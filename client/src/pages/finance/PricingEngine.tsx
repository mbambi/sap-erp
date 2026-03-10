import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import PageHeader from "../../components/PageHeader";
import DataTable from "../../components/DataTable";
import Modal from "../../components/Modal";
import KPICard from "../../components/KPICard";
import StatusBadge from "../../components/StatusBadge";
import { FormInput, FormSelect } from "../../components/FormField";
import { Plus, Calculator, Loader2 } from "lucide-react";

type TabId = "conditions" | "calculator";

interface PricingCondition {
  id: string;
  conditionType: string;
  name?: string;
  materialId?: string;
  customerId?: string;
  value?: number;
  validFrom?: string;
  validTo?: string;
}

interface PriceCalculation {
  basePrice?: number;
  discounts?: { name: string; amount: number; type?: string }[];
  surcharges?: { name: string; amount: number; type?: string }[];
  subtotal?: number;
  tax?: number;
  freight?: number;
  total?: number;
}

interface Material {
  id: string;
  materialNumber: string;
  description: string;
}

interface Customer {
  id: string;
  name: string;
}

const CONDITION_TYPES = [
  { value: "base_price", label: "Base Price" },
  { value: "discount_pct", label: "Discount %" },
  { value: "discount_amt", label: "Discount Amount" },
  { value: "surcharge", label: "Surcharge" },
  { value: "freight", label: "Freight" },
  { value: "tax", label: "Tax" },
];

