"""
Test-wide settings: never start background jobs, and keep every SQLite store
in a throwaway directory so tests never write to the real crowd_data/ files.
"""

import os
import tempfile

_tmp = tempfile.mkdtemp(prefix="weathergpt-tests-")
os.environ.setdefault("BACKGROUND_JOBS_ENABLED", "false")
os.environ.setdefault("CROWD_DB_PATH", os.path.join(_tmp, "crowd_reports.db"))
os.environ.setdefault("ALERT_HISTORY_DB_PATH", os.path.join(_tmp, "alert_history.db"))
os.environ.setdefault("FORECAST_LOG_DB_PATH", os.path.join(_tmp, "forecast_log.db"))
os.environ.setdefault("PUSH_DB_PATH", os.path.join(_tmp, "push_subscriptions.db"))
os.environ.setdefault("VAPID_PRIVATE_KEY_PATH", os.path.join(_tmp, "vapid_private.pem"))
