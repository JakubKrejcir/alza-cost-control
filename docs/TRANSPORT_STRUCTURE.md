# Struktura doprav AlzaBox

> ⚠️ **DŮLEŽITÉ**: Tato dokumentace je klíčová pro správné fungování aplikace.
> Před jakoukoliv změnou VŽDY konzultovat s vlastníkem projektu!

## Přehled logistického toku

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        EXPEDIČNÍ SKLADY (okolí Prahy)                       │
│                                                                             │
│   CZLC4 (Chrášťany)     LCU (Úžice)      CZTC1/LCZ (Zdiby)                 │
│   Hlavní sklad          XL zboží         Třídírna + Sklad                  │
│   50.05°N, 14.26°E      50.25°N, 14.37°E  50.18°N, 14.45°E                 │
└───────────┬─────────────────┬─────────────────┬─────────────────────────────┘
            │                 │                 │
            │ LINEHAUL        │ LINEHAUL        │ DIRECT
            │ (kamion/sólo)   │ (kamion/sólo)   │ (dodávka přímo)
            │                 │                 │
            ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ROZVOZOVÁ DEPA                                    │
│                                                                             │
│   Vratimov          Nový Bydžov        Brno           Č. Budějovice        │
│   (Drivecool)       (Drivecool)        (GEM)          (Lantaron)           │
│   49.77°N, 18.31°E  50.25°N, 15.50°E   -              -                    │
│                                                                             │
│   Rakovník                                                                  │
│   (Zítek)                                                                   │
└───────────┬─────────────────┬─────────────────┬─────────────────────────────┘
            │                 │                 │
            │ ROZVOZ          │ ROZVOZ          │ ROZVOZ
            │ (dodávky)       │ (dodávky)       │ (dodávky)
            ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AlzaBoxy                                       │
│   Moravskoslezsko   Vých. Čechy      Jižní Morava    Jižní Čechy           │
│                     Liberecko                                               │
│                     Pardubicko                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Expediční sklady

Všechny expediční sklady jsou v okolí Prahy (~20 km).

| Kód | Název | Lokace | GPS | Typ zboží |
|-----|-------|--------|-----|-----------|
| **CZLC4** | Chrášťany | Západ od Prahy | 50.0517°N, 14.2604°E | Hlavní sklad - běžné zboží |
| **LCU** | Úžice | Sever od Prahy | 50.2516°N, 14.3688°E | XL zboží (nadrozměrné) |
| **CZTC1** | Zdiby | Sever od Prahy | 50.1788°N, 14.4452°E | Třídírna |
| **LCZ** | Zdiby | Sever od Prahy | 50.1788°N, 14.4452°E | Sklad (stejná budova jako CZTC1) |

### Mapování názvů v plánovacích souborech

| Název v plánu | Expediční sklad |
|---------------|-----------------|
| "Depo Chrášťany" | CZLC4 |
| "Třídírna" | CZTC1 |

---

## 2. Rozvozová depa

| Depo | Provozovatel | GPS | Rozvozová oblast | Služby |
|------|--------------|-----|------------------|--------|
| **Vratimov** | Drivecool | 49.7707°N, 18.3076°E | Moravskoslezsko | AlzaBox, XL |
| **Nový Bydžov** | Drivecool | 50.2474°N, 15.4960°E | Hradecko, Liberecko, Pardubicko, Ústecko | AlzaBox, XL |
| **Brno** | GEM | - | Jižní Morava | AlzaBox, XL |
| **České Budějovice** | Lantaron | - | Jižní Čechy | AlzaBox |
| **Rakovník** | Zítek | - | Západní Čechy | AlzaBox |
| **Plzeň** | ? | - | Západní Čechy | XL pouze |
| **Přerov** | ? | - | Střední Morava | XL pouze |

### Mapování názvů v plánovacích souborech

| Název v plánu | Rozvozové depo |
|---------------|----------------|
| "Depo Drivecool" | Vratimov |
| "Depo Nový Bydžov" | Nový Bydžov |
| "Depo GEM" | Brno |
| "Depo Hosín" | České Budějovice |
| "Depo_Západ" | Rakovník |

