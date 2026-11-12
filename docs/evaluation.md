# WeatherGPT ML Evaluation Protocol & Benchmarks

## Evaluation Methodology
- **Time-based Splitting**: Zero temporal leakage. The dataset is strictly partitioned into chronological Train / Validation / Test sets.
- **Metric Definitions**:
  - **MAE (Mean Absolute Error)**: Average point error in continuous temperature predictions.
  - **RMSE (Root Mean Square Error)**: Penalizes larger prediction deviations.
  - **CRPS (Continuous Ranked Probability Score)**: Evaluates probabilistic quantile distribution calibration.
  - **Brier Score**: Evaluates probability calibration for binary precipitation occurrence.

## Model Benchmarks (Out-of-Sample Test Set)

| Model | Target | Horizon | MAE (°C) | RMSE (°C) | CRPS | Brier Score |
|---|---|---|---|---|---|---|
| Persistence Baseline | temperature_2m | 1h | 1.12 | 1.48 | — | — |
| Persistence Baseline | temperature_2m | 24h | 3.10 | 4.12 | — | — |
| Climatology Baseline | temperature_2m | 24h | 4.25 | 5.30 | — | — |
| **XGBoost Quantile** | temperature_2m | 1h | **0.68** | **0.92** | **0.48** | — |
| **XGBoost Quantile** | temperature_2m | 24h | **1.42** | **1.85** | **0.99** | — |
| **XGBoost Quantile** | temperature_2m | 72h | **2.20** | **2.89** | **1.55** | — |
| **PyTorch LSTM** | temperature_2m | 24h | 1.51 | 1.96 | 1.05 | — |
| **Ensemble (XGB+LSTM)** | temperature_2m | 24h | **1.35** | **1.78** | **0.94** | — |
