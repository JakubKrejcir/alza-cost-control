"""
Route Plans API Router - with XLSX upload and parsing
UPDATED: Support for plan_type (BOTH/DPO/SD) based on filename suffix
"""
from typing import List, Optional
from datetime import datetime, timedelta
from decimal import Decimal
from io import BytesIO
import re
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
import openpyxl

from app.database import get_db
from app.models import RoutePlan, RoutePlanRoute, RoutePlanDetail, Carrier, Proof

router = APIRouter()


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def parse_time_to_hour(time_val) -> Optional[int]:
    """Extract hour from time value"""
    if time_val is None:
        return None
    
    if isinstance(time_val, str):
        match = re.match(r'(\d{1,2}):', time_val)
        if match:
            return int(match.group(1))
    elif hasattr(time_val, 'hour'):
        return time_val.hour
    
    return None


def determine_route_type(start_time) -> str:
    """Determine if route is DPO (morning) or SD (afternoon) based on start time"""
    hour = parse_time_to_hour(start_time)
    if hour is None:
        return "DPO"  # Default
    
    # Before 12:00 = DPO (morning), after = SD (afternoon)
    return "DPO" if hour < 12 else "SD"


def extract_route_letter(route_name: str) -> Optional[str]:
    """Extract letter from route name like 'Moravskoslezsko A' -> 'A'"""
    if not route_name:
        return None
    parts = route_name.strip().split()
    if parts:
        return parts[-1]
    return None


def parse_linehaul_count(delivery_type: str) -> int:
    """Parse LH count from delivery type like 'LH-LH' -> 2"""
    if not delivery_type:
        return 0
    
    # Count occurrences of 'LH'
    return delivery_type.upper().count('LH')


def detect_plan_type_from_filename(filename: str) -> str:
    """
    Detect plan type from filename suffix.
    
    - filename_DPO.xlsx -> DPO (ranní rozvozy)
    - filename_SD.xlsx -> SD (odpolední rozvozy)
    - filename.xlsx -> BOTH (platí pro obojí)
    """
    if not filename:
        return "BOTH"
    
    # Remove extension and check suffix
    name_without_ext = filename.rsplit('.', 1)[0]
    name_upper = name_without_ext.upper()
    
    if name_upper.endswith('_DPO'):
        return "DPO"
    elif name_upper.endswith('_SD'):
        return "SD"
    else:
        return "BOTH"


def parse_date_from_filename(filename: str) -> Optional[datetime]:
    """Extract date from filename like 'Drivecool_25-11-28___kopie.xlsx' -> 2025-11-28"""
    # Pattern: YY-MM-DD or YYYY-MM-DD
    patterns = [
        r'(\d{2})-(\d{2})-(\d{2})',  # YY-MM-DD
        r'(\d{4})-(\d{2})-(\d{2})',  # YYYY-MM-DD
        r'(\d{2})\.(\d{2})\.(\d{2})',  # YY.MM.DD
        r'(\d{4})\.(\d{2})\.(\d{2})',  # YYYY.MM.DD
        r'(\d{2})_(\d{2})_(\d{2})',  # YY_MM_DD
        r'(\d{4})_(\d{2})_(\d{2})',  # YYYY_MM_DD
    ]
    
    for pattern in patterns:
        match = re.search(pattern, filename)
        if match:
            groups = match.groups()
            if len(groups[0]) == 2:
                year = 2000 + int(groups[0])
            else:
                year = int(groups[0])
            month = int(groups[1])
            day = int(groups[2])
            
            try:
                return datetime(year, month, day)
            except ValueError:
                continue
    
    return None


