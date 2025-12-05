"""
Price Matching - Helper funkce pro párování plánů s ceníky
"""
import re
from decimal import Decimal
from typing import Dict, List, Optional, Any
from dataclasses import dataclass


# =============================================================================
# KONFIGURACE - MAPOVÁNÍ
# =============================================================================

START_LOCATION_CONFIG = {
    # Expediční sklady (DIRECT_SKLAD)
    'Depo Chrášťany': {
        'type': 'WAREHOUSE',
        'code': 'CZLC4',
        'route_category': 'DIRECT_SKLAD',
        'fix_rate_key': 'DIRECT_Praha',
    },
    'Třídírna': {
        'type': 'WAREHOUSE',
        'code': 'CZTC1',
        'route_category': 'DIRECT_SKLAD',
        'fix_rate_key': 'DIRECT_Praha',
    },
    
    # Rozvozová depa (DIRECT_DEPO)
    'Depo Drivecool': {
        'type': 'DEPOT',
        'code': 'VRATIMOV',
        'route_category': 'DIRECT_DEPO',
        'fix_rate_key': 'DIRECT_Vratimov',
    },
    'Depo Nový Bydžov': {
        'type': 'DEPOT',
        'code': 'NOVY_BYDZOV',
        'route_category': 'DIRECT_DEPO',
        'fix_rate_key': 'DIRECT_NovyBydzov',
    },
    'Depo GEM': {
        'type': 'DEPOT',
        'code': 'BRNO',
        'route_category': 'DIRECT_DEPO',
        'fix_rate_key': 'DIRECT_Brno',
    },
    'Depo Hosín': {
        'type': 'DEPOT',
        'code': 'CESKE_BUDEJOVICE',
        'route_category': 'DIRECT_DEPO',
        'fix_rate_key': 'DIRECT_CeskeBudejovice',
    },
    'Depo_Západ': {
        'type': 'DEPOT',
        'code': 'RAKOVNIK',
        'route_category': 'DIRECT_DEPO',
        'fix_rate_key': 'DIRECT_Rakovnik',
    },
}

ROUTE_PREFIX_TO_DEPOT = {
    'Moravskoslezsko': 'VRATIMOV',
    'Hradecko': 'NOVY_BYDZOV',
    'Liberecko': 'NOVY_BYDZOV',
    'Pardubicko': 'NOVY_BYDZOV',
    'Ústecko': 'NOVY_BYDZOV',
    'Ustecko': 'NOVY_BYDZOV',
    'Morava': 'BRNO',
    'Jižní Čechy': 'CESKE_BUDEJOVICE',
    'Jizni Cechy': 'CESKE_BUDEJOVICE',
    'Západní Čechy': 'RAKOVNIK',
    'Zapadni Cechy': 'RAKOVNIK',
    'Praha': 'DIRECT',
    'Střední Čechy': 'DIRECT',
    'Stredni Cechy': 'DIRECT',
    'Praha_STČ': 'DIRECT',
}

DR_LH_TRIP_COUNT = {
    'DR': 1,
    'DR-DR': 2,
    'DR-DR-DR': 3,
    'LH-': 1,
    '-LH': 1,
    'LH-LH': 2,
}


# =============================================================================
# DATOVÉ TŘÍDY
# =============================================================================

@dataclass
class RouteInfo:
    """Informace o trase z plánovacího souboru."""
    route_name: str
    carrier_name: str
    start_location: str
    dr_lh: str
    total_distance_km: Decimal
    stops_count: int
    start_time: str
    end_time: str
    work_time: str


@dataclass
class CostBreakdown:
    """Rozpad nákladů za trasu."""
    fix_cost: Decimal
    km_cost: Decimal
    linehaul_cost: Decimal
    total_cost: Decimal
    trips_count: int
    route_category: str
    depot_code: Optional[str]
    warnings: List[str]
    missing_rates: List[str]


# =============================================================================
# HLAVNÍ FUNKCE
# =============================================================================

def get_route_category(start_location: str) -> str:
    """
    Určuje kategorii trasy podle startovního místa.
    
    Returns:
        'DIRECT_SKLAD' - trasa přímo z expedičního skladu
        'DIRECT_DEPO' - trasa z rozvozového depa (po linehaulu)
        'UNKNOWN' - neznámé startovní místo
    """
    config = START_LOCATION_CONFIG.get(start_location)
    if config:
        return config['route_category']
    return 'UNKNOWN'


def get_location_code(start_location: str) -> Optional[str]:
    """Vrací kód lokace (skladu nebo depa) podle startovního místa."""
    config = START_LOCATION_CONFIG.get(start_location)
    if config:
        return config['code']
    return None


