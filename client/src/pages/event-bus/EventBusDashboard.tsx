import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import PageHeader from "../../components/PageHeader";
import { Zap, Send, BarChart3, Play, RefreshCw } from "lucide-react";

const FLOW_TYPES = [
  { id: "procure-to-pay", label: "Procure to Pay (P2P)" },
  { id: "order-to-cash", label: "Order to Cash (O2C)" },
  { id: "plan-to-produce", label: "Plan to Produce" },
];

export default function EventBusDashboard() {
  const queryClient = useQueryClient();
  const [selectedFlow, setSelectedFlow] = useState("procure-to-pay");

  const { data: stats } = useQuery({
    queryKey: ["event-bus-stats"],
    queryFn: () => api.get("/event-bus/stats"),
  });

  const { data: subscriptions } = useQuery({
    queryKey: ["event-bus-subscriptions"],
    queryFn: () => api.get("/event-bus/subscriptions"),
  });

  const { data: recent, refetch: refetchRecent } = useQuery({
    queryKey: ["event-bus-recent"],
    queryFn: () => api.get("/event-bus/recent", { limit: 30 }),
    refetchInterval: 5000,
  });

  const { data: eventTypes } = useQuery({
    queryKey: ["event-bus-types"],
    queryFn: () => api.get("/event-bus/event-types"),
  });

  const simulateMutation = useMutation({
    mutationFn: (flow: string) => api.post("/event-bus/simulate-flow", { flow }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-bus-stats"] });
      queryClient.invalidateQueries({ queryKey: ["event-bus-recent"] });
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Event Bus Dashboard"
        subtitle="Monitor and simulate event-driven ERP architecture"
        icon={Zap}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats && Object.entries(stats.eventCounts ?? {}).slice(0, 4).map(([type, count]) => (
          <div key={type} className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
            <p className="text-xs text-gray-500 uppercase truncate">{type.replaceAll(".", " ")}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{count as number}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Simulate a flow */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Play className="w-4 h-4" /> Simulate Flow
          </h3>
          <div className="space-y-3">
            {FLOW_TYPES.map((f) => (
              <button
                key={f.id}
                onClick={() => { setSelectedFlow(f.id); simulateMutation.mutate(f.id); }}
                disabled={simulateMutation.isPending}
                className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                  selectedFlow === f.id
                    ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20"
                    : "border-gray-200 dark:border-gray-700 hover:border-primary-300"
                }`}
              >
                <span className="font-medium text-gray-900 dark:text-white">{f.label}</span>
              </button>
            ))}
            {simulateMutation.isSuccess && (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-sm text-green-700 dark:text-green-400">
                Flow simulated! {(simulateMutation.data as any)?.events?.length || 0} events generated.
              </div>
            )}
          </div>
        </div>

        {/* Subscriptions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Send className="w-4 h-4" /> Active Subscriptions
          </h3>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {subscriptions?.map((s: any, i: number) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded text-sm">
                <span className="font-mono text-xs text-gray-600 dark:text-gray-400 truncate flex-1">{s.event}</span>
                <span className="ml-2 px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded text-xs">{s.handler}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Event Types */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" /> Event Types
          </h3>
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {eventTypes?.map((type: string) => (
              <div key={type} className="px-3 py-1.5 text-xs font-mono text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded">
                {type}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Events */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-white">Recent Events</h3>
          <button onClick={() => refetchRecent()} className="text-gray-400 hover:text-gray-600">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Type</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Source</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {recent?.map((e: any) => (
                <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-4 py-2 font-mono text-xs">{e.type ?? e.eventType}</td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{e.source ?? "—"}</td>
                  <td className="px-4 py-2 text-gray-400 text-xs">{new Date(e.timestamp ?? e.createdAt).toLocaleTimeString()}</td>
                </tr>
              ))}
              {(!recent || recent.length === 0) && (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400">No events yet. Simulate a flow to generate events.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
