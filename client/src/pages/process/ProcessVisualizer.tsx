import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronRight, Info, MousePointerClick, Workflow, Layers, Package, FileText, CreditCard, Truck, ShoppingCart, Factory, ClipboardCheck, Users, Landmark, Box, Wrench } from "lucide-react";
import PageHeader from "../../components/PageHeader";

interface ProcessNode {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  description: string;
  transaction: string;
  link: string;
}

interface ProcessFlow {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  nodes: ProcessNode[];
}

const PROCESSES: ProcessFlow[] = [
  {
    id: "procure_to_pay",
    name: "Procure to Pay (P2P)",
    description: "End-to-end procurement cycle from requisition to payment",
    icon: Package,
    color: "blue",
    nodes: [
      { id: "pr", label: "Purchase\nRequisition", icon: FileText, color: "bg-blue-100 text-blue-700 border-blue-300", description: "Create internal request for materials or services", transaction: "ME51N", link: "/materials/purchase-orders" },
      { id: "rfq", label: "Request for\nQuotation", icon: ClipboardCheck, color: "bg-blue-100 text-blue-700 border-blue-300", description: "Send RFQ to vendors for pricing", transaction: "ME41", link: "/finance/vendors" },
      { id: "po", label: "Purchase\nOrder", icon: Package, color: "bg-blue-200 text-blue-800 border-blue-400", description: "Create purchase order with selected vendor", transaction: "ME21N", link: "/materials/purchase-orders" },
      { id: "gr", label: "Goods\nReceipt", icon: Box, color: "bg-green-100 text-green-700 border-green-300", description: "Receive goods in warehouse against PO", transaction: "MIGO", link: "/materials/inventory" },
      { id: "ir", label: "Invoice\nReceipt", icon: CreditCard, color: "bg-purple-100 text-purple-700 border-purple-300", description: "Post vendor invoice against PO/GR", transaction: "MIRO", link: "/finance/ap" },
      { id: "pay", label: "Payment\nRun", icon: Landmark, color: "bg-emerald-100 text-emerald-700 border-emerald-300", description: "Execute payment to vendor via bank", transaction: "F110", link: "/finance/journal-entries" },
    ],
  },
  {
    id: "order_to_cash",
    name: "Order to Cash (O2C)",
    description: "Complete sales cycle from order through cash collection",
    icon: ShoppingCart,
    color: "green",
    nodes: [
      { id: "so", label: "Sales\nOrder", icon: ShoppingCart, color: "bg-green-100 text-green-700 border-green-300", description: "Create customer sales order", transaction: "VA01", link: "/sales/orders" },
      { id: "del", label: "Delivery", icon: Truck, color: "bg-green-200 text-green-800 border-green-400", description: "Create outbound delivery from sales order", transaction: "VL01N", link: "/sales/deliveries" },
      { id: "pick", label: "Picking &\nPacking", icon: Box, color: "bg-amber-100 text-amber-700 border-amber-300", description: "Pick materials from warehouse bins", transaction: "VL02N", link: "/warehouse/bins" },
      { id: "gi", label: "Goods\nIssue", icon: Package, color: "bg-amber-200 text-amber-800 border-amber-400", description: "Post goods issue for delivery", transaction: "VL02N", link: "/materials/inventory" },
      { id: "inv", label: "Billing /\nInvoice", icon: FileText, color: "bg-purple-100 text-purple-700 border-purple-300", description: "Create customer invoice", transaction: "VF01", link: "/sales/invoices" },
      { id: "cash", label: "Payment\nReceipt", icon: CreditCard, color: "bg-emerald-100 text-emerald-700 border-emerald-300", description: "Receive and post customer payment", transaction: "F-28", link: "/finance/ar" },
    ],
  },
  {
    id: "plan_to_produce",
    name: "Plan to Produce",
    description: "From demand planning through production completion",
    icon: Factory,
    color: "orange",
    nodes: [
      { id: "dp", label: "Demand\nPlanning", icon: Layers, color: "bg-orange-100 text-orange-700 border-orange-300", description: "Forecast customer demand for planning", transaction: "MD61", link: "/mrp" },
      { id: "mrp", label: "MRP\nRun", icon: Workflow, color: "bg-orange-200 text-orange-800 border-orange-400", description: "Run Material Requirements Planning", transaction: "MD01", link: "/mrp" },
      { id: "plo", label: "Planned\nOrder", icon: FileText, color: "bg-amber-100 text-amber-700 border-amber-300", description: "Convert MRP output to planned orders", transaction: "MD04", link: "/mrp-board" },
      { id: "pro", label: "Production\nOrder", icon: Factory, color: "bg-red-100 text-red-700 border-red-300", description: "Create production order from planned order", transaction: "CO01", link: "/production/orders" },
      { id: "conf", label: "Confirmation", icon: ClipboardCheck, color: "bg-green-100 text-green-700 border-green-300", description: "Confirm production milestones and yield", transaction: "CO11N", link: "/production/orders" },
      { id: "fgr", label: "Finished Goods\nReceipt", icon: Box, color: "bg-emerald-100 text-emerald-700 border-emerald-300", description: "Receive finished goods into inventory", transaction: "MIGO", link: "/materials/inventory" },
    ],
  },
  {
    id: "hire_to_retire",
    name: "Hire to Retire",
    description: "Complete employee lifecycle management",
    icon: Users,
    color: "purple",
    nodes: [
      { id: "hire", label: "Employee\nOnboarding", icon: Users, color: "bg-purple-100 text-purple-700 border-purple-300", description: "Create employee master record", transaction: "PA40", link: "/hr/employees" },
      { id: "org", label: "Org\nAssignment", icon: Layers, color: "bg-purple-200 text-purple-800 border-purple-400", description: "Assign to org unit, position, cost center", transaction: "PP01", link: "/hr/org-units" },
      { id: "time", label: "Time\nManagement", icon: FileText, color: "bg-blue-100 text-blue-700 border-blue-300", description: "Record attendance, overtime, absences", transaction: "PA61", link: "/hr/time-entries" },
      { id: "leave", label: "Leave\nManagement", icon: ClipboardCheck, color: "bg-amber-100 text-amber-700 border-amber-300", description: "Submit and approve leave requests", transaction: "PA61", link: "/hr/leave-requests" },
      { id: "maint", label: "Maintenance\nTracking", icon: Wrench, color: "bg-orange-100 text-orange-700 border-orange-300", description: "Equipment assignments and work orders", transaction: "IW31", link: "/maintenance/work-orders" },
      { id: "retire", label: "Offboarding", icon: Users, color: "bg-red-100 text-red-700 border-red-300", description: "Process employee separation", transaction: "PA40", link: "/hr/employees" },
    ],
  },
];

