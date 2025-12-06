"""
Contracts API Router - with PDF upload and parsing
Updated: 2025-12-05 - Added depot_id, route_category, from_warehouse_id support
"""
from typing import List, Optional
from datetime import datetime
from decimal import Decimal
from io import BytesIO
import re
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy import select, and_, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
import pdfplumber

from app.database import get_db
from app.models import (
    Contract, Carrier, PriceConfig, FixRate, KmRate, DepoRate, LinehaulRate, BonusRate,
    Depot, Warehouse  # NEW
)
from app.schemas import ContractCreate, ContractUpdate, ContractResponse

router = APIRouter()


# =============================================================================
# KONFIGURACE - MAPOVÁNÍ (NOVÉ)
# =============================================================================

ROUTE_TYPE_TO_CATEGORY = {
    'DIRECT_Praha': 'DIRECT_SKLAD',
    'DIRECT_Vratimov': 'DIRECT_DEPO',
    'DIRECT_NovyBydzov': 'DIRECT_DEPO',
    'DIRECT_Brno': 'DIRECT_DEPO',
    'DIRECT_CeskeBudejovice': 'DIRECT_DEPO',
    'DIRECT_Rakovnik': 'DIRECT_DEPO',
}

ROUTE_TYPE_TO_DEPOT_CODE = {
    'DIRECT_Vratimov': 'VRATIMOV',
    'DIRECT_NovyBydzov': 'NOVY_BYDZOV',
    'DIRECT_Brno': 'BRNO',
    'DIRECT_CeskeBudejovice': 'CESKE_BUDEJOVICE',
    'DIRECT_Rakovnik': 'RAKOVNIK',
}

LINEHAUL_TO_DEPOT_CODE = {
    'Vratimov': 'VRATIMOV',
    'Nový Bydžov': 'NOVY_BYDZOV',
    'NovyBydzov': 'NOVY_BYDZOV',
    'Brno': 'BRNO',
    'České Budějovice': 'CESKE_BUDEJOVICE',
    'CeskeBudejovice': 'CESKE_BUDEJOVICE',
    'Rakovník': 'RAKOVNIK',
    'Rakovnik': 'RAKOVNIK',
}

WAREHOUSE_CODES = {
    'CZLC4': 'CZLC4',
    'CZTC1': 'CZTC1',
    'LCU': 'LCU',
    'LCZ': 'LCZ',
    'Chrášťany': 'CZLC4',
    'Chrastany': 'CZLC4',
    'Třídírna': 'CZTC1',
    'Tridirna': 'CZTC1',
    'Zdiby': 'CZTC1',
    'Úžice': 'LCU',
    'Uzice': 'LCU',
}

VEHICLE_TYPE_NORMALIZE = {
    'dodavka': 'DODAVKA',
    'dodávka': 'DODAVKA',
    'plachta': 'DODAVKA',
    'solo': 'SOLO',
    'sólo': 'SOLO',
    'kamion': 'KAMION',
    'lkw': 'KAMION',
    'návěs': 'KAMION',
    'naves': 'KAMION',
}

VEHICLE_PALLET_CAPACITY = {
    'DODAVKA': (8, 10),
    'SOLO': (15, 21),
    'KAMION': (33, 33),
}


# =============================================================================
# HELPER FUNKCE
# =============================================================================

def normalize_name(name: str) -> str:
    """Normalizuje název pro porovnání"""
    if not name:
        return ""
    name = name.lower().strip()
    for suffix in ['s.r.o.', 'sro', 'a.s.', 'as', 'spol.', 'spol', 'k.s.', 'v.o.s.']:
        name = name.replace(suffix, '')
    name = re.sub(r'[^a-z0-9áčďéěíňóřšťúůýž]', '', name)
    return name


def parse_czech_number(s: str) -> Optional[float]:
    """Parse Czech number format (3 688 000,00 -> 3688000.00)"""
    if not s:
        return None
    cleaned = re.sub(r'[\s\u00A0]', '', str(s)).replace(',', '.')
    try:
        return float(cleaned)
    except:
        return None


