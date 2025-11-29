"""
Contracts API Router - with PDF upload and parsing
"""
from typing import List, Optional
from datetime import datetime
from decimal import Decimal
from io import BytesIO
import re
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
import pdfplumber

from app.database import get_db
from app.models import Contract, Carrier, PriceConfig, FixRate, KmRate, DepoRate
from app.schemas import ContractCreate, ContractUpdate, ContractResponse

router = APIRouter()


def extract_carrier_info(text: str) -> dict:
    """Extract carrier info from PDF text"""
    carrier = {
        'name': None, 'ico': None, 'dic': None, 'address': None, 'bank_account': None
    }
    
    ico_matches = re.findall(r'IČO?[:\s]*(\d{8})', text, re.IGNORECASE)
    for ico in ico_matches:
        if ico != '27082440':
            carrier['ico'] = ico
            break
    
    dic_matches = re.findall(r'DIČ[:\s]*(CZ\d{8,10})', text, re.IGNORECASE)
    for dic in dic_matches:
        if dic.upper() != 'CZ27082440':
            carrier['dic'] = dic.upper()
            break
    
    if carrier['ico']:
        name_pattern = re.search(
            rf'([A-Za-zÀ-ž][A-Za-zÀ-ž\s]+(?:s\.r\.o\.|a\.s\.))\s*(?:se\s+sídlem|IČO?[:\s]*{carrier["ico"]})',
            text, re.IGNORECASE
        )
        if name_pattern:
            carrier['name'] = name_pattern.group(1).strip()
            carrier['name'] = re.sub(r'^a\s+', '', carrier['name'], flags=re.IGNORECASE)
    
    if not carrier['name']:
        alt_match = re.search(
            r'(?:Za\s+)?([A-Za-zÀ-ž][A-Za-zÀ-ž\s]+(?:s\.r\.o\.|a\.s\.))\s*\n.*jednatel',
            text, re.IGNORECASE
        )
        if alt_match and 'alza' not in alt_match.group(1).lower():
            carrier['name'] = alt_match.group(1).strip()
    
    address_matches = re.findall(r'se\s+sídlem[:\s]*([^\n]+)', text, re.IGNORECASE)
    for addr in address_matches:
        if 'jankovcova' not in addr.lower():
            carrier['address'] = addr.strip()
            break
    
    bank_match = re.search(r'č\.\s*bankovního\s*účtu[:\s]*(\d+/\d+)', text, re.IGNORECASE)
    if bank_match:
        carrier['bank_account'] = bank_match.group(1)
    
    return carrier


def extract_contract_info(text: str) -> dict:
    """Extract contract info from PDF text"""
    contract = {'number': None, 'type': None, 'valid_from': None, 'service_type': None}
    
    dodatek_match = re.search(r'Dodatek\s*č\.\s*(\d+)', text, re.IGNORECASE)
    if dodatek_match:
        contract['number'] = f"Dodatek č. {dodatek_match.group(1)}"
    
    date_match = re.search(
        r'(?:účinnosti\s*dnem|platn[ýé]\s*od)[:\s]*(\d{1,2})\.(\d{1,2})\.(\d{4})',
        text, re.IGNORECASE
    )
    if date_match:
        day, month, year = date_match.groups()
        contract['valid_from'] = datetime(int(year), int(month), int(day))
    
    if 'DROP 2.0' in text:
        contract['service_type'] = 'DROP 2.0'
        contract['type'] = 'DROP'
    elif 'AlzaBox' in text:
        contract['service_type'] = 'AlzaBox'
        contract['type'] = 'AlzaBox'
    
    return contract


