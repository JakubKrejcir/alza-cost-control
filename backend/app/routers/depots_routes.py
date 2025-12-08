"""
API Routes for Depots and Routes management
Created: 2025-12-07
"""
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from pydantic import BaseModel

from app.database import get_db
from app.models import (
    Depot, DepotNameMapping, Route, RouteDepotHistory, 
    RouteCarrierHistory, Carrier
)

router = APIRouter(prefix="/api", tags=["depots", "routes"])


# =============================================================================
# PYDANTIC SCHEMAS
# =============================================================================

class DepotBase(BaseModel):
    name: str
    code: Optional[str] = None
    depot_type: str = 'DISTRIBUTION'
    region: Optional[str] = None
    operator_type: str = 'CARRIER'
    operator_carrier_id: Optional[int] = None
    location_code: Optional[str] = None
    address: Optional[str] = None

class DepotCreate(DepotBase):
    pass

class DepotResponse(DepotBase):
    id: int
    carrier_id: Optional[int] = None
    valid_from: datetime
    valid_to: Optional[datetime] = None
    created_at: datetime
    operator_carrier_name: Optional[str] = None
    
    class Config:
        from_attributes = True

class RouteBase(BaseModel):
    route_name: str
    region: Optional[str] = None
    description: Optional[str] = None
    is_active: bool = True

class RouteCreate(RouteBase):
    depot_id: Optional[int] = None
    carrier_id: Optional[int] = None

class RouteResponse(RouteBase):
    id: int
    created_at: datetime
    current_depot: Optional[DepotResponse] = None
    current_carrier_id: Optional[int] = None
    current_carrier_name: Optional[str] = None
    
    class Config:
        from_attributes = True

class RouteDepotHistoryResponse(BaseModel):
    id: int
    route_id: int
    depot_id: int
    depot_name: str
    valid_from: datetime
    valid_to: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class RouteCarrierHistoryResponse(BaseModel):
    id: int
    route_id: int
    carrier_id: int
    carrier_name: str
    valid_from: datetime
    valid_to: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class DepotNameMappingResponse(BaseModel):
    id: int
    plan_name: str
    depot_id: int
    depot_name: str
    
    class Config:
        from_attributes = True


# =============================================================================
# DEPOT ENDPOINTS
# =============================================================================

@router.get("/depots", response_model=List[DepotResponse])
async def get_depots(
    operator_type: Optional[str] = Query(None, description="Filter by operator type (ALZA, CARRIER)"),
    carrier_id: Optional[int] = Query(None, description="Filter by operator carrier ID"),
    active_only: bool = Query(True, description="Show only active depots"),
    db: AsyncSession = Depends(get_db)
):
    """Získá seznam všech dep."""
    query = select(Depot).options(
        selectinload(Depot.operator_carrier)
    )
    
    if operator_type:
        query = query.where(Depot.operator_type == operator_type)
    
    if carrier_id:
        query = query.where(Depot.operator_carrier_id == carrier_id)
    
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
    
    return [
        {
            **depot.__dict__,
            "operator_carrier_name": depot.operator_carrier.name if depot.operator_carrier else None
        }
        for depot in depots
    ]


@router.get("/depots/{depot_id}", response_model=DepotResponse)
async def get_depot(depot_id: int, db: AsyncSession = Depends(get_db)):
    """Získá detail depa."""
    query = select(Depot).options(
        selectinload(Depot.operator_carrier)
    ).where(Depot.id == depot_id)
    
    result = await db.execute(query)
    depot = result.scalar_one_or_none()
    
    if not depot:
        raise HTTPException(status_code=404, detail="Depot not found")
    
    return {
        **depot.__dict__,
        "operator_carrier_name": depot.operator_carrier.name if depot.operator_carrier else None
    }


@router.post("/depots", response_model=DepotResponse)
async def create_depot(depot_data: DepotCreate, db: AsyncSession = Depends(get_db)):
    """Vytvoří nové depo."""
    depot = Depot(
        name=depot_data.name,
        code=depot_data.code,
        depot_type=depot_data.depot_type,
        region=depot_data.region,
        operator_type=depot_data.operator_type,
        operator_carrier_id=depot_data.operator_carrier_id,
        location_code=depot_data.location_code,
        address=depot_data.address,
        valid_from=datetime.utcnow()
    )
    
    db.add(depot)
    await db.commit()
    await db.refresh(depot)
    
    return depot


@router.get("/depots/mappings", response_model=List[DepotNameMappingResponse])
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
            "plan_name": m.plan_name,
            "depot_id": m.depot_id,
            "depot_name": m.depot.name
        }
        for m in mappings
    ]


@router.post("/depots/resolve-name")
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
            "plan_name": plan_name,
            "depot_id": mapping.depot_id,
            "depot_name": mapping.depot.name,
            "depot_code": mapping.depot.code
        }
    
    return {
        "found": False,
        "plan_name": plan_name,
        "depot_id": None,
        "depot_name": None
    }


