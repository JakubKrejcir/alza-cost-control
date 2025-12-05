"""
Analysis API Router
Updated: 2025-12-05 - Využívá depot_id, route_category pro párování
"""
from typing import Optional
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import (
    Proof, Carrier, PriceConfig, FixRate, KmRate, DepoRate, LinehaulRate
)

router = APIRouter()


# =============================================================================
# HELPER FUNKCE PRO PÁROVÁNÍ
# =============================================================================

def find_fix_rate_for_route(
    fix_rates: list,
    route_type: str,
    route_category: Optional[str] = None,
    depot_code: Optional[str] = None
) -> Optional[float]:
    """
    Najde FIX sazbu pro daný typ trasy.
    Priorita:
    1. route_category + depot match
    2. route_type exact match
    3. route_type partial match
    """
    # Priorita 1: Podle route_category a depot
    if route_category:
        for rate in fix_rates:
            if rate.route_category == route_category:
                if depot_code and rate.depot and rate.depot.code == depot_code:
                    return float(rate.rate)
                elif not depot_code:
                    return float(rate.rate)
    
    # Priorita 2: Přesná shoda route_type
    for rate in fix_rates:
        if rate.route_type == route_type:
            return float(rate.rate)
    
    # Priorita 3: Částečná shoda
    route_upper = route_type.upper()
    for rate in fix_rates:
        rt = (rate.route_type or '').upper()
        if route_upper in rt or rt in route_upper:
            return float(rate.rate)
    
    return None


def detect_route_category_from_type(route_type: str) -> Optional[str]:
    """Detekuje kategorii z názvu route_type"""
    if not route_type:
        return None
    
    rt_upper = route_type.upper()
    
    # DIRECT ze skladu = Praha, STČ
    if 'PRAHA' in rt_upper or 'STČ' in rt_upper or 'STREDNI' in rt_upper:
        return 'DIRECT_SKLAD'
    
    # DIRECT z depa = ostatní regiony
    if any(depot in rt_upper for depot in ['VRATIMOV', 'BYDZOV', 'BYDŽOV', 'BRNO', 'BUDEJOVIC', 'RAKOVNIK']):
        return 'DIRECT_DEPO'
    
    return None


def detect_depot_code_from_type(route_type: str) -> Optional[str]:
    """Detekuje kód depa z názvu route_type"""
    if not route_type:
        return None
    
    rt_upper = route_type.upper()
    
    if 'VRATIMOV' in rt_upper:
        return 'VRATIMOV'
    elif 'BYDZOV' in rt_upper or 'BYDŽOV' in rt_upper:
        return 'NOVY_BYDZOV'
    elif 'BRNO' in rt_upper:
        return 'BRNO'
    elif 'BUDEJOVIC' in rt_upper or 'BUDĚJOVIC' in rt_upper:
        return 'CESKE_BUDEJOVICE'
    elif 'RAKOVNIK' in rt_upper or 'RAKOVNÍK' in rt_upper:
        return 'RAKOVNIK'
    
    return None


# =============================================================================
# HLAVNÍ ENDPOINT
# =============================================================================

