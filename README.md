# Qum Plastic Industries RFQ Platform

Production-oriented B2B RFQ workflow for agro-commodity trading.

This monorepo includes:
- `frontend` - Next.js 14 (App Router, TypeScript, Tailwind)
- `backend` - Express + TypeScript + Prisma + PostgreSQL

Core workflow:
1. Buyer registers/logs in and submits RFQ (optional company document).
2. Admin/Sales reviews RFQ and sends quotation.
3. Buyer confirms quotation to create an order.
4. Buyer/Admin/Logistics manage shipment documents and order stages.

## Features

- JWT auth with role-based access (`BUYER`, `SUPER_ADMIN`, `SALES_MANAGER`, `LOGISTICS_MANAGER`)
- RFQ lifecycle: submit -> quote -> confirm -> order tracking
- Secure document handling with buyer isolation
- Admin access to buyer RFQ company documents
- Manual proforma upload by admin (no auto-generation)
- Downloads served as real binary attachments (PDF/documents open correctly)
- English-only UI
- SEO essentials: metadata, sitemap, robots

## Tech Stack

- Frontend: Next.js 14, React 18, TypeScript, TailwindCSS
- Backend: Node.js, Express 5, TypeScript, Prisma, PostgreSQL, Zod, Multer
- Optional integrations: AWS S3, SendGrid

## Prerequisites

- Node.js 18+
- npm 9+
- PostgreSQL database

## Environment Setup

### Backend (`backend/.env`)

Use `backend/.env.example` as template.

Required:
- `DATABASE_URL`
- `JWT_SECRET`
- `FRONTEND_ORIGIN` (supports comma-separated list, e.g. `http://localhost:3000,http://localhost:3001`)

Optional:
- SendGrid variables
- AWS S3 variables

### Frontend (`frontend/.env.local`)

Use `frontend/.env.local.example` as template.

Required for local:
- `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api`
- `NEXT_PUBLIC_SITE_URL=http://localhost:3000`

## Local Development

### 1 Install

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2 Database migration + seed

```bash
cd backend
npx prisma migrate dev --name init_schema
npx prisma db seed
```

### 3 Start backend

```bash
cd backend
npm run dev
```

Backend runs on `http://localhost:4000`.

### 4 Start frontend

```bash
cd frontend
npm run dev
```

Frontend runs on `http://localhost:3000` (or `3001` if `3000` is busy).

> The frontend dev script clears stale `.next` before start to reduce OneDrive lock issues.

## Seeded Internal Test Accounts

After running `npx prisma db seed`:

- `admin@qum.test` / `Admin12345!` (SUPER_ADMIN)
- `sales@qum.test` / `Sales12345!` (SALES_MANAGER)
- `logistics@qum.test` / `Logistics12345!` (LOGISTICS_MANAGER)

## API Overview

Base URL: `/api`

- Auth: `/auth/*`
- Lookups: `/lookups/*`
- RFQs: `/rfqs/*`
- Orders + documents: `/orders/*`
- Products: `/products/*`

Detailed endpoint list: `docs/API.md`

## Build Commands

```bash
cd backend && npm run build
cd ../frontend && npm run build
```

## Security Notes

- Password hashing via `bcryptjs`
- JWT-based auth middleware with role checks
- CORS allowlist (local + configured origins)
- Buyers can only access their own RFQs/orders/documents
- Admin roles can manage shipment documents and delete incorrect uploads

## Known Local Dev Notes

- If project is inside OneDrive, file locks can occasionally affect `.next`.
- Pausing OneDrive sync during active development is recommended.
- If needed, remove `.next` and restart `npm run dev`.

## Documentation

- `docs/ARCHITECTURE.md` - system design and data flow
- `docs/API.md` - endpoint catalog for frontend/backend integration
