import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Plus, Send, Check, Truck, Trash2 } from "lucide-react";
import { api } from "../../api/client";
import DataTable from "../../components/DataTable";
import Modal from "../../components/Modal";
import PageHeader from "../../components/PageHeader";
import StatusBadge from "../../components/StatusBadge";
import { FormInput, FormSelect, FormTextArea } from "../../components/FormField";
import { useCrud } from "../../hooks/useCrud";

export default function PurchaseOrders() {
  const { data, pagination, isLoading, page, setPage, setSearch, invalidate } = useCrud({
    key: "purchase-orders",
    endpoint: "/materials/purchase-orders",
  });

  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState<any>(null);
  const [vendors, setVendors] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);

  const [form, setForm] = useState({
    vendorId: "",
    deliveryDate: "",
    paymentTerms: "NET30",
    notes: "",
    items: [{ materialId: "", quantity: 1, unitPrice: 0 }],
  });

  const loadFormData = async () => {
    const [v, m] = await Promise.all([
      api.get("/finance/vendors"),
      api.get("/materials/items"),
    ]);
    setVendors(v.data || []);
    setMaterials(m.data || []);
  };

  const createPO = useMutation({
    mutationFn: (data: any) => api.post("/materials/purchase-orders", data),
    onSuccess: () => { invalidate(); setShowCreate(false); },
  });

  const approvePO = useMutation({
    mutationFn: (id: string) => api.post(`/materials/purchase-orders/${id}/approve`),
    onSuccess: () => { invalidate(); setShowDetail(null); },
  });

  const receiveGoods = useMutation({
    mutationFn: (id: string) => api.post(`/materials/purchase-orders/${id}/goods-receipt`, {}),
    onSuccess: () => { invalidate(); setShowDetail(null); },
  });

  const addItem = () =>
    setForm((f) => ({ ...f, items: [...f.items, { materialId: "", quantity: 1, unitPrice: 0 }] }));

  const removeItem = (idx: number) =>
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));

  const updateItem = (idx: number, field: string, value: any) =>
    setForm((f) => ({ ...f, items: f.items.map((item, i) => i === idx ? { ...item, [field]: value } : item) }));

  const handleCreate = () => {
    if (!form.vendorId || form.items.length === 0) {
      alert("Select a vendor and add at least one item");
      return;
    }
    createPO.mutate({
      vendorId: form.vendorId,
      deliveryDate: form.deliveryDate ? new Date(form.deliveryDate) : undefined,
      paymentTerms: form.paymentTerms,
      notes: form.notes,
      items: form.items.map((item) => ({
        materialId: item.materialId,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
      })),
    });
  };

  const total = form.items.reduce((s, i) => s + Number(i.quantity) * Number(i.unitPrice), 0);

  const viewDetail = async (row: any) => {
    try {
      const detail = await api.get(`/materials/purchase-orders/${row.id}`);
      setShowDetail(detail);
    } catch {
      setShowDetail(row);
    }
  };

  return (
    <div>
      <PageHeader
        title="Purchase Orders"
        subtitle="Manage procurement orders"
        breadcrumb={[{ label: "Materials Management" }, { label: "Purchase Orders" }]}
      />

      <DataTable
        columns={[
          { key: "poNumber", label: "PO #", render: (r: any) => (
            <span className="font-mono text-sm font-medium text-primary-600">{r.poNumber}</span>
          )},
          { key: "vendor", label: "Vendor", render: (r: any) => r.vendor?.name },
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
        addLabel="New PO"
        onRowClick={viewDetail}
        searchPlaceholder="Search POs..."
      />

      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create Purchase Order"
        size="xl"
        footer={
          <>
            <span className="text-sm font-medium text-gray-500 mr-auto">
              Total: ${total.toFixed(2)}
            </span>
            <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleCreate} disabled={createPO.isPending} className="btn-primary">
              <Send className="w-4 h-4" /> Create PO
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormSelect
              label="Vendor"
              value={form.vendorId}
              onChange={(e) => setForm({ ...form, vendorId: e.target.value })}
              options={vendors.map((v: any) => ({ value: v.id, label: `${v.vendorNumber} - ${v.name}` }))}
              required
            />
            <FormInput
              label="Expected Delivery"
              type="date"
              value={form.deliveryDate}
              onChange={(e) => setForm({ ...form, deliveryDate: e.target.value })}
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
              <button onClick={addItem} className="btn-secondary btn-sm">
                <Plus className="w-3 h-3" /> Add Item
              </button>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Material</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 w-24">Qty</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 w-28">Unit Price</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 w-28">Total</th>
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
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItem(idx, "quantity", e.target.value)}
                          className="input py-1.5 text-xs"
                          min={1}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(idx, "unitPrice", e.target.value)}
                          className="input py-1.5 text-xs"
                          step="0.01"
                        />
                      </td>
                      <td className="px-2 py-1 text-right text-xs font-medium">
                        ${(Number(item.quantity) * Number(item.unitPrice)).toFixed(2)}
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
        title={`Purchase Order: ${showDetail?.poNumber}`}
        size="lg"
        footer={
          <>
            {showDetail?.status === "draft" && (
              <button onClick={() => approvePO.mutate(showDetail.id)} className="btn-success btn-sm">
                <Check className="w-3.5 h-3.5" /> Approve
              </button>
            )}
            {["approved", "ordered"].includes(showDetail?.status) && (
              <button onClick={() => receiveGoods.mutate(showDetail.id)} className="btn-primary btn-sm">
                <Truck className="w-3.5 h-3.5" /> Goods Receipt
              </button>
            )}
          </>
        }
      >
        {showDetail && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div><span className="text-gray-500">PO #:</span> <strong>{showDetail.poNumber}</strong></div>
              <div><span className="text-gray-500">Status:</span> <StatusBadge status={showDetail.status} /></div>
              <div><span className="text-gray-500">Vendor:</span> {showDetail.vendor?.name}</div>
              <div><span className="text-gray-500">Date:</span> {new Date(showDetail.orderDate).toLocaleDateString()}</div>
              <div><span className="text-gray-500">Total:</span> <strong>${showDetail.totalAmount?.toFixed(2)}</strong></div>
              <div><span className="text-gray-500">Terms:</span> {showDetail.paymentTerms}</div>
            </div>
            {showDetail.notes && <p className="text-sm text-gray-600">{showDetail.notes}</p>}
            <table className="w-full text-sm border rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="px-3 py-2 text-left text-xs font-semibold">#</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold">Material</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold">Qty</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold">Unit Price</th>
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
            {showDetail.goodsReceipts?.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Goods Receipts</h4>
                {showDetail.goodsReceipts.map((gr: any) => (
                  <div key={gr.id} className="text-sm p-2 border rounded mb-1">
                    <span className="font-mono">{gr.grNumber}</span> — {new Date(gr.receiptDate).toLocaleDateString()}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
