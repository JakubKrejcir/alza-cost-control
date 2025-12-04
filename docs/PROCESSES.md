# Alza Cost Control - Procesní dokumentace

> **Verze:** 3.9.0  
> **Datum:** Prosinec 2025  
> **Aktualizace:** Linehauly do obou dep (Vratimov i Nový Bydžov)

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

## 3. EXPEDIČNÍ SKLADY A ROZVOZOVÁ DEPA

### 3.1 Struktura logistiky (Drivecool)

```
                    EXPEDIČNÍ SKLADY
                          │
        ┌─────────────────┴─────────────────┐
        │                                   │
        ▼                                   ▼
  ┌───────────┐                       ┌───────────┐
  │  CZTC1    │                       │  CZLC4    │
  │  Úžice    │                       │ Chrášťany │
  │(třídírna) │                       │           │
  └─────┬─────┘                       └─────┬─────┘
        │                                   │
        │         LINEHAUL                  │
        │    ┌────────┴────────┐            │
        │    │                 │            │
        │    ▼                 ▼            │
        │ ┌───────┐      ┌───────────┐      │
        └►│ DEPO  │      │   DEPO    │◄─────┘
          │VRATIM.│      │ NOVÝ BYD. │
          └───┬───┘      └─────┬─────┘
              │                │
              ▼                ▼
        ┌───────────┐    ┌───────────┐
        │ AlzaBoxy  │    │ AlzaBoxy  │
        │ Morava    │    │ okolí NB  │
        └───────────┘    └───────────┘
```

### 3.2 Expediční sklady vs Rozvozová depa

| Typ | Název | Kód | Funkce |
|-----|-------|-----|--------|
| **Expediční sklad** | Úžice (Třídírna) | CZTC1 | Třídírna, výchozí bod linehaulů |
| **Expediční sklad** | Chrášťany | CZLC4 | Hlavní sklad, expedice |
| **Rozvozové depo** | Vratimov | - | Příjem linehaulů, třídění, rozvoz na Moravu |
| **Rozvozové depo** | Nový Bydžov | - | Direct trasy + skladové služby |

### 3.3 Linehaul sazby

Linehauly mohou směřovat do **obou rozvozových dep** (Vratimov i Nový Bydžov).

**Do depa Vratimov:**
| Zdroj | Typ vozu | Palety | Sazba |
|-------|----------|--------|-------|
| CZTC1 (Úžice) | Dodávka | 8-10 | 9 100 Kč |
| CZTC1 (Úžice) | Solo | 15-18 | 14 800 Kč |
| CZTC1 (Úžice) | Kamion | 33 | 22 000 Kč |
| CZLC4 (Chrášťany) | Dodávka | 8-10 | 10 100 Kč |
| CZLC4 (Chrášťany) | Solo | 18-21 | 16 500 Kč |
| CZLC4 (Chrášťany) | Kamion | 33 | 24 180 Kč |

**Do depa Nový Bydžov:**
| Zdroj | Typ vozu | Palety | Sazba |
|-------|----------|--------|-------|
| CZTC1 (Úžice) | Dodávka | 8-10 | TBD |
| CZTC1 (Úžice) | Solo | 15-18 | TBD |
| CZLC4 (Chrášťany) | Dodávka | 8-10 | TBD |
| CZLC4 (Chrášťany) | Solo | 18-21 | TBD |

### 3.4 Rozvozové sazby

**Depo Vratimov (rozvoz dodávkami):**
| Sazba | Hodnota |
|-------|---------|
| FIX | 2 500 Kč/trasa |
| KM | 10,97 Kč/km |
| DEPO | 850 Kč/hod |

**Depo Nový Bydžov (direct trasy):**
| Sazba | Hodnota |
|-------|---------|
| FIX | 3 200 Kč/trasa |
| KM | 10,97 Kč/km |

**Skladové služby (Nový Bydžov):**
| Sazba | Hodnota |
|-------|---------|
| Sklad ALL IN | 410 000 Kč/měs |
| Bonus ≥98% | +35 600 Kč |

### 3.5 Platnost ceníků

- Nový ceník **nahrazuje** starý pro stejný typ sazby
- Zobrazuje se **pouze aktuálně platná** částka
- Deduplikace podle klíče (typ sazby + parametry)

```javascript
// Příklad deduplikace
const uniqueRates = deduplicateRates(rates, r => `${r.fromCode}_${r.vehicleType}`)
```

### 3.6 Zobrazení v aplikaci (Prices.jsx)

```
📦 AlzaBox (2 depa • 1 aktivní ceník)
│
├── 🏭 Depo Vratimov
│   │   Linehaul z CZTC1/CZLC4 → třídění → rozvoz dodávkami
│   │
│   ├── LINEHAUL DO DEPA
│   │   Z Úžice (CZTC1): Dodávka/Solo/Kamion
│   │   Z Chrášťan (CZLC4): Dodávka/Solo/Kamion
│   │
│   └── ROZVOZ Z DEPA (dodávky)
│       FIX: 2 500 Kč | KM: 10,97 Kč | DEPO: 850 Kč/h
│
└── 📦 Depo Nový Bydžov
    │   Linehaul + Direct trasy + skladové služby
    │
    ├── LINEHAUL DO DEPA
    │   Z Úžice (CZTC1): Dodávka/Solo/Kamion
    │   Z Chrášťan (CZLC4): Dodávka/Solo/Kamion
    │
    ├── DIRECT TRASY
    │   FIX: 3 200 Kč | KM: 10,97 Kč
    │
    └── SKLADOVÉ SLUŽBY
        ALL IN: 410 000 Kč/měs | Bonus ≥98%: +35 600 Kč
```

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

*Aktualizováno: Prosinec 2025 - v3.9.0*
