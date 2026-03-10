import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { useAuthStore } from "../stores/auth";
import PageHeader from "../components/PageHeader";
import { FileText, Loader2, Lock } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface FinancialStatement {
  id: string;
  type: string;
  periodYear: number;
  periodMonth: number;
  companyCode: string | null;
  status: string;
  data: string;
  generatedAt: string;
  generatedBy: string;
}

interface BalanceSheetData {
  assets: { accountNumber: string; name: string; balance: number }[];
  liabilities: { accountNumber: string; name: string; balance: number }[];
  equity: { accountNumber: string; name: string; balance: number }[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
}

interface IncomeStatementData {
  revenue: { accountNumber: string; name: string; amount: number }[];
  expenses: { accountNumber: string; name: string; amount: number }[];
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
}

interface CashFlowData {
  operating: { netIncome: number; depreciation: number; total: number };
  investing: { total: number };
  financing: { total: number };
  netChange: number;
}

const CARD_CLASS = "bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700";
const BTN_CLASS = "bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50";

export default function FinancialStatements() {
  const queryClient = useQueryClient();
  const { hasRole } = useAuthStore();
  const isAdmin = hasRole("admin") || hasRole("instructor");

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [companyCode, setCompanyCode] = useState("");
  const [statementType, setStatementType] = useState("balance_sheet");
  const [selectedStatement, setSelectedStatement] = useState<FinancialStatement | null>(null);

  const { data: rawStatements = [], isLoading: statementsLoading } = useQuery({
    queryKey: ["financial-statements", year, month, statementType],
    queryFn: () =>
      api.get<FinancialStatement[]>("/financial-statements", {
        year,
        month: month || undefined,
        type: statementType || undefined,
      }),
  });

  const statements = companyCode
    ? rawStatements.filter((s) => (s.companyCode ?? "") === companyCode)
    : rawStatements;

  const { data: companyCodes = [] } = useQuery({
    queryKey: ["multi-company", "companies"],
    queryFn: () => api.get<{ code: string; name: string }[]>("/multi-company/companies"),
  });

  const companyOptions = Array.isArray(companyCodes)
    ? (companyCodes as { code: string; name?: string }[]).map((c) => ({ value: c.code, label: `${c.code} - ${c.name ?? c.code}` }))
    : [];

  const { data: statementDetail } = useQuery({
    queryKey: ["financial-statements", selectedStatement?.id],
    queryFn: () => api.get<FinancialStatement>(`/financial-statements/${selectedStatement!.id}`),
    enabled: !!selectedStatement?.id,
  });

  const generateBalanceSheetMutation = useMutation({
    mutationFn: () => api.post("/financial-statements/generate/balance-sheet", { year, month, companyCode: companyCode || undefined }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["financial-statements"] }),
  });

