import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileSpreadsheet, FileJson, Database, BarChart3, AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import { api } from "../../api/client";
import PageHeader from "../../components/PageHeader";

export default function DataExportLab() {
  const [downloading, setDownloading] = useState<string | null>(null);

  const { data: entities = [] } = useQuery({
    queryKey: ["export-entities"],
    queryFn: () => api.get("/data-export/entities"),
  });

  const { data: summary = {}, isLoading } = useQuery({
    queryKey: ["export-summary"],
    queryFn: () => api.get("/data-export/summary"),
  });

  const handleExport = async (entity: string, format: "csv" | "json") => {
    setDownloading(`${entity}-${format}`);
    try {
      const response = await fetch(`/api/data-export/${format}/${entity}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });

      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${entity}_${new Date().toISOString().split("T")[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setDownloading(null);
    }
  };

  const totalRecords = Object.values(summary).reduce((sum: number, v: any) => sum + (v || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Data Export Lab" subtitle="Export ERP data for analysis, research, and reporting" />

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-5">
          <Database className="w-5 h-5 text-blue-600 mb-2" />
          <p className="text-2xl font-bold text-gray-900">{totalRecords.toLocaleString()}</p>
          <p className="text-xs text-gray-500">Total Records</p>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <BarChart3 className="w-5 h-5 text-green-600 mb-2" />
          <p className="text-2xl font-bold text-gray-900">{entities.length}</p>
          <p className="text-xs text-gray-500">Entity Types</p>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <FileSpreadsheet className="w-5 h-5 text-purple-600 mb-2" />
          <p className="text-2xl font-bold text-gray-900">CSV</p>
          <p className="text-xs text-gray-500">Excel Compatible</p>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <FileJson className="w-5 h-5 text-amber-600 mb-2" />
          <p className="text-2xl font-bold text-gray-900">JSON</p>
          <p className="text-xs text-gray-500">API Compatible</p>
        </div>
      </div>

      {/* Export table */}
      <div className="bg-white rounded-xl border">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Available Exports</h3>
          <span className="text-xs text-gray-500">Max 10,000 records per export</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entity</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase">Records</th>
                <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase">Export As</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {entities.map((entity: any) => {
                const count = summary[entity.key] || 0;
                return (
                  <tr key={entity.key} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                          <Database className="w-4 h-4 text-gray-500" />
                        </div>
                        <span className="text-sm font-medium text-gray-900">{entity.label}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="text-sm font-semibold text-gray-900">{count.toLocaleString()}</span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      {count > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3" /> Available
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                          <AlertCircle className="w-3 h-3" /> Empty
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => handleExport(entity.key, "csv")} disabled={count === 0 || !!downloading}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 disabled:opacity-40 transition-colors">
                          {downloading === `${entity.key}-csv` ? <RefreshCw className="w-3 h-3 animate-spin" /> : <FileSpreadsheet className="w-3 h-3" />}
                          CSV
                        </button>
                        <button onClick={() => handleExport(entity.key, "json")} disabled={count === 0 || !!downloading}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 disabled:opacity-40 transition-colors">
                          {downloading === `${entity.key}-json` ? <RefreshCw className="w-3 h-3 animate-spin" /> : <FileJson className="w-3 h-3" />}
                          JSON
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tips */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 p-6">
        <h3 className="text-sm font-semibold text-blue-900 mb-3">Research Tips</h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs text-blue-800">
          <div>
            <p className="font-medium mb-1">CSV for Spreadsheets</p>
            <p className="text-blue-600">Open directly in Excel, Google Sheets, or any data analysis tool. Filter, sort, and create pivot tables.</p>
          </div>
          <div>
            <p className="font-medium mb-1">JSON for Coding</p>
            <p className="text-blue-600">Import into Python, R, or JavaScript for custom analysis. Perfect for data science projects.</p>
          </div>
          <div>
            <p className="font-medium mb-1">SQL Explorer</p>
            <p className="text-blue-600">For advanced queries, use the SQL Explorer to run custom queries against the database.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
