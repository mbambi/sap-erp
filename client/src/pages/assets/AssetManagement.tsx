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
  Package,
  DollarSign,
  TrendingDown,
  AlertTriangle,
  Plus,
  Loader2,
  Trash2,
} from "lucide-react";

interface Asset {
  id: string;
  assetNumber: string;
  description?: string;
  category?: string;
  acquisitionCost?: number;
  currentValue?: number;
  monthlyDepreciation?: number;
  status?: string;
  depreciationSchedule?: { period: string; amount: number }[];
}

interface AssetSummary {
  totalAssets: number;
  totalValue: number;
  monthlyDepreciation: number;
  assetsNeedingAttention: number;
}

const CATEGORIES = [
  { value: "machinery", label: "Machinery" },
  { value: "vehicle", label: "Vehicle" },
  { value: "computer", label: "Computer" },
  { value: "furniture", label: "Furniture" },
  { value: "building", label: "Building" },
];

const DEPRECIATION_METHODS = [
  { value: "straight_line", label: "Straight Line" },
  { value: "declining_balance", label: "Declining Balance" },
];

export default function AssetManagement() {
  const queryClient = useQueryClient();
  const [showAddAsset, setShowAddAsset] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [showDispose, setShowDispose] = useState<Asset | null>(null);
  const [disposalValue, setDisposalValue] = useState("");

  const [assetForm, setAssetForm] = useState({
    assetNumber: "",
    description: "",
    category: "machinery",
    acquisitionDate: "",
    acquisitionCost: "",
    usefulLifeMonths: "",
    depreciationMethod: "straight_line",
    salvageValue: "",
  });

  const { data: summary } = useQuery({
    queryKey: ["assets-summary"],
    queryFn: () => api.get<AssetSummary>("/assets/summary"),
  });

  const { data: assets = [], isLoading: assetsLoading } = useQuery({
    queryKey: ["assets-list"],
    queryFn: () => api.get<Asset[] | { data?: Asset[] }>("/assets"),
  });

  const addAssetMutation = useMutation({
    mutationFn: (data: Record<string, string | number>) => api.post("/assets", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets-list"] });
      queryClient.invalidateQueries({ queryKey: ["assets-summary"] });
      setShowAddAsset(false);
      setAssetForm({
        assetNumber: "",
        description: "",
        category: "machinery",
        acquisitionDate: "",
        acquisitionCost: "",
        usefulLifeMonths: "",
        depreciationMethod: "straight_line",
        salvageValue: "",
      });
    },
  });

  const runDepreciationMutation = useMutation({
    mutationFn: () => api.post("/assets/run-depreciation"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets-list"] });
      queryClient.invalidateQueries({ queryKey: ["assets-summary"] });
    },
  });

  const disposeMutation = useMutation({
    mutationFn: ({ id, disposalValue }: { id: string; disposalValue: number }) =>
      api.post(`/assets/${id}/dispose`, { disposalValue }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets-list"] });
      queryClient.invalidateQueries({ queryKey: ["assets-summary"] });
      setShowDispose(null);
      setSelectedAsset(null);
      setDisposalValue("");
    },
  });

  const assetList = Array.isArray(assets) ? assets : (assets as { data?: Asset[] })?.data ?? [];
  const sum = summary ?? {
    totalAssets: 0,
    totalValue: 0,
    monthlyDepreciation: 0,
    assetsNeedingAttention: 0,
  };

  return (
    <div>
      <PageHeader
        title="Asset Management"
        breadcrumb={[{ label: "Home", path: "/" }, { label: "Asset Management" }]}
        children={
          <>
            <button className="btn-secondary btn-sm" onClick={() => runDepreciationMutation.mutate()} disabled={runDepreciationMutation.isPending}>
              {runDepreciationMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Run Depreciation
            </button>
            <button className="btn-primary btn-sm" onClick={() => setShowAddAsset(true)}>
              <Plus className="w-3.5 h-3.5" /> Add Asset
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard title="Total Assets" value={sum.totalAssets ?? 0} icon={Package} color="blue" />
        <KPICard title="Total Value" value={`$${(sum.totalValue ?? 0).toLocaleString()}`} icon={DollarSign} color="green" />
        <KPICard title="Monthly Depreciation" value={`$${(sum.monthlyDepreciation ?? 0).toLocaleString()}`} icon={TrendingDown} color="purple" />
        <KPICard
          title="Assets Needing Attention"
          value={sum.assetsNeedingAttention ?? 0}
          icon={AlertTriangle}
          color={sum.assetsNeedingAttention ? "red" : "green"}
        />
      </div>

      <div className="card">
        <div className="p-4">
          <DataTable<Asset>
            columns={[
              { key: "assetNumber", label: "Asset #" },
              { key: "description", label: "Description" },
              { key: "category", label: "Category", render: (r) => <StatusBadge status={r.category ?? "unknown"} /> },
              { key: "acquisitionCost", label: "Acquisition Cost", render: (r) => `$${(r.acquisitionCost ?? 0).toLocaleString()}` },
              { key: "currentValue", label: "Current Value", render: (r) => `$${(r.currentValue ?? 0).toLocaleString()}` },
              { key: "monthlyDepreciation", label: "Monthly Depr", render: (r) => `$${(r.monthlyDepreciation ?? 0).toLocaleString()}` },
              { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status ?? "active"} /> },
              {
                key: "actions",
                label: "Actions",
                render: (r) => (
                  <button
                    className="btn-danger btn-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDispose(r);
                      setDisposalValue(String(r.currentValue ?? 0));
                    }}
                  >
                    <Trash2 className="w-3 h-3" /> Dispose
                  </button>
                ),
              },
            ]}
            data={assetList}
            isLoading={assetsLoading}
            onRowClick={(row) => setSelectedAsset(selectedAsset?.id === row.id ? null : row)}
          />
        </div>
      </div>

      {selectedAsset && (
        <div className="card mt-6 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            Asset Detail: {selectedAsset.assetNumber}
          </h3>
          <p className="text-sm text-gray-600 mb-4">{selectedAsset.description}</p>
          {(selectedAsset.depreciationSchedule ?? []).length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Period</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {selectedAsset.depreciationSchedule!.map((s, i) => (
                    <tr key={i}>
                      <td className="px-4 py-3">{s.period}</td>
                      <td className="px-4 py-3 text-right">${(s.amount ?? 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No depreciation schedule available.</p>
          )}
        </div>
      )}

      <Modal
        isOpen={showAddAsset}
        onClose={() => setShowAddAsset(false)}
        title="Add Asset"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setShowAddAsset(false)}>Cancel</button>
            <button
              className="btn-primary"
              onClick={() =>
                addAssetMutation.mutate({
                  assetNumber: assetForm.assetNumber,
                  description: assetForm.description,
                  category: assetForm.category,
                  acquisitionDate: assetForm.acquisitionDate,
                  acquisitionCost: Number(assetForm.acquisitionCost) || 0,
                  usefulLifeMonths: Number(assetForm.usefulLifeMonths) || 0,
                  depreciationMethod: assetForm.depreciationMethod,
                  salvageValue: Number(assetForm.salvageValue) || 0,
                })
              }
              disabled={addAssetMutation.isPending || !assetForm.assetNumber || !assetForm.acquisitionCost}
            >
              {addAssetMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <FormInput label="Asset Number" value={assetForm.assetNumber} onChange={(e) => setAssetForm((f) => ({ ...f, assetNumber: e.target.value }))} required />
          <FormInput label="Description" value={assetForm.description} onChange={(e) => setAssetForm((f) => ({ ...f, description: e.target.value }))} />
          <FormSelect
            label="Category"
            value={assetForm.category}
            onChange={(e) => setAssetForm((f) => ({ ...f, category: e.target.value }))}
            options={CATEGORIES}
          />
          <FormInput label="Acquisition Date" type="date" value={assetForm.acquisitionDate} onChange={(e) => setAssetForm((f) => ({ ...f, acquisitionDate: e.target.value }))} />
          <FormInput label="Acquisition Cost" type="number" value={assetForm.acquisitionCost} onChange={(e) => setAssetForm((f) => ({ ...f, acquisitionCost: e.target.value }))} required />
          <FormInput label="Useful Life (months)" type="number" value={assetForm.usefulLifeMonths} onChange={(e) => setAssetForm((f) => ({ ...f, usefulLifeMonths: e.target.value }))} />
          <FormSelect
            label="Depreciation Method"
            value={assetForm.depreciationMethod}
            onChange={(e) => setAssetForm((f) => ({ ...f, depreciationMethod: e.target.value }))}
            options={DEPRECIATION_METHODS}
          />
          <FormInput label="Salvage Value" type="number" value={assetForm.salvageValue} onChange={(e) => setAssetForm((f) => ({ ...f, salvageValue: e.target.value }))} />
        </div>
      </Modal>

      <Modal
        isOpen={!!showDispose}
        onClose={() => { setShowDispose(null); setDisposalValue(""); }}
        title="Dispose Asset"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setShowDispose(null)}>Cancel</button>
            <button
              className="btn-danger"
              onClick={() => showDispose && disposeMutation.mutate({ id: showDispose.id, disposalValue: Number(disposalValue) || 0 })}
              disabled={disposeMutation.isPending}
            >
              {disposeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Dispose
            </button>
          </>
        }
      >
        {showDispose && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Asset: {showDispose.assetNumber} - {showDispose.description ?? "—"}
            </p>
            <FormInput
              label="Disposal Value"
              type="number"
              value={disposalValue}
              onChange={(e) => setDisposalValue(e.target.value)}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
