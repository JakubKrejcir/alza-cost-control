"""
Pydantic schemas for request/response validation
Updated: 2025-12-05 - Added depot_id, route_category, from_warehouse_id fields
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, ConfigDict


def to_camel(string: str) -> str:
    """Convert snake_case to camelCase"""
    components = string.split('_')
    return components[0] + ''.join(x.title() for x in components[1:])


class CamelModel(BaseModel):
    """Base model with camelCase serialization for responses"""
    model_config = ConfigDict(
        from_attributes=True,
        alias_generator=to_camel,
        populate_by_name=True,
        by_alias=True
    )


# =============================================================================
# CARRIER SCHEMAS
# =============================================================================

class CarrierBase(BaseModel):
    name: str
    ico: Optional[str] = None
    dic: Optional[str] = None
    address: Optional[str] = None
    contact: Optional[str] = None


class CarrierCreate(CarrierBase):
    pass


class CarrierUpdate(BaseModel):
    name: Optional[str] = None
    ico: Optional[str] = None
    dic: Optional[str] = None
    address: Optional[str] = None
    contact: Optional[str] = None


class CarrierResponse(CamelModel):
    id: int
    name: str
    ico: Optional[str] = None
    dic: Optional[str] = None
    address: Optional[str] = None
    contact: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class CarrierWithCounts(CarrierResponse):
    proofs_count: int = 0
    invoices_count: int = 0
    contracts_count: int = 0


# =============================================================================
# WAREHOUSE SCHEMAS (NEW)
# =============================================================================

class WarehouseBase(BaseModel):
    code: str
    name: str
    location: Optional[str] = None
    latitude: Optional[Decimal] = None
    longitude: Optional[Decimal] = None
    warehouse_type: Optional[str] = 'MAIN'
    is_active: bool = True


class WarehouseCreate(WarehouseBase):
    pass


class WarehouseResponse(CamelModel):
    id: int
    code: str
    name: str
    location: Optional[str] = None
    latitude: Optional[Decimal] = None
    longitude: Optional[Decimal] = None
    warehouse_type: Optional[str] = None
    is_active: bool = True
    created_at: datetime


# =============================================================================
# DEPOT SCHEMAS (UPDATED)
# =============================================================================

class DepotBase(BaseModel):
    name: str
    code: Optional[str] = None
    type: Optional[str] = None
    address: Optional[str] = None
    # NEW FIELDS
    latitude: Optional[Decimal] = None
    longitude: Optional[Decimal] = None
    region: Optional[str] = None
    depot_type: Optional[str] = 'DISTRIBUTION'


class DepotCreate(DepotBase):
    carrier_id: Optional[int] = None  
    operator_type: Optional[str] = 'CARRIER'
    operator_carrier_id: Optional[int] = None

class DepotUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    type: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[Decimal] = None
    longitude: Optional[Decimal] = None
    region: Optional[str] = None
    depot_type: Optional[str] = None


class DepotResponse(CamelModel):
    id: int
    carrier_id: Optional[int] = None  
    name: str
    code: Optional[str] = None
    type: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[Decimal] = None
    longitude: Optional[Decimal] = None
    region: Optional[str] = None
    depot_type: Optional[str] = None
    # NEW FIELDS
    operator_type: Optional[str] = None
    operator_carrier_id: Optional[int] = None
    valid_from: Optional[datetime] = None
    valid_to: Optional[datetime] = None
    location_code: Optional[str] = None
    created_at: datetime


# =============================================================================
# CONTRACT SCHEMAS
# =============================================================================

class ContractBase(BaseModel):
    number: str
    type: Optional[str] = None
    valid_from: datetime
    valid_to: Optional[datetime] = None
    document_url: Optional[str] = None
    notes: Optional[str] = None


class ContractCreate(ContractBase):
    carrier_id: int


class ContractUpdate(BaseModel):
    number: Optional[str] = None
    type: Optional[str] = None
    valid_from: Optional[datetime] = None
    valid_to: Optional[datetime] = None
    document_url: Optional[str] = None
    notes: Optional[str] = None


class ContractResponse(CamelModel):
    id: int
    carrier_id: int
    number: str
    type: Optional[str] = None
    valid_from: datetime
    valid_to: Optional[datetime] = None
    document_url: Optional[str] = None
    notes: Optional[str] = None
    amendment_number: Optional[int] = None
    created_at: datetime


# =============================================================================
# PRICE CONFIG SCHEMAS (UPDATED)
# =============================================================================

class FixRateBase(BaseModel):
    route_type: str
    rate: Decimal
    # NEW FIELDS
    depot_id: Optional[int] = None
    route_category: Optional[str] = None


class FixRateResponse(CamelModel):
    id: int
    route_type: str
    rate: Decimal
    # NEW FIELDS
    depot_id: Optional[int] = None
    route_category: Optional[str] = None
    # Nested depot info
    depot: Optional[DepotResponse] = None


class KmRateBase(BaseModel):
    route_type: Optional[str] = None
    rate: Decimal
    # NEW FIELDS
    depot_id: Optional[int] = None


class KmRateResponse(CamelModel):
    id: int
    route_type: Optional[str] = None
    rate: Decimal
    # NEW FIELDS
    depot_id: Optional[int] = None
    depot: Optional[DepotResponse] = None


class DepoRateBase(BaseModel):
    depo_name: str
    rate_type: str
    rate: Decimal
    # NEW FIELDS
    depot_id: Optional[int] = None


class DepoRateResponse(CamelModel):
    id: int
    depo_name: str
    rate_type: str
    rate: Decimal
    # NEW FIELDS
    depot_id: Optional[int] = None
    depot: Optional[DepotResponse] = None


class LinehaulRateBase(BaseModel):
    from_depot_id: Optional[int] = None
    to_depot_id: Optional[int] = None
    from_code: Optional[str] = None
    to_code: Optional[str] = None
    vehicle_type: str
    rate: Decimal
    is_posila: bool = False
    description: Optional[str] = None
    # NEW FIELDS
    from_warehouse_id: Optional[int] = None
    pallet_capacity_min: Optional[int] = None
    pallet_capacity_max: Optional[int] = None


class LinehaulRateResponse(CamelModel):
    id: int
    from_depot_id: Optional[int] = None
    to_depot_id: Optional[int] = None
    from_code: Optional[str] = None
    to_code: Optional[str] = None
    vehicle_type: str
    rate: Decimal
    is_posila: bool = False
    description: Optional[str] = None
    # NEW FIELDS
    from_warehouse_id: Optional[int] = None
    pallet_capacity_min: Optional[int] = None
    pallet_capacity_max: Optional[int] = None
    # Nested info
    from_warehouse: Optional[WarehouseResponse] = None


class BonusRateBase(BaseModel):
    quality_min: Decimal
    quality_max: Decimal
    bonus_amount: Decimal
    total_with_bonus: Decimal
    # NEW FIELDS
    depot_id: Optional[int] = None


class BonusRateResponse(CamelModel):
    id: int
    quality_min: Decimal
    quality_max: Decimal
    bonus_amount: Decimal
    total_with_bonus: Decimal
    # NEW FIELDS
    depot_id: Optional[int] = None
    depot: Optional[DepotResponse] = None


class PriceConfigBase(BaseModel):
    carrier_id: int
    contract_id: Optional[int] = None
    type: str
    valid_from: datetime
    valid_to: Optional[datetime] = None
    is_active: bool = True


class PriceConfigCreate(PriceConfigBase):
    fix_rates: Optional[List[FixRateBase]] = None
    km_rates: Optional[List[KmRateBase]] = None
    depo_rates: Optional[List[DepoRateBase]] = None
    linehaul_rates: Optional[List[LinehaulRateBase]] = None
    bonus_rates: Optional[List[BonusRateBase]] = None


class PriceConfigUpdate(BaseModel):
    type: Optional[str] = None
    valid_from: Optional[datetime] = None
    valid_to: Optional[datetime] = None
    is_active: Optional[bool] = None
    fix_rates: Optional[List[FixRateBase]] = None
    km_rates: Optional[List[KmRateBase]] = None
    depo_rates: Optional[List[DepoRateBase]] = None
    linehaul_rates: Optional[List[LinehaulRateBase]] = None
    bonus_rates: Optional[List[BonusRateBase]] = None


class PriceConfigResponse(CamelModel):
    id: int
    carrier_id: int
    contract_id: Optional[int] = None
    type: str
    valid_from: datetime
    valid_to: Optional[datetime] = None
    is_active: bool
    created_at: datetime
    carrier: Optional[CarrierResponse] = None
    contract: Optional[ContractResponse] = None
    fix_rates: List[FixRateResponse] = []
    km_rates: List[KmRateResponse] = []
    depo_rates: List[DepoRateResponse] = []
    linehaul_rates: List[LinehaulRateResponse] = []
    bonus_rates: List[BonusRateResponse] = []


# =============================================================================
# PROOF SCHEMAS
# =============================================================================

class ProofBase(BaseModel):
    carrier_id: int
    depot_id: Optional[int] = None
    period: str
    period_date: datetime


class ProofCreate(ProofBase):
    file_name: Optional[str] = None
    file_url: Optional[str] = None


class ProofUpdate(BaseModel):
    status: Optional[str] = None
    total_fix: Optional[Decimal] = None
    total_km: Optional[Decimal] = None
    total_linehaul: Optional[Decimal] = None
    total_depo: Optional[Decimal] = None
    total_bonus: Optional[Decimal] = None
    total_penalty: Optional[Decimal] = None
    grand_total: Optional[Decimal] = None


class ProofResponse(CamelModel):
    id: int
    carrier_id: int
    depot_id: Optional[int] = None
    period: str
    period_date: datetime
    file_name: Optional[str] = None
    file_url: Optional[str] = None
    status: str
    total_fix: Optional[Decimal] = None
    total_km: Optional[Decimal] = None
    total_linehaul: Optional[Decimal] = None
    total_depo: Optional[Decimal] = None
    total_bonus: Optional[Decimal] = None
    total_penalty: Optional[Decimal] = None
    grand_total: Optional[Decimal] = None
    created_at: datetime
    updated_at: datetime


class ProofDetailResponse(ProofResponse):
    carrier: Optional[CarrierResponse] = None
    depot: Optional[DepotResponse] = None


# =============================================================================
# INVOICE SCHEMAS
# =============================================================================

class InvoiceItemBase(BaseModel):
    item_type: str
    description: Optional[str] = None
    amount: Decimal


class InvoiceItemResponse(CamelModel):
    id: int
    item_type: str
    description: Optional[str] = None
    amount: Decimal


class InvoiceBase(BaseModel):
    carrier_id: int
    proof_id: Optional[int] = None
    invoice_number: str
    period: str
    issue_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    total_without_vat: Optional[Decimal] = None
    vat_amount: Optional[Decimal] = None
    total_with_vat: Optional[Decimal] = None


class InvoiceCreate(InvoiceBase):
    items: Optional[List[InvoiceItemBase]] = None


class InvoiceUpdate(BaseModel):
    status: Optional[str] = None
    proof_id: Optional[int] = None


class InvoiceResponse(CamelModel):
    id: int
    carrier_id: int
    proof_id: Optional[int] = None
    invoice_number: str
    period: str
    issue_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    total_without_vat: Optional[Decimal] = None
    vat_amount: Optional[Decimal] = None
    total_with_vat: Optional[Decimal] = None
    status: str
    file_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    items: List[InvoiceItemResponse] = []


class InvoiceParsedData(BaseModel):
    invoice_number: Optional[str] = None
    period: Optional[str] = None
    issue_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    total_without_vat: Optional[Decimal] = None
    vat_amount: Optional[Decimal] = None
    total_with_vat: Optional[Decimal] = None
    items: List[InvoiceItemBase] = []


# =============================================================================
# ROUTE PLAN SCHEMAS
# =============================================================================

class RoutePlanRouteBase(BaseModel):
    route_name: str
    carrier_name: Optional[str] = None
    stops_count: int = 0
    start_location: Optional[str] = None
    max_capacity: Optional[Decimal] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    total_distance_km: Optional[Decimal] = None
    work_time: Optional[str] = None
    dr_lh: Optional[str] = None
    depot: Optional[str] = None
    plan_type: Optional[str] = None


class RoutePlanRouteResponse(CamelModel):
    id: int
    route_name: str
    carrier_name: Optional[str] = None
    stops_count: int
    start_location: Optional[str] = None
    max_capacity: Optional[Decimal] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    total_distance_km: Optional[Decimal] = None
    work_time: Optional[str] = None
    dr_lh: Optional[str] = None
    depot: Optional[str] = None
    plan_type: Optional[str] = None


class RoutePlanBase(BaseModel):
    carrier_id: int
    valid_from: datetime
    valid_to: Optional[datetime] = None
    file_name: Optional[str] = None
    plan_type: str = "BOTH"
    depot: str = "BOTH"


class RoutePlanCreate(RoutePlanBase):
    routes: Optional[List[RoutePlanRouteBase]] = None


class RoutePlanResponse(CamelModel):
    id: int
    carrier_id: int
    valid_from: datetime
    valid_to: Optional[datetime] = None
    file_name: Optional[str] = None
    plan_type: str
    depot: str
    total_routes: int
    total_km: Optional[Decimal] = None
    total_stops: int
    total_duration_minutes: int
    vratimov_dpo_count: int
    vratimov_sd_count: int
    bydzov_dpo_count: int
    bydzov_sd_count: int
    created_at: datetime
    updated_at: datetime
    routes: List[RoutePlanRouteResponse] = []


# =============================================================================
# ALZABOX SCHEMAS
# =============================================================================

class AlzaBoxResponse(CamelModel):
    id: int
    box_id: str
    name: str
    address: Optional[str] = None
    city: Optional[str] = None
    zip_code: Optional[str] = None
    country: str
    region: Optional[str] = None
    gps_lat: Optional[Decimal] = None
    gps_lon: Optional[Decimal] = None
    is_active: bool


class DeliveryStatsResponse(CamelModel):
    stats_date: datetime
    delivery_type: str
    route_name: Optional[str] = None
    carrier_id: Optional[int] = None
    total_boxes: int
    delivered_on_time: int
    delivered_late: int
    on_time_pct: Optional[Decimal] = None


# =============================================================================
# START LOCATION MAPPING SCHEMAS (NEW)
# =============================================================================

class StartLocationMappingBase(BaseModel):
    plan_name: str
    location_type: str  # 'WAREHOUSE' or 'DEPOT'
    warehouse_id: Optional[int] = None
    depot_id: Optional[int] = None
    route_category: str  # 'DIRECT_SKLAD' or 'DIRECT_DEPO'


class StartLocationMappingCreate(StartLocationMappingBase):
    pass


class StartLocationMappingResponse(CamelModel):
    id: int
    plan_name: str
    location_type: str
    warehouse_id: Optional[int] = None
    depot_id: Optional[int] = None
    route_category: str
    created_at: datetime
    warehouse: Optional[WarehouseResponse] = None
    depot: Optional[DepotResponse] = None


# =============================================================================
# ROUTE NAME MAPPING SCHEMAS (NEW)
# =============================================================================

class RouteNameMappingBase(BaseModel):
    route_prefix: str
    depot_id: int


class RouteNameMappingCreate(RouteNameMappingBase):
    pass


class RouteNameMappingResponse(CamelModel):
    id: int
    route_prefix: str
    depot_id: int
    created_at: datetime
    depot: Optional[DepotResponse] = None
