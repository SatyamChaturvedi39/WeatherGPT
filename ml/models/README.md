# ML Model Artifacts

This directory stores serialized ML models after training.

## Expected Files (after Phase 2)

- `xgboost_temperature.joblib` — XGBoost temperature forecasting model
- `xgboost_precipitation.joblib` — XGBoost precipitation model
- `lstm_temperature.pt` — PyTorch LSTM model weights
- `anomaly_detector.joblib` — Isolation Forest anomaly detection model
- `scaler.joblib` — Feature scaler (StandardScaler/MinMaxScaler)

## Model Versioning

Models are versioned by date in the filename:
```
xgboost_temperature_v20261015.joblib
```

> **Note:** Model files are excluded from Git via `.gitignore`.
> Store them in a shared drive or model registry for team access.