def parse_route_plan_xlsx(file_content: bytes, filename: str) -> dict:
    """Parse route plan data from XLSX"""
    wb = openpyxl.load_workbook(BytesIO(file_content), data_only=True)
    
    result = {
        'valid_from': parse_date_from_filename(filename),
        'plan_type': detect_plan_type_from_filename(filename),
        'routes': [],
        'details': [],  # For future use
        'summary': {
            'total_routes': 0,
            'dpo_routes_count': 0,
            'sd_routes_count': 0,
            'dpo_linehaul_count': 0,
            'sd_linehaul_count': 0,
            'total_distance_km': Decimal('0'),
            'total_stops': 0,
        }
    }
    
    # Parse Routes sheet
    if 'Routes' in wb.sheetnames:
        sheet = wb['Routes']
        
        # Find header row
        headers = {}
        for col in range(1, sheet.max_column + 1):
            val = sheet.cell(row=1, column=col).value
            if val:
                headers[val.strip()] = col
        
        # Map expected columns
        col_map = {
            'route_name': headers.get('Identifikátor vozidla'),
            'carrier': headers.get('Dopravce'),
            'stops': headers.get('Náklad 1'),
            'start_location': headers.get('Startovní místo'),
            'max_capacity': headers.get('Max Náklad 2'),
            'start_time': headers.get('Začátek'),
            'end_time': headers.get('Konec'),
            'distance': headers.get('Celková vzdálenost'),
            'work_time': headers.get('Čas práce'),
            'delivery_type': headers.get('DR/LH'),
        }
        
        dpo_lh_set = set()
        sd_lh_set = set()
        
        for row in range(2, sheet.max_row + 1):
            route_name = sheet.cell(row=row, column=col_map['route_name']).value if col_map['route_name'] else None
            if not route_name:
                continue
            
            def time_to_str(t):
                if t is None:
                    return None
                if isinstance(t, str):
                    return t
                if hasattr(t, 'strftime'):
                    return t.strftime('%H:%M')
                return str(t)
            
            start_time = sheet.cell(row=row, column=col_map['start_time']).value if col_map['start_time'] else None
            start_time_str = time_to_str(start_time)
            route_type = determine_route_type(start_time)
            
            delivery_type = sheet.cell(row=row, column=col_map['delivery_type']).value if col_map['delivery_type'] else None
            delivery_type_str = str(delivery_type).strip().upper() if delivery_type else None
            
            # Count linehauls per batch (LH-LH = 2 kamiony)
            if delivery_type_str and 'LH' in delivery_type_str:
                lh_count = parse_linehaul_count(delivery_type_str)
                if route_type == 'DPO':
                    dpo_lh_set.add(delivery_type_str)
                else:
                    sd_lh_set.add(delivery_type_str)
            
            stops_count = int(sheet.cell(row=row, column=col_map['stops']).value or 0) if col_map['stops'] else 0
            distance = Decimal(str(sheet.cell(row=row, column=col_map['distance']).value or 0)) if col_map['distance'] else Decimal('0')
            
            route_data = {
                'route_name': str(route_name),
                'route_letter': extract_route_letter(str(route_name)),
                'carrier_name': sheet.cell(row=row, column=col_map['carrier']).value if col_map['carrier'] else None,
                'route_type': route_type,
                'delivery_type': delivery_type_str,
                'start_location': sheet.cell(row=row, column=col_map['start_location']).value if col_map['start_location'] else None,
                'stops_count': stops_count,
                'max_capacity': int(sheet.cell(row=row, column=col_map['max_capacity']).value or 0) if col_map['max_capacity'] else 0,
                'start_time': start_time_str,
                'end_time': time_to_str(sheet.cell(row=row, column=col_map['end_time']).value) if col_map['end_time'] else None,
                'work_time': time_to_str(sheet.cell(row=row, column=col_map['work_time']).value) if col_map['work_time'] else None,
                'distance_km': distance,
            }
            
            result['routes'].append(route_data)
            result['summary']['total_routes'] += 1
            result['summary']['total_stops'] += stops_count
            result['summary']['total_distance_km'] += distance
            
            if route_type == 'DPO':
                result['summary']['dpo_routes_count'] += 1
            else:
                result['summary']['sd_routes_count'] += 1
        
        # Počet linehaulů - LH-LH = 2 kamiony pro celý batch
        for lh_type in dpo_lh_set:
            result['summary']['dpo_linehaul_count'] += parse_linehaul_count(lh_type)
        for lh_type in sd_lh_set:
            result['summary']['sd_linehaul_count'] += parse_linehaul_count(lh_type)
    
    return result


