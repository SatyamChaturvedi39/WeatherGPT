# WeatherGPT: Project Repair Log & Scientific Validation Record

**Author / Lead Engineer**: Senior ML & Systems Engineer  
**Date**: October 2026  
**Branch**: `repair/msc-scientific-validation`  
**Repository**: `SatyamChaturvedi39/WeatherGPT`  
**Target Milestone**: MSc AI & ML System Project Development (SPD) Technical Defense  

---

## 1. Overview of Changes

This log documents all architectural corrections, data pipeline implementations, machine learning experiments, and codebase repairs performed to transition **WeatherGPT** from an unverified prototype with hardcoded claims into a reproducible, scientifically defensible MSc capstone project.

---

## 2. Phase-by-Phase Repair Actions

### Phase 0: Project Protection & Checkpointing
- **Action**: Verified working tree status (`git status`). Clean working tree on branch `Feats`.
- **Action**: Created dedicated repair branch `repair/msc-scientific-validation`.
- **Action**: Catalogued existing components: FastAPI backend (`backend/app`), React frontend (`frontend/src`), ML modules (`ml/src`), and documentation.

### Phase 1: Ground-Truth Repository Audit
- **Action**: Conducted complete audit across all endpoints, ML claims, and documentation.
- **Deliverable**: Generated [`PROJECT_AUDIT.md`](PROJECT_AUDIT.md) identifying 5 key areas of divergence:
  1. Ingestion claims of DWD ICON-D2 (2.2km) and NOAA HRRR over Bengaluru (physically impossible due to model geographical domains).
  2. Hardcoded ML benchmark returns in `backend/app/api/forecast.py` and missing trained model artifacts.
  3. Pseudo-SHAP linear calculations instead of true `shap.TreeExplainer` execution.
  4. Heuristic uncertainty interval expansions (`0.8 + i * 0.05`) masquerading as non-parametric quantile predictions.
  5. Vehicle braking dynamics discrepancy (+38% vs +45.4% from dry 26.0m to wet 37.8m).

### Phase 2: Weather-Data Architecture Corrections
- **Investigation**: Open-Meteo API provides global weather models (ECMWF IFS 9–11 km, NOAA GFS 13–25 km, DWD ICON Global ~13 km). ICON-D2 (Germany/Central Europe only) and NOAA HRRR (CONUS only) do not cover India.
- **Code Changes**:
  - `backend/app/services/weather.py`: Clarified that Open-Meteo serves global ECMWF/GFS model outputs.
  - Sub-hourly timelines explicitly documented as temporal spline interpolations, not Doppler radar convective cell tracking.
  - Added scientific disclaimers to API outputs so demonstration data and interpolated intervals are never presented as newly observed live Doppler data.

### Phase 3: Defensible Microclimates & Commute Heuristics
- **Code Changes**:
  - `backend/app/services/weather.py` (`get_bangalore_microclimates_summary`):
    - Retained the 25-zone locality registry as geographic and contextual metadata.
    - Preserved environmental lapse rate downscaling ($\Gamma = -6.5^\circ\text{C}/\text{km}$ relative to central Bengaluru CBD at 915m ASL).
    - Removed arbitrary locality-based rain probability assignments (e.g. Koramangala 68% vs Vimanapura 12% from string matching).
    - Replaced with regional synoptic precipitation probabilities and tagged low-lying arterial transit zones (Sony World, Central Silk Board, Ejipura underpass, Bellandur ORR) as **Historical Stormwater Inundation Susceptibility Chokepoints**, referencing BBMP stormwater drainage basin inventories.
    - Added `scientific_provenance` metadata to the API response.

### Phase 4: Machine Learning Pipeline & Reproducible Benchmarks
- **Data Acquisition**:
  - Created [`ml/fetch_data.py`](ml/fetch_data.py). Ingested 26,280 hourly observations (Jan 1, 2021 to Dec 31, 2023) for Bengaluru (`12.9716°N, 77.5946°E`) from Open-Meteo Historical Archive (ECMWF ERA5 / IFS Reanalysis). Saved to `data/bengaluru_hourly_2021_2024.csv`.
- **Training Pipeline**:
  - Created [`ml/train.py`](ml/train.py) with strict chronological walk-forward splitting:
    - **Train Set**: 18,345 hours (70%) — Jan 3, 2021 to Feb 6, 2023
    - **Validation Set**: 3,931 hours (15%) — Feb 6, 2023 to Jul 20, 2023
    - **Test Set (Held Out)**: 3,932 hours (15%) — Jul 20, 2023 to Dec 30, 2023
  - **Zero Data Leakage Safeguards**: All rolling windows, lags, and difference features use shifted indices ($t \ge 1$ in the past relative to prediction origin). Preprocessing fit strictly on training set.
