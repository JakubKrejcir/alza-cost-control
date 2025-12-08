"""
Depots API Router
Updated: 2025-12-07 - Added DepotNameMapping, operator info, stats
"""
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Depot, Carrier, DepotNameMapping, RouteDepotHistory
from app.schemas import DepotCreate, DepotUpdate, DepotResponse

router = APIRouter()


# =============================================================================
# DEPOT CRUD ENDPOINTS
# =============================================================================

@router.get("", response_model=List[DepotResponse])
async def get_depots(
    carrier_id: Optional[int] = Query(None, description="Filter by carrier (owner)"),
    operator_type: Optional[str] = Query(None, description="Filter by operator type (ALZA, CARRIER)"),
    operator_carrier_id: Optional[int] = Query(None, description="Filter by operator carrier ID"),
    active_only: bool = Query(True, description="Show only active depots"),
    db: AsyncSession = Depends(get_db)
):
    """Get all depots with optional filters"""
    query = select(Depot).options(
        selectinload(Depot.carrier),
        selectinload(Depot.operator_carrier)
    )
    
    if carrier_id:
        query = query.where(Depot.carrier_id == carrier_id)
    
    if operator_type:
        query = query.where(Depot.operator_type == operator_type)
    
    if operator_carrier_id:
        query = query.where(Depot.operator_carrier_id == operator_carrier_id)
    
    if active_only:
        now = datetime.utcnow()
        query = query.where(
            and_(
                Depot.valid_from <= now,
                or_(Depot.valid_to.is_(None), Depot.valid_to > now)
            )
        )
    
    query = query.order_by(Depot.name)
    
    result = await db.execute(query)
    depots = result.scalars().all()
    
    # Enhance response with operator info
    response = []
    for depot in depots:
        depot_dict = {
            "id": depot.id,
            "carrierId": depot.carrier_id,
            "name": depot.name,
            "code": depot.code,
            "type": depot.type,
            "address": depot.address,
            "latitude": float(depot.latitude) if depot.latitude else None,
            "longitude": float(depot.longitude) if depot.longitude else None,
            "region": depot.region,
            "depotType": depot.depot_type,
            "operatorType": depot.operator_type,
            "operatorCarrierId": depot.operator_carrier_id,
            "operatorCarrierName": depot.operator_carrier.name if depot.operator_carrier else None,
            "validFrom": depot.valid_from,
            "validTo": depot.valid_to,
            "locationCode": depot.location_code,
            "createdAt": depot.created_at,
            "carrier": {
                "id": depot.carrier.id,
                "name": depot.carrier.name
            } if depot.carrier else None
        }
        response.append(depot_dict)
    
    return response


@router.get("/stats")
async def get_depot_stats(db: AsyncSession = Depends(get_db)):
    """Statistiky dep - počet tras, typ provozovatele."""
    query = select(Depot).options(
        selectinload(Depot.operator_carrier),
        selectinload(Depot.route_depot_history)
    )
    
    result = await db.execute(query)
    depots = result.scalars().all()
    
    now = datetime.utcnow()
    stats = []
    
    for depot in depots:
        # Počet aktuálně přiřazených tras
        active_routes = sum(
            1 for h in depot.route_depot_history
            if h.valid_from <= now and (h.valid_to is None or h.valid_to > now)
        )
        
        stats.append({
            "depotId": depot.id,
            "depotName": depot.name,
            "depotCode": depot.code,
            "operatorType": depot.operator_type,
            "operatorCarrierName": depot.operator_carrier.name if depot.operator_carrier else None,
            "region": depot.region,
            "activeRoutesCount": active_routes
        })
    
    return stats


@router.get("/mappings")
async def get_depot_name_mappings(db: AsyncSession = Depends(get_db)):
    """Získá všechna mapování názvů dep z plánovacích souborů."""
    query = select(DepotNameMapping).options(
        selectinload(DepotNameMapping.depot)
    ).order_by(DepotNameMapping.plan_name)
    
    result = await db.execute(query)
    mappings = result.scalars().all()
    
    return [
        {
            "id": m.id,
            "planName": m.plan_name,
            "depotId": m.depot_id,
            "depotName": m.depot.name,
            "depotCode": m.depot.code
        }
        for m in mappings
    ]


