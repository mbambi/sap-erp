import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { api } from "../../api/client";
import PageHeader from "../../components/PageHeader";
import DataTable from "../../components/DataTable";
import Modal from "../../components/Modal";
import KPICard from "../../components/KPICard";
import { FormInput, FormSelect } from "../../components/FormField";
import { DollarSign, Calculator, Loader2, CheckCircle } from "lucide-react";

interface CostEstimate {
  id: string;
  materialNumber: string;
  materialDescription?: string;
  quantity: number;
  materialCost: number;
  laborCost: number;
  overhead: number;
  total: number;
  perUnit: number;
  status: string;
}

interface Material {
  id: string;
  materialNumber: string;
  description: string;
}

interface EstimateResult {
  materialCosts: { component: string; qty: number; cost: number }[];
  laborCosts: { step: string; time: number; rate: number; cost: number }[];
  overhead: number;
  overheadPct: number;
  total: number;
  perUnit: number;
}

export default function ProductCosting() {
  const queryClient = useQueryClient();
  const [showCalcModal, setShowCalcModal] = useState(false);
  const [calcForm, setCalcForm] = useState({ materialId: "", quantity: "" });
  const [estimateResult, setEstimateResult] = useState<EstimateResult | null>(null);

  const estimatesQuery = useQuery({
    queryKey: ["costing-estimates"],
    queryFn: () => api.get<CostEstimate[]>("/costing/estimates"),
  });

  const varianceQuery = useQuery({
    queryKey: ["costing-variance"],
    queryFn: () => api.get<{ data: { material: string; estimated: number; actual: number; variance: number }[] }>("/costing/variance"),
  });

  const materialsQuery = useQuery({
    queryKey: ["materials-bom"],
    queryFn: () => api.get<{ data: Material[] }>("/materials/items", { limit: 500 }),
  });

  const estimateMutation = useMutation({
    mutationFn: () =>
      api.post<EstimateResult>("/costing/estimate", {
        materialId: calcForm.materialId,
        quantity: Number(calcForm.quantity),
      }),
    onSuccess: (data) => setEstimateResult(data),
  });

  const releaseMutation = useMutation({
    mutationFn: (id: string) => api.post(`/costing/estimates/${id}/release`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["costing-estimates"] });
    },
  });

  const estimates = Array.isArray(estimatesQuery.data) ? estimatesQuery.data : (estimatesQuery.data as { data?: CostEstimate[] })?.data ?? [];
  const varianceData = varianceQuery.data?.data ?? [];
  const materials = materialsQuery.data?.data ?? (Array.isArray(materialsQuery.data) ? materialsQuery.data : []);

  const totalEstimates = estimates.length;
  const releasedCount = estimates.filter((e) => e.status === "released").length;
  const avgPerUnit =
    estimates.length > 0
      ? estimates.reduce((s, e) => s + e.perUnit, 0) / estimates.length
      : 0;

  const pieData = estimateResult
    ? [
        {
          name: "Material",
          value: estimateResult.materialCosts?.reduce((s, c) => s + c.cost, 0) ?? 0,
          color: "#2563eb",
        },
        {
          name: "Labor",
          value: estimateResult.laborCosts?.reduce((s, c) => s + c.cost, 0) ?? 0,
          color: "#10b981",
        },
        {
          name: "Overhead",
          value: estimateResult.overhead ?? 0,
          color: "#f59e0b",
        },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <div>
      <PageHeader
        title="Product Costing"
        subtitle="Cost estimates and variance analysis"
      >
        <button onClick={() => setShowCalcModal(true)} className="btn-primary">
          <Calculator className="w-4 h-4" /> Calculate Cost
        </button>
      </PageHeader>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KPICard
          title="Total Estimates"
          value={totalEstimates}
          icon={DollarSign}
          color="blue"
        />
        <KPICard
          title="Released Estimates"
          value={releasedCount}
          icon={CheckCircle}
          color="green"
        />
        <KPICard
          title="Avg Cost Per Unit"
          value={`$${avgPerUnit.toFixed(2)}`}
          color="purple"
        />
      </div>

      {/* Cost estimates table */}
      <div className="card mb-6">
        <DataTable<CostEstimate>
          columns={[
            {
              key: "material",
              label: "Material",
              render: (r) =>
                r.materialDescription
                  ? `${r.materialNumber} - ${r.materialDescription}`
                  : r.materialNumber,
            },
            { key: "quantity", label: "Quantity", render: (r) => r.quantity },
            {
              key: "materialCost",
              label: "Material Cost",
              render: (r) => `$${r.materialCost.toFixed(2)}`,
            },
            {
              key: "laborCost",
              label: "Labor Cost",
              render: (r) => `$${r.laborCost.toFixed(2)}`,
            },
            {
              key: "overhead",
              label: "Overhead",
              render: (r) => `$${r.overhead.toFixed(2)}`,
            },
            {
              key: "total",
              label: "Total",
              render: (r) => `$${r.total.toFixed(2)}`,
            },
            {
              key: "perUnit",
              label: "Per Unit",
              render: (r) => `$${r.perUnit.toFixed(2)}`,
            },
            {
              key: "status",
              label: "Status",
              render: (r) => (
                <span
                  className={
                    r.status === "released" ? "badge-green" : "badge-gray"
                  }
                >
                  {r.status}
                </span>
              ),
            },
            {
              key: "actions",
              label: "",
              render: (r) =>
                r.status !== "released" ? (
                  <button
                    onClick={() => releaseMutation.mutate(r.id)}
                    disabled={releaseMutation.isPending}
                    className="btn-primary btn-sm"
                  >
                    Release
                  </button>
                ) : null,
              className: "w-24",
            },
          ]}
          data={estimates}
          isLoading={estimatesQuery.isLoading}
        />
      </div>

      {/* Variance Analysis */}
      <div className="card p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Variance Analysis</h3>
        <DataTable
          columns={[
            { key: "material", label: "Material" },
            {
              key: "estimated",
              label: "Estimated",
              render: (r: { estimated: number }) => `$${r.estimated?.toFixed(2) ?? "—"}`,
            },
            {
              key: "actual",
              label: "Actual",
              render: (r: { actual: number }) => `$${r.actual?.toFixed(2) ?? "—"}`,
            },
            {
              key: "variance",
              label: "Variance",
              render: (r: { variance: number }) => (
                <span
                  className={
                    (r.variance ?? 0) > 0 ? "text-red-600" : "text-emerald-600"
                  }
                >
                  ${(r.variance ?? 0).toFixed(2)}
                </span>
              ),
            },
          ]}
          data={varianceData}
          isLoading={varianceQuery.isLoading}
        />
      </div>

      {/* Calculate Cost Modal */}
      <Modal
        isOpen={showCalcModal}
        onClose={() => {
          setShowCalcModal(false);
          setEstimateResult(null);
        }}
        title="Calculate Cost"
        size="xl"
        footer={
          <>
            <button
              onClick={() => {
                setShowCalcModal(false);
                setEstimateResult(null);
              }}
              className="btn-secondary"
            >
              Close
            </button>
            <button
              onClick={() => estimateMutation.mutate()}
              disabled={!calcForm.materialId || !calcForm.quantity || estimateMutation.isPending}
              className="btn-primary"
            >
              {estimateMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Calculator className="w-4 h-4" />
              )}{" "}
              Estimate
            </button>
          </>
        }
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormSelect
              label="Material (with BOM)"
              value={calcForm.materialId}
              onChange={(e) => setCalcForm({ ...calcForm, materialId: e.target.value })}
              options={materials.map((m: Material) => ({
                value: m.id,
                label: `${m.materialNumber} - ${m.description}`,
              }))}
            />
            <FormInput
              label="Quantity"
              type="number"
              value={calcForm.quantity}
              onChange={(e) => setCalcForm({ ...calcForm, quantity: e.target.value })}
            />
          </div>

          {estimateResult && (
            <div className="border-t pt-6 space-y-6">
              <h4 className="text-sm font-semibold text-gray-900">Cost Breakdown</h4>

              <div>
                <h5 className="text-xs font-medium text-gray-600 mb-2">Material Costs</h5>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Component</th>
                      <th className="text-right py-2">Qty</th>
                      <th className="text-right py-2">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(estimateResult.materialCosts ?? []).map((c, i) => (
                      <tr key={i} className="border-b">
                        <td className="py-2">{c.component}</td>
                        <td className="text-right">{c.qty}</td>
                        <td className="text-right">${c.cost.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <h5 className="text-xs font-medium text-gray-600 mb-2">Labor Costs</h5>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Step</th>
                      <th className="text-right py-2">Time</th>
                      <th className="text-right py-2">Rate</th>
                      <th className="text-right py-2">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(estimateResult.laborCosts ?? []).map((c, i) => (
                      <tr key={i} className="border-b">
                        <td className="py-2">{c.step}</td>
                        <td className="text-right">{c.time}h</td>
                        <td className="text-right">${c.rate}/h</td>
                        <td className="text-right">${c.cost.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <p className="text-sm text-gray-600">
                  Overhead: ${estimateResult.overhead?.toFixed(2) ?? "0"} (
                  {estimateResult.overheadPct ?? 0}%)
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h5 className="text-xs font-medium text-gray-600 mb-2">Cost Distribution</h5>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => `$${v.toFixed(2)}`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col justify-center">
                  <div className="text-3xl font-bold text-gray-900">
                    ${estimateResult.total?.toFixed(2) ?? "0"}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">Total Cost</p>
                  <div className="text-2xl font-bold text-primary-600 mt-4">
                    ${estimateResult.perUnit?.toFixed(2) ?? "0"} / unit
                  </div>
                  <p className="text-sm text-gray-500">Per Unit Cost</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
