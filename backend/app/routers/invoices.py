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
    # Remove all whitespace (including non-breaking spaces), replace comma with dot
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
        
        # ===========================================
        # INVOICE NUMBER - try multiple patterns
        # ===========================================
        inv_match = re.search(r'č\.\s*(\d{8})', text, re.IGNORECASE)
        if not inv_match:
            inv_match = re.search(r'FAKTURA[^č]*č\.\s*(\d{8})', text, re.IGNORECASE)
        if not inv_match:
            inv_match = re.search(r'Variabilní symbol:\s*(\d{8})', text, re.IGNORECASE)
        
        if inv_match:
            result.invoice_number = inv_match.group(1)
        
        # Variable symbol (backup)
        vs_match = re.search(r'Variabilní symbol:\s*(\d+)', text, re.IGNORECASE)
        if vs_match:
            result.variable_symbol = vs_match.group(1)
            if not result.invoice_number:
                result.invoice_number = vs_match.group(1)
        
        # ===========================================
        # DATES
        # ===========================================
        issue_match = re.search(r'Datum vystavení:\s*(\d{1,2}\.\d{1,2}\.\d{4})', text, re.IGNORECASE)
        if issue_match:
            result.issue_date = parse_czech_date(issue_match.group(1))
        
        due_match = re.search(r'Datum splatnosti:\s*(\d{1,2}\.\d{1,2}\.\d{4})', text, re.IGNORECASE)
        if due_match:
            result.due_date = parse_czech_date(due_match.group(1))
        
        tax_match = re.search(r'Datum uskutečnění plnění:\s*(\d{1,2}\.\d{1,2}\.\d{4})', text, re.IGNORECASE)
        if tax_match:
            result.tax_date = parse_czech_date(tax_match.group(1))
        
        # ===========================================
        # ITEM TYPE AND PERIOD
        # ===========================================
        item_match = re.search(r'ALZABOXY\s+(FIX|KM|LINEHAUL|DEPO)\s*-\s*(\d{1,2})/(\d{4})', text, re.IGNORECASE)
        if item_match:
            result.item_type = f"ALZABOXY {item_match.group(1).upper()}"
            result.period = f"{item_match.group(2)}/{item_match.group(3)}"
        else:
            # Fallback: look for any MM/YYYY pattern
            period_match = re.search(r'(\d{1,2})/(\d{4})', text)
            if period_match:
                result.period = f"{period_match.group(1)}/{period_match.group(2)}"
        
        # ===========================================
        # AMOUNTS - Multiple extraction strategies
        # ===========================================
        
        # Strategy 1: Extract from line item row
        # Pattern: "ALZABOXY XXX - MM/YYYY 1 3 688 000,00 3 688 000,00 21% 774 480,00 4 462 480,00"
        line_match = re.search(
            r'ALZABOXY\s+(?:FIX|KM|LINEHAUL|DEPO)\s*-\s*\d+/\d+\s+1\s+([\d\s]+,\d{2})\s+([\d\s]+,\d{2})\s+21%\s+([\d\s]+,\d{2})\s+([\d\s]+,\d{2})',
            text, re.IGNORECASE
        )
        
        if line_match:
            result.total_without_vat = parse_amount(line_match.group(2))
            result.vat_amount = parse_amount(line_match.group(3))
            result.total_with_vat = parse_amount(line_match.group(4))
        
        # Strategy 2: Extract from "Součet položek" row
        if not result.total_without_vat:
            sum_match = re.search(
                r'Součet položek\s+([\d\s]+,\d{2})\s+([\d\s]+,\d{2})\s+([\d\s]+,\d{2})',
                text, re.IGNORECASE
            )
            if sum_match:
                result.total_without_vat = parse_amount(sum_match.group(1))
                result.vat_amount = parse_amount(sum_match.group(2))
                result.total_with_vat = parse_amount(sum_match.group(3))
        
        # Strategy 3: Extract from DPH rekapitulace (21% line)
        if not result.total_without_vat:
            rekap_match = re.search(
                r'([\d\s]+,\d{2})\s+21%\s+([\d\s]+,\d{2})\s+([\d\s]+,\d{2})',
                text
            )
            if rekap_match:
                result.total_without_vat = parse_amount(rekap_match.group(1))
                result.vat_amount = parse_amount(rekap_match.group(2))
                result.total_with_vat = parse_amount(rekap_match.group(3))
        
        # Strategy 4: Extract "CELKEM K ÚHRADĚ" as fallback
        if not result.total_with_vat:
            celkem_match = re.search(r'CELKEM K ÚHRADĚ\s+([\d\s]+,\d{2})', text, re.IGNORECASE)
            if celkem_match:
                result.total_with_vat = parse_amount(celkem_match.group(1))
                # Calculate base from total (21% VAT)
                if result.total_with_vat and not result.total_without_vat:
                    result.total_without_vat = round(result.total_with_vat / Decimal('1.21'), 2)
                    result.vat_amount = result.total_with_vat - result.total_without_vat
        
        # ===========================================
        # IČO and DIČ extraction
        # ===========================================
        supplier_ico = re.search(r'IČ:\s*(\d{8})', text)
        if supplier_ico:
            result.supplier_ico = supplier_ico.group(1)
        
        supplier_dic = re.search(r'DIČ:\s*(CZ\d{8,10})', text)
        if supplier_dic:
            result.supplier_dic = supplier_dic.group(1)
        
        # Customer (odběratel)
        customer_section = re.search(
            r'Odběratel:[\s\S]*?IČ:\s*(\d{8})[\s\S]*?DIČ:\s*(CZ\d{8,10})',
            text, re.IGNORECASE
        )
        if customer_section:
            result.customer_ico = customer_section.group(1)
            result.customer_dic = customer_section.group(2)
    
    return result


