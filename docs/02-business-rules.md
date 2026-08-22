# Business Rules

## 1. Invoice Boundaries
*   **No Generation:** The system must NEVER generate invoices or authoritative invoice numbers.
*   **External Source of Truth:** External accounting/invoicing software remains the sole source of truth for invoice generation. Our system only stores `Invoice Records`.
*   **Many-to-Many Order Relationship:** An invoice can be associated with multiple orders, and an order can have multiple invoices (via junction table).

## 2. Payment Boundaries
*   **Decoupled Payments:** Payments are distinct from Invoices.
*   **Payment Allocation:** A single payment can be allocated across multiple invoices, and an invoice can be paid off by multiple payments.
*   **Allocation Limits:** The total allocated amount for an invoice cannot exceed its outstanding balance (Invoice Total - Previous Allocations). 

## 3. Order Completion
*   **Independent of Invoicing:** Order completion is based strictly on fulfillment, delivery, and business closure. "Invoice generated" is NOT a mandatory prerequisite for completing an order.
*   **State Separation:** Order status, invoice status, and payment status are tracked completely independently.

## 4. Financial Precision
*   **No Floats:** Monetary values must use exact precision decimal/numeric database types (e.g., `DECIMAL(19,4)`). Floating-point types (`float`, `double`) are strictly prohibited.

## 5. Pricing Snapshots
*   **Historical Integrity:** When an `OrderItem` is created, the current agreed unit price is copied from the Product master to the OrderItem. 
*   **Immutable History:** Future updates to the Product master pricing must NOT overwrite historical order pricing.

## 6. Auditability & Data Retention
*   **Audit Fields:** All primary business entities must track `created_at`, `updated_at`, `created_by`, and `updated_by`.
*   **Soft Deletion:** Important financial, client, and order records must not be physically deleted. They should transition to inactive, archived, voided, or cancelled states.
*   **Immutable Logs:** Audit logs must be append-only and immutable for normal users.
