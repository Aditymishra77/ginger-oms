# UI/UX & Screen Architecture Specification

## 1. UX Consistency Rules & Responsive Principles

### 1.1 Responsive Design Principles
*   **Web Application (Desktop/Tablet):** Utilizes a flexible CSS grid/flexbox system. The left sidebar navigation collapses to icons on smaller tablet screens and disappears behind a hamburger menu on mobile web. Data tables employ horizontal scrolling or switch to card-based stacked views for narrower widths. Forms use a maximum width (e.g., 800px) or multi-column layouts on ultra-wide screens to maintain readability.
*   **Mobile Application (iOS/Android):** Built natively or cross-platform (React Native/Flutter) specifically for on-the-go efficiency. Uses a bottom tab navigation for core functions and full-screen modals for complex data entry. Touch targets are large (min 44x44pt). Avoids horizontal scrolling; uses vertical stacks.

### 1.2 UX Consistency Rules
*   **Color & Typography:** Semantic colors for statuses (Green = Complete/Paid, Yellow/Orange = Pending/Partially Paid, Red = Overdue/Cancelled, Blue = Processing/In Transit).
*   **Button Hierarchy:** Clear primary, secondary, and tertiary/ghost button styles. Only one primary CTA per view.
*   **Data Density:** Configurable table density (Compact, Comfortable) for users managing large lists.

### 1.3 System States
*   **Empty States:** Informative empty states with illustrations and clear Call-to-Action (CTA) buttons (e.g., "No orders found. [Create New Order]").
*   **Loading States:** Skeleton loaders for dashboard widgets and profile views; subtle spinner overlays on buttons or table headers for data fetching to prevent layout shift and double-clicking.
*   **Error States:** Inline validation errors for forms (red text below fields). Toast notifications for non-blocking system errors (e.g., "Failed to save draft"). Full-page error states for 404s/500s with a "Return to Dashboard" action.
*   **Confirmation Dialogs:** Destructive actions (Cancel, Void, Archive) and critical state changes (Complete Order) require a confirmation modal ("Are you sure you want to perform this action? This cannot be undone.").

---

## 2. Navigation Model & Sitemaps

### 2.1 Web Application Sitemap
*   **Main Navigation (Left Sidebar)**
    *   Dashboard
    *   Clients (List, Create, 360 Profile)
    *   Orders (List, Create, Details)
    *   Dispatch (List, Details)
    *   Invoices (List, Entry)
    *   Payments (List, Entry, Allocation)
    *   Documents (Global Repository Search)
    *   Follow-ups (Task Board/List)
    *   Reports (Metrics & Exports)
    *   System
        *   Users & Roles
        *   Settings
        *   Products/Materials

### 2.2 Mobile Application Sitemap
*   **Main Navigation (Bottom Tabs)**
    *   Home (My Tasks/Metrics/Quick Actions)
    *   Clients (Lookup, Create, Quick Profile)
    *   Orders (Create, Quick View)
    *   Dispatch (My Deliveries, POD Upload)
    *   Menu (Settings, Logout)

---

## 3. Global Features

### 3.1 Search
*   **Global Omnibox (Web):** Persistent search bar in the top header. Supports searching by Client Name, Order ID, Invoice Number, or Phone Number.
*   **Local Search (Web & Mobile):** Search bars within specific list views (e.g., searching specifically within the Orders list) to filter the current dataset.

### 3.2 Notifications
*   **In-App Notification Center:** A bell icon in the top right (Web) or Home screen (Mobile) detailing system events (e.g., "Order #123 has been fully dispatched", "Payment received for Invoice #456").
*   **Toast Notifications:** Ephemeral messages appearing at the bottom/top of the screen for 3-5 seconds confirming successful CUD (Create, Update, Delete) operations.

### 3.3 Quick Actions
*   **Web Top Bar:** A persistent "+" button in the header allowing immediate creation of an Order, Client, Invoice Record, or Follow-up from any screen.
*   **Mobile FAB (Floating Action Button):** Context-aware FAB on list screens to quickly add records (e.g., "+" on Clients tab opens Add Client form).

### 3.4 Forms and Validations
*   **Client-Side Validation:** Real-time feedback as the user types (e.g., invalid email format, missing required fields). Submit buttons are disabled until the form is valid.
*   **Server-Side Validation:** Fallback validation returning structured error messages mapped to specific form fields.
*   **Input Masks:** Automatic formatting for Phone Numbers, Tax IDs, and Currency fields to ensure clean data entry.

---

## 4. Web Application Screen Inventory

### 4.1 Dashboard
*   **Purpose:** High-level overview of key metrics and pending tasks tailored to the user's role.
*   **Roles:** All.
*   **Required Data:** Active orders count, overdue invoices, pending dispatch, today's follow-ups.
*   **Actions:** Click through to lists, Quick Actions.

### 4.2 Client List
*   **Purpose:** Search and filter the client database.
*   **Roles:** Admin, Sales Manager, Sales Rep, Logistics (Read-only), Finance, Auditor.
*   **Required Data:** Client Name, Status, Outstanding Balance (summary).
*   **Actions:** Search, Filter, Sort, View Details, Add New Client.

### 4.3 Client Creation/Edit
*   **Purpose:** Add or modify client records.
*   **Roles:** Admin, Sales Manager, Sales Rep.
*   **Required Data:** Name, Tax ID, Status, Addresses (Billing/Shipping), Contacts (Primary/Secondary).
*   **Actions:** Save, Cancel, Add Address, Add Contact.

