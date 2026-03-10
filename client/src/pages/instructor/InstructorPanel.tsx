import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import PageHeader from "../../components/PageHeader";
import DataTable from "../../components/DataTable";
import KPICard from "../../components/KPICard";
import { FormInput, FormSelect } from "../../components/FormField";
import {
  Shield,
  Truck,
  TrendingUp,
  Flame,
  Zap,
  AlertTriangle,
  Loader2,
  RotateCcw,
  Users,
  Trophy,
  ClipboardCheck,
} from "lucide-react";

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

interface Warehouse {
  id: string;
  code: string;
  name: string;
}

interface InstructorAction {
  id: string;
  actionType: string;
  description: string;
  parameters: string;
  targetEntity?: string;
  appliedAt: string;
  isActive: boolean;
}

interface StudentActivityResponse {
  recentTransactions: any[];
  exerciseProgress: any[];
  simulationSessions: any[];
}

interface InstructorDashboard {
  activeCrises: number;
  studentCount: number;
  exerciseCount: number;
  exerciseCompletionRate: number;
  simulationCount: number;
  averageSimulationScore: number;
}

export default function InstructorPanel() {
  const queryClient = useQueryClient();
  const [crisisForms, setCrisisForms] = useState({
    supplier: { vendorId: "", durationDays: "" },
    demand: { materialId: "", multiplier: "2", durationDays: "" },
    warehouse: { warehouseId: "", inventoryLossPct: 50 },
    machine: { workCenterCode: "", durationDays: "" },
    quality: { materialId: "" },
  });

  const dashboardQuery = useQuery({
    queryKey: ["instructor-dashboard"],
    queryFn: () => api.get<InstructorDashboard>("/instructor/dashboard"),
  });

  const actionsQuery = useQuery({
    queryKey: ["instructor-actions"],
    queryFn: () => api.get<InstructorAction[]>("/instructor/actions"),
  });

  const studentActivityQuery = useQuery({
    queryKey: ["instructor-student-activity"],
    queryFn: () => api.get<StudentActivityResponse>("/instructor/student-activity"),
  });

  const vendorsQuery = useQuery({
    queryKey: ["vendors-list"],
    queryFn: () => api.get<{ data: Vendor[] }>("/finance/vendors", { limit: 200 }),
  });

  const materialsQuery = useQuery({
    queryKey: ["materials-list"],
    queryFn: () => api.get<{ data: Material[] }>("/materials/items", { limit: 500 }),
  });

  const warehousesQuery = useQuery({
    queryKey: ["warehouses-list"],
    queryFn: () => api.get<{ data: Warehouse[] }>("/warehouse/warehouses", { limit: 100 }),
  });

  const injectCrisisMutation = useMutation({
    mutationFn: (payload: { crisisType: string; parameters: Record<string, unknown> }) =>
      api.post("/instructor/inject-crisis", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instructor-actions"] });
      queryClient.invalidateQueries({ queryKey: ["instructor-dashboard"] });
    },
  });

  const resetCrisisMutation = useMutation({
    mutationFn: () => api.post("/instructor/reset-crisis"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instructor-actions"] });
      queryClient.invalidateQueries({ queryKey: ["instructor-dashboard"] });
    },
  });

  const vendors = vendorsQuery.data?.data ?? [];
  const materials = materialsQuery.data?.data ?? (Array.isArray(materialsQuery.data) ? materialsQuery.data : []);
  const warehouses = warehousesQuery.data?.data ?? [];
  const actions = actionsQuery.data ?? [];
  const studentData = studentActivityQuery.data;
  const dashboard = dashboardQuery.data;

  const handleInject = (crisisType: string, parameters: Record<string, unknown>) => {
    injectCrisisMutation.mutate({ crisisType, parameters });
  };

  return (
    <div>
      <PageHeader
        title="Instructor Control Panel"
        subtitle="Manage student learning environment"
      />

      <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
        <p className="text-sm text-amber-800">
          <strong>Warning:</strong> Actions here directly affect the student environment.
        </p>
      </div>

      {/* Dashboard stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard
          title="Active Crises"
          value={dashboard?.activeCrises ?? 0}
          icon={AlertTriangle}
          color="red"
        />
        <KPICard
          title="Student Count"
          value={dashboard?.studentCount ?? 0}
          icon={Users}
          color="blue"
        />
        <KPICard
          title="Exercise Completion Rate"
          value={`${dashboard?.exerciseCompletionRate ?? 0}%`}
          icon={ClipboardCheck}
          color="green"
        />
        <KPICard
          title="Avg Simulation Score"
          value={dashboard?.averageSimulationScore ?? "—"}
          icon={Trophy}
          color="purple"
        />
      </div>

      {/* Crisis Injection cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        {/* Supplier Failure */}
        <div className="card overflow-hidden">
          <div className="p-4 border-b bg-red-50/50 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100">
              <Truck className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Supplier Failure</h3>
              <p className="text-xs text-gray-600">Vendor stops deliveries</p>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <FormSelect
              label="Vendor"
              value={crisisForms.supplier.vendorId}
              onChange={(e) =>
                setCrisisForms({
                  ...crisisForms,
                  supplier: { ...crisisForms.supplier, vendorId: e.target.value },
                })
              }
              options={vendors.map((v: Vendor) => ({
                value: v.id,
                label: `${v.vendorNumber} - ${v.name}`,
              }))}
            />
            <FormInput
              label="Duration (days)"
              type="number"
              value={crisisForms.supplier.durationDays}
              onChange={(e) =>
                setCrisisForms({
                  ...crisisForms,
                  supplier: { ...crisisForms.supplier, durationDays: e.target.value },
                })
              }
            />
            <button
              onClick={() =>
                handleInject("supplier_failure", {
                  vendorId: crisisForms.supplier.vendorId,
                  durationDays: Number(crisisForms.supplier.durationDays),
                })
              }
              disabled={
                !crisisForms.supplier.vendorId ||
                !crisisForms.supplier.durationDays ||
                injectCrisisMutation.isPending
              }
              className="btn-danger w-full"
            >
              {injectCrisisMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <AlertTriangle className="w-4 h-4" />
              )}{" "}
              Inject Crisis
            </button>
          </div>
        </div>

        {/* Demand Spike */}
        <div className="card overflow-hidden">
          <div className="p-4 border-b bg-amber-50/50 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100">
              <TrendingUp className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Demand Spike</h3>
              <p className="text-xs text-gray-600">Sudden demand increase</p>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <FormSelect
              label="Material"
              value={crisisForms.demand.materialId}
              onChange={(e) =>
                setCrisisForms({
                  ...crisisForms,
                  demand: { ...crisisForms.demand, materialId: e.target.value },
                })
              }
              options={materials.map((m: Material) => ({
                value: m.id,
                label: `${m.materialNumber} - ${m.description}`,
              }))}
            />
            <FormSelect
              label="Multiplier"
              value={crisisForms.demand.multiplier}
              onChange={(e) =>
                setCrisisForms({
                  ...crisisForms,
                  demand: { ...crisisForms.demand, multiplier: e.target.value },
                })
              }
              options={[
                { value: "1.5", label: "1.5x" },
                { value: "2", label: "2x" },
                { value: "3", label: "3x" },
                { value: "5", label: "5x" },
              ]}
            />
            <FormInput
              label="Duration (days)"
              type="number"
              value={crisisForms.demand.durationDays}
              onChange={(e) =>
                setCrisisForms({
                  ...crisisForms,
                  demand: { ...crisisForms.demand, durationDays: e.target.value },
                })
              }
            />
            <button
              onClick={() =>
                handleInject("demand_spike", {
                  materialId: crisisForms.demand.materialId,
                  multiplier: Number(crisisForms.demand.multiplier),
                  durationDays: Number(crisisForms.demand.durationDays),
                })
              }
              disabled={
                !crisisForms.demand.materialId ||
                !crisisForms.demand.durationDays ||
                injectCrisisMutation.isPending
              }
              className="btn-danger w-full"
            >
              Inject Crisis
            </button>
          </div>
        </div>

        {/* Warehouse Fire */}
        <div className="card overflow-hidden">
          <div className="p-4 border-b bg-orange-50/50 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-100">
              <Flame className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Warehouse Fire</h3>
              <p className="text-xs text-gray-600">Inventory loss</p>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <FormSelect
              label="Warehouse"
              value={crisisForms.warehouse.warehouseId}
              onChange={(e) =>
                setCrisisForms({
                  ...crisisForms,
                  warehouse: { ...crisisForms.warehouse, warehouseId: e.target.value },
                })
              }
              options={warehouses.map((w: Warehouse) => ({
                value: w.id,
                label: `${w.code} - ${w.name}`,
              }))}
            />
            <div>
              <label className="label">Inventory Loss % (10-90)</label>
              <input
                type="range"
                min={10}
                max={90}
                value={crisisForms.warehouse.inventoryLossPct}
                onChange={(e) =>
                  setCrisisForms({
                    ...crisisForms,
                    warehouse: {
                      ...crisisForms.warehouse,
                      inventoryLossPct: Number(e.target.value),
                    },
                  })
                }
                className="w-full"
              />
              <span className="text-sm text-gray-500">{crisisForms.warehouse.inventoryLossPct}%</span>
            </div>
            <button
              onClick={() =>
                handleInject("warehouse_fire", {
                  warehouseId: crisisForms.warehouse.warehouseId,
                  inventoryLossPct: crisisForms.warehouse.inventoryLossPct,
                })
              }
              disabled={
                !crisisForms.warehouse.warehouseId || injectCrisisMutation.isPending
              }
              className="btn-danger w-full"
            >
              Inject Crisis
            </button>
          </div>
        </div>

        {/* Machine Breakdown */}
        <div className="card overflow-hidden">
          <div className="p-4 border-b bg-gray-100/50 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gray-200">
              <Zap className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Machine Breakdown</h3>
              <p className="text-xs text-gray-600">Work center offline</p>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <FormInput
              label="Work Center Code"
              value={crisisForms.machine.workCenterCode}
              onChange={(e) =>
                setCrisisForms({
                  ...crisisForms,
                  machine: { ...crisisForms.machine, workCenterCode: e.target.value },
                })
              }
            />
            <FormInput
              label="Duration (days)"
              type="number"
              value={crisisForms.machine.durationDays}
              onChange={(e) =>
                setCrisisForms({
                  ...crisisForms,
                  machine: { ...crisisForms.machine, durationDays: e.target.value },
                })
              }
            />
            <button
              onClick={() =>
                handleInject("machine_breakdown", {
                  workCenterCode: crisisForms.machine.workCenterCode,
                  durationDays: Number(crisisForms.machine.durationDays),
                })
              }
              disabled={
                !crisisForms.machine.workCenterCode ||
                !crisisForms.machine.durationDays ||
                injectCrisisMutation.isPending
              }
              className="btn-danger w-full"
            >
              Inject Crisis
            </button>
          </div>
        </div>

        {/* Quality Crisis */}
        <div className="card overflow-hidden">
          <div className="p-4 border-b bg-purple-50/50 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100">
              <AlertTriangle className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Quality Crisis</h3>
              <p className="text-xs text-gray-600">Material quality issue</p>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <FormSelect
              label="Material"
              value={crisisForms.quality.materialId}
              onChange={(e) =>
                setCrisisForms({
                  ...crisisForms,
                  quality: { ...crisisForms.quality, materialId: e.target.value },
                })
              }
              options={materials.map((m: Material) => ({
                value: m.id,
                label: `${m.materialNumber} - ${m.description}`,
              }))}
            />
            <button
              onClick={() =>
                handleInject("quality_crisis", { materialId: crisisForms.quality.materialId })
              }
              disabled={
                !crisisForms.quality.materialId || injectCrisisMutation.isPending
              }
              className="btn-danger w-full"
            >
              Inject Crisis
            </button>
          </div>
        </div>
      </div>

      {/* Active Crises */}
      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Active Crises</h3>
          <button
            onClick={() => resetCrisisMutation.mutate()}
            disabled={resetCrisisMutation.isPending || actions.length === 0}
            className="btn-secondary btn-sm"
          >
            {resetCrisisMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RotateCcw className="w-4 h-4" />
            )}{" "}
            Reset All Crises
          </button>
        </div>
        <DataTable
          columns={[
            { key: "actionType", label: "Type", render: (r: any) => (r.actionType || "").replace(/_/g, " ") },
            { key: "description", label: "Description" },
            { key: "parameters", label: "Params", render: (r: any) => {
              try { const p = JSON.parse(r.parameters || "{}"); return p.crisisType || r.actionType; } catch { return r.parameters; }
            }},
            { key: "isActive", label: "Active", render: (r: any) => r.isActive ? "Yes" : "No" },
            { key: "appliedAt", label: "Applied", render: (r: any) => r.appliedAt ? new Date(r.appliedAt).toLocaleString() : "—" },
          ]}
          data={actions}
          isLoading={actionsQuery.isLoading}
        />
      </div>

      {/* Student Activity */}
      <div className="card p-6 mb-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Recent Transactions</h3>
        <DataTable
          columns={[
            { key: "entityType", label: "Entity Type" },
            { key: "action", label: "Action" },
            { key: "entityId", label: "Entity ID" },
            { key: "createdAt", label: "Time", render: (r: any) => r.createdAt ? new Date(r.createdAt).toLocaleString() : "—" },
          ]}
          data={(studentData?.recentTransactions ?? []).slice(0, 20)}
          isLoading={studentActivityQuery.isLoading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Exercise Progress</h3>
          <DataTable
            columns={[
              { key: "exercise", label: "Exercise", render: (r: any) => r.exercise?.title ?? r.exerciseId },
              { key: "status", label: "Status", render: (r: any) => (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  r.status === "completed" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                }`}>{r.status}</span>
              )},
              { key: "score", label: "Score", render: (r: any) => r.score ?? "—" },
            ]}
            data={studentData?.exerciseProgress ?? []}
            isLoading={studentActivityQuery.isLoading}
          />
        </div>

        <div className="card p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Simulation Sessions</h3>
          <DataTable
            columns={[
              { key: "scenarioName", label: "Scenario", render: (r: any) => r.scenarioName ?? "Simulation" },
              { key: "status", label: "Status", render: (r: any) => (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  r.status === "completed" ? "bg-green-100 text-green-700" : r.status === "active" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"
                }`}>{r.status}</span>
              )},
              { key: "events", label: "Events", render: (r: any) => r.events?.length ?? 0 },
              { key: "createdAt", label: "Started", render: (r: any) => r.createdAt ? new Date(r.createdAt).toLocaleString() : "—" },
            ]}
            data={studentData?.simulationSessions ?? []}
            isLoading={studentActivityQuery.isLoading}
          />
        </div>
      </div>
    </div>
  );
}
