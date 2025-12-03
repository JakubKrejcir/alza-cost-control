# Procesní diagramy - APLIKACE

> **Verze:** 3.0.0  
> **Aktualizace:** Prosinec 2025 - nová struktura UI

---

## 0. Přehled aplikace

### Struktura navigace

```mermaid
flowchart LR
    subgraph NAV ["📱 NAVIGACE"]
        A[Fakturace]
        B[Ceníky]
        C[Dokumenty]
        D[Dopravci]
    end
    
    A --> A1[Dashboard]
    A --> A2[Historie 12 měsíců]
    B --> B1[Ceníky dle depa]
    B --> B2[Seznam smluv]
    C --> C1[Upload proofů]
    C --> C2[Upload faktur]
    C --> C3[Upload plánů]
    D --> D1[Správa dopravců]
    
    style A fill:#e3f2fd
    style B fill:#fff3e0
    style C fill:#e8f5e9
    style D fill:#f3e5f5
```

### Budoucí rozšíření

```mermaid
flowchart TD
    subgraph CURRENT ["✅ MVP"]
        A[1 dopravce]
        B[1 typ dopravy]
        C[1 země]
    end
    
    subgraph FUTURE ["🔜 Budoucnost"]
        D[Více dopravců]
        E[ALZABOX / BRANCH / PARCEL / TRANSFER]
        F[CZ / SK / HU / AT / DE]
    end
    
    A --> D
    B --> E
    C --> F
```

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
    A[📄 XLSX + dopravce + období] --> B{Detekce formátu}
    B -->|Září 2025| C[Starý formát<br/>2 sloupce/den]
    B -->|Říjen 2025+| D[Nový formát<br/>4 sloupce/den]
    C --> E[Parsování bez DPO/SD]
    D --> F[Parsování s DPO/SD + depo]
    E --> G[Extrakce totals]
    F --> G
    G --> G1[total_fix]
    G --> G2[total_km]
    G --> G3[total_linehaul]
    G --> G4[total_depo]
    G --> G5[total_penalty]
    G --> G6[total_posily]
    G --> G7[grand_total]
    G1 & G2 & G3 & G4 & G5 & G6 & G7 --> H[Extrakce denního rozpadu]
    H --> I{Existuje proof<br/>pro období?}
    I -->|Ano| J[Smazat starý]
    I -->|Ne| K[Pokračovat]
    J --> K
    K --> L[✅ Uložit Proof + details]
    
    style A fill:#e1f5fe
    style L fill:#c8e6c9
```

**Dual-format podpora:**
- Automatická detekce podle struktury hlavičky
- Dynamické hledání sloupců s hodnotami

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

## 5. Dashboard - Fakturace

```mermaid
flowchart TD
    A[Dashboard load] --> B[Načtení proofu za období]
    B --> C[Načtení faktur za období]
    C --> D[Načtení denního rozpadu]
    
    subgraph CARDS ["📊 Summary Cards"]
        E1[Box Faktury<br/>Celkem + seznam]
        E2[Box Proof<br/>Celkem + rozpad]
        E3[Box Faktury vs Proof<br/>Rozdíl]
        E4[Box Plán vs Proof<br/>Dny s rozdílem]
    end
    
    D --> CARDS
    
    subgraph TABLE ["📅 Denní breakdown"]
        F1[Tabulka po dnech]
        F2[Plán vs Skutečnost]
        F3[Per depo: Vratimov/Bydžov]
    end
    
    CARDS --> TABLE
    
    subgraph HISTORY ["📜 Historie"]
        G1[Posledních 12 měsíců]
        G2[Status per období]
    end
    
    TABLE --> HISTORY
    
    style A fill:#e1f5fe
    style CARDS fill:#e8f5e9
    style TABLE fill:#fff3e0
    style HISTORY fill:#f3e5f5
