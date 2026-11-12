"""
T+24h point forecast blends XGBoost with persistence using the trained weight (offline).
"""

import numpy as np

from app.api.forecast import blended_t24_point, get_all_ml_models, t24_point_forecast


class _Model:
    def __init__(self, value):
        self.value = value

    def predict(self, x):
        return np.array([self.value])


def test_blend_formula():
    models = {"point": _Model(30.0), "blend_weight": 0.55}
    blended, raw = blended_t24_point(models, None, current_temp=20.0)
    assert raw == 30.0
    assert abs(blended - (0.55 * 30.0 + 0.45 * 20.0)) < 1e-9


def test_missing_weight_falls_back_to_raw_model():
    blended, raw = blended_t24_point({"point": _Model(25.0)}, None, current_temp=10.0)
    assert blended == raw == 25.0


def test_trained_artifacts_load_blend_and_calibration():
    models = get_all_ml_models()
    assert models is not None
    assert 0.0 <= models["blend_weight"] <= 1.0
    assert models["calibration"]["margin_c"] > 0


def test_nwp_model_used_when_nwp_available():
    models = {
        "nwp_model": _Model(0.5),  # residual over the corrected NWP
        "nwp_config": {"persistence_blend_weight": 0.65, "bias_window_days": 14},
        "point": _Model(99.0),
        "blend_weight": 0.55,
    }
    x = np.zeros((1, 3))
    out = t24_point_forecast(models, x, current_temp=20.0, nwp={"raw_c": 23.0, "bias_c": 1.0, "corrected_c": 22.0})
    assert out["method"] == "nwp_corrected"
    assert abs(out["value"] - (0.65 * (22.0 + 0.5) + 0.35 * 20.0)) < 1e-9


def test_falls_back_to_station_blend_without_nwp():
    models = {"nwp_model": _Model(0.5), "nwp_config": {"persistence_blend_weight": 0.65, "bias_window_days": 14},
              "point": _Model(30.0), "blend_weight": 0.55}
    out = t24_point_forecast(models, None, current_temp=20.0, nwp=None)
    assert out["method"] == "station_blend"
    assert abs(out["value"] - (0.55 * 30.0 + 0.45 * 20.0)) < 1e-9


def test_trained_nwp_model_loads():
    models = get_all_ml_models()
    assert models["nwp_model"] is not None
    assert models["nwp_config"]["bias_window_days"] in (7, 14)
    assert len(models["nwp_config"]["features"]) == len(models["feature_names"]) + 1


def test_interval_centred_on_published_value_with_nwp_model():
    from app.api.forecast import t24_interval

    models = {"calibration": {"margin_c": 0.21, "calibrated_coverage_pct": 82.1, "quantile_index": 1, "validation_size": 2},
              "nwp_config": {"conformal_interval_80_margin_c": 1.2, "conformal_interval_80_test_coverage_pct": 81.8}}
    iv = t24_interval(models, {"method": "nwp_corrected"}, published=11.0, q10=16.0, q90=19.0)
    assert iv["calibrated_lower_c"] == 9.8 and iv["calibrated_upper_c"] == 12.2
    assert iv["calibrated_lower_c"] <= 11.0 <= iv["calibrated_upper_c"]
    fallback = t24_interval(models, {"method": "station_blend"}, published=17.0, q10=16.0, q90=19.0)
    assert fallback["calibrated_lower_c"] == 15.79 and fallback["method"] == "conformal_station_quantiles"


def test_training_domain_flag():
    from app.api.forecast import training_domain

    assert training_domain(12.97, 77.6)["in_domain"]
    assert not training_domain(40.71, -74.0)["in_domain"]
