import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { useAuthStore } from "../stores/auth";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import { FormInput, FormSelect, FormTextArea } from "../components/FormField";
import {
  Building2,
  ArrowRightLeft,
  Percent,
  LayoutDashboard,
  Plus,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

type TabId = "companies" | "transactions" | "pricing" | "consolidated";

interface Company {
  id: string;
  code: string;
  name: string;
  type: string;
  currency: string;
  country: string;
  parentId?: string | null;
  children?: Company[];
  isActive?: boolean;
}

interface IntercompanyTransaction {
  id: string;
  transactionNumber: string;
  fromCompanyCode: string;
  toCompanyCode: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
  materialId?: string | null;
  quantity?: number | null;
  notes?: string | null;
}

interface TransferPricingRule {
  id: string;
  fromCompanyCode: string;
  toCompanyCode: string;
  materialId?: string | null;
  method: string;
  markupPct?: number | null;
  fixedPrice?: number | null;
  isActive: boolean;
}

interface ConsolidatedData {
  assets: number;
  liabilities: number;
  equity: number;
  revenue: number;
  expenses: number;
  intercompanyElimination: number;
  netIncome: number;
}

const COMPANY_TYPE_COLORS: Record<string, string> = {
  factory: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  distribution: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  retail: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  holding: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
  services: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  approved: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  posted: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
};

const CARD_CLASS = "bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700";
const BTN_CLASS = "bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50";

export default function MultiCompany() {
  const queryClient = useQueryClient();
  const { hasRole } = useAuthStore();
  const isAdmin = hasRole("admin") || hasRole("instructor");

  const [activeTab, setActiveTab] = useState<TabId>("companies");
  const [showCreateCompany, setShowCreateCompany] = useState(false);
  const [showCreateTxn, setShowCreateTxn] = useState(false);
  const [showCreatePricing, setShowCreatePricing] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [editingPricingId, setEditingPricingId] = useState<string | null>(null);

  const [companyForm, setCompanyForm] = useState({
    code: "",
    name: "",
    type: "factory",
    currency: "USD",
    country: "US",
    parentId: "",
  });

  const [txnForm, setTxnForm] = useState({
    fromCompanyCode: "",
    toCompanyCode: "",
    type: "purchase",
    materialId: "",
    quantity: "",
    amount: "",
    notes: "",
  });

  const [pricingForm, setPricingForm] = useState({
    fromCompanyCode: "",
    toCompanyCode: "",
    materialId: "",
    method: "cost_plus",
    markupPct: "",
    fixedPrice: "",
    isActive: true,
  });

  const { data: companies = [], isLoading: companiesLoading } = useQuery({
    queryKey: ["multi-company", "companies"],
    queryFn: () => api.get<Company[]>("/multi-company/companies"),
    enabled: activeTab === "companies" || activeTab === "consolidated",
  });

  const { data: companyDetail } = useQuery({
    queryKey: ["multi-company", "company", selectedCompany?.id],
    queryFn: () => api.get<Company>(`/multi-company/companies/${selectedCompany!.id}`),
    enabled: !!selectedCompany?.id,
  });

  const { data: transactions = [], isLoading: txnsLoading } = useQuery({
    queryKey: ["multi-company", "transactions"],
    queryFn: () => api.get<IntercompanyTransaction[]>("/multi-company/transactions"),
    enabled: activeTab === "transactions",
  });

  const { data: pricingRules = [], isLoading: pricingLoading } = useQuery({
    queryKey: ["multi-company", "pricing-rules"],
    queryFn: () => api.get<TransferPricingRule[]>("/multi-company/pricing-rules"),
    enabled: activeTab === "pricing",
  });

  const { data: consolidated } = useQuery({
    queryKey: ["multi-company", "consolidated"],
    queryFn: () => api.get<ConsolidatedData>("/multi-company/consolidated"),
    enabled: activeTab === "consolidated",
  });

  const createCompanyMutation = useMutation({
    mutationFn: (data: Record<string, string>) =>
      api.post("/multi-company/companies", { ...data, parentId: data.parentId || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["multi-company"] });
      setShowCreateCompany(false);
      setCompanyForm({ code: "", name: "", type: "factory", currency: "USD", country: "US", parentId: "" });
    },
  });

  const createTxnMutation = useMutation({
    mutationFn: (data: Record<string, string | number>) => api.post("/multi-company/transactions", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["multi-company", "transactions"] });
      setShowCreateTxn(false);
      setTxnForm({ fromCompanyCode: "", toCompanyCode: "", type: "purchase", materialId: "", quantity: "", amount: "", notes: "" });
    },
  });

  const approveTxnMutation = useMutation({
    mutationFn: (id: string) => api.post(`/multi-company/transactions/${id}/approve`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["multi-company", "transactions"] }),
  });

  const postTxnMutation = useMutation({
    mutationFn: (id: string) => api.post(`/multi-company/transactions/${id}/post`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["multi-company", "transactions"] }),
  });

  const createPricingMutation = useMutation({
    mutationFn: (data: Record<string, string | number | boolean | null>) =>
      api.post("/multi-company/pricing-rules", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["multi-company", "pricing-rules"] });
      setShowCreatePricing(false);
      setEditingPricingId(null);
      setPricingForm({ fromCompanyCode: "", toCompanyCode: "", materialId: "", method: "cost_plus", markupPct: "", fixedPrice: "", isActive: true });
    },
  });

  const updatePricingMutation = useMutation({
    mutationFn: (params: { id: string; data: Record<string, string | number | boolean | null> }) =>
      api.put(`/multi-company/pricing-rules/${params.id}`, params.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["multi-company", "pricing-rules"] });
      setEditingPricingId(null);
    },
  });

  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: "companies", label: "Companies", icon: Building2 },
    { id: "transactions", label: "Intercompany Transactions", icon: ArrowRightLeft },
    { id: "pricing", label: "Transfer Pricing", icon: Percent },
    { id: "consolidated", label: "Consolidated View", icon: LayoutDashboard },
  ];

  const companyOptions = companies.map((c) => ({ value: c.code, label: `${c.code} - ${c.name}` }));
  const typeOptions = [
    { value: "factory", label: "Factory" },
    { value: "distribution", label: "Distribution" },
    { value: "retail", label: "Retail" },
    { value: "holding", label: "Holding" },
    { value: "services", label: "Services" },
  ];

  const consolidatedData = consolidated ?? {
    assets: 0,
    liabilities: 0,
    equity: 0,
    revenue: 0,
    expenses: 0,
    intercompanyElimination: 0,
    netIncome: 0,
  };

  const pieData = companies.length > 0
    ? companies.map((c) => ({
        name: c.name,
        value: consolidatedData.revenue > 0 ? Math.max(0, consolidatedData.revenue / companies.length) : 0,
      })).filter((d) => d.value > 0)
    : [{ name: "Total", value: consolidatedData.revenue }].filter((d) => d.value > 0);

  const COLORS = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4"];

  return (
    <div>
      <PageHeader title="Multi-Company Management" subtitle="Manage companies, intercompany transactions, and consolidated view" />

      <div className={`${CARD_CLASS} overflow-hidden`}>
        <div className="border-b border-gray-200 dark:border-gray-700 flex gap-1 p-2 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? "bg-blue-600 text-white"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Companies Tab */}
        {activeTab === "companies" && (
          <div className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Companies</h3>
              {isAdmin && (
                <button onClick={() => setShowCreateCompany(true)} className={`${BTN_CLASS} flex items-center gap-2`}>
                  <Plus className="w-4 h-4" /> Create Company
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Code</th>
                    <th className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Name</th>
                    <th className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Type</th>
                    <th className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Currency</th>
                    <th className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Country</th>
                    <th className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {companiesLoading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                      </td>
                    </tr>
                  ) : (
                    companies.map((c) => (
                      <tr
                        key={c.id}
                        onClick={() => setSelectedCompany(c)}
                        className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                      >
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{c.code}</td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{c.name}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${COMPANY_TYPE_COLORS[c.type] ?? "bg-gray-100 text-gray-800"}`}>
                            {c.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{c.currency}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{c.country}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs ${c.isActive !== false ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"}`}>
                            {c.isActive !== false ? "Active" : "Inactive"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {selectedCompany && (
              <div className={`${CARD_CLASS} mt-4 p-4`}>
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white">
                      {companyDetail?.name ?? selectedCompany.name} ({selectedCompany.code})
                    </h4>
                    <p className="text-sm text-gray-500 mt-1">
                      {companyDetail?.children?.length ? `${companyDetail.children.length} child companies` : "No child companies"}
                    </p>
                  </div>
                  <button onClick={() => setSelectedCompany(null)} className="text-gray-400 hover:text-gray-600">×</button>
                </div>
                {companyDetail?.children && companyDetail.children.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {companyDetail.children.map((child) => (
                      <div key={child.id} className="flex items-center gap-2 py-2 border-t border-gray-100 dark:border-gray-700">
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                        <span className="font-medium">{child.code}</span>
                        <span className="text-gray-600 dark:text-gray-400">- {child.name}</span>
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs ${COMPANY_TYPE_COLORS[child.type] ?? ""}`}>{child.type}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Intercompany Transactions Tab */}
        {activeTab === "transactions" && (
          <div className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Intercompany Transactions</h3>
              <button onClick={() => setShowCreateTxn(true)} className={`${BTN_CLASS} flex items-center gap-2`}>
                <Plus className="w-4 h-4" /> Create Transaction
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Txn #</th>
                    <th className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">From → To</th>
                    <th className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Type</th>
                    <th className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Amount</th>
                    <th className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Status</th>
                    {isAdmin && <th className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {txnsLoading ? (
                    <tr>
                      <td colSpan={isAdmin ? 6 : 5} className="px-4 py-8 text-center">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                      </td>
                    </tr>
                  ) : (
                    transactions.map((t) => (
                      <tr key={t.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{t.transactionNumber}</td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                          {t.fromCompanyCode} <ChevronRight className="w-3 h-3 inline" /> {t.toCompanyCode}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{t.type}</td>
                        <td className="px-4 py-3 font-medium">{t.currency} {(t.amount ?? 0).toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[t.status] ?? "bg-gray-100 text-gray-700"}`}>
                            {t.status}
                          </span>
                        </td>
                        {isAdmin && (
                          <td className="px-4 py-3 flex gap-2">
                            {t.status === "draft" && (
                              <button
                                onClick={() => approveTxnMutation.mutate(t.id)}
                                disabled={approveTxnMutation.isPending}
                                className="px-3 py-1 rounded-lg bg-amber-100 text-amber-800 hover:bg-amber-200 text-xs font-medium"
                              >
                                Approve
                              </button>
                            )}
                            {t.status === "approved" && (
                              <button
                                onClick={() => postTxnMutation.mutate(t.id)}
                                disabled={postTxnMutation.isPending}
                                className="px-3 py-1 rounded-lg bg-emerald-100 text-emerald-800 hover:bg-emerald-200 text-xs font-medium"
                              >
                                Post
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Transfer Pricing Tab */}
        {activeTab === "pricing" && (
          <div className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Transfer Pricing Rules</h3>
              {isAdmin && (
                <button onClick={() => setShowCreatePricing(true)} className={`${BTN_CLASS} flex items-center gap-2`}>
                  <Plus className="w-4 h-4" /> Create Rule
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">From → To</th>
                    <th className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Material</th>
                    <th className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Method</th>
                    <th className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Markup %</th>
                    <th className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Fixed Price</th>
                    <th className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Active</th>
                    {isAdmin && <th className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {pricingLoading ? (
                    <tr>
                      <td colSpan={isAdmin ? 7 : 6} className="px-4 py-8 text-center">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                      </td>
                    </tr>
                  ) : (
                    pricingRules.map((r) => (
                      <tr key={r.id} className="border-b border-gray-100 dark:border-gray-700">
                        <td className="px-4 py-3 font-medium">{r.fromCompanyCode} → {r.toCompanyCode}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{r.materialId ?? "-"}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{r.method}</td>
                        <td className="px-4 py-3">{r.markupPct != null ? `${r.markupPct}%` : "-"}</td>
                        <td className="px-4 py-3">{r.fixedPrice != null ? r.fixedPrice.toLocaleString() : "-"}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs ${r.isActive ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"}`}>
                            {r.isActive ? "Yes" : "No"}
                          </span>
                        </td>
                        {isAdmin && (
                          <td className="px-4 py-3">
                            <button
                              onClick={() => {
                                setEditingPricingId(r.id);
                                setPricingForm({
                                  fromCompanyCode: r.fromCompanyCode,
                                  toCompanyCode: r.toCompanyCode,
                                  materialId: r.materialId ?? "",
                                  method: r.method,
                                  markupPct: r.markupPct != null ? String(r.markupPct) : "",
                                  fixedPrice: r.fixedPrice != null ? String(r.fixedPrice) : "",
                                  isActive: r.isActive,
                                });
                              }}
                              className="text-blue-600 hover:text-blue-700 text-xs font-medium"
                            >
                              Edit
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Consolidated Tab */}
        {activeTab === "consolidated" && (
          <div className="p-4 space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className={`${CARD_CLASS} p-4`}>
                <p className="text-sm text-gray-500 dark:text-gray-400">Revenue</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">${consolidatedData.revenue.toLocaleString()}</p>
              </div>
              <div className={`${CARD_CLASS} p-4`}>
                <p className="text-sm text-gray-500 dark:text-gray-400">Expenses</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">${consolidatedData.expenses.toLocaleString()}</p>
              </div>
              <div className={`${CARD_CLASS} p-4`}>
                <p className="text-sm text-gray-500 dark:text-gray-400">Assets</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">${consolidatedData.assets.toLocaleString()}</p>
              </div>
              <div className={`${CARD_CLASS} p-4`}>
                <p className="text-sm text-gray-500 dark:text-gray-400">Liabilities</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">${consolidatedData.liabilities.toLocaleString()}</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className={`${CARD_CLASS} p-4`}>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Per-Company Breakdown</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="px-3 py-2 text-left text-gray-500 dark:text-gray-400">Item</th>
                        <th className="px-3 py-2 text-right text-gray-500 dark:text-gray-400">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-gray-100 dark:border-gray-700">
                        <td className="px-3 py-2 text-gray-700 dark:text-gray-300">Revenue</td>
                        <td className="px-3 py-2 text-right font-medium">${consolidatedData.revenue.toLocaleString()}</td>
                      </tr>
                      <tr className="border-b border-gray-100 dark:border-gray-700">
                        <td className="px-3 py-2 text-gray-700 dark:text-gray-300">Expenses</td>
                        <td className="px-3 py-2 text-right font-medium">${consolidatedData.expenses.toLocaleString()}</td>
                      </tr>
                      <tr className="border-b border-gray-100 dark:border-gray-700 bg-red-50 dark:bg-red-900/20">
                        <td className="px-3 py-2 font-medium text-red-700 dark:text-red-400">Intercompany Elimination</td>
                        <td className="px-3 py-2 text-right font-medium text-red-700 dark:text-red-400">${consolidatedData.intercompanyElimination.toLocaleString()}</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-semibold text-gray-900 dark:text-white">Net Income</td>
                        <td className="px-3 py-2 text-right font-semibold">${consolidatedData.netIncome.toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div className={`${CARD_CLASS} p-4`}>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Revenue Distribution by Company</h4>
                {pieData.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                          nameKey="name"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {pieData.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, "Revenue"]} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-sm py-8 text-center">No revenue data to display</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Company Modal */}
      <Modal
        isOpen={showCreateCompany}
        onClose={() => setShowCreateCompany(false)}
        title="Create Company"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setShowCreateCompany(false)}>Cancel</button>
            <button
              className={BTN_CLASS}
              onClick={() => createCompanyMutation.mutate(companyForm)}
              disabled={createCompanyMutation.isPending || !companyForm.code || !companyForm.name}
            >
              {createCompanyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <FormInput label="Code" value={companyForm.code} onChange={(e) => setCompanyForm((f) => ({ ...f, code: e.target.value }))} required />
          <FormInput label="Name" value={companyForm.name} onChange={(e) => setCompanyForm((f) => ({ ...f, name: e.target.value }))} required />
          <FormSelect label="Type" value={companyForm.type} onChange={(e) => setCompanyForm((f) => ({ ...f, type: e.target.value }))} options={typeOptions} />
          <FormInput label="Currency" value={companyForm.currency} onChange={(e) => setCompanyForm((f) => ({ ...f, currency: e.target.value }))} />
          <FormInput label="Country" value={companyForm.country} onChange={(e) => setCompanyForm((f) => ({ ...f, country: e.target.value }))} />
          <FormSelect label="Parent Company" value={companyForm.parentId} onChange={(e) => setCompanyForm((f) => ({ ...f, parentId: e.target.value }))} options={[{ value: "", label: "None" }, ...companyOptions]} />
        </div>
      </Modal>

      {/* Create Transaction Modal */}
      <Modal
        isOpen={showCreateTxn}
        onClose={() => setShowCreateTxn(false)}
        title="Create Intercompany Transaction"
        size="lg"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setShowCreateTxn(false)}>Cancel</button>
            <button
              className={BTN_CLASS}
              onClick={() => createTxnMutation.mutate({
                fromCompanyCode: txnForm.fromCompanyCode,
                toCompanyCode: txnForm.toCompanyCode,
                type: txnForm.type,
                materialId: txnForm.materialId || undefined,
                quantity: txnForm.quantity ? Number(txnForm.quantity) : undefined,
                amount: Number(txnForm.amount),
                notes: txnForm.notes || undefined,
              })}
              disabled={createTxnMutation.isPending || !txnForm.fromCompanyCode || !txnForm.toCompanyCode || !txnForm.amount}
            >
              {createTxnMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <FormSelect label="From Company" value={txnForm.fromCompanyCode} onChange={(e) => setTxnForm((f) => ({ ...f, fromCompanyCode: e.target.value }))} options={companyOptions} />
          <FormSelect label="To Company" value={txnForm.toCompanyCode} onChange={(e) => setTxnForm((f) => ({ ...f, toCompanyCode: e.target.value }))} options={companyOptions} />
          <FormSelect
            label="Type"
            value={txnForm.type}
            onChange={(e) => setTxnForm((f) => ({ ...f, type: e.target.value }))}
            options={[
              { value: "purchase", label: "Purchase" },
              { value: "transfer", label: "Transfer" },
              { value: "service", label: "Service" },
            ]}
          />
          <FormInput label="Material ID (optional)" value={txnForm.materialId} onChange={(e) => setTxnForm((f) => ({ ...f, materialId: e.target.value }))} />
          <FormInput label="Quantity" type="number" value={txnForm.quantity} onChange={(e) => setTxnForm((f) => ({ ...f, quantity: e.target.value }))} />
          <FormInput label="Amount" type="number" value={txnForm.amount} onChange={(e) => setTxnForm((f) => ({ ...f, amount: e.target.value }))} required />
          <FormTextArea label="Notes" value={txnForm.notes} onChange={(e) => setTxnForm((f) => ({ ...f, notes: e.target.value }))} />
        </div>
      </Modal>

      {/* Create/Edit Pricing Modal */}
      <Modal
        isOpen={showCreatePricing || !!editingPricingId}
        onClose={() => { setShowCreatePricing(false); setEditingPricingId(null); }}
        title={editingPricingId ? "Edit Transfer Pricing Rule" : "Create Transfer Pricing Rule"}
        footer={
          <>
            <button className="btn-secondary" onClick={() => { setShowCreatePricing(false); setEditingPricingId(null); }}>Cancel</button>
            <button
              className={BTN_CLASS}
              onClick={() => {
                if (editingPricingId) {
                  updatePricingMutation.mutate({
                    id: editingPricingId,
                    data: {
                      method: pricingForm.method,
                      markupPct: pricingForm.markupPct ? Number(pricingForm.markupPct) : null,
                      fixedPrice: pricingForm.fixedPrice ? Number(pricingForm.fixedPrice) : null,
                      isActive: pricingForm.isActive,
                    },
                  });
                } else {
                  createPricingMutation.mutate({
                    fromCompanyCode: pricingForm.fromCompanyCode,
                    toCompanyCode: pricingForm.toCompanyCode,
                    materialId: pricingForm.materialId || null,
                    method: pricingForm.method,
                    markupPct: pricingForm.markupPct ? Number(pricingForm.markupPct) : null,
                    fixedPrice: pricingForm.fixedPrice ? Number(pricingForm.fixedPrice) : null,
                  });
                }
              }}
              disabled={(createPricingMutation.isPending || updatePricingMutation.isPending) || (!editingPricingId && (!pricingForm.fromCompanyCode || !pricingForm.toCompanyCode))}
            >
              {(createPricingMutation.isPending || updatePricingMutation.isPending) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {editingPricingId ? "Update" : "Create"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <FormSelect label="From Company" value={pricingForm.fromCompanyCode} onChange={(e) => setPricingForm((f) => ({ ...f, fromCompanyCode: e.target.value }))} options={companyOptions} disabled={!!editingPricingId} />
          <FormSelect label="To Company" value={pricingForm.toCompanyCode} onChange={(e) => setPricingForm((f) => ({ ...f, toCompanyCode: e.target.value }))} options={companyOptions} disabled={!!editingPricingId} />
          <FormInput label="Material ID (optional)" value={pricingForm.materialId} onChange={(e) => setPricingForm((f) => ({ ...f, materialId: e.target.value }))} />
          <FormSelect
            label="Method"
            value={pricingForm.method}
            onChange={(e) => setPricingForm((f) => ({ ...f, method: e.target.value }))}
            options={[
              { value: "cost_plus", label: "Cost Plus" },
              { value: "market_price", label: "Market Price" },
              { value: "negotiated", label: "Negotiated" },
              { value: "resale_minus", label: "Resale Minus" },
            ]}
          />
          <FormInput label="Markup %" type="number" value={pricingForm.markupPct} onChange={(e) => setPricingForm((f) => ({ ...f, markupPct: e.target.value }))} />
          <FormInput label="Fixed Price" type="number" value={pricingForm.fixedPrice} onChange={(e) => setPricingForm((f) => ({ ...f, fixedPrice: e.target.value }))} />
          {editingPricingId && (
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={pricingForm.isActive} onChange={(e) => setPricingForm((f) => ({ ...f, isActive: e.target.checked }))} />
              <span className="text-sm text-gray-700 dark:text-gray-300">Active</span>
            </label>
          )}
        </div>
      </Modal>
    </div>
  );
}
