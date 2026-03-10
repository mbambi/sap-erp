import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import PageHeader from "../../components/PageHeader";
import DataTable from "../../components/DataTable";
import { AlertTriangle } from "lucide-react";

export default function Inventory() {
  const { data, isLoading } = useQuery({
    queryKey: ["inventory"],
    queryFn: () => api.get("/materials/items", { limit: 100 }),
  });

  const materials = data?.data || [];

  return (
    <div>
      <PageHeader
        title="Inventory Overview"
        subtitle="Current stock levels and valuation"
        breadcrumb={[{ label: "Materials Management" }, { label: "Inventory" }]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card p-5">
          <p className="text-sm text-gray-500">Total Materials</p>
          <p className="text-2xl font-bold">{materials.length}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">Total Stock Value</p>
          <p className="text-2xl font-bold">
            ${materials.reduce((s: number, m: any) => s + (m.stockQuantity || 0) * (m.standardPrice || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Below Reorder Point
          </p>
          <p className="text-2xl font-bold text-amber-600">
            {materials.filter((m: any) => m.stockQuantity <= m.reorderPoint).length}
          </p>
        </div>
      </div>

      <DataTable
        columns={[
          { key: "materialNumber", label: "Material #", render: (r: any) => (
            <span className="font-mono text-sm">{r.materialNumber}</span>
          )},
          { key: "description", label: "Description" },
          { key: "type", label: "Type", render: (r: any) => (
            <span className="badge badge-gray capitalize">{r.type}</span>
          )},
          { key: "stockQuantity", label: "On Hand", render: (r: any) => {
            const low = r.stockQuantity <= r.reorderPoint;
            return (
              <span className={`font-medium ${low ? "text-red-600" : ""}`}>
                {r.stockQuantity} {r.baseUnit}
                {low && <AlertTriangle className="w-3 h-3 inline ml-1 text-amber-500" />}
              </span>
            );
          }},
          { key: "reorderPoint", label: "Reorder Pt" },
          { key: "standardPrice", label: "Unit Price", render: (r: any) => `$${(r.standardPrice || 0).toFixed(2)}` },
          { key: "value", label: "Stock Value", render: (r: any) => (
            <span className="font-medium">${((r.stockQuantity || 0) * (r.standardPrice || 0)).toFixed(2)}</span>
          )},
        ]}
        data={materials}
        isLoading={isLoading}
      />
    </div>
  );
}
