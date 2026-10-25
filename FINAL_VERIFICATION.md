# WeatherGPT: Final Verification & Reproducibility Audit Log

> **CANONICAL FINAL EXECUTION LOG**:  
> This document records the final reproducible terminal executions, raw command outputs, live smoke tests, and verified artifact filesystem manifests for the WeatherGPT Bharat repository.

**Project**: WeatherGPT Bharat (MSc AI & ML Final-Year Capstone / System Project Development)  
**Evaluation Date**: October 2026  
**Environment**: Windows 11 / Python 3.12.10 / Node.js v20+ / React 18 / Vite 8.3.4  
**Repository Branch**: `repair/msc-scientific-validation`  

---

## 1. Automated Execution & Verification Summary

| Verification Stage | Command Executed | Outcome | Status |
| :--- | :--- | :--- | :---: |
| **1. Historical Data Ingestion** | `python ml/fetch_data.py` | Downloaded 26,280 hourly observations (2021-01-01 to 2023-12-31) to `data/bengaluru_hourly_2021_2023.csv` | **PASSED** |
| **2. Machine Learning Pipeline** | `python ml/train.py` | Trained 9 models with 24h purge gap, split conformal calibration, multi-horizon ablation, and TreeSHAP explainability | **PASSED** |
| **3. Backend Automated Tests** | `python -m pytest backend/tests/test_api.py -v` | Executed 31 automated integration, scientific, ML prediction, provenance, and leakage regression tests | **31 PASSED (100%)** |
| **4. Frontend Production Build** | `npm run build` (in `frontend/`) | Compiled React 18 production bundle via Vite in 1.92s | **PASSED** |
| **5. Live ML Prediction Smoke Test** | Direct FastAPI TestClient call | Live execution of `/api/forecast/ml-prediction` with live network call to Open-Meteo | **200 OK (PASSED)** |
| **6. Live TreeSHAP Explain Smoke Test** | Direct FastAPI TestClient call | Live execution of `/api/forecast/explain` with real Shapley attributions | **200 OK (PASSED)** |

---

## 2. Command Output Logs

### 2.1 ML Pipeline Execution (`python ml/train.py`)

```text
Loading and preparing dataset...
Raw downloaded rows: 26280
Dropped boundary rows (48h lag + 24h target shift): 72
Total usable supervised records: 26208

Chronological Holdout Split (with 24h Embargo Buffers):
  Train period: 2021-01-03 00:00:00 -> 2023-02-05 08:00:00 (18321 rows)
  Val period:   2023-02-06 09:00:00 -> 2023-07-19 03:00:00 (3907 rows)
  Test period:  2023-07-20 04:00:00 -> 2023-12-30 23:00:00 (3932 rows)
  Purged boundary rows: 48 rows (24 train-val gap, 24 val-test gap)

Training & Evaluating Multi-Horizon Forecasting Models...
  Horizon T+ 1h -> Pers MAE: 0.82°C | Clim MAE: 1.56°C | XGB MAE: 0.36°C (Gain vs Pers: +56.3%)
  Horizon T+ 6h -> Pers MAE: 4.03°C | Clim MAE: 1.56°C | XGB MAE: 0.80°C (Gain vs Pers: +80.2%)
  Horizon T+24h -> Pers MAE: 0.75°C | Clim MAE: 1.55°C | XGB MAE: 0.82°C (Gain vs Pers: -9.1%)

Training XGBoost Quantile Regressors (tau=0.10, 0.25, 0.50, 0.75, 0.90)...
  Raw 80% Prediction Interval:        Coverage = 72.9%, Mean Width = 2.18°C
  Split Conformal Adjustment:          Margin = +0.21°C (computed on validation data, k=3127/3907)
  Calibrated 80% Prediction Interval:  Coverage = 82.1%, Mean Width = 2.60°C

Training & Evaluating Probabilistic Precipitation Classifier (T+24h)...
  Target: rain >= 0.1 mm over 1 hour at T+24h (Test rain prevalence: 0.196)
  Baseline 1 Brier Score (Global Train Base Rate): 0.158
  Baseline 2 Brier Score (Seasonal-Diurnal Clim):  0.152 (ROC-AUC: 0.788)
  Trained XGBoost Brier Score:                    0.123 (Gain vs Clim: +19.3%)
  Trained XGBoost ROC-AUC:                        0.837

Running Feature Representation Ablation Study across Horizons (T+1h, T+6h, T+24h)...
  Layer 1: Raw Weather Observations Only (5 feats): T+1h=0.74°C | T+6h=2.74°C | T+24h=0.77°C
  Layer 2: + Cyclical Solar & Calendar Encodings (9 feats): T+1h=0.39°C | T+6h=1.14°C | T+24h=0.84°C
  Layer 3: + Selected Autoregressive Lags (16 features: 5 raw, 4 cyclical, temp t-1h..24h, hum t-1h, press t-1h) (16 feats): T+1h=0.39°C | T+6h=1.11°C | T+24h=0.81°C
  Layer 4: Full Multi-Modal (Lags + Rolling Windows + Gradients) (34 feats): T+1h=0.36°C | T+6h=0.80°C | T+24h=0.82°C

Initializing TreeSHAP Explainer...
Serializing complete model catalog to disk...

=================================================================
BENCHMARK COMPLETED SUCCESSFULLY & programmatically recorded!
Artifacts saved in ml/artifacts/
=================================================================
```

