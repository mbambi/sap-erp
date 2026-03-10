import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line,
} from "recharts";
import {
  Play, Pause, SkipForward, SkipBack, Loader2, Film, AlertTriangle,
  CheckCircle, Target, Clock, Trophy,
} from "lucide-react";
import { api } from "../../api/client";
import PageHeader from "../../components/PageHeader";
import KPICard from "../../components/KPICard";

interface ScenarioEvent {
  day: number;
  type: string;
  title: string;
  description: string;
  affectedModule: string;
  options?: Array<{ id: string; label: string; impact: string }>;
}

interface Scenario {
  id: string;
  name: string;
  description: string;
  difficulty: string;
  durationDays: number;
  tags: string[];
  events: ScenarioEvent[];
}

interface PlayResult {
  timeline: Array<{ day: number; type: string; title: string; description: string; metrics: Record<string, number> }>;
  score: { overall: number; serviceLevel: number; costEfficiency: number; backorderControl: number };
}

export default function ScenarioReplay() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [playResult, setPlayResult] = useState<PlayResult | null>(null);
  const [currentDay, setCurrentDay] = useState(0);
  const [decisions, setDecisions] = useState<Record<number, string>>({});

  const { data: scenarios, isLoading } = useQuery<Scenario[]>({
    queryKey: ["scenario-replay-list"],
    queryFn: () => api.get("/scenario-replay/scenarios"),
  });

  const scenarioQ = useQuery<Scenario>({
    queryKey: ["scenario-replay", selectedId],
    queryFn: () => api.get(`/scenario-replay/scenarios/${selectedId}`),
    enabled: !!selectedId,
  });

  const playMut = useMutation({
    mutationFn: (body: { decisions: Record<number, string> }) => api.post(`/scenario-replay/scenarios/${selectedId}/play`, body),
    onSuccess: (data) => {
      setPlayResult(data as PlayResult);
      setCurrentDay(0);
    },
  });

  const scenario = scenarioQ.data;
  const timeline = playResult?.timeline ?? [];
  const currentEvent = timeline[currentDay] ?? null;

  const decisionPoints = scenario?.events?.filter((e) => e.type === "decision_point") ?? [];

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /></div>;

  return (
    <div className="space-y-6">
      <PageHeader title="Scenario Replay & Time Travel" subtitle="Netflix-style ERP crisis scenarios — play, decide, learn" />

      {/* Scenario Picker */}
      {!selectedId && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(scenarios ?? []).map((s: Scenario) => (
            <button key={s.id} onClick={() => setSelectedId(s.id)}
              className="bg-gray-900 rounded-xl border border-gray-800 p-6 text-left hover:border-primary-600 transition group">
              <div className="flex items-center gap-2 mb-2">
                <Film className="w-5 h-5 text-primary-500" />
                <span className={`text-xs px-2 py-0.5 rounded-full ${s.difficulty === "hard" ? "bg-red-900/50 text-red-400" : s.difficulty === "medium" ? "bg-yellow-900/50 text-yellow-400" : "bg-green-900/50 text-green-400"}`}>{s.difficulty}</span>
              </div>
              <h3 className="text-white font-semibold group-hover:text-primary-400 transition">{s.name}</h3>
              <p className="text-gray-400 text-sm mt-1">{s.description}</p>
              <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {s.durationDays} days</span>
                <span>{s.tags?.join(", ")}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Scenario Detail */}
      {selectedId && scenario && (
        <>
          <div className="flex items-center gap-3">
            <button onClick={() => { setSelectedId(null); setPlayResult(null); setDecisions({}); }}
              className="text-gray-400 hover:text-white text-sm">← Back to scenarios</button>
            <h2 className="text-white text-xl font-bold">{scenario.name}</h2>
          </div>

          {/* Decision Points */}
          {!playResult && decisionPoints.length > 0 && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-yellow-500" /> Decision Points
              </h3>
              <p className="text-gray-400 text-sm mb-4">Make your decisions before running the scenario:</p>
              <div className="space-y-4">
                {decisionPoints.map((dp) => (
                  <div key={dp.day} className="bg-gray-800 rounded-lg p-4">
                    <p className="text-white text-sm font-medium">Day {dp.day}: {dp.title}</p>
                    <p className="text-gray-400 text-xs mt-1">{dp.description}</p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {dp.options?.map((opt) => (
                        <button key={opt.id} onClick={() => setDecisions((p) => ({ ...p, [dp.day]: opt.id }))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${decisions[dp.day] === opt.id ? "bg-primary-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <button onClick={() => playMut.mutate({ decisions })} disabled={playMut.isPending}
                className="mt-4 flex items-center gap-2 px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm disabled:opacity-50">
                {playMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Run Scenario
              </button>
            </div>
          )}

          {/* Timeline Playback */}
          {playResult && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KPICard title="Overall Score" value={`${playResult.score.overall}/100`} icon={Trophy} />
                <KPICard title="Service Level" value={`${playResult.score.serviceLevel}%`} icon={CheckCircle} />
                <KPICard title="Cost Efficiency" value={`${playResult.score.costEfficiency}%`} icon={Target} />
                <KPICard title="Backorder Ctrl" value={`${playResult.score.backorderControl}%`} icon={AlertTriangle} />
              </div>

              {/* Player Controls */}
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Timeline</h3>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setCurrentDay(0)} className="p-2 bg-gray-800 rounded-lg text-gray-400 hover:text-white"><SkipBack className="w-4 h-4" /></button>
                    <button onClick={() => setCurrentDay(Math.max(0, currentDay - 1))} className="p-2 bg-gray-800 rounded-lg text-gray-400 hover:text-white"><Pause className="w-4 h-4" /></button>
                    <span className="text-white text-sm font-mono px-3">{currentDay + 1} / {timeline.length}</span>
                    <button onClick={() => setCurrentDay(Math.min(timeline.length - 1, currentDay + 1))} className="p-2 bg-gray-800 rounded-lg text-gray-400 hover:text-white"><Play className="w-4 h-4" /></button>
                    <button onClick={() => setCurrentDay(timeline.length - 1)} className="p-2 bg-gray-800 rounded-lg text-gray-400 hover:text-white"><SkipForward className="w-4 h-4" /></button>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="relative h-2 bg-gray-800 rounded-full mb-6 cursor-pointer" onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pct = (e.clientX - rect.left) / rect.width;
                  setCurrentDay(Math.round(pct * (timeline.length - 1)));
                }}>
                  <div className="absolute h-full bg-primary-600 rounded-full transition-all" style={{ width: `${((currentDay + 1) / timeline.length) * 100}%` }} />
                  {timeline.map((ev, i) => ev.type === "crisis" || ev.type === "decision_point" ? (
                    <div key={i} className={`absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full ${ev.type === "crisis" ? "bg-red-500" : "bg-yellow-500"}`}
                      style={{ left: `${(i / timeline.length) * 100}%` }} />
                  ) : null)}
                </div>

                {/* Current Event Card */}
                {currentEvent && (
                  <div className={`rounded-lg p-4 ${currentEvent.type === "crisis" ? "bg-red-900/30 border border-red-800" : currentEvent.type === "decision_point" ? "bg-yellow-900/30 border border-yellow-800" : currentEvent.type === "recovery" || currentEvent.type === "resolution" ? "bg-green-900/30 border border-green-800" : "bg-gray-800 border border-gray-700"}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${currentEvent.type === "crisis" ? "bg-red-900 text-red-300" : currentEvent.type === "decision_point" ? "bg-yellow-900 text-yellow-300" : "bg-gray-700 text-gray-300"}`}>{currentEvent.type.replace(/_/g, " ")}</span>
                      <span className="text-gray-500 text-xs">Day {currentEvent.day}</span>
                    </div>
                    <p className="text-white font-medium">{currentEvent.title}</p>
                    <p className="text-gray-400 text-sm mt-1">{currentEvent.description}</p>
                    {currentEvent.metrics && (
                      <div className="flex gap-4 mt-3 text-xs text-gray-400">
                        {Object.entries(currentEvent.metrics).map(([k, v]) => (
                          <span key={k}>{k}: <span className="text-white font-medium">{typeof v === "number" && v % 1 !== 0 ? v.toFixed(1) : v}</span></span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Metrics Chart */}
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Metrics Over Time</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={timeline.filter((_, i) => i % 2 === 0)}>
                      <XAxis dataKey="day" stroke="#6b7280" tick={{ fontSize: 11 }} />
                      <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8, color: "#fff" }} />
                      <Line type="monotone" dataKey="metrics.serviceLevel" stroke="#10b981" strokeWidth={2} name="Service Level" dot={false} />
                      <Line type="monotone" dataKey="metrics.cost" stroke="#ef4444" strokeWidth={2} name="Cost" dot={false} />
                      <Line type="monotone" dataKey="metrics.inventory" stroke="#3b82f6" strokeWidth={2} name="Inventory" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
