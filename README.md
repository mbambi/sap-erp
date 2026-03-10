# SAP ERP Learning Platform

**Enterprise Resource Planning Simulator for University Education**

A comprehensive web-based ERP platform that mirrors SAP's core functionality. Designed for university students to learn enterprise resource planning through hands-on practice with real ERP workflows—from procurement and production to financial closing and supply chain optimization. The platform delivers 60+ integrated modules covering finance, materials, sales, production, MRP, warehouse, quality, maintenance, HR, advanced analytics, event-driven architecture, process mining, digital twin simulation, AI copilot, workflow automation, multi-user simulation, optimization engines, competitive benchmarking, industry templates, and a research-grade experiment lab—all within a multi-tenant, role-based learning environment.

---

## Features Overview

### Core ERP Modules (SAP-Style)

| # | Module | Features |
|---|--------|----------|
| 1 | **Finance - General Ledger (FI-GL)** | Journal entries, GL accounts, trial balance, fiscal periods, company codes, multi-currency |
| 2 | **Accounts Payable (FI-AP)** | 3-way matching (PO vs GR vs Invoice), payment runs, vendor balance, supplier invoices, purchase requisitions with approval workflow |
| 3 | **Accounts Receivable (FI-AR)** | Aging reports (0-30, 31-60, 61-90, 90+ days), payment status, customer credit limits, customer invoices |
| 4 | **Materials Management (MM)** | Material master, full procurement cycle (PR→PO→GR→Inventory), purchase orders, goods receipts, vendor management |
| 5 | **Inventory Management** | Batch tracking, lot numbers, goods issue/receipt, stock transfer, inventory count, ABC classification, EOQ, safety stock, reorder point |
| 6 | **Sales & Distribution (SD)** | Sales orders, deliveries, invoicing, pricing engine (discounts, taxes, surcharges, material/customer conditions) |
| 7 | **Production Planning (PP)** | BOMs, routings, production orders, work centers, scheduling board, Gantt visualization |
| 8 | **MRP (Material Requirements Planning)** | Demand forecasting (manual, moving avg, exponential, regression), net requirements, planned orders, procurement proposals |
| 9 | **Warehouse Management (WM)** | Bin management, pick/putaway, inventory counts, storage locations |
| 10 | **Quality Management (QM)** | Inspection lots, non-conformances, corrective actions, inspection results |
| 11 | **Plant Maintenance (PM)** | Work orders, equipment, preventive maintenance plans |
| 12 | **Human Resources (HR)** | Employee master, org structure, leave/time management |
| 13 | **Controlling (CO)** | Cost centers, internal orders |

### Enterprise Extensions

| # | Module | Features |
|---|--------|----------|
| 14 | **Multi-Company & Intercompany** | Multiple companies per tenant, intercompany transactions, transfer pricing rules, consolidated financials |
| 15 | **Financial Statements** | Balance Sheet, Income Statement, Cash Flow Statement generation |
| 16 | **Period Closing** | Month-end closing simulation with interactive checklist |
| 17 | **Costing** | Manufacturing cost calculation (material, labor, overhead), cost estimates, variance analysis |
| 18 | **Asset Management** | Equipment tracking, depreciation (straight-line, declining balance), maintenance linkage |
| 19 | **Transport/Logistics** | Shipments, routes, carriers, freight cost management |

### Planning & Analytics