---

## 3. Typy tras

### 3.1 DIRECT trasy

Dodávka jede **přímo z expedičního skladu** k AlzaBoxům bez mezitřídění na depu.

| Typ | Start | FIX sazba | Použití |
|-----|-------|-----------|---------|
| **DIRECT Praha** | CZLC4 nebo CZTC1 | 3 200 Kč | Urgentní zásilky, Praha a okolí, nebo vzdálené regiony |

**Identifikace v plánu:**
- `Startovní místo` = "Depo Chrášťany" nebo "Třídírna"
- `DR/LH` obsahuje "DR" (např. "DR", "DR-DR", "DR-DR-DR")

### 3.2 VIA LINEHAUL trasy

Zboží jede **linehaulem na depo**, kde se přetřídí, a pak dodávky rozvážejí.

| Typ | Start | FIX sazba | Použití |
|-----|-------|-----------|---------|
| **DIRECT Vratimov** | Depo Vratimov | 2 500 Kč | Standardní rozvoz Moravskoslezsko |
| **DIRECT Nový Bydžov** | Depo Nový Bydžov | TBD | Standardní rozvoz vých. Čechy |

**Identifikace v plánu:**
- `Startovní místo` = "Depo Drivecool", "Depo Nový Bydžov", "Depo GEM", atd.
- `DR/LH` obsahuje "LH" (např. "LH-", "-LH", "LH-LH")

---

## 4. Sloupec DR/LH - význam a počítání trips

### 4.1 Základní pravidla

| Hodnota | Popis | Počet trips (DPO+SD) | Linehaul |
|---------|-------|----------------------|----------|
| **DR** | Direct 1x denně | 1 (1 DPO + 0 SD) | Ne |
| **DR-DR** | Direct 2x denně | 2 (1 DPO + 1 SD) | Ne |
| **DR-DR-DR** | Direct 3x denně | 3 (1 DPO + 2 SD) | Ne |
| **LH** | Linehaul 1x denně | 1 (1 DPO + 0 SD) | Ano |
| **LH-LH** | Linehaul 2x denně | 1 (1 DPO + 0 SD) | Ano |
| **LH-LH-LH** | Linehaul 3x denně | 1 (1 DPO + 0 SD) | Ano |

### 4.2 Klíčové pravidlo: DR vs LH

> ⚠️ **DŮLEŽITÉ**: DR patterny se NÁSOBÍ (DR-DR = 2 trips), ale LH patterny se NENÁSOBÍ (LH-LH = 1 trip)!

**Proč?**
- DR (Direct) = každá jízda je samostatná rozvozová trasa
- LH (Linehaul) = linehaul je pouze přeprava na depo, počet linehauls se počítá z jiného zdroje

### 4.3 Příklady výpočtů

**Soubor: Drivecool 25-09-05.xlsx (23 tras)**

| Typ tras | Počet | DR/LH pattern | DPO | SD | Trips celkem |
|----------|-------|---------------|-----|-----|--------------|
| LH trasy | 17 | LH, LH-LH | 17 | 0 | 17 |
| DR-DR trasy | 6 | DR-DR | 6 | 6 | 12 |
| **Celkem** | **23** | - | **23** | **6** | **29** |

### 4.4 Implementace count_trips()

```python
def count_trips(dr_lh: str, plan_type: str = 'BOTH') -> int:
    """
    Počítá trips z DR/LH sloupce.
    
    PRAVIDLA:
    - DR pattern se násobí: DR=1, DR-DR=2, DR-DR-DR=3
    - LH pattern se NENÁSOBÍ: LH=1, LH-LH=1, LH-LH-LH=1
    - Pro separátní plány (DPO/SD) vždy vrací 1
    """
    if not dr_lh:
        return 1
    
    # Separátní plány - vždy 1 trip
    if plan_type in ('DPO', 'SD'):
        return 1
    
    dr_lh_upper = dr_lh.upper().strip()
    
    # Počítej pouze DR patterny (LH se nenásobí!)
    dr_count = dr_lh_upper.count('DR')
    
    return max(dr_count, 1)
```

