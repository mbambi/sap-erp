import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { useAuthStore } from "../stores/auth";
import PageHeader from "../components/PageHeader";
import { CheckCircle2, Circle, Loader2, Lock, RotateCcw, Plus } from "lucide-react";

interface ChecklistTask {
  id: string;
  name: string;
  description: string;
  status: string;
  completedAt: string | null;
  completedBy: string | null;
}

interface ClosingPeriod {
  id: string;
  year: number;
  month: number;
  status: string;
  checklist?: string;
  startedAt: string | null;
  completedAt: string | null;
  completedBy: string | null;
}

interface PeriodWithChecklist extends ClosingPeriod {
  checklist: ChecklistTask[];
}

interface PeriodStatus {
  year: number;
  open: number;
  in_progress: number;
  closed: number;
  total: number;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const CARD_CLASS = "bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700";
const BTN_CLASS = "bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50";

export default function PeriodClosing() {
  const queryClient = useQueryClient();
  const { hasRole } = useAuthStore();
  const isAdmin = hasRole("admin") || hasRole("instructor");
  const isAdminOnly = hasRole("admin");

  const currentYear = new Date().getFullYear();
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [showCreatePeriod, setShowCreatePeriod] = useState(false);
  const [createYear, setCreateYear] = useState(currentYear);
  const [createMonth, setCreateMonth] = useState(1);

  const { data: status } = useQuery({
    queryKey: ["period-closing", "status"],
    queryFn: () => api.get<PeriodStatus>("/period-closing/status"),
  });

  const { data: periods = [] } = useQuery({
    queryKey: ["period-closing", "periods", currentYear],
    queryFn: () => api.get<ClosingPeriod[]>("/period-closing", { year: currentYear }),
  });

  const { data: periodDetail, isLoading: periodDetailLoading } = useQuery({
    queryKey: ["period-closing", "period", selectedPeriodId],
    queryFn: () => api.get<PeriodWithChecklist>(`/period-closing/${selectedPeriodId}`),
    enabled: !!selectedPeriodId,
  });

  const completeTaskMutation = useMutation({
    mutationFn: ({ periodId, taskId }: { periodId: string; taskId: string }) =>
      api.post(`/period-closing/${periodId}/task/${taskId}/complete`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["period-closing"] }),
  });

