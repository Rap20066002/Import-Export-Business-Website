# Load tests

## One-time: register 10 load-test buyers

`register-load-buyers.mjs` calls **only** `POST /api/auth/register-buyer`. It does not run Prisma seed, SQL, or forgot-password.

Each **new** account gets a welcome email. If `ADMIN_NOTIFICATION_EMAIL` is set on the backend, staff get a copy too (up to 10 extra emails). Already-registered addresses are skipped; passwords are **not** reset.

**Do not run this until you are ready to create accounts.**

PowerShell (repo root). Password must be at least 8 characters. It is not printed:

```powershell
$env:API_URL="https://qum-industries-backend.onrender.com"
$env:BUYER_PASSWORD="your-shared-test-password"
node .\load-tests\register-load-buyers.mjs
```

Then use the same emails and password with `k6-buyer-readonly.js`, `k6-rfq-create.js`, and `k6-full-workflow.js`. Never commit the password.

---

# Full buyer workflow k6 test (`k6-full-workflow.js`)

One script for the real path: login → RFQ → admin quote → buyer confirm (order) → buyer PDF upload (`OTHER`) → own download → list isolation → cross-buyer denial.

k6 itself uses **1 VU**. `-e VUS=10` is the **buyer count**. The 10 buyers still fire create/quote/confirm/upload/download/list in parallel via `http.batch`, which is how this stays under the **100 requests / 15 minutes / IP** limiter.

**Do not run until you intend to write production RFQs, orders, S3 objects, and emails.** It does **not** delete anything. Reset later with the existing Prisma seed if you want. Use a **fresh 15-minute window**.

## Required environment

| Variable | Purpose |
| --- | --- |
| `API_URL` | Backend origin, **no** `/api` suffix |
| `BUYER_EMAILS` | 10 comma-separated buyer emails (same list as register helper) |
| `BUYER_PASSWORD` | Shared buyer password (or `BUYER_PASSWORDS` aligned with emails) |
| `ADMIN_EMAIL` | `SUPER_ADMIN` or `SALES_MANAGER` (quote cannot be done as BUYER) |
| `ADMIN_PASSWORD` | That admin’s password |
| `VUS` | Buyer count, default `10` (not k6 VU count). Do **not** pass `k6 --vus`. |

Never commit passwords. Stdout logs RFQ/order **ids and slots only**.

## Request budget (10 buyers)

**85 API calls** on the happy path (15 under the cap):

| Phase | Requests |
| --- | ---: |
| `GET /api/products` | 1 |
| Login 10 buyers + admin | 11 |
| `POST /api/rfqs` (batch) | 10 |
| `POST /api/rfqs/:id/quote` (batch) | 10 |
| `POST /api/rfqs/:id/confirm` (batch) | 10 |
| `POST /api/orders/:id/documents` (batch) | 10 |
| Own document download (batch) | 10 |
| `GET /api/rfqs` isolation (batch) | 10 |
| `GET /api/orders` isolation (batch) | 10 |
| Cross-buyer documents / download / confirm | 3 |
| **Total** | **85** |

`GET /api/lookups/ports` is skipped when the product already has a loading port (normal catalog). If it does not, add **1** (86).

Removed vs the first draft (that was 110–160): `UNDER_REVIEW` (quote already accepts `SUBMITTED`), quote-wait polling, extra admin list GET, teardown list refetches, and 10× IDOR (same 403/404 code path is probed once: buyer 1 against buyer 2).

## PowerShell (repo root)

```powershell
k6 run `
  -e API_URL=https://qum-industries-backend.onrender.com `
  -e VUS=10 `
  -e ADMIN_EMAIL="qumplastic.sales@gmail.com" `
  -e ADMIN_PASSWORD="your-admin-password" `
  -e BUYER_PASSWORD="your-shared-test-password" `
  -e BUYER_EMAILS="punjani24445@iiitd.ac.in,rezaabbaspunjani28@gmail.com,khizerglass1196@gmail.com,indopersiandates@gmail.com,indopersiangyp@gmail.com,rezaabbaspunjani7@gmail.com,rezapunjani00006@gmail.com,rezapunjani00008@gmail.com,rezaabbas0709@gmail.com,indopersianglass@gmail.com" `
  .\load-tests\k6-full-workflow.js
```

## What it does

1. `POST /api/auth/login` — 10 buyers + admin, in `setup`.
2. `POST /api/rfqs` — one `K6-FULL-TEST` RFQ per buyer (JSON; no company-document file).
3. Admin `POST /api/rfqs/:id/quote` `{ pricePerTon: 500, currency: "USD", validityDate, notes }`. No `UNDER_REVIEW` call (not required to quote).
4. Each buyer `POST /api/rfqs/:id/confirm` → order.
5. `POST /api/orders/:id/documents` multipart `file` + `type=OTHER`.
6. `GET .../documents/:documentId/download` — non-empty body.
7. `GET /api/rfqs` and `GET /api/orders` as each buyer — must contain only that buyer.
8. Buyer 1 against buyer 2: list documents, download, confirm (expect **403/404**, `access_denied_ok`).

