"""
Pydantic schemas for request/response validation
All Response classes use camelCase for JavaScript frontend compatibility
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
# DEPOT SCHEMAS
# =============================================================================
class DepotBase(BaseModel):
    name: str
    code: Optional[str] = None
    type: Optional[str] = None
    address: Optional[str] = None


class DepotCreate(DepotBase):
    carrier_id: int


class DepotUpdate(DepotBase):
    pass


class DepotResponse(CamelModel):
    id: int
    carrier_id: int
    name: str
    code: Optional[str] = None
    type: Optional[str] = None
    address: Optional[str] = None
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
    created_at: datetime


# =============================================================================
# PRICE CONFIG SCHEMAS
# =============================================================================
class FixRateBase(BaseModel):
    route_type: str
    rate: Decimal


class FixRateResponse(CamelModel):
    id: int
    route_type: str
    rate: Decimal


class KmRateBase(BaseModel):
    route_type: Optional[str] = None
    rate: Decimal


class KmRateResponse(CamelModel):
    id: int
    route_type: Optional[str] = None
    rate: Decimal


class DepoRateBase(BaseModel):
    depo_name: str
    rate_type: str
    rate: Decimal


class DepoRateResponse(CamelModel):
    id: int
    depo_name: str
    rate_type: str
    rate: Decimal


class LinehaulRateBase(BaseModel):
    from_depot_id: Optional[int] = None
    to_depot_id: Optional[int] = None
    from_code: Optional[str] = None
    to_code: Optional[str] = None
    vehicle_type: str
    rate: Decimal
    is_posila: bool = False
    description: Optional[str] = None


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


class BonusRateBase(BaseModel):
    quality_min: Decimal
    quality_max: Decimal
    bonus_amount: Decimal
    total_with_bonus: Decimal


class BonusRateResponse(CamelModel):
    id: int
    quality_min: Decimal
    quality_max: Decimal
    bonus_amount: Decimal
    total_with_bonus: Decimal


class PriceConfigBase(BaseModel):
    type: str
    valid_from: datetime
    valid_to: Optional[datetime] = None
    is_active: bool = True


class PriceConfigCreate(PriceConfigBase):
    carrier_id: int
    contract_id: Optional[int] = None
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
    is_active: bool = True
    created_at: datetime
    fix_rates: List[FixRateResponse] = []
    km_rates: List[KmRateResponse] = []
    depo_rates: List[DepoRateResponse] = []
    linehaul_rates: List[LinehaulRateResponse] = []
    bonus_rates: List[BonusRateResponse] = []


# =============================================================================
# INVOICE SCHEMAS (needed for ProofDetailResponse)
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
    invoice_number: str
    period: str
    issue_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    total_without_vat: Optional[Decimal] = None
    vat_amount: Optional[Decimal] = None
    total_with_vat: Optional[Decimal] = None
    status: str = "pending"


class InvoiceCreate(InvoiceBase):
    carrier_id: int
    proof_id: Optional[int] = None
    items: Optional[List[InvoiceItemBase]] = None


class InvoiceUpdate(BaseModel):
    proof_id: Optional[int] = None
    status: Optional[str] = None
    total_without_vat: Optional[Decimal] = None
    vat_amount: Optional[Decimal] = None
    total_with_vat: Optional[Decimal] = None
    items: Optional[List[InvoiceItemBase]] = None


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
    status: str = "pending"
    file_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    items: List[InvoiceItemResponse] = []


class InvoiceParsedData(BaseModel):
    """Data extracted from invoice PDF - internal use"""
    invoice_number: Optional[str] = None
    variable_symbol: Optional[str] = None
    issue_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    tax_date: Optional[datetime] = None
    total_without_vat: Optional[Decimal] = None
    vat_amount: Optional[Decimal] = None
    total_with_vat: Optional[Decimal] = None
    item_type: Optional[str] = None
    period: Optional[str] = None
    supplier_ico: Optional[str] = None
    supplier_dic: Optional[str] = None
    customer_ico: Optional[str] = None
    customer_dic: Optional[str] = None


# =============================================================================
# PROOF SCHEMAS
# =============================================================================
class ProofRouteDetailResponse(CamelModel):
    id: int
    route_type: str
    count: int
    rate: Decimal
    amount: Decimal


class ProofLinehaulDetailResponse(CamelModel):
    id: int
    description: str
    from_code: Optional[str] = None
    to_code: Optional[str] = None
    vehicle_type: Optional[str] = None
    days: Optional[int] = None
    per_day: Optional[int] = None
    rate: Decimal
    total: Decimal


class ProofDepoDetailResponse(CamelModel):
    id: int
    depo_name: str
    rate_type: str
    days: Optional[int] = None
    rate: Decimal
    amount: Decimal


class ProofBase(BaseModel):
    period: str
    status: str = "pending"
    total_fix: Optional[Decimal] = None
    total_km: Optional[Decimal] = None
    total_linehaul: Optional[Decimal] = None
    total_depo: Optional[Decimal] = None
    total_bonus: Optional[Decimal] = None
    total_penalty: Optional[Decimal] = None
    grand_total: Optional[Decimal] = None


class ProofCreate(ProofBase):
    carrier_id: int
    depot_id: Optional[int] = None


class ProofUpdate(BaseModel):
    status: Optional[str] = None


class ProofResponse(CamelModel):
    id: int
    carrier_id: int
    depot_id: Optional[int] = None
    period: str
    period_date: datetime
    status: str = "pending"
    total_fix: Optional[Decimal] = None
    total_km: Optional[Decimal] = None
    total_linehaul: Optional[Decimal] = None
    total_depo: Optional[Decimal] = None
    total_bonus: Optional[Decimal] = None
    total_penalty: Optional[Decimal] = None
    grand_total: Optional[Decimal] = None
    file_name: Optional[str] = None
    file_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class ProofAnalysisResponse(CamelModel):
    id: int
    proof_id: int
    status: str
    errors_json: Optional[str] = None
    warnings_json: Optional[str] = None
    ok_json: Optional[str] = None
    diff_fix: Optional[Decimal] = None
    diff_km: Optional[Decimal] = None
    diff_linehaul: Optional[Decimal] = None
    diff_depo: Optional[Decimal] = None
    missing_rates_json: Optional[str] = None
    created_at: datetime


class ProofDetailResponse(ProofResponse):
    """Full proof detail including all related data"""
    route_details: List[ProofRouteDetailResponse] = []
    linehaul_details: List[ProofLinehaulDetailResponse] = []
    depo_details: List[ProofDepoDetailResponse] = []
    invoices: List[InvoiceResponse] = []
    analyses: List[ProofAnalysisResponse] = []


# =============================================================================
# DASHBOARD SCHEMAS
# =============================================================================
class DashboardSummary(CamelModel):
    id: int
    carrier: str
    period: str
    proof_total: Decimal
    invoiced_total: Decimal
    invoice_count: int
    remaining_to_invoice: Decimal
    status: str
    errors: int
    warnings: int
