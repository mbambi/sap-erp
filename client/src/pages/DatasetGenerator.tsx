import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Database,
  Plus,
  Play,
  Zap,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { api } from "../api/client";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import { useAuthStore } from "../stores/auth";

interface Template {
  id: string;
  name: string;
  description?: string | null;
  config: string;
  status: string;
  lastGenerated?: string | null;
  createdAt: string;
}

const DEFAULT_CONFIG = {
  customers: 50,
  vendors: 20,
  materials: 100,
  purchaseOrders: 200,
  salesOrders: 150,
  journalEntries: 50,
};

const CONFIG_LIMITS = {
  customers: [1, 500],
  vendors: [1, 100],
  materials: [1, 1000],
  purchaseOrders: [1, 2000],
  salesOrders: [1, 1500],
  journalEntries: [1, 500],
};

function configSummary(config: Record<string, number>) {
  const parts: string[] = [];
  if (config.customers) parts.push(`${config.customers} customers`);
  if (config.vendors) parts.push(`${config.vendors} vendors`);
  if (config.materials) parts.push(`${config.materials} materials`);
  if (config.purchaseOrders) parts.push(`${config.purchaseOrders} POs`);
  if (config.salesOrders) parts.push(`${config.salesOrders} SOs`);
  if (config.journalEntries) parts.push(`${config.journalEntries} JEs`);
  return parts.join(", ") || "Default";
}

