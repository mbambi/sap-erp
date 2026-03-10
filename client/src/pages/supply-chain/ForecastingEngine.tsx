import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area,
} from "recharts";
import {
  Play, Loader2, TrendingUp, BarChart3, Layers, Target,
  RefreshCw, Database,
} from "lucide-react";
import { api } from "../../api/client";
import PageHeader from "../../components/PageHeader";
import KPICard from "../../components/KPICard";

interface Model {
  id: string;
  name: string;
  description: string;
  params: Array<{ name: string; type: string; default: number; description: string }>;
}

interface ForecastResult {
  model: string;
  forecast: number[];
  fitted: number[];
  confidenceInterval: Array<{ lower: number; upper: number }>;
  accuracy: { mae: number; mape: number; rmse: number; mse: number };
  params: Record<string, number>;
}

interface CompareResult {
  results: ForecastResult[];
  bestModel: string;
}

export default function ForecastingEngine() {
  const [selectedModel, setSelectedModel] = useState("exponential_smoothing");
  const [horizon, setHorizon] = useState(12);
  const [dataSource, setDataSource] = useState<"generate" | "custom">("generate");
  const [pattern, setPattern] = useState("seasonal");
  const [customData, setCustomData] = useState("");
  const [result, setResult] = useState<ForecastResult | null>(null);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [tab, setTab] = useState<"single" | "compare">("single");

  const { data: models } = useQuery<Model[]>({
    queryKey: ["forecasting-models"],
    queryFn: () => api.get("/forecasting/models"),
  });

  const genMut = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post("/forecasting/generate-data", body),
  });

  const runMut = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post("/forecasting/run", body),
    onSuccess: (data) => setResult(data as ForecastResult),
  });

  const compareMut = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post("/forecasting/compare", body),
    onSuccess: (data) => setCompareResult(data as CompareResult),
  });

  const handleRun = async () => {
    let data: number[];
    if (dataSource === "generate") {
      const gen = await genMut.mutateAsync({ pattern, periods: 48 });
      data = (gen as { data: number[] }).data;
    } else {
      data = customData.split(",").map((s) => parseFloat(s.trim())).filter((n) => !isNaN(n));
    }
    if (data.length < 6) return;

    if (tab === "compare") {
      compareMut.mutate({ data, horizon });
    } else {
      runMut.mutate({ model: selectedModel, data, horizon });
    }
  };

  const chartData = result ? [
    ...result.fitted.map((v, i) => ({ period: i + 1, actual: null as number | null, fitted: Math.round(v), forecast: null as number | null, lower: null as number | null, upper: null as number | null })),
    ...result.forecast.map((v, i) => ({
      period: result.fitted.length + i + 1,
      actual: null as number | null,
      fitted: null as number | null,
      forecast: Math.round(v),
      lower: result.confidenceInterval[i]?.lower ? Math.round(result.confidenceInterval[i].lower) : null,
      upper: result.confidenceInterval[i]?.upper ? Math.round(result.confidenceInterval[i].upper) : null,
    })),
  ] : [];

  return (
    <div className="space-y-6">
      <PageHeader title="Forecasting Engine" subtitle="Compare ARIMA, Holt-Winters, exponential smoothing and more" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard title="Models" value={models?.length ?? 6} icon={Layers} />
        <KPICard title="Best MAPE" value={compareResult ? `${compareResult.results[0]?.accuracy.mape.toFixed(1)}%` : result ? `${result.accuracy.mape.toFixed(1)}%` : "—"} icon={Target} />
        <KPICard title="Horizon" value={horizon} icon={TrendingUp} />
        <KPICard title="Best Model" value={compareResult?.bestModel?.replace(/_/g, " ") ?? result?.model?.replace(/_/g, " ") ?? "—"} icon={BarChart3} />
      </div>

      {/* Controls */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <div className="flex gap-2 mb-4">
          <button onClick={() => setTab("single")} className={`px-4 py-1.5 rounded-lg text-sm ${tab === "single" ? "bg-primary-600 text-white" : "bg-gray-800 text-gray-400"}`}>Single Model</button>
          <button onClick={() => setTab("compare")} className={`px-4 py-1.5 rounded-lg text-sm ${tab === "compare" ? "bg-primary-600 text-white" : "bg-gray-800 text-gray-400"}`}>Compare All</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Data Source */}
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Data Source</label>
            <div className="flex gap-2">
              <button onClick={() => setDataSource("generate")} className={`flex-1 px-3 py-2 rounded-lg text-sm ${dataSource === "generate" ? "bg-green-600 text-white" : "bg-gray-800 text-gray-400"}`}>
                <Database className="w-3 h-3 inline mr-1" /> Generate
              </button>
              <button onClick={() => setDataSource("custom")} className={`flex-1 px-3 py-2 rounded-lg text-sm ${dataSource === "custom" ? "bg-green-600 text-white" : "bg-gray-800 text-gray-400"}`}>
                Custom
              </button>
            </div>
            {dataSource === "generate" && (
              <select value={pattern} onChange={(e) => setPattern(e.target.value)} className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm">
                <option value="seasonal">Seasonal</option>
                <option value="trending">Trending</option>
                <option value="seasonal_trending">Seasonal + Trend</option>
                <option value="step">Step Change</option>
              </select>
            )}
            {dataSource === "custom" && (
              <textarea value={customData} onChange={(e) => setCustomData(e.target.value)} placeholder="100,120,110,..." rows={3} className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" />
            )}
          </div>

          {/* Model Selection (single mode) */}
          {tab === "single" && (
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Model</label>
              <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm">
                {(models ?? []).map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              <p className="text-gray-500 text-xs mt-1">{models?.find((m) => m.id === selectedModel)?.description}</p>
            </div>
          )}

          {/* Horizon */}
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Forecast Horizon</label>
            <input type="number" value={horizon} onChange={(e) => setHorizon(Number(e.target.value))} min={1} max={52} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" />
          </div>
        </div>

        <button onClick={handleRun} disabled={runMut.isPending || compareMut.isPending || genMut.isPending}
          className="mt-4 flex items-center gap-2 px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm disabled:opacity-50">
          {(runMut.isPending || compareMut.isPending || genMut.isPending) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {tab === "compare" ? "Compare All Models" : "Run Forecast"}
        </button>
      </div>

      {/* Single Model Result */}
      {result && tab === "single" && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h3 className="text-lg font-semibold text-white mb-2">Forecast: {result.model.replace(/_/g, " ")}</h3>
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="bg-gray-800 rounded-lg p-3 text-center">
              <p className="text-gray-400 text-xs">MAE</p><p className="text-white font-bold">{result.accuracy.mae.toFixed(1)}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-3 text-center">
              <p className="text-gray-400 text-xs">MAPE</p><p className="text-white font-bold">{result.accuracy.mape.toFixed(1)}%</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-3 text-center">
              <p className="text-gray-400 text-xs">RMSE</p><p className="text-white font-bold">{result.accuracy.rmse.toFixed(1)}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-3 text-center">
              <p className="text-gray-400 text-xs">MSE</p><p className="text-white font-bold">{result.accuracy.mse.toFixed(0)}</p>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <XAxis dataKey="period" stroke="#6b7280" tick={{ fontSize: 11 }} />
                <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8, color: "#fff" }} />
                <Area type="monotone" dataKey="upper" stroke="none" fill="#3b82f620" name="Upper CI" />
                <Area type="monotone" dataKey="lower" stroke="none" fill="#3b82f620" name="Lower CI" />
                <Line type="monotone" dataKey="fitted" stroke="#6b7280" strokeWidth={1.5} name="Fitted" dot={false} />
                <Line type="monotone" dataKey="forecast" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 3" name="Forecast" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Compare Results */}
      {compareResult && tab === "compare" && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Model Comparison (ranked by MAPE)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-left border-b border-gray-800">
                  <th className="pb-3 pr-4">#</th>
                  <th className="pb-3 pr-4">Model</th>
                  <th className="pb-3 pr-4 text-right">MAE</th>
                  <th className="pb-3 pr-4 text-right">MAPE %</th>
                  <th className="pb-3 pr-4 text-right">RMSE</th>
                  <th className="pb-3 text-right">MSE</th>
                </tr>
              </thead>
              <tbody>
                {compareResult.results.map((r, i) => (
                  <tr key={r.model} className={`border-b border-gray-800/50 ${i === 0 ? "bg-green-900/20" : ""}`}>
                    <td className="py-3 pr-4 text-gray-400">{i + 1}</td>
                    <td className="py-3 pr-4">
                      <span className="text-white font-medium capitalize">{r.model.replace(/_/g, " ")}</span>
                      {i === 0 && <span className="ml-2 text-xs bg-green-600 text-white px-2 py-0.5 rounded-full">Best</span>}
                    </td>
                    <td className="py-3 pr-4 text-right text-gray-300">{r.accuracy.mae.toFixed(1)}</td>
                    <td className="py-3 pr-4 text-right text-gray-300">{r.accuracy.mape.toFixed(1)}</td>
                    <td className="py-3 pr-4 text-right text-gray-300">{r.accuracy.rmse.toFixed(1)}</td>
                    <td className="py-3 text-right text-gray-300">{r.accuracy.mse.toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
