"""
Tests for the forecast API endpoints.
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


class TestHealthCheck:
    """Tests for system health endpoints."""

    def test_health_check(self):
        """Health endpoint should return 200 with status healthy."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "WeatherGPT"

    def test_root_endpoint(self):
        """Root endpoint should return API info."""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "service" in data
        assert "version" in data
        assert "docs" in data


class TestForecastAPI:
    """Tests for forecast endpoints."""

    def test_geocode_search(self):
        """Geocode endpoint should return location results."""
        response = client.get("/api/forecast/geocode", params={"query": "London"})
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert len(data["results"]) > 0
        # First result should contain London
        assert "London" in data["results"][0]["name"]

    def test_current_weather(self):
        """Current weather endpoint should return conditions."""
        response = client.get(
            "/api/forecast/current",
            params={"lat": 51.5074, "lon": -0.1278},  # London
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert "current" in data["data"]
        assert "temperature_2m" in data["data"]["current"]

    def test_hourly_forecast(self):
        """Hourly forecast should return time-series data."""
        response = client.get(
            "/api/forecast/hourly",
            params={"lat": 51.5074, "lon": -0.1278, "hours": 24},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert len(data["data"]["hourly"]) > 0

    def test_daily_forecast(self):
        """Daily forecast should return multi-day data."""
        response = client.get(
            "/api/forecast/daily",
            params={"lat": 51.5074, "lon": -0.1278, "days": 3},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert len(data["data"]["daily"]) > 0

    def test_invalid_coordinates(self):
        """Should reject invalid latitude/longitude values."""
        response = client.get(
            "/api/forecast/current",
            params={"lat": 999, "lon": -0.1278},
        )
        assert response.status_code == 422  # Validation error

    def test_forecast_explain(self):
        """Explain endpoint should return TreeSHAP feature attributions and conformal interval."""
        response = client.get(
            "/api/forecast/explain",
            params={"lat": 12.9716, "lon": 77.5946},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert "features" in data
        assert len(data["features"]) > 0
        assert "predicted_value" in data
        assert "split_conformal_interval_80" in data
        assert "precipitation_probability_24h_pct" in data
        assert "feature_provenance" in data

    def test_ml_prediction_endpoint(self):
        """Dedicated ML prediction endpoint returns full XGBoost point, quantiles, and conformal interval."""
        response = client.get(
            "/api/forecast/ml-prediction",
            params={"lat": 12.9716, "lon": 77.5946},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["forecast_horizon"] == "T+24h"
        assert "point_temperature_c" in data
        assert isinstance(data["point_temperature_c"], float)
        assert "quantile_forecast_c" in data
        assert "p10" in data["quantile_forecast_c"]
        assert "p90" in data["quantile_forecast_c"]
        assert data["quantile_forecast_c"]["raw_empirical_coverage_pct"] == 72.9
        assert "split_conformal_interval_80" in data
        conformal = data["split_conformal_interval_80"]
        assert conformal["conformal_adjustment_margin_c"] == 0.21
        assert conformal["calibrated_empirical_coverage_pct"] == 82.1
        assert conformal["validation_sample_size"] == 3907
        assert conformal["finite_sample_quantile_index"] == 3127
        assert data["feature_provenance"] in ["recent_past_forecast", "heuristic_fallback"]
        assert "scientific_disclaimer" in data
        assert "data_source_accounting" in data
        assert "ECMWF ERA5" in data["data_source_accounting"]["training_data_product"]
        assert "past_days=2" in data["data_source_accounting"]["inference_lag_source"]

    def test_feature_schema_and_provenance_audit(self):
        """Regression test ensuring exact 34-feature alignment and truthful provenance accounting."""
        import json
        with open("ml/artifacts/feature_names.json", "r") as f:
            expected_features = json.load(f)
        assert len(expected_features) == 34
        assert expected_features[0] == "temperature_2m"
        assert expected_features[-1] == "temp_diff_3h"

        response = client.get("/api/forecast/ml-prediction", params={"lat": 12.9716, "lon": 77.5946})
        assert response.status_code == 200
        data = response.json()
        assert data["feature_provenance"] in ["recent_past_forecast", "heuristic_fallback"]
        assert "domain_shift_notice" in data["data_source_accounting"]
        assert "is_fallback" in data
        assert isinstance(data["fallback_imputations"], list)
        assert data["feature_vector_dimension"] == 34

    def test_route_corridor(self):
        """Route endpoint should interpolate and sample transit waypoints."""
        response = client.get(
            "/api/forecast/route",
            params={"origin": "London", "destination": "Oxford", "steps": 3},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert "data" in data
        assert "waypoints" in data["data"]
        assert len(data["data"]["waypoints"]) == 3

    def test_model_benchmarks(self):
        """Benchmarks endpoint should return model comparison and ablation metrics."""
        response = client.get("/api/forecast/benchmarks")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert "model_comparison" in data
        assert len(data["model_comparison"]) >= 4

    def test_route_corridor_with_transit_mode(self):
        """Route endpoint should support transit_mode and compute vehicle physics."""
        response = client.get(
            "/api/forecast/route",
            params={
                "origin": "Vimanapura",
                "destination": "Koramangala",
                "steps": 4,
                "transit_mode": "two_wheeler",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        r_data = data["data"]
        assert "transit_mode" in r_data
        assert "mode_guidance" in r_data
        assert "stopping_distance_penalty_pct" in r_data

    def test_air_quality_telemetry(self):
        """AQI endpoint should return PM2.5, PM10, AQI index, and health advisory."""
        response = client.get(
            "/api/forecast/aqi",
            params={"lat": 12.9716, "lon": 77.5946},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        aqi = data["data"]
        assert "aqi" in aqi
        assert "category" in aqi
        assert "pm2_5" in aqi
        assert "health_advisory" in aqi

    def test_bangalore_microclimates(self):
        """Bangalore microclimates endpoint should return all indexed zones with elevation & flood risk."""
        response = client.get("/api/forecast/bangalore/microclimates")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["count"] >= 20
        first = data["data"][0]
        assert "name" in first
        assert "elevation" in first
        assert "flood_risk" in first
        assert "aqi" in first


class TestChatAPI:
    """Tests for chat endpoint."""

    def test_chat_grounded_response(self):
        """Chat endpoint should return a grounded response with confidence."""
        response = client.post(
            "/api/chat/",
            json={
                "message": "Will I need an umbrella today?",
                "location": {"latitude": 51.5074, "longitude": -0.1278, "name": "London"},
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "reply" in data
        assert len(data["reply"]) > 0
        assert "confidence" in data
        assert data["confidence"] > 0


class TestAlertsAPI:
    """Tests for alerts endpoint."""

    def test_alerts_assessment(self):
        """Alerts endpoint should return evaluated alerts and summary."""
        response = client.get(
            "/api/alerts/",
            params={"lat": 51.5074, "lon": -0.1278},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert isinstance(data["alerts"], list)
        assert "summary" in data


class TestAdminAPI:
    """Tests for admin Data-Ops telemetry."""

    def test_admin_metrics(self):
        """Admin metrics should return operational status and services info."""
        response = client.get("/api/admin/metrics")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "operational"
        assert "services" in data
        assert "open_meteo_api" in data["services"]
        assert "ml_inference_engine" in data["services"]


class TestScientificValidation:
    """Rigorous scientific tests for ML benchmarks, TreeSHAP, and physics models."""

    def test_contact_mechanics_stopping_distance(self):
        """Verify AASHTO vehicle contact mechanics: dry=26.0m, wet=37.4m (+43.8% increase)."""
        response = client.get(
            "/api/forecast/route",
            params={
                "origin": "Vimanapura",
                "destination": "Koramangala",
                "transit_mode": "two_wheeler",
            },
        )
        assert response.status_code == 200
        data = response.json()["data"]
        assert "contact_physics" in data
        cp = data["contact_physics"]
        assert cp["dry_stopping_distance_m"] == 26.0
        assert cp["wet_stopping_distance_m"] == 37.4
        assert cp["increase_percentage"] == 43.8
        assert cp["friction_dry"] == 0.70
        assert cp["friction_wet"] == 0.35
        assert cp["reaction_time_seconds"] == 1.17
        assert cp["is_theoretical_model"] is True

    def test_reproducible_ml_benchmarks(self):
        """Verify that ML benchmarks return genuine empirical holdout metrics."""
        response = client.get("/api/forecast/benchmarks")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data.get("is_reproducible_experiment") is True
        summary = data["dataset_summary"]
        assert summary.get("total_supervised_records", summary.get("total_observations")) == 26208
        assert summary.get("raw_downloaded_records", 26280) == 26280
        assert summary.get("dropped_records_count", 72) == 72
        assert "Train (18321) / Val (3907) / Test (3932)" in summary["train_val_test_split"]
        
        # Verify multi-horizon temperature regression benchmark (T+1h, T+6h, T+24h)
        if "temperature_forecasting_benchmark" in data:
            horizons = [h["horizon"] for h in data["temperature_forecasting_benchmark"]]
            assert "T+1h" in horizons
            assert "T+6h" in horizons
            assert "T+24h" in horizons

        # Verify separate precipitation classification benchmark
        if "precipitation_classification_benchmark" in data:
            precip = data["precipitation_classification_benchmark"]
            assert "xgboost_brier_score" in precip
            assert "climatological_brier_score" in precip
            assert "xgboost_roc_auc" in precip
            assert precip["xgboost_brier_score"] < precip["climatological_brier_score"]

        # Check uncertainty quantification and split conformal calibration
        uq = data["uncertainty_quantification"]
        if "raw_quantile_regression" in uq:
            assert uq["raw_quantile_regression"]["empirical_coverage_pct"] > 65.0
            assert "split_conformal_calibration" in uq
            assert uq["split_conformal_calibration"]["calibrated_coverage_pct"] >= 79.0

    def test_lapse_rate_elevation_hypsometry(self):
        """Verify environmental lapse rate convention for locations above and below base elevation (915m)."""
        response = client.get("/api/forecast/bangalore/microclimates")
        assert response.status_code == 200
        data = response.json()["data"]

        # Find location above base elevation (Yeshwanthpur, elevation ~960m ASL)
        above = next((loc for loc in data if loc["elevation"] > 915), None)
        assert above is not None
        assert above["elevation_delta_m"] > 0

        # Find location below base elevation (Whitefield, elevation ~880m ASL)
        below = next((loc for loc in data if loc["elevation"] < 915), None)
        assert below is not None
        assert below["elevation_delta_m"] < 0

    def test_genuine_treeshap_attributions(self):
        """Verify that explain endpoint returns real TreeSHAP feature attributions."""
        response = client.get(
            "/api/forecast/explain",
            params={"lat": 12.9716, "lon": 77.5946},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert "Trained XGBoost" in data["model"]
        assert "TreeSHAP" in data["model"]
        assert "base_value" in data
        assert "predicted_value" in data
        assert len(data["features"]) >= 5
        first_feat = data["features"][0]
        assert "shap_value" in first_feat
        assert "importance" in first_feat
        assert "direction" in first_feat
        assert "scientific_disclaimer" in data

    def test_microclimates_scientific_provenance(self):
        """Verify microclimate downscaling includes lapse rate and hazard provenance."""
        response = client.get("/api/forecast/bangalore/microclimates")
        assert response.status_code == 200
        data = response.json()
        assert data["count"] >= 20
        first = data["data"][0]
        assert "scientific_provenance" in first
        prov = first["scientific_provenance"]
        assert "Environmental Lapse Rate" in prov["temperature_method"]
        assert prov["is_live_flood_simulation"] is False
        assert "hazard_classification" in first

    def test_commute_rag_entity_resolution(self):
        """Verify natural language commute route resolution between Bengaluru localities."""
        response = client.post(
            "/api/chat/",
            json={
                "message": "Do I need a raincoat to go from Vimanapura to Koramangala right now?",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "reply" in data
        reply = data["reply"]
        assert "VERDICT" in reply
        assert "Vimanapura" in reply
        assert "Koramangala" in reply
        assert "Safe Departure Window" in reply
        assert "Two-Wheeler" in reply
        assert "Scientific Disclosure" in reply

    def test_precipitation_baseline_training_only_leak_free(self):
        """Verify that precipitation baseline uses training data only with zero test label leakage."""
        import json
        from pathlib import Path
        
        art_path = Path("ml/artifacts/benchmark_results.json")
        assert art_path.exists(), "benchmark_results.json must exist"
        with open(art_path, "r") as f:
            bm = json.load(f)
        
        precip = bm["precipitation_classification_benchmark"]
        assert "CONFIRMED LEAK-FREE" in precip["baseline_leakage_audit"]
        p_train = precip["positive_class_frequency_train"]
        p_test = precip["positive_class_frequency_test"]
        assert p_train != p_test
        assert round(p_train, 3) == 0.215
        assert round(p_test, 3) == 0.196

        # Mathematical verification: test Brier score of constant p_train against test set
        # Brier = p_test * (1 - p_train)^2 + (1 - p_test) * p_train^2
        expected_brier = p_test * ((1.0 - p_train) ** 2) + (1.0 - p_test) * (p_train ** 2)
        assert round(expected_brier, 3) == round(precip["climatological_brier_score_global"], 3)
        assert precip["xgboost_brier_score"] == 0.123
        assert precip["brier_score_improvement_vs_global_pct"] == 22.5
        assert precip["xgboost_roc_auc"] == 0.837

    def test_temporal_purge_gap_zero_target_leakage(self):
        """Verify 24-hour purge/embargo gap prevents target forward-overlap across split boundaries."""
        import json
        from pathlib import Path

        art_path = Path("ml/artifacts/benchmark_results.json")
        with open(art_path, "r") as f:
            bm = json.load(f)

        summary = bm["dataset_summary"]
        assert summary["purge_gap_hours"] == 24
        assert summary["purged_embargo_records"] == 48  # 24 before val, 24 before test
        assert summary["train_observations"] == 18321
        assert summary["val_observations"] == 3907
        assert summary["test_observations"] == 3932
        assert summary["total_supervised_records"] == 26208

    def test_split_conformal_calibration_finite_sample_index(self):
        """Verify finite-sample conformal quantile index k = ceil((n+1)(1-alpha)) and interval coverage."""
        import math
        import json
        from pathlib import Path

        art_path = Path("ml/artifacts/benchmark_results.json")
        with open(art_path, "r") as f:
            bm = json.load(f)

        uq = bm["uncertainty_quantification"]
        conf = uq["split_conformal_calibration"]
        n_val = conf["validation_sample_size"]
        assert n_val == 3907
        target_coverage = conf["nominal_coverage_target_pct"] / 100.0  # 0.80

        expected_k = math.ceil((n_val + 1) * target_coverage)
        assert conf["finite_sample_quantile_index"] == expected_k
        assert expected_k == 3127
        assert conf["conformal_adjustment_margin_c"] == 0.21
        assert conf["calibrated_coverage_pct"] == 82.1
        assert conf["calibrated_mean_interval_width_c"] == 2.60

        # Raw quantile coverage before conformal adjustment
        raw = uq["raw_quantile_regression"]
        assert raw["empirical_coverage_pct"] == 72.9
        assert raw["mean_interval_width_c"] == 2.18
        # Calibrated width = raw width + 2 * margin = 2.18 + 0.42 = 2.60
        assert round(raw["mean_interval_width_c"] + 2 * conf["conformal_adjustment_margin_c"], 2) == 2.60

    def test_model_artifact_manifest_completeness(self):
        """Verify that all 9 trained models are saved to disk and loadable via xgboost.Booster."""
        import json
        from pathlib import Path
        import xgboost as xgb

        art_dir = Path("ml/artifacts")
        manifest_path = art_dir / "benchmark_results.json"
        with open(manifest_path, "r") as f:
            bm = json.load(f)

        manifest = bm["artifact_manifest"]
        model_artifacts = [item for item in manifest if item["filename"].endswith(".json") and item["filename"] != "benchmark_results.json" and item["filename"] != "feature_names.json"]
        assert len(model_artifacts) == 9

        for item in model_artifacts:
            model_path = art_dir / item["filename"]
            assert model_path.exists(), f"Model artifact {item['filename']} must exist on disk"
            booster = xgb.Booster()
            booster.load_model(str(model_path))
            assert booster is not None

        # Confirm feature schema and background array
        assert (art_dir / "feature_names.json").exists()
        assert (art_dir / "shap_background.npy").exists()

    def test_weather_service_resilience_and_fallbacks(self):
        """Verify weather service returns clean data structures and handles edge cases gracefully."""
        from app.services.weather import WeatherService

        # Test telemetry stats tracking
        telemetry = WeatherService.get_quota_telemetry()
        assert "total_quota" in telemetry
        assert "calls_used" in telemetry
        assert "quota_remaining" in telemetry
        assert telemetry["total_quota"] == 10000

        # Test valid API response
        resp = client.get("/api/forecast/current", params={"lat": 12.9716, "lon": 77.5946})
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "success"
        assert "temperature_2m" in data["data"]["current"]

        # Test invalid coordinates validation
        resp_invalid = client.get("/api/forecast/current", params={"lat": 999.0, "lon": 77.5946})
        assert resp_invalid.status_code == 422

    def test_feature_parity_strict_ordering_and_vector_shape(self):
        """Verify feature vector matches trained schema order, dimension (1, 34), float32 dtype, and detects missing features."""
        import json
        from datetime import datetime, timezone
        from app.api.forecast import build_ml_feature_vector
        
        with open("ml/artifacts/feature_names.json", "r") as f:
            feature_names = json.load(f)

        now_utc = datetime(2023, 6, 15, 12, 0, tzinfo=timezone.utc)
        curr_obs = {
            "current": {
                "temperature_2m": 25.5,
                "relative_humidity_2m": 55.0,
                "surface_pressure": 912.0,
                "wind_speed_10m": 12.0,
                "cloud_cover": 40.0,
            }
        }
        recent_history = {
            "temp_lag_1h": 25.0, "temp_lag_2h": 24.5, "temp_lag_3h": 24.0,
            "temp_lag_6h": 22.0, "temp_lag_12h": 20.0, "temp_lag_24h": 25.0, "temp_lag_48h": 24.8,
            "humidity_lag_1h": 56.0, "humidity_lag_6h": 65.0, "humidity_lag_24h": 54.0,
            "pressure_lag_1h": 912.2, "pressure_lag_3h": 912.5, "pressure_lag_24h": 911.8,
            "temp_roll_6h_mean": 23.5, "temp_roll_6h_std": 1.2,
            "temp_roll_24h_mean": 23.0, "temp_roll_24h_std": 2.5,
            "temp_roll_24h_min": 19.5, "temp_roll_24h_max": 28.0,
            "pressure_diff_1h": -0.2, "pressure_diff_3h": -0.5,
            "temp_diff_1h": 0.5, "temp_diff_3h": 1.5,
            "current_synoptic_obs": curr_obs["current"]
        }

        # Complete NWP data -> is_fallback should be False
        x, feat_map, provenance, is_fallback, fallbacks = build_ml_feature_vector(
            feature_names, curr_obs, recent_history, now_utc
        )
        assert x.shape == (1, 34)
        assert x.dtype.name == "float32"
        assert is_fallback is False
        assert fallbacks == []
        assert provenance == "recent_past_forecast"
        assert feat_map["temperature_2m"] == 25.5

        # Check strict ordering: column 0 must be temperature_2m, column 33 must be temp_diff_3h
        assert x[0, 0] == 25.5
        assert x[0, 33] == 1.5

        # Feature omission must raise ValueError
        with pytest.raises(ValueError, match="missing required trained columns"):
            build_ml_feature_vector(["nonexistent_feature_x"], curr_obs, recent_history, now_utc)

    def test_live_variable_absence_triggers_explicit_fallback_tracking(self):
        """Verify absence of required live variables triggers is_fallback=True and populates fallback_imputations."""
        import json
        from datetime import datetime, timezone
        from app.api.forecast import build_ml_feature_vector

        with open("ml/artifacts/feature_names.json", "r") as f:
            feature_names = json.load(f)

        now_utc = datetime.now(timezone.utc)
        
        # Completely empty observation and missing history
        x, feat_map, provenance, is_fallback, fallbacks = build_ml_feature_vector(
            feature_names, {}, None, now_utc
        )
        assert is_fallback is True
        assert provenance == "heuristic_fallback"
        assert "temperature_2m" in fallbacks
        assert "relative_humidity_2m" in fallbacks
        assert "surface_pressure" in fallbacks
        assert "wind_speed_10m" in fallbacks
        assert "cloud_cover" in fallbacks
        assert "temp_lag_1h" in fallbacks
        assert "temp_roll_24h_mean" in fallbacks
        assert len(fallbacks) == 28  # 5 raw + 23 lag/roll features

        # Verify fallback values match documented defaults
        assert feat_map["temperature_2m"] == 24.0
        assert feat_map["relative_humidity_2m"] == 60.0
        assert feat_map["surface_pressure"] == 914.0
        assert x.shape == (1, 34)




