import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Car,
  ShoppingBag,
  Cpu,
  Pill,
  Wheat,
  Eye,
  Check,
  Loader2,
  FileJson,
} from "lucide-react";
import { api } from "../api/client";
import { useAuthStore } from "../stores/auth";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import { FormInput, FormTextArea } from "../components/FormField";
import DataTable from "../components/DataTable";

interface IndustryTemplate {
  id: string;
  name: string;
  description: string;
  industry: string;
  materialCount: number;
  bomCount: number;
  customerCount: number;
  config?: Record<string, unknown>;
}

interface AppliedTemplate {
  id: string;
  templateId: string;
  templateName: string;
  appliedAt: string;
}

const INDUSTRY_ICONS: Record<string, typeof Car> = {
  automotive: Car,
  retail: ShoppingBag,
  electronics: Cpu,
  pharma: Pill,
  food: Wheat,
};

const INDUSTRY_OPTIONS = [
  { value: "automotive", label: "Automotive", icon: Car },
  { value: "retail", label: "Retail", icon: ShoppingBag },
  { value: "electronics", label: "Electronics", icon: Cpu },
  { value: "pharma", label: "Pharmaceutical", icon: Pill },
  { value: "food", label: "Food & Beverage", icon: Wheat },
];

export default function IndustryTemplates() {
  const queryClient = useQueryClient();
  const { hasRole } = useAuthStore();
  const [expandedTemplate, setExpandedTemplate] = useState<IndustryTemplate | null>(null);
  const [showApplyConfirm, setShowApplyConfirm] = useState<IndustryTemplate | null>(null);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customForm, setCustomForm] = useState({
    name: "",
    description: "",
    industry: "automotive",
    configJson: "{}",
  });

  const isAdminOrInstructor = hasRole("admin") || hasRole("instructor");

  const templatesQuery = useQuery({
    queryKey: ["industry-templates"],
    queryFn: () => api.get<IndustryTemplate[]>("/industry-templates"),
    retry: false,
  });

  const appliedQuery = useQuery({
    queryKey: ["industry-templates", "applied"],
    queryFn: () => api.get<AppliedTemplate[]>("/industry-templates/applied"),
    retry: false,
  });

  const applyMutation = useMutation({
    mutationFn: (templateId: string) =>
      api.post(`/industry-templates/${templateId}/apply`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["industry-templates", "applied"] });
      setShowApplyConfirm(null);
    },
  });

  const createCustomMutation = useMutation({
    mutationFn: (data: typeof customForm) => {
      let config: Record<string, unknown>;
      try {
        config = JSON.parse(data.configJson);
      } catch {
        throw new Error("Invalid JSON config");
      }
      return api.post("/industry-templates", {
        name: data.name,
        description: data.description,
        industry: data.industry,
        config,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["industry-templates"] });
      setShowCustomForm(false);
      setCustomForm({ name: "", description: "", industry: "automotive", configJson: "{}" });
    },
  });

  const templates = templatesQuery.data ?? [
    {
      id: "t1",
      name: "Automotive Manufacturing",
      description: "Full automotive supply chain with OEM and tier suppliers",
      industry: "automotive",
      materialCount: 450,
      bomCount: 120,
      customerCount: 25,
    },
    {
      id: "t2",
      name: "Retail Distribution",
      description: "Multi-warehouse retail with seasonal demand patterns",
      industry: "retail",
      materialCount: 1200,
      bomCount: 80,
      customerCount: 150,
    },
    {
      id: "t3",
      name: "Electronics Assembly",
      description: "PCB and component supply chain with short life cycles",
      industry: "electronics",
      materialCount: 800,
      bomCount: 200,
      customerCount: 45,
    },
    {
      id: "t4",
      name: "Pharmaceutical",
      description: "GMP-compliant with batch tracking and cold chain",
      industry: "pharma",
      materialCount: 180,
      bomCount: 65,
      customerCount: 12,
    },
    {
      id: "t5",
      name: "Food & Beverage",
      description: "Perishable goods with expiry and lot traceability",
      industry: "food",
      materialCount: 320,
      bomCount: 95,
      customerCount: 80,
    },
  ];

  const appliedTemplates = appliedQuery.data ?? [];

  const handleApplyConfirm = (template: IndustryTemplate) => {
    if (!showApplyConfirm) return;
    applyMutation.mutate(template.id);
  };

  const handleCreateCustom = () => {
    try {
      JSON.parse(customForm.configJson);
    } catch {
      return;
    }
    createCustomMutation.mutate(customForm);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Industry Templates"
        subtitle="Catalog of industry-specific ERP configurations"
        breadcrumb={[{ label: "Home", path: "/" }, { label: "Industry Templates" }]}
      >
        {isAdminOrInstructor && (
          <button onClick={() => setShowCustomForm(true)} className="btn-primary">
            <FileJson className="w-4 h-4" /> Create Custom Template
          </button>
        )}
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((template) => {
          const Icon = INDUSTRY_ICONS[template.industry] ?? Cpu;
          const isExpanded = expandedTemplate?.id === template.id;
          return (
            <div
              key={template.id}
              className="card overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-4 rounded-xl bg-primary-50 text-primary-600">
                    <Icon className="w-10 h-10" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900">{template.name}</h3>
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                      {template.description}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex gap-4 text-xs text-gray-500">
                  <span>{template.materialCount} materials</span>
                  <span>{template.bomCount} BOMs</span>
                  <span>{template.customerCount} customers</span>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => setExpandedTemplate(isExpanded ? null : template)}
                    className="btn-secondary btn-sm"
                  >
                    <Eye className="w-4 h-4" /> Preview
                  </button>
                  {isAdminOrInstructor && (
                    <button
                      onClick={() => setShowApplyConfirm(template)}
                      className="btn-primary btn-sm"
                    >
                      <Check className="w-4 h-4" /> Apply Template
                    </button>
                  )}
                </div>
              </div>
              {isExpanded && (
                <div className="px-6 pb-6 pt-0 border-t border-gray-100 mt-4">
                  <h4 className="text-xs font-semibold text-gray-700 mb-2">Preview</h4>
                  <div className="text-xs text-gray-600 space-y-1">
                    <p>• Materials: Sample list from config</p>
                    <p>• BOM structure: Multi-level hierarchy</p>
                    <p>• Demand patterns: Seasonal / steady</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {appliedTemplates.length > 0 && (
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Applied Templates</h3>
          <DataTable<AppliedTemplate>
            columns={[
              { key: "templateName", label: "Template" },
              {
                key: "appliedAt",
                label: "Applied",
                render: (r) => new Date(r.appliedAt).toLocaleDateString(),
              },
            ]}
            data={appliedTemplates}
            isLoading={appliedQuery.isLoading}
          />
        </div>
      )}

      <Modal
        isOpen={!!showApplyConfirm}
        onClose={() => setShowApplyConfirm(null)}
        title="Apply Template"
        footer={
          showApplyConfirm ? (
            <>
              <button onClick={() => setShowApplyConfirm(null)} className="btn-secondary">
                Cancel
              </button>
              <button
                onClick={() => handleApplyConfirm(showApplyConfirm)}
                disabled={applyMutation.isPending}
                className="btn-primary"
              >
                {applyMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}{" "}
                Apply
              </button>
            </>
          ) : undefined
        }
      >
        {showApplyConfirm && (
          <p className="text-gray-600">
            This will add <strong>{showApplyConfirm.materialCount} materials</strong>,{" "}
            <strong>{showApplyConfirm.bomCount} BOMs</strong>, and{" "}
            <strong>{showApplyConfirm.customerCount} customers</strong> to your tenant.
            Continue?
          </p>
        )}
      </Modal>

      <Modal
        isOpen={showCustomForm}
        onClose={() => setShowCustomForm(false)}
        title="Create Custom Industry Template"
        size="lg"
        footer={
          <>
            <button onClick={() => setShowCustomForm(false)} className="btn-secondary">
              Cancel
            </button>
            <button
              onClick={handleCreateCustom}
              disabled={
                createCustomMutation.isPending ||
                !customForm.name ||
                !customForm.description
              }
              className="btn-primary"
            >
              {createCustomMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileJson className="w-4 h-4" />
              )}{" "}
              Create
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <FormInput
            label="Template Name"
            value={customForm.name}
            onChange={(e) => setCustomForm({ ...customForm, name: e.target.value })}
            placeholder="e.g. Custom Manufacturing"
          />
          <FormInput
            label="Description"
            value={customForm.description}
            onChange={(e) => setCustomForm({ ...customForm, description: e.target.value })}
            placeholder="Brief description"
          />
          <div>
            <label className="label">Industry</label>
            <select
              value={customForm.industry}
              onChange={(e) => setCustomForm({ ...customForm, industry: e.target.value })}
              className="input"
            >
              {INDUSTRY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <FormTextArea
            label="JSON Config"
            value={customForm.configJson}
            onChange={(e) => setCustomForm({ ...customForm, configJson: e.target.value })}
            placeholder='{"materials": [], "boms": [], "customers": []}'
            rows={8}
          />
        </div>
      </Modal>
    </div>
  );
}
