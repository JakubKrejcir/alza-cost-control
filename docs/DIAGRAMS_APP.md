# Procesní diagramy - APLIKACE

> **Verze:** 3.11.0  
> **Datum:** Prosinec 2025

---

## 1. Upload plánu tras

```mermaid
flowchart TD
    A[📄 Uživatel nahraje XLSX] --> B[Parsování sheet 'Routes']
    B --> C{Datum v názvu souboru?}
    C -->|Ano| D[Extrakce valid_from]
    C -->|Ne| E[Uživatel zadá ručně]
    D --> F[Rozpoznání DPO/SD tras<br/>DPO = start < 12:00]
    E --> F
    F --> G[Spočítání linehaulů<br/>LH-LH = 2 kamiony]
    G --> H{Existuje plán<br/>pro same date?}
    H -->|Ano| I[Přepsat starý plán]
    H -->|Ne| J[Vytvořit nový plán]
    I --> K[Aktualizovat valid_to<br/>předchozích plánů]
    J --> K
    K --> L[✅ Uložit RoutePlan<br/>+ RoutePlanRoute]
    
    style A fill:#e1f5fe
    style L fill:#c8e6c9
```

---

## 2. Upload proofu

```mermaid
flowchart TD
    A[📄 XLSX + dopravce + období] --> B[Parsování sheet 'Sumar']
    B --> C[Hledání hodnot podle labelů<br/>sloupec B → hodnota D]
    C --> D[Extrakce totals]
    D --> D1[total_fix]
    D --> D2[total_km]
    D --> D3[total_linehaul]
    D --> D4[total_depo]
    D --> D5[total_penalty]
    D --> D6[grand_total]
    D1 & D2 & D3 & D4 & D5 & D6 --> E[Extrakce route details]
    E --> E1[DR]
    E --> E2[LH_DPO]
    E --> E3[LH_SD]
    E --> E4[LH_SD_SPOJENE]
    E1 & E2 & E3 & E4 --> F[Extrakce depo details]
    F --> G{Existuje proof<br/>pro období?}
    G -->|Ano| H[Smazat starý]
    G -->|Ne| I[Pokračovat]
    H --> I
    I --> J[✅ Uložit Proof + details]
    
    style A fill:#e1f5fe
    style J fill:#c8e6c9
```

---

## 3. Upload faktury

```mermaid
flowchart TD
    A[📄 PDF + dopravce + období] --> B[Parsování PDF<br/>pdfplumber]
    B --> C[Extrakce hlavičky]
    C --> C1[Číslo faktury]
    C --> C2[Variabilní symbol]
    C --> C3[Datum vystavení]
    C --> C4[Datum splatnosti]
    C1 & C2 & C3 & C4 --> D[Extrakce částek<br/>4 strategie]
    D --> D1[1. Line item]
    D --> D2[2. Součet položek]
    D --> D3[3. DPH rekapitulace]
    D --> D4[4. CELKEM K ÚHRADĚ]
    D1 & D2 & D3 & D4 --> E[Detekce typu]
    E --> E1[ALZABOXY FIX]
    E --> E2[ALZABOXY KM]
    E --> E3[ALZABOXY LINEHAUL]
    E --> E4[ALZABOXY DEPO]
    E1 & E2 & E3 & E4 --> F{Faktura existuje?}
    F -->|Ano| G[❌ Chyba duplicita]
    F -->|Ne| H[Auto-párování s proofem]
    H --> I[✅ Uložit Invoice + Item]
    
    style A fill:#e1f5fe
    style G fill:#ffcdd2
    style I fill:#c8e6c9
```

---

## 4. Upload smlouvy/dodatku

```mermaid
flowchart TD
    A[📄 PDF dodatku] --> B[Extrakce textu]
    B --> C[Hledání IČO dopravce]
    C --> C1{IČO = 27082440?}
    C1 -->|Ano| C2[Ignorovat - to je Alza]
    C1 -->|Ne| D[Použít IČO]
    C2 --> C
    D --> E[Extrakce info dopravce]
    E --> E1[Název]
    E --> E2[DIČ]
    E --> E3[Adresa]
    E1 & E2 & E3 --> F[Extrakce info smlouvy]
    F --> F1[Číslo dodatku]
    F --> F2[Datum platnosti]
    F --> F3[Typ služby]
    F1 & F2 & F3 --> G[Extrakce sazeb]
    G --> G1[FixRate]
    G --> G2[KmRate]
    G --> G3[DepoRate]
    G --> G4[LinehaulRate]
    G1 & G2 & G3 & G4 --> H{Dopravce existuje?}
    H -->|Ne| I[Vytvořit dopravce]
    H -->|Ano| J[Použít existujícího]
    I --> K[Vytvořit Contract]
    J --> K
    K --> L[✅ Vytvořit PriceConfig + Rates]
    
    style A fill:#e1f5fe
    style L fill:#c8e6c9
```

---

## 5. AlzaBox Import (NOVÉ v3.10)

```mermaid
flowchart TD
    subgraph LOCATIONS ["Import lokací"]
        A1[📄 XLSX lokací] --> A2[Detekce sheetu<br/>LL_PS / Sheet1 / Data]
        A2 --> A3[Parsování sloupců]
        A3 --> A4[box_code, name, city<br/>GPS, carrier_code]
        A4 --> A5[Upsert AlzaBoxLocation]
    end
    
    subgraph DELIVERIES ["Import dojezdů"]
        B1[📄 XLSX dojezdů] --> B2[Detekce sheetů<br/>Actual + Plan]
        B2 --> B3[Datumy z row 2]
        B3 --> B4[Regex parser<br/>čas | název -- AB1234]
        B4 --> B5{Hlavička trasy?}
        B5 -->|Ano| B6[Uložit route_group]
        B5 -->|Ne| B7[Extrakce box_code + časy]
        B6 --> B4
        B7 --> B8[Párování s lokací]
        B8 --> B9[Uložit AlzaBoxDelivery]
    end
    
    A5 --> C[Dashboard statistiky]
    B9 --> C
    C --> D[Graf včasnosti<br/>on_time = actual ≤ planned]
    
    style A1 fill:#e1f5fe
    style B1 fill:#e1f5fe
    style D fill:#c8e6c9
```

