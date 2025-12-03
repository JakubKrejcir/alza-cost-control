"""
AlzaBox Router - Import dat a BI API
"""
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, extract
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
    db: Session = Depends(get_db)
):
    """
    Import AlzaBox umístění z XLSX souboru.
    Očekává sheet 'LL_PS' se sloupci:
    - Výdejní místo (id), Kód dopravce, Skupina výdejních míst, 
    - Odesílatel, Dopravce, Název combo, Stát, Město, GPS Y, GPS X, Kraj, etc.
    """
    try:
        content = await file.read()
        wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
        
        if 'LL_PS' not in wb.sheetnames:
            raise HTTPException(status_code=400, detail="Sheet 'LL_PS' nenalezen")
        
        sheet = wb['LL_PS']
        
        # Mapování dopravců z DB
        carriers = {c.name: c.id for c in db.query(Carrier).all()}
        
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
            box = db.query(AlzaBox).filter(AlzaBox.code == code).first()
            
            if box:
                # Update existujícího
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
                # Vytvoř nový
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
                db.flush()
                created += 1
            
            # Vytvoř/aktualizuj assignment
            carrier_id = carriers.get(carrier_name) if carrier_name else None
            
            # Extrahuj depot name (např. "Vratimov (Drive cool)" -> "Vratimov")
            clean_depot = None
            if depot_name and depot_name != '_DIRECT':
                clean_depot = depot_name.split('(')[0].strip()
            
            # Kontrola zda už existuje aktivní assignment
            existing = db.query(AlzaBoxAssignment).filter(
                AlzaBoxAssignment.box_id == box.id,
                AlzaBoxAssignment.valid_to.is_(None)
            ).first()
            
            if existing:
                # Update pokud se změnilo
                if (existing.carrier_id != carrier_id or 
                    existing.route_group != route_group or
                    existing.depot_name != clean_depot):
                    existing.valid_to = datetime.utcnow()
                    
                    new_assignment = AlzaBoxAssignment(
                        box_id=box.id,
                        carrier_id=carrier_id,
                        route_group=route_group,
                        depot_name=clean_depot,
                        valid_from=datetime.utcnow(),
                        created_at=datetime.utcnow()
                    )
                    db.add(new_assignment)
                    assignments_created += 1
            else:
                # Nový assignment
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
        
        db.commit()
        wb.close()
        
        return {
            "success": True,
            "boxes_created": created,
            "boxes_updated": updated,
            "assignments_created": assignments_created
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error importing locations: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/import/deliveries")
async def import_alzabox_deliveries(
    file: UploadFile = File(...),
    delivery_type: str = Query("DPO", description="Typ závozu: DPO, SD, THIRD"),
    db: Session = Depends(get_db)
):
    """
    Import dojezdových časů z XLSX souboru.
    Očekává sheety 'Plan' a 'Skutecnost' s:
    - Trasa, Box, info s plánovaným časem, datumy jako sloupce
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
        
        logger.info(f"Nalezeno {len(dates)} datumů")
        
        # Mapování boxů z DB
        boxes = {b.code: b.id for b in db.query(AlzaBox).all()}
        
        # Mapování dopravců - pokusíme se najít podle trasy
        carriers = {c.name: c.id for c in db.query(Carrier).all()}
        
        created = 0
        updated = 0
        skipped = 0
        
        for row in range(3, plan_sheet.max_row + 1):
            route_name = plan_sheet.cell(row=row, column=1).value
            box_code = plan_sheet.cell(row=row, column=2).value
            info = plan_sheet.cell(row=row, column=3).value
            
            if not box_code or box_code not in boxes:
                skipped += 1
                continue
            
            box_id = boxes[box_code]
            
            # Extrakce plánovaného času z info (např. "09:00 | Brno - Bystrc...")
            planned_time = None
            if info and '|' in str(info):
                time_part = str(info).split('|')[0].strip()
                if ':' in time_part and len(time_part) <= 6:
                    planned_time = time_part
            
            # Pro každé datum
            for col, date in dates:
                actual_time_val = actual_sheet.cell(row=row, column=col).value
                
                if not actual_time_val:
                    continue
                
                # Parse actual time
                actual_time = None
                if isinstance(actual_time_val, datetime):
                    actual_time = actual_time_val
                elif actual_time_val:
                    try:
                        actual_time = datetime.strptime(str(actual_time_val)[:19], "%Y-%m-%d %H:%M:%S")
                    except:
                        pass
                
                if not actual_time:
                    continue
                
                # Výpočet zpoždění
                delay_minutes = None
                on_time = None
                if planned_time and actual_time:
                    try:
                        plan_parts = planned_time.split(':')
                        plan_minutes = int(plan_parts[0]) * 60 + int(plan_parts[1])
                        actual_minutes = actual_time.hour * 60 + actual_time.minute
                        delay_minutes = actual_minutes - plan_minutes
                        on_time = delay_minutes <= 0
                    except:
                        pass
                
                # Delivery date = kombinace date + actual time
                delivery_datetime = datetime.combine(date, actual_time.time())
                
                # Upsert delivery
                existing = db.query(AlzaBoxDelivery).filter(
                    AlzaBoxDelivery.box_id == box_id,
                    func.date(AlzaBoxDelivery.delivery_date) == date,
                    AlzaBoxDelivery.delivery_type == delivery_type
                ).first()
                
                if existing:
                    existing.route_name = route_name
                    existing.planned_time = planned_time
                    existing.actual_time = actual_time
                    existing.delay_minutes = delay_minutes
                    existing.on_time = on_time
                    updated += 1
                else:
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
        
        db.commit()
        wb.close()
        
        # Přepočítej statistiky
        await recalculate_stats(db, dates[0][1] if dates else None, dates[-1][1] if dates else None)
        
        return {
            "success": True,
            "deliveries_created": created,
            "deliveries_updated": updated,
            "skipped": skipped,
            "dates_processed": len(dates)
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error importing deliveries: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def recalculate_stats(db: Session, start_date: datetime = None, end_date: datetime = None):
    """Přepočítá agregované statistiky pro dané období"""
    
    query = db.query(
        func.date(AlzaBoxDelivery.delivery_date).label('stats_date'),
        AlzaBoxDelivery.delivery_type,
        AlzaBoxDelivery.route_name,
        AlzaBoxDelivery.carrier_id,
        func.count(AlzaBoxDelivery.id).label('total_boxes'),
        func.sum(func.cast(AlzaBoxDelivery.on_time == True, Integer)).label('on_time_count'),
        func.sum(func.cast(AlzaBoxDelivery.on_time == False, Integer)).label('late_count'),
        func.avg(AlzaBoxDelivery.delay_minutes).label('avg_delay'),
        func.max(AlzaBoxDelivery.delay_minutes).label('max_delay')
    ).group_by(
        func.date(AlzaBoxDelivery.delivery_date),
        AlzaBoxDelivery.delivery_type,
        AlzaBoxDelivery.route_name,
        AlzaBoxDelivery.carrier_id
    )
    
    if start_date:
        query = query.filter(func.date(AlzaBoxDelivery.delivery_date) >= start_date)
    if end_date:
        query = query.filter(func.date(AlzaBoxDelivery.delivery_date) <= end_date)
    
    from sqlalchemy import Integer
    
    for row in query.all():
        # Upsert stats
        existing = db.query(DeliveryStats).filter(
            func.date(DeliveryStats.stats_date) == row.stats_date,
            DeliveryStats.delivery_type == row.delivery_type,
            DeliveryStats.route_name == row.route_name,
            DeliveryStats.carrier_id == row.carrier_id
        ).first()
        
        total = row.total_boxes or 0
        on_time = row.on_time_count or 0
        on_time_pct = (on_time / total * 100) if total > 0 else 0
        
        if existing:
            existing.total_boxes = total
            existing.delivered_on_time = on_time
            existing.delivered_late = row.late_count or 0
            existing.avg_delay_minutes = row.avg_delay
            existing.max_delay_minutes = row.max_delay
            existing.on_time_pct = Decimal(str(on_time_pct))
        else:
            stats = DeliveryStats(
                stats_date=datetime.combine(row.stats_date, datetime.min.time()),
                delivery_type=row.delivery_type,
                route_name=row.route_name,
                carrier_id=row.carrier_id,
                total_boxes=total,
                delivered_on_time=on_time,
                delivered_late=row.late_count or 0,
                avg_delay_minutes=row.avg_delay,
                max_delay_minutes=row.max_delay,
                on_time_pct=Decimal(str(on_time_pct)),
                created_at=datetime.utcnow()
            )
            db.add(stats)
    
    db.commit()


# =============================================================================
# BI API ENDPOINTS
# =============================================================================

@router.get("/stats/summary")
async def get_delivery_summary(
    start_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    carrier_id: Optional[int] = None,
    country: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Celkové statistiky doručení"""
    
    query = db.query(
        func.count(AlzaBoxDelivery.id).label('total_deliveries'),
        func.sum(func.cast(AlzaBoxDelivery.on_time == True, Integer)).label('on_time'),
        func.avg(AlzaBoxDelivery.delay_minutes).label('avg_delay'),
        func.max(AlzaBoxDelivery.delay_minutes).label('max_delay'),
        func.min(AlzaBoxDelivery.delay_minutes).label('min_delay')
    )
    
    if start_date:
        query = query.filter(AlzaBoxDelivery.delivery_date >= datetime.strptime(start_date, "%Y-%m-%d"))
    if end_date:
        query = query.filter(AlzaBoxDelivery.delivery_date <= datetime.strptime(end_date, "%Y-%m-%d"))
    if carrier_id:
        query = query.filter(AlzaBoxDelivery.carrier_id == carrier_id)
    
    from sqlalchemy import Integer
    
    result = query.first()
    
    total = result.total_deliveries or 0
    on_time = result.on_time or 0
    
    return {
        "totalDeliveries": total,
        "onTimeDeliveries": on_time,
        "onTimePct": round(on_time / total * 100, 1) if total > 0 else 0,
        "avgDelayMinutes": round(float(result.avg_delay or 0), 1),
        "maxDelayMinutes": result.max_delay,
        "earliestMinutes": abs(result.min_delay) if result.min_delay and result.min_delay < 0 else 0
    }


@router.get("/stats/by-route")
async def get_stats_by_route(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    delivery_type: Optional[str] = Query("DPO"),
    db: Session = Depends(get_db)
):
    """Statistiky per trasa"""
    
    from sqlalchemy import Integer
    
    query = db.query(
        AlzaBoxDelivery.route_name,
        func.count(AlzaBoxDelivery.id).label('total'),
        func.sum(func.cast(AlzaBoxDelivery.on_time == True, Integer)).label('on_time'),
        func.avg(AlzaBoxDelivery.delay_minutes).label('avg_delay')
    ).filter(
        AlzaBoxDelivery.route_name.isnot(None)
    ).group_by(
        AlzaBoxDelivery.route_name
    )
    
    if start_date:
        query = query.filter(AlzaBoxDelivery.delivery_date >= datetime.strptime(start_date, "%Y-%m-%d"))
    if end_date:
        query = query.filter(AlzaBoxDelivery.delivery_date <= datetime.strptime(end_date, "%Y-%m-%d"))
    if delivery_type:
        query = query.filter(AlzaBoxDelivery.delivery_type == delivery_type)
    
    results = []
    for row in query.order_by(AlzaBoxDelivery.route_name).all():
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
    db: Session = Depends(get_db)
):
    """Statistiky per den - pro grafy"""
    
    from sqlalchemy import Integer
    
    query = db.query(
        func.date(AlzaBoxDelivery.delivery_date).label('date'),
        func.count(AlzaBoxDelivery.id).label('total'),
        func.sum(func.cast(AlzaBoxDelivery.on_time == True, Integer)).label('on_time'),
        func.avg(AlzaBoxDelivery.delay_minutes).label('avg_delay')
    ).group_by(
        func.date(AlzaBoxDelivery.delivery_date)
    )
    
    if start_date:
        query = query.filter(AlzaBoxDelivery.delivery_date >= datetime.strptime(start_date, "%Y-%m-%d"))
    if end_date:
        query = query.filter(AlzaBoxDelivery.delivery_date <= datetime.strptime(end_date, "%Y-%m-%d"))
    if delivery_type:
        query = query.filter(AlzaBoxDelivery.delivery_type == delivery_type)
    
    results = []
    for row in query.order_by(func.date(AlzaBoxDelivery.delivery_date)).all():
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


