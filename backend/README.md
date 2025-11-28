# Alza Cost Control - Python Backend

FastAPI backend pro kontrolu nákladů na dopravu.

## Tech Stack

- **FastAPI** - moderní async Python web framework
- **SQLAlchemy 2.0** - async ORM
- **PostgreSQL** - databáze
- **pdfplumber** - parsování PDF faktur
- **openpyxl** - parsování XLSX proofů

## Lokální vývoj

```bash
# Vytvoř virtuální prostředí
python -m venv venv
source venv/bin/activate  # Linux/Mac
# nebo: venv\Scripts\activate  # Windows

# Instalace závislostí
pip install -r requirements.txt

# Zkopíruj .env
cp .env.example .env
# Uprav DATABASE_URL v .env

# Spusť server
uvicorn app.main:app --reload --port 3001
```

## API Dokumentace

Po spuštění serveru je dostupná na:
- Swagger UI: http://localhost:3001/docs
- ReDoc: http://localhost:3001/redoc

## Struktura

```
app/
├── main.py          # FastAPI aplikace
├── database.py      # SQLAlchemy konfigurace
├── models.py        # Databázové modely
├── schemas.py       # Pydantic schémata
└── routers/
    ├── carriers.py  # API dopravců
    ├── depots.py    # API dep
    ├── contracts.py # API smluv
    ├── prices.py    # API ceníků
    ├── proofs.py    # API proofů (XLSX upload)
    ├── invoices.py  # API faktur (PDF upload)
    └── analysis.py  # API analýz
```

## Deploy na Railway

1. Pushni tento kód do GitHub repo
2. Na Railway vytvoř nový service z tohoto repo
3. Nastav environment variables:
   - `DATABASE_URL` - connection string k PostgreSQL
   - `FRONTEND_URL` - URL frontendu pro CORS

Railway automaticky detekuje Python a použije `requirements.txt`.

## Migrace z Node.js

Tento backend je přepsaný z Node.js/Express/Prisma. Hlavní změny:

- Prisma → SQLAlchemy 2.0 (async)
- Express → FastAPI
- pdf-parse → pdfplumber (lepší pro české faktury)
- xlsx → openpyxl

API endpointy zůstávají stejné, frontend nevyžaduje změny.