- **Empirical Results (Computed on 3,932 Held-Out Test Hours)**:

| Model | MAE (+1h) | MAE (+6h) | MAE (+24h) | RMSE (+24h) | Pinball Loss (q50) | Brier Score (Rain) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Persistence Baseline ($y_{t+h} = y_t$)** | 0.82 °C | 4.03 °C | 0.75 °C | 1.07 °C | 0.37 °C | 0.158 |
| **Climatological Diurnal Mean Baseline** | — | — | 1.55 °C | 1.94 °C | 0.78 °C | 0.158 |
| **Trained XGBoost Point Regressor** | **0.36 °C** | **0.80 °C** | 0.84 °C | 1.10 °C | 0.42 °C | **0.122** |
| **XGBoost Quantile Regressor ($P_{50}$ Median)** | — | — | **0.74 °C** | **1.00 °C** | **0.37 °C** | **0.122** |

- **Artifacts Saved**:
  - `ml/artifacts/xgboost_t24_point.json` (Serialized Point Model)
  - `ml/artifacts/xgboost_q10.json`, `xgboost_q50.json`, `xgboost_q90.json` (Quantile Models)
  - `ml/artifacts/feature_names.json` (34 Feature Encodings)
  - `ml/artifacts/shap_background.npy` (Training Distribution Sample)
  - `ml/artifacts/benchmark_results.json` (Complete Experimental Telemetry)

### Phase 5: Real Uncertainty Quantification (UQ)
- **Quantile Training**: Evaluated XGBoost Quantile Regressors for $\tau \in \{0.10, 0.25, 0.50, 0.75, 0.90\}$ minimizing Pinball Loss:
  $$\mathcal{L}_\tau(y, \hat{y}) = \max\Big(\tau(y - \hat{y}), (1 - \tau)(\hat{y} - y)\Big)$$
- **Empirical Coverage**: Tested nominal 80% prediction interval $[P_{10}, P_{90}]$ against the 3,932 held-out test hours:
  - Nominal Coverage Target: 80.0%
  - **Empirical Observed Coverage**: **72.2%**
  - **Mean Interval Width**: **2.19 °C**
  - **Scientific Interpretation**: Disclosed honest under-coverage of 7.8% resulting from tight interval estimation; avoids misleading claims of unverified calibration.
- **Quantile Calibration Curve**:
  - $\tau = 0.10 \implies 7.6\%$ empirical coverage (Pinball loss: 0.183)
  - $\tau = 0.25 \implies 19.3\%$ empirical coverage (Pinball loss: 0.307)
  - $\tau = 0.50 \implies 39.0\%$ empirical coverage (Pinball loss: 0.368)
  - $\tau = 0.75 \implies 63.0\%$ empirical coverage (Pinball loss: 0.287)
  - $\tau = 0.90 \implies 79.8\%$ empirical coverage (Pinball loss: 0.167)

### Phase 6: TreeSHAP Explainability Connected to Real Model
- **Code Changes**:
  - `backend/app/api/forecast.py` (`explain_forecast`):
    - Replaced synthetic linear arithmetic with `shap.TreeExplainer` loaded lazily from `ml/artifacts/xgboost_t24_point.json`.
    - Samples real atmospheric inputs and computes exact game-theoretic Shapley values $\phi_i$.
    - Returns top physical attributions (Current Surface Temperature, Solar Diurnal Phase, 24h Thermal Persistence, Barometric Tendency, Relative Humidity).
    - Added explicit scientific disclaimer distinguishing statistical feature attribution under the learned model from physical causation.

### Phase 7: Grounded RAG & Conversational Service
- **Code Changes**:
  - `backend/app/services/rag_service.py`:
    - Updated commute raincoat advice to reflect exact contact dynamics (+45.4% stopping distance increase).
    - Added transparent scientific provenance disclosures to generated answers.
    - Preserved deterministic grounding rules when LLM API keys are absent.