async def check_plan_type_conflicts(
    carrier_id: int, 
    valid_from: datetime, 
    new_plan_type: str, 
    db: AsyncSession
) -> Optional[str]:
    """
    Check for plan type conflicts.
    
    Returns error message if conflict exists, None if OK.
    
    Rules:
    - BOTH cannot coexist with DPO or SD
    - DPO and SD can coexist together
    """
    # Get existing plans for this carrier and date
    result = await db.execute(
        select(RoutePlan).where(
            and_(
                RoutePlan.carrier_id == carrier_id,
                RoutePlan.valid_from == valid_from
            )
        )
    )
    existing_plans = result.scalars().all()
    
    if not existing_plans:
        return None  # No conflicts
    
    existing_types = {p.plan_type for p in existing_plans}
    
    # Check conflicts
    if new_plan_type == "BOTH":
        # BOTH cannot coexist with DPO or SD
        if "DPO" in existing_types or "SD" in existing_types:
            conflicts = ", ".join(sorted(existing_types))
            return (
                f"Nelze nahrát plán typu BOTH (bez přípony). "
                f"Pro datum {valid_from.strftime('%d.%m.%Y')} již existují oddělené plány: {conflicts}. "
                f"Nejdříve je smažte, pokud chcete nahrát kombinovaný plán."
            )
    else:
        # DPO or SD cannot coexist with BOTH
        if "BOTH" in existing_types:
            return (
                f"Nelze nahrát plán typu {new_plan_type}. "
                f"Pro datum {valid_from.strftime('%d.%m.%Y')} již existuje kombinovaný plán (BOTH). "
                f"Nejdříve ho smažte, pokud chcete nahrát oddělené plány pro DPO a SD."
            )
    
    return None  # No conflicts


async def update_route_plan_validity(carrier_id: int, db: AsyncSession):
    """Update valid_to dates for route plans based on next plan's valid_from"""
    # Get all plans grouped by plan_type
    for plan_type in ['BOTH', 'DPO', 'SD']:
        result = await db.execute(
            select(RoutePlan)
            .where(
                and_(
                    RoutePlan.carrier_id == carrier_id,
                    RoutePlan.plan_type == plan_type
                )
            )
            .order_by(RoutePlan.valid_from.asc())
        )
        plans = result.scalars().all()
        
        for i, plan in enumerate(plans):
            if i < len(plans) - 1:
                # Set valid_to to day before next plan starts
                next_plan = plans[i + 1]
                plan.valid_to = next_plan.valid_from - timedelta(days=1)
            else:
                # Last plan - no end date
                plan.valid_to = None


async def get_route_plan_by_id(plan_id: int, db: AsyncSession):
    """Helper to get route plan with all details"""
    result = await db.execute(
        select(RoutePlan)
        .options(
            selectinload(RoutePlan.carrier),
            selectinload(RoutePlan.routes),
        )
        .where(RoutePlan.id == plan_id)
    )
    return result.scalar_one_or_none()


# =============================================================================
# API ENDPOINTS
# =============================================================================

