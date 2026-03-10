import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "../../api/client";
import PageHeader from "../../components/PageHeader";
import StatusBadge from "../../components/StatusBadge";
import { FormInput, FormSelect } from "../../components/FormField";
import { Truck, TrendingUp, Loader2, AlertTriangle } from "lucide-react";

interface Vendor {
  id: string;
  vendorNumber: string;
  name: string;
}

interface Material {
  id: string;
  materialNumber: string;
  description: string;
}

interface SupplierDelayResult {
  scenario: string;
  vendor: string;
  delayDays: number;
  materialImpacts: {
    material: string;
    description?: string;
    currentStock: number;
    dailyUsage: number;
    daysOfStock: number;
    delayDays: number;
    willRunOut: boolean;
    shortageQty: number;
    recommendation: string;
  }[];
  customerImpacts: { soNumber: string; customer: string; status: string }[];
  summary: { materialsAffected: number; shortages: number; customersAtRisk: number };
}

interface DemandSpikeResult {
  scenario: string;
  material: { number: string; description: string };
  analysis: {
    normalDailyDemand: number;
    spikeDemand: number;
    spikeMultiplier: number;
    durationDays: number;
    totalSpikeDemand: number;
    currentStock: number;
    daysBeforeStockout: number;
    additionalUnitsNeeded: number;
    estimatedCost: number;
  };
  recommendedActions: { action: string; description: string; priority: string }[];
}

const SPIKE_OPTIONS = [
  { value: "1.5", label: "1.5x" },
  { value: "2", label: "2x" },
  { value: "3", label: "3x" },
  { value: "5", label: "5x" },
];