```

---

## 6. Porovnání plán vs. proof

```mermaid
flowchart TD
    A[Výběr období] --> B[Načtení aktivních plánů]
    B --> C[Načtení proofu s denním rozpadem]
    C --> D[Pro každý den v měsíci]
    D --> E[Porovnání plán vs skutečnost]
    
    subgraph COMPARE ["Porovnání"]
        E --> F[DPO: plánováno vs odjeto]
        E --> G[SD: plánováno vs odjeto]
        E --> H[Per depo: Vratimov, Bydžov]
    end
    
    F & G & H --> I[Výpočet rozdílů]
    I --> J{Rozdíly?}
    J -->|Ano| K[⚠️ Označit den]
    J -->|Ne| L[✅ Den OK]
    K --> M[Agregace: X dnů s rozdílem]
    L --> M
    M --> N[Výstup: Denní breakdown + součty]
    
    style A fill:#e1f5fe
    style K fill:#fff3e0
    style L fill:#c8e6c9
```

---

## 7. Stránka Ceníky

```mermaid
flowchart TD
    subgraph TOP ["⚠️ Nahoře"]
        A[Chybějící položky z proofu]
    end
    
    subgraph VRATIMOV ["🟣 Depo Vratimov"]
        B1[Alzaboxy z depa - Direct]
        B2[Alzaboxy z CZLC4/CZTC1 - Svozy]
        B3[Nájem depa]
    end
    
    subgraph BYDZOV ["🔵 Depo Nový Bydžov"]
        C1[Alzaboxy z depa - Direct]
        C2[Linehauly do NB]
        C3[Nájem depa + Bonusy]
    end
    
    subgraph EXTRA ["🔴 Extra služby"]
        D1[AlzaTrade 2.0 svozy]
    end
    
    subgraph BOTTOM ["📜 Dole"]
        E[Historie dodatků ke smlouvě]
    end
    
    TOP --> VRATIMOV
    VRATIMOV --> BYDZOV
    BYDZOV --> EXTRA
    EXTRA --> BOTTOM
    
    style TOP fill:#fff3e0
    style VRATIMOV fill:#f3e5f5
    style BYDZOV fill:#e0f7fa
    style EXTRA fill:#ffcdd2
```

**Badge dodatku u každé ceny:**
- `D7`, `D8`, `D9`, `D12`, `D13` = číslo dodatku
- `?` = chybí ve smlouvách

---

## 8. Stránka Dokumenty

```mermaid
flowchart TD
    subgraph UPLOAD ["📤 Upload sekce"]
        A1[Proof XLSX]
        A2[Faktura PDF]
        A3[Plán XLSX]
        A4[Smlouva PDF]
    end
    
    subgraph LIST ["📋 Seznamy"]
        B1[Nahrané proofy]
        B2[Nahrané faktury]
        B3[Nahrané plány]
    end
    
    A1 --> B1
    A2 --> B2
    A3 --> B3
```

---

## 9. API Endpoints

```mermaid
flowchart LR
    subgraph CARRIERS ["/api/carriers"]
        C1[GET /]
        C2[POST /]
        C3[GET /:id]
    end
    
    subgraph PROOFS ["/api/proofs"]
        P1[GET /]
        P2[POST /upload]
        P3[DELETE /:id]
    end
    
    subgraph INVOICES ["/api/invoices"]
        I1[GET /]
        I2[POST /upload]
        I3[DELETE /:id]
    end
    
    subgraph PLANS ["/api/route-plans"]
        R1[GET /]
        R2[POST /upload]
        R3[GET /daily-breakdown/:proof_id]
    end
    
    subgraph PRICES ["/api/prices"]
        PR1[GET /]
    end
```

---

## 10. Tech Stack

```mermaid
flowchart TD
    subgraph FRONTEND ["🖥️ Frontend"]
        F1[React 18]
        F2[Vite]
        F3[TanStack Query]
        F4[React Router]
        F5[Tailwind CSS]
        F6[Lucide Icons]
    end
    
    subgraph BACKEND ["⚙️ Backend"]
        B1[Python FastAPI]
        B2[SQLAlchemy]
        B3[Alembic]
        B4[pdfplumber]
        B5[openpyxl]
    end
    
    subgraph DB ["🗄️ Database"]
        D1[PostgreSQL]
    end
    
    subgraph DEPLOY ["🚀 Deploy"]
        DE1[Railway]
    end
    
    FRONTEND --> BACKEND
    BACKEND --> DB
    FRONTEND --> DEPLOY
    BACKEND --> DEPLOY
    DB --> DEPLOY
```

---

*Dokument aktualizován pro Transport Tycoon v3.0*