### Phase 10: Standardized AASHTO Braking & 22-Test Interim Suite
- **AASHTO Stopping Distance Standardization**:
  - Identified that the earlier calculation in Phase 8 contained an arithmetic rounding anomaly ($14.63 + 22.76 = 37.39\text{ m}$, which was approximated as $37.8\text{ m}$ and $+45.4\%$).
  - Standardized the exact AASHTO formulation with $v=12.5\text{ m/s}, t_r=1.17\text{ s}, g=9.807\text{ m/s}^2, \mu_{\text{dry}}=0.70, \mu_{\text{wet}}=0.35$:
    - $d_{\text{reaction}} = 12.5 \times 1.17 = 14.625\text{ m}$
    - $d_{\text{dry}} = 14.625 + 11.380 = 26.005\text{ m} \approx \mathbf{26.0\text{ m}}$
    - $d_{\text{wet}} = 14.625 + 22.761 = 37.386\text{ m} \approx \mathbf{37.4\text{ m}}$
    - Percentage Increase: $\frac{37.386 - 26.005}{26.005} \times 100\% = \mathbf{+43.76\% \approx +43.8\%}$.
  - Updated `weather.py`, `rag_service.py`, `RouteView.jsx`, and `test_api.py`.
- **Test Suite Expansion**: Added test for 25-zone microclimates hypsometry, reaching 22 passing tests.

---

## 3. Phase 11: Final Authoritative Reconciliation (Purge Gap, Leakage Audit & 27-Test Suite)

This section records the final, definitive engineering run and explicitly establishes which historical results are superseded and which final metrics are authoritative.

### 3.1 Historical vs. Authoritative Supersession Table

| Item / Metric | Historical Interim Values | Final Authoritative Value | Supersession Rationale |
| :--- | :--- | :--- | :--- |
| **Braking Distance** | $37.8\text{ m}$ (+45.4%) | **$37.4\text{ m}$ (+43.8%)** | Phase 8 draft contained an arithmetic rounding typo ($37.39\text{m} \to 37.8\text{m}$). Standard AASHTO contact mechanics yields exactly 37.4m (+43.8%). |
| **Temporal Split Accounting** | $18,345 / 3,931 / 3,932$ (Unpurged) | **$18,321 / 3,907 / 3,932$** (24h Purge Gap) | Naive index slicing allowed 23 rows of train targets to reach validation. An embargo gap of 24h (48 boundary rows purged) strictly guarantees zero forward target leakage. |
| **Split Conformal Coverage** | $79.4\%$ (margin +0.19°C)<br>$80.8\%$ (margin +0.18°C) | **$82.1\%$** (margin **$+0.21^\circ\text{C}$**) | On the purged validation set ($n=3,907$), finite-sample index $k = \lceil 3908 \times 0.80 \rceil = 3127$ gives margin $+0.21^\circ\text{C}$, elevating held-out test coverage from $72.9\%$ (raw, width $2.18^\circ\text{C}$) to **$82.1\%$** (calibrated, width $2.60^\circ\text{C}$). |
| **Precipitation Baseline Brier** | $0.158$ (Suspected Leakage) | **$0.158$** (Global Base Rate)<br>**$0.152$** (Seasonal Climatology) | Mathematical audit confirmed **Zero Leakage**: scoring training base rate $p_{\text{train}} = 0.2150$ on test targets ($p_{\text{test}} = 0.1961$) mathematically yields $0.1580$, purely coinciding with test prevalence variance $0.1578 \approx 0.158$ due to rounding. |
| **Precipitation XGBoost Brier** | $0.122$ (ROC-AUC $0.838$) | **$0.123$** (ROC-AUC **$0.837$**) | Recomputed on the leak-free purged split. Yields **+22.5% gain** over global base rate and **+19.3% gain** over seasonal climatology. |
| **Multi-Horizon Regressors** | +6h MAE: $0.79^\circ\text{C}$<br>+24h MAE: $0.81^\circ\text{C}$–$0.84^\circ\text{C}$ | +1h MAE: **$0.36^\circ\text{C}$**<br>+6h MAE: **$0.80^\circ\text{C}$**<br>+24h MAE: **$0.82^\circ\text{C}$** (Point), **$0.74^\circ\text{C}$** (P50) | Recomputed on purged splits. Demonstrates diurnal persistence barrier at +24h (Persistence: 0.75°C) and massive ML gains at +1h (+56.3%) and +6h (+80.2%). |
| **Automated Test Count** | 21 tests (Phase 9)<br>22 tests (Phase 10) | **27 Passed Tests** (100%) | Added 5 new tests in `backend/tests/test_api.py` asserting zero leakage, 24h purge gap, finite-sample conformal index, artifact manifest, and weather resilience. |
| **Model Artifacts on Disk** | 4 models listed | **All 9 Models Serialized** | Serialized 3 point regressors, 5 quantile regressors, 1 precipitation classifier, plus schema and background arrays in `ml/artifacts/`. |

