# Technická dokumentace - Transport Brain

> **Verze:** 3.12.0  
> **Datum:** 7. prosince 2025  
> **Aktualizace:** Opravy DB schématu, Expected Billing, konsolidace veškeré dokumentace

---

## 🏗️ ARCHITEKTURA

```
┌─────────────────────────────────────────────────────────────┐
│                      RAILWAY CLOUD                          │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────┐ │
│  │ Cost_control_    │  │ Cost_control_    │  │ Postgres  │ │
│  │ frontend         │  │ backend          │  │           │ │
│  │ (React + Vite)   │  │ (FastAPI)        │  │ (DB)      │ │
│  └────────┬─────────┘  └────────┬─────────┘  └─────┬─────┘ │
│           │                     │                   │       │
│           └─────────────────────┴───────────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠️ TECH STACK

### Backend
| Komponenta | Technologie | Verze |
|------------|-------------|-------|
| Runtime | **Python** | 3.11+ |
| Framework | **FastAPI** | 0.104+ |
| Server | **Uvicorn** | 0.24+ |
| ORM | **SQLAlchemy 2.x** | async |
| Database | **PostgreSQL** | 15+ |
| DB Driver | **asyncpg** | 0.29+ |
| Validace | **Pydantic** | 2.x |
| Hosting | **Railway** | - |
| PDF parsing | pdfplumber | - |
| Excel parsing | openpyxl | - |

### Frontend
| Komponenta | Technologie | Verze |
|------------|-------------|-------|
| Framework | **React** | 18.x |
| Build tool | **Vite** | 5.x |
| Routing | React Router | v6 |
| State (global) | React Context | - |
| State (server) | **React Query** (TanStack) | - |
| Styling | TailwindCSS | - |
| Charts | Recharts | - |
| Icons | Lucide React | - |
| Date handling | date-fns | - |

### Database
| Detail | Hodnota |
|--------|---------|
| Typ | PostgreSQL |
| Hosting | Railway |
| Správa | Postico (macOS) |
| Migrace | Ruční SQL skripty |

---

## 📝 NAMING CONVENTIONS

### Přehled konvencí napříč vrstvami

| Vrstva | Konvence | Příklad |
|--------|----------|---------|
| **Databáze (PostgreSQL)** | camelCase | `carrierId`, `validFrom`, `priceConfigId` |
| **Python backend (interní)** | snake_case | `carrier_id`, `valid_from` |
| **API response (JSON)** | camelCase | `carrierId`, `validFrom` |
| **Frontend (JavaScript)** | camelCase | `carrierId`, `validFrom` |

### SQL dotazy - POZOR na uvozovky!

```sql
-- ✅ SPRÁVNĚ (camelCase s uvozovkami)
SELECT "carrierId", "validFrom", "priceConfigId" FROM "PriceConfig";
SELECT "fromCode", "toCode", "vehicleType" FROM "LinehaulRate";
SELECT "amendmentNumber" FROM "Contract";

-- ❌ ŠPATNĚ (snake_case) - NEFUNGUJE!
SELECT carrier_id, valid_from FROM price_config;
```

### Databázové sloupce (camelCase)

**Contract:**
- `id`, `carrierId`, `number`, `type`, `validFrom`, `validTo`, `documentUrl`, `notes`, `amendmentNumber`, `createdAt`

**PriceConfig:**
- `id`, `carrierId`, `contractId`, `type`, `validFrom`, `validTo`, `isActive`, `createdAt`

**LinehaulRate:**
- `id`, `priceConfigId`, `fromCode`, `toCode`, `vehicleType`, `rate`, `isPosila`, `palletCapacityMin`, `palletCapacityMax`

**FixRate:**
- `id`, `priceConfigId`, `routeType`, `rate`, `routeCategory`, `depotId`

**DepoRate:**
- `id`, `priceConfigId`, `depoName`, `rateType`, `rate`, `depotId`

### SQLAlchemy mapování (models.py)

```python
class Contract(Base):
    __tablename__ = "Contract"
    
    carrier_id: Mapped[int] = mapped_column("carrierId", ForeignKey(...))
    valid_from: Mapped[datetime] = mapped_column("validFrom", DateTime)
    amendment_number: Mapped[Optional[int]] = mapped_column("amendmentNumber", Integer, nullable=True)
```

### Pydantic auto-konverze (schemas.py)

```python
from humps import camelize

def to_camel(string: str) -> str:
    return camelize(string)

class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )
```

---

## ⚠️ KRITICKÉ: ASYNC SQLALCHEMY

### Backend používá ASYNCHRONNÍ SQLAlchemy!

**SPRÁVNÝ přístup (async):**
```python
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

