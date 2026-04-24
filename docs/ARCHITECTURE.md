# Architecture Overview

## Monorepo Layout

- `frontend/` - Next.js App Router UI
- `backend/` - Express API + Prisma
- `docs/` - project documentation

## High-Level Design

1. Browser calls frontend pages (`/en/...`).
2. Frontend uses `NEXT_PUBLIC_API_BASE_URL` to call backend REST endpoints.
3. Backend validates auth (JWT) and role permissions.
4. Prisma persists business data in PostgreSQL.
5. Documents are stored in:
   - AWS S3 when configured
   - local `backend/storage` fallback when S3 is not configured

## Roles

- `BUYER`
  - submit RFQs
  - view own RFQs/orders
  - upload/download order documents for own orders
- `SUPER_ADMIN`
  - full internal access
- `SALES_MANAGER`
  - quote RFQs, upload/delete documents, admin views
- `LOGISTICS_MANAGER`
  - update order stages, upload/delete documents, admin views

## RFQ to Order Flow

1. Buyer submits RFQ (`POST /api/rfqs`) with optional company document.
2. Admin/Sales quotes RFQ (`POST /api/rfqs/:rfqId/quote`).
3. Buyer confirms quote (`POST /api/rfqs/:rfqId/confirm`).
4. Order is created with status history.
5. Internal team manually uploads proforma/commercial/shipping docs.

## Document Access Rules

- Buyer can only access documents of orders belonging to their own account.
- Internal roles can access all order documents.
- Internal roles can view buyer RFQ company document via dedicated endpoint.
- Download endpoint serves binary file content with proper headers.

## Frontend Routing

- Root `/` redirects to `/en`
- Public pages:
  - `/en`
  - `/en/about`
  - `/en/trade-process`
  - `/en/products`
  - `/en/contact`
- Buyer pages:
  - `/en/buyer/register`
  - `/en/buyer/login`
  - `/en/buyer/rfq`
  - `/en/buyer/dashboard`
  - `/en/buyer/orders/:id/documents`
- Admin pages:
  - `/en/admin/login`
  - `/en/admin`

## Operational Notes

- Backend CORS allows:
  - configured `FRONTEND_ORIGIN` values
  - `http://localhost:3000`
  - `http://localhost:3001`
- Frontend dev script clears stale `.next` before `next dev --turbo`.
