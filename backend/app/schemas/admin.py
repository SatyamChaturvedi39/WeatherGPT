"""Pydantic schemas for admin status and metrics."""
from datetime import datetime
from typing import Dict, List, Optional
from pydantic import BaseModel


class HorizonMetric(BaseModel):
    horizon_hours: int
    mae: float
    rmse: float
    crps: Optional[float] = None
    brier_score: Optional[float] = None


class ModelMetricSummary(BaseModel):
    model_name: str
    target: str
    horizons: List[HorizonMetric]
    overall_mae: float
    overall_rmse: float


class IngestionStatusSummary(BaseModel):
    last_run_time: Optional[datetime] = None
    last_run_status: str
    last_rows_ingested: int
    total_locations: int
    total_observation_rows: int
    scheduler_running: bool


class PipelineHealth(BaseModel):
    status: str  # "healthy", "degraded", "failing"
    database_connected: bool
    open_meteo_reachable: bool
    scheduler_active: bool
    issues: List[str] = []


class AdminStatusResponse(BaseModel):
    pipeline_health: PipelineHealth
    ingestion: IngestionStatusSummary
    model_metrics: List[ModelMetricSummary]
    system_latency_ms: Dict[str, float]
    server_time: datetime
