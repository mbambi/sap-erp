import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuthStore } from "../stores/auth";
import PageHeader from "../components/PageHeader";
import {
  Play,
  BookOpen,
  Award,
  AlertTriangle,
  Users,
  Activity,
  Zap,
  BarChart3,
  FileText,
  Settings,
} from "lucide-react";

const CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

export default function RoleDashboards() {
  const { user, hasRole } = useAuthStore();

  const isStudent = hasRole("student") || (!hasRole("admin") && !hasRole("instructor"));
  const isInstructor = hasRole("instructor");
  const isAdmin = hasRole("admin");

  // Student data
  const xpQuery = useQuery({
    queryKey: ["my-xp"],
    queryFn: () => api.get<{ totalXP: number; level?: number; streak?: number }>("/gamification/my-xp").catch(() => ({ totalXP: 0 })),
    enabled: isStudent,
  });

  const tasksQuery = useQuery({
    queryKey: ["student-tasks"],
    queryFn: async () => {
      const [events, lessons, certs] = await Promise.all([
        api.get("/simulator/pending-events").catch(() => []),
        api.get("/learning/incomplete-lessons").catch(() => []),
        api.get("/learning/upcoming-certifications").catch(() => []),
      ]);
      return { pendingEvents: events ?? [], incompleteLessons: lessons ?? [], upcomingCerts: certs ?? [] };
    },
    enabled: isStudent,
  });

  const alertsQuery = useQuery({
    queryKey: ["inventory-alerts"],
    queryFn: () => api.get("/inventory/below-safety-stock").catch(() => []),
    enabled: isStudent,
  });

  const activityQuery = useQuery({
    queryKey: ["recent-activity"],
    queryFn: () => api.get("/events/recent").catch(() => []),
    enabled: isStudent,
  });

  const totalXP = xpQuery.data?.totalXP ?? 0;
  const tasks = tasksQuery.data ?? { pendingEvents: [], incompleteLessons: [], upcomingCerts: [] };
  const alerts = Array.isArray(alertsQuery.data) ? alertsQuery.data : [];
  const recentActivity = Array.isArray(activityQuery.data) ? activityQuery.data : [];

  // Instructor data
  const studentsQuery = useQuery({
    queryKey: ["students-progress"],
    queryFn: () => api.get("/instructor/students-progress").catch(() => []),
    enabled: isInstructor || isAdmin,
  });

  const simulationsQuery = useQuery({
    queryKey: ["active-simulations"],
    queryFn: () => api.get("/instructor/active-simulations").catch(() => ({ count: 0, list: [] })),
    enabled: isInstructor || isAdmin,
  });

  const completionQuery = useQuery({
    queryKey: ["exercise-completion"],
    queryFn: () => api.get("/instructor/exercise-completion-rates").catch(() => []),
    enabled: isInstructor || isAdmin,
  });

  const instructorActionsQuery = useQuery({
    queryKey: ["instructor-actions"],
    queryFn: () => api.get("/instructor/recent-actions").catch(() => []),
    enabled: isInstructor || isAdmin,
  });

  const studentsProgress = Array.isArray(studentsQuery.data) ? studentsQuery.data : [];
  const simData = simulationsQuery.data || {};
  const activeSims = simData.count ?? (simData.list?.length ?? 0);
  const simList = simData.list ?? [];
  const completionRates = Array.isArray(completionQuery.data) ? completionQuery.data : [];
  const instructorActions = Array.isArray(instructorActionsQuery.data) ? instructorActionsQuery.data : [];

  // Admin data
  const systemQuery = useQuery({
    queryKey: ["admin-system"],
    queryFn: async () => {
      const [users, tenants, tx] = await Promise.all([
        api.get("/admin/users/count").catch(() => ({ count: 0 })),
        api.get("/admin/tenants/count").catch(() => ({ count: 0 })),
        api.get("/reporting/transaction-count").catch(() => ({ count: 0 })),
      ]);
      return {
        activeUsers: users?.count ?? 0,
        totalTenants: tenants?.count ?? 0,
        totalTransactions: tx?.count ?? 0,
      };
    },
    enabled: isAdmin,
  });

  const perfQuery = useQuery({
    queryKey: ["api-performance"],
    queryFn: () => api.get("/admin/api-performance").catch(() => ({ avgResponseTime: 0, errorRate: 0 })),
    enabled: isAdmin,
  });

  const dbQuery = useQuery({
    queryKey: ["database-stats"],
    queryFn: () => api.get("/admin/database-stats").catch(() => ({})),
    enabled: isAdmin,
  });

  const systemData = systemQuery.data || {};
  const perfData = perfQuery.data || {};
  const dbStats = dbQuery.data || {};

  // Determine which dashboard to show (admin takes precedence, then instructor, then student)
  const showAdmin = isAdmin;
  const showInstructor = isInstructor && !showAdmin;
  const showStudent = isStudent && !showAdmin && !showInstructor;

  return (
    <div>
      <PageHeader
        title={
          showAdmin
            ? "Admin Dashboard"
            : showInstructor
            ? "Instructor Dashboard"
            : `Welcome back, ${user?.firstName ?? "Student"}`
        }
        subtitle={
          showAdmin
            ? "System overview and management"
            : showInstructor
            ? "Student progress and simulations"
            : "Your learning journey and ERP activities"
        }
      />

      {/* Student Dashboard */}
      {showStudent && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <span className="text-xl font-bold text-blue-600">
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </span>
              </div>
              <div>
                <h2 className="text-lg font-semibold">{user?.firstName} {user?.lastName}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="badge badge-blue">{totalXP} XP</span>
                  <span className="text-sm text-gray-500">Level {Math.floor(totalXP / 100) + 1}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <Zap className="w-4 h-4" /> My Tasks
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <span>Pending simulation events</span>
                  <span className="font-semibold">{tasks.pendingEvents?.length ?? 0}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <span>Incomplete lessons</span>
                  <span className="font-semibold">{tasks.incompleteLessons?.length ?? 0}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <span>Upcoming certifications</span>
                  <span className="font-semibold">{tasks.upcomingCerts?.length ?? 0}</span>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" /> Inventory Alerts
              </h3>
              <div className="space-y-2">
                {alerts.slice(0, 5).map((a: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded bg-amber-50 dark:bg-amber-900/20">
                    <span className="text-sm">{a.materialNumber ?? a.material ?? a.name ?? "Material"}</span>
                    <span className="text-xs text-amber-600">Below safety stock</span>
                  </div>
                ))}
                {alerts.length === 0 && (
                  <p className="text-sm text-gray-500">No materials below safety stock</p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4" /> Recent Activity
            </h3>
            <div className="divide-y divide-gray-200 dark:divide-gray-600">
              {recentActivity.slice(0, 5).map((a: any, i: number) => (
                <div key={i} className="py-3 flex items-center justify-between">
                  <span className="text-sm">{a.type ?? a.action ?? "Event"}</span>
                  <span className="text-xs text-gray-500">
                    {a.timestamp ? new Date(a.timestamp).toLocaleString() : "—"}
                  </span>
                </div>
              ))}
              {recentActivity.length === 0 && (
                <p className="py-4 text-sm text-gray-500">No recent activity</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <Link
              to="/simulator"
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 flex items-center gap-2"
            >
              <Play className="w-4 h-4" /> Start Exercise
            </Link>
            <Link
              to="/learning"
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg px-4 py-2 flex items-center gap-2"
            >
              <BookOpen className="w-4 h-4" /> Continue Course
            </Link>
            <Link
              to="/gamification"
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg px-4 py-2 flex items-center gap-2"
            >
              <Award className="w-4 h-4" /> View Leaderboard
            </Link>
          </div>
        </div>
      )}

      {/* Instructor Dashboard */}
      {showInstructor && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
              <p className="text-sm text-gray-500">Active Simulations</p>
              <p className="text-2xl font-bold">{activeSims}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
              <p className="text-sm text-gray-500">Students</p>
              <p className="text-2xl font-bold">{studentsProgress.length}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Students by XP Level</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={studentsProgress.slice(0, 10).map((s: any) => ({
                    name: s.name ?? (`${s.firstName ?? ""} ${s.lastName ?? ""}`.trim() || s.id),
                    xp: (s.xp ?? s.totalXP) ?? 0,
                  }))}
                >
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="xp" fill="#3b82f6" radius={[4, 4, 0, 0]} name="XP" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Exercise Completion Rates</h3>
              {completionRates.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={completionRates}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, value }) => `${name}: ${value}%`}
                    >
                      {completionRates.map((_: any, i: number) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-gray-500 py-12 text-center">No completion data</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Active Simulations</h3>
              <div className="space-y-2">
                {simList.slice(0, 5).map((s: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded bg-gray-50 dark:bg-gray-700/50">
                    <span>{s.name ?? s.id ?? `Simulation ${i + 1}`}</span>
                    <span className="badge badge-green">Active</span>
                  </div>
                ))}
                {simList.length === 0 && (
                  <p className="text-sm text-gray-500">No active simulations</p>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Recent Instructor Actions</h3>
              <div className="space-y-2">
                {instructorActions.slice(0, 5).map((a: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                    <span className="text-sm">{a.action ?? a.type ?? "Action"}</span>
                    <span className="text-xs text-gray-500">
                      {a.timestamp ? new Date(a.timestamp).toLocaleString() : ""}
                    </span>
                  </div>
                ))}
                {instructorActions.length === 0 && (
                  <p className="text-sm text-gray-500">No recent actions</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <Link
              to="/instructor"
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 flex items-center gap-2"
            >
              <Zap className="w-4 h-4" /> Inject Crisis
            </Link>
            <Link
              to="/instructor"
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg px-4 py-2 flex items-center gap-2"
            >
              <FileText className="w-4 h-4" /> Create Exercise
            </Link>
            <Link
              to="/reporting"
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg px-4 py-2 flex items-center gap-2"
            >
              <BarChart3 className="w-4 h-4" /> View Reports
            </Link>
          </div>
        </div>
      )}

      {/* Admin Dashboard */}
      {showAdmin && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
              <p className="text-sm text-gray-500">Active Users</p>
              <p className="text-2xl font-bold">{systemData.activeUsers ?? 0}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
              <p className="text-sm text-gray-500">Total Tenants</p>
              <p className="text-2xl font-bold">{systemData.totalTenants ?? 0}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
              <p className="text-sm text-gray-500">Total Transactions</p>
              <p className="text-2xl font-bold">{systemData.totalTransactions ?? 0}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">API Performance</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Avg response time</span>
                  <span className="font-semibold">{perfData.avgResponseTime ?? 0} ms</span>
                </div>
                <div className="flex justify-between">
                  <span>Error rate</span>
                  <span className="font-semibold">{(perfData.errorRate ?? 0).toFixed(2)}%</span>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Database Stats</h3>
              <div className="space-y-2">
                {Object.entries(dbStats).map(([key, val]) => (
                  <div key={key} className="flex justify-between text-sm">
                    <span className="capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</span>
                    <span>{String(val).toLocaleString()}</span>
                  </div>
                ))}
                {Object.keys(dbStats).length === 0 && (
                  <p className="text-sm text-gray-500">No stats available</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <Link
              to="/admin"
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 flex items-center gap-2"
            >
              <Users className="w-4 h-4" /> User Management
            </Link>
            <Link
              to="/admin"
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg px-4 py-2 flex items-center gap-2"
            >
              <Settings className="w-4 h-4" /> Tenant Management
            </Link>
          </div>
        </div>
      )}

      {/* Fallback when no role matches */}
      {!showStudent && !showInstructor && !showAdmin && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <p className="text-gray-500">Unable to determine your role. Please contact your administrator.</p>
          <p className="text-sm text-gray-400 mt-2">Roles: {user?.roles?.join(", ") ?? "none"}</p>
        </div>
      )}
    </div>
  );
}
