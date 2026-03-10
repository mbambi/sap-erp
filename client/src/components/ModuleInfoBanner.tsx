import { useLocation } from "react-router-dom";
import {
  Info,
  Landmark,
  Calculator,
  Package,
  ShoppingCart,
  Factory,
  Warehouse,
  ClipboardCheck,
  Wrench,
  Users,
  Boxes,
  Building2,
  Laptop,
  Truck,
  Network,
  Workflow,
  Sparkles,
  Radar,
  FileSpreadsheet,
  PieChart,
  GitBranch,
  Activity,
  Database,
  Link2,
  FileText,
  Globe,
  GraduationCap,
  Trophy,
  Gamepad2,
  Scale,
  Zap,
  FlaskConical,
  Bot,
  Clock,
  HelpCircle,
  DollarSign,
  Shield,
  Eye,
  Gauge,
  Settings,
  Film,
  Brain,
  Terminal,
} from "lucide-react";

interface RouteInfo {
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  tips?: string[];
}

const ROUTE_INFO: Record<string, RouteInfo> = {
  // Finance
  "/finance/journal-entries": {
    title: "General Ledger — Journal Entries",
    description:
      "Record every financial transaction using double-entry bookkeeping. Each journal entry must balance: total debits must equal total credits. This is the backbone of the entire accounting system — every purchase, sale, payment, and expense flows through here.",
    icon: Landmark,
    color: "bg-blue-50 border-blue-200 text-blue-800",
    tips: [
      "Debits increase asset & expense accounts; credits increase liability, equity & revenue accounts.",
      "Post date determines which fiscal period the entry falls in.",
      "Use 'Reverse' to correct a posted entry — never delete posted journal entries.",
    ],
  },
  "/finance/gl-accounts": {
    title: "Chart of Accounts — GL Accounts",
    description:
      "The Chart of Accounts is the master list of all ledger accounts used to classify financial transactions. Each account has a type (asset, liability, equity, revenue, or expense) that determines how it appears in financial statements.",
    icon: Landmark,
    color: "bg-blue-50 border-blue-200 text-blue-800",
    tips: [
      "Account numbers are structured: 1xxxxx = Assets, 2xxxxx = Liabilities, 3xxxxx = Equity, 4xxxxx = Revenue, 5-7xxxxx = Expenses.",
      "Blocked accounts cannot receive new postings.",
    ],
  },
  "/finance/company-codes": {
    title: "Company Codes",
    description:
      "A company code is the smallest organizational unit for which a complete, self-contained set of accounts can be drawn up. In SAP, every financial document belongs to exactly one company code, enabling multi-company reporting and consolidation.",
    icon: Landmark,
    color: "bg-blue-50 border-blue-200 text-blue-800",
  },
  "/finance/vendors": {
    title: "Vendor Master Data",
    description:
      "Vendors (suppliers) are companies or individuals from whom you procure goods or services. The vendor master stores contact details, payment terms, and bank information. Accurate vendor data is critical for the procure-to-pay process.",
    icon: Landmark,
    color: "bg-blue-50 border-blue-200 text-blue-800",
    tips: [
      "Payment terms (NET30, NET45) determine when invoices must be paid.",
      "Vendor numbers are used on purchase orders and supplier invoices.",
    ],
  },
  "/finance/customers": {
    title: "Customer Master Data",
    description:
      "Customers are the parties that purchase your goods or services. The customer master holds billing addresses, credit limits, and payment terms. It drives the order-to-cash process from sales order through invoice collection.",
    icon: Landmark,
    color: "bg-blue-50 border-blue-200 text-blue-800",
    tips: [
      "Credit limits prevent orders that would exceed a customer's approved exposure.",
      "Customer numbers link sales orders, deliveries, and invoices together.",
    ],
  },
  "/finance/trial-balance": {
    title: "Trial Balance Report",
    description:
      "The trial balance lists all GL accounts with their debit and credit totals for a period. It verifies that the books are balanced (total debits = total credits) and is the starting point for preparing financial statements.",
    icon: Landmark,
    color: "bg-blue-50 border-blue-200 text-blue-800",
  },
  "/finance/analytics": {
    title: "Financial Analytics",
    description:
      "Advanced financial dashboards and trend analysis across revenue, expenses, profitability, and cash flow. Use these charts to identify patterns, compare periods, and support management decision-making.",
    icon: Landmark,
    color: "bg-blue-50 border-blue-200 text-blue-800",
  },
  "/finance/ap": {
    title: "Accounts Payable (FI-AP)",
    description:
      "Accounts Payable manages money owed to vendors for goods and services received. Track open invoices, payment due dates, and process payments. A key metric is Days Payable Outstanding (DPO) — how long you take to pay suppliers.",
    icon: Landmark,
    color: "bg-blue-50 border-blue-200 text-blue-800",
    tips: [
      "Paying on time maintains good supplier relationships and may unlock early-payment discounts.",
      "Three-way match: PO ↔ Goods Receipt ↔ Invoice must align before payment.",
    ],
  },
  "/finance/ar": {
    title: "Accounts Receivable (FI-AR)",
    description:
      "Accounts Receivable tracks money owed by customers for goods or services you have delivered. Monitor aging reports to identify overdue invoices and manage collections. Days Sales Outstanding (DSO) measures collection efficiency.",
    icon: Landmark,
    color: "bg-blue-50 border-blue-200 text-blue-800",
    tips: [
      "Aging buckets (0-30, 31-60, 61-90, 90+ days) help prioritize collection efforts.",
      "Credit memos reduce the amount a customer owes.",
    ],
  },
  "/finance/pricing": {
    title: "Pricing Engine (SD-PR)",
    description:
      "The pricing engine calculates the final price of goods and services using condition records. Conditions can include base prices, customer-specific discounts, volume rebates, freight charges, and taxes — all applied in a defined sequence.",
    icon: Landmark,
    color: "bg-blue-50 border-blue-200 text-blue-800",
  },

  // Controlling
  "/controlling/cost-centers": {
    title: "Cost Centers (CO-CCA)",
    description:
      "Cost centers are organizational units where costs are incurred. Examples: Production, Administration, Sales & Marketing, R&D. By assigning expenses to cost centers you can track where money is being spent and compare actual vs. planned costs.",
    icon: Calculator,
    color: "bg-violet-50 border-violet-200 text-violet-800",
    tips: [
      "Cost centers roll up into cost center groups for hierarchical reporting.",
      "Budget vs. actual variance analysis is a key controlling activity.",
    ],
  },
  "/controlling/internal-orders": {
    title: "Internal Orders (CO-OPA)",
    description:
      "Internal orders track costs for specific short-term tasks or events — such as a marketing campaign, a facility repair project, or a trade show. They provide more granular tracking than cost centers alone.",
    icon: Calculator,
    color: "bg-violet-50 border-violet-200 text-violet-800",
  },

  // Materials Management
  "/materials/items": {
    title: "Material Master (MM-BD)",
    description:
      "The material master is the central repository for all data about every material (product, raw material, or component) that a company procures, produces, stores, or sells. It is the most important master data object in SAP MM.",
    icon: Package,
    color: "bg-amber-50 border-amber-200 text-amber-800",
    tips: [
      "Material types: RAW (raw materials), SEMI (semi-finished), FERT (finished goods), HAWA (trading goods).",
      "Reorder point triggers automatic purchase requisitions when stock falls below the threshold.",
      "Lead time defines how many days it takes to replenish the material.",
    ],
  },
  "/materials/purchase-orders": {
    title: "Purchase Orders (MM-PUR)",
    description:
      "A purchase order is a formal document sent to a vendor authorizing the purchase of goods or services at agreed prices and quantities. It is the core document of the procure-to-pay process. Once approved, the vendor ships goods and sends an invoice.",
    icon: Package,
    color: "bg-amber-50 border-amber-200 text-amber-800",
    tips: [
      "PO lifecycle: Draft → Approved → Ordered → Partially Received → Received.",
      "Each line item specifies material, quantity, price, and delivery date.",
      "Three-way match at invoice verification: PO quantity = GR quantity = Invoice quantity.",
    ],
  },
  "/materials/goods-receipts": {
    title: "Goods Receipts (MM-IM)",
    description:
      "A goods receipt (GR) confirms that ordered goods have physically arrived at your warehouse. Posting a GR increases inventory stock, triggers quality inspection if configured, and creates the basis for invoice verification against the purchase order.",
    icon: Package,
    color: "bg-amber-50 border-amber-200 text-amber-800",
  },
  "/materials/inventory": {
    title: "Inventory Overview (MM-IM)",
    description:
      "Real-time view of all stock levels across materials, plants, and storage locations. Monitor current quantities, value of inventory, slow-moving items, and stock that is below reorder point. Accurate inventory is essential for planning and costing.",
    icon: Package,
    color: "bg-amber-50 border-amber-200 text-amber-800",
  },
  "/materials/plants": {
    title: "Plant Master Data",
    description:
      "A plant is an organizational unit where production, storage, and procurement activities take place. Plants are linked to company codes and contain warehouses, work centers, and equipment. All inventory and production transactions are plant-specific.",
    icon: Package,
    color: "bg-amber-50 border-amber-200 text-amber-800",
  },
  "/inventory/analytics": {
    title: "Inventory Analytics",
    description:
      "Deep-dive analytics for inventory performance: ABC classification (vital few vs. trivial many), turnover ratios, carrying costs, stockout risks, and demand patterns. Use these insights to optimize stock levels and reduce working capital.",
    icon: Package,
    color: "bg-amber-50 border-amber-200 text-amber-800",
    tips: [
      "ABC analysis: A-items (high value, ~20% of items = ~80% of value) need tightest control.",
      "High inventory turnover = fast-moving stock; low turnover = potential obsolescence.",
    ],
  },
  "/inventory/stock": {
    title: "Stock Management",
    description:
      "Manage stock movements including transfers between storage locations, stock adjustments, scrapping, and reservations for production orders. Every movement creates a material document that provides a full audit trail.",
    icon: Package,
    color: "bg-amber-50 border-amber-200 text-amber-800",
  },
  "/inventory/simulator": {
    title: "Inventory Simulator",
    description:
      "Simulate inventory policies (reorder point, min-max, safety stock) under different demand scenarios to find the optimal balance between service level and inventory cost. Experiment without affecting real production data.",
    icon: Package,
    color: "bg-amber-50 border-amber-200 text-amber-800",
  },

  // Sales
  "/sales/orders": {
    title: "Sales Orders (SD-OR)",
    description:
      "A sales order is a binding agreement between your company and a customer to deliver goods or services at a specified price and date. It triggers the entire order-to-cash process: delivery, goods issue, invoicing, and payment collection.",
    icon: ShoppingCart,
    color: "bg-green-50 border-green-200 text-green-800",
    tips: [
      "SO lifecycle: Draft → Confirmed → Processing → Shipped → Completed.",
      "Credit check runs automatically at order creation based on customer credit limit.",
      "Requested delivery date drives backward scheduling through the supply chain.",
    ],
  },
  "/sales/deliveries": {
    title: "Outbound Deliveries (SD-SHP)",
    description:
      "A delivery document authorizes the warehouse to pick, pack, and ship goods to the customer. Posting the goods issue (GI) reduces inventory and records the cost of goods sold. The delivery is the link between the sales order and the invoice.",
    icon: ShoppingCart,
    color: "bg-green-50 border-green-200 text-green-800",
  },
  "/sales/invoices": {
    title: "Customer Invoices (SD-BIL)",
    description:
      "An invoice is the request for payment sent to the customer after goods have been delivered. It references the sales order and delivery, records revenue in the general ledger, and creates an open item in accounts receivable.",
    icon: ShoppingCart,
    color: "bg-green-50 border-green-200 text-green-800",
    tips: [
      "Invoice → AR posting → Customer pays → Clear open item.",
      "Credit memos are issued for returns, price corrections, or goodwill.",
    ],
  },

  // Production
  "/production/boms": {
    title: "Bills of Materials (PP-BD)",
    description:
      "A bill of materials (BOM) lists all components and quantities needed to manufacture one unit of a finished or semi-finished product. BOMs drive production orders, MRP calculations, and product costing. They define the 'recipe' for manufacturing.",
    icon: Factory,
    color: "bg-orange-50 border-orange-200 text-orange-800",
    tips: [
      "Multi-level BOMs: a finished product BOM may reference semi-finished BOMs.",
      "BOM explosion in MRP calculates total component requirements from planned production.",
    ],
  },
  "/production/orders": {
    title: "Production Orders (PP-SFC)",
    description:
      "A production order authorizes the shop floor to manufacture a specific quantity of a material by a specified date. It triggers material staging, capacity scheduling, and cost collection. Actual costs are compared to standard cost at order settlement.",
    icon: Factory,
    color: "bg-orange-50 border-orange-200 text-orange-800",
    tips: [
      "Order lifecycle: Created → Released → In Progress → Technically Complete → Settled.",
      "Backflushing automatically posts goods issue for components when the order is confirmed.",
    ],
  },
  "/production/scheduling": {
    title: "Production Scheduling Board",
    description:
      "A visual Gantt-style board for planning and sequencing production orders across work centers. Drag and drop orders to resolve capacity conflicts, minimize changeover times, and meet delivery commitments. Finite scheduling respects work center capacity limits.",
    icon: Factory,
    color: "bg-orange-50 border-orange-200 text-orange-800",
  },
  "/operations/dashboard": {
    title: "Operations Dashboard",
    description:
      "A real-time overview of production operations: OEE (Overall Equipment Effectiveness), throughput, scrap rates, order completion status, and capacity utilization. The single source of truth for shift supervisors and production managers.",
    icon: Factory,
    color: "bg-orange-50 border-orange-200 text-orange-800",
  },

  // Warehouse
  "/warehouse/list": {
    title: "Warehouse Management (WM)",
    description:
      "Warehouse Management controls the physical movement and storage of goods within your facility. It manages multiple warehouses, storage types (bulk, high-rack, picking), and bin-level stock. It enables barcode-driven, paperless warehouse operations.",
    icon: Warehouse,
    color: "bg-teal-50 border-teal-200 text-teal-800",
  },
  "/warehouse/bins": {
    title: "Bin Management (WM-BIN)",
    description:
      "Storage bins are the smallest addressable locations in a warehouse (e.g., Row A, Aisle 01, Level 02, Bin 03). Bin management enables precise stock placement, directed putaway strategies, and efficient pick routes for warehouse workers.",
    icon: Warehouse,
    color: "bg-teal-50 border-teal-200 text-teal-800",
    tips: [
      "Bin types: Receiving → Bulk Storage → Picking → Shipping.",
      "Zone layouts (A, B, C) can reflect ABC inventory classification for optimized picking.",
    ],
  },

  // Quality
  "/quality/inspections": {
    title: "Quality Inspection Lots (QM-IM)",
    description:
      "An inspection lot is created automatically when goods are received, produced, or returned. It defines the scope of quality checks required. Results are recorded against the inspection lot, and the usage decision determines whether the stock is released or blocked.",
    icon: ClipboardCheck,
    color: "bg-cyan-50 border-cyan-200 text-cyan-800",
    tips: [
      "Inspection types: incoming goods (01), in-process (10), final inspection (04).",
      "Usage decision: Accept → stock is unrestricted; Reject → stock is scrapped or returned.",
    ],
  },
  "/quality/non-conformances": {
    title: "Non-Conformances (QM-NC)",
    description:
      "A non-conformance report (NCR) documents a product or process that does not meet defined specifications. It triggers a corrective action workflow (CAPA — Corrective and Preventive Action) to identify root causes and prevent recurrence.",
    icon: ClipboardCheck,
    color: "bg-cyan-50 border-cyan-200 text-cyan-800",
  },

  // Maintenance
  "/maintenance/equipment": {
    title: "Equipment Master (PM-EQM)",
    description:
      "The equipment master contains technical data for every maintainable asset: machines, vehicles, instruments, and facilities. It stores manufacturer info, installation date, maintenance history, and spare parts lists. It is the foundation for all maintenance planning.",
    icon: Wrench,
    color: "bg-rose-50 border-rose-200 text-rose-800",
    tips: [
      "Criticality levels (critical, high, medium, low) prioritize maintenance resources.",
      "Mean Time Between Failures (MTBF) and Mean Time To Repair (MTTR) are key reliability KPIs.",
    ],
  },
  "/maintenance/work-orders": {
    title: "Maintenance Work Orders (PM-WOC)",
    description:
      "A maintenance work order authorizes and documents repair or preventive maintenance tasks on equipment. It captures planned vs. actual labor, materials consumed, and downtime. Closed work orders feed maintenance cost history for lifecycle costing.",
    icon: Wrench,
    color: "bg-rose-50 border-rose-200 text-rose-800",
    tips: [
      "Types: Preventive Maintenance (PM), Corrective Maintenance (CM), Inspection.",
      "OEE impact: planned maintenance reduces availability but prevents unplanned breakdowns.",
    ],
  },

  // HR
  "/hr/employees": {
    title: "Employee Master Data (HR-PA)",
    description:
      "The employee master stores all personal, organizational, and compensation data for every employee. It is the starting point for all HR processes: payroll, time management, performance, and succession planning.",
    icon: Users,
    color: "bg-purple-50 border-purple-200 text-purple-800",
  },
  "/hr/org-units": {
    title: "Organizational Structure (HR-OM)",
    description:
      "The organizational structure defines the hierarchy of your company: divisions, departments, teams, and positions. It drives cost center assignments, approval workflows, reporting lines, and headcount analysis.",
    icon: Users,
    color: "bg-purple-50 border-purple-200 text-purple-800",
  },
  "/hr/leave-requests": {
    title: "Leave Requests (HR-TM)",
    description:
      "Manage employee leave requests and approvals: annual leave, sick leave, unpaid leave, and special absences. Leave balances are tracked per employee, and approved absences feed into time management and payroll.",
    icon: Users,
    color: "bg-purple-50 border-purple-200 text-purple-800",
  },
  "/hr/time-entries": {
    title: "Time Entries (HR-TM)",
    description:
      "Record actual working hours against projects, cost centers, or production orders. Time entries feed into payroll calculations and project costing. Overtime, shift differentials, and attendance deviations are tracked here.",
    icon: Users,
    color: "bg-purple-50 border-purple-200 text-purple-800",
  },

  // MRP
  "/mrp": {
    title: "Material Requirements Planning (PP-MRP)",
    description:
      "MRP calculates what materials are needed, in what quantities, and by when — based on sales orders, production plans, and inventory levels. It explodes BOMs to determine component requirements and generates planned orders to cover shortages.",
    icon: Boxes,
    color: "bg-indigo-50 border-indigo-200 text-indigo-800",
    tips: [
      "MRP logic: Gross Requirement - Available Stock - Planned Receipts = Net Requirement.",
      "Planned orders are proposals; they must be converted to POs or production orders to action them.",
      "Re-order point planning vs. MRP: MRP is demand-driven; ROP is consumption-driven.",
    ],
  },
  "/mrp-board": {
    title: "MRP Planning Board",
    description:
      "A visual planning board that shows the stock/requirements situation over time for each material. Green = surplus, red = shortage. Use it to review MRP results, manually adjust planned orders, and communicate supply shortages to the production team.",
    icon: Boxes,
    color: "bg-indigo-50 border-indigo-200 text-indigo-800",
  },

  // Supply Chain
  "/supply-chain/network": {
    title: "Supply Chain Network Map",
    description:
      "A visual map of your entire supply chain: suppliers, plants, distribution centers, and customers connected by transport lanes. Use it to analyze network topology, identify single points of failure, and model distribution strategies.",
    icon: Network,
    color: "bg-sky-50 border-sky-200 text-sky-800",
  },
  "/supply-chain/editor": {
    title: "Supply Chain Network Editor",
    description:
      "Build and modify your supply chain network model by adding nodes (facilities) and lanes (transport routes). Define capacities, lead times, and costs for each lane. The model feeds into optimization and simulation tools.",
    icon: Network,
    color: "bg-sky-50 border-sky-200 text-sky-800",
  },
  "/multi-echelon": {
    title: "Multi-Echelon Inventory",
    description:
      "Multi-echelon inventory optimization determines the optimal stock levels at each tier of the supply chain (supplier → DC → store) simultaneously. Unlike single-location models, it accounts for demand pooling and risk sharing across echelons.",
    icon: Network,
    color: "bg-sky-50 border-sky-200 text-sky-800",
  },
  "/forecasting": {
    title: "Demand Forecasting Engine",
    description:
      "Statistical demand forecasting using time-series methods (moving average, exponential smoothing, seasonal decomposition). Accurate forecasts drive better production planning, inventory positioning, and purchase order timing.",
    icon: Network,
    color: "bg-sky-50 border-sky-200 text-sky-800",
  },

  // Process
  "/process-flows": {
    title: "Process Flow Designer",
    description:
      "Design and document business processes as visual flow diagrams. Map end-to-end ERP processes (procure-to-pay, order-to-cash, plan-to-produce) to understand system integration points, approval steps, and data flows between modules.",
    icon: Workflow,
    color: "bg-slate-50 border-slate-200 text-slate-800",
  },
  "/process-visualizer": {
    title: "Process Visualizer",
    description:
      "Animate and replay ERP business processes step by step. See how data moves between modules in real time — from purchase order creation through goods receipt, invoice verification, and payment. Ideal for learning complex cross-module processes.",
    icon: Sparkles,
    color: "bg-slate-50 border-slate-200 text-slate-800",
  },
  "/process-mining": {
    title: "Process Mining (PM)",
    description:
      "Process mining automatically discovers your actual business processes from system event logs. Compare the discovered process to the ideal process to find bottlenecks, deviations, rework loops, and compliance violations.",
    icon: GitBranch,
    color: "bg-slate-50 border-slate-200 text-slate-800",
    tips: [
      "Conformance checking shows where real processes deviate from the designed process.",
      "Case duration analysis identifies where time is being lost in the process.",
    ],
  },
  "/digital-twin": {
    title: "Digital Twin Simulation",
    description:
      "A digital twin is a virtual replica of your physical operations — production lines, warehouses, or supply chain networks. Simulate disruptions, test process changes, and predict outcomes before implementing them in the real system.",
    icon: Radar,
    color: "bg-slate-50 border-slate-200 text-slate-800",
  },

  // Finance Ops
  "/financial-statements": {
    title: "Financial Statements",
    description:
      "Automated preparation of the three core financial statements: Income Statement (P&L), Balance Sheet, and Cash Flow Statement. These are generated directly from GL postings and provide the official picture of a company's financial health.",
    icon: FileSpreadsheet,
    color: "bg-blue-50 border-blue-200 text-blue-800",
    tips: [
      "P&L = Revenue - Expenses = Net Income.",
      "Balance Sheet: Assets = Liabilities + Equity (must always balance).",
      "Cash Flow Statement reconciles net income with actual cash movements.",
    ],
  },
  "/period-closing": {
    title: "Period-End Closing (FI-GL)",
    description:
      "Period closing is the set of activities performed at month-end or year-end to finalize the books: depreciation posting, accruals, intercompany reconciliation, balance carryforward, and financial statement preparation. It locks the period to prevent backdated postings.",
    icon: FileSpreadsheet,
    color: "bg-blue-50 border-blue-200 text-blue-800",
  },

  // Reporting
  "/reporting": {
    title: "Reporting Dashboard",
    description:
      "Central reporting hub with pre-built KPI dashboards covering all ERP modules. Track open purchase orders, sales pipeline, inventory levels, production efficiency, financial ratios, and HR metrics in one place.",
    icon: PieChart,
    color: "bg-emerald-50 border-emerald-200 text-emerald-800",
  },

  // Workflow
  "/workflow": {
    title: "Workflow Management",
    description:
      "Workflow automates approval processes: purchase order approvals, leave request sign-offs, quality deviations, and credit limit exceptions. Each workflow step routes documents to the correct approver and escalates if not actioned within the SLA.",
    icon: GitBranch,
    color: "bg-slate-50 border-slate-200 text-slate-800",
  },
  "/workflow/builder": {
    title: "Workflow Builder",
    description:
      "Design custom approval workflows visually. Define triggers (e.g., PO value > $10,000), steps (approver roles), conditions (parallel or sequential), and timeout escalations. Workflows enforce segregation of duties and authorization controls.",
    icon: GitBranch,
    color: "bg-slate-50 border-slate-200 text-slate-800",
  },

  // Analytics & BI
  "/data-warehouse": {
    title: "Data Warehouse (BW)",
    description:
      "The analytical data store optimized for reporting and BI. Data from all ERP modules is extracted, transformed, and loaded (ETL) into star-schema fact and dimension tables. Run complex analytical queries without impacting operational performance.",
    icon: Database,
    color: "bg-indigo-50 border-indigo-200 text-indigo-800",
  },
  "/data-lab": {
    title: "Data Export Lab",
    description:
      "Export data from any ERP module in CSV, JSON, or Excel format. Use it for ad-hoc analysis in external tools, academic research, or data science projects. All exports are tenant-scoped and logged for audit purposes.",
    icon: Database,
    color: "bg-indigo-50 border-indigo-200 text-indigo-800",
  },
  "/optimization": {
    title: "Optimization Engine",
    description:
      "Mathematical optimization algorithms (linear programming, heuristics) for supply chain and production decisions: network flow optimization, vehicle routing, production lot sizing, and inventory rebalancing across locations.",
    icon: Database,
    color: "bg-indigo-50 border-indigo-200 text-indigo-800",
  },
  "/decision-impact": {
    title: "Decision Impact Analyzer",
    description:
      "Model the downstream financial and operational impact of decisions before making them. What happens to working capital if you extend vendor payment terms? How does a 10% price increase affect sales volume? Quantify trade-offs with data.",
    icon: Database,
    color: "bg-indigo-50 border-indigo-200 text-indigo-800",
  },
  "/sql-explorer": {
    title: "SQL Explorer",
    description:
      "Write and execute read-only SQL SELECT queries against the ERP database to explore data relationships and build custom reports. All queries are automatically filtered to your organization's data — you cannot access other tenants' data.",
    icon: Terminal,
    color: "bg-gray-50 border-gray-200 text-gray-800",
    tips: [
      "Only SELECT statements are allowed — INSERT, UPDATE, DELETE, and DROP are blocked.",
      "UNION queries are disabled to prevent tenant data leakage.",
      'Try: SELECT materialNumber, description, stockQuantity FROM "Material" ORDER BY stockQuantity DESC',
    ],
  },
  "/role-dashboard": {
    title: "Role-Based Dashboards",
    description:
      "Tailored dashboards for each role in the organization: CFO (financial summary), Operations Manager (production KPIs), Procurement Manager (purchasing metrics), and more. Each dashboard surfaces the most relevant data for that role's responsibilities.",
    icon: Database,
    color: "bg-indigo-50 border-indigo-200 text-indigo-800",
  },

  // Integration
  "/integration": {
    title: "Integration Hub",
    description:
      "Connect this ERP to external systems via REST APIs, webhooks, and file-based interfaces. Configure integration endpoints for e-commerce platforms, banking systems, logistics providers, and third-party analytics tools.",
    icon: Link2,
    color: "bg-slate-50 border-slate-200 text-slate-800",
  },
  "/documents": {
    title: "Document Management",
    description:
      "Central repository for business documents: contracts, certificates, technical drawings, quality records, and correspondence. Documents are linked to ERP objects (purchase orders, equipment, etc.) and version-controlled.",
    icon: FileText,
    color: "bg-slate-50 border-slate-200 text-slate-800",
  },
  "/portals": {
    title: "External Portals",
    description:
      "Self-service portals for external stakeholders: vendor portal (submit invoices, view POs), customer portal (track orders, view invoices), and employee self-service. Portals reduce administrative overhead and improve stakeholder experience.",
    icon: Globe,
    color: "bg-slate-50 border-slate-200 text-slate-800",
  },

  // Learning
  "/learning": {
    title: "Learning Hub",
    description:
      "Guided exercises and tutorials to learn ERP concepts hands-on. Each exercise walks you through a real business process step by step. Complete exercises to earn XP and unlock achievements.",
    icon: GraduationCap,
    color: "bg-emerald-50 border-emerald-200 text-emerald-800",
  },
  "/learning/analytics": {
    title: "My Learning Progress",
    description:
      "Track your learning journey: completed exercises, course progress, certification attempts, and skill development over time. See how you compare with your peers on the class leaderboard.",
    icon: GraduationCap,
    color: "bg-emerald-50 border-emerald-200 text-emerald-800",
  },
  "/courses": {
    title: "Course Catalog",
    description:
      "Structured learning courses covering ERP fundamentals, supply chain management, financial accounting, and integration architecture. Each course has multiple lessons with interactive content and assessments.",
    icon: GraduationCap,
    color: "bg-emerald-50 border-emerald-200 text-emerald-800",
  },
  "/certification": {
    title: "ERP Certification Center",
    description:
      "Timed practical exams that test your ability to complete real ERP workflows. Pass certifications to prove your mastery of procurement (P2P), sales (O2C), production planning, and more.",
    icon: GraduationCap,
    color: "bg-emerald-50 border-emerald-200 text-emerald-800",
  },

  // Gamification & Competition
  "/gamification": {
    title: "Gamification & Achievements",
    description:
      "Earn XP points and unlock achievements as you use the ERP system. Complete exercises, create transactions, and master business processes to climb the leaderboard and earn badges.",
    icon: Trophy,
    color: "bg-amber-50 border-amber-200 text-amber-800",
  },
  "/game": {
    title: "Supply Chain Game",
    description:
      "Compete against classmates to run the most profitable company. Make procurement, production, and sales decisions in a simulated market. Your performance is scored on profitability, service level, and efficiency.",
    icon: Gamepad2,
    color: "bg-amber-50 border-amber-200 text-amber-800",
  },
  "/benchmark": {
    title: "ERP Benchmark Competition",
    description:
      "Tournament-style ERP performance competition. Your decisions are scored across multiple weighted metrics: profit, inventory turnover, service level, production efficiency, and on-time delivery.",
    icon: Scale,
    color: "bg-amber-50 border-amber-200 text-amber-800",
  },
  "/stress-test": {
    title: "Stress Test Scenarios",
    description:
      "Face real-world supply chain crises: demand spikes, supplier bankruptcies, quality recalls, and logistics disruptions. React quickly and make decisions under pressure. Your response is scored.",
    icon: Zap,
    color: "bg-red-50 border-red-200 text-red-800",
  },

  // Advanced Simulation & Research
  "/event-bus": {
    title: "Event Bus Architecture",
    description:
      "Explore the event-driven architecture powering cross-module communication. See how creating a purchase order triggers inventory updates, financial postings, and analytics events in real time.",
    icon: Zap,
    color: "bg-purple-50 border-purple-200 text-purple-800",
  },
  "/simulation": {
    title: "Multi-User Simulation",
    description:
      "Real-time collaborative ERP simulation where each student takes a role (procurement, production, warehouse, finance, sales, quality). Work together to run the company efficiently.",
    icon: Users,
    color: "bg-purple-50 border-purple-200 text-purple-800",
  },
  "/experiment-lab": {
    title: "Experiment Lab",
    description:
      "Research-grade simulation experiments: compare inventory policies (EOQ vs (s,S)), lot sizing methods, safety stock trade-offs, bullwhip effect, and scheduling rules. Export results for academic papers.",
    icon: FlaskConical,
    color: "bg-purple-50 border-purple-200 text-purple-800",
  },
  "/scenario-replay": {
    title: "Scenario Replay",
    description:
      "Replay past scenario simulations step by step. Analyze your decisions, compare alternative outcomes, and learn from your mistakes. Perfect for post-session review and class discussions.",
    icon: Film,
    color: "bg-purple-50 border-purple-200 text-purple-800",
  },
  "/recommendations": {
    title: "AI Recommendations",
    description:
      "AI-powered suggestions based on your ERP data: reorder materials running low, optimize production schedules, identify cost-saving opportunities, and flag anomalies in financial data.",
    icon: Brain,
    color: "bg-purple-50 border-purple-200 text-purple-800",
  },
  "/copilot": {
    title: "ERP AI Copilot",
    description:
      "Context-aware AI assistant that understands your ERP data. Ask natural language questions about inventory levels, production status, financial health, and get actionable answers with data.",
    icon: Bot,
    color: "bg-purple-50 border-purple-200 text-purple-800",
  },
  "/time-machine": {
    title: "ERP Time Machine",
    description:
      "Rewind and replay the entire ERP system state through time using event sourcing. See how inventory, orders, and financials evolved day by day. Perfect for understanding cause-and-effect in ERP processes.",
    icon: Clock,
    color: "bg-purple-50 border-purple-200 text-purple-800",
  },
  "/simulator": {
    title: "Live Supply Chain Simulator",
    description:
      "Real-time simulation engine where you manage a supply chain under live conditions. Demand fluctuates, suppliers deliver late, machines break down. Your job is to keep the operation running smoothly.",
    icon: Gamepad2,
    color: "bg-amber-50 border-amber-200 text-amber-800",
  },
  "/explainer": {
    title: "Explainable ERP",
    description:
      "Understand WHY the ERP system made specific decisions. Trace MRP planned orders back to demand sources, understand why a payment was blocked, or see why a quality lot was rejected — with full audit trails.",
    icon: HelpCircle,
    color: "bg-purple-50 border-purple-200 text-purple-800",
  },
  "/costing": {
    title: "Product Costing",
    description:
      "Calculate the true manufacturing cost of finished products by rolling up material costs (from BOMs), labor costs (from routings), and overhead allocations. Compare standard vs actual costs and analyze variances.",
    icon: DollarSign,
    color: "bg-blue-50 border-blue-200 text-blue-800",
  },

  // Instructor & Admin
  "/instructor": {
    title: "Instructor Control Panel",
    description:
      "Monitor student activity in real time, inject supply chain crises, freeze inventory, change demand patterns, and manage sandbox environments. Use the scenario builder to create custom learning exercises.",
    icon: Shield,
    color: "bg-rose-50 border-rose-200 text-rose-800",
  },
  "/instructor/analytics": {
    title: "Class Analytics",
    description:
      "Visualize class-wide engagement: which modules are most used, average exercise scores, certification pass rates, and learning velocity. Identify students who need extra help.",
    icon: Shield,
    color: "bg-rose-50 border-rose-200 text-rose-800",
  },
  "/instructor/assignments": {
    title: "Assignment Builder",
    description:
      "Create structured assignments with deadlines, rubrics, and auto-grading rules. Assign specific ERP tasks (create a PO, post a journal entry) and track student completion.",
    icon: Shield,
    color: "bg-rose-50 border-rose-200 text-rose-800",
  },
  "/instructor/scenarios": {
    title: "Scenario Builder",
    description:
      "Design custom supply chain scenarios for your class. Define demand patterns, supplier behavior, quality issues, and logistics constraints. Students experience these scenarios in real time.",
    icon: Shield,
    color: "bg-rose-50 border-rose-200 text-rose-800",
  },
  "/sandbox": {
    title: "Sandbox Manager",
    description:
      "Manage student sandboxes: reset data to a clean state, clone environments, and configure starting conditions. Each student gets an isolated environment for safe experimentation.",
    icon: Shield,
    color: "bg-rose-50 border-rose-200 text-rose-800",
  },
  "/dataset-generator": {
    title: "Dataset Generator",
    description:
      "Generate realistic synthetic ERP data at scale. Create thousands of purchase orders, sales orders, materials, and financial transactions for testing, demonstrations, and research.",
    icon: Shield,
    color: "bg-rose-50 border-rose-200 text-rose-800",
  },
  "/industry-templates": {
    title: "Industry Templates",
    description:
      "Pre-built ERP configurations for specific industries: Automotive, Retail, Pharmaceutical, Electronics, and Food & Beverage. Each template includes materials, BOMs, vendors, customers, and work centers.",
    icon: Shield,
    color: "bg-rose-50 border-rose-200 text-rose-800",
  },

  // Utilities
  "/tools/api-playground": {
    title: "API Playground",
    description:
      "Built-in API testing tool (like Postman). Test any ERP API endpoint with custom payloads, view responses, and explore the REST API. Great for understanding how ERP integrations work.",
    icon: Terminal,
    color: "bg-gray-50 border-gray-200 text-gray-800",
  },

  // Audit & Admin
  "/audit": {
    title: "Audit Trail",
    description:
      "Complete audit log of all actions performed in the system: who did what, when, and on which record. Essential for compliance, fraud detection, and regulatory reporting.",
    icon: Eye,
    color: "bg-slate-50 border-slate-200 text-slate-800",
  },
  "/monitoring": {
    title: "System Monitoring",
    description:
      "Real-time system health metrics: API response times, database performance, error rates, active users, and resource utilization. Alerts when thresholds are exceeded.",
    icon: Gauge,
    color: "bg-slate-50 border-slate-200 text-slate-800",
  },
  "/admin": {
    title: "Administration Panel",
    description:
      "System administration: manage users, roles, permissions, tenants, and system configuration. Control who can access what across the entire platform.",
    icon: Settings,
    color: "bg-slate-50 border-slate-200 text-slate-800",
  },
};

export default function ModuleInfoBanner() {
  const location = useLocation();

  // Find matching route info - try exact match first, then prefix match
  let info = ROUTE_INFO[location.pathname];
  if (!info) {
    const paths = Object.keys(ROUTE_INFO).sort((a, b) => b.length - a.length);
    for (const p of paths) {
      if (location.pathname.startsWith(p)) {
        info = ROUTE_INFO[p];
        break;
      }
    }
  }

  if (!info) return null;

  const Icon = info.icon;

  return (
    <div className={`rounded-xl border p-4 mb-6 ${info.color}`}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-white/60 flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm">{info.title}</h3>
          <p className="text-xs mt-1 opacity-80 leading-relaxed">{info.description}</p>
          {info.tips && info.tips.length > 0 && (
            <div className="mt-2 space-y-1">
              {info.tips.map((tip, i) => (
                <div key={i} className="flex items-start gap-1.5 text-[11px] opacity-70">
                  <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <span>{tip}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
