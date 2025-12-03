"""
AlzaBox Router - Import dat a BI API (ASYNC verze)
Rozšířeno o drill-down: Dopravce → Trasa → Box → Detail
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
        
        # Načti assignments pro carrier_id
        result = await db.execute(
            select(AlzaBoxAssignment).order_by(AlzaBoxAssignment.valid_from.desc())
        )
        assignments = {}
        for a in result.scalars().all():
            if a.box_id not in assignments:
                assignments[a.box_id] = a.carrier_id
        
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
        unique_days = set()
        
        for box_code, plan_info in plan_data.items():
            if box_code not in boxes:
                continue
            
            box_id = boxes[box_code]
            carrier_id = assignments.get(box_id)
            route_name = plan_info['route_name']
            planned_time_str = plan_info['planned_time']
            
            for col, delivery_date in dates:
                actual_time = actual_data.get(box_code, {}).get(col)
                
                if not actual_time:
                    continue
                
                # Spočítej plánovaný čas
                planned_time_str_final = None
                planned_datetime = None
                if planned_time_str:
                    try:
                        parts = planned_time_str.split(':')
                        h, m = int(parts[0]), int(parts[1])
                        planned_datetime = datetime.combine(delivery_date, datetime.min.time().replace(hour=h, minute=m))
                        planned_time_str_final = f"{h:02d}:{m:02d}"
                    except:
                        pass
                
                # Spočítej zpoždění
                delay_minutes = None
                on_time = None
                if planned_datetime and actual_time:
                    diff = (actual_time - planned_datetime).total_seconds() / 60
                    delay_minutes = int(diff)
                    on_time = diff <= 0
                
                delivery = AlzaBoxDelivery(
                    box_id=box_id,
                    carrier_id=carrier_id,
                    delivery_date=datetime.combine(delivery_date, datetime.min.time()),
                    delivery_type=delivery_type,
                    route_name=route_name,
                    planned_time=planned_time_str_final,  # String "HH:MM"
                    actual_time=actual_time,
                    delay_minutes=delay_minutes,
                    on_time=on_time,
                    created_at=datetime.utcnow()
                )
                db.add(delivery)
                created += 1
                unique_days.add(delivery_date)
        
        await db.commit()
        wb.close()
        
        return {
            "success": True,
            "deliveries_created": created,
            "deliveries_updated": 0,
            "days_processed": len(unique_days)
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
    """Smaže všechny AlzaBoxy, assignments a deliveries"""
    try:
        await db.execute(text('DELETE FROM "AlzaBoxDelivery"'))
        await db.execute(text('DELETE FROM "AlzaBoxAssignment"'))
        await db.execute(text('DELETE FROM "AlzaBox"'))
        await db.commit()
        return {"success": True, "message": "Všechna data smazána"}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/data/deliveries")
async def delete_deliveries(
    delivery_type: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """Smaže dojezdy (volitelně jen určitý typ)"""
    try:
        if delivery_type:
            result = await db.execute(
                text('DELETE FROM "AlzaBoxDelivery" WHERE "deliveryType" = :dt'),
                {"dt": delivery_type}
            )
        else:
            result = await db.execute(text('DELETE FROM "AlzaBoxDelivery"'))
        await db.commit()
        return {"success": True, "deleted": result.rowcount}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# STATS ENDPOINTS (s carrier_id filtrem)
# =============================================================================

@router.get("/stats/summary")
async def get_stats_summary(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    delivery_type: Optional[str] = Query(None),
    carrier_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """Souhrnné statistiky"""
    try:
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
        if carrier_id:
            sql += ' AND "carrierId" = :carrier_id'
            params['carrier_id'] = carrier_id
        
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
    carrier_id: Optional[int] = Query(None),
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
        if carrier_id:
            sql += ' AND "carrierId" = :carrier_id'
            params['carrier_id'] = carrier_id
        
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
    carrier_id: Optional[int] = Query(None),
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
        if carrier_id:
            sql += ' AND "carrierId" = :carrier_id'
            params['carrier_id'] = carrier_id
        
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


# =============================================================================
# DRILL-DOWN ENDPOINTS
# =============================================================================

@router.get("/stats/by-box")
async def get_stats_by_box(
    route_name: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    delivery_type: Optional[str] = Query(None),
    carrier_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """Statistiky per box (pro drill-down z trasy)"""
    try:
        sql = """
        SELECT 
            d."boxId",
            b.code,
            b.name,
            b.city,
            COUNT(*) as total,
            SUM(CASE WHEN d."onTime" = true THEN 1 ELSE 0 END) as on_time,
            AVG(d."delayMinutes") as avg_delay,
            MAX(d."delayMinutes") as max_delay
        FROM "AlzaBoxDelivery" d
        JOIN "AlzaBox" b ON b.id = d."boxId"
        WHERE 1=1
        """
        params = {}
        
        if route_name:
            sql += ' AND d."routeName" = :route_name'
            params['route_name'] = route_name
        if start_date:
            sql += ' AND d."deliveryDate" >= :start_date'
            params['start_date'] = datetime.strptime(start_date, "%Y-%m-%d")
        if end_date:
            sql += ' AND d."deliveryDate" <= :end_date'
            params['end_date'] = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
        if delivery_type:
            sql += ' AND d."deliveryType" = :delivery_type'
            params['delivery_type'] = delivery_type
        if carrier_id:
            sql += ' AND d."carrierId" = :carrier_id'
            params['carrier_id'] = carrier_id
        
        sql += ' GROUP BY d."boxId", b.code, b.name, b.city ORDER BY on_time ASC, total DESC'
        
        result = await db.execute(text(sql), params)
        rows = result.fetchall()
        
        return [
            {
                "boxId": row[0],
                "boxCode": row[1],
                "boxName": row[2],
                "city": row[3],
                "totalDeliveries": row[4],
                "onTimeDeliveries": row[5] or 0,
                "onTimePct": round((row[5] or 0) / row[4] * 100, 1) if row[4] > 0 else 0,
                "avgDelayMinutes": round(float(row[6]), 1) if row[6] else 0,
                "maxDelayMinutes": row[7] or 0
            }
            for row in rows
        ]
    except Exception as e:
        logger.error(f"Error in stats/by-box: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/box/{box_id}/detail")
async def get_box_detail(
    box_id: int,
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    delivery_type: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """Detail boxu s historií doručení"""
    try:
        # Info o boxu
        box_sql = """
        SELECT 
            b.id, b.code, b.name, b.city, b.region, b.country,
            b."gpsLat", b."gpsLon", b."sourceWarehouse",
            a."carrierId", c.name as carrier_name, a."routeGroup", a."depotName"
        FROM "AlzaBox" b
        LEFT JOIN "AlzaBoxAssignment" a ON a."boxId" = b.id
        LEFT JOIN "Carrier" c ON c.id = a."carrierId"
        WHERE b.id = :box_id
        ORDER BY a."validFrom" DESC
        LIMIT 1
        """
        result = await db.execute(text(box_sql), {"box_id": box_id})
        box_row = result.fetchone()
        
        if not box_row:
            raise HTTPException(status_code=404, detail="Box nenalezen")
        
        # Statistiky
        stats_sql = """
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN "onTime" = true THEN 1 ELSE 0 END) as on_time,
            AVG("delayMinutes") as avg_delay
        FROM "AlzaBoxDelivery"
        WHERE "boxId" = :box_id
        """
        params = {"box_id": box_id}
        
        if start_date:
            stats_sql += ' AND "deliveryDate" >= :start_date'
            params['start_date'] = datetime.strptime(start_date, "%Y-%m-%d")
        if end_date:
            stats_sql += ' AND "deliveryDate" <= :end_date'
            params['end_date'] = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
        if delivery_type:
            stats_sql += ' AND "deliveryType" = :delivery_type'
            params['delivery_type'] = delivery_type
        
        result = await db.execute(text(stats_sql), params)
        stats_row = result.fetchone()
        
        # Historie doručení
        history_sql = """
        SELECT 
            "deliveryDate", "deliveryType", "routeName",
            "plannedTime", "actualTime", "delayMinutes", "onTime"
        FROM "AlzaBoxDelivery"
        WHERE "boxId" = :box_id
        """
        
        if start_date:
            history_sql += ' AND "deliveryDate" >= :start_date'
        if end_date:
            history_sql += ' AND "deliveryDate" <= :end_date'
        if delivery_type:
            history_sql += ' AND "deliveryType" = :delivery_type'
        
        history_sql += ' ORDER BY "deliveryDate" DESC LIMIT 100'
        
        result = await db.execute(text(history_sql), params)
        history_rows = result.fetchall()
        
        # Trend per den (pro graf)
        trend_sql = """
        SELECT 
            DATE("deliveryDate") as date,
            AVG("delayMinutes") as avg_delay,
            COUNT(*) as total,
            SUM(CASE WHEN "onTime" = true THEN 1 ELSE 0 END) as on_time
        FROM "AlzaBoxDelivery"
        WHERE "boxId" = :box_id
        """
        
        if start_date:
            trend_sql += ' AND "deliveryDate" >= :start_date'
        if end_date:
            trend_sql += ' AND "deliveryDate" <= :end_date'
        if delivery_type:
            trend_sql += ' AND "deliveryType" = :delivery_type'
        
        trend_sql += ' GROUP BY DATE("deliveryDate") ORDER BY DATE("deliveryDate")'
        
        result = await db.execute(text(trend_sql), params)
        trend_rows = result.fetchall()
        
        total = stats_row[0] or 0
        on_time = stats_row[1] or 0
        
        return {
            "box": {
                "id": box_row[0],
                "code": box_row[1],
                "name": box_row[2],
                "city": box_row[3],
                "region": box_row[4],
                "country": box_row[5],
                "gpsLat": float(box_row[6]) if box_row[6] else None,
                "gpsLon": float(box_row[7]) if box_row[7] else None,
                "sourceWarehouse": box_row[8],
                "carrierId": box_row[9],
                "carrierName": box_row[10],
                "routeGroup": box_row[11],
                "depotName": box_row[12]
            },
            "stats": {
                "totalDeliveries": total,
                "onTimeDeliveries": on_time,
                "onTimePct": round(on_time / total * 100, 1) if total > 0 else 0,
                "avgDelayMinutes": round(float(stats_row[2]), 1) if stats_row[2] else 0
            },
            "history": [
                {
                    "date": str(row[0].date()) if row[0] else None,
                    "deliveryType": row[1],
                    "routeName": row[2],
                    "plannedTime": row[3].strftime("%H:%M") if row[3] else None,
                    "actualTime": row[4].strftime("%H:%M") if row[4] else None,
                    "delayMinutes": row[5],
                    "onTime": row[6]
                }
                for row in history_rows
            ],
            "trend": [
                {
                    "date": str(row[0]),
                    "avgDelayMinutes": round(float(row[1]), 1) if row[1] else 0,
                    "totalDeliveries": row[2],
                    "onTimePct": round((row[3] or 0) / row[2] * 100, 1) if row[2] > 0 else 0
                }
                for row in trend_rows
            ]
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in box detail: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/carriers")
async def get_alzabox_carriers(db: AsyncSession = Depends(get_db)):
    """Seznam dopravců s AlzaBoxy a jejich statistikami"""
    try:
        sql = """
        SELECT 
            c.id,
            c.name,
            COUNT(DISTINCT d."boxId") as box_count,
            COUNT(d.id) as delivery_count,
            SUM(CASE WHEN d."onTime" = true THEN 1 ELSE 0 END) as on_time_count
        FROM "Carrier" c
        JOIN "AlzaBoxDelivery" d ON d."carrierId" = c.id
        GROUP BY c.id, c.name
        ORDER BY delivery_count DESC
        """
        result = await db.execute(text(sql))
        rows = result.fetchall()
        
        return [
            {
                "id": row[0],
                "name": row[1],
                "boxCount": row[2],
                "deliveryCount": row[3],
                "onTimePct": round((row[4] or 0) / row[3] * 100, 1) if row[3] > 0 else 0
            }
            for row in rows
        ]
    except Exception as e:
        logger.error(f"Error in carriers: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# METADATA ENDPOINTS
# =============================================================================

@router.get("/boxes")
async def get_alzaboxes(
    country: Optional[str] = None,
    region: Optional[str] = None,
    carrier_id: Optional[int] = None,
    limit: int = Query(100, le=5000),
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    """Seznam AlzaBoxů"""
    try:
        base_where = 'WHERE b."isActive" = true'
        params = {}
        
        if country:
            base_where += ' AND b.country = :country'
            params['country'] = country
        if region:
            base_where += ' AND b.region = :region'
            params['region'] = region
        if carrier_id:
            base_where += ' AND a."carrierId" = :carrier_id'
            params['carrier_id'] = carrier_id
        
        # Count
        count_sql = f"""
        SELECT COUNT(DISTINCT b.id) 
        FROM "AlzaBox" b
        LEFT JOIN "AlzaBoxAssignment" a ON a."boxId" = b.id
        {base_where}
        """
        result = await db.execute(text(count_sql), params)
        total = result.scalar()
        
        # Data
        sql = f"""
        SELECT DISTINCT b.id, b.code, b.name, b.country, b.city, b.region, b."gpsLat", b."gpsLon"
        FROM "AlzaBox" b
        LEFT JOIN "AlzaBoxAssignment" a ON a."boxId" = b.id
        {base_where}
        LIMIT :limit OFFSET :offset
        """
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
async def get_routes(
    carrier_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """Seznam tras"""
    try:
        sql = """
        SELECT "routeName", COUNT(DISTINCT "boxId") as box_count
        FROM "AlzaBoxDelivery"
        WHERE "routeName" IS NOT NULL
        """
        params = {}
        
        if carrier_id:
            sql += ' AND "carrierId" = :carrier_id'
            params['carrier_id'] = carrier_id
        
        sql += ' GROUP BY "routeName" ORDER BY "routeName"'
        
        result = await db.execute(text(sql), params)
        rows = result.fetchall()
        
        return [{"routeName": row[0], "boxCount": row[1]} for row in rows]
    except Exception as e:
        logger.error(f"Error in routes: {e}")
        raise HTTPException(status_code=500, detail=str(e))
