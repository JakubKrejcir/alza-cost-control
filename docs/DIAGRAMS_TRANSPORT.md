# Procesní diagramy - DOPRAVA / LOGISTIKA

## 1. Hlavní tok zboží

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
    
    style A fill:#e3f2fd
    style B fill:#e3f2fd
    style C fill:#fff3e0
    style D fill:#f3e5f5
    style E fill:#f3e5f5
    style F fill:#e8f5e9
    style G fill:#c8e6c9
    style H fill:#c8e6c9
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
        D --> E[Rozdělení do 23 dodávek]
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

## 4. Spojené trasy (LH_SD_SPOJENE)

```mermaid
flowchart TD
    subgraph PLAN ["📋 Původní plán"]
        A[Trasa SD-A<br/>80 zastávek] 
        B[Trasa SD-B<br/>75 zastávek]
    end
    
    subgraph REALITA ["✨ Optimalizace"]
        C[Spojená trasa<br/>SD-A + SD-B<br/>155 zastávek]
    end
    
    A --> C
    B --> C
    
    subgraph VYSLEDEK ["💰 Výsledek"]
        D[Úspora 1 vozidla]
        E[Úspora řidiče]
        F[Delší pracovní doba]
    end
    
    C --> D
    C --> E
    C --> F
    
    style C fill:#c8e6c9
```

---

## 5. DEPO operace

```mermaid
flowchart TD
    subgraph PRIJEZD ["🚛 Příjezd linehaulu"]
        A[Kamion 1 přijíždí] --> B[Vyložení 33 palet]
        C[Kamion 2 přijíždí] --> D[Vyložení 33 palet]
    end
    
    subgraph TRIDENI ["📦 Třídění"]
        B --> E[Třídění podle tras]
        D --> E
        E --> F[Trasa A]
        E --> G[Trasa B]
        E --> H[...]
        E --> I[Trasa W]
    end
    
    subgraph NAKLADKA ["🚐 Nakládka"]
        F --> J[Dodávka A]
        G --> K[Dodávka B]
        H --> L[...]
        I --> M[Dodávka W]
    end
    
    subgraph ODJEZD ["🚀 Odjezd"]
        J --> N[Rozvoz trasy A]
        K --> O[Rozvoz trasy B]
        L --> P[...]
        M --> Q[Rozvoz trasy W]
    end
    
    style E fill:#f3e5f5
```

---

## 6. Časová osa dne

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

## 8. Struktura nákladů

```mermaid
pie showData
    title Struktura měsíčních nákladů (příklad Drivecool)
    "FIX za trasy" : 2500000
    "Kilometry" : 800000
    "Linehaul" : 600000
    "DEPO Vratimov" : 180000
    "DEPO Nový Bydžov" : 590000
    "Bonus/Malus" : 50000
```

---

## 9. Typy vozidel

```mermaid
flowchart TD
    subgraph KAMION ["🚛 Kamion"]
        A[Kapacita: 33 palet]
        B[Použití: Linehaul]
        C[Cena: ~24 000 Kč/jízda]
    end
    
    subgraph SOLO ["🚚 Sólo"]
        D[Kapacita: 15-21 palet]
        E[Použití: Linehaul/Posily]
        F[Cena: ~16 500 Kč/jízda]
    end
    
    subgraph DODAVKA ["🚐 Dodávka"]
        G[Kapacita: 8-10 palet]
        H[Použití: Last mile]
        I[Cena: ~10 100 Kč/jízda]
    end
```

---

## 10. Bonusový systém (Nový Bydžov)

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
