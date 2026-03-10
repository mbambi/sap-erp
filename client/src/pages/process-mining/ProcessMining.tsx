import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { api } from "../../api/client";
import PageHeader from "../../components/PageHeader";
import DataTable from "../../components/DataTable";
import Modal from "../../components/Modal";
import KPICard from "../../components/KPICard";
import { FormInput, FormSelect } from "../../components/FormField";
import { Plus, Loader2, GitBranch, List, BarChart3 } from "lucide-react";

type TabId = "process-map" | "cases" | "statistics";

interface ProcessMapData {
  activities: string[];
  transitions: { from: string; to: string; count: number; avgDuration: number }[];
}

interface CaseData {
  caseId: string;
  eventCount: number;
  firstEvent: string;
  lastEvent: string;
  duration: number;
}

interface ProcessEvent {
  id: string;
  caseId: string;
  activity: string;
  module: string;
  timestamp: string;
  duration?: number;
}

interface StatisticsData {
  avgCaseDuration: number;
  mostCommonPath: { path: string; count: number } | null;
  bottleneckActivities: { activity: string; avgDuration: number }[];
}

const MODULE_OPTIONS = [
  { value: "finance", label: "Finance" },
  { value: "materials", label: "Materials" },
  { value: "sales", label: "Sales" },
  { value: "production", label: "Production" },
  { value: "mrp", label: "MRP" },
  { value: "quality", label: "Quality" },
];

