"""
Alza Cost Control - FastAPI Backend
"""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.database import engine, Base
from app.middleware import APIKeyMiddleware
from app.routers import carriers, depots, contracts, prices, proofs, invoices, analysis
from app.routers import route_plans
from app.routers import alzabox
from app.routers import auth

async def run_migrations():
    """Run database migrations on startup"""
    async with engine.begin() as conn:
        # Check if planType column exists
        result = await conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'RoutePlan' AND column_name = 'planType'
        """))
        column_exists = result.fetchone() is not None
        
        if not column_exists:
            print("Migration: Adding planType column to RoutePlan...")
            
            # Add column
            await conn.execute(text("""
                ALTER TABLE "RoutePlan" 
                ADD COLUMN "planType" VARCHAR(10) DEFAULT 'BOTH'
            """))
            
            # Set default for existing records
            await conn.execute(text("""
                UPDATE "RoutePlan" 
                SET "planType" = 'BOTH' 
                WHERE "planType" IS NULL
            """))
            
            print("Migration: planType column added successfully")
        
        # Check if depot column exists
        result = await conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'RoutePlan' AND column_name = 'depot'
        """))
        depot_column_exists = result.fetchone() is not None
        
        if not depot_column_exists:
            print("Migration: Adding depot column to RoutePlan...")
            
            await conn.execute(text("""
                ALTER TABLE "RoutePlan" 
                ADD COLUMN "depot" VARCHAR(20) DEFAULT 'BOTH'
            """))
            
            print("Migration: depot column added successfully")
        
        # Check if vratimovStops column exists
        result = await conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'RoutePlan' AND column_name = 'vratimovStops'
        """))
        stops_column_exists = result.fetchone() is not None
        
        if not stops_column_exists:
            print("Migration: Adding stops per depot columns to RoutePlan...")
            
            await conn.execute(text("""
                ALTER TABLE "RoutePlan" 
                ADD COLUMN IF NOT EXISTS "vratimovStops" INTEGER DEFAULT 0
            """))
            await conn.execute(text("""
                ALTER TABLE "RoutePlan" 
                ADD COLUMN IF NOT EXISTS "bydzovStops" INTEGER DEFAULT 0
            """))
            
            print("Migration: stops columns added successfully")
        
        # Check if vratimovKm column exists
        result = await conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'RoutePlan' AND column_name = 'vratimovKm'
        """))
        km_column_exists = result.fetchone() is not None
        
        if not km_column_exists:
            print("Migration: Adding km per depot columns to RoutePlan...")
            
            await conn.execute(text("""
                ALTER TABLE "RoutePlan" 
                ADD COLUMN IF NOT EXISTS "vratimovKm" NUMERIC(10, 2) DEFAULT 0
            """))
            await conn.execute(text("""
                ALTER TABLE "RoutePlan" 
                ADD COLUMN IF NOT EXISTS "bydzovKm" NUMERIC(10, 2) DEFAULT 0
            """))
            
            print("Migration: km columns added successfully")
        
        # Check if vratimovDurationMin column exists
        result = await conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'RoutePlan' AND column_name = 'vratimovDurationMin'
        """))
        duration_column_exists = result.fetchone() is not None
        
        if not duration_column_exists:
            print("Migration: Adding duration per depot columns to RoutePlan...")
            
            await conn.execute(text("""
                ALTER TABLE "RoutePlan" 
                ADD COLUMN IF NOT EXISTS "vratimovDurationMin" INTEGER DEFAULT 0
            """))
            await conn.execute(text("""
                ALTER TABLE "RoutePlan" 
                ADD COLUMN IF NOT EXISTS "bydzovDurationMin" INTEGER DEFAULT 0
            """))
            
            print("Migration: duration columns added successfully")
        
        # Check if NEW unique constraint exists (with depot)
        result = await conn.execute(text("""
            SELECT constraint_name 
            FROM information_schema.table_constraints 
            WHERE table_name = 'RoutePlan' 
            AND constraint_name = 'uq_carrier_date_plantype_depot'
        """))
        new_constraint_exists = result.fetchone() is not None
        
        if not new_constraint_exists:
            print("Migration: Updating unique constraint to include depot...")
            
            # Drop old constraints if they exist
            await conn.execute(text("""
                ALTER TABLE "RoutePlan" 
                DROP CONSTRAINT IF EXISTS uq_carrier_date_plantype
            """))
            await conn.execute(text("""
                ALTER TABLE "RoutePlan" 
                DROP CONSTRAINT IF EXISTS uq_carrier_date
            """))
            
            # Add new constraint with depot
            await conn.execute(text("""
                ALTER TABLE "RoutePlan" 
                ADD CONSTRAINT uq_carrier_date_plantype_depot 
                UNIQUE ("carrierId", "validFrom", "planType", "depot")
            """))
            
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
    version="2.2.0",
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
    return {"status": "ok", "version": "2.2.0"}


# Routers
app.include_router(carriers.router, prefix="/api/carriers", tags=["Carriers"])
app.include_router(depots.router, prefix="/api/depots", tags=["Depots"])
app.include_router(contracts.router, prefix="/api/contracts", tags=["Contracts"])
app.include_router(prices.router, prefix="/api/prices", tags=["Prices"])
app.include_router(proofs.router, prefix="/api/proofs", tags=["Proofs"])
app.include_router(invoices.router, prefix="/api/invoices", tags=["Invoices"])
app.include_router(analysis.router, prefix="/api/analysis", tags=["Analysis"])
app.include_router(route_plans.router, prefix="/api/route-plans", tags=["Route Plans"])
app.include_router(alzabox.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
