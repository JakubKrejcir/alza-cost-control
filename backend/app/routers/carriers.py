"""
Carriers API Router
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Carrier, Depot, Proof, Invoice, Contract
from app.schemas import CarrierCreate, CarrierUpdate, CarrierResponse, CarrierWithCounts

router = APIRouter()


@router.get("/", response_model=List[CarrierWithCounts])
async def get_carriers(db: AsyncSession = Depends(get_db)):
    """Get all carriers with counts"""
    result = await db.execute(
        select(Carrier)
        .options(selectinload(Carrier.depots))
        .order_by(Carrier.name)
    )
    carriers = result.scalars().all()
    
    # Get counts for each carrier
    response = []
    for carrier in carriers:
        # Get counts
        proofs_count = await db.scalar(
            select(func.count(Proof.id)).where(Proof.carrier_id == carrier.id)
        )
        invoices_count = await db.scalar(
            select(func.count(Invoice.id)).where(Invoice.carrier_id == carrier.id)
        )
        contracts_count = await db.scalar(
            select(func.count(Contract.id)).where(Contract.carrier_id == carrier.id)
        )
        
        response.append(CarrierWithCounts(
            id=carrier.id,
            name=carrier.name,
            ico=carrier.ico,
            dic=carrier.dic,
            address=carrier.address,
            contact=carrier.contact,
            created_at=carrier.created_at,
            updated_at=carrier.updated_at,
            proofs_count=proofs_count or 0,
            invoices_count=invoices_count or 0,
            contracts_count=contracts_count or 0
        ))
    
    return response


@router.get("/{carrier_id}", response_model=CarrierResponse)
async def get_carrier(carrier_id: int, db: AsyncSession = Depends(get_db)):
    """Get single carrier by ID"""
    result = await db.execute(
        select(Carrier)
        .options(
            selectinload(Carrier.depots),
            selectinload(Carrier.contracts),
            selectinload(Carrier.prices)
        )
        .where(Carrier.id == carrier_id)
    )
    carrier = result.scalar_one_or_none()
    
    if not carrier:
        raise HTTPException(status_code=404, detail="Carrier not found")
    
    return carrier


@router.post("/", response_model=CarrierResponse, status_code=201)
async def create_carrier(carrier_data: CarrierCreate, db: AsyncSession = Depends(get_db)):
    """Create new carrier"""
    carrier = Carrier(**carrier_data.model_dump())
    db.add(carrier)
    await db.commit()
    await db.refresh(carrier)
    return carrier


@router.put("/{carrier_id}", response_model=CarrierResponse)
async def update_carrier(
    carrier_id: int, 
    carrier_data: CarrierUpdate, 
    db: AsyncSession = Depends(get_db)
):
    """Update carrier"""
    result = await db.execute(select(Carrier).where(Carrier.id == carrier_id))
    carrier = result.scalar_one_or_none()
    
    if not carrier:
        raise HTTPException(status_code=404, detail="Carrier not found")
    
    update_data = carrier_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(carrier, field, value)
    
    await db.commit()
    await db.refresh(carrier)
    return carrier


@router.delete("/{carrier_id}", status_code=204)
async def delete_carrier(carrier_id: int, db: AsyncSession = Depends(get_db)):
    """Delete carrier"""
    result = await db.execute(select(Carrier).where(Carrier.id == carrier_id))
    carrier = result.scalar_one_or_none()
    
    if not carrier:
        raise HTTPException(status_code=404, detail="Carrier not found")
    
    await db.delete(carrier)
    await db.commit()
