# Alza Cost Control - Frontend

React SPA pro kontrolu nákladů na dopravu.

## Tech Stack

- **React 18** + Vite
- **TanStack Query** - data fetching & caching
- **React Router** - routing
- **Tailwind CSS** - styling
- **Lucide React** - ikony
- **date-fns** - práce s daty

## Deployment

Aplikace běží na **Railway**. Deploy automaticky při push do `main`.

### Environment Variables (Railway)

```
VITE_API_URL=https://<backend-app>.railway.app/api
```

## Struktura

```
src/
├── main.jsx         # Entry point
├── App.jsx          # Router setup
├── components/
│   └── Layout.jsx   # Hlavní layout + navigace
├── pages/
│   ├── Dashboard.jsx   # Přehled období
│   ├── Upload.jsx      # Nahrávání proofů/faktur
│   ├── Contracts.jsx   # Nahrávání smluv
│   ├── Prices.jsx      # Přehled ceníků
│   ├── History.jsx     # Historie období
│   └── Carriers.jsx    # Správa dopravců
├── lib/
│   └── api.js       # API client (axios)
└── styles/
    └── index.css    # Tailwind + custom komponenty
```

## Stránky

| Stránka | Popis |
|---------|-------|
| `/dashboard` | Přehled aktuálního období - proof vs faktury |
| `/upload` | Nahrávání XLSX proofů a PDF faktur |
| `/contracts` | Nahrávání PDF smluv s extrakcí ceníků |
| `/prices` | Přehled všech ceníků ze smluv |
| `/history` | Historie posledních 12 měsíců |
| `/carriers` | CRUD dopravců |

## Build

```bash
npm run build  # Výstup do /dist
```

Railway automaticky spouští `npm install && npm run build` a servíruje přes `serve`.
