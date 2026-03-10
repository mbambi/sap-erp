import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import PageHeader from "../../components/PageHeader";
import DataTable from "../../components/DataTable";
import Modal from "../../components/Modal";
import KPICard from "../../components/KPICard";
import StatusBadge from "../../components/StatusBadge";
import { FormInput, FormSelect } from "../../components/FormField";
import { Package, DollarSign, AlertTriangle, ArrowRightLeft, Loader2 } from "lucide-react";

type TabId = "overview" | "goods-issue" | "transfer" | "count" | "movements";

interface StockItem {
  id: string;
  materialId?: string;
  materialNumber?: string;
  description?: string;
  stockQty?: number;
  reserved?: number;
  available?: number;
  value?: number;
  reorderAlert?: boolean;
}

interface Movement {
  id: string;
  date?: string;
  materialId?: string;
  materialNumber?: string;
  type?: string;
  quantity?: number;
  fromLocation?: string;
  toLocation?: string;
  reference?: string;
}

interface Material {
  id: string;
  materialNumber: string;
  description: string;
}

export default function StockManagement() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  const [goodsIssueForm, setGoodsIssueForm] = useState({
    materialId: "",
    quantity: "",
    reason: "",
    reference: "",
  });
  const [transferForm, setTransferForm] = useState({
    materialId: "",
    quantity: "",
    fromLocation: "",
    toLocation: "",
  });
  const [countForm, setCountForm] = useState({
    materialId: "",
    countedQuantity: "",
    location: "",
  });
  const [countVariance, setCountVariance] = useState<number | null>(null);

  const { data: stockOverview = [], isLoading: stockLoading } = useQuery({
    queryKey: ["enhanced-inventory-stock-overview"],
    queryFn: () => api.get<StockItem[] | { data?: StockItem[] }>("/enhanced-inventory/stock-overview"),
    enabled: activeTab === "overview",
  });

  const { data: movements = [], isLoading: movementsLoading } = useQuery({
    queryKey: ["enhanced-inventory-movements"],
    queryFn: () => api.get<Movement[] | { data?: Movement[] }>("/enhanced-inventory/movements"),
    enabled: activeTab === "movements",
  });

  const { data: materialsRes } = useQuery({
    queryKey: ["materials-list"],
    queryFn: () => api.get<{ data?: Material[] }>("/materials/items", { limit: 500 }),
  });
  const materials = Array.isArray(materialsRes) ? materialsRes : (materialsRes as { data?: Material[] })?.data ?? [];

  const stockItems = Array.isArray(stockOverview) ? stockOverview : (stockOverview as { data?: StockItem[] })?.data ?? [];
  const movementList = Array.isArray(movements) ? movements : (movements as { data?: Movement[] })?.data ?? [];

  const goodsIssueMutation = useMutation({
    mutationFn: (data: Record<string, string | number>) => api.post("/enhanced-inventory/goods-issue", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enhanced-inventory-stock-overview"] });
      queryClient.invalidateQueries({ queryKey: ["enhanced-inventory-movements"] });
      setGoodsIssueForm({ materialId: "", quantity: "", reason: "", reference: "" });
    },
  });

  const transferMutation = useMutation({
    mutationFn: (data: Record<string, string | number>) => api.post("/enhanced-inventory/stock-transfer", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enhanced-inventory-stock-overview"] });
      queryClient.invalidateQueries({ queryKey: ["enhanced-inventory-movements"] });
      setTransferForm({ materialId: "", quantity: "", fromLocation: "", toLocation: "" });
    },
  });

  const countMutation = useMutation({
    mutationFn: (data: Record<string, string | number>) => api.post("/enhanced-inventory/inventory-count", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enhanced-inventory-stock-overview"] });
      queryClient.invalidateQueries({ queryKey: ["enhanced-inventory-movements"] });
      setCountForm({ materialId: "", countedQuantity: "", location: "" });
      setCountVariance(null);
    },
  });

  const totalMaterials = stockItems.length;
  const totalStockValue = stockItems.reduce((s, i) => s + (i.value ?? 0), 0);
  const belowReorder = stockItems.filter((i) => i.reorderAlert).length;
  const pendingTransfers = movementList.filter((m) => m.type === "transfer" && m.quantity).length;

  const handleCountVariance = () => {
    const mat = stockItems.find((s) => s.id === countForm.materialId || s.materialId === countForm.materialId);
    const systemQty = mat?.stockQty ?? mat?.available ?? 0;
    const counted = Number(countForm.countedQuantity) || 0;
    setCountVariance(counted - systemQty);
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: "overview", label: "Stock Overview" },
    { id: "goods-issue", label: "Goods Issue" },
    { id: "transfer", label: "Stock Transfer" },
    { id: "count", label: "Inventory Count" },
    { id: "movements", label: "Movements" },
  ];

  return (
    <div>
      <PageHeader
        title="Stock Management"
        breadcrumb={[{ label: "Home", path: "/" }, { label: "Materials", path: "/materials/items" }, { label: "Stock Management" }]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard title="Total Materials" value={totalMaterials} icon={Package} color="blue" />
        <KPICard title="Total Stock Value" value={`$${totalStockValue.toLocaleString()}`} icon={DollarSign} color="green" />
        <KPICard
          title="Items Below Reorder"
          value={belowReorder}
          icon={AlertTriangle}
          color={belowReorder > 0 ? "red" : "green"}
        />
        <KPICard title="Pending Transfers" value={pendingTransfers} icon={ArrowRightLeft} color="purple" />
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

        {activeTab === "overview" && (
          <div className="p-4">
            <DataTable<StockItem>
              columns={[
                { key: "materialNumber", label: "Material #", render: (r) => r.materialNumber ?? r.materialId ?? "-" },
                { key: "description", label: "Description" },
                { key: "stockQty", label: "Stock Qty", render: (r) => (r.stockQty ?? 0).toLocaleString() },
                { key: "reserved", label: "Reserved", render: (r) => (r.reserved ?? 0).toLocaleString() },
                { key: "available", label: "Available", render: (r) => (r.available ?? r.stockQty ?? 0).toLocaleString() },
                { key: "value", label: "Value", render: (r) => `$${(r.value ?? 0).toLocaleString()}` },
                {
                  key: "reorderAlert",
                  label: "Reorder Alert",
                  render: (r) =>
                    r.reorderAlert ? (
                      <span className="text-red-600 font-medium">Below reorder</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    ),
                },
              ]}
              data={stockItems}
              isLoading={stockLoading}
            />
          </div>
        )}

        {activeTab === "goods-issue" && (
          <div className="p-6 space-y-6">
            <div className="max-w-md space-y-4">
              <h3 className="text-sm font-semibold text-gray-900">Issue Goods</h3>
              <FormSelect
                label="Material"
                value={goodsIssueForm.materialId}
                onChange={(e) => setGoodsIssueForm((f) => ({ ...f, materialId: e.target.value }))}
                options={materials.map((m: Material) => ({ value: m.id, label: `${m.materialNumber} - ${m.description}` }))}
              />
              <FormInput
                label="Quantity"
                type="number"
                value={goodsIssueForm.quantity}
                onChange={(e) => setGoodsIssueForm((f) => ({ ...f, quantity: e.target.value }))}
              />
              <FormInput
                label="Reason"
                value={goodsIssueForm.reason}
                onChange={(e) => setGoodsIssueForm((f) => ({ ...f, reason: e.target.value }))}
              />
              <FormInput
                label="Reference"
                value={goodsIssueForm.reference}
                onChange={(e) => setGoodsIssueForm((f) => ({ ...f, reference: e.target.value }))}
              />
              <button
                className="btn-primary"
                onClick={() =>
                  goodsIssueMutation.mutate({
                    materialId: goodsIssueForm.materialId,
                    quantity: Number(goodsIssueForm.quantity),
                    reason: goodsIssueForm.reason,
                    reference: goodsIssueForm.reference,
                  })
                }
                disabled={goodsIssueMutation.isPending || !goodsIssueForm.materialId || !goodsIssueForm.quantity}
              >
                {goodsIssueMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Submit
              </button>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Recent Issues</h3>
              <div className="text-sm text-gray-500">
                Recent goods issues appear in the Movements tab.
              </div>
            </div>
          </div>
        )}

        {activeTab === "transfer" && (
          <div className="p-6">
            <div className="max-w-md space-y-4">
              <h3 className="text-sm font-semibold text-gray-900">Stock Transfer</h3>
              <FormSelect
                label="Material"
                value={transferForm.materialId}
                onChange={(e) => setTransferForm((f) => ({ ...f, materialId: e.target.value }))}
                options={materials.map((m: Material) => ({ value: m.id, label: `${m.materialNumber} - ${m.description}` }))}
              />
              <FormInput
                label="Quantity"
                type="number"
                value={transferForm.quantity}
                onChange={(e) => setTransferForm((f) => ({ ...f, quantity: e.target.value }))}
              />
              <FormInput
                label="From Location"
                value={transferForm.fromLocation}
                onChange={(e) => setTransferForm((f) => ({ ...f, fromLocation: e.target.value }))}
              />
              <FormInput
                label="To Location"
                value={transferForm.toLocation}
                onChange={(e) => setTransferForm((f) => ({ ...f, toLocation: e.target.value }))}
              />
              <button
                className="btn-primary"
                onClick={() =>
                  transferMutation.mutate({
                    materialId: transferForm.materialId,
                    quantity: Number(transferForm.quantity),
                    fromLocation: transferForm.fromLocation,
                    toLocation: transferForm.toLocation,
                  })
                }
                disabled={
                  transferMutation.isPending ||
                  !transferForm.materialId ||
                  !transferForm.quantity ||
                  !transferForm.fromLocation ||
                  !transferForm.toLocation
                }
              >
                {transferMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Submit
              </button>
            </div>
          </div>
        )}

        {activeTab === "count" && (
          <div className="p-6 space-y-6">
            <div className="max-w-md space-y-4">
              <h3 className="text-sm font-semibold text-gray-900">Inventory Count</h3>
              <FormSelect
                label="Material"
                value={countForm.materialId}
                onChange={(e) => {
                  setCountForm((f) => ({ ...f, materialId: e.target.value }));
                  setCountVariance(null);
                }}
                options={materials.map((m: Material) => ({ value: m.id, label: `${m.materialNumber} - ${m.description}` }))}
              />
              <FormInput
                label="Counted Quantity"
                type="number"
                value={countForm.countedQuantity}
                onChange={(e) => {
                  setCountForm((f) => ({ ...f, countedQuantity: e.target.value }));
                  setCountVariance(null);
                }}
              />
              <FormInput
                label="Location"
                value={countForm.location}
                onChange={(e) => setCountForm((f) => ({ ...f, location: e.target.value }))}
              />
              <div className="flex gap-2">
                <button
                  className="btn-secondary"
                  onClick={handleCountVariance}
                >
                  Show Variance
                </button>
                <button
                  className="btn-primary"
                  onClick={() =>
                    countMutation.mutate({
                      materialId: countForm.materialId,
                      countedQuantity: Number(countForm.countedQuantity),
                      location: countForm.location,
                    })
                  }
                  disabled={
                    countMutation.isPending ||
                    !countForm.materialId ||
                    !countForm.countedQuantity ||
                    !countForm.location
                  }
                >
                  {countMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Submit
                </button>
              </div>
              {countVariance !== null && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">Variance (counted - system qty)</p>
                  <p className={`text-xl font-bold ${countVariance === 0 ? "text-emerald-600" : countVariance > 0 ? "text-blue-600" : "text-red-600"}`}>
                    {countVariance > 0 ? "+" : ""}{countVariance}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "movements" && (
          <div className="p-4">
            <DataTable<Movement>
              columns={[
                { key: "date", label: "Date" },
                { key: "materialNumber", label: "Material", render: (r) => r.materialNumber ?? r.materialId ?? "-" },
                { key: "type", label: "Type", render: (r) => <StatusBadge status={r.type ?? "unknown"} /> },
                { key: "quantity", label: "Qty", render: (r) => (r.quantity ?? 0).toLocaleString() },
                { key: "fromLocation", label: "From" },
                { key: "toLocation", label: "To" },
                { key: "reference", label: "Reference" },
              ]}
              data={movementList}
              isLoading={movementsLoading}
            />
          </div>
        )}
      </div>
    </div>
  );
}
