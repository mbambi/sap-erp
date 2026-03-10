import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuthStore } from "./stores/auth";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import JournalEntries from "./pages/finance/JournalEntries";
import GLAccounts from "./pages/finance/GLAccounts";
import CompanyCodes from "./pages/finance/CompanyCodes";
import Vendors from "./pages/finance/Vendors";
import Customers from "./pages/finance/Customers";
import TrialBalance from "./pages/finance/TrialBalance";
import Materials from "./pages/materials/Materials";
import PurchaseOrders from "./pages/materials/PurchaseOrders";
import Plants from "./pages/materials/Plants";
import Inventory from "./pages/materials/Inventory";
import SalesOrders from "./pages/sales/SalesOrders";
import Employees from "./pages/hr/Employees";
import LearningHub from "./pages/learning/LearningHub";
import AdminPanel from "./pages/admin/AdminPanel";
import ReportingDashboard from "./pages/reporting/ReportingDashboard";
import WorkflowPage from "./pages/workflow/WorkflowPage";
import MRPDashboard from "./pages/mrp/MRPDashboard";
import SchedulingBoard from "./pages/production/SchedulingBoard";
import SupplyChainNetwork from "./pages/supply-chain/SupplyChainNetwork";
import ProcessMining from "./pages/process-mining/ProcessMining";
import InventoryAnalytics from "./pages/inventory/InventoryAnalytics";
import OperationsDashboard from "./pages/operations/OperationsDashboard";
import ScenarioSimulator from "./pages/scenarios/ScenarioSimulator";
import FinancialAnalytics from "./pages/finance/FinancialAnalytics";
import AccountsPayable from "./pages/finance/AccountsPayable";
import AccountsReceivable from "./pages/finance/AccountsReceivable";
import PricingEngine from "./pages/finance/PricingEngine";
import StockManagement from "./pages/inventory/StockManagement";
import AssetManagement from "./pages/assets/AssetManagement";
import TransportDashboard from "./pages/transport/TransportDashboard";
import GamificationHub from "./pages/gamification/GamificationHub";
import SandboxManager from "./pages/utilities/SandboxManager";
import ApiPlayground from "./pages/utilities/ApiPlayground";
import WorkflowBuilder from "./pages/workflow/WorkflowBuilder";
import ERPCopilot from "./pages/copilot/ERPCopilot";
import TimeMachine from "./pages/time-machine/TimeMachine";
import SimulatorPage from "./pages/simulator/SimulatorPage";
import ERPExplainer from "./pages/explainer/ERPExplainer";
import InstructorPanel from "./pages/instructor/InstructorPanel";
import ProductCosting from "./pages/costing/ProductCosting";
import MultiCompany from "./pages/MultiCompany";
import FinancialStatements from "./pages/FinancialStatements";
import PeriodClosing from "./pages/PeriodClosing";
import MrpBoard from "./pages/MrpBoard";
import Portals from "./pages/Portals";
import DataWarehouse from "./pages/DataWarehouse";
import Optimization from "./pages/Optimization";
import Integration from "./pages/Integration";
import Documents from "./pages/Documents";
import RoleDashboards from "./pages/RoleDashboards";
import Courses from "./pages/Courses";
import DatasetGenerator from "./pages/DatasetGenerator";
import CertificationCenter from "./pages/CertificationCenter";
import Monitoring from "./pages/Monitoring";
import ProcessFlowDesigner from "./pages/ProcessFlowDesigner";
import DigitalTwin from "./pages/DigitalTwin";
import IndustryTemplates from "./pages/IndustryTemplates";
import DecisionImpact from "./pages/DecisionImpact";
import BenchmarkMode from "./pages/BenchmarkMode";
import StressTest from "./pages/StressTest";
import SqlExplorer from "./pages/SqlExplorer";
import AuditMode from "./pages/AuditMode";
import AssignmentBuilder from "./pages/instructor/AssignmentBuilder";
import ProcessVisualizer from "./pages/process/ProcessVisualizer";
import DataExportLab from "./pages/data-lab/DataExportLab";
import ScenarioBuilder from "./pages/instructor/ScenarioBuilder";
import InventorySimulator from "./pages/simulator/InventorySimulator";
import ProfilePage from "./pages/profile/ProfilePage";
import InstructorAnalytics from "./pages/instructor/InstructorAnalytics";
import SupplyChainGame from "./pages/game/SupplyChainGame";
import LearningAnalytics from "./pages/learning/LearningAnalytics";
import EventBusDashboard from "./pages/event-bus/EventBusDashboard";
import SimulationHub from "./pages/simulation/SimulationHub";
import ExperimentLab from "./pages/experiment-lab/ExperimentLab";
import SupplyChainEditor from "./pages/supply-chain/SupplyChainEditor";
import ScenarioReplay from "./pages/scenarios/ScenarioReplay";
import RecommendationsDashboard from "./pages/copilot/RecommendationsDashboard";
import ForecastingEngine from "./pages/supply-chain/ForecastingEngine";
import MultiEchelonPage from "./pages/supply-chain/MultiEchelonPage";
import {
  Deliveries, Invoices, BOMs, ProductionOrders, Warehouses, WarehouseBins,
  InspectionLots, NonConformances, Equipment, WorkOrders,
  OrgUnits, LeaveRequests, TimeEntries, CostCenters, InternalOrders,
} from "./pages/ModulePages";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthStore();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
      </div>
    );
  }
  return user ? <>{children}</> : <Navigate to="/login" />;
}

