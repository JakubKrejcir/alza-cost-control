"""
Depots API Router
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Depot, Carrier
from app.schemas import DepotCreate, DepotUpdate, DepotResponse

router = APIRouter()


@router.get("/", response_model=List[DepotResponse])
async def get_depots(
    carrier_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """Get all depots, optionally filtered by carrier"""
    query = select(Depot).options(selectinload(Depot.carrier))
    
    if carrier_id:
        query = query.where(Depot.carrier_id == carrier_id)
    
    query = query.order_by(Depot.carrier_id, Depot.name)
    
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{depot_id}", response_model=DepotResponse)
async def get_depot(depot_id: int, db: AsyncSession = Depends(get_db)):
    """Get single depot by ID"""
    result = await db.execute(
        select(Depot)
        .options(
            selectinload(Depot.carrier),
            selectinload(Depot.linehaul_from),
            selectinload(Depot.linehaul_to)
        )
        .where(Depot.id == depot_id)
    )
    depot = result.scalar_one_or_none()
    
    if not depot:
        raise HTTPException(status_code=404, detail="Depot not found")
    
    return depot


@router.post("/", response_model=DepotResponse, status_code=201)
async def create_depot(depot_data: DepotCreate, db: AsyncSession = Depends(get_db)):
    """Create new depot"""
    # Verify carrier exists
    carrier_result = await db.execute(
        select(Carrier).where(Carrier.id == depot_data.carrier_id)
    )
    if not carrier_result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Carrier not found")
    
    depot = Depot(**depot_data.model_dump())
    db.add(depot)
    await db.commit()
    await db.refresh(depot)
    return depot


@router.put("/{depot_id}", response_model=DepotResponse)
async def update_depot(
    depot_id: int, 
    depot_data: DepotUpdate, 
    db: AsyncSession = Depends(get_db)
):
    """Update depot"""
    result = await db.execute(select(Depot).where(Depot.id == depot_id))
    depot = result.scalar_one_or_none()
    
    if not depot:
        raise HTTPException(status_code=404, detail="Depot not found")
    
    update_data = depot_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(depot, field, value)
    
    await db.commit()
    await db.refresh(depot)
    return depot


@router.delete("/{depot_id}", status_code=204)
async def delete_depot(depot_id: int, db: AsyncSession = Depends(get_db)):
    """Delete depot"""
    result = await db.execute(select(Depot).where(Depot.id == depot_id))
    depot = result.scalar_one_or_none()
    
    if not depot:
        raise HTTPException(status_code=404, detail="Depot not found")
    
    await db.delete(depot)
    await db.commit()
