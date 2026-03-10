import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from "recharts";
import {
  Play, Loader2, Layers, TrendingUp, AlertTriangle, DollarSign,
  Package, Target, Settings,
} from "lucide-react";
import { api } from "../../api/client";
import PageHeader from "../../components/PageHeader";
import KPICard from "../../components/KPICard";

interface Template {
  id: string;
  name: string;
  description: string;
  nodes: Array<{ id: string; name: string; tier: number; type: string; inventory: number; capacity: number; holdingCost: number; orderingCost: number; leadTimeDays: number; safetyStock: number; demandMean: number; demandStdDev: number }>;
  links: Array<{ from: string; to: string; transportCost: number; leadTimeDays: number; capacity: number }>;
}

interface BullwhipEntry { node: string; tier: number; type: string; ordersMean: number; ordersVariance: number; ordersCV: number; orderCount: number }
interface VarianceRatio { fromTier: number; toTier: number; varianceRatio: number }

interface SimResult {
  summary: { totalCost: number; serviceLevel: number; totalStockouts: number; periods: number; policy: string };
  bullwhipAnalysis: BullwhipEntry[];
  varianceRatios: VarianceRatio[];
  timeline: Array<{ period: number; inventory: Record<string, number>; orders: Record<string, number>; stockouts: string[]; costs: Record<string, number> }>;
}

interface OptResult {
  targetServiceLevel: number;
  zValue: number;
  results: Array<{ node: string; tier: number; type: string; currentSafetyStock: number; optimizedSafetyStock: number; reorderPoint: number; change: number; annualHoldingCost: number }>;
  summary: { totalCurrentSafetyStock: number; totalOptimizedSafetyStock: number; estimatedCurrentCost: number; estimatedOptimizedCost: number; costDifference: number };
}

const TIER_COLORS = ["#6b7280", "#ec4899", "#8b5cf6", "#10b981", "#f59e0b", "#3b82f6"];