def extract_price_rates(text: str) -> dict:
    """Extract price rates from PDF text"""
    rates = {'fix_rates': [], 'km_rates': [], 'depo_rates': []}
    
    route_patterns = [
        (r'^A\s+(\d[\d\s]*)[,-]', 'DROP_A'),
        (r'^B\s+(\d[\d\s]*)[,-]', 'DROP_B'),
        (r'^C\s+(\d[\d\s]*)[,-]', 'DROP_C'),
        (r'Dopoledne\s+(\d[\d\s]*)[,-]', 'DROP_Dopoledne'),
    ]
    
    for pattern, route_type in route_patterns:
        match = re.search(pattern, text, re.MULTILINE | re.IGNORECASE)
        if match:
            rate_str = match.group(1).replace(' ', '')
            try:
                rate = int(rate_str)
                if rate > 0:
                    rates['fix_rates'].append({'route_type': route_type, 'rate': rate})
            except ValueError:
                pass
    
    km_match = re.search(r'(\d+[,.]?\d*)\s*Kč\s*/\s*km', text, re.IGNORECASE)
    if km_match:
        try:
            rate = float(km_match.group(1).replace(',', '.'))
            rates['km_rates'].append({'route_type': 'standard', 'rate': rate})
        except ValueError:
            pass
    
    return rates


# ==== STATIC ROUTES FIRST ====

@router.get("", response_model=List[ContractResponse])
async def get_contracts(
    carrier_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """Get all contracts, optionally filtered by carrier"""
    query = select(Contract).options(selectinload(Contract.carrier))
    
    if carrier_id:
        query = query.where(Contract.carrier_id == carrier_id)
    
    query = query.order_by(Contract.valid_from.desc())
    
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=ContractResponse, status_code=201)
async def create_contract(
    contract_data: ContractCreate, 
    db: AsyncSession = Depends(get_db)
):
    """Create new contract"""
    carrier_result = await db.execute(
        select(Carrier).where(Carrier.id == contract_data.carrier_id)
    )
    if not carrier_result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Carrier not found")
    
    contract = Contract(**contract_data.model_dump())
    db.add(contract)
    await db.commit()
    await db.refresh(contract)
    return contract


