"""
Route Resolver - Automatické vytváření Route a RouteDepotHistory z plánovacích souborů

Při uploadu plánovacího souboru:
1. Pro každý unikátní route_name zkontroluje, zda existuje Route záznam
2. Pokud ne, vytvoří nový Route s regionem extrahovaným z názvu
3. Zkontroluje RouteDepotHistory - pokud trasa není přiřazena k depu, vytvoří přiřazení
4. Zkontroluje RouteCarrierHistory - pokud trasa není přiřazena k dopravci, vytvoří přiřazení

Created: 2025-12-09
Updated: 2025-12-09 - Fixed MultipleResultsFound error by handling duplicate active assignments
"""
from datetime import datetime
from typing import Dict, List, Optional, Any
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Route, RouteDepotHistory, RouteCarrierHistory


def extract_region_from_route_name(route_name: str) -> Optional[str]:
    """
    Extrahuje region z názvu trasy.
    
    Příklady:
    - "Moravskoslezsko A" → "Moravskoslezsko"
    - "Praha C" → "Praha"
    - "Hradecko B" → "Hradecko"
    - "Jižní Čechy A" → "Jižní Čechy"
    - "Západní Čechy B" → "Západní Čechy"
    """
    if not route_name:
        return None
    
    # Odstraň písmeno na konci (typicky poslední slovo je jedno písmeno)
    parts = route_name.strip().rsplit(' ', 1)
    
    if len(parts) == 2:
        region, letter = parts
        # Pokud je poslední část jedno písmeno (A-Z), region je zbytek
        if len(letter) == 1 and letter.isalpha():
            return region.strip()
    
    # Fallback - vrať celý název
    return route_name.strip()


async def get_or_create_route(
    route_name: str,
    db: AsyncSession
) -> int:
    """
    Najde nebo vytvoří Route záznam.
    
    Returns:
        route_id: ID existující nebo nově vytvořené trasy
    """
    # Hledej existující Route
    result = await db.execute(
        select(Route).where(Route.route_name == route_name)
    )
    existing_route = result.scalar_one_or_none()
    
    if existing_route:
        return existing_route.id
    
    # Vytvoř novou Route
    region = extract_region_from_route_name(route_name)
    
    new_route = Route(
        route_name=route_name,
        region=region,
        is_active=True,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(new_route)
    await db.flush()
    
    return new_route.id


async def ensure_route_depot_assignment(
    route_id: int,
    depot_id: int,
    valid_from: datetime,
    db: AsyncSession
) -> bool:
    """
    Zajistí, že trasa má aktivní přiřazení k depu.
    
    Pokud trasa již má aktivní přiřazení ke STEJNÉMU depu, nic nedělá.
    Pokud má přiřazení k JINÉMU depu, ukončí ho a vytvoří nové.
    Pokud nemá žádné přiřazení, vytvoří nové.
    
    Returns:
        True pokud bylo vytvořeno nové přiřazení, False pokud již existovalo
    """
    # Najdi aktuální aktivní přiřazení (může být více - vezmeme první)
    result = await db.execute(
        select(RouteDepotHistory).where(
            and_(
                RouteDepotHistory.route_id == route_id,
                RouteDepotHistory.valid_to.is_(None)
            )
        ).order_by(RouteDepotHistory.id.desc())
    )
    current_assignments = result.scalars().all()
    
    # Pokud jsou duplicity, ukončíme všechny kromě poslední
    if len(current_assignments) > 1:
        for old_assignment in current_assignments[1:]:
            old_assignment.valid_to = valid_from
    
    current_assignment = current_assignments[0] if current_assignments else None
    
    if current_assignment:
        if current_assignment.depot_id == depot_id:
            # Již přiřazeno ke stejnému depu - nic nedělej
            return False
        else:
            # Přiřazeno k jinému depu - ukončí a vytvoř nové
            current_assignment.valid_to = valid_from
    
    # Vytvoř nové přiřazení
    new_assignment = RouteDepotHistory(
        route_id=route_id,
        depot_id=depot_id,
        valid_from=valid_from
    )
    db.add(new_assignment)
    await db.flush()
    
    return True


async def ensure_route_carrier_assignment(
    route_id: int,
    carrier_id: int,
    valid_from: datetime,
    db: AsyncSession
) -> bool:
    """
    Zajistí, že trasa má aktivní přiřazení k dopravci.
    
    Returns:
        True pokud bylo vytvořeno nové přiřazení, False pokud již existovalo
    """
    # Najdi aktuální aktivní přiřazení (může být více - vezmeme první)
    result = await db.execute(
        select(RouteCarrierHistory).where(
            and_(
                RouteCarrierHistory.route_id == route_id,
                RouteCarrierHistory.valid_to.is_(None)
            )
        ).order_by(RouteCarrierHistory.id.desc())
    )
    current_assignments = result.scalars().all()
    
    # Pokud jsou duplicity, ukončíme všechny kromě poslední
    if len(current_assignments) > 1:
        for old_assignment in current_assignments[1:]:
            old_assignment.valid_to = valid_from
    
    current_assignment = current_assignments[0] if current_assignments else None
    
    if current_assignment:
        if current_assignment.carrier_id == carrier_id:
            # Již přiřazeno ke stejnému dopravci
            return False
        else:
            # Přiřazeno k jinému dopravci - ukončí a vytvoř nové
            current_assignment.valid_to = valid_from
    
    # Vytvoř nové přiřazení
    new_assignment = RouteCarrierHistory(
        route_id=route_id,
        carrier_id=carrier_id,
        valid_from=valid_from
    )
    db.add(new_assignment)
    await db.flush()
    
    return True


async def resolve_all_routes_for_plan(
    routes_data: List[Dict[str, Any]],
    depot_lookup: Dict[str, int],
    carrier_id: int,
    valid_from: datetime,
    db: AsyncSession
) -> Dict[str, int]:
    """
    Pro všechny trasy v plánu zajistí existenci Route záznamů a přiřazení.
    
    Args:
        routes_data: Seznam tras z parsovaného XLSX
        depot_lookup: Mapování start_location → depot_id (z depot_resolver)
        carrier_id: ID dopravce z plánu
        valid_from: Datum platnosti plánu
        db: Database session
    
    Returns:
        Dict mapující route_name → route_id
    """
    route_lookup: Dict[str, int] = {}
    
    # Získej unikátní kombinace route_name + start_location
    unique_routes: Dict[str, str] = {}  # route_name → start_location
    
    for route_data in routes_data:
        route_name = route_data.get('route_name', '').strip()
        start_location = route_data.get('start_location', '').strip()
        
        if route_name and route_name not in unique_routes:
            unique_routes[route_name] = start_location
    
    # Pro každou unikátní trasu
    for route_name, start_location in unique_routes.items():
        # 1. Získej nebo vytvoř Route
        route_id = await get_or_create_route(route_name, db)
        route_lookup[route_name] = route_id
        
        # 2. Zajisti přiřazení k depu (pokud známe depot_id)
        depot_id = depot_lookup.get(start_location)
        if depot_id:
            await ensure_route_depot_assignment(
                route_id=route_id,
                depot_id=depot_id,
                valid_from=valid_from,
                db=db
            )
        
        # 3. Zajisti přiřazení k dopravci
        await ensure_route_carrier_assignment(
            route_id=route_id,
            carrier_id=carrier_id,
            valid_from=valid_from,
            db=db
        )
    
    return route_lookup
