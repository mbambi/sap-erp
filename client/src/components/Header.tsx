import {
  Menu, Bell, Search, LogOut, User, HelpCircle, Settings,
  X, Check, CheckCheck, Package, ShoppingCart, Users as UsersIcon,
  FileText, Truck, ChevronRight, Trash2,
} from "lucide-react";
import { useAuthStore } from "../stores/auth";
import { useNotificationStore } from "../stores/notifications";
import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";

interface Props {
  onMenuClick: () => void;
}

interface SearchResult {
  type: string;
  id: string;
  title: string;
  subtitle: string;
  link: string;
}

interface TCodeItem {
  code: string;
  name: string;
  module: string;
  path: string;
  description?: string;
}

interface SearchCommand {
  type: string;
  title: string;
  subtitle: string;
  link: string;
  keywords: string[];
}

const LOCAL_TCODES: TCodeItem[] = [
  { code: "ME21N", name: "Create Purchase Order", module: "materials", path: "/materials/purchase-orders", description: "Create a new purchase order" },
  { code: "MIGO", name: "Goods Receipt", module: "materials", path: "/materials/goods-receipts", description: "Post goods receipt for purchase order" },
  { code: "FB50", name: "Post Journal Entry", module: "finance", path: "/finance/journal-entries", description: "Post a general ledger journal entry" },
  { code: "VA01", name: "Create Sales Order", module: "sales", path: "/sales/orders", description: "Create a new sales order" },
  { code: "VL01N", name: "Create Delivery", module: "sales", path: "/sales/deliveries", description: "Create outbound delivery" },
  { code: "VF01", name: "Create Billing Document", module: "sales", path: "/sales/invoices", description: "Create billing document from delivery" },
  { code: "MD01", name: "MRP Run", module: "mrp", path: "/mrp", description: "Run material requirements planning" },
  { code: "CO01", name: "Create Production Order", module: "production", path: "/production/orders", description: "Create production order" },
];

