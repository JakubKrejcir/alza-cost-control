"""
Prices API Router
"""
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import (
    PriceConfig, Carrier, FixRate, KmRate, DepoRate, LinehaulRate, BonusRate
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
    """Get all price configs with filters"""
    query = select(PriceConfig).options(
        selectinload(PriceConfig.carrier),
        selectinload(PriceConfig.contract),
        selectinload(PriceConfig.fix_rates),
        selectinload(PriceConfig.km_rates),
        selectinload(PriceConfig.depo_rates),
        selectinload(PriceConfig.linehaul_rates),
        selectinload(PriceConfig.bonus_rates),
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
            selectinload(PriceConfig.fix_rates),
            selectinload(PriceConfig.km_rates),
            selectinload(PriceConfig.depo_rates),
            selectinload(PriceConfig.linehaul_rates),
            selectinload(PriceConfig.bonus_rates),
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
        .limit(1)
    )
    price_config = result.scalar_one_or_none()
    
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
            selectinload(PriceConfig.fix_rates),
            selectinload(PriceConfig.km_rates),
            selectinload(PriceConfig.depo_rates),
            selectinload(PriceConfig.linehaul_rates),
            selectinload(PriceConfig.bonus_rates),
        )
        .where(PriceConfig.id == price_config_id)
    )
    price_config = result.scalar_one_or_none()
    
    if not price_config:
        raise HTTPException(status_code=404, detail="Price config not found")
    
    return price_config


@router.post("", response_model=PriceConfigResponse, status_code=201)
async def create_price_config(
    config_data: PriceConfigCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create new price config with all rates"""
    # Verify carrier exists
    carrier_result = await db.execute(
        select(Carrier).where(Carrier.id == config_data.carrier_id)
    )
    if not carrier_result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Carrier not found")
    
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
    await db.flush()  # Get ID
    
    # Add rates
    if config_data.fix_rates:
        for rate in config_data.fix_rates:
            db.add(FixRate(price_config_id=price_config.id, **rate.model_dump()))
    
    if config_data.km_rates:
        for rate in config_data.km_rates:
            db.add(KmRate(price_config_id=price_config.id, **rate.model_dump()))
    
    if config_data.depo_rates:
        for rate in config_data.depo_rates:
            db.add(DepoRate(price_config_id=price_config.id, **rate.model_dump()))
    
    if config_data.linehaul_rates:
        for rate in config_data.linehaul_rates:
            db.add(LinehaulRate(price_config_id=price_config.id, **rate.model_dump()))
    
    if config_data.bonus_rates:
        for rate in config_data.bonus_rates:
            db.add(BonusRate(price_config_id=price_config.id, **rate.model_dump()))
    
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
    
    # Replace rates if provided
    if config_data.fix_rates is not None:
        await db.execute(
            FixRate.__table__.delete().where(FixRate.price_config_id == price_config_id)
        )
        for rate in config_data.fix_rates:
            db.add(FixRate(price_config_id=price_config_id, **rate.model_dump()))
    
    if config_data.km_rates is not None:
        await db.execute(
            KmRate.__table__.delete().where(KmRate.price_config_id == price_config_id)
        )
        for rate in config_data.km_rates:
            db.add(KmRate(price_config_id=price_config_id, **rate.model_dump()))
    
    if config_data.depo_rates is not None:
        await db.execute(
            DepoRate.__table__.delete().where(DepoRate.price_config_id == price_config_id)
        )
        for rate in config_data.depo_rates:
            db.add(DepoRate(price_config_id=price_config_id, **rate.model_dump()))
    
    if config_data.linehaul_rates is not None:
        await db.execute(
            LinehaulRate.__table__.delete().where(LinehaulRate.price_config_id == price_config_id)
        )
        for rate in config_data.linehaul_rates:
            db.add(LinehaulRate(price_config_id=price_config_id, **rate.model_dump()))
    
    if config_data.bonus_rates is not None:
        await db.execute(
            BonusRate.__table__.delete().where(BonusRate.price_config_id == price_config_id)
        )
        for rate in config_data.bonus_rates:
            db.add(BonusRate(price_config_id=price_config_id, **rate.model_dump()))
    
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