# =============================================================================
# ROUTE ENDPOINTS
# =============================================================================

@router.get("/routes", response_model=List[RouteResponse])
async def get_routes(
    region: Optional[str] = Query(None, description="Filter by region"),
    depot_id: Optional[int] = Query(None, description="Filter by current depot"),
    carrier_id: Optional[int] = Query(None, description="Filter by current carrier"),
    active_only: bool = Query(True, description="Show only active routes"),
    db: AsyncSession = Depends(get_db)
):
    """Získá seznam všech tras s aktuálním depem a dopravcem."""
    query = select(Route).options(
        selectinload(Route.depot_history).selectinload(RouteDepotHistory.depot),
        selectinload(Route.carrier_history).selectinload(RouteCarrierHistory.carrier)
    )
    
    if region:
        query = query.where(Route.region == region)
    
    if active_only:
        query = query.where(Route.is_active == True)
    
    query = query.order_by(Route.route_name)
    
    result = await db.execute(query)
    routes = result.scalars().all()
    
    now = datetime.utcnow()
    response = []
    
    for route in routes:
        # Najdi aktuální depo
        current_depot = None
        for history in route.depot_history:
            if history.valid_from <= now and (history.valid_to is None or history.valid_to > now):
                current_depot = history.depot
                break
        
        # Najdi aktuálního dopravce
        current_carrier = None
        for history in route.carrier_history:
            if history.valid_from <= now and (history.valid_to is None or history.valid_to > now):
                current_carrier = history.carrier
                break
        
        # Filtruj podle depot_id a carrier_id
        if depot_id and (current_depot is None or current_depot.id != depot_id):
            continue
        if carrier_id and (current_carrier is None or current_carrier.id != carrier_id):
            continue
        
        response.append({
            "id": route.id,
            "route_name": route.route_name,
            "region": route.region,
            "description": route.description,
            "is_active": route.is_active,
            "created_at": route.created_at,
            "current_depot": {
                "id": current_depot.id,
                "name": current_depot.name,
                "code": current_depot.code
            } if current_depot else None,
            "current_carrier_id": current_carrier.id if current_carrier else None,
            "current_carrier_name": current_carrier.name if current_carrier else None
        })
    
    return response


@router.get("/routes/{route_id}", response_model=RouteResponse)
async def get_route(route_id: int, db: AsyncSession = Depends(get_db)):
    """Získá detail trasy."""
    query = select(Route).options(
        selectinload(Route.depot_history).selectinload(RouteDepotHistory.depot),
        selectinload(Route.carrier_history).selectinload(RouteCarrierHistory.carrier)
    ).where(Route.id == route_id)
    
    result = await db.execute(query)
    route = result.scalar_one_or_none()
    
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    now = datetime.utcnow()
    current_depot = route.get_current_depot(now)
    current_carrier = route.get_current_carrier(now)
    
    return {
        "id": route.id,
        "route_name": route.route_name,
        "region": route.region,
        "description": route.description,
        "is_active": route.is_active,
        "created_at": route.created_at,
        "current_depot": current_depot,
        "current_carrier_id": current_carrier.id if current_carrier else None,
        "current_carrier_name": current_carrier.name if current_carrier else None
    }


@router.post("/routes", response_model=RouteResponse)
async def create_route(route_data: RouteCreate, db: AsyncSession = Depends(get_db)):
    """Vytvoří novou trasu s volitelným přiřazením depa a dopravce."""
    # Vytvoř trasu
    route = Route(
        route_name=route_data.route_name,
        region=route_data.region,
        description=route_data.description,
        is_active=route_data.is_active
    )
    db.add(route)
    await db.flush()
    
    # Přiřaď depo pokud je zadáno
    if route_data.depot_id:
        depot_history = RouteDepotHistory(
            route_id=route.id,
            depot_id=route_data.depot_id,
            valid_from=datetime.utcnow()
        )
        db.add(depot_history)
    
    # Přiřaď dopravce pokud je zadán
    if route_data.carrier_id:
        carrier_history = RouteCarrierHistory(
            route_id=route.id,
            carrier_id=route_data.carrier_id,
            valid_from=datetime.utcnow()
        )
        db.add(carrier_history)
    
    await db.commit()
    await db.refresh(route)
    
    return route


@router.get("/routes/{route_id}/depot-history", response_model=List[RouteDepotHistoryResponse])
async def get_route_depot_history(route_id: int, db: AsyncSession = Depends(get_db)):
    """Získá historii přiřazení trasy k depům."""
    query = select(RouteDepotHistory).options(
        selectinload(RouteDepotHistory.depot)
    ).where(
        RouteDepotHistory.route_id == route_id
    ).order_by(RouteDepotHistory.valid_from.desc())
    
    result = await db.execute(query)
    history = result.scalars().all()
    
    return [
        {
            "id": h.id,
            "route_id": h.route_id,
            "depot_id": h.depot_id,
            "depot_name": h.depot.name,
            "valid_from": h.valid_from,
            "valid_to": h.valid_to
        }
        for h in history
    ]