const LOCAL_COMMANDS: SearchCommand[] = [
  { type: "page", title: "Dashboard", subtitle: "Home overview and KPIs", link: "/", keywords: ["home", "dashboard", "kpi"] },

  { type: "module", title: "Finance - Journal Entries", subtitle: "Post and review journal entries", link: "/finance/journal-entries", keywords: ["finance", "gl", "fb50", "journal"] },
  { type: "module", title: "Finance - GL Accounts", subtitle: "Chart of accounts", link: "/finance/gl-accounts", keywords: ["gl accounts", "accounts", "coa"] },
  { type: "module", title: "Finance - Company Codes", subtitle: "Legal entities and settings", link: "/finance/company-codes", keywords: ["company code", "legal entity"] },
  { type: "module", title: "Finance - Vendors", subtitle: "Vendor master data", link: "/finance/vendors", keywords: ["vendor", "supplier", "xk01"] },
  { type: "module", title: "Finance - Customers", subtitle: "Customer master data", link: "/finance/customers", keywords: ["customer", "client", "xd01"] },
  { type: "module", title: "Finance - Trial Balance", subtitle: "Trial balance report", link: "/finance/trial-balance", keywords: ["trial balance", "tb"] },
  { type: "module", title: "Finance - Analytics", subtitle: "Financial dashboards", link: "/finance/analytics", keywords: ["financial analytics", "finance dashboard"] },
  { type: "module", title: "Accounts Payable", subtitle: "Invoices, approvals, payments", link: "/finance/ap", keywords: ["ap", "payable", "supplier invoice"] },
  { type: "module", title: "Accounts Receivable", subtitle: "Customer invoices and aging", link: "/finance/ar", keywords: ["ar", "receivable", "aging"] },
  { type: "module", title: "Pricing Engine", subtitle: "Pricing conditions and calculator", link: "/finance/pricing", keywords: ["pricing", "conditions", "discount", "tax"] },

  { type: "module", title: "Materials", subtitle: "Material master", link: "/materials/items", keywords: ["materials", "mm", "material master"] },
  { type: "module", title: "Purchase Orders", subtitle: "PO lifecycle", link: "/materials/purchase-orders", keywords: ["po", "purchase order", "me21n"] },
  { type: "module", title: "Goods Receipts", subtitle: "Post GR against PO", link: "/materials/goods-receipts", keywords: ["gr", "goods receipt", "migo"] },
  { type: "module", title: "Inventory", subtitle: "Stock levels", link: "/materials/inventory", keywords: ["inventory", "stock"] },
  { type: "module", title: "Plants", subtitle: "Plant and storage location setup", link: "/materials/plants", keywords: ["plants", "storage location"] },
  { type: "module", title: "Inventory Analytics", subtitle: "Inventory KPIs", link: "/inventory/analytics", keywords: ["inventory analytics", "turnover"] },
  { type: "module", title: "Stock Management", subtitle: "Detailed stock operations", link: "/inventory/stock", keywords: ["stock management", "movements"] },

  { type: "module", title: "Sales Orders", subtitle: "Create and manage sales orders", link: "/sales/orders", keywords: ["sd", "sales", "order", "va01"] },
  { type: "module", title: "Deliveries", subtitle: "Outbound deliveries", link: "/sales/deliveries", keywords: ["delivery", "vl01n"] },
  { type: "module", title: "Sales Invoices", subtitle: "Billing documents", link: "/sales/invoices", keywords: ["invoice", "billing", "vf01"] },

  { type: "module", title: "BOMs", subtitle: "Bills of material", link: "/production/boms", keywords: ["bom", "bill of material"] },
  { type: "module", title: "Production Orders", subtitle: "Create and track production", link: "/production/orders", keywords: ["production order", "co01", "pp"] },
  { type: "module", title: "Scheduling", subtitle: "Production scheduling board", link: "/production/scheduling", keywords: ["scheduling", "gantt"] },
  { type: "module", title: "Operations Dashboard", subtitle: "Operations KPIs", link: "/operations/dashboard", keywords: ["operations", "oee", "throughput"] },

  { type: "module", title: "MRP Dashboard", subtitle: "Run MRP and review runs", link: "/mrp", keywords: ["mrp", "md01", "planning"] },
  { type: "module", title: "MRP Planning Board", subtitle: "12-week supply-demand planning", link: "/mrp-board", keywords: ["mrp board", "shortage", "reschedule"] },

  { type: "module", title: "Warehouses", subtitle: "Warehouse list", link: "/warehouse/list", keywords: ["warehouse", "wm"] },
  { type: "module", title: "Bin Management", subtitle: "Bin-level operations", link: "/warehouse/bins", keywords: ["bins", "putaway", "picking"] },

  { type: "module", title: "Inspection Lots", subtitle: "Quality inspections", link: "/quality/inspections", keywords: ["quality", "inspection", "qa01"] },
  { type: "module", title: "Non-Conformances", subtitle: "Quality issues", link: "/quality/non-conformances", keywords: ["non conformance", "quality issue"] },

  { type: "module", title: "Equipment", subtitle: "Maintenance equipment", link: "/maintenance/equipment", keywords: ["equipment", "maintenance"] },
  { type: "module", title: "Work Orders", subtitle: "Maintenance work orders", link: "/maintenance/work-orders", keywords: ["work order", "iw31"] },

  { type: "module", title: "Employees", subtitle: "HR employee master", link: "/hr/employees", keywords: ["hr", "employees"] },
  { type: "module", title: "Org Units", subtitle: "Organization structure", link: "/hr/org-units", keywords: ["org", "org units"] },
  { type: "module", title: "Leave Requests", subtitle: "Leave approvals", link: "/hr/leave-requests", keywords: ["leave", "vacation"] },
  { type: "module", title: "Time Entries", subtitle: "Time tracking", link: "/hr/time-entries", keywords: ["time entries", "attendance"] },

  { type: "module", title: "Cost Centers", subtitle: "Controlling cost centers", link: "/controlling/cost-centers", keywords: ["cost center", "controlling"] },
  { type: "module", title: "Internal Orders", subtitle: "Internal projects and costs", link: "/controlling/internal-orders", keywords: ["internal order", "co"] },

  { type: "module", title: "Multi-Company", subtitle: "Intercompany setup and transactions", link: "/multi-company", keywords: ["multi company", "intercompany"] },
  { type: "module", title: "Financial Statements", subtitle: "Balance sheet, income statement, cash flow", link: "/financial-statements", keywords: ["financial statements", "balance sheet", "p&l"] },
  { type: "module", title: "Period Closing", subtitle: "Month-end closing checklist", link: "/period-closing", keywords: ["period closing", "month end"] },
  { type: "module", title: "Asset Management", subtitle: "Asset lifecycle and depreciation", link: "/assets", keywords: ["assets", "depreciation"] },
  { type: "module", title: "Transport", subtitle: "Shipments and logistics", link: "/transport", keywords: ["transport", "logistics", "shipments"] },

  { type: "module", title: "Supply Chain Network", subtitle: "Network map", link: "/supply-chain/network", keywords: ["supply chain", "network"] },
  { type: "module", title: "Supply Chain Editor", subtitle: "Edit network topology", link: "/supply-chain/editor", keywords: ["network editor", "topology"] },
  { type: "module", title: "Multi-Echelon", subtitle: "Multi-echelon inventory", link: "/multi-echelon", keywords: ["multi echelon", "inventory strategy"] },
  { type: "module", title: "Forecasting", subtitle: "Demand forecasting", link: "/forecasting", keywords: ["forecast", "demand"] },

  { type: "module", title: "Process Flows", subtitle: "Static process definitions", link: "/process-flows", keywords: ["process flows", "p2p", "o2c"] },
  { type: "module", title: "Process Visualizer", subtitle: "Interactive process graph", link: "/process-visualizer", keywords: ["process visualizer", "graph"] },
  { type: "module", title: "Process Mining", subtitle: "Bottlenecks and conformance", link: "/process-mining", keywords: ["process mining", "conformance"] },
  { type: "module", title: "Digital Twin", subtitle: "Supply chain digital twin", link: "/digital-twin", keywords: ["digital twin", "network simulation"] },

  { type: "module", title: "Reporting", subtitle: "Cross-module reports", link: "/reporting", keywords: ["reporting", "bi", "dashboards"] },
  { type: "module", title: "Workflow", subtitle: "Workflow definitions and instances", link: "/workflow", keywords: ["workflow", "automation"] },
  { type: "module", title: "Workflow Builder", subtitle: "Visual workflow rules editor", link: "/workflow/builder", keywords: ["workflow builder", "rules"] },

  { type: "module", title: "Data Warehouse", subtitle: "Star schema analytics", link: "/data-warehouse", keywords: ["data warehouse", "olap"] },
  { type: "module", title: "Data Export Lab", subtitle: "Export CSV and JSON datasets", link: "/data-lab", keywords: ["data lab", "export", "csv"] },
  { type: "module", title: "Optimization Engine", subtitle: "Run optimization scenarios", link: "/optimization", keywords: ["optimization", "routing", "scheduling"] },
  { type: "module", title: "Decision Impact", subtitle: "Analyze impact of decisions", link: "/decision-impact", keywords: ["decision impact", "what if"] },
  { type: "module", title: "SQL Explorer", subtitle: "Read-only SQL queries", link: "/sql-explorer", keywords: ["sql", "query", "explorer"] },
  { type: "module", title: "Role Dashboard", subtitle: "Role-specific KPI view", link: "/role-dashboard", keywords: ["role dashboard", "role based"] },

  { type: "module", title: "Learning Hub", subtitle: "Guided learning content", link: "/learning", keywords: ["learning", "lessons"] },
  { type: "module", title: "Learning Analytics", subtitle: "Personal learning progress", link: "/learning/analytics", keywords: ["learning analytics", "progress"] },
  { type: "module", title: "Courses", subtitle: "Courses and modules", link: "/courses", keywords: ["courses", "course mode"] },
  { type: "module", title: "Certification", subtitle: "ERP certification center", link: "/certification", keywords: ["certification", "exam"] },
  { type: "module", title: "Gamification", subtitle: "XP and achievements", link: "/gamification", keywords: ["gamification", "xp", "badges"] },
  { type: "module", title: "Supply Chain Game", subtitle: "Competitive game mode", link: "/game", keywords: ["game", "competition"] },
  { type: "module", title: "Benchmark", subtitle: "Tournament benchmark mode", link: "/benchmark", keywords: ["benchmark", "tournament"] },
  { type: "module", title: "Stress Test", subtitle: "Crisis and load scenarios", link: "/stress-test", keywords: ["stress test", "crisis"] },

  { type: "module", title: "Event Bus", subtitle: "ERP event stream", link: "/event-bus", keywords: ["event bus", "events", "p2p", "o2c"] },
  { type: "module", title: "Simulation", subtitle: "Multi-user simulation sessions", link: "/simulation", keywords: ["simulation", "multi user"] },
  { type: "module", title: "Experiment Lab", subtitle: "Research experiment templates", link: "/experiment-lab", keywords: ["experiment lab", "research"] },
  { type: "module", title: "Scenario Replay", subtitle: "Replay simulation scenarios", link: "/scenario-replay", keywords: ["scenario replay", "replay"] },
  { type: "module", title: "Scenario Simulator", subtitle: "What-if simulator", link: "/scenarios/simulator", keywords: ["scenario simulator", "what-if"] },
  { type: "module", title: "AI Recommendations", subtitle: "AI-generated recommendations", link: "/recommendations", keywords: ["recommendations", "ai"] },
  { type: "module", title: "ERP Copilot", subtitle: "AI assistant", link: "/copilot", keywords: ["copilot", "assistant"] },
  { type: "module", title: "Time Machine", subtitle: "Event-sourced time travel", link: "/time-machine", keywords: ["time machine", "event sourcing"] },
  { type: "module", title: "Simulator", subtitle: "Combined simulator shell", link: "/simulator", keywords: ["simulator"] },
  { type: "module", title: "ERP Explainer", subtitle: "Explainable ERP decisions", link: "/explainer", keywords: ["explainer", "explainable"] },
  { type: "module", title: "Costing", subtitle: "Product costing and variance", link: "/costing", keywords: ["costing", "variance"] },

  { type: "tool", title: "API Playground", subtitle: "In-browser API testing", link: "/tools/api-playground", keywords: ["api playground", "rest", "postman"] },
  { type: "tool", title: "Sandbox Manager", subtitle: "Reset and manage sandboxes", link: "/sandbox", keywords: ["sandbox", "reset"] },
  { type: "tool", title: "Dataset Generator", subtitle: "Generate teaching data", link: "/dataset-generator", keywords: ["dataset", "generator"] },
  { type: "tool", title: "Industry Templates", subtitle: "Apply industry starter templates", link: "/industry-templates", keywords: ["industry templates", "template"] },
  { type: "tool", title: "Integration", subtitle: "Webhooks and integrations", link: "/integration", keywords: ["integration", "webhook"] },
  { type: "tool", title: "Documents", subtitle: "Document uploads and attachments", link: "/documents", keywords: ["documents", "attachments"] },
  { type: "tool", title: "Portals", subtitle: "Supplier and customer portals", link: "/portals", keywords: ["portals", "supplier portal", "customer portal"] },

  { type: "admin", title: "Instructor Control Panel", subtitle: "Instructor operations", link: "/instructor", keywords: ["instructor", "control panel"] },
  { type: "admin", title: "Instructor Analytics", subtitle: "Class analytics", link: "/instructor/analytics", keywords: ["instructor analytics", "class analytics"] },
  { type: "admin", title: "Assignment Builder", subtitle: "Create assignments", link: "/instructor/assignments", keywords: ["assignment builder", "assignments"] },
  { type: "admin", title: "Scenario Builder", subtitle: "Build and inject scenarios", link: "/instructor/scenarios", keywords: ["scenario builder", "inject crises"] },
  { type: "admin", title: "Audit", subtitle: "Audit log browser", link: "/audit", keywords: ["audit", "logs"] },
  { type: "admin", title: "Monitoring", subtitle: "System and API health", link: "/monitoring", keywords: ["monitoring", "system health", "metrics"] },
  { type: "admin", title: "Admin", subtitle: "Tenant and user administration", link: "/admin", keywords: ["admin", "tenants", "users"] },
  { type: "page", title: "Profile", subtitle: "User profile and settings", link: "/profile", keywords: ["profile", "account settings"] },
];

