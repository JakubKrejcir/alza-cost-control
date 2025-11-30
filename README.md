# Alza Cost Control

Aplikace pro kontrolu nákladů na dopravu – porovnání proofů od dopravců s fakturami.

## Architektura

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Frontend     │────▶│    Backend      │────▶│   PostgreSQL    │
│  React + Vite   │     │    FastAPI      │     │    Railway      │
│    Railway      │     │    Railway      │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Struktura repozitáře

```
alza-cost-control/
├── backend/           # Python FastAPI API
│   ├── app/
│   │   ├── main.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   └── routers/
│   └── requirements.txt
├── frontend/          # React SPA
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   └── lib/
│   └── package.json
└── README.md
```

## Funkce

### MVP (aktuální)
- ✅ Správa dopravců
- ✅ Nahrávání XLSX proofů s automatickým parsováním
- ✅ Nahrávání PDF faktur s automatickým parsováním
- ✅ Nahrávání PDF smluv s extrakcí ceníků
- ✅ Dashboard s přehledem proof vs faktury
- ✅ Historie období

### Plánované
- 📋 Rozšíření na více dopravců
- 📋 Automatická kontrola ceníků
- 📋 Reporting a exporty
- 📋 Notifikace

## Deployment

Obě části běží na **Railway**:

1. **Backend**: Auto-deploy z `/backend` při push do `main`
2. **Frontend**: Auto-deploy z `/frontend` při push do `main`

### Environment Variables

**Backend (Railway):**
- `DATABASE_URL` – automaticky z Railway PostgreSQL addon

**Frontend (Railway):**
- `VITE_API_URL` – URL backend API (např. `https://backend.railway.app/api`)

## Vývoj

Viz README v jednotlivých složkách:
- [Backend README](./backend/README.md)
- [Frontend README](./frontend/README.md)