@router.post("/mappings")
async def create_depot_name_mapping(
    plan_name: str = Query(..., description="Název depa z plánovacího souboru"),
    depot_id: int = Query(..., description="ID skutečného depa"),
    db: AsyncSession = Depends(get_db)
):
    """Vytvoří nové mapování názvu depa."""
    # Check depot exists
    depot = await db.get(Depot, depot_id)
    if not depot:
        raise HTTPException(status_code=404, detail="Depot not found")
    
    # Check if mapping already exists
    existing = await db.execute(
        select(DepotNameMapping).where(DepotNameMapping.plan_name == plan_name)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"Mapping for '{plan_name}' already exists")
    
    mapping = DepotNameMapping(
        plan_name=plan_name,
        depot_id=depot_id
    )
    db.add(mapping)
    await db.commit()
    
    return {
        "id": mapping.id,
        "planName": mapping.plan_name,
        "depotId": mapping.depot_id,
        "depotName": depot.name
    }


@router.get("/resolve-name")
async def resolve_depot_name(
    plan_name: str = Query(..., description="Název depa z plánovacího souboru"),
    db: AsyncSession = Depends(get_db)
):
    """
    Přeloží název depa z plánovacího souboru na skutečné depo.
    Např: "Depo Drivecool" → Depo Vratimov
    """
    query = select(DepotNameMapping).options(
        selectinload(DepotNameMapping.depot)
    ).where(DepotNameMapping.plan_name == plan_name)
    
    result = await db.execute(query)
    mapping = result.scalar_one_or_none()
    
    if mapping:
        return {
            "found": True,
            "planName": plan_name,
            "depotId": mapping.depot_id,
            "depotName": mapping.depot.name,
            "depotCode": mapping.depot.code
        }
    
    return {
        "found": False,
        "planName": plan_name,
        "depotId": None,
        "depotName": None,
        "depotCode": None
    }


@router.get("/{depot_id}")
async def get_depot(depot_id: int, db: AsyncSession = Depends(get_db)):
    """Get single depot by ID with full details"""
    result = await db.execute(
        select(Depot)
        .options(
            selectinload(Depot.carrier),
            selectinload(Depot.operator_carrier),
            selectinload(Depot.linehaul_from),
            selectinload(Depot.linehaul_to),
            selectinload(Depot.route_depot_history)
        )
        .where(Depot.id == depot_id)
    )
    depot = result.scalar_one_or_none()
    
    if not depot:
        raise HTTPException(status_code=404, detail="Depot not found")
    
    now = datetime.utcnow()
    active_routes = sum(
        1 for h in depot.route_depot_history
        if h.valid_from <= now and (h.valid_to is None or h.valid_to > now)
    )
    
    return {
        "id": depot.id,
        "carrierId": depot.carrier_id,
        "name": depot.name,
        "code": depot.code,
        "type": depot.type,
        "address": depot.address,
        "latitude": float(depot.latitude) if depot.latitude else None,
        "longitude": float(depot.longitude) if depot.longitude else None,
        "region": depot.region,
        "depotType": depot.depot_type,
        "operatorType": depot.operator_type,
        "operatorCarrierId": depot.operator_carrier_id,
        "operatorCarrierName": depot.operator_carrier.name if depot.operator_carrier else None,
        "validFrom": depot.valid_from,
        "validTo": depot.valid_to,
        "locationCode": depot.location_code,
        "createdAt": depot.created_at,
        "activeRoutesCount": active_routes,
        "carrier": {
            "id": depot.carrier.id,
            "name": depot.carrier.name
        } if depot.carrier else None
    }


@router.post("", status_code=201)
async def create_depot(depot_data: DepotCreate, db: AsyncSession = Depends(get_db)):
    """Create new depot"""
    # Verify carrier exists if provided
    if depot_data.carrier_id:
        carrier_result = await db.execute(
            select(Carrier).where(Carrier.id == depot_data.carrier_id)
        )
        if not carrier_result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Carrier not found")
    
    depot = Depot(**depot_data.model_dump())
    depot.valid_from = datetime.utcnow()
    db.add(depot)
    await db.commit()
    await db.refresh(depot)
    
    return {
        "id": depot.id,
        "name": depot.name,
        "message": "Depot created"
    }


@router.put("/{depot_id}")
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
    
    return {
        "id": depot.id,
        "name": depot.name,
        "message": "Depot updated"
    }


@router.delete("/{depot_id}", status_code=204)
async def delete_depot(depot_id: int, db: AsyncSession = Depends(get_db)):
    """Delete depot"""
    result = await db.execute(select(Depot).where(Depot.id == depot_id))
    depot = result.scalar_one_or_none()
    
    if not depot:
        raise HTTPException(status_code=404, detail="Depot not found")
    
    await db.delete(depot)
    await db.commit()
