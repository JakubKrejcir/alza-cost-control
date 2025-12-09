"""
Depot Resolver - najde nebo vytvoří depo podle start_location z plánovacího souboru.

Použití v route_plans.py:
    from app.depot_resolver import resolve_depot_for_route

    depot_id = await resolve_depot_for_route(
        start_location="Depo Drivecool",
        route_name="Moravskoslezsko A", 
        carrier_id=3,
        valid_from=datetime(2025, 8, 22),
        db=db
    )
"""
from datetime import datetime
from typing import Optional, Tuple
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Depot, DepotNameMapping


async def resolve_depot_for_route(
    start_location: Optional[str],
    route_name: str,
    carrier_id: int,
    valid_from: datetime,
    db: AsyncSession
) -> Optional[int]:
    """
    Najde depot_id pro trasu na základě start_location.
    
    Logika:
    1. Pokud start_location existuje v DepotNameMapping → vrať depot_id
    2. Pokud ne, vytvoř nové Depot a DepotNameMapping
    3. Vrať depot_id
    
    Args:
        start_location: Hodnota ze sloupce "Startovní místo" (např. "Depo Drivecool")
        route_name: Název trasy (např. "Moravskoslezsko A") - pro fallback detekci
        carrier_id: ID dopravce
        valid_from: Datum platnosti plánu
        db: Database session
        
    Returns:
        depot_id nebo None
    """
    if not start_location:
        return None
    
    start_location = start_location.strip()
    
    # 1. Zkus najít v DepotNameMapping
    result = await db.execute(
        select(DepotNameMapping).where(DepotNameMapping.plan_name == start_location)
    )
    mapping = result.scalar_one_or_none()
    
    if mapping:
        # Aktualizuj valid_from depa pokud je starší
        depot = await db.get(Depot, mapping.depot_id)
        if depot and (depot.valid_from is None or valid_from < depot.valid_from):
            depot.valid_from = valid_from
        return mapping.depot_id
    
    # 2. Neexistuje - vytvoř nové Depot a mapping
    depot_info = detect_depot_info(start_location, route_name)
    
    new_depot = Depot(
        name=depot_info['name'],
        code=depot_info['code'],
        depot_type=depot_info['depot_type'],
        operator_type=depot_info['operator_type'],
        operator_carrier_id=carrier_id if depot_info['operator_type'] == 'CARRIER' else None,
        valid_from=valid_from,
        location_code=depot_info.get('location_code'),
    )
    db.add(new_depot)
    await db.flush()  # Získej ID
    
    # Vytvoř mapping
    new_mapping = DepotNameMapping(
        plan_name=start_location,
        depot_id=new_depot.id
    )
    db.add(new_mapping)
    
    return new_depot.id


def detect_depot_info(start_location: str, route_name: str) -> dict:
    """
    Detekuje informace o depu z názvu startovního místa.
    
    Známé vzory:
    - "Depo Drivecool" → rozvozové depo dopravce (Vratimov)
    - "Depo Chrášťany" → expediční sklad Alzy (CZLC4)
    - "Depo GEM" → rozvozové depo dopravce
    - "CZTC1" → třídírna Alzy (Úžice)
    
    Returns:
        dict s klíči: name, code, depot_type, operator_type, location_code
    """
    loc_upper = start_location.upper()
    
    # Expediční sklady Alzy
    if 'CHRÁŠŤAN' in loc_upper or 'CHRASTANY' in loc_upper or 'CZLC4' in loc_upper:
        return {
            'name': 'Expedice Chrášťany',
            'code': 'CZLC4',
            'depot_type': 'WAREHOUSE',
            'operator_type': 'ALZA',
            'location_code': 'CZLC4'
        }
    
    if 'CZTC1' in loc_upper or 'ÚŽICE' in loc_upper or 'UZICE' in loc_upper or 'TŘÍDÍRNA' in loc_upper:
        return {
            'name': 'Třídírna Úžice',
            'code': 'CZTC1',
            'depot_type': 'WAREHOUSE',
            'operator_type': 'ALZA',
            'location_code': 'CZTC1'
        }
    
    # Rozvozová depa dopravců - detekce podle názvu
    if 'DRIVECOOL' in loc_upper:
        # Drivecool má depo ve Vratimově
        return {
            'name': 'Depo Vratimov',
            'code': 'VRATIMOV',
            'depot_type': 'DISTRIBUTION',
            'operator_type': 'CARRIER',
            'location_code': None
        }
    
    if 'GEM' in loc_upper:
        return {
            'name': 'Depo GEM',
            'code': 'GEM',
            'depot_type': 'DISTRIBUTION',
            'operator_type': 'CARRIER',
            'location_code': None
        }
    
    if 'NOVÝ BYDŽOV' in loc_upper or 'BYDZOV' in loc_upper or 'BYDŽOV' in loc_upper:
        return {
            'name': 'Depo Nový Bydžov',
            'code': 'BYDZOV',
            'depot_type': 'DISTRIBUTION',
            'operator_type': 'CARRIER',
            'location_code': None
        }
    
    if 'HOSÍN' in loc_upper or 'HOSIN' in loc_upper:
        return {
            'name': 'Depo Hosín',
            'code': 'HOSIN',
            'depot_type': 'DISTRIBUTION',
            'operator_type': 'CARRIER',
            'location_code': None
        }
    
    # Fallback - použij název přímo
    # Odstraň "Depo " prefix pokud existuje
    name = start_location
    if name.lower().startswith('depo '):
        name = name[5:].strip()
    
    # Generuj kód z názvu (první slovo, uppercase, bez diakritiky)
    code = name.split()[0].upper() if name else 'UNKNOWN'
    # Jednoduchá náhrada diakritiky
    code = code.replace('Á', 'A').replace('É', 'E').replace('Í', 'I').replace('Ó', 'O').replace('Ú', 'U')
    code = code.replace('Ý', 'Y').replace('Č', 'C').replace('Ř', 'R').replace('Š', 'S').replace('Ž', 'Z')
    code = code.replace('Ď', 'D').replace('Ť', 'T').replace('Ň', 'N').replace('Ě', 'E').replace('Ů', 'U')
    
    return {
        'name': f'Depo {name}',
        'code': code[:20],  # Max 20 znaků
        'depot_type': 'DISTRIBUTION',
        'operator_type': 'CARRIER',
        'location_code': None
    }


async def get_unique_start_locations(routes_data: list) -> set:
    """
    Vrátí množinu unikátních start_location hodnot z parsovaných dat tras.
    """
    return {
        route.get('start_location', '').strip()
        for route in routes_data
        if route.get('start_location')
    }


async def resolve_all_depots_for_plan(
    routes_data: list,
    carrier_id: int,
    valid_from: datetime,
    db: AsyncSession
) -> dict:
    """
    Vyřeší depot_id pro všechny unikátní start_location v plánu.
    
    Returns:
        dict: {start_location: depot_id}
    """
    start_locations = await get_unique_start_locations(routes_data)
    
    result = {}
    for start_loc in start_locations:
        if start_loc:
            depot_id = await resolve_depot_for_route(
                start_location=start_loc,
                route_name='',  # Není potřeba pro lookup
                carrier_id=carrier_id,
                valid_from=valid_from,
                db=db
            )
            result[start_loc] = depot_id
    
    return result
