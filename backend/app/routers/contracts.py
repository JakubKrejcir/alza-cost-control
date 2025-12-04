"""
Contracts API Router - with PDF upload and parsing
Vylepšeno: validace protistrany, kontrola duplicit, zachování ceníků
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
from app.models import Contract, Carrier, PriceConfig, FixRate, KmRate, DepoRate, LinehaulRate, BonusRate
from app.schemas import ContractCreate, ContractUpdate, ContractResponse

router = APIRouter()


def normalize_name(name: str) -> str:
    """Normalizuje název pro porovnání (malá písmena, bez právních forem, bez mezer)"""
    if not name:
        return ""
    name = name.lower().strip()
    # Odstraň právní formy
    for suffix in ['s.r.o.', 'sro', 'a.s.', 'as', 'spol.', 'spol', 'k.s.', 'v.o.s.']:
        name = name.replace(suffix, '')
    # Odstraň mezery a speciální znaky
    name = re.sub(r'[^a-z0-9áčďéěíňóřšťúůýž]', '', name)
    return name


def extract_carrier_info(text: str) -> dict:
    """Extract carrier info from PDF text"""
    carrier = {
        'name': None, 'ico': None, 'dic': None, 'address': None, 'bank_account': None
    }
    
    # Najdi všechna IČO (ignoruj Alza IČO 27082440)
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
            r'(?:Za\s+)?([A-Za-zÀ-ž][A-Za-zÀ-ž\s]+(?:s\.r\.o\.|a\.s\.))\s*\n.*jednatel',
            text, re.IGNORECASE
        )
        if alt_match and 'alza' not in alt_match.group(1).lower():
            carrier['name'] = alt_match.group(1).strip()
    
    # Adresa
    address_matches = re.findall(r'se\s+sídlem[:\s]*([^\n]+)', text, re.IGNORECASE)
    for addr in address_matches:
        if 'jankovcova' not in addr.lower():
            carrier['address'] = addr.strip()
            break
    
    # Bankovní účet
    bank_match = re.search(r'č\.\s*bankovního\s*účtu[:\s]*(\d+/\d+)', text, re.IGNORECASE)
    if bank_match:
        carrier['bank_account'] = bank_match.group(1)
    
    return carrier


def extract_contract_info(text: str, filename: str = None) -> dict:
    """Extract contract info from PDF text"""
    contract = {'number': None, 'type': None, 'valid_from': None, 'service_type': None}
    
    # Číslo dodatku
    dodatek_match = re.search(r'Dodatek\s*č\.\s*(\d+)', text, re.IGNORECASE)
    if dodatek_match:
        contract['number'] = f"Dodatek č. {dodatek_match.group(1)}"
    elif filename:
        # Zkus z názvu souboru
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
    if 'drop 2.0' in text.lower() or 'alzatrade' in text.lower():
        contract['service_type'] = 'DROP 2.0'
    elif 'alzabox' in text.lower():
        contract['service_type'] = 'AlzaBox'
    elif 'třídírna' in text.lower() or 'tridirna' in text.lower():
        contract['service_type'] = 'Třídírna'
    
    return contract


def extract_price_rates(text: str) -> dict:
    """Extract price rates from PDF text - improved version for Alza contracts"""
    rates = {
        'fix_rates': [], 
        'km_rates': [], 
        'depo_rates': [],
        'linehaul_rates': [],
        'bonus_rates': []
    }
    
    # Normalize text - remove extra whitespace, normalize numbers
    text_clean = re.sub(r'\s+', ' ', text)
    text_lower = text_clean.lower()
    
    # ============ FIX SAZBY ============
    # Tabulkový formát: "3 200 Kč bez DPH DIRECT Praha" nebo "FIXNÍ ČÁSTKA ... X XXX Kč ... DIRECT"
    fix_patterns = [
        # Formát: číslo před DIRECT (z tabulky)
        (r'([\d\s]+)\s*kč\s*bez\s*dph\s*direct\s+praha', 'DIRECT_Praha'),
        (r'([\d\s]+)\s*kč\s*bez\s*dph\s*direct\s+vratimov', 'DIRECT_Vratimov'),
        # Formát: DIRECT před číslem
        (r'direct\s+praha[^0-9]*?([\d\s]+)\s*kč', 'DIRECT_Praha'),
        (r'direct\s+vratimov[^0-9]*?([\d\s]+)\s*kč', 'DIRECT_Vratimov'),
        # Formát s FIXNÍ ČÁSTKA
        (r'fixní\s+částka\s+([\d\s]+)\s*kč[^0-9]*direct\s+praha', 'DIRECT_Praha'),
        (r'fixní\s+částka\s+([\d\s]+)\s*kč[^0-9]*direct\s+vratimov', 'DIRECT_Vratimov'),
    ]
    
    seen_fix = set()
    for pattern, route_type in fix_patterns:
        matches = re.findall(pattern, text_lower)
        for match in matches:
            try:
                rate = int(match.replace(' ', '').replace('\xa0', ''))
                if 1000 <= rate <= 50000 and (route_type, rate) not in seen_fix:
                    rates['fix_rates'].append({'route_type': route_type, 'rate': rate})
                    seen_fix.add((route_type, rate))
            except ValueError:
                continue
    
    # ============ KM SAZBY ============
    # Formát: "10,97 Kč bez DPH Direct Praha" nebo "Cena za kilometr ... 10,97 Kč"
    km_patterns = [
        r'(\d+[,\.]\d+)\s*kč\s*bez\s*dph\s*direct',  # Tabulkový formát
        r'cena\s+za\s+kilometr[^0-9]*?(\d+[,\.]\d+)\s*kč',
        r'(\d+[,\.]\d+)\s*kč\s*/\s*km',
    ]
    
    seen_km = set()
    for pattern in km_patterns:
        matches = re.findall(pattern, text_lower)
        for match in matches:
            try:
                rate = float(match.replace(',', '.'))
                if 1 <= rate <= 100 and rate not in seen_km:
                    rates['km_rates'].append({'route_type': 'standard', 'rate': rate})
                    seen_km.add(rate)
            except ValueError:
                continue
    
    # ============ DEPO SAZBY ============
    # Formát: "Hodinová sazba na DEPU 850 Kč" nebo "Sklad ALL IN 410 000 Kč/měsíc"
    depo_patterns = [
        (r'hodinov[áa]\s+sazba\s+na\s+depu?\s*[:\-–]?\s*([\d\s]+)\s*kč', 'Vratimov', 'hourly'),
        (r'sklad\s+all\s+in\s*[:\-–]?\s*([\d\s]+)[,\.\-]*\s*/?\s*měsíc', 'Sklad_ALL_IN', 'monthly'),
        (r'sklad\s+all\s+in\s+.*?po\s+slevě[^0-9]*([\d\s]+)[,\.\-]*\s*/?\s*měsíc', 'Sklad_ALL_IN_sleva', 'monthly'),
        (r'(\d+)\s*x\s*skladník[^0-9]*([\d\s]+)[,\.\-]*\s*/?\s*měsíc', 'Skladnici', 'monthly'),
        (r'brigádník[^0-9]*([\d\s]+)[,\.\-]*\s*/?\s*den', 'Brigadnik', 'daily'),
    ]
    
    seen_depo = set()
    for pattern, depo_name, rate_type in depo_patterns:
        matches = re.findall(pattern, text_lower)
        for match in matches:
            try:
                if isinstance(match, tuple):
                    rate_str = match[-1]
                else:
                    rate_str = match
                rate = int(rate_str.replace(' ', '').replace('\xa0', ''))
                if rate > 0 and (depo_name, rate) not in seen_depo:
                    rates['depo_rates'].append({
                        'depo_name': depo_name, 
                        'rate_type': rate_type, 
                        'rate': rate
                    })
                    seen_depo.add((depo_name, rate))
            except ValueError:
                continue
    
    # ============ LINEHAUL SAZBY ============
    # Formát 1: "24 180 Kč bez DPH CZLC4 -> Vratimov" (AlzaBox dodatky)
    # Formát 2: Třídírna tabulky - line-by-line parsing
    
    linehaul_patterns = [
        # Tabulkový formát: číslo před trasou (AlzaBox)
        (r'([\d\s]+)\s*kč\s*bez\s*dph\s*czlc4\s*[–\->]+\s*vratimov', 'CZLC4', 'Vratimov', 'LKW'),
        # Formát: trasa před číslem
        (r'linehaul\s+czlc4\s*[–\->]+\s*vratimov[^0-9]*([\d\s]+)\s*kč', 'CZLC4', 'Vratimov', 'LKW'),
        # LKW/sólo/dodávka pro Nový Bydžov
        (r'lcu\s*[–\-]\s*depo\s+nový\s+bydžov[^0-9]*([\d\s]+)[,\.\-]*', 'LCU', 'Novy_Bydzov', 'LKW'),
        (r'lcz/cztc1\s*[–\-]\s*depo\s+nový\s+bydžov[^0-9]*([\d\s]+)[,\.\-]*', 'LCZ_CZTC1', 'Novy_Bydzov', 'LKW'),
    ]
    
    seen_linehaul = set()
    for pattern, from_code, to_code, vehicle in linehaul_patterns:
        matches = re.findall(pattern, text_lower)
        for match in matches:
            try:
                rate = int(match.replace(' ', '').replace('\xa0', ''))
                key = (from_code, to_code, vehicle, rate)
                if 1000 <= rate <= 100000 and key not in seen_linehaul:
                    rates['linehaul_rates'].append({
                        'from_code': from_code,
                        'to_code': to_code,
                        'vehicle_type': vehicle,
                        'rate': rate
                    })
                    seen_linehaul.add(key)
            except ValueError:
                continue
    
    # Třídírna tabulky - line-by-line parsing
    # Formát: "CZTC1 – DEPO Vratimov CZTC1 DEPO Vratimov (Plachta) 8-10 9 100,-"
    for line in text.split('\n'):
        line_lower = line.lower().strip()
        
        # Detekuj zdroj (CZTC1 nebo CZLC4)
        from_code = None
        if 'cztc1 – depo vratimov' in line_lower or 'cztc1 - depo vratimov' in line_lower:
            from_code = 'CZTC1'
        elif 'czlc4 – depo vratimov' in line_lower or 'czlc4 - depo vratimov' in line_lower:
            from_code = 'CZLC4'
        
        if from_code:
            # Najdi cenu na konci řádku - formát "X XXX,-" nebo "XX XXX,-"
            price_match = re.search(r'\s(\d{1,2}\s?\d{3})[,\-]+\s*$', line_lower)
            if price_match:
                try:
                    rate = int(price_match.group(1).replace(' ', ''))
                    if 1000 <= rate <= 100000:
                        # Detekuj typ vozu
                        if 'plachta' in line_lower:
                            vehicle = 'Dodavka'
                        elif 'solo' in line_lower:
                            vehicle = 'Solo'
                        elif 'kamion' in line_lower:
                            vehicle = 'Kamion'
                        else:
                            continue  # Neznámý typ vozu, přeskoč
                        
                        key = (from_code, 'Vratimov', vehicle, rate)
                        if key not in seen_linehaul:
                            rates['linehaul_rates'].append({
                                'from_code': from_code,
                                'to_code': 'Vratimov',
                                'vehicle_type': vehicle,
                                'rate': rate
                            })
                            seen_linehaul.add(key)
                except ValueError:
                    continue
    
    # ============ BONUS SAZBY ============
    # Formát: "≥ 98 % + 35 600" nebo "97,51 – 97,99 % + 30 000"
    bonus_patterns = [
        (r'[≥>=]\s*98\s*%[^0-9]*\+\s*([\d\s]+)[,\.\-]*', 98.0, 100.0),
        (r'97[,\.]51\s*[–\-]\s*97[,\.]99\s*%[^0-9]*\+\s*([\d\s]+)[,\.\-]*', 97.51, 97.99),
        (r'97[,\.]01\s*[–\-]\s*97[,\.]50\s*%[^0-9]*\+\s*([\d\s]+)[,\.\-]*', 97.01, 97.50),
        (r'96[,\.]51\s*[–\-]\s*97[,\.]00\s*%[^0-9]*\+\s*([\d\s]+)[,\.\-]*', 96.51, 97.00),
        (r'96[,\.]01\s*[–\-]\s*96[,\.]50\s*%[^0-9]*\+\s*([\d\s]+)[,\.\-]*', 96.01, 96.50),
        (r'[<]\s*96[,\.]?0?\s*%[^0-9]*\+\s*([\d\s]+)[,\.\-]*', 0.0, 96.0),
    ]
    
    seen_bonus = set()
    for pattern, quality_min, quality_max in bonus_patterns:
        matches = re.findall(pattern, text_lower)
        for match in matches:
            try:
                bonus = int(match.replace(' ', '').replace('\xa0', ''))
                key = (quality_min, quality_max)
                if bonus > 0 and key not in seen_bonus:
                    rates['bonus_rates'].append({
                        'quality_min': quality_min,
                        'quality_max': quality_max,
                        'bonus': bonus
                    })
                    seen_bonus.add(key)
            except ValueError:
                continue
    
    return rates


def validate_carrier_match(carrier: Carrier, extracted_info: dict) -> dict:
    """
    Validuje, že extrahované údaje odpovídají dopravci.
    Vrací dict s výsledkem validace a varováními.
    """
    result = {
        'valid': True,
        'warnings': [],
        'errors': []
    }
    
    # Porovnej IČO
    if extracted_info.get('ico'):
        if carrier.ico and carrier.ico != extracted_info['ico']:
            result['errors'].append(
                f"IČO ve smlouvě ({extracted_info['ico']}) nesouhlasí s IČO dopravce ({carrier.ico})"
            )
            result['valid'] = False
    
    # Porovnej název (fuzzy match)
    if extracted_info.get('name'):
        carrier_name_norm = normalize_name(carrier.name)
        extracted_name_norm = normalize_name(extracted_info['name'])
        
        if carrier_name_norm and extracted_name_norm:
            # Kontrola zda jeden obsahuje druhý
            if carrier_name_norm not in extracted_name_norm and extracted_name_norm not in carrier_name_norm:
                result['warnings'].append(
                    f"Název ve smlouvě ({extracted_info['name']}) se liší od názvu dopravce ({carrier.name})"
                )
    
    return result


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


@router.post("/upload")
async def upload_contract(
    file: UploadFile = File(...),
    carrier_id: int = Form(...),
    db: AsyncSession = Depends(get_db)
):
    """
    Upload contract to existing carrier.
    Validates that the contract belongs to the carrier.
    Checks for duplicates.
    """
    # Ověř dopravce
    carrier_result = await db.execute(
        select(Carrier).where(Carrier.id == carrier_id)
    )
    carrier = carrier_result.scalar_one_or_none()
    if not carrier:
        raise HTTPException(status_code=400, detail="Dopravce nenalezen")
    
    content = await file.read()
    
    # Extrahuj data z PDF
    contract_info = {
        'number': file.filename.replace('.pdf', '').replace('.PDF', ''),
        'type': None,
        'valid_from': datetime.now(),
        'service_type': None
    }
    carrier_info = {}
    price_rates = {'fix_rates': [], 'km_rates': [], 'depo_rates': []}
    
    try:
        with pdfplumber.open(BytesIO(content)) as pdf:
            text = ""
            for page in pdf.pages[:5]:
                text += page.extract_text() or ""
        
        carrier_info = extract_carrier_info(text)
        extracted_contract = extract_contract_info(text, file.filename)
        price_rates = extract_price_rates(text)
        
        if extracted_contract['number']:
            contract_info['number'] = extracted_contract['number']
        if extracted_contract['valid_from']:
            contract_info['valid_from'] = extracted_contract['valid_from']
        if extracted_contract['type']:
            contract_info['type'] = extracted_contract['type']
        if extracted_contract['service_type']:
            contract_info['service_type'] = extracted_contract['service_type']
            
    except Exception as e:
        print(f"PDF parsing failed (continuing anyway): {e}")
    
    # Validace protistrany
    validation = validate_carrier_match(carrier, carrier_info)
    if not validation['valid']:
        raise HTTPException(
            status_code=400,
            detail=f"Nesprávná protistrana: {'; '.join(validation['errors'])}"
        )
    
    # Kontrola duplicit
    existing = await db.execute(
        select(Contract).where(
            and_(
                Contract.carrier_id == carrier_id,
                Contract.number == contract_info['number']
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail=f"Smlouva '{contract_info['number']}' pro tohoto dopravce již existuje"
        )
    
    # Vytvoř smlouvu
    contract = Contract(
        carrier_id=carrier_id,
        number=contract_info['number'],
        type=contract_info['service_type'] or contract_info['type'],
        valid_from=contract_info['valid_from'],
        document_url=file.filename,
        notes=f"Nahráno: {datetime.now().strftime('%d.%m.%Y %H:%M')}"
    )
    db.add(contract)
    await db.flush()
    
    # Vytvoř ceník pokud byly nalezeny sazby
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
            carrier_id=carrier_id,
            contract_id=contract.id,
            type=contract_info['service_type'] or 'general',
            valid_from=contract_info['valid_from'],
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
        
        for rate in price_rates.get('linehaul_rates', []):
            db.add(LinehaulRate(
                price_config_id=price_config.id,
                from_code=rate['from_code'],
                to_code=rate['to_code'],
                vehicle_type=rate['vehicle_type'],
                rate=Decimal(str(rate['rate']))
            ))
        
        for rate in price_rates.get('bonus_rates', []):
            db.add(BonusRate(
                price_config_id=price_config.id,
                quality_min=Decimal(str(rate['quality_min'])),
                quality_max=Decimal(str(rate['quality_max'])),
                bonus_amount=Decimal(str(rate['bonus'])),
                total_with_bonus=Decimal('0')  # Placeholder
            ))
    
    await db.commit()
    
    return {
        'success': True,
        'message': 'Smlouva nahrána',
        'id': contract.id,
        'number': contract.number,
        'type': contract.type,
        'validFrom': contract.valid_from.isoformat() if contract.valid_from else None,
        'fileName': file.filename,
        'warnings': validation.get('warnings', []),
        'priceConfig': {
            'id': price_config.id,
            'fixRatesCount': len(price_rates['fix_rates']),
            'kmRatesCount': len(price_rates['km_rates']),
            'depoRatesCount': len(price_rates['depo_rates']),
            'linehaulRatesCount': len(price_rates.get('linehaul_rates', [])),
            'bonusRatesCount': len(price_rates.get('bonus_rates', []))
        } if price_config else None
    }


@router.post("/upload-pdf")
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
    
    carrier_info = extract_carrier_info(text)
    contract_info = extract_contract_info(text, file.filename)
    price_rates = extract_price_rates(text)
    
    if not carrier_info['ico']:
        raise HTTPException(
            status_code=400,
            detail="Nepodařilo se extrahovat IČO dopravce z dokumentu"
        )
    
    # Najdi nebo vytvoř dopravce
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
    
    # Kontrola duplicit
    existing = await db.execute(
        select(Contract).where(
            and_(
                Contract.carrier_id == carrier.id,
                Contract.number == contract_info['number']
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail=f"Smlouva '{contract_info['number']}' pro dopravce {carrier.name} již existuje"
        )
    
    # Vytvoř smlouvu
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
        
        for rate in price_rates.get('linehaul_rates', []):
            db.add(LinehaulRate(
                price_config_id=price_config.id,
                from_code=rate['from_code'],
                to_code=rate['to_code'],
                vehicle_type=rate['vehicle_type'],
                rate=Decimal(str(rate['rate']))
            ))
        
        for rate in price_rates.get('bonus_rates', []):
            db.add(BonusRate(
                price_config_id=price_config.id,
                quality_min=Decimal(str(rate['quality_min'])),
                quality_max=Decimal(str(rate['quality_max'])),
                bonus_amount=Decimal(str(rate['bonus'])),
                total_with_bonus=Decimal('0')
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
    """
    Delete contract but KEEP price configs (set contract_id to NULL).
    This preserves pricing data even when contract is deleted.
    """
    result = await db.execute(select(Contract).where(Contract.id == contract_id))
    contract = result.scalar_one_or_none()
    
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    
    # Nastav contract_id na NULL u všech ceníků místo kaskádového mazání
    await db.execute(
        update(PriceConfig)
        .where(PriceConfig.contract_id == contract_id)
        .values(contract_id=None)
    )
    
    await db.delete(contract)
    await db.commit()
