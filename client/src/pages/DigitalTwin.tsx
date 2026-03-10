import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Play, RotateCcw, Loader2, Truck, Warehouse, Factory, Users, AlertTriangle } from "lucide-react";
import { api } from "../api/client";
import PageHeader from "../components/PageHeader";
import KPICard from "../components/KPICard";

interface SupplierState {
  id: string;
  name: string;
  reliability: number;
  itemsInTransit: number;
  status: "green" | "yellow" | "red";
}

interface WarehouseState {
  id: string;
  name: string;
  fillLevel: number;
  inboundCount: number;
  outboundCount: number;
}

interface FactoryState {
  id: string;
  name: string;
  utilization: number;
  activeOrders: number;
  status: "green" | "yellow" | "red";
}

interface CustomerState {
  id: string;
  name: string;
  pendingOrders: number;
  satisfaction: number;
}

interface TransportState {
  id: string;
  fromType: string;
  toType: string;
  inTransit: number;
}

interface DigitalTwinState {
  suppliers: SupplierState[];
  warehouses: WarehouseState[];
  factories: FactoryState[];
  customers: CustomerState[];
  transports: TransportState[];
  alerts: string[];
}

interface KpiTrendPoint {
  tick: number;
  inventoryValue: number;
  openOrders: number;
  utilization: number;
  onTimeDelivery: number;
}

