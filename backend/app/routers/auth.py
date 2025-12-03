"""
Auth Router - Jednoduchá autentizace heslem
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from datetime import datetime, timedelta
from pydantic import BaseModel
import hashlib
import secrets
import os
import logging

from app.database import get_db

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)

# Heslo z environment variable
APP_PASSWORD = os.getenv("APP_PASSWORD", "admin123")  # Default pro development

# Session tokens (in-memory, pro jednoduchost)
# V produkci by bylo lepší Redis nebo DB
active_sessions = {}

class LoginRequest(BaseModel):
    password: str

class LoginResponse(BaseModel):
    success: bool
    token: str | None = None
    message: str | None = None


@router.post("/login", response_model=LoginResponse)
async def login(
    request: Request,
    login_data: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """Ověření hesla a vytvoření session."""
    
    # Získej IP a user agent
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")
    
    # Ověř heslo
    is_valid = login_data.password == APP_PASSWORD
    
    # Zaloguj pokus
    await log_login_attempt(db, client_ip, user_agent, is_valid)
    
    if not is_valid:
        logger.warning(f"Failed login attempt from {client_ip}")
        raise HTTPException(status_code=401, detail="Nesprávné heslo")
    
    # Vytvoř session token
    token = secrets.token_urlsafe(32)
    active_sessions[token] = {
        "created_at": datetime.utcnow(),
        "ip": client_ip,
        "expires_at": datetime.utcnow() + timedelta(days=7)
    }
    
    logger.info(f"Successful login from {client_ip}")
    
    return LoginResponse(
        success=True,
        token=token,
        message="Přihlášení úspěšné"
    )


@router.post("/verify")
async def verify_token(request: Request):
    """Ověření platnosti tokenu."""
    
    auth_header = request.headers.get("authorization", "")
    token = auth_header.replace("Bearer ", "") if auth_header.startswith("Bearer ") else None
    
    if not token or token not in active_sessions:
        raise HTTPException(status_code=401, detail="Neplatný token")
    
    session = active_sessions[token]
    
    # Kontrola expirace
    if datetime.utcnow() > session["expires_at"]:
        del active_sessions[token]
        raise HTTPException(status_code=401, detail="Token expiroval")
    
    return {"valid": True}


@router.post("/logout")
async def logout(request: Request):
    """Odhlášení - smazání session."""
    
    auth_header = request.headers.get("authorization", "")
    token = auth_header.replace("Bearer ", "") if auth_header.startswith("Bearer ") else None
    
    if token and token in active_sessions:
        del active_sessions[token]
    
    return {"success": True, "message": "Odhlášeno"}


@router.get("/logs")
async def get_login_logs(
    limit: int = 50,
    db: AsyncSession = Depends(get_db)
):
    """Získání logů přihlášení."""
    
    result = await db.execute(text('''
        SELECT id, ip_address, user_agent, success, created_at
        FROM "LoginLog"
        ORDER BY created_at DESC
        LIMIT :limit
    '''), {"limit": limit})
    
    logs = []
    for row in result.fetchall():
        logs.append({
            "id": row[0],
            "ip_address": row[1],
            "user_agent": row[2][:50] if row[2] else None,  # Zkrátit UA
            "success": row[3],
            "created_at": row[4].isoformat() if row[4] else None
        })
    
    return {"logs": logs}


async def log_login_attempt(db: AsyncSession, ip: str, user_agent: str, success: bool):
    """Uložení pokusu o přihlášení do DB."""
    try:
        await db.execute(text('''
            INSERT INTO "LoginLog" (ip_address, user_agent, success, created_at)
            VALUES (:ip, :ua, :success, :created_at)
        '''), {
            "ip": ip,
            "ua": user_agent[:255] if user_agent else None,
            "success": success,
            "created_at": datetime.utcnow()
        })
        await db.commit()
    except Exception as e:
        logger.error(f"Failed to log login attempt: {e}")
        # Nepřerušuj login kvůli chybě logování
