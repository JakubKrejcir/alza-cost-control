# Procesní diagramy - DOPRAVA / LOGISTIKA

> **Verze:** 3.0.0  
> **Aktualizace:** Rozšíření o typy doprav a země

---

## 0. Přehled typů doprav a zemí

### Typy doprav Alza

```mermaid
flowchart TD
    subgraph ALZABOX ["📦 ALZABOXY"]
        A1[Samoobslužné boxy]
        A2[24/7 vyzvednutí]
        A3[Status: ✅ MVP]
    end
    
    subgraph BRANCH ["🏪 POBOČKY"]
        B1[Kamenné prodejny]
        B2[Showroomy]
        B3[Status: 🔜 Plánováno]
    end
    
    subgraph PARCEL ["📬 BALÍKOVKA"]
        C1[Doručení na adresu]
        C2[Kurýr k zákazníkovi]
        C3[Status: 🔜 Plánováno]
    end
    
    subgraph TRANSFER ["🔄 MEZISKLADY"]
        D1[Mezi sklady]
        D2[Redistribuce]
        D3[Status: 🔜 Plánováno]
    end
    
    subgraph RETURN ["↩️ VRATKY"]
        E1[Svoz vratek]
        E2[Od zákazníků]
        E3[Status: 🔜 Plánováno]
    end
    
    style A3 fill:#c8e6c9
    style B3 fill:#fff3e0
    style C3 fill:#fff3e0
    style D3 fill:#fff3e0
    style E3 fill:#fff3e0
```

### Země operací

```mermaid
flowchart LR
    subgraph EU ["🇪🇺 ALZA OPERACE"]
        CZ["🇨🇿 Česko<br/>CZK<br/>✅ MVP"]
        SK["🇸🇰 Slovensko<br/>EUR<br/>🔜"]
        HU["🇭🇺 Maďarsko<br/>HUF<br/>🔜"]
        AT["🇦🇹 Rakousko<br/>EUR<br/>🔜"]
        DE["🇩🇪 Německo<br/>EUR<br/>🔜"]
    end
    
    style CZ fill:#c8e6c9
    style SK fill:#fff3e0
    style HU fill:#fff3e0
    style AT fill:#fff3e0
    style DE fill:#fff3e0
```

---

## 1. Hlavní tok zboží (Alzaboxy CZ)

```mermaid
flowchart LR
    subgraph SKLADY ["🏭 SKLADY ALZA"]
        A[CZLC4<br/>Log. centrum]
        B[CZTC1<br/>Třídírna]
    end
    
    subgraph LINEHAUL ["🚛 LINEHAUL"]
        C[2× Kamion<br/>LH-LH]
    end
    
    subgraph DEPO ["📦 DEPO DOPRAVCE"]
        D[Vratimov<br/>denní sazba]
        E[Nový Bydžov<br/>měsíční paušál]
    end
    
    subgraph LASTMILE ["🚐 LAST MILE"]
        F[23× Dodávka]
    end
    
    subgraph DORUCENI ["📍 DORUČENÍ"]
        G[AlzaBoxy]
    end
    
    A --> C
    B --> C
    C --> D
    C --> E
    D --> F
    E --> F
    F --> G
    
    style A fill:#e3f2fd
    style B fill:#e3f2fd
    style C fill:#fff3e0
    style D fill:#f3e5f5
    style E fill:#e0f7fa
    style F fill:#e8f5e9
    style G fill:#c8e6c9
```

---

## 2. Typy rozvozů - přehled

```mermaid
flowchart TD
    subgraph DPO ["☀️ DPO - Ranní rozvoz"]
        A1[📱 Objednávka<br/>do půlnoci] --> A2[📦 Expedice<br/>po půlnoci]
        A2 --> A3[🚛 Linehaul<br/>cca 2:00-4:00]
        A3 --> A4[📦 Překládka<br/>na DEPU]
        A4 --> A5[🚐 Rozvoz<br/>od 7:00]
    end
    
    subgraph SD ["🌙 SD - Same Day"]
        B1[📱 Objednávka<br/>ráno] --> B2[📦 Expedice<br/>odpoledne]
        B2 --> B3[🚛 Linehaul<br/>cca 12:00-14:00]
        B3 --> B4[📦 Překládka<br/>na DEPU]
        B4 --> B5[🚐 Rozvoz<br/>od 16:00]
    end
    
    subgraph DR ["⚡ DR - Direct Route"]
        C1[📦 Speciální<br/>zásilka] --> C2[🚐 Přímý rozvoz<br/>ze skladu]
        C2 --> C3[📍 Doručení<br/>bez DEPA]
    end
    
    style A5 fill:#c8e6c9
    style B5 fill:#c8e6c9
    style C3 fill:#c8e6c9
```

---

## 3. Linehaul detail (LH-LH)

```mermaid
flowchart TD
    subgraph RANO ["Ranní batch (DPO)"]
        A[Sklad CZLC4/CZTC1] --> B[Kamion 1<br/>33 palet]
        A --> C[Kamion 2<br/>33 palet]
        B --> D[DEPO Vratimov]
        C --> D
        D --> E[Rozdělení do dodávek]
        E --> F[Rozvoz tras A-W]
    end
    
    subgraph ODPO ["Odpolední batch (SD)"]
        G[Sklad CZLC4/CZTC1] --> H[Kamion 1<br/>33 palet]
        G --> I[Kamion 2<br/>33 palet]
        H --> J[DEPO Vratimov]
        I --> J
        J --> K[Rozdělení do dodávek]
        K --> L[Rozvoz SD tras]
    end
    
    style D fill:#f3e5f5
    style J fill:#f3e5f5
```

**Klíčové pravidlo:** LH-LH = 2 kamiony pro CELÝ batch, NE per trasa!