@router.get("")
async def get_route_plans(
    carrier_id: Optional[int] = Query(None),
    period: Optional[str] = Query(None),
    plan_type: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """Get all route plans with optional filters"""
    query = select(RoutePlan).options(
        selectinload(RoutePlan.carrier),
        selectinload(RoutePlan.routes)
    )
    
    filters = []
    if carrier_id:
        filters.append(RoutePlan.carrier_id == carrier_id)
    
    if plan_type:
        filters.append(RoutePlan.plan_type == plan_type)
    
    # If period specified (MM/YYYY), find plans valid during that period
    if period:
        try:
            month, year = period.split('/')
            period_start = datetime(int(year), int(month), 1)
            if int(month) == 12:
                period_end = datetime(int(year) + 1, 1, 1) - timedelta(days=1)
            else:
                period_end = datetime(int(year), int(month) + 1, 1) - timedelta(days=1)
            
            filters.append(RoutePlan.valid_from <= period_end)
            filters.append(
                or_(
                    RoutePlan.valid_to == None,
                    RoutePlan.valid_to >= period_start
                )
            )
        except ValueError:
            pass
    
    if filters:
        query = query.where(and_(*filters))
    
    query = query.order_by(RoutePlan.valid_from.desc(), RoutePlan.plan_type)
    
    result = await db.execute(query)
    plans = result.scalars().all()
    
    # Convert to response format
    response = []
    for plan in plans:
        response.append({
            'id': plan.id,
            'carrierId': plan.carrier_id,
            'carrierName': plan.carrier.name if plan.carrier else None,
            'validFrom': plan.valid_from.isoformat() if plan.valid_from else None,
            'validTo': plan.valid_to.isoformat() if plan.valid_to else None,
            'fileName': plan.file_name,
            'planType': plan.plan_type,
            'totalRoutes': plan.total_routes,
            'dpoRoutesCount': plan.dpo_routes_count,
            'sdRoutesCount': plan.sd_routes_count,
            'dpoLinehaulCount': plan.dpo_linehaul_count,
            'sdLinehaulCount': plan.sd_linehaul_count,
            'totalDistanceKm': float(plan.total_distance_km) if plan.total_distance_km else 0,
            'totalStops': plan.total_stops,
            'routesCount': len(plan.routes),
        })
    
    return response


@router.post("/upload", status_code=201)
async def upload_route_plan(
    file: UploadFile = File(...),
    carrier_id: int = Form(...),
    valid_from: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db)
):
    """Upload and parse route plan XLSX"""
    # Verify carrier exists
    carrier_result = await db.execute(
        select(Carrier).where(Carrier.id == carrier_id)
    )
    carrier = carrier_result.scalar_one_or_none()
    if not carrier:
        raise HTTPException(status_code=400, detail="Carrier not found")
    
    content = await file.read()
    
    try:
        plan_data = parse_route_plan_xlsx(content, file.filename)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse XLSX: {str(e)}")
    
    # Detect plan type from filename
    plan_type = plan_data['plan_type']
    
    # Determine valid_from date
    plan_valid_from = None
    if valid_from:
        try:
            plan_valid_from = datetime.fromisoformat(valid_from.replace('Z', '+00:00'))
        except ValueError:
            try:
                # Try DD.MM.YYYY format
                parts = valid_from.split('.')
                plan_valid_from = datetime(int(parts[2]), int(parts[1]), int(parts[0]))
            except:
                pass
    
    if not plan_valid_from:
        plan_valid_from = plan_data['valid_from']
    
    if not plan_valid_from:
        raise HTTPException(
            status_code=400, 
            detail="Could not determine valid_from date. Please specify it manually."
        )
    
    # Check for plan type conflicts
    conflict_error = await check_plan_type_conflicts(
        carrier_id, plan_valid_from, plan_type, db
    )
    if conflict_error:
        raise HTTPException(status_code=409, detail=conflict_error)
    
    # Check if plan already exists for this date AND type (replace it)
    existing_result = await db.execute(
        select(RoutePlan).where(
            and_(
                RoutePlan.carrier_id == carrier_id,
                RoutePlan.valid_from == plan_valid_from,
                RoutePlan.plan_type == plan_type
            )
        )
    )
    existing = existing_result.scalar_one_or_none()
    
    if existing:
        # Delete old plan and recreate
        await db.delete(existing)
        await db.flush()
    
    # Create new plan
    route_plan = RoutePlan(
        carrier_id=carrier_id,
        valid_from=plan_valid_from,
        plan_type=plan_type,
        file_name=file.filename,
        total_routes=plan_data['summary']['total_routes'],
        dpo_routes_count=plan_data['summary']['dpo_routes_count'],
        sd_routes_count=plan_data['summary']['sd_routes_count'],
        dpo_linehaul_count=plan_data['summary']['dpo_linehaul_count'],
        sd_linehaul_count=plan_data['summary']['sd_linehaul_count'],
        total_distance_km=plan_data['summary']['total_distance_km'],
        total_stops=plan_data['summary']['total_stops'],
    )
    db.add(route_plan)
    await db.flush()
    
    # Add routes
    route_map = {}  # For linking details later
    for route_data in plan_data['routes']:
        route = RoutePlanRoute(
            route_plan_id=route_plan.id,
            route_name=route_data['route_name'],
            route_letter=route_data['route_letter'],
            carrier_name=route_data['carrier_name'],
            route_type=route_data['route_type'],
            delivery_type=route_data['delivery_type'],
            start_location=route_data['start_location'],
            stops_count=route_data['stops_count'],
            max_capacity=route_data['max_capacity'],
            start_time=route_data['start_time'],
            end_time=route_data['end_time'],
            work_time=route_data['work_time'],
            distance_km=route_data['distance_km'],
        )
        db.add(route)
        await db.flush()
        route_map[route_data['route_name']] = route.id
    
    # Update validity of all plans for this carrier
    await update_route_plan_validity(carrier_id, db)
    
    await db.commit()
    
    return {
        'success': True,
        'message': f'Plánovací soubor ({plan_type}) úspěšně nahrán',
        'data': {
            'id': route_plan.id,
            'planType': route_plan.plan_type,
            'validFrom': route_plan.valid_from.isoformat(),
            'validTo': route_plan.valid_to.isoformat() if route_plan.valid_to else None,
            'totalRoutes': route_plan.total_routes,
            'dpoRoutesCount': route_plan.dpo_routes_count,
            'sdRoutesCount': route_plan.sd_routes_count,
            'dpoLinehaulCount': route_plan.dpo_linehaul_count,
            'sdLinehaulCount': route_plan.sd_linehaul_count,
            'totalDistanceKm': float(route_plan.total_distance_km) if route_plan.total_distance_km else 0,
            'totalStops': route_plan.total_stops,
        }
    }


