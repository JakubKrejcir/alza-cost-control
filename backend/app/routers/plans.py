"""
Plans API Router - Upload and parse planning XLSX files, compare with proofs
"""
from typing import List, Optional
from datetime import datetime, date, time
from decimal import Decimal
from io import BytesIO
import re
import json
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
import openpyxl

from app.database import get_db
from app.models import Carrier, Proof, ProofRouteDetail

router = APIRouter()


# ============================================================================
# MODELS (inline for now - should be in models.py)
# ============================================================================
from sqlalchemy import String, Integer, Boolean, DateTime, Date, ForeignKey, Text, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Plan(Base):
    """Planning document - represents a daily/weekly route plan"""
    __tablename__ = "Plan"

    id: Mapped[int] = mapped_column(primary_key=True)
    carrier_id: Mapped[int] = mapped_column("carrierId", ForeignKey("Carrier.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255))
    plan_date: Mapped[date] = mapped_column("planDate", Date)
    period: Mapped[Optional[str]] = mapped_column(String(20))
    file_name: Mapped[Optional[str]] = mapped_column("fileName", String(255))
    
    total_routes: Mapped[int] = mapped_column("totalRoutes", Integer, default=0)  # Last mile routes
    linehauls_per_batch: Mapped[int] = mapped_column("linehaulsPerBatch", Integer, default=2)  # LH-LH = 2
    total_distance_km: Mapped[Optional[Decimal]] = mapped_column("totalDistanceKm", Numeric(10, 2))
    total_stops: Mapped[Optional[int]] = mapped_column("totalStops", Integer)
    
    routes_dr: Mapped[int] = mapped_column("routesDr", Integer, default=0)  # Direct routes
    routes_lh: Mapped[int] = mapped_column("routesLh", Integer, default=0)  # Routes with linehaul
    
    status: Mapped[str] = mapped_column(String(50), default="active")
    notes: Mapped[Optional[str]] = mapped_column(Text)
    
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column("updatedAt", DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    carrier: Mapped["Carrier"] = relationship()
    routes: Mapped[List["PlanRoute"]] = relationship(back_populates="plan", cascade="all, delete-orphan")


class PlanRoute(Base):
    """Individual route in a plan"""
    __tablename__ = "PlanRoute"

    id: Mapped[int] = mapped_column(primary_key=True)
    plan_id: Mapped[int] = mapped_column("planId", ForeignKey("Plan.id", ondelete="CASCADE"))
    
    vehicle_id: Mapped[str] = mapped_column("vehicleId", String(100))
    route_code: Mapped[Optional[str]] = mapped_column("routeCode", String(50))
    route_type: Mapped[str] = mapped_column("routeType", String(50))
    
    start_location: Mapped[Optional[str]] = mapped_column("startLocation", String(255))
    distance_km: Mapped[Optional[Decimal]] = mapped_column("distanceKm", Numeric(10, 2))
    work_time_minutes: Mapped[Optional[int]] = mapped_column("workTimeMinutes", Integer)
    stops_count: Mapped[Optional[int]] = mapped_column("stopsCount", Integer)

    plan: Mapped["Plan"] = relationship(back_populates="routes")


class PlanComparison(Base):
    """Comparison between a plan and actual proof"""
    __tablename__ = "PlanComparison"

    id: Mapped[int] = mapped_column(primary_key=True)
    plan_id: Mapped[int] = mapped_column("planId", ForeignKey("Plan.id", ondelete="CASCADE"))
    proof_id: Mapped[int] = mapped_column("proofId", ForeignKey("Proof.id", ondelete="CASCADE"))
    
    routes_planned: Mapped[int] = mapped_column("routesPlanned", Integer, default=0)
    routes_actual: Mapped[int] = mapped_column("routesActual", Integer, default=0)
    routes_difference: Mapped[int] = mapped_column("routesDifference", Integer, default=0)
    
    distance_planned_km: Mapped[Optional[Decimal]] = mapped_column("distancePlannedKm", Numeric(10, 2))
    distance_actual_km: Mapped[Optional[Decimal]] = mapped_column("distanceActualKm", Numeric(10, 2))
    
    cost_planned: Mapped[Optional[Decimal]] = mapped_column("costPlanned", Numeric(12, 2))
    cost_actual: Mapped[Optional[Decimal]] = mapped_column("costActual", Numeric(12, 2))
    cost_difference: Mapped[Optional[Decimal]] = mapped_column("costDifference", Numeric(12, 2))
    
    extra_routes: Mapped[int] = mapped_column("extraRoutes", Integer, default=0)
    missing_routes: Mapped[int] = mapped_column("missingRoutes", Integer, default=0)
    combined_routes: Mapped[int] = mapped_column("combinedRoutes", Integer, default=0)
    reinforcements: Mapped[int] = mapped_column("reinforcements", Integer, default=0)
    
    differences_json: Mapped[Optional[str]] = mapped_column("differencesJson", Text)
    status: Mapped[str] = mapped_column(String(50), default="pending")
    notes: Mapped[Optional[str]] = mapped_column(Text)
    
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, default=datetime.utcnow)

    plan: Mapped["Plan"] = relationship()
    proof: Mapped["Proof"] = relationship()


# ============================================================================
# PARSING FUNCTIONS
# ============================================================================

def parse_plan_from_xlsx(file_content: bytes, plan_date: date) -> dict:
    """Parse planning data from XLSX file
    
    Understanding of route types:
    - LH-LH = 2 linehaul trips for the ENTIRE batch of deliveries (not per route!)
             These are large trucks that bring goods for ALL last mile routes
    - LH = 1 linehaul trip for the entire batch
    - DR = Direct route (no linehaul, directly from warehouse)
    
    DPO = "Do půlnoci objednáš" - morning delivery (ordered before midnight)
    SD = Same Day - evening delivery (ordered before noon)
    
    LH_SD_SPOJENE in proof = 2 last mile routes combined into 1 vehicle
    """
    wb = openpyxl.load_workbook(BytesIO(file_content), data_only=True)
    
    result = {
        'routes': [],
        'total_routes': 0,  # Number of last mile routes (vehicles/deliveries)
        'linehauls_per_batch': 0,  # Number of linehaul trucks per delivery batch (typically 2 for LH-LH)
        'total_distance_km': Decimal('0'),
        'total_stops': 0,
        'routes_dr': 0,  # Direct routes (no linehaul)
        'routes_lh': 0,  # Routes served by linehaul
    }
    
    # Try to find Routes sheet
    routes_sheet = None
    for name in ['Routes', 'Trasy', 'routes']:
        if name in wb.sheetnames:
            routes_sheet = wb[name]
            break
    
    if not routes_sheet:
        routes_sheet = wb.active
    
    # Find header row
    header_row = None
    headers = {}
    for row_idx in range(1, min(10, routes_sheet.max_row + 1)):
        row = [routes_sheet.cell(row=row_idx, column=c).value for c in range(1, routes_sheet.max_column + 1)]
        if any('vozidla' in str(cell).lower() for cell in row if cell) or \
           any('vehicle' in str(cell).lower() for cell in row if cell):
            header_row = row_idx
            for col_idx, cell in enumerate(row):
                if cell:
                    headers[str(cell).lower().strip()] = col_idx
            break
    
    if not header_row:
        raise ValueError("Could not find header row in Routes sheet")
    
    # Map common column names
    col_map = {
        'vehicle_id': next((headers.get(k) for k in ['identifikátor vozidla', 'vehicle', 'vozidlo', 'trasa'] if k in headers), None),
        'carrier': next((headers.get(k) for k in ['dopravce', 'carrier'] if k in headers), None),
        'stops': next((headers.get(k) for k in ['náklad 1', 'stops', 'zastávky', 'počet zastávek'] if k in headers), None),
        'start_location': next((headers.get(k) for k in ['startovní místo', 'start', 'depo'] if k in headers), None),
        'distance': next((headers.get(k) for k in ['celková vzdálenost', 'vzdálenost', 'distance', 'km'] if k in headers), None),
        'work_time': next((headers.get(k) for k in ['čas práce', 'doba', 'time', 'work_time'] if k in headers), None),
        'route_type': next((headers.get(k) for k in ['dr/lh', 'typ', 'type', 'route_type'] if k in headers), None),
    }
    
    # Track linehaul type (LH-LH means 2 trucks for the batch)
    linehaul_type_detected = None
    
    # Parse routes
    for row_idx in range(header_row + 1, routes_sheet.max_row + 1):
        row = [routes_sheet.cell(row=row_idx, column=c).value for c in range(1, routes_sheet.max_column + 1)]
        
        if not row[0]:
            continue
        
        vehicle_id = str(row[col_map['vehicle_id']]) if col_map['vehicle_id'] is not None else str(row[0])
        
        # Extract route code (letter) from vehicle_id like "Moravskoslezsko A" -> "A"
        route_code_match = re.search(r'[A-Z]$', vehicle_id.strip())
        route_code = route_code_match.group(0) if route_code_match else vehicle_id[-1] if vehicle_id else None
        
        # Get route type
        route_type_raw = row[col_map['route_type']] if col_map['route_type'] is not None else 'LH'
        route_type = str(route_type_raw) if route_type_raw else 'LH'
        
        # Detect linehaul type for the batch
        if linehaul_type_detected is None and route_type:
            linehaul_count = route_type.upper().count('LH')
            if linehaul_count > 0:
                result['linehauls_per_batch'] = linehaul_count  # LH-LH = 2, LH = 1
                linehaul_type_detected = route_type
        
        # Categorize route
        is_direct = 'DR' in route_type.upper() and 'LH' not in route_type.upper()
        
        if is_direct:
            result['routes_dr'] += 1
            route_type_normalized = 'DR'
        else:
            result['routes_lh'] += 1
            route_type_normalized = 'LH'
        
        # Get distance
        distance_km = Decimal('0')
        if col_map['distance'] is not None and row[col_map['distance']]:
            try:
                distance_km = Decimal(str(row[col_map['distance']]))
            except:
                pass
        
        # Get stops count
        stops_count = 0
        if col_map['stops'] is not None and row[col_map['stops']]:
            try:
                stops_count = int(row[col_map['stops']])
            except:
                pass
        
        # Get work time in minutes
        work_time_minutes = 0
        if col_map['work_time'] is not None and row[col_map['work_time']]:
            work_time = row[col_map['work_time']]
            if isinstance(work_time, time):
                work_time_minutes = work_time.hour * 60 + work_time.minute
            elif isinstance(work_time, str):
                match = re.match(r'(\d+):(\d+)', work_time)
                if match:
                    work_time_minutes = int(match.group(1)) * 60 + int(match.group(2))
        
        route_data = {
            'vehicle_id': vehicle_id,
            'route_code': route_code,
            'route_type': route_type_normalized,
            'route_type_raw': route_type,
            'start_location': row[col_map['start_location']] if col_map['start_location'] is not None else None,
            'distance_km': distance_km,
            'work_time_minutes': work_time_minutes,
            'stops_count': stops_count,
        }
        
        result['routes'].append(route_data)
        result['total_routes'] += 1
        result['total_distance_km'] += distance_km
        result['total_stops'] += stops_count
    
    return result


def compare_plan_with_proof(plan_data: dict, proof: Proof, plan_routes: list) -> dict:
    """Compare plan with actual proof data
    
    Plan contains:
    - total_routes: number of last mile delivery routes (vehicles/vans)
    - linehauls_per_batch: number of linehaul trucks for the entire batch (LH-LH = 2)
    - routes_lh: routes served by linehaul
    - routes_dr: direct routes
    
    Proof contains:
    - route_details with types: DR, LH_DPO, LH_SD, LH_SD_SPOJENE
    - LH_DPO = morning last mile routes (DPO delivery)
    - LH_SD = evening last mile routes (Same Day delivery)
    - LH_SD_SPOJENE = two last mile routes combined into one vehicle
    - DR = direct routes (no linehaul)
    
    Note: LH-LH means 2 linehaul TRUCKS for ALL routes in the batch,
    not 2 linehauls per route!
    """
    comparison = {
        # Last mile routes comparison
        'routes_planned': plan_data['total_routes'],
        'routes_actual': 0,
        'routes_difference': 0,
        
        # Linehaul trucks (for the entire batch)
        'linehauls_per_batch': plan_data.get('linehauls_per_batch', 2),
        
        # Distance
        'distance_planned_km': float(plan_data['total_distance_km']),
        'distance_actual_km': 0,
        
        # Costs
        'cost_planned': 0,
        'cost_actual': float(proof.grand_total or 0),
        'cost_difference': 0,
        
        # Route breakdown
        'extra_routes': 0,
        'missing_routes': 0,
        'combined_routes': 0,  # LH_SD_SPOJENE count (2 routes merged into 1)
        
        # Detailed comparison
        'differences': [],
        'route_comparison': [],
        
        'plan_breakdown': {
            'total_routes': plan_data['total_routes'],
            'routes_with_linehaul': plan_data['routes_lh'],
            'direct_routes': plan_data['routes_dr'],
            'linehauls_per_batch': plan_data.get('linehauls_per_batch', 2),
        },
        'proof_breakdown': {
            'lh_dpo': 0,
            'lh_sd': 0,
            'lh_sd_spojene': 0,
            'dr': 0,
            'total_routes': 0,
        }
    }
    
    # Parse proof route details
    for route_detail in proof.route_details:
        route_type = route_detail.route_type.upper()
        count = route_detail.count
        
        # Update proof breakdown
        if 'DPO' in route_type or route_type == 'LH_DPO':
            comparison['proof_breakdown']['lh_dpo'] += count
        elif 'SPOJENE' in route_type or 'SPOJENÉ' in route_type:
            comparison['proof_breakdown']['lh_sd_spojene'] += count
            comparison['combined_routes'] += count
        elif 'SD' in route_type or route_type == 'LH_SD':
            comparison['proof_breakdown']['lh_sd'] += count
        elif 'DR' in route_type:
            comparison['proof_breakdown']['dr'] += count
    
    # Calculate actual total routes
    # LH_SD_SPOJENE = 1 vehicle doing 2 routes, so count as 1 for vehicle comparison
    comparison['routes_actual'] = (
        comparison['proof_breakdown']['lh_dpo'] +
        comparison['proof_breakdown']['lh_sd'] +
        comparison['proof_breakdown']['lh_sd_spojene'] +
        comparison['proof_breakdown']['dr']
    )
    comparison['proof_breakdown']['total_routes'] = comparison['routes_actual']
    
    # How many "logical routes" were actually covered
    # Combined routes = 1 vehicle covers 2 routes
    logical_routes_covered = (
        comparison['proof_breakdown']['lh_dpo'] +
        comparison['proof_breakdown']['lh_sd'] +
        (comparison['proof_breakdown']['lh_sd_spojene'] * 2) +  # Each combined = 2 routes
        comparison['proof_breakdown']['dr']
    )
    
    comparison['routes_difference'] = comparison['routes_actual'] - comparison['routes_planned']
    
    # Build route type comparison
    # Compare LH routes (plan) vs LH_DPO + LH_SD + LH_SD_SPOJENE (proof)
    planned_lh = plan_data['routes_lh']
    actual_lh_vehicles = (
        comparison['proof_breakdown']['lh_dpo'] + 
        comparison['proof_breakdown']['lh_sd'] + 
        comparison['proof_breakdown']['lh_sd_spojene']
    )
    lh_diff = actual_lh_vehicles - planned_lh
    
    comparison['route_comparison'].append({
        'type': 'Last Mile trasy (LH)',
        'planned': planned_lh,
        'actual': actual_lh_vehicles,
        'difference': lh_diff,
        'status': 'ok' if lh_diff == 0 else 'extra' if lh_diff > 0 else 'missing',
        'note': f'DPO: {comparison["proof_breakdown"]["lh_dpo"]}, SD: {comparison["proof_breakdown"]["lh_sd"]}, Spojené: {comparison["proof_breakdown"]["lh_sd_spojene"]}'
    })
    
    # Compare DR routes
    planned_dr = plan_data['routes_dr']
    actual_dr = comparison['proof_breakdown']['dr']
    dr_diff = actual_dr - planned_dr
    
    comparison['route_comparison'].append({
        'type': 'Direct trasy (DR)',
        'planned': planned_dr,
        'actual': actual_dr,
        'difference': dr_diff,
        'status': 'ok' if dr_diff == 0 else 'extra' if dr_diff > 0 else 'missing',
        'note': ''
    })
    
    # Info about linehaul trucks
    comparison['route_comparison'].append({
        'type': 'Linehaul kamiony',
        'planned': plan_data.get('linehauls_per_batch', 2),
        'actual': plan_data.get('linehauls_per_batch', 2),  # Same as planned (from proof linehaul section)
        'difference': 0,
        'status': 'info',
        'note': 'LH-LH = 2 kamiony pro celý rozvoz'
    })
    
    # Info about combined routes
    if comparison['combined_routes'] > 0:
        comparison['route_comparison'].append({
            'type': 'Spojené trasy',
            'planned': 0,
            'actual': comparison['combined_routes'],
            'difference': comparison['combined_routes'],
            'status': 'info',
            'note': f'{comparison["combined_routes"]} vozidel pokrývá {comparison["combined_routes"] * 2} tras'
        })
    
    # Generate differences list
    if lh_diff > 0:
        comparison['extra_routes'] += lh_diff
        comparison['differences'].append({
            'type': 'extra',
            'category': 'LH trasy',
            'count': lh_diff,
            'message': f'Více Last Mile tras než plánováno: +{lh_diff}'
        })
    elif lh_diff < 0:
        comparison['missing_routes'] += abs(lh_diff)
        comparison['differences'].append({
            'type': 'missing',
            'category': 'LH trasy',
            'count': abs(lh_diff),
            'message': f'Méně Last Mile tras než plánováno: {lh_diff}'
        })
    
    if dr_diff > 0:
        comparison['extra_routes'] += dr_diff
        comparison['differences'].append({
            'type': 'extra',
            'category': 'DR trasy',
            'count': dr_diff,
            'message': f'Více Direct tras než plánováno: +{dr_diff}'
        })
    elif dr_diff < 0:
        comparison['missing_routes'] += abs(dr_diff)
        comparison['differences'].append({
            'type': 'missing',
            'category': 'DR trasy',
            'count': abs(dr_diff),
            'message': f'Méně Direct tras než plánováno: {dr_diff}'
        })
    
    if comparison['combined_routes'] > 0:
        comparison['differences'].append({
            'type': 'info',
            'category': 'Efektivita',
            'count': comparison['combined_routes'],
            'message': f'Spojeno {comparison["combined_routes"]} tras do jednoho vozidla (úspora {comparison["combined_routes"]} vozidel)'
        })
    
    # Cost difference
    comparison['cost_difference'] = comparison['cost_actual'] - comparison['cost_planned']
    
    return comparison


# ============================================================================
# API ENDPOINTS
# ============================================================================

@router.get("")
async def get_plans(
    carrier_id: Optional[int] = Query(None),
    period: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """Get all plans with optional filters"""
    query = select(Plan).options(selectinload(Plan.carrier))
    
    filters = []
    if carrier_id:
        filters.append(Plan.carrier_id == carrier_id)
    if period:
        filters.append(Plan.period == period)
    
    if filters:
        query = query.where(and_(*filters))
    
    query = query.order_by(Plan.plan_date.desc())
    
    result = await db.execute(query)
    plans = result.scalars().all()
    
    return [{
        'id': p.id,
        'carrierId': p.carrier_id,
        'carrierName': p.carrier.name if p.carrier else None,
        'name': p.name,
        'planDate': p.plan_date.isoformat() if p.plan_date else None,
        'period': p.period,
        'fileName': p.file_name,
        'totalRoutes': p.total_routes,
        'totalDistanceKm': float(p.total_distance_km) if p.total_distance_km else 0,
        'totalStops': p.total_stops,
        'routesDr': p.routes_dr,
        'routesLh': p.routes_lh,
        'status': p.status,
        'createdAt': p.created_at.isoformat() if p.created_at else None,
    } for p in plans]


@router.post("/upload")
async def upload_plan(
    file: UploadFile = File(...),
    carrier_id: int = Form(...),
    plan_date: str = Form(...),  # YYYY-MM-DD format
    db: AsyncSession = Depends(get_db)
):
    """Upload and parse planning XLSX file"""
    # Verify carrier exists
    carrier_result = await db.execute(
        select(Carrier).where(Carrier.id == carrier_id)
    )
    carrier = carrier_result.scalar_one_or_none()
    if not carrier:
        raise HTTPException(status_code=400, detail="Carrier not found")
    
    # Parse date
    try:
        parsed_date = datetime.strptime(plan_date, '%Y-%m-%d').date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    # Calculate period (MM/YYYY)
    period = parsed_date.strftime('%m/%Y')
    
    # Read file content
    content = await file.read()
    
    # Parse XLSX
    try:
        plan_data = parse_plan_from_xlsx(content, parsed_date)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse XLSX: {str(e)}")
    
    # Create plan record
    plan = Plan(
        carrier_id=carrier_id,
        name=file.filename or f"Plan {plan_date}",
        plan_date=parsed_date,
        period=period,
        file_name=file.filename,
        total_routes=plan_data['total_routes'],
        linehauls_per_batch=plan_data['linehauls_per_batch'],
        total_distance_km=plan_data['total_distance_km'],
        total_stops=plan_data['total_stops'],
        routes_dr=plan_data['routes_dr'],
        routes_lh=plan_data['routes_lh'],
        status='active'
    )
    db.add(plan)
    await db.flush()
    
    # Create route records
    for route_data in plan_data['routes']:
        route = PlanRoute(
            plan_id=plan.id,
            vehicle_id=route_data['vehicle_id'],
            route_code=route_data['route_code'],
            route_type=route_data['route_type'],
            start_location=route_data['start_location'],
            distance_km=route_data['distance_km'],
            work_time_minutes=route_data['work_time_minutes'],
            stops_count=route_data['stops_count'],
        )
        db.add(route)
    
    await db.commit()
    
    return {
        'success': True,
        'message': 'Plan uploaded successfully',
        'data': {
            'id': plan.id,
            'name': plan.name,
            'planDate': plan.plan_date.isoformat(),
            'period': plan.period,
            'totalRoutes': plan.total_routes,
            'totalDistanceKm': float(plan.total_distance_km) if plan.total_distance_km else 0,
            'linehaulsPerBatch': plan.linehauls_per_batch,
            'routesDr': plan.routes_dr,
            'routesLh': plan.routes_lh,
            'routes': [{
                'vehicleId': r['vehicle_id'],
                'routeCode': r['route_code'],
                'routeType': r['route_type'],
                'routeTypeRaw': r['route_type_raw'],
                'distanceKm': float(r['distance_km']),
                'stopsCount': r['stops_count'],
            } for r in plan_data['routes']]
        }
    }


@router.get("/{plan_id}")
async def get_plan(plan_id: int, db: AsyncSession = Depends(get_db)):
    """Get plan details with routes"""
    result = await db.execute(
        select(Plan)
        .options(
            selectinload(Plan.carrier),
            selectinload(Plan.routes)
        )
        .where(Plan.id == plan_id)
    )
    plan = result.scalar_one_or_none()
    
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    return {
        'id': plan.id,
        'carrierId': plan.carrier_id,
        'carrierName': plan.carrier.name if plan.carrier else None,
        'name': plan.name,
        'planDate': plan.plan_date.isoformat() if plan.plan_date else None,
        'period': plan.period,
        'fileName': plan.file_name,
        'totalRoutes': plan.total_routes,
        'totalDistanceKm': float(plan.total_distance_km) if plan.total_distance_km else 0,
        'totalStops': plan.total_stops,
        'routesDr': plan.routes_dr,
        'routesLh': plan.routes_lh,
        'status': plan.status,
        'routes': [{
            'id': r.id,
            'vehicleId': r.vehicle_id,
            'routeCode': r.route_code,
            'routeType': r.route_type,
            'startLocation': r.start_location,
            'distanceKm': float(r.distance_km) if r.distance_km else 0,
            'workTimeMinutes': r.work_time_minutes,
            'stopsCount': r.stops_count,
        } for r in plan.routes]
    }


@router.post("/{plan_id}/compare/{proof_id}")
async def compare_plan_with_proof_endpoint(
    plan_id: int,
    proof_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Compare a plan with a proof"""
    # Get plan with routes
    plan_result = await db.execute(
        select(Plan)
        .options(selectinload(Plan.routes))
        .where(Plan.id == plan_id)
    )
    plan = plan_result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    # Get proof with details
    proof_result = await db.execute(
        select(Proof)
        .options(
            selectinload(Proof.carrier),
            selectinload(Proof.route_details)
        )
        .where(Proof.id == proof_id)
    )
    proof = proof_result.scalar_one_or_none()
    if not proof:
        raise HTTPException(status_code=404, detail="Proof not found")
    
    # Verify same carrier
    if plan.carrier_id != proof.carrier_id:
        raise HTTPException(status_code=400, detail="Plan and proof must belong to the same carrier")
    
    # Build plan data dict
    plan_data = {
        'total_routes': plan.total_routes,
        'total_distance_km': plan.total_distance_km or Decimal('0'),
        'routes_dr': plan.routes_dr,
        'routes_lh': plan.routes_lh,
    }
    
    # Run comparison
    comparison = compare_plan_with_proof(plan_data, proof, plan.routes)
    
    # Save comparison
    comp_record = PlanComparison(
        plan_id=plan_id,
        proof_id=proof_id,
        routes_planned=comparison['routes_planned'],
        routes_actual=comparison['routes_actual'],
        routes_difference=comparison['routes_difference'],
        distance_planned_km=Decimal(str(comparison['distance_planned_km'])),
        distance_actual_km=Decimal(str(comparison.get('distance_actual_km', 0))),
        cost_planned=Decimal(str(comparison['cost_planned'])),
        cost_actual=Decimal(str(comparison['cost_actual'])),
        cost_difference=Decimal(str(comparison['cost_difference'])),
        extra_routes=comparison['extra_routes'],
        missing_routes=comparison['missing_routes'],
        combined_routes=comparison['combined_routes'],
        reinforcements=comparison['reinforcements'],
        differences_json=json.dumps(comparison['differences']),
        status='pending'
    )
    db.add(comp_record)
    await db.commit()
    await db.refresh(comp_record)
    
    return {
        'id': comp_record.id,
        'planId': plan_id,
        'proofId': proof_id,
        'plan': {
            'name': plan.name,
            'planDate': plan.plan_date.isoformat() if plan.plan_date else None,
            'totalRoutes': plan.total_routes,
        },
        'proof': {
            'period': proof.period,
            'grandTotal': float(proof.grand_total) if proof.grand_total else 0,
        },
        'comparison': comparison
    }


@router.get("/{plan_id}/comparisons")
async def get_plan_comparisons(plan_id: int, db: AsyncSession = Depends(get_db)):
    """Get all comparisons for a plan"""
    result = await db.execute(
        select(PlanComparison)
        .options(selectinload(PlanComparison.proof))
        .where(PlanComparison.plan_id == plan_id)
        .order_by(PlanComparison.created_at.desc())
    )
    comparisons = result.scalars().all()
    
    return [{
        'id': c.id,
        'planId': c.plan_id,
        'proofId': c.proof_id,
        'proofPeriod': c.proof.period if c.proof else None,
        'routesPlanned': c.routes_planned,
        'routesActual': c.routes_actual,
        'routesDifference': c.routes_difference,
        'costPlanned': float(c.cost_planned) if c.cost_planned else 0,
        'costActual': float(c.cost_actual) if c.cost_actual else 0,
        'costDifference': float(c.cost_difference) if c.cost_difference else 0,
        'extraRoutes': c.extra_routes,
        'missingRoutes': c.missing_routes,
        'combinedRoutes': c.combined_routes,
        'reinforcements': c.reinforcements,
        'status': c.status,
        'createdAt': c.created_at.isoformat() if c.created_at else None,
    } for c in comparisons]


@router.delete("/{plan_id}")
async def delete_plan(plan_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a plan"""
    result = await db.execute(select(Plan).where(Plan.id == plan_id))
    plan = result.scalar_one_or_none()
    
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    await db.delete(plan)
    await db.commit()
    
    return {"success": True, "message": "Plan deleted"}