export default function ScenarioSimulator() {
  const [supplierForm, setSupplierForm] = useState({ vendorId: "", delayDays: "" });
  const [demandForm, setDemandForm] = useState({
    materialId: "",
    spikeMultiplier: "2",
    durationDays: "14",
  });
  const [supplierResult, setSupplierResult] = useState<SupplierDelayResult | null>(null);
  const [demandResult, setDemandResult] = useState<DemandSpikeResult | null>(null);

  const vendorsQuery = useQuery({
    queryKey: ["vendors-list"],
    queryFn: () => api.get<{ data: Vendor[] }>("/finance/vendors", { limit: 200 }),
  });

  const materialsQuery = useQuery({
    queryKey: ["materials-list"],
    queryFn: () => api.get<{ data: Material[] }>("/materials/items", { limit: 500 }),
  });

  const supplierDelayMutation = useMutation({
    mutationFn: () =>
      api.post<SupplierDelayResult>("/utilities/simulate/supplier-delay", {
        vendorId: supplierForm.vendorId,
        delayDays: Number(supplierForm.delayDays),
      }),
    onSuccess: (data) => setSupplierResult(data),
  });

  const demandSpikeMutation = useMutation({
    mutationFn: () =>
      api.post<DemandSpikeResult>("/utilities/simulate/demand-spike", {
        materialId: demandForm.materialId,
        spikeMultiplier: Number(demandForm.spikeMultiplier),
        durationDays: Number(demandForm.durationDays),
      }),
    onSuccess: (data) => setDemandResult(data),
  });

  const vendors = vendorsQuery.data?.data ?? (Array.isArray(vendorsQuery.data) ? vendorsQuery.data : []);
  const materials = materialsQuery.data?.data ?? (Array.isArray(materialsQuery.data) ? materialsQuery.data : []);

  return (
    <div>
      <PageHeader
        title="Scenario Simulator"
        subtitle="Test how supply chain disruptions affect your operations"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Supplier Delay */}
        <div className="card overflow-hidden">
          <div className="p-6 border-b bg-amber-50/50">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-amber-100">
                <Truck className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Supplier Delay</h2>
                <p className="text-sm text-gray-600">Simulate vendor delivery delays</p>
              </div>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <FormSelect
              label="Vendor"
              value={supplierForm.vendorId}
              onChange={(e) => setSupplierForm({ ...supplierForm, vendorId: e.target.value })}
              options={vendors.map((v: Vendor) => ({ value: v.id, label: `${v.vendorNumber} - ${v.name}` }))}
            />
            <FormInput
              label="Delay (days)"
              type="number"
              value={supplierForm.delayDays}
              onChange={(e) => setSupplierForm({ ...supplierForm, delayDays: e.target.value })}
            />
            <button
              onClick={() => supplierDelayMutation.mutate()}
              disabled={
                supplierDelayMutation.isPending || !supplierForm.vendorId || !supplierForm.delayDays
              }
              className="btn-primary w-full"
            >
              {supplierDelayMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <AlertTriangle className="w-4 h-4" />
              )}{" "}
              Simulate
            </button>
          </div>
          {supplierResult && (
            <div className="border-t p-6 space-y-4">
              <h3 className="text-sm font-semibold text-gray-900">Results</h3>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 bg-gray-50 rounded">
                  <p className="text-xs text-gray-500">Materials Affected</p>
                  <p className="font-bold">{supplierResult.summary.materialsAffected}</p>
                </div>
                <div className="p-2 bg-red-50 rounded">
                  <p className="text-xs text-red-600">Shortages</p>
                  <p className="font-bold text-red-700">{supplierResult.summary.shortages}</p>
                </div>
                <div className="p-2 bg-amber-50 rounded">
                  <p className="text-xs text-amber-600">Customers at Risk</p>
                  <p className="font-bold text-amber-700">{supplierResult.summary.customersAtRisk}</p>
                </div>
              </div>
              <div>
                <h4 className="text-xs font-medium text-gray-600 mb-2">Material Impacts</h4>
                <div className="overflow-x-auto max-h-48 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Material</th>
                        <th className="text-right py-2">Stock</th>
                        <th className="text-right py-2">Days</th>
                        <th className="text-right py-2">Shortage</th>
                        <th className="text-left py-2">Recommendation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {supplierResult.materialImpacts.map((imp, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-2">{imp.material}</td>
                          <td className="text-right">{imp.currentStock}</td>
                          <td className="text-right">{imp.daysOfStock}</td>
                          <td className="text-right">{imp.shortageQty}</td>
                          <td className="py-2">
                            <StatusBadge status={imp.willRunOut ? "critical" : "minor"} />
                            <span className="ml-1 text-xs">{imp.recommendation}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {supplierResult.customerImpacts.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-gray-600 mb-2">Customer Impacts</h4>
                  <ul className="space-y-1 text-sm">
                    {supplierResult.customerImpacts.map((c, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <StatusBadge status="critical" />
                        {c.soNumber} - {c.customer}: {c.status}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Demand Spike */}
        <div className="card overflow-hidden">
          <div className="p-6 border-b bg-blue-50/50">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-blue-100">
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Demand Spike</h2>
                <p className="text-sm text-gray-600">Simulate sudden demand increase</p>
              </div>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <FormSelect
              label="Material"
              value={demandForm.materialId}
              onChange={(e) => setDemandForm({ ...demandForm, materialId: e.target.value })}
              options={materials.map((m: Material) => ({
                value: m.id,
                label: `${m.materialNumber} - ${m.description}`,
              }))}
            />
            <FormSelect
              label="Spike Multiplier"
              value={demandForm.spikeMultiplier}
              onChange={(e) => setDemandForm({ ...demandForm, spikeMultiplier: e.target.value })}
              options={SPIKE_OPTIONS}
            />
            <FormInput
              label="Duration (days)"
              type="number"
              value={demandForm.durationDays}
              onChange={(e) => setDemandForm({ ...demandForm, durationDays: e.target.value })}
            />
            <button
              onClick={() => demandSpikeMutation.mutate()}
              disabled={
                demandSpikeMutation.isPending || !demandForm.materialId || !demandForm.durationDays
              }
              className="btn-primary w-full"
            >
              {demandSpikeMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <TrendingUp className="w-4 h-4" />
              )}{" "}
              Simulate
            </button>
          </div>
          {demandResult && (
            <div className="border-t p-6 space-y-4">
              <h3 className="text-sm font-semibold text-gray-900">Analysis</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 bg-gray-50 rounded">
                  <p className="text-xs text-gray-500">Normal vs Spike Demand</p>
                  <p className="font-medium">
                    {demandResult.analysis.normalDailyDemand} → {demandResult.analysis.spikeDemand} units/day
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded">
                  <p className="text-xs text-gray-500">Days Before Stockout</p>
                  <p className="font-medium">{demandResult.analysis.daysBeforeStockout} days</p>
                </div>
                <div className="p-3 bg-amber-50 rounded">
                  <p className="text-xs text-amber-600">Additional Needed</p>
                  <p className="font-medium">{demandResult.analysis.additionalUnitsNeeded} units</p>
                </div>
                <div className="p-3 bg-amber-50 rounded">
                  <p className="text-xs text-amber-600">Estimated Cost</p>
                  <p className="font-medium">${demandResult.analysis.estimatedCost.toLocaleString()}</p>
                </div>
              </div>
              <div>
                <h4 className="text-xs font-medium text-gray-600 mb-2">Recommended Actions</h4>
                <ul className="space-y-2">
                  {demandResult.recommendedActions.map((a, i) => (
                    <li key={i} className="flex items-start gap-2 p-2 bg-gray-50 rounded">
                      <StatusBadge status={a.priority.toLowerCase()} />
                      <div>
                        <p className="font-medium text-sm">{a.action}</p>
                        <p className="text-xs text-gray-600">{a.description}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      {(supplierResult || demandResult) && (
        <div className="card p-6 mt-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Visual Impact Comparison</h3>
          <div className="grid grid-cols-2 gap-6">
            <div className="p-4 border rounded-lg">
              <p className="text-xs font-medium text-gray-500 mb-2">Before</p>
              {supplierResult && (
                <p className="text-sm">
                  {supplierResult.materialImpacts.length} materials • Normal lead times
                </p>
              )}
              {demandResult && (
                <p className="text-sm">
                  Stock: {demandResult.analysis.currentStock} • Demand: {demandResult.analysis.normalDailyDemand}/day
                </p>
              )}
            </div>
            <div className="p-4 border rounded-lg bg-amber-50/50">
              <p className="text-xs font-medium text-amber-600 mb-2">After</p>
              {supplierResult && (
                <p className="text-sm">
                  +{supplierResult.delayDays} day delay • {supplierResult.summary.shortages} shortages
                </p>
              )}
              {demandResult && (
                <p className="text-sm">
                  Demand: {demandResult.analysis.spikeDemand}/day • Need +{demandResult.analysis.additionalUnitsNeeded} units
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