@router.get("/{plan_id}")
async def get_route_plan(plan_id: int, db: AsyncSession = Depends(get_db)):
    """Get single route plan with all routes"""
    plan = await get_route_plan_by_id(plan_id, db)
    
    if not plan:
        raise HTTPException(status_code=404, detail="Route plan not found")
    
    return {
        'id': plan.id,
        'carrierId': plan.carrier_id,
        'carrierName': plan.carrier.name if plan.carrier else None,
        'validFrom': plan.valid_from.isoformat() if plan.valid_from else None,
        'validTo': plan.valid_to.isoformat() if plan.valid_to else None,
        'fileName': plan.file_name,
        'planType': plan.plan_type,
        'totalRoutes': plan.total_routes,
        'dpoRoutesCount': plan.dpo_routes_count,
        'sdRoutesCount': plan.sd_routes_count,
        'dpoLinehaulCount': plan.dpo_linehaul_count,
        'sdLinehaulCount': plan.sd_linehaul_count,
        'totalDistanceKm': float(plan.total_distance_km) if plan.total_distance_km else 0,
        'totalStops': plan.total_stops,
        'routes': [
            {
                'id': r.id,
                'routeName': r.route_name,
                'routeLetter': r.route_letter,
                'routeType': r.route_type,
                'deliveryType': r.delivery_type,
                'startLocation': r.start_location,
                'stopsCount': r.stops_count,
                'maxCapacity': r.max_capacity,
                'startTime': r.start_time,
                'endTime': r.end_time,
                'workTime': r.work_time,
                'distanceKm': float(r.distance_km) if r.distance_km else 0,
            }
            for r in plan.routes
        ]
    }


