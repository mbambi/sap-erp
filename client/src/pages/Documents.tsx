import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import { FormInput, FormSelect, FormTextArea } from "../components/FormField";
import {
  FileText,
  FileSpreadsheet,
  FileImage,
  Paperclip,
  Grid3X3,
  List,
  Plus,
  Download,
  Trash2,
  Loader2,
} from "lucide-react";

const ENTITY_TYPES = [
  { value: "purchase_order", label: "Purchase Order" },
  { value: "sales_order", label: "Sales Order" },
  { value: "invoice", label: "Invoice" },
  { value: "vendor", label: "Vendor" },
  { value: "customer", label: "Customer" },
];

const DOC_TYPES = [
  { value: "contract", label: "Contract" },
  { value: "invoice", label: "Invoice PDF" },
  { value: "report", label: "Report" },
  { value: "attachment", label: "Attachment" },
];

const DOC_ICONS: Record<string, typeof FileText> = {
  contract: FileText,
  invoice: FileSpreadsheet,
  report: FileText,
  attachment: Paperclip,
};

export default function Documents() {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [filters, setFilters] = useState({
    entityType: "",
    documentType: "",
    search: "",
  });
  const [showUpload, setShowUpload] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [generateForm, setGenerateForm] = useState({ entityType: "", entityId: "" });
  const [generatedDoc, setGeneratedDoc] = useState<any>(null);

  const [uploadForm, setUploadForm] = useState({
    name: "",
    type: "attachment",
    entityType: "",
    entityId: "",
    description: "",
    content: "",
    tags: "",
  });

  const docsQuery = useQuery({
    queryKey: ["documents", filters],
    queryFn: () =>
      api.get("/documents", {
        entityType: filters.entityType || undefined,
        documentType: filters.documentType || undefined,
        search: filters.search || undefined,
      }),
  });

  const entitiesQuery = useQuery({
    queryKey: ["documents-entities"],
    queryFn: async () => {
      const [pos, sos, invoices] = await Promise.all([
        api.get("/materials/purchase-orders").catch(() => ({ data: [] })),
        api.get("/sales/orders").catch(() => ({ data: [] })),
        api.get("/finance/invoices").catch(() => ({ data: [] })),
      ]);
      return { pos, sos, invoices };
    },
  });

  const docsData = docsQuery.data || {};
  const documents = docsData.data ?? docsData.documents ?? [];
  const stats = docsData.stats ?? {
    total: 0,
    contracts: 0,
    invoicePdfs: 0,
    attachments: 0,
  };

  const uploadMutation = useMutation({
    mutationFn: (data: typeof uploadForm) => api.post("/documents", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      setShowUpload(false);
      setUploadForm({ name: "", type: "attachment", entityType: "", entityId: "", description: "", content: "", tags: "" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/documents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      setSelectedDoc(null);
    },
  });

  const generateMutation = useMutation({
    mutationFn: (data: { entityType: string; entityId: string }) =>
      api.post("/documents/generate-pdf", data),
    onSuccess: (data) => setGeneratedDoc(data),
  });

  const getEntityOptions = () => {
    const { pos, sos, invoices } = entitiesQuery.data || {};
    const poList = Array.isArray(pos?.data) ? pos.data : Array.isArray(pos) ? pos : [];
    const soList = Array.isArray(sos?.data) ? sos.data : Array.isArray(sos) ? sos : [];
    const invList = Array.isArray(invoices?.data) ? invoices.data : Array.isArray(invoices) ? invoices : [];
    return {
      purchase_order: poList.map((p: any) => ({ value: p.id, label: p.poNumber ?? p.id })),
      sales_order: soList.map((s: any) => ({ value: s.id, label: s.soNumber ?? s.id })),
      invoice: invList.map((i: any) => ({ value: i.id, label: i.invoiceNumber ?? i.id })),
      vendor: [],
      customer: [],
    };
  };

  const entityOptions = getEntityOptions();

  return (
    <div>
      <PageHeader
        title="Documents"
        subtitle="Manage and generate documents"
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <p className="text-sm text-gray-500">Total Documents</p>
          <p className="text-2xl font-bold">{stats.total ?? documents.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <p className="text-sm text-gray-500">Contracts</p>
          <p className="text-2xl font-bold">{stats.contracts ?? 0}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <p className="text-sm text-gray-500">Invoice PDFs</p>
          <p className="text-2xl font-bold">{stats.invoicePdfs ?? 0}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <p className="text-sm text-gray-500">Attachments</p>
          <p className="text-2xl font-bold">{stats.attachments ?? 0}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-4">
        <select
          value={filters.entityType}
          onChange={(e) => setFilters({ ...filters, entityType: e.target.value })}
          className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
        >
          <option value="">All entity types</option>
          {ENTITY_TYPES.map((e) => (
            <option key={e.value} value={e.value}>{e.label}</option>
          ))}
        </select>
        <select
          value={filters.documentType}
          onChange={(e) => setFilters({ ...filters, documentType: e.target.value })}
          className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
        >
          <option value="">All document types</option>
          {DOC_TYPES.map((d) => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Search by name"
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm w-48"
        />
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-2 rounded-lg ${viewMode === "grid" ? "bg-blue-100 text-blue-600" : "hover:bg-gray-100"}`}
          >
            <Grid3X3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-2 rounded-lg ${viewMode === "list" ? "bg-blue-100 text-blue-600" : "hover:bg-gray-100"}`}
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowUpload(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Upload
          </button>
        </div>
      </div>

      {/* Documents */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {docsQuery.isLoading ? (
            <div className="col-span-full flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : documents.length === 0 ? (
            <div className="col-span-full text-center py-12 text-gray-400">No documents</div>
          ) : (
            documents.map((doc: any) => {
              const Icon = DOC_ICONS[doc.type] ?? FileText;
              return (
                <div
                  key={doc.id}
                  onClick={() => setSelectedDoc(doc)}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 cursor-pointer hover:border-blue-400 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-gray-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{doc.name}</p>
                      <p className="text-xs text-gray-500">{doc.entityType ?? "—"}</p>
                      <p className="text-xs text-gray-400">
                        {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : "—"} · {doc.size ?? "—"}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50">
                <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Name</th>
                <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Type</th>
                <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Entity</th>
                <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Description</th>
                <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Uploaded By</th>
                <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Date</th>
                <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
              {documents.map((doc: any) => (
                <tr key={doc.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setSelectedDoc(doc)}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {doc.name}
                    </button>
                  </td>
                  <td className="px-4 py-3">{doc.type}</td>
                  <td className="px-4 py-3">{doc.entityType ?? "—"} {doc.entityId ? `#${doc.entityId}` : ""}</td>
                  <td className="px-4 py-3 truncate max-w-[120px]">{doc.description ?? "—"}</td>
                  <td className="px-4 py-3">{doc.uploadedBy ?? "—"}</td>
                  <td className="px-4 py-3">
                    {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 flex gap-2">
                    {doc.url && (
                      <a
                        href={doc.url}
                        download
                        className="text-blue-600 hover:underline"
                      >
                        <Download className="w-4 h-4 inline" />
                      </a>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteMutation.mutate(doc.id);
                      }}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4 inline" />
                    </button>
                  </td>
                </tr>
              ))}
              {documents.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">No documents</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Generate PDF */}
      <div className="mt-8 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Generate PDF</h3>
        <div className="flex flex-wrap gap-4 items-end">
          <FormSelect
            label="Entity Type"
            value={generateForm.entityType}
            onChange={(e) => setGenerateForm({ ...generateForm, entityType: e.target.value })}
            options={[{ value: "", label: "Select..." }, ...ENTITY_TYPES]}
          />
          <FormInput
            label="Entity ID"
            value={generateForm.entityId}
            onChange={(e) => setGenerateForm({ ...generateForm, entityId: e.target.value })}
            placeholder="e.g. PO-001"
          />
          <button
            onClick={() => generateMutation.mutate(generateForm)}
            disabled={generateMutation.isPending || !generateForm.entityType || !generateForm.entityId}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 flex items-center gap-2 disabled:opacity-50"
          >
            {generateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Generate
          </button>
        </div>
        {generatedDoc && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <p className="text-sm font-medium mb-2">Generated document:</p>
            <pre className="text-xs overflow-auto max-h-40">
              {typeof generatedDoc === "string"
                ? generatedDoc
                : JSON.stringify(generatedDoc, null, 2)}
            </pre>
            {generatedDoc?.url && (
              <a
                href={generatedDoc.url}
                download
                className="mt-2 inline-flex items-center gap-1 text-blue-600 hover:underline"
              >
                <Download className="w-4 h-4" /> Download
              </a>
            )}
          </div>
        )}
      </div>

      {/* Document Detail Modal */}
      <Modal
        isOpen={!!selectedDoc}
        onClose={() => setSelectedDoc(null)}
        title={selectedDoc?.name ?? "Document"}
        size="lg"
        footer={
          <>
            <button
              onClick={() => selectedDoc && deleteMutation.mutate(selectedDoc.id)}
              disabled={deleteMutation.isPending}
              className="btn-secondary text-red-600 hover:bg-red-50"
            >
              Delete
            </button>
            {selectedDoc?.url && (
              <a
                href={selectedDoc.url}
                download
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 flex items-center gap-2"
              >
                <Download className="w-4 h-4" /> Download
              </a>
            )}
          </>
        }
      >
        {selectedDoc && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <p><span className="text-gray-500">Type:</span> {selectedDoc.type}</p>
              <p><span className="text-gray-500">Entity:</span> {selectedDoc.entityType} {selectedDoc.entityId}</p>
              <p><span className="text-gray-500">Uploaded:</span> {selectedDoc.uploadedAt ? new Date(selectedDoc.uploadedAt).toLocaleString() : "—"}</p>
              <p><span className="text-gray-500">Size:</span> {selectedDoc.size ?? "—"}</p>
            </div>
            {selectedDoc.description && (
              <p className="text-sm">{selectedDoc.description}</p>
            )}
            {selectedDoc.content && (
              <pre className="text-xs overflow-auto max-h-64 p-4 bg-gray-100 dark:bg-gray-700/50 rounded">
                {selectedDoc.content}
              </pre>
            )}
          </div>
        )}
      </Modal>

      {/* Upload Modal */}
      <Modal
        isOpen={showUpload}
        onClose={() => setShowUpload(false)}
        title="Upload Document"
        size="lg"
        footer={
          <>
            <button onClick={() => setShowUpload(false)} className="btn-secondary">Cancel</button>
            <button
              onClick={() => uploadMutation.mutate(uploadForm)}
              disabled={uploadMutation.isPending || !uploadForm.name}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2"
            >
              {uploadMutation.isPending && <Loader2 className="w-4 h-4 animate-spin inline" />} Upload
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <FormInput
            label="Name"
            value={uploadForm.name}
            onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
          />
          <FormSelect
            label="Type"
            value={uploadForm.type}
            onChange={(e) => setUploadForm({ ...uploadForm, type: e.target.value })}
            options={DOC_TYPES}
          />
          <FormSelect
            label="Entity Type"
            value={uploadForm.entityType}
            onChange={(e) => setUploadForm({ ...uploadForm, entityType: e.target.value })}
            options={[{ value: "", label: "Select..." }, ...ENTITY_TYPES]}
          />
          {uploadForm.entityType && (
            <FormSelect
              label="Entity"
              value={uploadForm.entityId}
              onChange={(e) => setUploadForm({ ...uploadForm, entityId: e.target.value })}
              options={(entityOptions as Record<string, { value: string; label: string }[]>)[uploadForm.entityType] ?? []}
            />
          )}
          <FormTextArea
            label="Description"
            value={uploadForm.description}
            onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
          />
          <FormInput
            label="Tags"
            value={uploadForm.tags}
            onChange={(e) => setUploadForm({ ...uploadForm, tags: e.target.value })}
            placeholder="comma-separated"
          />
          <FormTextArea
            label="Content (for text-based docs)"
            value={uploadForm.content}
            onChange={(e) => setUploadForm({ ...uploadForm, content: e.target.value })}
            rows={4}
          />
        </div>
      </Modal>
    </div>
  );
}
