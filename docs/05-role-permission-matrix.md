# Role & Permission Matrix

| Module | Admin | Sales Manager | Sales Rep | Logistics | Finance | Auditor |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Clients** | CRUD | CRUD | CRUD (Assigned) | Read | Read | Read |
| **Addresses/Contacts** | CRUD | CRUD | CRUD (Assigned) | Read | Read | Read |
| **Products** | CRUD | Read | Read | Read | Read | Read |
| **Orders** | CRUD | CRUD | Create, Read | Read | Read | Read |
| **Order Status Transitions**| All | Approve, Complete | Request Approval | Read | Read | Read |
| **Dispatch** | CRUD | Read | Read | CRUD | Read | Read |
| **Invoice Records** | CRUD | Read | Read | Read | CRUD | Read |
| **Payments & Allocations** | CRUD | Read | Read | No Access | CRUD | Read |
| **Documents** | CRUD | CRUD | Create, Read | Create (POD), Read | Read | Read |
| **Audit Logs** | Read | No Access | No Access | No Access | No Access | Read |

*(C = Create, R = Read, U = Update, D = Delete/Archive)*
