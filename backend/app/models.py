"""
SQLAlchemy Models - matching the Prisma schema exactly
Updated: 2025-12-07 - Added Route, RouteDepotHistory, RouteCarrierHistory, DepotNameMapping
                      Updated Depot model with operatorType, validFrom/validTo
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, Index, Text, Numeric, UniqueConstraint, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


# =============================================================================
# WAREHOUSE MODEL
# =============================================================================

class Warehouse(Base):
    """Expediční sklady (CZLC4, LCU, CZTC1, LCZ)"""
    __tablename__ = "Warehouse"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    location: Mapped[Optional[str]] = mapped_column(String(200))
    latitude: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 7))
    longitude: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 7))
    warehouse_type: Mapped[str] = mapped_column("warehouseType", String(50), default='MAIN')
    is_active: Mapped[bool] = mapped_column("isActive", Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, default=datetime.utcnow)

    # Relationships
    linehaul_from: Mapped[List["LinehaulRate"]] = relationship(
        back_populates="from_warehouse", 
        foreign_keys="LinehaulRate.from_warehouse_id"
    )
    start_location_mappings: Mapped[List["StartLocationMapping"]] = relationship(
        back_populates="warehouse"
    )


# =============================================================================
# CARRIER MODEL
# =============================================================================

class Carrier(Base):
    __tablename__ = "Carrier"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    ico: Mapped[Optional[str]] = mapped_column(String(20))
    dic: Mapped[Optional[str]] = mapped_column(String(20))
    address: Mapped[Optional[str]] = mapped_column(Text)
    contact: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column("updatedAt", DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    depots: Mapped[List["Depot"]] = relationship(
        back_populates="carrier", 
        foreign_keys="Depot.carrier_id",
        cascade="all, delete-orphan"
    )
    operated_depots: Mapped[List["Depot"]] = relationship(
        back_populates="operator_carrier",
        foreign_keys="Depot.operator_carrier_id"
    )
    contracts: Mapped[List["Contract"]] = relationship(back_populates="carrier", cascade="all, delete-orphan")
    prices: Mapped[List["PriceConfig"]] = relationship(back_populates="carrier", cascade="all, delete-orphan")
    proofs: Mapped[List["Proof"]] = relationship(back_populates="carrier", cascade="all, delete-orphan")
    invoices: Mapped[List["Invoice"]] = relationship(back_populates="carrier", cascade="all, delete-orphan")
    route_plans: Mapped[List["RoutePlan"]] = relationship(back_populates="carrier", cascade="all, delete-orphan")
    route_carrier_history: Mapped[List["RouteCarrierHistory"]] = relationship(back_populates="carrier")


# =============================================================================
# DEPOT MODEL (UPDATED - with operator and validity)
# =============================================================================

class Depot(Base):
    """
    Depa - místa odkud začínají direct trasy.
    
    Provozovatel (operator):
    - ALZA: Depo Chrášťany (CZLC4), Depo Třídírna (CZTC1)
    - CARRIER: Depo Vratimov (Drivecool), Depo Morava (GEM), atd.
    """
    __tablename__ = "Depot"

    id: Mapped[int] = mapped_column(primary_key=True)
    # carrier_id je nyní nullable - ALZA depa nemají vlastníka
    carrier_id: Mapped[Optional[int]] = mapped_column("carrierId", ForeignKey("Carrier.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255))
    code: Mapped[Optional[str]] = mapped_column(String(50), unique=True)
    type: Mapped[Optional[str]] = mapped_column(String(50))
    address: Mapped[Optional[str]] = mapped_column(Text)
    latitude: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 7))
    longitude: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 7))
    region: Mapped[Optional[str]] = mapped_column(String(100))
    depot_type: Mapped[str] = mapped_column("depotType", String(50), default='DISTRIBUTION')
    
    # NEW: Operator info
    operator_type: Mapped[str] = mapped_column("operatorType", String(20), default='CARRIER')
    operator_carrier_id: Mapped[Optional[int]] = mapped_column(
        "operatorCarrierId", 
        ForeignKey("Carrier.id", ondelete="SET NULL")
    )
    
    # NEW: Validity period (depo může vzniknout/zaniknout)
    valid_from: Mapped[datetime] = mapped_column("validFrom", DateTime, default=datetime.utcnow)
    valid_to: Mapped[Optional[datetime]] = mapped_column("validTo", DateTime, nullable=True)
    
    # NEW: Location code (CZLC4, CZTC1 pro ALZA depa)
    location_code: Mapped[Optional[str]] = mapped_column("locationCode", String(20))
    
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, default=datetime.utcnow)

    # Relationships
    carrier: Mapped[Optional["Carrier"]] = relationship(
        back_populates="depots", 
        foreign_keys=[carrier_id]
    )
    operator_carrier: Mapped[Optional["Carrier"]] = relationship(
        back_populates="operated_depots",
        foreign_keys=[operator_carrier_id]
    )
    linehaul_from: Mapped[List["LinehaulRate"]] = relationship(
        back_populates="from_depot", foreign_keys="LinehaulRate.from_depot_id"
    )
    linehaul_to: Mapped[List["LinehaulRate"]] = relationship(
        back_populates="to_depot", foreign_keys="LinehaulRate.to_depot_id"
    )
    proofs: Mapped[List["Proof"]] = relationship(back_populates="depot")
    start_location_mappings: Mapped[List["StartLocationMapping"]] = relationship(back_populates="depot")
    route_name_mappings: Mapped[List["RouteNameMapping"]] = relationship(back_populates="depot")
    depot_name_mappings: Mapped[List["DepotNameMapping"]] = relationship(back_populates="depot")
    fix_rates: Mapped[List["FixRate"]] = relationship(back_populates="depot", foreign_keys="FixRate.depot_id")
    km_rates: Mapped[List["KmRate"]] = relationship(back_populates="depot", foreign_keys="KmRate.depot_id")
    depo_rates_by_depot: Mapped[List["DepoRate"]] = relationship(back_populates="depot", foreign_keys="DepoRate.depot_id")
    bonus_rates: Mapped[List["BonusRate"]] = relationship(back_populates="depot", foreign_keys="BonusRate.depot_id")
    route_depot_history: Mapped[List["RouteDepotHistory"]] = relationship(back_populates="depot")
    route_plan_routes: Mapped[List["RoutePlanRoute"]] = relationship(back_populates="depot_ref")

    __table_args__ = (
        CheckConstraint("\"operatorType\" IN ('ALZA', 'CARRIER')", name="chk_operator_type"),
        Index('ix_depot_valid', 'validFrom', 'validTo'),
        Index('ix_depot_operator', 'operatorType', 'operatorCarrierId'),
    )


# =============================================================================
# DEPOT NAME MAPPING MODEL (NEW)
# =============================================================================

class DepotNameMapping(Base):
    """
    Mapování názvů dep z plánovacích souborů na skutečná depa.
    Např: "Depo Drivecool" → Depo Vratimov
          "Depo GEM" → Depo Morava
    """
    __tablename__ = "DepotNameMapping"

    id: Mapped[int] = mapped_column(primary_key=True)
    plan_name: Mapped[str] = mapped_column("planName", String(100), unique=True, nullable=False)
    depot_id: Mapped[int] = mapped_column("depotId", ForeignKey("Depot.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, default=datetime.utcnow)

    # Relationships
    depot: Mapped["Depot"] = relationship(back_populates="depot_name_mappings")


# =============================================================================
# ROUTE MODEL (NEW - Master data tras)
# =============================================================================

class Route(Base):
    """
    Master data tras.
    Každá trasa má unikátní název (např. "Moravskoslezsko A", "Praha C").
    Historie přiřazení k depům a dopravcům je v RouteDepotHistory a RouteCarrierHistory.
    """
    __tablename__ = "Route"

    id: Mapped[int] = mapped_column(primary_key=True)
    route_name: Mapped[str] = mapped_column("routeName", String(100), unique=True, nullable=False)
    region: Mapped[Optional[str]] = mapped_column(String(100))
    description: Mapped[Optional[str]] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column("isActive", Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column("updatedAt", DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    depot_history: Mapped[List["RouteDepotHistory"]] = relationship(back_populates="route", cascade="all, delete-orphan")
    carrier_history: Mapped[List["RouteCarrierHistory"]] = relationship(back_populates="route", cascade="all, delete-orphan")
    box_assignments: Mapped[List["AlzaBoxAssignment"]] = relationship(back_populates="route")
    route_plan_routes: Mapped[List["RoutePlanRoute"]] = relationship(back_populates="route_ref")

    __table_args__ = (
        Index('ix_route_name', 'routeName'),
        Index('ix_route_region', 'region'),
    )

    def get_current_depot(self, as_of: datetime = None) -> Optional["Depot"]:
        """Vrátí aktuální depo pro tuto trasu."""
        if as_of is None:
            as_of = datetime.utcnow()
        for history in self.depot_history:
            if history.valid_from <= as_of and (history.valid_to is None or history.valid_to > as_of):
                return history.depot
        return None

    def get_current_carrier(self, as_of: datetime = None) -> Optional["Carrier"]:
        """Vrátí aktuálního dopravce pro tuto trasu."""
        if as_of is None:
            as_of = datetime.utcnow()
        for history in self.carrier_history:
            if history.valid_from <= as_of and (history.valid_to is None or history.valid_to > as_of):
                return history.carrier
        return None


# =============================================================================
# ROUTE DEPOT HISTORY MODEL (NEW)
# =============================================================================

class RouteDepotHistory(Base):
    """
    Historie přiřazení tras k depům.
    Trasa může v čase měnit depo (např. přesun z Vratimova do jiného depa).
    """
    __tablename__ = "RouteDepotHistory"

    id: Mapped[int] = mapped_column(primary_key=True)
    route_id: Mapped[int] = mapped_column("routeId", ForeignKey("Route.id", ondelete="CASCADE"), nullable=False)
    depot_id: Mapped[int] = mapped_column("depotId", ForeignKey("Depot.id", ondelete="CASCADE"), nullable=False)
    valid_from: Mapped[datetime] = mapped_column("validFrom", DateTime, nullable=False, default=datetime.utcnow)
    valid_to: Mapped[Optional[datetime]] = mapped_column("validTo", DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, default=datetime.utcnow)

    # Relationships
    route: Mapped["Route"] = relationship(back_populates="depot_history")
    depot: Mapped["Depot"] = relationship(back_populates="route_depot_history")

    __table_args__ = (
        UniqueConstraint('routeId', 'validFrom', name='uq_route_depot_valid'),
        Index('ix_route_depot_route', 'routeId'),
        Index('ix_route_depot_depot', 'depotId'),
        Index('ix_route_depot_valid', 'validFrom', 'validTo'),
    )


# =============================================================================
# ROUTE CARRIER HISTORY MODEL (NEW)
# =============================================================================

class RouteCarrierHistory(Base):
    """
    Historie přiřazení tras k dopravcům.
    Trasa může v čase měnit dopravce (např. trasu "Praha A" dnes jezdí jiný dopravce než před rokem).
    """
    __tablename__ = "RouteCarrierHistory"

    id: Mapped[int] = mapped_column(primary_key=True)
    route_id: Mapped[int] = mapped_column("routeId", ForeignKey("Route.id", ondelete="CASCADE"), nullable=False)
    carrier_id: Mapped[int] = mapped_column("carrierId", ForeignKey("Carrier.id", ondelete="CASCADE"), nullable=False)
    valid_from: Mapped[datetime] = mapped_column("validFrom", DateTime, nullable=False, default=datetime.utcnow)
    valid_to: Mapped[Optional[datetime]] = mapped_column("validTo", DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, default=datetime.utcnow)

    # Relationships
    route: Mapped["Route"] = relationship(back_populates="carrier_history")
    carrier: Mapped["Carrier"] = relationship(back_populates="route_carrier_history")

    __table_args__ = (
        UniqueConstraint('routeId', 'validFrom', name='uq_route_carrier_valid'),
        Index('ix_route_carrier_route', 'routeId'),
        Index('ix_route_carrier_carrier', 'carrierId'),
        Index('ix_route_carrier_valid', 'validFrom', 'validTo'),
    )


# =============================================================================
# START LOCATION MAPPING MODEL
# =============================================================================

class StartLocationMapping(Base):
    """Mapování názvů startovních míst z plánovacích souborů"""
    __tablename__ = "StartLocationMapping"

    id: Mapped[int] = mapped_column(primary_key=True)
    plan_name: Mapped[str] = mapped_column("planName", String(100), unique=True, nullable=False)
    location_type: Mapped[str] = mapped_column("locationType", String(20), nullable=False)
    warehouse_id: Mapped[Optional[int]] = mapped_column("warehouseId", ForeignKey("Warehouse.id"))
    depot_id: Mapped[Optional[int]] = mapped_column("depotId", ForeignKey("Depot.id"))
    route_category: Mapped[str] = mapped_column("routeCategory", String(50), nullable=False)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, default=datetime.utcnow)

    # Relationships
    warehouse: Mapped[Optional["Warehouse"]] = relationship(back_populates="start_location_mappings")
    depot: Mapped[Optional["Depot"]] = relationship(back_populates="start_location_mappings")


# =============================================================================
# ROUTE NAME MAPPING MODEL
# =============================================================================

class RouteNameMapping(Base):
    """Mapování prefixů názvů tras na depa"""
    __tablename__ = "RouteNameMapping"

    id: Mapped[int] = mapped_column(primary_key=True)
    route_prefix: Mapped[str] = mapped_column("routePrefix", String(50), nullable=False)
    depot_id: Mapped[int] = mapped_column("depotId", ForeignKey("Depot.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, default=datetime.utcnow)

    # Relationships
    depot: Mapped["Depot"] = relationship(back_populates="route_name_mappings")


# =============================================================================
# CONTRACT MODEL
# =============================================================================

class Contract(Base):
    __tablename__ = "Contract"

    id: Mapped[int] = mapped_column(primary_key=True)
    carrier_id: Mapped[int] = mapped_column("carrierId", ForeignKey("Carrier.id", ondelete="CASCADE"))
    number: Mapped[str] = mapped_column(String(100))
    type: Mapped[Optional[str]] = mapped_column(String(50))
    valid_from: Mapped[datetime] = mapped_column("validFrom", DateTime)
    valid_to: Mapped[Optional[datetime]] = mapped_column("validTo", DateTime)
    document_url: Mapped[Optional[str]] = mapped_column("documentUrl", Text)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    amendment_number: Mapped[Optional[int]] = mapped_column("amendmentNumber", Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, default=datetime.utcnow)

    # Relationships
    carrier: Mapped["Carrier"] = relationship(back_populates="contracts")
    prices: Mapped[List["PriceConfig"]] = relationship(back_populates="contract")


# =============================================================================
# PRICE CONFIG MODEL
# =============================================================================

class PriceConfig(Base):
    __tablename__ = "PriceConfig"

    id: Mapped[int] = mapped_column(primary_key=True)
    carrier_id: Mapped[int] = mapped_column("carrierId", ForeignKey("Carrier.id", ondelete="CASCADE"))
    contract_id: Mapped[Optional[int]] = mapped_column("contractId", ForeignKey("Contract.id"))
    type: Mapped[str] = mapped_column(String(50))
    valid_from: Mapped[datetime] = mapped_column("validFrom", DateTime)
    valid_to: Mapped[Optional[datetime]] = mapped_column("validTo", DateTime)
    is_active: Mapped[bool] = mapped_column("isActive", Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, default=datetime.utcnow)

    # Relationships
    carrier: Mapped["Carrier"] = relationship(back_populates="prices")
    contract: Mapped[Optional["Contract"]] = relationship(back_populates="prices")
    fix_rates: Mapped[List["FixRate"]] = relationship(back_populates="price_config", cascade="all, delete-orphan")
    km_rates: Mapped[List["KmRate"]] = relationship(back_populates="price_config", cascade="all, delete-orphan")
    depo_rates: Mapped[List["DepoRate"]] = relationship(back_populates="price_config", cascade="all, delete-orphan")
    linehaul_rates: Mapped[List["LinehaulRate"]] = relationship(back_populates="price_config", cascade="all, delete-orphan")
    bonus_rates: Mapped[List["BonusRate"]] = relationship(back_populates="price_config", cascade="all, delete-orphan")


# =============================================================================
# FIX RATE MODEL
# =============================================================================

class FixRate(Base):
    __tablename__ = "FixRate"

    id: Mapped[int] = mapped_column(primary_key=True)
    price_config_id: Mapped[int] = mapped_column("priceConfigId", ForeignKey("PriceConfig.id", ondelete="CASCADE"))
    route_type: Mapped[str] = mapped_column("routeType", String(50))
    rate: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    depot_id: Mapped[Optional[int]] = mapped_column("depotId", ForeignKey("Depot.id"))
    route_category: Mapped[Optional[str]] = mapped_column("routeCategory", String(50))
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, default=datetime.utcnow)

    # Relationships
    price_config: Mapped["PriceConfig"] = relationship(back_populates="fix_rates")
    depot: Mapped[Optional["Depot"]] = relationship(back_populates="fix_rates", foreign_keys=[depot_id])


# =============================================================================
# KM RATE MODEL
# =============================================================================

class KmRate(Base):
    __tablename__ = "KmRate"

    id: Mapped[int] = mapped_column(primary_key=True)
    price_config_id: Mapped[int] = mapped_column("priceConfigId", ForeignKey("PriceConfig.id", ondelete="CASCADE"))
    route_type: Mapped[Optional[str]] = mapped_column("routeType", String(50))
    rate: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    depot_id: Mapped[Optional[int]] = mapped_column("depotId", ForeignKey("Depot.id"))
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, default=datetime.utcnow)

    # Relationships
    price_config: Mapped["PriceConfig"] = relationship(back_populates="km_rates")
    depot: Mapped[Optional["Depot"]] = relationship(back_populates="km_rates", foreign_keys=[depot_id])


# =============================================================================
# DEPO RATE MODEL
# =============================================================================

class DepoRate(Base):
    __tablename__ = "DepoRate"

    id: Mapped[int] = mapped_column(primary_key=True)
    price_config_id: Mapped[int] = mapped_column("priceConfigId", ForeignKey("PriceConfig.id", ondelete="CASCADE"))
    depo_name: Mapped[str] = mapped_column("depoName", String(100))
    rate_type: Mapped[str] = mapped_column("rateType", String(50))
    rate: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    depot_id: Mapped[Optional[int]] = mapped_column("depotId", ForeignKey("Depot.id"))
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, default=datetime.utcnow)

    # Relationships
    price_config: Mapped["PriceConfig"] = relationship(back_populates="depo_rates")
    depot: Mapped[Optional["Depot"]] = relationship(back_populates="depo_rates_by_depot", foreign_keys=[depot_id])


# =============================================================================
# LINEHAUL RATE MODEL
# =============================================================================

class LinehaulRate(Base):
    __tablename__ = "LinehaulRate"

    id: Mapped[int] = mapped_column(primary_key=True)
    price_config_id: Mapped[int] = mapped_column("priceConfigId", ForeignKey("PriceConfig.id", ondelete="CASCADE"))
    from_depot_id: Mapped[Optional[int]] = mapped_column("fromDepotId", ForeignKey("Depot.id"))
    to_depot_id: Mapped[Optional[int]] = mapped_column("toDepotId", ForeignKey("Depot.id"))
    from_code: Mapped[Optional[str]] = mapped_column("fromCode", String(50))
    to_code: Mapped[Optional[str]] = mapped_column("toCode", String(50))
    vehicle_type: Mapped[str] = mapped_column("vehicleType", String(50))
    rate: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    is_posila: Mapped[bool] = mapped_column("isPosila", Boolean, default=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    from_warehouse_id: Mapped[Optional[int]] = mapped_column("fromWarehouseId", ForeignKey("Warehouse.id"))
    pallet_capacity_min: Mapped[Optional[int]] = mapped_column("palletCapacityMin", Integer)
    pallet_capacity_max: Mapped[Optional[int]] = mapped_column("palletCapacityMax", Integer)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, default=datetime.utcnow)

    # Relationships
    price_config: Mapped["PriceConfig"] = relationship(back_populates="linehaul_rates")
    from_depot: Mapped[Optional["Depot"]] = relationship(back_populates="linehaul_from", foreign_keys=[from_depot_id])
    to_depot: Mapped[Optional["Depot"]] = relationship(back_populates="linehaul_to", foreign_keys=[to_depot_id])
    from_warehouse: Mapped[Optional["Warehouse"]] = relationship(back_populates="linehaul_from", foreign_keys=[from_warehouse_id])


# =============================================================================
# BONUS RATE MODEL
# =============================================================================

class BonusRate(Base):
    __tablename__ = "BonusRate"

    id: Mapped[int] = mapped_column(primary_key=True)
    price_config_id: Mapped[int] = mapped_column("priceConfigId", ForeignKey("PriceConfig.id", ondelete="CASCADE"))
    quality_min: Mapped[Decimal] = mapped_column("qualityMin", Numeric(5, 2))
    quality_max: Mapped[Decimal] = mapped_column("qualityMax", Numeric(5, 2))
    bonus_amount: Mapped[Decimal] = mapped_column("bonusAmount", Numeric(10, 2))
    total_with_bonus: Mapped[Decimal] = mapped_column("totalWithBonus", Numeric(10, 2))
    depot_id: Mapped[Optional[int]] = mapped_column("depotId", ForeignKey("Depot.id"))
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, default=datetime.utcnow)

    # Relationships
    price_config: Mapped["PriceConfig"] = relationship(back_populates="bonus_rates")
    depot: Mapped[Optional["Depot"]] = relationship(back_populates="bonus_rates", foreign_keys=[depot_id])


# =============================================================================
# PROOF MODEL
# =============================================================================

class Proof(Base):
    __tablename__ = "Proof"

    id: Mapped[int] = mapped_column(primary_key=True)
    carrier_id: Mapped[int] = mapped_column("carrierId", ForeignKey("Carrier.id", ondelete="CASCADE"))
    depot_id: Mapped[Optional[int]] = mapped_column("depotId", ForeignKey("Depot.id"))
    period: Mapped[str] = mapped_column(String(20))
    period_date: Mapped[datetime] = mapped_column("periodDate", DateTime)
    file_name: Mapped[Optional[str]] = mapped_column("fileName", String(255))
    file_url: Mapped[Optional[str]] = mapped_column("fileUrl", Text)
    status: Mapped[str] = mapped_column(String(50), default="pending")
    total_fix: Mapped[Optional[Decimal]] = mapped_column("totalFix", Numeric(12, 2))
    total_km: Mapped[Optional[Decimal]] = mapped_column("totalKm", Numeric(12, 2))
    total_linehaul: Mapped[Optional[Decimal]] = mapped_column("totalLinehaul", Numeric(12, 2))
    total_depo: Mapped[Optional[Decimal]] = mapped_column("totalDepo", Numeric(12, 2))
    total_bonus: Mapped[Optional[Decimal]] = mapped_column("totalBonus", Numeric(12, 2))
    total_penalty: Mapped[Optional[Decimal]] = mapped_column("totalPenalty", Numeric(12, 2))
    grand_total: Mapped[Optional[Decimal]] = mapped_column("grandTotal", Numeric(12, 2))
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column("updatedAt", DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    carrier: Mapped["Carrier"] = relationship(back_populates="proofs")
    depot: Mapped[Optional["Depot"]] = relationship(back_populates="proofs")
    route_details: Mapped[List["ProofRouteDetail"]] = relationship(back_populates="proof", cascade="all, delete-orphan")
    linehaul_details: Mapped[List["ProofLinehaulDetail"]] = relationship(back_populates="proof", cascade="all, delete-orphan")
    depo_details: Mapped[List["ProofDepoDetail"]] = relationship(back_populates="proof", cascade="all, delete-orphan")
    daily_details: Mapped[List["ProofDailyDetail"]] = relationship(back_populates="proof", cascade="all, delete-orphan")
    invoices: Mapped[List["Invoice"]] = relationship(back_populates="proof")
    analyses: Mapped[List["ProofAnalysis"]] = relationship(back_populates="proof", cascade="all, delete-orphan")


# =============================================================================
# PROOF DETAIL MODELS
# =============================================================================

class ProofRouteDetail(Base):
    __tablename__ = "ProofRouteDetail"

    id: Mapped[int] = mapped_column(primary_key=True)
    proof_id: Mapped[int] = mapped_column("proofId", ForeignKey("Proof.id", ondelete="CASCADE"))
    route_name: Mapped[str] = mapped_column("routeName", String(100))
    route_type: Mapped[Optional[str]] = mapped_column("routeType", String(50))
    trips_count: Mapped[int] = mapped_column("tripsCount", Integer, default=0)
    total_km: Mapped[Decimal] = mapped_column("totalKm", Numeric(10, 2), default=0)
    fix_amount: Mapped[Optional[Decimal]] = mapped_column("fixAmount", Numeric(10, 2))
    km_amount: Mapped[Optional[Decimal]] = mapped_column("kmAmount", Numeric(10, 2))
    total_amount: Mapped[Optional[Decimal]] = mapped_column("totalAmount", Numeric(10, 2))
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, default=datetime.utcnow)

    proof: Mapped["Proof"] = relationship(back_populates="route_details")


class ProofLinehaulDetail(Base):
    __tablename__ = "ProofLinehaulDetail"

    id: Mapped[int] = mapped_column(primary_key=True)
    proof_id: Mapped[int] = mapped_column("proofId", ForeignKey("Proof.id", ondelete="CASCADE"))
    from_location: Mapped[str] = mapped_column("fromLocation", String(100))
    to_location: Mapped[str] = mapped_column("toLocation", String(100))
    vehicle_type: Mapped[str] = mapped_column("vehicleType", String(50))
    trips_count: Mapped[int] = mapped_column("tripsCount", Integer, default=0)
    rate: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    total_amount: Mapped[Decimal] = mapped_column("totalAmount", Numeric(10, 2))
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, default=datetime.utcnow)

    proof: Mapped["Proof"] = relationship(back_populates="linehaul_details")


class ProofDepoDetail(Base):
    __tablename__ = "ProofDepoDetail"

    id: Mapped[int] = mapped_column(primary_key=True)
    proof_id: Mapped[int] = mapped_column("proofId", ForeignKey("Proof.id", ondelete="CASCADE"))
    depo_name: Mapped[str] = mapped_column("depoName", String(100))
    service_type: Mapped[str] = mapped_column("serviceType", String(100))
    quantity: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    rate: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    total_amount: Mapped[Decimal] = mapped_column("totalAmount", Numeric(10, 2))
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, default=datetime.utcnow)

    proof: Mapped["Proof"] = relationship(back_populates="depo_details")


class ProofDailyDetail(Base):
    __tablename__ = "ProofDailyDetail"

    id: Mapped[int] = mapped_column(primary_key=True)
    proof_id: Mapped[int] = mapped_column("proofId", ForeignKey("Proof.id", ondelete="CASCADE"))
    date: Mapped[datetime] = mapped_column(DateTime)
    routes_count: Mapped[int] = mapped_column("routesCount", Integer, default=0)
    total_km: Mapped[Decimal] = mapped_column("totalKm", Numeric(10, 2), default=0)
    total_stops: Mapped[int] = mapped_column("totalStops", Integer, default=0)
    fix_amount: Mapped[Optional[Decimal]] = mapped_column("fixAmount", Numeric(10, 2))
    km_amount: Mapped[Optional[Decimal]] = mapped_column("kmAmount", Numeric(10, 2))
    day_of_week: Mapped[Optional[str]] = mapped_column("dayOfWeek", String(10))
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, default=datetime.utcnow)

    proof: Mapped["Proof"] = relationship(back_populates="daily_details")


class ProofAnalysis(Base):
    __tablename__ = "ProofAnalysis"

    id: Mapped[int] = mapped_column(primary_key=True)
    proof_id: Mapped[int] = mapped_column("proofId", ForeignKey("Proof.id", ondelete="CASCADE"))
    analysis_type: Mapped[str] = mapped_column("analysisType", String(50))
    metric_name: Mapped[str] = mapped_column("metricName", String(100))
    metric_value: Mapped[Decimal] = mapped_column("metricValue", Numeric(15, 4))
    comparison_value: Mapped[Optional[Decimal]] = mapped_column("comparisonValue", Numeric(15, 4))
    difference_pct: Mapped[Optional[Decimal]] = mapped_column("differencePct", Numeric(8, 2))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, default=datetime.utcnow)

    proof: Mapped["Proof"] = relationship(back_populates="analyses")


# =============================================================================
# INVOICE MODEL
# =============================================================================

class Invoice(Base):
    __tablename__ = "Invoice"

    id: Mapped[int] = mapped_column(primary_key=True)
    carrier_id: Mapped[int] = mapped_column("carrierId", ForeignKey("Carrier.id", ondelete="CASCADE"))
    proof_id: Mapped[Optional[int]] = mapped_column("proofId", ForeignKey("Proof.id"))
    number: Mapped[str] = mapped_column(String(100))
    issue_date: Mapped[datetime] = mapped_column("issueDate", DateTime)
    due_date: Mapped[datetime] = mapped_column("dueDate", DateTime)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    status: Mapped[str] = mapped_column(String(50), default="pending")
    document_url: Mapped[Optional[str]] = mapped_column("documentUrl", Text)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, default=datetime.utcnow)

    carrier: Mapped["Carrier"] = relationship(back_populates="invoices")
    proof: Mapped[Optional["Proof"]] = relationship(back_populates="invoices")


# =============================================================================
# LOGIN LOG MODEL
# =============================================================================

class LoginLog(Base):
    __tablename__ = "LoginLog"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[Optional[str]] = mapped_column(String(255))
    login_at: Mapped[datetime] = mapped_column("loginAt", DateTime, default=datetime.utcnow)
    ip_address: Mapped[Optional[str]] = mapped_column("ipAddress", String(50))
    user_agent: Mapped[Optional[str]] = mapped_column("userAgent", Text)


# =============================================================================
# ROUTE PLAN MODELS
# =============================================================================

class RoutePlan(Base):
    __tablename__ = "RoutePlan"

    id: Mapped[int] = mapped_column(primary_key=True)
    carrier_id: Mapped[int] = mapped_column("carrierId", ForeignKey("Carrier.id", ondelete="CASCADE"))
    plan_date: Mapped[datetime] = mapped_column("planDate", DateTime)
    file_name: Mapped[Optional[str]] = mapped_column("fileName", String(255))
    file_url: Mapped[Optional[str]] = mapped_column("fileUrl", Text)
    routes_count: Mapped[int] = mapped_column("routesCount", Integer, default=0)
    total_stops: Mapped[int] = mapped_column("totalStops", Integer, default=0)
    total_km: Mapped[Optional[Decimal]] = mapped_column("totalKm", Numeric(10, 2))
    status: Mapped[str] = mapped_column(String(50), default="pending")
    notes: Mapped[Optional[str]] = mapped_column(Text)
    # Additional aggregation columns
    dpo_routes_count: Mapped[int] = mapped_column("dpoRoutesCount", Integer, default=0)
    sd_routes_count: Mapped[int] = mapped_column("sdRoutesCount", Integer, default=0)
    dpo_linehaul_count: Mapped[int] = mapped_column("dpoLinehaulCount", Integer, default=0)
    sd_linehaul_count: Mapped[int] = mapped_column("sdLinehaulCount", Integer, default=0)
    vratimov_stops: Mapped[int] = mapped_column("vratimovStops", Integer, default=0)
    vratimov_km: Mapped[Optional[Decimal]] = mapped_column("vratimovKm", Numeric(10, 2), default=0)
    vratimov_duration_min: Mapped[int] = mapped_column("vratimovDurationMin", Integer, default=0)
    bydzov_stops: Mapped[int] = mapped_column("bydzovStops", Integer, default=0)
    bydzov_km: Mapped[Optional[Decimal]] = mapped_column("bydzovKm", Numeric(10, 2), default=0)
    bydzov_duration_min: Mapped[int] = mapped_column("bydzovDurationMin", Integer, default=0)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column("updatedAt", DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    carrier: Mapped["Carrier"] = relationship(back_populates="route_plans")
    routes: Mapped[List["RoutePlanRoute"]] = relationship(back_populates="route_plan", cascade="all, delete-orphan")


class RoutePlanRoute(Base):
    __tablename__ = "RoutePlanRoute"

    id: Mapped[int] = mapped_column(primary_key=True)
    route_plan_id: Mapped[int] = mapped_column("routePlanId", ForeignKey("RoutePlan.id", ondelete="CASCADE"))
    route_name: Mapped[str] = mapped_column("routeName", String(100))
    carrier_name: Mapped[Optional[str]] = mapped_column("carrierName", String(100))
    stops_count: Mapped[int] = mapped_column("stopsCount", Integer, default=0)
    start_location: Mapped[Optional[str]] = mapped_column("startLocation", String(200))
    max_capacity: Mapped[Optional[Decimal]] = mapped_column("maxCapacity", Numeric(10, 2))
    start_time: Mapped[Optional[str]] = mapped_column("startTime", String(10))
    end_time: Mapped[Optional[str]] = mapped_column("endTime", String(10))
    total_distance_km: Mapped[Optional[Decimal]] = mapped_column("totalDistanceKm", Numeric(10, 3))
    work_time: Mapped[Optional[str]] = mapped_column("workTime", String(10))
    dr_lh: Mapped[Optional[str]] = mapped_column("drLh", String(20))
    depot: Mapped[Optional[str]] = mapped_column("depot", String(50))
    plan_type: Mapped[Optional[str]] = mapped_column("planType", String(10))
    route_letter: Mapped[Optional[str]] = mapped_column("routeLetter", String(10))
    route_type: Mapped[Optional[str]] = mapped_column("routeType", String(20), default='DPO')
    delivery_type: Mapped[Optional[str]] = mapped_column("deliveryType", String(20))
    # NEW: Vazby na Route a Depot
    route_id: Mapped[Optional[int]] = mapped_column("routeId", ForeignKey("Route.id", ondelete="SET NULL"))
    depot_id: Mapped[Optional[int]] = mapped_column("depotId", ForeignKey("Depot.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, default=datetime.utcnow)

    route_plan: Mapped["RoutePlan"] = relationship(back_populates="routes")
    details: Mapped[List["RoutePlanDetail"]] = relationship(back_populates="route", cascade="all, delete-orphan")
    route_ref: Mapped[Optional["Route"]] = relationship(back_populates="route_plan_routes")
    depot_ref: Mapped[Optional["Depot"]] = relationship(back_populates="route_plan_routes")


class RoutePlanDetail(Base):
    __tablename__ = "RoutePlanDetail"

    id: Mapped[int] = mapped_column(primary_key=True)
    route_id: Mapped[int] = mapped_column("routeId", ForeignKey("RoutePlanRoute.id", ondelete="CASCADE"))
    sequence: Mapped[int] = mapped_column(Integer)
    eta: Mapped[Optional[str]] = mapped_column(String(10))
    order_id: Mapped[Optional[str]] = mapped_column("orderId", String(50))
    stop_name: Mapped[Optional[str]] = mapped_column("stopName", String(255))
    address: Mapped[Optional[str]] = mapped_column(Text)
    distance_from_previous: Mapped[Optional[Decimal]] = mapped_column("distanceFromPrevious", Numeric(10, 2))
    unload_sequence: Mapped[Optional[int]] = mapped_column("unloadSequence", Integer)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, default=datetime.utcnow)

    route: Mapped["RoutePlanRoute"] = relationship(back_populates="details")


# =============================================================================
# ALZABOX MODELS
# =============================================================================

class AlzaBox(Base):
    __tablename__ = "AlzaBox"

    id: Mapped[int] = mapped_column(primary_key=True)
    box_id: Mapped[str] = mapped_column("boxId", String(20), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    address: Mapped[Optional[str]] = mapped_column(Text)
    city: Mapped[Optional[str]] = mapped_column(String(100))
    zip_code: Mapped[Optional[str]] = mapped_column("zipCode", String(10))
    country: Mapped[str] = mapped_column(String(5), default='CZ')
    region: Mapped[Optional[str]] = mapped_column(String(100))
    gps_lat: Mapped[Optional[Decimal]] = mapped_column("gpsLat", Numeric(10, 6))
    gps_lon: Mapped[Optional[Decimal]] = mapped_column("gpsLon", Numeric(10, 6))
    description: Mapped[Optional[str]] = mapped_column(Text)
    first_launch: Mapped[Optional[datetime]] = mapped_column("firstLaunch", DateTime)
    source_warehouse: Mapped[Optional[str]] = mapped_column("sourceWarehouse", String(20))
    is_active: Mapped[bool] = mapped_column("isActive", Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column("updatedAt", DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    assignments: Mapped[List["AlzaBoxAssignment"]] = relationship(back_populates="box", cascade="all, delete-orphan")
    deliveries: Mapped[List["AlzaBoxDelivery"]] = relationship(back_populates="box", cascade="all, delete-orphan")

    __table_args__ = (
        Index('ix_alzabox_country_region', 'country', 'region'),
    )


class AlzaBoxAssignment(Base):
    __tablename__ = "AlzaBoxAssignment"

    id: Mapped[int] = mapped_column(primary_key=True)
    box_id: Mapped[int] = mapped_column("boxId", ForeignKey("AlzaBox.id", ondelete="CASCADE"), index=True)
    carrier_id: Mapped[Optional[int]] = mapped_column("carrierId", ForeignKey("Carrier.id", ondelete="SET NULL"))
    route_name: Mapped[Optional[str]] = mapped_column("routeName", String(100), index=True)
    route_group: Mapped[Optional[str]] = mapped_column("routeGroup", String(100))
    depot_name: Mapped[Optional[str]] = mapped_column("depotName", String(100))
    planned_delivery_time: Mapped[Optional[str]] = mapped_column("plannedDeliveryTime", String(10))
    valid_from: Mapped[datetime] = mapped_column("validFrom", DateTime, default=datetime.utcnow)
    valid_to: Mapped[Optional[datetime]] = mapped_column("validTo", DateTime, nullable=True)
    # NEW: Vazba na Route
    route_id: Mapped[Optional[int]] = mapped_column("routeId", ForeignKey("Route.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, default=datetime.utcnow)

    box: Mapped["AlzaBox"] = relationship(back_populates="assignments")
    carrier: Mapped[Optional["Carrier"]] = relationship()
    route: Mapped[Optional["Route"]] = relationship(back_populates="box_assignments")

    __table_args__ = (
        Index('ix_assignment_route', 'routeName', 'validFrom'),
        Index('ix_assignment_route_id', 'routeId'),
    )


class AlzaBoxDelivery(Base):
    __tablename__ = "AlzaBoxDelivery"

    id: Mapped[int] = mapped_column(primary_key=True)
    box_id: Mapped[int] = mapped_column("boxId", ForeignKey("AlzaBox.id", ondelete="CASCADE"), index=True)
    delivery_date: Mapped[datetime] = mapped_column("deliveryDate", DateTime, index=True)
    delivery_type: Mapped[str] = mapped_column("deliveryType", String(10))
    route_name: Mapped[Optional[str]] = mapped_column("routeName", String(100))
    carrier_id: Mapped[Optional[int]] = mapped_column("carrierId", ForeignKey("Carrier.id", ondelete="SET NULL"))
    planned_time: Mapped[Optional[str]] = mapped_column("plannedTime", String(10))
    actual_time: Mapped[Optional[datetime]] = mapped_column("actualTime", DateTime)
    delay_minutes: Mapped[Optional[int]] = mapped_column("delayMinutes", Integer)
    on_time: Mapped[Optional[bool]] = mapped_column("onTime", Boolean)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, default=datetime.utcnow)

    box: Mapped["AlzaBox"] = relationship(back_populates="deliveries")
    carrier: Mapped[Optional["Carrier"]] = relationship()

    __table_args__ = (
        UniqueConstraint('boxId', 'deliveryDate', 'deliveryType', name='uq_box_date_type'),
        Index('ix_delivery_date_route', 'deliveryDate', 'routeName'),
        Index('ix_delivery_carrier_date', 'carrierId', 'deliveryDate'),
    )


class DeliveryStats(Base):
    __tablename__ = "DeliveryStats"

    id: Mapped[int] = mapped_column(primary_key=True)
    stats_date: Mapped[datetime] = mapped_column("statsDate", DateTime, index=True)
    delivery_type: Mapped[str] = mapped_column("deliveryType", String(10))
    route_name: Mapped[Optional[str]] = mapped_column("routeName", String(100))
    carrier_id: Mapped[Optional[int]] = mapped_column("carrierId", ForeignKey("Carrier.id", ondelete="SET NULL"))
    country: Mapped[Optional[str]] = mapped_column(String(5))
    region: Mapped[Optional[str]] = mapped_column(String(100))
    total_boxes: Mapped[int] = mapped_column("totalBoxes", Integer, default=0)
    delivered_on_time: Mapped[int] = mapped_column("deliveredOnTime", Integer, default=0)
    delivered_late: Mapped[int] = mapped_column("deliveredLate", Integer, default=0)
    avg_delay_minutes: Mapped[Optional[Decimal]] = mapped_column("avgDelayMinutes", Numeric(8, 2))
    max_delay_minutes: Mapped[Optional[int]] = mapped_column("maxDelayMinutes", Integer)
    on_time_pct: Mapped[Optional[Decimal]] = mapped_column("onTimePct", Numeric(5, 2))
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('statsDate', 'deliveryType', 'routeName', 'carrierId', name='uq_stats_day'),
        Index('ix_stats_carrier_date', 'carrierId', 'statsDate'),
    )
