import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trophy, Medal, Award, Loader2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { api } from "../api/client";
import { useAuthStore } from "../stores/auth";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import { FormInput } from "../components/FormField";
import KPICard from "../components/KPICard";

const METRIC_LABELS: Record<string, string> = {
  profit: "Profit",
  inventory_turnover: "Inventory Turnover",
  service_level: "Service Level %",
  production_efficiency: "Production Efficiency %",
  cash_flow: "Cash Flow",
  on_time_delivery: "On-Time Delivery %",
};

interface BenchmarkRun {
  id: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  status: string;
  metrics: string;
  standings?: LeaderboardEntry[];
}

interface LeaderboardEntry {
  userId: string;
  userName: string;
  scores: Record<string, number>;
  total: number;
  rank: number;
}

interface MyScore {
  benchmarkId: string;
  benchmarkName: string;
  scores: Record<string, number>;
  rank: number;
}

export default function BenchmarkMode() {
  const { user, hasRole } = useAuthStore();
  const queryClient = useQueryClient();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    startDate: "",
    endDate: "",
    metrics: ["profit", "inventory_turnover", "service_level", "production_efficiency", "cash_flow", "on_time_delivery"],
    weights: {} as Record<string, number>,
  });

  const { data: runs = [], isLoading: runsLoading } = useQuery({
    queryKey: ["benchmark-runs"],
    queryFn: () => api.get<BenchmarkRun[]>("/benchmark"),
  });

  const activeCompetition = runs.find(
    (r) =>
      r.status === "active" &&
      new Date(r.startDate) <= new Date() &&
      new Date(r.endDate) >= new Date()
  );

  const { data: activeDetail } = useQuery({
    queryKey: ["benchmark", activeCompetition?.id],
    queryFn: () => api.get<BenchmarkRun & { standings: LeaderboardEntry[] }>(`/benchmark/${activeCompetition!.id}`),
    enabled: !!activeCompetition?.id,
  });

  const { data: myScores = [] } = useQuery({
    queryKey: ["benchmark-my-score"],
    queryFn: () => api.get<MyScore[]>("/benchmark/my-score"),
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; startDate: string; endDate: string; metrics: string }) =>
      api.post("/benchmark", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["benchmark-runs"] });
      setCreateModalOpen(false);
      setCreateForm({ name: "", startDate: "", endDate: "", metrics: createForm.metrics, weights: {} });
    },
  });

  const calculateMutation = useMutation({
    mutationFn: (id: string) => api.post(`/benchmark/${id}/calculate`),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["benchmark", id] });
      queryClient.invalidateQueries({ queryKey: ["benchmark-runs"] });
      queryClient.invalidateQueries({ queryKey: ["benchmark-my-score"] });
    },
  });

  const handleCreate = () => {
    createMutation.mutate({
      name: createForm.name,
      startDate: createForm.startDate,
      endDate: createForm.endDate,
      metrics: JSON.stringify(createForm.metrics.map((m) => ({ name: m, weight: createForm.weights[m] ?? 5 }))),
    });
  };

  const standings = activeDetail?.standings ?? [];
  const currentUserRank = standings.find((s) => s.userId === user?.id);
  const totalStudents = standings.length;

  const formatTimeRemaining = () => {
    if (!activeCompetition?.endDate) return "";
    const end = new Date(activeCompetition.endDate);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    if (diff <= 0) return "Ended";
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    return `${days}d ${hours}h remaining`;
  };

  const trendForMetric = (metric: string): "up" | "down" | "neutral" => {
    const score = currentUserRank?.scores?.[metric];
    if (!score) return "neutral";
    return score > 50 ? "up" : score < 50 ? "down" : "neutral";
  };

  const isAdmin = hasRole("admin") || hasRole("instructor");

  return (
    <div>
      <PageHeader
        title="ERP Benchmark Mode"
        subtitle="Compete with fellow students on ERP performance metrics"
      />

      {/* Active Competition Banner */}
      {activeCompetition && (
        <div className="card p-6 mb-6 bg-gradient-to-r from-primary-50 to-blue-50 border-primary-200">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary-100">
                <Trophy className="w-8 h-8 text-primary-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{activeCompetition.name}</h2>
                <p className="text-sm text-gray-600 mt-1">{formatTimeRemaining()}</p>
                {currentUserRank && (
                  <p className="text-sm font-medium text-primary-600 mt-1">
                    Your rank: #{currentUserRank.rank} of {totalStudents}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" />
          Leaderboard
        </h3>
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Rank</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Student Name</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Profit</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Inv. Turnover</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Service Level %</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Prod. Efficiency %</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Cash Flow</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Overall Score</th>
              </tr>
            </thead>
            <tbody>
              {runsLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                  </td>
                </tr>
              ) : standings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                    No leaderboard data yet. {isAdmin && "Create a competition and calculate rankings."}
                  </td>
                </tr>
              ) : (
                standings.map((entry, idx) => {
                  const isCurrentUser = entry.userId === user?.id;
                  const rankBadge =
                    entry.rank === 1 ? (
                      <span className="inline-flex items-center gap-1 text-amber-600">
                        <Medal className="w-4 h-4" /> #{entry.rank}
                      </span>
                    ) : entry.rank === 2 ? (
                      <span className="inline-flex items-center gap-1 text-gray-500">
                        <Medal className="w-4 h-4" /> #{entry.rank}
                      </span>
                    ) : entry.rank === 3 ? (
                      <span className="inline-flex items-center gap-1 text-amber-700">
                        <Award className="w-4 h-4" /> #{entry.rank}
                      </span>
                    ) : (
                      <span>#{entry.rank}</span>
                    );
                  return (
                    <tr
                      key={entry.userId}
                      className={`border-b last:border-0 ${
                        isCurrentUser ? "bg-blue-50" : "hover:bg-gray-50"
                      }`}
                    >
                      <td className="px-4 py-3 font-medium">{rankBadge}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {entry.userName}
                        {isCurrentUser && (
                          <span className="ml-2 text-xs text-blue-600">(You)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">{entry.scores?.profit?.toLocaleString() ?? "-"}</td>
                      <td className="px-4 py-3 text-right">{entry.scores?.inventory_turnover?.toFixed(2) ?? "-"}</td>
                      <td className="px-4 py-3 text-right">{entry.scores?.service_level?.toFixed(1) ?? "-"}%</td>
                      <td className="px-4 py-3 text-right">{entry.scores?.production_efficiency?.toFixed(1) ?? "-"}%</td>
                      <td className="px-4 py-3 text-right">{entry.scores?.cash_flow?.toLocaleString() ?? "-"}</td>
                      <td className="px-4 py-3 text-right font-semibold">{entry.total?.toFixed(2) ?? "-"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Metric cards for current user */}
      {currentUserRank && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Performance</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {Object.entries(currentUserRank.scores || {}).map(([metric, value]) => (
              <KPICard
                key={metric}
                title={METRIC_LABELS[metric] ?? metric}
                value={typeof value === "number" ? (metric.includes("%") ? `${value.toFixed(1)}%` : value.toLocaleString()) : "-"}
                subtitle={`Rank #${currentUserRank.rank} of ${totalStudents}`}
                trend={trendForMetric(metric)}
                trendValue={trendForMetric(metric) === "up" ? "Above avg" : trendForMetric(metric) === "down" ? "Below avg" : undefined}
              />
            ))}
          </div>
        </div>
      )}

      {/* Admin/Instructor section */}
      {isAdmin && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Admin / Instructor</h3>
          <div className="flex flex-wrap gap-4 mb-6">
            <button onClick={() => setCreateModalOpen(true)} className="btn-primary">
              Create Competition
            </button>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Active Competitions</h4>
            <div className="space-y-2">
              {runs.filter((r) => r.status === "active").map((run) => (
                <div
                  key={run.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <span className="font-medium">{run.name}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => calculateMutation.mutate(run.id)}
                      disabled={calculateMutation.isPending}
                      className="btn-secondary btn-sm"
                    >
                      {calculateMutation.isPending ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        "Calculate Rankings"
                      )}
                    </button>
                  </div>
                </div>
              ))}
              {runs.filter((r) => r.status === "active").length === 0 && (
                <p className="text-sm text-gray-500">No active competitions.</p>
              )}
            </div>
          </div>
        </div>
      )}

      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create Competition"
        size="lg"
        footer={
          <>
            <button onClick={() => setCreateModalOpen(false)} className="btn-secondary">
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={
                !createForm.name || !createForm.startDate || !createForm.endDate || createMutation.isPending
              }
              className="btn-primary"
            >
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <FormInput
            label="Competition Name"
            value={createForm.name}
            onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
            placeholder="e.g. Q1 2025 ERP Challenge"
          />
          <FormInput
            label="Start Date"
            type="datetime-local"
            value={createForm.startDate}
            onChange={(e) => setCreateForm({ ...createForm, startDate: e.target.value })}
          />
          <FormInput
            label="End Date"
            type="datetime-local"
            value={createForm.endDate}
            onChange={(e) => setCreateForm({ ...createForm, endDate: e.target.value })}
          />
          <div>
            <label className="label">Metric Weights</label>
            <p className="text-xs text-gray-500 mb-2">Adjust weight for each metric (1–10)</p>
            <div className="space-y-2">
              {createForm.metrics.map((m) => (
                <div key={m} className="flex items-center gap-4">
                  <span className="text-sm w-48">{METRIC_LABELS[m] ?? m}</span>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={createForm.weights[m] ?? 1}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        weights: { ...createForm.weights, [m]: Number(e.target.value) },
                      })
                    }
                    className="flex-1"
                  />
                  <span className="text-sm w-8">{createForm.weights[m] ?? 1}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
