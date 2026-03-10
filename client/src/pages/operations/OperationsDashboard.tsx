import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { api } from "../../api/client";
import PageHeader from "../../components/PageHeader";
import KPICard from "../../components/KPICard";
import { FormInput, FormSelect } from "../../components/FormField";
import { Loader2, Gauge, Zap, Clock, RotateCcw, Package, AlertTriangle } from "lucide-react";

interface WorkCenter {
  id: string;
  code: string;
  name: string;
}

interface DashboardData {
  oee: number | null;
  inventoryTurnover: number | null;
  fillRate: number | null;
  throughput: number | null;
  avgInventory: number;
}

interface OeeResult {
  oee: number;
  availability: number;
  performance: number;
  quality: number;
}

function GaugeDisplay({
  value,
  max = 100,
  label,
  color,
}: {
  value: number;
  max?: number;
  label: string;
  color: "green" | "yellow" | "red";
}) {
  const pct = Math.min(100, (value / max) * 100);
  const colorClass =
    color === "green" ? "text-emerald-600" : color === "yellow" ? "text-amber-600" : "text-red-600";
  return (
    <div className="relative">
      <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            color === "green" ? "bg-emerald-500" : color === "yellow" ? "bg-amber-500" : "bg-red-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
      <p className={`text-sm font-bold ${colorClass}`}>{typeof value === "number" ? value.toFixed(1) : value}%</p>
    </div>
  );
}