@router.get("/routes/{route_id}/carrier-history", response_model=List[RouteCarrierHistoryResponse])
async def get_route_carrier_history(route_id: int, db: AsyncSession = Depends(get_db)):
    """Získá historii přiřazení trasy k dopravcům."""
    query = select(RouteCarrierHistory).options(
        selectinload(RouteCarrierHistory.carrier)
    ).where(
        RouteCarrierHistory.route_id == route_id
    ).order_by(RouteCarrierHistory.valid_from.desc())
    
    result = await db.execute(query)
    history = result.scalars().all()
    
    return [
        {
            "id": h.id,
            "route_id": h.route_id,
            "carrier_id": h.carrier_id,
            "carrier_name": h.carrier.name,
            "valid_from": h.valid_from,
            "valid_to": h.valid_to
        }
        for h in history
    ]


@router.post("/routes/{route_id}/assign-depot")
async def assign_route_to_depot(
    route_id: int,
    depot_id: int,
    valid_from: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Přiřadí trasu k novému depu.
    Ukončí předchozí přiřazení a vytvoří nové.
    """
    if valid_from is None:
        valid_from = datetime.utcnow()
    
    # Ověř že trasa existuje
    route = await db.get(Route, route_id)
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    # Ověř že depo existuje
    depot = await db.get(Depot, depot_id)
    if not depot:
        raise HTTPException(status_code=404, detail="Depot not found")
    
    # Ukončí aktuální přiřazení
    query = select(RouteDepotHistory).where(
        and_(
            RouteDepotHistory.route_id == route_id,
            RouteDepotHistory.valid_to.is_(None)
        )
    )
    result = await db.execute(query)
    current = result.scalar_one_or_none()
    
    if current:
        current.valid_to = valid_from
    
    # Vytvoř nové přiřazení
    new_history = RouteDepotHistory(
        route_id=route_id,
        depot_id=depot_id,
        valid_from=valid_from
    )
    db.add(new_history)
    
    await db.commit()
    
    return {
        "message": f"Route '{route.route_name}' assigned to depot '{depot.name}'",
        "valid_from": valid_from
    }


@router.post("/routes/{route_id}/assign-carrier")
async def assign_route_to_carrier(
    route_id: int,
    carrier_id: int,
    valid_from: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Přiřadí trasu k novému dopravci.
    Ukončí předchozí přiřazení a vytvoří nové.
    """
    if valid_from is None:
        valid_from = datetime.utcnow()
    
    # Ověř že trasa existuje
    route = await db.get(Route, route_id)
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    # Ověř že dopravce existuje
    carrier = await db.get(Carrier, carrier_id)
    if not carrier:
        raise HTTPException(status_code=404, detail="Carrier not found")
    
    # Ukončí aktuální přiřazení
    query = select(RouteCarrierHistory).where(
        and_(
            RouteCarrierHistory.route_id == route_id,
            RouteCarrierHistory.valid_to.is_(None)
        )
    )
    result = await db.execute(query)
    current = result.scalar_one_or_none()
    
    if current:
        current.valid_to = valid_from
    
    # Vytvoř nové přiřazení
    new_history = RouteCarrierHistory(
        route_id=route_id,
        carrier_id=carrier_id,
        valid_from=valid_from
    )
    db.add(new_history)
    
    await db.commit()
    
    return {
        "message": f"Route '{route.route_name}' assigned to carrier '{carrier.name}'",
        "valid_from": valid_from
    }


# =============================================================================
# STATISTICS ENDPOINTS
# =============================================================================

@router.get("/depots/stats")
async def get_depot_stats(db: AsyncSession = Depends(get_db)):
    """Statistiky dep - počet tras, počet dopravců."""
    query = select(Depot).options(
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
            "depot_id": depot.id,
            "depot_name": depot.name,
            "depot_code": depot.code,
            "operator_type": depot.operator_type,
            "region": depot.region,
            "active_routes_count": active_routes
        })
    
    return stats


@router.get("/routes/by-region")
async def get_routes_by_region(db: AsyncSession = Depends(get_db)):
    """Seskupení tras podle regionu."""
    query = select(Route).where(Route.is_active == True).order_by(Route.region, Route.route_name)
    
    result = await db.execute(query)
    routes = result.scalars().all()
    
    by_region = {}
    for route in routes:
        region = route.region or "Ostatní"
        if region not in by_region:
            by_region[region] = []
        by_region[region].append({
            "id": route.id,
            "route_name": route.route_name
        })
    
    return by_region
