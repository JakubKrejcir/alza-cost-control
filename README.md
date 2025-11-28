# Alza Cost Control

Aplikace pro kontrolu nákladů na dopravu – porovnání proofů od dopravců s fakturami a ceníky ze smluv.

## Architektura

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Frontend     │────▶│     Backend     │────▶│    Database     │
│   (React/Vite)  │     │ (Node/Express)  │     │  (PostgreSQL)   │
│    Railway      │     │    Railway      │     │    Railway      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Tech Stack

**Frontend:**
- React 18 + Vite
- TailwindCSS
- React Query (TanStack)
- React Router
- Lucide Icons

**Backend:**
- Node.js + Express
- Prisma ORM
- PostgreSQL

## Deployment na Railway

### 1. Vytvoř Railway účet
1. Jdi na [railway.app](https://railway.app)
2. Přihlas se přes GitHub

### 2. Vytvoř nový projekt
1. "New Project" → "Empty Project"
2. Pojmenuj ho "alza-cost-control"

### 3. Přidej PostgreSQL databázi
1. V projektu klikni "+ New" → "Database" → "PostgreSQL"
2. Railway automaticky vytvoří databázi a connection string

### 4. Nahraj Backend
1. "+ New" → "GitHub Repo" nebo "Empty Service"
2. Nastav root directory: `/backend`
3. Přidej environment variables:
   ```
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   NODE_ENV=production
   PORT=3001
   FRONTEND_URL=https://tvoje-frontend-url.railway.app
   ```
4. Build command: `npm install && npx prisma generate && npx prisma migrate deploy`
5. Start command: `npm start`

### 5. Nahraj Frontend
1. "+ New" → "GitHub Repo" nebo "Empty Service"
2. Nastav root directory: `/frontend`
3. Přidej environment variables:
   ```
   VITE_API_URL=https://tvoje-backend-url.railway.app/api
   ```
4. Build command: `npm install && npm run build`
5. Start command: `npx serve dist -s`

### 6. Inicializace databáze
Po prvním deploymentu backendu spusť v Railway shell:
```bash
npx prisma migrate deploy
```

## Lokální vývoj

### Prerequisites
- Node.js 18+
- PostgreSQL (nebo Docker)

### Backend
```bash
cd backend
cp .env.example .env
# Uprav .env s tvým DATABASE_URL
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Aplikace běží na:
- Frontend: http://localhost:5173
- Backend: http://localhost:3001

## Struktura projektu

```
alza-cost-control/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma    # Datový model
│   ├── src/
│   │   ├── index.js         # Express server
│   │   └── routes/          # API endpoints
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/      # React komponenty
│   │   ├── pages/           # Stránky
│   │   ├── lib/             # API klient
│   │   └── styles/          # CSS
│   ├── package.json
│   └── vite.config.js
└── README.md
```

## API Endpoints

### Carriers
- `GET /api/carriers` - Seznam dopravců
- `POST /api/carriers` - Vytvořit dopravce
- `PUT /api/carriers/:id` - Upravit dopravce
- `DELETE /api/carriers/:id` - Smazat dopravce

### Proofs
- `GET /api/proofs` - Seznam proofů
- `POST /api/proofs/upload` - Nahrát proof (XLSX)
- `GET /api/proofs/:id` - Detail proofu

### Invoices
- `GET /api/invoices` - Seznam faktur
- `POST /api/invoices/upload` - Nahrát fakturu (PDF)
- `POST /api/invoices/:id/match` - Spárovat s proofem

### Prices
- `GET /api/prices` - Seznam ceníků
- `GET /api/prices/active` - Aktivní ceník pro období
- `POST /api/prices` - Vytvořit ceník

### Analysis
- `POST /api/analysis/proof/:id` - Analyzovat proof
- `GET /api/analysis/dashboard` - Dashboard summary

## Dopravci v systému

### Drivecool
- **Dodatek č. 7** (od 1.4.2025) - AlzaBox
- **Dodatek č. 8** (od 1.6.2025) - Třídírna
- **Dodatek č. 9** (od 1.7.2025) - AlzaBox posily
- **Dodatek č. 12** (od 1.10.2025) - Depo Nový Bydžov
- **Dodatek č. 13** (od 1.11.2025) - DROP 2.0

## Licence

Proprietary - Alza.cz a.s.