There is no `GET /api/rfqs/:id`. Official shipping types are staff-only. No order stage, settlement, or payments.

## Records and files (per successful buyer, ×10)

| Where | What |
| --- | --- |
| `RFQ` | 1, ends `CONVERTED_TO_ORDER`, grade/notes `K6-FULL-TEST` |
| `RFQItem` | 1 |
| `RfqMessage` | several (create notes, review note, quote text, confirm note) |
| `Quotation` | 1, 500 USD/t, ~14-day validity |
| `Order` | 1, number `QUM-…` |
| `OrderItem` | 1 |
| `OrderStatusHistory` | 1 (`CONTAINER_BOOKING`) |
| `Document` | 1, type `OTHER`, file `K6-FULL-TEST-slot-N.pdf` |
| S3 | `orders/{orderId}/documents/{timestamp}-K6-FULL-TEST-slot-N.pdf` |

## Emails (if `/health` has `emailConfigured: true`)

Per RFQ/order, buyer gets a copy; staff get another if `ADMIN_NOTIFICATION_EMAIL` is set:

- `RFQ_SUBMITTED` — after create
- `RFQ_QUOTED` — after quote (`notifyBuyerAndAdmin`)
- `ORDER_CONFIRMED` — after confirm
- `DOCUMENT_UPLOADED` — after the PDF

`UNDER_REVIEW` does **not** send mail. Review/quote/confirm messages do **not** send `RFQ_MESSAGE` (that event is only `POST /api/rfqs/:id/messages`, which this script does not call).

Rough inbox size: **40 emails to buyers** (4 events × 10) and **up to 40 more** to the admin notification address.

## Metrics

- `http_429` / `http_other_failures` / `failed_requests` — expected 403/404 denials are **excluded** from failures (`access_denied_ok` instead)
- `rfqs_created`, `quotes_sent`, `orders_created`, `documents_uploaded`, `workflows_completed`
- `isolation_failures` must stay 0

---

# RFQ create k6 test (`k6-rfq-create.js`)

Writes **one RFQ per buyer** on the live API. Default is **10 VUs × 1 iteration**. It does **not** loop, so it will not create duplicates from extra iterations.

Inspected API (`backend/src/routes/rfq.ts`):

- Auth: `POST /api/rfqs` requires a **BUYER** JWT (`Authorization: Bearer …`).
- Body: JSON (same fields the buyer form sends as multipart). Required: `productIds` (array of numbers, min 1), `quantityContainers` (positive int), `containerType` (`DRY_20` | `DRY_40` | `REEFER`), `packagingKg` (positive), `numberOfBoxes` (positive int), `destinationPortId` (positive int), `incoterm` (`FOB` | `CIF` | `CFR`). Optional: `grade`, `targetPricePerTon`, `targetPriceCurrency`, `notes`, file `companyDocument` (this script sends **no file**).
- Success: **201** with the RFQ (`id`, `status: SUBMITTED`).
- List: `GET /api/rfqs` (any authenticated user). Buyers only receive **their** rows. **There is no `GET /api/rfqs/:id`.**
- Cross-buyer probe: `POST /api/rfqs/:id/confirm` as another buyer returns **403** (or **404** if missing). Unquoted `SUBMITTED` RFQs are not converted to orders.

## What will be created

Per successful VU (10 if all logins succeed):

| Table | Rows |
| --- | --- |
| `RFQ` | 1 (`status=SUBMITTED`, notes/grade contain `K6-LOAD-TEST`) |
| `RFQItem` | 1 (first usable catalog product, prefers `rabbi-dates`) |
| `RfqMessage` | 1 (because `notes` is set; copied from notes at create time) |

No orders, quotations, S3 uploads, or password changes.

## Emails (`RFQ_SUBMITTED`)

If backend email is configured (`/health` → `emailConfigured: true`):

- **Buyer:** one email per RFQ, subject `RFQ received — …`, to that buyer’s address.
- **Staff:** a second copy **only if** `ADMIN_NOTIFICATION_EMAIL` is set on the backend.

Expect **10 buyer emails**, and **up to 10 more** to the admin inbox. Create does **not** send `RFQ_MESSAGE`, `RFQ_QUOTED`, or order mail. Isolation `confirm` probes do not send mail (they should 403 before any write).

After testing you can wipe trade data with the existing Prisma seed (that seed also deletes users and recreates the launch admin).

## PowerShell (repo root)

Do **not** pass `k6 --vus` / `--duration`; this script uses `-e VUS=10` and one iteration per VU. All VUs share your public IP and the backend’s **100 requests / 15 minutes / IP** limiter. This run is about **60 API calls** with sleeps, so it should stay under the cap if you have not already used the window.

