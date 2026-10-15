"""
SHAP-based explainability module.

Provides "why this forecast" explanations for every ML prediction,
surfaced in the chat answers and explainability panels.
"""

import numpy as np
import shap


class ForecastExplainer:
    """
    Generates SHAP-based explanations for weather forecast models.

    Supports tree-based models (XGBoost) out of the box.
    LSTM explanations use KernelSHAP (slower but model-agnostic).
    """

    def __init__(self, model, model_type: str = "tree"):
        """
        Args:
            model: Trained ML model (XGBoost, sklearn, or PyTorch).
            model_type: "tree" for tree-based models, "kernel" for neural nets.
        """
        self.model = model
        self.model_type = model_type
        self.explainer = None

    def initialize(self, background_data: np.ndarray):
        """
        Initialize the SHAP explainer with background/training data.

        Args:
            background_data: Representative sample of training data
                             for computing Shapley values.
        """
        if self.model_type == "tree":
            self.explainer = shap.TreeExplainer(self.model)
        else:
            # KernelSHAP for model-agnostic explanations (e.g., LSTM)
            self.explainer = shap.KernelExplainer(
                self.model.predict if hasattr(self.model, 'predict') else self.model,
                background_data,
            )

    def explain(self, X: np.ndarray) -> shap.Explanation:
        """
        Compute SHAP values for given inputs.

        Args:
            X: Input features to explain, shape (n_samples, n_features).

        Returns:
            SHAP Explanation object with values and base values.
        """
        if self.explainer is None:
            raise RuntimeError("Call initialize() before explain().")
        return self.explainer(X)

    def get_top_features(
        self,
        X: np.ndarray,
        feature_names: list[str],
        top_k: int = 5,
    ) -> list[dict]:
        """
        Get the top contributing features for a prediction.

        Args:
            X: Single input sample, shape (1, n_features).
            feature_names: List of feature names.
            top_k: Number of top features to return.

        Returns:
            List of dicts with feature name, SHAP value, and direction.
        """
        explanation = self.explain(X)
        shap_values = explanation.values[0] if explanation.values.ndim > 1 else explanation.values

        # Sort by absolute SHAP value
        indices = np.argsort(np.abs(shap_values))[::-1][:top_k]

        return [
            {
                "feature": feature_names[i],
                "shap_value": float(shap_values[i]),
                "direction": "increases" if shap_values[i] > 0 else "decreases",
                "importance": float(np.abs(shap_values[i])),
            }
            for i in indices
        ]

    def explain_in_natural_language(
        self,
        X: np.ndarray,
        feature_names: list[str],
        prediction_value: float,
        target_name: str = "temperature",
    ) -> str:
        """
        Generate a human-readable explanation of a prediction.

        Used in the chat interface and explainability panels.

        Args:
            X: Single input sample.
            feature_names: Feature names.
            prediction_value: The model's prediction.
            target_name: What is being predicted.

        Returns:
            Natural language explanation string.
        """
        top_features = self.get_top_features(X, feature_names, top_k=3)

        explanation_parts = [
            f"The predicted {target_name} is {prediction_value:.1f}°C."
        ]

        for feat in top_features:
            direction = "pushing it higher" if feat["direction"] == "increases" else "pulling it lower"
            explanation_parts.append(
                f"• {feat['feature']} is {direction} (impact: {feat['shap_value']:+.2f})"
            )

        return "\n".join(explanation_parts)
