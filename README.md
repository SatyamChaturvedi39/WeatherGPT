# WeatherGPT Bharat 🌦️🛵

> **Hyper-Local Meteorological Intelligence, Uncertainty Quantification & Commute Risk Platform**  
> *Final-Year MSc Artificial Intelligence & Machine Learning Capstone Project (System Project Development — SPD)*

[![Backend Tests](https://img.shields.io/badge/pytest-31%20passed-emerald)](backend/tests/test_api.py)
[![ML Framework](https://img.shields.io/badge/ML-XGBoost%203.2%20%2B%20TreeSHAP-blue)](ml/)
[![License](https://img.shields.io/badge/License-MIT-gray.svg)](LICENSE)

---

## 1. What WeatherGPT Bharat Does

Traditional weather applications provide macro-scale forecasts (10–25 km grids) that treat entire urban metropolitan areas as homogenous stations. In plateau environments like Bengaluru, this fails to capture localized convective storms, urban heat islands, and drainage choke points.

**WeatherGPT Bharat** solves this by coupling:
1. **Topographic Hypsometric Downscaling**: Environmental lapse rate ($\Gamma = +0.0065^\circ\text{C}/\text{m}$) downscaling across a dedicated **25-Zone Bengaluru Microclimate Registry** with contextual stormwater drainage vulnerability mapping (BBMP audits).
2. **Reproducible Machine Learning Forecasting**: Multi-horizon forecasting trained on 26,208 hourly records (2021–2023) comparing Persistence and Climatological baselines against **Trained XGBoost Point & Quantile Regressors**.
3. **Calibrated Uncertainty Quantification (UQ)**: Split Conformal Prediction achieving calibrated 82.1% coverage on held-out test data (mean width 2.60°C) alongside raw non-parametric quantile regression (72.9% coverage, mean width 2.18°C).
4. **TreeSHAP Game-Theoretic Explainability**: Real-time Shapley values ($\phi_i$) decomposing forecast predictions into physical atmospheric drivers (thermal persistence, solar declination, pressure tendency).
5. **Commute Rain Shield & AASHTO Contact Dynamics**: Instant safe departure windows and vehicle braking physics (+43.8% stopping distance increase on wet asphalt: 26.0m dry $\to$ 37.4m wet).
6. **Grounded Conversational RAG**: Dynamic commute route parsing (e.g., *"Do I need a raincoat to go from Vimanapura to Koramangala right now?"*) with bilingual regional accessibility (Kannada ಕನ್ನಡ & Hindi हिंदी).

---

## 2. Technical Stack

| Subsystem | Components & Frameworks |
| :--- | :--- |
| **Telemetry Ingestion** | Open-Meteo Global NWP (ECMWF IFS 0.1° / GFS), Historical Archive (ERA5 Reanalysis) |
| **Machine Learning** | Python 3.12, XGBoost 3.2.0, scikit-learn 1.5.0, NumPy 1.26.4, Pandas 2.3.0 |
| **Explainability (XAI)** | TreeSHAP (`shap` 0.50.0) initialized on representative training background |
| **Backend & REST Gateway**| FastAPI 0.115.0, Uvicorn, Pydantic v2, HTTPX, in-memory TTL caching |
| **Frontend & UI/UX** | React 18, Vite 8, Recharts, Lucide Icons, Carbon-Matte Design System |
| **Verification & Testing** | Pytest 8.3.5 (31 automated integration & scientific validation tests) |

---

## 3. Repository Structure

```
WeatherGPT/
├── backend/                  # FastAPI backend service
│   ├── app/
│   │   ├── api/              # REST route handlers (forecast, alerts, chat, admin)
│   │   ├── core/             # Configuration & environment settings
│   │   ├── services/         # Weather ingestion, RAG reasoner, risk engine
│   │   └── main.py           # FastAPI entrypoint & CORS middleware
│   └── tests/
│       └── test_api.py       # 31 automated integration & physics tests
├── frontend/                 # React + Vite web application
│   ├── src/
│   │   ├── components/       # Dashboard, RouteView, MicroclimatesView, BenchmarkView, ChatView
│   │   ├── services/         # API integration client
│   │   ├── App.jsx           # Master navigation & state
│   │   └── App.css           # Carbon-Matte design tokens
│   └── package.json
├── ml/                       # Machine learning pipeline
│   ├── artifacts/            # Serialized models, feature names, TreeSHAP background, benchmark JSON
│   ├── src/                  # Feature engineering, explainability, anomaly detection
│   ├── fetch_data.py         # Open-Meteo historical archive data fetcher (2021-2023)
│   └── train.py              # Chronological walk-forward training & evaluation pipeline
├── data/
│   ├── bengaluru_hourly_2021_2024.csv  # 26,208 hourly meteorological records
│   ├── ingestion.py          # Data ingestion script
│   └── schema.sql            # Time-series relational schema
└── README.md
```

---

## 4. Empirical Evaluation Benchmark

Trained on 18,321 records (assigned train) and evaluated strictly on **3,932 held-out test hours** (July 2023 to December 2023) for Bengaluru:

| Model Architecture | MAE (+1h) | MAE (+6h) | MAE (+24h) | RMSE (+24h) | Pinball Loss ($q_{50}$) | Brier Score (Rain) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Persistence Baseline ($y_{t+h} = y_t$)** | 0.82 °C | 4.03 °C | 0.75 °C | 1.07 °C | 0.37 °C | 0.158 |
| **Climatological Diurnal Mean Baseline** | — | — | 1.55 °C | 1.94 °C | 0.78 °C | 0.158 |
| **Trained XGBoost Point Regressor** | **0.36 °C** | **0.80 °C** | 0.82 °C | 1.07 °C | 0.42 °C | **0.123** |
| **XGBoost Quantile Regressor ($P_{50}$ Median)** | — | — | **0.74 °C** | **1.00 °C** | **0.37 °C** | — |

* **Uncertainty Calibration**: 80% nominal prediction interval $[P_{10}, P_{90}]$ achieves **72.9% empirical coverage** with a sharp mean interval width of **2.18 °C**; split conformal calibration expands coverage to **82.1%** at **2.60 °C** width.
* **Precipitation Event Accuracy**: Brier score improves from 0.158 (baseline) to **0.123** (**22.5% error reduction** vs global climatology).

---

## 5. Quick Start & Reproduction Commands

### 5.1 Environment Setup

```bash
# Clone the repository
git clone https://github.com/SatyamChaturvedi39/WeatherGPT.git
cd WeatherGPT

# Install backend dependencies
pip install -r backend/requirements.txt
```

### 5.2 Reproduce Data Acquisition & ML Benchmark

```bash
# 1. Fetch 3 full years (26,208 hours) of historical observations for Bengaluru
python ml/fetch_data.py

# 2. Run the complete leakage-free training, uncertainty quantification & TreeSHAP pipeline
python ml/train.py
```
*Outputs are saved to `ml/artifacts/benchmark_results.json` and loaded live by `/api/forecast/benchmarks`.*

### 5.3 Run Automated Pytest Suite

```bash
# Run all 31 unit, integration, and physics validation tests
python -m pytest backend/tests/test_api.py -v
```

### 5.4 Run the Backend API

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```
*Interactive Swagger documentation: [http://localhost:8000/docs](http://localhost:8000/docs)*

### 5.5 Run the Frontend Dashboard

```bash
cd frontend
npm install
npm run dev
```
*Mission control UI available at: [http://localhost:5173](http://localhost:5173)*

---

## 6. Primary REST API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/forecast/current?lat=&lon=` | Current observations with 5-minute TTL caching |
| `GET` | `/api/forecast/hourly?lat=&lon=` | Hourly forecast with calibrated 80% prediction intervals |
| `GET` | `/api/forecast/explain?lat=&lon=` | Real-time TreeSHAP feature attributions on trained XGBoost model |
| `GET` | `/api/forecast/route` | Multi-modal transit corridor waypoints & AASHTO braking distance |
| `GET` | `/api/forecast/bangalore/microclimates` | 25-zone microclimate matrix with lapse-rate downscaled temps |
| `GET` | `/api/forecast/aqi?lat=&lon=` | Real-time PM2.5, PM10, US AQI, and commuter health advisories |
| `GET` | `/api/forecast/benchmarks` | Real empirical model evaluation metrics & calibration curves |
| `POST`| `/api/chat/` | Grounded conversational assistant for weather & commute queries |
| `GET` | `/api/alerts/?lat=&lon=` | Multi-hazard threshold scoring and proactive alerts |
| `GET` | `/api/admin/metrics` | System telemetry, cache hits, latency, and quota utilization |

---

## 7. Division of Work (MSc Capstone Team)

* **Satyam (Lead Architect & Systems Engineer)**: Asynchronous FastAPI gateway, dynamic NLP commute entity parser, geodesic transit corridor interpolation, in-memory TTL caching, deterministic activity risk engine, and automated test suite.
* **Likith (ML & Uncertainty Quantification Engineer)**: Historical data pipeline, leakage-free feature engineering, multi-horizon benchmarking (Persistence, Climatology, XGBoost), non-parametric quantile loss ($P_{10}/P_{50}/P_{90}$), TreeSHAP explainability, and AASHTO contact mechanics derivations.
* **Adithyan (Frontend Architect & Spatial UX Engineer)**: Mission-control Carbon-Matte design system, interactive Bangalore commute widget, 25-zone microclimate mission board, Recharts probabilistic fan charts, and bilingual regional accessibility (Kannada & Hindi).

---

## 8. Scientific Disclaimers & Known Limitations

1. **Host PyTorch Runtime Conflict**: PyTorch fails to import on the host Windows Python 3.12 runtime due to native DLL loading issues (`torch/lib/c10.dll` WinError 1114). The recurrent LSTM model comparison is recorded as an unverified host dependency rather than fabricated. Production forecasting relies on XGBoost, which runs natively and efficiently.
2. **NWP Spatial Resolution**: Telemetry is sourced from Open-Meteo's global numerical weather prediction feeds (ECMWF IFS 9–11 km / GFS 13–25 km). Local Doppler radar convective tracking is not accessible via public APIs for Bengaluru; sub-hourly intervals are temporal spline interpolations.
3. **Stormwater Drainage Data**: Low-lying flood chokepoints reflect static municipal stormwater surveys (BBMP) rather than real-time hydrodynamic flow simulations.