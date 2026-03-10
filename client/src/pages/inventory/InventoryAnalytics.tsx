import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { api } from "../../api/client";
import PageHeader from "../../components/PageHeader";
import DataTable from "../../components/DataTable";
import Modal from "../../components/Modal";
import KPICard from "../../components/KPICard";
import { FormInput, FormSelect } from "../../components/FormField";
import { Play, Loader2, Settings, Calculator } from "lucide-react";

type TabId = "abc" | "policies" | "eoq";

interface ABCClassification {
  materialId: string;
  abcClass: string;
  value: number;
}

interface InventoryPolicy {
  id: string;
  materialId: string;
  material?: { materialNumber: string; description: string };
  policyType: string;
  orderQuantity?: number;
  reorderPoint?: number;
  safetyStock?: number;
  abcClass?: string;
}

interface Material {
  id: string;
  materialNumber: string;
  description: string;
}

export default function InventoryAnalytics() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>("abc");
  const [abcResult, setAbcResult] = useState<{ classifications: ABCClassification[] } | null>(null);
  const [editPolicy, setEditPolicy] = useState<InventoryPolicy | null>(null);
  const [eoqForm, setEoqForm] = useState({
    annualDemand: "",
    orderingCost: "",
    unitPrice: "",
    holdingCostPct: "",
  });
  const [eoqResult, setEoqResult] = useState<{
    eoq: number;
    ordersPerYear: number;
    costCurve: { qty: number; cost: number }[];
  } | null>(null);
  const [applyMaterialId, setApplyMaterialId] = useState("");

  const policiesQuery = useQuery({
    queryKey: ["inventory-policies"],
    queryFn: () => api.get<InventoryPolicy[]>("/inventory-policies/policies"),
    enabled: activeTab === "policies",
  });

  const materialsQuery = useQuery({
    queryKey: ["materials-list"],
    queryFn: () => api.get<{ data: Material[] }>("/materials/items", { limit: 500 }),
  });

  const runAbcMutation = useMutation({
    mutationFn: () => api.post<{ classifications: ABCClassification[] }>("/inventory-policies/abc-classification"),
    onSuccess: (data) => {
      setAbcResult(data);
      queryClient.invalidateQueries({ queryKey: ["inventory-policies"] });
    },
  });

  const applyEoqMutation = useMutation({
    mutationFn: ({ materialId }: { materialId: string }) =>
      api.post("/inventory-policies/calculate-eoq", {
        materialId,
        annualDemand: Number(eoqForm.annualDemand),
        orderingCost: Number(eoqForm.orderingCost),
        holdingCostPct: Number(eoqForm.holdingCostPct),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-policies"] });
      setApplyMaterialId("");
    },
  });

  const savePolicyMutation = useMutation({
    mutationFn: (data: Partial<InventoryPolicy> & { materialId: string; policyType: string }) =>
      api.post("/inventory-policies/policies", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-policies"] });
      setEditPolicy(null);
    },
  });

  const materials = materialsQuery.data?.data ?? (Array.isArray(materialsQuery.data) ? materialsQuery.data : []);
  const policies = policiesQuery.data ?? [];

  const materialMap = Object.fromEntries(materials.map((m: Material) => [m.id, m]));

  const abcWithMaterial = abcResult?.classifications?.map((c) => ({
    ...c,
    material: materialMap[c.materialId] as Material | undefined,
  })) ?? [];

  const totalValue = abcWithMaterial.reduce((s, c) => s + c.value, 0);
  const abcSummary = {
    A: abcWithMaterial.filter((c) => c.abcClass === "A"),
    B: abcWithMaterial.filter((c) => c.abcClass === "B"),
    C: abcWithMaterial.filter((c) => c.abcClass === "C"),
  };

  const handleCalculateEoq = () => {
    const D = Number(eoqForm.annualDemand);
    const S = Number(eoqForm.orderingCost);
    const unitPrice = Number(eoqForm.unitPrice) || 1;
    const holdingPct = Number(eoqForm.holdingCostPct) / 100;
    const H = unitPrice * holdingPct;
    if (D <= 0 || S < 0 || H <= 0) return;
    const EOQ = Math.sqrt((2 * D * S) / H);
    const ordersPerYear = D / EOQ;
    const costCurve: { qty: number; cost: number }[] = [];
    for (let q = Math.max(1, Math.floor(EOQ / 2)); q <= Math.ceil(EOQ * 2); q += Math.max(1, Math.floor(EOQ / 10))) {
      const orderingCost = (D / q) * S;
      const holdingCost = (q / 2) * H;
      costCurve.push({ qty: q, cost: orderingCost + holdingCost });
    }
    costCurve.sort((a, b) => a.qty - b.qty);
    setEoqResult({ eoq: EOQ, ordersPerYear, costCurve });
  };

  const pieData = [
    { name: "A", value: abcSummary.A.reduce((s, c) => s + c.value, 0), color: "#ef4444" },
    { name: "B", value: abcSummary.B.reduce((s, c) => s + c.value, 0), color: "#f59e0b" },
    { name: "C", value: abcSummary.C.reduce((s, c) => s + c.value, 0), color: "#10b981" },
  ].filter((d) => d.value > 0);

  const totalMaterials = materials.length;
  const totalStockValue = materials.reduce(
    (s: number, m: Material & { stockQuantity?: number; standardPrice?: number }) =>
      s + (m.stockQuantity ?? 0) * (m.standardPrice ?? 0),
    0
  );
  const belowReorder = materials.filter(
    (m: Material & { stockQuantity?: number; reorderPoint?: number }) =>
      (m.reorderPoint ?? 0) > 0 && (m.stockQuantity ?? 0) <= (m.reorderPoint ?? 0)
  ).length;

  return (
    <div>
      <PageHeader
        title="Inventory Analytics & Policies"
        subtitle="ABC classification, policies, and EOQ optimization"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KPICard title="Total Materials" value={totalMaterials} color="blue" />
        <KPICard title="Total Stock Value" value={`$${totalStockValue.toLocaleString()}`} color="green" />
        <KPICard title="Materials Below Reorder" value={belowReorder} color={belowReorder > 0 ? "red" : "green"} />
      </div>

      <div className="card">
        <div className="border-b flex gap-1 p-2">
          {(["abc", "policies", "eoq"] as TabId[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                activeTab === tab ? "bg-primary-600 text-white" : "hover:bg-gray-100 text-gray-600"
              }`}
            >
              {tab === "abc" && <Play className="w-4 h-4" />}
              {tab === "policies" && <Settings className="w-4 h-4" />}
              {tab === "eoq" && <Calculator className="w-4 h-4" />}
              {tab === "abc" && "ABC Classification"}
              {tab === "policies" && "Inventory Policies"}
              {tab === "eoq" && "EOQ Calculator"}
            </button>
          ))}
        </div>

        {activeTab === "abc" && (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">ABC Analysis</h3>
              <button
                onClick={() => runAbcMutation.mutate()}
                disabled={runAbcMutation.isPending}
                className="btn-primary"
              >
                {runAbcMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Run ABC Classification
              </button>
            </div>
            {abcResult ? (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="card p-5">
                    <h4 className="text-sm font-medium text-gray-700 mb-4">Distribution by Value</h4>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                          label={({ name, value }) => `${name}: $${value.toLocaleString()}`}
                        >
                          {pieData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-gray-700">Summary</h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-4 bg-red-50 rounded-lg">
                        <p className="text-xs font-medium text-red-600">A Items</p>
                        <p className="text-xl font-bold text-red-900">{abcSummary.A.length}</p>
                        <p className="text-xs text-red-700">
                          {totalValue > 0 ? ((abcSummary.A.reduce((s, c) => s + c.value, 0) / totalValue) * 100).toFixed(1) : 0}% of value
                        </p>
                      </div>
                      <div className="p-4 bg-amber-50 rounded-lg">
                        <p className="text-xs font-medium text-amber-600">B Items</p>
                        <p className="text-xl font-bold text-amber-900">{abcSummary.B.length}</p>
                        <p className="text-xs text-amber-700">
                          {totalValue > 0 ? ((abcSummary.B.reduce((s, c) => s + c.value, 0) / totalValue) * 100).toFixed(1) : 0}% of value
                        </p>
                      </div>
                      <div className="p-4 bg-emerald-50 rounded-lg">
                        <p className="text-xs font-medium text-emerald-600">C Items</p>
                        <p className="text-xl font-bold text-emerald-900">{abcSummary.C.length}</p>
                        <p className="text-xs text-emerald-700">
                          {totalValue > 0 ? ((abcSummary.C.reduce((s, c) => s + c.value, 0) / totalValue) * 100).toFixed(1) : 0}% of value
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <DataTable<typeof abcWithMaterial[0]>
                  columns={[
                    {
                      key: "material",
                      label: "Material",
                      render: (r) => r.material ? `${r.material.materialNumber} - ${r.material.description}` : r.materialId,
                    },
                    {
                      key: "value",
                      label: "Annual Value",
                      render: (r) => `$${r.value.toLocaleString()}`,
                    },
                    {
                      key: "abcClass",
                      label: "Class",
                      render: (r) => (
                        <span
                          className={`badge ${
                            r.abcClass === "A" ? "badge-red" : r.abcClass === "B" ? "badge-yellow" : "badge-green"
                          }`}
                        >
                          {r.abcClass}
                        </span>
                      ),
                    },
                    {
                      key: "pct",
                      label: "% of Total Value",
                      render: (r) =>
                        totalValue > 0 ? `${((r.value / totalValue) * 100).toFixed(1)}%` : "-",
                    },
                  ]}
                  data={abcWithMaterial}
                />
              </>
            ) : (
              <p className="text-center py-12 text-gray-500">
                Run ABC Classification to analyze materials by annual value. Requires inventory policies with annual demand.
              </p>
            )}
          </div>
        )}

        {activeTab === "policies" && (
          <div className="p-4">
            <DataTable<InventoryPolicy>
              columns={[
                {
                  key: "material",
                  label: "Material",
                  render: (r) =>
                    r.material ? `${r.material.materialNumber} - ${r.material.description}` : r.materialId,
                },
                { key: "policyType", label: "Policy Type", render: (r) => <span className="badge-blue">{r.policyType}</span> },
                { key: "orderQuantity", label: "Order Qty", render: (r) => r.orderQuantity ?? "-" },
                { key: "reorderPoint", label: "Reorder Point", render: (r) => r.reorderPoint ?? "-" },
                { key: "safetyStock", label: "Safety Stock", render: (r) => r.safetyStock ?? "-" },
                { key: "abcClass", label: "ABC Class", render: (r) => r.abcClass ?? "-" },
                {
                  key: "actions",
                  label: "",
                  render: (r) => (
                    <button onClick={() => setEditPolicy(r)} className="btn-secondary btn-sm">
                      Set Policy
                    </button>
                  ),
                  className: "w-24",
                },
              ]}
              data={policies}
              isLoading={policiesQuery.isLoading}
            />
          </div>
        )}

        {activeTab === "eoq" && (
          <div className="p-6 space-y-6">
            <div className="max-w-md space-y-4">
              <h3 className="text-sm font-semibold text-gray-900">EOQ Calculator</h3>
              <FormInput
                label="Annual Demand (D)"
                type="number"
                value={eoqForm.annualDemand}
                onChange={(e) => setEoqForm({ ...eoqForm, annualDemand: e.target.value })}
              />
              <FormInput
                label="Ordering Cost (S)"
                type="number"
                value={eoqForm.orderingCost}
                onChange={(e) => setEoqForm({ ...eoqForm, orderingCost: e.target.value })}
              />
              <FormInput
                label="Unit Price"
                type="number"
                value={eoqForm.unitPrice}
                onChange={(e) => setEoqForm({ ...eoqForm, unitPrice: e.target.value })}
              />
              <FormInput
                label="Holding Cost %"
                type="number"
                value={eoqForm.holdingCostPct}
                onChange={(e) => setEoqForm({ ...eoqForm, holdingCostPct: e.target.value })}
              />
              <button
                onClick={handleCalculateEoq}
                disabled={
                  !eoqForm.annualDemand ||
                  !eoqForm.orderingCost ||
                  !eoqForm.holdingCostPct ||
                  Number(eoqForm.annualDemand) <= 0
                }
                className="btn-primary"
              >
                Calculate EOQ
              </button>
            </div>
            {eoqResult && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <KPICard title="Optimal EOQ" value={Math.ceil(eoqResult.eoq)} color="blue" />
                  <KPICard title="Orders per Year" value={eoqResult.ordersPerYear.toFixed(1)} color="green" />
                </div>
                <div className="card p-5">
                  <h4 className="text-sm font-semibold text-gray-900 mb-4">Total Annual Cost vs Order Quantity</h4>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={eoqResult.costCurve}>
                      <XAxis dataKey="qty" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: number) => [`$${v.toFixed(2)}`, "Total Cost"]} />
                      <Line type="monotone" dataKey="cost" stroke="#3b82f6" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center gap-4">
                  <FormSelect
                    label="Apply to Material"
                    value={applyMaterialId}
                    onChange={(e) => setApplyMaterialId(e.target.value)}
                    options={materials.map((m: Material) => ({
                      value: m.id,
                      label: `${m.materialNumber} - ${m.description}`,
                    }))}
                  />
                  <button
                    onClick={() => applyMaterialId && applyEoqMutation.mutate({ materialId: applyMaterialId })}
                    disabled={!applyMaterialId || applyEoqMutation.isPending}
                    className="btn-primary self-end"
                  >
                    {applyEoqMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Apply to Material
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <Modal
        isOpen={!!editPolicy}
        onClose={() => setEditPolicy(null)}
        title="Set Policy"
        footer={
          <>
            <button onClick={() => setEditPolicy(null)} className="btn-secondary">Cancel</button>
            <button
              onClick={() =>
                editPolicy &&
                savePolicyMutation.mutate({
                  materialId: editPolicy.materialId,
                  policyType: editPolicy.policyType,
                  orderQuantity: editPolicy.orderQuantity ?? undefined,
                  reorderPoint: editPolicy.reorderPoint ?? undefined,
                  safetyStock: editPolicy.safetyStock ?? undefined,
                })
              }
              disabled={savePolicyMutation.isPending}
              className="btn-primary"
            >
              Save
            </button>
          </>
        }
      >
        {editPolicy && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Material: {editPolicy.material?.materialNumber} - {editPolicy.material?.description}
            </p>
            <FormSelect
              label="Policy Type"
              value={editPolicy.policyType}
              onChange={(e) => setEditPolicy({ ...editPolicy, policyType: e.target.value })}
              options={[
                { value: "eoq", label: "EOQ" },
                { value: "rop", label: "Reorder Point" },
                { value: "min_max", label: "Min-Max" },
              ]}
            />
            <FormInput
              label="Order Quantity"
              type="number"
              value={editPolicy.orderQuantity ?? ""}
              onChange={(e) => setEditPolicy({ ...editPolicy, orderQuantity: e.target.value ? Number(e.target.value) : undefined })}
            />
            <FormInput
              label="Reorder Point"
              type="number"
              value={editPolicy.reorderPoint ?? ""}
              onChange={(e) => setEditPolicy({ ...editPolicy, reorderPoint: e.target.value ? Number(e.target.value) : undefined })}
            />
            <FormInput
              label="Safety Stock"
              type="number"
              value={editPolicy.safetyStock ?? ""}
              onChange={(e) => setEditPolicy({ ...editPolicy, safetyStock: e.target.value ? Number(e.target.value) : undefined })}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
