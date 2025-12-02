"""
SQLAlchemy Models - matching the Prisma schema exactly
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, Index, Text, Numeric, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


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
    depots: Mapped[List["Depot"]] = relationship(back_populates="carrier", cascade="all, delete-orphan")
    contracts: Mapped[List["Contract"]] = relationship(back_populates="carrier", cascade="all, delete-orphan")
    prices: Mapped[List["PriceConfig"]] = relationship(back_populates="carrier", cascade="all, delete-orphan")
    proofs: Mapped[List["Proof"]] = relationship(back_populates="carrier", cascade="all, delete-orphan")
    invoices: Mapped[List["Invoice"]] = relationship(back_populates="carrier", cascade="all, delete-orphan")
    route_plans: Mapped[List["RoutePlan"]] = relationship(back_populates="carrier", cascade="all, delete-orphan")


class Depot(Base):
    __tablename__ = "Depot"

    id: Mapped[int] = mapped_column(primary_key=True)
    carrier_id: Mapped[int] = mapped_column("carrierId", ForeignKey("Carrier.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255))
    code: Mapped[Optional[str]] = mapped_column(String(50))
    type: Mapped[Optional[str]] = mapped_column(String(50))
    address: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, default=datetime.utcnow)

    # Relationships
    carrier: Mapped["Carrier"] = relationship(back_populates="depots")
    linehaul_from: Mapped[List["LinehaulRate"]] = relationship(
        back_populates="from_depot", foreign_keys="LinehaulRate.from_depot_id"
    )
    linehaul_to: Mapped[List["LinehaulRate"]] = relationship(
        back_populates="to_depot", foreign_keys="LinehaulRate.to_depot_id"
    )
    proofs: Mapped[List["Proof"]] = relationship(back_populates="depot")


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
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, default=datetime.utcnow)

    # Relationships
    carrier: Mapped["Carrier"] = relationship(back_populates="contracts")
    prices: Mapped[List["PriceConfig"]] = relationship(back_populates="contract")


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


class FixRate(Base):
    __tablename__ = "FixRate"

    id: Mapped[int] = mapped_column(primary_key=True)
    price_config_id: Mapped[int] = mapped_column("priceConfigId", ForeignKey("PriceConfig.id", ondelete="CASCADE"))
    route_type: Mapped[str] = mapped_column("routeType", String(50))
    rate: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, default=datetime.utcnow)

    price_config: Mapped["PriceConfig"] = relationship(back_populates="fix_rates")


class KmRate(Base):
    __tablename__ = "KmRate"

    id: Mapped[int] = mapped_column(primary_key=True)
    price_config_id: Mapped[int] = mapped_column("priceConfigId", ForeignKey("PriceConfig.id", ondelete="CASCADE"))
    route_type: Mapped[Optional[str]] = mapped_column("routeType", String(50))
    rate: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, default=datetime.utcnow)

    price_config: Mapped["PriceConfig"] = relationship(back_populates="km_rates")


class DepoRate(Base):
    __tablename__ = "DepoRate"

    id: Mapped[int] = mapped_column(primary_key=True)
    price_config_id: Mapped[int] = mapped_column("priceConfigId", ForeignKey("PriceConfig.id", ondelete="CASCADE"))
    depo_name: Mapped[str] = mapped_column("depoName", String(100))
    rate_type: Mapped[str] = mapped_column("rateType", String(50))
    rate: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, default=datetime.utcnow)

    price_config: Mapped["PriceConfig"] = relationship(back_populates="depo_rates")


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

    price_config: Mapped["PriceConfig"] = relationship(back_populates="linehaul_rates")
    from_depot: Mapped[Optional["Depot"]] = relationship(back_populates="linehaul_from", foreign_keys=[from_depot_id])
    to_depot: Mapped[Optional["Depot"]] = relationship(back_populates="linehaul_to", foreign_keys=[to_depot_id])


class BonusRate(Base):
    __tablename__ = "BonusRate"

    id: Mapped[int] = mapped_column(primary_key=True)
    price_config_id: Mapped[int] = mapped_column("priceConfigId", ForeignKey("PriceConfig.id", ondelete="CASCADE"))
    quality_min: Mapped[Decimal] = mapped_column("qualityMin", Numeric(5, 2))
    quality_max: Mapped[Decimal] = mapped_column("qualityMax", Numeric(5, 2))
    bonus_amount: Mapped[Decimal] = mapped_column("bonusAmount", Numeric(10, 2))
    total_with_bonus: Mapped[Decimal] = mapped_column("totalWithBonus", Numeric(10, 2))
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, default=datetime.utcnow)

    price_config: Mapped["PriceConfig"] = relationship(back_populates="bonus_rates")


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


class ProofRouteDetail(Base):
    __tablename__ = "ProofRouteDetail"

    id: Mapped[int] = mapped_column(primary_key=True)
    proof_id: Mapped[int] = mapped_column("proofId", ForeignKey("Proof.id", ondelete="CASCADE"))
    route_type: Mapped[str] = mapped_column("routeType", String(50))
    routes_count: Mapped[Optional[int]] = mapped_column("routesCount", Integer)
    count: Mapped[int] = mapped_column(Integer)
    rate: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))

    proof: Mapped["Proof"] = relationship(back_populates="route_details")


class ProofLinehaulDetail(Base):
    __tablename__ = "ProofLinehaulDetail"

    id: Mapped[int] = mapped_column(primary_key=True)
    proof_id: Mapped[int] = mapped_column("proofId", ForeignKey("Proof.id", ondelete="CASCADE"))
    description: Mapped[str] = mapped_column(Text)
    from_code: Mapped[Optional[str]] = mapped_column("fromCode", String(50))
    to_code: Mapped[Optional[str]] = mapped_column("toCode", String(50))
    vehicle_type: Mapped[Optional[str]] = mapped_column("vehicleType", String(50))
    days: Mapped[Optional[int]] = mapped_column(Integer)
    per_day: Mapped[Optional[int]] = mapped_column("perDay", Integer)
    rate: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2))

    proof: Mapped["Proof"] = relationship(back_populates="linehaul_details")


class ProofDepoDetail(Base):
    __tablename__ = "ProofDepoDetail"

    id: Mapped[int] = mapped_column(primary_key=True)
    proof_id: Mapped[int] = mapped_column("proofId", ForeignKey("Proof.id", ondelete="CASCADE"))
    depo_name: Mapped[str] = mapped_column("depoName", String(100))
    rate_type: Mapped[str] = mapped_column("rateType", String(50))
    days: Mapped[Optional[int]] = mapped_column(Integer)
    rate: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))

    proof: Mapped["Proof"] = relationship(back_populates="depo_details")


class ProofDailyDetail(Base):
    """Daily breakdown of routes from proof 'Podkladove tab' sheet"""
    __tablename__ = "ProofDailyDetail"

    id: Mapped[int] = mapped_column(primary_key=True)
    proof_id: Mapped[int] = mapped_column("proofId", ForeignKey("Proof.id", ondelete="CASCADE"))
    date: Mapped[datetime] = mapped_column(DateTime)
    
    # Počty tras (CNT) - CELKEM
    dr_dpo_count: Mapped[int] = mapped_column("drDpoCount", Integer, default=0)  # Direct Route DPO
    lh_dpo_count: Mapped[int] = mapped_column("lhDpoCount", Integer, default=0)  # Linehaul DPO
    dr_sd_count: Mapped[int] = mapped_column("drSdCount", Integer, default=0)    # Direct Route SD
    lh_sd_count: Mapped[int] = mapped_column("lhSdCount", Integer, default=0)    # Linehaul SD
    
    # Počty tras - VRATIMOV
    vratimov_dr_dpo: Mapped[int] = mapped_column("vratimovDrDpo", Integer, default=0)
    vratimov_lh_dpo: Mapped[int] = mapped_column("vratimovLhDpo", Integer, default=0)
    vratimov_dr_sd: Mapped[int] = mapped_column("vratimovDrSd", Integer, default=0)
    vratimov_lh_sd: Mapped[int] = mapped_column("vratimovLhSd", Integer, default=0)
    
    # Počty tras - NOVÝ BYDŽOV
    bydzov_dr_dpo: Mapped[int] = mapped_column("bydzovDrDpo", Integer, default=0)
    bydzov_lh_dpo: Mapped[int] = mapped_column("bydzovLhDpo", Integer, default=0)
    bydzov_dr_sd: Mapped[int] = mapped_column("bydzovDrSd", Integer, default=0)
    bydzov_lh_sd: Mapped[int] = mapped_column("bydzovLhSd", Integer, default=0)
    
    # Kilometry (KM) - CELKEM
    dr_dpo_km: Mapped[Optional[Decimal]] = mapped_column("drDpoKm", Numeric(10, 2), default=0)
    lh_dpo_km: Mapped[Optional[Decimal]] = mapped_column("lhDpoKm", Numeric(10, 2), default=0)
    dr_sd_km: Mapped[Optional[Decimal]] = mapped_column("drSdKm", Numeric(10, 2), default=0)
    lh_sd_km: Mapped[Optional[Decimal]] = mapped_column("lhSdKm", Numeric(10, 2), default=0)
    
    # Kilometry - VRATIMOV
    vratimov_dr_dpo_km: Mapped[Optional[Decimal]] = mapped_column("vratimovDrDpoKm", Numeric(10, 2), default=0)
    vratimov_lh_dpo_km: Mapped[Optional[Decimal]] = mapped_column("vratimovLhDpoKm", Numeric(10, 2), default=0)
    vratimov_dr_sd_km: Mapped[Optional[Decimal]] = mapped_column("vratimovDrSdKm", Numeric(10, 2), default=0)
    vratimov_lh_sd_km: Mapped[Optional[Decimal]] = mapped_column("vratimovLhSdKm", Numeric(10, 2), default=0)
    
    # Kilometry - NOVÝ BYDŽOV
    bydzov_dr_dpo_km: Mapped[Optional[Decimal]] = mapped_column("bydzovDrDpoKm", Numeric(10, 2), default=0)
    bydzov_lh_dpo_km: Mapped[Optional[Decimal]] = mapped_column("bydzovLhDpoKm", Numeric(10, 2), default=0)
    bydzov_dr_sd_km: Mapped[Optional[Decimal]] = mapped_column("bydzovDrSdKm", Numeric(10, 2), default=0)
    bydzov_lh_sd_km: Mapped[Optional[Decimal]] = mapped_column("bydzovLhSdKm", Numeric(10, 2), default=0)

    proof: Mapped["Proof"] = relationship(back_populates="daily_details")

    @property
    def total_dpo_count(self) -> int:
        return self.dr_dpo_count + self.lh_dpo_count

    @property
    def total_sd_count(self) -> int:
        return self.dr_sd_count + self.lh_sd_count

    @property
    def total_routes(self) -> int:
        return self.total_dpo_count + self.total_sd_count
    
    @property
    def vratimov_total(self) -> int:
        return self.vratimov_dr_dpo + self.vratimov_lh_dpo + self.vratimov_dr_sd + self.vratimov_lh_sd
    
    @property
    def bydzov_total(self) -> int:
        return self.bydzov_dr_dpo + self.bydzov_lh_dpo + self.bydzov_dr_sd + self.bydzov_lh_sd


class Invoice(Base):
    __tablename__ = "Invoice"

    id: Mapped[int] = mapped_column(primary_key=True)
    carrier_id: Mapped[int] = mapped_column("carrierId", ForeignKey("Carrier.id", ondelete="CASCADE"))
    proof_id: Mapped[Optional[int]] = mapped_column("proofId", ForeignKey("Proof.id"))
    invoice_number: Mapped[str] = mapped_column("invoiceNumber", String(50))
    period: Mapped[str] = mapped_column(String(20))
    issue_date: Mapped[Optional[datetime]] = mapped_column("issueDate", DateTime)
    due_date: Mapped[Optional[datetime]] = mapped_column("dueDate", DateTime)
    total_without_vat: Mapped[Optional[Decimal]] = mapped_column("totalWithoutVat", Numeric(12, 2))
    vat_amount: Mapped[Optional[Decimal]] = mapped_column("vatAmount", Numeric(12, 2))
    total_with_vat: Mapped[Optional[Decimal]] = mapped_column("totalWithVat", Numeric(12, 2))
    status: Mapped[str] = mapped_column(String(50), default="pending")
    file_url: Mapped[Optional[str]] = mapped_column("fileUrl", Text)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column("updatedAt", DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    carrier: Mapped["Carrier"] = relationship(back_populates="invoices")
    proof: Mapped[Optional["Proof"]] = relationship(back_populates="invoices")
    items: Mapped[List["InvoiceItem"]] = relationship(back_populates="invoice", cascade="all, delete-orphan")


class InvoiceItem(Base):
    __tablename__ = "InvoiceItem"

    id: Mapped[int] = mapped_column(primary_key=True)
    invoice_id: Mapped[int] = mapped_column("invoiceId", ForeignKey("Invoice.id", ondelete="CASCADE"))
    item_type: Mapped[str] = mapped_column("itemType", String(50))
    description: Mapped[Optional[str]] = mapped_column(Text)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))

    invoice: Mapped["Invoice"] = relationship(back_populates="items")


class ProofAnalysis(Base):
    __tablename__ = "ProofAnalysis"

    id: Mapped[int] = mapped_column(primary_key=True)
    proof_id: Mapped[int] = mapped_column("proofId", ForeignKey("Proof.id", ondelete="CASCADE"))
    status: Mapped[str] = mapped_column(String(50))
    errors_json: Mapped[Optional[str]] = mapped_column("errorsJson", Text)
    warnings_json: Mapped[Optional[str]] = mapped_column("warningsJson", Text)
    ok_json: Mapped[Optional[str]] = mapped_column("okJson", Text)
    diff_fix: Mapped[Optional[Decimal]] = mapped_column("diffFix", Numeric(12, 2))
    diff_km: Mapped[Optional[Decimal]] = mapped_column("diffKm", Numeric(12, 2))
    diff_linehaul: Mapped[Optional[Decimal]] = mapped_column("diffLinehaul", Numeric(12, 2))
    diff_depo: Mapped[Optional[Decimal]] = mapped_column("diffDepo", Numeric(12, 2))
    missing_rates_json: Mapped[Optional[str]] = mapped_column("missingRatesJson", Text)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, default=datetime.utcnow)

    proof: Mapped["Proof"] = relationship(back_populates="analyses")


class AuditLog(Base):
    __tablename__ = "AuditLog"

    id: Mapped[int] = mapped_column(primary_key=True)
    entity_type: Mapped[str] = mapped_column("entityType", String(50))
    entity_id: Mapped[int] = mapped_column("entityId", Integer)
    action: Mapped[str] = mapped_column(String(50))
    user_id: Mapped[Optional[str]] = mapped_column("userId", String(100))
    changes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, default=datetime.utcnow)


# =============================================================================
# ROUTE PLANNING MODELS
# =============================================================================

class RoutePlan(Base):
    """Plánovací soubor tras - hlavička"""
    __tablename__ = "RoutePlan"

    id: Mapped[int] = mapped_column(primary_key=True)
    carrier_id: Mapped[int] = mapped_column("carrierId", ForeignKey("Carrier.id", ondelete="CASCADE"))
    valid_from: Mapped[datetime] = mapped_column("validFrom", DateTime)
    valid_to: Mapped[Optional[datetime]] = mapped_column("validTo", DateTime, nullable=True)
    file_name: Mapped[Optional[str]] = mapped_column("fileName", String(255))
    
    # Typ plánu - BOTH (bez přípony), DPO (_DPO), SD (_SD)
    plan_type: Mapped[str] = mapped_column("planType", String(10), default="BOTH")
    
    # Depo - VRATIMOV, BYDZOV, nebo BOTH (obsahuje trasy pro obě depa)
    depot: Mapped[str] = mapped_column("depot", String(20), default="BOTH")
    
    # Souhrn z plánu - celkem
    total_routes: Mapped[int] = mapped_column("totalRoutes", Integer, default=0)
    dpo_routes_count: Mapped[int] = mapped_column("dpoRoutesCount", Integer, default=0)
    sd_routes_count: Mapped[int] = mapped_column("sdRoutesCount", Integer, default=0)
    dpo_linehaul_count: Mapped[int] = mapped_column("dpoLinehaulCount", Integer, default=0)
    sd_linehaul_count: Mapped[int] = mapped_column("sdLinehaulCount", Integer, default=0)
    total_distance_km: Mapped[Optional[Decimal]] = mapped_column("totalDistanceKm", Numeric(10, 2))
    total_stops: Mapped[int] = mapped_column("totalStops", Integer, default=0)
    
    # Souhrn per depo - Vratimov (Moravskoslezsko)
    vratimov_dpo_count: Mapped[int] = mapped_column("vratimovDpoCount", Integer, default=0)
    vratimov_sd_count: Mapped[int] = mapped_column("vratimovSdCount", Integer, default=0)
    vratimov_stops: Mapped[int] = mapped_column("vratimovStops", Integer, default=0)
    vratimov_km: Mapped[Optional[Decimal]] = mapped_column("vratimovKm", Numeric(10, 2), default=0)
    vratimov_duration_min: Mapped[int] = mapped_column("vratimovDurationMin", Integer, default=0)  # celková doba v minutách
    
    # Souhrn per depo - Nový Bydžov (ostatní regiony)
    bydzov_dpo_count: Mapped[int] = mapped_column("bydzovDpoCount", Integer, default=0)
    bydzov_sd_count: Mapped[int] = mapped_column("bydzovSdCount", Integer, default=0)
    bydzov_stops: Mapped[int] = mapped_column("bydzovStops", Integer, default=0)
    bydzov_km: Mapped[Optional[Decimal]] = mapped_column("bydzovKm", Numeric(10, 2), default=0)
    bydzov_duration_min: Mapped[int] = mapped_column("bydzovDurationMin", Integer, default=0)  # celková doba v minutách
    
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column("updatedAt", DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    carrier: Mapped["Carrier"] = relationship(back_populates="route_plans")
    routes: Mapped[List["RoutePlanRoute"]] = relationship(back_populates="route_plan", cascade="all, delete-orphan")

    # Unique constraint: carrier + valid_from + plan_type + depot
    __table_args__ = (
        UniqueConstraint('carrierId', 'validFrom', 'planType', 'depot', name='uq_carrier_date_plantype_depot'),
    )


class RoutePlanRoute(Base):
    """Jednotlivé trasy v plánu (sheet Routes)"""
    __tablename__ = "RoutePlanRoute"

    id: Mapped[int] = mapped_column(primary_key=True)
    route_plan_id: Mapped[int] = mapped_column("routePlanId", ForeignKey("RoutePlan.id", ondelete="CASCADE"))
    
    route_name: Mapped[str] = mapped_column("routeName", String(100))
    route_letter: Mapped[Optional[str]] = mapped_column("routeLetter", String(10))
    carrier_name: Mapped[Optional[str]] = mapped_column("carrierName", String(100))
    
    route_type: Mapped[str] = mapped_column("routeType", String(20))  # DPO, SD, nebo BOTH (DR-DR jede 2x denně)
    delivery_type: Mapped[Optional[str]] = mapped_column("deliveryType", String(20))  # LH-LH, DR, DR-DR, etc.
    depot: Mapped[Optional[str]] = mapped_column("depot", String(20))  # VRATIMOV nebo BYDZOV
    start_location: Mapped[Optional[str]] = mapped_column("startLocation", String(255))
    stops_count: Mapped[int] = mapped_column("stopsCount", Integer, default=0)
    max_capacity: Mapped[int] = mapped_column("maxCapacity", Integer, default=0)
    start_time: Mapped[Optional[str]] = mapped_column("startTime", String(10))
    end_time: Mapped[Optional[str]] = mapped_column("endTime", String(10))
    work_time: Mapped[Optional[str]] = mapped_column("workTime", String(10))
    distance_km: Mapped[Optional[Decimal]] = mapped_column("distanceKm", Numeric(10, 2))

    # Relationships
    route_plan: Mapped["RoutePlan"] = relationship(back_populates="routes")
    details: Mapped[List["RoutePlanDetail"]] = relationship(back_populates="route", cascade="all, delete-orphan")


class RoutePlanDetail(Base):
    """Detaily jednotlivých zastávek na trase"""
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

    # Relationships
    route: Mapped["RoutePlanRoute"] = relationship(back_populates="details")
