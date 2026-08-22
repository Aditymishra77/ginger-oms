# Database Architecture

## 1. Core Principles
*   **Numeric Precision:** All money fields use `DECIMAL(19,4)`.
*   **Auditability:** Standard audit fields (`created_at`, `updated_at`, `created_by`, `updated_by`) exist on all main tables.
*   **Soft Deletion:** Soft delete states (e.g., `status = 'archived'`) are used instead of physical deletes.

## 2. Entity Relationship Specification (ERD)

### Client & Contacts
*   **Client**
    *   `id` (PK, UUID)
    *   `name` (VARCHAR)
    *   `tax_id` (VARCHAR)
    *   `status` (ENUM: active, archived)
    *   Audit Fields
*   **ClientAddress**
    *   `id` (PK, UUID)
    *   `client_id` (FK -> Client)
    *   `type` (ENUM: billing, shipping, both)
    *   `address_line_1`, `address_line_2`, `city`, `state`, `postal_code`, `country`
    *   `is_default` (BOOLEAN)
    *   `status` (ENUM: active, archived)
    *   Audit Fields
*   **ContactPerson**
    *   `id` (PK, UUID)
    *   `client_id` (FK -> Client)
    *   `first_name`, `last_name`, `email`, `phone`, `role`
    *   `is_primary` (BOOLEAN)
    *   `status` (ENUM: active, archived)
    *   Audit Fields

### Product & Order
*   **Product**
    *   `id` (PK, UUID)
    *   `sku` (VARCHAR, UNIQUE)
    *   `name`, `description`
    *   `base_unit_price` (DECIMAL(19,4))
    *   `status` (ENUM: active, archived)
    *   Audit Fields
*   **Order**
    *   `id` (PK, UUID)
    *   `client_id` (FK -> Client)
    *   `status` (ENUM: draft, confirmed, processing, partially_dispatched, completed, cancelled)
    *   `total_amount` (DECIMAL(19,4))
    *   `notes` (TEXT)
    *   Audit Fields
*   **OrderItem**
    *   `id` (PK, UUID)
    *   `order_id` (FK -> Order)
    *   `product_id` (FK -> Product)
    *   `quantity` (DECIMAL(10,2))
    *   `unit_price` (DECIMAL(19,4)) -- SNAPSHOT OF PRICE
    *   `line_total` (DECIMAL(19,4))
    *   Audit Fields

### Invoicing & Junctions
*   **InvoiceRecord**
    *   `id` (PK, UUID)
    *   `client_id` (FK -> Client)
    *   `invoice_number` (VARCHAR) -- Sourced from external system
    *   `invoice_date` (DATE)
    *   `due_date` (DATE)
    *   `subtotal` (DECIMAL(19,4))
    *   `gst_amount` (DECIMAL(19,4))
    *   `total_amount` (DECIMAL(19,4))
    *   `status` (ENUM: unpaid, partially_paid, paid, voided)
    *   `document_url` (VARCHAR)
    *   Audit Fields
*   **InvoiceOrder** (Junction Table)
    *   `invoice_record_id` (FK -> InvoiceRecord)
    *   `order_id` (FK -> Order)
    *   `created_at`

### Payments & Allocations
*   **Payment**
    *   `id` (PK, UUID)
    *   `client_id` (FK -> Client)
    *   `amount` (DECIMAL(19,4))
    *   `payment_date` (DATE)
    *   `payment_method` (VARCHAR)
    *   `reference_number` (VARCHAR)
    *   `status` (ENUM: unallocated, partially_allocated, fully_allocated, voided)
    *   Audit Fields
*   **PaymentAllocation** (Junction Table)
    *   `id` (PK, UUID)
    *   `payment_id` (FK -> Payment)
    *   `invoice_record_id` (FK -> InvoiceRecord)
    *   `allocated_amount` (DECIMAL(19,4))
    *   Audit Fields

### Dispatch & Tracking
*   **Dispatch**
    *   `id` (PK, UUID)
    *   `order_id` (FK -> Order)
    *   `status` (ENUM: scheduled, in_transit, delivered, cancelled)
    *   `dispatch_date` (DATE)
    *   `carrier` (VARCHAR)
    *   `tracking_number` (VARCHAR)
    *   `pod_url` (VARCHAR)
    *   Audit Fields
*   **DispatchItem**
    *   `id` (PK, UUID)
    *   `dispatch_id` (FK -> Dispatch)
    *   `order_item_id` (FK -> OrderItem)
    *   `quantity_shipped` (DECIMAL(10,2))

### Audit & Ancillary
*   **AuditLog**
    *   `id` (PK, UUID)
    *   `user_id` (FK -> User)
    *   `action` (VARCHAR) -- CREATE, UPDATE, DELETE, STATE_CHANGE
    *   `entity_type` (VARCHAR)
    *   `entity_id` (UUID)
    *   `old_values` (JSONB)
    *   `new_values` (JSONB)
    *   `created_at` (TIMESTAMP)
