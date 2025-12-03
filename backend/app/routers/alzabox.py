"""
AlzaBox Router - Import dat a BI API (ASYNC verze)
"""
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, delete, text
from datetime import datetime, timedelta, date
from typing import Optional, List
from decimal import Decimal
import openpyxl
import io
import logging

from app.database import get_db
from app.models import AlzaBox, AlzaBoxAssignment, AlzaBoxDelivery, Carrier

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
    """Import AlzaBox umístění z XLSX souboru."""
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
            depot_name = sheet.cell(row=row, column=24).value
            
            if not code or not name:
                continue
            
            code = str(code).strip()
            
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
            
            carrier_id = carriers.get(carrier_name) if carrier_name else None
            
            clean_depot = None
            if depot_name and depot_name != '_DIRECT':
                clean_depot = depot_name.split('(')[0].strip()
            
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
    """Import dojezdových časů z XLSX souboru."""
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
            await db.flush()
            logger.info(f"Smazáno {result.rowcount} existujících záznamů")
        
        # Načti mapování boxů z DB
        result = await db.execute(select(AlzaBox))
        boxes = {b.code: b.id for b in result.scalars().all()}
        
        # Načti plánované časy z Plan sheetu
        plan_data = {}
        for row in range(3, plan_sheet.max_row + 1):
            route_name = plan_sheet.cell(row=row, column=1).value
            box_code = plan_sheet.cell(row=row, column=2).value
            info = plan_sheet.cell(row=row, column=3).value
            
            if not box_code or not str(box_code).strip():
                continue
            
            box_code = str(box_code).strip()
            
            planned_time = None
            if info and '|' in str(info):
                time_part = str(info).split('|')[0].strip()
                if ':' in time_part and len(time_part) <= 6:
                    planned_time = time_part
            
            plan_data[box_code] = {
                'route_name': route_name,
                'planned_time': planned_time
            }
        
        # Načti skutečné časy ze Skutecnost sheetu
        actual_data = {}
        for row in range(3, actual_sheet.max_row + 1):
            box_code = actual_sheet.cell(row=row, column=2).value
            
            if not box_code or not str(box_code).strip():
                continue
            
            box_code = str(box_code).strip()
            actual_data[box_code] = {}
            
            for col, dt in dates:
                actual_time_val = actual_sheet.cell(row=row, column=col).value
                if actual_time_val and isinstance(actual_time_val, datetime):
                    actual_data[box_code][col] = actual_time_val
        
        # Vytvoř delivery záznamy
        created = 0
        skipped = 0
        
        for box_code, plan_info in plan_data.items():
            if box_code not in boxes:
                skipped += 1
                continue
            
            box_id = boxes[box_code]
            route_name = plan_info['route_name']
            planned_time = plan_info['planned_time']
            
            if box_code not in actual_data:
                continue
            
            for col, dt in dates:
                if col not in actual_data[box_code]:
                    continue
                
                actual_time = actual_data[box_code][col]
                
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
                
                delivery_datetime = datetime.combine(dt, actual_time.time())
                
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
async def delete_all_locations(db: AsyncSession = Depends(get_db)):
    """Smaže všechny AlzaBoxy a jejich assignments"""
    try:
        await db.execute(delete(AlzaBoxDelivery))
        await db.execute(delete(AlzaBoxAssignment))
        result = await db.execute(delete(AlzaBox))
        deleted_count = result.rowcount
        await db.commit()
        
        return {"success": True, "message": f"Smazáno {deleted_count} AlzaBoxů"}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/data/deliveries")
