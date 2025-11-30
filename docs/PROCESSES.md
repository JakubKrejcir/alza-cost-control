# Alza Cost Control - Procesní dokumentace

> **Verze:** 2.1.0  
> **Datum:** Listopad 2025  
> **Zdroj:** Integrace znalostí ze všech konverzací + aktuální codebase

---

## 📊 OBSAH

1. [Přehled systému](#1-přehled-systému)
2. [Procesy aplikace](#2-procesy-aplikace)
3. [Procesy dopravy](#3-procesy-dopravy)
4. [Entity a vztahy](#4-entity-a-vztahy)
5. [Business pravidla](#5-business-pravidla)
6. [Co platí / Neplatí / Neznámé](#6-validace-znalostí)

---

## 1. PŘEHLED SYSTÉMU

### Co aplikace řeší
Kontrola nákladů na dopravu pro Alzu - porovnání:
- **Plánů tras** (co mělo jet)
- **Proofů** (co dopravce tvrdí, že jelo)  
- **Faktur** (co dopravce účtuje)
- **Ceníků** (za kolik to má být)

### Aktuální stav (MVP)
- Jeden dopravce: **Drivecool**
- Jedno hlavní depo: **Vratimov**
- Druhé depo: **Nový Bydžov** (měsíční paušál)

---

## 2. PROCESY APLIKACE

### 2.1 Upload plánu tras (XLSX)

```mermaid
flowchart TD
    A[Uživatel nahraje XLSX] --> B[Parsování sheet 'Routes']
    B --> C{Datum v názvu souboru?}
    C -->|Ano| D[Extrakce valid_from]
    C -->|Ne| E[Uživatel zadá ručně]
    D --> F[Rozpoznání DPO/SD tras]
    E --> F
    F --> G[Spočítání linehaulů z LH-LH]
    G --> H{Existuje plán pro same date?}
    H -->|Ano| I[Přepsat starý plán]
    H -->|Ne| J[Vytvořit nový plán]
    I --> K[Aktualizovat valid_to předchozích plánů]
    J --> K
    K --> L[Uložit RoutePlan + RoutePlanRoute]
```

**Klíčová logika:**
- DPO trasa = začátek před 12:00
- SD trasa = začátek od 12:00
- LH-LH = 2 linehauly pro CELÝ batch (ne per trasa!)
- `valid_to` se dopočítá automaticky podle dalšího plánu

---

### 2.2 Upload proofu (XLSX)

```mermaid
flowchart TD
    A[Uživatel nahraje XLSX + vybere dopravce + období] --> B[Parsování sheet 'Sumar']
    B --> C[Hledání hodnot podle labelů]
    C --> D[Extrakce totals: FIX, KM, Linehaul, DEPO, Penalty]
    D --> E[Extrakce route details: DR, LH_DPO, LH_SD, LH_SD_SPOJENE]
    E --> F[Extrakce depo details: Vratimov, Nový Bydžov]
    F --> G{Existuje proof pro období?}
    G -->|Ano| H[Smazat starý + vytvořit nový]
    G -->|Ne| I[Vytvořit nový]
    H --> J[Uložit Proof + details]
    I --> J
```

**Labely v XLSX (sloupec B → hodnota D):**
- "Cena FIX" → total_fix
- "Cena KM" → total_km
- "Linehaul" → total_linehaul
- "DEPO" → total_depo
- "Pokuty" → total_penalty
- "Celková částka" → grand_total

---

### 2.3 Upload faktury (PDF)

```mermaid
flowchart TD
    A[Uživatel nahraje PDF + vybere dopravce + období] --> B[Parsování PDF přes pdfplumber]
    B --> C[Extrakce: číslo faktury, VS, data]
    C --> D[Extrakce částek - 4 strategie]
    D --> E[Detekce typu: FIX/KM/LINEHAUL/DEPO]
    E --> F{Faktura již existuje?}
    F -->|Ano| G[Chyba - duplicita]
    F -->|Ne| H[Automatické párování s proofem]
    H --> I[Uložit Invoice + InvoiceItem]
```

**4 strategie extrakce částek:**
1. Line item match
2. "Součet položek"
3. DPH rekapitulace (základ 21% DPH celkem)
4. "CELKEM K ÚHRADĚ"

---

### 2.4 Upload smlouvy/dodatku (PDF)

```mermaid
flowchart TD
    A[Uživatel nahraje PDF dodatku] --> B[Extrakce textu]
    B --> C[Hledání IČO dopravce - ignorovat IČO Alzy]
    C --> D[Extrakce: název, DIČ, adresa]
    D --> E[Extrakce info o smlouvě: číslo, datum, typ]
    E --> F[Extrakce sazeb: FIX, KM, DEPO, Linehaul]
    F --> G{Dopravce existuje?}
    G -->|Ano| H[Použít existujícího]
    G -->|Ne| I[Vytvořit nového]
    H --> J[Vytvořit Contract]
    I --> J
    J --> K[Vytvořit PriceConfig + Rates]
```

---

### 2.5 Porovnání plán vs. proof

```mermaid
flowchart TD
    A[Uživatel vybere plány + proof] --> B[Agregace plánů za období]
    B --> C[Sečtení: working_days, total_routes, linehauls]
    C --> D[Načtení proof dat]
    D --> E[Porovnání DPO tras: plán vs skutečnost]
    E --> F[Porovnání SD tras: plán vs skutečnost]
    F --> G[Detekce spojených tras LH_SD_SPOJENE]
    G --> H[Porovnání linehaulů]
    H --> I[Generování rozdílů a warnings]
    I --> J[Výstup: Comparison report]
```

---

### 2.6 Analýza proofu vs. ceník

```mermaid
flowchart TD
    A[Spuštění analýzy proofu] --> B[Načtení aktivního ceníku]
    B --> C{Ceník existuje?}
    C -->|Ne| D[Warning: chybí ceník]
    C -->|Ano| E[Porovnání FIX sazeb]
    D --> F[Kontrola fakturace]
    E --> F
    F --> G{Všechny typy vyfakturovány?}
    G -->|Ne| H[Warning: chybí faktura typu X]
    G -->|Ano| I[Kontrola přefakturace]
    H --> I
    I --> J{Fakturováno > Proof?}
    J -->|Ano| K[Error: přefakturace]
    J -->|Ne| L[OK nebo Warnings]
    K --> M[Uložit ProofAnalysis]
    L --> M
```

---

## 3. PROCESY DOPRAVY

### 3.1 Hlavní tok zboží

```mermaid
flowchart LR
    subgraph SKLADY
        A[CZLC4 Log. centrum]
        B[CZTC1 Třídírna]
    end
    
    subgraph LINEHAUL
        C[2× Kamion LH-LH]
    end
    
    subgraph DEPO
        D[DEPO Vratimov]
        E[DEPO Nový Bydžov]
    end
    
    subgraph LAST_MILE
        F[23× Dodávka]
    end
    
    subgraph DORUČENÍ
        G[AlzaBoxy]
        H[Zákazníci]
    end
    
    A --> C
    B --> C
    C --> D
    C --> E
    D --> F
    E --> F
    F --> G
    F --> H
```

---

### 3.2 Typy rozvozů

```mermaid
flowchart TD
    subgraph DPO ["DPO - Ranní rozvoz"]
        A1[Objednávka do půlnoci] --> A2[Expedice po půlnoci]
        A2 --> A3[Linehaul LH-LH cca 2:00]
        A3 --> A4[Rozvoz od 7:00]
    end
    
    subgraph SD ["SD - Odpolední rozvoz (Same Day)"]
        B1[Objednávka ráno] --> B2[Expedice odpoledne]
        B2 --> B3[Linehaul LH-LH cca 14:00]
        B3 --> B4[Rozvoz od 16:00]
    end
    
    subgraph DR ["DR - Direct Route"]
        C1[Speciální zásilka] --> C2[Přímý rozvoz ze skladu]
        C2 --> C3[Bez průjezdu DEPEM]
    end
```

---

### 3.3 Časová osa denního provozu

```mermaid
gantt
    title Denní provoz dopravy
    dateFormat HH:mm
    axisFormat %H:%M
    
    section DPO
    Linehaul ze skladu     :a1, 00:00, 2h
    Překládka na DEPU      :a2, after a1, 2h
    Nakládka dodávek       :a3, after a2, 2h
    Rozvoz DPO tras        :a4, 07:00, 6h
    
    section SD
    Linehaul ze skladu     :b1, 12:00, 2h
    Překládka na DEPU      :b2, after b1, 1h
    Nakládka dodávek       :b3, after b2, 1h
    Rozvoz SD tras         :b4, 16:00, 5h
```

---

### 3.4 Struktura nákladů

```mermaid
pie title Struktura měsíčních nákladů (příklad)
    "FIX za trasy" : 45
    "KM" : 20
    "Linehaul" : 15
    "DEPO" : 15
    "Bonus/Penalty" : 5
```

---

## 4. ENTITY A VZTAHY

### 4.1 ER Diagram

```mermaid
erDiagram
    Carrier ||--o{ Depot : has
    Carrier ||--o{ Contract : has
    Carrier ||--o{ PriceConfig : has
    Carrier ||--o{ Proof : has
    Carrier ||--o{ Invoice : has
    Carrier ||--o{ RoutePlan : has
    
    Contract ||--o{ PriceConfig : defines
    
    PriceConfig ||--o{ FixRate : contains
    PriceConfig ||--o{ KmRate : contains
    PriceConfig ||--o{ DepoRate : contains
    PriceConfig ||--o{ LinehaulRate : contains
    PriceConfig ||--o{ BonusRate : contains
    
    Proof ||--o{ ProofRouteDetail : contains
    Proof ||--o{ ProofLinehaulDetail : contains
    Proof ||--o{ ProofDepoDetail : contains
    Proof ||--o{ Invoice : matched_to
    Proof ||--o{ ProofAnalysis : analyzed_by
    
    Invoice ||--o{ InvoiceItem : contains
    
    RoutePlan ||--o{ RoutePlanRoute : contains
    RoutePlanRoute ||--o{ RoutePlanDetail : contains
    
    Carrier {
        int id PK
        string name
        string ico
        string dic
        string address
    }
    
    Proof {
        int id PK
        int carrier_id FK
        string period
        decimal total_fix
        decimal total_km
        decimal total_linehaul
        decimal total_depo
        decimal grand_total
    }
    
    RoutePlan {
        int id PK
        int carrier_id FK
        datetime valid_from
        datetime valid_to
        int dpo_routes_count
        int sd_routes_count
        int dpo_linehaul_count
        int sd_linehaul_count
    }
```

---

### 4.2 Typy tras v systému

| Kód | Název | Popis |
|-----|-------|-------|
| `DR` | Direct Route | Přímý rozvoz ze skladu, bez DEPA |
| `LH_DPO` | Linehaul DPO | Ranní rozvoz (Do Půlnoci Objednáš) |
| `LH_SD` | Linehaul SD | Odpolední rozvoz (Same Day) |
| `LH_SD_SPOJENE` | Spojené SD | 2 trasy spojené do 1 vozidla |

---

### 4.3 Typy DEPO sazeb

| DEPO | Typ sazby | Popis |
|------|-----------|-------|
| Vratimov | Denní | X Kč × počet odpracovaných dnů |
| Nový Bydžov | Měsíční | Paušál ALL IN + skladníci |

---

## 5. BUSINESS PRAVIDLA

### 5.1 Pravidla pro plánování

| # | Pravidlo |
|---|----------|
| P1 | Plán platí od `valid_from` do `valid_to` (nebo do dalšího plánu) |
| P2 | Jeden měsíc může mít více plánů (např. 1.-14. a 15.-30.) |
| P3 | `valid_to` se automaticky přepočítá při uploadu nového plánu |
| P4 | Pracovní dny = pouze Po-Pá |

### 5.2 Pravidla pro linehaul

| # | Pravidlo |
|---|----------|
| L1 | **LH-LH = 2 kamiony pro CELÝ batch, NE per trasa!** |
| L2 | LH-LH pro DPO = 2 kamiony pro všechny ranní rozvozy |
| L3 | LH-LH pro SD = 2 kamiony pro všechny odpolední rozvozy |
| L4 | Linehaul přiváží zboží na DEPO, odkud jedou dodávky |

### 5.3 Pravidla pro proof

| # | Pravidlo |
|---|----------|
| R1 | Pro dopravce existuje max 1 proof za období |
| R2 | Nový upload přepíše existující proof |
| R3 | Celkové trasy = LH_DPO + LH_SD + LH_SD_SPOJENE + DR |

### 5.4 Pravidla pro fakturaci

| # | Pravidlo |
|---|----------|
| F1 | 4 typy faktur: FIX, KM, LINEHAUL, DEPO |
| F2 | Faktura se páruje s proofem podle období + dopravce |
| F3 | DPH je vždy 21% |
| F4 | Kombinace carrier_id + invoice_number musí být unikátní |

### 5.5 Pravidla pro ceníky

| # | Pravidlo |
|---|----------|
| C1 | Aktivní ceník se hledá podle období proofu |
| C2 | Tolerance pro rozdíly: 100 Kč |
| C3 | Sazby se extrahují z PDF dodatků ke smlouvám |

### 5.6 Pravidla pro bonusy (Nový Bydžov)

| Kvalita doručení | Bonus |
|------------------|-------|
| ≥ 98% | Plný bonus |
| 97.51 - 97.99% | Plný bonus |
| 97.01 - 97.50% | Snížený bonus |
| 96.51 - 97.00% | Snížený bonus |
| < 96% | Žádný bonus |

---

## 6. VALIDACE ZNALOSTÍ

### ✅ CO PLATÍ (potvrzeno aktuální codebase)

| Oblast | Detail |
|--------|--------|
| Upload proofu | XLSX parsing sheetu "Sumar", extrakce podle labelů |
| Upload faktury | PDF parsing přes pdfplumber, 4 strategie |
| Upload smlouvy | PDF parsing, extrakce IČO, vytvoření ceníku |
| Upload plánu | XLSX parsing sheetu "Routes", rozpoznání DPO/SD |
| Porovnání plán vs proof | Endpoint `/api/route-plans/{id}/compare/{proof_id}` |
| Entity | Carrier, Proof, Invoice, Contract, PriceConfig, RoutePlan |
| Typy tras | DR, LH_DPO, LH_SD, LH_SD_SPOJENE |
| DEPO | Vratimov (denní), Nový Bydžov (měsíční) |

### ⚠️ CO NEVÍME, ZDA PLATÍ

| Oblast | Poznámka |
|--------|----------|
| Agregace více plánů | V minulém chatu zmíněno, ale v aktuální codebase je porovnání 1:1 |
| PlanComparison entita | Zmíněna v minulém chatu, ale není v models.py |
| working_days výpočet | Zmíněno, ale v route_plans.py se nepočítá |
| routes_per_day | Zmíněno jako atribut, ale není v modelu |

### ❓ NEZNÁMÉ / K DOPLNĚNÍ

| Oblast | Co chybí |
|--------|----------|
| RouteDetails parsing | Připraveno v modelu, ale neukládá se |
| Kvalita doručení | Odkud se bere procento? |
| Posily | Jak se identifikují v proofu? |
| Automatické párování plánů | Jak napárovat správné plány k proofu? |

---

## 7. PŘÍLOHY

### 7.1 Aktuální ceníky (z dodatků)

**AlzaBox (Dodatek č. 9, od 1.7.2025):**
- DIRECT Praha: 3 200 Kč
- DIRECT Vratimov: 2 500 Kč
- Kč/km: 10,97 Kč
- DEPO hodina: 850 Kč

**DROP 2.0 (Dodatek č. 13, od 1.11.2025):**
- Trasy A-I: 8 500 Kč
- Dopoledne: 8 500 Kč
- Posily C, D, H: 11 600 Kč

**Nový Bydžov (Dodatek č. 12, od 1.10.2025):**
- Sklad ALL IN: 410 000 Kč/měs (po slevě 396 000 Kč)
- 4× skladník: 194 800 Kč/měs

---

*Dokument vygenerován integrací znalostí z projektu TransportBrain*
