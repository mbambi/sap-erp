import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import PageHeader from "../../components/PageHeader";
import { FlaskConical, Play, Download, History, Loader2, ChevronDown, ChevronRight } from "lucide-react";

export default function ExperimentLab() {
  const queryClient = useQueryClient();
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [params, setParams] = useState<Record<string, any>>({});
  const [experimentName, setExperimentName] = useState("");
  const [results, setResults] = useState<any>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedResult, setExpandedResult] = useState<string | null>(null);

  const { data: templates } = useQuery({
    queryKey: ["experiment-templates"],
    queryFn: () => api.get("/experiment-lab/templates"),
  });

  const { data: history } = useQuery({
    queryKey: ["experiment-history"],
    queryFn: () => api.get("/experiment-lab/history"),
    enabled: showHistory,
  });

  const runMutation = useMutation({
    mutationFn: (data: { templateId: string; parameters: Record<string, any>; name?: string }) =>
      api.post("/experiment-lab/run", data),
    onSuccess: (data) => {
      setResults(data);
      queryClient.invalidateQueries({ queryKey: ["experiment-history"] });
    },
  });

  const selectTemplate = (id: string) => {
    setSelectedTemplate(id);
    setResults(null);
    const tpl = templates?.find((t: any) => t.id === id);
    if (tpl) {
      const defaults: Record<string, any> = {};
      tpl.parameters.forEach((p: any) => { defaults[p.name] = p.default; });
      setParams(defaults);
    }
  };

  const activeTemplate = templates?.find((t: any) => t.id === selectedTemplate);

  return (
    <div className="space-y-6">
      <PageHeader
        title="ERP Experiment Lab"
        subtitle="Run controlled experiments for research-grade analysis"
        icon={FlaskConical}
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Template Selection */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm">Experiment Templates</h3>
            <div className="space-y-2">
              {templates?.map((t: any) => (
                <button
                  key={t.id}
                  onClick={() => selectTemplate(t.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors text-sm ${
                    selectedTemplate === t.id
                      ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-primary-300"
                  }`}
                >
                  <div className="font-medium text-gray-900 dark:text-white">{t.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{t.category}</div>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm"
          >
            <History className="w-4 h-4" />
            {showHistory ? "Hide" : "Show"} History
          </button>
        </div>

        {/* Parameters & Run */}
        <div className="lg:col-span-3 space-y-4">
          {activeTemplate ? (
            <>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{activeTemplate.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">{activeTemplate.description}</p>
                  </div>
                  <button
                    onClick={() => runMutation.mutate({
                      templateId: selectedTemplate!,
                      parameters: params,
                      name: experimentName || undefined,
                    })}
                    disabled={runMutation.isPending}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm flex items-center gap-2"
                  >
                    {runMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    Run Experiment
                  </button>
                </div>

                <div className="mb-4">
                  <input
                    type="text"
                    placeholder="Experiment name (optional)"
                    value={experimentName}
                    onChange={(e) => setExperimentName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {activeTemplate.parameters.map((p: any) => (
                    <div key={p.name}>
                      <label className="block text-xs font-medium text-gray-500 mb-1">{p.label}</label>
                      {p.type === "select" ? (
                        <select
                          value={params[p.name] ?? p.default}
                          onChange={(e) => setParams({ ...params, [p.name]: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                        >
                          {p.options?.map((o: string) => (
                            <option key={o} value={o}>{o}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="number"
                          value={params[p.name] ?? p.default}
                          onChange={(e) => setParams({ ...params, [p.name]: Number(e.target.value) })}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Results */}
              {results && (
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900 dark:text-white">Results</h3>
                    <button
                      onClick={() => {
                        const blob = new Blob([JSON.stringify(results, null, 2)], { type: "application/json" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `experiment-${selectedTemplate}-${Date.now()}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-sm flex items-center gap-1 hover:bg-gray-200"
                    >
                      <Download className="w-3 h-3" /> Export JSON
                    </button>
                  </div>

                  {/* Render results based on template */}
                  {selectedTemplate === "eoq-vs-ss" && results.results && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <ResultCard title="EOQ Policy" data={results.results.eoq} />
                        <ResultCard title="(s,S) Policy" data={results.results.ss} />
                      </div>
                      <div className="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg text-center">
                        <span className="text-sm text-primary-700 dark:text-primary-400">
                          Winner: <strong>{results.results.winner}</strong>
                        </span>
                      </div>
                    </div>
                  )}

                  {selectedTemplate === "lot-sizing-comparison" && results.results && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {["lot-for-lot", "eoq", "fixed-period", "silver-meal"].map((rule) => (
                          <div key={rule} className={`p-3 rounded-lg border ${
                            results.results.bestRule === rule
                              ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                              : "border-gray-200 dark:border-gray-700"
                          }`}>
                            <h4 className="text-xs font-medium text-gray-500 uppercase">{rule}</h4>
                            <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">
                              ${results.results[rule]?.totalCost?.toLocaleString()}
                            </p>
                            <p className="text-xs text-gray-500">{results.results[rule]?.numOrders} orders</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedTemplate === "scheduling-rules" && results.results && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-700/50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Rule</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Makespan</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Avg Flow</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Avg Tardiness</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Late Jobs</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Util %</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                          {["FIFO", "SPT", "EDD", "CR"].map((rule) => {
                            const r = results.results[rule];
                            if (!r) return null;
                            return (
                              <tr key={rule} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                <td className="px-3 py-2 font-medium">{rule}</td>
                                <td className="px-3 py-2 text-right">{r.makespan}</td>
                                <td className="px-3 py-2 text-right">{r.avgFlowTime}</td>
                                <td className="px-3 py-2 text-right">{r.avgTardiness}</td>
                                <td className="px-3 py-2 text-right">{r.numLateJobs}</td>
                                <td className="px-3 py-2 text-right">{r.utilization}%</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Safety stock & Bullwhip: generic JSON display */}
                  {(selectedTemplate === "safety-stock-service" || selectedTemplate === "bullwhip-effect") && results.results && (
                    <div className="space-y-3">
                      {Object.entries(results.results).map(([key, value]) => {
                        if (typeof value !== "object" || value === null) {
                          return (
                            <div key={key} className="flex justify-between items-center text-sm">
                              <span className="text-gray-500">{key}</span>
                              <span className="font-medium text-gray-900 dark:text-white">{String(value)}</span>
                            </div>
                          );
                        }
                        return (
                          <div key={key} className="border border-gray-200 dark:border-gray-700 rounded-lg">
                            <button
                              onClick={() => setExpandedResult(expandedResult === key ? null : key)}
                              className="w-full flex items-center justify-between px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/30"
                            >
                              {key}
                              {expandedResult === key ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                            {expandedResult === key && (
                              <pre className="px-4 py-2 text-xs text-gray-600 dark:text-gray-400 overflow-x-auto border-t border-gray-200 dark:border-gray-700 max-h-48">
                                {JSON.stringify(value, null, 2)}
                              </pre>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-12 shadow-sm text-center text-gray-400">
              <FlaskConical className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>Select an experiment template to begin</p>
            </div>
          )}

          {/* History */}
          {showHistory && history && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Experiment History</h3>
              <div className="space-y-2">
                {history.map((h: any) => (
                  <div
                    key={h.id}
                    onClick={() => setResults({ results: h.results })}
                    className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{h.name}</p>
                      <p className="text-xs text-gray-500">{h.type}</p>
                    </div>
                    <span className="text-xs text-gray-400">{new Date(h.createdAt).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultCard({ title, data }: { title: string; data: Record<string, any> }) {
  if (!data) return null;
  const display = Object.entries(data).filter(([k]) => k !== "timeline");
  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{title}</h4>
      <dl className="space-y-1">
        {display.map(([k, v]) => (
          <div key={k} className="flex justify-between text-xs">
            <dt className="text-gray-500">{k.replace(/([A-Z])/g, " $1").trim()}</dt>
            <dd className="font-medium text-gray-900 dark:text-white">{typeof v === "number" ? v.toLocaleString() : String(v)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
