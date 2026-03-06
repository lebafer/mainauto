# AutoHaus - Fahrzeugverwaltung

A comprehensive car dealership management system built with React, Hono, Prisma, and PostgreSQL.

## Features

- **Fahrzeugverwaltung**: Full CRUD for vehicles with all relevant data (brand, model, year, mileage, equipment, images, documents, pricing)
  - Hersteller-Schnellauswahl: Click-to-select grid for Mercedes-Benz, BMW, Audi, VW, Porsche, Opel, Ford, Tesla, BYD
  - Erweiterte technische Daten: CO₂-Ausstoß, Hubraum, PS + kW, Farbpicker
  - Vorschäden: Boolean toggle mit Beschreibung und Schadenshöhe
  - Hybrid-/Elektrofelder: Batteriegröße, Reichweite WLTP, SOH, Batterietyp (nur bei Hybrid/Elektro sichtbar)
  - Export / Portugal: Separate Kostenfelder für Inland-/Auslandstransport, Zoll, Zulassung, Reparatur
  - Interner Laufzettel: Arbeitsschritte pro Fahrzeug mit Status (Offen/In Arbeit/Erledigt), Verantwortlichem und Fälligkeitsdatum
- **Steuerberechnung**: Automatic Netto/Brutto calculation with support for Regelbesteuerung (19% MwSt) and Differenzbesteuerung (§25a UStG)
- **Kundenverwaltung**: Customer database with contact info, documents, and linked vehicles
  - Zweite Telefonnummer
  - Land (Dropdown mit europäischen Ländern)
- **Verkaufsverwaltung**: Track sales linking customers to vehicles
- **Dokumentgenerierung**: Generate printable Angebote (offers), Preisschilder (price tags), and Kaufverträge (contracts) as HTML
- **Datei-Upload**: Upload vehicle images and documents for both vehicles and customers
- **Dark/Light Mode**: Modern UI with theme toggle
- **Dashboard**: Overview with stats, recent vehicles, and recent sales

## Tech Stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui, React Query, React Router
- **Backend**: Hono, Bun, Prisma (PostgreSQL), Better Auth (Email/Password)
- **Design**: DM Sans font, amber/gold accent color, responsive layout

## Project Structure

```
webapp/          - React frontend (port 8000)
  src/
    components/  - UI components and layout
    pages/       - Route pages (Dashboard, Vehicles, Customers, Sales)
    lib/         - API client, auth client, utilities
backend/         - Hono API server (port 3000)
  src/
    routes/      - API route handlers
    prisma.ts    - Database client
    auth.ts      - Authentication setup
    types.ts     - Shared Zod schemas
  prisma/        - Database schema and migrations
  uploads/       - Uploaded files
```

## Production Deployment

Production setup (Docker Compose, Nginx routing, backups, restore, cutover checklist):

- [`deploy/README.md`](deploy/README.md)

## API Endpoints

- `GET/POST /api/vehicles` - Vehicle CRUD
- `GET/POST /api/customers` - Customer CRUD
- `GET/POST /api/sales` - Sales management
- `POST /api/documents/generate` - Document generation
- `POST /api/vehicles/:id/images` - Image upload
- `POST /api/vehicles/:id/documents` - Vehicle document upload
- `POST /api/customers/:id/documents` - Customer document upload
