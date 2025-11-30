"""
Invoices API Router - with PDF upload and parsing using pdfplumber
"""
from typing import List, Optional
from datetime import datetime
from decimal import Decimal
import re
from io import BytesIO
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
import pdfplumber

from app.database import get_db
from app.models import Invoice, InvoiceItem, Carrier, Proof
from app.schemas import (
    InvoiceResponse, InvoiceCreate, InvoiceUpdate, InvoiceParsedData
)

router = APIRouter()


def parse_amount(s: str) -> Optional[Decimal]:
    """Parse Czech number format (3 688 000,00 -> 3688000.00)"""
    if not s:
        return None
    cleaned = re.sub(r'[\s\u00A0]', '', s).replace(',', '.')
    try:
        return Decimal(cleaned)
    except:
        return None


def parse_czech_date(date_str: str) -> Optional[datetime]:
    """Parse Czech date format (31.10.2025 -> datetime)"""
    if not date_str:
        return None
    match = re.search(r'(\d{1,2})\.(\d{1,2})\.(\d{4})', date_str)
    if not match:
        return None
    day, month, year = match.groups()
    return datetime(int(year), int(month), int(day))


def parse_invoice_pdf(file_content: bytes) -> InvoiceParsedData:
    """Parse invoice data from PDF using pdfplumber"""
    result = InvoiceParsedData()
    
    with pdfplumber.open(BytesIO(file_content)) as pdf:
        if len(pdf.pages) == 0:
            return result
        
        page = pdf.pages[0]
        text = page.extract_text() or ""
        
        # Invoice number
        inv_match = re.search(r'č\.\s*(\d{8})', text, re.IGNORECASE)
        if not inv_match:
            inv_match = re.search(r'Variabilní symbol:\s*(\d{8})', text, re.IGNORECASE)
        if inv_match:
            result.invoice_number = inv_match.group(1)
        
        vs_match = re.search(r'Variabilní symbol:\s*(\d+)', text, re.IGNORECASE)
        if vs_match:
            result.variable_symbol = vs_match.group(1)
            if not result.invoice_number:
                result.invoice_number = vs_match.group(1)
        
        # Dates
        issue_match = re.search(r'Datum vystavení:\s*(\d{1,2}\.\d{1,2}\.\d{4})', text, re.IGNORECASE)
        if issue_match:
            result.issue_date = parse_czech_date(issue_match.group(1))
        
        due_match = re.search(r'Datum splatnosti:\s*(\d{1,2}\.\d{1,2}\.\d{4})', text, re.IGNORECASE)
        if due_match:
            result.due_date = parse_czech_date(due_match.group(1))
        
        # Item type and period
        item_match = re.search(r'ALZABOXY\s+(FIX|KM|LINEHAUL|DEPO)\s*-\s*(\d{1,2})/(\d{4})', text, re.IGNORECASE)
        if item_match:
            result.item_type = f"ALZABOXY {item_match.group(1).upper()}"
            result.period = f"{item_match.group(2)}/{item_match.group(3)}"
        else:
            period_match = re.search(r'(\d{1,2})/(\d{4})', text)
            if period_match:
                result.period = f"{period_match.group(1)}/{period_match.group(2)}"
        
        # Amounts - Strategy 1: line item
        line_match = re.search(
            r'ALZABOXY\s+(?:FIX|KM|LINEHAUL|DEPO)\s*-\s*\d+/\d+\s+1\s+([\d\s]+,\d{2})\s+([\d\s]+,\d{2})\s+21%\s+([\d\s]+,\d{2})\s+([\d\s]+,\d{2})',
            text, re.IGNORECASE
        )
        if line_match:
            result.total_without_vat = parse_amount(line_match.group(2))
            result.vat_amount = parse_amount(line_match.group(3))
            result.total_with_vat = parse_amount(line_match.group(4))
        
        # Strategy 2: Součet položek
        if not result.total_without_vat:
            sum_match = re.search(
                r'Součet položek\s+([\d\s]+,\d{2})\s+([\d\s]+,\d{2})\s+([\d\s]+,\d{2})',
                text, re.IGNORECASE
            )
            if sum_match:
                result.total_without_vat = parse_amount(sum_match.group(1))
                result.vat_amount = parse_amount(sum_match.group(2))
                result.total_with_vat = parse_amount(sum_match.group(3))
        
        # Strategy 3: DPH rekapitulace
        if not result.total_without_vat:
            rekap_match = re.search(r'([\d\s]+,\d{2})\s+21%\s+([\d\s]+,\d{2})\s+([\d\s]+,\d{2})', text)
            if rekap_match:
                result.total_without_vat = parse_amount(rekap_match.group(1))
                result.vat_amount = parse_amount(rekap_match.group(2))
                result.total_with_vat = parse_amount(rekap_match.group(3))
        
        # Strategy 4: CELKEM K ÚHRADĚ
        if not result.total_with_vat:
            celkem_match = re.search(r'CELKEM K ÚHRADĚ\s+([\d\s]+,\d{2})', text, re.IGNORECASE)
            if celkem_match:
                result.total_with_vat = parse_amount(celkem_match.group(1))
                if result.total_with_vat and not result.total_without_vat:
                    result.total_without_vat = round(result.total_with_vat / Decimal('1.21'), 2)
                    result.vat_amount = result.total_with_vat - result.total_without_vat
        
        # IČO/DIČ
        supplier_ico = re.search(r'IČ:\s*(\d{8})', text)
        if supplier_ico:
            result.supplier_ico = supplier_ico.group(1)
        
        supplier_dic = re.search(r'DIČ:\s*(CZ\d{8,10})', text)
        if supplier_dic:
            result.supplier_dic = supplier_dic.group(1)
    
    return result


