"""
Pydantic schemas for request/response validation
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, ConfigDict


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


class CarrierResponse(CarrierBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
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


class DepotResponse(DepotBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    carrier_id: int
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


class ContractResponse(ContractBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    carrier_id: int
    created_at: datetime


# =============================================================================
# PRICE CONFIG SCHEMAS
# =============================================================================
class FixRateBase(BaseModel):
    route_type: str
    rate: Decimal


class FixRateResponse(FixRateBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


class KmRateBase(BaseModel):
    route_type: Optional[str] = None
    rate: Decimal


class KmRateResponse(KmRateBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


class DepoRateBase(BaseModel):
    depo_name: str
    rate_type: str
    rate: Decimal


class DepoRateResponse(DepoRateBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


class LinehaulRateBase(BaseModel):
    from_depot_id: Optional[int] = None
    to_depot_id: Optional[int] = None
    from_code: Optional[str] = None
    to_code: Optional[str] = None
    vehicle_type: str
    rate: Decimal
    is_posila: bool = False
    description: Optional[str] = None


class LinehaulRateResponse(LinehaulRateBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


class BonusRateBase(BaseModel):
    quality_min: Decimal
    quality_max: Decimal
    bonus_amount: Decimal
    total_with_bonus: Decimal


class BonusRateResponse(BonusRateBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


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


class PriceConfigResponse(PriceConfigBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    carrier_id: int
    contract_id: Optional[int] = None
    created_at: datetime
    fix_rates: List[FixRateResponse] = []
    km_rates: List[KmRateResponse] = []
    depo_rates: List[DepoRateResponse] = []
    linehaul_rates: List[LinehaulRateResponse] = []
    bonus_rates: List[BonusRateResponse] = []


# =============================================================================
# PROOF SCHEMAS
# =============================================================================
class ProofRouteDetailBase(BaseModel):
    route_type: str
    count: int
    rate: Decimal
    amount: Decimal


class ProofRouteDetailResponse(ProofRouteDetailBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


class ProofLinehaulDetailBase(BaseModel):
    description: str
    from_code: Optional[str] = None
    to_code: Optional[str] = None
    vehicle_type: Optional[str] = None
    days: Optional[int] = None
    per_day: Optional[int] = None
    rate: Decimal
    total: Decimal


class ProofLinehaulDetailResponse(ProofLinehaulDetailBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


class ProofDepoDetailBase(BaseModel):
    depo_name: str
    rate_type: str
    days: Optional[int] = None
    rate: Decimal
    amount: Decimal


class ProofDepoDetailResponse(ProofDepoDetailBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


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


class ProofResponse(ProofBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    carrier_id: int
    depot_id: Optional[int] = None
    period_date: datetime
    file_name: Optional[str] = None
    file_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class ProofDetailResponse(ProofResponse):
    route_details: List[ProofRouteDetailResponse] = []
    linehaul_details: List[ProofLinehaulDetailResponse] = []
    depo_details: List[ProofDepoDetailResponse] = []


# =============================================================================
# INVOICE SCHEMAS
# =============================================================================
class InvoiceItemBase(BaseModel):
    item_type: str
    description: Optional[str] = None
    amount: Decimal


class InvoiceItemResponse(InvoiceItemBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


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


class InvoiceResponse(InvoiceBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    carrier_id: int
    proof_id: Optional[int] = None
    file_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    items: List[InvoiceItemResponse] = []


class InvoiceParsedData(BaseModel):
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
# ANALYSIS SCHEMAS
# =============================================================================
class ProofAnalysisResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
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


class DashboardSummary(BaseModel):
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
