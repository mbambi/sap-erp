import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Send, RotateCcw, Trash2 } from "lucide-react";
import { api } from "../../api/client";
import DataTable from "../../components/DataTable";
import Modal from "../../components/Modal";
import PageHeader from "../../components/PageHeader";
import StatusBadge from "../../components/StatusBadge";
import { FormInput, FormSelect, FormTextArea } from "../../components/FormField";
import { useCrud } from "../../hooks/useCrud";

export default function JournalEntries() {
  const { data, pagination, isLoading, page, setPage, setSearch, invalidate } = useCrud({
    key: "journal-entries",
    endpoint: "/finance/journal-entries",
  });
  const queryClient = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState<any>(null);

  const [companyCodes, setCompanyCodes] = useState<any[]>([]);
  const [glAccounts, setGlAccounts] = useState<any[]>([]);

  const loadFormData = async () => {
    const [cc, gl] = await Promise.all([
      api.get("/finance/company-codes"),
      api.get("/finance/gl-accounts"),
    ]);
    setCompanyCodes(cc.data || []);
    setGlAccounts(gl.data || []);
  };

  const [form, setForm] = useState({
    companyCodeId: "",
    postingDate: new Date().toISOString().split("T")[0],
    documentDate: new Date().toISOString().split("T")[0],
    description: "",
    lineItems: [
      { glAccountId: "", debit: 0, credit: 0, description: "" },
      { glAccountId: "", debit: 0, credit: 0, description: "" },
    ],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post("/finance/journal-entries", data),
    onSuccess: () => {
      invalidate();
      setShowCreate(false);
    },
  });

  const handleCreate = () => {
    const totalDebit = form.lineItems.reduce((s, l) => s + Number(l.debit || 0), 0);
    const totalCredit = form.lineItems.reduce((s, l) => s + Number(l.credit || 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      alert(`Debits ($${totalDebit}) must equal Credits ($${totalCredit})`);
      return;
    }
    createMutation.mutate({
      ...form,
      postingDate: new Date(form.postingDate),
      documentDate: new Date(form.documentDate),
    });
  };

  const addLine = () =>
    setForm((f) => ({
      ...f,
      lineItems: [...f.lineItems, { glAccountId: "", debit: 0, credit: 0, description: "" }],
    }));

  const removeLine = (idx: number) =>
    setForm((f) => ({
      ...f,
      lineItems: f.lineItems.filter((_, i) => i !== idx),
    }));

  const updateLine = (idx: number, field: string, value: any) =>
    setForm((f) => ({
      ...f,
      lineItems: f.lineItems.map((l, i) => (i === idx ? { ...l, [field]: value } : l)),
    }));

  const totalDebit = form.lineItems.reduce((s, l) => s + Number(l.debit || 0), 0);
  const totalCredit = form.lineItems.reduce((s, l) => s + Number(l.credit || 0), 0);

  const postJE = useMutation({
    mutationFn: (id: string) => api.post(`/finance/journal-entries/${id}/post`),
    onSuccess: () => { invalidate(); setShowDetail(null); },
  });

  const reverseJE = useMutation({
    mutationFn: (id: string) => api.post(`/finance/journal-entries/${id}/reverse`),
    onSuccess: () => { invalidate(); setShowDetail(null); },
  });

  return (
    <div>
      <PageHeader
        title="Journal Entries"
        subtitle="Manage general ledger postings"
        breadcrumb={[{ label: "Finance" }, { label: "Journal Entries" }]}
      />

      <DataTable
        columns={[
          { key: "documentNumber", label: "Document #", render: (r: any) => (
            <span className="font-mono text-sm font-medium text-primary-600">{r.documentNumber}</span>
          )},
          { key: "postingDate", label: "Posting Date", render: (r: any) => new Date(r.postingDate).toLocaleDateString() },
          { key: "description", label: "Description" },
          { key: "companyCode", label: "Company Code", render: (r: any) => r.companyCode?.code },
          { key: "lineItems", label: "Lines", render: (r: any) => r.lineItems?.length || 0 },
          { key: "total", label: "Total", render: (r: any) => {
            const total = (r.lineItems || []).reduce((s: number, l: any) => s + l.debit, 0);
            return `$${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
          }},
          { key: "status", label: "Status", render: (r: any) => <StatusBadge status={r.status} /> },
        ]}
        data={data}
        pagination={pagination}
        isLoading={isLoading}
        onPageChange={setPage}
        onSearch={setSearch}
        onAdd={() => { loadFormData(); setShowCreate(true); }}
        addLabel="New Journal Entry"
        onRowClick={(row) => setShowDetail(row)}
        searchPlaceholder="Search by document # or description..."
      />

      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create Journal Entry"
        size="xl"
        footer={
          <>
            <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleCreate} disabled={createMutation.isPending} className="btn-primary">
              <Send className="w-4 h-4" /> Create Entry
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormSelect
              label="Company Code"
              value={form.companyCodeId}
              onChange={(e) => setForm({ ...form, companyCodeId: e.target.value })}
              options={companyCodes.map((c: any) => ({ value: c.id, label: `${c.code} - ${c.name}` }))}
            />
            <FormInput
              label="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormInput
              label="Posting Date"
              type="date"
              value={form.postingDate}
              onChange={(e) => setForm({ ...form, postingDate: e.target.value })}
            />
            <FormInput
              label="Document Date"
              type="date"
              value={form.documentDate}
              onChange={(e) => setForm({ ...form, documentDate: e.target.value })}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Line Items</label>
              <button onClick={addLine} className="btn-secondary btn-sm">
                <Plus className="w-3 h-3" /> Add Line
              </button>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">GL Account</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 w-28">Debit</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 w-28">Credit</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Description</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {form.lineItems.map((line, idx) => (
                    <tr key={idx}>
                      <td className="px-2 py-1">
                        <select
                          value={line.glAccountId}
                          onChange={(e) => updateLine(idx, "glAccountId", e.target.value)}
                          className="input py-1.5 text-xs"
                        >
                          <option value="">Select...</option>
                          {glAccounts.map((a: any) => (
                            <option key={a.id} value={a.id}>{a.accountNumber} - {a.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          value={line.debit || ""}
                          onChange={(e) => updateLine(idx, "debit", parseFloat(e.target.value) || 0)}
                          className="input py-1.5 text-xs w-full"
                          step="0.01"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          value={line.credit || ""}
                          onChange={(e) => updateLine(idx, "credit", parseFloat(e.target.value) || 0)}
                          className="input py-1.5 text-xs w-full"
                          step="0.01"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="text"
                          value={line.description}
                          onChange={(e) => updateLine(idx, "description", e.target.value)}
                          className="input py-1.5 text-xs"
                        />
                      </td>
                      <td className="px-2 py-1">
                        {form.lineItems.length > 2 && (
                          <button onClick={() => removeLine(idx)} className="text-red-400 hover:text-red-600">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 border-t font-medium text-xs">
                    <td className="px-3 py-2 text-right">Totals:</td>
                    <td className="px-3 py-2">${totalDebit.toFixed(2)}</td>
                    <td className="px-3 py-2">${totalCredit.toFixed(2)}</td>
                    <td className="px-3 py-2" colSpan={2}>
                      {Math.abs(totalDebit - totalCredit) < 0.01 ? (
                        <span className="text-emerald-600">Balanced</span>
                      ) : (
                        <span className="text-red-600">
                          Difference: ${Math.abs(totalDebit - totalCredit).toFixed(2)}
                        </span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!showDetail}
        onClose={() => setShowDetail(null)}
        title={`Journal Entry: ${showDetail?.documentNumber}`}
        size="lg"
        footer={
          <>
            {showDetail?.status === "draft" && (
              <button onClick={() => postJE.mutate(showDetail.id)} className="btn-success btn-sm">
                <Send className="w-3.5 h-3.5" /> Post
              </button>
            )}
            {showDetail?.status === "posted" && (
              <button onClick={() => reverseJE.mutate(showDetail.id)} className="btn-danger btn-sm">
                <RotateCcw className="w-3.5 h-3.5" /> Reverse
              </button>
            )}
          </>
        }
      >
        {showDetail && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div><span className="text-gray-500">Document #:</span> <strong>{showDetail.documentNumber}</strong></div>
              <div><span className="text-gray-500">Status:</span> <StatusBadge status={showDetail.status} /></div>
              <div><span className="text-gray-500">Posting Date:</span> {new Date(showDetail.postingDate).toLocaleDateString()}</div>
            </div>
            {showDetail.description && <p className="text-sm text-gray-600">{showDetail.description}</p>}
            <table className="w-full text-sm border rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="px-3 py-2 text-left text-xs font-semibold">#</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold">Account</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold">Debit</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold">Credit</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(showDetail.lineItems || []).map((li: any) => (
                  <tr key={li.id}>
                    <td className="px-3 py-2">{li.lineNumber}</td>
                    <td className="px-3 py-2">{li.glAccount?.accountNumber} - {li.glAccount?.name}</td>
                    <td className="px-3 py-2 text-right">{li.debit > 0 ? `$${li.debit.toFixed(2)}` : ""}</td>
                    <td className="px-3 py-2 text-right">{li.credit > 0 ? `$${li.credit.toFixed(2)}` : ""}</td>
                    <td className="px-3 py-2 text-gray-500">{li.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}
