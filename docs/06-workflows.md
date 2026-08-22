# Workflows & Status Models

## 1. Order Lifecycle
**Transitions:**
1.  **Draft** -> **Confirmed**: Performed by Sales Manager/Admin (Approval).
2.  **Confirmed** -> **Processing**: Performed automatically or by Sales Manager when fulfillment begins.
3.  **Processing** -> **Partially Dispatched**: System auto-updates when first Dispatch is created.
4.  **Partially Dispatched** -> **Completed**: Performed by Sales Manager/Admin when fulfillment is final. (Independent of invoicing).
5.  **Processing** -> **Completed**: If fully dispatched instantly.
6.  *Any State* -> **Cancelled**: If the order is aborted.

## 2. Dispatch Lifecycle
**Transitions:**
1.  **Scheduled** -> **In Transit**: Performed by Logistics when goods leave.
2.  **In Transit** -> **Delivered**: Performed by Logistics upon POD upload.
3.  **Scheduled** -> **Cancelled**: If dispatch is aborted.

## 3. Invoice Record Lifecycle
**Transitions:**
1.  **Unpaid**: Default state upon record creation.
2.  **Unpaid** -> **Partially Paid**: System auto-updates when a `PaymentAllocation` brings `paid_amount` > 0 but < `total_amount`.
3.  **Partially Paid** -> **Paid**: System auto-updates when allocations equal `total_amount`.
4.  *Any State* -> **Voided**: Finance/Admin revokes the invoice record.

## 4. Payment Lifecycle
**Transitions:**
1.  **Unallocated**: Default state upon payment receipt.
2.  **Unallocated** -> **Partially Allocated**: System auto-updates when allocations are made but remaining balance > 0.
3.  **Partially Allocated** -> **Fully Allocated**: Auto-updates when entire payment is allocated.
4.  *Any State* -> **Voided**: Finance revokes payment.