  const reopenTaskMutation = useMutation({
    mutationFn: ({ periodId, taskId }: { periodId: string; taskId: string }) =>
      api.post(`/period-closing/${periodId}/task/${taskId}/reopen`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["period-closing"] }),
  });

  const closePeriodMutation = useMutation({
    mutationFn: (id: string) => api.post(`/period-closing/${id}/close`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["period-closing"] }),
  });

  const reopenPeriodMutation = useMutation({
    mutationFn: (id: string) => api.post(`/period-closing/${id}/reopen`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["period-closing"] }),
  });

  const createPeriodMutation = useMutation({
    mutationFn: () => api.post("/period-closing", { year: createYear, month: createMonth }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["period-closing"] });
      setShowCreatePeriod(false);
    },
  });

  const getMonthStatus = (month: number) => {
    const p = periods.find((x) => x.month === month);
    return p?.status ?? "none";
  };

  const statusColor = (s: string) => {
    if (s === "closed") return "bg-emerald-500";
    if (s === "in_progress") return "bg-amber-500";
    if (s === "open") return "bg-gray-300 dark:bg-gray-600";
    return "bg-gray-200 dark:bg-gray-700";
  };

  const checklist = periodDetail?.checklist ?? [];
  const completedCount = checklist.filter((t) => t.status === "completed").length;
  const totalCount = checklist.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const allComplete = totalCount > 0 && completedCount === totalCount;
  const canClose = allComplete && periodDetail?.status !== "closed";

  return (
    <div>
      <PageHeader title="Period Closing" subtitle="Manage month-end closing tasks and fiscal period status" />

      {/* Year Overview - Month Pills */}
      <div className={`${CARD_CLASS} p-4 mb-6`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            {currentYear} - Period Overview
          </h3>
          {isAdmin && (
            <button onClick={() => setShowCreatePeriod(true)} className={`${BTN_CLASS} flex items-center gap-2`}>
              <Plus className="w-4 h-4" /> Create Period
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {MONTHS.map((m, i) => {
            const monthNum = i + 1;
            const st = getMonthStatus(monthNum);
            const period = periods.find((p) => p.month === monthNum);
            return (
              <button
                key={monthNum}
                onClick={() => {
                  if (period) setSelectedPeriodId(period.id);
                  else {
                    setCreateYear(currentYear);
                    setCreateMonth(monthNum);
                    setShowCreatePeriod(true);
                  }
                }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  selectedPeriodId === period?.id
                    ? "ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${statusColor(st)}`} />
                {m}
              </button>
            );
          })}
        </div>
        <div className="flex gap-4 mt-4 text-sm text-gray-500 dark:text-gray-400">
          <span><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block mr-1" /> Closed: {status?.closed ?? 0}</span>
          <span><span className="w-2 h-2 rounded-full bg-amber-500 inline-block mr-1" /> In Progress: {status?.in_progress ?? 0}</span>
          <span><span className="w-2 h-2 rounded-full bg-gray-400 inline-block mr-1" /> Open: {status?.open ?? 0}</span>
        </div>
      </div>

      {/* Period Detail */}
      {selectedPeriodId && (
        <div className={`${CARD_CLASS} overflow-hidden`}>
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap justify-between items-center gap-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {periodDetail ? `${MONTHS[periodDetail.month - 1]} ${periodDetail.year} - Month-End Closing` : "Loading..."}
              </h3>
              <span
                className={`inline-flex mt-2 px-3 py-1 rounded-full text-xs font-medium ${
                  periodDetail?.status === "closed"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                    : periodDetail?.status === "in_progress"
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                    : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                }`}
              >
                {periodDetail?.status ?? "open"}
              </span>
            </div>
            <div className="flex gap-2">
              {isAdminOnly && periodDetail?.status === "closed" && (
                <button
                  onClick={() => reopenPeriodMutation.mutate(selectedPeriodId)}
                  disabled={reopenPeriodMutation.isPending}
                  className="px-4 py-2 rounded-lg bg-amber-100 text-amber-800 hover:bg-amber-200 text-sm font-medium flex items-center gap-2"
                >
                  {reopenPeriodMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                  Reopen Period
                </button>
              )}
              {isAdmin && canClose && (
                <button
                  onClick={() => closePeriodMutation.mutate(selectedPeriodId)}
                  disabled={closePeriodMutation.isPending}
                  className={`${BTN_CLASS} flex items-center gap-2`}
                >
                  {closePeriodMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                  Close Period
                </button>
              )}
            </div>
          </div>

          {periodDetailLoading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
            </div>
          ) : (
            <div className="p-4">
              {/* Progress Bar */}
              <div className="mb-6">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600 dark:text-gray-400">Progress</span>
                  <span className="font-medium">{completedCount} / {totalCount} tasks ({progressPct}%)</span>
                </div>
                <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>

              {/* Timeline / Checklist */}
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
                <div className="space-y-4">
                  {checklist.map((task, idx) => {
                    const isCompleted = task.status === "completed";
                    return (
                      <div
                        key={task.id}
                        className={`relative flex gap-4 ${CARD_CLASS} p-4 hover:shadow-md transition-shadow`}
                      >
                        <div className="flex-shrink-0 z-10">
                          <button
                            onClick={() => {
                              if (!isAdmin) return;
                              if (isCompleted) {
                                reopenTaskMutation.mutate({ periodId: selectedPeriodId!, taskId: task.id });
                              } else {
                                completeTaskMutation.mutate({ periodId: selectedPeriodId!, taskId: task.id });
                              }
                            }}
                            disabled={!isAdmin || (completeTaskMutation.isPending && !isCompleted) || (reopenTaskMutation.isPending && isCompleted) || periodDetail?.status === "closed"}
                            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          >
                            {isCompleted ? (
                              <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <Circle className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                            )}
                          </button>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className={`font-medium ${isCompleted ? "text-gray-500 line-through" : "text-gray-900 dark:text-white"}`}>
                            {task.name}
                          </h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{task.description}</p>
                          {isCompleted && task.completedAt && (
                            <p className="text-xs text-gray-400 mt-2">
                              Completed {new Date(task.completedAt).toLocaleString()}
                              {task.completedBy && ` by ${task.completedBy}`}
                            </p>
                          )}
                        </div>
                        <div className="flex-shrink-0">
                          <span
                            className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              isCompleted ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                            }`}
                          >
                            {isCompleted ? "✓ Completed" : "○ Pending"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Period Modal */}
      {showCreatePeriod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className={`${CARD_CLASS} w-full max-w-md p-6`}>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Create Closing Period</h3>
            <div className="space-y-4">
              <div>
                <label className="label">Year</label>
                <select value={createYear} onChange={(e) => setCreateYear(Number(e.target.value))} className="input">
                  {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Month</label>
                <select value={createMonth} onChange={(e) => setCreateMonth(Number(e.target.value))} className="input">
                  {MONTHS.map((m, i) => (
                    <option key={i} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button className="btn-secondary" onClick={() => setShowCreatePeriod(false)}>Cancel</button>
              <button
                className={BTN_CLASS}
                onClick={() => createPeriodMutation.mutate()}
                disabled={createPeriodMutation.isPending}
              >
                {createPeriodMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
