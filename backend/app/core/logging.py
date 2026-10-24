"""Structured logging configuration for WeatherGPT."""
import logging
import sys
from typing import Any, Dict


class StructuredFormatter(logging.Formatter):
    """Simple structured formatter with timestamp, level, and component."""
    def format(self, record: logging.LogRecord) -> str:
        timestamp = self.formatTime(record, self.datefmt or "%Y-%m-%d %H:%M:%S")
        log_data = f"[{timestamp}] [{record.levelname:<7}] [{record.name}]: {record.getMessage()}"
        if record.exc_info:
            log_data += "\n" + self.formatException(record.exc_info)
        return log_data


def setup_logging(debug: bool = False) -> logging.Logger:
    """Configure root logger with structured formatter and log level."""
    log_level = logging.DEBUG if debug else logging.INFO
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)

    # Avoid duplicate handlers if called multiple times
    if not root_logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(log_level)
        formatter = StructuredFormatter()
        handler.setFormatter(formatter)
        root_logger.addHandler(handler)

    # Silence noisy third-party loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("aiosqlite").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)

    logger = logging.getLogger("weathergpt")
    logger.setLevel(log_level)
    return logger
