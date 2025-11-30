"""
Alza Cost Control - FastAPI Backend
"""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app.routers import carriers, depots, contracts, prices, proofs, invoices, analysis


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Create tables if they don't exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    # Shutdown: dispose engine
    await engine.dispose()


app = FastAPI(
    title="Alza Cost Control API",
    description="Backend API pro kontrolu nákladů na dopravu",
    version="2.0.0",
    lifespan=lifespan,
    redirect_slashes=True
)

# CORS - configured for Railway deployment
# Frontend URL is set via environment variable
FRONTEND_URL = os.getenv("FRONTEND_URL", "")
ALLOWED_ORIGINS = [
    origin.strip() 
    for origin in FRONTEND_URL.split(",") 
    if origin.strip()
]

# If no origins configured, allow all (development fallback)
if not ALLOWED_ORIGINS:
    ALLOWED_ORIGINS = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Health check
@app.get("/health")
async def health_check():
    return {"status": "ok", "version": "2.0.0"}


# Routers
app.include_router(carriers.router, prefix="/api/carriers", tags=["Carriers"])
app.include_router(depots.router, prefix="/api/depots", tags=["Depots"])
app.include_router(contracts.router, prefix="/api/contracts", tags=["Contracts"])
app.include_router(prices.router, prefix="/api/prices", tags=["Prices"])
app.include_router(proofs.router, prefix="/api/proofs", tags=["Proofs"])
app.include_router(invoices.router, prefix="/api/invoices", tags=["Invoices"])
app.include_router(analysis.router, prefix="/api/analysis", tags=["Analysis"])