def get_fix_rate_key(start_location: str) -> Optional[str]:
    """Vrací klíč pro vyhledání FIX sazby podle startovního místa."""
    config = START_LOCATION_CONFIG.get(start_location)
    if config:
        return config['fix_rate_key']
    return None


def detect_depot_from_route_name(route_name: str) -> Optional[str]:
    """
    Detekuje depo z názvu trasy.
    
    Např. "Moravskoslezsko A" -> "VRATIMOV"
         "Liberecko F + Ústecko L" -> "NOVY_BYDZOV"
    """
    route_upper = route_name.upper()
    
    for prefix, depot_code in ROUTE_PREFIX_TO_DEPOT.items():
        if prefix.upper() in route_upper:
            return depot_code
    
    return None


def count_trips(dr_lh: str) -> int:
    """
    Spočítá počet jízd podle sloupce DR/LH.
    
    DR-DR-DR = 3 jízdy
    LH-LH = 2 jízdy
    LH- = 1 jízda
    """
    if not dr_lh:
        return 1
    
    dr_lh_clean = dr_lh.strip().upper()
    
    # Přímé mapování
    if dr_lh_clean in DR_LH_TRIP_COUNT:
        return DR_LH_TRIP_COUNT[dr_lh_clean]
    
    # Počítáme DR a LH
    dr_count = len(re.findall(r'DR', dr_lh_clean))
    lh_count = len(re.findall(r'LH', dr_lh_clean))
    
    return max(dr_count, lh_count, 1)


def has_linehaul(dr_lh: str) -> bool:
    """Zjistí, zda trasa zahrnuje linehaul."""
    if not dr_lh:
        return False
    return 'LH' in dr_lh.upper()


def count_linehauls(dr_lh: str) -> int:
    """Spočítá počet linehaulů."""
    if not dr_lh:
        return 0
    return len(re.findall(r'LH', dr_lh.upper()))


# =============================================================================
# VÝPOČET NÁKLADŮ
# =============================================================================

def calculate_route_cost(
    route: RouteInfo,
    fix_rates: List[Dict],
    km_rates: List[Dict],
    linehaul_rates: List[Dict],
) -> CostBreakdown:
    """
    Vypočítá plánované náklady pro trasu.
    """
    warnings = []
    missing_rates = []
    
    # 1. Určit kategorii trasy
    route_category = get_route_category(route.start_location)
    depot_code = detect_depot_from_route_name(route.route_name)
    
    if route_category == 'UNKNOWN':
        warnings.append(f"Neznámé startovní místo: {route.start_location}")
        route_category = 'DIRECT_DEPO'
    
    # 2. Počet jízd
    trips = count_trips(route.dr_lh)
    
    # 3. FIX sazba
    fix_rate_key = get_fix_rate_key(route.start_location)
    fix_rate = find_fix_rate(fix_rates, fix_rate_key, depot_code)
    
    if fix_rate is None:
        missing_rates.append(f"FIX sazba pro {fix_rate_key or route.start_location}")
        fix_rate = Decimal('0')
    
    fix_cost = fix_rate * trips
    
    # 4. KM sazba
    km_rate = find_km_rate(km_rates, depot_code)
    
    if km_rate is None:
        missing_rates.append(f"KM sazba pro {depot_code or 'default'}")
        km_rate = Decimal('0')
    
    km_cost = km_rate * route.total_distance_km * trips
    
    # 5. Linehaul
    linehaul_cost = Decimal('0')
    
    if route_category == 'DIRECT_DEPO' and has_linehaul(route.dr_lh):
        linehaul_count = count_linehauls(route.dr_lh)
        lh_rate = find_linehaul_rate(linehaul_rates, depot_code)
        
        if lh_rate is None:
            missing_rates.append(f"Linehaul sazba pro {depot_code}")
        else:
            linehaul_cost = lh_rate * linehaul_count
    
    total_cost = fix_cost + km_cost + linehaul_cost
    
    return CostBreakdown(
        fix_cost=fix_cost,
        km_cost=km_cost,
        linehaul_cost=linehaul_cost,
        total_cost=total_cost,
        trips_count=trips,
        route_category=route_category,
        depot_code=depot_code,
        warnings=warnings,
        missing_rates=missing_rates,
    )


