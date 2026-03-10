import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Play, Loader2, Plus, Lock, FileOutput } from "lucide-react";
import { api } from "../../api/client";
import PageHeader from "../../components/PageHeader";
import DataTable from "../../components/DataTable";
import StatusBadge from "../../components/StatusBadge";
import Modal from "../../components/Modal";
import KPICard from "../../components/KPICard";
import { FormInput, FormSelect, FormTextArea } from "../../components/FormField";

type TabId = "runs" | "planned" | "forecasts";

interface MrpRun {
  id: string;
  runNumber: string;
  runDate: string;
  status: string;
  plannedOrders?: { id: string }[];
  results?: string;
}

interface PlannedOrder {
  id: string;
  materialId: string;
  material?: { materialNumber: string; description: string };
  orderType: string;
  quantity: number;
  unit: string;
  plannedDate: string;
  dueDate: string;
  status: string;
}

interface DemandForecast {
  id: string;
  materialId: string;
  material?: { materialNumber: string; description: string };
  periodStart: string;
  periodEnd: string;
  forecastQty: number;
  method: string;
}

export default function MRPDashboard() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>("runs");
  const [runResultModal, setRunResultModal] = useState<{
    materialsAnalyzed: number;
    plannedOrdersCreated: number;
    runNumber: string;
    recommendations?: string;
  } | null>(null);
  const [showForecastModal, setShowForecastModal] = useState(false);
  const [selectedRun, setSelectedRun] = useState<MrpRun | null>(null);
  const [forecastForm, setForecastForm] = useState({
    materialId: "",
    periodStart: "",
    periodEnd: "",
    forecastQty: "",
    method: "manual",
  });

  const runsQuery = useQuery({
    queryKey: ["mrp-runs"],
    queryFn: () => api.get<{ data: MrpRun[]; pagination: { total: number } }>("/mrp/runs", { limit: 100 }),
  });

  const plannedQuery = useQuery({
    queryKey: ["mrp-planned-orders"],
    queryFn: () => api.get<{ data: PlannedOrder[]; pagination: { total: number } }>("/mrp/planned-orders", { limit: 100 }),
  });

  const forecastsQuery = useQuery({
    queryKey: ["mrp-forecasts"],
    queryFn: () => api.get<{ data: DemandForecast[]; pagination: { total: number } }>("/mrp/forecasts", { limit: 100 }),
  });

  const materialsQuery = useQuery({
    queryKey: ["materials-list"],
    queryFn: () => api.get<{ data: { id: string; materialNumber: string; description: string }[] }>("/materials/items", { limit: 500 }),
  });

  const runMrpMutation = useMutation({
    mutationFn: () => api.post<MrpRun & { results?: string }>("/mrp/runs", { planningHorizonDays: 90 }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["mrp-runs"] });
      queryClient.invalidateQueries({ queryKey: ["mrp-planned-orders"] });
      const results = data.results ? JSON.parse(data.results) : {};
      setRunResultModal({
        materialsAnalyzed: results.materialsProcessed ?? 0,
        plannedOrdersCreated: results.plannedOrdersCreated ?? 0,
        runNumber: results.runNumber ?? data.runNumber ?? "",
        recommendations: results.recommendations,
      });
    },
  });

  const createForecastMutation = useMutation({
    mutationFn: (data: typeof forecastForm) =>
      api.post("/mrp/forecasts", {
        materialId: data.materialId,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        forecastQty: Number(data.forecastQty),
        method: data.method,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mrp-forecasts"] });
      setShowForecastModal(false);
      setForecastForm({ materialId: "", periodStart: "", periodEnd: "", forecastQty: "", method: "manual" });
    },
  });

  const firmMutation = useMutation({
    mutationFn: (id: string) => api.post(`/mrp/planned-orders/${id}/firm`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["mrp-planned-orders"] }),
  });

  const convertMutation = useMutation({
    mutationFn: ({ id, vendorId }: { id: string; vendorId?: string }) =>
      api.post(`/mrp/planned-orders/${id}/convert`, { vendorId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["mrp-planned-orders"] }),
  });

  const runs = runsQuery.data?.data ?? (Array.isArray(runsQuery.data) ? runsQuery.data : []);
  const runsPagination = runsQuery.data?.pagination;
  const plannedOrders = plannedQuery.data?.data ?? (Array.isArray(plannedQuery.data) ? plannedQuery.data : []);
  const forecasts = forecastsQuery.data?.data ?? (Array.isArray(forecastsQuery.data) ? forecastsQuery.data : []);
  const materials = materialsQuery.data?.data ?? (Array.isArray(materialsQuery.data) ? materialsQuery.data : []);

  const totalRuns = runsPagination?.total ?? runs.length;
  const totalPlanned = plannedQuery.data?.pagination?.total ?? plannedOrders.length;
  const openForecasts = forecasts.filter((f) => new Date(f.periodEnd) >= new Date()).length;

  const handleAddForecast = () => {
    if (!forecastForm.materialId || !forecastForm.periodStart || !forecastForm.periodEnd || !forecastForm.forecastQty) {
      return;
    }
    createForecastMutation.mutate(forecastForm);
  };

  const handleConvert = (order: PlannedOrder) => {
    if (order.orderType === "purchase") {
      const vendorId = prompt("Enter Vendor ID for purchase order conversion:");
      if (vendorId) convertMutation.mutate({ id: order.id, vendorId });
    } else {
      convertMutation.mutate({ id: order.id });
    }
  };

  return (
    <div>
      <PageHeader
        title="Material Requirements Planning"
        subtitle="Plan materials and production based on demand"
        breadcrumb={[
          { label: "Home", path: "/" },
          { label: "MRP", path: "/mrp" },
          { label: "Dashboard" },
        ]}
      >
        <button
          onClick={() => runMrpMutation.mutate()}
          disabled={runMrpMutation.isPending}
          className="btn-primary"
        >
          {runMrpMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4" />
          )}{" "}
          Run MRP
        </button>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <KPICard title="Total MRP Runs" value={totalRuns} color="blue" />
        <KPICard title="Planned Orders" value={totalPlanned} color="purple" />
        <KPICard title="Open Forecasts" value={openForecasts} color="green" />
      </div>

      <div className="card">
        <div className="border-b flex gap-1 p-2">
          {(["runs", "planned", "forecasts"] as TabId[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab ? "bg-primary-600 text-white" : "hover:bg-gray-100 text-gray-600"
              }`}
            >
              {tab === "runs" && "MRP Runs"}
              {tab === "planned" && "Planned Orders"}
              {tab === "forecasts" && "Demand Forecasts"}
            </button>
          ))}
        </div>

        {activeTab === "runs" && (
          <div className="p-4">
            <DataTable<MrpRun>
              columns={[
                { key: "runNumber", label: "Run #", render: (r) => <span className="font-mono font-medium">{r.runNumber}</span> },
                { key: "runDate", label: "Date", render: (r) => new Date(r.runDate).toLocaleDateString() },
                { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
                {
                  key: "plannedOrders",
                  label: "Planned Orders",
                  render: (r) => r.plannedOrders?.length ?? 0,
                },
              ]}
              data={runs}
              isLoading={runsQuery.isLoading}
              onRowClick={(row) => setSelectedRun(row)}
            />
          </div>
        )}

        {activeTab === "planned" && (
          <div className="p-4">
            <DataTable<PlannedOrder>
              columns={[
                {
                  key: "material",
                  label: "Material",
                  render: (r) => r.material ? `${r.material.materialNumber} - ${r.material.description}` : r.materialId,
                },
                {
                  key: "orderType",
                  label: "Type",
                  render: (r) => (
                    <span className={r.orderType === "purchase" ? "badge-yellow" : "badge-blue"}>
                      {r.orderType}
                    </span>
                  ),
                },
                { key: "quantity", label: "Qty", render: (r) => `${r.quantity} ${r.unit}` },
                { key: "plannedDate", label: "Planned Date", render: (r) => new Date(r.plannedDate).toLocaleDateString() },
                { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
                {
                  key: "actions",
                  label: "Actions",
                  render: (r) => (
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      {r.status === "planned" && (
                        <>
                          <button
                            onClick={() => firmMutation.mutate(r.id)}
                            disabled={firmMutation.isPending}
                            className="btn-secondary btn-sm"
                          >
                            <Lock className="w-3 h-3" /> Firm
                          </button>
                          <button
                            onClick={() => handleConvert(r)}
                            disabled={convertMutation.isPending}
                            className="btn-primary btn-sm"
                          >
                            <FileOutput className="w-3 h-3" /> Convert to PO
                          </button>
                        </>
                      )}
                    </div>
                  ),
                },
              ]}
              data={plannedOrders}
              isLoading={plannedQuery.isLoading}
            />
          </div>
        )}

        {activeTab === "forecasts" && (
          <div className="p-4">
            <DataTable<DemandForecast>
              columns={[
                {
                  key: "material",
                  label: "Material",
                  render: (r) => r.material ? `${r.material.materialNumber} - ${r.material.description}` : r.materialId,
                },
                { key: "periodStart", label: "Period Start", render: (r) => new Date(r.periodStart).toLocaleDateString() },
                { key: "periodEnd", label: "Period End", render: (r) => new Date(r.periodEnd).toLocaleDateString() },
                { key: "forecastQty", label: "Forecast Qty" },
                { key: "method", label: "Method" },
              ]}
              data={forecasts}
              isLoading={forecastsQuery.isLoading}
              onAdd={() => setShowForecastModal(true)}
              addLabel="Add Forecast"
            />
          </div>
        )}
      </div>

      <Modal
        isOpen={!!runResultModal}
        onClose={() => setRunResultModal(null)}
        title="MRP Run Complete"
        footer={
          <button onClick={() => setRunResultModal(null)} className="btn-primary">
            Close
          </button>
        }
      >
        {runResultModal && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Run <strong>{runResultModal.runNumber}</strong> completed successfully.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-600 font-medium">Materials Analyzed</p>
                <p className="text-2xl font-bold text-blue-900">{runResultModal.materialsAnalyzed}</p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-xs text-green-600 font-medium">Planned Orders Created</p>
                <p className="text-2xl font-bold text-green-900">{runResultModal.plannedOrdersCreated}</p>
              </div>
            </div>
            {runResultModal.recommendations && (
              <div className="p-4 bg-amber-50 rounded-lg">
                <p className="text-xs text-amber-600 font-medium mb-2">Recommendations</p>
                <p className="text-sm text-amber-900">{runResultModal.recommendations}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        isOpen={showForecastModal}
        onClose={() => setShowForecastModal(false)}
        title="Add Forecast"
        footer={
          <>
            <button onClick={() => setShowForecastModal(false)} className="btn-secondary">
              Cancel
            </button>
            <button
              onClick={handleAddForecast}
              disabled={createForecastMutation.isPending || !forecastForm.materialId || !forecastForm.periodStart || !forecastForm.periodEnd || !forecastForm.forecastQty}
              className="btn-primary"
            >
              <Plus className="w-4 h-4" /> Add Forecast
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <FormSelect
            label="Material"
            value={forecastForm.materialId}
            onChange={(e) => setForecastForm({ ...forecastForm, materialId: e.target.value })}
            options={materials.map((m: { id: string; materialNumber: string; description: string }) => ({
              value: m.id,
              label: `${m.materialNumber} - ${m.description}`,
            }))}
          />
          <FormInput
            label="Period Start"
            type="date"
            value={forecastForm.periodStart}
            onChange={(e) => setForecastForm({ ...forecastForm, periodStart: e.target.value })}
          />
          <FormInput
            label="Period End"
            type="date"
            value={forecastForm.periodEnd}
            onChange={(e) => setForecastForm({ ...forecastForm, periodEnd: e.target.value })}
          />
          <FormInput
            label="Forecast Quantity"
            type="number"
            value={forecastForm.forecastQty}
            onChange={(e) => setForecastForm({ ...forecastForm, forecastQty: e.target.value })}
          />
          <FormSelect
            label="Method"
            value={forecastForm.method}
            onChange={(e) => setForecastForm({ ...forecastForm, method: e.target.value })}
            options={[
              { value: "manual", label: "Manual" },
              { value: "moving_avg", label: "Moving Average" },
              { value: "exponential", label: "Exponential Smoothing" },
            ]}
          />
        </div>
      </Modal>

      <Modal
        isOpen={!!selectedRun}
        onClose={() => setSelectedRun(null)}
        title={selectedRun ? `MRP Run: ${selectedRun.runNumber}` : ""}
        footer={<button onClick={() => setSelectedRun(null)} className="btn-secondary">Close</button>}
      >
        {selectedRun && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">Run #:</span> <strong>{selectedRun.runNumber}</strong></div>
              <div><span className="text-gray-500">Date:</span> {new Date(selectedRun.runDate).toLocaleDateString()}</div>
              <div><span className="text-gray-500">Status:</span> <StatusBadge status={selectedRun.status} /></div>
              <div><span className="text-gray-500">Planned Orders:</span> {selectedRun.plannedOrders?.length ?? 0}</div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
