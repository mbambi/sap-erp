import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { api } from "../../api/client";
import PageHeader from "../../components/PageHeader";
import Modal from "../../components/Modal";
import KPICard from "../../components/KPICard";
import { FormInput, FormSelect } from "../../components/FormField";
import {
  Gamepad2,
  Plus,
  Play,
  Pause,
  CheckCircle,
  Loader2,
  AlertTriangle,
  Truck,
  Zap,
  TrendingUp,
  Package,
} from "lucide-react";

interface SimSession {
  id: string;
  name: string;
  status: "running" | "paused" | "completed";
  currentDay: number;
  totalDays: number;
  score?: number;
}

interface SimEvent {
  id: string;
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  resolved?: boolean;
  actions?: { id: string; label: string }[];
}

const SEVERITY_STYLES: Record<string, string> = {
  low: "badge-blue",
  medium: "badge-yellow",
  high: "bg-orange-100 text-orange-800 px-2.5 py-0.5 rounded-full text-xs font-medium",
  critical: "badge-red",
};

const EVENT_ACTIONS: Record<string, { id: string; label: string }[]> = {
  supplier_delay: [
    { id: "find_alternative", label: "Find Alternative" },
    { id: "expedite", label: "Expedite" },
    { id: "wait", label: "Wait" },
  ],
  machine_breakdown: [
    { id: "emergency_repair", label: "Emergency Repair" },
    { id: "reroute", label: "Reroute Production" },
    { id: "outsource", label: "Outsource" },
  ],
  demand_spike: [
    { id: "run_mrp", label: "Run MRP" },
    { id: "emergency_order", label: "Emergency Order" },
    { id: "allocate_safety", label: "Allocate from Safety Stock" },
  ],
  quality_issue: [
    { id: "full_inspection", label: "Full Inspection" },
    { id: "quarantine", label: "Quarantine" },
    { id: "rework", label: "Rework" },
  ],
};

