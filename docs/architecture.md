# WeatherGPT Architecture & System Design

```mermaid
graph TD
    subgraph Data Layer & Ingestion
        OM[Open-Meteo API] -->|Historical + Forecast| INGEST[Ingestion Engine]
        NOAA[NOAA GHCN API] -.->|Optional Baseline| INGEST
        SCHED[APScheduler] -->|Interval Trigger| INGEST
        INGEST --> CLEAN[Cleaning & Bounds Validation]
        CLEAN --> DB[(PostgreSQL / SQLite)]
    end

    subgraph Intelligence & ML Engine
        DB --> FEAT[Feature Engineering: Lags & Cyclical]
        FEAT --> XGB[XGBoost Quantile Regressor]
        FEAT --> LSTM[PyTorch LSTM]
        XGB --> SHAP_EXP[SHAP TreeExplainer]
        XGB & LSTM --> PROB[Isotonic Calibration & P10/P50/P90]
        PROB --> RISK[Rule-Based Risk Engine]
        PROB --> ANOM[Isolation Forest Anomaly Detection]
    end

    subgraph Grounded RAG
        PROB & RISK & SHAP_EXP --> DOC_GEN[Context Document Generator]
        DOC_GEN --> CHROMA[(ChromaDB Vector Store)]
        QUERY[User Prompt] --> RETRIEVER[Retriever + Cosine Sim]
        CHROMA --> RETRIEVER
        RETRIEVER --> GUARD[Strict Anti-Hallucination Guardrails]
        GUARD --> LLM[LLM: Ollama / OpenAI / Anthropic]
    end

    subgraph Delivery & Client
        DB & PROB & RISK & LLM --> API[FastAPI REST API /api/v1]
        API --> REACT[React 18 + Vite Dashboard]
    end
```

## Core Subsystems

### 1. Ingestion & Preprocessing
- **Source**: Open-Meteo high-resolution hourly forecast and archive endpoints.
- **Physical Bounds Validation**: Strict filtering on temperature (-90°C to 60°C), pressure (870 to 1085 hPa), wind speed (0 to 350 km/h), and precipitation (0 to 300 mm/h).
- **Interpolation**: Linear interpolation for missing sensory telemetry with imputation audit flags.

### 2. Probabilistic ML Forecasting
- Calibrated quantiles (P10, P50, P90) giving actionable uncertainty margins.
- Dual-head forecasting for continuous temperature and precipitation probabilities.

### 3. Risk Engine & Personalized Decisions
- Computes activity-specific hazard indices (commuting, running, outdoor events, travel).
- Escalates caution when forecast uncertainty bands widen.

### 4. RAG Chatbot
- Grounded solely on ingested and predicted telemetry.
- Zero-tolerance anti-hallucination guardrails: if missing or low-confidence, answers "I'm not sure".