---

## 4. Residual Known Limitations

1. **Host PyTorch Runtime Dependency**:
   PyTorch fails to load on the local Windows Python 3.12 runtime due to a dynamic link library initialization conflict with `c10.dll` (`WinError 1114`). As a result, the recurrent LSTM model comparison is documented as an unverified host dependency rather than simulated with fake numbers. The production system relies on XGBoost, which runs natively and efficiently.
2. **NWP Spatial Discretization**:
   Open-Meteo provides global numerical weather prediction data at 9–11 km (ECMWF) and 13–25 km (GFS). True convective cloud boundary tracking requires local Doppler weather radar (DWR) telemetry, which is not freely accessible via programmatic API for real-time inference in Bengaluru. The platform's sub-hourly timelines are therefore honest spline interpolations combined with topographic lapse-rate downscaling.
3. **Stormwater Drainage Data**:
   Flood chokepoints (Sony World Junction, Ejipura underpass, Silk Board) reflect static civil drainage assessments rather than real-time hydraulic flow simulations.
4. **Exchangeability in Time-Series Conformal Prediction**:
   Standard split conformal prediction assumes exchangeability. Hourly meteorological data exhibits autocorrelation. On the held-out test set, the calibrated interval achieves 82.1% coverage, which verifies empirical coverage over this period rather than an unconditional theoretical guarantee across non-stationary regime shifts.

---

## 5. Phase 12: Final Release Gate — Scientific Claims, ML Integration & Submission Readiness

* **Dedicated ML Endpoint (`/api/forecast/ml-prediction`)**:
  - Implemented real-time endpoint running trained XGBoost models: T+24h point prediction, quantile regression spread ($\tau \in \{0.10, 0.25, 0.50, 0.75, 0.90\}$), split conformal interval ($+0.21^\circ\text{C}$ margin, 82.1% empirical test coverage), and precipitation classifier ($P(\text{rain} \ge 0.1\text{ mm})$, Brier: 0.123).
  - Tracks live feature provenance (`recent_past_forecast` using 48h Open-Meteo forecast lags vs fallback; historical reference to `live_real_history` superseded).
  - Integrated into frontend `DashboardView.jsx` as a dedicated **WeatherGPT Custom ML Inference** summary card.
* **Automated Test Suite Expansion**:
  - Added `test_ml_prediction_endpoint` and `test_feature_schema_and_provenance_audit` to `backend/tests/test_api.py`, expanding test suite to **29 passed automated tests** (exit code 0 in 28.07s).
* **Dataset Accounting & Provenance**:
  - Renamed primary dataset to [`data/bengaluru_hourly_2021_2023.csv`](data/bengaluru_hourly_2021_2023.csv) to accurately represent the 3-year scope (26,280 hourly observations, Jan 1, 2021 to Dec 31, 2023). Preserved `data/bengaluru_hourly_2021_2024.csv` as a backward-compatible alias.
  - Updated `ml/fetch_data.py` and `ml/train.py` to prefer the 2021_2023 path.
* **External Claims & Citations Audit**:
  - Replaced fictitious BBMP/KSDMA 2022 citation with authentic Comptroller and Auditor General of India (CAG) Performance Audit Report No. 2 of 2021 on Management of Storm Water in Bengaluru Urban Area and KSNDMC flood mapping documents.
  - Corrected two-wheeler statistics: distinguished registered vehicle fleet (>70% of registered motor vehicles, ~7.5M of 10.5M, Karnataka Transport Dept 2023) from daily commuter modal share (~24–27%, DULT Comprehensive Mobility Plan 2020).
  - Clarified stopping-distance calculator as theoretical physics-based estimator (AASHTO kinematic formulation) with explicitly stated modeling assumptions ($t_r = 1.17\text{ s}$, $\mu=0.70 \to 0.35$, yielding 26.0m dry, 37.4m wet, +43.8% increase).
  - Renamed quadrant chart axis to distinguish regional forecast resolution from locality-aware route decision support.

---

### Phase 13: Final Release Gate — Live ML Inference Audit, Multi-Horizon Ablation, Split Reconciliation & Publication Audit (October 25, 2026)