async def get_items(db: AsyncSession):
    # SELECT pomocí select()
    result = await db.execute(select(Model))
    items = result.scalars().all()
    
    # INSERT/UPDATE
    db.add(new_item)
    await db.flush()  # pro získání ID
    await db.commit()
    
    # Agregace
    result = await db.execute(
        select(func.count(Model.id)).where(Model.active == True)
    )
    count = result.scalar()
```

**ŠPATNÝ přístup (sync) - NEFUNGUJE:**
```python
# ❌ TOTO NEFUNGUJE!
db.query(Model).filter(...).all()
db.session.query(...)
```

### Klíčové rozdíly

| Operace | Sync (ŠPATNĚ) | Async (SPRÁVNĚ) |
|---------|---------------|-----------------|
| Select all | `db.query(M).all()` | `await db.execute(select(M))` + `.scalars().all()` |
| Filter | `db.query(M).filter(...)` | `select(M).where(...)` |
| Count | `db.query(M).count()` | `select(func.count(M.id))` |
| Get by ID | `db.query(M).get(id)` | `await db.get(M, id)` |
| Add | `db.add(obj)` | `db.add(obj)` + `await db.flush()` |
| Commit | `db.commit()` | `await db.commit()` |
| Rollback | `db.rollback()` | `await db.rollback()` |

### Relationship loading (lazy loading nefunguje v async)

```python
from sqlalchemy.orm import selectinload

result = await db.execute(
    select(Parent).options(selectinload(Parent.children))
)
```

---

## ⚠️ KRITICKÉ: REACT ROUTER (Outlet vs Children)

### Layout komponenta MUSÍ používat `<Outlet />`!

Když je Layout jako parent route v App.jsx, **NELZE použít `{children}`** - musí se použít `<Outlet />` z react-router-dom.

**SPRÁVNÝ přístup:**
```jsx
// Layout.jsx
import { Outlet } from 'react-router-dom'

export default function Layout() {  // BEZ { children }
  return (
    <div>
      <Sidebar />
      <main>
        <Outlet />  {/* SPRÁVNĚ - renderuje child routes */}
      </main>
    </div>
  )
}

// App.jsx
<Routes>
  <Route path="/" element={<Layout />}>
    <Route index element={<Navigate to="/dashboard" replace />} />
    <Route path="dashboard" element={<Dashboard />} />
    <Route path="upload" element={<Documents />} />
  </Route>
</Routes>
```

**ŠPATNÝ přístup (NEFUNGUJE):**
```jsx
// ❌ TOTO NEFUNGUJE s nested routes!
export default function Layout({ children }) {
  return (
    <div>
      <Sidebar />
      <main>{children}</main>  // ŠPATNĚ - children bude undefined
    </div>
  )
}
```

### Navigační cesty MUSÍ odpovídat routám v App.jsx!

```jsx
// App.jsx definuje tyto cesty:
<Route path="dashboard" element={<Dashboard />} />
<Route path="upload" element={<Documents />} />
<Route path="prices" element={<Prices />} />

// Layout.jsx navigace MUSÍ používat STEJNÉ cesty:
const navigation = [
  { name: 'Fakturace', href: '/dashboard', ... },  // ✓ odpovídá
  { name: 'Dokumenty', href: '/upload', ... },     // ✓ odpovídá
  { name: 'Ceníky', href: '/prices', ... },        // ✓ odpovídá
]

// ❌ ŠPATNĚ - cesty se neshodují:
const navigation = [
  { name: 'Fakturace', href: '/', ... },           // ✗ v App.jsx je /dashboard
  { name: 'Dokumenty', href: '/documents', ... },  // ✗ v App.jsx je /upload
]
```

---

## ⚠️ KRITICKÉ: FRONTEND API CLIENT

### Vždy používat centrální api.js!

Frontend MUSÍ používat axios client z `lib/api.js`, **NE lokální fetch()** volání.

**SPRÁVNÝ přístup:**
```jsx
import { alzabox as alzaboxApi } from '../lib/api'
const data = await alzaboxApi.getSummary({ start_date, end_date })
```

**ŠPATNÝ přístup (NEFUNGUJE na produkci):**
```jsx
// ❌ TOTO NEFUNGUJE!
const data = await fetch('/api/alzabox/stats/summary').then(r => r.json())
// Důvod: Relativní URL jde na frontend server, ne na backend
// Chybí API key v headerech
```

### Proč api.js?
1. **Správná URL** - používá `VITE_API_URL` environment variable
2. **API autentizace** - automaticky přidává `X-API-Key` header
3. **Error handling** - centralizované zpracování chyb

### FormData upload (správný způsob)

```javascript
// V api.js - definice upload funkce
export const myResource = {
  // ... ostatní metody ...
  
  upload: (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/myresource/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then(r => r.data)
  }
}

