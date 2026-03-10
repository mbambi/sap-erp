import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Landmark,
  Package,
  ShoppingCart,
  Factory,
  Warehouse as WarehouseIcon,
  ClipboardCheck,
  Wrench,
  Users,
  PieChart,
  GitBranch,
  Activity,
  Settings,
  GraduationCap,
  ChevronDown,
  ChevronRight,
  Calculator,
  X,
  Trophy,
  Terminal,
  Bot,
  Network,
  Boxes,
  BarChart3,
  Clock,
  Gamepad2,
  HelpCircle,
  DollarSign,
  Laptop,
  Truck,
  Shield,
  Building2,
  FileSpreadsheet,
  CalendarCheck,
  Globe,
  Database,
  Cpu,
  Link2,
  FileText,
  BookOpen,
  Award,
  Gauge,
  Layers,
  Workflow,
  Radar,
  FlaskConical,
  Scale,
  Zap,
  Search,
  Eye,
  Sparkles,
  Map,
  Film,
  Brain,
  LineChart,
  Milestone,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useAuthStore } from "../stores/auth";

type RoleSet = ("admin" | "instructor" | "student" | "auditor")[];

interface ChildNavItem {
  label: string;
  path: string;
  roles?: RoleSet;
}

interface NavItem {
  label: string;
  icon: React.ElementType;
  path?: string;
  roles?: RoleSet;
  children?: ChildNavItem[];
}

const ALL_ROLES: RoleSet = ["admin", "instructor", "student", "auditor"];
const STAFF: RoleSet = ["admin", "instructor"];
const ADMIN_ONLY: RoleSet = ["admin"];

