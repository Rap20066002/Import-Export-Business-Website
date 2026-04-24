# API Endpoints

Base URL: `/api`

## Auth

- `POST /auth/register-buyer`
  - Buyer self-signup
- `POST /auth/login`
  - Login for buyer/admin/sales/logistics
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
  - Multipart form
  - optional `companyDocument` file
- `GET /rfqs` (auth)
  - Buyer gets own RFQs
  - Internal roles get all RFQs
- `GET /rfqs/:rfqId/company-document` (internal roles)
  - Access uploaded buyer company document
- `POST /rfqs/:rfqId/quote` (admin/sales)
- `POST /rfqs/:rfqId/confirm` (buyer)
  - Converts quoted RFQ to order

## Orders

- `GET /orders` (auth)
- `POST /orders/convert-from-rfq` (admin/sales)
- `POST /orders/:orderId/status` (admin/logistics)

## Order Documents

- `GET /orders/:orderId/documents` (auth)
- `POST /orders/:orderId/documents` (buyer/internal roles)
  - Multipart with `file` + `type`
- `GET /orders/:orderId/documents/:documentId/download` (auth)
  - Returns binary file response
- `DELETE /orders/:orderId/documents/:documentId` (internal roles)

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
