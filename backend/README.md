# Alza Cost Control - Backend API

FastAPI backend pro kontrolu nákladů na dopravu.

## Tech Stack

- **FastAPI** - async Python web framework
- **SQLAlchemy 2.0** - async ORM
- **PostgreSQL** - databáze (Railway)
- **pdfplumber** - parsování PDF faktur
- **openpyxl** - parsování XLSX proofů

## Deployment

Aplikace běží na **Railway**. Pro deploy stačí pushnout do `main` branch.

### Environment Variables (Railway)

```
DATABASE_URL=postgresql://...  # Automaticky z Railway PostgreSQL
```

## API Dokumentace

Po deployi dostupná na:
- Swagger UI: `https://<your-app>.railway.app/docs`
- ReDoc: `https://<your-app>.railway.app/redoc`

## Struktura

```
app/
├── main.py          # FastAPI aplikace + CORS
├── database.py      # SQLAlchemy async konfigurace
├── models.py        # Databázové modely
├── schemas.py       # Pydantic schémata (camelCase pro frontend)
└── routers/
    ├── carriers.py  # CRUD dopravců
    ├── depots.py    # CRUD dep
    ├── contracts.py # Smlouvy + PDF parsing
    ├── prices.py    # Ceníky
    ├── proofs.py    # Proofy + XLSX parsing
    ├── invoices.py  # Faktury + PDF parsing
    └── analysis.py  # Analýza proof vs faktury
```

## API Endpoints

| Metoda | Endpoint | Popis |
|--------|----------|-------|
| GET | `/health` | Health check |
| GET/POST | `/api/carriers` | Seznam/vytvoření dopravců |
| GET/PUT/DELETE | `/api/carriers/{id}` | Detail dopravce |
| POST | `/api/proofs/upload` | Nahrání XLSX proofu |
| POST | `/api/invoices/upload` | Nahrání PDF faktury |
| POST | `/api/contracts/upload-pdf` | Nahrání PDF smlouvy |
| GET | `/api/analysis/dashboard` | Dashboard data |
| POST | `/api/analysis/proof/{id}` | Spustit analýzu proofu |

## Databázové migrace

Tabulky se vytvoří automaticky při prvním startu aplikace pomocí SQLAlchemy `create_all()`.

Pro produkční migrace doporučujeme Alembic (zatím neimplementováno).
