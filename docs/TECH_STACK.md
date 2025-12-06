# Technická dokumentace - Transport Brain

> **Verze:** 3.11.0  
> **Datum:** Prosinec 2025  
> **Aktualizace:** Přidána dokumentace naming conventions

---

## 🛠️ TECH STACK

### Backend
| Komponenta | Technologie | Verze |
|------------|-------------|-------|
| Framework | **FastAPI** | latest |
| ORM | **SQLAlchemy 2.x** | async |
| Database | **PostgreSQL** | 15+ |
| Hosting | **Railway** | - |
| PDF parsing | pdfplumber | - |
| Excel parsing | openpyxl | - |

### Frontend
| Komponenta | Technologie |
|------------|-------------|
| Framework | **React** (Vite) |
| State management | **React Query** (TanStack) |
| Routing | React Router v6 |
| Styling | TailwindCSS |
| Charts | Recharts |
| Icons | Lucide React |
| Date handling | date-fns |

### Database
| Detail | Hodnota |
|--------|---------|
| Typ | PostgreSQL |
| Hosting | Railway |
| Správa | Postico (macOS) |
| Migrace | Ruční SQL skripty |

---

## 📝 NAMING CONVENTIONS

### Přehled konvencí podle vrstvy

| Vrstva | Konvence | Příklad |
|--------|----------|---------|
| **Databáze (PostgreSQL)** | camelCase | `carrierId`, `validFrom`, `priceConfigId` |
| **Python backend (interní)** | snake_case | `carrier_id`, `valid_from` |
| **API response (JSON)** | camelCase | `carrierId`, `validFrom` |
| **Frontend (JavaScript)** | camelCase | `carrierId`, `validFrom` |

### Databáze (PostgreSQL)

Tabulky i sloupce používají **camelCase** (původně z Prisma):

```sql
-- Správně (camelCase)
SELECT "carrierId", "validFrom", "priceConfigId" FROM "PriceConfig";
SELECT "fromCode", "toCode", "vehicleType" FROM "LinehaulRate";

-- Špatně (snake_case) - NEFUNGUJE!
SELECT carrier_id, valid_from FROM price_config;  -- ❌
```

**Příklady sloupců:**
- `PriceConfig`: `id`, `carrierId`, `contractId`, `validFrom`, `validTo`, `isActive`
- `LinehaulRate`: `priceConfigId`, `fromCode`, `toCode`, `vehicleType`, `isPosila`
- `FixRate`: `priceConfigId`, `routeType`, `routeCategory`, `depotId`
- `Contract`: `carrierId`, `validFrom`, `validTo`, `amendmentNumber`

### Python Backend

Interně používá **snake_case**, ale SQLAlchemy mapuje na camelCase v DB:

```python
# models.py - mapování snake_case → camelCase
class PriceConfig(Base):
    carrier_id: Mapped[int] = mapped_column("carrierId", ForeignKey(...))
    valid_from: Mapped[datetime] = mapped_column("validFrom", DateTime)
    is_active: Mapped[bool] = mapped_column("isActive", Boolean)
```

### API Response (JSON)

Pydantic schémata automaticky konvertují na **camelCase** pro frontend:

```python
# schemas.py
class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,  # snake_case → camelCase
        by_alias=True
    )

class PriceConfigResponse(CamelModel):
    carrier_id: int      # → JSON: "carrierId"
    valid_from: datetime # → JSON: "validFrom"
```

### Frontend (JavaScript)

Vždy pracuje s **camelCase** (nativní JS konvence):

```javascript
// Data z API přicházejí v camelCase
const { carrierId, validFrom, contractId } = priceConfig

// Mapa contract_id → číslo dodatku
contractList?.forEach(c => {
  contractMap[c.id] = c.amendmentNumber || '?'
})
```

---

## ⚠️ KRITICKÉ: ASYNC SQLALCHEMY

### Backend používá ASYNCHRONNÍ SQLAlchemy!

**SPRÁVNÝ přístup (async):**
```python
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

async def get_items(db: AsyncSession):
    result = await db.execute(select(Model))
    items = result.scalars().all()
    
    db.add(new_item)
    await db.flush()
    await db.commit()
```

**ŠPATNÝ přístup (sync) - NEFUNGUJE:**
```python
# ❌ TOTO NEFUNGUJE!
db.query(Model).filter(...).all()
```

### Klíčové rozdíly

| Operace | Sync (ŠPATNĚ) | Async (SPRÁVNĚ) |
|---------|---------------|-----------------|
| Select all | `db.query(M).all()` | `await db.execute(select(M))` + `.scalars().all()` |
| Filter | `db.query(M).filter(...)` | `select(M).where(...)` |
| Count | `db.query(M).count()` | `select(func.count(M.id))` |
| Get by ID | `db.query(M).get(id)` | `await db.get(M, id)` |

---

## ⚠️ KRITICKÉ: FRONTEND API CLIENT

### Vždy používat centrální api.js!

**SPRÁVNÝ přístup:**
```jsx
import { alzabox as alzaboxApi } from '../lib/api'
const data = await alzaboxApi.getSummary({ start_date, end_date })
```

**ŠPATNÝ přístup (NEFUNGUJE na produkci):**
```jsx
// ❌ TOTO NEFUNGUJE!
const data = await fetch('/api/alzabox/stats/summary').then(r => r.json())
```

---

## 📁 STRUKTURA PROJEKTU