function ProcessNodeCard({ node, isActive, onClick }: { node: ProcessNode; isActive: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`flex flex-col items-center text-center w-[120px] transition-all ${isActive ? "scale-110" : "hover:scale-105"}`}>
      <div className={`w-16 h-16 rounded-2xl border-2 ${node.color} flex items-center justify-center shadow-sm transition-all ${isActive ? "ring-4 ring-primary-200 shadow-lg" : ""}`}>
        <node.icon className="w-7 h-7" />
      </div>
      <p className="text-xs font-medium text-gray-800 mt-2 whitespace-pre-line leading-tight">{node.label}</p>
    </button>
  );
}

export default function ProcessVisualizer() {
  const [activeProcess, setActiveProcess] = useState(PROCESSES[0].id);
  const [activeNode, setActiveNode] = useState<string | null>(null);

  const process = PROCESSES.find((p) => p.id === activeProcess)!;
  const selectedNode = process.nodes.find((n) => n.id === activeNode);

  return (
    <div className="space-y-6">
      <PageHeader title="Business Process Visualizer" subtitle="Interactive ERP process flows — click any step to learn more and navigate" />

      {/* Process selector */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {PROCESSES.map((p) => (
          <button key={p.id} onClick={() => { setActiveProcess(p.id); setActiveNode(null); }}
            className={`p-4 rounded-xl border-2 transition-all text-left ${
              activeProcess === p.id
                ? "border-primary-500 bg-primary-50 shadow-md"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}>
            <p.icon className={`w-6 h-6 mb-2 ${activeProcess === p.id ? "text-primary-600" : "text-gray-400"}`} />
            <p className="text-sm font-semibold text-gray-900">{p.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>
          </button>
        ))}
      </div>

      {/* Flow diagram */}
      <div className="bg-white rounded-2xl border p-8 overflow-x-auto">
        <div className="flex items-center justify-center gap-2 min-w-[700px]">
          {process.nodes.map((node, i) => (
            <div key={node.id} className="flex items-center">
              <ProcessNodeCard node={node} isActive={activeNode === node.id} onClick={() => setActiveNode(activeNode === node.id ? null : node.id)} />
              {i < process.nodes.length - 1 && (
                <div className="flex items-center px-1">
                  <div className="w-6 h-0.5 bg-gray-300" />
                  <ChevronRight className="w-4 h-4 text-gray-400 -ml-1" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Detail panel */}
      {selectedNode && (
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden animate-in slide-in-from-top">
          <div className={`px-6 py-4 ${selectedNode.color} border-b`}>
            <div className="flex items-center gap-3">
              <selectedNode.icon className="w-6 h-6" />
              <div>
                <h3 className="text-lg font-bold">{selectedNode.label.replace("\n", " ")}</h3>
                <p className="text-sm opacity-80">SAP Transaction: {selectedNode.transaction}</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <p className="text-sm text-gray-700 mb-4">{selectedNode.description}</p>
            <div className="flex items-center gap-3">
              <Link to={selectedNode.link}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors">
                <MousePointerClick className="w-4 h-4" /> Open in ERP <ArrowRight className="w-3 h-3" />
              </Link>
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Info className="w-3 h-3" /> Click to practice this step in the simulator
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Hint */}
      {!selectedNode && (
        <div className="text-center py-4">
          <p className="text-sm text-gray-400 flex items-center justify-center gap-2">
            <MousePointerClick className="w-4 h-4" /> Click any process step above to see details and navigate to the ERP module
          </p>
        </div>
      )}
    </div>
  );
}
