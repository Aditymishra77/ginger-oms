# Testing Strategy

## 1. Unit Testing
*   **Focus Area:** Financial precision and business boundaries.
*   **Key Scenarios:**
    *   Verify `DECIMAL` math doesn't lose precision during allocation calculations.
    *   Verify Payment Allocations throw exceptions if allocated > payment total or allocated > invoice remaining.
    *   Verify OrderItem captures the Product snapshot price precisely upon creation, and ignoring future Product price changes.

## 2. Integration Testing
*   **Focus Area:** Database relationships and API boundaries.
*   **Key Scenarios:**
    *   Verify `InvoiceOrder` junction properly associates one invoice to multiple orders.
    *   Verify `PaymentAllocation` properly links multiple invoices to a single payment.
    *   Verify AuditLog triggers/middleware fires on CRUD operations capturing `created_by` and `new_values`.

## 3. End-to-End (E2E) Testing
*   **Focus Area:** Multi-role workflow simulation.
*   **Key Scenarios:**
    *   *Sales Rep* creates Order -> *Manager* confirms -> *Logistics* dispatches -> *Manager* completes Order.
    *   *Finance* creates InvoiceRecord linked to Order -> *Finance* creates Payment -> *Finance* allocates Payment across Invoice.

## 4. User Acceptance Testing (UAT)
*   **Focus Area:** Validation with stakeholders to ensure the 'no invoice generation' and 'independent order completion' flows match operational reality.