---

## 5. Dopravci a jejich oblasti

### 5.1 Praha a Střední Čechy (DIRECT z CZLC4/CZTC1)

| Dopravce | Startovní místo | Trasy |
|----------|-----------------|-------|
| FADvořáček | Depo Chrášťany | Praha A-Z |
| Seeingmore | Depo Chrášťany | Praha D, G, K |
| ASEN | Depo Chrášťany | Praha B, BB |
| Slezák | Depo Chrášťany | Praha H |
| L-CarCare | Depo Chrášťany | Střední Čechy B-ZC |
| Zítek | Depo Chrášťany | Střední Čechy A-ZB |
| Zítek | Třídírna | Praha_STČ A-J |
| Fismo | Třídírna | Praha_STČ K-T |
| Davcol | Třídírna | Praha_STČ AB-AU |
| DoDo | Depo Chrášťany | Praha (některé) |

### 5.2 Moravskoslezsko (Depo Vratimov)

| Dopravce | Typ | Trasy |
|----------|-----|-------|
| Drivecool | VIA LINEHAUL | Moravskoslezsko A-Q |
| Drivecool | DIRECT Praha | Moravskoslezsko R-W (urgentní, z Chrášťan) |

### 5.3 Východní Čechy (Depo Nový Bydžov)

| Dopravce | Typ | Trasy |
|----------|-----|-------|
| Drivecool | VIA LINEHAUL | Liberecko, Pardubicko, Ústecko |
| Asen | VIA LINEHAUL | Hradecko, Liberecko, Pardubicko |

### 5.4 Jižní Morava (Depo Brno)

| Dopravce | Typ | Trasy |
|----------|-----|-------|
| GEM | VIA LINEHAUL | Morava A-Z |

### 5.5 Jižní Čechy (Depo Hosín / Č. Budějovice)

| Dopravce | Typ | Trasy |
|----------|-----|-------|
| Lantaron | VIA LINEHAUL | Jižní Čechy A-O |

### 5.6 Západní Čechy (Depo Rakovník)

| Dopravce | Typ | Trasy |
|----------|-----|-------|
| Zítek | VIA LINEHAUL | Západní Čechy A-Z |

---

## 6. Detekce depa z názvu trasy

```python
def detect_depot_from_route_name(route_name: str) -> str:
    """Detekuje depo z názvu trasy."""
    route_upper = route_name.upper()
    
    if "MORAVSKOSLEZSKO" in route_upper:
        return "VRATIMOV"
    elif "HRADECKO" in route_upper:
        return "NOVY_BYDZOV"
    elif "LIBERECKO" in route_upper:
        return "NOVY_BYDZOV"
    elif "PARDUBICKO" in route_upper:
        return "NOVY_BYDZOV"
    elif "ÚSTECKO" in route_upper or "USTECKO" in route_upper:
        return "NOVY_BYDZOV"
    elif "MORAVA" in route_upper:  # Bez "MORAVSKOSLEZSKO"
        return "BRNO"
    elif "JIŽNÍ ČECHY" in route_upper or "JIZNI CECHY" in route_upper:
        return "CESKE_BUDEJOVICE"
    elif "ZÁPADNÍ ČECHY" in route_upper or "ZAPADNI CECHY" in route_upper:
        return "RAKOVNIK"
    elif "PRAHA" in route_upper or "STŘEDNÍ ČECHY" in route_upper:
        return "DIRECT"  # Přímo z expedičního skladu
    else:
        return "UNKNOWN"
```

---

## 7. Detekce typu trasy ze startovního místa

