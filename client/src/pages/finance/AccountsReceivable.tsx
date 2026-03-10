import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { api } from "../../api/client";
import PageHeader from "../../components/PageHeader";
import DataTable from "../../components/DataTable";
import Modal from "../../components/Modal";
import KPICard from "../../components/KPICard";
import StatusBadge from "../../components/StatusBadge";
import { FormInput } from "../../components/FormField";
import { DollarSign, TrendingUp, AlertCircle, Percent, Loader2 } from "lucide-react";

type TabId = "invoices" | "aging" | "payments";

interface CustomerInvoice {
  id: string;
  invoiceNumber: string;
  customer?: { name?: string };
  customerId?: string;
  amount: number;
  paidAmount?: number;
  status: string;
  dueDate?: string;
}

interface AgingRow {
  customerId?: string;
  customer?: string;
  current?: number;
  days31to60?: number;
  days61to90?: number;
  days90Plus?: number;
  total?: number;
}

interface Payment {
  id: string;
  paymentNumber: string;
  customer?: { name?: string };
  amount: number;
  date?: string;
  method?: string;
}

interface PaymentStatus {
  totalReceivables: number;
  collectedThisMonth: number;
  overdue: number;
  collectionRate: number;
}

export default function AccountsReceivable() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>("invoices");
  const [showReceivePayment, setShowReceivePayment] = useState<CustomerInvoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");

  const { data: paymentStatus } = useQuery({
    queryKey: ["ar-payment-status"],
    queryFn: () => api.get<PaymentStatus>("/ar/payment-status"),
  });

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery({
    queryKey: ["ar-invoices"],
    queryFn: () => api.get<CustomerInvoice[]>("/ar/invoices"),
    enabled: activeTab === "invoices",
  });

  const { data: agingData = [], isLoading: agingLoading } = useQuery({
    queryKey: ["ar-aging-report"],
    queryFn: () => api.get<AgingRow[] | { rows?: AgingRow[] }>("/ar/aging-report"),
    enabled: activeTab === "aging",
  });

  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ["ar-payments"],
    queryFn: () => api.get<Payment[]>("/ar/payments"),
    enabled: activeTab === "payments",
  });

  const receivePaymentMutation = useMutation({
    mutationFn: ({ invoiceId, amount }: { invoiceId: string; amount: number }) =>
      api.post("/ar/receive-payment", { invoiceId, amount }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ar-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["ar-payments"] });
      queryClient.invalidateQueries({ queryKey: ["ar-payment-status"] });
      setShowReceivePayment(null);
      setPaymentAmount("");
    },
  });

  const status = paymentStatus ?? {
    totalReceivables: 0,
    collectedThisMonth: 0,
    overdue: 0,
    collectionRate: 0,
  };

  const agingRows = Array.isArray(agingData) ? agingData : (agingData as { rows?: AgingRow[] })?.rows ?? [];
  const agingChartData = agingRows.slice(0, 10).map((r) => ({
    name: r.customer ?? r.customerId ?? "Unknown",
    current: r.current ?? 0,
    "31-60": r.days31to60 ?? 0,
    "61-90": r.days61to90 ?? 0,
    "90+": r.days90Plus ?? 0,
    total: r.total ?? 0,
  }));

  const handleReceivePayment = () => {
    if (!showReceivePayment || !paymentAmount) return;
    receivePaymentMutation.mutate({
      invoiceId: showReceivePayment.id,
      amount: Number(paymentAmount),
    });
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: "invoices", label: "Invoices" },
    { id: "aging", label: "Aging Report" },
    { id: "payments", label: "Payments" },
  ];

  return (
    <div>
      <PageHeader
        title="Accounts Receivable"
        breadcrumb={[{ label: "Home", path: "/" }, { label: "Finance", path: "/finance/journal-entries" }, { label: "AR" }]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard
          title="Total Receivables"
          value={`$${(status.totalReceivables ?? 0).toLocaleString()}`}
          icon={DollarSign}
          color="blue"
        />
        <KPICard
          title="Collected This Month"
          value={`$${(status.collectedThisMonth ?? 0).toLocaleString()}`}
          icon={TrendingUp}
          color="green"
        />
        <KPICard
          title="Overdue"
          value={`$${(status.overdue ?? 0).toLocaleString()}`}
          icon={AlertCircle}
          color="red"
        />
        <KPICard
          title="Collection Rate %"
          value={`${(status.collectionRate ?? 0).toFixed(1)}%`}
          icon={Percent}
          color="purple"
        />
      </div>

      <div className="card">
        <div className="border-b flex gap-1 p-2 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id ? "bg-primary-600 text-white" : "hover:bg-gray-100 text-gray-600"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "invoices" && (
          <div className="p-4">
            <DataTable<CustomerInvoice>
              columns={[
                { key: "invoiceNumber", label: "Invoice #" },
                { key: "customer", label: "Customer", render: (r) => r.customer?.name ?? r.customerId ?? "-" },
                { key: "amount", label: "Amount", render: (r) => `$${(r.amount ?? 0).toLocaleString()}` },
                { key: "paidAmount", label: "Paid Amount", render: (r) => `$${(r.paidAmount ?? 0).toLocaleString()}` },
                { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
                { key: "dueDate", label: "Due Date" },
                {
                  key: "actions",
                  label: "Actions",
                  render: (r) => (
                    <button
                      className="btn-primary btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowReceivePayment(r);
                        setPaymentAmount(String(r.amount - (r.paidAmount ?? 0)));
                      }}
                    >
                      Receive Payment
                    </button>
                  ),
                },
              ]}
              data={invoices}
              isLoading={invoicesLoading}
            />
          </div>
        )}

        {activeTab === "aging" && (
          <div className="p-6 space-y-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Customer</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-emerald-600">Current (0-30)</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-amber-600">31-60</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-orange-600">61-90</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-red-600">90+</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {agingLoading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                      </td>
                    </tr>
                  ) : (
                    agingRows.map((r, i) => (
                      <tr key={i}>
                        <td className="px-4 py-3">{r.customer ?? r.customerId ?? "-"}</td>
                        <td className="px-4 py-3 text-right text-emerald-600">${(r.current ?? 0).toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-amber-600">${(r.days31to60 ?? 0).toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-orange-600">${(r.days61to90 ?? 0).toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-red-600">${(r.days90Plus ?? 0).toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-medium">${(r.total ?? 0).toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {agingChartData.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Aging Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={agingChartData} layout="vertical" margin={{ left: 80 }}>
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                    <Legend />
                    <Bar dataKey="current" stackId="a" fill="#10b981" name="Current (0-30)" />
                    <Bar dataKey="31-60" stackId="a" fill="#f59e0b" name="31-60" />
                    <Bar dataKey="61-90" stackId="a" fill="#f97316" name="61-90" />
                    <Bar dataKey="90+" stackId="a" fill="#ef4444" name="90+" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {activeTab === "payments" && (
          <div className="p-4">
            <DataTable<Payment>
              columns={[
                { key: "paymentNumber", label: "Payment #" },
                { key: "customer", label: "Customer", render: (r) => r.customer?.name ?? "-" },
                { key: "amount", label: "Amount", render: (r) => `$${(r.amount ?? 0).toLocaleString()}` },
                { key: "date", label: "Date" },
                { key: "method", label: "Method" },
              ]}
              data={payments}
              isLoading={paymentsLoading}
            />
          </div>
        )}
      </div>

      <Modal
        isOpen={!!showReceivePayment}
        onClose={() => { setShowReceivePayment(null); setPaymentAmount(""); }}
        title="Receive Payment"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setShowReceivePayment(null)}>Cancel</button>
            <button
              className="btn-primary"
              onClick={handleReceivePayment}
              disabled={receivePaymentMutation.isPending || !paymentAmount}
            >
              {receivePaymentMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Submit
            </button>
          </>
        }
      >
        {showReceivePayment && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Invoice: {showReceivePayment.invoiceNumber} | Outstanding: $
              {(showReceivePayment.amount - (showReceivePayment.paidAmount ?? 0)).toLocaleString()}
            </p>
            <FormInput
              label="Amount"
              type="number"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
