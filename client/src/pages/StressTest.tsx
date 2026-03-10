import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShoppingCart,
  AlertTriangle,
  Truck,
  Wrench,
  Shield,
  Loader2,
  Play,
  RotateCcw,
  Clock,
  Star,
} from "lucide-react";
import { api } from "../api/client";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import { FormInput, FormSelect, FormTextArea } from "../components/FormField";

const SCENARIOS = [
  {
    id: "black_friday",
    name: "Black Friday",
    icon: ShoppingCart,
    color: "red",
    description: "200% demand spike for 48 hours",
    difficulty: 4,
  },
  {
    id: "supplier_bankruptcy",
    name: "Supplier Bankruptcy",
    icon: AlertTriangle,
    color: "orange",
    description: "Top supplier goes bankrupt",
    difficulty: 5,
  },
  {
    id: "transport_strike",
    name: "Transport Strike",
    icon: Truck,
    color: "yellow",
    description: "All shipments delayed 2 weeks",
    difficulty: 3,
  },
  {
    id: "machine_cascade",
    name: "Machine Cascade",
    icon: Wrench,
    color: "purple",
    description: "50% work centers fail",
    difficulty: 4,
  },
  {
    id: "cyber_attack",
    name: "Cyber Attack",
    icon: Shield,
    color: "gray",
    description: "ERP data corruption",
    difficulty: 5,
  },
];

const COLOR_CLASSES: Record<string, string> = {
  red: "bg-red-50 text-red-600 border-red-200",
  orange: "bg-orange-50 text-orange-600 border-orange-200",
  yellow: "bg-amber-50 text-amber-600 border-amber-200",
  purple: "bg-purple-50 text-purple-600 border-purple-200",
  gray: "bg-gray-100 text-gray-700 border-gray-300",
};

const SEVERITY_STYLES: Record<string, string> = {
  critical: "badge-red",
  warning: "badge-yellow",
  info: "badge-blue",
};

interface CrisisEvent {
  id: string;
  timestamp: string;
  severity: "critical" | "warning" | "info";
  description: string;
}

interface StudentAction {
  id: string;
  timestamp: string;
  action: string;
  details?: string;
  result?: string;
}

interface StressTestSession {
  id: string;
  scenario: string;
  status: string;
  events?: CrisisEvent[];
  studentActions?: StudentAction[];
  score?: number;
  startedAt?: string;
  completedAt?: string;
}

type ViewState = "selection" | "active" | "results";

