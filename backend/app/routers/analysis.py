"""
Analysis API Router
"""
from typing import List, Optional
from decimal import Decimal
import json
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import (
    Proof, ProofAnalysis, PriceConfig, Invoice
)
from app.schemas import ProofAnalysisResponse, DashboardSummary

router = APIRouter()


def analyze_proof(proof: Proof, price_config: Optional[PriceConfig]) -> dict:
    """Analyze proof against price config"""
    errors = []
    warnings = []
    ok = []
    missing_rates = []
    
    result = {
        'status': 'ok',
        'errors': errors,
        'warnings': warnings,
        'ok': ok,
        'missing_rates': missing_rates,
        'fix': {'expected': Decimal('0'), 'actual': Decimal('0'), 'difference': Decimal('0')},
        'km': {'expected': Decimal('0'), 'actual': Decimal('0'), 'difference': Decimal('0')},
        'linehaul': {'expected': Decimal('0'), 'actual': Decimal('0'), 'difference': Decimal('0')},
        'depo': {'expected': Decimal('0'), 'actual': Decimal('0'), 'difference': Decimal('0')},
    }
    
    if not price_config:
        warnings.append('Žádný aktivní ceník pro toto období')
        result['status'] = 'warning'
        return result
    
    # Analyze FIX
    expected_fix = Decimal('0')
    fix_rates_map = {r.route_type: r.rate for r in price_config.fix_rates}
    
    for route in proof.route_details:
        config_rate = fix_rates_map.get(route.route_type)
        if config_rate:
            expected_fix += route.count * config_rate
        else:
            missing_rates.append({
                'type': 'fix',
                'route_type': route.route_type,
                'proof_rate': float(route.rate)
            })
            expected_fix += route.amount
    
    result['fix']['expected'] = expected_fix
    result['fix']['actual'] = proof.total_fix or Decimal('0')
    result['fix']['difference'] = result['fix']['actual'] - result['fix']['expected']
    
    if abs(result['fix']['difference']) > 100:
        warnings.append(f"Nevysvětlený rozdíl u FIX: {result['fix']['difference']:,.0f} Kč")
    else:
        ok.append('FIX: Hodnoty sedí')
    
    # Analyze KM
    km_rate = price_config.km_rates[0].rate if price_config.km_rates else Decimal('10.97')
    result['km']['actual'] = proof.total_km or Decimal('0')
    
    if abs(result['km']['actual']) > 100:
        ok.append('KM: Hodnoty kontrolovány')
    
    # Analyze Linehaul
    result['linehaul']['actual'] = proof.total_linehaul or Decimal('0')
    
    # Analyze Depo
    result['depo']['actual'] = proof.total_depo or Decimal('0')
    
    # Check invoices
    invoiced_types = set()
    for inv in proof.invoices:
        for item in inv.items:
            invoiced_types.add(item.item_type.lower())
    
    required_types = ['fix', 'km', 'linehaul', 'depo']
    for t in required_types:
        total_field = f'total_{t}'
        total_value = getattr(proof, total_field, None) or Decimal('0')
        if t not in invoiced_types and total_value > 0:
            warnings.append(f'Chybí faktura: {t.upper()}')
    
    # Set overall status
    if errors:
        result['status'] = 'error'
    elif warnings:
        result['status'] = 'warning'
    
    return result


@router.post("/proof/{proof_id}", response_model=ProofAnalysisResponse)
async def analyze_proof_endpoint(proof_id: int, db: AsyncSession = Depends(get_db)):
    """Analyze proof against price config"""
    # Get proof with all details
    result = await db.execute(
        select(Proof)
        .options(
            selectinload(Proof.carrier),
            selectinload(Proof.route_details),
            selectinload(Proof.linehaul_details),
            selectinload(Proof.depo_details),
            selectinload(Proof.invoices).selectinload(Invoice.items)
        )
        .where(Proof.id == proof_id)
    )
    proof = result.scalar_one_or_none()
    
    if not proof:
        raise HTTPException(status_code=404, detail="Proof not found")
    
    # Get active price config
    price_config_result = await db.execute(
        select(PriceConfig)
        .options(
            selectinload(PriceConfig.fix_rates),
            selectinload(PriceConfig.km_rates),
            selectinload(PriceConfig.depo_rates),
            selectinload(PriceConfig.linehaul_rates)
        )
        .where(
            and_(
                PriceConfig.carrier_id == proof.carrier_id,
                PriceConfig.is_active == True,
                PriceConfig.valid_from <= proof.period_date,
                or_(
                    PriceConfig.valid_to == None,
                    PriceConfig.valid_to >= proof.period_date
                )
            )
        )
        .order_by(PriceConfig.valid_from.desc())
        .limit(1)
    )
    price_config = price_config_result.scalar_one_or_none()
    
    # Perform analysis
    analysis_result = analyze_proof(proof, price_config)
    
    # Save analysis
    analysis = ProofAnalysis(
        proof_id=proof_id,
        status=analysis_result['status'],
        errors_json=json.dumps(analysis_result['errors']),
        warnings_json=json.dumps(analysis_result['warnings']),
        ok_json=json.dumps(analysis_result['ok']),
        diff_fix=analysis_result['fix']['difference'],
        diff_km=analysis_result['km']['difference'],
        diff_linehaul=analysis_result['linehaul']['difference'],
        diff_depo=analysis_result['depo']['difference'],
        missing_rates_json=json.dumps(analysis_result['missing_rates'])
    )
    db.add(analysis)
    await db.commit()
    await db.refresh(analysis)
    
    return analysis


@router.get("/proof/{proof_id}", response_model=ProofAnalysisResponse)
async def get_proof_analysis(proof_id: int, db: AsyncSession = Depends(get_db)):
    """Get latest analysis for proof"""
    result = await db.execute(
        select(ProofAnalysis)
        .where(ProofAnalysis.proof_id == proof_id)
        .order_by(ProofAnalysis.created_at.desc())
        .limit(1)
    )
    analysis = result.scalar_one_or_none()
    
    if not analysis:
        raise HTTPException(status_code=404, detail="No analysis found for this proof")
    
    return analysis


@router.get("/dashboard", response_model=List[DashboardSummary])
async def get_dashboard(
    carrier_id: Optional[int] = Query(None),
    period: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """Get dashboard summary for period"""
    query = select(Proof).options(
        selectinload(Proof.carrier),
        selectinload(Proof.invoices),
        selectinload(Proof.analyses)
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
            float(inv.total_without_vat or 0) for inv in proof.invoices
        )
        proof_total = float(proof.grand_total or 0)
        
        # Get latest analysis
        latest_analysis = None
        if proof.analyses:
            latest_analysis = sorted(proof.analyses, key=lambda a: a.created_at, reverse=True)[0]
        
        errors_count = 0
        warnings_count = 0
        if latest_analysis:
            try:
                errors_count = len(json.loads(latest_analysis.errors_json or '[]'))
                warnings_count = len(json.loads(latest_analysis.warnings_json or '[]'))
            except:
                pass
        
        summary.append(DashboardSummary(
            id=proof.id,
            carrier=proof.carrier.name,
            period=proof.period,
            proof_total=Decimal(str(proof_total)),
            invoiced_total=Decimal(str(invoiced_total)),
            invoice_count=len(proof.invoices),
            remaining_to_invoice=Decimal(str(proof_total - invoiced_total)),
            status=latest_analysis.status if latest_analysis else 'pending',
            errors=errors_count,
            warnings=warnings_count
        ))
    
    return summary
