# TransportBrain - Tech Stack

> **Verze:** 3.11.0  
> **Datum:** Prosinec 2025

---

## 🏗️ Architektura

```
┌─────────────────────────────────────────────────────────────┐
│                      RAILWAY CLOUD                          │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────┐ │
│  │ Cost_control_    │  │ Cost_control_    │  │ Postgres  │ │
│  │ frontend         │  │ backend          │  │           │ │
│  │ (React + Vite)   │  │ (FastAPI)        │  │ (DB)      │ │
│  └────────┬─────────┘  └────────┬─────────┘  └─────┬─────┘ │
│           │                     │                   │       │
│           └─────────────────────┴───────────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 Backend

### Framework & Runtime
| Technologie | Verze | Účel |
|-------------|-------|------|
| Python | 3.11+ | Runtime |
| FastAPI | 0.104+ | Web framework |
| Uvicorn | 0.24+ | ASGI server |
| Pydantic | 2.x | Validace dat |

### Databáze
| Technologie | Verze | Účel |
|-------------|-------|------|
| PostgreSQL | 15+ | Hlavní databáze |
| SQLAlchemy | 2.0+ | ORM (async) |
| asyncpg | 0.29+ | PostgreSQL driver |

### Parsování souborů
| Technologie | Účel |
|-------------|------|
| openpyxl | Excel XLSX parsing |
| pdfplumber | PDF extrakce textu |
| python-multipart | File upload handling |

### Struktura backend/
```
backend/
├── app/
│   ├── main.py              # FastAPI app + routing
│   ├── database.py          # Async SQLAlchemy session
│   ├── models.py            # SQLAlchemy ORM modely
│   └── routers/
│       ├── auth.py          # /api/auth/*
│       ├── carriers.py      # /api/carriers/*
│       ├── contracts.py     # /api/contracts/*
│       ├── prices.py        # /api/prices/*
│       ├── proofs.py        # /api/proofs/*
│       ├── invoices.py      # /api/invoices/*
│       ├── analysis.py      # /api/analysis/*
│       ├── route_plans.py   # /api/route-plans/*
│       ├── alzabox.py       # /api/alzabox/*
│       └── expected_billing.py  # /api/expected-billing/*
├── requirements.txt
└── Dockerfile
```

---

## 🎨 Frontend

### Framework & Build
| Technologie | Verze | Účel |
|-------------|-------|------|
| React | 18.x | UI framework |
| Vite | 5.x | Build tool |
| React Router | 6.x | Routing |

### State Management
| Technologie | Účel |
|-------------|------|
| React Context | Globální stav (CarrierContext) |
| TanStack Query | Server state + caching |

### UI & Styling
| Technologie | Účel |
|-------------|------|
| Tailwind CSS | Utility-first CSS |
| Lucide React | Ikony |
| Recharts | Grafy |
| date-fns | Práce s daty |

### Struktura frontend/
```
frontend/
├── src/
│   ├── main.jsx             # Entry point
│   ├── App.jsx              # Routes + CarrierProvider
│   ├── index.css            # Tailwind + CSS variables
│   ├── components/
│   │   ├── Layout.jsx       # Sidebar + TopBar + Outlet
│   │   └── LoginGate.jsx    # Auth wrapper
│   ├── pages/
│   │   ├── Dashboard.jsx    # Fakturace
│   │   ├── ExpectedBilling.jsx  # Očekávaná fakturace
│   │   ├── Prices.jsx       # Ceníky
│   │   ├── Documents.jsx    # Upload dokumentů
│   │   ├── AlzaBoxBI.jsx    # AlzaBox statistiky
│   │   └── Carriers.jsx     # Správa dopravců
│   └── lib/
│       ├── api.js           # Axios instance + API calls
│       └── CarrierContext.jsx  # Globální context
├── package.json
├── vite.config.js
└── Dockerfile
```

---

## 🗄️ Databázové modely

### Hlavní entity
```
Carrier (dopravce)
├── id, name, ico, dic, address
├── → Depot[]
├── → Contract[]
├── → PriceConfig[]
├── → Proof[]
├── → Invoice[]
└── → RoutePlan[]

Contract (smlouva/dodatek)
├── id, carrier_id, amendment_number, type
├── valid_from, valid_to
└── → PriceConfig[]

