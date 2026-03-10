import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { api } from "../../api/client";
import PageHeader from "../../components/PageHeader";
import Modal from "../../components/Modal";
import { FormInput, FormSelect } from "../../components/FormField";
import { Clock, Camera, GitCompare, History, ChevronDown, ChevronRight, Loader2 } from "lucide-react";

interface TimeMachineEvent {
  id: string;
  eventType: string;
  entity: string;
  entityId?: string;
  description: string;
  timestamp: string;
  payload?: Record<string, unknown>;
}

interface SnapshotState {
  materials?: Record<string, unknown>[];
  purchaseOrders?: Record<string, unknown>[];
  salesOrders?: Record<string, unknown>[];
  inventory?: Record<string, unknown>[];
}

interface DiffResult {
  added: { entity: string; id: string; data?: Record<string, unknown> }[];
  modified: { entity: string; id: string; changes?: Record<string, unknown> }[];
  removed: { entity: string; id: string }[];
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  created: "bg-emerald-100 text-emerald-800",
  updated: "bg-amber-100 text-amber-800",
  deleted: "bg-red-100 text-red-800",
  posted: "bg-blue-100 text-blue-800",
  confirmed: "bg-purple-100 text-purple-800",
  default: "bg-gray-100 text-gray-700",
};

export default function TimeMachine() {
  const queryClient = useQueryClient();
  const [selectedDay, setSelectedDay] = useState(1);
  const [totalDays, setTotalDays] = useState(30);
  const [compareDay1, setCompareDay1] = useState(1);
  const [compareDay2, setCompareDay2] = useState(2);
  const [entityType, setEntityType] = useState("material");
  const [entityId, setEntityId] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<TimeMachineEvent | null>(null);
  const [snapshot, setSnapshot] = useState<SnapshotState | null>(null);
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
  const [showCompare, setShowCompare] = useState(false);

  const dayEventsQuery = useQuery({
    queryKey: ["time-machine-day", selectedDay],
    queryFn: () => api.get<{ events: TimeMachineEvent[] }>(`/time-machine/day/${selectedDay}`),
  });

  const snapshotMutation = useMutation({
    mutationFn: () => api.post<SnapshotState>(`/time-machine/snapshot/${selectedDay}`),
    onSuccess: (data) => setSnapshot(data),
  });

  const diffQuery = useQuery({
    queryKey: ["time-machine-diff", compareDay1, compareDay2],
    queryFn: () => api.get<DiffResult>(`/time-machine/diff/${compareDay1}/${compareDay2}`),
    enabled: showCompare,
  });

  useEffect(() => {
    if (diffQuery.data) setDiffResult(diffQuery.data);
  }, [diffQuery.data]);

  const events = dayEventsQuery.data?.events ?? [];
  const eventTypes = [...new Set(events.map((e) => e.eventType))];
  const eventsByType = eventTypes.map((t) => ({
    type: t,
    count: events.filter((e) => e.eventType === t).length,
  }));
  const eventsByDay = Array.from({ length: totalDays }, (_, i) => ({
    day: i + 1,
    count: 0,
  }));

  return (
    <div>
      <PageHeader
        title="ERP Time Machine"
        subtitle="Rewind and replay your ERP decisions"
      />

      {/* Timeline visualization */}
      <div className="card p-6 mb-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Simulation Timeline</h3>
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1">
            <input
              type="range"
              min={1}
              max={totalDays}
              value={selectedDay}
              onChange={(e) => setSelectedDay(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
            />
          </div>
          <span className="text-sm font-medium text-gray-700 min-w-[80px]">
            Day {selectedDay} of {totalDays}
          </span>
        </div>
        <div className="flex gap-1 overflow-x-auto pb-2">
          {Array.from({ length: totalDays }, (_, i) => {
            const day = i + 1;
            const dayEventCount = day === selectedDay ? events.length : Math.floor(Math.random() * 8) + 1;
            const isSelected = day === selectedDay;
            return (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={`flex flex-col items-center min-w-[36px] p-2 rounded-lg transition-colors ${
                  isSelected ? "bg-primary-600 text-white" : "hover:bg-gray-100"
                }`}
              >
                <span className="text-xs font-medium">{day}</span>
                <div className="flex gap-0.5 mt-1">
                  {Array.from({ length: Math.min(dayEventCount, 5) }, (_, j) => (
                    <div
                      key={j}
                      className={`w-1 h-1 rounded-full ${isSelected ? "bg-white" : "bg-gray-400"}`}
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Selected day panel */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Events for Day {selectedDay}</h3>
              <button
                onClick={() => snapshotMutation.mutate()}
                disabled={snapshotMutation.isPending}
                className="btn-primary btn-sm"
              >
                {snapshotMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}{" "}
                Snapshot
              </button>
            </div>
            <div className="p-4 max-h-80 overflow-y-auto space-y-2">
              {dayEventsQuery.isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                </div>
              ) : events.length === 0 ? (
                <p className="text-center py-8 text-gray-500">No events for this day</p>
              ) : (
                events.map((evt) => (
                  <div
                    key={evt.id}
                    onClick={() => setSelectedEvent(evt)}
                    className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          EVENT_TYPE_COLORS[evt.eventType] ?? EVENT_TYPE_COLORS.default
                        }`}
                      >
                        {evt.eventType}
                      </span>
                      <span className="text-sm font-medium">{evt.entity}</span>
                      {evt.entityId && (
                        <span className="text-xs text-gray-500">{evt.entityId}</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{evt.description}</p>
                    <p className="text-xs text-gray-400 mt-1">{evt.timestamp}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {snapshot && (
            <div className="card">
              <h3 className="p-4 border-b text-sm font-semibold text-gray-900">State Reconstruction</h3>
              <div className="p-4 space-y-2">
                {Object.entries(snapshot).map(([key, value]) => (
                  <CollapsibleSection key={key} title={key} data={Array.isArray(value) ? value : [value]} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Compare & Entity History */}
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <GitCompare className="w-4 h-4" /> Compare Days
            </h3>
            <div className="space-y-3">
              <FormInput
                label="Day 1"
                type="number"
                value={String(compareDay1)}
                onChange={(e) => setCompareDay1(Number(e.target.value) || 1)}
              />
              <FormInput
                label="Day 2"
                type="number"
                value={String(compareDay2)}
                onChange={(e) => setCompareDay2(Number(e.target.value) || 2)}
              />
              <button
                onClick={() => {
                  setShowCompare(true);
                  queryClient.invalidateQueries({ queryKey: ["time-machine-diff", compareDay1, compareDay2] });
                }}
                className="btn-primary w-full"
              >
                Compare
              </button>
            </div>
          </div>

          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <History className="w-4 h-4" /> Entity History
            </h3>
            <div className="space-y-3">
              <FormSelect
                label="Entity Type"
                value={entityType}
                onChange={(e) => setEntityType(e.target.value)}
                options={[
                  { value: "material", label: "Material" },
                  { value: "purchase_order", label: "Purchase Order" },
                  { value: "sales_order", label: "Sales Order" },
                ]}
              />
              <FormInput
                label="Entity ID"
                value={entityId}
                onChange={(e) => setEntityId(e.target.value)}
                placeholder="Enter ID"
              />
              <button className="btn-secondary w-full">View Timeline</button>
            </div>
          </div>
        </div>
      </div>

      {/* Compare result */}
      {showCompare && diffResult && (
        <div className="card p-6 mt-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            Diff: Day {compareDay1} vs Day {compareDay2}
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200">
              <h4 className="text-xs font-semibold text-emerald-800 mb-2">Added (green)</h4>
              <ul className="space-y-1 text-sm">
                {diffResult.added?.slice(0, 5).map((a, i) => (
                  <li key={i}>{a.entity} #{a.id}</li>
                ))}
                {(!diffResult.added || diffResult.added.length === 0) && (
                  <li className="text-gray-500">None</li>
                )}
              </ul>
            </div>
            <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
              <h4 className="text-xs font-semibold text-amber-800 mb-2">Modified (yellow)</h4>
              <ul className="space-y-1 text-sm">
                {diffResult.modified?.slice(0, 5).map((m, i) => (
                  <li key={i}>{m.entity} #{m.id}</li>
                ))}
                {(!diffResult.modified || diffResult.modified.length === 0) && (
                  <li className="text-gray-500">None</li>
                )}
              </ul>
            </div>
            <div className="p-4 rounded-lg bg-red-50 border border-red-200">
              <h4 className="text-xs font-semibold text-red-800 mb-2">Removed (red)</h4>
              <ul className="space-y-1 text-sm">
                {diffResult.removed?.slice(0, 5).map((r, i) => (
                  <li key={i}>{r.entity} #{r.id}</li>
                ))}
                {(!diffResult.removed || diffResult.removed.length === 0) && (
                  <li className="text-gray-500">None</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Statistics panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className="card p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Events by Type</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={eventsByType}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="type" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#2563eb" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Events by Day</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={eventsByDay}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Event payload modal */}
      <Modal
        isOpen={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        title="Event Details"
        size="lg"
      >
        {selectedEvent && (
          <div>
            <div className="space-y-2 mb-4">
              <p><strong>Type:</strong> {selectedEvent.eventType}</p>
              <p><strong>Entity:</strong> {selectedEvent.entity}</p>
              <p><strong>Description:</strong> {selectedEvent.description}</p>
              <p><strong>Timestamp:</strong> {selectedEvent.timestamp}</p>
            </div>
            {selectedEvent.payload && (
              <pre className="p-4 bg-gray-50 rounded-lg text-xs overflow-auto max-h-64">
                {JSON.stringify(selectedEvent.payload, null, 2)}
              </pre>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function CollapsibleSection({
  title,
  data,
}: {
  title: string;
  data: Record<string, unknown>[];
}) {
  const [open, setOpen] = useState(false);
  const label = title.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
  return (
    <div className="border rounded-lg">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50"
      >
        <span className="font-medium text-sm">{label}</span>
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>
      {open && (
        <div className="p-3 border-t bg-gray-50/50 max-h-48 overflow-y-auto">
          {data.length === 0 ? (
            <p className="text-sm text-gray-500">No records</p>
          ) : (
            <pre className="text-xs">{JSON.stringify(data.slice(0, 10), null, 2)}</pre>
          )}
        </div>
      )}
    </div>
  );
}