@router.get("/proof/{proof_id}")
async def analyze_proof(proof_id: int, db: AsyncSession = Depends(get_db)):
    """
    Analyzuje proof a porovnává s ceníkem.
    AKTUALIZOVÁNO: Využívá depot_id a route_category pro přesné párování.
    """
    # Načti proof se všemi vztahy
    result = await db.execute(
        select(Proof)
        .options(
            selectinload(Proof.carrier),
            selectinload(Proof.depot),
            selectinload(Proof.route_details),
            selectinload(Proof.linehaul_details),
            selectinload(Proof.depo_details),
            selectinload(Proof.invoices),
        )
        .where(Proof.id == proof_id)
    )
    proof = result.scalar_one_or_none()
    
    if not proof:
        raise HTTPException(status_code=404, detail="Proof not found")
    
    # Načti aktivní ceník s relationships
    price_config = None
    price_result = await db.execute(
        select(PriceConfig)
        .options(
            selectinload(PriceConfig.fix_rates).selectinload(FixRate.depot),
            selectinload(PriceConfig.km_rates).selectinload(KmRate.depot),
            selectinload(PriceConfig.depo_rates).selectinload(DepoRate.depot),
            selectinload(PriceConfig.linehaul_rates),
        )
        .where(
            and_(
                PriceConfig.carrier_id == proof.carrier_id,
                PriceConfig.is_active == True,
                PriceConfig.valid_from <= proof.period_date
            )
        )
        .order_by(PriceConfig.valid_from.desc())
    )
    price_config = price_result.scalars().first()
    
    # Připrav mapy sazeb
    fix_rates_map = {}
    km_rate_config = None
    depo_rates_map = {}
    linehaul_rates_map = {}
    
    if price_config:
        # FIX rates - klíč je route_type, ale ukládáme i category a depot
        for r in price_config.fix_rates:
            fix_rates_map[r.route_type] = {
                'rate': float(r.rate),
                'route_category': r.route_category,
                'depot_code': r.depot.code if r.depot else None,
            }
        
        # KM rate
        if price_config.km_rates:
            km_rate_config = float(price_config.km_rates[0].rate)
        
        # Depo rates
        for r in price_config.depo_rates:
            key = f"{r.depo_name}_{r.rate_type}"
            depo_rates_map[key] = {
                'rate': float(r.rate),
                'depot_code': r.depot.code if r.depot else None,
            }
        
        # Linehaul rates
        for r in price_config.linehaul_rates:
            key = f"{r.from_code or ''}_{r.to_code or ''}_{r.vehicle_type}"
            linehaul_rates_map[key] = float(r.rate)
    
    # === ANALÝZA ROUTE DETAILS ===
    route_details = []
    total_routes_calculated = Decimal('0')
    missing_rates = []
    
    for route in proof.route_details:
        # Detekce category a depot z route_type
        route_category = detect_route_category_from_type(route.route_type)
        depot_code = detect_depot_code_from_type(route.route_type)
        
        # Hledání sazby
        config_rate = None
        
        # 1. Přesná shoda
        if route.route_type in fix_rates_map:
            config_rate = fix_rates_map[route.route_type]['rate']
        else:
            # 2. Podle category a depot
            for rt, rate_info in fix_rates_map.items():
                if rate_info.get('route_category') == route_category:
                    if depot_code and rate_info.get('depot_code') == depot_code:
                        config_rate = rate_info['rate']
                        break
                    elif not depot_code:
                        config_rate = rate_info['rate']
                        break
        
        # 3. Fallback - partial match
        if config_rate is None:
            for rt, rate_info in fix_rates_map.items():
                if route.route_type.upper() in rt.upper() or rt.upper() in route.route_type.upper():
                    config_rate = rate_info['rate']
                    break
        
        calculated = route.count * route.rate
        total_routes_calculated += calculated
        
        status = 'ok'
        if config_rate is None:
            status = 'missing'
            missing_rates.append(f"FIX: {route.route_type}")
        elif abs(float(route.rate) - config_rate) > 1:
            status = 'warning'
        
        route_details.append({
            'routeType': route.route_type,
            'routeCategory': route_category,
            'depotCode': depot_code,
            'count': route.count,
            'proofRate': float(route.rate),
            'configRate': config_rate,
            'amount': float(route.amount),
            'calculatedAmount': float(calculated),
            'difference': float(route.amount - calculated) if route.amount else 0,
            'status': status
        })
    
    # === ANALÝZA DEPO DETAILS ===
    depo_details = []
    total_depo_calculated = Decimal('0')
    
    for depo in proof.depo_details:
        config_key = f"{depo.depo_name}_{depo.rate_type}"
        config_info = depo_rates_map.get(config_key)
        config_rate = config_info['rate'] if config_info else None
        
        calculated = (depo.days or 1) * depo.rate
        total_depo_calculated += calculated
        
        status = 'ok' if config_rate else 'missing'
        if not config_rate:
            missing_rates.append(f"DEPO: {depo.depo_name} ({depo.rate_type})")
        
        depo_details.append({
            'depoName': depo.depo_name,
            'rateType': depo.rate_type,
            'days': depo.days,
            'proofRate': float(depo.rate),
            'configRate': config_rate,
            'amount': float(depo.amount),
            'calculatedAmount': float(calculated),
            'depotCode': config_info.get('depot_code') if config_info else None,
            'status': status
        })
    
    # === ANALÝZA LINEHAUL DETAILS ===
    linehaul_details = []
    total_linehaul_calculated = Decimal('0')
    
    for lh in proof.linehaul_details:
        key = f"{lh.from_code or ''}_{lh.to_code or ''}_{lh.vehicle_type or ''}"
        config_rate = linehaul_rates_map.get(key)
        
        calculated = lh.total or (lh.rate * (lh.days or 1) * (lh.per_day or 1))
        total_linehaul_calculated += calculated
        
        if not config_rate:
            missing_rates.append(f"LH: {lh.from_code} → {lh.to_code} ({lh.vehicle_type})")
        
        linehaul_details.append({
            'description': lh.description,
            'fromCode': lh.from_code,
            'toCode': lh.to_code,
            'vehicleType': lh.vehicle_type,
            'days': lh.days,
            'perDay': lh.per_day,
            'rate': float(lh.rate),
            'total': float(lh.total),
            'calculatedTotal': float(calculated),
            'configRate': config_rate,
            'status': 'ok' if config_rate else 'missing'
        })
    
    # === SOUHRN ===
    summary = {
        'fix': {
            'proof': float(proof.total_fix or 0),
            'calculated': float(total_routes_calculated),
            'difference': float((proof.total_fix or 0) - total_routes_calculated)
        },
        'km': {
            'proof': float(proof.total_km or 0),
            'rate': km_rate_config,
        },
        'depo': {
            'proof': float(proof.total_depo or 0),
            'calculated': float(total_depo_calculated),
            'difference': float((proof.total_depo or 0) - total_depo_calculated)
        },
        'linehaul': {
            'proof': float(proof.total_linehaul or 0),
            'calculated': float(total_linehaul_calculated),
            'difference': float((proof.total_linehaul or 0) - total_linehaul_calculated)
        },
        'grandTotal': float(proof.grand_total or 0),
    }
    
    # === INVOICE STATUS ===
    invoice_status = []
    invoiced_totals = {'fix': 0, 'km': 0, 'linehaul': 0, 'depo': 0}
    
    for inv in proof.invoices:
        for item in inv.items:
            item_type_lower = (item.item_type or '').lower()
            for cat in ['fix', 'km', 'linehaul', 'depo']:
                if cat in item_type_lower:
                    invoiced_totals[cat] += float(item.amount or 0)
                    break
    
    for category, label in [('fix', 'FIX'), ('km', 'KM'), ('linehaul', 'Linehaul'), ('depo', 'DEPO')]:
        proof_amount = float(getattr(proof, f'total_{category}', 0) or 0)
        invoiced = invoiced_totals[category]
        
        invoice_status.append({
            'category': category,
            'label': label,
            'proofAmount': proof_amount,
            'invoicedAmount': invoiced,
            'remaining': proof_amount - invoiced,
            'status': 'ok' if abs(proof_amount - invoiced) < 100 else ('missing' if invoiced == 0 else 'partial')
        })
    
    # === CHECKS ===
    checks = []
    
    # Check 1: FIX matches
    fix_diff = abs(summary['fix']['difference'])
    checks.append({
        'name': 'FIX výpočet',
        'description': 'Součet FIX položek odpovídá celkovému FIX',
        'status': 'ok' if fix_diff < 100 else 'warning',
        'expected': summary['fix']['calculated'],
        'actual': summary['fix']['proof'],
        'difference': fix_diff
    })
    
    # Check 2: DEPO matches
    depo_diff = abs(summary['depo']['difference'])
    checks.append({
        'name': 'DEPO výpočet',
        'description': 'Součet DEPO položek odpovídá celkovému DEPO',
        'status': 'ok' if depo_diff < 100 else 'warning',
        'expected': summary['depo']['calculated'],
        'actual': summary['depo']['proof'],
        'difference': depo_diff
    })
    
    # Check 3: Has price config
    checks.append({
        'name': 'Ceník',
        'description': 'Existuje aktivní ceník pro toto období',
        'status': 'ok' if price_config else 'warning',
        'message': 'Ceník nalezen' if price_config else 'Chybí aktivní ceník'
    })
    
    # Check 4: Missing rates
    checks.append({
        'name': 'Chybějící sazby',
        'description': 'Všechny položky mají odpovídající sazbu v ceníku',
        'status': 'ok' if not missing_rates else 'warning',
        'message': 'Kompletní' if not missing_rates else f"Chybí: {len(missing_rates)} sazeb",
        'missingRates': missing_rates[:10]  # Max 10
    })
    
    # Check 5: All invoiced
    missing_invoices = [s['label'] for s in invoice_status if s['status'] == 'missing' and s['proofAmount'] > 0]
    checks.append({
        'name': 'Fakturace',
        'description': 'Všechny typy jsou vyfakturovány',
        'status': 'ok' if not missing_invoices else 'warning',
        'message': 'Kompletní' if not missing_invoices else f"Chybí: {', '.join(missing_invoices)}"
    })
    
    # Overall status
    has_error = any(c['status'] == 'error' for c in checks)
    has_warning = any(c['status'] == 'warning' for c in checks)
    overall_status = 'error' if has_error else 'warning' if has_warning else 'ok'
    
    return {
        'proofId': proof.id,
        'carrierId': proof.carrier_id,
        'carrierName': proof.carrier.name if proof.carrier else None,
        'period': proof.period,
        'periodDate': proof.period_date.isoformat() if proof.period_date else None,
        'fileName': proof.file_name,
        'status': overall_status,
        'summary': summary,
        'routeDetails': route_details,
        'depoDetails': depo_details,
        'linehaulDetails': linehaul_details,
        'invoiceStatus': invoice_status,
        'checks': checks,
        'missingRates': missing_rates,
        'hasPriceConfig': price_config is not None,
    }