PriceConfig (ceník)
├── id, carrier_id, contract_id, type
├── valid_from, valid_to, is_active
├── → FixRate[]
├── → KmRate[]
├── → DepoRate[]
├── → LinehaulRate[]
└── → BonusRate[]

Proof (měsíční výkaz)
├── id, carrier_id, period
├── total_fix, total_km, total_linehaul, total_depo
├── → ProofRouteDetail[]
├── → ProofLinehaulDetail[]
└── → ProofDepoDetail[]

Invoice (faktura)
├── id, carrier_id, proof_id
├── invoice_number, amount_without_vat, amount_with_vat
└── → InvoiceItem[]

RoutePlan (plánovací soubor)
├── id, carrier_id, depot
├── valid_from, valid_to
├── dpo_routes_count, sd_routes_count
└── → RoutePlanRoute[]
```

### AlzaBox entity (globální - bez carrier_id)
```
AlzaBoxLocation
├── id, box_code (unique), name, city
├── latitude, longitude, carrier_code
└── → AlzaBoxDelivery[]

AlzaBoxDelivery
├── id, location_id, delivery_date
├── planned_time, actual_time
├── route_group, on_time
└── → AlzaBoxLocation
```

---

## 🌐 API Endpoints

### Auth
```
POST /api/auth/login      # Přihlášení
POST /api/auth/verify     # Ověření tokenu
POST /api/auth/logout     # Odhlášení
```

### Carriers
```
GET  /api/carriers        # Seznam dopravců
POST /api/carriers        # Vytvořit dopravce
GET  /api/carriers/{id}   # Detail dopravce
PUT  /api/carriers/{id}   # Aktualizovat
DELETE /api/carriers/{id} # Smazat
```

### Contracts
```
GET  /api/contracts            # Seznam smluv
POST /api/contracts/upload     # Upload PDF dodatku
GET  /api/contracts/{id}       # Detail
DELETE /api/contracts/{id}     # Smazat
```

### Prices
```
GET  /api/prices              # Seznam ceníků
GET  /api/prices/active       # Aktivní ceník pro období
POST /api/prices              # Vytvořit ceník
```

### Proofs
```
GET  /api/proofs              # Seznam proofů
POST /api/proofs/upload       # Upload XLSX
GET  /api/proofs/{id}         # Detail
DELETE /api/proofs/{id}       # Smazat
```

### Invoices
```
GET  /api/invoices            # Seznam faktur
POST /api/invoices/upload     # Upload PDF
GET  /api/invoices/{id}       # Detail
DELETE /api/invoices/{id}     # Smazat
```

### AlzaBox
```
GET  /api/alzabox/stats/summary     # Statistiky
POST /api/alzabox/import/locations  # Import lokací
POST /api/alzabox/import/deliveries # Import dojezdů
DELETE /api/alzabox/locations       # Smazat lokace
DELETE /api/alzabox/deliveries      # Smazat dojezdy
```

### Expected Billing
```
GET /api/expected-billing/calculate  # Výpočet očekávané fakturace
GET /api/expected-billing/periods    # Dostupná období
```

---

## ⚙️ Konfigurace

### Environment Variables (Backend)
```bash
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/db
APP_PASSWORD=heslo_pro_login
```

### Environment Variables (Frontend)
```bash
VITE_API_URL=https://backend-url.railway.app
```

### API Timeouty (frontend/src/lib/api.js)
```javascript
// Default
timeout: 30000  // 30 sekund

// Speciální endpointy
alzabox/import/*: 300000   // 5 minut
proofs/upload:    180000   // 3 minuty
contracts/upload: 120000   // 2 minuty
```

---

## 🚀 Deployment

### Railway Services
| Service | Build | Port |
|---------|-------|------|
| Cost_control_backend | Dockerfile | 8080 |
| Cost_control_frontend | Dockerfile (nginx) | 80 |
| Postgres | Docker Image | 5432 |

### Deploy Process
```bash
# 1. Commit změny
git add .
git commit -m "v3.11.0: popis změn"

# 2. Push do main branch
git push origin main

# 3. Railway automaticky detekuje a nasadí
# (sleduj logy v Railway Dashboard)
```

---

## 📊 Monitoring

### Health Check
```
GET /health  →  {"status": "healthy", "database": "connected"}
```

### Railway Logs
- Backend: `Cost_control_backend → Logs`
- Frontend: `Cost_control_frontend → Logs`
- Database: `Postgres → Logs`

---

*Tech Stack dokumentace pro TransportBrain v3.11.0*
