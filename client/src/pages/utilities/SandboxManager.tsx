import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Trash2, RefreshCw, FileDown, Upload } from "lucide-react";
import { api } from "../../api/client";
import PageHeader from "../../components/PageHeader";
import Modal from "../../components/Modal";

const ENTITIES = [
  { value: "materials", label: "Materials" },
  { value: "vendors", label: "Vendors" },
  { value: "customers", label: "Customers" },
];

export default function SandboxManager() {
  const queryClient = useQueryClient();
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [importEntity, setImportEntity] = useState("materials");
  const [importInput, setImportInput] = useState("");
  const [previewRows, setPreviewRows] = useState<any[] | null>(null);
  const [importResult, setImportResult] = useState<{ imported: number; errors: string[] } | null>(null);
  const [exportEntity, setExportEntity] = useState("materials");

  const resetMutation = useMutation({
    mutationFn: () => api.post("/utilities/sandbox-reset"),
    onSuccess: () => {
      setResetModalOpen(false);
      queryClient.invalidateQueries();
    },
  });

  const parseInput = () => {
    const text = importInput.trim();
    if (!text) return;
    let rows: any[] = [];
    try {
      if (text.startsWith("[")) {
        rows = JSON.parse(text);
      } else {
        const lines = text.split("\n").filter((l) => l.trim());
        if (lines.length < 2) return;
        const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
          const row: any = {};
          headers.forEach((h, j) => (row[h] = values[j] ?? ""));
          rows.push(row);
        }
      }
      setPreviewRows(rows);
      setImportResult(null);
    } catch {
      setPreviewRows([]);
    }
  };

  const doImport = async () => {
    if (!previewRows || previewRows.length === 0) return;
    setImportResult(null);
    try {
      const res = await api.post<{ imported: number; errors: string[] }>(
        `/utilities/import/${importEntity}`,
        { rows: previewRows }
      );
      setImportResult({ imported: res.imported, errors: res.errors || [] });
      queryClient.invalidateQueries();
    } catch (e: any) {
      setImportResult({ imported: 0, errors: [e.message] });
    }
  };

  const doExport = async () => {
    try {
      const res = await fetch(`/api/utilities/export/${exportEntity}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("erp_token")}`,
        },
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${exportEntity}-export.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e.message || "Export failed");
    }
  };

  const materialHeaders = ["materialNumber", "description", "type", "baseUnit", "standardPrice", "stockQuantity", "reorderPoint", "safetyStock", "leadTimeDays"];
  const vendorHeaders = ["vendorNumber", "name", "email", "paymentTerms"];
  const customerHeaders = ["customerNumber", "name", "email", "creditLimit"];

  const getHeaders = () => {
    if (importEntity === "materials") return materialHeaders;
    if (importEntity === "vendors") return vendorHeaders;
    return customerHeaders;
  };

  return (
    <div>
      <PageHeader
        title="Sandbox Manager"
        subtitle="Reset sandbox data or import/export CSV"
      />

      {/* Warning & Reset */}
      <div className="card p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-amber-50 shrink-0">
            <AlertTriangle className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-1">Sandbox Reset</h3>
            <p className="text-sm text-gray-600 mb-4">
              Resetting the sandbox will clear all transactional data (purchase orders, sales
              orders, journal entries, deliveries, invoices, etc.) including workflow instances and
              MRP runs. Master data (materials, vendors, customers, GL accounts, etc.) is
              preserved. Your XP and achievements will be reset.
            </p>
            <button
              onClick={() => setResetModalOpen(true)}
              className="btn-danger flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Reset Sandbox
            </button>
          </div>
        </div>
      </div>

      <Modal
        isOpen={resetModalOpen}
        onClose={() => !resetMutation.isPending && setResetModalOpen(false)}
        title="Confirm Sandbox Reset"
        footer={
          <>
            <button
              onClick={() => setResetModalOpen(false)}
              className="btn-secondary"
              disabled={resetMutation.isPending}
            >
              Cancel
            </button>
            <button
              onClick={() => resetMutation.mutate()}
              className="btn-danger flex items-center gap-2"
              disabled={resetMutation.isPending}
            >
              {resetMutation.isPending ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              {resetMutation.isPending ? "Resetting..." : "Confirm Reset"}
            </button>
          </>
        }
      >
        <p className="text-gray-600">
          Are you sure? This will delete all transactional data including POs, SOs, journal
          entries, deliveries, invoices, etc. Master data will be preserved.
        </p>
        {resetMutation.isSuccess && (
          <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm">
            Sandbox reset complete.
          </div>
        )}
        {resetMutation.isError && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
            {String(resetMutation.error)}
          </div>
        )}
      </Modal>

      {/* CSV Import */}
      <div className="card p-6 mb-6">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Upload className="w-4 h-4" />
          CSV Import
        </h3>
        <div className="space-y-4">
          <div>
            <label className="label">Entity</label>
            <select
              value={importEntity}
              onChange={(e) => {
                setImportEntity(e.target.value);
                setPreviewRows(null);
                setImportResult(null);
              }}
              className="input"
            >
              {ENTITIES.map((e) => (
                <option key={e.value} value={e.value}>
                  {e.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Paste CSV or JSON</label>
            <textarea
              value={importInput}
              onChange={(e) => setImportInput(e.target.value)}
              placeholder={
                importEntity === "materials"
                  ? "materialNumber,description,type,baseUnit,standardPrice,stockQuantity,..."
                  : importEntity === "vendors"
                  ? "vendorNumber,name,email,paymentTerms"
                  : "customerNumber,name,email,creditLimit"
              }
              className="input min-h-[120px] font-mono text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={parseInput} className="btn-secondary">
              Parse & Preview
            </button>
            <button
              onClick={doImport}
              disabled={!previewRows || previewRows.length === 0}
              className="btn-primary"
            >
              Import
            </button>
          </div>
          {previewRows && previewRows.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="p-2 bg-gray-50 text-xs text-gray-500">
                Preview: {previewRows.length} rows
              </div>
              <div className="max-h-48 overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      {getHeaders().map((h) => (
                        <th key={h} className="px-3 py-2 text-left font-medium text-gray-600">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-t">
                        {getHeaders().map((h) => (
                          <td key={h} className="px-3 py-2 text-gray-700">
                            {String(row[h] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {importResult && (
            <div className="p-4 rounded-lg bg-gray-50">
              <p className="text-sm font-medium">{importResult.imported} imported</p>
              {importResult.errors.length > 0 && (
                <ul className="mt-2 text-xs text-red-600 list-disc list-inside">
                  {importResult.errors.slice(0, 5).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                  {importResult.errors.length > 5 && (
                    <li>... and {importResult.errors.length - 5} more</li>
                  )}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      {/* CSV Export */}
      <div className="card p-6">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <FileDown className="w-4 h-4" />
          CSV Export
        </h3>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="label">Entity</label>
            <select
              value={exportEntity}
              onChange={(e) => setExportEntity(e.target.value)}
              className="input"
            >
              {ENTITIES.map((e) => (
                <option key={e.value} value={e.value}>
                  {e.label}
                </option>
              ))}
            </select>
          </div>
          <button onClick={doExport} className="btn-primary flex items-center gap-2">
            <FileDown className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>
    </div>
  );
}