---

## 6. Očekávaná fakturace (NOVÉ v3.10)

```mermaid
flowchart TD
    A[Výběr dopravce + období<br/>z globální hlavičky] --> B[Načtení plánovacích souborů]
    B --> C[Načtení aktivních ceníků]
    C --> D{Data dostupná?}
    D -->|Ne| E[⚠️ Nedostatek dat]
    D -->|Ano| F[Výpočet složek]
    
    F --> F1[FIX za trasy<br/>DPO × sazba + SD × sazba]
    F --> F2[KM náklady<br/>total_km × Kč/km]
    F --> F3[Linehaul<br/>počet × průměrná sazba]
    F --> F4[DEPO náklady<br/>denní/měsíční sazby]
    
    F1 & F2 & F3 & F4 --> G[Součet = grand_total]
    G --> H[+ DPH 21%]
    H --> I[✅ Zobrazení výsledků]
    
    I --> J[Karty: Celkem, FIX, KM, LH, DEPO]
    I --> K[Tabulka plánovacích souborů]
    
    style A fill:#e1f5fe
    style E fill:#fff3e0
    style I fill:#c8e6c9
```

---

## 7. Porovnání plán vs. proof

```mermaid
flowchart TD
    A[Výběr plánu + proof] --> B[Načtení dat plánu]
    B --> B1[dpo_routes_count]
    B --> B2[sd_routes_count]
    B --> B3[dpo_linehaul_count]
    B --> B4[sd_linehaul_count]
    B1 & B2 & B3 & B4 --> C[Načtení dat proofu]
    C --> C1[LH_DPO count]
    C --> C2[LH_SD count]
    C --> C3[LH_SD_SPOJENE count]
    C --> C4[Linehaul details]
    C1 & C2 & C3 & C4 --> D[Porovnání]
    D --> D1[DPO: plán vs skutečnost]
    D --> D2[SD: plán vs skutečnost]
    D --> D3[Linehauly: plán vs skutečnost]
    D1 & D2 & D3 --> E{Rozdíly?}
    E -->|Ano| F[⚠️ Generovat warnings]
    E -->|Ne| G[✅ Status OK]
    F --> H[Výstup: Comparison report]
    G --> H
    
    style A fill:#e1f5fe
    style F fill:#fff3e0
    style G fill:#c8e6c9
```

---

## 8. Dashboard flow

```mermaid
flowchart TD
    A[Dashboard load] --> B[CarrierContext<br/>selectedCarrierId + selectedPeriod]
    B --> C[Načtení proofů<br/>s filtry]
    C --> D[Pro každý proof]
    D --> E[Spočítat součet faktur]
    E --> F[Načíst poslední analýzu]
    F --> G[Vypočítat remaining]
    G --> H{Další proof?}
    H -->|Ano| D
    H -->|Ne| I[Sestavit response]
    I --> J[DashboardSummary list]
    J --> K[Zobrazení karet<br/>Faktury / Proof / Rozdíl]
    
    style A fill:#e1f5fe
    style K fill:#c8e6c9
```

---

## 9. Frontend State Management

```mermaid
flowchart TD
    subgraph CONTEXT ["CarrierContext (globální)"]
        A1[selectedCarrierId]
        A2[selectedPeriod]
        A3[carrierList]
        A4[periodOptions]
    end
    
    subgraph LAYOUT ["Layout.jsx"]
        B1[Sidebar navigace]
        B2[Top bar s dropdowny]
        B3[Outlet pro stránky]
    end
    
    subgraph PAGES ["Stránky"]
        C1[Dashboard<br/>needsCarrier + needsPeriod]
        C2[Očekávaná fakturace<br/>needsCarrier + needsPeriod]
        C3[Ceníky<br/>needsCarrier]
        C4[Dokumenty<br/>needsCarrier + needsPeriod]
        C5[AlzaBox BI<br/>globální data]
        C6[Dopravci<br/>bez filtru]
    end
    
    A1 & A2 --> B2
    B2 --> C1 & C2 & C3 & C4
    B3 --> C1 & C2 & C3 & C4 & C5 & C6
    
    style CONTEXT fill:#e3f2fd
    style LAYOUT fill:#f3e5f5
    style PAGES fill:#e8f5e9
```

---

## 10. API Routing Architecture

```mermaid
flowchart LR
    subgraph FRONTEND ["Frontend"]
        F1[api.js<br/>axios instance]
    end
    
    subgraph BACKEND ["Backend - main.py"]
        M[FastAPI App]
        M --> R1[/api/auth]
        M --> R2[/api/carriers]
        M --> R3[/api/contracts]
        M --> R4[/api/prices]
        M --> R5[/api/proofs]
        M --> R6[/api/invoices]
        M --> R7[/api/alzabox]
        M --> R8[/api/expected-billing]
    end
    
    subgraph DATABASE ["PostgreSQL"]
        DB[(Database)]
    end
    
    F1 --> M
    R1 & R2 & R3 & R4 & R5 & R6 & R7 & R8 --> DB
    
    style FRONTEND fill:#e1f5fe
    style BACKEND fill:#fff3e0
    style DATABASE fill:#c8e6c9
```

---

*Diagramy vygenerovány pro TransportBrain v3.11.0*