def detect_route_category(route_type: str) -> Optional[str]:
    """Detekuje kategorii trasy z route_type"""
    if not route_type:
        return None
    
    # Přímá shoda
    if route_type in ROUTE_TYPE_TO_CATEGORY:
        return ROUTE_TYPE_TO_CATEGORY[route_type]
    
    # Heuristika
    route_upper = route_type.upper()
    if 'PRAHA' in route_upper or 'STČ' in route_upper or 'STREDNI' in route_upper:
        return 'DIRECT_SKLAD'
    elif any(depot in route_upper for depot in ['VRATIMOV', 'BYDZOV', 'BRNO', 'BUDEJOVIC', 'RAKOVNIK']):
        return 'DIRECT_DEPO'
    
    return None


def detect_depot_code_from_route_type(route_type: str) -> Optional[str]:
    """Detekuje kód depa z route_type"""
    if not route_type:
        return None
    
    # Přímá shoda
    if route_type in ROUTE_TYPE_TO_DEPOT_CODE:
        return ROUTE_TYPE_TO_DEPOT_CODE[route_type]
    
    # Heuristika
    route_upper = route_type.upper()
    if 'VRATIMOV' in route_upper:
        return 'VRATIMOV'
    elif 'BYDZOV' in route_upper or 'BYDŽOV' in route_upper:
        return 'NOVY_BYDZOV'
    elif 'BRNO' in route_upper:
        return 'BRNO'
    elif 'BUDEJOVIC' in route_upper or 'BUDĚJOVIC' in route_upper:
        return 'CESKE_BUDEJOVICE'
    elif 'RAKOVNIK' in route_upper or 'RAKOVNÍK' in route_upper:
        return 'RAKOVNIK'
    
    return None


def detect_warehouse_code(text: str) -> Optional[str]:
    """Detekuje kód skladu z textu"""
    if not text:
        return None
    
    text_upper = text.upper()
    for key, code in WAREHOUSE_CODES.items():
        if key.upper() in text_upper:
            return code
    
    return None


def normalize_vehicle_type(vehicle_type: str) -> str:
    """Normalizuje typ vozidla"""
    if not vehicle_type:
        return 'DODAVKA'
    
    vt_lower = vehicle_type.lower().strip()
    return VEHICLE_TYPE_NORMALIZE.get(vt_lower, vehicle_type.upper())


def get_pallet_capacity(vehicle_type: str) -> tuple:
    """Vrací kapacitu palet pro typ vozidla"""
    vt_normalized = normalize_vehicle_type(vehicle_type)
    return VEHICLE_PALLET_CAPACITY.get(vt_normalized, (None, None))


# =============================================================================
# PDF EXTRACTION FUNKCE
# =============================================================================

def extract_carrier_info(text: str) -> dict:
    """Extract carrier info from PDF text"""
    carrier = {
        'name': None, 'ico': None, 'dic': None, 'address': None, 'bank_account': None
    }
    
    # Najdi IČO (ignoruj Alza IČO 27082440)
    ico_matches = re.findall(r'IČO?[:\s]*(\d{8})', text, re.IGNORECASE)
    for ico in ico_matches:
        if ico != '27082440':
            carrier['ico'] = ico
            break
    
    # Najdi DIČ
    dic_matches = re.findall(r'DIČ[:\s]*(CZ\d{8,10})', text, re.IGNORECASE)
    for dic in dic_matches:
        if dic.upper() != 'CZ27082440':
            carrier['dic'] = dic.upper()
            break
    
    # Najdi název dopravce
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
            r'(?:Za\s+)?([A-Za-zÀ-ž][A-Za-zÀ-ž\s]+(?:s\.r\.o\.|a\.s\.))\s*\n',
            text, re.IGNORECASE
        )
        if alt_match:
            carrier['name'] = alt_match.group(1).strip()
    
    return carrier


