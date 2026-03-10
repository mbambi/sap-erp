import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { api } from "../../api/client";
import PageHeader from "../../components/PageHeader";
import KPICard from "../../components/KPICard";
import { DollarSign, TrendingDown, Percent, Wallet, RotateCcw, Package } from "lucide-react";

interface FinancialData {
  revenue: number;
  expenses: number;
  grossMargin: number;
  cashFlow: number;
  monthlyData: { month: string; revenue: number; expenses: number }[];
  expenseCategories: { name: string; value: number }[];
  inventoryDonut: { name: string; value: number }[];
  inventoryTurnover: number;
  daysOfInventory: number;
  avgInventory: number;
}

const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

export default function FinancialAnalytics() {
  const { data, isLoading } = useQuery({
    queryKey: ["financial-analytics"],
    queryFn: () => api.get<FinancialData>("/reporting/financial"),
  });

  const revenue = data?.revenue ?? 0;
  const expenses = data?.expenses ?? 0;
  const grossMargin = data?.grossMargin ?? 0;
  const cashFlow = data?.cashFlow ?? 0;
  const monthlyData = data?.monthlyData ?? [];
  const expenseCategories = data?.expenseCategories ?? [];
  const inventoryDonut = data?.inventoryDonut ?? [];
  const inventoryTurnover = data?.inventoryTurnover ?? 0;
  const daysOfInventory = data?.daysOfInventory ?? 0;

  return (
    <div>
      <PageHeader
        title="Financial Analytics"
        subtitle="Revenue, expenses, margins, and cash flow"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard
          title="Total Revenue"
          value={`$${revenue.toLocaleString()}`}
          subtitle="Posted invoices"
          icon={DollarSign}
          color="green"
        />
        <KPICard
          title="Total Expenses"
          value={`$${expenses.toLocaleString()}`}
          subtitle="Posted POs"
          icon={TrendingDown}
          color="red"
        />
        <KPICard
          title="Gross Margin %"
          value={`${grossMargin.toFixed(1)}%`}
          subtitle="(Revenue - Expenses) / Revenue"
          icon={Percent}
          color="blue"
        />
        <KPICard
          title="Cash Flow"
          value={`$${cashFlow.toLocaleString()}`}
          subtitle="Revenue minus expenses"
          icon={Wallet}
          color={cashFlow >= 0 ? "green" : "red"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Revenue vs Expenses by Month</h3>
          {monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyData}>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, ""]} />
                <Bar dataKey="revenue" fill="#10b981" name="Revenue" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" fill="#ef4444" name="Expenses" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
              No monthly data available
            </div>
          )}
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Expense Breakdown by Category</h3>
          {expenseCategories.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={expenseCategories}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, value }) => `${name}: $${value.toLocaleString()}`}
                >
                  {expenseCategories.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
              No expense data available
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Cash Flow Trend</h3>
          {monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart
                data={monthlyData.map((d) => ({
                  ...d,
                  cashFlow: d.revenue - d.expenses,
                }))}
              >
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, "Cash Flow"]} />
                <Line type="monotone" dataKey="cashFlow" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
              No trend data available
            </div>
          )}
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Inventory Value by Material Type</h3>
          {inventoryDonut.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={inventoryDonut}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                >
                  {inventoryDonut.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
              No inventory data available
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Inventory Turnover</h3>
          <p className="text-sm text-gray-600 mb-4">
            COGS / Average Inventory = Turnover ratio. Days of inventory = 365 / Turnover.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <KPICard
              title="Turnover Ratio"
              value={inventoryTurnover.toFixed(2)}
              icon={RotateCcw}
              color="blue"
            />
            <KPICard
              title="Days of Inventory"
              value={daysOfInventory.toFixed(0)}
              subtitle="days"
              icon={Package}
              color="purple"
            />
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Quick Ratios</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">Current Ratio</span>
              <span className="font-medium">-</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">Working Capital</span>
              <span className="font-medium">-</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">Days Payable Outstanding</span>
              <span className="font-medium">-</span>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Configure GL accounts and AP data to enable quick ratio calculations.
          </p>
        </div>
      </div>
    </div>
  );
}
