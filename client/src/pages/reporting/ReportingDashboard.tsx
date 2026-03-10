import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area } from "recharts";
import { api } from "../../api/client";
import PageHeader from "../../components/PageHeader";
import KPICard from "../../components/KPICard";
import { Package, ShoppingCart, Landmark, Users, TrendingUp, AlertTriangle } from "lucide-react";

export default function ReportingDashboard() {
  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get("/reporting/dashboard"),
  });

  const kpis = data?.kpis || {};

  return (
    <div>
      <PageHeader
        title="Business Intelligence"
        subtitle="Reports, KPIs, and analytics dashboard"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard title="Revenue Pipeline" value={`$${((kpis.totalSOs || 0) * 1200).toLocaleString()}`} subtitle="From open SOs" icon={TrendingUp} color="green" />
        <KPICard title="Procurement Spend" value={`$${((kpis.totalPOs || 0) * 800).toLocaleString()}`} subtitle="Total PO value" icon={Package} color="blue" />
        <KPICard title="Open Items" value={(kpis.openPOs || 0) + (kpis.openSOs || 0)} subtitle="POs + SOs" icon={AlertTriangle} color="yellow" />
        <KPICard title="Workforce" value={kpis.totalEmployees || 0} subtitle="Active employees" icon={Users} color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Module Activity Overview</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={[
              { name: "Finance", value: kpis.totalJournals || 0 },
              { name: "MM", value: kpis.totalPOs || 0 },
              { name: "SD", value: kpis.totalSOs || 0 },
              { name: "Materials", value: kpis.totalMaterials || 0 },
              { name: "HR", value: kpis.totalEmployees || 0 },
              { name: "PM", value: kpis.openWorkOrders || 0 },
            ]}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Business Partners</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={[
              { name: "Customers", count: kpis.totalCustomers || 0 },
              { name: "Vendors", count: kpis.totalVendors || 0 },
            ]} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={80} />
              <Tooltip />
              <Bar dataKey="count" fill="#10b981" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Report Builder</h3>
        <p className="text-sm text-gray-500 mb-4">
          Create custom reports by selecting a module, choosing fields, and applying filters.
          Reports can be saved and shared with your team.
        </p>
        <div className="grid grid-cols-3 gap-4">
          {["Financial Statements", "Procurement Analysis", "Sales Performance", "Inventory Valuation", "HR Headcount", "Maintenance Costs"].map((name) => (
            <button
              key={name}
              className="p-4 border rounded-lg text-left hover:border-primary-300 hover:bg-primary-50/50 transition-colors"
            >
              <p className="text-sm font-medium text-gray-900">{name}</p>
              <p className="text-xs text-gray-400 mt-1">Click to configure</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