def extract_contract_info(text: str, filename: str = None) -> dict:
    """Extract contract info from PDF text"""
    contract = {
        'number': None,
        'type': 'Dodatek',
        'valid_from': None,
        'service_type': None
    }
    
    # Číslo dodatku
    dodatek_match = re.search(r'dodatek\s*(?:č\.|číslo)?\s*(\d+)', text, re.IGNORECASE)
    if dodatek_match:
        contract['number'] = f"Dodatek č. {dodatek_match.group(1)}"
    elif filename:
        num_match = re.search(r'(\d+)', filename)
        if num_match:
            contract['number'] = f"Dodatek č. {num_match.group(1)}"
    
    # Datum platnosti
    date_patterns = [
        r'účinnosti\s+dnem\s+(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})',
        r'platný\s+od\s+(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})',
        r'od\s+(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})',
    ]
    for pattern in date_patterns:
        date_match = re.search(pattern, text, re.IGNORECASE)
        if date_match:
            try:
                day, month, year = int(date_match.group(1)), int(date_match.group(2)), int(date_match.group(3))
                contract['valid_from'] = datetime(year, month, day)
                break
            except ValueError:
                continue
    
    # Typ služby
    text_lower = text.lower()
    if 'drop 2.0' in text_lower or 'alzatrade' in text_lower:
        contract['service_type'] = 'DROP 2.0'
    elif 'alzabox' in text_lower:
        contract['service_type'] = 'AlzaBox'
    elif 'třídírna' in text_lower or 'tridirna' in text_lower:
        contract['service_type'] = 'Třídírna'
    elif 'xl' in text_lower and 'rozvo' in text_lower:
        contract['service_type'] = 'XL'
    
    return contract