| # | Module | Features |
|---|--------|----------|
| 20 | **MRP Planning Board** | Visual demand/supply/shortage view with 12-week timeline, reschedule, supplier change, safety stock adjustment |
| 21 | **Data Warehouse & OLAP** | Star schema fact tables, ETL process, sales/inventory analytics, KPI dashboard |
| 22 | **Advanced Optimization Engine** | Warehouse location, production scheduling, inventory policy (EOQ), transport route, job-shop scheduling (Johnson's algorithm), multi-period capacity planning with overtime, vehicle routing with capacity constraints, multi-echelon safety stock optimization |
| 23 | **Reporting/BI** | Customizable dashboards, KPI studio, financial analytics |
| 24 | **Operations Metrics** | OEE, cycle time, throughput, inventory turnover, fill rate |
| 25 | **Process Mining Engine** | Event log recording, process flow visualization, bottleneck detection (transition & activity analysis with P95), conformance checking (fitness scoring against ideal process), process variant discovery, organizational social network analysis (resource handover graphs) |

### Integration & Architecture

| # | Module | Features |
|---|--------|----------|
| 26 | **Event-Driven ERP Architecture** | In-process event bus (upgradeable to Kafka/NATS/Redis Streams), 27 event types, 5 built-in subscribers (Inventory, Finance, Analytics, ProcessMining, Notification), automatic event persistence, batch publish, P2P/O2C/Plan-to-Produce flow simulation |
| 27 | **Integration Layer** | Webhook management, REST API endpoints, event simulation, architecture visualization |
| 28 | **Document Management** | Upload/attach documents to ERP entities, PDF generation for POs/invoices |
| 29 | **Supplier & Customer Portals** | External views for vendors (POs, deliveries, invoices) and customers (orders, shipments) |
| 30 | **API Playground** | Built-in API testing tool (Postman-like) |
| 31 | **SAP Transaction Codes** | Command bar with T-Code navigation (ME21N, MIGO, FB50, VA01, CO01, MD01, etc.) |

### Learning & Certification

| # | Module | Features |
|---|--------|----------|
| 32 | **Course Mode** | Structured learning courses with lessons, progress tracking, objectives |
| 33 | **ERP Certification** | Timed exams with task validation, scoring, leaderboard |
| 34 | **Learning Hub** | Guided exercises, sandboxed sample companies |
| 35 | **Gamification** | XP points, achievements, leaderboard |
| 36 | **Scenario Simulator** | Supply chain crises, demand spikes, supplier delays |
| 37 | **ERP Time Machine** | Event sourcing, rewind/replay system state, timeline visualization |
| 38 | **Live Supply Chain Simulator** | Real-time simulation engine with scoring |
| 39 | **Explainable ERP** | AI decision explainer tracing "why" ERP decisions were made |
| 40 | **AI ERP Copilot** | Context-aware AI assistant with intent detection (MRP, inventory, production, finance, sales, purchasing, quality), automatic Prisma data gathering, markdown-formatted explanations, contextual page-based suggestions |
| 41 | **Dataset Generator** | Create realistic test datasets (10–2000 records per entity) |

### Advanced Simulation & Research

| # | Module | Features |
|---|--------|----------|
| 42 | **Supply Chain Digital Twin** | Cytoscape.js-compatible network graph (suppliers→plants→warehouses→customers), procurement/production/distribution edges, demand signal forecasting, summary KPIs |
| 43 | **Configurable Workflow Engine** | Rule-based automation with conditions (`gt`, `gte`, `lt`, `eq`, `contains`, etc.), document evaluation against active rules, auto-create workflow instances/tasks, 5 predefined templates (PO approval, credit check, production release, invoice match, quality escalation) |
| 44 | **Multi-User Real-Time Simulation** | 6 collaboration roles (procurement, production, warehouse, finance, sales, quality) with permission sets, session management (create/join/start/end), role-validated actions, live event feed with polling, cross-module event bus integration |
| 45 | **ERP Benchmark Competition** | Tournament system (weekly/semester), weighted multi-metric scoring, standings & leaderboard, hall of fame, 8 benchmark metrics (efficiency, accuracy, cycle time, cost, quality, throughput, utilization, on-time delivery) |
| 46 | **Industry Templates** | Pre-built configurations for Manufacturing, Retail, Pharma, Automotive, Food & Beverage — each with structured materials, detailed BOMs with components, named suppliers with material mappings & lead times, customer databases, work centers, logistics info |
| 47 | **ERP Experiment Lab** | 5 research-grade experiment templates: EOQ vs (s,S) inventory policy, lot sizing comparison (lot-for-lot/EOQ/fixed-period/Silver-Meal), safety stock vs service level tradeoff analysis, bullwhip effect simulation, scheduling rule comparison (FIFO/SPT/EDD/CR). Full simulation engines, exportable results for research papers, experiment history & replay |

### Administration

| # | Module | Features |
|---|--------|----------|
| 48 | **Instructor Control Panel** | Inject crises, freeze inventory, change demand, monitor students |
| 49 | **Role-Based Dashboards** | Tailored views for Student, Instructor, Admin |
| 50 | **Monitoring** | System health, API performance, usage statistics, metrics explorer |
| 51 | **Sandbox Reset** | One-click data reset for safe experimentation |
| 52 | **Multi-tenant** | Data isolation per university/class |
| 53 | **RBAC** | Admin, instructor, student, auditor roles |

---

## Quick Start

```bash
git clone <repo>
cd sap

# Backend
cd server
npm install
cp ../.env.example ../.env
npx prisma db push
npx tsx src/seed.ts
npx tsx src/index.ts

# Frontend (new terminal)
cd ../client
npm install
npm run dev
```

**Default credentials** (tenant: `demo-university`):

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@demo.edu | password123 |
| Instructor | instructor@demo.edu | password123 |
| Student | student@demo.edu | password123 |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, TypeScript, Vite, TailwindCSS, Zustand, TanStack Query, Recharts, Lucide React |
| **Backend** | Node.js, Express, TypeScript, Prisma ORM |
| **Database** | SQLite (dev) / PostgreSQL (prod) |
| **Auth** | JWT, bcryptjs, RBAC middleware |

---

## Role-Based Access Control (RBAC)

### Role Overview

| Role | Description | Typical User |
|------|-------------|--------------|
| **Admin** | Full system access, user management, monitoring | System administrator |
| **Instructor** | Create/manage courses, exercises, inject crises, view student progress | Professor/TA |
| **Student** | Learn ERP, complete exercises, take certifications, run simulations | Student |
| **Auditor** | Read-only access to all modules for audit purposes | External auditor |

### Permission Matrix

| Feature / Module | Admin | Instructor | Student | Auditor |
|-----------------|:-----:|:----------:|:-------:|:-------:|
| **Finance (GL, AP, AR, Trial Balance)** | Full | Full | Full (read on write ops) | Read |
| **Materials Management (MM)** | Full | Full | Full | Read |
| **Sales & Distribution (SD)** | Full | Full | Full | Read |
| **Production Planning (PP)** | Full | Full | Full | Read |
| **MRP & MRP Planning Board** | Full | Full | Full | Read |
| **Warehouse, Quality, Maintenance** | Full | Full | Full | Read |
| **HR (Employees, Org, Leave, Time)** | Full | Full | Hidden | Hidden |
| **Multi-Company & Intercompany** | Full | Full | Hidden | Hidden |
| **Period Closing** | Full | Full | Hidden | Hidden |
| **Integration Layer** | Full | Full | Hidden | Hidden |
| **Supplier & Customer Portals** | Full | Full | Hidden | Hidden |
| **Courses & Certification** | Full | Full (create) | View/Take | Read |
| **Dataset Generator** | Full | Full | Hidden | Hidden |
| **Sandbox Reset** | Full | Full | Hidden | Hidden |
| **Monitoring** | Full | Hidden | Hidden | Hidden |
| **Admin Panel** | Full | Hidden | Hidden | Hidden |
| **Instructor Panel** | Full | Full | Hidden | Hidden |

### Backend Enforcement

Role checks are enforced at the API level with `requireRoles()` middleware. Protected endpoints:

| Endpoint | Required Role |
|----------|---------------|
| `POST /api/ap/purchase-requisitions/:id/approve` | admin, instructor |
| `POST /api/ap/supplier-invoices/:id/approve` | admin, instructor |
| `POST /api/ap/payment-run` | admin, instructor |
| `POST /api/assets`, `POST /api/assets/run-depreciation`, `POST /api/assets/:id/dispose` | admin, instructor |
| `POST /api/instructor/*` (all) | admin, instructor |
| `POST /api/utilities/sandbox-reset` | admin, instructor |
| `GET/POST /api/hr/*` (all) | admin, instructor |
| `GET/POST /api/admin/*` (all) | admin, instructor |
| `POST /api/admin/tenants` | admin only |
| `GET/POST /api/portals/*` (manage) | admin, instructor |
| `POST /api/multi-company/companies`, `POST /api/multi-company/transactions/:id/approve` | admin, instructor |
| `POST /api/period-closing/*`, `POST /api/period-closing/:id/reopen` | admin, instructor |
| `POST /api/financial-statements/*` | admin, instructor |
| `POST /api/dataset-generator/*` (generate) | admin, instructor |
| `GET /api/monitoring/*` (metrics) | admin, instructor |
| `GET /api/monitoring/system` | admin only |

---

## Navigation Map (Sidebar)

This section documents **every item in the left navigation sidebar**: what it does, the main route, and **who can see it**.

Legend:

- **All** = `admin`, `instructor`, `student`, `auditor`
- **Staff** = `admin`, `instructor`
- **Admin** = `admin` only

### Global

| Label | Route | Access | Description |
|-------|-------|--------|-------------|
| **Dashboard** | `/` | All | Personalized home with KPIs, recent orders, quick actions, and shortcuts to learning and instructor tools. |

### Finance & Controlling

| Label | Route | Access | Description |
|-------|-------|--------|-------------|
| **Finance (FI) → Journal Entries** | `/finance/journal-entries` | All | Post and review general ledger journal entries. |
| **Finance (FI) → GL Accounts** | `/finance/gl-accounts` | All | Manage chart of accounts and account metadata. |
| **Finance (FI) → Company Codes** | `/finance/company-codes` | Staff | Configure legal entities, currencies, and posting settings. |
| **Finance (FI) → Vendors** | `/finance/vendors` | All | Maintain vendor master data used in procurement. |
| **Finance (FI) → Customers** | `/finance/customers` | All | Maintain customer master data used in sales. |
| **Finance (FI) → Trial Balance** | `/finance/trial-balance` | All | View trial balance by GL account and company code. |
| **Finance (FI) → Financial Analytics** | `/finance/analytics` | All | Dashboards for P&L, balance sheet, and key financial KPIs. |
| **Finance (FI) → Accounts Payable** | `/finance/ap` | All | AP workbench for supplier invoices, approvals, and payments. |
| **Finance (FI) → Accounts Receivable** | `/finance/ar` | All | AR workbench for customer invoices, cash receipts, and aging. |
| **Finance (FI) → Pricing Engine** | `/finance/pricing` | All | Configure pricing conditions (discounts, surcharges, taxes). |
| **Controlling (CO) → Cost Centers** | `/controlling/cost-centers` | All | Manage cost center hierarchy and master data. |
| **Controlling (CO) → Internal Orders** | `/controlling/internal-orders` | All | Track internal projects and cost collections. |
| **Finance Ops → Financial Statements** | `/financial-statements` | All | Generate simulated balance sheet, income statement, cash flow. |
| **Finance Ops → Period Closing** | `/period-closing` | Staff | Month-end closing checklist and guided closing workflow. |

### Materials, Sales, Production, Warehouse, Quality, Maintenance

| Label | Route | Access | Description |
|-------|-------|--------|-------------|
| **Materials (MM) → Materials** | `/materials/items` | All | Material master list (raw, semi-finished, finished, trading). |
| **Materials (MM) → Purchase Orders** | `/materials/purchase-orders` | All | Full PO lifecycle, including creation and tracking. |
| **Materials (MM) → Goods Receipts** | `/materials/goods-receipts` | All | Post goods receipts against purchase orders. |
| **Materials (MM) → Inventory** | `/materials/inventory` | All | View stock levels and inventory positions. |
| **Materials (MM) → Plants** | `/materials/plants` | Staff | Configure plants and storage locations. |
| **Materials (MM) → Inventory Analytics** | `/inventory/analytics` | All | Inventory KPIs: turnover, days of supply, stock aging. |
| **Materials (MM) → Stock Management** | `/inventory/stock` | All | Detailed stock movements and manual adjustments. |
| **Sales (SD) → Sales Orders** | `/sales/orders` | All | Manage order-to-cash: sales orders and statuses. |
| **Sales (SD) → Deliveries** | `/sales/deliveries` | All | Outbound delivery processing and shipment prep. |
| **Sales (SD) → Invoices** | `/sales/invoices` | All | Customer invoicing and billing documents. |
| **Production (PP) → BOMs** | `/production/boms` | All | Bills of material and component structures. |
| **Production (PP) → Production Orders** | `/production/orders` | All | Create and track production orders and confirmations. |
| **Production (PP) → Scheduling** | `/production/scheduling` | All | Gantt-style scheduling board for capacity planning. |
| **Production (PP) → Operations Dashboard** | `/operations/dashboard` | All | High-level production KPIs (OEE, throughput, utilization). |
| **Warehouse (WM) → Warehouses** | `/warehouse/list` | All | Warehouse master data and locations. |
| **Warehouse (WM) → Bin Management** | `/warehouse/bins` | All | Manage storage bins and bin-level stock. |
| **Quality (QM) → Inspection Lots** | `/quality/inspections` | All | Create and evaluate inspection lots. |
| **Quality (QM) → Non-Conformances** | `/quality/non-conformances` | All | Track quality issues and corrective actions. |
| **Maintenance (PM) → Equipment** | `/maintenance/equipment` | All | Equipment master data and maintenance history. |
| **Maintenance (PM) → Work Orders** | `/maintenance/work-orders` | All | Create and manage maintenance work orders. |

### HR & People

| Label | Route | Access | Description |
|-------|-------|--------|-------------|
| **HR → Employees** | `/hr/employees` | Staff | Employee master data and assignments. |
| **HR → Org Structure** | `/hr/org-units` | Staff | Organizational units, positions, reporting lines. |
| **HR → Leave Requests** | `/hr/leave-requests` | Staff | Leave approvals and history. |
| **HR → Time Entries** | `/hr/time-entries` | Staff | Working time, overtime, and attendance records. |

### Planning, MRP & Inventory Simulation

| Label | Route | Access | Description |
|-------|-------|--------|-------------|
| **MRP & Planning → MRP Dashboard** | `/mrp` | All | Run MRP, review MRP runs, and planned orders. |
| **MRP & Planning → MRP Planning Board** | `/mrp-board` | All | 12-week visual board for shortages, reschedules, and supplier changes. |
| **MRP & Planning → Inventory Simulator** | `/inventory/simulator` | All | Inventory policy simulator (EOQ, (s,S), min-max, periodic review). |

### Supply Chain & Digital Twin

> Some of these views are advanced / experimental and may be more relevant for **staff** and research use, but the sidebar visibility is controlled by role as defined in RBAC.

| Label | Route | Access | Description |
|-------|-------|--------|-------------|
| **Multi-Company** | `/multi-company` | Staff | Configure multiple companies and intercompany flows. |
| **Asset Management** | `/assets` | Staff | Track assets, depreciation, and links to maintenance. |
| **Transport** | `/transport` | All | Logistics view for shipments, carriers, and routes. |
| **Supply Chain → Network Map** | `/supply-chain/network` | All | Graph view of suppliers, plants, warehouses, customers. |
| **Supply Chain → Map Editor** | `/supply-chain/editor` | All | Edit the digital twin network topology. |
| **Supply Chain → Multi-Echelon** | `/multi-echelon` | All | Multi‑echelon inventory strategy experiments. |
| **Supply Chain → Forecasting** | `/forecasting` | All | Demand forecasting experiments and visualizations. |
| **Process Flows** | `/process-flows` | All | Static process flow definitions (e.g. P2P, O2C). |
| **Process Visualizer** | `/process-visualizer` | All | Interactive, clickable process graph that links to transactions. |
| **Digital Twin** | `/digital-twin` | All | Live supply chain digital twin with KPIs. |

### Process Mining, Workflow & Analytics

| Label | Route | Access | Description |
|-------|-------|--------|-------------|
| **Reporting** | `/reporting` | All | Cross-module reporting dashboards. |
| **Process Mining** | `/process-mining` | All | Event-log based process maps, bottlenecks, and conformance. |
| **Scenario Simulator** | `/scenarios/simulator` | All | Scenario playground for what‑if analysis across modules. |
| **Workflow → Workflows** | `/workflow` | All | List of workflow definitions and instances. |
| **Workflow → Workflow Builder** | `/workflow/builder` | Staff | Visual rule editor for workflow conditions and actions. |
| **Analytics & BI → Data Warehouse** | `/data-warehouse` | All | Star schema views and aggregated analytics. |
| **Analytics & BI → Data Export Lab** | `/data-lab` | All | Export data to CSV/JSON for research and teaching. |
| **Analytics & BI → Optimization Engine** | `/optimization` | All | Launch optimization runs (scheduling, routing, etc.). |
| **Analytics & BI → Decision Impact** | `/decision-impact` | All | Analyze impact of decisions on KPIs. |
| **Analytics & BI → SQL Explorer** | `/sql-explorer` | All | Run read‑only SQL queries against the teaching dataset. |
| **Analytics & BI → Role Dashboard** | `/role-dashboard` | All | Role‑specific summary dashboards. |

### Learning, Gamification & Games

| Label | Route | Access | Description |
|-------|-------|--------|-------------|
| **Learning → Learning Hub** | `/learning` | All | Guided exercises and learning paths. |
| **Learning → My Progress** | `/learning/analytics` | All | Personal learning analytics and achievements. |
| **Learning → Courses** | `/courses` | All | Course structures and modules. |
| **Learning → Certification** | `/certification` | All | Certification center with timed exams. |
| **Gamification** | `/gamification` | All | XP, levels, badges, and leaderboards. |
| **Supply Chain Game** | `/game` | All | Competitive game mode where students run virtual companies. |
| **Benchmark** | `/benchmark` | All | Tournament‑style benchmark mode for cohorts. |
| **Stress Test** | `/stress-test` | All | High‑load / crisis scenarios for whole system or class. |

### Simulation, Experimentation & AI

| Label | Route | Access | Description |
|-------|-------|--------|-------------|
| **Event Bus** | `/event-bus` | All | Visualize ERP events and simulate flows (P2P, O2C, P2P). |
| **Simulation** | `/simulation` | All | Multi‑user simulation sessions (roles collaborate in real time). |
| **Experiment Lab** | `/experiment-lab` | All | Research‑grade experiment templates and results. |
| **Scenario Replay** | `/scenario-replay` | All | Replay past simulations / crisis scenarios. |
| **AI Recommendations** | `/recommendations` | All | AI‑generated suggestions (e.g. stock levels, pricing). |
| **ERP Copilot** | `/copilot` | All | AI assistant answering "why" and "how" questions about ERP data. |
| **Time Machine** | `/time-machine` | All | Event‑sourced rewind/compare of company state over time. |
| **Simulator** | `/simulator` | All | High‑level simulator shell combining multiple engines. |
| **ERP Explainer** | `/explainer` | All | Explainable ERP decisions and process walkthroughs. |
| **Costing** | `/costing` | All | Product costing, BOM roll‑ups, variance analysis. |

### Instructor & Utilities

| Label | Route | Access | Description |
|-------|-------|--------|-------------|
| **Instructor → Control Panel** | `/instructor` | Staff | Central hub for instructor‑level tools. |
| **Instructor → Class Analytics** | `/instructor/analytics` | Staff | Class‑level performance and learning analytics. |
| **Instructor → Assignment Builder** | `/instructor/assignments` | Staff | Build step‑based assignments with auto‑grading. |
| **Instructor → Scenario Builder** | `/instructor/scenarios` | Staff | Inject crises (demand spikes, supplier delays, etc.). |
| **Instructor → Sandbox Manager** | `/sandbox` | Staff | Reset student sandboxes and scenarios. |
| **Instructor → Dataset Generator** | `/dataset-generator` | Staff | Generate teaching datasets (small/medium/large). |
| **Instructor → Industry Templates** | `/industry-templates` | Staff | Preconfigured templates by industry. |
| **Utilities → API Playground** | `/tools/api-playground` | All | In‑browser REST client for the platform API. |
| **Utilities → SQL Explorer** | `/sql-explorer` | All | Same as Analytics SQL Explorer (quick navigation duplicate). |
| **Audit** | `/audit` | All | Read‑only audit log browser (immutable history). |
| **Monitoring** | `/monitoring` | Admin | System health, API performance, and technical metrics. |
| **Admin** | `/admin` | Admin | Tenant and user management, high‑level configuration. |

> **Note**: Navigation visibility is controlled in `Sidebar.tsx` via `roles` on each item, and actual permissions are enforced by backend middleware as documented above.

---

## Architecture

- **Monorepo**: `client` + `server`
- **RESTful API** with 70+ route modules
- **Prisma ORM** with 60+ models
- **Event-driven architecture** with in-process event bus (27 event types, 5 built-in subscribers)
- **Event sourcing** for ERP Time Machine
- **Star schema** for Data Warehouse (FactSales, FactInventory)

```
sap/
├── client/                 # React SPA (Vite)
│   └── src/
│       ├── api/             # Axios API client
│       ├── components/      # Reusable UI (DataTable, Modal, Sidebar, TCodePalette, etc.)
│       ├── pages/           # 50+ page modules
│       └── stores/          # Zustand auth store
├── server/                  # Express API
│   ├── prisma/
│   │   └── schema.prisma    # 60+ models
│   └── src/
│       ├── routes/          # 70+ route modules
│       ├── services/        # Event bus, copilot, CRUD
│       ├── middleware/      # auth, rbac, audit, errorHandler
│       └── config.ts
└── package.json
```

---

## Demo Data

Pre-loaded demo data includes:

| Category | Count | Details |
|----------|-------|---------|
| **Users** | 3 | Admin, Instructor, Student |
| **Tenant** | 1 | demo-university |
| **Company Code** | 1 | 1000 - Global Trading Corp |
| **GL Accounts** | 16 | Full chart of accounts |
| **Vendors** | 5 | Steel, Electronics, Raw Materials, Packaging, Chemical |
| **Customers** | 5 | Various industries, credit limits $30K–$200K |
| **Materials** | 8 | Raw, semi-finished, finished, trading |
| **Purchase Orders** | 4+ | Various statuses |
| **Sales Orders** | 3+ | With deliveries and invoices |
| **BOMs** | 2+ | Multi-component structures with routings |
| **Production Orders** | 3+ | Planned, released, in progress |
| **Work Centers** | 5 | CNC Mill, Lathe, Assembly, QA, Packaging |
| **Equipment** | 4+ | Machines, vehicles |
| **Employees** | 10+ | Various departments |
| **Assets** | 5+ | Machinery, vehicles, computers, furniture |
| **Fiscal Periods** | 12 | Full year |
| **T-Codes** | 31+ | ME21N, MIGO, FB50, VA01, CO01, MD01, etc. |
| **Achievements** | 12 | Gamification achievements |
| **Courses & Lessons** | Multiple | Structured learning content |
| **Certifications** | Multiple | Timed exams with tasks |
| **Supply Chain Nodes** | 6+ | Suppliers, factory, warehouses |
| **Optimization Runs** | Sample | Warehouse, production, inventory |
| **Financial Statements** | Sample | Balance sheet, income statement, cash flow |

---

## Database Schema

60+ Prisma models organized by module:

| Module | Models |
|--------|--------|
| **Auth** | Tenant, User, Role, UserRole, RolePermission, AuditLog |
| **Finance** | CompanyCode, GLAccount, JournalEntry, JournalLineItem, FiscalPeriod, BankAccount |
| **AP/AR** | PurchaseRequisition, SupplierInvoice, Payment, Vendor, Customer, Invoice, InvoiceItem |
| **Materials** | Material, Plant, PurchaseOrder, PurchaseOrderItem, GoodsReceipt, GoodsReceiptItem, InventoryMovement |
| **Sales** | SalesOrder, SalesOrderItem, Delivery, DeliveryItem, PricingCondition |
| **Production** | BillOfMaterial, BOMComponent, Routing, ProductionOrder, WorkCenter, ProductionSchedule |
| **Warehouse** | Warehouse, WarehouseBin |
| **Quality** | InspectionLot, InspectionResult, NonConformance |
| **Maintenance** | Equipment, WorkOrder, MaintenancePlan |
| **HR** | Employee, OrgUnit, LeaveRequest, TimeEntry |
| **Controlling** | CostCenter, InternalOrder |
| **MRP** | MrpRun, DemandForecast, PlannedOrder |
| **Supply Chain** | SupplyChainNode, SupplyChainLink |
| **Process Mining** | ProcessEvent |
| **Inventory** | InventoryPolicy |
| **Gamification** | UserXP, Achievement, UserAchievement |
| **Operations** | OperationsMetric |
| **Time Machine** | ERPEvent |
| **Simulator** | SimulationSession, SimulationEvent |
| **Instructor** | InstructorAction |
| **Assets** | Asset, AssetDepreciation |
| **Transport** | Shipment |
| **Costing** | CostEstimate |
| **Multi-Company** | Company, IntercompanyTransaction, TransferPricingRule |
| **Financial Ops** | FinancialStatement, ClosingPeriod |
| **Portals** | PortalAccess |
| **Data Warehouse** | FactSales, FactInventory |
| **Optimization** | OptimizationRun |
| **Integration** | IntegrationEndpoint, IntegrationLog |
| **Documents** | Document |
| **Monitoring** | SystemMetric |
| **Learning** | Course, Lesson, LessonProgress, Exercise, ExerciseProgress, Scenario |
| **Certification** | Certification, CertificationAttempt |
| **Dataset** | DatasetTemplate |
| **Config** | TransactionCode |

---

## API Endpoints

All endpoints are REST, JSON, and require JWT authentication. Base URL: `http://localhost:3001/api`

| Prefix | Description |
|--------|--------------|
| `/api/auth` | Authentication (login, register, profile) |
| `/api/finance` | GL accounts, journal entries, company codes |
| `/api/ap` | Purchase requisitions, supplier invoices, 3-way matching, payment runs |
| `/api/ar` | Customer invoices, aging reports, payments, credit checks |
| `/api/materials` | Materials, purchase orders, goods receipts |
| `/api/sales` | Sales orders, deliveries, invoices |
| `/api/production` | BOMs, production orders |
| `/api/scheduling` | Work centers, schedules, Gantt data |
| `/api/warehouse` | Warehouses, bins |
| `/api/quality` | Inspection lots, non-conformances |
| `/api/maintenance` | Equipment, work orders |
| `/api/hr` | Employees, org units, leave, time entries |
| `/api/controlling` | Cost centers, internal orders |
| `/api/enhanced-inventory` | Stock management, movements, valuation |
| `/api/pricing` | Conditions, price calculation |
| `/api/mrp` | MRP runs, forecasts, planned orders |
| `/api/mrp-board` | MRP Planning Board (12-week timeline, reschedule, supplier change) |
| `/api/multi-company` | Companies, intercompany transactions, transfer pricing |
| `/api/financial-statements` | Balance sheet, income statement, cash flow generation |
| `/api/period-closing` | Month-end closing checklist |
| `/api/portals` | Supplier/customer portal access |
| `/api/data-warehouse` | ETL, fact tables, analytics |
| `/api/optimization` | Warehouse, production, inventory, transport, job-shop, capacity-planning, vehicle-routing, safety-stock optimization |
| `/api/integration` | Webhooks, endpoints, event simulation |
| `/api/documents` | Document upload, attachment to entities |
| `/api/courses` | Courses, lessons, progress |
| `/api/certification` | Certifications, attempts, scoring |
| `/api/dataset-generator` | Generate test datasets |
| `/api/monitoring` | System health, API performance, metrics |
| `/api/supply-chain` | Nodes, links, network optimization |
| `/api/process-mining` | Events, process maps, bottleneck detection, conformance checking, variant discovery, social network |
| `/api/inventory-policies` | EOQ, ROP, ABC classification |
| `/api/operations` | OEE, throughput, KPIs |
| `/api/gamification` | XP, achievements, leaderboard |
| `/api/time-machine` | Events, timeline, snapshots, diffs |
| `/api/simulator` | Live simulation sessions |
| `/api/explainer` | Decision tracing |
| `/api/instructor` | Crisis injection, student monitoring |
| `/api/assets` | Assets, depreciation, disposal |
| `/api/transport` | Shipments, carriers |
| `/api/costing` | Cost estimates, variance |
| `/api/reporting` | Saved reports, dashboards |
| `/api/workflow` | Workflow definitions, instances, configurable rules, rule evaluation, templates |
| `/api/learning` | Exercises, scenarios |
| `/api/admin` | Tenants, users |
| `/api/utilities` | T-codes, sandbox reset, CSV export/import |
| `/api/event-bus` | Publish events, subscribe, recent events, stats, simulate ERP flows (P2P, O2C, Plan-to-Produce) |
| `/api/copilot` | Context-aware AI assistant queries, contextual suggestions |
| `/api/simulation` | Multi-user sessions, role-based collaboration, live event feed |
| `/api/experiment-lab` | Experiment templates, run simulations, history, export results |
| `/api/digital-twin` | Network graph, demand signals |
| `/api/benchmark` | Tournaments, standings, hall of fame, metrics |

---

## What Students Learn

- **Procurement**: Purchase requisitions, 3-way matching, vendor management, goods receipt
- **Sales & Distribution**: Order-to-cash, pricing conditions, deliveries, invoicing
- **Production Planning**: BOMs, routings, production orders, capacity scheduling
- **MRP**: Demand forecasting, net requirements, planned orders, procurement proposals
- **Financial Accounting**: Journal entries, trial balance, AP/AR, fiscal periods
- **Supply Chain Management**: End-to-end flow from supplier to customer
- **Inventory Optimization**: ABC classification, EOQ, safety stock, reorder points
- **ERP Integration**: REST APIs, webhooks, event-driven architecture with event bus
- **Period Closing**: Month-end checklist, financial statement generation
- **Multi-Company**: Intercompany transactions, transfer pricing
- **Quality & Maintenance**: Inspection lots, work orders, preventive maintenance
- **Analytics**: Data warehouse, OLAP, KPI dashboards, process mining with conformance checking
- **Process Mining**: Bottleneck detection, conformance checking, variant discovery, organizational analysis
- **Supply Chain Digital Twin**: Network visualization, demand forecasting, simulation
- **Optimization**: Job-shop scheduling, capacity planning, vehicle routing, safety stock analysis
- **Workflow Automation**: Configurable business rules, condition evaluation, auto-routing
- **Collaborative Simulation**: Multi-user role-based ERP simulation with live event feed
- **Competitive Benchmarking**: Tournament mode, multi-metric scoring, hall of fame
- **Research Methods**: Controlled experiments (EOQ vs (s,S), lot sizing, bullwhip effect, scheduling rules), exportable results

---

## License

MIT
