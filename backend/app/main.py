"""
Alza Cost Control - FastAPI Backend
"""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.database import engine, Base
from app.routers import carriers, depots, contracts, prices, proofs, invoices, analysis


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup - tables already exist from Prisma, no need to create
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

# CORS - must be added before routes
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


# Manual OPTIONS handler for preflight requests
@app.options("/{rest_of_path:path}")
async def preflight_handler(rest_of_path: str):
    return JSONResponse(
        content={"message": "OK"},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
            "Access-Control-Allow-Headers": "*",
        }
    )


# Health check
@app.get("/health")
async def health_check():
    return {"status": "ok"}

# Routers
app.include_router(carriers.router, prefix="/api/carriers", tags=["Carriers"])
app.include_router(depots.router, prefix="/api/depots", tags=["Depots"])
app.include_router(contracts.router, prefix="/api/contracts", tags=["Contracts"])
app.include_router(prices.router, prefix="/api/prices", tags=["Prices"])
app.include_router(proofs.router, prefix="/api/proofs", tags=["Proofs"])
app.include_router(invoices.router, prefix="/api/invoices", tags=["Invoices"])
app.include_router(analysis.router, prefix="/api/analysis", tags=["Analysis"])
