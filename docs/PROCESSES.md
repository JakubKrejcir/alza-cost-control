# Alza Cost Control - Procesní dokumentace

> **Verze:** 3.13.0  
> **Datum:** Prosinec 2025  
> **Aktualizace:** DB Schema konzistence - DepoRate, FixRate, KmRate, PriceConfig kompletní struktura

---

## 📊 OBSAH

1. [Přehled systému](#1-přehled-systému)
2. [Typy doprav a země](#2-typy-doprav-a-země)
3. [Depa a ceníky](#3-depa-a-ceníky)
4. [AlzaBox BI modul](#4-alzabox-bi-modul)
5. [Procesy aplikace](#5-procesy-aplikace)
6. [Entity a vztahy](#6-entity-a-vztahy)
7. [Business pravidla](#7-business-pravidla)
8. [Roadmapa](#8-roadmapa)
9. [Technické poznámky - DB Schema](#9-technické-poznámky---db-schema)

---

## 1. PŘEHLED SYSTÉMU

### Co aplikace řeší
Kontrola nákladů na dopravu pro Alzu - porovnání:
- **Plánů tras** (co mělo jet)
- **Proofů** (co dopravce tvrdí, že jelo)  
- **Faktur** (co dopravce účtuje)
- **Ceníků** (za kolik to má být)
- **Dojezdů** (kvalita doručení)

### Aktuální stav (MVP)
- Jeden dopravce: **Drivecool**
- Jeden typ dopravy: **Alzaboxy**
- Jedna země: **Česko (CZ)**
- Dvě depa: **Vratimov**, **Nový Bydžov** (+ Praha/STČ pro direct)
- **AlzaBox BI**: Analýza dojezdů s drill-down

---

## 2. TYPY DOPRAV A ZEMĚ

### 2.1 Typy doprav v Alze

| Kód | Typ dopravy | Popis | Status |
|-----|-------------|-------|--------|
| `ALZABOX` | Alzaboxy | Závoz samoobslužných boxů | ✅ MVP + BI |
| `TRIDIRNA` | Třídírna | Linehaul do třídírny | ✅ MVP |
| `BRANCH` | Pobočky | Závoz kamenných prodejen | 📜 Plánováno |
| `PARCEL` | Balíkovka | Doručení na adresu | 📜 Plánováno |
| `XL` | XL zásilky | Velké zásilky | 📜 Plánováno |

### 2.2 Země operací

| Kód | Země | Měna | Status |
|-----|------|------|--------|
| `CZ` | 🇨🇿 Česko | CZK | ✅ MVP |
| `SK` | 🇸🇰 Slovensko | EUR | 📜 Plánováno |
| `HU` | 🇭🇺 Maďarsko | HUF | 📜 Plánováno |

---

## 3. EXPEDIČNÍ SKLADY A ROZVOZOVÁ DEPA

### 3.1 Struktura logistiky

```
                    EXPEDIČNÍ SKLADY
                          │
     ┌────────────────────┼────────────────────┐
     │                    │                    │
     ▼                    ▼                    ▼
┌─────────┐        ┌─────────────┐       ┌─────────┐
│ CZTC1   │        │   CZLC4     │       │  LCU    │
│ Úžice   │        │ Chrášťany   │       │  LCS    │
│(třídírna│        │             │       │  LCZ    │
└────┬────┘        └──────┬──────┘       │  SKLC3  │
     │                    │              └────┬────┘
     │     LINEHAUL       │                   │
     │    nebo DIRECT     │                   │
     │         │          │                   │
     ▼         ▼          ▼                   ▼
┌──────────────────────────────────────────────────┐
│              ROZVOZOVÁ DEPA                       │
│  ┌───────────────┐    ┌───────────────────┐      │
│  │ 🏭 VRATIMOV   │    │ 📦 NOVÝ BYDŽOV    │      │
│  └───────┬───────┘    └─────────┬─────────┘      │
│          │                      │                │
│          ▼                      ▼                │
│    ┌───────────┐          ┌───────────┐          │
│    │ AlzaBoxy  │          │ AlzaBoxy  │          │
│    │ Morava    │          │ okolí NB  │          │
│    └───────────┘          └───────────┘          │
└──────────────────────────────────────────────────┘
```

### 3.2 Klíčové pojmy

| Pojem | Popis |
|-------|-------|
| **Expediční sklad** | Sklad, odkud se expeduje zboží (CZTC1, CZLC4, LCU...) |
| **Rozvozové depo** | Místo, kam přijíždí linehauly a odkud jedou dodávky na rozvoz |
| **Linehaul** | Přeprava z expedičního skladu na rozvozové depo (kamion, solo, dodávka) |
| **Direct trasa** | Dodávka jede přímo z expedičního skladu (bez přetřídění na depu) |
| **Rozvoz z depa** | Dodávky, které jedou z rozvozového depa k AlzaBoxům |

### 3.3 Způsoby obsluhy rozvozové oblasti

**1. Linehaul + rozvoz z depa:**
```
Exp. sklad → Linehaul → Depo → Třídění → Rozvoz dodávkami → AlzaBoxy
```

**2. Direct trasy:**
```
Exp. sklad → Direct dodávka → AlzaBoxy
```

### 3.4 Sazby per depo

**Depo Vratimov:**
| Typ sazby | Popis | Příklad |
|-----------|-------|---------|
| Linehaul | Z exp. skladu na depo | CZTC1 → Vratimov |
| FIX | Paušál za rozvozovou trasu | 2 500 Kč |
| KM | Kilometrová sazba | 10,97 Kč/km |
| DEPO | Práce na depu (hodinová) | 850 Kč/h |

**Depo Nový Bydžov:**
| Typ sazby | Popis | Příklad |
|-----------|-------|---------|
| Linehaul | Z exp. skladu na depo | CZLC4 → NB |
| FIX | Paušál za rozvozovou trasu | 3 200 Kč |
| KM | Kilometrová sazba | 10,97 Kč/km |
| Sklad ALL IN | Měsíční paušál | 410 000 Kč |
| Sklad se slevou | Měsíční paušál | 396 000 Kč |
| Skladníci | Měsíční náklad | 194 800 Kč |
| Brigádník | Denní sazba | 1 600 Kč |
| Bonus ≥98% | Za kvalitu | +35 600 Kč |

### 3.5 Alza Trade Delivery 2.0

Služba svozu (první míle) od dodavatelů:
```
Dodavatel → Svoz → CZTC1 (třídírna)
```

### 3.6 Zobrazení v aplikaci (Prices.jsx) - v3.11.0

Ceníky zobrazeny **hierarchicky: Typ závozu → Depo → Služba**:

```
📦 ROZVOZ ALZABOX
├── 🔴 Depo Vratimov
│   ├── LINEHAUL (z exp. skladů na depo)
│   │   ├── Z Úžice (CZTC1): Dodávka/Solo/Kamion [D8]
│   │   └── Z Chrášťan (CZLC4): Dodávka/Solo/Kamion [D8]
│   ├── ROZVOZ (FIX + KM)
│   │   └── FIX 2 500 Kč | KM 10,97 Kč [D7]
│   └── NÁKLADY DEPA
│       └── Práce na depu: 850 Kč/h [D7]
│
├── 🟢 Depo Nový Bydžov
│   ├── LINEHAUL
│   ├── ROZVOZ (FIX + KM)
│   ├── NÁKLADY DEPA
│   │   ├── Sklad ALL IN: 410 000 Kč/měs [D12]
│   │   ├── Sklad ALL IN (se slevou): 396 000 Kč/měs [D12]
│   │   ├── Skladníci: 194 800 Kč/měs [D12]
│   │   └── Brigádník: 1 600 Kč/den [D12]
│   └── SKLADOVÉ SLUŽBY (bonusy)
│       ├── ≥98%: +35 600 Kč [D12]
│       └── ≥97.5%: +30 000 Kč [D12]
│
└── 🔵 Depo Praha/STČ
    └── ROZVOZ (Direct trasy)
        └── FIX 3 200 Kč | KM 10,97 Kč [D7]

🏭 SVOZ TŘÍDÍRNA (pokud existují sazby směr → CZTC1)
└── (zatím prázdné pro Drivecool)
```

**Čísla dodatků** ([D7], [D8], [D12]) jsou zachována u každé sazby.

---

## 4. ALZABOX BI MODUL

### 4.1 Účel
Sledování včasnosti dojezdů k AlzaBoxům s cílem **99% včasnost**.

### 4.2 Drill-down struktura

```
Přehled (všechny trasy) 
    ↓ klik na trasu
Detail trasy (všechny boxy)
    ↓ klik na box
Detail boxu (historie, trend, % včas)
```

### 4.3 Barevná škála

| Barva | Rozsah | Význam |
|-------|--------|--------|
| 🟢 Zelená | ≥ 99% | Splňuje cíl |
| 🟠 Oranžová | 95-98.9% | Varování |
| 🔴 Červená | < 95% | Kritické |

### 4.4 Metriky

- **Včasnost**: % dojezdů před plánovaným časem
- **Trend**: Graf vývoje za období
- **Top problémové boxy**: Seřazené podle % včas

---

## 5. PROCESY APLIKACE

### 5.1 Nahrání smlouvy (PDF)

```
1. Uživatel nahraje PDF smlouvy
2. Systém validuje název (con + 5 číslic)
3. Backend extrahuje:
   - Číslo dodatku → amendmentNumber (automaticky)
   - Datum platnosti
   - Typ služby (AlzaBox/Třídírna/XL)
   - FIX, KM, DEPO, Linehaul sazby
4. Vytvoří se Contract (s amendmentNumber) + PriceConfig + sazby
5. Ceníky se zobrazí per typ služby + depo
```

### 5.2 Import dojezdů (AlzaBox BI)

```
1. Uživatel nahraje XLSX s dojezdy
2. Systém parsuje:
   - Název boxu, trasa
   - Plánovaný čas (string "HH:MM")
   - Skutečný čas (datetime)
3. Uloží do AlzaBoxDelivery
4. BI dashboard zobrazí statistiky
```

### 5.3 Očekávaná fakturace

```
1. Systém načte plány tras
2. Pro každou trasu aplikuje ceníky:
   - FIX sazba (pokud existuje)
   - KM sazba × km
   - Linehaul (pokud applicable)
3. Sečte celkovou očekávanou částku
4. Porovná s fakturou dopravce
```

---

## 6. ENTITY A VZTAHY

### 6.1 Hlavní entity

```
Carrier (Dopravce)
├── Contract[] (Smlouvy)
│   ├── amendmentNumber (číslo dodatku)
│   └── PriceConfig (Ceník)
│       ├── FixRate[]
│       ├── KmRate[]
│       ├── DepoRate[]
│       ├── LinehaulRate[]
│       └── BonusRate[]
├── RoutePlan[] (Plány tras)
├── Proof[] (Proofy)
└── Invoice[] (Faktury)

AlzaBoxLocation (Box)
└── AlzaBoxDelivery[] (Dojezdy)
```

### 6.2 Klíčové vztahy

| Entita | Vztah | Entita |
|--------|-------|--------|
| Carrier | 1:N | Contract |
| Contract | 1:1 | PriceConfig |
| PriceConfig | 1:N | FixRate, KmRate, DepoRate... |
| Carrier | 1:N | RoutePlan |
| AlzaBoxLocation | 1:N | AlzaBoxDelivery |

---

## 7. BUSINESS PRAVIDLA

### 7.1 Validace smluv
- Název souboru musí obsahovat `con` + min 5 číslic
- IČO ve smlouvě musí odpovídat dopravci
- Duplicitní smlouvy (stejné číslo) jsou odmítnuty
- **amendmentNumber** se automaticky extrahuje z názvu dodatku

### 7.2 Extrakce ceníků
- Automatická detekce typu služby z textu
- Sazby se párují k depům podle klíčových slov
- KM sazby jsou sdílené mezi depy (pokud není specifikováno)

### 7.3 Mapování DepoRate na depa

| depoName v DB | Mapuje na depo |
|---------------|----------------|
| Sklad_ALL_IN | Nový Bydžov |
| Sklad_ALL_IN_sleva | Nový Bydžov |
| Skladnici | Nový Bydžov |
| Brigadnik | Nový Bydžov |
| Vratimov | Vratimov |

### 7.4 Včasnost dojezdů
- Cíl: 99% včasnost
- Včasný = actual_time ≤ planned_time
- Tolerance: žádná (striktní porovnání)

---

## 8. ROADMAPA

### ✅ Hotovo (MVP)
- [x] Správa dopravců
- [x] Upload smluv s extrakcí ceníků
- [x] Zobrazení ceníků per typ služby + depo
- [x] AlzaBox BI s drill-down
- [x] Očekávaná fakturace
- [x] Autentizace (login)
- [x] Automatické amendmentNumber při uploadu
- [x] Redesign ceníků - hierarchie typ závozu → depo
- [x] DB Schema konzistence - DepoRate, FixRate, KmRate kompletní

### 📜 Plánováno (Q1 2025)
- [ ] Další dopravci
- [ ] Další typy doprav (Pobočky, Balíkovka)
- [ ] Automatické párování plánů s proofy
- [ ] Export reportů

### 🔮 Budoucnost
- [ ] Multi-country (SK, HU)
- [ ] Predikce nákladů
- [ ] Integrace s ERP

---

## PŘÍLOHY

### Aktuální ceníky (Drivecool)

**AlzaBox (Dodatek č. 7):**
| Položka | Sazba |
|---------|-------|
| DIRECT Praha | 3 200 Kč |
| DIRECT Vratimov | 2 500 Kč |
| Kč/km | 10,97 Kč |
| DEPO hodina | 850 Kč |
| Linehaul CZLC4 → Vratimov | 24 180 Kč |

**Třídírna (Dodatek č. 8):**
| Trasa | Typ vozu | Sazba |
|-------|----------|-------|
| CZTC1 → Vratimov | Dodávka | 9 100 Kč |
| CZTC1 → Vratimov | Solo | 14 800 Kč |
| CZTC1 → Vratimov | Kamion | 22 000 Kč |
| CZLC4 → Vratimov | Dodávka | 10 100 Kč |
| CZLC4 → Vratimov | Solo | 16 500 Kč |
| CZLC4 → Vratimov | Kamion | 24 180 Kč |

**Sklad (Dodatek č. 12):**
| Položka | Sazba |
|---------|-------|
| Sklad ALL IN | 410 000 Kč/měs |
| Sklad se slevou | 396 000 Kč/měs |
| Skladníci | 194 800 Kč/měs |
| Brigádník | 1 600 Kč/den |
| Bonus ≥98% | +35 600 Kč |
| Bonus ≥97.5% | +30 000 Kč |
| Bonus ≥97% | +24 000 Kč |

---

## 9. TECHNICKÉ POZNÁMKY - DB SCHEMA

### 9.1 Kritická pravidla konzistence

**Model (models.py) ↔ Schema (schemas.py) ↔ Databáze musí být VŽDY synchronizované!**

| Vrstva | Soubor | Formát atributů |
|--------|--------|-----------------|
| Model | `models.py` | `snake_case` + `mapped_column("camelCase")` |
| Schema | `schemas.py` | `snake_case` (CamelModel převede na camelCase) |
| Databáze | PostgreSQL | `camelCase` (názvy sloupců) |

### 9.2 DepoRate - kompletní struktura

```python
# models.py
class DepoRate(Base):
    id: Mapped[int]
    price_config_id: Mapped[int]           # "priceConfigId"
    depo_name: Mapped[Optional[str]]       # "depoName" - název z PDF
    rate_type: Mapped[Optional[str]]       # "rateType" - hourly/monthly
    service_type: Mapped[Optional[str]]    # "serviceType" - alternativní
    rate: Mapped[Decimal]
    depot_id: Mapped[Optional[int]]        # "depotId" - FK na Depot
```

```python
# schemas.py
class DepoRateResponse(CamelModel):
    id: int
    depo_name: Optional[str] = None
    rate_type: Optional[str] = None
    service_type: Optional[str] = None
    rate: Decimal
    depot_id: Optional[int] = None
    depot: Optional[DepotResponse] = None
```

### 9.3 FixRate / KmRate - kompletní struktura

```python
# models.py
class FixRate(Base):
    id: Mapped[int]
    price_config_id: Mapped[int]           # "priceConfigId"
    route_type: Mapped[str]                # "routeType"
    delivery_type: Mapped[str]             # "deliveryType" - DPO/SD
    rate: Mapped[Decimal]
    depot_id: Mapped[Optional[int]]        # "depotId"
```

```python
# schemas.py  
class FixRateResponse(CamelModel):
    id: int
    route_type: str
    delivery_type: Optional[str] = None    # Optional kvůli starým datům
    rate: Decimal
    depot_id: Optional[int] = None
    depot: Optional[DepotResponse] = None
```

### 9.4 PriceConfig - kompletní struktura

```python
# models.py
class PriceConfig(Base):
    id: Mapped[int]
    carrier_id: Mapped[int]                # "carrierId"
    contract_id: Mapped[Optional[int]]     # "contractId"
    type: Mapped[Optional[str]]            # typ služby - MŮŽE BÝT NULL
    name: Mapped[Optional[str]]
    valid_from: Mapped[datetime]           # "validFrom"
    valid_to: Mapped[Optional[datetime]]   # "validTo"
    is_active: Mapped[bool]                # "isActive" - default True
    created_at: Mapped[datetime]           # "createdAt"
    updated_at: Mapped[datetime]           # "updatedAt"
```

### 9.5 RoutePlan - per-depot počty

```python
# models.py - agregační sloupce pro depa
class RoutePlan(Base):
    # ... základní atributy ...
    depot: Mapped[Optional[str]]                    # detekované depo
    vratimov_dpo_count: Mapped[int]                 # "vratimovDpoCount"
    vratimov_sd_count: Mapped[int]                  # "vratimovSdCount"
    bydzov_dpo_count: Mapped[int]                   # "bydzovDpoCount"
    bydzov_sd_count: Mapped[int]                    # "bydzovSdCount"
    vratimov_stops: Mapped[int]                     # "vratimovStops"
    bydzov_stops: Mapped[int]                       # "bydzovStops"
    vratimov_km: Mapped[Optional[Decimal]]          # "vratimovKm"
    bydzov_km: Mapped[Optional[Decimal]]            # "bydzovKm"
```

### 9.6 Časté chyby a řešení

| Chyba | Příčina | Řešení |
|-------|---------|--------|
| `Field required` | Schema vyžaduje atribut, který model nemá | Přidat do modelu NEBO změnit na Optional v schema |
| `UndefinedColumnError` | Sloupec neexistuje v DB | Spustit `ALTER TABLE ADD COLUMN` |
| `AttributeError: has no attribute` | Model nemá atribut | Přidat `Mapped[...]` do modelu |
| `ResponseValidationError` | Nesoulad model ↔ schema | Synchronizovat oba soubory |

### 9.7 SQL migrace - šablona

```sql
-- Přidání sloupce (IF NOT EXISTS = bezpečné opakované spuštění)
ALTER TABLE "TableName" ADD COLUMN IF NOT EXISTS "columnName" VARCHAR(100);
ALTER TABLE "TableName" ADD COLUMN IF NOT EXISTS "columnName" INTEGER DEFAULT 0;
ALTER TABLE "TableName" ADD COLUMN IF NOT EXISTS "columnName" NUMERIC(10,2) DEFAULT 0;
ALTER TABLE "TableName" ADD COLUMN IF NOT EXISTS "columnName" BOOLEAN DEFAULT true;
ALTER TABLE "TableName" ADD COLUMN IF NOT EXISTS "columnName" TIMESTAMP DEFAULT NOW();

-- Oprava NULL hodnot (před změnou na NOT NULL)
UPDATE "TableName" SET "columnName" = 'defaultValue' WHERE "columnName" IS NULL;
```

### 9.8 Checklist před deployem

- [ ] Model má všechny atributy které schema používá
- [ ] Schema má správné typy (Optional kde může být NULL)
- [ ] DB má všechny sloupce (spustit ALTER TABLE)
- [ ] Existující NULL data opravena (UPDATE WHERE IS NULL)
- [ ] Názvy atributů: model `snake_case`, DB sloupec `camelCase`

---

*Aktualizováno: Prosinec 2025 - v3.13.0 - Přidána sekce DB Schema konzistence*
