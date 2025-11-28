"""
SQLAlchemy Models - matching the Prisma schema
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, Index, Text, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Carrier(Base):
    __tablename__ = "carriers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    ico: Mapped[Optional[str]] = mapped_column(String(20))
    dic: Mapped[Optional[str]] = mapped_column(String(20))
    address: Mapped[Optional[str]] = mapped_column(Text)
    contact: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    depots: Mapped[List["Depot"]] = relationship(back_populates="carrier", cascade="all, delete-orphan")
    contracts: Mapped[List["Contract"]] = relationship(back_populates="carrier", cascade="all, delete-orphan")
    prices: Mapped[List["PriceConfig"]] = relationship(back_populates="carrier", cascade="all, delete-orphan")
    proofs: Mapped[List["Proof"]] = relationship(back_populates="carrier", cascade="all, delete-orphan")
    invoices: Mapped[List["Invoice"]] = relationship(back_populates="carrier", cascade="all, delete-orphan")


class Depot(Base):
    __tablename__ = "depots"

    id: Mapped[int] = mapped_column(primary_key=True)
    carrier_id: Mapped[int] = mapped_column(ForeignKey("carriers.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255))
    code: Mapped[Optional[str]] = mapped_column(String(50))
    type: Mapped[Optional[str]] = mapped_column(String(50))
    address: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    carrier: Mapped["Carrier"] = relationship(back_populates="depots")
    linehaul_from: Mapped[List["LinehaulRate"]] = relationship(
        back_populates="from_depot", foreign_keys="LinehaulRate.from_depot_id"
    )
    linehaul_to: Mapped[List["LinehaulRate"]] = relationship(
        back_populates="to_depot", foreign_keys="LinehaulRate.to_depot_id"
    )
    proofs: Mapped[List["Proof"]] = relationship(back_populates="depot")

    __table_args__ = (Index("ix_depots_carrier_id", "carrier_id"),)


class Contract(Base):
    __tablename__ = "contracts"

    id: Mapped[int] = mapped_column(primary_key=True)
    carrier_id: Mapped[int] = mapped_column(ForeignKey("carriers.id", ondelete="CASCADE"))
    number: Mapped[str] = mapped_column(String(100))
    type: Mapped[Optional[str]] = mapped_column(String(50))
    valid_from: Mapped[datetime] = mapped_column(DateTime)
    valid_to: Mapped[Optional[datetime]] = mapped_column(DateTime)
    document_url: Mapped[Optional[str]] = mapped_column(Text)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    carrier: Mapped["Carrier"] = relationship(back_populates="contracts")
    prices: Mapped[List["PriceConfig"]] = relationship(back_populates="contract")

    __table_args__ = (Index("ix_contracts_carrier_id", "carrier_id"),)


class PriceConfig(Base):
    __tablename__ = "price_configs"

    id: Mapped[int] = mapped_column(primary_key=True)
    carrier_id: Mapped[int] = mapped_column(ForeignKey("carriers.id", ondelete="CASCADE"))
    contract_id: Mapped[Optional[int]] = mapped_column(ForeignKey("contracts.id"))
    type: Mapped[str] = mapped_column(String(50))
    valid_from: Mapped[datetime] = mapped_column(DateTime)
    valid_to: Mapped[Optional[datetime]] = mapped_column(DateTime)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    carrier: Mapped["Carrier"] = relationship(back_populates="prices")
    contract: Mapped[Optional["Contract"]] = relationship(back_populates="prices")
    fix_rates: Mapped[List["FixRate"]] = relationship(back_populates="price_config", cascade="all, delete-orphan")
    km_rates: Mapped[List["KmRate"]] = relationship(back_populates="price_config", cascade="all, delete-orphan")
    depo_rates: Mapped[List["DepoRate"]] = relationship(back_populates="price_config", cascade="all, delete-orphan")
    linehaul_rates: Mapped[List["LinehaulRate"]] = relationship(back_populates="price_config", cascade="all, delete-orphan")
    bonus_rates: Mapped[List["BonusRate"]] = relationship(back_populates="price_config", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_price_configs_carrier_id", "carrier_id"),
        Index("ix_price_configs_type_valid_from", "type", "valid_from"),
    )


class FixRate(Base):
    __tablename__ = "fix_rates"

    id: Mapped[int] = mapped_column(primary_key=True)
    price_config_id: Mapped[int] = mapped_column(ForeignKey("price_configs.id", ondelete="CASCADE"))
    route_type: Mapped[str] = mapped_column(String(50))
    rate: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    price_config: Mapped["PriceConfig"] = relationship(back_populates="fix_rates")

    __table_args__ = (Index("ix_fix_rates_price_config_id", "price_config_id"),)


class KmRate(Base):
    __tablename__ = "km_rates"

    id: Mapped[int] = mapped_column(primary_key=True)
    price_config_id: Mapped[int] = mapped_column(ForeignKey("price_configs.id", ondelete="CASCADE"))
    route_type: Mapped[Optional[str]] = mapped_column(String(50))
    rate: Mapped[Decimal] = mapped_column(Numeric(10, 4))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    price_config: Mapped["PriceConfig"] = relationship(back_populates="km_rates")

    __table_args__ = (Index("ix_km_rates_price_config_id", "price_config_id"),)


class DepoRate(Base):
    __tablename__ = "depo_rates"

    id: Mapped[int] = mapped_column(primary_key=True)
    price_config_id: Mapped[int] = mapped_column(ForeignKey("price_configs.id", ondelete="CASCADE"))
    depo_name: Mapped[str] = mapped_column(String(100))
    rate_type: Mapped[str] = mapped_column(String(50))
    rate: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    price_config: Mapped["PriceConfig"] = relationship(back_populates="depo_rates")

    __table_args__ = (Index("ix_depo_rates_price_config_id", "price_config_id"),)


class LinehaulRate(Base):
    __tablename__ = "linehaul_rates"

    id: Mapped[int] = mapped_column(primary_key=True)
    price_config_id: Mapped[int] = mapped_column(ForeignKey("price_configs.id", ondelete="CASCADE"))
    from_depot_id: Mapped[Optional[int]] = mapped_column(ForeignKey("depots.id"))
    to_depot_id: Mapped[Optional[int]] = mapped_column(ForeignKey("depots.id"))
    from_code: Mapped[Optional[str]] = mapped_column(String(50))
    to_code: Mapped[Optional[str]] = mapped_column(String(50))
    vehicle_type: Mapped[str] = mapped_column(String(50))
    rate: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    is_posila: Mapped[bool] = mapped_column(Boolean, default=False)
    description: Mapped[Optional[str]] = mapped_column(Text)

    price_config: Mapped["PriceConfig"] = relationship(back_populates="linehaul_rates")
    from_depot: Mapped[Optional["Depot"]] = relationship(back_populates="linehaul_from", foreign_keys=[from_depot_id])
    to_depot: Mapped[Optional["Depot"]] = relationship(back_populates="linehaul_to", foreign_keys=[to_depot_id])

    __table_args__ = (Index("ix_linehaul_rates_price_config_id", "price_config_id"),)


class BonusRate(Base):
    __tablename__ = "bonus_rates"

    id: Mapped[int] = mapped_column(primary_key=True)
    price_config_id: Mapped[int] = mapped_column(ForeignKey("price_configs.id", ondelete="CASCADE"))
    quality_min: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    quality_max: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    bonus_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    total_with_bonus: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    price_config: Mapped["PriceConfig"] = relationship(back_populates="bonus_rates")

    __table_args__ = (Index("ix_bonus_rates_price_config_id", "price_config_id"),)


class Proof(Base):
    __tablename__ = "proofs"

    id: Mapped[int] = mapped_column(primary_key=True)
    carrier_id: Mapped[int] = mapped_column(ForeignKey("carriers.id", ondelete="CASCADE"))
    depot_id: Mapped[Optional[int]] = mapped_column(ForeignKey("depots.id"))
    period: Mapped[str] = mapped_column(String(20))
    period_date: Mapped[datetime] = mapped_column(DateTime)
    file_name: Mapped[Optional[str]] = mapped_column(String(255))
    file_url: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(50), default="pending")
    total_fix: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    total_km: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    total_linehaul: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    total_depo: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    total_bonus: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    total_penalty: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    grand_total: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    carrier: Mapped["Carrier"] = relationship(back_populates="proofs")
    depot: Mapped[Optional["Depot"]] = relationship(back_populates="proofs")
    route_details: Mapped[List["ProofRouteDetail"]] = relationship(back_populates="proof", cascade="all, delete-orphan")
    linehaul_details: Mapped[List["ProofLinehaulDetail"]] = relationship(back_populates="proof", cascade="all, delete-orphan")
    depo_details: Mapped[List["ProofDepoDetail"]] = relationship(back_populates="proof", cascade="all, delete-orphan")
    invoices: Mapped[List["Invoice"]] = relationship(back_populates="proof")
    analyses: Mapped[List["ProofAnalysis"]] = relationship(back_populates="proof", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_proofs_carrier_id", "carrier_id"),
        Index("ix_proofs_period", "period"),
    )


class ProofRouteDetail(Base):
    __tablename__ = "proof_route_details"

    id: Mapped[int] = mapped_column(primary_key=True)
    proof_id: Mapped[int] = mapped_column(ForeignKey("proofs.id", ondelete="CASCADE"))
    route_type: Mapped[str] = mapped_column(String(50))
    count: Mapped[int] = mapped_column(Integer)
    rate: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))

    proof: Mapped["Proof"] = relationship(back_populates="route_details")

    __table_args__ = (Index("ix_proof_route_details_proof_id", "proof_id"),)


class ProofLinehaulDetail(Base):
    __tablename__ = "proof_linehaul_details"

    id: Mapped[int] = mapped_column(primary_key=True)
    proof_id: Mapped[int] = mapped_column(ForeignKey("proofs.id", ondelete="CASCADE"))
    description: Mapped[str] = mapped_column(Text)
    from_code: Mapped[Optional[str]] = mapped_column(String(50))
    to_code: Mapped[Optional[str]] = mapped_column(String(50))
    vehicle_type: Mapped[Optional[str]] = mapped_column(String(50))
    days: Mapped[Optional[int]] = mapped_column(Integer)
    per_day: Mapped[Optional[int]] = mapped_column(Integer)
    rate: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2))

    proof: Mapped["Proof"] = relationship(back_populates="linehaul_details")

    __table_args__ = (Index("ix_proof_linehaul_details_proof_id", "proof_id"),)


class ProofDepoDetail(Base):
    __tablename__ = "proof_depo_details"

    id: Mapped[int] = mapped_column(primary_key=True)
    proof_id: Mapped[int] = mapped_column(ForeignKey("proofs.id", ondelete="CASCADE"))
    depo_name: Mapped[str] = mapped_column(String(100))
    rate_type: Mapped[str] = mapped_column(String(50))
    days: Mapped[Optional[int]] = mapped_column(Integer)
    rate: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))

    proof: Mapped["Proof"] = relationship(back_populates="depo_details")

    __table_args__ = (Index("ix_proof_depo_details_proof_id", "proof_id"),)


class Invoice(Base):
    __tablename__ = "invoices"

    id: Mapped[int] = mapped_column(primary_key=True)
    carrier_id: Mapped[int] = mapped_column(ForeignKey("carriers.id", ondelete="CASCADE"))
    proof_id: Mapped[Optional[int]] = mapped_column(ForeignKey("proofs.id"))
    invoice_number: Mapped[str] = mapped_column(String(50))
    period: Mapped[str] = mapped_column(String(20))
    issue_date: Mapped[Optional[datetime]] = mapped_column(DateTime)
    due_date: Mapped[Optional[datetime]] = mapped_column(DateTime)
    total_without_vat: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    vat_amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    total_with_vat: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    status: Mapped[str] = mapped_column(String(50), default="pending")
    file_url: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    carrier: Mapped["Carrier"] = relationship(back_populates="invoices")
    proof: Mapped[Optional["Proof"]] = relationship(back_populates="invoices")
    items: Mapped[List["InvoiceItem"]] = relationship(back_populates="invoice", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_invoices_carrier_id", "carrier_id"),
        Index("ix_invoices_period", "period"),
        Index("ix_invoices_proof_id", "proof_id"),
    )


class InvoiceItem(Base):
    __tablename__ = "invoice_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    invoice_id: Mapped[int] = mapped_column(ForeignKey("invoices.id", ondelete="CASCADE"))
    item_type: Mapped[str] = mapped_column(String(50))
    description: Mapped[Optional[str]] = mapped_column(Text)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))

    invoice: Mapped["Invoice"] = relationship(back_populates="items")

    __table_args__ = (Index("ix_invoice_items_invoice_id", "invoice_id"),)


class ProofAnalysis(Base):
    __tablename__ = "proof_analyses"

    id: Mapped[int] = mapped_column(primary_key=True)
    proof_id: Mapped[int] = mapped_column(ForeignKey("proofs.id", ondelete="CASCADE"))
    status: Mapped[str] = mapped_column(String(50))
    errors_json: Mapped[Optional[str]] = mapped_column(Text)
    warnings_json: Mapped[Optional[str]] = mapped_column(Text)
    ok_json: Mapped[Optional[str]] = mapped_column(Text)
    diff_fix: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    diff_km: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    diff_linehaul: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    diff_depo: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    missing_rates_json: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    proof: Mapped["Proof"] = relationship(back_populates="analyses")

    __table_args__ = (Index("ix_proof_analyses_proof_id", "proof_id"),)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    entity_type: Mapped[str] = mapped_column(String(50))
    entity_id: Mapped[int] = mapped_column(Integer)
    action: Mapped[str] = mapped_column(String(50))
    user_id: Mapped[Optional[str]] = mapped_column(String(100))
    changes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (Index("ix_audit_logs_entity", "entity_type", "entity_id"),)