---

### 2.2 Automated Test Suite Execution (`pytest`)

```text
============================= test session starts =============================
platform win32 -- Python 3.12.10, pytest-8.3.5, pluggy-1.5.0
rootdir: C:\SattyGithub\WeatherGPT
plugins: anyio-4.12.1, langsmith-0.10.2, asyncio-0.24.0, cov-7.1.0
asyncio: mode=Mode.STRICT, default_loop_scope=None
collected 31 items

backend/tests/test_api.py::TestHealthCheck::test_health_check PASSED     [  3%]
backend/tests/test_api.py::TestHealthCheck::test_root_endpoint PASSED    [  6%]
backend/tests/test_api.py::TestForecastAPI::test_geocode_search PASSED   [  9%]
backend/tests/test_api.py::TestForecastAPI::test_current_weather PASSED  [ 12%]
backend/tests/test_api.py::TestForecastAPI::test_hourly_forecast PASSED  [ 16%]
backend/tests/test_api.py::TestForecastAPI::test_daily_forecast PASSED   [ 19%]
backend/tests/test_api.py::TestForecastAPI::test_invalid_coordinates PASSED [ 22%]
backend/tests/test_api.py::TestForecastAPI::test_forecast_explain PASSED [ 25%]
backend/tests/test_api.py::TestForecastAPI::test_ml_prediction_endpoint PASSED [ 29%]
backend/tests/test_api.py::TestForecastAPI::test_feature_schema_and_provenance_audit PASSED [ 32%]
backend/tests/test_api.py::TestForecastAPI::test_route_corridor PASSED   [ 35%]
backend/tests/test_api.py::TestForecastAPI::test_model_benchmarks PASSED [ 38%]
backend/tests/test_api.py::TestForecastAPI::test_route_corridor_with_transit_mode PASSED [ 41%]
backend/tests/test_api.py::TestForecastAPI::test_air_quality_telemetry PASSED [ 45%]
backend/tests/test_api.py::TestForecastAPI::test_bangalore_microclimates PASSED [ 48%]
backend/tests/test_api.py::TestChatAPI::test_chat_grounded_response PASSED [ 51%]
backend/tests/test_api.py::TestAlertsAPI::test_alerts_assessment PASSED  [ 54%]
backend/tests/test_api.py::TestAdminAPI::test_admin_metrics PASSED       [ 58%]
backend/tests/test_api.py::TestScientificValidation::test_contact_mechanics_stopping_distance PASSED [ 61%]
backend/tests/test_api.py::TestScientificValidation::test_reproducible_ml_benchmarks PASSED [ 64%]
backend/tests/test_api.py::TestScientificValidation::test_lapse_rate_elevation_hypsometry PASSED [ 67%]
backend/tests/test_api.py::TestScientificValidation::test_genuine_treeshap_attributions PASSED [ 70%]
backend/tests/test_api.py::TestScientificValidation::test_microclimates_scientific_provenance PASSED [ 74%]
backend/tests/test_api.py::TestScientificValidation::test_commute_rag_entity_resolution PASSED [ 77%]
backend/tests/test_api.py::TestScientificValidation::test_precipitation_baseline_training_only_leak_free PASSED [ 80%]
backend/tests/test_api.py::TestScientificValidation::test_temporal_purge_gap_zero_target_leakage PASSED [ 83%]
backend/tests/test_api.py::TestScientificValidation::test_split_conformal_calibration_finite_sample_index PASSED [ 87%]
backend/tests/test_api.py::TestScientificValidation::test_model_artifact_manifest_completeness PASSED [ 90%]
backend/tests/test_api.py::TestScientificValidation::test_weather_service_resilience_and_fallbacks PASSED [ 93%]
backend/tests/test_api.py::TestScientificValidation::test_feature_parity_strict_ordering_and_vector_shape PASSED [ 96%]
backend/tests/test_api.py::TestScientificValidation::test_live_variable_absence_triggers_explicit_fallback_tracking PASSED [100%]

======================= 31 passed, 2 warnings in 24.64s =======================
```

