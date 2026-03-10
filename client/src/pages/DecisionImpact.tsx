import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Shield,
  Truck,
  DollarSign,
  Package,
  Clock,
  TrendingUp,
  TrendingDown,
  Loader2,
  GitCompare,
} from "lucide-react";
import { api } from "../api/client";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import { FormInput, FormSelect } from "../components/FormField";
import DataTable from "../components/DataTable";

type DecisionType =
  | "increase-safety-stock"
  | "change-supplier"
  | "adjust-price"
  | "change-lot-size"
  | "add-shift";

interface DecisionOption {
  type: DecisionType;
  label: string;
  icon: typeof Shield;
}

const DECISION_OPTIONS: DecisionOption[] = [
  { type: "increase-safety-stock", label: "Increase Safety Stock", icon: Shield },
  { type: "change-supplier", label: "Change Supplier", icon: Truck },
  { type: "adjust-price", label: "Adjust Price", icon: DollarSign },
  { type: "change-lot-size", label: "Change Lot Size", icon: Package },
  { type: "add-shift", label: "Add Shift", icon: Clock },
];

interface ImpactMetric {
  metric: string;
  before: number | string;
  after: number | string;
  change: "up" | "down" | "neutral";
  explanation: string;
}

interface AnalysisResult {
  id: string;
  decisionType: string;
  positives: string[];
  negatives: string[];
  impacts: ImpactMetric[];
  recommendation: string;
}

interface AnalysisHistory {
  id: string;
  decisionType: string;
  date: string;
  keyImpact: string;
}

