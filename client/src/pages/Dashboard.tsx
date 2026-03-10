import { useQuery } from "@tanstack/react-query";
import {
  ShoppingCart, Package, FileText, Users, Wrench, Landmark, TrendingUp,
  BarChart3, ArrowRight, Boxes, Clock, Zap, Trophy, BookOpen,
  Activity, Target, Gamepad2, GraduationCap,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, CartesianGrid } from "recharts";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuthStore } from "../stores/auth";

const CHART_COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#ef4444", "#8b5cf6", "#0891b2"];

const accentColors: Record<string, string> = {
  blue: "border-l-blue-500", green: "border-l-emerald-500",
  purple: "border-l-purple-500", amber: "border-l-amber-500",
  orange: "border-l-orange-500", cyan: "border-l-cyan-500",
  yellow: "border-l-yellow-500",
};

function KPICard({ title, value, subtitle, icon: Icon, trend, color, accent }: {
  title: string; value: string | number; subtitle?: string;
  icon: React.ElementType; trend?: string; color: string; accent?: string;
}) {
  const borderClass = accent ? accentColors[accent] || "" : "";
  return (
    <div className={`bg-white rounded-xl border border-gray-100 border-l-[3px] ${borderClass} p-5 hover:shadow-md hover:border-gray-200 transition-all`}>
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <span className="text-[11px] font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">{trend}</span>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900 mt-3 tracking-tight">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{title}</p>
      {subtitle && <p className="text-[11px] text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  );
}

function QuickAction({ label, path, icon: Icon, color, desc }: {
  label: string; path: string; icon: React.ElementType; color: string; desc: string;
}) {
  return (
    <Link to={path} className="group flex items-center gap-3 p-3.5 rounded-xl border border-gray-100 hover:border-primary-200 hover:bg-primary-50/30 transition-all">
      <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center group-hover:scale-105 transition-transform`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-[11px] text-gray-500">{desc}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-gray-300 ml-auto group-hover:text-primary-500 transition-colors" />
    </Link>
  );
}

export default function Dashboard() {
  const { user } = useAuthStore();
  const isStaff = user?.roles?.some((r) => ["admin", "instructor"].includes(r));

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get("/reporting/dashboard"),
  });

  const kpis = data?.kpis || {};

  const moduleData = [
    { name: "POs", count: kpis.totalPOs || 0, fill: "#2563eb" },
    { name: "SOs", count: kpis.totalSOs || 0, fill: "#16a34a" },
    { name: "Materials", count: kpis.totalMaterials || 0, fill: "#f59e0b" },
    { name: "Employees", count: kpis.totalEmployees || 0, fill: "#8b5cf6" },
    { name: "Journals", count: kpis.totalJournals || 0, fill: "#06b6d4" },
  ];

  const statusData = [
    { name: "Open POs", value: kpis.openPOs || 0 },
    { name: "Open SOs", value: kpis.openSOs || 0 },
    { name: "Work Orders", value: kpis.openWorkOrders || 0 },
    { name: "Pending", value: kpis.pendingLeaves || 0 },
  ].filter((d) => d.value > 0);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="space-y-6">
      {/* Hero greeting */}
      <div className="bg-gradient-to-r from-primary-600 via-primary-600 to-indigo-600 rounded-2xl p-6 lg:p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-1/2 w-48 h-48 bg-white/5 rounded-full translate-y-1/2" />
        <div className="relative z-10">
          <p className="text-primary-200 text-sm font-medium">{greeting()}</p>
          <h1 className="text-2xl lg:text-3xl font-bold mt-1 tracking-tight">{user?.firstName} {user?.lastName}</h1>
          <p className="text-primary-200 mt-2 max-w-lg text-sm">
            {isStaff
              ? "Monitor your class activity, manage assignments, and track student progress."
              : "Continue your ERP learning journey. Practice real business processes."}
          </p>
          <div className="flex flex-wrap gap-3 mt-5">
            {isStaff ? (
              <>
                <Link to="/instructor/analytics" className="inline-flex items-center gap-2 px-4 py-2 bg-white/15 hover:bg-white/25 backdrop-blur-sm rounded-lg text-sm font-medium transition-colors border border-white/20">
                  <BarChart3 className="w-4 h-4" /> Class Analytics
                </Link>
                <Link to="/dataset-generator" className="inline-flex items-center gap-2 px-4 py-2 bg-white/15 hover:bg-white/25 backdrop-blur-sm rounded-lg text-sm font-medium transition-colors border border-white/20">
                  <Boxes className="w-4 h-4" /> Generate Data
                </Link>
              </>
            ) : (
              <>
                <Link to="/learning" className="inline-flex items-center gap-2 px-4 py-2 bg-white text-primary-700 rounded-lg text-sm font-semibold hover:bg-white/90 transition-colors shadow-lg shadow-primary-900/20">
                  <BookOpen className="w-4 h-4" /> Continue Learning
                </Link>
                <Link to="/game" className="inline-flex items-center gap-2 px-4 py-2 bg-white/15 hover:bg-white/25 backdrop-blur-sm rounded-lg text-sm font-medium transition-colors border border-white/20">
                  <Gamepad2 className="w-4 h-4" /> Supply Chain Game
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Purchase Orders" value={kpis.totalPOs || 0} subtitle={`${kpis.openPOs || 0} open`} icon={Package} color="text-blue-600 bg-blue-50" accent="blue" />
        <KPICard title="Sales Orders" value={kpis.totalSOs || 0} subtitle={`${kpis.openSOs || 0} open`} icon={ShoppingCart} color="text-green-600 bg-green-50" accent="green" />
        <KPICard title="Journal Entries" value={kpis.totalJournals || 0} subtitle="Posted" icon={Landmark} color="text-purple-600 bg-purple-50" accent="purple" />
        <KPICard title="Materials" value={kpis.totalMaterials || 0} subtitle={`${kpis.totalVendors || 0} vendors`} icon={Boxes} color="text-amber-600 bg-amber-50" accent="amber" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Records by Module</h3>
            <Link to="/reporting" className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1">
              Full Report <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={moduleData} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {moduleData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Open Items</h3>
          {statusData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={3}>
                    {statusData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center mt-2">
                {statusData.map((d, i) => (
                  <span key={d.name} className="inline-flex items-center gap-1.5 text-[11px] text-gray-600">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                    {d.name}: {d.value}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <div className="h-[220px] flex flex-col items-center justify-center text-gray-400">
              <Target className="w-8 h-8 mb-2 text-gray-300" />
              <p className="text-sm">All clear — no open items</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions + Recent Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary-600" /> Quick Actions
          </h3>
          <div className="space-y-2">
            <QuickAction label="New Purchase Order" path="/materials/purchase-orders" icon={Package} color="text-blue-600 bg-blue-50" desc="Create procurement" />
            <QuickAction label="New Sales Order" path="/sales/orders" icon={ShoppingCart} color="text-green-600 bg-green-50" desc="Enter customer order" />
            <QuickAction label="Journal Entry" path="/finance/journal-entries" icon={FileText} color="text-purple-600 bg-purple-50" desc="Post GL entry" />
            <QuickAction label="Run MRP" path="/mrp" icon={Boxes} color="text-orange-600 bg-orange-50" desc="Plan requirements" />
            <QuickAction label="Start Exercise" path="/learning" icon={GraduationCap} color="text-cyan-600 bg-cyan-50" desc="Learn ERP" />
            {isStaff && (
              <QuickAction label="View Submissions" path="/instructor/analytics" icon={Trophy} color="text-yellow-600 bg-yellow-50" desc="Grade students" />
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Recent Sales Orders</h3>
            <Link to="/sales/orders" className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y">
            {(data?.recentSOs || []).slice(0, 5).map((so: any) => (
              <div key={so.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div>
                  <p className="text-sm font-medium text-gray-900">{so.soNumber}</p>
                  <p className="text-xs text-gray-500">{so.customer?.name || "—"}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">${(so.totalAmount || 0).toLocaleString()}</p>
                  <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                    so.status === "completed" ? "bg-green-50 text-green-700" :
                    so.status === "confirmed" ? "bg-blue-50 text-blue-700" :
                    so.status === "processing" ? "bg-amber-50 text-amber-700" :
                    "bg-gray-100 text-gray-600"
                  }`}>{so.status}</span>
                </div>
              </div>
            ))}
            {(!data?.recentSOs || data.recentSOs.length === 0) && (
              <div className="px-5 py-8 text-center text-sm text-gray-400">No sales orders yet</div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Recent Purchase Orders</h3>
            <Link to="/materials/purchase-orders" className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y">
            {(data?.recentPOs || []).slice(0, 5).map((po: any) => (
              <div key={po.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div>
                  <p className="text-sm font-medium text-gray-900">{po.poNumber}</p>
                  <p className="text-xs text-gray-500">{po.vendor?.name || "—"}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">${(po.totalAmount || 0).toLocaleString()}</p>
                  <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                    po.status === "received" || po.status === "closed" ? "bg-green-50 text-green-700" :
                    po.status === "approved" ? "bg-blue-50 text-blue-700" :
                    po.status === "ordered" ? "bg-amber-50 text-amber-700" :
                    "bg-gray-100 text-gray-600"
                  }`}>{po.status}</span>
                </div>
              </div>
            ))}
            {(!data?.recentPOs || data.recentPOs.length === 0) && (
              <div className="px-5 py-8 text-center text-sm text-gray-400">No purchase orders yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