async def delete_deliveries(
    delivery_type: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """Smaže záznamy o doručení."""
    try:
        if delivery_type:
            result = await db.execute(
                delete(AlzaBoxDelivery).where(AlzaBoxDelivery.delivery_type == delivery_type)
            )
        else:
            result = await db.execute(delete(AlzaBoxDelivery))
        
        await db.commit()
        return {"success": True, "message": f"Smazáno {result.rowcount} záznamů"}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# BI API ENDPOINTS
# =============================================================================

@router.get("/stats/summary")
async def get_delivery_summary(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    delivery_type: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """Celkové statistiky doručení"""
    try:
        # Použijeme raw SQL pro jistotu
        sql = """
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN "onTime" = true THEN 1 ELSE 0 END) as on_time,
            AVG("delayMinutes") as avg_delay,
            MAX("delayMinutes") as max_delay,
            MIN("delayMinutes") as min_delay
        FROM "AlzaBoxDelivery"
        WHERE 1=1
        """
        params = {}
        
        if start_date:
            sql += ' AND "deliveryDate" >= :start_date'
            params['start_date'] = datetime.strptime(start_date, "%Y-%m-%d")
        if end_date:
            sql += ' AND "deliveryDate" <= :end_date'
            params['end_date'] = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
        if delivery_type:
            sql += ' AND "deliveryType" = :delivery_type'
            params['delivery_type'] = delivery_type
        
        result = await db.execute(text(sql), params)
        row = result.fetchone()
        
        total = row[0] or 0
        on_time = row[1] or 0
        avg_delay = float(row[2]) if row[2] else 0
        max_delay = row[3] or 0
        min_delay = row[4] or 0
        
        return {
            "totalDeliveries": total,
            "onTimeDeliveries": on_time,
            "onTimePct": round(on_time / total * 100, 1) if total > 0 else 0,
            "avgDelayMinutes": round(avg_delay, 1),
            "maxDelayMinutes": max_delay,
            "earliestMinutes": abs(min_delay) if min_delay < 0 else 0
        }
    except Exception as e:
        logger.error(f"Error in stats/summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats/by-route")
async def get_stats_by_route(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    delivery_type: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """Statistiky per trasa"""
    try:
        sql = """
        SELECT 
            "routeName",
            COUNT(*) as total,
            SUM(CASE WHEN "onTime" = true THEN 1 ELSE 0 END) as on_time,
            AVG("delayMinutes") as avg_delay
        FROM "AlzaBoxDelivery"
        WHERE "routeName" IS NOT NULL
        """
        params = {}
        
        if start_date:
            sql += ' AND "deliveryDate" >= :start_date'
            params['start_date'] = datetime.strptime(start_date, "%Y-%m-%d")
        if end_date:
            sql += ' AND "deliveryDate" <= :end_date'
            params['end_date'] = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
        if delivery_type:
            sql += ' AND "deliveryType" = :delivery_type'
            params['delivery_type'] = delivery_type
        
        sql += ' GROUP BY "routeName" ORDER BY "routeName"'
        
        result = await db.execute(text(sql), params)
        rows = result.fetchall()
        
        return [
            {
                "routeName": row[0],
                "totalDeliveries": row[1],
                "onTimeDeliveries": row[2] or 0,
                "onTimePct": round((row[2] or 0) / row[1] * 100, 1) if row[1] > 0 else 0,
                "avgDelayMinutes": round(float(row[3]), 1) if row[3] else 0
            }
            for row in rows
        ]
    except Exception as e:
        logger.error(f"Error in stats/by-route: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats/by-day")
async def get_stats_by_day(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    delivery_type: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """Statistiky per den"""
    try:
        sql = """
        SELECT 
            DATE("deliveryDate") as date,
            COUNT(*) as total,
            SUM(CASE WHEN "onTime" = true THEN 1 ELSE 0 END) as on_time,
            AVG("delayMinutes") as avg_delay
        FROM "AlzaBoxDelivery"
        WHERE 1=1
        """
        params = {}
        
        if start_date:
            sql += ' AND "deliveryDate" >= :start_date'
            params['start_date'] = datetime.strptime(start_date, "%Y-%m-%d")
        if end_date:
            sql += ' AND "deliveryDate" <= :end_date'
            params['end_date'] = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
        if delivery_type:
            sql += ' AND "deliveryType" = :delivery_type'
            params['delivery_type'] = delivery_type
        
        sql += ' GROUP BY DATE("deliveryDate") ORDER BY DATE("deliveryDate")'
        
        result = await db.execute(text(sql), params)
        rows = result.fetchall()
        
        return [
            {
                "date": str(row[0]),
                "totalDeliveries": row[1],
                "onTimeDeliveries": row[2] or 0,
                "onTimePct": round((row[2] or 0) / row[1] * 100, 1) if row[1] > 0 else 0,
                "avgDelayMinutes": round(float(row[3]), 1) if row[3] else 0
            }
            for row in rows
        ]
    except Exception as e:
        logger.error(f"Error in stats/by-day: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/boxes")
async def get_alzaboxes(
    country: Optional[str] = None,
    region: Optional[str] = None,
    limit: int = Query(100, le=5000),
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    """Seznam AlzaBoxů"""
    try:
        sql = 'SELECT COUNT(*) FROM "AlzaBox" WHERE "isActive" = true'
        params = {}
        
        if country:
            sql += ' AND country = :country'
            params['country'] = country
        if region:
            sql += ' AND region = :region'
            params['region'] = region
        
        result = await db.execute(text(sql), params)
        total = result.scalar()
        
        sql = 'SELECT id, code, name, country, city, region, "gpsLat", "gpsLon" FROM "AlzaBox" WHERE "isActive" = true'
        if country:
            sql += ' AND country = :country'
        if region:
            sql += ' AND region = :region'
        sql += ' LIMIT :limit OFFSET :offset'
        params['limit'] = limit
        params['offset'] = offset
        
        result = await db.execute(text(sql), params)
        rows = result.fetchall()
        
        return {
            "total": total,
            "boxes": [
                {
                    "id": row[0],
                    "code": row[1],
                    "name": row[2],
                    "country": row[3],
                    "city": row[4],
                    "region": row[5],
                    "gpsLat": float(row[6]) if row[6] else None,
                    "gpsLon": float(row[7]) if row[7] else None
                }
                for row in rows
            ]
        }
    except Exception as e:
        logger.error(f"Error in boxes: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/countries")
async def get_countries(db: AsyncSession = Depends(get_db)):
    """Seznam zemí s počty boxů"""
    try:
        sql = """
        SELECT country, COUNT(*) as count 
        FROM "AlzaBox" 
        WHERE "isActive" = true 
        GROUP BY country
        ORDER BY count DESC
        """
        result = await db.execute(text(sql))
        rows = result.fetchall()
        
        return [{"country": row[0], "boxCount": row[1]} for row in rows]
    except Exception as e:
        logger.error(f"Error in countries: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/routes")
async def get_routes(db: AsyncSession = Depends(get_db)):
    """Seznam tras"""
    try:
        sql = """
        SELECT "routeName", COUNT(DISTINCT "boxId") as box_count
        FROM "AlzaBoxDelivery"
        WHERE "routeName" IS NOT NULL
        GROUP BY "routeName"
        ORDER BY "routeName"
        """
        result = await db.execute(text(sql))
        rows = result.fetchall()
        
        return [{"routeName": row[0], "boxCount": row[1]} for row in rows]
    except Exception as e:
        logger.error(f"Error in routes: {e}")
        raise HTTPException(status_code=500, detail=str(e))