export default function SimulatorPage() {
  const queryClient = useQueryClient();
  const [selectedSession, setSelectedSession] = useState<SimSession | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [respondEvent, setRespondEvent] = useState<SimEvent | null>(null);
  const [newSimForm, setNewSimForm] = useState({
    name: "",
    totalDays: 30,
    demandVolatility: 50,
    leadTimeVariability: 50,
    machineFailureRate: 25,
    transportDelayRate: 25,
  });

  const sessionsQuery = useQuery({
    queryKey: ["simulator-sessions"],
    queryFn: () => api.get<SimSession[]>("/simulator/sessions"),
  });

  const advanceMutation = useMutation({
    mutationFn: (id: string) => api.post(`/simulator/sessions/${id}/advance`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["simulator-sessions"] });
    },
  });

  const sessions = Array.isArray(sessionsQuery.data) ? sessionsQuery.data : (sessionsQuery.data as { data?: SimSession[] })?.data ?? [];
  const activeSession = selectedSession ?? sessions.find((s) => s.status === "running");
  const isCompleted = activeSession?.status === "completed";

  const mockEvents: SimEvent[] = [
    { id: "1", type: "supplier_delay", severity: "high", description: "Vendor ACME delayed shipment by 5 days", actions: EVENT_ACTIONS.supplier_delay },
    { id: "2", type: "demand_spike", severity: "medium", description: "Unexpected 2x demand for material M-100", actions: EVENT_ACTIONS.demand_spike },
  ];

  const inventoryData = [
    { name: "M-100", level: 75 },
    { name: "M-200", level: 45 },
    { name: "M-300", level: 90 },
  ];

  const resolvedPieData = [
    { name: "Resolved", value: 3, color: "#10b981" },
    { name: "Pending", value: 2, color: "#f59e0b" },
  ];

  return (
    <div>
      <PageHeader
        title="Supply Chain Simulator"
        subtitle="Manage your company under pressure"
      >
        <button onClick={() => setShowNewModal(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> New Simulation
        </button>
      </PageHeader>

      {/* Sessions list */}
      <div className="card p-4 mb-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Sessions</h3>
        <div className="flex flex-wrap gap-3">
          {sessionsQuery.isLoading ? (
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          ) : sessions.length === 0 ? (
            <p className="text-gray-500">No sessions yet. Create a new simulation.</p>
          ) : (
            sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedSession(s)}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  activeSession?.id === s.id
                    ? "border-primary-600 bg-primary-50 text-primary-700"
                    : "border-gray-200 hover:bg-gray-50"
                }`}
              >
                {s.name} - Day {s.currentDay}/{s.totalDays}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Active simulation view */}
      {activeSession && !isCompleted && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Day {activeSession.currentDay} of {activeSession.totalDays}
                  </h3>
                  <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-600 transition-all"
                      style={{
                        width: `${(activeSession.currentDay / activeSession.totalDays) * 100}%`,
                      }}
                    />
                  </div>
                </div>
                <button
                  onClick={() => advanceMutation.mutate(activeSession.id)}
                  disabled={advanceMutation.isPending}
                  className="btn-primary text-lg px-6 py-3"
                >
                  {advanceMutation.isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Play className="w-5 h-5" />
                  )}{" "}
                  Advance Day
                </button>
              </div>

              <div className="flex gap-2">
                <button className="btn-secondary btn-sm">
                  <Pause className="w-4 h-4" /> Pause
                </button>
                <button className="btn-secondary btn-sm">
                  <CheckCircle className="w-4 h-4" /> Complete
                </button>
              </div>
            </div>

            <div className="card p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Today&apos;s Events</h3>
              <div className="space-y-3">
                {mockEvents.map((evt) => (
                  <div
                    key={evt.id}
                    className="p-4 border rounded-lg flex items-start justify-between gap-4"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={SEVERITY_STYLES[evt.severity]}>
                          {evt.severity}
                        </span>
                        <span className="text-xs text-gray-500">{evt.type}</span>
                      </div>
                      <p className="text-sm text-gray-700">{evt.description}</p>
                    </div>
                    <button
                      onClick={() => setRespondEvent(evt)}
                      className="btn-primary btn-sm"
                    >
                      Respond
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Status dashboard side panel */}
          <div className="space-y-4">
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Inventory Levels</h3>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={inventoryData} layout="vertical" margin={{ left: 60 }}>
                  <XAxis type="number" domain={[0, 100]} />
                  <YAxis type="category" dataKey="name" width={50} />
                  <Bar dataKey="level" fill="#2563eb" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Events Status</h3>
              <ResponsiveContainer width="100%" height={120}>
                <PieChart>
                  <Pie
                    data={resolvedPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={50}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {resolvedPieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <KPICard title="Score" value={activeSession.score ?? "—"} color="green" />
          </div>
        </div>
      )}

      {/* Scoreboard when completed */}
      {activeSession && isCompleted && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Simulation Complete</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <KPICard title="Final Score" value={`${activeSession.score ?? 0}/100`} color="green" />
            <KPICard title="Events Resolved" value="8" color="blue" />
            <KPICard title="Response Quality" value="85%" color="purple" />
            <KPICard title="Customer Fulfillment" value="92%" color="green" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Event Log Timeline</h4>
            <div className="space-y-2 text-sm text-gray-600">
              <p>Day 1: Supplier delay - Expedited</p>
              <p>Day 3: Demand spike - Emergency order placed</p>
              <p>Day 5: Machine breakdown - Rerouted production</p>
            </div>
          </div>
        </div>
      )}

      {/* New Simulation Modal */}
      <Modal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        title="New Simulation"
        size="lg"
        footer={
          <>
            <button onClick={() => setShowNewModal(false)} className="btn-secondary">
              Cancel
            </button>
            <button
              onClick={() => {
                api.post("/simulator/sessions", newSimForm).then(() => {
                  queryClient.invalidateQueries({ queryKey: ["simulator-sessions"] });
                  setShowNewModal(false);
                });
              }}
              className="btn-primary"
            >
              Start Simulation
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <FormInput
            label="Name"
            value={newSimForm.name}
            onChange={(e) => setNewSimForm({ ...newSimForm, name: e.target.value })}
            placeholder="My simulation"
          />
          <div>
            <label className="label">Total Days (10-60)</label>
            <input
              type="range"
              min={10}
              max={60}
              value={newSimForm.totalDays}
              onChange={(e) =>
                setNewSimForm({ ...newSimForm, totalDays: Number(e.target.value) })
              }
              className="w-full"
            />
            <span className="text-sm text-gray-500">{newSimForm.totalDays} days</span>
          </div>
          <div>
            <label className="label">Demand Volatility (0-100%)</label>
            <input
              type="range"
              min={0}
              max={100}
              value={newSimForm.demandVolatility}
              onChange={(e) =>
                setNewSimForm({ ...newSimForm, demandVolatility: Number(e.target.value) })
              }
              className="w-full"
            />
            <span className="text-sm text-gray-500">{newSimForm.demandVolatility}%</span>
          </div>
          <div>
            <label className="label">Lead Time Variability (0-100%)</label>
            <input
              type="range"
              min={0}
              max={100}
              value={newSimForm.leadTimeVariability}
              onChange={(e) =>
                setNewSimForm({ ...newSimForm, leadTimeVariability: Number(e.target.value) })
              }
              className="w-full"
            />
            <span className="text-sm text-gray-500">{newSimForm.leadTimeVariability}%</span>
          </div>
          <div>
            <label className="label">Machine Failure Rate (0-50%)</label>
            <input
              type="range"
              min={0}
              max={50}
              value={newSimForm.machineFailureRate}
              onChange={(e) =>
                setNewSimForm({ ...newSimForm, machineFailureRate: Number(e.target.value) })
              }
              className="w-full"
            />
            <span className="text-sm text-gray-500">{newSimForm.machineFailureRate}%</span>
          </div>
          <div>
            <label className="label">Transport Delay Rate (0-50%)</label>
            <input
              type="range"
              min={0}
              max={50}
              value={newSimForm.transportDelayRate}
              onChange={(e) =>
                setNewSimForm({ ...newSimForm, transportDelayRate: Number(e.target.value) })
              }
              className="w-full"
            />
            <span className="text-sm text-gray-500">{newSimForm.transportDelayRate}%</span>
          </div>
        </div>
      </Modal>

      {/* Respond to event modal */}
      <Modal
        isOpen={!!respondEvent}
        onClose={() => setRespondEvent(null)}
        title="Respond to Event"
        footer={
          <>
            <button onClick={() => setRespondEvent(null)} className="btn-secondary">
              Cancel
            </button>
          </>
        }
      >
        {respondEvent && (
          <div>
            <p className="text-sm text-gray-600 mb-4">{respondEvent.description}</p>
            <div className="space-y-2">
              {(respondEvent.actions ?? EVENT_ACTIONS[respondEvent.type] ?? []).map((a) => (
                <button
                  key={a.id}
                  onClick={() => setRespondEvent(null)}
                  className="btn-primary w-full"
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