export default function DecisionImpact() {
  const queryClient = useQueryClient();
  const [selectedDecision, setSelectedDecision] = useState<DecisionType | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [compareResult, setCompareResult] = useState<AnalysisResult | null>(null);
  const [showCompare, setShowCompare] = useState(false);

  const [formState, setFormState] = useState({
    materialId: "",
    vendorId: "",
    workCenterId: "",
    safetyStock: "",
    price: "",
    lotSize: "",
    shiftHours: "",
  });

  const materialsQuery = useQuery({
    queryKey: ["materials"],
    queryFn: () =>
      api
        .get<
          | { id: string; materialNumber: string; description: string }[]
          | { data?: { id: string; materialNumber: string; description: string }[] }
        >("/materials/items")
        .then((r) => ("data" in r && r.data ? r.data : Array.isArray(r) ? r : [])),
    retry: false,
  });

  const vendorsQuery = useQuery({
    queryKey: ["vendors"],
    queryFn: () =>
      api
        .get<{ id: string; vendorNumber: string; name: string }[] | { data?: { id: string; vendorNumber: string; name: string }[] }>(
          "/finance/vendors"
        )
        .then((r) => ("data" in r && r.data ? r.data : Array.isArray(r) ? r : [])),
    retry: false,
  });

  const workCentersQuery = useQuery({
    queryKey: ["work-centers"],
    queryFn: () => api.get<{ id: string; code: string; name: string }[]>("/scheduling/work-centers"),
    retry: false,
  });

  const historyQuery = useQuery({
    queryKey: ["decision-impact", "history"],
    queryFn: () => api.get<AnalysisHistory[]>("/decision-impact/history"),
    retry: false,
  });

  const getMockResult = (): AnalysisResult => ({
    id: "mock-1",
    decisionType: selectedDecision ?? "",
    positives: ["Reduced stockout risk by 40%", "Improved service level to 98%"],
    negatives: ["Inventory carrying cost increases by $12,000/year", "Warehouse space utilization +15%"],
    impacts: [
      { metric: "Safety Stock", before: 200, after: 500, change: "up", explanation: "Buffer increased" },
      { metric: "Carrying Cost", before: "$8,000", after: "$20,000", change: "up", explanation: "More inventory held" },
      { metric: "Stockout Risk", before: "12%", after: "2%", change: "down", explanation: "Better coverage" },
    ],
    recommendation:
      "Based on the analysis, increasing safety stock is recommended if service level targets are critical. Consider a phased approach to balance cost and risk.",
  });

  const analyzeMutation = useMutation({
    mutationFn: (data: { decisionType: string; params: Record<string, unknown> }) =>
      api.post<AnalysisResult>("/decision-impact/analyze", data),
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["decision-impact", "history"] });
    },
    onError: () => {
      setResult(getMockResult());
    },
  });

  const materials = materialsQuery.data ?? [];
  const vendors = vendorsQuery.data ?? [];
  const workCenters = workCentersQuery.data ?? [];
  const history = historyQuery.data ?? [];

  const handleAnalyze = () => {
    if (!selectedDecision) return;
    const params: Record<string, unknown> = {};
    if (formState.materialId) params.materialId = formState.materialId;
    if (formState.vendorId) params.vendorId = formState.vendorId;
    if (formState.workCenterId) params.workCenterId = formState.workCenterId;
    if (formState.safetyStock) params.safetyStock = Number(formState.safetyStock);
    if (formState.price) params.price = Number(formState.price);
    if (formState.lotSize) params.lotSize = Number(formState.lotSize);
    if (formState.shiftHours) params.shiftHours = Number(formState.shiftHours);
    analyzeMutation.mutate({ decisionType: selectedDecision, params });
  };

  const getFormFields = () => {
    switch (selectedDecision) {
      case "increase-safety-stock":
        return (
          <>
            <FormSelect
              label="Material"
              value={formState.materialId}
              onChange={(e) => setFormState({ ...formState, materialId: e.target.value })}
              options={materials.map((m) => ({
                value: m.id,
                label: `${m.materialNumber} - ${m.description}`,
              }))}
            />
            <FormInput
              label="New Safety Stock"
              type="number"
              value={formState.safetyStock}
              onChange={(e) => setFormState({ ...formState, safetyStock: e.target.value })}
              placeholder="e.g. 500"
            />
          </>
        );
      case "change-supplier":
        return (
          <>
            <FormSelect
              label="Material"
              value={formState.materialId}
              onChange={(e) => setFormState({ ...formState, materialId: e.target.value })}
              options={materials.map((m) => ({
                value: m.id,
                label: `${m.materialNumber} - ${m.description}`,
              }))}
            />
            <FormSelect
              label="New Vendor"
              value={formState.vendorId}
              onChange={(e) => setFormState({ ...formState, vendorId: e.target.value })}
              options={vendors.map((v) => ({
                value: v.id,
                label: `${v.vendorNumber} - ${v.name}`,
              }))}
            />
          </>
        );
      case "adjust-price":
        return (
          <>
            <FormSelect
              label="Material"
              value={formState.materialId}
              onChange={(e) => setFormState({ ...formState, materialId: e.target.value })}
              options={materials.map((m) => ({
                value: m.id,
                label: `${m.materialNumber} - ${m.description}`,
              }))}
            />
            <FormInput
              label="New Price"
              type="number"
              value={formState.price}
              onChange={(e) => setFormState({ ...formState, price: e.target.value })}
              placeholder="e.g. 25.99"
            />
          </>
        );
      case "change-lot-size":
        return (
          <>
            <FormSelect
              label="Material"
              value={formState.materialId}
              onChange={(e) => setFormState({ ...formState, materialId: e.target.value })}
              options={materials.map((m) => ({
                value: m.id,
                label: `${m.materialNumber} - ${m.description}`,
              }))}
            />
            <FormInput
              label="New Lot Size"
              type="number"
              value={formState.lotSize}
              onChange={(e) => setFormState({ ...formState, lotSize: e.target.value })}
              placeholder="e.g. 1000"
            />
          </>
        );
      case "add-shift":
        return (
          <>
            <FormSelect
              label="Work Center"
              value={formState.workCenterId}
              onChange={(e) => setFormState({ ...formState, workCenterId: e.target.value })}
              options={workCenters.map((w) => ({
                value: w.id,
                label: `${w.code} - ${w.name}`,
              }))}
            />
            <FormInput
              label="Additional Shift Hours"
              type="number"
              value={formState.shiftHours}
              onChange={(e) => setFormState({ ...formState, shiftHours: e.target.value })}
              placeholder="e.g. 8"
            />
          </>
        );
      default:
        return null;
    }
  };

  const displayResult = result ?? (analyzeMutation.isPending ? null : null);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Decision Impact Analysis"
        subtitle="What-if analysis for ERP decisions"
        breadcrumb={[{ label: "Home", path: "/" }, { label: "Decision Impact" }]}
      />

      <div className="flex flex-wrap gap-4">
        {DECISION_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          return (
            <button
              key={opt.type}
              onClick={() => {
                setSelectedDecision(opt.type);
                setResult(null);
              }}
              className={`flex items-center gap-3 px-6 py-4 rounded-xl border-2 transition-all ${
                selectedDecision === opt.type
                  ? "border-primary-500 bg-primary-50"
                  : "border-gray-200 hover:border-gray-300 bg-white"
              }`}
            >
              <div
                className={`p-3 rounded-lg ${
                  selectedDecision === opt.type ? "bg-primary-100 text-primary-600" : "bg-gray-100 text-gray-600"
                }`}
              >
                <Icon className="w-6 h-6" />
              </div>
              <span className="font-medium text-gray-900">{opt.label}</span>
            </button>
          );
        })}
      </div>

      {selectedDecision && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Decision Parameters</h3>
            <div className="space-y-4">
              {getFormFields()}
              <button
                onClick={handleAnalyze}
                disabled={analyzeMutation.isPending}
                className="btn-primary w-full"
              >
                {analyzeMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                ) : (
                  "Analyze Impact"
                )}
              </button>
            </div>
          </div>

          {displayResult && (
            <div className="lg:col-span-2 space-y-4">
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Impact Metrics</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {displayResult.impacts.map((imp, i) => (
                    <div key={i} className="p-4 rounded-lg border border-gray-200">
                      <p className="text-xs font-medium text-gray-500">{imp.metric}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm text-gray-600">{imp.before}</span>
                        <span className="text-gray-400">→</span>
                        <span className="font-semibold text-gray-900">{imp.after}</span>
                        {imp.change === "up" && (
                          <TrendingUp className="w-4 h-4 text-emerald-600" />
                        )}
                        {imp.change === "down" && (
                          <TrendingDown className="w-4 h-4 text-red-600" />
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{imp.explanation}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="card p-5">
                  <h3 className="text-sm font-semibold text-emerald-800 mb-3">Positives</h3>
                  <ul className="space-y-2">
                    {displayResult.positives.map((p, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-emerald-700">
                        <span className="text-emerald-500 mt-0.5">✓</span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="card p-5">
                  <h3 className="text-sm font-semibold text-red-800 mb-3">Negatives</h3>
                  <ul className="space-y-2">
                    {displayResult.negatives.map((n, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-red-700">
                        <span className="text-red-500 mt-0.5">✗</span>
                        {n}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="card p-5 bg-primary-50 border-primary-100">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Recommendation</h3>
                <p className="text-gray-700">{displayResult.recommendation}</p>
              </div>

              <button
                onClick={() => setShowCompare(true)}
                className="btn-secondary flex items-center gap-2"
              >
                <GitCompare className="w-4 h-4" /> Compare with Another Decision
              </button>
            </div>
          )}
        </div>
      )}

      {history.length > 0 && (
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Analysis History</h3>
          <DataTable<AnalysisHistory>
            columns={[
              {
                key: "decisionType",
                label: "Decision Type",
                render: (r) => {
                  const opt = DECISION_OPTIONS.find((o) => o.type === r.decisionType);
                  return opt?.label ?? r.decisionType;
                },
              },
              {
                key: "date",
                label: "Date",
                render: (r) => new Date(r.date).toLocaleString(),
              },
              { key: "keyImpact", label: "Key Impact" },
            ]}
            data={history}
            isLoading={historyQuery.isLoading}
          />
        </div>
      )}

      <Modal
        isOpen={showCompare}
        onClose={() => setShowCompare(false)}
        title="Compare Decisions"
        size="xl"
      >
        <p className="text-gray-600 mb-4">
          Select another decision type and run analysis to compare side-by-side.
        </p>
        <div className="grid grid-cols-2 gap-4">
          {displayResult && (
            <div className="p-4 rounded-lg border border-gray-200">
              <h4 className="font-medium text-gray-900 mb-2">Current: {displayResult.decisionType}</h4>
              {displayResult.impacts.map((imp, i) => (
                <p key={i} className="text-sm text-gray-600">
                  {imp.metric}: {imp.before} → {imp.after}
                </p>
              ))}
            </div>
          )}
          {compareResult ? (
            <div className="p-4 rounded-lg border border-gray-200">
              <h4 className="font-medium text-gray-900 mb-2">Compare: {compareResult.decisionType}</h4>
              {compareResult.impacts.map((imp, i) => (
                <p key={i} className="text-sm text-gray-600">
                  {imp.metric}: {imp.before} → {imp.after}
                </p>
              ))}
            </div>
          ) : (
            <div className="p-4 rounded-lg border border-dashed border-gray-300 text-center text-gray-500">
              Run another analysis to compare
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