---

## 4. Depa a regiony

```mermaid
flowchart TD
    subgraph VRATIMOV ["🟣 DEPO VRATIMOV"]
        V1[Moravskoslezský kraj]
        V2[Denní sazba: 5 950 Kč]
        V3[Trasy: A-W]
    end
    
    subgraph BYDZOV ["🔵 DEPO NOVÝ BYDŽOV"]
        B1[Královéhradecký kraj]
        B2[Měsíční paušál: 410 000 Kč]
        B3[+ Bonusový systém]
    end
    
    subgraph REGIONY ["Pokrytí regionů"]
        R1[MSK - Ostravsko]
        R2[OLK - Olomoucko]
        R3[ZLK - Zlínsko]
        R4[PAK - Pardubicko]
        R5[HKK - Hradecko]
        R6[LBK - Liberecko]
    end
    
    VRATIMOV --> R1
    VRATIMOV --> R2
    VRATIMOV --> R3
    BYDZOV --> R4
    BYDZOV --> R5
    BYDZOV --> R6
    
    style VRATIMOV fill:#f3e5f5
    style BYDZOV fill:#e0f7fa
```

---

## 5. Časová osa dne

```mermaid
gantt
    title Denní provoz dopravy Drivecool
    dateFormat HH:mm
    axisFormat %H:%M
    
    section DPO Linehaul
    Nakládka ve skladu     :a1, 00:00, 1h
    Jízda na DEPO          :a2, 01:00, 2h
    
    section DPO DEPO
    Vyložení kamionů       :b1, 03:00, 1h
    Třídění                :b2, 04:00, 1h
    Nakládka dodávek       :b3, 05:00, 2h
    
    section DPO Rozvoz
    Rozvoz tras A-W        :c1, 07:00, 6h
    
    section SD Linehaul
    Nakládka ve skladu     :d1, 11:00, 1h
    Jízda na DEPO          :d2, 12:00, 2h
    
    section SD DEPO
    Vyložení + třídění     :e1, 14:00, 1h
    Nakládka dodávek       :e2, 15:00, 1h
    
    section SD Rozvoz
    Rozvoz SD tras         :f1, 16:00, 5h
```

---

## 6. Struktura nákladů

```mermaid
pie showData
    title Struktura měsíčních nákladů (příklad říjen 2025)
    "FIX za trasy" : 3688000
    "Kilometry" : 3864466
    "Linehaul" : 4436120
    "DEPO" : 785893
```

---

## 7. Fakturační tok

```mermaid
flowchart LR
    subgraph MESIC ["📅 Měsíc N"]
        A[Denní rozvozy] --> B[Evidence v systému]
    end
    
    subgraph KONEC ["📊 Konec měsíce"]
        B --> C[Dopravce generuje<br/>PROOF XLSX]
    end
    
    subgraph FAKTURACE ["💰 Fakturace"]
        C --> D[Faktura FIX]
        C --> E[Faktura KM]
        C --> F[Faktura LINEHAUL]
        C --> G[Faktura DEPO]
    end
    
    subgraph KONTROLA ["✅ Kontrola Alza"]
        D --> H[Upload do systému]
        E --> H
        F --> H
        G --> H
        H --> I[Porovnání<br/>Proof vs Faktury]
        I --> J{Sedí?}
        J -->|Ano| K[✅ Schválení]
        J -->|Ne| L[❌ Reklamace]
    end
    
    style K fill:#c8e6c9
    style L fill:#ffcdd2
```

---

## 8. Typy vozidel

| Typ | Kapacita | Použití | Cena (přibližně) |
|-----|----------|---------|------------------|
| 🚛 Kamion | 33 palet | Linehaul | 22 000 - 24 180 Kč |
| 🚚 Sólo | 15-21 palet | Linehaul/Posily | 14 800 - 16 500 Kč |
| 🚐 Dodávka | 8-10 palet | Last mile | 9 100 - 10 100 Kč |
| 🚐 Dodávka 6300 | 6 palet | Last mile (menší) | 6 300 Kč |

---

## 9. Bonusový systém (Nový Bydžov)

```mermaid
flowchart TD
    A[Měsíční kvalita doručení] --> B{Procento?}
    
    B -->|≥ 98%| C[Plný bonus<br/>445 600 Kč]
    B -->|97.51-97.99%| D[Plný bonus<br/>445 600 Kč]
    B -->|97.01-97.50%| E[Snížený<br/>436 700 Kč]
    B -->|96.51-97.00%| F[Snížený<br/>427 800 Kč]
    B -->|96.01-96.50%| G[Snížený<br/>418 900 Kč]
    B -->|< 96%| H[Základ<br/>410 000 Kč]
    
    style C fill:#c8e6c9
    style D fill:#c8e6c9
    style E fill:#fff3e0
    style F fill:#fff3e0
    style G fill:#fff3e0
    style H fill:#ffcdd2
```

---

## 10. Budoucí rozšíření - další typy doprav

```mermaid
flowchart TD
    subgraph CURRENT ["✅ Aktuálně"]
        A[Alzaboxy CZ]
    end
    
    subgraph NEXT ["🔜 Další fáze"]
        B[Pobočky CZ]
        C[Balíkovka CZ]
        D[Mezisklady CZ]
    end
    
    subgraph FUTURE ["🔮 Budoucnost"]
        E[Alzaboxy SK/HU/AT/DE]
        F[Multi-dopravci]
        G[Srovnávací analýzy]
    end
    
    A --> B
    A --> C
    A --> D
    B & C & D --> E
    E --> F
    F --> G
    
    style A fill:#c8e6c9
    style B fill:#fff3e0
    style C fill:#fff3e0
    style D fill:#fff3e0
```

---

*Dokument aktualizován pro Transport Tycoon v3.0*
