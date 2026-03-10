import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import PageHeader from "../../components/PageHeader";
import DataTable from "../../components/DataTable";
import Modal from "../../components/Modal";
import KPICard from "../../components/KPICard";
import StatusBadge from "../../components/StatusBadge";
import { FormInput, FormSelect } from "../../components/FormField";
import {
  FileText,
  DollarSign,
  AlertCircle,
  Calendar,
  Plus,
  CheckCircle,
  ShoppingCart,
  Loader2,
  CreditCard,
} from "lucide-react";

type TabId = "pr" | "invoices" | "payments" | "vendor-balance";

interface PurchaseRequisition {
  id: string;
  prNumber: string;
  description: string;
  quantity: number;
  status: string;
  requestedBy?: string;
  date?: string;
}

interface SupplierInvoice {
  id: string;
  invoiceNumber: string;
  vendor?: { name?: string };
  vendorId?: string;
  amount: number;
  matchStatus?: string;
  status: string;
  dueDate?: string;
}

interface Payment {
  id: string;
  paymentNumber: string;
  vendor?: { name?: string };
  amount: number;
  date?: string;
  status: string;
}

interface Vendor {
  id: string;
  name: string;
}

export default function AccountsPayable() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>("pr");
  const [showCreatePR, setShowCreatePR] = useState(false);
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [showPaymentRun, setShowPaymentRun] = useState(false);
  const [matchResult, setMatchResult] = useState<{ invoiceId: string; result?: unknown } | null>(null);
  const [paymentRunResult, setPaymentRunResult] = useState<unknown>(null);
  const [selectedVendor, setSelectedVendor] = useState("");
  const [vendorBalance, setVendorBalance] = useState<number | null>(null);

  const [prForm, setPrForm] = useState({
    description: "",
    materialId: "",
    quantity: "",
    estimatedPrice: "",
    vendorId: "",
  });
  const [invoiceForm, setInvoiceForm] = useState({
    vendorId: "",
    amount: "",
    invoiceNumber: "",
    dueDate: "",
  });

  const { data: apSummary } = useQuery({
    queryKey: ["ap-summary"],
    queryFn: () => api.get<{ openInvoices: number; totalPayables: number; overdueAmount: number; paymentRunDue: number }>("/ap/summary"),
  });

  const { data: prs = [], isLoading: prsLoading } = useQuery({
    queryKey: ["ap-purchase-requisitions"],
    queryFn: () => api.get<PurchaseRequisition[]>("/ap/purchase-requisitions"),
    enabled: activeTab === "pr",
  });

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery({
    queryKey: ["ap-supplier-invoices"],
    queryFn: () => api.get<SupplierInvoice[]>("/ap/supplier-invoices"),
    enabled: activeTab === "invoices",
  });

  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ["ap-payments"],
    queryFn: () => api.get<Payment[]>("/ap/payments"),
    enabled: activeTab === "payments",
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors-list"],
    queryFn: () => api.get<{ data?: Vendor[] }>("/finance/vendors").then((r) => r.data ?? r),
  });
  const vendorList = Array.isArray(vendors) ? vendors : (vendors as { data?: Vendor[] })?.data ?? [];

  const createPRMutation = useMutation({
    mutationFn: (data: Record<string, string | number>) => api.post("/ap/purchase-requisitions", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ap-purchase-requisitions"] });
      setShowCreatePR(false);
      setPrForm({ description: "", materialId: "", quantity: "", estimatedPrice: "", vendorId: "" });
    },
  });

  const createInvoiceMutation = useMutation({
    mutationFn: (data: Record<string, string | number>) => api.post("/ap/supplier-invoices", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ap-supplier-invoices"] });
      setShowCreateInvoice(false);
      setInvoiceForm({ vendorId: "", amount: "", invoiceNumber: "", dueDate: "" });
    },
  });

  const matchMutation = useMutation({
    mutationFn: (id: string) => api.post(`/ap/supplier-invoices/${id}/match`),
    onSuccess: (result, id) => {
      setMatchResult({ invoiceId: id, result });
      queryClient.invalidateQueries({ queryKey: ["ap-supplier-invoices"] });
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/ap/supplier-invoices/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ap-supplier-invoices"] });
    },
  });

  const paymentRunMutation = useMutation({
    mutationFn: () => api.post("/ap/payment-run"),
    onSuccess: (result) => {
      setPaymentRunResult(result);
      queryClient.invalidateQueries({ queryKey: ["ap-payments"] });
    },
  });

  const fetchVendorBalance = () => {
    if (!selectedVendor) return;
    api.get<{ balance: number }>(`/ap/vendor-balance`, { vendorId: selectedVendor }).then((r) => {
      setVendorBalance(r.balance ?? 0);
    }).catch(() => setVendorBalance(null));
  };

  const summary = apSummary ?? { openInvoices: 0, totalPayables: 0, overdueAmount: 0, paymentRunDue: 0 };

  const tabs: { id: TabId; label: string }[] = [
    { id: "pr", label: "Purchase Requisitions" },
    { id: "invoices", label: "Supplier Invoices" },
    { id: "payments", label: "Payments" },
    { id: "vendor-balance", label: "Vendor Balance" },
  ];

  return (
    <div>
      <PageHeader
        title="Accounts Payable"
        breadcrumb={[{ label: "Home", path: "/" }, { label: "Finance", path: "/finance/journal-entries" }, { label: "AP" }]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard
          title="Open Invoices"
          value={summary.openInvoices ?? 0}
          icon={FileText}
          color="blue"
        />
        <KPICard
          title="Total Payables"
          value={`$${(summary.totalPayables ?? 0).toLocaleString()}`}
          icon={DollarSign}
          color="green"
        />
        <KPICard
          title="Overdue Amount"
          value={`$${(summary.overdueAmount ?? 0).toLocaleString()}`}
          icon={AlertCircle}
          color="red"
        />
        <KPICard
          title="Payment Run Due"
          value={summary.paymentRunDue ?? 0}
          icon={Calendar}
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

        {activeTab === "pr" && (
          <div className="p-4">
            <DataTable<PurchaseRequisition>
              columns={[
                { key: "prNumber", label: "PR Number" },
                { key: "description", label: "Description" },
                { key: "quantity", label: "Quantity", render: (r) => r.quantity?.toLocaleString() ?? "-" },
                { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
                { key: "requestedBy", label: "Requested By" },
                { key: "date", label: "Date" },
                {
                  key: "actions",
                  label: "Actions",
                  render: (r) => (
                    <div className="flex gap-2">
                      <button className="btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); }}>Approve</button>
                      <button className="btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); }}>Convert to PO</button>
                    </div>
                  ),
                },
              ]}
              data={prs}
              isLoading={prsLoading}
              onAdd={() => setShowCreatePR(true)}
              addLabel="Create PR"
            />
          </div>
        )}

        {activeTab === "invoices" && (
          <div className="p-4">
            <DataTable<SupplierInvoice>
              columns={[
                { key: "invoiceNumber", label: "Invoice #" },
                { key: "vendor", label: "Vendor", render: (r) => r.vendor?.name ?? r.vendorId ?? "-" },
                { key: "amount", label: "Amount", render: (r) => `$${(r.amount ?? 0).toLocaleString()}` },
                { key: "matchStatus", label: "Match Status", render: (r) => <StatusBadge status={r.matchStatus ?? "pending"} /> },
                { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
                { key: "dueDate", label: "Due Date" },
                {
                  key: "actions",
                  label: "Actions",
                  render: (r) => (
                    <div className="flex gap-2">
                      <button
                        className="btn-secondary btn-sm"
                        onClick={(e) => { e.stopPropagation(); matchMutation.mutate(r.id); }}
                        disabled={matchMutation.isPending}
                      >
                        {matchMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                        3-Way Match
                      </button>
                      <button
                        className="btn-primary btn-sm"
                        onClick={(e) => { e.stopPropagation(); approveMutation.mutate(r.id); }}
                        disabled={approveMutation.isPending}
                      >
                        Approve
                      </button>
                    </div>
                  ),
                },
              ]}
              data={invoices}
              isLoading={invoicesLoading}
              onAdd={() => setShowCreateInvoice(true)}
              addLabel="Create Invoice"
            />
          </div>
        )}

        {activeTab === "payments" && (
          <div className="p-4">
            <DataTable<Payment>
              columns={[
                { key: "paymentNumber", label: "Payment #" },
                { key: "vendor", label: "Vendor", render: (r) => r.vendor?.name ?? "-" },
                { key: "amount", label: "Amount", render: (r) => `$${(r.amount ?? 0).toLocaleString()}` },
                { key: "date", label: "Date" },
                { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
              ]}
              data={payments}
              isLoading={paymentsLoading}
              actions={
                <button
                  className="btn-primary btn-sm"
                  onClick={() => paymentRunMutation.mutate()}
                  disabled={paymentRunMutation.isPending}
                >
                  {paymentRunMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />}
                  Run Payment
                </button>
              }
            />
          </div>
        )}

        {activeTab === "vendor-balance" && (
          <div className="p-6">
            <div className="flex gap-4 items-end mb-6">
              <div className="flex-1 max-w-xs">
                <label className="label">Select Vendor</label>
                <select
                  value={selectedVendor}
                  onChange={(e) => setSelectedVendor(e.target.value)}
                  className="input"
                >
                  <option value="">Select vendor...</option>
                  {vendorList.map((v: Vendor) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
              <button className="btn-primary" onClick={fetchVendorBalance}>
                Get Balance
              </button>
            </div>
            {vendorBalance !== null && (
              <div className="card p-6 max-w-md">
                <p className="text-sm text-gray-500">Balance (open invoices - payments)</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">${vendorBalance.toLocaleString()}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <Modal
        isOpen={showCreatePR}
        onClose={() => setShowCreatePR(false)}
        title="Create Purchase Requisition"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setShowCreatePR(false)}>Cancel</button>
            <button
              className="btn-primary"
              onClick={() => createPRMutation.mutate({
                description: prForm.description,
                materialId: prForm.materialId || undefined,
                quantity: Number(prForm.quantity) || 0,
                estimatedPrice: Number(prForm.estimatedPrice) || 0,
                vendorId: prForm.vendorId || undefined,
              })}
              disabled={createPRMutation.isPending || !prForm.description}
            >
              {createPRMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <FormInput label="Description" value={prForm.description} onChange={(e) => setPrForm((f) => ({ ...f, description: e.target.value }))} required />
          <FormInput label="Material ID (optional)" value={prForm.materialId} onChange={(e) => setPrForm((f) => ({ ...f, materialId: e.target.value }))} />
          <FormInput label="Quantity" type="number" value={prForm.quantity} onChange={(e) => setPrForm((f) => ({ ...f, quantity: e.target.value }))} />
          <FormInput label="Estimated Price" type="number" value={prForm.estimatedPrice} onChange={(e) => setPrForm((f) => ({ ...f, estimatedPrice: e.target.value }))} />
          <FormSelect
            label="Vendor (optional)"
            value={prForm.vendorId}
            onChange={(e) => setPrForm((f) => ({ ...f, vendorId: e.target.value }))}
            options={vendorList.map((v: Vendor) => ({ value: v.id, label: v.name }))}
          />
        </div>
      </Modal>

      <Modal
        isOpen={showCreateInvoice}
        onClose={() => setShowCreateInvoice(false)}
        title="Create Supplier Invoice"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setShowCreateInvoice(false)}>Cancel</button>
            <button
              className="btn-primary"
              onClick={() => createInvoiceMutation.mutate({
                vendorId: invoiceForm.vendorId,
                amount: Number(invoiceForm.amount),
                invoiceNumber: invoiceForm.invoiceNumber,
                dueDate: invoiceForm.dueDate,
              })}
              disabled={createInvoiceMutation.isPending || !invoiceForm.vendorId || !invoiceForm.amount}
            >
              {createInvoiceMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <FormSelect
            label="Vendor"
            value={invoiceForm.vendorId}
            onChange={(e) => setInvoiceForm((f) => ({ ...f, vendorId: e.target.value }))}
            options={vendorList.map((v: Vendor) => ({ value: v.id, label: v.name }))}
          />
          <FormInput label="Invoice Number" value={invoiceForm.invoiceNumber} onChange={(e) => setInvoiceForm((f) => ({ ...f, invoiceNumber: e.target.value }))} />
          <FormInput label="Amount" type="number" value={invoiceForm.amount} onChange={(e) => setInvoiceForm((f) => ({ ...f, amount: e.target.value }))} required />
          <FormInput label="Due Date" type="date" value={invoiceForm.dueDate} onChange={(e) => setInvoiceForm((f) => ({ ...f, dueDate: e.target.value }))} />
        </div>
      </Modal>

      <Modal
        isOpen={!!matchResult}
        onClose={() => setMatchResult(null)}
        title="3-Way Match Result"
      >
        <pre className="text-sm bg-gray-50 p-4 rounded-lg overflow-auto max-h-64">
          {JSON.stringify(matchResult?.result ?? {}, null, 2)}
        </pre>
      </Modal>

      <Modal
        isOpen={!!paymentRunResult}
        onClose={() => setPaymentRunResult(null)}
        title="Payment Run Results"
        size="lg"
      >
        <pre className="text-sm bg-gray-50 p-4 rounded-lg overflow-auto max-h-64">
          {JSON.stringify(paymentRunResult ?? {}, null, 2)}
        </pre>
      </Modal>
    </div>
  );
}