def extract_price_rates(text: str) -> dict:
    """
    Extract price rates from PDF text - UPDATED VERSION
    Now includes depot_code, route_category, warehouse_code, pallet_capacity
    """
    rates = {
        'fix_rates': [], 
        'km_rates': [], 
        'depo_rates': [],
        'linehaul_rates': [],
        'bonus_rates': []
    }
    
    # Normalize text
    text_clean = re.sub(r'\s+', ' ', text)
    text_lower = text_clean.lower()
    
    # ============ FIX SAZBY ============
    fix_patterns = [
        # Formát: číslo před DIRECT
        (r'([\d\s]+)\s*kč\s*bez\s*dph\s*direct\s+praha', 'DIRECT_Praha'),
        (r'([\d\s]+)\s*kč\s*bez\s*dph\s*direct\s+vratimov', 'DIRECT_Vratimov'),
        (r'([\d\s]+)\s*kč\s*bez\s*dph\s*direct\s+nov[ýy]\s*b[ýy]d[žz]ov', 'DIRECT_NovyBydzov'),
        # Formát: DIRECT před číslem
        (r'direct\s+praha[^0-9]*?([\d\s]+)\s*kč', 'DIRECT_Praha'),
        (r'direct\s+vratimov[^0-9]*?([\d\s]+)\s*kč', 'DIRECT_Vratimov'),
        (r'direct\s+nov[ýy]\s*b[ýy]d[žz]ov[^0-9]*?([\d\s]+)\s*kč', 'DIRECT_NovyBydzov'),
        # Formát z tabulek - FIXNÍ ČÁSTKA
        (r'fixn[íi]\s+[čc][áa]stka[^0-9]*?([\d\s]+)\s*kč[^0-9]*direct\s+praha', 'DIRECT_Praha'),
        (r'fixn[íi]\s+[čc][áa]stka[^0-9]*?([\d\s]+)\s*kč[^0-9]*direct\s+vratimov', 'DIRECT_Vratimov'),
    ]
    
    found_fix = set()
    for pattern, route_type in fix_patterns:
        matches = re.finditer(pattern, text_lower)
        for match in matches:
            rate_str = match.group(1)
            rate = parse_czech_number(rate_str)
            if rate and rate > 100 and route_type not in found_fix:
                found_fix.add(route_type)
                
                # NOVÉ: detekce category a depot
                route_category = detect_route_category(route_type)
                depot_code = detect_depot_code_from_route_type(route_type)
                
                rates['fix_rates'].append({
                    'route_type': route_type,
                    'rate': rate,
                    'route_category': route_category,  # NOVÉ
                    'depot_code': depot_code,          # NOVÉ
                })
    
    # ============ KM SAZBY ============
    km_patterns = [
        (r'([\d,]+)\s*kč\s*(?:bez\s*dph\s*)?(?:za\s*)?(?:1\s*)?km', None),
        (r'km\s*sazba[^0-9]*([\d,]+)\s*kč', None),
        (r'sazba\s+za\s+km[^0-9]*([\d,]+)', None),
    ]
    
    found_km = False
    for pattern, route_type in km_patterns:
        if found_km:
            break
        matches = re.finditer(pattern, text_lower)
        for match in matches:
            rate = parse_czech_number(match.group(1))
            if rate and 5 < rate < 50:  # Rozumný rozsah pro km sazbu
                rates['km_rates'].append({
                    'route_type': route_type,
                    'rate': rate,
                    'depot_code': None,  # KM sazba je typicky univerzální
                })
                found_km = True
                break
    
    # ============ DEPO SAZBY ============
    depo_patterns = [
        (r'hodinov[áa]\s+sazba\s+(?:na\s+)?depu[^0-9]*([\d\s]+)\s*kč', 'hourly'),
        (r'depo[^0-9]*hodinov[^0-9]*([\d\s]+)\s*kč', 'hourly'),
        (r'm[ěe]s[íi][čc]n[íi]\s+pau[šs][áa]l[^0-9]*([\d\s]+)\s*kč', 'monthly'),
        (r'sklad\s+all\s+in[^0-9]*([\d\s]+)\s*kč', 'monthly'),
    ]
    
    for pattern, rate_type in depo_patterns:
        matches = re.finditer(pattern, text_lower)
        for match in matches:
            rate = parse_czech_number(match.group(1))
            if rate:
                # Validace rozsahu podle typu
                if rate_type == 'hourly' and not (100 < rate < 2000):
                    continue
                if rate_type == 'monthly' and not (10000 < rate < 1000000):
                    continue
                
                # Detekce depa z kontextu
                context_start = max(0, match.start() - 100)
                context = text_lower[context_start:match.end() + 50]
                
                depo_name = 'Depo'
                depot_code = None
                if 'vratimov' in context:
                    depo_name = 'Vratimov'
                    depot_code = 'VRATIMOV'
                elif 'bydžov' in context or 'bydzov' in context:
                    depo_name = 'Nový Bydžov'
                    depot_code = 'NOVY_BYDZOV'
                
                rates['depo_rates'].append({
                    'depo_name': depo_name,
                    'rate_type': rate_type,
                    'rate': rate,
                    'depot_code': depot_code,  # NOVÉ
                })
    
    # ============ LINEHAUL SAZBY ============
    # Vzor 1: Jednoduchý formát "CZLC4 -> Vratimov ... 24 180 Kč"
    lh_pattern1 = r'(CZ[A-Z0-9]+|LCU|LCZ)\s*[-–→>]+\s*([A-Za-zÀ-ž\s]+?)\s*[^0-9]*([\d\s]+)\s*kč'
    
    for match in re.finditer(lh_pattern1, text, re.IGNORECASE):
        from_code = match.group(1).upper()
        to_location = match.group(2).strip()
        rate = parse_czech_number(match.group(3))
        
        if rate and rate > 1000:
            # Normalizace to_code
            to_code = None
            for key, code in LINEHAUL_TO_DEPOT_CODE.items():
                if key.lower() in to_location.lower():
                    to_code = code
                    break
            
            if not to_code:
                to_code = to_location.upper().replace(' ', '_')[:20]
            
            # NOVÉ: warehouse_code a kapacity
            warehouse_code = detect_warehouse_code(from_code)
            
            rates['linehaul_rates'].append({
                'from_code': from_code,
                'to_code': to_code,
                'vehicle_type': 'KAMION',  # Default
                'rate': rate,
                'warehouse_code': warehouse_code,      # NOVÉ
                'pallet_capacity_min': 33,            # NOVÉ
                'pallet_capacity_max': 33,            # NOVÉ
            })
    
    # Vzor 2: Tabulka třídírny s typy vozidel
    lh_table_pattern = r'(dodávka|solo|kamion)[^0-9]*([\d\s]+)\s*kč'
    
    # Zjisti, jestli jsme v sekci třídírna/linehaul
    if 'třídírna' in text_lower or 'linehaul' in text_lower or 'line-haul' in text_lower:
        for match in re.finditer(lh_table_pattern, text_lower):
            vehicle_raw = match.group(1)
            rate = parse_czech_number(match.group(2))
            
            if rate and rate > 1000:
                vehicle_type = normalize_vehicle_type(vehicle_raw)
                pallet_min, pallet_max = get_pallet_capacity(vehicle_type)
                
                # Detekce from/to z kontextu
                context_start = max(0, match.start() - 200)
                context = text_lower[context_start:match.end()]
                
                from_code = 'CZTC1'  # Default třídírna
                to_code = 'VRATIMOV'  # Default depo
                
                if 'czlc4' in context:
                    from_code = 'CZLC4'
                if 'bydžov' in context or 'bydzov' in context:
                    to_code = 'NOVY_BYDZOV'
                
                warehouse_code = detect_warehouse_code(from_code)
                
                rates['linehaul_rates'].append({
                    'from_code': from_code,
                    'to_code': to_code,
                    'vehicle_type': vehicle_type,
                    'rate': rate,
                    'warehouse_code': warehouse_code,      # NOVÉ
                    'pallet_capacity_min': pallet_min,    # NOVÉ
                    'pallet_capacity_max': pallet_max,    # NOVÉ
                })
    
    # ============ BONUS SAZBY ============
    bonus_pattern = r'[≥>]\s*([\d,]+)\s*%[^0-9]*\+?\s*([\d\s]+)\s*kč'
    
    for match in re.finditer(bonus_pattern, text_lower):
        quality = parse_czech_number(match.group(1))
        bonus = parse_czech_number(match.group(2))
        
        if quality and bonus and 90 < quality <= 100:
            rates['bonus_rates'].append({
                'quality_min': quality,
                'quality_max': 100,
                'bonus': bonus,
                'depot_code': None,  # Bonus je typicky univerzální
            })
    
    return rates


