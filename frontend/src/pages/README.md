# Opravené Frontend Komponenty

Tyto soubory obsahují opravenou verzi frontend komponent, které:

1. **Zachovávají nový Figma design** (CSS variables, light theme)
2. **Vrací plnou funkcionalitu** z původních souborů

## Soubory

```
pages/
├── Dashboard.jsx    # Hlavní dashboard s přehledem
├── Documents.jsx    # Správa dokumentů (plány, proofy, faktury, smlouvy)
├── Prices.jsx       # Přehled ceníků
├── History.jsx      # Historie období
└── Carriers.jsx     # CRUD dopravců
```

## Co bylo obnoveno

### Dashboard.jsx
- ✅ Summary cards (Proof, Fakturováno, Zbývá, Plán vs Skutečnost)
- ✅ ComparisonSummary s rozpadem na depa (Vratimov, Nový Bydžov)
- ✅ View mode tabs (total, vratimov, bydzov) pro denní tabulku
- ✅ Rozšířená DailyTable se statistikami per depo
- ✅ Napojení na useCarrier() context

### Documents.jsx
- ✅ Multi-select s checkboxy pro plány, proofy, smlouvy
- ✅ Bulk delete funkcionalita
- ✅ Detailní zobrazení proofů (FIX/KM/LH/Tras breakdown)
- ✅ PlanTypeBadge a DepotBadge komponenty
- ✅ Tabs pro různé typy dokumentů
- ✅ Chytrá detekce typu souboru při uploadu

### Prices.jsx
- ✅ Historie dodatků ke smlouvě
- ✅ Ceníky AlzaBox, Třídírna, Nový Bydžov, DROP 2.0
- ✅ Bonusový systém kvality
- ✅ Upozornění na chybějící sazby

### History.jsx
- ✅ Přehled posledních 12 měsíců
- ✅ Status porovnání proof vs faktury
- ✅ Kliknutí na řádek přesměruje na dashboard s vybraným obdobím

### Carriers.jsx
- ✅ CRUD operace pro dopravce
- ✅ Přehled dep a statistik
- ✅ Modální okno pro přidání/úpravu

## Nasazení

1. Zkopírujte soubory do `frontend/src/pages/`:

```bash
cp pages/*.jsx /cesta/k/projektu/frontend/src/pages/
```

2. Ujistěte se, že máte v projektu:
   - `frontend/src/lib/CarrierContext.jsx` - kontext pro správu dopravců
   - `frontend/src/lib/api.js` - API client
   - `frontend/src/styles/index.css` - CSS s design tokens

3. Zkompilujte a otestujte:

```bash
cd frontend
npm run dev
```

## Design Tokens (CSS Variables)

Všechny komponenty používají CSS variables z Figma designu:

```css
--color-primary: #217efd
--color-purple: #895bf1
--color-green: #1ad598
--color-orange: #f9b959
--color-red: #ea3a3d
--color-cyan: #36dae9
--color-text-dark: #0b1524
--color-text-muted: #6b7a90
--color-bg: #f5f7fa
--color-card: #ffffff
```

## Poznámky

- Komponenty používají inline `style` atributy s CSS variables pro konzistentní vzhled
- Původní dark theme třídy (bg-white/5, text-gray-400) byly nahrazeny light theme barvami
- Všechny interaktivní prvky mají hover stavy