@router.get("/stats/heatmap")
async def get_delay_heatmap(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Heatmapa zpoždění per trasa a den"""
    
    query = db.query(
        func.date(AlzaBoxDelivery.delivery_date).label('date'),
        AlzaBoxDelivery.route_name,
        func.avg(AlzaBoxDelivery.delay_minutes).label('avg_delay'),
        func.count(AlzaBoxDelivery.id).label('count')
    ).filter(
        AlzaBoxDelivery.route_name.isnot(None)
    ).group_by(
        func.date(AlzaBoxDelivery.delivery_date),
        AlzaBoxDelivery.route_name
    )
    
    if start_date:
        query = query.filter(AlzaBoxDelivery.delivery_date >= datetime.strptime(start_date, "%Y-%m-%d"))
    if end_date:
        query = query.filter(AlzaBoxDelivery.delivery_date <= datetime.strptime(end_date, "%Y-%m-%d"))
    
    results = []
    for row in query.all():
        results.append({
            "date": str(row.date),
            "routeName": row.route_name,
            "avgDelayMinutes": round(float(row.avg_delay or 0), 1),
            "deliveryCount": row.count
        })
    
    return results


@router.get("/boxes")
async def get_alzaboxes(
    country: Optional[str] = None,
    region: Optional[str] = None,
    carrier_id: Optional[int] = None,
    limit: int = Query(100, le=5000),
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """Seznam AlzaBoxů s filtrací"""
    
    query = db.query(AlzaBox).filter(AlzaBox.is_active == True)
    
    if country:
        query = query.filter(AlzaBox.country == country)
    if region:
        query = query.filter(AlzaBox.region == region)
    
    # Join s assignments pro filtr podle dopravce
    if carrier_id:
        query = query.join(AlzaBoxAssignment).filter(
            AlzaBoxAssignment.carrier_id == carrier_id,
            AlzaBoxAssignment.valid_to.is_(None)
        )
    
    total = query.count()
    boxes = query.offset(offset).limit(limit).all()
    
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


@router.get("/boxes/map")
async def get_boxes_for_map(
    country: Optional[str] = Query("CZ"),
    db: Session = Depends(get_db)
):
    """Boxy pro zobrazení na mapě - pouze s GPS"""
    
    boxes = db.query(AlzaBox).filter(
        AlzaBox.is_active == True,
        AlzaBox.gps_lat.isnot(None),
        AlzaBox.gps_lon.isnot(None)
    )
    
    if country:
        boxes = boxes.filter(AlzaBox.country == country)
    
    return [
        {
            "code": b.code,
            "name": b.name,
            "city": b.city,
            "lat": float(b.gps_lat),
            "lon": float(b.gps_lon)
        }
        for b in boxes.all()
    ]


@router.get("/countries")
async def get_countries(db: Session = Depends(get_db)):
    """Seznam zemí s počty boxů"""
    
    results = db.query(
        AlzaBox.country,
        func.count(AlzaBox.id).label('count')
    ).filter(
        AlzaBox.is_active == True
    ).group_by(
        AlzaBox.country
    ).all()
    
    return [
        {"country": r.country, "boxCount": r.count}
        for r in results
    ]


@router.get("/routes")
async def get_routes(
    country: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Seznam tras s počty boxů"""
    
    query = db.query(
        AlzaBoxAssignment.route_name,
        AlzaBoxAssignment.depot_name,
        func.count(AlzaBoxAssignment.id).label('count')
    ).filter(
        AlzaBoxAssignment.valid_to.is_(None),
        AlzaBoxAssignment.route_name.isnot(None)
    ).group_by(
        AlzaBoxAssignment.route_name,
        AlzaBoxAssignment.depot_name
    )
    
    return [
        {
            "routeName": r.route_name,
            "depotName": r.depot_name,
            "boxCount": r.count
        }
        for r in query.all()
    ]
