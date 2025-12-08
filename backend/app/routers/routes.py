"""
Routes API Router - Master data tras a jejich historie
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
from app.models import Route, RouteDepotHistory, RouteCarrierHistory, Depot, Carrier

router = APIRouter()


# =============================================================================
# PYDANTIC SCHEMAS
# =============================================================================

class RouteBase(BaseModel):
    route_name: str
    region: Optional[str] = None
    description: Optional[str] = None
    is_active: bool = True

class RouteCreate(RouteBase):
    depot_id: Optional[int] = None
    carrier_id: Optional[int] = None

class RouteUpdate(BaseModel):
    route_name: Optional[str] = None
    region: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class RouteResponse(BaseModel):
    id: int
    routeName: str
    region: Optional[str] = None
    description: Optional[str] = None
    isActive: bool
    createdAt: datetime
    currentDepot: Optional[dict] = None
    currentCarrierId: Optional[int] = None
    currentCarrierName: Optional[str] = None
    
    class Config:
        from_attributes = True

class RouteDepotHistoryResponse(BaseModel):
    id: int
    routeId: int
    depotId: int
    depotName: str
    depotCode: Optional[str] = None
    validFrom: datetime
    validTo: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class RouteCarrierHistoryResponse(BaseModel):
    id: int
    routeId: int
    carrierId: int
    carrierName: str
    validFrom: datetime
    validTo: Optional[datetime] = None
    
    class Config:
        from_attributes = True


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def get_current_depot_for_route(route: Route, as_of: datetime = None) -> Optional[Depot]:
    """Vrátí aktuální depo pro trasu."""
    if as_of is None:
        as_of = datetime.utcnow()
    for history in route.depot_history:
        if history.valid_from <= as_of and (history.valid_to is None or history.valid_to > as_of):
            return history.depot
    return None

def get_current_carrier_for_route(route: Route, as_of: datetime = None) -> Optional[Carrier]:
    """Vrátí aktuálního dopravce pro trasu."""
    if as_of is None:
        as_of = datetime.utcnow()
    for history in route.carrier_history:
        if history.valid_from <= as_of and (history.valid_to is None or history.valid_to > as_of):
            return history.carrier
    return None

def route_to_response(route: Route) -> dict:
    """Konvertuje Route na response dict."""
    now = datetime.utcnow()
    current_depot = get_current_depot_for_route(route, now)
    current_carrier = get_current_carrier_for_route(route, now)
    
    return {
        "id": route.id,
        "routeName": route.route_name,
        "region": route.region,
        "description": route.description,
        "isActive": route.is_active,
        "createdAt": route.created_at,
        "currentDepot": {
            "id": current_depot.id,
            "name": current_depot.name,
            "code": current_depot.code
        } if current_depot else None,
        "currentCarrierId": current_carrier.id if current_carrier else None,
        "currentCarrierName": current_carrier.name if current_carrier else None
    }


# =============================================================================
# ROUTE ENDPOINTS
# =============================================================================

@router.get("")
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
        current_depot = get_current_depot_for_route(route, now)
        current_carrier = get_current_carrier_for_route(route, now)
        
        # Filtruj podle depot_id a carrier_id
        if depot_id and (current_depot is None or current_depot.id != depot_id):
            continue
        if carrier_id and (current_carrier is None or current_carrier.id != carrier_id):
            continue
        
        response.append(route_to_response(route))
    
    return response


@router.get("/by-region")
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
            "routeName": route.route_name
        })
    
    return by_region


@router.get("/{route_id}")
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
    
    return route_to_response(route)


@router.post("", status_code=201)
async def create_route(route_data: RouteCreate, db: AsyncSession = Depends(get_db)):
    """Vytvoří novou trasu s volitelným přiřazením depa a dopravce."""
    # Check if route with this name already exists
    existing = await db.execute(
        select(Route).where(Route.route_name == route_data.route_name)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"Route '{route_data.route_name}' already exists")
    
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
        depot = await db.get(Depot, route_data.depot_id)
        if not depot:
            raise HTTPException(status_code=400, detail="Depot not found")
        
        depot_history = RouteDepotHistory(
            route_id=route.id,
            depot_id=route_data.depot_id,
            valid_from=datetime.utcnow()
        )
        db.add(depot_history)
    
    # Přiřaď dopravce pokud je zadán
    if route_data.carrier_id:
        carrier = await db.get(Carrier, route_data.carrier_id)
        if not carrier:
            raise HTTPException(status_code=400, detail="Carrier not found")
        
        carrier_history = RouteCarrierHistory(
            route_id=route.id,
            carrier_id=route_data.carrier_id,
            valid_from=datetime.utcnow()
        )
        db.add(carrier_history)
    
    await db.commit()
    await db.refresh(route)
    
    return {"id": route.id, "routeName": route.route_name, "message": "Route created"}


@router.put("/{route_id}")
async def update_route(
    route_id: int,
    route_data: RouteUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Aktualizuje trasu."""
    route = await db.get(Route, route_id)
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    update_data = route_data.model_dump(exclude_unset=True)
    
    # Map snake_case to actual column names
    field_mapping = {
        'route_name': 'route_name',
        'is_active': 'is_active'
    }
    
    for field, value in update_data.items():
        setattr(route, field_mapping.get(field, field), value)
    
    route.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(route)
    
    return {"id": route.id, "message": "Route updated"}


@router.delete("/{route_id}", status_code=204)
async def delete_route(route_id: int, db: AsyncSession = Depends(get_db)):
    """Smaže trasu (a její historii díky CASCADE)."""
    route = await db.get(Route, route_id)
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    await db.delete(route)
    await db.commit()


# =============================================================================
# ROUTE HISTORY ENDPOINTS
# =============================================================================

@router.get("/{route_id}/depot-history")
async def get_route_depot_history(route_id: int, db: AsyncSession = Depends(get_db)):
    """Získá historii přiřazení trasy k depům."""
    # Verify route exists
    route = await db.get(Route, route_id)
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
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
            "routeId": h.route_id,
            "depotId": h.depot_id,
            "depotName": h.depot.name,
            "depotCode": h.depot.code,
            "validFrom": h.valid_from,
            "validTo": h.valid_to
        }
        for h in history
    ]


@router.get("/{route_id}/carrier-history")
async def get_route_carrier_history(route_id: int, db: AsyncSession = Depends(get_db)):
    """Získá historii přiřazení trasy k dopravcům."""
    # Verify route exists
    route = await db.get(Route, route_id)
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
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
            "routeId": h.route_id,
            "carrierId": h.carrier_id,
            "carrierName": h.carrier.name,
            "validFrom": h.valid_from,
            "validTo": h.valid_to
        }
        for h in history
    ]


# =============================================================================
# ROUTE ASSIGNMENT ENDPOINTS
# =============================================================================

@router.post("/{route_id}/assign-depot")
async def assign_route_to_depot(
    route_id: int,
    depot_id: int = Query(..., description="ID depa"),
    valid_from: Optional[datetime] = Query(None, description="Datum od (default: nyní)"),
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
        "validFrom": valid_from
    }


@router.post("/{route_id}/assign-carrier")
async def assign_route_to_carrier(
    route_id: int,
    carrier_id: int = Query(..., description="ID dopravce"),
    valid_from: Optional[datetime] = Query(None, description="Datum od (default: nyní)"),
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
        "validFrom": valid_from
    }
