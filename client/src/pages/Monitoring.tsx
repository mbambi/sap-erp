import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Database,
  Clock,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  Users,
  Zap,
  Server,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
} from "recharts";
import { api } from "../api/client";
import PageHeader from "../components/PageHeader";
import { useAuthStore } from "../stores/auth";

interface HealthResponse {
  status: string;
  database: string;
  uptime: number;
  version: string;
  timestamp: string;
}

interface DashboardResponse {
  apiResponseTimes: { avg: number; p95: number; p99: number };
  totalRequestsToday: number;
  errorRate: number;
  activeUsers: number;
  dbQueryStats?: { avg: number; count: number };
}

interface UsageResponse {
  userCount: number;
  transactionCounts: { purchaseOrders: number; salesOrders: number; journalEntries: number };
  materialCount: number;
  storageUsed: number;
}

interface SystemMetric {
  id: string;
  metricType: string;
  endpoint?: string | null;
  value: number;
  unit?: string | null;
  timestamp: string;
}

export default function Monitoring() {
  const { hasRole } = useAuthStore();
  const isAdmin = hasRole("admin");
  const isAdminOrInstructor = hasRole("admin") || hasRole("instructor");

  const [metricTypeFilter, setMetricTypeFilter] = useState<string>("");
  const [dateRange, setDateRange] = useState({ from: "", to: "" });

  const { data: health, isLoading: healthLoading } = useQuery({
    queryKey: ["monitoring", "health"],
    queryFn: () => api.get<HealthResponse>("/monitoring/health"),
  });

  const { data: dashboard } = useQuery({
    queryKey: ["monitoring", "dashboard"],
    queryFn: () => api.get<DashboardResponse>("/monitoring/dashboard"),
    enabled: isAdmin,
  });

  const { data: usage } = useQuery({
    queryKey: ["monitoring", "usage"],
    queryFn: () => api.get<UsageResponse>("/monitoring/usage"),
    enabled: isAdminOrInstructor,
  });

  const { data: metricsRes } = useQuery({
    queryKey: ["monitoring", "metrics", metricTypeFilter],
    queryFn: () =>
      api.get<{ data: SystemMetric[] }>("/monitoring/metrics", {
        ...(metricTypeFilter && { type: metricTypeFilter }),
        limit: 200,
      }),
    enabled: isAdminOrInstructor,
  });
  const metrics = metricsRes?.data ?? [];

  if (!isAdminOrInstructor) {
    return (
      <div className="p-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
          <AlertTriangle className="w-8 h-8 text-red-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
        <p className="text-gray-600">Monitoring is for administrators and instructors only.</p>
      </div>
    );
  }

  const isHealthy = health?.status === "ok" && health?.database === "connected";

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Monitoring"
        subtitle="Health, metrics, and usage statistics"
      />

      {/* Dark-themed monitoring aesthetic */}
      <div className="bg-gray-900 rounded-xl border border-gray-700 p-6 text-gray-100">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-emerald-400" />
          Health Status
        </h2>
        <div className="flex items-center gap-6">
          <div
            className={`flex items-center gap-3 px-6 py-4 rounded-lg ${
              isHealthy ? "bg-emerald-900/30 border border-emerald-700" : "bg-red-900/30 border border-red-700"
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full ${
                isHealthy ? "bg-emerald-500 animate-pulse" : "bg-red-500"
              }`}
            />
            <span className="text-xl font-bold">
              {healthLoading ? "Checking..." : isHealthy ? "HEALTHY" : "UNHEALTHY"}
            </span>
          </div>
          {health && (
            <div className="flex gap-6 text-sm">
              <span className="flex items-center gap-1.5">
                <Database className="w-4 h-4 text-gray-400" />
                DB: {health.database}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-gray-400" />
                Uptime: {Math.floor(health.uptime / 60)}m
              </span>
              <span className="text-gray-400">v{health.version}</span>
            </div>
          )}
        </div>
      </div>

      {/* System Dashboard - Admin only */}
      {isAdmin && dashboard && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Server className="w-5 h-5" />
            System Dashboard
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gray-900 rounded-xl border border-gray-700 p-5">
              <p className="text-sm text-gray-400">Avg API Response Time</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">
                {dashboard.apiResponseTimes?.avg?.toFixed(1) ?? 0} ms
              </p>
            </div>
            <div className="bg-gray-900 rounded-xl border border-gray-700 p-5">
              <p className="text-sm text-gray-400">Total Requests Today</p>
              <p className="text-2xl font-bold text-blue-400 mt-1">
                {dashboard.totalRequestsToday ?? 0}
              </p>
            </div>
            <div className="bg-gray-900 rounded-xl border border-gray-700 p-5">
              <p className="text-sm text-gray-400">Error Rate</p>
              <p className={`text-2xl font-bold mt-1 ${
                (dashboard.errorRate ?? 0) > 5 ? "text-red-400" : (dashboard.errorRate ?? 0) > 1 ? "text-amber-400" : "text-emerald-400"
              }`}>
                {(dashboard.errorRate ?? 0).toFixed(2)}%
              </p>
            </div>
            <div className="bg-gray-900 rounded-xl border border-gray-700 p-5">
              <p className="text-sm text-gray-400">Active Users</p>
              <p className="text-2xl font-bold text-purple-400 mt-1">
                {dashboard.activeUsers ?? 0}
              </p>
            </div>
          </div>

          {/* API response time chart - if we have metrics */}
          {metrics.filter((m) => m.metricType === "api_response_time").length > 0 && (
            <div className="bg-gray-900 rounded-xl border border-gray-700 p-5">
              <h3 className="text-sm font-medium text-gray-300 mb-4">API Response Time (24h)</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart
                  data={metrics
                    .filter((m) => m.metricType === "api_response_time")
                    .slice(0, 50)
                    .reverse()
                    .map((m) => ({
                      time: new Date(m.timestamp).toLocaleTimeString(),
                      value: m.value,
                    }))}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="time" stroke="#9ca3af" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#9ca3af" tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151" }}
                    labelStyle={{ color: "#9ca3af" }}
                  />
                  <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Usage Statistics */}
      {usage && (
        <div className="bg-gray-900 rounded-xl border border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-amber-400" />
            Usage Statistics
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <p className="text-xs text-gray-400">Users</p>
              <p className="text-xl font-bold text-blue-400">{usage.userCount ?? 0}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <p className="text-xs text-gray-400">Purchase Orders</p>
              <p className="text-xl font-bold text-emerald-400">
                {usage.transactionCounts?.purchaseOrders ?? 0}
              </p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <p className="text-xs text-gray-400">Sales Orders</p>
              <p className="text-xl font-bold text-purple-400">
                {usage.transactionCounts?.salesOrders ?? 0}
              </p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <p className="text-xs text-gray-400">Materials</p>
              <p className="text-xl font-bold text-amber-400">{usage.materialCount ?? 0}</p>
            </div>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  { name: "Users", value: usage.userCount ?? 0, fill: "#3b82f6" },
                  { name: "POs", value: usage.transactionCounts?.purchaseOrders ?? 0, fill: "#10b981" },
                  { name: "SOs", value: usage.transactionCounts?.salesOrders ?? 0, fill: "#8b5cf6" },
                  { name: "JEs", value: usage.transactionCounts?.journalEntries ?? 0, fill: "#f59e0b" },
                  { name: "Materials", value: usage.materialCount ?? 0, fill: "#ef4444" },
                ]}
              >
                <XAxis dataKey="name" stroke="#9ca3af" tick={{ fontSize: 11 }} />
                <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151" }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Metrics Explorer - Admin/Instructor */}
      {isAdminOrInstructor && (
        <div className="bg-gray-900 rounded-xl border border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            Metrics Explorer
          </h2>
          <div className="flex flex-wrap gap-4 mb-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Metric Type</label>
              <select
                className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-gray-200 text-sm"
                value={metricTypeFilter}
                onChange={(e) => setMetricTypeFilter(e.target.value)}
              >
                <option value="">All</option>
                <option value="api_response_time">API Response Time</option>
                <option value="db_query_time">DB Query Time</option>
                <option value="active_users">Active Users</option>
                <option value="error_rate">Error Rate</option>
                <option value="memory_usage">Memory Usage</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Date From</label>
              <input
                type="date"
                className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-gray-200 text-sm"
                value={dateRange.from}
                onChange={(e) => setDateRange((r) => ({ ...r, from: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Date To</label>
              <input
                type="date"
                className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-gray-200 text-sm"
                value={dateRange.to}
                onChange={(e) => setDateRange((r) => ({ ...r, to: e.target.value }))}
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="py-3 font-medium text-gray-400">Timestamp</th>
                  <th className="py-3 font-medium text-gray-400">Type</th>
                  <th className="py-3 font-medium text-gray-400">Endpoint</th>
                  <th className="py-3 font-medium text-gray-400">Value</th>
                  <th className="py-3 font-medium text-gray-400">Unit</th>
                </tr>
              </thead>
              <tbody>
                {metrics.slice(0, 50).map((m) => (
                  <tr key={m.id} className="border-b border-gray-800">
                    <td className="py-2 text-gray-300">
                      {new Date(m.timestamp).toLocaleString()}
                    </td>
                    <td className="py-2 text-gray-300">{m.metricType}</td>
                    <td className="py-2 text-gray-400">{m.endpoint || "—"}</td>
                    <td className="py-2 font-mono text-emerald-400">{m.value}</td>
                    <td className="py-2 text-gray-400">{m.unit || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {metrics.length > 0 && (
            <div className="mt-6 h-48">
              <h3 className="text-sm text-gray-400 mb-2">Visualization</h3>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={metrics
                    .slice(0, 100)
                    .reverse()
                    .map((m) => ({
                      time: new Date(m.timestamp).toLocaleTimeString(),
                      value: m.value,
                    }))}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="time" stroke="#9ca3af" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#9ca3af" tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151" }}
                  />
                  <Line type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
