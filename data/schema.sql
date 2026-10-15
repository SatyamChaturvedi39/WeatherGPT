-- ═══════════════════════════════════════════════════════════════
-- WeatherGPT Database Schema
-- PostgreSQL (compatible with Neon free tier)
--
-- Uses standard B-tree and BRIN indexes as a performant
-- substitute for TimescaleDB hypertables.
-- ═══════════════════════════════════════════════════════════════

-- Weather Observations (ingested from Open-Meteo)
CREATE TABLE IF NOT EXISTS weather_observations (
    id              SERIAL PRIMARY KEY,
    latitude        DOUBLE PRECISION NOT NULL,
    longitude       DOUBLE PRECISION NOT NULL,
    location_name   VARCHAR(255),

    observed_at     TIMESTAMP NOT NULL,
    ingested_at     TIMESTAMP DEFAULT NOW(),

    temperature_2m          DOUBLE PRECISION,
    relative_humidity_2m    DOUBLE PRECISION,
    apparent_temperature    DOUBLE PRECISION,
    precipitation           DOUBLE PRECISION,
    weather_code            INTEGER,
    wind_speed_10m          DOUBLE PRECISION,
    wind_direction_10m      DOUBLE PRECISION,
    surface_pressure        DOUBLE PRECISION,
    cloud_cover             DOUBLE PRECISION
);

-- Composite index: location + time (primary query pattern)
CREATE INDEX IF NOT EXISTS idx_obs_location_time
    ON weather_observations (latitude, longitude, observed_at DESC);

-- BRIN index on observed_at for range scans over large time spans
CREATE INDEX IF NOT EXISTS idx_obs_time_brin
    ON weather_observations USING BRIN (observed_at);


-- Forecast Predictions (from ML models)
CREATE TABLE IF NOT EXISTS forecast_predictions (
    id              SERIAL PRIMARY KEY,
    latitude        DOUBLE PRECISION NOT NULL,
    longitude       DOUBLE PRECISION NOT NULL,

    predicted_at    TIMESTAMP DEFAULT NOW(),
    target_time     TIMESTAMP NOT NULL,

    model_name      VARCHAR(100) NOT NULL,
    model_version   VARCHAR(50),

    temperature_predicted       DOUBLE PRECISION,
    temperature_lower           DOUBLE PRECISION,
    temperature_upper           DOUBLE PRECISION,
    precipitation_probability   DOUBLE PRECISION
);

CREATE INDEX IF NOT EXISTS idx_forecast_location_target
    ON forecast_predictions (latitude, longitude, target_time DESC);


-- Alert Records
CREATE TABLE IF NOT EXISTS alert_records (
    id              SERIAL PRIMARY KEY,
    latitude        DOUBLE PRECISION NOT NULL,
    longitude       DOUBLE PRECISION NOT NULL,
    location_name   VARCHAR(255),

    created_at      TIMESTAMP DEFAULT NOW(),
    expires_at      TIMESTAMP,

    severity        VARCHAR(20) NOT NULL,  -- LOW, MODERATE, HIGH, EXTREME
    alert_type      VARCHAR(100) NOT NULL,
    title           VARCHAR(255) NOT NULL,
    description     VARCHAR(1000),

    triggered_by    VARCHAR(100)  -- threshold, anomaly_detection, manual
);

CREATE INDEX IF NOT EXISTS idx_alert_location
    ON alert_records (latitude, longitude, created_at DESC);
