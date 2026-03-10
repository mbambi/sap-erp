import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { useAuthStore } from "../stores/auth";
import PageHeader from "../components/PageHeader";
import {
  Package,
  AlertTriangle,
  Calendar,
  TrendingUp,
  Loader2,
  X,
  CalendarClock,
  Truck,
  Shield,
} from "lucide-react";
import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  ComposedChart,
  Line,
  ReferenceLine,
} from "recharts";

interface PlanningBoardItem {
  materialId: string;
  materialNumber: string;
  description: string;
  currentStock: number;
  demand: number;
  supply: number;
  netRequirement: number;
  safetyStock: number;
  shortage: number;
  coverageDays: number;
}

interface TimelineBucket {
  week: number;
  weekStart: string;
  demand: number;
  supply: number;
  projectedStock: number;
  shortageFlag: boolean;
}

const CARD_CLASS = "bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700";
const BTN_CLASS = "bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50";

function ProportionalBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium w-8">{value.toLocaleString()}</span>
    </div>
  );
}

export default function MrpBoard() {
  const queryClient = useQueryClient();
  const { hasRole } = useAuthStore();
  const isAdmin = hasRole("admin") || hasRole("instructor");

  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const [showReschedule, setShowReschedule] = useState(false);
  const [showChangeSupplier, setShowChangeSupplier] = useState(false);
  const [showAdjustSafety, setShowAdjustSafety] = useState(false);
  const [rescheduleOrderId, setRescheduleOrderId] = useState("");
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [changeSupplierOrderId, setChangeSupplierOrderId] = useState("");
  const [changeSupplierVendorId, setChangeSupplierVendorId] = useState("");
  const [adjustSafetyMaterialId, setAdjustSafetyMaterialId] = useState("");
  const [adjustSafetyValue, setAdjustSafetyValue] = useState("");

  const { data: planningData = [], isLoading: planningLoading } = useQuery({
    queryKey: ["mrp-board", "planning-board"],
    queryFn: () => api.get<PlanningBoardItem[]>("/mrp-board/planning-board"),
  });

  const { data: timelineData = [] } = useQuery({
    queryKey: ["mrp-board", "timeline", selectedMaterialId],
    queryFn: () => api.get<TimelineBucket[]>(`/mrp-board/material/${selectedMaterialId}/timeline`),
    enabled: !!selectedMaterialId,
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors-list"],
    queryFn: () => api.get<{ id: string; name: string }[] | { data?: { id: string; name: string }[] }>("/finance/vendors").then((r) => ("data" in r && r.data) ? r.data : (Array.isArray(r) ? r : [])),
    enabled: showChangeSupplier,
  });

  const rescheduleMutation = useMutation({
    mutationFn: (data: { plannedOrderId: string; newDate: string }) =>
      api.post("/mrp-board/reschedule", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mrp-board"] });
      setShowReschedule(false);
      setRescheduleOrderId("");
      setRescheduleDate("");
    },
  });

  const changeSupplierMutation = useMutation({
    mutationFn: (data: { plannedOrderId: string; newVendorId: string }) =>
      api.post("/mrp-board/change-supplier", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mrp-board"] });
      setShowChangeSupplier(false);
      setChangeSupplierOrderId("");
      setChangeSupplierVendorId("");
    },
  });

  const adjustSafetyMutation = useMutation({
    mutationFn: (data: { materialId: string; newSafetyStock: number }) =>
      api.post("/mrp-board/adjust-safety-stock", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mrp-board"] });
      setShowAdjustSafety(false);
      setAdjustSafetyMaterialId("");
      setAdjustSafetyValue("");
    },
  });

  const maxDemand = Math.max(...planningData.map((p) => p.demand), 1);
  const maxSupply = Math.max(...planningData.map((p) => p.supply), 1);
  const maxStock = Math.max(...planningData.map((p) => p.currentStock), 1);

  const totalMaterials = planningData.length;
  const materialsWithShortage = planningData.filter((p) => p.shortage > 0).length;
  const avgCoverage = planningData.length > 0
    ? (planningData.reduce((s, p) => s + p.coverageDays, 0) / planningData.length).toFixed(1)
    : "0";
  const totalNetReq = planningData.reduce((s, p) => s + Math.max(0, p.netRequirement), 0);

  const vendorList = Array.isArray(vendors) ? vendors : [];

  const chartData = timelineData.map((b) => ({
    week: `W${b.week}`,
    projectedStock: b.projectedStock,
    demand: b.demand,
    supply: b.supply,
    shortageFlag: b.shortageFlag,
  }));

  return (
    <div>
      <PageHeader title="MRP Planning Board" subtitle="Material requirements planning and shortage analysis" />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className={`${CARD_CLASS} p-4`}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900/30">
              <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Materials</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{totalMaterials}</p>
            </div>
          </div>
        </div>
        <div className={`${CARD_CLASS} p-4`}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-100 dark:bg-red-900/30">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">With Shortage</p>
              <p className="text-xl font-bold text-red-600 dark:text-red-400">{materialsWithShortage}</p>
            </div>
          </div>
        </div>
        <div className={`${CARD_CLASS} p-4`}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/30">
              <Calendar className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Avg Coverage Days</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{avgCoverage}</p>
            </div>
          </div>
        </div>
        <div className={`${CARD_CLASS} p-4`}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-900/30">
              <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Net Requirement</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{totalNetReq.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Board */}
      <div className={`${CARD_CLASS} overflow-hidden`}>
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white">Materials by Shortage (most critical first)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/30">
                <th className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Material</th>
                <th className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Current Stock</th>
                <th className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Demand</th>
                <th className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Supply</th>
                <th className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Net Req</th>
                <th className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Safety Stock</th>
                <th className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Coverage Days</th>
              </tr>
            </thead>
            <tbody>
              {planningLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                  </td>
                </tr>
              ) : (
                planningData.map((row) => (
                  <tr
                    key={row.materialId}
                    onClick={() => setSelectedMaterialId(row.materialId)}
                    className={`border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer ${
                      selectedMaterialId === row.materialId ? "bg-blue-50 dark:bg-blue-900/20" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 dark:text-white">{row.materialNumber}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{row.description}</div>
                    </td>
                    <td className="px-4 py-3">
                      <ProportionalBar value={row.currentStock} max={maxStock} color="bg-blue-500" />
                    </td>
                    <td className="px-4 py-3">
                      <ProportionalBar value={row.demand} max={maxDemand} color="bg-red-500" />
                    </td>
                    <td className="px-4 py-3">
                      <ProportionalBar value={row.supply} max={maxSupply} color="bg-emerald-500" />
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`font-medium ${
                          row.netRequirement > 0
                            ? "text-red-600 dark:text-red-400"
                            : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {row.netRequirement.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{row.safetyStock.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`font-medium ${
                          row.coverageDays < 7
                            ? "text-red-600 dark:text-red-400"
                            : row.coverageDays < 14
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {row.coverageDays.toFixed(1)} days
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {isAdmin && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-2">
            <button
              onClick={() => setShowReschedule(true)}
              className="px-3 py-1.5 rounded-lg bg-amber-100 text-amber-800 hover:bg-amber-200 text-sm font-medium flex items-center gap-2"
            >
              <CalendarClock className="w-4 h-4" /> Reschedule Order
            </button>
            <button
              onClick={() => setShowChangeSupplier(true)}
              className="px-3 py-1.5 rounded-lg bg-blue-100 text-blue-800 hover:bg-blue-200 text-sm font-medium flex items-center gap-2"
            >
              <Truck className="w-4 h-4" /> Change Supplier
            </button>
            <button
              onClick={() => {
                setShowAdjustSafety(true);
                if (selectedMaterialId) setAdjustSafetyMaterialId(selectedMaterialId);
              }}
              className="px-3 py-1.5 rounded-lg bg-purple-100 text-purple-800 hover:bg-purple-200 text-sm font-medium flex items-center gap-2"
            >
              <Shield className="w-4 h-4" /> Adjust Safety Stock
            </button>
          </div>
        )}
      </div>

      {/* Timeline Panel - Slide-in */}
      {selectedMaterialId && (
        <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white dark:bg-gray-800 shadow-2xl border-l border-gray-200 dark:border-gray-700 z-50 flex flex-col animate-in slide-in-from-right">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              12-Week Horizon - {planningData.find((p) => p.materialId === selectedMaterialId)?.materialNumber ?? selectedMaterialId}
            </h3>
            <button onClick={() => setSelectedMaterialId(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-auto p-4">
            {chartData.length > 0 ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="projectedStock" fill="#3b82f6" stroke="#3b82f6" name="Projected Stock" fillOpacity={0.4} />
                    <Line type="monotone" dataKey="demand" stroke="#ef4444" strokeWidth={2} name="Demand" dot={false} />
                    <Bar dataKey="supply" fill="#10b981" name="Supply" />
                    {chartData.map((d, i) =>
                      d.shortageFlag ? (
                        <ReferenceLine key={i} x={d.week} stroke="#ef4444" strokeOpacity={0.3} />
                      ) : null
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">No timeline data</p>
            )}
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {showReschedule && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className={`${CARD_CLASS} w-full max-w-md p-6`}>
            <h3 className="text-lg font-semibold mb-4">Reschedule Order</h3>
            <div className="space-y-4">
              <div>
                <label className="label">Planned Order ID</label>
                <input
                  type="text"
                  value={rescheduleOrderId}
                  onChange={(e) => setRescheduleOrderId(e.target.value)}
                  className="input"
                  placeholder="Order ID"
                />
              </div>
              <div>
                <label className="label">New Date</label>
                <input
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="input"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button className="btn-secondary" onClick={() => setShowReschedule(false)}>Cancel</button>
              <button
                className={BTN_CLASS}
                onClick={() => rescheduleMutation.mutate({ plannedOrderId: rescheduleOrderId, newDate: rescheduleDate })}
                disabled={!rescheduleOrderId || !rescheduleDate || rescheduleMutation.isPending}
              >
                {rescheduleMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Reschedule"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Supplier Modal */}
      {showChangeSupplier && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className={`${CARD_CLASS} w-full max-w-md p-6`}>
            <h3 className="text-lg font-semibold mb-4">Change Supplier</h3>
            <div className="space-y-4">
              <div>
                <label className="label">Planned Order ID</label>
                <input
                  type="text"
                  value={changeSupplierOrderId}
                  onChange={(e) => setChangeSupplierOrderId(e.target.value)}
                  className="input"
                  placeholder="Order ID"
                />
              </div>
              <div>
                <label className="label">New Vendor</label>
                <select value={changeSupplierVendorId} onChange={(e) => setChangeSupplierVendorId(e.target.value)} className="input">
                  <option value="">Select vendor...</option>
                  {vendorList.map((v: { id: string; name: string }) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button className="btn-secondary" onClick={() => setShowChangeSupplier(false)}>Cancel</button>
              <button
                className={BTN_CLASS}
                onClick={() => changeSupplierMutation.mutate({ plannedOrderId: changeSupplierOrderId, newVendorId: changeSupplierVendorId })}
                disabled={!changeSupplierOrderId || !changeSupplierVendorId || changeSupplierMutation.isPending}
              >
                {changeSupplierMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Change"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Safety Stock Modal */}
      {showAdjustSafety && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className={`${CARD_CLASS} w-full max-w-md p-6`}>
            <h3 className="text-lg font-semibold mb-4">Adjust Safety Stock</h3>
            <div className="space-y-4">
              <div>
                <label className="label">Material ID</label>
                <input
                  type="text"
                  value={adjustSafetyMaterialId}
                  onChange={(e) => setAdjustSafetyMaterialId(e.target.value)}
                  className="input"
                  placeholder="Material ID"
                />
              </div>
              <div>
                <label className="label">New Safety Stock</label>
                <input
                  type="number"
                  value={adjustSafetyValue}
                  onChange={(e) => setAdjustSafetyValue(e.target.value)}
                  className="input"
                  min={0}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button className="btn-secondary" onClick={() => setShowAdjustSafety(false)}>Cancel</button>
              <button
                className={BTN_CLASS}
                onClick={() => adjustSafetyMutation.mutate({ materialId: adjustSafetyMaterialId, newSafetyStock: Number(adjustSafetyValue) || 0 })}
                disabled={!adjustSafetyMaterialId || adjustSafetyMutation.isPending}
              >
                {adjustSafetyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Update"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
