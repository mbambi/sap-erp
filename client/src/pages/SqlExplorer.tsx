import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Play, Trash2, Loader2, ChevronDown, ChevronRight, Database } from "lucide-react";
import { api } from "../api/client";
import PageHeader from "../components/PageHeader";

const EXAMPLE_QUERIES = [
  {
    label: "Top 10 materials by stock value",
    sql: "SELECT m.materialNumber, m.description, m.stockQuantity, m.movingAvgPrice, (m.stockQuantity * m.movingAvgPrice) as stockValue FROM Material m ORDER BY stockValue DESC LIMIT 10",
  },
  {
    label: "Purchase orders by vendor",
    sql: "SELECT v.name as vendorName, po.poNumber, po.status, po.totalAmount FROM PurchaseOrder po JOIN Vendor v ON po.vendorId = v.id ORDER BY po.createdAt DESC LIMIT 20",
  },
  {
    label: "Monthly revenue",
    sql: "SELECT strftime('%Y-%m', so.createdAt) as month, SUM(so.totalAmount) as revenue FROM SalesOrder so WHERE so.status = 'completed' GROUP BY month ORDER BY month DESC LIMIT 12",
  },
  {
    label: "Inventory turnover",
    sql: "SELECT m.materialNumber, m.description, m.stockQuantity, m.movingAvgPrice FROM Material m WHERE m.stockQuantity > 0 ORDER BY (m.stockQuantity * m.movingAvgPrice) DESC LIMIT 20",
  },
  {
    label: "Open production orders",
    sql: "SELECT po.orderNumber, po.status, po.quantity, po.materialId FROM ProductionOrder po WHERE po.status IN ('planned', 'released', 'in_progress') ORDER BY po.createdAt DESC LIMIT 20",
  },
];

interface TableSchema {
  name: string;
  columns: { name: string; type: string }[];
}

interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  executionTimeMs?: number;
}

