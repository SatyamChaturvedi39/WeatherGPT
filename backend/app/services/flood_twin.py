"""
Flood-Risk Digital Twin for the Bengaluru microclimate registry.

Turns the synoptic rain forecast into a per-zone *impact* forecast: the
probability that roads in each zone become waterlogged over the next hours.

Pipeline (per zone, per Monte Carlo member):
  1. Rain sampling — each forecast hour is sampled as a rain/no-rain event
     (Bernoulli on the NWP precipitation probability) with a lognormal
     intensity around the conditional rain rate. This propagates forecast
     uncertainty instead of using a single deterministic number.
  2. Surface-water bucket — a linear-reservoir ponding model:
         S_t = (1 - k) * S_{t-1} + max(0, c * f * P_t - D)
     where c is the impervious runoff coefficient, f the lateral basin inflow
     factor (low-lying zones collect upslope runoff), D the stormwater drain
     capacity implied by the zone's historical vulnerability class, and k the
     hourly recession (drain-down) rate of water already ponded. Runoff the
     drains cannot carry overflows onto the road surface.
  3. Impact thresholds — ponded excess is mapped to road water depth and
     scored against two-wheeler thresholds (5 cm waterlogging, 15 cm stall).

Calibration constants below are documented heuristics derived from the BBMP /
CAG 2021 stormwater audit vulnerability classes, not a hydrodynamic model.
They are the quantities the crowd-sourced feedback loop corrects at runtime:
crowd reports shift the rain probability (log-odds bias) and set the initial
ponded storage S_0 (state assimilation) before the simulation starts.
"""

from __future__ import annotations

import math
import statistics

import numpy as np

# Stormwater drain capacity (mm/h of rain the network clears) per vulnerability class
DRAIN_CAPACITY_MM_H = {
    "Low": 22.0,
    "Moderate": 14.0,
    "High": 9.0,
    "Severe": 6.0,
    "Critical": 4.0,
}

# Fraction of rainfall that becomes surface runoff (impervious urban cover)
RUNOFF_COEFFICIENT = 0.80
DENSE_CORRIDOR_RUNOFF = 0.90
DENSE_CORRIDOR_KEYS = ("whitefield", "electronic city", "bellandur", "marathahalli", "silk board", "mg road")

# Hourly fraction of ponded water that drains away once rain eases
RECESSION_RATE = 0.35

# Lateral inflow: each 20 m below the city median elevation adds 25% upslope runoff (capped)
BASIN_INFLOW_PER_20M = 0.25
BASIN_INFLOW_CAP = 1.6

# Ponded excess (mm over zone) -> road water depth (cm) at low points
DEPTH_CM_PER_MM_EXCESS = 0.6

# Impact thresholds for two-wheeler traffic
WATERLOG_DEPTH_CM = 5.0
SEVERE_DEPTH_CM = 15.0

# Rain intensity spread around the conditional rate (lognormal sigma)
INTENSITY_SIGMA = 0.75
# Median intensity assumed when NWP gives a rain chance but zero accumulation
TRACE_RAIN_MEDIAN_MM = 0.5

DEFAULT_SAMPLES = 400

# Log-odds corrections start from at least this probability: an NWP "0%" is not certainty
PROB_FLOOR = 0.05


def _logit(p: float) -> float:
    p = min(max(p, 1e-4), 1 - 1e-4)
    return math.log(p / (1 - p))


def _sigmoid(x: float) -> float:
    return 1.0 / (1.0 + math.exp(-x))


def apply_logit_bias(p: float, bias: float) -> float:
    """Shift a probability by an additive bias in log-odds space."""
    if bias == 0.0:
        return p
    return _sigmoid(_logit(p) + bias)


def unique_zones(registry: dict) -> list[dict]:
    """Collapse registry aliases (e.g. 'hal', 'hsr') into one entry per locality."""
    seen = set()
    zones = []
    for key, loc in registry.items():
        if loc["name"] in seen:
            continue
        seen.add(loc["name"])
        zones.append({"id": key, **loc})
    return zones


def zone_hydrology(zone: dict, median_elevation: float) -> dict:
    """Static hydrological parameters for one zone."""
    capacity = DRAIN_CAPACITY_MM_H.get(zone.get("flood_risk", "Moderate"), DRAIN_CAPACITY_MM_H["Moderate"])
    runoff = DENSE_CORRIDOR_RUNOFF if any(k in zone["id"] for k in DENSE_CORRIDOR_KEYS) else RUNOFF_COEFFICIENT
    depression_m = max(0.0, median_elevation - zone["elevation"])
    inflow = min(BASIN_INFLOW_CAP, 1.0 + BASIN_INFLOW_PER_20M * depression_m / 20.0)
    return {
        "drain_capacity_mm_h": capacity,
        "runoff_coefficient": runoff,
        "basin_inflow_factor": round(inflow, 3),
    }


def sample_rain(
    hourly: list[dict],
    n_samples: int,
    rng: np.random.Generator,
    rain_prob_bias: float = 0.0,
    scenario_mm: float = 0.0,
) -> np.ndarray:
    """
    Draw an (n_samples, hours) matrix of hourly rain totals in mm.

    `rain_prob_bias` shifts each hour's rain probability in log-odds space
    (used by the crowd correction). `scenario_mm` injects a hypothetical
    cloudburst into the next hour for what-if simulation.
    """
    hours = len(hourly)
    rain = np.zeros((n_samples, hours))
    for h, point in enumerate(hourly):
        p = (point.get("precipitation_probability") or 0) / 100.0
        amount = point.get("precipitation") or 0.0
        if amount > 0 and p == 0:
            p = 1.0  # NWP reports accumulation without a probability: treat as observed rain
        # Forecast accumulation is roughly an expectation, so the rain rate *given* rain is higher.
        # Computed from the NWP probability: crowd evidence changes how likely rain is, not how hard it falls.
        conditional = amount / max(p, 0.1) if amount > 0 else TRACE_RAIN_MEDIAN_MM
        if rain_prob_bias > 0.0:
            p = apply_logit_bias(max(p, PROB_FLOOR), rain_prob_bias)
        elif rain_prob_bias < 0.0 and p > 0:
            p = apply_logit_bias(p, rain_prob_bias)
        if p <= 0:
            continue
        wet = rng.random(n_samples) < p
        intensity = conditional * rng.lognormal(0.0, INTENSITY_SIGMA, n_samples)
        rain[:, h] = np.where(wet, intensity, 0.0)
    if scenario_mm > 0 and hours > 1:
        rain[:, 1] += scenario_mm
    return rain


