"""
AlzaBox Router - Import dat a BI API (ASYNC verze)
"""
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, cast, Integer, Date, delete
from sqlalchemy.orm import selectinload
from datetime import datetime, timedelta
from typing import Optional, List
from decimal import Decimal
import openpyxl
import io
import logging

from app.database import get_db
from app.models import AlzaBox, AlzaBoxAssignment, AlzaBoxDelivery, DeliveryStats, Carrier

router = APIRouter(prefix="/alzabox", tags=["alzabox"])
logger = logging.getLogger(__name__)


# =============================================================================
# IMPORT ENDPOINTS
# =============================================================================

@router.post("/import/locations")
async def import_alzabox_locations(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    """
    Import AlzaBox umístění z XLSX souboru.
    """
    try:
        content = await file.read()
        wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
        
        if 'LL_PS' not in wb.sheetnames:
            raise HTTPException(status_code=400, detail="Sheet 'LL_PS' nenalezen")
        
        sheet = wb['LL_PS']
        
        # Načti existující dopravce
        result = await db.execute(select(Carrier))
        carriers = {c.name: c.id for c in result.scalars().all()}
        
        # Načti existující boxy
        result = await db.execute(select(AlzaBox))
        existing_boxes = {b.code: b for b in result.scalars().all()}
        
        created = 0
        updated = 0
        assignments_created = 0
        
        for row in range(2, sheet.max_row + 1):
            alza_id = sheet.cell(row=row, column=1).value
            code = sheet.cell(row=row, column=2).value
            route_group = sheet.cell(row=row, column=4).value
            source_warehouse = sheet.cell(row=row, column=5).value
            carrier_name = sheet.cell(row=row, column=6).value
            name = sheet.cell(row=row, column=7).value
            country = sheet.cell(row=row, column=8).value
            city = sheet.cell(row=row, column=9).value
            gps_lat = sheet.cell(row=row, column=10).value
            gps_lon = sheet.cell(row=row, column=11).value
            region = sheet.cell(row=row, column=12).value
            first_launch = sheet.cell(row=row, column=13).value
            depot_name = sheet.cell(row=row, column=24).value  # Depo + dopr
            
            if not code or not name:
                continue
            
            # Najdi nebo vytvoř AlzaBox
            if code in existing_boxes:
                box = existing_boxes[code]
                box.name = name
                box.country = country or 'CZ'
                box.city = city
                box.region = region
                box.gps_lat = Decimal(str(gps_lat)) if gps_lat else None
                box.gps_lon = Decimal(str(gps_lon)) if gps_lon else None
                box.source_warehouse = source_warehouse
                box.updated_at = datetime.utcnow()
                updated += 1
            else:
                box = AlzaBox(
                    code=code,
                    alza_id=alza_id,
                    name=name,
                    country=country or 'CZ',
                    city=city,
                    region=region,
                    gps_lat=Decimal(str(gps_lat)) if gps_lat else None,
                    gps_lon=Decimal(str(gps_lon)) if gps_lon else None,
                    source_warehouse=source_warehouse,
                    first_launch=first_launch if isinstance(first_launch, datetime) else None,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow()
                )
                db.add(box)
                await db.flush()
                existing_boxes[code] = box
                created += 1
            
            # Carrier ID
            carrier_id = carriers.get(carrier_name) if carrier_name else None
            
            # Extrahuj depot name
            clean_depot = None
            if depot_name and depot_name != '_DIRECT':
                clean_depot = depot_name.split('(')[0].strip()
            
            # Vytvoř assignment (zjednodušeně - vždy nový)
            assignment = AlzaBoxAssignment(
                box_id=box.id,
                carrier_id=carrier_id,
                route_group=route_group,
                depot_name=clean_depot,
                valid_from=datetime.utcnow(),
                created_at=datetime.utcnow()
            )
            db.add(assignment)
            assignments_created += 1
        
        await db.commit()
        wb.close()
        
        return {
            "success": True,
            "boxes_created": created,
            "boxes_updated": updated,
            "assignments_created": assignments_created
        }
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Error importing locations: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/import/deliveries")
async def import_alzabox_deliveries(
    file: UploadFile = File(...),
    delivery_type: str = Query("DPO", description="Typ závozu: DPO, SD, THIRD"),
    db: AsyncSession = Depends(get_db)
):
    """
    Import dojezdových časů z XLSX souboru.
    DŮLEŽITÉ: Plan a Skutecnost mají různé pořadí řádků, proto párujeme podle box_code!
    Při reimportu smaže existující záznamy pro dané období a delivery_type.
    """
    try:
        content = await file.read()
        wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
        
        if 'Plan' not in wb.sheetnames or 'Skutecnost' not in wb.sheetnames:
            raise HTTPException(status_code=400, detail="Sheety 'Plan' a 'Skutecnost' nenalezeny")
        
        plan_sheet = wb['Plan']
        actual_sheet = wb['Skutecnost']
        
        # Načti datumy ze sloupců (od sloupce 4)
        dates = []
        for col in range(4, plan_sheet.max_column + 1):
            date_val = plan_sheet.cell(row=1, column=col).value
            if isinstance(date_val, datetime):
                dates.append((col, date_val.date()))
        
        # Smaž existující záznamy pro dané období a delivery_type
        if dates:
            min_date = min(d for _, d in dates)
            max_date = max(d for _, d in dates)
            
            # Převedeme na datetime pro správné porovnání
            min_datetime = datetime.combine(min_date, datetime.min.time())
            max_datetime = datetime.combine(max_date, datetime.max.time())
            
            delete_stmt = delete(AlzaBoxDelivery).where(
                and_(
                    AlzaBoxDelivery.delivery_type == delivery_type,
                    AlzaBoxDelivery.delivery_date >= min_datetime,
                    AlzaBoxDelivery.delivery_date <= max_datetime
                )
            )
            result = await db.execute(delete_stmt)
            deleted_count = result.rowcount
            await db.flush()  # Důležité - provést delete před insertem
            logger.info(f"Smazáno {deleted_count} existujících záznamů pro {delivery_type} ({min_date} - {max_date})")
        
        logger.info(f"Nalezeno {len(dates)} datumů")
        
        # Načti mapování boxů z DB
        result = await db.execute(select(AlzaBox))
        boxes = {b.code: b.id for b in result.scalars().all()}
        
        # 1. Načti plánované časy z Plan sheetu
        # Struktura: {box_code: {route_name, planned_time}}
        plan_data = {}
        for row in range(3, plan_sheet.max_row + 1):
            route_name = plan_sheet.cell(row=row, column=1).value
            box_code = plan_sheet.cell(row=row, column=2).value
            info = plan_sheet.cell(row=row, column=3).value
            
            if not box_code or not str(box_code).strip():
                continue
            
            box_code = str(box_code).strip()
            
            # Extrakce plánovaného času z info (např. "09:00 | Brno - Bystrc")
            planned_time = None
            if info and '|' in str(info):
                time_part = str(info).split('|')[0].strip()
                if ':' in time_part and len(time_part) <= 6:
                    planned_time = time_part
            
            plan_data[box_code] = {
                'route_name': route_name,
                'planned_time': planned_time
            }
        
        logger.info(f"Načteno {len(plan_data)} plánů")
        
        # 2. Načti skutečné časy ze Skutecnost sheetu a spáruj podle box_code
        # Struktura: {box_code: {col: actual_datetime}}
        actual_data = {}
        for row in range(3, actual_sheet.max_row + 1):
            box_code = actual_sheet.cell(row=row, column=2).value
            
            if not box_code or not str(box_code).strip():
                continue
            
            box_code = str(box_code).strip()
            actual_data[box_code] = {}
            
            for col, date in dates:
                actual_time_val = actual_sheet.cell(row=row, column=col).value
                if actual_time_val and isinstance(actual_time_val, datetime):
                    actual_data[box_code][col] = actual_time_val
        
        logger.info(f"Načteno {len(actual_data)} skutečností")
        
        # 3. Vytvoř delivery záznamy
        created = 0
        skipped = 0
        
        for box_code, plan_info in plan_data.items():
            if box_code not in boxes:
                skipped += 1
                continue
            
            box_id = boxes[box_code]
            route_name = plan_info['route_name']
            planned_time = plan_info['planned_time']
            
            # Najdi skutečné časy pro tento box
            if box_code not in actual_data:
                continue
            
            for col, date in dates:
                if col not in actual_data[box_code]:
                    continue
                
                actual_time = actual_data[box_code][col]
                
                # Výpočet zpoždění
                delay_minutes = None
                on_time = None
                if planned_time:
                    try:
                        plan_parts = planned_time.split(':')
                        plan_minutes = int(plan_parts[0]) * 60 + int(plan_parts[1])
                        actual_minutes = actual_time.hour * 60 + actual_time.minute
                        delay_minutes = actual_minutes - plan_minutes
                        on_time = delay_minutes <= 0
                    except:
                        pass
                
                # Delivery datetime
                delivery_datetime = datetime.combine(date, actual_time.time())
                
                # Vytvoř delivery záznam
                delivery = AlzaBoxDelivery(
                    box_id=box_id,
                    delivery_date=delivery_datetime,
                    delivery_type=delivery_type,
                    route_name=route_name,
                    planned_time=planned_time,
                    actual_time=actual_time,
                    delay_minutes=delay_minutes,
                    on_time=on_time,
                    created_at=datetime.utcnow()
                )
                db.add(delivery)
                created += 1
        
        await db.commit()
        wb.close()
        
        return {
            "success": True,
            "deliveries_created": created,
            "deliveries_updated": 0,
            "skipped": skipped,
            "dates_processed": len(dates)
        }
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Error importing deliveries: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# DELETE ENDPOINTS
# =============================================================================

@router.delete("/data/locations")
async def delete_all_locations(
    db: AsyncSession = Depends(get_db)
):
    """Smaže všechny AlzaBoxy a jejich assignments"""
    try:
        # Nejdřív smazat závislé záznamy
        await db.execute(delete(AlzaBoxDelivery))
        await db.execute(delete(AlzaBoxAssignment))
        result = await db.execute(delete(AlzaBox))
        deleted_count = result.rowcount
        await db.commit()
        
        return {
            "success": True,
            "message": f"Smazáno {deleted_count} AlzaBoxů a všechny související záznamy"
        }
    except Exception as e:
        await db.rollback()
        logger.error(f"Error deleting locations: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/data/deliveries")
async def delete_deliveries(
    delivery_type: Optional[str] = Query(None, description="Typ závozu: DPO, SD, THIRD. Pokud prázdné, smaže vše."),
    db: AsyncSession = Depends(get_db)
):
    """Smaže záznamy o doručení. Volitelně filtrovat podle typu."""
    try:
        if delivery_type:
            result = await db.execute(
                delete(AlzaBoxDelivery).where(AlzaBoxDelivery.delivery_type == delivery_type)
            )
        else:
            result = await db.execute(delete(AlzaBoxDelivery))
        
        deleted_count = result.rowcount
        await db.commit()
        
        type_msg = f" typu {delivery_type}" if delivery_type else ""
        return {
            "success": True,
            "message": f"Smazáno {deleted_count} záznamů o doručení{type_msg}"
        }
    except Exception as e:
        await db.rollback()
        logger.error(f"Error deleting deliveries: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# BI API ENDPOINTS
# =============================================================================

@router.get("/stats/summary")
async def get_delivery_summary(
    start_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    carrier_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db)
):
    """Celkové statistiky doručení"""
    
    # Základní query
    conditions = []
    if start_date:
        conditions.append(AlzaBoxDelivery.delivery_date >= datetime.strptime(start_date, "%Y-%m-%d"))
    if end_date:
        conditions.append(AlzaBoxDelivery.delivery_date <= datetime.strptime(end_date, "%Y-%m-%d"))
    if carrier_id:
        conditions.append(AlzaBoxDelivery.carrier_id == carrier_id)
    
    # Total count
    query = select(func.count(AlzaBoxDelivery.id))
    if conditions:
        query = query.where(and_(*conditions))
    result = await db.execute(query)
    total = result.scalar() or 0
    
    # On time count
    query = select(func.count(AlzaBoxDelivery.id)).where(AlzaBoxDelivery.on_time == True)
    if conditions:
        query = query.where(and_(*conditions))
    result = await db.execute(query)
    on_time = result.scalar() or 0
    
    # Avg delay
    query = select(func.avg(AlzaBoxDelivery.delay_minutes))
    if conditions:
        query = query.where(and_(*conditions))
    result = await db.execute(query)
    avg_delay = result.scalar() or 0
    
    # Max delay
    query = select(func.max(AlzaBoxDelivery.delay_minutes))
    if conditions:
        query = query.where(and_(*conditions))
    result = await db.execute(query)
    max_delay = result.scalar() or 0
    
    # Min delay (earliest)
    query = select(func.min(AlzaBoxDelivery.delay_minutes))
    if conditions:
        query = query.where(and_(*conditions))
    result = await db.execute(query)
    min_delay = result.scalar() or 0
    
    return {
        "totalDeliveries": total,
        "onTimeDeliveries": on_time,
        "onTimePct": round(on_time / total * 100, 1) if total > 0 else 0,
        "avgDelayMinutes": round(float(avg_delay or 0), 1),
        "maxDelayMinutes": max_delay,
        "earliestMinutes": abs(min_delay) if min_delay and min_delay < 0 else 0
    }


@router.get("/stats/by-route")
async def get_stats_by_route(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    delivery_type: Optional[str] = Query("DPO"),
    db: AsyncSession = Depends(get_db)
):
    """Statistiky per trasa"""
    
    conditions = [AlzaBoxDelivery.route_name.isnot(None)]
    if start_date:
        conditions.append(AlzaBoxDelivery.delivery_date >= datetime.strptime(start_date, "%Y-%m-%d"))
    if end_date:
        conditions.append(AlzaBoxDelivery.delivery_date <= datetime.strptime(end_date, "%Y-%m-%d"))
    if delivery_type:
        conditions.append(AlzaBoxDelivery.delivery_type == delivery_type)
    
    query = select(
        AlzaBoxDelivery.route_name,
        func.count(AlzaBoxDelivery.id).label('total'),
        func.sum(cast(AlzaBoxDelivery.on_time == True, Integer)).label('on_time'),
        func.avg(AlzaBoxDelivery.delay_minutes).label('avg_delay')
    ).where(
        and_(*conditions)
    ).group_by(
        AlzaBoxDelivery.route_name
    ).order_by(
        AlzaBoxDelivery.route_name
    )
    
    result = await db.execute(query)
    rows = result.all()
    
    results = []
    for row in rows:
        total = row.total or 0
        on_time = row.on_time or 0
        results.append({
            "routeName": row.route_name,
            "totalDeliveries": total,
            "onTimeDeliveries": on_time,
            "onTimePct": round(on_time / total * 100, 1) if total > 0 else 0,
            "avgDelayMinutes": round(float(row.avg_delay or 0), 1)
        })
    
    return results


@router.get("/stats/by-day")
async def get_stats_by_day(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    delivery_type: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """Statistiky per den - pro grafy"""
    
    conditions = []
    if start_date:
        conditions.append(AlzaBoxDelivery.delivery_date >= datetime.strptime(start_date, "%Y-%m-%d"))
    if end_date:
        conditions.append(AlzaBoxDelivery.delivery_date <= datetime.strptime(end_date, "%Y-%m-%d"))
    if delivery_type:
        conditions.append(AlzaBoxDelivery.delivery_type == delivery_type)
    
    query = select(
        cast(AlzaBoxDelivery.delivery_date, Date).label('date'),
        func.count(AlzaBoxDelivery.id).label('total'),
        func.sum(cast(AlzaBoxDelivery.on_time == True, Integer)).label('on_time'),
        func.avg(AlzaBoxDelivery.delay_minutes).label('avg_delay')
    ).group_by(
        cast(AlzaBoxDelivery.delivery_date, Date)
    ).order_by(
        cast(AlzaBoxDelivery.delivery_date, Date)
    )
    
    if conditions:
        query = query.where(and_(*conditions))
    
    result = await db.execute(query)
    rows = result.all()
    
    results = []
    for row in rows:
        total = row.total or 0
        on_time = row.on_time or 0
        results.append({
            "date": str(row.date),
            "totalDeliveries": total,
            "onTimeDeliveries": on_time,
            "onTimePct": round(on_time / total * 100, 1) if total > 0 else 0,
            "avgDelayMinutes": round(float(row.avg_delay or 0), 1)
        })
    
    return results


@router.get("/boxes")
async def get_alzaboxes(
    country: Optional[str] = None,
    region: Optional[str] = None,
    limit: int = Query(100, le=5000),
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    """Seznam AlzaBoxů s filtrací"""
    
    conditions = [AlzaBox.is_active == True]
    if country:
        conditions.append(AlzaBox.country == country)
    if region:
        conditions.append(AlzaBox.region == region)
    
    # Count
    count_query = select(func.count(AlzaBox.id)).where(and_(*conditions))
    result = await db.execute(count_query)
    total = result.scalar()
    
    # Data
    query = select(AlzaBox).where(and_(*conditions)).offset(offset).limit(limit)
    result = await db.execute(query)
    boxes = result.scalars().all()
    
    return {
        "total": total,
        "boxes": [
            {
                "id": b.id,
                "code": b.code,
                "name": b.name,
                "country": b.country,
                "city": b.city,
                "region": b.region,
                "gpsLat": float(b.gps_lat) if b.gps_lat else None,
                "gpsLon": float(b.gps_lon) if b.gps_lon else None
            }
            for b in boxes
        ]
    }


@router.get("/countries")
async def get_countries(db: AsyncSession = Depends(get_db)):
    """Seznam zemí s počty boxů"""
    
    query = select(
        AlzaBox.country,
        func.count(AlzaBox.id).label('count')
    ).where(
        AlzaBox.is_active == True
    ).group_by(
        AlzaBox.country
    )
    
    result = await db.execute(query)
    rows = result.all()
    
    return [
        {"country": r.country, "boxCount": r.count}
        for r in rows
    ]


@router.get("/routes")
async def get_routes(
    db: AsyncSession = Depends(get_db)
):
    """Seznam tras s počty boxů"""
    
    query = select(
        AlzaBoxAssignment.route_name,
        AlzaBoxAssignment.depot_name,
        func.count(AlzaBoxAssignment.id).label('count')
    ).where(
        AlzaBoxAssignment.valid_to.is_(None),
        AlzaBoxAssignment.route_name.isnot(None)
    ).group_by(
        AlzaBoxAssignment.route_name,
        AlzaBoxAssignment.depot_name
    )
    
    result = await db.execute(query)
    rows = result.all()
    
    return [
        {
            "routeName": r.route_name,
            "depotName": r.depot_name,
            "boxCount": r.count
        }
        for r in rows
    ]
