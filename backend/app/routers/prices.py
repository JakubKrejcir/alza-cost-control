"""
Prices API Router
Updated: 2025-12-05 - Added depot, warehouse relationships loading
"""
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import (
    PriceConfig, Carrier, FixRate, KmRate, DepoRate, LinehaulRate, BonusRate,
    Depot, Warehouse  # NEW
)
from app.schemas import (
    PriceConfigCreate, PriceConfigUpdate, PriceConfigResponse
)

router = APIRouter()


@router.get("", response_model=List[PriceConfigResponse])
async def get_price_configs(
    carrier_id: Optional[int] = Query(None),
    type: Optional[str] = Query(None),
    active: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """Get all price configs with filters - includes depot/warehouse relationships"""
    query = select(PriceConfig).options(
        selectinload(PriceConfig.carrier),
        selectinload(PriceConfig.contract),
        # FIX rates with depot
        selectinload(PriceConfig.fix_rates).selectinload(FixRate.depot),
        # KM rates with depot
        selectinload(PriceConfig.km_rates).selectinload(KmRate.depot),
        # Depo rates with depot
        selectinload(PriceConfig.depo_rates).selectinload(DepoRate.depot),
        # Linehaul rates with warehouse
        selectinload(PriceConfig.linehaul_rates).selectinload(LinehaulRate.from_warehouse),
        selectinload(PriceConfig.linehaul_rates).selectinload(LinehaulRate.from_depot),
        selectinload(PriceConfig.linehaul_rates).selectinload(LinehaulRate.to_depot),
        # Bonus rates with depot
        selectinload(PriceConfig.bonus_rates).selectinload(BonusRate.depot),
    )
    
    filters = []
    if carrier_id:
        filters.append(PriceConfig.carrier_id == carrier_id)
    if type:
        filters.append(PriceConfig.type == type)
    if active is not None:
        filters.append(PriceConfig.is_active == active)
    
    if filters:
        query = query.where(and_(*filters))
    
    query = query.order_by(PriceConfig.valid_from.desc())
    
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/active", response_model=PriceConfigResponse)
async def get_active_price_config(
    carrier_id: int = Query(...),
    type: str = Query(...),
    date: Optional[datetime] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """Get active price config for carrier, type, and date"""
    target_date = date or datetime.utcnow()
    
    result = await db.execute(
        select(PriceConfig)
        .options(
            selectinload(PriceConfig.fix_rates).selectinload(FixRate.depot),
            selectinload(PriceConfig.km_rates).selectinload(KmRate.depot),
            selectinload(PriceConfig.depo_rates).selectinload(DepoRate.depot),
            selectinload(PriceConfig.linehaul_rates).selectinload(LinehaulRate.from_warehouse),
            selectinload(PriceConfig.bonus_rates).selectinload(BonusRate.depot),
        )
        .where(
            and_(
                PriceConfig.carrier_id == carrier_id,
                PriceConfig.type == type,
                PriceConfig.is_active == True,
                PriceConfig.valid_from <= target_date,
                or_(
                    PriceConfig.valid_to == None,
                    PriceConfig.valid_to >= target_date
                )
            )
        )
        .order_by(PriceConfig.valid_from.desc())
    )
    price_config = result.scalars().first()
    
    if not price_config:
        raise HTTPException(status_code=404, detail="No active price config found")
    
    return price_config


@router.get("/{price_config_id}", response_model=PriceConfigResponse)
async def get_price_config(price_config_id: int, db: AsyncSession = Depends(get_db)):
    """Get single price config by ID"""
    result = await db.execute(
        select(PriceConfig)
        .options(
            selectinload(PriceConfig.carrier),
            selectinload(PriceConfig.contract),
            selectinload(PriceConfig.fix_rates).selectinload(FixRate.depot),
            selectinload(PriceConfig.km_rates).selectinload(KmRate.depot),
            selectinload(PriceConfig.depo_rates).selectinload(DepoRate.depot),
            selectinload(PriceConfig.linehaul_rates).selectinload(LinehaulRate.from_warehouse),
            selectinload(PriceConfig.bonus_rates).selectinload(BonusRate.depot),
        )
        .where(PriceConfig.id == price_config_id)
    )
    price_config = result.scalar_one_or_none()
    
    if not price_config:
        raise HTTPException(status_code=404, detail="Price config not found")
    
    return price_config


@router.post("", response_model=PriceConfigResponse)
async def create_price_config(
    config_data: PriceConfigCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create new price config with rates"""
    # Verify carrier exists
    carrier_result = await db.execute(
        select(Carrier).where(Carrier.id == config_data.carrier_id)
    )
    if not carrier_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Carrier not found")
    
    # Create price config
    price_config = PriceConfig(
        carrier_id=config_data.carrier_id,
        contract_id=config_data.contract_id,
        type=config_data.type,
        valid_from=config_data.valid_from,
        valid_to=config_data.valid_to,
        is_active=config_data.is_active
    )
    db.add(price_config)
    await db.flush()
    
    # Add rates with new fields
    if config_data.fix_rates:
        for rate in config_data.fix_rates:
            db.add(FixRate(
                price_config_id=price_config.id,
                route_type=rate.route_type,
                rate=rate.rate,
                depot_id=rate.depot_id,
                route_category=rate.route_category,
            ))
    
    if config_data.km_rates:
        for rate in config_data.km_rates:
            db.add(KmRate(
                price_config_id=price_config.id,
                route_type=rate.route_type,
                rate=rate.rate,
                depot_id=rate.depot_id,
            ))
    
    if config_data.depo_rates:
        for rate in config_data.depo_rates:
            db.add(DepoRate(
                price_config_id=price_config.id,
                depo_name=rate.depo_name,
                rate_type=rate.rate_type,
                rate=rate.rate,
                depot_id=rate.depot_id,
            ))
    
    if config_data.linehaul_rates:
        for rate in config_data.linehaul_rates:
            db.add(LinehaulRate(
                price_config_id=price_config.id,
                from_code=rate.from_code,
                to_code=rate.to_code,
                vehicle_type=rate.vehicle_type,
                rate=rate.rate,
                from_depot_id=rate.from_depot_id,
                to_depot_id=rate.to_depot_id,
                is_posila=rate.is_posila,
                description=rate.description,
                from_warehouse_id=rate.from_warehouse_id,
                pallet_capacity_min=rate.pallet_capacity_min,
                pallet_capacity_max=rate.pallet_capacity_max,
            ))
    
    if config_data.bonus_rates:
        for rate in config_data.bonus_rates:
            db.add(BonusRate(
                price_config_id=price_config.id,
                quality_min=rate.quality_min,
                quality_max=rate.quality_max,
                bonus_amount=rate.bonus_amount,
                total_with_bonus=rate.total_with_bonus,
                depot_id=rate.depot_id,
            ))
    
    await db.commit()
    
    # Fetch with all relations
    return await get_price_config(price_config.id, db)


@router.put("/{price_config_id}", response_model=PriceConfigResponse)
async def update_price_config(
    price_config_id: int,
    config_data: PriceConfigUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update price config and optionally replace rates"""
    result = await db.execute(
        select(PriceConfig).where(PriceConfig.id == price_config_id)
    )
    price_config = result.scalar_one_or_none()
    
    if not price_config:
        raise HTTPException(status_code=404, detail="Price config not found")
    
    # Update main fields
    update_data = config_data.model_dump(
        exclude_unset=True, 
        exclude={'fix_rates', 'km_rates', 'depo_rates', 'linehaul_rates', 'bonus_rates'}
    )
    for field, value in update_data.items():
        setattr(price_config, field, value)
    
    # Replace rates if provided - with new fields
    if config_data.fix_rates is not None:
        await db.execute(
            FixRate.__table__.delete().where(FixRate.price_config_id == price_config_id)
        )
        for rate in config_data.fix_rates:
            db.add(FixRate(
                price_config_id=price_config_id,
                route_type=rate.route_type,
                rate=rate.rate,
                depot_id=rate.depot_id,
                route_category=rate.route_category,
            ))
    
    if config_data.km_rates is not None:
        await db.execute(
            KmRate.__table__.delete().where(KmRate.price_config_id == price_config_id)
        )
        for rate in config_data.km_rates:
            db.add(KmRate(
                price_config_id=price_config_id,
                route_type=rate.route_type,
                rate=rate.rate,
                depot_id=rate.depot_id,
            ))
    
    if config_data.depo_rates is not None:
        await db.execute(
            DepoRate.__table__.delete().where(DepoRate.price_config_id == price_config_id)
        )
        for rate in config_data.depo_rates:
            db.add(DepoRate(
                price_config_id=price_config_id,
                depo_name=rate.depo_name,
                rate_type=rate.rate_type,
                rate=rate.rate,
                depot_id=rate.depot_id,
            ))
    
    if config_data.linehaul_rates is not None:
        await db.execute(
            LinehaulRate.__table__.delete().where(LinehaulRate.price_config_id == price_config_id)
        )
        for rate in config_data.linehaul_rates:
            db.add(LinehaulRate(
                price_config_id=price_config_id,
                from_code=rate.from_code,
                to_code=rate.to_code,
                vehicle_type=rate.vehicle_type,
                rate=rate.rate,
                from_depot_id=rate.from_depot_id,
                to_depot_id=rate.to_depot_id,
                is_posila=rate.is_posila,
                description=rate.description,
                from_warehouse_id=rate.from_warehouse_id,
                pallet_capacity_min=rate.pallet_capacity_min,
                pallet_capacity_max=rate.pallet_capacity_max,
            ))
    
    if config_data.bonus_rates is not None:
        await db.execute(
            BonusRate.__table__.delete().where(BonusRate.price_config_id == price_config_id)
        )
        for rate in config_data.bonus_rates:
            db.add(BonusRate(
                price_config_id=price_config_id,
                quality_min=rate.quality_min,
                quality_max=rate.quality_max,
                bonus_amount=rate.bonus_amount,
                total_with_bonus=rate.total_with_bonus,
                depot_id=rate.depot_id,
            ))
    
    await db.commit()
    
    # Fetch updated with all relations
    return await get_price_config(price_config_id, db)


@router.delete("/{price_config_id}", status_code=204)
async def delete_price_config(price_config_id: int, db: AsyncSession = Depends(get_db)):
    """Delete price config"""
    result = await db.execute(
        select(PriceConfig).where(PriceConfig.id == price_config_id)
    )
    price_config = result.scalar_one_or_none()
    
    if not price_config:
        raise HTTPException(status_code=404, detail="Price config not found")
    
    await db.delete(price_config)
    await db.commit()


# =============================================================================
# NEW: Warehouse endpoints
# =============================================================================

@router.get("/warehouses", response_model=list)
async def get_warehouses(db: AsyncSession = Depends(get_db)):
    """Get all warehouses"""
    result = await db.execute(
        select(Warehouse).where(Warehouse.is_active == True).order_by(Warehouse.code)
    )
    warehouses = result.scalars().all()
    return [
        {
            'id': w.id,
            'code': w.code,
            'name': w.name,
            'location': w.location,
            'warehouseType': w.warehouse_type,
            'latitude': float(w.latitude) if w.latitude else None,
            'longitude': float(w.longitude) if w.longitude else None,
        }
        for w in warehouses
    ]


# =============================================================================
# NEW: Summary endpoint for dashboard
# =============================================================================

@router.get("/summary/{carrier_id}")
async def get_price_summary(
    carrier_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get price summary grouped by depot for a carrier"""
    result = await db.execute(
        select(PriceConfig)
        .options(
            selectinload(PriceConfig.fix_rates).selectinload(FixRate.depot),
            selectinload(PriceConfig.km_rates).selectinload(KmRate.depot),
            selectinload(PriceConfig.linehaul_rates).selectinload(LinehaulRate.from_warehouse),
            selectinload(PriceConfig.depo_rates).selectinload(DepoRate.depot),
        )
        .where(
            and_(
                PriceConfig.carrier_id == carrier_id,
                PriceConfig.is_active == True
            )
        )
    )
    configs = result.scalars().all()
    
    # Group by depot
    by_depot = {}
    
    for config in configs:
        # FIX rates
        for rate in config.fix_rates:
            depot_key = rate.depot.code if rate.depot else 'UNKNOWN'
            if depot_key not in by_depot:
                by_depot[depot_key] = {'fix': [], 'km': [], 'linehaul': [], 'depo': []}
            by_depot[depot_key]['fix'].append({
                'routeType': rate.route_type,
                'routeCategory': rate.route_category,
                'rate': float(rate.rate),
            })
        
        # KM rates
        for rate in config.km_rates:
            depot_key = rate.depot.code if rate.depot else 'UNKNOWN'
            if depot_key not in by_depot:
                by_depot[depot_key] = {'fix': [], 'km': [], 'linehaul': [], 'depo': []}
            by_depot[depot_key]['km'].append({
                'routeType': rate.route_type,
                'rate': float(rate.rate),
            })
        
        # Linehaul rates
        for rate in config.linehaul_rates:
            depot_key = rate.to_code or 'UNKNOWN'
            if depot_key not in by_depot:
                by_depot[depot_key] = {'fix': [], 'km': [], 'linehaul': [], 'depo': []}
            by_depot[depot_key]['linehaul'].append({
                'fromCode': rate.from_code,
                'toCode': rate.to_code,
                'vehicleType': rate.vehicle_type,
                'rate': float(rate.rate),
                'palletCapacityMin': rate.pallet_capacity_min,
                'palletCapacityMax': rate.pallet_capacity_max,
                'warehouseCode': rate.from_warehouse.code if rate.from_warehouse else None,
            })
        
        # Depo rates
        for rate in config.depo_rates:
            depot_key = rate.depot.code if rate.depot else rate.depo_name
            if depot_key not in by_depot:
                by_depot[depot_key] = {'fix': [], 'km': [], 'linehaul': [], 'depo': []}
            by_depot[depot_key]['depo'].append({
                'depoName': rate.depo_name,
                'rateType': rate.rate_type,
                'rate': float(rate.rate),
            })
    
    return {
        'carrierId': carrier_id,
        'byDepot': by_depot,
        'configsCount': len(configs),
    }
