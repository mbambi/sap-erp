import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import PageHeader from "../../components/PageHeader";
import { Users, Play, UserPlus, Square, MessageSquare, Loader2 } from "lucide-react";

interface SimSession {
  id: string;
  name: string;
  scenario: string;
  status: string;
  participants: Array<{ userId: string; email: string; role: string; joinedAt: string }>;
  createdAt: string;
}

export default function SimulationHub() {
  const queryClient = useQueryClient();
  const [sessionName, setSessionName] = useState("");
  const [scenario, setScenario] = useState("manufacturing");
  const [selectedRole, setSelectedRole] = useState("");
  const [actionModule, setActionModule] = useState("procurement");
  const [actionType, setActionType] = useState("create_purchase_order");
  const [activeSession, setActiveSession] = useState<string | null>(null);

  const { data: roles } = useQuery({
    queryKey: ["sim-roles"],
    queryFn: () => api.get("/simulation/roles"),
  });

  const { data: sessions, refetch: refetchSessions } = useQuery({
    queryKey: ["sim-sessions"],
    queryFn: () => api.get<SimSession[]>("/simulation/sessions"),
  });

  const { data: sessionDetail, refetch: refetchDetail } = useQuery({
    queryKey: ["sim-session", activeSession],
    queryFn: () => api.get(`/simulation/sessions/${activeSession}`),
    enabled: !!activeSession,
    refetchInterval: activeSession ? 3000 : false,
  });

  const { data: feed } = useQuery({
    queryKey: ["sim-feed", activeSession],
    queryFn: () => api.get(`/simulation/sessions/${activeSession}/feed`),
    enabled: !!activeSession,
    refetchInterval: activeSession ? 2000 : false,
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; scenario: string }) => api.post("/simulation/sessions", data),
    onSuccess: (data) => {
      setActiveSession(data.session.id);
      queryClient.invalidateQueries({ queryKey: ["sim-sessions"] });
    },
  });

  const joinMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => api.post(`/simulation/sessions/${id}/join`, { role }),
    onSuccess: () => {
      refetchDetail();
      refetchSessions();
    },
  });

  const startMutation = useMutation({
    mutationFn: (id: string) => api.post(`/simulation/sessions/${id}/start`),
    onSuccess: () => refetchDetail(),
  });

  const actionMutation = useMutation({
    mutationFn: ({ id, module, action }: { id: string; module: string; action: string }) =>
      api.post(`/simulation/sessions/${id}/action`, { module, action, data: {} }),
    onSuccess: () => refetchDetail(),
  });

  const endMutation = useMutation({
    mutationFn: (id: string) => api.post(`/simulation/sessions/${id}/end`),
    onSuccess: () => {
      setActiveSession(null);
      refetchSessions();
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Multi-User Simulation"
        subtitle="Collaborative ERP simulation with role-based access"
        icon={Users}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Create / Join */}
        <div className="space-y-4">
          {/* Create Session */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Create Session</h3>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Session Name"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
              />
              <select
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
              >
                <option value="manufacturing">Manufacturing</option>
                <option value="retail">Retail</option>
                <option value="services">Services</option>
              </select>
              <button
                onClick={() => createMutation.mutate({ name: sessionName || "New Session", scenario })}
                disabled={createMutation.isPending}
                className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm flex items-center justify-center gap-2"
              >
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Create Session
              </button>
            </div>
          </div>

          {/* Available Sessions */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Sessions</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {sessions?.map((s: SimSession) => (
                <button
                  key={s.id}
                  onClick={() => setActiveSession(s.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                    activeSession === s.id
                      ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-primary-300"
                  }`}
                >
                  <div className="font-medium text-gray-900 dark:text-white">{s.name}</div>
                  <div className="text-xs text-gray-500">
                    {s.status} · {s.participants?.length ?? 0} players
                  </div>
                </button>
              ))}
              {(!sessions || sessions.length === 0) && (
                <p className="text-sm text-gray-400 text-center py-4">No sessions yet</p>
              )}
            </div>
          </div>
        </div>

        {/* Middle: Session Detail */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          {activeSession && sessionDetail ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-white">{sessionDetail.session?.name}</h3>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  sessionDetail.session?.status === "running"
                    ? "bg-green-100 text-green-700"
                    : sessionDetail.session?.status === "ended"
                    ? "bg-gray-100 text-gray-700"
                    : "bg-yellow-100 text-yellow-700"
                }`}>
                  {sessionDetail.session?.status}
                </span>
              </div>

              {/* Participants */}
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2">Participants</h4>
                <div className="space-y-1">
                  {sessionDetail.session?.participants?.map((p: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 dark:text-gray-300">{p.email}</span>
                      <span className="px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded text-xs">
                        {p.role}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Join */}
              {sessionDetail.session?.status === "waiting" && (
                <div className="flex gap-2">
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                  >
                    <option value="">Select role...</option>
                    {roles?.map((r: any) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => selectedRole && joinMutation.mutate({ id: activeSession!, role: selectedRole })}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                  >
                    <UserPlus className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Controls */}
              <div className="flex gap-2">
                {sessionDetail.session?.status === "waiting" && (
                  <button
                    onClick={() => startMutation.mutate(activeSession!)}
                    className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm flex items-center justify-center gap-2"
                  >
                    <Play className="w-4 h-4" /> Start
                  </button>
                )}
                {sessionDetail.session?.status === "running" && (
                  <>
                    <select value={actionModule} onChange={(e) => setActionModule(e.target.value)} className="flex-1 px-2 py-2 rounded border text-sm dark:bg-gray-700 dark:border-gray-600">
                      <option value="procurement">Procurement</option>
                      <option value="production">Production</option>
                      <option value="warehouse">Warehouse</option>
                      <option value="finance">Finance</option>
                      <option value="sales">Sales</option>
                      <option value="quality">Quality</option>
                    </select>
                    <button
                      onClick={() => actionMutation.mutate({ id: activeSession!, module: actionModule, action: actionType })}
                      className="px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"
                    >
                      Act
                    </button>
                  </>
                )}
                {sessionDetail.session?.status !== "ended" && (
                  <button
                    onClick={() => endMutation.mutate(activeSession!)}
                    className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                  >
                    <Square className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-400 py-12">
              Select or create a session to begin
            </div>
          )}
        </div>

        {/* Right: Event Feed */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" /> Event Feed
          </h3>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {feed?.events?.map((e: any, i: number) => (
              <div key={i} className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900 dark:text-white">{e.action ?? e.type}</span>
                  <span className="text-gray-400">{new Date(e.timestamp).toLocaleTimeString()}</span>
                </div>
                <p className="text-gray-500 mt-0.5">{e.userEmail} · {e.module}</p>
              </div>
            ))}
            {(!feed?.events || feed.events.length === 0) && (
              <p className="text-sm text-gray-400 text-center py-8">No events yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
