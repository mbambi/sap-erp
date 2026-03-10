import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { useAuthStore } from "../stores/auth";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import { FormInput, FormSelect, FormTextArea } from "../components/FormField";
import {
  GitBranch,
  Plug,
  FileText,
  Play,
  Loader2,
  Plus,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

type TabId = "architecture" | "endpoints" | "logs" | "simulator";

const EVENT_TYPES = [
  "PO_CREATED",
  "GOODS_RECEIVED",
  "INVOICE_POSTED",
  "SO_SHIPPED",
  "MATERIAL_CREATED",
  "STOCK_MOVEMENT",
  "ORDER_CONFIRMED",
];

export default function Integration() {
  const queryClient = useQueryClient();
  const { hasRole } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabId>("architecture");

  // Architecture
  const archQuery = useQuery({
    queryKey: ["integration", "architecture"],
    queryFn: () => api.get("/integration/architecture").catch(() => ({ nodes: [], description: "" })),
    enabled: activeTab === "architecture",
  });

  const arch = archQuery.data || {};
  const nodes = arch.nodes || [
    { id: "sap", name: "SAP ERP", type: "central", events: ["All events"] },
    { id: "crm", name: "CRM", type: "external", events: ["Customer sync", "Order sync"] },
    { id: "ecom", name: "E-Commerce", type: "external", events: ["Order created", "Inventory sync"] },
    { id: "iot", name: "IoT Sensors", type: "external", events: ["Telemetry", "Alerts"] },
    { id: "transport", name: "Transport", type: "external", events: ["Shipment status", "Tracking"] },
  ];

  // Endpoints (admin/instructor)
  const isAdminOrInstructor = hasRole("admin") || hasRole("instructor");
  const endpointsQuery = useQuery({
    queryKey: ["integration", "endpoints"],
    queryFn: () => api.get("/integration/endpoints").catch(() => []),
    enabled: activeTab === "endpoints" && isAdminOrInstructor,
  });

  const [showCreateEndpoint, setShowCreateEndpoint] = useState(false);
  const [endpointForm, setEndpointForm] = useState({
    name: "",
    type: "webhook" as "webhook" | "rest_api" | "message_queue" | "file_transfer",
    direction: "inbound" as "inbound" | "outbound",
    url: "",
    method: "POST",
    authType: "none",
    eventTrigger: "",
  });

  const createEndpointMutation = useMutation({
    mutationFn: (data: typeof endpointForm) => api.post("/integration/endpoints", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integration", "endpoints"] });
      setShowCreateEndpoint(false);
      setEndpointForm({ name: "", type: "webhook", direction: "inbound", url: "", method: "POST", authType: "none", eventTrigger: "" });
    },
  });

  const toggleEndpointMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.put(`/integration/endpoints/${id}`, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["integration", "endpoints"] }),
  });

  const testEndpointMutation = useMutation({
    mutationFn: (id: string) => api.post(`/integration/endpoints/${id}/test`),
  });

  const endpoints = Array.isArray(endpointsQuery.data) ? endpointsQuery.data : [];

  // Logs
  const [logsPage, setLogsPage] = useState(1);
  const [logsFilter, setLogsFilter] = useState({ status: "" as "" | "success" | "fail", eventType: "" });
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const logsQuery = useQuery({
    queryKey: ["integration", "logs", logsPage, logsFilter],
    queryFn: () =>
      api.get("/integration/logs", {
        page: logsPage,
        limit: 20,
        status: logsFilter.status || undefined,
        eventType: logsFilter.eventType || undefined,
      }),
    enabled: activeTab === "logs",
  });

  const logsData = logsQuery.data || {};
  const logs = logsData.data ?? logsData.logs ?? [];
  const logsPagination = logsData.pagination ?? { page: 1, total: 0, totalPages: 1 };

  // Simulator
  const [simEventType, setSimEventType] = useState("PO_CREATED");
  const [simPayload, setSimPayload] = useState("{}");
  const [simResponse, setSimResponse] = useState<any>(null);

  const simulateMutation = useMutation({
    mutationFn: (data: { eventType: string; payload: string }) =>
      api.post("/integration/simulate-event", {
        eventType: data.eventType,
        payload: typeof data.payload === "string" ? JSON.parse(data.payload || "{}") : data.payload,
      }),
    onSuccess: (data) => setSimResponse(data),
  });

  const tabs: { id: TabId; label: string; icon: typeof GitBranch }[] = [
    { id: "architecture", label: "Architecture", icon: GitBranch },
    { id: "endpoints", label: "Endpoints", icon: Plug },
    { id: "logs", label: "Logs", icon: FileText },
    { id: "simulator", label: "Simulator", icon: Play },
  ];

  return (
    <div>
      <PageHeader
        title="Integration"
        subtitle="Event-driven architecture, endpoints, and logs"
      />

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
        <div className="border-b border-gray-200 dark:border-gray-700 flex gap-1 p-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                activeTab === tab.id
                  ? "bg-blue-600 text-white"
                  : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Architecture Tab */}
        {activeTab === "architecture" && (
          <div className="p-6 space-y-6">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {arch.description ||
                "Event-driven architecture: SAP ERP acts as the central hub. External systems (CRM, E-Commerce, IoT, Transport) connect via webhooks or message queues. Events flow inbound and outbound based on configuration."}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-8 py-8">
              {nodes.map((node: any) => (
                <div key={node.id} className="flex flex-col items-center gap-2">
                  <div
                    className={`w-32 p-4 rounded-xl border-2 text-center ${
                      node.type === "central"
                        ? "bg-blue-50 dark:bg-blue-900/20 border-blue-500"
                        : "bg-gray-50 dark:bg-gray-700/50 border-gray-300 dark:border-gray-600"
                    }`}
                  >
                    <p className="font-semibold text-sm">{node.name}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {(node.events || []).slice(0, 2).join(", ")}
                    </p>
                  </div>
                  {node.type !== "central" && (
                    <div className="flex gap-2">
                      <span className="text-xs flex items-center gap-0.5">
                        <ArrowRight className="w-3 h-3" /> inbound
                      </span>
                      <span className="text-xs flex items-center gap-0.5">
                        <ArrowLeft className="w-3 h-3" /> outbound
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-center">
              <div className="w-40 p-4 rounded-xl border-2 bg-blue-50 dark:bg-blue-900/20 border-blue-500 text-center">
                <p className="font-semibold text-sm">SAP ERP</p>
                <p className="text-xs text-gray-500 mt-1">Central hub</p>
              </div>
            </div>
          </div>
        )}

        {/* Endpoints Tab */}
        {activeTab === "endpoints" && (
          <div className="p-6">
            {!isAdminOrInstructor ? (
              <div className="text-center py-12 text-gray-500">Access restricted to admin or instructor.</div>
            ) : (
              <>
                <div className="flex justify-end mb-4">
                  <button
                    onClick={() => setShowCreateEndpoint(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Create Endpoint
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50">
                        <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Name</th>
                        <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Type</th>
                        <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Direction</th>
                        <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">URL</th>
                        <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Event</th>
                        <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Active</th>
                        <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Last Triggered</th>
                        <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                      {endpoints.map((ep: any) => (
                        <tr key={ep.id}>
                          <td className="px-4 py-3">{ep.name}</td>
                          <td className="px-4 py-3">
                            <span className="badge badge-blue">{ep.type || "webhook"}</span>
                          </td>
                          <td className="px-4 py-3">
                            {ep.direction === "inbound" ? (
                              <ArrowRight className="w-4 h-4 text-green-500" />
                            ) : (
                              <ArrowLeft className="w-4 h-4 text-blue-500" />
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1 rounded truncate max-w-[120px] block">
                              {ep.url || "—"}
                            </code>
                          </td>
                          <td className="px-4 py-3">{ep.eventTrigger || "—"}</td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => toggleEndpointMutation.mutate({ id: ep.id, active: !ep.active })}
                              className={`relative w-10 h-6 rounded-full transition-colors ${
                                ep.active ? "bg-green-500" : "bg-gray-300"
                              }`}
                            >
                              <span
                                className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow ${
                                  ep.active ? "left-5" : "left-1"
                                }`}
                              />
                            </button>
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs">
                            {ep.lastTriggered ? new Date(ep.lastTriggered).toLocaleString() : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => testEndpointMutation.mutate(ep.id)}
                              disabled={testEndpointMutation.isPending}
                              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-2 py-1 text-xs flex items-center gap-1"
                            >
                              {testEndpointMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                              Test
                            </button>
                          </td>
                        </tr>
                      ))}
                      {endpoints.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                            No endpoints
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* Logs Tab */}
        {activeTab === "logs" && (
          <div className="p-6 space-y-4">
            <div className="flex flex-wrap gap-4">
              <select
                value={logsFilter.status}
                onChange={(e) => setLogsFilter({ ...logsFilter, status: e.target.value as "success" | "fail" | "" })}
                className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
              >
                <option value="">All statuses</option>
                <option value="success">Success</option>
                <option value="fail">Fail</option>
              </select>
              <input
                type="text"
                placeholder="Filter by event type"
                value={logsFilter.eventType}
                onChange={(e) => setLogsFilter({ ...logsFilter, eventType: e.target.value })}
                className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm w-48"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50">
                    <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Timestamp</th>
                    <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Event Type</th>
                    <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Direction</th>
                    <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Status</th>
                    <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Duration (ms)</th>
                    <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Endpoint</th>
                    <th className="px-4 py-3 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                  {logsQuery.isLoading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-400">No logs</td>
                    </tr>
                  ) : (
                    logs.map((log: any) => (
                      <React.Fragment key={log.id}>
                        <tr
                          onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                          className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                        >
                          <td className="px-4 py-3">{new Date(log.timestamp).toLocaleString()}</td>
                          <td className="px-4 py-3">{log.eventType}</td>
                          <td className="px-4 py-3">{log.direction}</td>
                          <td className="px-4 py-3">
                            {log.status === "success" ? (
                              <span className="text-green-600 flex items-center gap-1">
                                <CheckCircle2 className="w-4 h-4" /> Success
                              </span>
                            ) : (
                              <span className="text-red-600 flex items-center gap-1">
                                <XCircle className="w-4 h-4" /> Fail
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">{log.duration ?? "—"}</td>
                          <td className="px-4 py-3">{log.endpoint ?? "—"}</td>
                          <td className="px-4 py-3">
                            {expandedLog === log.id ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </td>
                        </tr>
                        {expandedLog === log.id && (
                          <tr key={`${log.id}-exp`}>
                            <td colSpan={7} className="px-4 py-4 bg-gray-50 dark:bg-gray-700/30">
                              <pre className="text-xs overflow-auto max-h-48 rounded p-2 bg-gray-100 dark:bg-gray-800">
                                {JSON.stringify(
                                  { payload: log.payload, response: log.response },
                                  null,
                                  2
                                )}
                              </pre>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {logsPagination.totalPages > 1 && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">
                  Page {logsPagination.page} of {logsPagination.totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setLogsPage((p) => Math.max(1, p - 1))}
                    disabled={logsPagination.page <= 1}
                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-3 py-1 disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setLogsPage((p) => p + 1)}
                    disabled={logsPagination.page >= logsPagination.totalPages}
                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-3 py-1 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Simulator Tab */}
        {activeTab === "simulator" && (
          <div className="p-6 space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 max-w-2xl">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Simulate Event</h3>
              <div className="space-y-4">
                <div>
                  <label className="label">Event Type</label>
                  <select
                    value={simEventType}
                    onChange={(e) => setSimEventType(e.target.value)}
                    className="input"
                  >
                    {EVENT_TYPES.map((et) => (
                      <option key={et} value={et}>{et}</option>
                    ))}
                  </select>
                </div>
                <FormTextArea
                  label="Custom Payload (JSON)"
                  value={simPayload}
                  onChange={(e) => setSimPayload(e.target.value)}
                  rows={8}
                />
                <button
                  onClick={() => simulateMutation.mutate({ eventType: simEventType, payload: simPayload })}
                  disabled={simulateMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 flex items-center gap-2 disabled:opacity-50"
                >
                  {simulateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Send
                </button>
              </div>
            </div>
            {simResponse && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Response</h3>
                <pre className="text-xs overflow-auto max-h-64 rounded p-4 bg-gray-100 dark:bg-gray-700/50">
                  {JSON.stringify(simResponse, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>

      <Modal
        isOpen={showCreateEndpoint}
        onClose={() => setShowCreateEndpoint(false)}
        title="Create Endpoint"
        size="lg"
        footer={
          <>
            <button onClick={() => setShowCreateEndpoint(false)} className="btn-secondary">
              Cancel
            </button>
            <button
              onClick={() => createEndpointMutation.mutate(endpointForm)}
              disabled={createEndpointMutation.isPending || !endpointForm.name || !endpointForm.url}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2"
            >
              Create
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <FormInput
            label="Name"
            value={endpointForm.name}
            onChange={(e) => setEndpointForm({ ...endpointForm, name: e.target.value })}
          />
          <FormSelect
            label="Type"
            value={endpointForm.type}
            onChange={(e) =>
              setEndpointForm({
                ...endpointForm,
                type: e.target.value as "webhook" | "rest_api" | "message_queue" | "file_transfer",
              })
            }
            options={[
              { value: "webhook", label: "Webhook" },
              { value: "rest_api", label: "REST API" },
              { value: "message_queue", label: "Message Queue" },
              { value: "file_transfer", label: "File Transfer" },
            ]}
          />
          <FormSelect
            label="Direction"
            value={endpointForm.direction}
            onChange={(e) =>
              setEndpointForm({ ...endpointForm, direction: e.target.value as "inbound" | "outbound" })
            }
            options={[
              { value: "inbound", label: "Inbound" },
              { value: "outbound", label: "Outbound" },
            ]}
          />
          <FormInput
            label="URL"
            value={endpointForm.url}
            onChange={(e) => setEndpointForm({ ...endpointForm, url: e.target.value })}
          />
          <FormSelect
            label="Method"
            value={endpointForm.method}
            onChange={(e) => setEndpointForm({ ...endpointForm, method: e.target.value })}
            options={[
              { value: "GET", label: "GET" },
              { value: "POST", label: "POST" },
              { value: "PUT", label: "PUT" },
            ]}
          />
          <FormSelect
            label="Auth Type"
            value={endpointForm.authType}
            onChange={(e) => setEndpointForm({ ...endpointForm, authType: e.target.value })}
            options={[
              { value: "none", label: "None" },
              { value: "bearer", label: "Bearer" },
              { value: "basic", label: "Basic" },
            ]}
          />
          <FormSelect
            label="Event Trigger"
            value={endpointForm.eventTrigger}
            onChange={(e) => setEndpointForm({ ...endpointForm, eventTrigger: e.target.value })}
            options={[{ value: "", label: "Select..." }, ...EVENT_TYPES.map((et) => ({ value: et, label: et }))]}
          />
        </div>
      </Modal>
    </div>
  );
}