@router.post("/upload-pdf")
async def upload_contract_pdf(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    """Upload and parse contract PDF"""
    content = await file.read()
    
    try:
        with pdfplumber.open(BytesIO(content)) as pdf:
            text = ""
            for page in pdf.pages:
                text += page.extract_text() or ""
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Chyba při čtení PDF: {str(e)}")
    
    carrier_info = extract_carrier_info(text)
    contract_info = extract_contract_info(text)
    price_rates = extract_price_rates(text)
    
    if not carrier_info['ico']:
        raise HTTPException(
            status_code=400,
            detail="Nepodařilo se extrahovat IČO dopravce z dokumentu"
        )
    
    carrier_result = await db.execute(
        select(Carrier).where(Carrier.ico == carrier_info['ico'])
    )
    carrier = carrier_result.scalar_one_or_none()
    is_new_carrier = carrier is None
    
    if not carrier:
        carrier = Carrier(
            name=carrier_info['name'] or f"Dopravce {carrier_info['ico']}",
            ico=carrier_info['ico'],
            dic=carrier_info['dic'],
            address=carrier_info['address'],
            contact=carrier_info['bank_account']
        )
        db.add(carrier)
        await db.flush()
    
    contract = Contract(
        carrier_id=carrier.id,
        number=contract_info['number'] or 'Neznámý dodatek',
        type=contract_info['service_type'],
        valid_from=contract_info['valid_from'] or datetime.now(),
        document_url=file.filename,
        notes=f"Automaticky extrahováno z PDF. Typ služby: {contract_info['service_type'] or 'neznámý'}"
    )
    db.add(contract)
    await db.flush()
    
    price_config = None
    has_rates = (
        len(price_rates['fix_rates']) > 0 or
        len(price_rates['km_rates']) > 0 or
        len(price_rates['depo_rates']) > 0
    )
    
    if has_rates:
        price_config = PriceConfig(
            carrier_id=carrier.id,
            contract_id=contract.id,
            type=contract_info['service_type'] or 'general',
            valid_from=contract_info['valid_from'] or datetime.now(),
            is_active=True
        )
        db.add(price_config)
        await db.flush()
        
        for rate in price_rates['fix_rates']:
            db.add(FixRate(
                price_config_id=price_config.id,
                route_type=rate['route_type'],
                rate=Decimal(str(rate['rate']))
            ))
        
        for rate in price_rates['km_rates']:
            db.add(KmRate(
                price_config_id=price_config.id,
                route_type=rate['route_type'],
                rate=Decimal(str(rate['rate']))
            ))
        
        for rate in price_rates['depo_rates']:
            db.add(DepoRate(
                price_config_id=price_config.id,
                depo_name=rate['depo_name'],
                rate_type=rate['rate_type'],
                rate=Decimal(str(rate['rate']))
            ))
    
    await db.commit()
    
    return {
        'success': True,
        'message': 'Smlouva úspěšně zpracována',
        'data': {
            'carrier': {
                'id': carrier.id,
                'name': carrier.name,
                'ico': carrier.ico,
                'isNew': is_new_carrier
            },
            'contract': {
                'id': contract.id,
                'number': contract.number,
                'type': contract.type,
                'validFrom': contract.valid_from.isoformat() if contract.valid_from else None
            },
            'priceConfig': {
                'id': price_config.id,
                'type': price_config.type,
                'fixRatesCount': len(price_rates['fix_rates']),
                'kmRatesCount': len(price_rates['km_rates']),
                'depoRatesCount': len(price_rates['depo_rates'])
            } if price_config else None,
            'extractedRates': price_rates
        }
    }


@router.post("/parse-preview")
async def parse_preview(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    """Preview extraction without saving"""
    content = await file.read()
    
    try:
        with pdfplumber.open(BytesIO(content)) as pdf:
            text = ""
            for page in pdf.pages:
                text += page.extract_text() or ""
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Chyba při čtení PDF: {str(e)}")
    
    carrier_info = extract_carrier_info(text)
    contract_info = extract_contract_info(text)
    price_rates = extract_price_rates(text)
    
    existing_carrier = None
    if carrier_info['ico']:
        result = await db.execute(
            select(Carrier)
            .options(selectinload(Carrier.contracts))
            .where(Carrier.ico == carrier_info['ico'])
        )
        existing_carrier = result.scalar_one_or_none()
    
    return {
        'carrier': {
            'name': carrier_info['name'],
            'ico': carrier_info['ico'],
            'dic': carrier_info['dic'],
            'address': carrier_info['address'],
            'bankAccount': carrier_info['bank_account'],
            'existsInDb': existing_carrier is not None,
            'existingData': {
                'id': existing_carrier.id,
                'name': existing_carrier.name
            } if existing_carrier else None
        },
        'contract': {
            'number': contract_info['number'],
            'type': contract_info['type'],
            'serviceType': contract_info['service_type'],
            'validFrom': contract_info['valid_from'].isoformat() if contract_info['valid_from'] else None
        },
        'rates': {
            'fixRates': [{'routeType': r['route_type'], 'rate': r['rate']} for r in price_rates['fix_rates']],
            'kmRates': [{'routeType': r['route_type'], 'rate': r['rate']} for r in price_rates['km_rates']],
            'depoRates': [{'depoName': r['depo_name'], 'rateType': r['rate_type'], 'rate': r['rate']} for r in price_rates['depo_rates']]
        },
        'rawTextPreview': text[:2000]
    }


# ==== DYNAMIC ROUTES LAST ====

@router.get("/{contract_id}", response_model=ContractResponse)
async def get_contract(contract_id: int, db: AsyncSession = Depends(get_db)):
    """Get single contract by ID with price configs"""
    result = await db.execute(
        select(Contract)
        .options(
            selectinload(Contract.carrier),
            selectinload(Contract.prices)
        )
        .where(Contract.id == contract_id)
    )
    contract = result.scalar_one_or_none()
    
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    
    return contract


@router.put("/{contract_id}", response_model=ContractResponse)
async def update_contract(
    contract_id: int, 
    contract_data: ContractUpdate, 
    db: AsyncSession = Depends(get_db)
):
    """Update contract"""
    result = await db.execute(select(Contract).where(Contract.id == contract_id))
    contract = result.scalar_one_or_none()
    
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    
    update_data = contract_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(contract, field, value)
    
    await db.commit()
    await db.refresh(contract)
    return contract


@router.delete("/{contract_id}", status_code=204)
async def delete_contract(contract_id: int, db: AsyncSession = Depends(get_db)):
    """Delete contract"""
    result = await db.execute(select(Contract).where(Contract.id == contract_id))
    contract = result.scalar_one_or_none()
    
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    
    await db.delete(contract)
    await db.commit()
