"""
Alza Cost Control API - Main Application
"""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.database import engine, Base
from app.api_key_middleware import APIKeyMiddleware
from app.routers import (
    carriers, 
    depots, 
    contracts, 
    prices, 
    proofs, 
    invoices, 
    analysis, 
    route_plans,
    alzabox,
    auth,
    expected_billing
)


async def run_migrations():
    """Run any pending migrations"""
    async with engine.begin() as conn:
        # Check if LoginLog table exists, create if not
        result = await conn.execute(text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'LoginLog'
            )
        """))
        exists = result.scalar()
        
        if not exists:
            await conn.execute(text("""
                CREATE TABLE "LoginLog" (
                    id SERIAL PRIMARY KEY,
                    email VARCHAR(255) NOT NULL,
                    "loginAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    "ipAddress" VARCHAR(45),
                    "userAgent" TEXT
                )
            """))
            print("Migration: Created LoginLog table")
        
        # Check for unique constraint on RoutePlan
        result = await conn.execute(text("""
            SELECT EXISTS (
                SELECT 1 FROM pg_constraint 
                WHERE conname = 'uq_carrier_date_plantype_depot'
            )
        """))
        constraint_exists = result.scalar()
        
        if not constraint_exists:
            # First check if the old constraint exists and drop it
            await conn.execute(text("""
                ALTER TABLE "RoutePlan" 
                DROP CONSTRAINT IF EXISTS "uq_carrier_date_plantype"
            """))
            
            # Add the new constraint with depot
            try:
                await conn.execute(text("""
                    ALTER TABLE "RoutePlan" 
                    ADD CONSTRAINT "uq_carrier_date_plantype_depot" 
                    UNIQUE ("carrierId", "validFrom", "planType", "depot")
                """))
                print("Migration: Added unique constraint with depot")
            except Exception as e:
                print(f"Migration warning: {e}")
            
            print("Migration: Unique constraint updated successfully")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Create tables if they don't exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Run migrations
    await run_migrations()
    
    yield
    # Shutdown: dispose engine
    await engine.dispose()


# Skrýt docs v produkci pokud je nastaven API_KEY
IS_PRODUCTION = bool(os.getenv("API_KEY"))

app = FastAPI(
    title="Alza Cost Control API",
    description="Backend API pro kontrolu nákladů na dopravu",
    version="2.3.0",
    lifespan=lifespan,
    redirect_slashes=True,
    docs_url=None if IS_PRODUCTION else "/docs",
    redoc_url=None if IS_PRODUCTION else "/redoc",
)

# CORS - configured for Railway deployment
FRONTEND_URL = os.getenv("FRONTEND_URL", "")
ALLOWED_ORIGINS = [
    origin.strip() 
    for origin in FRONTEND_URL.split(",") 
    if origin.strip()
]

if not ALLOWED_ORIGINS:
    ALLOWED_ORIGINS = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Key authentication middleware
app.add_middleware(APIKeyMiddleware)


# Health check
@app.get("/health")
async def health_check():
    return {"status": "ok", "version": "2.3.0"}


# Routers
app.include_router(carriers.router, prefix="/api/carriers", tags=["Carriers"])
app.include_router(depots.router, prefix="/api/depots", tags=["Depots"])
app.include_router(contracts.router, prefix="/api/contracts", tags=["Contracts"])
app.include_router(prices.router, prefix="/api/prices", tags=["Prices"])
app.include_router(proofs.router, prefix="/api/proofs", tags=["Proofs"])
app.include_router(invoices.router, prefix="/api/invoices", tags=["Invoices"])
app.include_router(analysis.router, prefix="/api/analysis", tags=["Analysis"])
app.include_router(route_plans.router, prefix="/api/route-plans", tags=["Route Plans"])
app.include_router(alzabox.router, prefix="/api/alzabox", tags=["AlzaBox BI"])
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(expected_billing.router, prefix="/api/expected-billing", tags=["Expected Billing"])
