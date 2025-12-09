# Carrier Alias System - Implementační instrukce

## Datum: 2025-12-09

## Přehled změn

Přidání systému aliasů pro dopravce, který umožňuje:
- Oficiální název (ze smlouvy): "FA Dvořáček s.r.o."
- Alias (pro Excel matching): "FADvořáček"

---

## 1. SQL pro Postico (spusť PRVNÍ)

```sql
-- 1. Přidat sloupec alias
ALTER TABLE "Carrier" ADD COLUMN alias VARCHAR(100);

-- 2. Nastavit aliasy pro existující dopravce
UPDATE "Carrier" SET alias = 'Drivecool' WHERE id = 1;
UPDATE "Carrier" SET alias = 'FADvořáček' WHERE id = 2;
UPDATE "Carrier" SET alias = 'Asen' WHERE id = 3;
UPDATE "Carrier" SET alias = 'L-CarCare' WHERE id = 4;
UPDATE "Carrier" SET alias = 'GEM' WHERE id = 6;
UPDATE "Carrier" SET alias = 'Zítek' WHERE id = 7;
UPDATE "Carrier" SET alias = 'Lantaron' WHERE id = 8;
UPDATE "Carrier" SET alias = 'Fismo' WHERE id = 10;
UPDATE "Carrier" SET alias = 'Davcol' WHERE id = 11;

-- 3. Smazat duplicity (prázdní dopravci)
DELETE FROM "Carrier" WHERE id IN (9, 12, 13);
```

---

## 2. Soubory k nahrání na GitHub

### Backend:
| Soubor | Popis |
|--------|-------|
| `backend/app/models.py` | Carrier model s `alias` sloupcem |
| `backend/app/schemas.py` | Carrier schémata s `alias` |
| `backend/app/routers/carriers.py` | Carriers API s `alias` v response |
| `backend/app/routers/alzabox.py` | Import s matching podle alias ✅ |
| `backend/app/carrier_matching.py` | **NOVÝ** - helper pro matching |

### Frontend:
| Soubor | Popis |
|--------|-------|
| `frontend/src/pages/Carriers.jsx` | Formulář s polem "Alias" |

### Dokumentace:
| Soubor | Popis |
|--------|-------|
| `docs/TECH_STACK.md` | Přidána sekce o Carrier Alias systému |
| `docs/TRANSPORT_STRUCTURE.md` | Přidána sekce 11, opravena sekce 4 |

---

## 3. Testování

Po nasazení:
1. Jdi do **Dopravci**
2. Ověř, že každý dopravce má alias
3. Zkus editovat dopravce a změnit alias
4. Zkus importovat AlzaBox soubor - měl by matchovat podle aliasu

---

## Shrnutí změn

| Soubor | Změna |
|--------|-------|
| DB | Nový sloupec `alias` + vyčištění duplicit |
| models.py | `alias: Mapped[Optional[str]]` |
| schemas.py | `alias` ve všech Carrier schématech |
| carriers.py | `alias` v response |
| carrier_matching.py | **NOVÝ** - helper funkce pro lookup |
| alzabox.py | Upraven pro použití helperu (verze 3.11.0) |
| Carriers.jsx | Pole pro alias ve formuláři |
| TECH_STACK.md | Nová sekce o Carrier Alias |
| TRANSPORT_STRUCTURE.md | Sekce 11 + oprava sekce 4 |