function RoleRoute({ children, roles }: { children: React.ReactNode; roles: string[] }) {
  const { user } = useAuthStore();
  if (!user || !roles.some((r) => user.roles.includes(r))) {
    return (
      <div className="p-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
          <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m-4.93-2.07A8 8 0 1112 4a8 8 0 01-4.93 12.93z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
        <p className="text-gray-600">You don't have permission to view this page.</p>
        <p className="text-sm text-gray-400 mt-1">Required role: {roles.join(" or ")}</p>
      </div>
    );
  }
  return <>{children}</>;
}

export default function App() {
  const { loadUser, token } = useAuthStore();

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  return (
    <Routes>
      <Route path="/login" element={token ? <Navigate to="/" /> : <Login />} />

      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/" element={<Dashboard />} />

        {/* Finance */}
        <Route path="/finance/journal-entries" element={<JournalEntries />} />
        <Route path="/finance/gl-accounts" element={<GLAccounts />} />
        <Route path="/finance/company-codes" element={<RoleRoute roles={["admin","instructor"]}><CompanyCodes /></RoleRoute>} />
        <Route path="/finance/vendors" element={<Vendors />} />
        <Route path="/finance/customers" element={<Customers />} />
        <Route path="/finance/trial-balance" element={<TrialBalance />} />
        <Route path="/finance/analytics" element={<FinancialAnalytics />} />
        <Route path="/finance/ap" element={<AccountsPayable />} />
        <Route path="/finance/ar" element={<AccountsReceivable />} />
        <Route path="/finance/pricing" element={<PricingEngine />} />

        {/* Controlling */}
        <Route path="/controlling/cost-centers" element={<CostCenters />} />
        <Route path="/controlling/internal-orders" element={<InternalOrders />} />

        {/* Materials Management */}
        <Route path="/materials/items" element={<Materials />} />
        <Route path="/materials/purchase-orders" element={<PurchaseOrders />} />
        <Route path="/materials/goods-receipts" element={<PurchaseOrders />} />
        <Route path="/materials/inventory" element={<Inventory />} />
        <Route path="/materials/plants" element={<Plants />} />
        <Route path="/inventory/analytics" element={<InventoryAnalytics />} />
        <Route path="/inventory/stock" element={<StockManagement />} />

        {/* Sales & Distribution */}
        <Route path="/sales/orders" element={<SalesOrders />} />
        <Route path="/sales/deliveries" element={<Deliveries />} />
        <Route path="/sales/invoices" element={<Invoices />} />

        {/* Production */}
        <Route path="/production/boms" element={<BOMs />} />
        <Route path="/production/orders" element={<ProductionOrders />} />
        <Route path="/production/scheduling" element={<SchedulingBoard />} />
        <Route path="/operations/dashboard" element={<OperationsDashboard />} />

        {/* MRP */}
        <Route path="/mrp" element={<MRPDashboard />} />

        {/* Supply Chain */}
        <Route path="/supply-chain/network" element={<SupplyChainNetwork />} />

        {/* Process Mining */}
        <Route path="/process-mining" element={<ProcessMining />} />

        {/* Scenarios */}
        <Route path="/scenarios/simulator" element={<ScenarioSimulator />} />

        {/* Warehouse */}
        <Route path="/warehouse/list" element={<Warehouses />} />
        <Route path="/warehouse/bins" element={<WarehouseBins />} />

        {/* Quality */}
        <Route path="/quality/inspections" element={<InspectionLots />} />
        <Route path="/quality/non-conformances" element={<NonConformances />} />

        {/* Maintenance */}
        <Route path="/maintenance/equipment" element={<Equipment />} />
        <Route path="/maintenance/work-orders" element={<WorkOrders />} />

        {/* HR */}
        <Route path="/hr/employees" element={<RoleRoute roles={["admin","instructor"]}><Employees /></RoleRoute>} />
        <Route path="/hr/org-units" element={<RoleRoute roles={["admin","instructor"]}><OrgUnits /></RoleRoute>} />
        <Route path="/hr/leave-requests" element={<RoleRoute roles={["admin","instructor"]}><LeaveRequests /></RoleRoute>} />
        <Route path="/hr/time-entries" element={<RoleRoute roles={["admin","instructor"]}><TimeEntries /></RoleRoute>} />

        {/* Reporting */}
        <Route path="/reporting" element={<ReportingDashboard />} />

        {/* Workflow */}
        <Route path="/workflow" element={<WorkflowPage />} />
        <Route path="/workflow/builder" element={<WorkflowBuilder />} />

        {/* Gamification */}
        <Route path="/gamification" element={<GamificationHub />} />

        {/* Utilities */}
        <Route path="/sandbox" element={<RoleRoute roles={["admin","instructor"]}><SandboxManager /></RoleRoute>} />
        <Route path="/tools/api-playground" element={<ApiPlayground />} />

        {/* Copilot */}
        <Route path="/copilot" element={<ERPCopilot />} />

        <Route path="/assets" element={<RoleRoute roles={["admin","instructor"]}><AssetManagement /></RoleRoute>} />
        <Route path="/transport" element={<TransportDashboard />} />

        {/* Time Machine & Simulator */}
        <Route path="/time-machine" element={<TimeMachine />} />
        <Route path="/simulator" element={<SimulatorPage />} />
        <Route path="/explainer" element={<ERPExplainer />} />
        <Route path="/instructor" element={<RoleRoute roles={["admin","instructor"]}><InstructorPanel /></RoleRoute>} />
        <Route path="/costing" element={<ProductCosting />} />

        {/* Learning */}
        <Route path="/learning" element={<LearningHub />} />
        <Route path="/learning/analytics" element={<LearningAnalytics />} />

        {/* New Modules */}
        <Route path="/multi-company" element={<RoleRoute roles={["admin","instructor"]}><MultiCompany /></RoleRoute>} />
        <Route path="/financial-statements" element={<FinancialStatements />} />
        <Route path="/period-closing" element={<RoleRoute roles={["admin","instructor"]}><PeriodClosing /></RoleRoute>} />
        <Route path="/mrp-board" element={<MrpBoard />} />
        <Route path="/portals" element={<RoleRoute roles={["admin","instructor"]}><Portals /></RoleRoute>} />
        <Route path="/data-warehouse" element={<DataWarehouse />} />
        <Route path="/optimization" element={<Optimization />} />
        <Route path="/integration" element={<RoleRoute roles={["admin","instructor"]}><Integration /></RoleRoute>} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/role-dashboard" element={<RoleDashboards />} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/dataset-generator" element={<RoleRoute roles={["admin","instructor"]}><DatasetGenerator /></RoleRoute>} />
        <Route path="/certification" element={<CertificationCenter />} />
        <Route path="/monitoring" element={<RoleRoute roles={["admin"]}><Monitoring /></RoleRoute>} />

        {/* Advanced Features */}
        <Route path="/process-flows" element={<ProcessFlowDesigner />} />
        <Route path="/digital-twin" element={<DigitalTwin />} />
        <Route path="/industry-templates" element={<RoleRoute roles={["admin","instructor"]}><IndustryTemplates /></RoleRoute>} />
        <Route path="/decision-impact" element={<DecisionImpact />} />
        <Route path="/benchmark" element={<BenchmarkMode />} />
        <Route path="/stress-test" element={<StressTest />} />
        <Route path="/sql-explorer" element={<SqlExplorer />} />
        <Route path="/audit" element={<AuditMode />} />

        {/* Profile */}
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/profile/settings" element={<ProfilePage />} />

        {/* Instructor */}
        <Route path="/instructor/analytics" element={<RoleRoute roles={["admin","instructor"]}><InstructorAnalytics /></RoleRoute>} />
        <Route path="/instructor/assignments" element={<RoleRoute roles={["admin","instructor"]}><AssignmentBuilder /></RoleRoute>} />
        <Route path="/instructor/scenarios" element={<RoleRoute roles={["admin","instructor"]}><ScenarioBuilder /></RoleRoute>} />

        {/* Process Visualizer */}
        <Route path="/process-visualizer" element={<ProcessVisualizer />} />

        {/* Data Lab */}
        <Route path="/data-lab" element={<DataExportLab />} />

        {/* Inventory Simulator */}
        <Route path="/inventory/simulator" element={<InventorySimulator />} />

        {/* Supply Chain Game */}
        <Route path="/game" element={<SupplyChainGame />} />

        {/* Admin */}
        <Route path="/admin" element={<RoleRoute roles={["admin"]}><AdminPanel /></RoleRoute>} />

        {/* New Features */}
        <Route path="/event-bus" element={<EventBusDashboard />} />
        <Route path="/simulation" element={<SimulationHub />} />
        <Route path="/experiment-lab" element={<ExperimentLab />} />
        <Route path="/supply-chain/editor" element={<SupplyChainEditor />} />
        <Route path="/scenario-replay" element={<ScenarioReplay />} />
        <Route path="/recommendations" element={<RecommendationsDashboard />} />
        <Route path="/forecasting" element={<ForecastingEngine />} />
        <Route path="/multi-echelon" element={<MultiEchelonPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