@router.get("/", response_model=List[InvoiceResponse])
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
        selectinload(Invoice.proof),
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


@router.get("/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice(invoice_id: int, db: AsyncSession = Depends(get_db)):
    """Get single invoice by ID"""
    result = await db.execute(
        select(Invoice)
        .options(
            selectinload(Invoice.carrier),
            selectinload(Invoice.proof),
            selectinload(Invoice.items)
        )
        .where(Invoice.id == invoice_id)
    )
    invoice = result.scalar_one_or_none()
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    return invoice


@router.post("/", response_model=InvoiceResponse, status_code=201)
async def create_invoice(
    invoice_data: InvoiceCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create new invoice manually"""
    # Verify carrier exists
    carrier_result = await db.execute(
        select(Carrier).where(Carrier.id == invoice_data.carrier_id)
    )
    if not carrier_result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Carrier not found")
    
    # Check for duplicate
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
    
    # Create invoice
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
    
    # Add items
    if invoice_data.items:
        for item in invoice_data.items:
            db.add(InvoiceItem(invoice_id=invoice.id, **item.model_dump()))
    
    await db.commit()
    return await get_invoice(invoice.id, db)


@router.post("/upload", response_model=InvoiceResponse, status_code=201)
async def upload_invoice(
    file: UploadFile = File(...),
    carrier_id: int = Form(...),
    period: str = Form(...),
    db: AsyncSession = Depends(get_db)
):
    """Upload and parse invoice PDF"""
    # Verify carrier exists
    carrier_result = await db.execute(
        select(Carrier).where(Carrier.id == carrier_id)
    )
    if not carrier_result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Carrier not found")
    
    # Read file
    content = await file.read()
    
    # Parse PDF
    parsed_data = parse_invoice_pdf(content)
    
    # Use parsed invoice number or extract from filename
    invoice_number = parsed_data.invoice_number
    if not invoice_number:
        filename_match = re.search(r'(\d{8})', file.filename or "")
        invoice_number = filename_match.group(1) if filename_match else f"SCAN-{int(datetime.now().timestamp())}"
    
    # Check for duplicate
    existing_result = await db.execute(
        select(Invoice).where(
            and_(
                Invoice.carrier_id == carrier_id,
                Invoice.invoice_number == invoice_number
            )
        )
    )
    existing = existing_result.scalar_one_or_none()
    
    if existing:
        # Update existing invoice with parsed data
        if parsed_data.total_without_vat:
            existing.total_without_vat = parsed_data.total_without_vat
        if parsed_data.vat_amount:
            existing.vat_amount = parsed_data.vat_amount
        if parsed_data.total_with_vat:
            existing.total_with_vat = parsed_data.total_with_vat
        if parsed_data.issue_date:
            existing.issue_date = parsed_data.issue_date
        if parsed_data.due_date:
            existing.due_date = parsed_data.due_date
        if parsed_data.total_without_vat:
            existing.status = 'parsed'
        
        await db.commit()
        return await get_invoice(existing.id, db)
    
    # Find matching proof
    proof_result = await db.execute(
        select(Proof).where(
            and_(
                Proof.carrier_id == carrier_id,
                Proof.period == (parsed_data.period or period)
            )
        )
    )
    proof = proof_result.scalar_one_or_none()
    
    # Determine item type
    item_type = 'OTHER'
    if parsed_data.item_type:
        if 'FIX' in parsed_data.item_type:
            item_type = 'FIX'
        elif 'KM' in parsed_data.item_type:
            item_type = 'KM'
        elif 'LINEHAUL' in parsed_data.item_type:
            item_type = 'LINEHAUL'
        elif 'DEPO' in parsed_data.item_type:
            item_type = 'DEPO'
    
    # Create invoice
    invoice = Invoice(
        carrier_id=carrier_id,
        proof_id=proof.id if proof else None,
        invoice_number=invoice_number,
        period=parsed_data.period or period,
        file_url=file.filename,
        issue_date=parsed_data.issue_date,
        due_date=parsed_data.due_date,
        total_without_vat=parsed_data.total_without_vat or Decimal('0'),
        vat_amount=parsed_data.vat_amount or Decimal('0'),
        total_with_vat=parsed_data.total_with_vat or Decimal('0'),
        status='parsed' if parsed_data.total_without_vat else 'pending'
    )
    db.add(invoice)
    await db.flush()
    
    # Add item
    db.add(InvoiceItem(
        invoice_id=invoice.id,
        item_type=item_type,
        description=parsed_data.item_type or 'Imported from PDF',
        amount=parsed_data.total_without_vat or Decimal('0')
    ))
    
    await db.commit()
    return await get_invoice(invoice.id, db)


@router.post("/parse-preview")
async def parse_preview(file: UploadFile = File(...)):
    """Parse PDF without saving - for testing"""
    content = await file.read()
    parsed_data = parse_invoice_pdf(content)
    
    return {
        "filename": file.filename,
        "parsed": parsed_data.model_dump()
    }


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
    
    # Update fields
    update_data = invoice_data.model_dump(exclude_unset=True, exclude={'items'})
    for field, value in update_data.items():
        setattr(invoice, field, value)
    
    # Replace items if provided
    if invoice_data.items is not None:
        await db.execute(
            InvoiceItem.__table__.delete().where(InvoiceItem.invoice_id == invoice_id)
        )
        for item in invoice_data.items:
            db.add(InvoiceItem(invoice_id=invoice_id, **item.model_dump()))
    
    await db.commit()
    return await get_invoice(invoice_id, db)


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
    
    invoice.proof_id = proof_id
    invoice.status = 'matched'
    
    await db.commit()
    return await get_invoice(invoice_id, db)
