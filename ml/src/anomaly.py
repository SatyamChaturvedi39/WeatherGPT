"""
Anomaly detection module.

Uses Isolation Forest on model residuals to detect
abrupt weather pattern shifts and trigger risk alerts.
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
import joblib


class WeatherAnomalyDetector:
    """
    Detects anomalous weather patterns using Isolation Forest.

    Designed to run on model residuals (actual - predicted) to
    identify when the weather deviates significantly from
    expected patterns.
    """

    def __init__(self, contamination: float = 0.05, random_state: int = 42):
        """
        Args:
            contamination: Expected proportion of anomalies (0-0.5).
            random_state: Random seed for reproducibility.
        """
        self.contamination = contamination
        self.random_state = random_state
        self.model = IsolationForest(
            contamination=contamination,
            random_state=random_state,
            n_estimators=200,
            max_samples="auto",
        )
        self.is_fitted = False

    def fit(self, residuals: np.ndarray) -> "WeatherAnomalyDetector":
        """
        Fit the anomaly detector on historical residuals.

        Args:
            residuals: Array of shape (n_samples, n_features) or (n_samples,).
                       Typically model residuals (actual - predicted).
        """
        if residuals.ndim == 1:
            residuals = residuals.reshape(-1, 1)
        self.model.fit(residuals)
        self.is_fitted = True
        return self

    def predict(self, residuals: np.ndarray) -> np.ndarray:
        """
        Predict anomaly labels.

        Args:
            residuals: New residuals to check.

        Returns:
            Array of labels: 1 for normal, -1 for anomaly.
        """
        if not self.is_fitted:
            raise RuntimeError("Detector must be fitted before predicting.")
        if residuals.ndim == 1:
            residuals = residuals.reshape(-1, 1)
        return self.model.predict(residuals)

    def score_samples(self, residuals: np.ndarray) -> np.ndarray:
        """
        Get anomaly scores (lower = more anomalous).

        Args:
            residuals: Data to score.

        Returns:
            Array of anomaly scores.
        """
        if not self.is_fitted:
            raise RuntimeError("Detector must be fitted before scoring.")
        if residuals.ndim == 1:
            residuals = residuals.reshape(-1, 1)
        return self.model.score_samples(residuals)

    def save(self, filepath: str):
        """Save the fitted model to disk."""
        joblib.dump(self.model, filepath)
        print(f"Anomaly detector saved to {filepath}")

    def load(self, filepath: str):
        """Load a fitted model from disk."""
        self.model = joblib.load(filepath)
        self.is_fitted = True
        print(f"Anomaly detector loaded from {filepath}")
