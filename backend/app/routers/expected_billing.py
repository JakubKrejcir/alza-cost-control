"""
Expected Billing API Router
Výpočet očekávané fakturace na základě plánovacích souborů a ceníků
Updated: 2025-12-05 - Využívá depot_id, route_category, from_warehouse_id
"""
from typing import Optional, Dict, List
from datetime import datetime, date
from decimal import Decimal
from calendar import monthrange
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import (
    Carrier, RoutePlan, RoutePlanRoute, 
    PriceConfig, FixRate, KmRate, DepoRate, LinehaulRate,
    Depot, Warehouse  # NEW
)

router = APIRouter()


# =============================================================================
# KONFIGURACE - MAPOVÁNÍ
# =============================================================================

START_LOCATION_TO_CATEGORY = {
    'Depo Chrášťany': 'DIRECT_SKLAD',
    'Třídírna': 'DIRECT_SKLAD',
    'Depo Drivecool': 'DIRECT_DEPO',
    'Depo Nový Bydžov': 'DIRECT_DEPO',
    'Depo GEM': 'DIRECT_DEPO',
    'Depo Hosín': 'DIRECT_DEPO',
    'Depo_Západ': 'DIRECT_DEPO',
}

START_LOCATION_TO_DEPOT = {
    'Depo Drivecool': 'VRATIMOV',
    'Depo Nový Bydžov': 'NOVY_BYDZOV',
    'Depo GEM': 'BRNO',
    'Depo Hosín': 'CESKE_BUDEJOVICE',
    'Depo_Západ': 'RAKOVNIK',
}

ROUTE_PREFIX_TO_DEPOT = {
    'Moravskoslezsko': 'VRATIMOV',
    'Hradecko': 'NOVY_BYDZOV',
    'Liberecko': 'NOVY_BYDZOV',
    'Pardubicko': 'NOVY_BYDZOV',
    'Ústecko': 'NOVY_BYDZOV',
    'Morava': 'BRNO',
    'Jižní Čechy': 'CESKE_BUDEJOVICE',
    'Západní Čechy': 'RAKOVNIK',
}


# =============================================================================
# HELPER FUNKCE
# =============================================================================

def get_working_days_in_month(year: int, month: int) -> int:
    """Spočítá pracovní dny (Po-Pá) v měsíci"""
    _, last_day = monthrange(year, month)
    working_days = 0
    for day in range(1, last_day + 1):
        d = date(year, month, day)
        if d.weekday() < 5:
            working_days += 1
    return working_days


def detect_route_category(start_location: str, dr_lh: str) -> str:
    """Určuje kategorii trasy podle startovního místa a DR/LH"""
    if start_location in START_LOCATION_TO_CATEGORY:
        return START_LOCATION_TO_CATEGORY[start_location]
    
    # Fallback podle DR/LH
    if dr_lh:
        dr_lh_upper = dr_lh.upper()
        if 'LH' in dr_lh_upper:
            return 'DIRECT_DEPO'
        elif 'DR' in dr_lh_upper:
            return 'DIRECT_SKLAD'
    
    return 'DIRECT_SKLAD'  # Default


def detect_depot_code(start_location: str, route_name: str) -> Optional[str]:
    """Detekuje kód depa ze startovního místa nebo názvu trasy"""
    # Z start_location
    if start_location in START_LOCATION_TO_DEPOT:
        return START_LOCATION_TO_DEPOT[start_location]
    
    # Z route_name
    if route_name:
        route_upper = route_name.upper()
        for prefix, depot in ROUTE_PREFIX_TO_DEPOT.items():
            if prefix.upper() in route_upper:
                return depot
    
    return None


def count_trips(dr_lh: str) -> int:
    """Spočítá počet jízd z DR/LH sloupce"""
    if not dr_lh:
        return 1
    
    dr_lh_upper = dr_lh.upper()
    
    # Počítej DR a LH
    dr_count = dr_lh_upper.count('DR')
    lh_count = dr_lh_upper.count('LH')
    
    return max(dr_count, lh_count, 1)


def has_linehaul(dr_lh: str) -> bool:
    """Zjistí, zda trasa má linehaul"""
    if not dr_lh:
        return False
    return 'LH' in dr_lh.upper()