// V komponentě - použití
const handleUpload = async (file) => {
  try {
    const result = await myResource.upload(file)
    console.log('Nahráno:', result)
  } catch (error) {
    console.error('Chyba uploadu:', error)
  }
}
```

### API Timeouty (frontend/src/lib/api.js)
```javascript
// Default
timeout: 30000  // 30 sekund

// Speciální endpointy
alzabox/import/*: 300000   // 5 minut
proofs/upload:    180000   // 3 minuty
contracts/upload: 120000   // 2 minuty
```

---

## 🔗 API KONVENCE

### URL struktura
```
/api/{resource}                 # GET list, POST create
/api/{resource}/{id}            # GET one, PUT update, DELETE
/api/{resource}/{id}/action     # POST akce
```

### Response formát
```javascript
// Seznam
{ "items": [...], "total": 100 }

// Detail
{ "id": 1, "name": "...", ... }

// Akce
{ "success": true, "message": "..." }
```

### Health Check
```
GET /health  →  {"status": "healthy", "database": "connected"}
```

---

## 📁 STRUKTURA PROJEKTU

```
transport-brain/
├── backend/
│   └── app/
│       ├── main.py              # FastAPI + router registrace
│       ├── database.py          # SQLAlchemy async konfigurace
│       ├── models.py            # Databázové modely
│       ├── schemas.py           # Pydantic schémata
│       ├── api_key_middleware.py
│       └── routers/
│           ├── auth.py          # /api/auth/*
│           ├── carriers.py      # /api/carriers/*
│           ├── proofs.py        # /api/proofs/*
│           ├── invoices.py      # /api/invoices/*
│           ├── contracts.py     # /api/contracts/* (PDF extrakce)
│           ├── prices.py        # /api/prices/*
│           ├── route_plans.py   # /api/route-plans/*
│           ├── analysis.py      # /api/analysis/*
│           ├── depots.py        # /api/depots/*
│           ├── alzabox.py       # /api/alzabox/*
│           └── expected_billing.py  # /api/expected-billing/*
│
├── frontend/
│   └── src/
│       ├── main.jsx             # Entry point
│       ├── App.jsx              # Routes + CarrierProvider
│       ├── index.css            # Tailwind + CSS variables
│       ├── components/
│       │   ├── Layout.jsx       # Sidebar + TopBar + Outlet
│       │   └── LoginGate.jsx    # Auth wrapper
│       ├── pages/
│       │   ├── Dashboard.jsx    # Fakturace
│       │   ├── Documents.jsx    # Upload dokumentů
│       │   ├── Prices.jsx       # Ceníky per typ + depo
│       │   ├── Carriers.jsx     # Správa dopravců
│       │   ├── AlzaBoxBI.jsx    # BI dashboard s drill-down
│       │   └── ExpectedBilling.jsx  # Očekávaná fakturace
│       └── lib/
│           ├── api.js           # API client (axios) - VŽDY POUŽÍVAT!
│           └── CarrierContext.jsx  # Globální context
```

---

## 🗄️ DATABÁZOVÉ MODELY

### Hlavní entity (s carrier_id)

```
Carrier (dopravce)
├── id, name, ico, dic, address
├── → Depot[]
├── → Contract[]
├── → PriceConfig[]
├── → Proof[]
├── → Invoice[]
└── → RoutePlan[]

Contract (smlouva/dodatek)
├── id, carrier_id, amendment_number, type
├── valid_from, valid_to
└── → PriceConfig[]

PriceConfig (ceník)
├── id, carrier_id, contract_id, type
├── valid_from, valid_to, is_active
├── → FixRate[]
├── → KmRate[]
├── → DepoRate[]
├── → LinehaulRate[]
└── → BonusRate[]

Proof (měsíční výkaz)
├── id, carrier_id, period
├── total_fix, total_km, total_linehaul, total_depo
├── → ProofRouteDetail[]
├── → ProofLinehaulDetail[]
└── → ProofDepoDetail[]

Invoice (faktura)
├── id, carrier_id, proof_id
├── invoice_number, amount_without_vat, amount_with_vat
└── → InvoiceItem[]

RoutePlan (plánovací soubor)
├── id, carrier_id, depot
├── valid_from, valid_to
├── dpo_routes_count, sd_routes_count
└── → RoutePlanRoute[]
```

### AlzaBox entity (globální - BEZ carrier_id)

```
AlzaBoxLocation
├── id, box_code (unique), name, city
├── latitude, longitude, carrier_code
└── → AlzaBoxDelivery[]

AlzaBoxDelivery
├── id, location_id, delivery_date
├── planned_time (String!), actual_time (DateTime)
├── route_group, on_time
└── → AlzaBoxLocation
```

**POZOR:** `AlzaBoxDelivery.planned_time` je **String** ("HH:MM"), NE DateTime!

```python
class AlzaBoxDelivery(Base):
    planned_time: Mapped[Optional[str]] = mapped_column("plannedTime", String(10))  # "09:00"
    actual_time: Mapped[Optional[datetime]] = mapped_column("actualTime", DateTime)  # datetime objekt
```

---

## 🌐 API ENDPOINTS

### Auth
```
POST /api/auth/login      # Přihlášení
POST /api/auth/verify     # Ověření tokenu
POST /api/auth/logout     # Odhlášení
```

### Carriers
```
GET  /api/carriers        # Seznam dopravců
POST /api/carriers        # Vytvořit dopravce
GET  /api/carriers/{id}   # Detail dopravce
PUT  /api/carriers/{id}   # Aktualizovat
DELETE /api/carriers/{id} # Smazat
```

### Contracts
```
GET  /api/contracts            # Seznam smluv
POST /api/contracts/upload     # Upload PDF dodatku
GET  /api/contracts/{id}       # Detail
DELETE /api/contracts/{id}     # Smazat
```

### Prices
```
GET  /api/prices              # Seznam ceníků
GET  /api/prices/active       # Aktivní ceník pro období
POST /api/prices              # Vytvořit ceník
```

### Proofs
```
GET  /api/proofs              # Seznam proofů
POST /api/proofs/upload       # Upload XLSX
GET  /api/proofs/{id}         # Detail
DELETE /api/proofs/{id}       # Smazat
```

### Invoices
```
GET  /api/invoices            # Seznam faktur
POST /api/invoices/upload     # Upload PDF
GET  /api/invoices/{id}       # Detail
DELETE /api/invoices/{id}     # Smazat
```

### Route Plans
```
GET  /api/route-plans              # Seznam plánů
POST /api/route-plans/upload       # Upload XLSX
POST /api/route-plans/upload-batch # Batch upload
GET  /api/route-plans/{id}         # Detail
DELETE /api/route-plans/{id}       # Smazat
```

### AlzaBox
```
GET  /api/alzabox/stats/summary     # Celkové statistiky
GET  /api/alzabox/stats/by-route    # Statistiky per trasa
GET  /api/alzabox/stats/by-day      # Statistiky per den
GET  /api/alzabox/stats/by-box      # Statistiky per box
GET  /api/alzabox/box/{id}/detail   # Detail boxu s historií
GET  /api/alzabox/carriers          # Dopravci s AlzaBoxy
GET  /api/alzabox/routes            # Seznam tras
GET  /api/alzabox/countries         # Země s počty boxů
POST /api/alzabox/import/locations  # Import lokací (XLSX)
POST /api/alzabox/import/deliveries # Import dojezdů (XLSX)
DELETE /api/alzabox/data/locations  # Smazat všechna data
DELETE /api/alzabox/data/deliveries # Smazat dojezdy
```

### Expected Billing
```
GET /api/expected-billing/calculate  # Výpočet očekávané fakturace
GET /api/expected-billing/periods    # Dostupná období
```

---

## 📊 ALZABOX BI MODUL

### Struktura drill-down

```
Přehled (všechny trasy) 
    ↓ klik na trasu
Detail trasy (všechny boxy)
    ↓ klik na box
Detail boxu (historie, trend, statistiky)
```

### Filtry
- **Dopravce** - filtr podle carrier_id
- **Období** - start_date, end_date
- **Typ závozu** - DPO, SD, THIRD

### API Parametry

| Endpoint | Parametry |
|----------|-----------|
| `stats/summary` | `start_date`, `end_date`, `delivery_type`, `carrier_id` |
| `stats/by-route` | dtto |
| `stats/by-day` | dtto |
| `stats/by-box` | dtto + `route_name` |
| `box/{id}/detail` | `start_date`, `end_date`, `delivery_type` |

---

## 🏭 ZOBRAZENÍ CENÍKŮ (Prices.jsx)

### Hierarchie zobrazení (v3.11.0)

```
DOPRAVCE (např. Drivecool)
│
├── 📦 ROZVOZ ALZABOX
│   │
│   ├── 🔴 Depo Vratimov
│   │   ├── LINEHAUL (přeprava ze skladu na depo)
│   │   │   ├── Z Úžice (CZTC1): Dodávka/Solo/Kamion [D8]
│   │   │   └── Z Chrášťan (CZLC4): Dodávka/Solo/Kamion [D8]
│   │   ├── ROZVOZ (FIX za trasu + KM)
│   │   │   └── FIX 2 500 Kč | KM 10,97 Kč [D7]
│   │   └── NÁKLADY DEPA
│   │       └── Práce na depu: 850 Kč/h [D7]
│   │
│   ├── 🟢 Depo Nový Bydžov
│   │   ├── LINEHAUL
│   │   ├── ROZVOZ (FIX + KM)
│   │   ├── NÁKLADY DEPA
│   │   │   ├── Sklad ALL IN: 410 000 Kč/měs [D12]
│   │   │   ├── Sklad ALL IN (se slevou): 396 000 Kč/měs [D12]
│   │   │   ├── Skladníci: 194 800 Kč/měs [D12]
│   │   │   └── Brigádník: 1 600 Kč/den [D12]
│   │   └── SKLADOVÉ SLUŽBY (bonusy)
│   │       ├── ≥98%: +35 600 Kč [D12]
│   │       └── ≥97.5%: +30 000 Kč [D12]
│   │
│   ├── 🔵 Depo Chrášťany (CZLC4) - Praha/STČ + část MSK
│   │   └── ROZVOZ (Direct trasy)
│   │       └── FIX 3 200 Kč | KM 10,97 Kč [D7]
│   │
│   └── 🔵 Depo Třídírna (CZTC1) - Praha/STČ (AlzaTrade)
│       └── ROZVOZ (Direct trasy)
│           └── (sazby dle smlouvy)
│
└── 🏭 SVOZ TŘÍDÍRNA (pokud existují sazby směr → CZTC1)
    └── ... (zatím prázdné pro Drivecool)
```

### Lokace a depa

| Lokace | Kód | Role | Název depa |
|--------|-----|------|------------|
| Chrášťany | CZLC4 | Sklad + Depo | **Depo Chrášťany** |
| Úžice | CZTC1 | Třídírna + Depo | **Depo Třídírna** |
| Vratimov | - | Depo (pouze) | **Depo Vratimov** |
| Nový Bydžov | - | Depo (pouze) | **Depo Nový Bydžov** |

> **Poznámka:** Praha/STČ má 2 depa - Depo Chrášťany (zboží ze skladu) a Depo Třídírna (AlzaTrade 2.0)

### Mapování DepoRate na depa

| depoName v DB | Skutečné depo | Zobrazení |
|---------------|---------------|-----------|
| `Sklad_ALL_IN` | Nový Bydžov | Sklad ALL IN |
| `Sklad_ALL_IN_sleva` | Nový Bydžov | Sklad ALL IN (se slevou) |
| `Skladnici` | Nový Bydžov | Skladníci |
| `Brigadnik` | Nový Bydžov | Brigádník |
| `Vratimov` | Vratimov | Práce na depu |

### Logika kategorizace

```javascript
// LINEHAUL - kategorie podle CÍLOVÉ DESTINACE
if (toCode.includes('cztc1')) {
  category = 'tridirna'  // Svoz NA třídírnu
} else {
  category = 'alzabox'   // Rozvoz Z skladu na depo
}

// DEPO RATES - mapování podle názvu
if (depoName.includes('sklad') || depoName.includes('skladni') || depoName.includes('brigadnik')) {
  depot = 'Nový Bydžov'
} else if (depoName.includes('vratimov')) {
  depot = 'Vratimov'
}
```

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

### Čísla dodatků (DodatekBadge)

Každá sazba zobrazuje badge s číslem dodatku [D7], [D8], [D12]...

```jsx
<DodatekBadge number={rate.dodatek} />
```

Číslo dodatku se získává z:
1. `Contract.amendmentNumber` v DB
2. Mapování `PriceConfig.contractId` → `Contract`
3. Frontend spojí přes `contractMap[priceConfig.contractId]`

---

## 📄 AUTOMATIZACE AMENDMENT_NUMBER

### Při uploadu nové smlouvy (contracts.py)

```python
# Extrahuj číslo dodatku z názvu
amendment_num = None
if contract_info['number']:
    num_match = re.search(r'(\d+)', contract_info['number'])
    if num_match:
        amendment_num = int(num_match.group(1))

# Vytvoř smlouvu s amendment_number
contract = Contract(
    carrier_id=carrier.id,
    number=contract_info['number'],
    amendment_number=amendment_num,  # ← Automaticky nastaveno
    ...
)
```

### Ruční oprava existujících dat

```sql
-- Vyplň amendment_number z názvu smlouvy
UPDATE "Contract" 
SET "amendmentNumber" = CAST(REGEXP_REPLACE(number, '[^0-9]', '', 'g') AS INTEGER)
WHERE number LIKE 'Dodatek č.%' AND "amendmentNumber" IS NULL;

-- Napáruj PriceConfig s Contract podle validFrom
UPDATE "PriceConfig" SET "contractId" = 50 
WHERE "validFrom" = '2025-04-01' AND "carrierId" = 1;
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

## 🗄️ ROUTE PLAN SCHEMA (v3.12.0)

### ⚠️ KRITICKÉ: Rozdíl total_km vs total_distance_km

| Tabulka | Python atribut | DB sloupec | Použití |
|---------|----------------|------------|---------|
| **RoutePlan** | `total_km` | `totalKm` | Celkové km celého plánu |
| **RoutePlanRoute** | `total_distance_km` | `totalDistanceKm` | KM jednotlivé trasy |

### RoutePlan - všechny sloupce

```sql
CREATE TABLE "RoutePlan" (
    id SERIAL PRIMARY KEY,
    "carrierId" INTEGER REFERENCES "Carrier"(id),
    "validFrom" TIMESTAMP,
    "validTo" TIMESTAMP,
    "fileName" VARCHAR(255),
    "planType" VARCHAR(10) DEFAULT 'BOTH',
    depot VARCHAR(20) DEFAULT 'BOTH',
    "totalRoutes" INTEGER DEFAULT 0,
    "totalKm" DECIMAL(12,2),              -- ⚠️ NE totalDistanceKm!
    "totalStops" INTEGER DEFAULT 0,
    "dpoRoutesCount" INTEGER DEFAULT 0,
    "sdRoutesCount" INTEGER DEFAULT 0,
    "dpoLinehaulCount" INTEGER DEFAULT 0,
    "sdLinehaulCount" INTEGER DEFAULT 0,
    "vratimovDpoCount" INTEGER DEFAULT 0,
    "vratimovSdCount" INTEGER DEFAULT 0,
    "vratimovStops" INTEGER DEFAULT 0,
    "vratimovKm" DECIMAL(10,2) DEFAULT 0,
    "vratimovDurationMin" INTEGER DEFAULT 0,
    "bydzovDpoCount" INTEGER DEFAULT 0,
    "bydzovSdCount" INTEGER DEFAULT 0,
    "bydzovStops" INTEGER DEFAULT 0,
    "bydzovKm" DECIMAL(10,2) DEFAULT 0,
    "bydzovDurationMin" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);
```

### RoutePlanRoute - všechny sloupce

```sql
CREATE TABLE "RoutePlanRoute" (
    id SERIAL PRIMARY KEY,
    "routePlanId" INTEGER REFERENCES "RoutePlan"(id) ON DELETE CASCADE,
    "routeName" VARCHAR(100),
    "routeLetter" VARCHAR(10),
    "carrierName" VARCHAR(100),
    "routeType" VARCHAR(20) DEFAULT 'DPO',
    "deliveryType" VARCHAR(20),
    "drLh" VARCHAR(20),                   -- DR/LH typ (např. 'LH-LH')
    depot VARCHAR(50),
    "startLocation" VARCHAR(200),
    "stopsCount" INTEGER DEFAULT 0,
    "maxCapacity" DECIMAL(10,2),
    "startTime" VARCHAR(10),
    "endTime" VARCHAR(10),
    "workTime" VARCHAR(10),
    "totalDistanceKm" DECIMAL(10,3),      -- ⚠️ totalDistanceKm pro trasy!
    "planType" VARCHAR(10),
    "createdAt" TIMESTAMP DEFAULT NOW()
);
```

### LoginLog

```sql
CREATE TABLE "LoginLog" (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255),                   -- Status: 'app_user' nebo 'failed_attempt'
    "loginAt" TIMESTAMP DEFAULT NOW(),
    "ipAddress" VARCHAR(50),
    "userAgent" TEXT
);
```

### SQL opravy pro v3.12.0

```sql
-- LoginLog - smaž a vytvoř znovu
DROP TABLE IF EXISTS "LoginLog";
CREATE TABLE "LoginLog" (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255),
    "loginAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" VARCHAR(50),
    "userAgent" TEXT
);

-- RoutePlan - přidej chybějící sloupce
ALTER TABLE "RoutePlan" 
ADD COLUMN IF NOT EXISTS "dpoRoutesCount" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "sdRoutesCount" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "dpoLinehaulCount" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "sdLinehaulCount" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "vratimovStops" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "vratimovKm" DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS "vratimovDurationMin" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "bydzovStops" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "bydzovKm" DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS "bydzovDurationMin" INTEGER DEFAULT 0;

-- RoutePlanRoute - přidej chybějící sloupce
ALTER TABLE "RoutePlanRoute"
ADD COLUMN IF NOT EXISTS "routeLetter" VARCHAR(10),
ADD COLUMN IF NOT EXISTS "routeType" VARCHAR(20) DEFAULT 'DPO',
ADD COLUMN IF NOT EXISTS "deliveryType" VARCHAR(20);

-- ProofDailyDetail - přidej chybějící sloupec
ALTER TABLE "ProofDailyDetail" 
ADD COLUMN IF NOT EXISTS "dayOfWeek" VARCHAR(10);
```

---

## 📊 EXPECTED BILLING LOGIKA (v3.12.0)

### Registrace routeru v main.py

```python
from app.routers import expected_billing

app.include_router(
    expected_billing.router, 
    prefix="/api/expected-billing", 
    tags=["Expected Billing"]
)
```

### Výpočet kilometrů

Expected billing používá `plan.total_km` (agregované km z RoutePlan), protože jednotlivé trasy (`RoutePlanRoute.total_distance_km`) mohou být NULL.

```python
# Správná logika v expected_billing.py
for plan in plans:
    plan_total_km = Decimal(str(plan.total_km or 0))
    routes_count = len(plan.routes) or 1
    avg_km_per_route = plan_total_km / routes_count
    
    for route in plan.routes:
        route_km = Decimal(str(route.total_distance_km or 0))
        if route_km == 0:
            route_km = avg_km_per_route  # Fallback na průměr
```

### Detekce linehaulů

Linehauly se detekují ze sloupce `drLh` v RoutePlanRoute:
- `'LH-LH'` = 2 linehauly
- `'DR-LH'` = 1 linehaul  
- `'DR-DR'` = 0 linehaulů

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

### Aktuální routy v App.jsx
```jsx
<Route path="/" element={<Layout />}>
  <Route index element={<Navigate to="/dashboard" replace />} />
  <Route path="dashboard" element={<Dashboard />} />
  <Route path="upload" element={<Documents />} />
  <Route path="prices" element={<Prices />} />
  <Route path="alzabox" element={<AlzaBoxBI />} />
  <Route path="carriers" element={<Carriers />} />
  <Route path="expected-billing" element={<ExpectedBilling />} />
</Route>
```

### Navigace v Layout.jsx
```jsx
const navigation = [
  { name: 'Fakturace', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Ceníky', href: '/prices', icon: Tag },
  { name: 'Dokumenty', href: '/upload', icon: FileText },
  { name: 'AlzaBox BI', href: '/alzabox', icon: Package },
  { name: 'Dopravci', href: '/carriers', icon: Truck },
  { name: 'Oček. fakturace', href: '/expected-billing', icon: Calculator },
]
```

---

## 🚀 DEPLOYMENT

### Railway Services
| Service | Build | Port |
|---------|-------|------|
| Cost_control_backend | Dockerfile | 8080 |
| Cost_control_frontend | Dockerfile (nginx) | 80 |
| Postgres | Docker Image | 5432 |

### Railway URLs
- **Backend**: `alza-cost-control-production.up.railway.app`
- **Frontend**: `amused-manifestation-production.up.railway.app`

### Environment variables

**Frontend:**
```
VITE_API_URL=https://alza-cost-control-production.up.railway.app/api
VITE_API_KEY=<same as backend API_KEY>
```

**Backend:**
```
API_KEY=<secret>
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/db
FRONTEND_URL=<frontend url for CORS>
APP_PASSWORD=<heslo pro login>
```

### Deploy Process
```bash
# 1. Commit změny
git add .
git commit -m "v3.12.0: popis změn"

# 2. Push do main branch
git push origin main

# 3. Railway automaticky detekuje a nasadí
# (sleduj logy v Railway Dashboard)
```

### Monitoring
- **Backend logs**: `Cost_control_backend → Logs`
- **Frontend logs**: `Cost_control_frontend → Logs`
- **Database logs**: `Postgres → Logs`

---

## 📋 CHECKLIST PRO NOVÝ ROUTER

1. [ ] Vytvořit soubor v `backend/app/routers/`
2. [ ] Použít `async def` pro všechny endpointy
3. [ ] Použít `AsyncSession` a `select()`
4. [ ] Přidat do `main.py`: `app.include_router(xyz.router, prefix="/api")`
5. [ ] Přidat API funkce do `frontend/src/lib/api.js`
6. [ ] Vytvořit stránku v `frontend/src/pages/`
7. [ ] Přidat route do `App.jsx` (uvnitř `<Route path="/" element={<Layout />}>`)
8. [ ] Přidat navigaci do `Layout.jsx` - **CESTA MUSÍ ODPOVÍDAT ROUTĚ V App.jsx!**

### Příklad přidání nové stránky

**1. App.jsx:**
```jsx
<Route path="/" element={<Layout />}>
  ...
  <Route path="nova-stranka" element={<NovaStranka />} />  {/* Přidat */}