export default function PricingEngine() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>("conditions");
  const [showAddCondition, setShowAddCondition] = useState(false);
  const [conditionForm, setConditionForm] = useState({
    conditionType: "base_price",
    name: "",
    value: "",
    materialId: "",
    customerId: "",
    validFrom: "",
    validTo: "",
  });
  const [calcForm, setCalcForm] = useState({
    materialId: "",
    customerId: "",
    quantity: "1",
  });
  const [calcResult, setCalcResult] = useState<PriceCalculation | null>(null);

  const { data: conditions = [], isLoading: conditionsLoading } = useQuery({
    queryKey: ["pricing-conditions"],
    queryFn: () => api.get<PricingCondition[] | { data?: PricingCondition[] }>("/pricing/conditions"),
    enabled: activeTab === "conditions",
  });

  const { data: materialsRes } = useQuery({
    queryKey: ["materials-list"],
    queryFn: () => api.get<{ data?: Material[] }>("/materials/items", { limit: 500 }),
  });
  const { data: customersRes } = useQuery({
    queryKey: ["customers-list"],
    queryFn: () => api.get<{ data?: Customer[] }>("/finance/customers", { limit: 500 }),
  });

  const materials = Array.isArray(materialsRes) ? materialsRes : (materialsRes as { data?: Material[] })?.data ?? [];
  const customers = Array.isArray(customersRes) ? customersRes : (customersRes as { data?: Customer[] })?.data ?? [];
  const conditionList = Array.isArray(conditions) ? conditions : (conditions as { data?: PricingCondition[] })?.data ?? [];

  const addConditionMutation = useMutation({
    mutationFn: (data: Record<string, string | number>) => api.post("/pricing/conditions", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pricing-conditions"] });
      setShowAddCondition(false);
      setConditionForm({ conditionType: "base_price", name: "", value: "", materialId: "", customerId: "", validFrom: "", validTo: "" });
    },
  });

  const calculateMutation = useMutation({
    mutationFn: (data: Record<string, string | number>) => api.post<PriceCalculation>("/pricing/calculate-price", data),
    onSuccess: (result) => {
      setCalcResult(result);
    },
  });

  const handleCalculate = () => {
    const { materialId, customerId, quantity } = calcForm;
    if (!materialId || !quantity) return;
    calculateMutation.mutate({
      materialId,
      customerId: customerId || undefined,
      quantity: Number(quantity) || 1,
    });
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: "conditions", label: "Pricing Conditions" },
    { id: "calculator", label: "Price Calculator" },
  ];

  return (
    <div>
      <PageHeader
        title="Pricing Engine"
        breadcrumb={[{ label: "Home", path: "/" }, { label: "Finance", path: "/finance/journal-entries" }, { label: "Pricing Engine" }]}
      />

      <div className="card">
        <div className="border-b flex gap-1 p-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id ? "bg-primary-600 text-white" : "hover:bg-gray-100 text-gray-600"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "conditions" && (
          <div className="p-4">
            <DataTable<PricingCondition>
              columns={[
                {
                  key: "conditionType",
                  label: "Type",
                  render: (r) => <StatusBadge status={r.conditionType ?? "unknown"} />,
                },
                { key: "name", label: "Name" },
                { key: "materialId", label: "Material" },
                { key: "customerId", label: "Customer" },
                { key: "value", label: "Value", render: (r) => (r.value != null ? `$${r.value}` : "-") },
                { key: "validFrom", label: "Valid From" },
                { key: "validTo", label: "Valid To" },
              ]}
              data={conditionList}
              isLoading={conditionsLoading}
              onAdd={() => setShowAddCondition(true)}
              addLabel="Add Condition"
            />
          </div>
        )}

        {activeTab === "calculator" && (
          <div className="p-6 space-y-6">
            <div className="max-w-md space-y-4">
              <h3 className="text-sm font-semibold text-gray-900">Calculate Price</h3>
              <FormSelect
                label="Material"
                value={calcForm.materialId}
                onChange={(e) => setCalcForm((f) => ({ ...f, materialId: e.target.value }))}
                options={materials.map((m: Material) => ({ value: m.id, label: `${m.materialNumber} - ${m.description}` }))}
              />
              <FormSelect
                label="Customer"
                value={calcForm.customerId}
                onChange={(e) => setCalcForm((f) => ({ ...f, customerId: e.target.value }))}
                options={customers.map((c: Customer) => ({ value: c.id, label: c.name }))}
              />
              <FormInput
                label="Quantity"
                type="number"
                value={calcForm.quantity}
                onChange={(e) => setCalcForm((f) => ({ ...f, quantity: e.target.value }))}
              />
              <button
                className="btn-primary"
                onClick={handleCalculate}
                disabled={calculateMutation.isPending || !calcForm.materialId}
              >
                {calculateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
                Calculate Price
              </button>
            </div>

            {calcResult && (
              <div className="max-w-sm border-2 border-gray-200 rounded-xl p-6 bg-gray-50/50">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Price Breakdown</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Base Price</span>
                    <span>${(calcResult.basePrice ?? 0).toLocaleString()}</span>
                  </div>
                  {(calcResult.discounts ?? []).map((d, i) => (
                    <div key={i} className="flex justify-between text-emerald-600">
                      <span>{d.name}</span>
                      <span>-${(d.amount ?? 0).toLocaleString()}</span>
                    </div>
                  ))}
                  {(calcResult.surcharges ?? []).map((s, i) => (
                    <div key={i} className="flex justify-between text-amber-600">
                      <span>{s.name}</span>
                      <span>+${(s.amount ?? 0).toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="border-t pt-2 flex justify-between">
                    <span className="text-gray-600">Subtotal</span>
                    <span>${(calcResult.subtotal ?? calcResult.basePrice ?? 0).toLocaleString()}</span>
                  </div>
                  {calcResult.tax != null && calcResult.tax > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tax</span>
                      <span>${calcResult.tax.toLocaleString()}</span>
                    </div>
                  )}
                  {calcResult.freight != null && calcResult.freight > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Freight</span>
                      <span>${calcResult.freight.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="border-t-2 pt-3 mt-3 flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span className="text-primary-600">${(calcResult.total ?? 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <Modal
        isOpen={showAddCondition}
        onClose={() => setShowAddCondition(false)}
        title="Add Pricing Condition"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setShowAddCondition(false)}>Cancel</button>
            <button
              className="btn-primary"
              onClick={() =>
                addConditionMutation.mutate({
                  conditionType: conditionForm.conditionType,
                  name: conditionForm.name,
                  value: Number(conditionForm.value) || 0,
                  materialId: conditionForm.materialId || undefined,
                  customerId: conditionForm.customerId || undefined,
                  validFrom: conditionForm.validFrom || undefined,
                  validTo: conditionForm.validTo || undefined,
                })
              }
              disabled={addConditionMutation.isPending}
            >
              {addConditionMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <FormSelect
            label="Condition Type"
            value={conditionForm.conditionType}
            onChange={(e) => setConditionForm((f) => ({ ...f, conditionType: e.target.value }))}
            options={CONDITION_TYPES}
          />
          <FormInput
            label="Name"
            value={conditionForm.name}
            onChange={(e) => setConditionForm((f) => ({ ...f, name: e.target.value }))}
          />
          <FormInput
            label="Value"
            type="number"
            value={conditionForm.value}
            onChange={(e) => setConditionForm((f) => ({ ...f, value: e.target.value }))}
          />
          <FormSelect
            label="Material (optional)"
            value={conditionForm.materialId}
            onChange={(e) => setConditionForm((f) => ({ ...f, materialId: e.target.value }))}
            options={materials.map((m: Material) => ({ value: m.id, label: `${m.materialNumber} - ${m.description}` }))}
          />
          <FormSelect
            label="Customer (optional)"
            value={conditionForm.customerId}
            onChange={(e) => setConditionForm((f) => ({ ...f, customerId: e.target.value }))}
            options={customers.map((c: Customer) => ({ value: c.id, label: c.name }))}
          />
          <FormInput
            label="Valid From"
            type="date"
            value={conditionForm.validFrom}
            onChange={(e) => setConditionForm((f) => ({ ...f, validFrom: e.target.value }))}
          />
          <FormInput
            label="Valid To"
            type="date"
            value={conditionForm.validTo}
            onChange={(e) => setConditionForm((f) => ({ ...f, validTo: e.target.value }))}
          />
        </div>
      </Modal>
    </div>
  );
}
