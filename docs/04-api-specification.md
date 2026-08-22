# API Specification

## 1. General Principles
*   **Format:** JSON payloads via REST.
*   **Authentication:** Bearer tokens (JWT).
*   **Pagination:** Limit/Offset or Cursor-based for lists.
*   **Status Codes:** 200 (OK), 201 (Created), 400 (Bad Request), 401 (Unauthorized), 403 (Forbidden), 404 (Not Found).

## 2. Key Resource Endpoints

### Clients
*   `GET /api/v1/clients`
*   `POST /api/v1/clients`
*   `GET /api/v1/clients/:id`
*   `PUT /api/v1/clients/:id`
*   `PATCH /api/v1/clients/:id/status` (Soft Delete / Archive)

### Client Addresses & Contacts
*   `GET /api/v1/clients/:id/addresses`
*   `POST /api/v1/clients/:id/addresses`
*   `GET /api/v1/clients/:id/contacts`
*   `POST /api/v1/clients/:id/contacts`

### Orders
*   `GET /api/v1/orders`
*   `POST /api/v1/orders` (Includes OrderItems payload, system snapshots pricing)
*   `GET /api/v1/orders/:id`
*   `PUT /api/v1/orders/:id`
*   `PATCH /api/v1/orders/:id/status`

### Invoice Records
*   `GET /api/v1/invoices`
*   `POST /api/v1/invoices` (Accepts `order_ids` array to populate `InvoiceOrder` junction)
*   `GET /api/v1/invoices/:id`
*   `PATCH /api/v1/invoices/:id/status`

### Payments & Allocations
*   `GET /api/v1/payments`
*   `POST /api/v1/payments` (Records receipt of money)
*   `POST /api/v1/payments/:id/allocations` (Allocates portion of payment to an invoice)
    *   *Payload:* `{ "invoice_record_id": "uuid", "allocated_amount": 500.00 }`
*   `GET /api/v1/payments/:id/allocations`

### Dispatch
*   `POST /api/v1/orders/:id/dispatches`
*   `PATCH /api/v1/dispatches/:id/status`