def count_linehauls(dr_lh: str) -> int:
    """Spočítá počet linehaulů"""
    if not dr_lh:
        return 0
    return dr_lh.upper().count('LH')


# =============================================================================
# NOVÉ FUNKCE PRO VYHLEDÁVÁNÍ SAZEB
# =============================================================================

def find_fix_rate(
    fix_rates: List[FixRate],
    route_category: str,
    depot_code: Optional[str]
) -> Optional[Decimal]:
    """
    Najde FIX sazbu podle depa a route_type.
    Priorita:
    1. depot match (podle depot.code nebo route_type obsahující depot název)
    2. route_type text match (DIRECT_Praha, DIRECT_Vratimov, etc.)
    3. Fallback na první dostupnou
    """
    # Priorita 1: Přesná shoda depot
    if depot_code:
        for rate in fix_rates:
            if rate.depot and rate.depot.code == depot_code:
                return rate.rate
    
    # Priorita 2: route_type obsahuje depot název
    if depot_code:
        depot_search = depot_code.upper().replace('_', ' ')
        for rate in fix_rates:
            rt = (rate.route_type or '').upper()
            if depot_search in rt or depot_code.upper() in rt:
                return rate.rate
    
    # Priorita 3: Fallback na route_type text podle kategorie
    if route_category == 'DIRECT_SKLAD':
        search_terms = ['PRAHA', 'DIRECT_PRAHA', 'STČ']
    else:
        search_terms = [depot_code or 'VRATIMOV', 'DIRECT_']
    
    for rate in fix_rates:
        rt = (rate.route_type or '').upper()
        for term in search_terms:
            if term.upper() in rt:
                return rate.rate
    
    # Fallback: první dostupná
    if fix_rates:
        return fix_rates[0].rate
    
    return None


def find_km_rate(
    km_rates: List[KmRate],
    depot_code: Optional[str]
) -> Optional[Decimal]:
    """
    Najde KM sazbu, prioritně podle depa.
    """
    # Priorita 1: Podle depot
    if depot_code:
        for rate in km_rates:
            if rate.depot and rate.depot.code == depot_code:
                return rate.rate
    
    # Priorita 2: První dostupná
    if km_rates:
        return km_rates[0].rate
    
    return None


def find_linehaul_rate(
    linehaul_rates: List[LinehaulRate],
    to_depot_code: Optional[str],
    vehicle_type: str = 'KAMION'
) -> Optional[Decimal]:
    """
    Najde linehaul sazbu podle cílového depa a typu vozidla.
    """
    # Priorita 1: Přesná shoda to_code + vehicle_type
    if to_depot_code:
        for rate in linehaul_rates:
            if rate.to_code == to_depot_code and rate.vehicle_type == vehicle_type:
                return rate.rate
    
    # Priorita 2: Shoda to_code
    if to_depot_code:
        for rate in linehaul_rates:
            if rate.to_code == to_depot_code:
                return rate.rate
    
    # Priorita 3: Podle vehicle_type
    for rate in linehaul_rates:
        if rate.vehicle_type == vehicle_type:
            return rate.rate
    
    # Fallback: průměr
    if linehaul_rates:
        return sum(r.rate for r in linehaul_rates) / len(linehaul_rates)
    
    return None


def find_depo_rates(
    depo_rates: List[DepoRate],
    depot_code: Optional[str]
) -> Dict[str, dict]:
    """
    Najde DEPO sazby, prioritně podle depot_id.
    """
    result = {}
    
    for rate in depo_rates:
        # Pokud má depot_id, použij kód depa jako klíč
        if rate.depot:
            key = rate.depot.code
        else:
            key = rate.depo_name
        
        # Filtruj podle depot_code pokud je zadán
        if depot_code:
            if rate.depot and rate.depot.code != depot_code:
                continue
            elif not rate.depot and depot_code.lower() not in rate.depo_name.lower():
                continue
        
        result[key] = {
            'rate': rate.rate,
            'rate_type': rate.rate_type,
            'depo_name': rate.depo_name,
        }
    
    return result


# =============================================================================
# HLAVNÍ ENDPOINT
# =============================================================================