### 4.4 Client 360° Profile
*   **Purpose:** Comprehensive view of a single client's relationship with the business.
*   **Roles:** Admin, Sales Manager, Sales Rep, Finance, Auditor.
*   **Required Data:** Profile details, Addresses, Contacts, Order History, Invoice History, Payment Ledger, Document repository, Follow-ups.
*   **Actions:** Edit Profile, Create Order for Client, Add Document, Record Payment, Archive Client.
*   **UX Layout:** Header with high-level stats (LTV, Outstanding Balance). Horizontal tabs to switch between sub-entities (Orders, Invoices, Documents, etc.) without leaving the page.

### 4.5 Orders: List & Creation
*   **Order List Purpose:** Track all orders and their statuses.
*   **Order Creation Purpose:** Form to draft and confirm a new order.
*   **Roles:** Admin, Sales Manager, Sales Rep.
*   **Workflow:** Select Client -> Add Line Items (auto-populates current product pricing) -> Adjust Quantities -> Add Notes -> Save Draft or Submit for Approval.
*   **Validations:** Must select a client, min 1 line item, qty > 0.

### 4.6 Order Details
*   **Purpose:** Master view for managing order progression.
*   **Roles:** All.
*   **Workflow & Actions:** Change Status (Draft -> Confirmed -> Processing -> Completed), trigger Dispatch creation, link Invoice Records. Displays a timeline of events.

### 4.7 Invoice Records
*   **Purpose:** Entry and management of externally generated invoices.
*   **Roles:** Finance, Admin (Read-only for others).
*   **Workflow:** Input external Invoice # -> Select Client -> Link to Order(s) -> Enter Due Date, Subtotal, GST, Total -> Upload PDF -> Save.
*   **Validations:** Subtotal + GST must equal Total. External invoice # must be unique per client.

### 4.8 Payments & Allocation
*   **Purpose:** Record money in and apply to invoices.
*   **Roles:** Finance, Admin.
*   **Workflow:** Enter Payment Details (Amount, Method, Date, Ref#) -> View Client's Unpaid Invoices -> Allocate amounts to specific invoices -> Submit.
*   **Validations:** Allocated amount cannot exceed Payment total. Allocated amount cannot exceed Invoice remaining balance.

### 4.9 Dispatch
*   **Purpose:** Logistics tracking and delivery confirmation.
*   **Roles:** Logistics, Admin, Sales Manager.
*   **Workflow:** Open Pending Order -> Create Dispatch -> Select Items & Qty to ship -> Set Carrier/Tracking -> Update to "In Transit" -> Update to "Delivered" -> Upload POD.

### 4.10 Documents
*   **Purpose:** Central file management attached to entities.
*   **Roles:** All.
*   **Actions:** Drag-and-drop upload, Download, Delete. Restricted to PDF, JPG, PNG. Max size 10MB.

### 4.11 Follow-ups
*   **Purpose:** CRM task management for sales.
*   **Roles:** Sales Manager, Sales Rep, Admin.
*   **Actions:** Mark Done, Reschedule, Add Note. Viewable as a Calendar or List.

### 4.12 Reports
*   **Purpose:** Charting and tabular exports (CSV/PDF) for revenue, balances, and operational metrics.
*   **Roles:** Finance, Admin, Sales Manager.

### 4.13 Users & Roles
*   **Purpose:** Manage system access and permissions.
*   **Roles:** Admin.
*   **Actions:** Create User, Assign Role, Reset Password, Deactivate User.

### 4.14 Settings
*   **Purpose:** Global application configuration.
*   **Roles:** Admin.
*   **Actions:** Manage Tax Rates, Default Payment Terms, Company Details, Products/Materials catalog management.

---

## 5. Mobile Application Strategy & Workflows

**Purpose Statement:** The mobile application is NOT a duplicate of the desktop web app. It is optimized for Field Sales and Logistics personnel who need fast data entry, quick lookups, and device hardware utilization (camera, GPS) while on the road.

### 5.1 Mobile-Specific Workflows
1.  **Client Lookup & Quick Navigation:**
    *   *Workflow:* Search Client -> Tap Phone number to dial -> Tap Address to open Google Maps/Apple Maps.
2.  **Field Order Creation:**
    *   *Workflow:* Stand with client -> Open App -> Tap "+" Order -> Select Client -> Quickly tap products to add to cart -> Submit. Simplified validation compared to web.
3.  **Dispatch & POD Upload (Logistics):**
    *   *Workflow:* Driver views daily manifest -> Arrives at location -> Taps "Mark Delivered" -> App automatically opens Camera -> Snap photo of signed document or goods -> Save.
4.  **Field Payment Entry:**
    *   *Workflow:* Rep receives check -> Tap "+" Payment -> Enter amount -> Snap photo of check -> Save. (Allocation is deferred to Finance on Web).
5.  **Voice-to-Text Follow-ups:**
    *   *Workflow:* Leave client meeting -> Tap microphone icon -> Dictate meeting notes -> Save as Follow-up history.

---

## 6. Assumptions & Unresolved Decisions

1.  **Mobile Offline Mode:** Assuming a basic level of offline tolerance (caching reads, queueing writes) is required for logistics in areas with poor cellular reception, but this significantly increases mobile app complexity. *To be decided before mobile implementation.*
2.  **Notification Delivery:** Assuming in-app notifications are sufficient for V1. Email or SMS notifications (e.g., emailing a client when an order dispatches) are assumed to be out of scope for V1 unless specified otherwise.
3.  **Client Portal:** Assuming this system is strictly for internal employees and clients will NOT have their own login to view statuses.
4.  **Payment Gateways:** Assuming the system only *records* payments made externally (bank transfer, physical check) and does NOT integrate with Stripe/PayPal to actually process credit cards.