```python
def get_route_type(startovni_misto: str) -> str:
    """Určuje typ trasy podle startovního místa."""
    
    # DIRECT = přímo z expedičního skladu
    if startovni_misto in ["Depo Chrášťany", "Třídírna"]:
        return "DIRECT"
    
    # VIA LINEHAUL = z rozvozového depa
    # Depo Drivecool, Depo Nový Bydžov, Depo GEM, Depo Hosín, Depo_Západ
    else:
        return "VIA_LINEHAUL"


def get_warehouse_from_start(startovni_misto: str) -> str:
    """Mapuje startovní místo na kód skladu/depa."""
    
    mapping = {
        "Depo Chrášťany": "CZLC4",
        "Třídírna": "CZTC1",
        "Depo Drivecool": "VRATIMOV",
        "Depo Nový Bydžov": "NOVY_BYDZOV",
        "Depo GEM": "BRNO",
        "Depo Hosín": "CESKE_BUDEJOVICE",
        "Depo_Západ": "RAKOVNIK",
    }
    
    return mapping.get(startovni_misto, "UNKNOWN")
```

---

## 8. Služby Alzy

| Služba | Směr | Popis |
|--------|------|-------|
| **AlzaBox** | Ven | Sklady → AlzaBoxy (doručení zákazníkům) |
| **DROP 2.0 (AlzaTrade)** | Dovnitř | Dodavatelé → Třídírna (svoz zboží) |
| **XL** | Ven | Nadrozměrné zásilky (ze skladu LCU) |

---

## 9. Ceníková struktura (příklad Drivecool)

### 9.1 FIX sazby (rozvozové trasy)

| Typ trasy | Sazba | Kdy se používá |
|-----------|-------|----------------|
| DIRECT Praha | 3 200 Kč | Start z Chrášťan/Třídírny |
| DIRECT Vratimov | 2 500 Kč | Start z depa Vratimov |

### 9.2 KM sazby

| Typ | Sazba |
|-----|-------|
| Všechny rozvozové trasy | 10,97 Kč/km |

### 9.3 Linehaul sazby

| Odkud | Kam | Vůz | Kapacita | Sazba |
|-------|-----|-----|----------|-------|
| CZLC4 | Vratimov | Kamion | 33 pal | 24 180 Kč |
| CZLC4 | Vratimov | Sólo | 18-21 pal | 16 500 Kč |
| CZLC4 | Vratimov | Dodávka | 8-10 pal | 10 100 Kč |
| CZTC1 | Vratimov | Kamion | 33 pal | 22 000 Kč |
| CZTC1 | Vratimov | Sólo | 15-18 pal | 14 800 Kč |
| CZTC1 | Vratimov | Dodávka | 8-10 pal | 9 100 Kč |
| LCU | Nový Bydžov | Kamion | - | 9 500 - 10 500 Kč |
| LCU | Nový Bydžov | Sólo | - | 7 500 - 8 000 Kč |
| LCU | Nový Bydžov | Dodávka | - | 5 000 - 5 500 Kč |

### 9.4 DEPO sazby

| Depo | Typ | Sazba |
|------|-----|-------|
| Vratimov | Hodinová | 850 Kč/hod |
| Nový Bydžov | Měsíční ALL IN | 410 000 Kč/měs |
| Nový Bydžov | Měsíční (sleva) | 396 000 Kč/měs |
| Nový Bydžov | Skladníci 4x | 194 800 Kč/měs |
| Nový Bydžov | Brigádník | 1 600 Kč/den |

### 9.5 Bonusy (kvalita doručení)

| Kvalita | Bonus |
|---------|-------|
| ≥ 98% | +35 600 Kč |
| 97,51-97,99% | +30 000 Kč |
| 97,01-97,50% | +24 000 Kč |

### 9.6 DROP 2.0 sazby

| Trasa | Sazba |
|-------|-------|
| Trasy A-I | 8 500 Kč/vozidlo |
| Dopoledne | 8 500 Kč |
| Sobota | 8 500 Kč |
| Posila C,D,H | 11 600 Kč |

---

## 10. Párování plán → ceník

### Algoritmus