---

### 2.3 Live ML Inference Smoke Test (`/api/forecast/ml-prediction`)

```json
{
  "status": "success",
  "model_pipeline": "WeatherGPT Trained XGBoost Regressors & Classifier (T+24h)",
  "forecast_horizon": "T+24h",
  "forecast_origin_utc": "2026-10-24T22:01:25.600489+00:00",
  "point_temperature_c": 20.21,
  "quantile_forecast_c": {
    "p10": 19.57,
    "p50_median": 20.04,
    "p90": 20.7,
    "raw_interval_width_c": 1.13,
    "raw_empirical_coverage_pct": 72.9
  },
  "split_conformal_interval_80": {
    "nominal_coverage_pct": 80.0,
    "calibrated_empirical_coverage_pct": 82.1,
    "conformal_adjustment_margin_c": 0.21,
    "calibrated_lower_c": 19.36,
    "calibrated_upper_c": 20.91,
    "calibrated_interval_width_c": 1.55,
    "finite_sample_quantile_index": 3127,
    "validation_sample_size": 3907
  },
  "precipitation_risk_24h": {
    "target": "Rainfall occurrence >= 0.1 mm/h",
    "rain_probability_pct": 30.6,
    "risk_category": "Moderate Rain Risk"
  },
  "is_fallback": false,
  "fallback_imputations": [],
  "feature_provenance": "recent_past_forecast",
  "feature_vector_dimension": 34,
  "data_source_accounting": {
    "training_data_product": "Open-Meteo Historical Weather Archive (ECMWF ERA5 / ERA5-Land Reanalysis)",
    "inference_lag_source": "Open-Meteo Forecast API (past_days=2, recent NWP forecast blend)",
    "domain_shift_notice": "Training inputs utilize historical reanalysis whereas live inference uses recent archived NWP forecast outputs; operational predictive skill in production deployment remains an experimental application."
  },
  "scientific_disclaimer": "This forecast is produced directly by WeatherGPT's trained XGBoost models. At live inference, feature lags are derived from recent past forecast data (Open-Meteo Forecast API past_days=2), whereas training utilized historical ERA5/ERA5-Land reanalysis. Evaluated on held-out test data (82.1% empirical conformal coverage, 0.123 precipitation Brier score). Split conformal exchangeability is an empirical measurement on the test period, not an unconditional non-stationary guarantee."
}
```

---

### 2.4 Frontend Production Build (`npm run build`)

```text
> frontend@0.0.0 build
> vite build

vite v8.3.4 building client environment for production...
transforming...
✓ 2509 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.97 kB │ gzip:   0.53 kB
dist/assets/index-CXzyuzUc.css   42.29 kB │ gzip:   7.64 kB
dist/assets/index-D8T_wqDC.js   757.91 kB │ gzip: 221.85 kB
✓ built in 1.92s
```

---

## 3. Verified Artifact Catalog on Disk

The following 13 artifacts exist on disk in `ml/artifacts/` and `data/` and have been programmatically validated:

1. `ml/artifacts/xgboost_t1_point.json` (Point regressor $T+1\text{h}$)
2. `ml/artifacts/xgboost_t6_point.json` (Point regressor $T+6\text{h}$)
3. `ml/artifacts/xgboost_t24_point.json` (Point regressor $T+24\text{h}$, active TreeSHAP inference)
4. `ml/artifacts/xgboost_q10.json` (Quantile regressor $\tau=0.10, T+24\text{h}$)
5. `ml/artifacts/xgboost_q25.json` (Quantile regressor $\tau=0.25, T+24\text{h}$)
6. `ml/artifacts/xgboost_q50.json` (Quantile regressor $\tau=0.50, T+24\text{h}$, median)
7. `ml/artifacts/xgboost_q75.json` (Quantile regressor $\tau=0.75, T+24\text{h}$)
8. `ml/artifacts/xgboost_q90.json` (Quantile regressor $\tau=0.90, T+24\text{h}$)
9. `ml/artifacts/xgboost_precipitation_t24.json` (Precipitation classifier $T+24\text{h}$)
10. `ml/artifacts/feature_names.json` (Schema of all 34 engineered feature column names)
11. `ml/artifacts/shap_background.npy` (100 background training samples for TreeSHAP)
12. `ml/artifacts/benchmark_results.json` (Complete experimental metrics, multi-horizon ablation, and manifest)
13. `data/bengaluru_hourly_2021_2023.csv` (Historical meteorological dataset, 26,280 rows, with alias `data/bengaluru_hourly_2021_2024.csv`)