function SemicircleGauge({ value, label, unit = "%" }: { value: number; label: string; unit?: string }) {
  const pct = Math.min(100, Math.max(0, value));
  const color = pct > 85 ? "#10b981" : pct > 65 ? "#f59e0b" : "#ef4444";
  const rotation = (pct / 100) * 180 - 90;
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-24 h-12 overflow-hidden">
        <svg viewBox="0 0 100 60" className="w-full h-full">
          <path
            d="M 10 50 A 40 40 0 0 1 90 50"
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <path
            d="M 10 50 A 40 40 0 0 1 90 50"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${(pct / 100) * 125.6} 125.6`}
          />
        </svg>
      </div>
      <p className="text-lg font-bold mt-1" style={{ color }}>{value.toFixed(1)}{unit === "%" ? "%" : ""}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

export default function OperationsDashboard() {
  const queryClient = useQueryClient();
  const [oeeForm, setOeeForm] = useState({
    workCenterId: "",
    plannedTime: "",
    runTime: "",
    totalPieces: "",
    goodPieces: "",
    idealCycleTime: "",
  });
  const [oeeResult, setOeeResult] = useState<OeeResult | null>(null);

  const dashboardQuery = useQuery({
    queryKey: ["operations-dashboard"],
    queryFn: () => api.get<DashboardData>("/operations/dashboard"),
  });

  const workCentersQuery = useQuery({
    queryKey: ["work-centers"],
    queryFn: () => api.get<WorkCenter[]>("/scheduling/work-centers"),
  });

  const metricsQuery = useQuery({
    queryKey: ["operations-metrics"],
    queryFn: () => api.get<{ metricType: string; workCenterId: string; value: number }[]>("/operations/metrics"),
  });

  const calculateOeeMutation = useMutation({
    mutationFn: (data: typeof oeeForm) =>
      api.post<OeeResult>("/operations/calculate-oee", {
        workCenterId: data.workCenterId,
        plannedTime: Number(data.plannedTime),
        runTime: Number(data.runTime),
        totalPieces: Number(data.totalPieces),
        goodPieces: Number(data.goodPieces),
        idealCycleTime: data.idealCycleTime ? Number(data.idealCycleTime) : undefined,
      }),
    onSuccess: (data) => {
      setOeeResult(data);
      queryClient.invalidateQueries({ queryKey: ["operations-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["operations-metrics"] });
    },
  });

  const dashboard = dashboardQuery.data;
  const workCenters = workCentersQuery.data ?? [];
  const metrics = metricsQuery.data ?? [];

  const oeeByWorkCenter = workCenters.map((wc) => {
    const oeeMetrics = metrics.filter((m) => m.metricType === "oee" && m.workCenterId === wc.id);
    const avg = oeeMetrics.length > 0 ? oeeMetrics.reduce((s, m) => s + m.value, 0) / oeeMetrics.length : 0;
    return { name: wc.code, oee: avg * 100 };
  }).filter((d) => d.oee > 0);

  const oeeValue = dashboard?.oee != null ? dashboard.oee * 100 : 0;
  const oeeColor = oeeValue > 85 ? "green" : oeeValue > 65 ? "yellow" : "red";

  const handleCalculateOee = () => {
    if (!oeeForm.workCenterId || !oeeForm.plannedTime || !oeeForm.runTime || !oeeForm.totalPieces || !oeeForm.goodPieces)
      return;
    calculateOeeMutation.mutate(oeeForm);
  };

  return (
    <div>
      <PageHeader
        title="Operations Performance"
        subtitle="Industrial Engineering KPI dashboard"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-500">OEE</p>
            <Gauge className="w-5 h-5 text-primary-500" />
          </div>
          <SemicircleGauge value={oeeValue} label="Overall Equipment Effectiveness" />
        </div>
        <KPICard
          title="Throughput"
          value={dashboard?.throughput != null ? `${dashboard.throughput} u/h` : "-"}
          icon={Zap}
          color="blue"
        />
        <KPICard
          title="Cycle Time"
          value={dashboard?.throughput && dashboard.throughput > 0 ? `${(60 / dashboard.throughput).toFixed(1)} min` : "-"}
          subtitle="avg per unit"
          icon={Clock}
          color="purple"
        />
        <KPICard
          title="Inventory Turnover"
          value={dashboard?.inventoryTurnover != null ? dashboard.inventoryTurnover.toFixed(2) : "-"}
          icon={RotateCcw}
          color="green"
        />
        <KPICard
          title="Fill Rate"
          value={dashboard?.fillRate != null ? `${(dashboard.fillRate * 100).toFixed(1)}%` : "-"}
          icon={Package}
          color="blue"
        />
        <KPICard
          title="Scrap Rate"
          value="-"
          subtitle="Configure metrics"
          icon={AlertTriangle}
          color="yellow"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="card p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">OEE Calculator</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormSelect
              label="Work Center"
              value={oeeForm.workCenterId}
              onChange={(e) => setOeeForm({ ...oeeForm, workCenterId: e.target.value })}
              options={workCenters.map((wc) => ({ value: wc.id, label: `${wc.code} - ${wc.name}` }))}
            />
            <FormInput
              label="Planned Production Time (min)"
              type="number"
              value={oeeForm.plannedTime}
              onChange={(e) => setOeeForm({ ...oeeForm, plannedTime: e.target.value })}
            />
            <FormInput
              label="Actual Run Time (min)"
              type="number"
              value={oeeForm.runTime}
              onChange={(e) => setOeeForm({ ...oeeForm, runTime: e.target.value })}
            />
            <FormInput
              label="Total Pieces"
              type="number"
              value={oeeForm.totalPieces}
              onChange={(e) => setOeeForm({ ...oeeForm, totalPieces: e.target.value })}
            />
            <FormInput
              label="Good Pieces"
              type="number"
              value={oeeForm.goodPieces}
              onChange={(e) => setOeeForm({ ...oeeForm, goodPieces: e.target.value })}
            />
            <FormInput
              label="Ideal Cycle Time (min/piece)"
              type="number"
              step="0.01"
              value={oeeForm.idealCycleTime}
              onChange={(e) => setOeeForm({ ...oeeForm, idealCycleTime: e.target.value })}
            />
          </div>
          <button
            onClick={handleCalculateOee}
            disabled={
              calculateOeeMutation.isPending ||
              !oeeForm.workCenterId ||
              !oeeForm.plannedTime ||
              !oeeForm.runTime ||
              !oeeForm.totalPieces ||
              !oeeForm.goodPieces
            }
            className="btn-primary mt-4"
          >
            {calculateOeeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Calculate OEE
          </button>
          {oeeResult && (
            <div className="mt-6 pt-6 border-t space-y-3">
              <h4 className="text-sm font-medium text-gray-700">Breakdown</h4>
              <div className="grid grid-cols-2 gap-4">
                <GaugeDisplay
                  value={oeeResult.availability * 100}
                  label="Availability"
                  color={oeeResult.availability > 0.9 ? "green" : oeeResult.availability > 0.7 ? "yellow" : "red"}
                />
                <GaugeDisplay
                  value={oeeResult.performance * 100}
                  label="Performance"
                  color={oeeResult.performance > 0.9 ? "green" : oeeResult.performance > 0.7 ? "yellow" : "red"}
                />
                <GaugeDisplay
                  value={oeeResult.quality * 100}
                  label="Quality"
                  color={oeeResult.quality > 0.9 ? "green" : oeeResult.quality > 0.7 ? "yellow" : "red"}
                />
                <div>
                  <p className="text-xs text-gray-500">OEE</p>
                  <p
                    className={`text-xl font-bold ${
                      oeeResult.oee > 0.85 ? "text-emerald-600" : oeeResult.oee > 0.65 ? "text-amber-600" : "text-red-600"
                    }`}
                  >
                    {(oeeResult.oee * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="card p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">OEE by Work Center</h3>
          {oeeByWorkCenter.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={oeeByWorkCenter}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, "OEE"]} />
                <Bar dataKey="oee" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center py-12 text-gray-500">Calculate OEE for work centers to see the chart.</p>
          )}
        </div>
      </div>

      <div className="card p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Throughput Trend</h3>
        <p className="text-sm text-gray-500">
          Record metrics via POST /operations/metrics to populate throughput and other trend data.
        </p>
        <div className="h-48 flex items-center justify-center text-gray-400 mt-4">
          No trend data available
        </div>
      </div>
    </div>
  );
}
