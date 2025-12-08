# Alza Cost Control - Procesní dokumentace

> **Verze:** 3.12.0  
> **Datum:** 7. prosince 2025  
> **Aktualizace:** DB schema opravy, Expected Billing km fallback logika, naming conventions

---

## 📊 OBSAH

1. [Přehled systému](#1-přehled-systému)
2. [Typy doprav a země](#2-typy-doprav-a-země)
3. [Lokace a depa](#3-lokace-a-depa)
4. [AlzaBox BI modul](#4-alzabox-bi-modul)
5. [Procesy aplikace](#5-procesy-aplikace)
6. [Entity a vztahy](#6-entity-a-vztahy)
7. [Business pravidla](#7-business-pravidla)
8. [Roadmapa](#8-roadmapa)
9. [Aktualizace v3.11.0](#9-aktualizace-v3110)
10. [Aktualizace v3.12.0](#10-aktualizace-v3120)

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
- Dvě depa: **Praha**, **Vratimov** (+ sklad Nový Bydžov)
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

## 3. LOKACE A DEPA

### 3.1 Typy lokalit

| Typ | Popis |
|-----|-------|
| **Sklad** | Uskladňuje zboží, odjíždí z něj linehauly na depa |
| **Třídírna** | Sváží se sem AlzaTrade 2.0, odjíždí linehauly i directy |
| **Depo** | Místo odkud začínají direct trasy (dodávky rozvážející do AlzaBoxů) |

> **Poznámka:** Jedna lokace může mít více rolí - sklad může být zároveň depem.

### 3.2 Konkrétní lokace

| Lokace | Kód | Role | Název depa | Provozovatel |
|--------|-----|------|------------|--------------|
| **Chrášťany** | CZLC4 | Sklad + Depo | **Depo Chrášťany** | ALZA |
| **Úžice** | CZTC1 | Třídírna + Depo | **Depo Třídírna** | ALZA |
| **Vratimov** | - | Depo (pouze) | **Depo Vratimov** | Drivecool |
| **Nový Bydžov** | - | Depo (pouze) | **Depo Nový Bydžov** | Drivecool |

### 3.3 Provozovatelé lokalit

| Typ lokace | Provozovatel | Činnosti |
|------------|--------------|----------|
| **Expediční sklad** (CZLC4) | ALZA | Uskladnění, třídění, nakládka linehaulů |
| **Třídírna** (CZTC1) | ALZA | Příjem svozů, třídění, nakládka linehaulů |
| **Depo = součást skladu/třídírny** | ALZA | Třídění pro finální trasy, nakládka direct tras |
| **Samostatné depo** (Vratimov, NB) | DOPRAVCE | Příjem linehaulů, třídění, správa depa |

> **Klíčové:** Provozovatel depa zajišťuje veškerý provoz - třídění zboží, správu prostor, nakládku vozidel.

### 3.4 Vztah Depo ↔ Dopravci ↔ Trasy

```
DEPO
├── Provozovatel depa: 1 dopravce (nebo Alza) - správa, třídění
├── Alokované trasy: [A, B, C, D, ...]
│   └── Každá trasa = seznam AlzaBoxů k obsluze
└── Rozvoz tras: může jezdit VÍCE dopravců
    └── 1 trasa v 1 moment = 1 dopravce
```

**Příklad - Depo Vratimov:**
- **Provozovatel:** Drivecool (správa depa, třídění)
- **Alokované trasy:** MSK-A, MSK-B, MSK-C, ...
- **Rozvoz:** Drivecool (všechny trasy), ale může se změnit

### 3.5 Dynamika v čase (DŮLEŽITÉ!)

Systém je dynamický - vše se v čase mění:

| Co se mění | Příklad | Důsledek pro data |
|------------|---------|-------------------|
| **AlzaBoxy na trase** | "Praha A" má dnes jiné boxy než před rokem | Historie přiřazení boxů |
| **Počet boxů na trase** | "Praha A" měla 50 boxů, dnes má 65 | Trackování změn |
| **Dopravce na trase** | "Praha A" jezdil Drivecool, teď jezdí jiný | Historie dopravců |
| **Depo pro trasu** | "MSK A" začínala z Vratimova, teď odjinud | Historie přiřazení dep |
| **Existence depa** | Depo může vzniknout/zaniknout | valid_from, valid_to |

### 3.6 Datový model pro historii změn

```
Trasa (Route)
├── route_id, route_name (např. "Praha A")
├── Má historii přiřazení k depu (RouteDepotHistory)
│   └── route_id, depot_id, valid_from, valid_to
├── Má historii přiřazení dopravce (RouteCarrierHistory)
│   └── route_id, carrier_id, valid_from, valid_to
└── Má historii seznamu AlzaBoxů (AlzaBoxAssignment)
    └── box_id, route_id, valid_from, valid_to

Depot
├── id, name, code
├── operator_type: 'ALZA' | 'CARRIER'
├── operator_carrier_id (pokud CARRIER)
├── valid_from, valid_to (existence depa)
└── location_code (CZLC4, CZTC1, nebo NULL)

DepotNameMapping (mapování názvů z plánovacích souborů)
├── plan_name: "Depo Drivecool"
└── depot_id → Depot (Vratimov)
```

### 3.6.1 Kompletní DB Schema (v2)

**Nové tabulky:**

| Tabulka | Účel |
|---------|------|
| `Route` | Master data tras (unikátní název, region) |
| `RouteDepotHistory` | Historie: trasa → depo (N:M s časem) |
| `RouteCarrierHistory` | Historie: trasa → dopravce (N:M s časem) |
| `DepotNameMapping` | Mapování názvů dep z plánovacích souborů |

**Upravené tabulky:**

| Tabulka | Změna |
|---------|-------|
| `Depot` | + `operatorType`, `operatorCarrierId`, `validFrom`, `validTo`, `locationCode` |
| `AlzaBoxAssignment` | + `routeId` (vazba na Route) |
| `RoutePlanRoute` | + `routeId`, `depotId` (vazby na master data) |

**ER Diagram:**

```
┌─────────────┐       ┌──────────────────────┐       ┌─────────────┐
│   Carrier   │       │  RouteCarrierHistory │       │    Route    │
├─────────────┤       ├──────────────────────┤       ├─────────────┤
│ id          │◄──────│ carrierId            │       │ id          │
│ name        │       │ routeId              │──────►│ routeName   │
│ ...         │       │ validFrom            │       │ region      │
└─────────────┘       │ validTo              │       │ isActive    │
      │               └──────────────────────┘       └─────────────┘
      │                                                     │
      │ operatorCarrierId                                   │
      ▼                                                     ▼
┌─────────────┐       ┌──────────────────────┐       ┌─────────────┐
│    Depot    │◄──────│   RouteDepotHistory  │──────►│    Route    │
├─────────────┤       ├──────────────────────┤       └─────────────┘
│ id          │       │ depotId              │
│ name        │       │ routeId              │
│ code        │       │ validFrom            │
│ operatorType│       │ validTo              │
│ validFrom   │       └──────────────────────┘
│ validTo     │
└─────────────┘
      │
      │ depotId
      ▼
┌─────────────────────┐
│  DepotNameMapping   │
├─────────────────────┤
│ planName            │  ← "Depo Drivecool"
│ depotId             │  → Depot (Vratimov)
└─────────────────────┘
```

### 3.6.2 API Endpointy pro depa a trasy

**Depa:**
- `GET /api/depots` - seznam všech dep (filtry: operator_type, carrier_id, active_only)
- `GET /api/depots/{id}` - detail depa
- `POST /api/depots` - vytvoření depa
- `GET /api/depots/mappings` - mapování názvů z plánovacích souborů
- `POST /api/depots/resolve-name?plan_name=X` - přeložení názvu z plánu na skutečné depo

**Trasy:**
- `GET /api/routes` - seznam tras (filtry: region, depot_id, carrier_id)
- `GET /api/routes/{id}` - detail trasy
- `POST /api/routes` - vytvoření trasy
- `GET /api/routes/{id}/depot-history` - historie přiřazení k depům
- `GET /api/routes/{id}/carrier-history` - historie přiřazení k dopravcům
- `POST /api/routes/{id}/assign-depot` - přiřazení trasy k depu
- `POST /api/routes/{id}/assign-carrier` - přiřazení trasy k dopravci

### 3.6.3 Frontend stránka Depots.jsx

Nová stránka `/depots` zobrazuje:
- Přehled všech dep (ALZA i CARRIER provozovaných)
- Pro každé depo: seznam tras, provozovatel, region
- Statistiky: počet dep, počet tras podle regionu
- Filtr podle typu provozovatele

### 3.7 Detaily jednotlivých lokalit

**CZLC4 (Chrášťany) - Sklad + Depo Chrášťany:**
- **Sklad**: Uskladnění zboží, odjezd linehaulů na Vratimov a Nový Bydžov
- **Depo Chrášťany**: Direct trasy na Prahu/STČ
- **Depo pro MSK**: Některé direct trasy na Moravskoslezsko (část tras)

**CZTC1 (Úžice) - Třídírna + Depo Třídírna:**
- **PŘÍJEZD (svozy)**: Přijíždějí sem svozy od dodavatelů = služba AlzaTrade / Drop 2.0
- **Třídírna**: Třídění zboží z Drop 2.0 pro další distribuci
- **ODJEZD (linehauly)**: Odjíždějí linehauly na Vratimov a Nový Bydžov
- **ODJEZD (direct)**: Direct trasy na Prahu/STČ (Depo Třídírna)

**Vratimov - Depo Vratimov:**
- Čistě depo (přetřídění linehaulů → rozvoz)
- Obsluhuje Moravu

**Nový Bydžov - Depo Nový Bydžov:**
- Čistě depo (přetřídění linehaulů → rozvoz)
- Obsluhuje okolí Nového Bydžova

### 3.8 Svozy na třídírnu (AlzaTrade / Drop 2.0)

**Co je AlzaTrade / Drop 2.0:**
- Služba svozu zboží od externích dodavatelů (první míle)
- Dodavatel předá zboží → svozová trasa → CZTC1 (třídírna)

**Tok zboží:**
```
Dodavatel 1 ─┐
Dodavatel 2 ─┼── SVOZ ──► CZTC1 (třídírna) ──► Linehaul/Direct
Dodavatel 3 ─┘
```

**Sazby za svoz:**
- Ceníky pro svozy jsou samostatná kategorie (směr → CZTC1)
- V aplikaci zobrazeny v sekci "SVOZ TŘÍDÍRNA"

### 3.9 Praha/STČ - dvě depa

Praha a Střední Čechy mají dvě depa (začínají zde direct trasy):

| Depo | Lokace | Zboží |
|------|--------|-------|
| **Depo Chrášťany** | CZLC4 | Zboží ze skladu |
| **Depo Třídírna** | CZTC1 | Zboží z třídírny (AlzaTrade 2.0) |

### 3.10 Struktura logistiky

```
┌─────────────────────────────────────────────────────────────────┐
│                         LOKACE                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────┐      ┌──────────────────────┐         │
│  │ CZLC4 (Chrášťany)    │      │ CZTC1 (Úžice)        │         │
│  │ ══════════════════   │      │ ═══════════════      │         │
│  │ Role: SKLAD + DEPO   │      │ Role: TŘÍDÍRNA + DEPO│         │
│  │ Depo: "Chrášťany"    │      │ Depo: "Třídírna"     │         │
│  └──────────┬───────────┘      └──────────┬───────────┘         │
│             │                              ▲                     │
│             │                              │                     │
│             │                     ┌────────┴────────┐            │
│             │                     │ SVOZY (Drop 2.0)│            │
│             │                     │ od dodavatelů   │            │
│             │                     └─────────────────┘            │
│             │                              │                     │
│             ├──── Linehaul ────────────────┤                     │
│             │                              │                     │
│             ▼                              ▼                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    CÍLOVÁ DEPA                           │    │
│  ├─────────────────────────────────────────────────────────┤    │
│  │  ┌─────────────────┐          ┌─────────────────┐       │    │
│  │  │ Depo Vratimov   │          │ Depo Nový Bydžov│       │    │
│  │  │ (pouze depo)    │          │ (pouze depo)    │       │    │
│  │  └────────┬────────┘          └────────┬────────┘       │    │
│  │           │                            │                │    │
│  │           ▼                            ▼                │    │
│  │     ┌───────────┐               ┌───────────┐           │    │
│  │     │ AlzaBoxy  │               │ AlzaBoxy  │           │    │
│  │     │ Morava    │               │ okolí NB  │           │    │
│  │     └───────────┘               └───────────┘           │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              DIRECT TRASY (Praha/STČ/MSK)                │    │
│  ├─────────────────────────────────────────────────────────┤    │
│  │  CZLC4 ──Direct──► AlzaBoxy Praha/STČ + část MSK        │    │
│  │  CZTC1 ──Direct──► AlzaBoxy Praha/STČ (AlzaTrade)       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.11 Klíčové pojmy

| Pojem | Popis |
|-------|-------|
| **Sklad** | Uskladňuje zboží, odjíždí z něj linehauly (CZLC4) |
| **Třídírna** | Přijíždějí sem svozy, odjíždí linehauly i directy (CZTC1) |
| **Depo** | Místo odkud začínají direct trasy (dodávky → AlzaBoxy) |
| **Svoz** | Přeprava od dodavatelů NA třídírnu (AlzaTrade / Drop 2.0) |
| **Linehaul** | Přeprava ze skladu/třídírny na depo (kamion, solo, dodávka) |
| **Direct trasa** | Dodávka jede přímo z depa k AlzaBoxům |

### 3.12 Způsoby obsluhy rozvozové oblasti

**1. Linehaul + rozvoz z depa (Vratimov, Nový Bydžov):**
```
Sklad/Třídírna → Linehaul → Depo → Třídění → Direct trasy → AlzaBoxy
```

**2. Direct trasy z Chrášťan/Třídírny (Praha/STČ/část MSK):**
```
Depo Chrášťany/Třídírna → Direct trasa → AlzaBoxy
```

### 3.13 Sazby per depo

**Depo Vratimov:**
| Typ sazby | Popis | Příklad |
|-----------|-------|---------|
| Linehaul | Ze skladu/třídírny na depo | CZTC1 → Vratimov |
| FIX | Paušál za rozvozovou trasu | 2 500 Kč |
| KM | Kilometrová sazba | 10,97 Kč/km |
| DEPO | Práce na depu (hodinová) | 850 Kč/h |

**Depo Nový Bydžov:**
| Typ sazby | Popis | Příklad |
|-----------|-------|---------|
| Linehaul | Ze skladu/třídírny na depo | CZLC4 → NB |
| FIX | Paušál za rozvozovou trasu | 3 200 Kč |
| KM | Kilometrová sazba | 10,97 Kč/km |
| Sklad | Měsíční paušál | 410 000 Kč |
| Bonus | Za kvalitu ≥98% | +35 600 Kč |

### 3.14 Alza Trade Delivery 2.0

Služba svozu (první míle) od dodavatelů:
```
Dodavatel → Svoz → CZTC1 (třídírna) → Direct trasy z Depa Třídírna
```

### 3.15 Zobrazení v aplikaci (Prices.jsx)

Ceníky zobrazeny **per typ služby → per depo**:

```
📦 AlzaBox
├── 🏭 Depo Vratimov
│   ├── Linehaul (ze skladu/třídírny na depo)
│   │   └── Z Úžice: Dodávka/Solo/Kamion [D8]
│   │   └── Z Chrášťan: Dodávka/Solo/Kamion [D8]
│   └── Rozvoz z depa (direct trasy)
│       └── FIX 2 500 Kč [D7] | KM 10,97 Kč [D7] | DEPO 850 Kč/h [D7]
│
├── 📦 Depo Nový Bydžov
│   ├── Linehaul (ze skladu/třídírny na depo)
│   ├── Rozvoz z depa (direct trasy)
│   │   └── FIX 3 200 Kč [D7] | KM 10,97 Kč [D7]
│   └── Skladové služby
│       └── ALL IN 410 000 Kč [D12] | Bonus ≥98% +35 600 Kč [D12]
│
├── 🏢 Depo Chrášťany (CZLC4)
│   └── Direct trasy Praha/STČ + část MSK
│       └── FIX 3 200 Kč [D7] | KM 10,97 Kč [D7]
│
└── 🏭 Depo Třídírna (CZTC1)
    └── Direct trasy Praha/STČ (AlzaTrade 2.0)
        └── (sazby dle smlouvy)
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
   - Číslo dodatku
   - Datum platnosti
   - Typ služby (AlzaBox/Třídírna/XL)
   - FIX, KM, DEPO, Linehaul sazby
4. Vytvoří se Contract + PriceConfig + sazby
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

### 7.2 Extrakce ceníků
- Automatická detekce typu služby z textu
- Sazby se párují k depům podle klíčových slov
- KM sazby jsou sdílené mezi depy (pokud není specifikováno)

### 7.3 Včasnost dojezdů
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

---

## 9. AKTUALIZACE v3.11.0

> **Datum:** Prosinec 2025

### 9.1 Redesign ceníků (Prices.jsx)

Nová hierarchie zobrazení: **Typ závozu → Depo → Služba**

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
├── 🔵 Depo Chrášťany (CZLC4) - Praha/STČ + část MSK
│   └── ROZVOZ (Direct trasy)
│       └── FIX 3 200 Kč | KM 10,97 Kč [D7]
│
└── 🔵 Depo Třídírna (CZTC1) - Praha/STČ (AlzaTrade)
    └── ROZVOZ (Direct trasy)
        └── (sazby dle smlouvy)
```

### 9.2 Mapování DepoRate na depa

| depoName v DB | Mapuje na depo |
|---------------|----------------|
| Sklad_ALL_IN | Nový Bydžov |
| Sklad_ALL_IN_sleva | Nový Bydžov |
| Skladnici | Nový Bydžov |
| Brigadnik | Nový Bydžov |
| Vratimov | Vratimov |

### 9.3 Automatické amendmentNumber

Při uploadu smlouvy se automaticky extrahuje číslo dodatku z názvu:
- "Dodatek č. 7" → `amendmentNumber = 7`
- "Dodatek č. 12" → `amendmentNumber = 12`

Zobrazuje se jako [D7], [D8], [D12] u každé sazby v ceníku.

### 9.4 Rozšířené ceníky Drivecool

**Sklad (Dodatek č. 12) - kompletní:**
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

## 10. AKTUALIZACE v3.12.0

> **Datum:** 7. prosince 2025

### 10.1 Opravy DB schématu

**Problém:** Nesoulad mezi `models.py` a skutečným DB schématem způsoboval chyby při uploadu plánovacích souborů a v Expected Billing.

**Přidané sloupce do RoutePlan:**
- `dpoRoutesCount`, `sdRoutesCount` - počty tras per typ
- `dpoLinehaulCount`, `sdLinehaulCount` - počty linehaulů
- `vratimovStops`, `vratimovKm`, `vratimovDurationMin` - agregace Vratimov
- `bydzovStops`, `bydzovKm`, `bydzovDurationMin` - agregace Nový Bydžov

**Přidané sloupce do RoutePlanRoute:**
- `routeLetter` - písmeno trasy (A, B, C...)
- `routeType` - typ trasy (DPO/SD)
- `deliveryType` - alias pro drLh

**Přidané sloupce do LoginLog:**
- `email` - email nebo status ('app_user', 'failed_attempt')

**Přidané sloupce do ProofDailyDetail:**
- `dayOfWeek` - den v týdnu

### 10.2 Kritické naming conventions

| Tabulka | Python atribut | DB sloupec | Poznámka |
|---------|----------------|------------|----------|
| **RoutePlan** | `total_km` | `totalKm` | Celkové km plánu |
| **RoutePlanRoute** | `total_distance_km` | `totalDistanceKm` | KM jednotlivé trasy |

⚠️ **POZOR:** V `route_plans.py` bylo 5 míst, kde se chybně používalo `total_distance_km` místo `total_km` pro RoutePlan model. Opraveno.

### 10.3 Detekce linehaulů z DR/LH sloupce

| Hodnota drLh | Počet linehaulů | Popis |
|--------------|-----------------|-------|
| `LH-LH` | 2 | Dva linehauly denně |
| `DR-LH` nebo `LH-DR` | 1 | Jeden linehaul |
| `DR-DR` | 0 | Žádný linehaul (direct) |
| `DR` | 0 | Direct trasa |

### 10.4 Expected Billing - km fallback logika

**Problém:** `RoutePlanRoute.total_distance_km` může být NULL, což způsobovalo KM = 0.

**Řešení:**
```python
plan_total_km = plan.total_km or 0  # Celkové km z RoutePlan
routes_count = len(plan.routes) or 1
avg_km_per_route = plan_total_km / routes_count

for route in plan.routes:
    route_km = route.total_distance_km or 0
    if route_km == 0:
        route_km = avg_km_per_route  # Použij průměr jako fallback
```

### 10.5 SQL migrace pro v3.12.0

```sql
-- LoginLog - recreate
DROP TABLE IF EXISTS "LoginLog";
CREATE TABLE "LoginLog" (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255),
    "loginAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" VARCHAR(50),
    "userAgent" TEXT
);

-- RoutePlan - přidej sloupce
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

-- RoutePlanRoute - přidej sloupce
ALTER TABLE "RoutePlanRoute"
ADD COLUMN IF NOT EXISTS "routeLetter" VARCHAR(10),
ADD COLUMN IF NOT EXISTS "routeType" VARCHAR(20) DEFAULT 'DPO',
ADD COLUMN IF NOT EXISTS "deliveryType" VARCHAR(20);

-- ProofDailyDetail
ALTER TABLE "ProofDailyDetail" 
ADD COLUMN IF NOT EXISTS "dayOfWeek" VARCHAR(10);
```

### 10.6 Rozšířené entity (v3.12.0)

```
Carrier (Dopravce)
├── Contract[] (Smlouvy)
│   ├── amendmentNumber (číslo dodatku) ← NOVÉ v3.11.0
│   └── PriceConfig (Ceník)
│       ├── FixRate[]
│       ├── KmRate[]
│       ├── DepoRate[]
│       ├── LinehaulRate[]
│       └── BonusRate[]
├── RoutePlan[] (Plány tras)
│   ├── totalKm, dpoRoutesCount, sdRoutesCount ← OPRAVENO v3.12.0
│   └── RoutePlanRoute[] (Jednotlivé trasy)
│       ├── routeLetter, routeType, deliveryType ← NOVÉ v3.12.0
│       └── totalDistanceKm
├── Proof[] (Proofy)
└── Invoice[] (Faktury)

AlzaBoxLocation (Box)
└── AlzaBoxDelivery[] (Dojezdy)

LoginLog (Audit přihlášení)
└── email, loginAt, ipAddress, userAgent ← OPRAVENO v3.12.0
```

---

## CHANGELOG

### v3.13.0 (7. prosince 2025)
- ✅ **Kompletní DB schema v2 - Routes and Depots**:
  - Nové tabulky: `Route`, `RouteDepotHistory`, `RouteCarrierHistory`, `DepotNameMapping`
  - Upravená tabulka `Depot`: `operatorType`, `operatorCarrierId`, `validFrom`, `validTo`, `locationCode`
  - Upravené tabulky: `AlzaBoxAssignment` (+ `routeId`), `RoutePlanRoute` (+ `routeId`, `depotId`)
- ✅ **SQL migrace**: `001_routes_and_depots_v2.sql`
- ✅ **Seed data**: `002_seed_depots_and_routes.sql`
  - 9 dopravců (Drivecool, GEM, Zítek, Lantaron, Asen, Fismo, Davcol, FADvořáček, L-CarCare)
  - 7 dep (Chrášťany, Třídírna, Vratimov, Morava, Západ, Hosín, Nový Bydžov)
  - Mapování názvů z plánovacích souborů (DepotNameMapping)
- ✅ **Backend**: Nové API endpointy `/api/depots`, `/api/routes`
- ✅ **Frontend**: Nová stránka `Depots.jsx` pro správu dep a tras
- ✅ **Aktualizovaný models.py (v2)** s novými modely

### v3.12.0 (7. prosince 2025)
- ✅ DB schema opravy (RoutePlan, RoutePlanRoute, LoginLog, ProofDailyDetail)
- ✅ route_plans.py: oprava `total_distance_km` → `total_km` pro RoutePlan
- ✅ Expected Billing: km fallback logika (plan.total_km jako záloha)
- ✅ Dokumentace: detekce linehaulů z drLh sloupce
- ✅ SQL migrace skripty
- ✅ **Oprava terminologie lokací a dep**:
  - CZLC4 (Chrášťany) = Sklad + Depo Chrášťany
  - CZTC1 (Úžice) = Třídírna + Depo Třídírna
  - Praha/STČ má 2 depa: Depo Chrášťany + Depo Třídírna
  - CZLC4 může být i depo pro část tras MSK
- ✅ **Svozy na třídírnu (AlzaTrade / Drop 2.0)**:
  - Nová sekce 3.8 popisující svozy od dodavatelů → CZTC1
  - Aktualizovaný diagram s příjezdem svozů
  - Přidán pojem "Svoz" do klíčových pojmů
- ✅ **Provozovatelé a dynamika systému**:
  - Sekce 3.3: Provozovatelé lokalit (ALZA vs DOPRAVCE)
  - Sekce 3.4: Vztah Depo ↔ Dopravci ↔ Trasy
  - Sekce 3.5: Dynamika v čase (změny tras, boxů, dopravců, dep)
  - Sekce 3.6: Datový model pro historii změn (RouteDepotHistory, RouteCarrierHistory)

### v3.11.0 (Prosinec 2025)
- ✅ Redesign ceníků: hierarchie typ závozu → depo
- ✅ DepoRate mapování: Sklad_ALL_IN → Nový Bydžov
- ✅ amendmentNumber: automatické nastavení při uploadu
- ✅ Naming conventions dokumentace

### v3.10.0 (Prosinec 2025)
- Restrukturace ceníků per depo
- Zachování čísel dodatků
- Deduplikace sazeb

---

*Aktualizováno: 7. prosince 2025 - v3.13.0*