```python
def calculate_planned_cost(route: RoutePlanRoute, prices: PriceConfig) -> dict:
    """Vypočítá plánované náklady pro trasu."""
    
    result = {
        "fix": Decimal("0"),
        "km": Decimal("0"),
        "linehaul": Decimal("0"),
        "total": Decimal("0"),
    }
    
    # 1. Určit typ trasy
    route_type = get_route_type(route.start_location)
    
    # 2. Najít FIX sazbu
    if route_type == "DIRECT":
        fix_rate = prices.get_fix_rate("DIRECT_PRAHA")  # 3200 Kč
    else:
        depot = detect_depot_from_route_name(route.route_name)
        fix_rate = prices.get_fix_rate(f"DIRECT_{depot}")  # 2500 Kč
    
    # 3. Spočítat počet jízd z DR/LH
    # DR pattern se násobí: DR=1, DR-DR=2, DR-DR-DR=3
    # LH pattern se NENÁSOBÍ: LH=1, LH-LH=1
    trips = count_trips(route.dr_lh, plan_type)
    
    result["fix"] = fix_rate * trips
    
    # 4. KM sazba
    km_rate = prices.get_km_rate()  # 10.97 Kč/km
    result["km"] = km_rate * route.total_distance_km * trips
    
    # 5. Linehaul (pouze pro VIA LINEHAUL trasy)
    if route_type == "VIA_LINEHAUL" and "LH" in route.dr_lh:
        linehaul_count = count_linehauls(route.dr_lh)
        linehaul_rate = prices.get_linehaul_rate(...)  # Podle warehouse a vehicle
        result["linehaul"] = linehaul_rate * linehaul_count
    
    result["total"] = result["fix"] + result["km"] + result["linehaul"]
    
    return result
```

---

## 11. Dopravci a aliasy

### 11.1 Problém s názvy dopravců

Smlouvy obsahují **oficiální názvy** jako "ASEN Logistic Group s.r.o.", ale plánovací soubory používají **zkrácené aliasy** jako "Asen".

### 11.2 Mapování dopravců

| ID | Oficiální název (smlouva) | Alias (Excel) | Depo |
|----|---------------------------|---------------|------|
| 1 | Drivecool | Drivecool | Vratimov, Nový Bydžov |
| 2 | FA Dvořáček s.r.o. | FADvořáček | - |
| 3 | ASEN Logistic Group s.r.o. | Asen | Depo Východ |
| 4 | L Car Care s.r.o. | L-CarCare | - |
| 6 | GEM | GEM | Brno |
| 7 | Zítek | Zítek | Rakovník |
| 8 | Lantaron | Lantaron | České Budějovice |
| 10 | Fismo | Fismo | TC1 |
| 11 | Davcol | Davcol | TC1 |

### 11.3 Matching v plánovacích souborech

Při importu plánovacích souborů se dopravce hledá:
1. Nejprve podle **alias** (přesná shoda, case-insensitive)
2. Pokud nenalezeno, podle **name**

```
Excel soubor: "Asen_Depo_Vy_chod_25-11-21.xlsx"
                ↓
Název dopravce z Excelu: "Asen"
                ↓
Hledání v DB: alias = 'asen' OR name = 'asen'
                ↓
Nalezeno: id=3 (ASEN Logistic Group s.r.o.)
```

### 11.4 Správa aliasů

Aliasy se spravují v UI aplikace:
- **Dopravci** → klik na dopravce → pole "Alias"
- Při vytvoření dopravce ze smlouvy se alias automaticky navrhne

---

## Historie změn

| Datum | Změna | Autor |
|-------|-------|-------|
| 2025-12-05 | Vytvoření dokumentace | Claude |
| 2025-12-09 | Přidána sekce 11 - Dopravci a aliasy | Claude |
| 2025-12-09 | Oprava sekce 4 - logika počítání trips (DR vs LH) | Claude |

---

> **Poznámka**: Tato dokumentace byla vytvořena na základě analýzy plánovacích souborů
> a ceníků z dodatků smluv. Před implementací změn vždy ověřit s vlastníkem projektu.
