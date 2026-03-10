import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { api } from "../api/client";
import { useAuthStore } from "../stores/auth";
import PageHeader from "../components/PageHeader";
import KPICard from "../components/KPICard";
import {
  BarChart3,
  Package,
  TrendingUp,
  Loader2,
  Database,
  Play,
} from "lucide-react";

const CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#14b8a6"];

type TabId = "sales" | "inventory" | "kpis" | "etl";

export default function DataWarehouse() {
  const queryClient = useQueryClient();
  const { hasRole } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabId>("kpis");

  // KPIs tab
  const kpisQuery = useQuery({
    queryKey: ["data-warehouse", "kpis"],
    queryFn: () => api.get("/data-warehouse/kpis"),
    enabled: activeTab === "kpis",
  });

  const kpis = kpisQuery.data || {};

  // Sales tab filters
  const [salesFilters, setSalesFilters] = useState({
    startDate: "",
    endDate: "",
    customerId: "",
    materialId: "",
    groupBy: "customer" as "customer" | "material" | "month" | "region",
  });

  const salesQuery = useQuery({
    queryKey: ["data-warehouse", "sales", salesFilters],
    queryFn: () =>
      api.get("/data-warehouse/sales", {
        startDate: salesFilters.startDate || undefined,
        endDate: salesFilters.endDate || undefined,
        customerId: salesFilters.customerId || undefined,
        materialId: salesFilters.materialId || undefined,
        groupBy: salesFilters.groupBy,
      }),
    enabled: activeTab === "sales",
  });

  const salesData = Array.isArray(salesQuery.data?.data)
    ? salesQuery.data.data
    : Array.isArray(salesQuery.data?.rows)
    ? salesQuery.data.rows
    : [];
  const customersOptions = Array.isArray(salesQuery.data?.customers) ? salesQuery.data.customers : [];
  const materialsOptions = Array.isArray(salesQuery.data?.materials) ? salesQuery.data.materials : [];

  // Inventory tab filters
  const [inventoryFilters, setInventoryFilters] = useState({
    date: "",
    materialId: "",
  });

  const inventoryQuery = useQuery({
    queryKey: ["data-warehouse", "inventory", inventoryFilters],
    queryFn: () =>
      api.get("/data-warehouse/inventory", {
        date: inventoryFilters.date || undefined,
        materialId: inventoryFilters.materialId || undefined,
      }),
    enabled: activeTab === "inventory",
  });

  const inventoryData = Array.isArray(inventoryQuery.data?.data)
    ? inventoryQuery.data.data
    : Array.isArray(inventoryQuery.data?.rows)
    ? inventoryQuery.data.rows
    : [];
  const inventoryChartData = Array.isArray(inventoryQuery.data?.chartData) ? inventoryQuery.data.chartData : [];

  // ETL tab
  const etlRunMutation = useMutation({
    mutationFn: () => api.post("/data-warehouse/etl/run"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["data-warehouse", "kpis"] });
      queryClient.invalidateQueries({ queryKey: ["data-warehouse", "etl-status"] });
    },
  });

  const etlStatusQuery = useQuery({
    queryKey: ["data-warehouse", "etl-status"],
    queryFn: () => api.get("/data-warehouse/etl/status").catch(() => ({ lastRun: null, recordsLoaded: {} })),
    enabled: activeTab === "etl",
  });

  const etlResult = etlRunMutation.data;
  const etlStatus = etlStatusQuery.data;
  const lastEtlRun = etlResult?.lastRun || etlStatus?.lastRun;
  const recordsLoaded = etlResult?.recordsLoaded || etlStatus?.recordsLoaded || {};

  const isAdminOrInstructor = hasRole("admin") || hasRole("instructor");

  const tabs: { id: TabId; label: string; icon: typeof BarChart3 }[] = [
    { id: "sales", label: "Sales Analytics", icon: BarChart3 },
    { id: "inventory", label: "Inventory Analytics", icon: Package },
    { id: "kpis", label: "KPIs", icon: TrendingUp },
    { id: "etl", label: "ETL", icon: Database },
  ];

  return (
    <div>
      <PageHeader
        title="Data Warehouse"
        subtitle="Analytics, KPIs, and ETL management"
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

        {/* KPIs Tab */}
        {activeTab === "kpis" && (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard
                title="Total Revenue"
                value={`$${(kpis.totalRevenue ?? 0).toLocaleString()}`}
                icon={TrendingUp}
                color="green"
              />
              <KPICard
                title="Total Cost"
                value={`$${(kpis.totalCost ?? 0).toLocaleString()}`}
                icon={Package}
                color="blue"
              />
              <KPICard
                title="Profit Margin %"
                value={`${(kpis.profitMarginPct ?? 0).toFixed(1)}%`}
                icon={BarChart3}
                color="purple"
              />
              <KPICard
                title="Top Product"
                value={kpis.topProduct ?? "—"}
                subtitle={kpis.topProductRevenue ? `$${kpis.topProductRevenue?.toLocaleString()}` : undefined}
                color="yellow"
              />
            </div>

            {(kpis.revenueTrend || []).length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Revenue Trend (Monthly)</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={kpis.revenueTrend}>
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => [`$${v?.toLocaleString()}`, "Revenue"]} />
                    <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Top 10 Customers by Revenue</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={(kpis.topCustomersByRevenue || []).slice(0, 10)}
                    layout="vertical"
                    margin={{ left: 80 }}
                  >
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: number) => [`$${v?.toLocaleString()}`, "Revenue"]} />
                    <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Top 10 Products by Profit</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={(kpis.topProductsByProfit || []).slice(0, 10)}
                    layout="vertical"
                    margin={{ left: 80 }}
                  >
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: number) => [`$${v?.toLocaleString()}`, "Profit"]} />
                    <Bar dataKey="profit" fill="#10b981" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Sales Analytics Tab */}
        {activeTab === "sales" && (
          <div className="p-6 space-y-6">
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
                <input
                  type="date"
                  value={salesFilters.startDate}
                  onChange={(e) => setSalesFilters({ ...salesFilters, startDate: e.target.value })}
                  className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
                <input
                  type="date"
                  value={salesFilters.endDate}
                  onChange={(e) => setSalesFilters({ ...salesFilters, endDate: e.target.value })}
                  className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Customer</label>
                <select
                  value={salesFilters.customerId}
                  onChange={(e) => setSalesFilters({ ...salesFilters, customerId: e.target.value })}
                  className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm min-w-[160px]"
                >
                  <option value="">All</option>
                  {(customersOptions as { id: string; name: string }[]).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Material</label>
                <select
                  value={salesFilters.materialId}
                  onChange={(e) => setSalesFilters({ ...salesFilters, materialId: e.target.value })}
                  className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm min-w-[160px]"
                >
                  <option value="">All</option>
                  {(materialsOptions as { id: string; materialNumber: string; description?: string }[]).map((m) => (
                    <option key={m.id} value={m.id}>{m.materialNumber}{m.description ? ` - ${m.description}` : ""}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Group By</label>
                <select
                  value={salesFilters.groupBy}
                  onChange={(e) =>
                    setSalesFilters({
                      ...salesFilters,
                      groupBy: e.target.value as "customer" | "material" | "month" | "region",
                    })
                  }
                  className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
                >
                  <option value="customer">Customer</option>
                  <option value="material">Material</option>
                  <option value="month">Month</option>
                  <option value="region">Region</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50">
                    <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Dimension</th>
                    <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Quantity</th>
                    <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Revenue</th>
                    <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Cost</th>
                    <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                  {salesQuery.isLoading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                      </td>
                    </tr>
                  ) : salesData.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-400">No data</td>
                    </tr>
                  ) : (
                    salesData.map((row: any, i: number) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-4 py-3">{row.dimension ?? row.name ?? row[Object.keys(row)[0]] ?? "—"}</td>
                        <td className="px-4 py-3">{row.quantity ?? row.qty ?? 0}</td>
                        <td className="px-4 py-3">${(row.revenue ?? 0).toLocaleString()}</td>
                        <td className="px-4 py-3">${(row.cost ?? 0).toLocaleString()}</td>
                        <td className="px-4 py-3">${(row.profit ?? 0).toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {salesData.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Revenue by {salesFilters.groupBy}
                </h3>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={salesData.map((r: any, i: number) => ({
                        name: r.dimension ?? r.name ?? `Item ${i + 1}`,
                        value: r.revenue ?? 0,
                      }))}
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      dataKey="value"
                      label={({ name, value }) => (value > 0 ? `${name}: $${value.toLocaleString()}` : "")}
                    >
                      {salesData.map((_: any, i: number) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => [`$${v?.toLocaleString()}`, "Revenue"]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* Inventory Analytics Tab */}
        {activeTab === "inventory" && (
          <div className="p-6 space-y-6">
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
                <input
                  type="date"
                  value={inventoryFilters.date}
                  onChange={(e) => setInventoryFilters({ ...inventoryFilters, date: e.target.value })}
                  className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Material</label>
                <select
                  value={inventoryFilters.materialId}
                  onChange={(e) => setInventoryFilters({ ...inventoryFilters, materialId: e.target.value })}
                  className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm min-w-[180px]"
                >
                  <option value="">All</option>
                  {(Array.isArray(inventoryQuery.data?.materials) ? inventoryQuery.data.materials : []).map((m: any) => (
                    <option key={m.id} value={m.id}>{m.materialNumber}{m.description ? ` - ${m.description}` : ""}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50">
                    <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Date</th>
                    <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Material</th>
                    <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Warehouse</th>
                    <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Stock Qty</th>
                    <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Stock Value</th>
                    <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Inbound</th>
                    <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Outbound</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                  {inventoryQuery.isLoading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                      </td>
                    </tr>
                  ) : inventoryData.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-400">No data</td>
                    </tr>
                  ) : (
                    inventoryData.map((row: any, i: number) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-4 py-3">{row.date ?? "—"}</td>
                        <td className="px-4 py-3">{row.material ?? row.materialNumber ?? "—"}</td>
                        <td className="px-4 py-3">{row.warehouse ?? "—"}</td>
                        <td className="px-4 py-3">{row.stockQuantity ?? row.quantity ?? 0}</td>
                        <td className="px-4 py-3">${(row.stockValue ?? 0).toLocaleString()}</td>
                        <td className="px-4 py-3">{row.inbound ?? 0}</td>
                        <td className="px-4 py-3">{row.outbound ?? 0}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {inventoryChartData.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Stock Levels Over Time</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={inventoryChartData}>
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="stock" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* ETL Tab */}
        {activeTab === "etl" && (
          <div className="p-6 space-y-6">
            {!isAdminOrInstructor ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                Access restricted to admin or instructor roles.
              </div>
            ) : (
              <>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => etlRunMutation.mutate()}
                    disabled={etlRunMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 flex items-center gap-2 disabled:opacity-50"
                  >
                    {etlRunMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    Run ETL Process
                  </button>
                </div>

                {etlResult && (
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">ETL Result</h3>
                    <div className="space-y-2">
                      <p>
                        <span className="font-medium">Sales records loaded:</span>{" "}
                        {recordsLoaded.sales ?? etlResult.salesLoaded ?? 0}
                      </p>
                      <p>
                        <span className="font-medium">Inventory records loaded:</span>{" "}
                        {recordsLoaded.inventory ?? etlResult.inventoryLoaded ?? 0}
                      </p>
                    </div>
                  </div>
                )}

                {lastEtlRun && (
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Last ETL run: {new Date(lastEtlRun).toLocaleString()}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
