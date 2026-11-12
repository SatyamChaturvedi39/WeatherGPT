"""
T+24h point forecast blends XGBoost with persistence using the trained weight (offline).
"""

import numpy as np

from app.api.forecast import blended_t24_point, get_all_ml_models


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