export default function StressTest() {
  const queryClient = useQueryClient();
  const [viewState, setViewState] = useState<ViewState>("selection");
  const [activeTest, setActiveTest] = useState<StressTestSession | null>(null);
  const [actionModal, setActionModal] = useState<{ action: string; open: boolean }>({ action: "", open: false });
  const [actionForm, setActionForm] = useState<Record<string, string>>({});

  const { data: myTests = [], refetch: refetchTests } = useQuery({
    queryKey: ["stress-test-history"],
    queryFn: () => api.get<StressTestSession[]>("/stress-test"),
  });

  const startMutation = useMutation({
    mutationFn: (scenario: string) =>
      api.post<StressTestSession>("/stress-test/start", { scenario }),
    onSuccess: (data) => {
      setActiveTest(data);
      setViewState("active");
      queryClient.invalidateQueries({ queryKey: ["stress-test-history"] });
    },
  });

  const actionMutation = useMutation({
    mutationFn: ({ testId, action, details }: { testId: string; action: string; details?: Record<string, string> }) =>
      api.post(`/stress-test/${testId}/action`, { action, ...details }),
    onSuccess: (_, vars) => {
      setActionModal({ action: "", open: false });
      setActionForm({});
      queryClient.invalidateQueries({ queryKey: ["stress-test", vars.testId] });
      if (activeTest) {
        setActiveTest((prev) =>
          prev
            ? {
                ...prev,
                studentActions: [
                  ...(prev.studentActions || []),
                  {
                    id: crypto.randomUUID(),
                    timestamp: new Date().toISOString(),
                    action: vars.action,
                    details: vars.details ? JSON.stringify(vars.details) : undefined,
                  },
                ],
              }
            : null
        );
      }
    },
  });

  const completeMutation = useMutation({
    mutationFn: (testId: string) => api.post<{ score: number; breakdown: Record<string, number> }>(`/stress-test/${testId}/complete`),
    onSuccess: (data, testId) => {
      if (activeTest) {
        setActiveTest({
          ...activeTest,
          status: "completed",
          score: data.score,
          completedAt: new Date().toISOString(),
        });
        setViewState("results");
      }
      queryClient.invalidateQueries({ queryKey: ["stress-test-history"] });
    },
  });

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  useEffect(() => {
    if (viewState !== "active" || !activeTest?.startedAt) return;
    const start = new Date(activeTest.startedAt).getTime();
    const tick = () => setElapsedSeconds(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [viewState, activeTest?.startedAt]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const handleActionSubmit = () => {
    if (!activeTest) return;
    const details: Record<string, string> = {};
    if (actionModal.action === "emergency_po") {
      details.vendorId = actionForm.vendorId || "";
      details.materialId = actionForm.materialId || "";
      details.quantity = actionForm.quantity || "";
    } else if (actionModal.action === "override_inventory") {
      details.materialId = actionForm.materialId || "";
      details.quantity = actionForm.quantity || "";
    } else if (actionModal.action === "adjust_forecast") {
      details.materialId = actionForm.materialId || "";
      details.newForecast = actionForm.newForecast || "";
    }
    actionMutation.mutate({ testId: activeTest.id, action: actionModal.action, details });
  };

  const QUICK_ACTIONS = [
    { id: "run_mrp", label: "Run MRP", needsForm: false },
    { id: "emergency_po", label: "Emergency PO", needsForm: true },
    { id: "reroute_production", label: "Reroute Production", needsForm: false },
    { id: "override_inventory", label: "Override Inventory", needsForm: true },
    { id: "adjust_forecast", label: "Adjust Forecast", needsForm: true },
  ];

  return (
    <div>
      <PageHeader
        title="ERP Stress Test"
        subtitle="Survival challenge – manage crises in real-time"
      />

      {/* Scenario selection */}
      {viewState === "selection" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {SCENARIOS.map((s) => (
            <div
              key={s.id}
              className={`card overflow-hidden border-2 transition-all hover:shadow-md ${COLOR_CLASSES[s.color].split(" ")[0]} border-transparent hover:border-current`}
            >
              <div className={`p-6 border-b ${COLOR_CLASSES[s.color].split(" ")[0]}`}>
                <div className="flex items-start justify-between">
                  <div className={`p-3 rounded-xl ${COLOR_CLASSES[s.color]}`}>
                    <s.icon className="w-8 h-8" />
                  </div>
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${i < s.difficulty ? "fill-amber-400 text-amber-500" : "text-gray-200"}`}
                      />
                    ))}
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mt-3">{s.name}</h3>
                <p className="text-sm text-gray-600 mt-1">{s.description}</p>
              </div>
              <div className="p-4">
                <button
                  onClick={() => startMutation.mutate(s.id)}
                  disabled={startMutation.isPending}
                  className="btn-primary w-full"
                >
                  {startMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}{" "}
                  Start Challenge
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Active test view */}
      {viewState === "active" && activeTest && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-lg font-medium">
                <Clock className="w-5 h-5" />
                {formatTime(elapsedSeconds)}
              </div>
              <span className="badge badge-blue">
                {SCENARIOS.find((s) => s.id === activeTest.scenario)?.name ?? activeTest.scenario}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">Score: —</span>
              <button
                onClick={() => completeMutation.mutate(activeTest.id)}
                className="btn-primary"
              >
                Complete Challenge
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Crisis Feed - 40% */}
            <div className="lg:col-span-2 card overflow-hidden">
              <h3 className="px-4 py-3 border-b font-semibold text-gray-900">Crisis Feed</h3>
              <div className="max-h-[400px] overflow-y-auto divide-y">
                {(activeTest.events || []).length === 0 ? (
                  <div className="p-6 text-center text-gray-400 text-sm">
                    Events will appear here as the scenario unfolds.
                  </div>
                ) : (
                  (activeTest.events || []).map((ev) => (
                    <div key={ev.id} className="p-4 hover:bg-gray-50">
                      <div className="flex items-start gap-2">
                        <span className={`badge ${SEVERITY_STYLES[ev.severity] ?? "badge-gray"}`}>
                          {ev.severity}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(ev.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mt-1">{ev.description}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Action Panel - 60% */}
            <div className="lg:col-span-3 card overflow-hidden">
              <h3 className="px-4 py-3 border-b font-semibold text-gray-900">Action Panel</h3>
              <div className="p-4 space-y-4">
                <div className="flex flex-wrap gap-2">
                  {QUICK_ACTIONS.map((a) => (
                    <button
                      key={a.id}
                      onClick={() =>
                        a.needsForm
                          ? setActionModal({ action: a.id, open: true })
                          : actionMutation.mutate({
                              testId: activeTest.id,
                              action: a.id,
                            })
                      }
                      disabled={actionMutation.isPending}
                      className="btn-secondary btn-sm"
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Your Actions</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {(activeTest.studentActions || []).length === 0 ? (
                      <p className="text-sm text-gray-400">No actions taken yet.</p>
                    ) : (
                      (activeTest.studentActions || []).map((a) => (
                        <div
                          key={a.id}
                          className="flex items-center gap-2 text-sm p-2 bg-gray-50 rounded"
                        >
                          <span className="text-xs text-gray-400">
                            {new Date(a.timestamp).toLocaleTimeString()}
                          </span>
                          <span className="font-medium">{a.action.replace(/_/g, " ")}</span>
                          {a.details && (
                            <span className="text-gray-500 truncate">{a.details}</span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results view */}
      {viewState === "results" && activeTest && (
        <div className="card p-8 max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {activeTest.score != null && activeTest.score >= 60 ? "Pass" : "Fail"}
          </h2>
          <p className="text-6xl font-bold text-primary-600 mb-6">
            {activeTest.score?.toFixed(0) ?? "—"}%
          </p>
          <div className="grid grid-cols-2 gap-4 text-left mb-6">
            <div className="p-3 bg-gray-50 rounded">
              <p className="text-xs text-gray-500">Response Time</p>
              <p className="font-semibold">25%</p>
            </div>
            <div className="p-3 bg-gray-50 rounded">
              <p className="text-xs text-gray-500">Actions Taken</p>
              <p className="font-semibold">25%</p>
            </div>
            <div className="p-3 bg-gray-50 rounded">
              <p className="text-xs text-gray-500">KPI Recovery</p>
              <p className="font-semibold">25%</p>
            </div>
            <div className="p-3 bg-gray-50 rounded">
              <p className="text-xs text-gray-500">Decision Quality</p>
              <p className="font-semibold">25%</p>
            </div>
          </div>
          <button
            onClick={() => {
              setActiveTest(null);
              setViewState("selection");
            }}
            className="btn-primary"
          >
            <RotateCcw className="w-4 h-4" /> Try Again
          </button>
        </div>
      )}

      {/* My Tests tab */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">My Tests</h3>
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Scenario</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Score</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
              </tr>
            </thead>
            <tbody>
              {myTests.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                    No stress tests completed yet.
                  </td>
                </tr>
              ) : (
                myTests.map((t) => (
                  <tr key={t.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      {SCENARIOS.find((s) => s.id === t.scenario)?.name ?? t.scenario}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${t.status === "completed" ? "badge-green" : "badge-yellow"}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">{t.score != null ? `${t.score}%` : "—"}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {t.completedAt
                        ? new Date(t.completedAt).toLocaleDateString()
                        : t.startedAt
                        ? new Date(t.startedAt).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action modal */}
      <Modal
        isOpen={actionModal.open}
        onClose={() => setActionModal({ action: "", open: false })}
        title={QUICK_ACTIONS.find((a) => a.id === actionModal.action)?.label ?? "Action"}
        footer={
          <>
            <button onClick={() => setActionModal({ action: "", open: false })} className="btn-secondary">
              Cancel
            </button>
            <button
              onClick={handleActionSubmit}
              disabled={actionMutation.isPending}
              className="btn-primary"
            >
              {actionMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit"}
            </button>
          </>
        }
      >
        {actionModal.action === "emergency_po" && (
          <div className="space-y-4">
            <FormInput
              label="Vendor ID"
              value={actionForm.vendorId ?? ""}
              onChange={(e) => setActionForm({ ...actionForm, vendorId: e.target.value })}
            />
            <FormInput
              label="Material ID"
              value={actionForm.materialId ?? ""}
              onChange={(e) => setActionForm({ ...actionForm, materialId: e.target.value })}
            />
            <FormInput
              label="Quantity"
              type="number"
              value={actionForm.quantity ?? ""}
              onChange={(e) => setActionForm({ ...actionForm, quantity: e.target.value })}
            />
          </div>
        )}
        {actionModal.action === "override_inventory" && (
          <div className="space-y-4">
            <FormInput
              label="Material ID"
              value={actionForm.materialId ?? ""}
              onChange={(e) => setActionForm({ ...actionForm, materialId: e.target.value })}
            />
            <FormInput
              label="Quantity"
              type="number"
              value={actionForm.quantity ?? ""}
              onChange={(e) => setActionForm({ ...actionForm, quantity: e.target.value })}
            />
          </div>
        )}
        {actionModal.action === "adjust_forecast" && (
          <div className="space-y-4">
            <FormInput
              label="Material ID"
              value={actionForm.materialId ?? ""}
              onChange={(e) => setActionForm({ ...actionForm, materialId: e.target.value })}
            />
            <FormInput
              label="New Forecast"
              type="number"
              value={actionForm.newForecast ?? ""}
              onChange={(e) => setActionForm({ ...actionForm, newForecast: e.target.value })}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
