import CrudPage from "../CrudPage";

export default function Materials() {
  return (
    <CrudPage
      title="Materials"
      subtitle="Material master data management"
      breadcrumb={[{ label: "Materials Management" }, { label: "Materials" }]}
      queryKey="materials"
      endpoint="/materials/items"
      searchPlaceholder="Search materials..."
      addLabel="New Material"
      fields={[
        { key: "materialNumber", label: "Material #", required: true },
        { key: "description", label: "Description", required: true },
        {
          key: "type",
          label: "Type",
          type: "select",
          required: true,
          options: [
            { value: "raw", label: "Raw Material" },
            { value: "semi-finished", label: "Semi-Finished" },
            { value: "finished", label: "Finished Product" },
            { value: "trading", label: "Trading Good" },
            { value: "service", label: "Service" },
          ],
          tableRender: (r: any) => (
            <span className={`badge ${
              r.type === "raw" ? "badge-yellow" :
              r.type === "finished" ? "badge-green" :
              r.type === "semi-finished" ? "badge-blue" :
              "badge-gray"
            }`}>{r.type}</span>
          ),
        },
        { key: "baseUnit", label: "Base Unit", defaultValue: "EA" },
        { key: "standardPrice", label: "Standard Price", type: "number",
          tableRender: (r: any) => `$${(r.standardPrice || 0).toFixed(2)}`
        },
        { key: "stockQuantity", label: "Stock Qty", type: "number", defaultValue: 0,
          tableRender: (r: any) => {
            const qty = r.stockQuantity || 0;
            const rp = r.reorderPoint || 0;
            return <span className={qty <= rp ? "text-red-600 font-medium" : ""}>{qty}</span>;
          }
        },
        { key: "reorderPoint", label: "Reorder Point", type: "number", defaultValue: 0, showInTable: false },
        { key: "safetyStock", label: "Safety Stock", type: "number", defaultValue: 0, showInTable: false },
        { key: "leadTimeDays", label: "Lead Time (days)", type: "number", defaultValue: 7, showInTable: false },
        { key: "materialGroup", label: "Material Group", showInTable: false },
        { key: "weight", label: "Weight", type: "number", showInTable: false },
        { key: "weightUnit", label: "Weight Unit", showInTable: false },
      ]}
    />
  );
}