export default function MultiEchelonPage() {
  const [selectedTemplate, setSelectedTemplate] = useState<string>("standard-5tier");
  const [periods, setPeriods] = useState(52);
  const [policy, setPolicy] = useState<"order-up-to" | "reorder-point" | "echelon-stock">("order-up-to");
  const [targetSL, setTargetSL] = useState(95);
  const [simResult, setSimResult] = useState<SimResult | null>(null);
  const [optResult, setOptResult] = useState<OptResult | null>(null);
  const [tab, setTab] = useState<"simulate" | "optimize">("simulate");

  const { data: templates, isLoading } = useQuery<Template[]>({
    queryKey: ["multi-echelon-templates"],
    queryFn: () => api.get("/multi-echelon/templates"),
  });

  const template = templates?.find((t) => t.id === selectedTemplate) ?? null;

  const simMut = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post("/multi-echelon/simulate", body),
    onSuccess: (data) => setSimResult(data as SimResult),
  });

  const optMut = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post("/multi-echelon/optimize-safety-stock", body),
    onSuccess: (data) => setOptResult(data as OptResult),
  });

  const handleRun = () => {
    if (!template) return;
    if (tab === "simulate") {
      simMut.mutate({ nodes: template.nodes, links: template.links, periods, policy });
    } else {
      optMut.mutate({ nodes: template.nodes, links: template.links, targetServiceLevel: targetSL });
    }
  };

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /></div>;

  return (
    <div className="space-y-6">
      <PageHeader title="Multi-Echelon Supply Chain" subtitle="Multi-tier inventory planning — bullwhip effect, safety stock optimization, echelon policies" />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard title="Templates" value={templates?.length ?? 0} icon={Layers} />
        <KPICard title="Tiers" value={template ? new Set(template.nodes.map((n) => n.tier)).size : 0} icon={TrendingUp} />
        <KPICard title="Service Level" value={simResult ? `${simResult.summary.serviceLevel}%` : "—"} icon={Target} />
        <KPICard title="Total Cost" value={simResult ? `$${simResult.summary.totalCost.toLocaleString()}` : "—"} icon={DollarSign} />
      </div>

      {/* Controls */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <div className="flex gap-2 mb-4">
          <button onClick={() => setTab("simulate")} className={`px-4 py-1.5 rounded-lg text-sm ${tab === "simulate" ? "bg-primary-600 text-white" : "bg-gray-800 text-gray-400"}`}>Simulation</button>
          <button onClick={() => setTab("optimize")} className={`px-4 py-1.5 rounded-lg text-sm ${tab === "optimize" ? "bg-primary-600 text-white" : "bg-gray-800 text-gray-400"}`}>Safety Stock Optimization</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Network Template</label>
            <select value={selectedTemplate} onChange={(e) => setSelectedTemplate(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm">
              {(templates ?? []).map((t) => <option key={t.id} value={t.id}>{t.name} — {t.description}</option>)}
            </select>
          </div>

          {tab === "simulate" && (
            <>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Policy</label>
                <select value={policy} onChange={(e) => setPolicy(e.target.value as typeof policy)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm">
                  <option value="order-up-to">Order-Up-To</option>
                  <option value="reorder-point">Reorder Point</option>
                  <option value="echelon-stock">Echelon Stock</option>
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Periods</label>
                <input type="number" value={periods} onChange={(e) => setPeriods(Number(e.target.value))} min={10} max={200} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
            </>
          )}

          {tab === "optimize" && (
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Target Service Level (%)</label>
              <input type="number" value={targetSL} onChange={(e) => setTargetSL(Number(e.target.value))} min={80} max={99.9} step={0.5} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" />
            </div>
          )}
        </div>

        <button onClick={handleRun} disabled={simMut.isPending || optMut.isPending || !template}
          className="mt-4 flex items-center gap-2 px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm disabled:opacity-50">
          {(simMut.isPending || optMut.isPending) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {tab === "simulate" ? "Run Simulation" : "Optimize"}
        </button>
      </div>

      {/* Network Visualization */}
      {template && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Network Structure</h3>
          <div className="flex flex-wrap gap-3 mb-4">
            {[...new Set(template.nodes.map((n) => n.tier))].sort((a, b) => b - a).map((tier) => (
              <div key={tier} className="bg-gray-800 rounded-lg p-3 min-w-[120px]">
                <p className="text-gray-400 text-xs mb-2">Tier {tier}</p>
                {template.nodes.filter((n) => n.tier === tier).map((n) => (
                  <div key={n.id} className="flex items-center gap-2 py-1">
                    <div className="w-2 h-2 rounded-full" style={{ background: TIER_COLORS[tier] ?? "#999" }} />
                    <span className="text-white text-xs">{n.name}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <p className="text-gray-500 text-xs">{template.nodes.length} nodes, {template.links.length} links</p>
        </div>
      )}

      {/* Simulation Results */}
      {simResult && tab === "simulate" && (
        <>
          {/* Bullwhip Analysis */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" /> Bullwhip Effect Analysis
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 text-left border-b border-gray-800">
                    <th className="pb-3 pr-4">Node</th>
                    <th className="pb-3 pr-4">Tier</th>
                    <th className="pb-3 pr-4 text-right">Avg Order</th>
                    <th className="pb-3 pr-4 text-right">Variance</th>
                    <th className="pb-3 text-right">CV</th>
                  </tr>
                </thead>
                <tbody>
                  {simResult.bullwhipAnalysis.map((b) => (
                    <tr key={b.node} className="border-b border-gray-800/50">
                      <td className="py-3 pr-4 text-white">{b.node}</td>
                      <td className="py-3 pr-4"><span className="px-2 py-0.5 rounded-full text-xs" style={{ background: `${TIER_COLORS[b.tier]}30`, color: TIER_COLORS[b.tier] }}>Tier {b.tier}</span></td>
                      <td className="py-3 pr-4 text-right text-gray-300">{b.ordersMean}</td>
                      <td className="py-3 pr-4 text-right text-gray-300">{b.ordersVariance.toLocaleString()}</td>
                      <td className="py-3 text-right"><span className={`font-medium ${b.ordersCV > 1 ? "text-red-400" : b.ordersCV > 0.5 ? "text-yellow-400" : "text-green-400"}`}>{b.ordersCV.toFixed(2)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {simResult.varianceRatios.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-4">
                {simResult.varianceRatios.map((vr) => (
                  <div key={`${vr.fromTier}-${vr.toTier}`} className={`bg-gray-800 rounded-lg p-3 ${vr.varianceRatio > 1 ? "border border-red-800" : ""}`}>
                    <p className="text-gray-400 text-xs">Tier {vr.fromTier} → {vr.toTier}</p>
                    <p className={`text-xl font-bold ${vr.varianceRatio > 1 ? "text-red-400" : "text-green-400"}`}>{vr.varianceRatio}x</p>
                    <p className="text-gray-500 text-xs">{vr.varianceRatio > 1 ? "Amplified ⚠️" : "Dampened ✓"}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Inventory Timeline */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Inventory Levels Over Time</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={simResult.timeline.slice(0, 100)}>
                  <XAxis dataKey="period" stroke="#6b7280" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8, color: "#fff" }} />
                  {template?.nodes.filter((n) => n.type !== "customer").slice(0, 5).map((n, i) => (
                    <Line key={n.id} type="monotone" dataKey={`inventory.${n.id}`} stroke={TIER_COLORS[i] ?? "#999"} strokeWidth={1.5} name={n.name} dot={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {/* Optimization Results */}
      {optResult && tab === "optimize" && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-green-500" /> Safety Stock Optimization
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-gray-800 rounded-lg p-3 text-center">
              <p className="text-gray-400 text-xs">Current Total SS</p><p className="text-white font-bold">{optResult.summary.totalCurrentSafetyStock.toLocaleString()}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-3 text-center">
              <p className="text-gray-400 text-xs">Optimized Total SS</p><p className="text-white font-bold">{optResult.summary.totalOptimizedSafetyStock.toLocaleString()}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-3 text-center">
              <p className="text-gray-400 text-xs">Current Annual Cost</p><p className="text-white font-bold">${optResult.summary.estimatedCurrentCost.toLocaleString()}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-3 text-center">
              <p className="text-gray-400 text-xs">Cost Difference</p>
              <p className={`font-bold ${optResult.summary.costDifference < 0 ? "text-green-400" : "text-red-400"}`}>
                {optResult.summary.costDifference < 0 ? "-" : "+"}${Math.abs(optResult.summary.costDifference).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-left border-b border-gray-800">
                  <th className="pb-3 pr-4">Node</th>
                  <th className="pb-3 pr-4">Tier</th>
                  <th className="pb-3 pr-4 text-right">Current SS</th>
                  <th className="pb-3 pr-4 text-right">Optimized SS</th>
                  <th className="pb-3 pr-4 text-right">Change</th>
                  <th className="pb-3 pr-4 text-right">Reorder Pt</th>
                  <th className="pb-3 text-right">Annual Cost</th>
                </tr>
              </thead>
              <tbody>
                {optResult.results.map((r) => (
                  <tr key={r.node} className="border-b border-gray-800/50">
                    <td className="py-3 pr-4 text-white">{r.node}</td>
                    <td className="py-3 pr-4"><span className="px-2 py-0.5 rounded-full text-xs" style={{ background: `${TIER_COLORS[r.tier]}30`, color: TIER_COLORS[r.tier] }}>Tier {r.tier}</span></td>
                    <td className="py-3 pr-4 text-right text-gray-300">{r.currentSafetyStock}</td>
                    <td className="py-3 pr-4 text-right text-white font-medium">{r.optimizedSafetyStock}</td>
                    <td className="py-3 pr-4 text-right"><span className={r.change > 0 ? "text-red-400" : "text-green-400"}>{r.change > 0 ? "+" : ""}{r.change}</span></td>
                    <td className="py-3 pr-4 text-right text-gray-300">{r.reorderPoint}</td>
                    <td className="py-3 text-right text-gray-300">${r.annualHoldingCost.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={optResult.results}>
                <XAxis dataKey="node" stroke="#6b7280" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" height={60} />
                <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8, color: "#fff" }} />
                <Bar dataKey="currentSafetyStock" fill="#6b7280" name="Current SS" />
                <Bar dataKey="optimizedSafetyStock" fill="#3b82f6" name="Optimized SS" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