const typeIcons: Record<string, React.ElementType> = {
  material: Package,
  customer: UsersIcon,
  vendor: Truck,
  sales_order: ShoppingCart,
  purchase_order: FileText,
  employee: User,
  tcode: Search,
  module: Package,
  page: FileText,
  tool: Settings,
  admin: User,
};

const typeLabels: Record<string, string> = {
  material: "Material",
  customer: "Customer",
  vendor: "Vendor",
  sales_order: "Sales Order",
  purchase_order: "Purchase Order",
  employee: "Employee",
  tcode: "T-Code",
  module: "Module",
  page: "Page",
  tool: "Tool",
  admin: "Admin",
};

function normalizeSearchText(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isSubsequence(query: string, target: string) {
  let i = 0;
  let j = 0;
  while (i < query.length && j < target.length) {
    if (query[i] === target[j]) i += 1;
    j += 1;
  }
  return i === query.length;
}

function levenshtein(a: string, b: string) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i = 0; i < rows; i += 1) dp[i][0] = i;
  for (let j = 0; j < cols; j += 1) dp[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[a.length][b.length];
}

function scoreField(query: string, candidate: string) {
  if (!query || !candidate) return 0;

  const q = normalizeSearchText(query);
  const c = normalizeSearchText(candidate);
  if (!q || !c) return 0;

  if (c === q) return 200;
  if (c.startsWith(q)) return 160;
  if (c.includes(q)) return 130;
  if (q.length >= 2 && isSubsequence(q, c)) return 90;

  if (q.length >= 4 && c.length >= 4) {
    const distance = levenshtein(q, c);
    if (distance <= 1) return 85;
    if (distance === 2) return 70;
  }

  return 0;
}

