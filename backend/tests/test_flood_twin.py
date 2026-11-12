"""
Tests for the Flood-Risk Digital Twin simulation (offline, no network).
"""

from app.services.flood_twin import (
    run_flood_twin,
    unique_zones,
    zone_hydrology,
    apply_logit_bias,
)
from app.services.weather import WeatherService

ZONES = unique_zones(WeatherService.BANGALORE_MICROCLIMATES)


def _hourly(precip: list[float], prob: list[int]) -> list[dict]:
    return [
        {"time": f"2026-11-12T{h:02d}:00", "precipitation": p, "precipitation_probability": q}
        for h, (p, q) in enumerate(zip(precip, prob))
    ]


class TestFloodTwin:

    def test_unique_zones_drops_aliases(self):
        names = [z["name"] for z in ZONES]
        assert len(names) == len(set(names))
        assert len(ZONES) >= 20

    def test_dry_forecast_has_no_waterlogging(self):
        out = run_flood_twin(ZONES, _hourly([0] * 6, [0] * 6))
        for zone in out["zones"]:
            assert all(t["p_waterlog"] == 0 for t in zone["timeline"])
            assert zone["peak"]["level"] == "Clear"

    def test_cloudburst_floods_vulnerable_zones_before_resilient_ones(self):
        out = run_flood_twin(ZONES, _hourly([0] * 6, [0] * 6), scenario_mm=30)
        by_id = {z["id"]: z for z in out["zones"]}
        silk_board = by_id["silk board"]["peak"]["p_waterlog"]
        rajajinagar = by_id["rajajinagar"]["peak"]["p_waterlog"]
        assert silk_board > 0.9
        assert silk_board > rajajinagar

    def test_low_lying_zone_collects_more_inflow(self):
        median = 905.0
        low = zone_hydrology({"id": "x", "elevation": 865, "flood_risk": "Low"}, median)
        high = zone_hydrology({"id": "y", "elevation": 940, "flood_risk": "Low"}, median)
        assert low["basin_inflow_factor"] > high["basin_inflow_factor"] == 1.0

    def test_water_drains_after_rain_stops(self):
        out = run_flood_twin(ZONES, _hourly([0] * 8, [0] * 8), scenario_mm=40)
        silk = next(z for z in out["zones"] if z["id"] == "silk board")
        depths = [t["depth_cm"]["p50"] for t in silk["timeline"]]
        assert depths[1] == max(depths)
        assert depths[-1] < depths[1]

    def test_simulation_is_reproducible(self):
        hourly = _hourly([4, 12, 6, 0], [60, 90, 70, 20])
        assert run_flood_twin(ZONES, hourly) == run_flood_twin(ZONES, hourly)

    def test_probability_bands_are_ordered(self):
        out = run_flood_twin(ZONES, _hourly([5, 15, 10, 2], [70, 95, 80, 40]))
        for zone in out["zones"]:
            for t in zone["timeline"]:
                d = t["depth_cm"]
                assert d["p10"] <= d["p50"] <= d["p90"]
                assert 0 <= t["p_severe"] <= t["p_waterlog"] <= 1

    def test_assimilated_storage_raises_risk(self):
        hourly = _hourly([3, 8, 4], [50, 70, 50])
        base = run_flood_twin(ZONES, hourly)
        corrected = run_flood_twin(ZONES, hourly, corrections={"koramangala": {"rain_bias": 0.0, "initial_storage_mm": 15.0}})
        p_base = next(z for z in base["zones"] if z["id"] == "koramangala")["peak"]["p_waterlog"]
        p_corr = next(z for z in corrected["zones"] if z["id"] == "koramangala")["peak"]["p_waterlog"]
        assert p_corr > p_base

    def test_positive_rain_bias_raises_risk(self):
        hourly = _hourly([2, 6, 3], [30, 40, 30])
        base = run_flood_twin(ZONES, hourly)
        corrected = run_flood_twin(ZONES, hourly, corrections={"silk board": {"rain_bias": 2.0}})
        p_base = next(z for z in base["zones"] if z["id"] == "silk board")["peak"]["p_waterlog"]
        p_corr = next(z for z in corrected["zones"] if z["id"] == "silk board")["peak"]["p_waterlog"]
        assert p_corr > p_base

    def test_logit_bias_is_monotonic_and_bounded(self):
        assert apply_logit_bias(0.3, 0.0) == 0.3
        assert 0.3 < apply_logit_bias(0.3, 1.0) < 1.0
        assert 0.0 < apply_logit_bias(0.3, -1.0) < 0.3
