import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Award,
  PlayCircle,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  Trophy,
  Plus,
  FileCheck,
} from "lucide-react";
import { api } from "../api/client";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import { useAuthStore } from "../stores/auth";

interface Certification {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  modulesCovered: string;
  passingScore: number;
  timeLimit?: number | null;
  tasks: string;
  isActive: boolean;
  myAttempts?: CertificationAttempt[];
}

interface CertificationAttempt {
  id: string;
  certificationId: string;
  userId: string;
  status: string;
  score?: number | null;
  startedAt: string;
  completedAt?: string | null;
  taskResults?: string | null;
  timeSpent?: number | null;
  certification?: { title: string };
}

interface TaskDef {
  id: string;
  description: string;
  validationRules?: string;
}

type Tab = "available" | "my-certs" | "leaderboard" | "admin";

export default function CertificationCenter() {
  const queryClient = useQueryClient();
  const { user, hasRole } = useAuthStore();
  const isAdminOrInstructor = hasRole("admin") || hasRole("instructor");

  const [activeTab, setActiveTab] = useState<Tab>("available");
  const [selectedCertId, setSelectedCertId] = useState<string | null>(null);
  const [activeAttemptId, setActiveAttemptId] = useState<string | null>(null);
  const [taskResults, setTaskResults] = useState<Record<string, { completed: boolean; evidence?: string }>>({});
  const [showCreateCert, setShowCreateCert] = useState(false);
  const [certForm, setCertForm] = useState({
    code: "",
    title: "",
    description: "",
    modulesCovered: [] as string[],
    passingScore: 70,
    timeLimit: 60,
    tasks: [] as TaskDef[],
  });

  const { data: certsRes } = useQuery({
    queryKey: ["certification"],
    queryFn: () => api.get<{ data: Certification[] }>("/certification"),
  });
  const certifications = certsRes?.data ?? [];

  const { data: certDetail } = useQuery({
    queryKey: ["certification", selectedCertId],
    queryFn: () => api.get<Certification>(`/certification/${selectedCertId}`),
    enabled: !!selectedCertId,
  });

  const { data: myAttemptsRes } = useQuery({
    queryKey: ["certification", "my-attempts"],
    queryFn: () => api.get<{ data: CertificationAttempt[] }>("/certification/my-attempts"),
  });
  const myAttempts = myAttemptsRes?.data ?? [];

  const { data: leaderboardRes } = useQuery({
    queryKey: ["certification", selectedCertId, "leaderboard"],
    queryFn: () => api.get<{ data: CertificationAttempt[] }>(`/certification/${selectedCertId}/leaderboard`),
    enabled: !!selectedCertId && activeTab === "leaderboard",
  });
  const leaderboard = leaderboardRes?.data ?? [];

  const { data: allAttemptsRes } = useQuery({
    queryKey: ["certification", selectedCertId, "attempts"],
    queryFn: () => api.get<{ data: CertificationAttempt[] }>(`/certification/${selectedCertId}/attempts`),
    enabled: !!selectedCertId && activeTab === "admin" && isAdminOrInstructor,
  });
  const allAttempts = allAttemptsRes?.data ?? [];

  const startAttempt = useMutation({
    mutationFn: (id: string) => api.post<CertificationAttempt>(`/certification/${id}/start`),
    onSuccess: (data) => {
      setActiveAttemptId(data.id);
      setSelectedCertId(data.certificationId);
      const cert = certifications.find((c) => c.id === data.certificationId);
      if (cert) {
        const tasks = parseTasks(cert.tasks);
        const init: Record<string, { completed: boolean; evidence?: string }> = {};
        tasks.forEach((t) => (init[t.id] = { completed: false, evidence: "" }));
        setTaskResults(init);
      }
      queryClient.invalidateQueries({ queryKey: ["certification"] });
    },
  });

  const [lastResult, setLastResult] = useState<CertificationAttempt | null>(null);

  const submitAttempt = useMutation({
    mutationFn: (id: string) =>
      api.post<CertificationAttempt>(`/certification/${id}/submit`, {
        taskResults: Object.entries(taskResults).map(([taskId, r]) => ({
          taskId,
          completed: r.completed,
          evidence: r.evidence,
        })),
      }),
    onSuccess: (data) => {
      setActiveAttemptId(null);
      setTaskResults({});
      setLastResult(data);
      queryClient.invalidateQueries({ queryKey: ["certification"] });
    },
  });

  const createCert = useMutation({
    mutationFn: (data: typeof certForm) =>
      api.post("/certification", {
        ...data,
        modulesCovered: data.modulesCovered,
        timeLimit: data.timeLimit || null,
        tasks: data.tasks,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["certification"] });
      setShowCreateCert(false);
      setCertForm({
        code: "",
        title: "",
        description: "",
        modulesCovered: [],
        passingScore: 70,
        timeLimit: 60,
        tasks: [],
      });
    },
  });

  function parseTasks(tasksJson: string): TaskDef[] {
    try {
      const t = JSON.parse(tasksJson || "[]");
      return Array.isArray(t) ? t : [];
    } catch {
      return [];
    }
  }

  const currentUserAttempt = myAttempts.find(
    (a) => a.certificationId === selectedCertId && a.status === "in_progress"
  );
  const attemptCount = certDetail?.myAttempts?.length ?? 0;

  const modules = ["Finance", "MM", "SD", "PP", "FI", "CO", "HR"];

  return (
    <div>
      <PageHeader
        title="Certification Center"
        subtitle="Earn SAP ERP certifications and track your progress"
      />

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab("available")}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            activeTab === "available" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Available Certifications
        </button>
        <button
          onClick={() => setActiveTab("my-certs")}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            activeTab === "my-certs" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          My Certifications
        </button>
        <button
          onClick={() => setActiveTab("leaderboard")}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            activeTab === "leaderboard" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Leaderboard
        </button>
        {isAdminOrInstructor && (
          <button
            onClick={() => setActiveTab("admin")}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              activeTab === "admin" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Admin
          </button>
        )}
      </div>

      {/* Available Certifications */}
      {activeTab === "available" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {certifications.filter((c) => c.isActive).map((cert) => {
            const attempts = cert.myAttempts ?? [];
            const lastAttempt = attempts[0];
            const hasInProgress = attempts.some((a) => a.status === "in_progress");
            const passed = attempts.some((a) => a.status === "passed");
            let modulesCovered: string[] = [];
            try {
              modulesCovered = JSON.parse(cert.modulesCovered || "[]");
            } catch {}
            return (
              <div
                key={cert.id}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5"
              >
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{cert.title}</h3>
                {cert.description && (
                  <p className="text-sm text-gray-500 mb-3 line-clamp-2">{cert.description}</p>
                )}
                <div className="flex flex-wrap gap-1 mb-3">
                  {modulesCovered.map((m) => (
                    <span key={m} className="badge badge-blue text-xs">{m}</span>
                  ))}
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                  <span>Pass: {cert.passingScore}%</span>
                  {cert.timeLimit && <span>{cert.timeLimit} min</span>}
                  <span>{attempts.length} attempts</span>
                </div>
                <button
                  onClick={() => {
                    setSelectedCertId(cert.id);
                    const inProgressAttempt = attempts.find((a) => a.status === "in_progress");
                    if (hasInProgress && inProgressAttempt) {
                      setActiveAttemptId(inProgressAttempt.id);
                      try {
                        const results = JSON.parse(inProgressAttempt.taskResults || "[]");
                        const init: Record<string, { completed: boolean; evidence?: string }> = {};
                        (Array.isArray(results) ? results : []).forEach((r: any) => {
                          if (r.taskId) init[r.taskId] = { completed: !!r.completed, evidence: r.evidence };
                        });
                        setTaskResults(init);
                      } catch {}
                    } else {
                      startAttempt.mutate(cert.id);
                    }
                  }}
                  disabled={hasInProgress || startAttempt.isPending}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 flex items-center justify-center gap-2"
                >
                  {hasInProgress ? (
                    <>Continue Exam</>
                  ) : passed ? (
                    <>Retry</>
                  ) : (
                    <>Start Exam</>
                  )}
                  <PlayCircle className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Active Exam View */}
      {activeAttemptId && certDetail && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{certDetail.title}</h2>
            {certDetail.timeLimit && (
              <ExamTimer
                timeLimitMinutes={certDetail.timeLimit}
                startedAt={currentUserAttempt?.startedAt}
                onExpire={() => submitAttempt.mutate(activeAttemptId)}
              />
            )}
          </div>
          <div className="space-y-4">
            {parseTasks(certDetail.tasks).map((task) => (
              <div
                key={task.id}
                className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg"
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={taskResults[task.id]?.completed ?? false}
                    onChange={(e) =>
                      setTaskResults((r) => ({
                        ...r,
                        [task.id]: { ...r[task.id], completed: e.target.checked },
                      }))
                    }
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-white">{task.description}</p>
                    <input
                      type="text"
                      placeholder="Evidence (what you did)"
                      className="input mt-2"
                      value={taskResults[task.id]?.evidence ?? ""}
                      onChange={(e) =>
                        setTaskResults((r) => ({
                          ...r,
                          [task.id]: { ...r[task.id], evidence: e.target.value },
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => submitAttempt.mutate(activeAttemptId)}
            disabled={submitAttempt.isPending}
            className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-3 font-medium"
          >
            Submit Exam
          </button>
        </div>
      )}

      {/* Results view - after submission */}
      {lastResult && (
        <Modal
          isOpen={!!lastResult}
          onClose={() => setLastResult(null)}
          title="Exam Results"
          size="lg"
          footer={
            lastResult.status === "failed" ? (
              <button
                onClick={() => {
                  setLastResult(null);
                  if (lastResult.certificationId) startAttempt.mutate(lastResult.certificationId);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2"
              >
                Try Again
              </button>
            ) : (
              <button onClick={() => setLastResult(null)} className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2">
                Close
              </button>
            )
          }
        >
          <div className="text-center mb-6">
            <p className="text-4xl font-bold mb-2">{lastResult.score?.toFixed(1) ?? 0}%</p>
            <span className={`badge text-lg ${lastResult.status === "passed" ? "badge-green" : "badge-red"}`}>
              {lastResult.status === "passed" ? "PASSED" : "FAILED"}
            </span>
            {lastResult.timeSpent && (
              <p className="text-sm text-gray-500 mt-2">Time spent: {Math.floor(lastResult.timeSpent / 60)} min</p>
            )}
          </div>
          {lastResult.taskResults && (() => {
            try {
              const results = JSON.parse(lastResult.taskResults);
              return Array.isArray(results) && results.length > 0 ? (
                <div>
                  <h4 className="font-medium mb-2">Per-task breakdown</h4>
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="py-2">Task</th>
                        <th className="py-2">Completed</th>
                        <th className="py-2">Evidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((r: any, i: number) => (
                        <tr key={i} className="border-b border-gray-100">
                          <td className="py-2">{r.taskId}</td>
                          <td className="py-2">{r.completed ? "✓" : "✗"}</td>
                          <td className="py-2 text-gray-600">{r.evidence || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null;
            } catch {
              return null;
            }
          })()}
        </Modal>
      )}

      {/* My Certifications */}
      {activeTab === "my-certs" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                  <th className="px-6 py-3 font-medium">Certification</th>
                  <th className="px-6 py-3 font-medium">Best Score</th>
                  <th className="px-6 py-3 font-medium">Attempts</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const byCert = new Map<string, CertificationAttempt[]>();
                  myAttempts.forEach((a) => {
                    const list = byCert.get(a.certificationId) || [];
                    list.push(a);
                    byCert.set(a.certificationId, list);
                  });
                  return Array.from(byCert.entries()).map(([certId, attempts]) => {
                    const cert = attempts[0]?.certification;
                    const best = attempts
                      .filter((a) => a.score != null)
                      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
                    const passed = attempts.some((a) => a.status === "passed");
                    const inProgress = attempts.some((a) => a.status === "in_progress");
                    return (
                      <tr key={certId} className="border-b border-gray-100 dark:border-gray-700">
                        <td className="px-6 py-3 font-medium">{cert?.title ?? certId}</td>
                        <td className="px-6 py-3">{best?.score?.toFixed(1) ?? "—"}%</td>
                        <td className="px-6 py-3">{attempts.length}</td>
                        <td className="px-6 py-3">
                          <span
                            className={`badge ${
                              passed ? "badge-green" : inProgress ? "badge-blue" : "badge-red"
                            }`}
                          >
                            {passed ? "Passed" : inProgress ? "In Progress" : "Failed"}
                          </span>
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
          {myAttempts.filter((a) => a.status === "passed").length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <h3 className="col-span-2 font-semibold text-gray-900 dark:text-white">Certificates</h3>
              {myAttempts
                .filter((a) => a.status === "passed")
                .map((a) => (
                  <div
                    key={a.id}
                    className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/30 border-2 border-amber-300 dark:border-amber-700 rounded-xl p-6 text-center"
                  >
                    <Award className="w-12 h-12 text-amber-600 mx-auto mb-2" />
                    <h4 className="font-bold text-gray-900 dark:text-white">{a.certification?.title}</h4>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                      Score: {a.score?.toFixed(1)}% • {a.timeSpent ? `${Math.floor(a.timeSpent / 60)} min` : ""}
                    </p>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Leaderboard */}
      {activeTab === "leaderboard" && (
        <div className="space-y-4">
          <div className="flex gap-2 mb-4">
            <select
              className="input w-auto"
              value={selectedCertId || ""}
              onChange={(e) => setSelectedCertId(e.target.value || null)}
            >
              <option value="">Select certification</option>
              {certifications.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>
          {selectedCertId && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                    <th className="px-6 py-3 font-medium">Rank</th>
                    <th className="px-6 py-3 font-medium">User</th>
                    <th className="px-6 py-3 font-medium">Score</th>
                    <th className="px-6 py-3 font-medium">Time</th>
                    <th className="px-6 py-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((a, i) => (
                    <tr
                      key={a.id}
                      className={`border-b border-gray-100 dark:border-gray-700 ${
                        a.userId === user?.id ? "bg-blue-50 dark:bg-blue-900/20" : ""
                      }`}
                    >
                      <td className="px-6 py-3 font-medium">{i + 1}</td>
                      <td className="px-6 py-3">
                        {a.userId === user?.id ? "You" : (a.userId ?? "").slice(0, 8)}
                      </td>
                      <td className="px-6 py-3">{a.score?.toFixed(1) ?? "—"}%</td>
                      <td className="px-6 py-3">
                        {a.timeSpent ? `${Math.floor(a.timeSpent / 60)}m` : "—"}
                      </td>
                      <td className="px-6 py-3 text-gray-500">
                        {a.completedAt ? new Date(a.completedAt).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Admin */}
      {activeTab === "admin" && isAdminOrInstructor && (
        <div className="space-y-6">
          <button
            onClick={() => setShowCreateCert(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Create Certification
          </button>
          <div className="flex gap-2">
            <select
              className="input w-auto"
              value={selectedCertId || ""}
              onChange={(e) => setSelectedCertId(e.target.value || null)}
            >
              <option value="">Select certification</option>
              {certifications.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>
          {selectedCertId && allAttempts.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <h3 className="px-6 py-3 font-semibold border-b">All Student Attempts</h3>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                    <th className="px-6 py-3 font-medium">User</th>
                    <th className="px-6 py-3 font-medium">Score</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {allAttempts.map((a) => (
                    <tr key={a.id} className="border-b border-gray-100 dark:border-gray-700">
                      <td className="px-6 py-3">{(a.userId ?? "").slice(0, 8)}</td>
                      <td className="px-6 py-3">{a.score?.toFixed(1) ?? "—"}%</td>
                      <td className="px-6 py-3">
                        <span
                          className={`badge ${
                            a.status === "passed" ? "badge-green" : a.status === "failed" ? "badge-red" : "badge-blue"
                          }`}
                        >
                          {a.status}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-gray-500">
                        {new Date(a.startedAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <Modal
        isOpen={showCreateCert}
        onClose={() => setShowCreateCert(false)}
        title="Create Certification"
        size="lg"
        footer={
          <button
            onClick={() => createCert.mutate(certForm)}
            disabled={createCert.isPending || !certForm.code || !certForm.title}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2"
          >
            Create
          </button>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Code</label>
            <input
              className="input"
              value={certForm.code}
              onChange={(e) => setCertForm((f) => ({ ...f, code: e.target.value }))}
              placeholder="CERT-FI-001"
            />
          </div>
          <div>
            <label className="label">Title</label>
            <input
              className="input"
              value={certForm.title}
              onChange={(e) => setCertForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Finance Fundamentals"
            />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              className="input min-h-[60px]"
              value={certForm.description}
              onChange={(e) => setCertForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Modules Covered</label>
            <div className="flex flex-wrap gap-2">
              {modules.map((m) => (
                <label key={m} className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={certForm.modulesCovered.includes(m)}
                    onChange={(e) =>
                      setCertForm((f) => ({
                        ...f,
                        modulesCovered: e.target.checked
                          ? [...f.modulesCovered, m]
                          : f.modulesCovered.filter((x) => x !== m),
                      }))
                    }
                  />
                  {m}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Passing Score (%)</label>
            <input
              type="number"
              className="input"
              value={certForm.passingScore}
              onChange={(e) => setCertForm((f) => ({ ...f, passingScore: +e.target.value }))}
              min={0}
              max={100}
            />
          </div>
          <div>
            <label className="label">Time Limit (minutes)</label>
            <input
              type="number"
              className="input"
              value={certForm.timeLimit}
              onChange={(e) => setCertForm((f) => ({ ...f, timeLimit: +e.target.value }))}
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="label">Tasks (JSON array)</label>
            <textarea
              className="input font-mono text-sm min-h-[120px]"
              value={JSON.stringify(certForm.tasks, null, 2)}
              onChange={(e) => {
                try {
                  setCertForm((f) => ({ ...f, tasks: JSON.parse(e.target.value || "[]") }));
                } catch {}
              }}
              placeholder='[{"id":"t1","description":"Create a journal entry"}]'
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

function ExamTimer({
  timeLimitMinutes,
  startedAt,
  onExpire,
}: {
  timeLimitMinutes: number;
  startedAt?: string;
  onExpire: () => void;
}) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!startedAt) return;
    const start = new Date(startedAt).getTime();
    const totalMs = timeLimitMinutes * 60 * 1000;

    const tick = () => {
      const elapsed = Date.now() - start;
      const left = Math.max(0, Math.floor((totalMs - elapsed) / 1000));
      setRemaining(left);
      if (left <= 0) onExpire();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt, timeLimitMinutes, onExpire]);

  if (remaining === null) return null;
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  const isLow = remaining < 300;
  return (
    <div className={`flex items-center gap-2 font-mono text-lg ${isLow ? "text-red-600" : "text-gray-700 dark:text-gray-300"}`}>
      <Clock className="w-5 h-5" />
      {m}:{s.toString().padStart(2, "0")}
    </div>
  );
}