@router.get("/summary")
async def get_analysis_summary(
    carrier_id: Optional[int] = Query(None),
    period: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """Get summary of all proofs analysis"""
    query = select(Proof).options(
        selectinload(Proof.carrier),
        selectinload(Proof.invoices),
    )
    
    filters = []
    if carrier_id:
        filters.append(Proof.carrier_id == carrier_id)
    if period:
        filters.append(Proof.period == period)
    
    if filters:
        query = query.where(and_(*filters))
    
    query = query.order_by(Proof.period_date.desc())
    
    result = await db.execute(query)
    proofs = result.scalars().all()
    
    summary = []
    for proof in proofs:
        invoiced_total = sum(
            float(item.amount or 0) 
            for inv in proof.invoices 
            for item in inv.items
        )
        
        proof_total = float(proof.grand_total or 0)
        diff = proof_total - invoiced_total
        
        status = 'ok'
        if abs(diff) > 1000:
            status = 'warning' if invoiced_total > 0 else 'missing'
        
        summary.append({
            'proofId': proof.id,
            'carrierId': proof.carrier_id,
            'carrierName': proof.carrier.name if proof.carrier else None,
            'period': proof.period,
            'proofTotal': proof_total,
            'invoicedTotal': invoiced_total,
            'difference': diff,
            'status': status,
        })
    
    return summary
