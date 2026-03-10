import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Search, Loader2, AlertTriangle, AlertCircle, Info, CheckCircle,
  Play, ShieldCheck, Package, Factory as FactoryIcon, ShoppingCart,
  ClipboardCheck, GitBranch,
} from "lucide-react";
import { api } from "../../api/client";
import PageHeader from "../../components/PageHeader";
import KPICard from "../../components/KPICard";

interface Recommendation {
  id: string;
  severity: "critical" | "warning" | "info";
  category: string;
  title: string;
  description: string;
  action: string;
  impact: string;
  data: Record<string, unknown>;
}

interface ScanResult {
  scannedAt: string;
  recommendations: Recommendation[];
  summary: Record<string, { total: number; critical: number; warning: number; info: number }>;
}

interface ApplyResult {
  recommendation: Recommendation;
  simulatedResult: { success: boolean; description: string; steps: Array<{ step: number; action: string; tcode: string; details: string }> };
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  inventory: Package,
  production: FactoryIcon,
  purchasing: ShoppingCart,
  sales: ShoppingCart,
  workflow: GitBranch,
  quality: ClipboardCheck,
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-900/30 border-red-800 text-red-400",
  warning: "bg-yellow-900/30 border-yellow-800 text-yellow-400",
  info: "bg-blue-900/30 border-blue-800 text-blue-400",
};

const SEVERITY_ICONS: Record<string, React.ElementType> = {
  critical: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

export default function RecommendationsDashboard() {
  const [filter, setFilter] = useState<string>("all");
  const [applyResult, setApplyResult] = useState<ApplyResult | null>(null);

  const { data: scanResult, isLoading, refetch } = useQuery<ScanResult>({
    queryKey: ["recommendations-scan"],
    queryFn: () => api.get("/recommendations/scan"),
  });

  const applyMut = useMutation({
    mutationFn: (body: { recommendationId: string }) => api.post("/recommendations/apply", body),
    onSuccess: (data) => setApplyResult(data as ApplyResult),
  });

  const recs = scanResult?.recommendations ?? [];
  const filtered = filter === "all" ? recs : recs.filter((r) => r.category === filter);
  const summary = scanResult?.summary ?? {};
  const categories = Object.keys(summary);

  const criticalCount = recs.filter((r) => r.severity === "critical").length;
  const warningCount = recs.filter((r) => r.severity === "warning").length;

  const chartData = categories.map((c) => ({
    name: c.charAt(0).toUpperCase() + c.slice(1),
    critical: summary[c]?.critical ?? 0,
    warning: summary[c]?.warning ?? 0,
    info: summary[c]?.info ?? 0,
  }));

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /></div>;

  return (
    <div className="space-y-6">
      <PageHeader title="AI Decision Recommendations" subtitle="Intelligent ERP scan with actionable suggestions and SAP T-code walkthroughs" />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard title="Total Issues" value={recs.length} icon={Search} />
        <KPICard title="Critical" value={criticalCount} icon={AlertCircle} />
        <KPICard title="Warnings" value={warningCount} icon={AlertTriangle} />
        <KPICard title="Categories" value={categories.length} icon={ShieldCheck} />
      </div>

      {/* Chart */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Issues by Category</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="name" stroke="#6b7280" tick={{ fontSize: 11 }} />
              <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8, color: "#fff" }} />
              <Bar dataKey="critical" stackId="a" fill="#ef4444" name="Critical" radius={[0, 0, 0, 0]} />
              <Bar dataKey="warning" stackId="a" fill="#eab308" name="Warning" />
              <Bar dataKey="info" stackId="a" fill="#3b82f6" name="Info" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category Filters */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setFilter("all")} className={`px-4 py-1.5 rounded-lg text-sm ${filter === "all" ? "bg-primary-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>All ({recs.length})</button>
        {categories.map((c) => {
          const Icon = CATEGORY_ICONS[c] ?? Info;
          return (
            <button key={c} onClick={() => setFilter(c)} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm capitalize ${filter === c ? "bg-primary-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
              <Icon className="w-3 h-3" /> {c} ({summary[c]?.total ?? 0})
            </button>
          );
        })}
      </div>

      {/* Recommendations List */}
      <div className="space-y-3">
        {filtered.map((rec) => {
          const SevIcon = SEVERITY_ICONS[rec.severity] ?? Info;
          return (
            <div key={rec.id} className={`rounded-xl border p-5 ${SEVERITY_COLORS[rec.severity]}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <SevIcon className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-white font-medium">{rec.title}</p>
                    <p className="text-gray-400 text-sm mt-1">{rec.description}</p>
                    <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-500">
                      <span>Action: <span className="text-gray-300">{rec.action}</span></span>
                      <span>Impact: <span className="text-gray-300">{rec.impact}</span></span>
                    </div>
                  </div>
                </div>
                <button onClick={() => applyMut.mutate({ recommendationId: rec.id })}
                  disabled={applyMut.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs text-white flex-shrink-0">
                  {applyMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />} Simulate Fix
                </button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-12">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="text-white font-medium">All clear!</p>
            <p className="text-gray-400 text-sm">No issues found in this category.</p>
          </div>
        )}
      </div>

      {/* Apply Result Modal */}
      {applyResult && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setApplyResult(null)}>
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-2">Simulated Fix</h3>
            <p className="text-gray-400 text-sm mb-4">{applyResult.simulatedResult.description}</p>
            <div className="space-y-3">
              {applyResult.simulatedResult.steps.map((step) => (
                <div key={step.step} className="flex items-start gap-3 bg-gray-800 rounded-lg p-3">
                  <span className="w-6 h-6 rounded-full bg-primary-600 flex items-center justify-center text-xs text-white font-bold flex-shrink-0">{step.step}</span>
                  <div>
                    <p className="text-white text-sm font-medium">{step.action}</p>
                    <p className="text-primary-400 text-xs font-mono mt-0.5">T-code: {step.tcode}</p>
                    <p className="text-gray-400 text-xs mt-1">{step.details}</p>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setApplyResult(null)} className="mt-4 w-full py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-white">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
