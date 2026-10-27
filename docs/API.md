# API Endpoints

Base URL: `/api`

## Auth

- `POST /auth/register-buyer`
  - Buyer self-signup
- `POST /auth/login`
  - Login for buyer/admin/sales/logistics
- `POST /auth/forgot-password`
  - Body: `{ email }`. Requires email to be configured. Returns 404 if the address is not registered. If it is registered, a temporary password is emailed.
- `POST /auth/change-password` (auth)
  - Body: `{ currentPassword, newPassword }` (new password min 8 characters)
- `GET /auth/me`
  - Returns current authenticated user

## Lookups

- `GET /lookups/countries`
- `GET /lookups/ports`

## Products

- `GET /products`
  - Public active products
- `GET /products/:slug`
  - Product details
- `POST /products` (admin/sales)
- `PUT /products/:slug` (admin/sales)
- `DELETE /products/:slug` (admin/sales)

## RFQs

- `POST /rfqs` (buyer)
  - Multipart form: productIds, packagingKg, numberOfBoxes, containerType (DRY_20|DRY_40|REEFER), quantityContainers, destinationPortId, incoterm, optional targetPricePerTon + targetPriceCurrency, optional companyDocument
- `GET /rfqs` (auth)
  - Buyer gets own RFQs
  - Internal roles get all RFQs
- `GET /rfqs/:rfqId/company-document/download` (internal roles)
  - Download uploaded buyer company document as a file
- `POST /rfqs/:rfqId/review` (admin/sales)
  - Body: `{ status: "UNDER_REVIEW" | "REJECTED", notes? }`
- `POST /rfqs/:rfqId/messages` (buyer of RFQ or internal roles)
  - Body: `{ body: string }` — visible conversation thread between buyer and sales
- `POST /rfqs/:rfqId/quote` (admin/sales)
- `POST /rfqs/:rfqId/confirm` (buyer)
  - Converts quoted RFQ to order. Returns 400 if the latest quotation `validityDate` is in the past. The RFQ stays; admin/sales can post a new quote to extend or revise.

## Orders

- `GET /orders` (auth)
- `POST /orders/convert-from-rfq` (admin/sales)
- `POST /orders/:orderId/status` (admin/logistics)
- `POST /orders/:orderId/settlement` (admin/sales)
  - Body: `{ finalWeightTons, unitPrice?, invoicedAmount?, settlementNote? }`
- `POST /orders/:orderId/payments` (admin/sales)
  - Body: `{ amount, note? }` — records a received installment; updates `amountReceived`

## Order Documents

- `GET /orders/:orderId/documents` (auth)
- `POST /orders/:orderId/documents` (buyer/internal roles)
  - Multipart with `file` + `type`
- `GET /orders/:orderId/documents/:documentId/download` (auth)
  - Returns binary file response
- `DELETE /orders/:orderId/documents/:documentId` (internal roles)

## Inquiries

- `POST /inquiries`
  - Public contact form. Emails `ADMIN_NOTIFICATION_EMAIL`.

## Common Error Responses

- `401 Unauthorized`
- `403 Forbidden`
- `404 Not found`
- `400 Invalid input`

Most validation errors are normalized as:

```json
{
  "error": "Invalid input"
}
```