# =============================================================================
# HELPER PRO ZÍSKÁNÍ ID Z KÓDU
# =============================================================================

async def get_depot_id_by_code(db: AsyncSession, carrier_id: int, depot_code: str) -> Optional[int]:
    """Najde depot_id podle kódu pro daného dopravce"""
    if not depot_code:
        return None
    
    result = await db.execute(
        select(Depot).where(
            and_(
                Depot.carrier_id == carrier_id,
                Depot.code == depot_code
            )
        )
    )
    depot = result.scalar_one_or_none()
    return depot.id if depot else None


async def get_warehouse_id_by_code(db: AsyncSession, warehouse_code: str) -> Optional[int]:
    """Najde warehouse_id podle kódu"""
    if not warehouse_code:
        return None
    
    result = await db.execute(
        select(Warehouse).where(Warehouse.code == warehouse_code)
    )
    warehouse = result.scalar_one_or_none()
    return warehouse.id if warehouse else None


# =============================================================================
# API ENDPOINTY
# =============================================================================

@router.get("", response_model=List[ContractResponse])
async def get_contracts(
    carrier_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """Get all contracts with optional carrier filter"""
    query = select(Contract).options(selectinload(Contract.carrier))
    
    if carrier_id:
        query = query.where(Contract.carrier_id == carrier_id)
    
    query = query.order_by(Contract.valid_from.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{contract_id}", response_model=ContractResponse)
async def get_contract(contract_id: int, db: AsyncSession = Depends(get_db)):
    """Get single contract by ID"""
    result = await db.execute(
        select(Contract)
        .options(selectinload(Contract.carrier))
        .where(Contract.id == contract_id)
    )
    contract = result.scalar_one_or_none()
    
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    
    return contract


@router.post("/upload")
@router.post("/upload-pdf")  # Alias
async def upload_contract_pdf(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    """Upload and parse contract PDF - creates carrier if not exists"""
    content = await file.read()
    
    try:
        with pdfplumber.open(BytesIO(content)) as pdf:
            text = ""
            for page in pdf.pages:
                text += page.extract_text() or ""
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Chyba při čtení PDF: {str(e)}")
    
    # Extrakce dat
    carrier_info = extract_carrier_info(text)
    contract_info = extract_contract_info(text, file.filename)
    price_rates = extract_price_rates(text)
    
    # Validace
    if not carrier_info['ico']:
        raise HTTPException(status_code=400, detail="Nepodařilo se najít IČO dopravce")
    
    # Najdi nebo vytvoř dopravce
    result = await db.execute(
        select(Carrier).where(Carrier.ico == carrier_info['ico'])
    )
    carrier = result.scalar_one_or_none()
    is_new_carrier = False
    
    if not carrier:
        carrier = Carrier(
            name=carrier_info['name'] or f"Dopravce {carrier_info['ico']}",
            ico=carrier_info['ico'],
            dic=carrier_info['dic'],
            address=carrier_info['address']
        )
        db.add(carrier)
        await db.flush()
        is_new_carrier = True
    
    # Extrahuj číslo dodatku z názvu
    amendment_num = None
    if contract_info['number']:
        num_match = re.search(r'(\d+)', contract_info['number'])
        if num_match:
            amendment_num = int(num_match.group(1))
    
    # Vytvoř smlouvu
    contract = Contract(
        carrier_id=carrier.id,
        number=contract_info['number'] or f"Dodatek-{file.filename}",
        type=contract_info['type'],
        valid_from=contract_info['valid_from'] or datetime.now(),
        amendment_number=amendment_num,
        notes=f"Typ služby: {contract_info['service_type'] or 'neznámý'}"
    )
    db.add(contract)
    await db.flush()
    
    # Vytvoř ceník
    price_config = None
    has_rates = (
        len(price_rates['fix_rates']) > 0 or
        len(price_rates['km_rates']) > 0 or
        len(price_rates['depo_rates']) > 0 or
        len(price_rates.get('linehaul_rates', [])) > 0 or
        len(price_rates.get('bonus_rates', [])) > 0
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
        
        # FIX RATES - s novými sloupci
        for rate in price_rates['fix_rates']:
            depot_id = await get_depot_id_by_code(db, carrier.id, rate.get('depot_code'))
            
            db.add(FixRate(
                price_config_id=price_config.id,
                route_type=rate['route_type'],
                rate=Decimal(str(rate['rate'])),
                route_category=rate.get('route_category'),  # NOVÉ
                depot_id=depot_id,                          # NOVÉ
            ))
        
        # KM RATES - s novými sloupci
        for rate in price_rates['km_rates']:
            depot_id = await get_depot_id_by_code(db, carrier.id, rate.get('depot_code'))
            
            db.add(KmRate(
                price_config_id=price_config.id,
                route_type=rate.get('route_type'),
                rate=Decimal(str(rate['rate'])),
                depot_id=depot_id,  # NOVÉ
            ))
        
        # DEPO RATES - s novými sloupci
        for rate in price_rates['depo_rates']:
            depot_id = await get_depot_id_by_code(db, carrier.id, rate.get('depot_code'))
            
            db.add(DepoRate(
                price_config_id=price_config.id,
                depo_name=rate['depo_name'],
                rate_type=rate['rate_type'],
                rate=Decimal(str(rate['rate'])),
                depot_id=depot_id,  # NOVÉ
            ))
        
        # LINEHAUL RATES - s novými sloupci
        for rate in price_rates.get('linehaul_rates', []):
            warehouse_id = await get_warehouse_id_by_code(db, rate.get('warehouse_code'))
            
            db.add(LinehaulRate(
                price_config_id=price_config.id,
                from_code=rate['from_code'],
                to_code=rate['to_code'],
                vehicle_type=rate['vehicle_type'],
                rate=Decimal(str(rate['rate'])),
                from_warehouse_id=warehouse_id,                      # NOVÉ
                pallet_capacity_min=rate.get('pallet_capacity_min'), # NOVÉ
                pallet_capacity_max=rate.get('pallet_capacity_max'), # NOVÉ
            ))
        
        # BONUS RATES - s novými sloupci
        for rate in price_rates.get('bonus_rates', []):
            depot_id = await get_depot_id_by_code(db, carrier.id, rate.get('depot_code'))
            
            db.add(BonusRate(
                price_config_id=price_config.id,
                quality_min=Decimal(str(rate['quality_min'])),
                quality_max=Decimal(str(rate['quality_max'])),
                bonus_amount=Decimal(str(rate['bonus'])),
                total_with_bonus=Decimal('0'),
                depot_id=depot_id,  # NOVÉ
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
                'depoRatesCount': len(price_rates['depo_rates']),
                'linehaulRatesCount': len(price_rates.get('linehaul_rates', [])),
                'bonusRatesCount': len(price_rates.get('bonus_rates', []))
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
    contract_info = extract_contract_info(text, file.filename)
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
            'fixRates': [
                {
                    'routeType': r['route_type'], 
                    'rate': r['rate'],
                    'routeCategory': r.get('route_category'),
                    'depotCode': r.get('depot_code'),
                } 
                for r in price_rates['fix_rates']
            ],
            'kmRates': [
                {
                    'routeType': r.get('route_type'), 
                    'rate': r['rate'],
                    'depotCode': r.get('depot_code'),
                } 
                for r in price_rates['km_rates']
            ],
            'depoRates': [
                {
                    'depoName': r['depo_name'], 
                    'rateType': r['rate_type'], 
                    'rate': r['rate'],
                    'depotCode': r.get('depot_code'),
                } 
                for r in price_rates['depo_rates']
            ],
            'linehaulRates': [
                {
                    'fromCode': r['from_code'], 
                    'toCode': r['to_code'], 
                    'vehicleType': r['vehicle_type'], 
                    'rate': r['rate'],
                    'warehouseCode': r.get('warehouse_code'),
                    'palletCapacityMin': r.get('pallet_capacity_min'),
                    'palletCapacityMax': r.get('pallet_capacity_max'),
                } 
                for r in price_rates.get('linehaul_rates', [])
            ],
            'bonusRates': [
                {
                    'qualityMin': r['quality_min'], 
                    'qualityMax': r['quality_max'], 
                    'bonus': r['bonus']
                } 
                for r in price_rates.get('bonus_rates', [])
            ]
        }
    }


@router.put("/{contract_id}", response_model=ContractResponse)
async def update_contract(
    contract_id: int, 
    contract_data: ContractUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update contract"""
    result = await db.execute(
        select(Contract).where(Contract.id == contract_id)
    )
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
    result = await db.execute(
        select(Contract).where(Contract.id == contract_id)
    )
    contract = result.scalar_one_or_none()
    
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    
    await db.delete(contract)
    await db.commit()
