"""
Proofs API Router - with XLSX upload and parsing
"""
from typing import List, Optional
from datetime import datetime
from decimal import Decimal
from io import BytesIO
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
import openpyxl

from app.database import get_db
from app.models import (
    Proof, Carrier, ProofRouteDetail, ProofLinehaulDetail, ProofDepoDetail
)
from app.schemas import ProofResponse, ProofDetailResponse, ProofUpdate

router = APIRouter()


def parse_proof_from_xlsx(file_content: bytes) -> dict:
    """Parse proof data from XLSX Sumar sheet"""
    wb = openpyxl.load_workbook(BytesIO(file_content), data_only=True)
    
    if 'Sumar' not in wb.sheetnames:
        raise ValueError('Sheet "Sumar" not found in XLSX')
    
    sheet = wb['Sumar']
    
    result = {
        'totals': {
            'total_fix': None,
            'total_km': None,
            'total_linehaul': None,
            'total_depo': None,
            'total_penalty': None,
            'grand_total': None,
        },
        'route_details': [],
        'linehaul_details': [],
        'depo_details': [],
    }
    
    def find_row_by_label(label: str) -> Optional[int]:
        for row in range(1, sheet.max_row + 1):
            cell_value = sheet.cell(row=row, column=2).value
            if cell_value and label in str(cell_value):
                return row
        return None
    
    def get_value_by_label(label: str) -> Optional[float]:
        row = find_row_by_label(label)
        if row is None:
            return None
        value = sheet.cell(row=row, column=4).value
        if value is not None:
            try:
                return float(value)
            except (ValueError, TypeError):
                return None
        return None
    
    result['totals']['total_fix'] = get_value_by_label('Cena FIX')
    result['totals']['total_km'] = get_value_by_label('Cena KM')
    result['totals']['total_linehaul'] = get_value_by_label('Linehaul')
    result['totals']['total_depo'] = get_value_by_label('DEPO')
    result['totals']['total_penalty'] = get_value_by_label('Pokuty')
    result['totals']['grand_total'] = get_value_by_label('Celková částka')
    
    route_types = [
        {'label': 'Počet tras LastMile při DR', 'type': 'DR', 'rate_label': 'Cena DR'},
        {'label': 'Počet tras LastMile při DPO LH', 'type': 'LH_DPO', 'rate_label': 'Cena LastMile při LH DPO'},
        {'label': 'Počet tras SD LH', 'type': 'LH_SD', 'rate_label': 'Cena LastMile při LH SD'},
        {'label': 'Počet tras SD LH spojene', 'type': 'LH_SD_SPOJENE', 'rate_label': 'Cena LastMile při LH SD spojené'},
    ]
    
    for rt in route_types:
        count = get_value_by_label(rt['label'])
        rate = get_value_by_label(rt['rate_label'])
        if count and count > 0:
            rate_val = rate or 0
            result['route_details'].append({
                'route_type': rt['type'],
                'count': int(count),
                'rate': Decimal(str(rate_val)),
                'amount': Decimal(str(int(count) * float(rate_val)))
            })
    
    depo_vratimov = get_value_by_label('DEPO Vratimov / Den')
    depo_nb_mesiac = get_value_by_label('DEPO Nový Bydžov / Mesiac')
    skladnici_nb = get_value_by_label('3 Skladníci Nový Bydžov / Mesiac')
    days_worked = get_value_by_label('Odježděných dní')
    
    if depo_vratimov and days_worked:
        result['depo_details'].append({
            'depo_name': 'Vratimov',
            'rate_type': 'daily',
            'days': int(days_worked),
            'rate': Decimal(str(depo_vratimov)),
            'amount': Decimal(str(int(days_worked) * float(depo_vratimov)))
        })
    
    if depo_nb_mesiac:
        result['depo_details'].append({
            'depo_name': 'Nový Bydžov',
            'rate_type': 'monthly',
            'days': 1,
            'rate': Decimal(str(depo_nb_mesiac)),
            'amount': Decimal(str(depo_nb_mesiac))
        })
    
    if skladnici_nb:
        result['depo_details'].append({
            'depo_name': 'Nový Bydžov - Skladníci',
            'rate_type': 'monthly',
            'days': 1,
            'rate': Decimal(str(skladnici_nb)),
            'amount': Decimal(str(skladnici_nb))
        })
    
    return result


async def get_proof_by_id(proof_id: int, db: AsyncSession):
    """Helper to get proof with all details"""
    result = await db.execute(
        select(Proof)
        .options(
            selectinload(Proof.carrier),
            selectinload(Proof.depot),
            selectinload(Proof.route_details),
            selectinload(Proof.linehaul_details),
            selectinload(Proof.depo_details),
            selectinload(Proof.invoices),
            selectinload(Proof.analyses),
        )
        .where(Proof.id == proof_id)
    )
    return result.scalar_one_or_none()