  const generateIncomeStatementMutation = useMutation({
    mutationFn: () => api.post("/financial-statements/generate/income-statement", { year, month }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["financial-statements"] }),
  });

  const generateCashFlowMutation = useMutation({
    mutationFn: () => api.post("/financial-statements/generate/cash-flow", { year, month }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["financial-statements"] }),
  });

  const finalizeMutation = useMutation({
    mutationFn: (id: string) => api.post(`/financial-statements/${id}/finalize`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-statements"] });
      if (selectedStatement) {
        setSelectedStatement((s) => (s ? { ...s, status: "final" } : null));
      }
    },
  });

  const statementTypeLabel = (t: string) => {
    if (t === "balance_sheet") return "Balance Sheet";
    if (t === "income_statement") return "Income Statement";
    if (t === "cash_flow") return "Cash Flow";
    return t;
  };

  const statusBadge = (status: string) => (
    <span
      className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
        status === "final" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
      }`}
    >
      {status}
    </span>
  );

  const formatDate = (d: string) => (d ? new Date(d).toLocaleDateString() : "-");

  const incomeChartData = statements
    .filter((s) => s.type === "income_statement")
    .slice(0, 6)
    .map((s) => {
      try {
        const d = JSON.parse(s.data) as IncomeStatementData;
        return {
          month: MONTHS[s.periodMonth - 1] ?? "—",
          revenue: d.totalRevenue ?? 0,
          expenses: d.totalExpenses ?? 0,
          netIncome: d.netIncome ?? 0,
        };
      } catch {
        return { month: MONTHS[s.periodMonth - 1] ?? "—", revenue: 0, expenses: 0, netIncome: 0 };
      }
    })
    .reverse();

  return (
    <div>
      <PageHeader title="Financial Statements" subtitle="Generate and view balance sheets, income statements, and cash flow" />

      {/* Filters & Generate Buttons */}
      <div className={`${CARD_CLASS} p-4 mb-6`}>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="label">Year</label>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="input w-32">
              {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Month</label>
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="input w-32">
              {MONTHS.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Company Code</label>
            <select value={companyCode} onChange={(e) => setCompanyCode(e.target.value)} className="input w-48">
              <option value="">All</option>
              {companyOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Statement Type</label>
            <select value={statementType} onChange={(e) => setStatementType(e.target.value)} className="input w-48">
              <option value="balance_sheet">Balance Sheet</option>
              <option value="income_statement">Income Statement</option>
              <option value="cash_flow">Cash Flow</option>
            </select>
          </div>
          {isAdmin && (
            <div className="flex gap-2 ml-auto">
              <button
                onClick={() => generateBalanceSheetMutation.mutate()}
                disabled={generateBalanceSheetMutation.isPending}
                className={`${BTN_CLASS} flex items-center gap-2`}
              >
                {generateBalanceSheetMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                Generate Balance Sheet
              </button>
              <button
                onClick={() => generateIncomeStatementMutation.mutate()}
                disabled={generateIncomeStatementMutation.isPending}
                className={`${BTN_CLASS} flex items-center gap-2`}
              >
                {generateIncomeStatementMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                Generate Income Statement
              </button>
              <button
                onClick={() => generateCashFlowMutation.mutate()}
                disabled={generateCashFlowMutation.isPending}
                className={`${BTN_CLASS} flex items-center gap-2`}
              >
                {generateCashFlowMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                Generate Cash Flow
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Statement List */}
        <div className={`${CARD_CLASS} overflow-hidden ${selectedStatement ? "lg:col-span-1" : "lg:col-span-3"}`}>
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white">Statement List</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/30">
                  <th className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Type</th>
                  <th className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Period</th>
                  <th className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Company</th>
                  <th className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Status</th>
                  <th className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Generated</th>
                </tr>
              </thead>
              <tbody>
                {statementsLoading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : (
                  statements.map((s) => (
                    <tr
                      key={s.id}
                      onClick={() => setSelectedStatement(s)}
                      className={`border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer ${
                        selectedStatement?.id === s.id ? "bg-blue-50 dark:bg-blue-900/20" : ""
                      }`}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{statementTypeLabel(s.type)}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{(MONTHS[s.periodMonth - 1] ?? "—")} {s.periodYear}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{s.companyCode ?? "All"}</td>
                      <td className="px-4 py-3">{statusBadge(s.status)}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{formatDate(s.generatedAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Statement Detail */}
        {selectedStatement && (
          <div className={`${CARD_CLASS} overflow-hidden lg:col-span-2`}>
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {statementTypeLabel(selectedStatement.type)} - {(MONTHS[selectedStatement.periodMonth - 1] ?? "—")} {selectedStatement.periodYear}
              </h3>
              {isAdmin && selectedStatement.status === "draft" && (
                <button
                  onClick={() => finalizeMutation.mutate(selectedStatement.id)}
                  disabled={finalizeMutation.isPending}
                  className={`${BTN_CLASS} flex items-center gap-2`}
                >
                  {finalizeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                  Finalize
                </button>
              )}
            </div>
            <div className="p-4 overflow-y-auto max-h-[600px]">
              {statementDetail?.type === "balance_sheet" && (() => {
                try {
                  const data = JSON.parse(statementDetail.data) as BalanceSheetData;
                  return (
                    <div className="grid md:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <h4 className="font-semibold text-blue-700 dark:text-blue-400 border-b pb-2">Assets</h4>
                        {data.assets?.map((a, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">{a.name}</span>
                            <span className="font-medium">${a.balance.toLocaleString()}</span>
                          </div>
                        ))}
                        <div className="flex justify-between font-semibold pt-2 border-t">
                          <span>Total Assets</span>
                          <span>${(data.totalAssets ?? 0).toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-semibold text-amber-700 dark:text-amber-400 border-b pb-2">Liabilities</h4>
                        {data.liabilities?.map((l, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">{l.name}</span>
                            <span className="font-medium">${l.balance.toLocaleString()}</span>
                          </div>
                        ))}
                        <div className="flex justify-between font-semibold pt-2 border-t">
                          <span>Total Liabilities</span>
                          <span>${(data.totalLiabilities ?? 0).toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-semibold text-emerald-700 dark:text-emerald-400 border-b pb-2">Equity</h4>
                        {data.equity?.map((e, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">{e.name}</span>
                            <span className="font-medium">${e.balance.toLocaleString()}</span>
                          </div>
                        ))}
                        <div className="flex justify-between font-semibold pt-2 border-t">
                          <span>Total Equity</span>
                          <span>${(data.totalEquity ?? 0).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  );
                } catch {
                  return <p className="text-gray-500">Invalid statement data</p>;
                }
              })()}

              {statementDetail?.type === "income_statement" && (() => {
                try {
                  const data = JSON.parse(statementDetail.data) as IncomeStatementData;
                  return (
                    <div className="space-y-6">
                      <div>
                        <h4 className="font-semibold text-emerald-700 dark:text-emerald-400 border-b pb-2 mb-2">Revenue</h4>
                        {data.revenue?.map((r, i) => (
                          <div key={i} className="flex justify-between text-sm py-1">
                            <span className="text-gray-600 dark:text-gray-400">{r.name}</span>
                            <span className="font-medium text-emerald-600">${r.amount.toLocaleString()}</span>
                          </div>
                        ))}
                        <div className="flex justify-between font-semibold pt-2 border-t text-emerald-700 dark:text-emerald-400">
                          <span>Total Revenue</span>
                          <span>${(data.totalRevenue ?? 0).toLocaleString()}</span>
                        </div>
                      </div>
                      <div>
                        <h4 className="font-semibold text-red-700 dark:text-red-400 border-b pb-2 mb-2">Expenses</h4>
                        {data.expenses?.map((e, i) => (
                          <div key={i} className="flex justify-between text-sm py-1">
                            <span className="text-gray-600 dark:text-gray-400">{e.name}</span>
                            <span className="font-medium text-red-600">${e.amount.toLocaleString()}</span>
                          </div>
                        ))}
                        <div className="flex justify-between font-semibold pt-2 border-t text-red-700 dark:text-red-400">
                          <span>Total Expenses</span>
                          <span>${(data.totalExpenses ?? 0).toLocaleString()}</span>
                        </div>
                      </div>
                      <div className={`p-4 rounded-lg font-semibold text-lg ${(data.netIncome ?? 0) >= 0 ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-300"}`}>
                        Net Income: ${(data.netIncome ?? 0).toLocaleString()}
                      </div>
                      {incomeChartData.length > 0 && (
                        <div className="mt-6">
                          <h4 className="font-semibold mb-4">Monthly Comparison</h4>
                          <div className="h-48">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={incomeChartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="month" />
                                <YAxis />
                                <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, ""]} />
                                <Legend />
                                <Bar dataKey="revenue" fill="#10b981" name="Revenue" />
                                <Bar dataKey="expenses" fill="#ef4444" name="Expenses" />
                                <Bar dataKey="netIncome" fill="#3b82f6" name="Net Income" />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                } catch {
                  return <p className="text-gray-500">Invalid statement data</p>;
                }
              })()}

              {statementDetail?.type === "cash_flow" && (() => {
                try {
                  const data = JSON.parse(statementDetail.data) as CashFlowData;
                  return (
                    <div className="space-y-6">
                      <div>
                        <h4 className="font-semibold text-blue-700 dark:text-blue-400 border-b pb-2 mb-2">Operating Activities</h4>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Net Income</span>
                            <span>${(data.operating?.netIncome ?? 0).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Depreciation</span>
                            <span>${(data.operating?.depreciation ?? 0).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between font-semibold pt-2 border-t">
                            <span>Total Operating</span>
                            <span>${(data.operating?.total ?? 0).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <h4 className="font-semibold text-amber-700 dark:text-amber-400 border-b pb-2 mb-2">Investing Activities</h4>
                        <div className="flex justify-between font-semibold">
                          <span>Total Investing</span>
                          <span>${(data.investing?.total ?? 0).toLocaleString()}</span>
                        </div>
                      </div>
                      <div>
                        <h4 className="font-semibold text-purple-700 dark:text-purple-400 border-b pb-2 mb-2">Financing Activities</h4>
                        <div className="flex justify-between font-semibold">
                          <span>Total Financing</span>
                          <span>${(data.financing?.total ?? 0).toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="p-4 rounded-lg font-semibold text-lg bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                        Net Change in Cash: ${(data.netChange ?? 0).toLocaleString()}
                      </div>
                    </div>
                  );
                } catch {
                  return <p className="text-gray-500">Invalid statement data</p>;
                }
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
