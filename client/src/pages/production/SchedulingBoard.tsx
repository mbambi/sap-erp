import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2, AlertTriangle } from "lucide-react";
import { api } from "../../api/client";
import PageHeader from "../../components/PageHeader";
import Modal from "../../components/Modal";
import { FormInput, FormSelect } from "../../components/FormField";

interface WorkCenter {
  id: string;
  code: string;
  name: string;
  type: string;
  capacity: number;
  efficiency: number;
}

interface ProductionSchedule {
  id: string;
  workCenterId: string;
  workCenter?: WorkCenter;
  productionOrderId: string;
  operation: string;
  setupTime: number;
  runTime: number;
  plannedStart: string;
  plannedEnd: string;
  status: string;
}

interface CapacityUtil {
  workCenterId: string;
  workCenterCode: string;
  workCenterName: string;
  availableHours: number;
  scheduledHours: number;
  utilizationPct: number;
  isBottleneck: boolean;
}

interface ProductionOrder {
  id: string;
  orderNumber: string;
  materialId?: string;
  quantity?: number;
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-500",
  in_progress: "bg-green-500",
  completed: "bg-gray-400",
  delayed: "bg-red-500",
};

export default function SchedulingBoard() {
  const queryClient = useQueryClient();
  const [showAddSchedule, setShowAddSchedule] = useState(false);
  const [hoveredBar, setHoveredBar] = useState<ProductionSchedule | null>(null);
  const [scheduleForm, setScheduleForm] = useState({
    workCenterId: "",
    productionOrderId: "",
    operation: "",
    setupTime: "0",
    runTime: "0",
    plannedStart: "",
    plannedEnd: "",
  });

  const workCentersQuery = useQuery({
    queryKey: ["scheduling-work-centers"],
    queryFn: () => api.get<WorkCenter[]>("/scheduling/work-centers"),
  });

  const scheduleQuery = useQuery({
    queryKey: ["scheduling-schedule"],
    queryFn: () => api.get<ProductionSchedule[]>("/scheduling/schedule"),
  });

  const capacityQuery = useQuery({
    queryKey: ["scheduling-capacity"],
    queryFn: () => api.get<CapacityUtil[]>("/scheduling/capacity"),
  });

  const productionOrdersQuery = useQuery({
    queryKey: ["production-orders"],
    queryFn: () => api.get<{ data: ProductionOrder[] }>("/production/orders", { limit: 200 }),
  });

  const createScheduleMutation = useMutation({
    mutationFn: (data: typeof scheduleForm) =>
      api.post("/scheduling/schedule", {
        workCenterId: data.workCenterId,
        productionOrderId: data.productionOrderId,
        operation: data.operation,
        setupTime: Number(data.setupTime),
        runTime: Number(data.runTime),
        plannedStart: data.plannedStart,
        plannedEnd: data.plannedEnd,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduling-schedule"] });
      queryClient.invalidateQueries({ queryKey: ["scheduling-capacity"] });
      setShowAddSchedule(false);
      setScheduleForm({
        workCenterId: "",
        productionOrderId: "",
        operation: "",
        setupTime: "0",
        runTime: "0",
        plannedStart: "",
        plannedEnd: "",
      });
    },
  });

  const workCenters = Array.isArray(workCentersQuery.data) ? workCentersQuery.data : [];
  const schedules = Array.isArray(scheduleQuery.data) ? scheduleQuery.data : [];
  const capacityList = Array.isArray(capacityQuery.data) ? capacityQuery.data : [];
  const productionOrders = productionOrdersQuery.data?.data ?? (Array.isArray(productionOrdersQuery.data) ? productionOrdersQuery.data : []);

  const { timeMin, timeMax, totalMs } = useMemo(() => {
    if (schedules.length === 0) {
      const now = new Date();
      const min = new Date(now);
      min.setHours(0, 0, 0, 0);
      const max = new Date(min);
      max.setDate(max.getDate() + 1);
      return {
        timeMin: min.getTime(),
        timeMax: max.getTime(),
        totalMs: 24 * 60 * 60 * 1000,
      };
    }
    const times = schedules.flatMap((s) => [
      new Date(s.plannedStart).getTime(),
      new Date(s.plannedEnd).getTime(),
    ]);
    const min = Math.min(...times);
    const max = Math.max(...times);
    const padding = (max - min) * 0.1 || 3600000;
    return {
      timeMin: min - padding,
      timeMax: max + padding,
      totalMs: max - min + 2 * padding,
    };
  }, [schedules]);

  const getBarStyle = (s: ProductionSchedule) => {
    const start = new Date(s.plannedStart).getTime();
    const end = new Date(s.plannedEnd).getTime();
    const left = ((start - timeMin) / totalMs) * 100;
    const width = ((end - start) / totalMs) * 100;
    const color = STATUS_COLORS[s.status] || "bg-gray-400";
    return { left: `${left}%`, width: `${Math.max(width, 2)}%`, color };
  };

  const formatTime = (ms: number) => {
    const d = new Date(ms);
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  };

  const handleAddSchedule = () => {
    if (!scheduleForm.workCenterId || !scheduleForm.productionOrderId || !scheduleForm.operation || !scheduleForm.plannedStart || !scheduleForm.plannedEnd) {
      return;
    }
    createScheduleMutation.mutate(scheduleForm);
  };

  const schedulesByWorkCenter = useMemo(() => {
    const map = new Map<string, ProductionSchedule[]>();
    for (const s of schedules) {
      const wcId = s.workCenterId;
      if (!map.has(wcId)) map.set(wcId, []);
      map.get(wcId)!.push(s);
    }
    return map;
  }, [schedules]);

  return (
    <div>
      <PageHeader
        title="Production Planning Board"
        subtitle="Gantt-style scheduling view"
        breadcrumb={[
          { label: "Home", path: "/" },
          { label: "Production", path: "/production" },
          { label: "Scheduling Board" },
        ]}
      >
        <button onClick={() => setShowAddSchedule(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> Add Schedule
        </button>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Work Centers</h3>
            <ul className="space-y-2">
              {workCenters.map((wc) => (
                <li key={wc.id} className="text-sm py-2 border-b border-gray-100 last:border-0">
                  <span className="font-medium text-gray-900">{wc.code}</span>
                  <span className="text-gray-500 ml-2">{wc.name}</span>
                </li>
              ))}
              {workCenters.length === 0 && !workCentersQuery.isLoading && (
                <li className="text-gray-400 text-sm">No work centers</li>
              )}
            </ul>
          </div>

          <div className="card p-4 mt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Capacity Utilization</h3>
            <div className="space-y-4">
              {capacityList.map((c) => (
                <div key={c.workCenterId}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className={c.isBottleneck ? "text-red-600 font-medium" : "text-gray-600"}>
                      {c.workCenterCode}
                    </span>
                    <span className={c.isBottleneck ? "text-red-600 font-medium" : "text-gray-600"}>
                      {c.utilizationPct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        c.isBottleneck ? "bg-red-500" : "bg-blue-500"
                      }`}
                      style={{ width: `${Math.min(c.utilizationPct, 100)}%` }}
                    />
                  </div>
                  {c.isBottleneck && (
                    <span className="inline-flex items-center gap-1 text-xs text-red-600 mt-1">
                      <AlertTriangle className="w-3 h-3" /> Bottleneck
                    </span>
                  )}
                </div>
              ))}
              {capacityList.length === 0 && !capacityQuery.isLoading && (
                <p className="text-gray-400 text-sm">No capacity data</p>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="card overflow-hidden">
            <div className="p-4 border-b bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-700">Timeline</h3>
              <div className="text-xs text-gray-500 mt-1">
                {formatTime(timeMin)} – {formatTime(timeMax)}
              </div>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[600px] p-4">
                {workCenters.map((wc) => {
                  const wcSchedules = schedulesByWorkCenter.get(wc.id) ?? [];
                  return (
                    <div key={wc.id} className="flex border-b border-gray-100 last:border-0 py-3">
                      <div className="w-40 shrink-0 pr-4">
                        <span className="font-medium text-sm text-gray-900">{wc.code}</span>
                        <span className="text-gray-500 text-xs block truncate">{wc.name}</span>
                      </div>
                      <div className="flex-1 relative h-10 bg-gray-50 rounded-lg">
                        {wcSchedules.map((s) => {
                          const style = getBarStyle(s);
                          return (
                            <div
                              key={s.id}
                              className={`absolute top-1 bottom-1 rounded ${style.color} text-white text-xs px-2 flex items-center overflow-hidden cursor-pointer hover:opacity-90 transition-opacity`}
                              style={{ left: style.left, width: style.width, minWidth: "40px" }}
                              onMouseEnter={() => setHoveredBar(s)}
                              onMouseLeave={() => setHoveredBar(null)}
                              title={`${s.operation} (${s.status})`}
                            >
                              <span className="truncate">{s.operation}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {workCenters.length === 0 && !workCentersQuery.isLoading && (
                  <div className="py-12 text-center text-gray-400 text-sm">No work centers to display</div>
                )}
              </div>
            </div>
          </div>

          {hoveredBar && (
            <div className="fixed bottom-4 right-4 z-10 bg-gray-900 text-white text-xs rounded-lg shadow-lg p-3 max-w-xs">
              <p className="font-medium">{hoveredBar.operation}</p>
              <p className="text-gray-300 mt-1">
                {new Date(hoveredBar.plannedStart).toLocaleString()} – {new Date(hoveredBar.plannedEnd).toLocaleString()}
              </p>
              <p className="text-gray-400 mt-1">Status: {hoveredBar.status}</p>
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={showAddSchedule}
        onClose={() => setShowAddSchedule(false)}
        title="Add Schedule"
        footer={
          <>
            <button onClick={() => setShowAddSchedule(false)} className="btn-secondary">
              Cancel
            </button>
            <button
              onClick={handleAddSchedule}
              disabled={
                createScheduleMutation.isPending ||
                !scheduleForm.workCenterId ||
                !scheduleForm.productionOrderId ||
                !scheduleForm.operation ||
                !scheduleForm.plannedStart ||
                !scheduleForm.plannedEnd
              }
              className="btn-primary"
            >
              {createScheduleMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}{" "}
              Add Schedule
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <FormSelect
            label="Work Center"
            value={scheduleForm.workCenterId}
            onChange={(e) => setScheduleForm({ ...scheduleForm, workCenterId: e.target.value })}
            options={workCenters.map((wc) => ({ value: wc.id, label: `${wc.code} - ${wc.name}` }))}
          />
          <FormSelect
            label="Production Order"
            value={scheduleForm.productionOrderId}
            onChange={(e) => setScheduleForm({ ...scheduleForm, productionOrderId: e.target.value })}
            options={productionOrders.map((po: ProductionOrder) => ({
              value: po.id,
              label: po.orderNumber || po.id,
            }))}
          />
          <FormInput
            label="Operation"
            value={scheduleForm.operation}
            onChange={(e) => setScheduleForm({ ...scheduleForm, operation: e.target.value })}
            placeholder="e.g. Assembly, Machining"
          />
          <FormInput
            label="Setup Time (min)"
            type="number"
            value={scheduleForm.setupTime}
            onChange={(e) => setScheduleForm({ ...scheduleForm, setupTime: e.target.value })}
          />
          <FormInput
            label="Run Time (min)"
            type="number"
            value={scheduleForm.runTime}
            onChange={(e) => setScheduleForm({ ...scheduleForm, runTime: e.target.value })}
          />
          <FormInput
            label="Planned Start"
            type="datetime-local"
            value={scheduleForm.plannedStart}
            onChange={(e) => setScheduleForm({ ...scheduleForm, plannedStart: e.target.value })}
          />
          <FormInput
            label="Planned End"
            type="datetime-local"
            value={scheduleForm.plannedEnd}
            onChange={(e) => setScheduleForm({ ...scheduleForm, plannedEnd: e.target.value })}
          />
        </div>
      </Modal>
    </div>
  );
}