@router.get("/calculate")
async def calculate_expected_billing(
    carrier_id: int = Query(..., description="ID dopravce"),
    year: int = Query(..., description="Rok"),
    month: int = Query(..., description="Měsíc (1-12)"),
    db: AsyncSession = Depends(get_db)
):
    """
    Vypočítá očekávanou fakturaci pro dopravce za daný měsíc.
    
    NOVÁ LOGIKA:
    1. Načte plánovací soubory a detekuje route_category a depot pro každou trasu
    2. Páruje s ceníky podle route_category a depot_id
    3. Počítá FIX × trips, KM × distance × trips, Linehaul × linehauls
    """
    
    # Ověř dopravce
    carrier_result = await db.execute(
        select(Carrier).where(Carrier.id == carrier_id)
    )
    carrier = carrier_result.scalar_one_or_none()
    if not carrier:
        raise HTTPException(status_code=404, detail="Dopravce nenalezen")
    
    # Rozsah měsíce
    month_start = date(year, month, 1)
    _, last_day = monthrange(year, month)
    month_end = date(year, month, last_day)
    
    # Pracovní dny
    working_days = get_working_days_in_month(year, month)
    
    # Načti plánovací soubory
    plans_result = await db.execute(
        select(RoutePlan)
        .options(selectinload(RoutePlan.routes))
        .where(
            and_(
                RoutePlan.carrier_id == carrier_id,
                RoutePlan.valid_from <= datetime.combine(month_end, datetime.max.time()),
                or_(
                    RoutePlan.valid_to == None,
                    RoutePlan.valid_to >= datetime.combine(month_start, datetime.min.time())
                )
            )
        )
        .order_by(RoutePlan.valid_from)
    )
    plans = plans_result.scalars().all()
    
    if not plans:
        return {
            "success": False,
            "error": f"Žádné plánovací soubory pro {month}/{year}",
            "carrier": {"id": carrier.id, "name": carrier.name},
            "period": f"{month:02d}/{year}",
            "workingDays": working_days
        }
    
    # Načti aktivní ceníky s relationships
    price_configs_result = await db.execute(
        select(PriceConfig)
        .options(
            selectinload(PriceConfig.fix_rates).selectinload(FixRate.depot),
            selectinload(PriceConfig.km_rates).selectinload(KmRate.depot),
            selectinload(PriceConfig.depo_rates).selectinload(DepoRate.depot),
            selectinload(PriceConfig.linehaul_rates).selectinload(LinehaulRate.from_warehouse),
        )
        .where(
            and_(
                PriceConfig.carrier_id == carrier_id,
                PriceConfig.is_active == True,
                PriceConfig.valid_from <= datetime.combine(month_end, datetime.max.time()),
                or_(
                    PriceConfig.valid_to == None,
                    PriceConfig.valid_to >= datetime.combine(month_start, datetime.min.time())
                )
            )
        )
    )
    price_configs = price_configs_result.scalars().all()
    
    # Agreguj sazby ze všech aktivních ceníků
    all_fix_rates = []
    all_km_rates = []
    all_depo_rates = []
    all_linehaul_rates = []
    
    for config in price_configs:
        all_fix_rates.extend(config.fix_rates)
        all_km_rates.extend(config.km_rates)
        all_depo_rates.extend(config.depo_rates)
        all_linehaul_rates.extend(config.linehaul_rates)
    
    # === VÝPOČET PO TRASÁCH ===
    
    routes_breakdown = []
    totals = {
        'fix': Decimal('0'),
        'km': Decimal('0'),
        'linehaul': Decimal('0'),
        'depo': Decimal('0'),
    }
    
    # Agregace per depot
    per_depot = {}
    
    # Agregace pro DPO/SD
    dpo_routes = 0
    sd_routes = 0
    dpo_linehauls = 0
    sd_linehauls = 0
    total_km = Decimal('0')
    
    # Depo dny (pro DEPO sazby)
    depot_days = {}
    
    # NOVÉ: Denní agregace - pro KAŽDÝ den v měsíci
    daily_breakdown = {}
    
    # Seřaď plány podle valid_from pro správné určení platnosti
    sorted_plans = sorted(plans, key=lambda p: p.valid_from or p.plan_date or datetime.min)
    
    # Vytvoř záznamy pro každý den v měsíci
    _, last_day = monthrange(year, month)
    for day in range(1, last_day + 1):
        current_date = date(year, month, day)
        day_key = current_date.strftime('%Y-%m-%d')
        
        # Najdi VŠECHNY platné plány pro tento den
        # Pro každou kombinaci (depot, plan_type) vyber nejnovější platný plán
        valid_plans_by_key = {}  # key = (depot, plan_type) -> plan
        
        for plan in sorted_plans:
            plan_start = (plan.valid_from or plan.plan_date).date() if (plan.valid_from or plan.plan_date) else None
            plan_end = plan.valid_to.date() if plan.valid_to else None
            
            if plan_start and plan_start <= current_date:
                if plan_end is None or plan_end >= current_date:
                    # Plán je platný pro tento den
                    key = (plan.depot, plan.plan_type)
                    # Novější plán (vyšší valid_from) přepíše starší
                    if key not in valid_plans_by_key or plan_start >= (valid_plans_by_key[key].valid_from or valid_plans_by_key[key].plan_date).date():
                        valid_plans_by_key[key] = plan
        
        valid_plans = list(valid_plans_by_key.values())
        
        # Inicializace denního záznamu
        plan_names = [p.file_name for p in valid_plans] if valid_plans else []
        daily_breakdown[day_key] = {
            'date': day_key,
            'routes': 0,
            'trips': 0,
            'km': Decimal('0'),
            'fix': Decimal('0'),
            'kmCost': Decimal('0'),
            'linehaul': Decimal('0'),
            'total': Decimal('0'),
            'dpoRoutes': 0,
            'sdRoutes': 0,
            'linehauls': 0,
            'planCount': len(valid_plans),
            'planName': ', '.join(plan_names) if plan_names else None,
        }
        
        # Pokud máme platné plány, spočítej náklady pro tento den
        for valid_plan in valid_plans:
            plan_total_km = Decimal(str(valid_plan.total_distance_km or 0))
            routes_count = len(valid_plan.routes) or 1
            avg_km_per_route = plan_total_km / routes_count if routes_count > 0 else Decimal('0')
            
            for route in valid_plan.routes:
                # Detekce kategorie a depa
                route_category = detect_route_category(
                    route.start_location or '',
                    route.dr_lh or ''
                )
                depot_code = detect_depot_code(
                    route.start_location or '',
                    route.route_name or ''
                )
                
                # Počet jízd
                trips = count_trips(route.dr_lh)
                
                # KM - použij hodnotu z trasy, nebo průměr z plánu
                route_km = Decimal(str(route.total_distance_km or 0))
                if route_km == 0:
                    route_km = avg_km_per_route
                
                # === HLEDÁNÍ SAZEB PRO DENNÍ ROZPIS ===
                fix_rate = find_fix_rate(all_fix_rates, route_category, depot_code)
                fix_cost = (fix_rate or Decimal('0')) * trips
                
                km_rate = find_km_rate(all_km_rates, depot_code)
                km_cost = (km_rate or Decimal('0')) * route_km * trips
                
                linehaul_cost = Decimal('0')
                lh_count = 0
                if has_linehaul(route.dr_lh):
                    lh_rate = find_linehaul_rate(all_linehaul_rates, depot_code)
                    lh_count = count_linehauls(route.dr_lh)
                    linehaul_cost = (lh_rate or Decimal('0')) * lh_count
                
                # Přičti k dennímu záznamu
                daily_breakdown[day_key]['routes'] += 1
                daily_breakdown[day_key]['trips'] += trips
                daily_breakdown[day_key]['km'] += route_km * trips
                daily_breakdown[day_key]['fix'] += fix_cost
                daily_breakdown[day_key]['kmCost'] += km_cost
                daily_breakdown[day_key]['linehaul'] += linehaul_cost
                daily_breakdown[day_key]['total'] += fix_cost + km_cost + linehaul_cost
                daily_breakdown[day_key]['linehauls'] += lh_count
                
                # Per-depot agregace (pro denní souhrn)
                if depot_code:
                    if depot_code not in per_depot:
                        per_depot[depot_code] = {
                            'routes': 0,
                            'trips': 0,
                            'km': Decimal('0'),
                            'fix': Decimal('0'),
                            'km_cost': Decimal('0'),
                            'linehaul': Decimal('0'),
                        }
                    per_depot[depot_code]['routes'] += 1
                    per_depot[depot_code]['trips'] += trips
                    per_depot[depot_code]['km'] += route_km * trips
                    per_depot[depot_code]['fix'] += fix_cost
                    per_depot[depot_code]['km_cost'] += km_cost
                    per_depot[depot_code]['linehaul'] += linehaul_cost
                    
                    # Depo dny pro DEPO sazby
                    if depot_code not in depot_days:
                        depot_days[depot_code] = set()
                    depot_days[depot_code].add(day_key)
                
                # DPO/SD pro denní agregaci
                plan_type = (route.plan_type or valid_plan.plan_type or '').upper()
                if 'DPO' in plan_type:
                    daily_breakdown[day_key]['dpoRoutes'] += trips
                elif 'SD' in plan_type:
                    daily_breakdown[day_key]['sdRoutes'] += trips
                else:
                    if route.start_time and route.start_time < '12:00':
                        daily_breakdown[day_key]['dpoRoutes'] += trips
                    else:
                        daily_breakdown[day_key]['sdRoutes'] += trips
    
    # === ROUTES BREAKDOWN (pro debugging) ===
    # Zobraz unikátní trasy ze všech plánů (každou trasu jen jednou)
    seen_routes = set()
    for plan in plans:
        plan_total_km = Decimal(str(plan.total_distance_km or 0))
        routes_count = len(plan.routes) or 1
        avg_km_per_route = plan_total_km / routes_count if routes_count > 0 else Decimal('0')
        
        for route in plan.routes:
            route_key = f"{plan.id}-{route.route_name}"
            if route_key in seen_routes:
                continue
            seen_routes.add(route_key)
            
            route_category = detect_route_category(
                route.start_location or '',
                route.dr_lh or ''
            )
            depot_code = detect_depot_code(
                route.start_location or '',
                route.route_name or ''
            )
            trips = count_trips(route.dr_lh)
            route_km = Decimal(str(route.total_distance_km or 0))
            if route_km == 0:
                route_km = avg_km_per_route
            
            fix_rate = find_fix_rate(all_fix_rates, route_category, depot_code)
            km_rate = find_km_rate(all_km_rates, depot_code)
            linehaul_cost = Decimal('0')
            if has_linehaul(route.dr_lh):
                lh_rate = find_linehaul_rate(all_linehaul_rates, depot_code)
                linehaul_cost = (lh_rate or Decimal('0')) * count_linehauls(route.dr_lh)
            
            routes_breakdown.append({
                'routeName': route.route_name,
                'startLocation': route.start_location,
                'drLh': route.dr_lh,
                'routeCategory': route_category,
                'depotCode': depot_code,
                'trips': trips,
                'km': float(route_km),
                'fixRate': float(fix_rate) if fix_rate else None,
                'kmRate': float(km_rate) if km_rate else None,
                'fixCost': float((fix_rate or Decimal('0')) * trips),
                'kmCost': float((km_rate or Decimal('0')) * route_km * trips),
                'linehaulCost': float(linehaul_cost),
                'planName': plan.file_name,
            })
    
    # === DEPO NÁKLADY ===
    depo_details = []
    
    # Pro každé depo kde máme trasy
    for depot_code in depot_days.keys():
        depo_rates = find_depo_rates(all_depo_rates, depot_code)
        
        for key, rate_info in depo_rates.items():
            rate = rate_info['rate']
            rate_type = rate_info['rate_type']
            
            if rate_type == 'monthly' or rate_type == 'měsíční':
                depo_amount = rate
                days = None
            else:
                days = working_days
                depo_amount = rate * days
            
            totals['depo'] += depo_amount
            
            depo_details.append({
                'name': rate_info['depo_name'],
                'depotCode': depot_code,
                'rate': float(rate),
                'rateType': rate_type,
                'days': days,
                'amount': float(depo_amount),
            })
    
    # === PŘEPOČET TOTALS Z DENNÍHO ROZPADU ===
    # Totals by měly být součtem denních hodnot, ne z původní smyčky
    daily_totals = {
        'fix': Decimal('0'),
        'km': Decimal('0'),
        'linehaul': Decimal('0'),
        'routes': 0,
        'trips': 0,
        'total_km': Decimal('0'),
        'dpo_routes': 0,
        'sd_routes': 0,
        'linehauls': 0,
    }
    
    for day_data in daily_breakdown.values():
        daily_totals['fix'] += day_data['fix']
        daily_totals['km'] += day_data['kmCost']
        daily_totals['linehaul'] += day_data['linehaul']
        daily_totals['routes'] += day_data['routes']
        daily_totals['trips'] += day_data['trips']
        daily_totals['total_km'] += day_data['km']
        daily_totals['dpo_routes'] += day_data['dpoRoutes']
        daily_totals['sd_routes'] += day_data['sdRoutes']
        daily_totals['linehauls'] += day_data['linehauls']
    
    # Použij denní součty místo původních
    totals['fix'] = daily_totals['fix']
    totals['km'] = daily_totals['km']
    totals['linehaul'] = daily_totals['linehaul']
    total_km = daily_totals['total_km']
    dpo_routes = daily_totals['dpo_routes']
    sd_routes = daily_totals['sd_routes']
    
    # Celkem
    grand_total = totals['fix'] + totals['km'] + totals['linehaul'] + totals['depo']
    grand_total_with_vat = grand_total * Decimal('1.21')
    
    return {
        "success": True,
        "carrier": {
            "id": carrier.id,
            "name": carrier.name
        },
        "period": f"{month:02d}/{year}",
        "periodStart": month_start.isoformat(),
        "periodEnd": month_end.isoformat(),
        "workingDays": working_days,
        "totals": {
            "fix": float(totals['fix']),
            "km": float(totals['km']),
            "linehaul": float(totals['linehaul']),
            "depo": float(totals['depo']),
            "grandTotal": float(grand_total),
            "grandTotalWithVat": float(grand_total_with_vat),
        },
        "breakdown": {
            "fix": {
                "dpoRoutes": dpo_routes,
                "sdRoutes": sd_routes,
                "total": float(totals['fix']),
            },
            "km": {
                "totalKm": float(total_km),
                "total": float(totals['km']),
            },
            "linehaul": {
                "dpoLinehauls": dpo_linehauls,
                "sdLinehauls": sd_linehauls,
                "total": float(totals['linehaul']),
            },
            "depo": {
                "details": depo_details,
                "total": float(totals['depo']),
            },
        },
        "perDepot": {
            code: {
                'routes': data['routes'],
                'trips': data['trips'],
                'km': float(data['km']),
                'fix': float(data['fix']),
                'kmCost': float(data['km_cost']),
                'linehaul': float(data['linehaul']),
                'total': float(data['fix'] + data['km_cost'] + data['linehaul']),
            }
            for code, data in per_depot.items()
        },
        "dailyBreakdown": [
            {
                'date': day_data['date'],
                'dayName': datetime.strptime(day_data['date'], '%Y-%m-%d').strftime('%A'),
                'dayShort': datetime.strptime(day_data['date'], '%Y-%m-%d').strftime('%d.%m.'),
                'routes': day_data['routes'],
                'trips': day_data['trips'],
                'km': float(day_data['km']),
                'fix': float(day_data['fix']),
                'kmCost': float(day_data['kmCost']),
                'linehaul': float(day_data['linehaul']),
                'total': float(day_data['total']),
                'dpoRoutes': day_data['dpoRoutes'],
                'sdRoutes': day_data['sdRoutes'],
                'linehauls': day_data['linehauls'],
                'planName': day_data.get('planName'),
            }
            for day_data in sorted(daily_breakdown.values(), key=lambda x: x['date'])
        ],
        "plans": [
            {
                "id": plan.id,
                "fileName": plan.file_name,
                "validFrom": plan.valid_from.isoformat() if plan.valid_from else None,
                "depot": plan.depot,
                "routesCount": len(plan.routes),
            }
            for plan in plans
        ],
        "routesBreakdown": routes_breakdown[:50],  # Limit pro response size
        "warnings": [],
    }