export default function SqlExplorer() {
  const [sql, setSql] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<"results" | "schema">("results");

  const { data: tables = [], isLoading: tablesLoading } = useQuery({
    queryKey: ["sql-explorer-tables"],
    queryFn: () => api.get<TableSchema[]>("/sql-explorer/tables"),
  });

  const runMutation = useMutation({
    mutationFn: (query: string) =>
      api.post<QueryResult>("/sql-explorer/execute", { query }),
  });

  const [result, setResult] = useState<QueryResult | null>(null);

  const handleRun = () => {
    if (!sql.trim()) return;
    runMutation.mutate(sql, {
      onSuccess: (data) => setResult(data),
      onError: () => setResult(null),
    });
  };

  const handleExampleSelect = (example: (typeof EXAMPLE_QUERIES)[0]) => {
    setSql(example.sql);
    setResult(null);
  };

  const insertTableQuery = (tableName: string) => {
    setSql(`SELECT * FROM ${tableName} LIMIT 20`);
    setActiveTab("results");
  };

  const [schemaExpanded, setSchemaExpanded] = useState<Record<string, boolean>>({});

  return (
    <div>
      <PageHeader
        title="SQL Explorer"
        subtitle="Interactive SQL query tool for ERP data analysis"
      />

      <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
        Read-only access. Only SELECT queries allowed.
      </div>

      <div className="flex gap-4">
        {/* Sidebar - collapsible */}
        <div
          className={`${sidebarCollapsed ? "w-12" : "w-56"} flex-shrink-0 transition-all`}
        >
          <div className="card overflow-hidden">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="w-full px-4 py-3 flex items-center justify-between border-b hover:bg-gray-50"
            >
              <span className="flex items-center gap-2">
                <Database className="w-4 h-4" />
                {!sidebarCollapsed && <span className="font-medium">Tables</span>}
              </span>
              {sidebarCollapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4 rotate-180" />
              )}
            </button>
            {!sidebarCollapsed && (
              <div className="max-h-64 overflow-y-auto p-2">
                {tablesLoading ? (
                  <div className="p-4 text-center">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" />
                  </div>
                ) : (
                  tables.map((t) => (
                    <button
                      key={t.name}
                      onClick={() => insertTableQuery(t.name)}
                      className="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 truncate"
                    >
                      {t.name}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          {/* Query editor - top half */}
          <div className="card overflow-hidden">
            <div className="p-4 border-b flex flex-wrap items-center gap-3">
              <select
                className="input w-auto max-w-xs"
                onChange={(e) => {
                  const ex = EXAMPLE_QUERIES.find((x) => x.label === e.target.value);
                  if (ex) handleExampleSelect(ex);
                }}
                value=""
              >
                <option value="">Example queries...</option>
                {EXAMPLE_QUERIES.map((ex) => (
                  <option key={ex.label} value={ex.label}>
                    {ex.label}
                  </option>
                ))}
              </select>
              <button
                onClick={handleRun}
                disabled={!sql.trim() || runMutation.isPending}
                className="btn-primary"
              >
                {runMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}{" "}
                Run Query
              </button>
              <button
                onClick={() => {
                  setSql("");
                  setResult(null);
                }}
                className="btn-secondary"
              >
                <Trash2 className="w-4 h-4" /> Clear
              </button>
              {result?.executionTimeMs != null && (
                <span className="text-sm text-gray-500 ml-auto">
                  {result.executionTimeMs} ms
                </span>
              )}
            </div>
            <div className="p-4">
              <textarea
                value={sql}
                onChange={(e) => setSql(e.target.value)}
                placeholder="SELECT * FROM Material LIMIT 20"
                className="input font-mono text-sm min-h-[120px] resize-y"
                spellCheck={false}
              />
            </div>
          </div>

          {/* Results - bottom half */}
          <div className="card overflow-hidden flex-1 min-h-[300px] flex flex-col">
            <div className="flex border-b">
              <button
                onClick={() => setActiveTab("results")}
                className={`px-4 py-3 text-sm font-medium ${
                  activeTab === "results"
                    ? "border-b-2 border-primary-600 text-primary-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Results
              </button>
              <button
                onClick={() => setActiveTab("schema")}
                className={`px-4 py-3 text-sm font-medium ${
                  activeTab === "schema"
                    ? "border-b-2 border-primary-600 text-primary-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Schema
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4">
              {activeTab === "results" && (
                <>
                  {runMutation.isError && (
                    <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">
                      {runMutation.error?.message ?? "Query failed"}
                    </div>
                  )}
                  {result && (
                    <>
                      <p className="text-sm text-gray-500 mb-3">
                        {result.rowCount} row{result.rowCount !== 1 ? "s" : ""}
                      </p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                          <thead>
                            <tr className="border-b bg-gray-50">
                              {result.columns.map((col) => (
                                <th
                                  key={col}
                                  className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase"
                                >
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {result.rows.map((row, i) => (
                              <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                                {result.columns.map((col) => (
                                  <td key={col} className="px-4 py-2 text-gray-700">
                                    {row[col] != null ? String(row[col]) : "NULL"}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                  {!result && !runMutation.isError && !runMutation.isPending && (
                    <p className="text-gray-400 text-sm">Run a query to see results.</p>
                  )}
                </>
              )}

              {activeTab === "schema" && (
                <div className="space-y-2">
                  {tablesLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                  ) : (
                    tables.map((t) => (
                      <div key={t.name} className="border rounded-lg overflow-hidden">
                        <button
                          onClick={() =>
                            setSchemaExpanded((s) => ({
                              ...s,
                              [t.name]: !s[t.name],
                            }))
                          }
                          className="w-full px-4 py-3 flex items-center gap-2 bg-gray-50 hover:bg-gray-100 text-left"
                        >
                          {schemaExpanded[t.name] ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                          <span className="font-medium">{t.name}</span>
                        </button>
                        {schemaExpanded[t.name] && (
                          <div className="p-4 bg-white border-t">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-left text-xs text-gray-500">
                                  <th className="pb-2">Column</th>
                                  <th className="pb-2">Type</th>
                                </tr>
                              </thead>
                              <tbody>
                                {t.columns.map((c) => (
                                  <tr key={c.name} className="border-b last:border-0">
                                    <td className="py-1.5 font-mono">{c.name}</td>
                                    <td className="py-1.5 text-gray-500">{c.type}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
