# WeatherGPT 🌦️🤖

> AI-powered weather forecasting with RAG chatbot, anomaly detection, and explainability.

[![Backend CI](https://github.com/SatyamChaturvedi39/WeatherGPT/actions/workflows/backend-ci.yml/badge.svg)](https://github.com/SatyamChaturvedi39/WeatherGPT/actions/workflows/backend-ci.yml)
[![Frontend CI](https://github.com/SatyamChaturvedi39/WeatherGPT/actions/workflows/frontend-ci.yml/badge.svg)](https://github.com/SatyamChaturvedi39/WeatherGPT/actions/workflows/frontend-ci.yml)

## What It Does

WeatherGPT combines ML-powered weather forecasting with a RAG chatbot to deliver:

- 🌡️ **Accurate Forecasts** — XGBoost and LSTM models with calibrated uncertainty intervals
- 💬 **Conversational AI** — Ask questions about weather in natural language, grounded in real data
- ⚠️ **Risk Alerts** — Anomaly detection drives proactive weather warnings
- 🔍 **Explainability** — SHAP-based "why this forecast" panels for transparency
- 📊 **Interactive Dashboard** — Real-time charts with confidence bands

## Tech Stack

| Layer | Technology |
|:------|:-----------|
| **Data** | Open-Meteo API (free, no key) |
| **Database** | PostgreSQL via Neon (free tier) |
| **Vector Store** | ChromaDB (in-process) |
| **ML/DL** | scikit-learn, XGBoost, PyTorch, SHAP |
| **Backend** | FastAPI, Docker |
| **LLM/RAG** | Groq (Llama 3) + Gemini Flash (fallback) |
| **Frontend** | React, Recharts, Vite |
| **Hosting** | Render (backend) + Vercel (frontend) |
| **CI/CD** | GitHub Actions |

## Project Structure

```
WeatherGPT/
├── backend/          # FastAPI application
│   ├── app/
│   │   ├── api/      # Route handlers (forecast, alerts, chat, settings)
│   │   ├── core/     # Config, database connection
│   │   ├── models/   # SQLAlchemy models
│   │   └── services/ # Business logic (weather, ML, RAG)
│   └── Dockerfile
├── frontend/         # React + Vite dashboard
│   └── src/
│       ├── components/
│       └── pages/
├── ml/               # ML training & models
│   ├── notebooks/    # Jupyter/Colab notebooks
│   ├── src/          # Feature engineering, anomaly detection, SHAP
│   └── models/       # Serialized model artifacts
├── data/             # Data pipeline & schema
├── docs/             # Documentation
└── docker-compose.yml
```

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 20+
- Docker & Docker Compose (optional, for full local setup)

### Backend (FastAPI)

```bash
cd backend
python -m venv venv
venv\Scripts\activate      # Windows
pip install -r requirements.txt
cp .env.example .env       # Edit with your API keys
uvicorn app.main:app --reload
```

API docs available at: http://localhost:8000/docs

### Frontend (React)

```bash
cd frontend
npm install
npm run dev
```

Dashboard available at: http://localhost:5173

### Full Stack (Docker Compose)

```bash
docker compose up
```

## API Endpoints

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| GET | `/health` | Health check |
| GET | `/api/forecast/current?lat=&lon=` | Current weather conditions |
| GET | `/api/forecast/hourly?lat=&lon=` | Hourly forecast |
| GET | `/api/forecast/daily?lat=&lon=` | Daily forecast |
| GET | `/api/forecast/geocode?query=` | Location search |
| GET | `/api/forecast/explain?lat=&lon=` | TreeSHAP feature attributions & explainability |
| GET | `/api/alerts/?lat=&lon=` | Real-time weather risk alerts & anomaly scores |
| GET | `/api/alerts/history?lat=&lon=` | Past 7-day incident history |
| POST | `/api/chat/` | Grounded RAG conversational weather assistant |
| GET | `/api/admin/metrics` | System telemetry & Data-Ops operational health |
| GET | `/api/settings/` | User preferences |

## Data Pipeline

```bash
# Fetch 1 year of historical data for New York
cd data
python ingestion.py --lat 40.7128 --lon -74.0060 --days 365

# Fetch real-time data
python ingestion.py --lat 40.7128 --lon -74.0060 --mode realtime
```

## Team

| Role | Responsibility |
|:-----|:---------------|
| **Member 1** — ML & Data Engineering | Models, features, anomaly detection, SHAP |
| **Member 2** — Backend, RAG & Infra | API, database, RAG pipeline, deployment |
| **Member 3** — Frontend & UX | Dashboard, chat UI, admin panel |

## License

MIT