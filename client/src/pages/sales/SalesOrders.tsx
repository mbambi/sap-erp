import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Plus, Send, Check, Truck, FileText, Trash2 } from "lucide-react";
import { api } from "../../api/client";
import DataTable from "../../components/DataTable";
import Modal from "../../components/Modal";
import PageHeader from "../../components/PageHeader";
import StatusBadge from "../../components/StatusBadge";
import { FormInput, FormSelect, FormTextArea } from "../../components/FormField";
import { useCrud } from "../../hooks/useCrud";

export default function SalesOrders() {
  const { data, pagination, isLoading, page, setPage, setSearch, invalidate } = useCrud({
    key: "sales-orders",
    endpoint: "/sales/orders",
  });

  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState<any>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);

  const [form, setForm] = useState({
    customerId: "",
    requestedDate: "",
    shippingMethod: "",
    notes: "",
    items: [{ materialId: "", quantity: 1, unitPrice: 0, discount: 0 }],
  });

  const loadFormData = async () => {
    const [c, m] = await Promise.all([
      api.get("/finance/customers"),
      api.get("/materials/items"),
    ]);
    setCustomers(c.data || []);
    setMaterials(m.data || []);
  };

  const createSO = useMutation({
    mutationFn: (data: any) => api.post("/sales/orders", data),
    onSuccess: () => { invalidate(); setShowCreate(false); },
  });

  const confirmSO = useMutation({
    mutationFn: (id: string) => api.post(`/sales/orders/${id}/confirm`),
    onSuccess: () => { invalidate(); setShowDetail(null); },
  });

  const deliverSO = useMutation({
    mutationFn: (id: string) => api.post(`/sales/orders/${id}/deliver`),
    onSuccess: () => { invalidate(); setShowDetail(null); },
  });

  const invoiceSO = useMutation({
    mutationFn: (id: string) => api.post(`/sales/orders/${id}/invoice`),
    onSuccess: () => { invalidate(); setShowDetail(null); },
  });

  const addItem = () =>
    setForm((f) => ({ ...f, items: [...f.items, { materialId: "", quantity: 1, unitPrice: 0, discount: 0 }] }));

  const removeItem = (idx: number) =>
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));

  const updateItem = (idx: number, field: string, value: any) =>
    setForm((f) => ({ ...f, items: f.items.map((item, i) => i === idx ? { ...item, [field]: value } : item) }));

  const handleCreate = () => {
    if (!form.customerId || form.items.length === 0) {
      alert("Select a customer and add at least one item");
      return;
    }
    createSO.mutate({
      customerId: form.customerId,
      requestedDate: form.requestedDate ? new Date(form.requestedDate) : undefined,
      shippingMethod: form.shippingMethod,
      notes: form.notes,
      items: form.items.map((item) => ({
        materialId: item.materialId,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        discount: Number(item.discount),
      })),
    });
  };

  const total = form.items.reduce(
    (s, i) => s + Number(i.quantity) * Number(i.unitPrice) * (1 - Number(i.discount) / 100), 0
  );

  const viewDetail = async (row: any) => {
    try {
      const detail = await api.get(`/sales/orders/${row.id}`);
      setShowDetail(detail);
    } catch {
      setShowDetail(row);
    }
  };

  return (
    <div>
      <PageHeader
        title="Sales Orders"
        subtitle="Manage customer orders"
        breadcrumb={[{ label: "Sales & Distribution" }, { label: "Sales Orders" }]}
      />

      <DataTable
        columns={[
          { key: "soNumber", label: "SO #", render: (r: any) => (
            <span className="font-mono text-sm font-medium text-primary-600">{r.soNumber}</span>
          )},
          { key: "customer", label: "Customer", render: (r: any) => r.customer?.name },
          { key: "orderDate", label: "Date", render: (r: any) => new Date(r.orderDate).toLocaleDateString() },
          { key: "items", label: "Items", render: (r: any) => r.items?.length || 0 },
          { key: "totalAmount", label: "Total", render: (r: any) => `$${(r.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
          { key: "status", label: "Status", render: (r: any) => <StatusBadge status={r.status} /> },
        ]}
        data={data}
        pagination={pagination}
        isLoading={isLoading}
        onPageChange={setPage}
        onSearch={setSearch}
        onAdd={() => { loadFormData(); setShowCreate(true); }}
        addLabel="New SO"
        onRowClick={viewDetail}
        searchPlaceholder="Search orders..."
      />

      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create Sales Order"
        size="xl"
        footer={
          <>
            <span className="text-sm font-medium text-gray-500 mr-auto">Total: ${total.toFixed(2)}</span>
            <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleCreate} disabled={createSO.isPending} className="btn-primary">
              <Send className="w-4 h-4" /> Create SO
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormSelect
              label="Customer"
              value={form.customerId}
              onChange={(e) => setForm({ ...form, customerId: e.target.value })}
              options={customers.map((c: any) => ({ value: c.id, label: `${c.customerNumber} - ${c.name}` }))}
              required
            />
            <FormInput
              label="Requested Delivery Date"
              type="date"
              value={form.requestedDate}
              onChange={(e) => setForm({ ...form, requestedDate: e.target.value })}
            />
          </div>
          <FormTextArea
            label="Notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Line Items</label>
              <button onClick={addItem} className="btn-secondary btn-sm"><Plus className="w-3 h-3" /> Add Item</button>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Material</th>
                    <th className="px-3 py-2 text-xs font-semibold w-20">Qty</th>
                    <th className="px-3 py-2 text-xs font-semibold w-24">Price</th>
                    <th className="px-3 py-2 text-xs font-semibold w-20">Disc %</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold w-24">Total</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {form.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="px-2 py-1">
                        <select
                          value={item.materialId}
                          onChange={(e) => {
                            updateItem(idx, "materialId", e.target.value);
                            const mat = materials.find((m: any) => m.id === e.target.value);
                            if (mat) updateItem(idx, "unitPrice", mat.standardPrice);
                          }}
                          className="input py-1.5 text-xs"
                        >
                          <option value="">Select...</option>
                          {materials.map((m: any) => (
                            <option key={m.id} value={m.id}>{m.materialNumber} - {m.description}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1">
                        <input type="number" value={item.quantity} onChange={(e) => updateItem(idx, "quantity", e.target.value)} className="input py-1.5 text-xs" min={1} />
                      </td>
                      <td className="px-2 py-1">
                        <input type="number" value={item.unitPrice} onChange={(e) => updateItem(idx, "unitPrice", e.target.value)} className="input py-1.5 text-xs" step="0.01" />
                      </td>
                      <td className="px-2 py-1">
                        <input type="number" value={item.discount} onChange={(e) => updateItem(idx, "discount", e.target.value)} className="input py-1.5 text-xs" min={0} max={100} />
                      </td>
                      <td className="px-2 py-1 text-right text-xs font-medium">
                        ${(Number(item.quantity) * Number(item.unitPrice) * (1 - Number(item.discount) / 100)).toFixed(2)}
                      </td>
                      <td className="px-2 py-1">
                        {form.items.length > 1 && (
                          <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!showDetail}
        onClose={() => setShowDetail(null)}
        title={`Sales Order: ${showDetail?.soNumber}`}
        size="lg"
        footer={
          <>
            {showDetail?.status === "draft" && (
              <button onClick={() => confirmSO.mutate(showDetail.id)} className="btn-success btn-sm">
                <Check className="w-3.5 h-3.5" /> Confirm
              </button>
            )}
            {["confirmed", "processing"].includes(showDetail?.status) && (
              <>
                <button onClick={() => deliverSO.mutate(showDetail.id)} className="btn-primary btn-sm">
                  <Truck className="w-3.5 h-3.5" /> Create Delivery
                </button>
                <button onClick={() => invoiceSO.mutate(showDetail.id)} className="btn-success btn-sm">
                  <FileText className="w-3.5 h-3.5" /> Create Invoice
                </button>
              </>
            )}
          </>
        }
      >
        {showDetail && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div><span className="text-gray-500">SO #:</span> <strong>{showDetail.soNumber}</strong></div>
              <div><span className="text-gray-500">Status:</span> <StatusBadge status={showDetail.status} /></div>
              <div><span className="text-gray-500">Customer:</span> {showDetail.customer?.name}</div>
              <div><span className="text-gray-500">Date:</span> {new Date(showDetail.orderDate).toLocaleDateString()}</div>
              <div><span className="text-gray-500">Total:</span> <strong>${showDetail.totalAmount?.toFixed(2)}</strong></div>
            </div>
            <table className="w-full text-sm border rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="px-3 py-2 text-left text-xs font-semibold">#</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold">Material</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold">Qty</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold">Price</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(showDetail.items || []).map((item: any) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2">{item.lineNumber}</td>
                    <td className="px-3 py-2">{item.material?.materialNumber} - {item.material?.description}</td>
                    <td className="px-3 py-2 text-right">{item.quantity}</td>
                    <td className="px-3 py-2 text-right">${item.unitPrice?.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-medium">${item.totalPrice?.toFixed(2)}</td>
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