def simulate_depth(rain: np.ndarray, hydrology: dict, initial_storage_mm: float = 0.0) -> np.ndarray:
    """Run the linear-reservoir ponding model; returns road water depth in cm."""
    n, hours = rain.shape
    storage = np.full(n, initial_storage_mm)
    depth = np.zeros((n, hours))
    gain = hydrology["runoff_coefficient"] * hydrology["basin_inflow_factor"]
    capacity = hydrology["drain_capacity_mm_h"]
    for h in range(hours):
        overflow = np.maximum(0.0, gain * rain[:, h] - capacity)
        storage = (1 - RECESSION_RATE) * storage + overflow
        depth[:, h] = storage * DEPTH_CM_PER_MM_EXCESS
    return depth


def risk_level(p_waterlog: float, p_severe: float) -> str:
    if p_severe >= 0.3:
        return "Severe"
    if p_waterlog >= 0.5:
        return "Warning"
    if p_waterlog >= 0.2:
        return "Watch"
    return "Clear"


def run_flood_twin(
    zones: list[dict],
    hourly: list[dict],
    scenario_mm: float = 0.0,
    n_samples: int = DEFAULT_SAMPLES,
    seed: int = 42,
    corrections: dict[str, dict] | None = None,
) -> dict:
    """
    Simulate waterlogging risk for every zone across the forecast hours.

    `corrections` maps zone id -> {"rain_bias": float, "initial_storage_mm": float}
    learned from crowd reports: a log-odds offset on rain probability and the
    assimilated ponded water already on the ground.
    """
    corrections = corrections or {}
    median_elev = statistics.median(z["elevation"] for z in zones)
    results = []

    for idx, zone in enumerate(zones):
        # Independent stream per zone, so correcting one zone never reshuffles another's samples
        rng = np.random.default_rng([seed, idx])
        hydro = zone_hydrology(zone, median_elev)
        corr = corrections.get(zone["id"], {})
        rain_bias = corr.get("rain_bias", 0.0)
        storage0 = corr.get("initial_storage_mm", 0.0)

        rain = sample_rain(hourly, n_samples, rng, rain_prob_bias=rain_bias, scenario_mm=scenario_mm)
        depth = simulate_depth(rain, hydro, initial_storage_mm=storage0)

        timeline = []
        for h, point in enumerate(hourly):
            col = depth[:, h]
            p_wl = float(np.mean(col >= WATERLOG_DEPTH_CM))
            p_sv = float(np.mean(col >= SEVERE_DEPTH_CM))
            p10, p50, p90 = np.percentile(col, [10, 50, 90])
            timeline.append({
                "time": point.get("time"),
                "rain_forecast_mm": round(float(point.get("precipitation") or 0.0), 2),
                "rain_probability": int(point.get("precipitation_probability") or 0),
                "rain_sampled_mean_mm": round(float(rain[:, h].mean()), 2),
                "p_waterlog": round(p_wl, 3),
                "p_severe": round(p_sv, 3),
                "depth_cm": {"p10": round(float(p10), 1), "p50": round(float(p50), 1), "p90": round(float(p90), 1)},
                "level": risk_level(p_wl, p_sv),
            })

        peak = max(timeline, key=lambda t: t["p_waterlog"])
        results.append({
            "id": zone["id"],
            "name": zone["name"],
            "zone": zone["zone"],
            "latitude": zone["latitude"],
            "longitude": zone["longitude"],
            "elevation": zone["elevation"],
            "vulnerability": zone["flood_risk"],
            "hydrology": hydro,
            "correction": {
                "rain_bias": round(rain_bias, 3),
                "initial_storage_mm": round(storage0, 2),
                "n_reports": corr.get("n_reports", 0),
            },
            "timeline": timeline,
            "peak": {"time": peak["time"], "p_waterlog": peak["p_waterlog"], "level": peak["level"]},
        })

    city = []
    for h, point in enumerate(hourly):
        levels = [z["timeline"][h]["level"] for z in results]
        city.append({
            "time": point.get("time"),
            "zones_watch": levels.count("Watch"),
            "zones_warning": levels.count("Warning"),
            "zones_severe": levels.count("Severe"),
        })

    results.sort(key=lambda z: -z["peak"]["p_waterlog"])
    return {
        "zones": results,
        "city_timeline": city,
        "parameters": {
            "monte_carlo_samples": n_samples,
            "scenario_cloudburst_mm": scenario_mm,
            "waterlog_threshold_cm": WATERLOG_DEPTH_CM,
            "severe_threshold_cm": SEVERE_DEPTH_CM,
            "recession_rate_per_h": RECESSION_RATE,
            "intensity_sigma": INTENSITY_SIGMA,
            "median_elevation_m": median_elev,
            "model": "Monte Carlo rain ensemble -> linear-reservoir ponding (S_t = (1-k)S_{t-1} + max(0, c*f*P_t - D))",
        },
    }
