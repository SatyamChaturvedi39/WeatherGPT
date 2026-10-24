"""Consistent error definitions and FastAPI exception handlers."""
from typing import Any, Dict, Optional
from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class AppError(Exception):
    """Base application exception."""
    def __init__(self, code: str, message: str, status_code: int = status.HTTP_400_BAD_REQUEST, details: Optional[Any] = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details


class NotFoundError(AppError):
    def __init__(self, message: str = "Resource not found"):
        super().__init__(code="NOT_FOUND", message=message, status_code=status.HTTP_404_NOT_FOUND)


class IngestionError(AppError):
    def __init__(self, message: str = "Data ingestion failed"):
        super().__init__(code="INGESTION_ERROR", message=message, status_code=status.HTTP_502_BAD_GATEWAY)


class ValidationError(AppError):
    def __init__(self, message: str = "Validation failed", details: Optional[Any] = None):
        super().__init__(code="VALIDATION_ERROR", message=message, status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, details=details)


def format_error_response(code: str, message: str, details: Optional[Any] = None) -> Dict[str, Any]:
    """Uniform error response wrapper."""
    payload: Dict[str, Any] = {
        "error": {
            "code": code,
            "message": message,
        }
    }
    if details:
        payload["error"]["details"] = details
    return payload


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content=format_error_response(exc.code, exc.message, exc.details),
    )


async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    code = "HTTP_ERROR"
    if exc.status_code == 404:
        code = "NOT_FOUND"
    elif exc.status_code == 403:
        code = "FORBIDDEN"
    elif exc.status_code == 401:
        code = "UNAUTHORIZED"
    return JSONResponse(
        status_code=exc.status_code,
        content=format_error_response(code, str(exc.detail)),
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    errors = exc.errors()
    first_error = errors[0] if errors else {}
    msg = first_error.get("msg", "Request validation failed")
    loc = " -> ".join(str(l) for l in first_error.get("loc", []))
    full_msg = f"{loc}: {msg}" if loc else msg
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=format_error_response("VALIDATION_ERROR", full_msg, details=errors),
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=format_error_response("INTERNAL_SERVER_ERROR", "An unexpected internal error occurred."),
    )