```
transport-brain/
├── backend/
│   └── app/
│       ├── main.py
│       ├── database.py
│       ├── models.py
│       ├── api_key_middleware.py
│       └── routers/
│           ├── carriers.py
│           ├── proofs.py
│           ├── invoices.py
│           ├── contracts.py      # PDF extrakce ceníků ⭐
│           ├── prices.py
│           ├── route_plans.py
│           ├── analysis.py
│           ├── depots.py
│           ├── alzabox.py
│           ├── auth.py
│           └── expected_billing.py
│
├── frontend/
│   └── src/
│       ├── App.jsx
│       ├── components/
│       │   ├── Layout.jsx
│       │   └── LoginGate.jsx
│       ├── pages/
│       │   ├── Dashboard.jsx
│       │   ├── Documents.jsx
│       │   ├── Prices.jsx        # Ceníky per typ + depo ⭐
│       │   ├── Carriers.jsx
│       │   ├── AlzaBoxBI.jsx
│       │   └── ExpectedBilling.jsx
│       └── lib/
│           └── api.js
```

---

## 💰 EXTRAKCE CENÍKŮ Z PDF

### Podporované typy sazeb

| Typ | Příklad v PDF | Extrakce |
|-----|---------------|----------|
| **FIX** | "DIRECT Praha 3 200 Kč" | ✅ Auto |
| **KM** | "10,97 Kč bez DPH" | ✅ Auto |
| **DEPO** | "Hodinová sazba na DEPU 850 Kč" | ✅ Auto |
| **Sklad** | "Sklad ALL IN 410 000 Kč/měsíc" | ✅ Auto |
| **Linehaul** | "CZLC4 → Vratimov 24 180 Kč" | ✅ Auto |
| **Třídírna** | Tabulky CZTC1/CZLC4 → Vratimov | ✅ Auto |
| **Bonus** | "≥ 98 % + 35 600 Kč" | ✅ Auto |

### Formáty PDF

1. **Tabulkový formát**: číslo před názvem
2. **Inline formát**: název před číslem
3. **Třídírna tabulky**: speciální line-by-line parsing

---

## 🏭 ZOBRAZENÍ CENÍKŮ (Prices.jsx)

### Hierarchie zobrazení

```
Typ služby (AlzaBox, Třídírna, XL...)
└── Rozvozové depo (Vratimov, Nový Bydžov)
    ├── Linehaul (s počtem palet)
    ├── Rozvoz z depa (FIX, KM, DEPO)
    └── Skladové služby + Bonusy
```

### Expediční sklady vs Rozvozová depa

| Typ | Lokace | Kód | Účel |
|-----|--------|-----|------|
| Expediční sklad | Úžice | CZTC1 | Třídírna, zdroj linehaulů |
| Expediční sklad | Chrášťany | CZLC4 | Hlavní sklad, expedice |
| Rozvozové depo | Vratimov | - | Linehaul → třídění → rozvoz |
| Rozvozové depo | Nový Bydžov | - | Direct trasy + sklad |

### Deduplikace ceníků

Zobrazuje se **pouze nejnovější platná sazba**:

```jsx
function deduplicateRates(rates, getKey) {
  const map = new Map()
  rates.forEach(rate => {
    const key = getKey(rate)
    const existing = map.get(key)
    if (!existing || new Date(rate.validFrom) > new Date(existing.validFrom)) {
      map.set(key, rate)
    }
  })
  return Array.from(map.values())
}
```

### Linehaul typy vozů

| Typ | Palety |
|-----|--------|
| Dodávka | 8-10 pal |
| Solo | 15-21 pal |
| Kamion | 33 pal |

### Typy služeb

| Typ | Ikona | Barva |
|-----|-------|-------|
| AlzaBox | 📦 | Modrá #3b82f6 |
| Třídírna | 🏭 | Fialová #8b5cf6 |
| DROP 2.0 | 📦 | Zelená #10b981 |
| XL | 🚚 | Oranžová #f59e0b |
| Pobočka | 🏢 | Tyrkysová #06b6d4 |

---

## 🗃️ AKTUÁLNÍ MODULY

| Modul | Backend | Frontend | Route |
|-------|---------|----------|-------|
| Dashboard | analysis.py | Dashboard.jsx | `/dashboard` |
| Documents | contracts.py, proofs.py | Documents.jsx | `/upload` |
| Prices | prices.py | Prices.jsx | `/prices` |
| AlzaBox BI | alzabox.py | AlzaBoxBI.jsx | `/alzabox` |
| Carriers | carriers.py | Carriers.jsx | `/carriers` |
| Expected | expected_billing.py | ExpectedBilling.jsx | `/expected-billing` |

---

## 🚀 DEPLOYMENT

### Railway services
- **Backend**: `alza-cost-control-production.up.railway.app`
- **Frontend**: `amused-manifestation-production.up.railway.app`

### Environment variables

**Frontend:**
```
VITE_API_URL=https://alza-cost-control-production.up.railway.app/api
VITE_API_KEY=<secret>
```

**Backend:**
```
API_KEY=<secret>
DATABASE_URL=<railway postgres url>
FRONTEND_URL=<frontend url for CORS>
```

---

## 🔧 ČASTÉ PROBLÉMY

| Problém | Řešení |
|---------|--------|
| AsyncSession error | Použít `select()` místo `.query()` |
| Frontend vrací HTML | Použít api.js místo fetch() |
| Ceníky se neextrahují | Zkontrolovat PDF formát |
| Auth 404 | Zkontrolovat prefix v auth.py |
| SQL column not found | Použít camelCase: `"carrierId"` ne `carrier_id` |

---

*Aktualizováno: Prosinec 2025 - v3.11.0*
