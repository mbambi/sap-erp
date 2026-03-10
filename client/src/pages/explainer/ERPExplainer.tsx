import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { api } from "../../api/client";
import PageHeader from "../../components/PageHeader";
import Modal from "../../components/Modal";
import { FormInput, FormSelect } from "../../components/FormField";
import { HelpCircle, FileText, List, Package, GitBranch, Loader2, ArrowRight } from "lucide-react";

type TabId = "production" | "planned" | "stock" | "process";

interface ProductionOrder {
  id: string;
  orderNumber: string;
  materialNumber: string;
  quantity: number;
  status: string;
}

interface PlannedOrder {
  id: string;
  materialNumber: string;
  quantity: number;
  requirementDate: string;
}

interface Material {
  id: string;
  materialNumber: string;
  description: string;
}

export default function ERPExplainer() {
  const [activeTab, setActiveTab] = useState<TabId>("production");
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [selectedMaterialId, setSelectedMaterialId] = useState("");
  const [processDocType, setProcessDocType] = useState("PO");
  const [processDocNumber, setProcessDocNumber] = useState("");
  const [explainResult, setExplainResult] = useState<Record<string, unknown> | null>(null);
  const [stockExplainResult, setStockExplainResult] = useState<{
    movements: { date: string; inflow: number; outflow: number; balance: number }[];
  } | null>(null);

  const productionOrdersQuery = useQuery({
    queryKey: ["production-orders"],
    queryFn: () => api.get<{ data: ProductionOrder[] }>("/production/orders", { limit: 100 }),
    enabled: activeTab === "production",
  });

  const plannedOrdersQuery = useQuery({
    queryKey: ["planned-orders"],
    queryFn: () => api.get<{ data: PlannedOrder[] }>("/mrp/planned-orders", { limit: 100 }),
    enabled: activeTab === "planned",
  });

  const materialsQuery = useQuery({
    queryKey: ["materials-list"],
    queryFn: () => api.get<{ data: Material[] }>("/materials/items", { limit: 500 }),
  });

  const explainMutation = useMutation({
    mutationFn: () =>
      api.post<Record<string, unknown>>("/explainer/explain/production-order", {
        productionOrderId: selectedOrderId,
      }),
    onSuccess: (data) => setExplainResult(data),
  });

  const processFlowMutation = useMutation({
    mutationFn: () =>
      api.post<Record<string, unknown>>("/explainer/explain/process-flow", {
        documentType: processDocType,
        documentNumber: processDocNumber,
      }),
    onSuccess: (data) => setExplainResult(data),
  });

  const productionOrders = productionOrdersQuery.data?.data ?? [];
  const plannedOrders = plannedOrdersQuery.data?.data ?? [];
  const materials = materialsQuery.data?.data ?? (Array.isArray(materialsQuery.data) ? materialsQuery.data : []);

  const stockMovementData = [
    { date: "Day 1", inflow: 100, outflow: 20, balance: 80 },
    { date: "Day 2", inflow: 0, outflow: 35, balance: 45 },
    { date: "Day 3", inflow: 50, outflow: 15, balance: 80 },
    { date: "Day 4", inflow: 0, outflow: 40, balance: 40 },
    { date: "Day 5", inflow: 80, outflow: 25, balance: 95 },
  ];

  const processSteps = [
    { id: "1", name: "Order Created", status: "completed", docRef: "SO-1001", timestamp: "09:00" },
    { id: "2", name: "MRP Run", status: "completed", docRef: "MRP-2024-001", timestamp: "09:15" },
    { id: "3", name: "PO Released", status: "current", docRef: "PO-5001", timestamp: "10:30" },
    { id: "4", name: "Goods Receipt", status: "pending", docRef: "-", timestamp: "-" },
    { id: "5", name: "Invoice", status: "pending", docRef: "-", timestamp: "-" },
  ];

  return (
    <div>
      <PageHeader
        title="ERP Decision Explainer"
        subtitle="Understand WHY the system made decisions"
      />

      <div className="card">
        <div className="border-b flex gap-1 p-2 overflow-x-auto">
          {(
            [
              { id: "production" as TabId, label: "Production Orders", icon: FileText },
              { id: "planned" as TabId, label: "Planned Orders", icon: List },
              { id: "stock" as TabId, label: "Stock Levels", icon: Package },
              { id: "process" as TabId, label: "Process Flows", icon: GitBranch },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                activeTab === id ? "bg-primary-600 text-white" : "hover:bg-gray-100 text-gray-600"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Production Orders tab */}
        {activeTab === "production" && (
          <div className="p-6 space-y-4">
            <div className="flex gap-4 items-end">
              <FormSelect
                label="Select Production Order"
                value={selectedOrderId}
                onChange={(e) => setSelectedOrderId(e.target.value)}
                options={productionOrders.map((o) => ({
                  value: o.id,
                  label: `${o.orderNumber} - ${o.materialNumber} (${o.quantity})`,
                }))}
              />
              <button
                onClick={() => explainMutation.mutate()}
                disabled={!selectedOrderId || explainMutation.isPending}
                className="btn-primary"
              >
                {explainMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <HelpCircle className="w-4 h-4" />
                )}{" "}
                Explain
              </button>
            </div>
            {explainResult && (
              <div className="border rounded-lg p-6 bg-gray-50/50 space-y-6">
                <h4 className="text-sm font-semibold text-gray-900">Visual Explanation</h4>
                <div className="flex flex-col gap-4">
                  <FlowStep
                    title="Sales Order Demand"
                    data="SO-1001: 50 units required by 2024-03-15"
                    status="source"
                  />
                  <ArrowRight className="w-5 h-5 text-gray-400 self-center" />
                  <FlowStep
                    title="MRP Calculation"
                    data="Net requirement: 50 - 20 (stock) = 30 to produce"
                    status="calculation"
                  />
                  <ArrowRight className="w-5 h-5 text-gray-400 self-center" />
                  <FlowStep
                    title="Production Order"
                    data="PO-4001: 30 units, Start 2024-03-10"
                    status="result"
                  />
                </div>
                <div>
                  <h5 className="text-xs font-medium text-gray-600 mb-2">BOM Tree</h5>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="badge-green">M-100</span>
                      <span>30 qty - Sufficient</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="badge-red">M-200</span>
                      <span>15 qty - Shortage 5</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Planned Orders tab */}
        {activeTab === "planned" && (
          <div className="p-6 space-y-4">
            <div className="flex gap-4 items-end">
              <FormSelect
                label="Select Planned Order"
                value={selectedOrderId}
                onChange={(e) => setSelectedOrderId(e.target.value)}
                options={plannedOrders.map((o) => ({
                  value: o.id,
                  label: `${o.materialNumber} - ${o.quantity} (${o.requirementDate})`,
                }))}
              />
              <button
                onClick={() => explainMutation.mutate()}
                disabled={!selectedOrderId}
                className="btn-primary"
              >
                Explain
              </button>
            </div>
            {explainResult && (
              <div className="border rounded-lg p-6 bg-gray-50/50">
                <h4 className="text-sm font-semibold text-gray-900 mb-4">Explanation</h4>
                <div className="space-y-2 text-sm">
                  <p><strong>Demand source:</strong> Forecast + Sales orders</p>
                  <p><strong>Current stock:</strong> 20 units</p>
                  <p><strong>Net requirement:</strong> 50 - 20 = 30 units</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Stock Levels tab */}
        {activeTab === "stock" && (
          <div className="p-6 space-y-4">
            <div className="flex gap-4 items-end">
              <FormSelect
                label="Select Material"
                value={selectedMaterialId}
                onChange={(e) => setSelectedMaterialId(e.target.value)}
                options={materials.map((m: Material) => ({
                  value: m.id,
                  label: `${m.materialNumber} - ${m.description}`,
                }))}
              />
              <button
                onClick={() => setStockExplainResult({ movements: stockMovementData })}
                disabled={!selectedMaterialId}
                className="btn-primary"
              >
                Explain Stock Level
              </button>
            </div>
            {stockExplainResult && (
              <div className="border rounded-lg p-6 bg-gray-50/50 space-y-4">
                <h4 className="text-sm font-semibold text-gray-900">Inflows & Outflows Timeline</h4>
                <div className="space-y-2 text-sm mb-4">
                  {stockMovementData.map((m, i) => (
                    <div key={i} className="flex gap-4">
                      <span className="w-16">{m.date}</span>
                      <span className="text-emerald-600">+{m.inflow}</span>
                      <span className="text-red-600">-{m.outflow}</span>
                      <span className="font-medium">Balance: {m.balance}</span>
                    </div>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={stockMovementData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="balance" stroke="#2563eb" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* Process Flows tab */}
        {activeTab === "process" && (
          <div className="p-6 space-y-4">
            <div className="flex gap-4 items-end flex-wrap">
              <FormSelect
                label="Document Type"
                value={processDocType}
                onChange={(e) => setProcessDocType(e.target.value)}
                options={[
                  { value: "PO", label: "Purchase Order" },
                  { value: "SO", label: "Sales Order" },
                ]}
              />
              <FormInput
                label="Document Number"
                value={processDocNumber}
                onChange={(e) => setProcessDocNumber(e.target.value)}
                placeholder="e.g. 5001"
              />
              <button
                onClick={() => processFlowMutation.mutate()}
                disabled={!processDocNumber || processFlowMutation.isPending}
                className="btn-primary"
              >
                {processFlowMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <GitBranch className="w-4 h-4" />
                )}{" "}
                Trace Process
              </button>
            </div>
            {explainResult && (
              <div className="border rounded-lg p-6 bg-gray-50/50">
                <h4 className="text-sm font-semibold text-gray-900 mb-4">Process Flow</h4>
                <div className="flex items-center gap-2 overflow-x-auto pb-4">
                  {processSteps.map((step, i) => (
                    <div key={step.id} className="flex items-center">
                      <div
                        className={`px-4 py-3 rounded-lg border min-w-[140px] text-center ${
                          step.status === "completed"
                            ? "bg-emerald-50 border-emerald-200"
                            : step.status === "current"
                            ? "bg-blue-50 border-blue-200 ring-2 ring-blue-400"
                            : "bg-gray-50 border-gray-200"
                        }`}
                      >
                        <p className="text-xs font-medium text-gray-600">{step.name}</p>
                        <p className="text-xs text-gray-500 mt-1">{step.docRef}</p>
                        <p className="text-xs text-gray-400">{step.timestamp}</p>
                      </div>
                      {i < processSteps.length - 1 && (
                        <div className="w-8 h-0.5 bg-gray-300 mx-1" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function FlowStep({
  title,
  data,
  status,
}: {
  title: string;
  data: string;
  status: string;
}) {
  return (
    <div className="p-4 border rounded-lg bg-white">
      <p className="text-sm font-medium text-gray-900">{title}</p>
      <p className="text-sm text-gray-600 mt-1">{data}</p>
    </div>
  );
}