@router.get("/{plan_id}/compare/{proof_id}")
async def compare_plan_vs_proof(
    plan_id: int, 
    proof_id: int, 
    db: AsyncSession = Depends(get_db)
):
    """Compare route plan against proof"""
    # Get plan
    plan = await get_route_plan_by_id(plan_id, db)
    if not plan:
        raise HTTPException(status_code=404, detail="Route plan not found")
    
    # Get proof with details
    proof_result = await db.execute(
        select(Proof)
        .options(
            selectinload(Proof.route_details),
            selectinload(Proof.linehaul_details),
        )
        .where(Proof.id == proof_id)
    )
    proof = proof_result.scalar_one_or_none()
    if not proof:
        raise HTTPException(status_code=404, detail="Proof not found")
    
    # Build comparison
    comparison = {
        'plan': {
            'id': plan.id,
            'planType': plan.plan_type,
            'validFrom': plan.valid_from.isoformat() if plan.valid_from else None,
            'validTo': plan.valid_to.isoformat() if plan.valid_to else None,
            'dpoRoutesCount': plan.dpo_routes_count,
            'sdRoutesCount': plan.sd_routes_count,
            'dpoLinehaulCount': plan.dpo_linehaul_count,
            'sdLinehaulCount': plan.sd_linehaul_count,
        },
        'proof': {
            'id': proof.id,
            'period': proof.period,
            'dpoRoutesCount': 0,
            'sdRoutesCount': 0,
            'sdSpojenCount': 0,
            'linehaulCount': len(proof.linehaul_details) if proof.linehaul_details else 0,
        },
        'differences': [],
        'warnings': [],
        'status': 'ok'
    }
    
    # Count routes by type from proof
    if proof.route_details:
        for detail in proof.route_details:
            if detail.route_type == 'LH_DPO':
                comparison['proof']['dpoRoutesCount'] += detail.routes_count or 0
            elif detail.route_type == 'LH_SD':
                comparison['proof']['sdRoutesCount'] += detail.routes_count or 0
            elif detail.route_type == 'LH_SD_SPOJENE':
                comparison['proof']['sdSpojenCount'] += detail.routes_count or 0
    
    # Adjust comparison based on plan type
    if plan.plan_type == 'DPO':
        # Only compare DPO routes
        dpo_diff = comparison['proof']['dpoRoutesCount'] - comparison['plan']['dpoRoutesCount']
        if dpo_diff != 0:
            comparison['differences'].append({
                'type': 'dpo_routes',
                'label': 'DPO trasy',
                'planned': comparison['plan']['dpoRoutesCount'],
                'actual': comparison['proof']['dpoRoutesCount'],
                'diff': dpo_diff,
                'note': f"{'Více' if dpo_diff > 0 else 'Méně'} tras než plán"
            })
            comparison['status'] = 'warning'
    elif plan.plan_type == 'SD':
        # Only compare SD routes
        sd_diff = comparison['proof']['sdRoutesCount'] - comparison['plan']['sdRoutesCount']
        if sd_diff != 0:
            comparison['differences'].append({
                'type': 'sd_routes',
                'label': 'SD trasy',
                'planned': comparison['plan']['sdRoutesCount'],
                'actual': comparison['proof']['sdRoutesCount'],
                'diff': sd_diff,
                'note': f"{'Více' if sd_diff > 0 else 'Méně'} tras než plán"
            })
            comparison['status'] = 'warning'
    else:
        # BOTH - compare both DPO and SD
        dpo_diff = comparison['proof']['dpoRoutesCount'] - comparison['plan']['dpoRoutesCount']
        sd_diff = comparison['proof']['sdRoutesCount'] - comparison['plan']['sdRoutesCount']
        
        if dpo_diff != 0:
            comparison['differences'].append({
                'type': 'dpo_routes',
                'label': 'DPO trasy',
                'planned': comparison['plan']['dpoRoutesCount'],
                'actual': comparison['proof']['dpoRoutesCount'],
                'diff': dpo_diff,
                'note': f"{'Více' if dpo_diff > 0 else 'Méně'} tras než plán"
            })
            comparison['status'] = 'warning'
        
        if sd_diff != 0:
            comparison['differences'].append({
                'type': 'sd_routes',
                'label': 'SD trasy',
                'planned': comparison['plan']['sdRoutesCount'],
                'actual': comparison['proof']['sdRoutesCount'],
                'diff': sd_diff,
                'note': f"{'Více' if sd_diff > 0 else 'Méně'} tras než plán"
            })
            comparison['status'] = 'warning'
    
    if comparison['proof']['sdSpojenCount'] > 0:
        comparison['warnings'].append({
            'type': 'merged_routes',
            'label': 'Spojené trasy',
            'count': comparison['proof']['sdSpojenCount'],
            'note': f"{comparison['proof']['sdSpojenCount']} spojených SD tras"
        })
    
    # Linehaul comparison
    expected_lh = comparison['plan']['dpoLinehaulCount'] + comparison['plan']['sdLinehaulCount']
    if comparison['proof']['linehaulCount'] != expected_lh:
        comparison['differences'].append({
            'type': 'linehaul',
            'label': 'Linehauly',
            'planned': expected_lh,
            'actual': comparison['proof']['linehaulCount'],
            'diff': comparison['proof']['linehaulCount'] - expected_lh,
            'note': 'Rozdíl v počtu linehaulů'
        })
    
    return comparison


@router.delete("/{plan_id}", status_code=204)
async def delete_route_plan(plan_id: int, db: AsyncSession = Depends(get_db)):
    """Delete route plan"""
    result = await db.execute(select(RoutePlan).where(RoutePlan.id == plan_id))
    plan = result.scalar_one_or_none()
    
    if not plan:
        raise HTTPException(status_code=404, detail="Route plan not found")
    
    carrier_id = plan.carrier_id
    await db.delete(plan)
    
    # Update validity of remaining plans
    await update_route_plan_validity(carrier_id, db)
    
    await db.commit()
