# Procesní diagramy - APLIKACE

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

## 5. Porovnání plán vs. proof

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

## 6. Analýza proofu vs. ceník

```mermaid
flowchart TD
    A[Spuštění analýzy] --> B[Načtení proofu]
    B --> C[Hledání aktivního ceníku]
    C --> D{Ceník nalezen?}
    D -->|Ne| E[⚠️ Warning: chybí ceník]
    D -->|Ano| F[Porovnání sazeb]
    E --> G[Kontrola fakturace]
    F --> F1[FIX: proof vs ceník]
    F --> F2[KM: proof vs ceník]
    F --> F3[DEPO: proof vs ceník]
    F1 & F2 & F3 --> G
    G --> H{Všechny typy<br/>vyfakturovány?}
    H -->|Ne| I[⚠️ Warning: chybí faktura]
    H -->|Ano| J[Kontrola přefakturace]
    I --> J
    J --> K{Fakturováno > Proof?}
    K -->|Ano| L[❌ Error: přefakturace]
    K -->|Ne| M[Tolerance check<br/>rozdíl < 100 Kč?]
    L --> N[Uložit ProofAnalysis]
    M --> N
    
    style A fill:#e1f5fe
    style E fill:#fff3e0
    style I fill:#fff3e0
    style L fill:#ffcdd2
    style N fill:#c8e6c9
```

---

## 7. Dashboard flow

```mermaid
flowchart TD
    A[Dashboard load] --> B[Načtení proofů<br/>s filtry]
    B --> C[Pro každý proof]
    C --> D[Spočítat součet faktur]
    D --> E[Načíst poslední analýzu]
    E --> F[Vypočítat remaining]
    F --> G{Další proof?}
    G -->|Ano| C
    G -->|Ne| H[Sestavit response]
    H --> I[DashboardSummary list]
    
    style A fill:#e1f5fe
    style I fill:#c8e6c9
```