export default function DatasetGenerator() {
  const queryClient = useQueryClient();
  const { hasRole } = useAuthStore();
  const isAdmin = hasRole("admin");
  const isAdminOrInstructor = hasRole("admin") || hasRole("instructor");

  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [templateForm, setTemplateForm] = useState({
    name: "",
    description: "",
    config: { ...DEFAULT_CONFIG },
  });
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [generateResult, setGenerateResult] = useState<Record<string, number> | null>(null);

  const { data: templatesRes, isLoading: loadingTemplates } = useQuery({
    queryKey: ["dataset-generator", "templates"],
    queryFn: () => api.get<{ data: Template[] }>("/dataset-generator/templates"),
    enabled: isAdminOrInstructor,
  });
  const templates = templatesRes?.data ?? [];

  const generateMutation = useMutation({
    mutationFn: (templateId: string) => api.post<{ counts: Record<string, number> }>("/dataset-generator/generate", { templateId }),
    onSuccess: (data) => {
      setGenerateResult(data.counts ?? null);
      queryClient.invalidateQueries({ queryKey: ["dataset-generator", "templates"] });
    },
  });

  const quickGenerateMutation = useMutation({
    mutationFn: () => api.post<{ counts: Record<string, number> }>("/dataset-generator/generate-quick"),
    onSuccess: (data) => {
      setGenerateResult(data.counts ?? null);
      queryClient.invalidateQueries({ queryKey: ["dataset-generator", "templates"] });
    },
  });

  const clearMutation = useMutation({
    mutationFn: () => api.delete("/dataset-generator/clear-generated"),
    onSuccess: () => {
      setShowClearConfirm(false);
      queryClient.invalidateQueries({ queryKey: ["dataset-generator"] });
    },
  });

  const createTemplateMutation = useMutation({
    mutationFn: (data: typeof templateForm) =>
      api.post("/dataset-generator/templates", {
        name: data.name,
        description: data.description || null,
        config: data.config,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dataset-generator", "templates"] });
      setShowCreateTemplate(false);
      setTemplateForm({ name: "", description: "", config: { ...DEFAULT_CONFIG } });
    },
  });

  const isGenerating = generateMutation.isPending || quickGenerateMutation.isPending;

  if (!isAdminOrInstructor) {
    return (
      <div className="p-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 mb-4">
          <AlertTriangle className="w-8 h-8 text-amber-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
        <p className="text-gray-600">This page is for administrators and instructors only.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dataset Generator"
        subtitle="Create and manage synthetic ERP data for training and demos"
      />

      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start gap-3">
        <Database className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-amber-800 dark:text-amber-200">Orange/amber theme</p>
          <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
            Use this tool to generate sample customers, vendors, materials, purchase orders, and sales orders for your tenant.
          </p>
        </div>
      </div>

      {/* Quick Preset Generation */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="font-semibold text-gray-900">Quick Generate from Preset</h2>
          <p className="text-sm text-gray-500 mt-1">Generate realistic manufacturing data with one click</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6">
          {[
            { size: "small", label: "Small", desc: "10 customers, 5 vendors, 15 materials, 20 POs, 15 SOs", icon: "📦" },
            { size: "medium", label: "Medium", desc: "50 customers, 20 vendors, 80 materials, 100 POs, 75 SOs", icon: "🏭" },
            { size: "large", label: "Large", desc: "200 customers, 50 vendors, 300 materials, 500 POs, 350 SOs", icon: "🌐" },
          ].map((preset) => (
            <button
              key={preset.size}
              onClick={async () => {
                try {
                  const result = await api.post("/dataset-generator/generate-preset", { size: preset.size });
                  setGenerateResult(result.counts);
                } catch {}
              }}
              disabled={isGenerating}
              className="text-left p-5 rounded-xl border-2 border-gray-200 hover:border-primary-400 hover:bg-primary-50/50 transition-all disabled:opacity-50"
            >
              <div className="text-3xl mb-2">{preset.icon}</div>
              <h3 className="font-semibold text-gray-900">{preset.label} Dataset</h3>
              <p className="text-xs text-gray-500 mt-1">{preset.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Templates Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 dark:text-white">Templates</h2>
          <button
            onClick={() => setShowCreateTemplate(true)}
            className="bg-amber-500 hover:bg-amber-600 text-white rounded-lg px-4 py-2 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Create Template
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                <th className="px-6 py-3 font-medium text-gray-900 dark:text-white">Name</th>
                <th className="px-6 py-3 font-medium text-gray-900 dark:text-white">Description</th>
                <th className="px-6 py-3 font-medium text-gray-900 dark:text-white">Config Summary</th>
                <th className="px-6 py-3 font-medium text-gray-900 dark:text-white">Status</th>
                <th className="px-6 py-3 font-medium text-gray-900 dark:text-white">Last Generated</th>
              </tr>
            </thead>
            <tbody>
              {loadingTemplates ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    Loading templates...
                  </td>
                </tr>
              ) : templates.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No templates yet. Create one to get started.
                  </td>
                </tr>
              ) : (
                templates.map((t) => {
                  let config: Record<string, number> = {};
                  try {
                    config = JSON.parse(t.config || "{}");
                  } catch {}
                  return (
                    <tr
                      key={t.id}
                      className={`border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer ${
                        selectedTemplateId === t.id ? "bg-amber-50 dark:bg-amber-900/20" : ""
                      }`}
                      onClick={() => setSelectedTemplateId(t.id)}
                    >
                      <td className="px-6 py-3 font-medium text-gray-900 dark:text-white">{t.name}</td>
                      <td className="px-6 py-3 text-gray-600 dark:text-gray-400 max-w-[200px] truncate">
                        {t.description || "—"}
                      </td>
                      <td className="px-6 py-3 text-gray-600 dark:text-gray-400 text-xs">
                        {configSummary(config)}
                      </td>
                      <td className="px-6 py-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                            t.status === "generating"
                              ? "bg-amber-100 text-amber-800"
                              : t.status === "completed"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-gray-500 text-xs">
                        {t.lastGenerated
                          ? new Date(t.lastGenerated).toLocaleString()
                          : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Generate Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Generate Dataset</h2>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Select Template
            </label>
            <select
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2"
              value={selectedTemplateId || ""}
              onChange={(e) => setSelectedTemplateId(e.target.value || null)}
            >
              <option value="">— Select a template —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => selectedTemplateId && generateMutation.mutate(selectedTemplateId)}
              disabled={!selectedTemplateId || isGenerating || templates.some((t) => t.status === "generating")}
              className="bg-amber-500 hover:bg-amber-600 text-white rounded-lg px-6 py-3 flex items-center gap-2 font-medium text-lg"
            >
              {isGenerating && generateMutation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Play className="w-5 h-5" />
              )}
              Generate Dataset
            </button>
            <button
              onClick={() => quickGenerateMutation.mutate()}
              disabled={isGenerating}
              className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-200 rounded-lg px-4 py-3 flex items-center gap-2"
            >
              <Zap className="w-4 h-4" /> Quick Generate
            </button>
          </div>
        </div>
        {isGenerating && (
          <div className="mt-4 flex items-center gap-2 text-amber-600">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Generating data... This may take a moment.</span>
          </div>
        )}
        {generateResult && !isGenerating && (
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-5 gap-4">
            {Object.entries(generateResult).map(([key, count]) => (
              <div
                key={key}
                className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-center"
              >
                <p className="text-2xl font-bold text-amber-800 dark:text-amber-200">{count}</p>
                <p className="text-sm text-amber-700 dark:text-amber-300 capitalize">
                  {key.replace(/([A-Z])/g, " $1").trim()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Data Management - Admin only */}
      {isAdmin && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-start gap-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg mb-4">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-800 dark:text-red-200">Warning: Data Loss</p>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                Clearing generated data will permanently delete all customers, vendors, materials, purchase orders, and sales orders created by the dataset generator.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowClearConfirm(true)}
            className="bg-red-600 hover:bg-red-700 text-white rounded-lg px-4 py-2 flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" /> Clear All Generated Data
          </button>
        </div>
      )}

      <Modal
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        title="Confirm Clear Data"
        footer={
          <div className="flex gap-2">
            <button
              onClick={() => setShowClearConfirm(false)}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg px-4 py-2"
            >
              Cancel
            </button>
            <button
              onClick={() => clearMutation.mutate()}
              disabled={clearMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white rounded-lg px-4 py-2"
            >
              Yes, Clear All Data
            </button>
          </div>
        }
      >
        <p className="text-gray-600 dark:text-gray-400">
          This will permanently delete all generated data (customers, vendors, materials, POs, SOs). Are you sure?
        </p>
      </Modal>

      <Modal
        isOpen={showCreateTemplate}
        onClose={() => setShowCreateTemplate(false)}
        title="Create Template"
        size="lg"
        footer={
          <button
            onClick={() => createTemplateMutation.mutate(templateForm)}
            disabled={createTemplateMutation.isPending || !templateForm.name}
            className="bg-amber-500 hover:bg-amber-600 text-white rounded-lg px-4 py-2"
          >
            Create Template
          </button>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input
              className="input"
              value={templateForm.name}
              onChange={(e) => setTemplateForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Small Demo Dataset"
            />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              className="input min-h-[60px]"
              value={templateForm.description}
              onChange={(e) => setTemplateForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Optional description"
            />
          </div>
          <div>
            <label className="label mb-2 block">Configuration</label>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(CONFIG_LIMITS).map(([key, [min, max]]) => (
                <div key={key}>
                  <label className="text-xs text-gray-500 capitalize">
                    {key.replace(/([A-Z])/g, " $1").trim()}
                  </label>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    value={templateForm.config[key as keyof typeof templateForm.config] ?? min}
                    onChange={(e) =>
                      setTemplateForm((f) => ({
                        ...f,
                        config: { ...f.config, [key]: +e.target.value },
                      }))
                    }
                    className="w-full mt-1"
                  />
                  <span className="text-sm text-gray-600 ml-2">
                    {templateForm.config[key as keyof typeof templateForm.config] ?? min}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
