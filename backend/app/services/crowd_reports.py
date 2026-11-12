"""
Crowd-sourced ground truth and online model correction.

Citizens report what they see ("dry", "raining", "heavy rain", "waterlogged").
Reports are stored in a small SQLite table and assimilated into the flood twin
on every request:

  * Rain-occurrence bias (parameter correction): an online logistic-regression
    update in log-odds space. Reports are replayed in time order; each one
    nudges the bias of every zone within reach by
        b_j <- b_j + lr * w_space(d_ij) * (y - sigmoid(logit(p_model) + b_j))
    and biases relax back toward 0 with an e-folding time of BIAS_TAU_H, so the
    model returns to the NWP forecast when reports stop.

  * Ponded-water state (state assimilation): "waterlogged" and "dry" reports
    observe the surface-water bucket directly. Their observed storage is
    drained forward with the twin's recession rate to the present and combined
    as a distance-weighted average with a prior weight on the model's own
    state (0 mm), giving the initial storage S_0 for the simulation.
"""

from __future__ import annotations

import math
import sqlite3
import time
import uuid
from pathlib import Path

from app.services.flood_twin import (
    DEPTH_CM_PER_MM_EXCESS,
    PROB_FLOOR,
    RECESSION_RATE,
    apply_logit_bias,
)

# report_type -> (rain observed, ponded depth observed in cm or None if not informative)
REPORT_TYPES: dict[str, tuple[int, float | None]] = {
    "dry": (0, 0.0),
    "raining": (1, None),
    "heavy_rain": (1, None),
    "waterlogged": (1, 10.0),
}

# Reports older than this are ignored entirely
REPORT_WINDOW_H = 6.0
# Bias relaxes toward the uncorrected model with this e-folding time
BIAS_TAU_H = 2.0
LEARNING_RATE = 1.0
BIAS_CLIP = 4.0
# Spatial influence: Gaussian kernel on distance between report and zone centre
SPATIAL_SIGMA_KM = 2.0
MIN_SPATIAL_WEIGHT = 0.05
# Prior weight on the model's own (dry) ponding state when averaging observations
STORAGE_PRIOR_WEIGHT = 0.5
# Reports must fall within this distance of a registered zone
MAX_ZONE_DISTANCE_KM = 6.0
# One report per client per zone in this window
RATE_LIMIT_S = 600


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def nearest_zone(lat: float, lon: float, zones: list[dict]) -> tuple[dict | None, float]:
    best, best_d = None, float("inf")
    for z in zones:
        d = haversine_km(lat, lon, z["latitude"], z["longitude"])
        if d < best_d:
            best, best_d = z, d
    return best, best_d


class ReportStore:
    """SQLite-backed store for crowd reports."""

    def __init__(self, db_path: str):
        self.db_path = db_path
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS crowd_reports (
                    id TEXT PRIMARY KEY,
                    zone_id TEXT NOT NULL,
                    report_type TEXT NOT NULL,
                    latitude REAL NOT NULL,
                    longitude REAL NOT NULL,
                    client_id TEXT NOT NULL,
                    created_at REAL NOT NULL
                )
                """
            )
            conn.execute("CREATE INDEX IF NOT EXISTS idx_reports_time ON crowd_reports(created_at)")

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def add(self, zone_id: str, report_type: str, lat: float, lon: float, client_id: str, created_at: float | None = None) -> dict:
        row = {
            "id": uuid.uuid4().hex,
            "zone_id": zone_id,
            "report_type": report_type,
            "latitude": lat,
            "longitude": lon,
            "client_id": client_id,
            "created_at": created_at if created_at is not None else time.time(),
        }
        with self._connect() as conn:
            conn.execute(
                "INSERT INTO crowd_reports VALUES (:id, :zone_id, :report_type, :latitude, :longitude, :client_id, :created_at)",
                row,
            )
        return row

    def last_from_client(self, client_id: str, zone_id: str) -> float | None:
        with self._connect() as conn:
            r = conn.execute(
                "SELECT MAX(created_at) AS t FROM crowd_reports WHERE client_id = ? AND zone_id = ?",
                (client_id, zone_id),
            ).fetchone()
        return r["t"] if r and r["t"] is not None else None

    def recent(self, since: float) -> list[dict]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM crowd_reports WHERE created_at >= ? ORDER BY created_at ASC", (since,)
            ).fetchall()
        return [dict(r) for r in rows]


def learn_corrections(
    reports: list[dict],
    zones: list[dict],
    model_rain_prob: float,
    now: float | None = None,
) -> dict[str, dict]:
    """
    Replay reports (oldest first) into per-zone corrections for the flood twin.

    `model_rain_prob` is the uncorrected NWP rain probability for the current hour.
    Returns zone id -> {"rain_bias", "initial_storage_mm", "n_reports"}.
    """
    now = now if now is not None else time.time()
    bias = {z["id"]: 0.0 for z in zones}
    last_t = None
    storage_num = {z["id"]: 0.0 for z in zones}
    storage_den = {z["id"]: STORAGE_PRIOR_WEIGHT for z in zones}
    n_reports = {z["id"]: 0 for z in zones}

    for rep in sorted(reports, key=lambda r: r["created_at"]):
        if rep["report_type"] not in REPORT_TYPES:
            continue
        age_h = (now - rep["created_at"]) / 3600.0
        if age_h > REPORT_WINDOW_H or age_h < 0:
            continue
        # Relax all biases toward zero for the time elapsed since the previous report
        if last_t is not None:
            decay = math.exp(-(rep["created_at"] - last_t) / 3600.0 / BIAS_TAU_H)
            bias = {k: v * decay for k, v in bias.items()}
        last_t = rep["created_at"]

        y_rain, depth_obs = REPORT_TYPES[rep["report_type"]]
        for z in zones:
            d = haversine_km(rep["latitude"], rep["longitude"], z["latitude"], z["longitude"])
            w = math.exp(-(d ** 2) / (2 * SPATIAL_SIGMA_KM ** 2))
            if w < MIN_SPATIAL_WEIGHT:
                continue
            zid = z["id"]
            n_reports[zid] += 1
            pred = apply_logit_bias(max(model_rain_prob, PROB_FLOOR), bias[zid])
            bias[zid] = max(-BIAS_CLIP, min(BIAS_CLIP, bias[zid] + LEARNING_RATE * w * (y_rain - pred)))

            if depth_obs is not None:
                # Drain the observed bucket forward to now with the twin's own recession rate
                storage_obs = depth_obs / DEPTH_CM_PER_MM_EXCESS * (1 - RECESSION_RATE) ** age_h
                storage_num[zid] += w * storage_obs
                storage_den[zid] += w

    if last_t is not None:
        decay = math.exp(-(now - last_t) / 3600.0 / BIAS_TAU_H)
        bias = {k: v * decay for k, v in bias.items()}

    return {
        zid: {
            "rain_bias": bias[zid],
            "initial_storage_mm": storage_num[zid] / storage_den[zid],
            "n_reports": n_reports[zid],
        }
        for zid in bias
        if n_reports[zid] > 0
    }