export default function DigitalTwin() {
  const [autoSimulate, setAutoSimulate] = useState(false);
  const [tick, setTick] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stateQuery = useQuery({
    queryKey: ["digital-twin", "state", tick],
    queryFn: () => api.get<DigitalTwinState>("/digital-twin/state"),
    retry: false,
  });

  const kpiTrendQuery = useQuery({
    queryKey: ["digital-twin", "kpi-trend"],
    queryFn: () => api.get<KpiTrendPoint[]>("/digital-twin/kpi-trend"),
    retry: false,
  });

  const state = stateQuery.data;
  const kpiTrend = kpiTrendQuery.data ?? [];

  const handleSimulateTick = useCallback(async () => {
    try {
      await api.post("/digital-twin/simulate-tick");
      setTick((t) => t + 1);
      stateQuery.refetch();
    } catch {
      setTick((t) => t + 1);
    }
  }, [stateQuery]);

  const handleReset = useCallback(() => {
    setTick(0);
    stateQuery.refetch();
  }, [stateQuery]);

  useEffect(() => {
    if (autoSimulate) {
      intervalRef.current = setInterval(handleSimulateTick, 3000);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [autoSimulate, handleSimulateTick]);

  const suppliers = state?.suppliers ?? [
    { id: "s1", name: "Steel Supplier", reliability: 95, itemsInTransit: 12, status: "green" as const },
    { id: "s2", name: "Electronics Co", reliability: 88, itemsInTransit: 5, status: "yellow" as const },
  ];
  const warehouses = state?.warehouses ?? [
    { id: "w1", name: "Central WH", fillLevel: 72, inboundCount: 8, outboundCount: 15 },
    { id: "w2", name: "Regional WH", fillLevel: 45, inboundCount: 3, outboundCount: 10 },
  ];
  const factories = state?.factories ?? [
    { id: "f1", name: "Factory A", utilization: 78, activeOrders: 4, status: "green" as const },
    { id: "f2", name: "Factory B", utilization: 92, activeOrders: 6, status: "yellow" as const },
  ];
  const customers = state?.customers ?? [
    { id: "c1", name: "Retail Corp", pendingOrders: 3, satisfaction: 94 },
    { id: "c2", name: "Industrial Inc", pendingOrders: 7, satisfaction: 82 },
  ];
  const transports = state?.transports ?? [
    { id: "t1", fromType: "supplier", toType: "warehouse", inTransit: 5 },
    { id: "t2", fromType: "warehouse", toType: "factory", inTransit: 3 },
    { id: "t3", fromType: "factory", toType: "customer", inTransit: 5 },
  ];
  const alerts = state?.alerts ?? [];

  const kpiData = {
    inventoryValue: 1245000,
    openOrders: 23,
    utilization: 85,
    onTimeDelivery: 92,
  };

  const statusColor = (s: string) =>
    s === "green" ? "bg-emerald-500" : s === "yellow" ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Digital Twin"
        subtitle="Real-time visualization of your supply chain"
        breadcrumb={[{ label: "Home", path: "/" }, { label: "Digital Twin" }]}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handleSimulateTick} className="btn-primary btn-sm">
            <Play className="w-4 h-4" /> Simulate Tick
          </button>
          <button onClick={handleReset} className="btn-secondary btn-sm">
            <RotateCcw className="w-4 h-4" /> Reset
          </button>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoSimulate}
              onChange={(e) => setAutoSimulate(e.target.checked)}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm font-medium">Auto-Simulate</span>
          </label>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>Tick: {tick}</span>
          </div>
        </div>
      </PageHeader>

      {alerts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {alerts.map((alert, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800"
            >
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">{alert}</span>
            </div>
          ))}
        </div>
      )}

      <div className="card p-6 overflow-x-auto">
        <div className="flex items-stretch gap-4 min-w-max">
          {/* Suppliers */}
          <div className="flex flex-col gap-3 w-48">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
              <Truck className="w-4 h-4" /> Suppliers
            </h3>
            {suppliers.map((s) => (
              <div
                key={s.id}
                className="card p-4 border-l-4"
                style={{ borderLeftColor: s.status === "green" ? "#22c55e" : s.status === "yellow" ? "#f59e0b" : "#ef4444" }}
              >
                <p className="font-medium text-gray-900">{s.name}</p>
                <p className="text-xs text-gray-500 mt-1">Reliability: {s.reliability}%</p>
                <p className="text-xs text-gray-500">In transit: {s.itemsInTransit}</p>
                <div className={`w-2 h-2 rounded-full mt-2 ${statusColor(s.status)}`} />
              </div>
            ))}
          </div>

          {/* Transport 1 */}
          <div className="flex flex-col justify-center items-center w-24">
            <div className="flex-1 w-px bg-gray-200 relative overflow-hidden">
              <div
                className="absolute inset-0 border-l-2 border-dashed border-primary-400 animate-pulse"
                style={{
                  animation: "flow 2s linear infinite",
                }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">→ {transports[0]?.inTransit ?? 0} in transit</p>
          </div>

          {/* Warehouses */}
          <div className="flex flex-col gap-3 w-48">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
              <Warehouse className="w-4 h-4" /> Warehouses
            </h3>
            {warehouses.map((w) => (
              <div key={w.id} className="card p-4">
                <p className="font-medium text-gray-900">{w.name}</p>
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Fill: {w.fillLevel}%</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-500 rounded-full transition-all duration-500"
                      style={{ width: `${w.fillLevel}%` }}
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  In: {w.inboundCount} | Out: {w.outboundCount}
                </p>
              </div>
            ))}
          </div>

          {/* Transport 2 */}
          <div className="flex flex-col justify-center items-center w-24">
            <div className="flex-1 w-px bg-gray-200 relative" />
            <p className="text-xs text-gray-500 mt-2">→ {transports[1]?.inTransit ?? 0}</p>
          </div>

          {/* Factories */}
          <div className="flex flex-col gap-3 w-48">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
              <Factory className="w-4 h-4" /> Factories
            </h3>
            {factories.map((f) => (
              <div
                key={f.id}
                className="card p-4 border-l-4"
                style={{ borderLeftColor: f.status === "green" ? "#22c55e" : f.status === "yellow" ? "#f59e0b" : "#ef4444" }}
              >
                <p className="font-medium text-gray-900">{f.name}</p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="relative w-12 h-12">
                    <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="#e5e7eb"
                        strokeWidth="3"
                      />
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth="3"
                        strokeDasharray={`${f.utilization}, 100`}
                        strokeLinecap="round"
                        className="transition-all duration-500"
                      />
                    </svg>
                  </div>
                  <span className="text-sm font-semibold">{f.utilization}%</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Orders: {f.activeOrders}</p>
              </div>
            ))}
          </div>

          {/* Transport 3 */}
          <div className="flex flex-col justify-center items-center w-24">
            <div className="flex-1 w-px bg-gray-200 relative" />
            <p className="text-xs text-gray-500 mt-2">→ {transports[2]?.inTransit ?? 0}</p>
          </div>

          {/* Customers */}
          <div className="flex flex-col gap-3 w-48">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4" /> Customers
            </h3>
            {customers.map((c) => (
              <div key={c.id} className="card p-4">
                <p className="font-medium text-gray-900">{c.name}</p>
                <p className="text-xs text-gray-500 mt-1">Pending: {c.pendingOrders}</p>
                <div className="mt-2 flex items-center gap-1">
                  <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${c.satisfaction}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium">{c.satisfaction}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Inventory Value"
          value={`$${(kpiData.inventoryValue / 1000).toFixed(0)}K`}
          color="blue"
        />
        <KPICard
          title="Open Orders"
          value={kpiData.openOrders}
          color="purple"
        />
        <KPICard
          title="Production Utilization"
          value={`${kpiData.utilization}%`}
          color="green"
        />
        <KPICard
          title="On-Time Delivery"
          value={`${kpiData.onTimeDelivery}%`}
          color="green"
        />
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">KPI Trends (Simulation Ticks)</h3>
        <div className="h-64">
          {kpiTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={kpiTrend}>
                <XAxis dataKey="tick" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="inventoryValue" stroke="#3b82f6" name="Inventory Value" strokeWidth={2} />
                <Line type="monotone" dataKey="openOrders" stroke="#a855f7" name="Open Orders" strokeWidth={2} />
                <Line type="monotone" dataKey="utilization" stroke="#22c55e" name="Utilization %" strokeWidth={2} />
                <Line type="monotone" dataKey="onTimeDelivery" stroke="#f59e0b" name="On-Time %" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
              Run simulation to see KPI trends
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes flow {
          0% { transform: translateY(-100%); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: translateY(100%); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