```powershell
k6 run `
  -e API_URL=https://qum-industries-backend.onrender.com `
  -e VUS=10 `
  -e BUYER_PASSWORD="your-shared-test-password" `
  -e BUYER_EMAILS="punjani24445@iiitd.ac.in,rezaabbaspunjani28@gmail.com,khizerglass1196@gmail.com,indopersiandates@gmail.com,indopersiangyp@gmail.com,rezaabbaspunjani7@gmail.com,rezapunjani00006@gmail.com,rezapunjani00008@gmail.com,rezaabbas0709@gmail.com,indopersianglass@gmail.com" `
  .\load-tests\k6-rfq-create.js
```

Optional different per-account passwords (same order as emails): `-e BUYER_PASSWORDS="p1,p2,..."`.

`FRONTEND_URL` is not used. Never commit the password. Stdout logs **RFQ ids and VU slots only**, not JWTs.

## Metrics

Same 429 split as the other scripts, plus:

- `rfqs_created` — must equal the VU count
- `rfq_access_denied_ok` — 403/404 on another buyer’s confirm
- `rfq_isolation_failures` — must stay 0 (list leak or missing own RFQ)

---

# Read-only k6 load test

Public HTML pages and GET APIs only. It does **not** register users, log in, submit RFQs, send contact/inquiry emails, upload files, post messages, confirm orders, or change passwords.

Default load is **2 virtual users for 30 seconds**, with **2 seconds sleep after each request** (plus 3 seconds at the end of each loop). That keeps a first run well under the backend limit of **100 requests per 15 minutes per IP**.

## What it hits

Frontend (your Render web URL):

- `GET /en`
- `GET /en/about`
- `GET /en/trade-process`
- `GET /en/products`
- `GET /en/products/export-bananas` (override with `PRODUCT_SLUG`)

Backend (API origin, no `/api` suffix on the env value):

- `GET /health`
- `GET /api/products`
- `GET /api/products/export-bananas`
- `GET /api/lookups/ports`
- `GET /api/lookups/countries`

It does **not** call `/_next/image` (homepage photos). HTML-only traffic understates frontend image-optimizer RAM.

## Metrics

k6 prints standard `http_req_duration` (including p95) and `http_req_failed`.

Custom counters:

- `http_429` — HTTP 429 only (rate limiter)
- `http_other_failures` — any non-success that is **not** 429
- `failed_requests` — rate of all non-success responses (includes 429)
- `page_req_duration` / `api_req_duration` — frontend vs API timing

Failed requests are also logged on stderr (`HTTP 429 ...` or `FAIL <status> ...`).

## Install k6 on Windows

Using winget:

```powershell
winget install Grafana.k6
```

Close and reopen the terminal, then check:

```powershell
k6 version
```

## First test (2 VUs, 30 seconds)

From the **repository root** (`Export website`), in PowerShell:

```powershell
k6 run `
  -e FRONTEND_URL=https://YOUR_FRONTEND.onrender.com `
  -e API_URL=https://qum-industries-backend.onrender.com `
  .\load-tests\k6-readonly.js
```

Replace `YOUR_FRONTEND` with the real frontend hostname. Do **not** put `/api` on `API_URL`.

Optional:

```powershell
k6 run `
  -e FRONTEND_URL=https://YOUR_FRONTEND.onrender.com `
  -e API_URL=https://qum-industries-backend.onrender.com `
  -e VUS=2 `
  -e DURATION=30s `
  -e PRODUCT_SLUG=rabbi-dates `
  .\load-tests\k6-readonly.js
```

`VUS` and `DURATION` default to `2` and `30s` if omitted.

## Raising load later

Stay conservative. All k6 VUs share **your** public IP, so they share the 100/15-minute backend cap.

Example (still modest):

```powershell
k6 run -e FRONTEND_URL=https://YOUR_FRONTEND.onrender.com -e API_URL=https://qum-industries-backend.onrender.com -e VUS=5 -e DURATION=1m .\load-tests\k6-readonly.js
```

If `http_429` rises, stop. That is the IP limiter, not “site down.”

## Watch Render during the test

Open these **before** you start k6:

1. Frontend web service — CPU, RAM, restarts / `Killed`
2. Backend web service — CPU, RAM, request rate, 4xx/5xx
3. PostgreSQL — CPU, RAM, connections

Keep the graphs on the same time window as the k6 run.

## Do not add to this script

- `POST /api/auth/register-buyer`, login, forgot-password, change-password
- `POST /api/rfqs`, messages, confirm, quote, review
- `POST /api/inquiries` (contact form)
- Order settlement, payments, document upload/delete
- Admin JWT (`GET /api/rfqs` as admin returns every RFQ)