* **Live ML Inference Data Source Audit (Phase 2 Resolution)**:
  - Inspected `get_recent_history_for_features()` in `backend/app/services/weather.py`. Verified that the request `GET /forecast?past_days=2` queries Open-Meteo Forecast API, which documents that `past_days` returns recently archived **numerical weather prediction (NWP) model outputs** (ECMWF IFS / GFS blends), **not physical ground station telemetry**.
  - Replaced misleading label `live_real_history` across backend, frontend, unit tests, and documentation with truthful label **`recent_past_forecast`**.
  - Disclosed operational domain shift: model training utilized historical reanalysis (ECMWF ERA5 / ERA5-Land via Archive API) while live inference ingests recent past NWP forecasts from the Forecast API. Added `domain_shift_notice` to response metadata and API disclaimers.
* **Multi-Horizon Feature Representation Ablation Study (Phase 4 Resolution)**:
  - Extended ablation study in `ml/train.py` and `ml/artifacts/benchmark_results.json` to evaluate all 4 cumulative layers across all three horizons ($T+1\text{h}$, $T+6\text{h}$, $T+24\text{h}$).
  - Empirically proved why Layer 4 multi-modal representations are indispensable: slashes $T+6\text{h}$ MAE by **71.2%** (2.74°C → 0.79°C) and $T+1\text{h}$ MAE by **51.7%** (0.74°C → 0.36°C), while at $T+24\text{h}$ strong diurnal recurrence creates a competitive 5-variable baseline (0.77°C vs 0.81°C).
  - Enhanced frontend `BenchmarkView.jsx` to render multi-horizon MAE columns in the ablation stack.
* **Dataset & Split Accounting Reconciliation (Phase 3 Resolution)**:
  - Reconciled exact arithmetic: 26,280 raw rows → 72 boundary drops (48h lag + 24h target) → 26,208 candidates → 48 purge gap drops (24h train-val + 24h val-test) → **26,160 assigned rows** ($18,321 + 3,907 + 3,932 = 26,160$).
  - Recorded exact timestamps and forward target upper bounds:
    - Train: 2021-01-03 00:00 to 2023-02-05 08:00 (18,321 rows, max target: 2023-02-06 08:00)
    - Purge Gap 1: 2023-02-05 09:00 to 2023-02-06 08:00 (24 rows)
    - Val: 2023-02-06 09:00 to 2023-07-19 03:00 (3,907 rows, max target: 2023-07-20 03:00)
    - Purge Gap 2: 2023-07-19 04:00 to 2023-07-20 03:00 (24 rows)
    - Test: 2023-07-20 04:00 to 2023-12-30 23:00 (3,932 rows, max target: 2023-12-31 23:00)
* **Conformal Prediction Research Question & Claim Refinement (Phase 5 Resolution)**:
  - Reframed RQ2 to explicitly distinguish nominal coverage (80%), validation-derived adjustment margin ($\Delta = +0.21^\circ\text{C}, k=3127$), empirical test coverage (82.1%, width 2.60°C), and exchangeability assumptions under autocorrelated time series.
* **Citation & Drainage Claim Audit (Phase 6 Resolution)**:
  - Qualified CAG 2021 Report No. 2 of 2021 statements: removed unverified "40–60%" blanket deficit claims, replacing with exact qualitative findings of severe siltation, culvert narrowing, and over 1,800 buffer-zone encroachments across Koramangala and Vrishabhavathi valleys.
  - Verified and referenced KSNDMC/BBMP (2021–2022) flood vulnerability mapping technical report.
* **Repository & Remote Publication Inspection (Phase 1 Resolution)**:
  - Created [`FINAL_REPOSITORY_STATUS.md`](FINAL_REPOSITORY_STATUS.md) documenting that remote `origin/main` currently contains only a 1-line README commit, while the entire genuine application resides on local branch `repair/msc-scientific-validation`.
  - Tested git push dry-run (`git push --dry-run origin repair/msc-scientific-validation`, exit code 0) and documented safe non-destructive publishing commands.
* **Live Smoke Testing & Build Verification (Phase 7 & 10 Resolution)**:
  - Executed live smoke test of `/api/forecast/ml-prediction` (200 OK, point: 20.21°C, quantiles, conformal interval, rain risk: 17.0%, provenance: `recent_past_forecast`).
  - Executed live smoke test of `/api/forecast/explain` (200 OK, base: 22.73°C, point: 20.21°C, 8 TreeSHAP features).
  - Executed `pytest backend/tests/test_api.py -v`: **29 passed in 28.07s**.
  - Executed `npm run build`: **Vite build succeeded in 1.92s**.



