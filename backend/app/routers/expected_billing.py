"""
Expected Billing API Router
Výpočet očekávané fakturace na základě plánovacích souborů a ceníků
"""
from typing import Optional
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
    PriceConfig, FixRate, KmRate, DepoRate, LinehaulRate
)

router = APIRouter()


def get_working_days_in_month(year: int, month: int) -> int:
    """Spočítá pracovní dny (Po-Pá) v měsíci"""
    _, last_day = monthrange(year, month)
    working_days = 0
    for day in range(1, last_day + 1):
        d = date(year, month, day)
        if d.weekday() < 5:  # Po-Pá
            working_days += 1
    return working_days


@router.get("/calculate")
async def calculate_expected_billing(
    carrier_id: int = Query(..., description="ID dopravce"),
    year: int = Query(..., description="Rok"),
    month: int = Query(..., description="Měsíc (1-12)"),
    db: AsyncSession = Depends(get_db)
):
    """
    Vypočítá očekávanou fakturaci pro dopravce za daný měsíc.
    
    Logika:
    1. Načte plánovací soubory platné pro daný měsíc
    2. Načte aktivní ceníky
    3. Spočítá:
       - FIX za trasy (DPO + SD) × počet pracovních dnů
       - KM × celkové km
       - Linehaul × počet linehaulů × pracovní dny
       - DEPO (denní nebo měsíční paušál)
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
    
    # Pracovní dny v měsíci
    working_days = get_working_days_in_month(year, month)
    
    # Načti plánovací soubory platné pro daný měsíc
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
    
    # Načti aktivní ceníky
    price_configs_result = await db.execute(
        select(PriceConfig)
        .options(
            selectinload(PriceConfig.fix_rates),
            selectinload(PriceConfig.km_rates),
            selectinload(PriceConfig.depo_rates),
            selectinload(PriceConfig.linehaul_rates),
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
    fix_rates = {}  # route_type -> rate
    km_rate = Decimal('0')
    depo_rates = {}  # depo_name -> {rate, rate_type}
    linehaul_rates = {}  # vehicle_type -> rate
    
    for config in price_configs:
        for rate in config.fix_rates:
            fix_rates[rate.route_type] = rate.rate
        for rate in config.km_rates:
            if rate.rate > km_rate:
                km_rate = rate.rate
        for rate in config.depo_rates:
            depo_rates[rate.depo_name] = {
                'rate': rate.rate,
                'rate_type': rate.rate_type
            }
        for rate in config.linehaul_rates:
            key = f"{rate.from_code or '?'}->{rate.to_code or '?'}_{rate.vehicle_type}"
            linehaul_rates[key] = rate.rate
    
    # Agreguj data z plánů
    total_dpo_routes = 0
    total_sd_routes = 0
    total_km = Decimal('0')
    total_dpo_linehaul = 0
    total_sd_linehaul = 0
    vratimov_days = 0
    bydzov_days = 0
    
    plan_details = []
    
    for plan in plans:
        # Spočítej kolik dnů z měsíce pokrývá tento plán
        plan_start = plan.valid_from.date() if isinstance(plan.valid_from, datetime) else plan.valid_from
        plan_end = plan.valid_to.date() if plan.valid_to else month_end
        if isinstance(plan_end, datetime):
            plan_end = plan_end.date()
        
        # Ořízni na měsíc
        effective_start = max(plan_start, month_start)
        effective_end = min(plan_end, month_end)
        
        if effective_start > effective_end:
            continue
        
        # Pracovní dny v tomto rozsahu
        plan_working_days = 0
        current = effective_start
        from datetime import timedelta
        while current <= effective_end:
            if current.weekday() < 5:
                plan_working_days += 1
            current += timedelta(days=1)
        
        if plan_working_days == 0:
            continue
        
        # Přičti trasy × pracovní dny
        total_dpo_routes += (plan.dpo_routes_count or 0) * plan_working_days
        total_sd_routes += (plan.sd_routes_count or 0) * plan_working_days
        
        # Linehauly × pracovní dny
        total_dpo_linehaul += (plan.dpo_linehaul_count or 0) * plan_working_days
        total_sd_linehaul += (plan.sd_linehaul_count or 0) * plan_working_days
        
        # KM - celkem za období
        plan_km = Decimal(str(plan.total_distance_km or 0))
        total_km += plan_km * plan_working_days
        
        # DEPO dny
        if plan.depot in ('VRATIMOV', 'BOTH'):
            vratimov_days = max(vratimov_days, plan_working_days)
        if plan.depot in ('BYDZOV', 'BOTH'):
            bydzov_days = max(bydzov_days, plan_working_days)
        
        plan_details.append({
            'id': plan.id,
            'fileName': plan.file_name,
            'validFrom': plan_start.isoformat(),
            'validTo': plan_end.isoformat() if plan.valid_to else None,
            'effectiveStart': effective_start.isoformat(),
            'effectiveEnd': effective_end.isoformat(),
            'workingDays': plan_working_days,
            'depot': plan.depot,
            'dpoRoutes': plan.dpo_routes_count or 0,
            'sdRoutes': plan.sd_routes_count or 0,
            'dpoLinehaul': plan.dpo_linehaul_count or 0,
            'sdLinehaul': plan.sd_linehaul_count or 0,
            'totalKm': float(plan.total_distance_km or 0),
        })
    
    # === VÝPOČET FAKTURACE ===
    
    # 1. FIX za trasy
    # Hledáme sazby podle typu
    dpo_fix_rate = fix_rates.get('DPO') or fix_rates.get('DIRECT_DPO') or fix_rates.get('DROP_Dopoledne') or Decimal('0')
    sd_fix_rate = fix_rates.get('SD') or fix_rates.get('DIRECT_SD') or fix_rates.get('DROP_Odpoledne') or Decimal('0')
    
    # Pokud nemáme specifické, zkusíme obecné
    if dpo_fix_rate == 0:
        for key, rate in fix_rates.items():
            if 'DPO' in key.upper() or 'DIRECT' in key.upper():
                dpo_fix_rate = rate
                break
    if sd_fix_rate == 0:
        for key, rate in fix_rates.items():
            if 'SD' in key.upper():
                sd_fix_rate = rate
                break
    
    fix_dpo_total = dpo_fix_rate * total_dpo_routes
    fix_sd_total = sd_fix_rate * total_sd_routes
    fix_total = fix_dpo_total + fix_sd_total
    
    # 2. KM
    km_total = km_rate * total_km
    
    # 3. Linehaul
    # Použijeme průměrnou sazbu nebo první nalezenou
    linehaul_rate_avg = Decimal('0')
    if linehaul_rates:
        linehaul_rate_avg = sum(linehaul_rates.values()) / len(linehaul_rates)
    
    total_linehauls = total_dpo_linehaul + total_sd_linehaul
    linehaul_total = linehaul_rate_avg * total_linehauls
    
    # 4. DEPO
    depo_total = Decimal('0')
    depo_details = []
    
    for depo_name, depo_info in depo_rates.items():
        rate = depo_info['rate']
        rate_type = depo_info['rate_type']
        
        if 'vratimov' in depo_name.lower():
            days = vratimov_days
        elif 'bydžov' in depo_name.lower() or 'bydzov' in depo_name.lower():
            days = bydzov_days
        else:
            days = working_days
        
        if rate_type == 'monthly' or rate_type == 'měsíční':
            depo_amount = rate  # Měsíční paušál
        else:
            depo_amount = rate * days  # Denní sazba
        
        depo_total += depo_amount
        depo_details.append({
            'name': depo_name,
            'rate': float(rate),
            'rateType': rate_type,
            'days': days,
            'amount': float(depo_amount)
        })
    
    # Celkem
    grand_total = fix_total + km_total + linehaul_total + depo_total
    
    # Výstup
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
        
        "plans": plan_details,
        "priceConfigsCount": len(price_configs),
        
        "breakdown": {
            "fix": {
                "dpoRoutes": total_dpo_routes,
                "dpoRate": float(dpo_fix_rate),
                "dpoTotal": float(fix_dpo_total),
                "sdRoutes": total_sd_routes,
                "sdRate": float(sd_fix_rate),
                "sdTotal": float(fix_sd_total),
                "total": float(fix_total)
            },
            "km": {
                "totalKm": float(total_km),
                "rate": float(km_rate),
                "total": float(km_total)
            },
            "linehaul": {
                "dpoCount": total_dpo_linehaul,
                "sdCount": total_sd_linehaul,
                "totalCount": total_linehauls,
                "avgRate": float(linehaul_rate_avg),
                "total": float(linehaul_total),
                "rates": {k: float(v) for k, v in linehaul_rates.items()}
            },
            "depo": {
                "details": depo_details,
                "total": float(depo_total)
            }
        },
        
        "totals": {
            "fix": float(fix_total),
            "km": float(km_total),
            "linehaul": float(linehaul_total),
            "depo": float(depo_total),
            "grandTotal": float(grand_total),
            "grandTotalWithVat": float(grand_total * Decimal('1.21'))
        },
        
        "warnings": []
    }


@router.get("/periods")
async def get_available_periods(
    carrier_id: int = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """Vrátí dostupná období (měsíce) pro daného dopravce na základě plánovacích souborů"""
    
    result = await db.execute(
        select(RoutePlan.valid_from)
        .where(RoutePlan.carrier_id == carrier_id)
        .order_by(RoutePlan.valid_from.desc())
    )
    
    periods = set()
    for row in result.fetchall():
        d = row[0]
        if isinstance(d, datetime):
            d = d.date()
        periods.add((d.year, d.month))
    
    return {
        "periods": [
            {"year": year, "month": month, "label": f"{month:02d}/{year}"}
            for year, month in sorted(periods, reverse=True)
        ]
    }