def find_fix_rate(
    fix_rates: List[Dict],
    route_type: Optional[str],
    depot_code: Optional[str]
) -> Optional[Decimal]:
    """Najde odpovídající FIX sazbu."""
    if not fix_rates:
        return None
    
    # Priorita 1: Přesná shoda route_type
    if route_type:
        for rate in fix_rates:
            rt = rate.get('route_type') or rate.get('routeType')
            if rt == route_type:
                return Decimal(str(rate['rate']))
    
    # Priorita 2: Podle depot_code
    if depot_code:
        for rate in fix_rates:
            dc = rate.get('depot_code') or rate.get('depotCode')
            if dc == depot_code:
                return Decimal(str(rate['rate']))
    
    # Priorita 3: DIRECT jako default
    for rate in fix_rates:
        rt = rate.get('route_type') or rate.get('routeType') or ''
        if 'DIRECT' in rt:
            return Decimal(str(rate['rate']))
    
    return None


def find_km_rate(
    km_rates: List[Dict],
    depot_code: Optional[str]
) -> Optional[Decimal]:
    """Najde odpovídající KM sazbu."""
    if not km_rates:
        return None
    
    # Priorita 1: Podle depot_code
    if depot_code:
        for rate in km_rates:
            dc = rate.get('depot_code') or rate.get('depotCode')
            if dc == depot_code:
                return Decimal(str(rate['rate']))
    
    # Priorita 2: První dostupná
    if km_rates:
        return Decimal(str(km_rates[0]['rate']))
    
    return None


def find_linehaul_rate(
    linehaul_rates: List[Dict],
    to_depot_code: Optional[str],
    vehicle_type: str = 'KAMION'
) -> Optional[Decimal]:
    """Najde odpovídající linehaul sazbu."""
    if not linehaul_rates:
        return None
    
    # Priorita 1: Přesná shoda to_code + vehicle_type
    if to_depot_code:
        for rate in linehaul_rates:
            tc = rate.get('to_code') or rate.get('toCode')
            vt = rate.get('vehicle_type') or rate.get('vehicleType')
            if tc == to_depot_code and vt == vehicle_type:
                return Decimal(str(rate['rate']))
    
    # Priorita 2: Shoda to_code
    if to_depot_code:
        for rate in linehaul_rates:
            tc = rate.get('to_code') or rate.get('toCode')
            if tc == to_depot_code:
                return Decimal(str(rate['rate']))
    
    return None


# =============================================================================
# AGREGAČNÍ FUNKCE
# =============================================================================

def calculate_plan_total_cost(
    routes: List[RouteInfo],
    fix_rates: List[Dict],
    km_rates: List[Dict],
    linehaul_rates: List[Dict],
) -> Dict[str, Any]:
    """
    Vypočítá celkové náklady za plánovací soubor.
    """
    total_fix = Decimal('0')
    total_km = Decimal('0')
    total_linehaul = Decimal('0')
    total = Decimal('0')
    
    all_warnings = []
    all_missing_rates = set()
    
    per_depot = {}
    
    for route in routes:
        cost = calculate_route_cost(route, fix_rates, km_rates, linehaul_rates)
        
        total_fix += cost.fix_cost
        total_km += cost.km_cost
        total_linehaul += cost.linehaul_cost
        total += cost.total_cost
        
        all_warnings.extend(cost.warnings)
        all_missing_rates.update(cost.missing_rates)
        
        # Per depot agregace
        depot = cost.depot_code or 'UNKNOWN'
        if depot not in per_depot:
            per_depot[depot] = {
                'routes_count': 0,
                'trips_count': 0,
                'fix_cost': Decimal('0'),
                'km_cost': Decimal('0'),
                'linehaul_cost': Decimal('0'),
                'total_cost': Decimal('0'),
                'total_km': Decimal('0'),
            }
        
        per_depot[depot]['routes_count'] += 1
        per_depot[depot]['trips_count'] += cost.trips_count
        per_depot[depot]['fix_cost'] += cost.fix_cost
        per_depot[depot]['km_cost'] += cost.km_cost
        per_depot[depot]['linehaul_cost'] += cost.linehaul_cost
        per_depot[depot]['total_cost'] += cost.total_cost
        per_depot[depot]['total_km'] += route.total_distance_km
    
    return {
        'total': {
            'fix_cost': float(total_fix),
            'km_cost': float(total_km),
            'linehaul_cost': float(total_linehaul),
            'total_cost': float(total),
            'routes_count': len(routes),
        },
        'per_depot': {k: {kk: float(vv) if isinstance(vv, Decimal) else vv for kk, vv in v.items()} for k, v in per_depot.items()},
        'warnings': all_warnings,
        'missing_rates': list(all_missing_rates),
    }