async def get_invoice_by_id(invoice_id: int, db: AsyncSession):
    """Helper to get invoice with relations"""
    result = await db.execute(
        select(Invoice)
        .options(
            selectinload(Invoice.carrier),
            selectinload(Invoice.proof),
            selectinload(Invoice.items)
        )
        .where(Invoice.id == invoice_id)
    )
    return result.scalar_one_or_none()


# ==== STATIC ROUTES FIRST ====

@router.get("", response_model=List[InvoiceResponse])
async def get_invoices(
    carrier_id: Optional[int] = Query(None),
    period: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    proof_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """Get all invoices with filters"""
    query = select(Invoice).options(
        selectinload(Invoice.carrier),
        selectinload(Invoice.items)
    )
    
    filters = []
    if carrier_id:
        filters.append(Invoice.carrier_id == carrier_id)
    if period:
        filters.append(Invoice.period == period)
    if status:
        filters.append(Invoice.status == status)
    if proof_id:
        filters.append(Invoice.proof_id == proof_id)
    
    if filters:
        query = query.where(and_(*filters))
    
    query = query.order_by(Invoice.created_at.desc())
    
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=InvoiceResponse, status_code=201)
async def create_invoice(
    invoice_data: InvoiceCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create new invoice manually"""
    carrier_result = await db.execute(
        select(Carrier).where(Carrier.id == invoice_data.carrier_id)
    )
    if not carrier_result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Carrier not found")
    
    existing = await db.execute(
        select(Invoice).where(
            and_(
                Invoice.carrier_id == invoice_data.carrier_id,
                Invoice.invoice_number == invoice_data.invoice_number
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Invoice with this number already exists")
    
    invoice = Invoice(
        carrier_id=invoice_data.carrier_id,
        proof_id=invoice_data.proof_id,
        invoice_number=invoice_data.invoice_number,
        period=invoice_data.period,
        issue_date=invoice_data.issue_date,
        due_date=invoice_data.due_date,
        total_without_vat=invoice_data.total_without_vat,
        vat_amount=invoice_data.vat_amount,
        total_with_vat=invoice_data.total_with_vat,
        status=invoice_data.status
    )
    db.add(invoice)
    await db.flush()
    
    if invoice_data.items:
        for item in invoice_data.items:
            db.add(InvoiceItem(invoice_id=invoice.id, **item.model_dump()))
    
    await db.commit()
    return await get_invoice_by_id(invoice.id, db)


@router.post("/upload", response_model=InvoiceResponse, status_code=201)
async def upload_invoice(
    file: UploadFile = File(...),
    carrier_id: int = Form(...),
    period: str = Form(...),
    db: AsyncSession = Depends(get_db)
):
    """Upload and parse invoice PDF"""
    carrier_result = await db.execute(
        select(Carrier).where(Carrier.id == carrier_id)
    )
    carrier = carrier_result.scalar_one_or_none()
    if not carrier:
        raise HTTPException(status_code=400, detail="Carrier not found")
    
    content = await file.read()
    
    try:
        parsed = parse_invoice_pdf(content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse PDF: {str(e)}")
    
    if not parsed.invoice_number:
        raise HTTPException(status_code=400, detail="Could not extract invoice number from PDF")
    
    existing = await db.execute(
        select(Invoice).where(
            and_(
                Invoice.carrier_id == carrier_id,
                Invoice.invoice_number == parsed.invoice_number
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"Invoice {parsed.invoice_number} already exists")
    
    invoice_period = parsed.period or period
    
    proof_result = await db.execute(
        select(Proof).where(
            and_(Proof.carrier_id == carrier_id, Proof.period == invoice_period)
        )
    )
    proof = proof_result.scalar_one_or_none()
    
    invoice = Invoice(
        carrier_id=carrier_id,
        proof_id=proof.id if proof else None,
        invoice_number=parsed.invoice_number,
        period=invoice_period,
        issue_date=parsed.issue_date,
        due_date=parsed.due_date,
        total_without_vat=parsed.total_without_vat,
        vat_amount=parsed.vat_amount,
        total_with_vat=parsed.total_with_vat,
        file_url=file.filename,
        status='pending'
    )
    db.add(invoice)
    await db.flush()
    
    if parsed.item_type and parsed.total_without_vat:
        db.add(InvoiceItem(
            invoice_id=invoice.id,
            item_type=parsed.item_type,
            description=f"{parsed.item_type} - {invoice_period}",
            amount=parsed.total_without_vat
        ))
    
    await db.commit()
    return await get_invoice_by_id(invoice.id, db)


@router.post("/parse-preview")
async def parse_preview(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    """Parse PDF without saving - for testing"""
    content = await file.read()
    
    try:
        parsed = parse_invoice_pdf(content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse PDF: {str(e)}")
    
    return {
        'invoiceNumber': parsed.invoice_number,
        'variableSymbol': parsed.variable_symbol,
        'issueDate': parsed.issue_date.isoformat() if parsed.issue_date else None,
        'dueDate': parsed.due_date.isoformat() if parsed.due_date else None,
        'period': parsed.period,
        'itemType': parsed.item_type,
        'totalWithoutVat': str(parsed.total_without_vat) if parsed.total_without_vat else None,
        'vatAmount': str(parsed.vat_amount) if parsed.vat_amount else None,
        'totalWithVat': str(parsed.total_with_vat) if parsed.total_with_vat else None,
        'supplierIco': parsed.supplier_ico,
        'supplierDic': parsed.supplier_dic,
    }


# ==== DYNAMIC ROUTES LAST ====

@router.get("/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice(invoice_id: int, db: AsyncSession = Depends(get_db)):
    """Get single invoice by ID"""
    invoice = await get_invoice_by_id(invoice_id, db)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice


@router.put("/{invoice_id}", response_model=InvoiceResponse)
async def update_invoice(
    invoice_id: int,
    invoice_data: InvoiceUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update invoice"""
    result = await db.execute(select(Invoice).where(Invoice.id == invoice_id))
    invoice = result.scalar_one_or_none()
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    update_data = invoice_data.model_dump(exclude_unset=True, exclude={'items'})
    for field, value in update_data.items():
        setattr(invoice, field, value)
    
    if invoice_data.items is not None:
        await db.execute(
            InvoiceItem.__table__.delete().where(InvoiceItem.invoice_id == invoice_id)
        )
        for item in invoice_data.items:
            db.add(InvoiceItem(invoice_id=invoice.id, **item.model_dump()))
    
    await db.commit()
    return await get_invoice_by_id(invoice.id, db)


@router.delete("/{invoice_id}", status_code=204)
async def delete_invoice(invoice_id: int, db: AsyncSession = Depends(get_db)):
    """Delete invoice"""
    result = await db.execute(select(Invoice).where(Invoice.id == invoice_id))
    invoice = result.scalar_one_or_none()
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    await db.delete(invoice)
    await db.commit()


@router.post("/{invoice_id}/match", response_model=InvoiceResponse)
async def match_invoice_to_proof(
    invoice_id: int,
    proof_id: int = Form(...),
    db: AsyncSession = Depends(get_db)
):
    """Match invoice to proof"""
    result = await db.execute(select(Invoice).where(Invoice.id == invoice_id))
    invoice = result.scalar_one_or_none()
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    proof_result = await db.execute(select(Proof).where(Proof.id == proof_id))
    proof = proof_result.scalar_one_or_none()
    
    if not proof:
        raise HTTPException(status_code=400, detail="Proof not found")
    
    if proof.carrier_id != invoice.carrier_id:
        raise HTTPException(status_code=400, detail="Proof belongs to different carrier")
    
    invoice.proof_id = proof_id
    await db.commit()
    return await get_invoice_by_id(invoice.id, db)
