import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import PageHeader from "../components/PageHeader";
import {
  Warehouse,
  Settings,
  Package,
  Truck,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";

type OptimizationType = "warehouse" | "production" | "inventory" | "transport";

interface Facility {
  id: string;
  name: string;
  fixedCost: number;
  capacity: number;
}

interface Customer {
  id: string;
  name: string;
  demand: number;
  x: number;
  y: number;
}

interface Job {
  id: string;
  duration: number;
  deadline: number;
  priority: number;
}

export default function Optimization() {
  const queryClient = useQueryClient();
  const [activeType, setActiveType] = useState<OptimizationType>("warehouse");

  // Warehouse Location
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [maxWarehouses, setMaxWarehouses] = useState(3);
  const [warehouseResult, setWarehouseResult] = useState<any>(null);

  const warehouseRunMutation = useMutation({
    mutationFn: (data: { facilities: Facility[]; customers: Customer[]; maxWarehouses: number }) =>
      api.post("/optimization/run/warehouse-location", data),
    onSuccess: (data) => {
      setWarehouseResult(data);
      queryClient.invalidateQueries({ queryKey: ["optimization-runs"] });
    },
  });

  const addFacility = () => {
    setFacilities([
      ...facilities,
      { id: `f${Date.now()}`, name: "", fixedCost: 0, capacity: 0 },
    ]);
  };
  const removeFacility = (id: string) => setFacilities(facilities.filter((f) => f.id !== id));
  const updateFacility = (id: string, field: keyof Facility, value: string | number) => {
    setFacilities(facilities.map((f) => (f.id === id ? { ...f, [field]: value } : f)));
  };

  const addCustomer = () => {
    setCustomers([
      ...customers,
      { id: `c${Date.now()}`, name: "", demand: 0, x: 0, y: 0 },
    ]);
  };
  const removeCustomer = (id: string) => setCustomers(customers.filter((c) => c.id !== id));
  const updateCustomer = (id: string, field: keyof Customer, value: string | number) => {
    setCustomers(customers.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  };

  // Production Scheduling
  const [jobs, setJobs] = useState<Job[]>([]);
  const [numMachines, setNumMachines] = useState(2);
  const [productionResult, setProductionResult] = useState<any>(null);

  const productionRunMutation = useMutation({
    mutationFn: (data: { jobs: Job[]; numMachines: number }) =>
      api.post("/optimization/run/production-scheduling", data),
    onSuccess: (data) => {
      setProductionResult(data);
      queryClient.invalidateQueries({ queryKey: ["optimization-runs"] });
    },
  });

  const addJob = () => {
    setJobs([...jobs, { id: `j${Date.now()}`, duration: 0, deadline: 0, priority: 1 }]);
  };
  const removeJob = (id: string) => setJobs(jobs.filter((j) => j.id !== id));
  const updateJob = (id: string, field: keyof Job, value: number) => {
    setJobs(jobs.map((j) => (j.id === id ? { ...j, [field]: value } : j)));
  };

  // Inventory Policy
  const [inventoryForm, setInventoryForm] = useState({
    materialId: "",
    annualDemand: "",
    orderingCost: "",
    holdingCostPct: "",
    serviceLevelPct: "",
    leadTimeDays: "",
    demandStdDev: "",
  });
  const [inventoryResult, setInventoryResult] = useState<any>(null);
  const materialsQuery = useQuery({
    queryKey: ["materials-list"],
    queryFn: () => api.get<{ data?: any[] }>("/materials/items", { limit: 200 }),
  });
  const materials = materialsQuery.data?.data ?? (Array.isArray(materialsQuery.data) ? materialsQuery.data : []);

  const inventoryRunMutation = useMutation({
    mutationFn: (data: Record<string, number | string>) =>
      api.post("/optimization/run/inventory-policy", data),
    onSuccess: (data) => {
      setInventoryResult(data);
      queryClient.invalidateQueries({ queryKey: ["optimization-runs"] });
    },
  });

  // Transport Route
  const [origins, setOrigins] = useState<{ id: string; supply: number }[]>([]);
  const [destinations, setDestinations] = useState<{ id: string; demand: number }[]>([]);
  const [costMatrix, setCostMatrix] = useState<Record<string, number>>({});
  const [transportResult, setTransportResult] = useState<any>(null);

  const addOrigin = () =>
    setOrigins([...origins, { id: `o${Date.now()}`, supply: 0 }]);
  const addDestination = () =>
    setDestinations([...destinations, { id: `d${Date.now()}`, demand: 0 }]);
  const setCost = (o: string, d: string, v: number) =>
    setCostMatrix({ ...costMatrix, [`${o}-${d}`]: v });

  const transportRunMutation = useMutation({
    mutationFn: (data: {
      origins: { id: string; supply: number }[];
      destinations: { id: string; demand: number }[];
      costMatrix: Record<string, number>;
    }) => api.post("/optimization/run/transport-route", data),
    onSuccess: (data) => {
      setTransportResult(data);
      queryClient.invalidateQueries({ queryKey: ["optimization-runs"] });
    },
  });

  // History
  const runsQuery = useQuery({
    queryKey: ["optimization-runs"],
    queryFn: () => api.get<any[]>("/optimization/runs").catch(() => []),
  });
  const runs = Array.isArray(runsQuery.data) ? runsQuery.data : [];

  const types: { id: OptimizationType; label: string; icon: typeof Warehouse }[] = [
    { id: "warehouse", label: "Warehouse Location", icon: Warehouse },
    { id: "production", label: "Production Scheduling", icon: Settings },
    { id: "inventory", label: "Inventory Policy", icon: Package },
    { id: "transport", label: "Transport Route", icon: Truck },
  ];

  return (
    <div className="flex gap-6">
      <aside className="w-56 shrink-0">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-2">
          {types.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveType(t.id)}
              className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeType === t.id
                  ? "bg-blue-600 text-white"
                  : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <PageHeader
          title="Optimization"
          subtitle="Run optimization models for warehouse, production, inventory, and transport"
        />

        {/* Warehouse Location */}
        {activeType === "warehouse" && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Facilities</h3>
              <div className="space-y-3 mb-4">
                {facilities.map((f) => (
                  <div key={f.id} className="flex gap-2 items-center flex-wrap">
                    <input
                      placeholder="Name"
                      value={f.name}
                      onChange={(e) => updateFacility(f.id, "name", e.target.value)}
                      className="input flex-1 min-w-[100px]"
                    />
                    <input
                      type="number"
                      placeholder="Fixed cost"
                      value={f.fixedCost || ""}
                      onChange={(e) => updateFacility(f.id, "fixedCost", Number(e.target.value) || 0)}
                      className="input w-24"
                    />
                    <input
                      type="number"
                      placeholder="Capacity"
                      value={f.capacity || ""}
                      onChange={(e) => updateFacility(f.id, "capacity", Number(e.target.value) || 0)}
                      className="input w-24"
                    />
                    <button onClick={() => removeFacility(f.id)} className="text-red-500 hover:text-red-700">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={addFacility} className="btn-secondary btn-sm flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add Facility
              </button>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Customers</h3>
              <div className="space-y-3 mb-4">
                {customers.map((c) => (
                  <div key={c.id} className="flex gap-2 items-center flex-wrap">
                    <input
                      placeholder="Name"
                      value={c.name}
                      onChange={(e) => updateCustomer(c.id, "name", e.target.value)}
                      className="input flex-1 min-w-[100px]"
                    />
                    <input
                      type="number"
                      placeholder="Demand"
                      value={c.demand || ""}
                      onChange={(e) => updateCustomer(c.id, "demand", Number(e.target.value) || 0)}
                      className="input w-20"
                    />
                    <input
                      type="number"
                      placeholder="X"
                      value={c.x || ""}
                      onChange={(e) => updateCustomer(c.id, "x", Number(e.target.value) || 0)}
                      className="input w-16"
                    />
                    <input
                      type="number"
                      placeholder="Y"
                      value={c.y || ""}
                      onChange={(e) => updateCustomer(c.id, "y", Number(e.target.value) || 0)}
                      className="input w-16"
                    />
                    <button onClick={() => removeCustomer(c.id)} className="text-red-500 hover:text-red-700">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={addCustomer} className="btn-secondary btn-sm flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add Customer
              </button>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <span className="text-sm font-medium">Max warehouses:</span>
                <input
                  type="range"
                  min={1}
                  max={Math.max(facilities.length, 5)}
                  value={maxWarehouses}
                  onChange={(e) => setMaxWarehouses(Number(e.target.value))}
                  className="w-32"
                />
                <span className="text-sm">{maxWarehouses}</span>
              </label>
              <button
                onClick={() =>
                  warehouseRunMutation.mutate({
                    facilities,
                    customers,
                    maxWarehouses,
                  })
                }
                disabled={
                  warehouseRunMutation.isPending ||
                  facilities.length === 0 ||
                  customers.length === 0
                }
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 flex items-center gap-2 disabled:opacity-50"
              >
                {warehouseRunMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Run Optimization
              </button>
            </div>

            {warehouseResult && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Results</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-xs text-gray-500">Total Cost</p>
                    <p className="font-semibold">${(warehouseResult.totalCost ?? 0).toLocaleString()}</p>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-xs text-gray-500">Baseline Cost</p>
                    <p className="font-semibold">${(warehouseResult.baselineCost ?? 0).toLocaleString()}</p>
                  </div>
                </div>
                <div className="relative h-64 bg-gray-100 dark:bg-gray-700/30 rounded-lg overflow-hidden">
                  {/* Simple visual: dots for warehouses (blue) and customers (gray) */}
                  <svg className="w-full h-full" viewBox="0 0 400 200">
                    {warehouseResult.selectedWarehouses?.map((w: any, i: number) => (
                      <circle
                        key={i}
                        cx={(w.x ?? 50 + i * 80) % 380 + 10}
                        cy={(w.y ?? 100) % 180 + 10}
                        r="8"
                        fill="#3b82f6"
                      />
                    ))}
                    {(warehouseResult.assignments ?? customers).map((c: any, i: number) => (
                      <circle
                        key={i}
                        cx={(c.x ?? 30 + (i % 5) * 70) % 380 + 10}
                        cy={(c.y ?? 40 + Math.floor(i / 5) * 60) % 180 + 10}
                        r="5"
                        fill="#9ca3af"
                      />
                    ))}
                  </svg>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Production Scheduling */}
        {activeType === "production" && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center gap-4 mb-4">
                <label className="flex items-center gap-2">
                  <span className="text-sm font-medium">Machines:</span>
                  <input
                    type="number"
                    min={1}
                    value={numMachines}
                    onChange={(e) => setNumMachines(Math.max(1, Number(e.target.value)))}
                    className="input w-20"
                  />
                </label>
                <button onClick={addJob} className="btn-secondary btn-sm flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Add Job
                </button>
              </div>
              <div className="space-y-2">
                {jobs.map((j) => (
                  <div key={j.id} className="flex gap-2 items-center">
                    <input
                      type="number"
                      placeholder="Duration"
                      value={j.duration || ""}
                      onChange={(e) => updateJob(j.id, "duration", Number(e.target.value) || 0)}
                      className="input w-24"
                    />
                    <input
                      type="number"
                      placeholder="Deadline"
                      value={j.deadline || ""}
                      onChange={(e) => updateJob(j.id, "deadline", Number(e.target.value) || 0)}
                      className="input w-24"
                    />
                    <input
                      type="number"
                      placeholder="Priority"
                      value={j.priority || ""}
                      onChange={(e) => updateJob(j.id, "priority", Number(e.target.value) || 0)}
                      className="input w-20"
                    />
                    <button onClick={() => removeJob(j.id)} className="text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={() =>
                  productionRunMutation.mutate({ jobs, numMachines })
                }
                disabled={productionRunMutation.isPending || jobs.length === 0}
                className="mt-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 flex items-center gap-2 disabled:opacity-50"
              >
                {productionRunMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Run Scheduling
              </button>
            </div>

            {productionResult && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Gantt View</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                  <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-xs text-gray-500">Makespan</p>
                    <p className="font-semibold">{productionResult.makespan ?? 0}</p>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-xs text-gray-500">Utilization %</p>
                    <p className="font-semibold">{(productionResult.utilization ?? 0).toFixed(1)}%</p>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-xs text-gray-500">Idle Time</p>
                    <p className="font-semibold">{productionResult.idleTime ?? 0}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {(productionResult.schedule ?? []).map((m: any, mi: number) => (
                    <div key={mi} className="flex items-center gap-2">
                      <span className="text-xs font-medium w-16">M{mi + 1}</span>
                      <div className="flex-1 flex gap-1 h-8">
                        {(m.jobs ?? m).map((j: any, ji: number) => (
                          <div
                            key={ji}
                            className="rounded flex items-center justify-center text-xs text-white"
                            style={{
                              width: `${(j.duration ?? 1) * 20}px`,
                              minWidth: "24px",
                              backgroundColor: CHART_COLORS[ji % CHART_COLORS.length],
                            }}
                          >
                            {j.id ?? `J${ji + 1}`}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Inventory Policy */}
        {activeType === "inventory" && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 max-w-md">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Parameters</h3>
              <div className="space-y-3">
                <div>
                  <label className="label">Material</label>
                  <select
                    value={inventoryForm.materialId}
                    onChange={(e) => setInventoryForm({ ...inventoryForm, materialId: e.target.value })}
                    className="input"
                  >
                    <option value="">Select...</option>
                    {materials.map((m: any) => (
                      <option key={m.id} value={m.id}>
                        {m.materialNumber}{m.description ? ` - ${m.description}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <input
                  type="number"
                  placeholder="Annual demand"
                  value={inventoryForm.annualDemand}
                  onChange={(e) => setInventoryForm({ ...inventoryForm, annualDemand: e.target.value })}
                  className="input"
                />
                <input
                  type="number"
                  placeholder="Ordering cost"
                  value={inventoryForm.orderingCost}
                  onChange={(e) => setInventoryForm({ ...inventoryForm, orderingCost: e.target.value })}
                  className="input"
                />
                <input
                  type="number"
                  placeholder="Holding cost %"
                  value={inventoryForm.holdingCostPct}
                  onChange={(e) => setInventoryForm({ ...inventoryForm, holdingCostPct: e.target.value })}
                  className="input"
                />
                <input
                  type="number"
                  placeholder="Service level %"
                  value={inventoryForm.serviceLevelPct}
                  onChange={(e) => setInventoryForm({ ...inventoryForm, serviceLevelPct: e.target.value })}
                  className="input"
                />
                <input
                  type="number"
                  placeholder="Lead time (days)"
                  value={inventoryForm.leadTimeDays}
                  onChange={(e) => setInventoryForm({ ...inventoryForm, leadTimeDays: e.target.value })}
                  className="input"
                />
                <input
                  type="number"
                  placeholder="Demand std dev"
                  value={inventoryForm.demandStdDev}
                  onChange={(e) => setInventoryForm({ ...inventoryForm, demandStdDev: e.target.value })}
                  className="input"
                />
              </div>
              <button
                onClick={() =>
                  inventoryRunMutation.mutate({
                    ...inventoryForm,
                    annualDemand: Number(inventoryForm.annualDemand),
                    orderingCost: Number(inventoryForm.orderingCost),
                    holdingCostPct: Number(inventoryForm.holdingCostPct),
                    serviceLevelPct: Number(inventoryForm.serviceLevelPct),
                    leadTimeDays: Number(inventoryForm.leadTimeDays),
                    demandStdDev: Number(inventoryForm.demandStdDev),
                  })
                }
                disabled={
                  inventoryRunMutation.isPending ||
                  !inventoryForm.materialId ||
                  !inventoryForm.annualDemand
                }
                className="mt-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 flex items-center gap-2 disabled:opacity-50"
              >
                {inventoryRunMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Calculate
              </button>
            </div>

            {inventoryResult && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
                  <p className="text-xs text-gray-500">EOQ</p>
                  <p className="text-xl font-bold">{Math.ceil(inventoryResult.eoq ?? 0)}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
                  <p className="text-xs text-gray-500">Reorder Point</p>
                  <p className="text-xl font-bold">{Math.ceil(inventoryResult.reorderPoint ?? 0)}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
                  <p className="text-xs text-gray-500">Safety Stock</p>
                  <p className="text-xl font-bold">{Math.ceil(inventoryResult.safetyStock ?? 0)}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
                  <p className="text-xs text-gray-500">Total Annual Cost</p>
                  <p className="text-xl font-bold">${(inventoryResult.totalAnnualCost ?? 0).toLocaleString()}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Transport Route */}
        {activeType === "transport" && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex gap-4 mb-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">Origins</h4>
                  {origins.map((o) => (
                    <div key={o.id} className="flex gap-2 mb-2">
                      <input
                        type="number"
                        placeholder="Supply"
                        value={o.supply || ""}
                        onChange={(e) =>
                          setOrigins(origins.map((x) => (x.id === o.id ? { ...x, supply: Number(e.target.value) || 0 } : x)))
                        }
                        className="input w-24"
                      />
                      <span className="text-sm py-2">{o.id}</span>
                    </div>
                  ))}
                  <button onClick={addOrigin} className="btn-secondary btn-sm">
                    <Plus className="w-3 h-3 inline" /> Add
                  </button>
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-2">Destinations</h4>
                  {destinations.map((d) => (
                    <div key={d.id} className="flex gap-2 mb-2">
                      <input
                        type="number"
                        placeholder="Demand"
                        value={d.demand || ""}
                        onChange={(e) =>
                          setDestinations(
                            destinations.map((x) => (x.id === d.id ? { ...x, demand: Number(e.target.value) || 0 } : x))
                          )
                        }
                        className="input w-24"
                      />
                      <span className="text-sm py-2">{d.id}</span>
                    </div>
                  ))}
                  <button onClick={addDestination} className="btn-secondary btn-sm">
                    <Plus className="w-3 h-3 inline" /> Add
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-500 mb-2">Cost matrix: origin-destination (e.g. o1-d1)</p>
              <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${destinations.length + 1}, minmax(60px, 1fr))` }}>
                <span></span>
                {destinations.map((d) => (
                  <span key={d.id} className="text-xs font-medium">{d.id}</span>
                ))}
                {origins.map((o) => (
                  <React.Fragment key={o.id}>
                    <span className="text-xs font-medium">{o.id}</span>
                    {destinations.map((d) => (
                      <input
                        key={`${o.id}-${d.id}`}
                        type="number"
                        value={costMatrix[`${o.id}-${d.id}`] ?? ""}
                        onChange={(e) => setCost(o.id, d.id, Number(e.target.value) || 0)}
                        className="input w-16"
                      />
                    ))}
                  </React.Fragment>
                ))}
              </div>
              <button
                onClick={() =>
                  transportRunMutation.mutate({
                    origins,
                    destinations,
                    costMatrix,
                  })
                }
                disabled={
                  transportRunMutation.isPending ||
                  origins.length === 0 ||
                  destinations.length === 0
                }
                className="mt-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 flex items-center gap-2 disabled:opacity-50"
              >
                {transportRunMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Run Transport Optimization
              </button>
            </div>

            {transportResult && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Allocation (heatmap)</h3>
                <p className="mb-4">Total transport cost: ${(transportResult.totalCost ?? 0).toLocaleString()}</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="px-2 py-1"></th>
                        {destinations.map((d) => (
                          <th key={d.id} className="px-2 py-1">{d.id}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {origins.map((o) => {
                        const row = transportResult.allocations?.[o.id] ?? transportResult.allocations?.find((r: any) => r.origin === o.id);
                        const values = Array.isArray(row) ? row : (typeof row === "object" && row !== null ? destinations.map((d) => row?.[d.id] ?? 0) : row?.values ?? []);
                        const maxVal = Math.max(...values, 1);
                        return (
                          <tr key={o.id}>
                            <td className="px-2 py-1 font-medium">{o.id}</td>
                            {(Array.isArray(values) ? values : []).map((v: number, j: number) => (
                              <td
                                key={j}
                                className="px-2 py-1"
                                style={{
                                  backgroundColor: `rgba(59, 130, 246, ${Math.min(1, (v ?? 0) / maxVal)})`,
                                }}
                              >
                                {v ?? 0}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* History */}
        <div className="mt-8 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <h3 className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700">
            Optimization History
          </h3>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50">
                <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Status</th>
                <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Type</th>
                <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Objective</th>
                <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Runtime</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
              {runs.slice(0, 10).map((r: any, i: number) => (
                <tr key={i}>
                  <td className="px-4 py-3">
                    <span
                      className={`badge ${
                        r.status === "completed" ? "badge-green" : r.status === "failed" ? "badge-red" : "badge-yellow"
                      }`}
                    >
                      {r.status ?? "pending"}
                    </span>
                  </td>
                  <td className="px-4 py-3">{r.type ?? "—"}</td>
                  <td className="px-4 py-3">{r.objectiveValue ?? r.totalCost ?? "—"}</td>
                  <td className="px-4 py-3">{r.runtime ?? "—"} ms</td>
                </tr>
              ))}
              {runs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                    No runs yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

const CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