export default function ProcessMining() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>("process-map");
  const [selectedCase, setSelectedCase] = useState<CaseData | null>(null);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [eventForm, setEventForm] = useState({
    caseId: "",
    activity: "",
    module: "",
    documentId: "",
  });

  const processMapQuery = useQuery({
    queryKey: ["process-map"],
    queryFn: () => api.get<ProcessMapData>("/process-mining/process-map"),
    enabled: activeTab === "process-map",
  });

  const casesQuery = useQuery({
    queryKey: ["process-cases"],
    queryFn: () => api.get<CaseData[]>("/process-mining/cases"),
    enabled: activeTab === "cases",
  });

  const caseEventsQuery = useQuery({
    queryKey: ["case-events", selectedCase?.caseId],
    queryFn: () => api.get<ProcessEvent[]>(`/process-mining/cases/${selectedCase!.caseId}`),
    enabled: !!selectedCase,
  });

  const statisticsQuery = useQuery({
    queryKey: ["process-statistics"],
    queryFn: () => api.get<StatisticsData>("/process-mining/statistics"),
    enabled: activeTab === "statistics",
  });

  const recordEventMutation = useMutation({
    mutationFn: (data: typeof eventForm) =>
      api.post("/process-mining/events", {
        caseId: data.caseId,
        activity: data.activity,
        module: data.module,
        documentId: data.documentId || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["process-map"] });
      queryClient.invalidateQueries({ queryKey: ["process-cases"] });
      queryClient.invalidateQueries({ queryKey: ["process-statistics"] });
      setShowRecordModal(false);
      setEventForm({ caseId: "", activity: "", module: "", documentId: "" });
    },
  });

  const processMap = processMapQuery.data;
  const cases = casesQuery.data ?? [];
  const caseEvents = caseEventsQuery.data ?? [];
  const stats = statisticsQuery.data;

  const activityFreqMap = new Map<string, number>();
  if (processMap) {
    for (const t of processMap.transitions) {
      activityFreqMap.set(t.from, (activityFreqMap.get(t.from) ?? 0) + t.count);
      activityFreqMap.set(t.to, (activityFreqMap.get(t.to) ?? 0) + t.count);
    }
  }
  const maxFreq = Math.max(...activityFreqMap.values(), 1);

  const activityAvgDuration = new Map<string, number>();
  if (processMap) {
    for (const t of processMap.transitions) {
      const existing = activityAvgDuration.get(t.to);
      if (existing === undefined) activityAvgDuration.set(t.to, t.avgDuration);
      else activityAvgDuration.set(t.to, (existing + t.avgDuration) / 2);
    }
  }

  const handleRecordEvent = () => {
    if (!eventForm.caseId || !eventForm.activity || !eventForm.module) return;
    recordEventMutation.mutate(eventForm);
  };

  return (
    <div>
      <PageHeader
        title="Process Mining & Analytics"
        subtitle="Visualize and analyze business process flows"
      >
        <button onClick={() => setShowRecordModal(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> Record Event
        </button>
      </PageHeader>

      <div className="card">
        <div className="border-b flex gap-1 p-2">
          {(["process-map", "cases", "statistics"] as TabId[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                activeTab === tab ? "bg-primary-600 text-white" : "hover:bg-gray-100 text-gray-600"
              }`}
            >
              {tab === "process-map" && <GitBranch className="w-4 h-4" />}
              {tab === "cases" && <List className="w-4 h-4" />}
              {tab === "statistics" && <BarChart3 className="w-4 h-4" />}
              {tab === "process-map" && "Process Map"}
              {tab === "cases" && "Cases"}
              {tab === "statistics" && "Statistics"}
            </button>
          ))}
        </div>

        {activeTab === "process-map" && (
          <div className="p-6">
            {processMapQuery.isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
              </div>
            ) : processMap && (processMap.activities.length > 0 || processMap.transitions.length > 0) ? (
              <div className="overflow-x-auto min-h-[400px]">
                <svg width="100%" height={Math.max(400, processMap.activities.length * 80)} viewBox={`0 0 800 ${Math.max(400, processMap.activities.length * 80)}`}>
                  <defs>
                    <marker id="arrow-pm" markerWidth={10} markerHeight={10} refX={9} refY={3} orient="auto">
                      <path d="M0,0 L0,6 L9,3 z" fill="#64748b" />
                    </marker>
                  </defs>
                  {processMap.activities.map((act, i) => {
                    const x = 100 + (i % 4) * 180;
                    const y = 80 + Math.floor(i / 4) * 120;
                    const freq = activityFreqMap.get(act) ?? 0;
                    const intensity = maxFreq > 0 ? Math.min(1, 0.3 + (freq / maxFreq) * 0.7) : 0.5;
                    const avgDur = activityAvgDuration.get(act) ?? 0;
                    return (
                      <g key={act}>
                        <rect
                          x={x}
                          y={y}
                          width={140}
                          height={50}
                          rx={10}
                          fill={`rgba(59, 130, 246, ${intensity})`}
                          stroke="#1d4ed8"
                          strokeWidth={1}
                        />
                        <text x={x + 70} y={y + 28} textAnchor="middle" fontSize={11} fill="white" fontWeight="600">
                          {act}
                        </text>
                        {avgDur > 0 && (
                          <text x={x + 70} y={y + 45} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.9)">
                            avg {avgDur.toFixed(1)}s
                          </text>
                        )}
                      </g>
                    );
                  })}
                  {processMap.transitions.map((t, i) => {
                    const fromIdx = processMap.activities.indexOf(t.from);
                    const toIdx = processMap.activities.indexOf(t.to);
                    if (fromIdx < 0 || toIdx < 0) return null;
                    const x1 = 100 + (fromIdx % 4) * 180 + 140;
                    const y1 = 80 + Math.floor(fromIdx / 4) * 120 + 25;
                    const x2 = 100 + (toIdx % 4) * 180;
                    const y2 = 80 + Math.floor(toIdx / 4) * 120 + 25;
                    const midX = (x1 + x2) / 2;
                    const midY = (y1 + y2) / 2;
                    return (
                      <g key={`${t.from}-${t.to}-${i}`}>
                        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#64748b" strokeWidth={2} markerEnd="url(#arrow-pm)" />
                        <text x={midX} y={midY - 5} textAnchor="middle" fontSize={10} fill="#475569">
                          {t.count}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            ) : (
              <p className="text-center py-20 text-gray-500">No process data yet. Record events to build the process map.</p>
            )}
          </div>
        )}

        {activeTab === "cases" && (
          <div className="p-4">
            <DataTable<CaseData>
              columns={[
                { key: "caseId", label: "Case ID", render: (r) => <span className="font-mono font-medium">{r.caseId}</span> },
                { key: "eventCount", label: "Event Count" },
                {
                  key: "firstEvent",
                  label: "Start Time",
                  render: (r) => new Date(r.firstEvent).toLocaleString(),
                },
                {
                  key: "lastEvent",
                  label: "End Time",
                  render: (r) => new Date(r.lastEvent).toLocaleString(),
                },
                {
                  key: "duration",
                  label: "Total Duration",
                  render: (r) => `${(r.duration / 60).toFixed(1)} min`,
                },
              ]}
              data={cases}
              isLoading={casesQuery.isLoading}
              onRowClick={(row) => setSelectedCase(row)}
            />
          </div>
        )}

        {activeTab === "statistics" && (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <KPICard
                title="Avg Case Duration"
                value={stats ? `${(stats.avgCaseDuration / 60).toFixed(1)} min` : "-"}
                color="blue"
              />
              <KPICard
                title="Total Cases"
                value={cases.length}
                color="green"
              />
              <KPICard
                title="Most Common Path"
                value={stats?.mostCommonPath ? stats.mostCommonPath.path.split(" → ").slice(0, 2).join(" → ") + "..." : "-"}
                subtitle={stats?.mostCommonPath ? `${stats.mostCommonPath.count} cases` : undefined}
                color="purple"
              />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Activity Frequency</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart
                    data={
                      processMap?.activities.map((a) => ({
                        name: a,
                        count: activityFreqMap.get(a) ?? 0,
                      })) ?? []
                    }
                  >
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Bottleneck Activities (Highest Avg Duration)</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart
                    data={stats?.bottleneckActivities ?? []}
                    layout="vertical"
                    margin={{ left: 80 }}
                  >
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="activity" type="category" tick={{ fontSize: 11 }} width={70} />
                    <Tooltip formatter={(v: number) => `${v.toFixed(1)}s`} />
                    <Bar dataKey="avgDuration" fill="#ef4444" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>

      <Modal
        isOpen={!!selectedCase}
        onClose={() => setSelectedCase(null)}
        title={selectedCase ? `Case: ${selectedCase.caseId}` : ""}
        size="lg"
        footer={<button onClick={() => setSelectedCase(null)} className="btn-primary">Close</button>}
      >
        {selectedCase && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              {selectedCase.eventCount} events • Duration: {(selectedCase.duration / 60).toFixed(1)} min
            </p>
            <div className="relative pl-6 border-l-2 border-primary-200">
              {caseEventsQuery.isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                caseEvents.map((evt, i) => (
                  <div key={evt.id} className="relative pb-6 last:pb-0">
                    <div className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-primary-600 border-2 border-white" />
                    <div className="ml-2">
                      <p className="font-medium text-gray-900">{evt.activity}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(evt.timestamp).toLocaleString()} • {evt.module}
                        {evt.duration != null && ` • ${evt.duration}s`}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={showRecordModal}
        onClose={() => setShowRecordModal(false)}
        title="Record Event"
        footer={
          <>
            <button onClick={() => setShowRecordModal(false)} className="btn-secondary">Cancel</button>
            <button
              onClick={handleRecordEvent}
              disabled={recordEventMutation.isPending || !eventForm.caseId || !eventForm.activity || !eventForm.module}
              className="btn-primary"
            >
              {recordEventMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Record
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <FormInput
            label="Case ID"
            value={eventForm.caseId}
            onChange={(e) => setEventForm({ ...eventForm, caseId: e.target.value })}
            placeholder="e.g. CASE-001"
          />
          <FormInput
            label="Activity"
            value={eventForm.activity}
            onChange={(e) => setEventForm({ ...eventForm, activity: e.target.value })}
            placeholder="e.g. Create PO"
          />
          <FormSelect
            label="Module"
            value={eventForm.module}
            onChange={(e) => setEventForm({ ...eventForm, module: e.target.value })}
            options={MODULE_OPTIONS}
          />
          <FormInput
            label="Document ID (optional)"
            value={eventForm.documentId}
            onChange={(e) => setEventForm({ ...eventForm, documentId: e.target.value })}
            placeholder="e.g. PO-0000123"
          />
        </div>
      </Modal>
    </div>
  );
}