function scoreFields(query: string, fields: string[]) {
  return fields.reduce((best, field) => Math.max(best, scoreField(query, field)), 0);
}

export default function Header({ onMenuClick }: Props) {
  const { user, logout } = useAuthStore();
  const { notifications, unreadCount, fetchNotifications, markAsRead, markAllRead, deleteNotification } = useNotificationStore();
  const navigate = useNavigate();

  const [showProfile, setShowProfile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (profileRef.current && !profileRef.current.contains(target)) setShowProfile(false);
      if (notifRef.current && !notifRef.current.contains(target)) setShowNotifications(false);
      if (searchRef.current && !searchRef.current.contains(target)) {
        setShowSearch(false);
        setSearchQuery("");
        setSearchResults([]);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowSearch(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
      if (e.key === "Escape") {
        setShowSearch(false);
        setShowProfile(false);
        setShowNotifications(false);
        setSearchQuery("");
        setSearchResults([]);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const performSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);

    const rawQuery = query.trim();
    const lower = rawQuery.toLowerCase();

    type RankedResult = SearchResult & { score: number };

    const commandMatches: RankedResult[] = LOCAL_COMMANDS
      .map((cmd) => {
        const score = scoreFields(rawQuery, [cmd.title, cmd.subtitle, cmd.link, ...cmd.keywords]);
        return {
          type: cmd.type,
          id: `cmd-${cmd.link}`,
          title: cmd.title,
          subtitle: cmd.subtitle,
          link: cmd.link,
          score,
        };
      })
      .filter((item) => item.score > 0);

    const routeExact = LOCAL_COMMANDS.find((cmd) => cmd.link.toLowerCase() === lower);
    const routeMatches: RankedResult[] = routeExact
      ? [{ type: routeExact.type, id: `cmd-route-${routeExact.link}`, title: routeExact.title, subtitle: routeExact.subtitle, link: routeExact.link, score: 260 }]
      : [];

    const localMatches: RankedResult[] = LOCAL_TCODES
      .map((t) => {
        const title = `${t.code} - ${t.name}`;
        const subtitle = t.description || `Open ${t.module} function`;
        const score = scoreFields(rawQuery, [t.code, t.name, subtitle, t.path, t.module]);
        return {
          type: "tcode",
          id: `tcode-${t.code}`,
          title,
          subtitle,
          link: t.path,
          score,
        };
      })
      .filter((item) => item.score > 0);

    try {
      const [searchRes, tcodesRes] = await Promise.all([
        api.get<{ results?: SearchResult[] }>("/search", { q: query }),
        api.get<TCodeItem[]>("/utilities/tcodes").catch(() => []),
      ]);

      const apiTcodes: RankedResult[] = (Array.isArray(tcodesRes) ? tcodesRes : [])
        .map((t) => {
          const title = `${t.code} - ${t.name}`;
          const subtitle = t.description || `Open ${t.module} function`;
          const score = scoreFields(rawQuery, [t.code, t.name, subtitle, t.path, t.module]);
          return {
            type: "tcode",
            id: `tcode-${t.code}`,
            title,
            subtitle,
            link: t.path,
            score,
          };
        })
        .filter((item) => item.score > 0);

      const apiResults: RankedResult[] = (searchRes.results || []).map((item) => ({
        ...item,
        score: Math.max(50, scoreFields(rawQuery, [item.title, item.subtitle, item.link])),
      }));

      const merged = [...routeMatches, ...apiTcodes, ...localMatches, ...commandMatches, ...apiResults];
      const bestByKey = new Map<string, RankedResult>();
      for (const item of merged) {
        const key = `${item.type}|${item.link}|${item.title}`;
        const current = bestByKey.get(key);
        if (!current || item.score > current.score) bestByKey.set(key, item);
      }

      const ranked = Array.from(bestByKey.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, 80)
        .map(({ score: _score, ...rest }) => rest);

      setSearchResults(ranked);
    } catch {
      const merged = [...routeMatches, ...localMatches, ...commandMatches];
      const bestByKey = new Map<string, RankedResult>();
      for (const item of merged) {
        const key = `${item.type}|${item.link}|${item.title}`;
        const current = bestByKey.get(key);
        if (!current || item.score > current.score) bestByKey.set(key, item);
      }
      const ranked = Array.from(bestByKey.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, 80)
        .map(({ score: _score, ...rest }) => rest);
      setSearchResults(ranked);
    }
    setSearchLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => performSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, performSearch]);

  const handleSearchResultClick = (result: SearchResult) => {
    navigate(result.link);
    setShowSearch(false);
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleNotificationClick = (notif: typeof notifications[0]) => {
    if (!notif.isRead) markAsRead(notif.id);
    if (notif.link) navigate(notif.link);
    setShowNotifications(false);
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  return (
    <>
      <header className="sticky top-0 z-30 h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-4">
          <button onClick={onMenuClick} className="lg:hidden btn-icon" aria-label="Toggle menu">
            <Menu className="w-5 h-5" />
          </button>

          <div ref={searchRef} className="relative">
            <button
              onClick={() => {
                setShowSearch(true);
                setTimeout(() => searchInputRef.current?.focus(), 50);
              }}
              className="hidden sm:flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2 w-72 hover:bg-gray-150 transition-colors"
            >
              <Search className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-400 flex-1 text-left">Search anything...</span>
              <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] text-gray-400 bg-white rounded border">
                Ctrl+K
              </kbd>
            </button>

            {showSearch && (
              <div className="absolute top-0 left-0 w-[480px] bg-white rounded-xl shadow-2xl border z-50 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b">
                  <Search className="w-4 h-4 text-gray-400" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search modules, routes, T-codes, orders, customers..."
                    className="flex-1 text-sm outline-none placeholder:text-gray-400"
                    autoFocus
                  />
                  {searchQuery && (
                    <button onClick={() => { setSearchQuery(""); setSearchResults([]); }} className="p-0.5 hover:bg-gray-100 rounded">
                      <X className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                  )}
                </div>

                {searchLoading && (
                  <div className="px-4 py-6 text-center text-sm text-gray-400">
                    <div className="animate-spin w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full mx-auto mb-2" />
                    Searching...
                  </div>
                )}

                {!searchLoading && searchResults.length > 0 && (
                  <div className="max-h-80 overflow-y-auto py-1">
                    {searchResults.map((result) => {
                      const Icon = typeIcons[result.type] || FileText;
                      return (
                        <button
                          key={`${result.type}-${result.id}`}
                          onClick={() => handleSearchResultClick(result)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
                        >
                          <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                            <Icon className="w-4 h-4 text-primary-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{result.title}</p>
                            <p className="text-xs text-gray-500 truncate">{result.subtitle}</p>
                          </div>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 uppercase flex-shrink-0">
                            {typeLabels[result.type] || result.type}
                          </span>
                          <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                )}

                {!searchLoading && searchQuery.length >= 2 && searchResults.length === 0 && (
                  <div className="px-4 py-6 text-center text-sm text-gray-400">
                    No results found for "{searchQuery}"
                  </div>
                )}

                {!searchLoading && searchQuery.length < 2 && (
                  <div className="px-4 py-6 text-center text-sm text-gray-400">
                    Type at least 2 characters to search
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="sm:hidden btn-icon" onClick={() => { setShowSearch(true); setTimeout(() => searchInputRef.current?.focus(), 50); }}>
            <Search className="w-5 h-5 text-gray-500" />
          </button>

          <button className="btn-icon relative" aria-label="Help" title="Help & Tutorials"
            onClick={() => navigate("/learning")}>
            <HelpCircle className="w-5 h-5 text-gray-500" />
          </button>

          <div className="relative" ref={notifRef}>
            <button
              className="btn-icon relative"
              aria-label="Notifications"
              onClick={() => setShowNotifications(!showNotifications)}
            >
              <Bell className="w-5 h-5 text-gray-500" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full px-1">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 top-12 w-96 bg-white border rounded-xl shadow-2xl z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
                  <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
                    >
                      <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-96 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <Bell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-400">No notifications yet</p>
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className={`flex items-start gap-3 px-4 py-3 border-b last:border-b-0 cursor-pointer transition-colors ${
                          notif.isRead ? "bg-white hover:bg-gray-50" : "bg-blue-50/50 hover:bg-blue-50"
                        }`}
                        onClick={() => handleNotificationClick(notif)}
                      >
                        <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                          notif.isRead ? "bg-transparent" : "bg-primary-600"
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${notif.isRead ? "text-gray-700" : "text-gray-900 font-medium"}`}>
                            {notif.title}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notif.message}</p>
                          <p className="text-[10px] text-gray-400 mt-1">{formatTime(notif.createdAt)}</p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(notif.id);
                          }}
                          className="p-1 hover:bg-gray-200 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-gray-400" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setShowProfile(!showProfile)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center">
                <span className="text-xs font-medium text-white">
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </span>
              </div>
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium text-gray-900">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-gray-500">{user?.roles?.[0]}</p>
              </div>
            </button>

            {showProfile && (
              <div className="absolute right-0 top-12 w-64 bg-white border rounded-xl shadow-2xl py-1 z-50">
                <div className="px-4 py-3 border-b">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center">
                      <span className="text-sm font-medium text-white">
                        {user?.firstName?.[0]}{user?.lastName?.[0]}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">{user?.firstName} {user?.lastName}</p>
                      <p className="text-xs text-gray-500">{user?.email}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    {user?.tenantName} &middot; {user?.roles?.join(", ")}
                  </p>
                </div>
                <button
                  onClick={() => { navigate("/profile"); setShowProfile(false); }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <User className="w-4 h-4" /> My Profile
                </button>
                <button
                  onClick={() => { navigate("/profile/settings"); setShowProfile(false); }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Settings className="w-4 h-4" /> Settings
                </button>
                <div className="border-t my-1" />
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                >
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {showSearch && (
        <div className="fixed inset-0 bg-black/20 z-40 sm:hidden" onClick={() => setShowSearch(false)} />
      )}
    </>
  );
}
