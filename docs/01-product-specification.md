# Product Specification: Client & Order Management System

## 1. System Overview
A B2B/industrial Client & Order Management System designed to track the complete lifecycle of clients, orders, dispatch, and payments. 

**Core Tenet**: The system strictly serves as a centralized record-keeping and workflow management tool and **will never** generate invoices or authoritative invoice numbers. All invoice generation occurs in external accounting software.

## 2. Architecture 
*   **Web Application:** Responsive SPA for desktop/tablet use.
*   **Mobile Application:** Cross-platform mobile app for field/logistics access.
*   **Backend API:** Centralized REST/GraphQL API.
*   **Database:** Relational Database (e.g., PostgreSQL).
*   **Storage:** Cloud storage for documents, PODs (Proof of Delivery), and invoice PDFs.

## 3. Core Modules
1.  **Dashboard:** High-level metrics tailored to user roles.
2.  **Clients:** Client lifecycle management, multi-address support, multi-contact support.
3.  **Orders:** Order creation, processing, and completion tracking.
4.  **Products/Materials:** Master catalog with historical pricing integrity.
5.  **Dispatch:** Logistics tracking, split deliveries, POD uploads.
6.  **Invoice Records:** Entry and allocation of externally generated invoices.
7.  **Payments:** Logging incoming payments and allocating them across invoices.
8.  **Documents:** Centralized document repository attached to entities.
9.  **Follow-ups:** Task management and CRM activities.
10. **Reports:** Revenue, outstanding balances, order volume, dispatch metrics.
11. **Users & Roles:** RBAC user management.
12. **Settings:** System-wide configurations.

## 4. User Roles
*   **System Admin:** Full access to all modules and configurations.
*   **Sales Manager:** Can manage clients, approve orders, and oversee sales metrics.
*   **Sales Representative:** Can manage assigned clients, create orders, log follow-ups.
*   **Logistics/Dispatch:** Can view confirmed orders, manage dispatch records, update shipping status.
*   **Finance/Billing:** Can input invoice records, record payments, allocate payments.
*   **Auditor/View-Only:** Read-only access to all/most modules.
