"""Security utilities, rate limiting, and input sanitization."""
import time
from typing import Dict, Tuple
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from app.core.errors import format_error_response


class SimpleRateLimiterMiddleware(BaseHTTPMiddleware):
    """In-memory rate limiter per IP address for standard API protection."""
    def __init__(self, app, max_requests: int = 120, window_seconds: int = 60):
        super().__init__(app)
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        # ip -> list of timestamps
        self.clients: Dict[str, list] = {}

    async def dispatch(self, request: Request, call_next):
        # Skip rate limit on docs, openapi, or health checks
        path = request.url.path
        if path.startswith("/docs") or path.startswith("/openapi.json") or path.endswith("/health"):
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        now = time.time()
        
        # Clean timestamps older than window
        timestamps = self.clients.get(client_ip, [])
        timestamps = [ts for ts in timestamps if now - ts < self.window_seconds]
        
        if len(timestamps) >= self.max_requests:
            return JSONResponse(
                status_code=429,
                content=format_error_response("RATE_LIMIT_EXCEEDED", "Too many requests. Please slow down."),
                headers={"Retry-After": str(self.window_seconds)}
            )
        
        timestamps.append(now)
        self.clients[client_ip] = timestamps

        response = await call_next(request)
        # Add basic security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        return response