const navItems: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/" },
  {
    label: "Finance (FI)",
    icon: Landmark,
    children: [
      { label: "Journal Entries", path: "/finance/journal-entries" },
      { label: "GL Accounts", path: "/finance/gl-accounts" },
      { label: "Company Codes", path: "/finance/company-codes", roles: STAFF },
      { label: "Vendors", path: "/finance/vendors" },
      { label: "Customers", path: "/finance/customers" },
      { label: "Trial Balance", path: "/finance/trial-balance" },
      { label: "Financial Analytics", path: "/finance/analytics" },
      { label: "Accounts Payable", path: "/finance/ap" },
      { label: "Accounts Receivable", path: "/finance/ar" },
      { label: "Pricing Engine", path: "/finance/pricing" },
    ],
  },
  {
    label: "Controlling (CO)",
    icon: Calculator,
    children: [
      { label: "Cost Centers", path: "/controlling/cost-centers" },
      { label: "Internal Orders", path: "/controlling/internal-orders" },
    ],
  },
  {
    label: "Materials (MM)",
    icon: Package,
    children: [
      { label: "Materials", path: "/materials/items" },
      { label: "Purchase Orders", path: "/materials/purchase-orders" },
      { label: "Goods Receipts", path: "/materials/goods-receipts" },
      { label: "Inventory", path: "/materials/inventory" },
      { label: "Plants", path: "/materials/plants", roles: STAFF },
      { label: "Inventory Analytics", path: "/inventory/analytics" },
      { label: "Stock Management", path: "/inventory/stock" },
    ],
  },
  {
    label: "Sales (SD)",
    icon: ShoppingCart,
    children: [
      { label: "Sales Orders", path: "/sales/orders" },
      { label: "Deliveries", path: "/sales/deliveries" },
      { label: "Invoices", path: "/sales/invoices" },
    ],
  },
  {
    label: "Production (PP)",
    icon: Factory,
    children: [
      { label: "BOMs", path: "/production/boms" },
      { label: "Production Orders", path: "/production/orders" },
      { label: "Scheduling", path: "/production/scheduling" },
      { label: "Operations Dashboard", path: "/operations/dashboard" },
    ],
  },
  {
    label: "Warehouse (WM)",
    icon: WarehouseIcon,
    children: [
      { label: "Warehouses", path: "/warehouse/list" },
      { label: "Bin Management", path: "/warehouse/bins" },
    ],
  },
  {
    label: "Quality (QM)",
    icon: ClipboardCheck,
    children: [
      { label: "Inspection Lots", path: "/quality/inspections" },
      { label: "Non-Conformances", path: "/quality/non-conformances" },
    ],
  },
  {
    label: "Maintenance (PM)",
    icon: Wrench,
    children: [
      { label: "Equipment", path: "/maintenance/equipment" },
      { label: "Work Orders", path: "/maintenance/work-orders" },
    ],
  },
  {
    label: "HR",
    icon: Users,
    roles: STAFF,
    children: [
      { label: "Employees", path: "/hr/employees" },
      { label: "Org Structure", path: "/hr/org-units" },
      { label: "Leave Requests", path: "/hr/leave-requests" },
      { label: "Time Entries", path: "/hr/time-entries" },
    ],
  },
  {
    label: "MRP & Planning",
    icon: Boxes,
    children: [
      { label: "MRP Dashboard", path: "/mrp" },
      { label: "MRP Planning Board", path: "/mrp-board" },
      { label: "Inventory Simulator", path: "/inventory/simulator" },
    ],
  },
  { label: "Multi-Company", icon: Building2, path: "/multi-company", roles: STAFF },
  { label: "Asset Management", icon: Laptop, path: "/assets", roles: STAFF },
  { label: "Transport", icon: Truck, path: "/transport" },
  {
    label: "Supply Chain",
    icon: Network,
    children: [
      { label: "Network Map", path: "/supply-chain/network" },
      { label: "Map Editor", path: "/supply-chain/editor" },
      { label: "Multi-Echelon", path: "/multi-echelon" },
      { label: "Forecasting", path: "/forecasting" },
    ],
  },
  { label: "Process Flows", icon: Workflow, path: "/process-flows" },
  { label: "Process Visualizer", icon: Sparkles, path: "/process-visualizer" },
  { label: "Digital Twin", icon: Radar, path: "/digital-twin" },
  {
    label: "Finance Ops",
    icon: FileSpreadsheet,
    children: [
      { label: "Financial Statements", path: "/financial-statements" },
      { label: "Period Closing", path: "/period-closing", roles: STAFF },
    ],
  },
  { label: "Reporting", icon: PieChart, path: "/reporting" },
  { label: "Process Mining", icon: GitBranch, path: "/process-mining" },
  { label: "Scenario Simulator", icon: Activity, path: "/scenarios/simulator" },
  {
    label: "Workflow",
    icon: GitBranch,
    children: [
      { label: "Workflows", path: "/workflow" },
      { label: "Workflow Builder", path: "/workflow/builder", roles: STAFF },
    ],
  },
  {
    label: "Analytics & BI",
    icon: Database,
    children: [
      { label: "Data Warehouse", path: "/data-warehouse" },
      { label: "Data Export Lab", path: "/data-lab" },
      { label: "Optimization Engine", path: "/optimization" },
      { label: "Decision Impact", path: "/decision-impact" },
      { label: "SQL Explorer", path: "/sql-explorer" },
      { label: "Role Dashboard", path: "/role-dashboard" },
    ],
  },
  { label: "Integration", icon: Link2, path: "/integration", roles: STAFF },
  { label: "Documents", icon: FileText, path: "/documents" },
  { label: "Portals", icon: Globe, path: "/portals", roles: STAFF },
  {
    label: "Learning",
    icon: GraduationCap,
    children: [
      { label: "Learning Hub", path: "/learning" },
      { label: "My Progress", path: "/learning/analytics" },
      { label: "Courses", path: "/courses" },
      { label: "Certification", path: "/certification" },
    ],
  },
  { label: "Gamification", icon: Trophy, path: "/gamification" },
  { label: "Supply Chain Game", icon: Gamepad2, path: "/game" },
  { label: "Benchmark", icon: Scale, path: "/benchmark" },
  { label: "Stress Test", icon: Zap, path: "/stress-test" },
  { label: "Event Bus", icon: Zap, path: "/event-bus" },
  { label: "Simulation", icon: Users, path: "/simulation" },
  { label: "Experiment Lab", icon: FlaskConical, path: "/experiment-lab" },
  { label: "Scenario Replay", icon: Film, path: "/scenario-replay" },
  { label: "AI Recommendations", icon: Brain, path: "/recommendations" },
  { label: "ERP Copilot", icon: Bot, path: "/copilot" },
  { label: "Time Machine", icon: Clock, path: "/time-machine" },
  { label: "Simulator", icon: Gamepad2, path: "/simulator" },
  { label: "ERP Explainer", icon: HelpCircle, path: "/explainer" },
  { label: "Costing", icon: DollarSign, path: "/costing" },
  {
    label: "Instructor",
    icon: Shield,
    roles: STAFF,
    children: [
      { label: "Control Panel", path: "/instructor" },
      { label: "Class Analytics", path: "/instructor/analytics" },
      { label: "Assignment Builder", path: "/instructor/assignments" },
      { label: "Scenario Builder", path: "/instructor/scenarios" },
      { label: "Sandbox Manager", path: "/sandbox" },
      { label: "Dataset Generator", path: "/dataset-generator" },
      { label: "Industry Templates", path: "/industry-templates" },
    ],
  },
  {
    label: "Utilities",
    icon: Terminal,
    children: [
      { label: "API Playground", path: "/tools/api-playground" },
      { label: "SQL Explorer", path: "/sql-explorer" },
    ],
  },
  { label: "Audit", icon: Eye, path: "/audit" },
  { label: "Monitoring", icon: Gauge, path: "/monitoring", roles: ADMIN_ONLY },
  { label: "Admin", icon: Settings, path: "/admin", roles: ADMIN_ONLY },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: Props) {
  const location = useLocation();
  const { user } = useAuthStore();
  const userRoles = user?.roles ?? [];

  const visibleItems = useMemo(() => {
    return navItems
      .filter((item) => {
        if (!item.roles) return true;
        return item.roles.some((r) => userRoles.includes(r));
      })
      .map((item) => {
        if (!item.children) return item;
        const filteredChildren = item.children.filter((child) => {
          if (!child.roles) return true;
          return child.roles.some((r) => userRoles.includes(r));
        });
        if (filteredChildren.length === 0) return null;
        return { ...item, children: filteredChildren };
      })
      .filter(Boolean) as NavItem[];
  }, [userRoles]);

  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    navItems.forEach((item) => {
      if (item.children?.some((c) => location.pathname.startsWith(c.path))) {
        init[item.label] = true;
      }
    });
    return init;
  });

  const toggle = (label: string) =>
    setExpanded((prev) => ({ ...prev, [label]: !prev[label] }));

  const linkClass = (isActive: boolean) =>
    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
      isActive
        ? "bg-primary-600/10 text-primary-600 font-medium"
        : "text-gray-400 hover:text-white hover:bg-white/5"
    }`;

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed top-0 left-0 z-50 h-screen w-64 bg-sap-sidebar border-r border-gray-800 flex flex-col transition-transform lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center">
              <Landmark className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-tight">
                SAP ERP
              </h1>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                Learning Platform
              </p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {visibleItems.map((item) => {
            if (item.path) {
              return (
                <NavLink
                  key={item.label}
                  to={item.path}
                  onClick={onClose}
                  className={({ isActive }) => linkClass(isActive && item.path === "/"
                    ? location.pathname === "/"
                    : isActive)}
                  end={item.path === "/"}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  {item.label}
                </NavLink>
              );
            }

            const isExpanded = expanded[item.label];
            const isChildActive = item.children?.some((c) =>
              location.pathname.startsWith(c.path)
            );

            return (
              <div key={item.label}>
                <button
                  onClick={() => toggle(item.label)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm w-full transition-colors ${
                    isChildActive
                      ? "text-primary-400"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                </button>
                {isExpanded && (
                  <div className="ml-7 mt-1 space-y-0.5 border-l border-gray-800 pl-3">
                    {item.children!.map((child) => (
                      <NavLink
                        key={child.path}
                        to={child.path}
                        onClick={onClose}
                        className={({ isActive }) =>
                          `block px-3 py-1.5 rounded text-xs transition-colors ${
                            isActive
                              ? "text-primary-400 bg-primary-600/10 font-medium"
                              : "text-gray-500 hover:text-gray-300"
                          }`
                        }
                      >
                        {child.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="p-3 border-t border-gray-800">
          <div className="px-3 py-2 text-xs text-gray-600">
            v3.0.0 &middot; Enterprise Edition
          </div>
        </div>
      </aside>
    </>
  );
}
