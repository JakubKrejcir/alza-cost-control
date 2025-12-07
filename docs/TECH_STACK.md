# Technická dokumentace - Transport Brain

> **Verze:** 3.11.0  
> **Datum:** Prosinec 2025  
> **Aktualizace:** Redesign ceníků (hierarchie typ závozu → depo), amendment_number automatizace, naming conventions

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
│   └── 🔵 Depo Praha/STČ
│       └── ROZVOZ (Direct trasy)
│           └── FIX 3 200 Kč | KM 10,97 Kč [D7]
│
└── 🏭 SVOZ TŘÍDÍRNA (pokud existují sazby směr → CZTC1)
    └── ... (zatím prázdné pro Drivecool)
```

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
| Chybí amendmentNumber | Přidat do models.py + schemas.py |
| DepoRate špatné depo | Zkontrolovat mapování v Prices.jsx |
| VITE_API_URL nefunguje | Hard refresh (Cmd+Shift+R), vymazat cache |

---

## 📊 CHANGELOG

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

---

*Aktualizováno: Prosinec 2025 - v3.11.0*
