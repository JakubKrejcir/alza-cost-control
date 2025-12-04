"""
API Key Authentication Middleware
"""
import os
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

API_KEY = os.getenv("API_KEY")

# Endpointy, které nevyžadují autentizaci
PUBLIC_PATHS = [
    "/health",
    "/docs",
    "/redoc",
    "/openapi.json",
    "/api/auth/login",
    "/api/auth/verify",
    "/api/auth/logout",
]


class APIKeyMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # V development módu bez API_KEY povol vše
        if not API_KEY:
            return await call_next(request)
        
        # Povol OPTIONS requesty (CORS preflight)
        if request.method == "OPTIONS":
            return await call_next(request)
        
        # Povol veřejné endpointy
        if any(request.url.path.startswith(path) for path in PUBLIC_PATHS):
            return await call_next(request)
        
        # Zkontroluj API klíč
        api_key = request.headers.get("X-API-Key")
        
        if not api_key:
            return JSONResponse(
                status_code=401,
                content={"detail": "Missing API key. Include 'X-API-Key' header."}
            )
        
        if api_key != API_KEY:
            return JSONResponse(
                status_code=403,
                content={"detail": "Invalid API key"}
            )
        
        return await call_next(request)