</Route>
```

**2. Layout.jsx:**
```jsx
const navigation = [
  ...
  { name: 'Nová stránka', href: '/nova-stranka', icon: SomeIcon },  {/* STEJNÁ CESTA! */}
]
```

---

## 🔧 ČASTÉ PROBLÉMY A ŘEŠENÍ

| Problém | Řešení |
|---------|--------|
| AsyncSession error (`'AsyncSession' object has no attribute 'query'`) | Použít `select()` místo `.query()` |
| Frontend vrací HTML místo JSON | Použít api.js místo fetch() |
| Ceníky se neextrahují | Zkontrolovat PDF formát |
| Auth 404 | Zkontrolovat prefix v auth.py |
| Chybí amendmentNumber | Přidat do models.py + schemas.py |
| DepoRate špatné depo | Zkontrolovat mapování v Prices.jsx |
| VITE_API_URL nefunguje | Hard refresh (Cmd+Shift+R), vymazat cache |
| "column X does not exist" | ALTER TABLE ADD COLUMN (viz SQL opravy) |
| "'X' is an invalid keyword argument" | Sjednotit názvy v route_plans.py vs models.py |
| Stránky se nenačítají | Layout.jsx musí používat `<Outlet />`, ne `{children}` |
| Navigace nefunguje | Cesty v Layout.jsx musí odpovídat routám v App.jsx |
| Encoding problém (české znaky) | Soubor uložit jako UTF-8 |
| API vrací 401 Unauthorized | Ověřit `VITE_API_KEY` ve frontend env variables |
| planned_time TypeError | Formátovat jako string: `f"{h:02d}:{m:02d}"` |

---

## 📊 CHANGELOG

### v3.12.0 (7. prosince 2025)
- ✅ **DB Schema opravy**: Přidány chybějící sloupce do RoutePlan, RoutePlanRoute, LoginLog, ProofDailyDetail
- ✅ **route_plans.py oprava**: `total_distance_km` → `total_km` pro RoutePlan (5 míst)
- ✅ **expected_billing.py**: Použití `plan.total_km` jako fallback pro km výpočet
- ✅ **Naming conventions**: Dokumentace rozdílu `total_km` (RoutePlan) vs `total_distance_km` (RoutePlanRoute)
- ✅ **SQL migrace**: Kompletní skripty pro opravu DB schématu
- ✅ **Konsolidace dokumentace**: Sloučení všech předchozích verzí do jednoho souboru
- ✅ **FormData upload**: Přidán příklad správného uploadu souborů

### v3.12.0 (7. prosince 2025)
- ✅ **DB schema opravy**: RoutePlan, RoutePlanRoute, LoginLog, ProofDailyDetail
- ✅ **Terminologie lokací a dep**:
  - CZLC4 (Chrášťany) = Sklad + Depo Chrášťany
  - CZTC1 (Úžice) = Třídírna + Depo Třídírna
  - Praha/STČ má 2 depa: Depo Chrášťany + Depo Třídírna

### v3.11.0 (Prosinec 2025)
- ✅ **Redesign ceníků**: Hierarchie Typ závozu → Depo → Služba
- ✅ **DepoRate mapování**: Sklad_ALL_IN → Nový Bydžov, Vratimov → Vratimov
- ✅ **amendment_number**: Automatické nastavení při uploadu smlouvy
- ✅ **Naming conventions**: Dokumentace camelCase (DB) vs snake_case (Python)
- ✅ **DodatekBadge**: Zobrazení čísla dodatku u každé sazby

### v3.10.0 (Prosinec 2025)
- Restrukturace ceníků per depo
- Zachování čísel dodatků
- Deduplikace sazeb

### v1.1.0 (Prosinec 2025)
- AlzaBox BI modul s drill-down
- API timeouty pro dlouhé operace
- Frontend API client dokumentace

### v1.0.0 (Prosinec 2025)
- Počáteční verze dokumentace
- Async SQLAlchemy pravidla
- React Router pravidla

---

*Aktualizováno: 7. prosince 2025 - v3.12.0*