@router.get("", response_model=List[ProofResponse])
async def get_proofs(
    carrier_id: Optional[int] = Query(None),
    period: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """Get all proofs with filters"""
    query = select(Proof).options(
        selectinload(Proof.carrier),
        selectinload(Proof.depot)
    )
    
    filters = []
    if carrier_id:
        filters.append(Proof.carrier_id == carrier_id)
    if period:
        filters.append(Proof.period == period)
    if status:
        filters.append(Proof.status == status)
    
    if filters:
        query = query.where(and_(*filters))
    
    query = query.order_by(Proof.period_date.desc())
    
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/upload", response_model=ProofDetailResponse, status_code=201)
async def upload_proof(
    file: UploadFile = File(...),
    carrier_id: int = Form(...),
    period: str = Form(...),
    db: AsyncSession = Depends(get_db)
):
    """Upload and parse proof XLSX"""
    carrier_result = await db.execute(
        select(Carrier).where(Carrier.id == carrier_id)
    )
    if not carrier_result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Carrier not found")
    
    content = await file.read()
    
    try:
        proof_data = parse_proof_from_xlsx(content)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse XLSX: {str(e)}")
    
    try:
        month, year = period.split('/')
        period_date = datetime(int(year), int(month), 1)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid period format. Use MM/YYYY")
    
    existing_result = await db.execute(
        select(Proof).where(
            and_(Proof.carrier_id == carrier_id, Proof.period == period)
        )
    )
    existing = existing_result.scalar_one_or_none()
    
    if existing:
        await db.execute(
            ProofRouteDetail.__table__.delete().where(ProofRouteDetail.proof_id == existing.id)
        )
        await db.execute(
            ProofLinehaulDetail.__table__.delete().where(ProofLinehaulDetail.proof_id == existing.id)
        )
        await db.execute(
            ProofDepoDetail.__table__.delete().where(ProofDepoDetail.proof_id == existing.id)
        )
        
        for field, value in proof_data['totals'].items():
            if value is not None:
                setattr(existing, field, Decimal(str(value)))
        
        existing.file_name = file.filename
        
        for detail in proof_data['route_details']:
            db.add(ProofRouteDetail(proof_id=existing.id, **detail))
        for detail in proof_data['linehaul_details']:
            db.add(ProofLinehaulDetail(proof_id=existing.id, **detail))
        for detail in proof_data['depo_details']:
            db.add(ProofDepoDetail(proof_id=existing.id, **detail))
        
        await db.commit()
        return await get_proof_by_id(existing.id, db)
    
    proof = Proof(
        carrier_id=carrier_id,
        period=period,
        period_date=period_date,
        file_name=file.filename,
        total_fix=Decimal(str(proof_data['totals']['total_fix'])) if proof_data['totals']['total_fix'] else None,
        total_km=Decimal(str(proof_data['totals']['total_km'])) if proof_data['totals']['total_km'] else None,
        total_linehaul=Decimal(str(proof_data['totals']['total_linehaul'])) if proof_data['totals']['total_linehaul'] else None,
        total_depo=Decimal(str(proof_data['totals']['total_depo'])) if proof_data['totals']['total_depo'] else None,
        total_penalty=Decimal(str(proof_data['totals']['total_penalty'])) if proof_data['totals']['total_penalty'] else None,
        grand_total=Decimal(str(proof_data['totals']['grand_total'])) if proof_data['totals']['grand_total'] else None,
    )
    db.add(proof)
    await db.flush()
    
    for detail in proof_data['route_details']:
        db.add(ProofRouteDetail(proof_id=proof.id, **detail))
    for detail in proof_data['linehaul_details']:
        db.add(ProofLinehaulDetail(proof_id=proof.id, **detail))
    for detail in proof_data['depo_details']:
        db.add(ProofDepoDetail(proof_id=proof.id, **detail))
    
    await db.commit()
    return await get_proof_by_id(proof.id, db)


@router.get("/{proof_id}", response_model=ProofDetailResponse)
async def get_proof(proof_id: int, db: AsyncSession = Depends(get_db)):
    """Get single proof by ID with all details"""
    proof = await get_proof_by_id(proof_id, db)
    if not proof:
        raise HTTPException(status_code=404, detail="Proof not found")
    return proof


@router.put("/{proof_id}", response_model=ProofResponse)
async def update_proof(
    proof_id: int,
    proof_data: ProofUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update proof status"""
    result = await db.execute(select(Proof).where(Proof.id == proof_id))
    proof = result.scalar_one_or_none()
    
    if not proof:
        raise HTTPException(status_code=404, detail="Proof not found")
    
    if proof_data.status:
        proof.status = proof_data.status
    
    await db.commit()
    await db.refresh(proof)
    return proof


@router.delete("/{proof_id}", status_code=204)
async def delete_proof(proof_id: int, db: AsyncSession = Depends(get_db)):
    """Delete proof"""
    result = await db.execute(select(Proof).where(Proof.id == proof_id))
    proof = result.scalar_one_or_none()
    
    if not proof:
        raise HTTPException(status_code=404, detail="Proof not found")
    
    await db.delete(proof)
    await db.commit()
