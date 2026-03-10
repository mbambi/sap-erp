import { useState, useEffect } from "react";
import { api } from "../../api/client";
import {
  BookOpen, Award, Clock, Zap, Star, Target, BarChart3,
  CheckCircle2, TrendingUp, Activity,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  AreaChart, Area, LineChart, Line,
} from "recharts";

export default function LearningAnalytics() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const res = await api.get("/learning-analytics/my-progress");
      setData(res);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!data) {
    return <div className="text-center text-gray-500 py-10">Unable to load analytics</div>;
  }

  const radarData = data.proficiency?.map((p: any) => ({
    subject: p.module.charAt(0).toUpperCase() + p.module.slice(1),
    value: p.percentage,
    fullMark: 100,
  })) ?? [];

  const activityData = Object.entries(data.activityByDay || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, count]) => ({
      day: day.slice(5),
      actions: count as number,
    }));

  const level = data.xp?.level ?? 1;
  const xp = data.xp?.totalXP ?? 0;
  const nextLevelXP = level * 500;
  const xpProgress = Math.min(100, (xp / nextLevelXP) * 100);

  const kpis = [
    { label: "Exercises Done", value: data.stats.exercisesCompleted, icon: BookOpen, color: "text-blue-600 bg-blue-50" },
    { label: "Certifications", value: data.stats.certificationsPassed, icon: Award, color: "text-green-600 bg-green-50" },
    { label: "Time Spent", value: `${Math.round(data.stats.totalTimeMinutes / 60)}h`, icon: Clock, color: "text-purple-600 bg-purple-50" },
    { label: "Transactions", value: data.stats.transactionCount, icon: Activity, color: "text-orange-600 bg-orange-50" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Learning Progress</h1>
        <p className="text-gray-500 mt-1">Track your ERP proficiency and achievements</p>
      </div>

      <div className="bg-gradient-to-r from-primary-600 to-indigo-600 rounded-xl p-5 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-primary-100 text-sm">Current Level</p>
            <p className="text-4xl font-bold mt-1">Level {level}</p>
            <p className="text-primary-200 text-sm mt-1">{xp} / {nextLevelXP} XP to next level</p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-5 h-5 text-yellow-300" />
              <span className="text-lg font-bold">{data.xp?.streak ?? 0} day streak</span>
            </div>
          </div>
        </div>
        <div className="mt-4 bg-white/20 rounded-full h-3">
          <div className="bg-white rounded-full h-3 transition-all" style={{ width: `${xpProgress}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-xl border p-4">
            <div className={`w-10 h-10 rounded-lg ${kpi.color} flex items-center justify-center mb-3`}>
              <kpi.icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
            <p className="text-xs text-gray-500 mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Target className="w-4 h-4 text-primary-600" /> ERP Module Proficiency
          </h3>
          {radarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9 }} />
                <Radar name="Proficiency" dataKey="value" stroke="#2563eb" fill="#2563eb" fillOpacity={0.3} />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-400 text-sm">
              Complete exercises to see your proficiency radar
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary-600" /> Module Completion
          </h3>
          {data.proficiency?.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.proficiency.map((p: any) => ({
                module: p.module.charAt(0).toUpperCase() + p.module.slice(1),
                percentage: p.percentage,
                avgScore: p.avgScore,
              }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="module" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="percentage" fill="#2563eb" radius={[4, 4, 0, 0]} name="Completion %" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-400 text-sm">
              No exercise data yet
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary-600" /> Activity (Last 30 Days)
        </h3>
        {activityData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={activityData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area type="monotone" dataKey="actions" stroke="#2563eb" fill="#2563eb" fillOpacity={0.1} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[200px] text-gray-400 text-sm">
            Start using the ERP to see your activity timeline
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border">
          <div className="px-5 py-4 border-b">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary-600" /> Recent Exercises
            </h3>
          </div>
          <div className="divide-y max-h-80 overflow-y-auto">
            {data.recentExercises?.length > 0 ? (
              data.recentExercises.map((ex: any) => (
                <div key={ex.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{ex.exerciseTitle}</p>
                    <p className="text-xs text-gray-500">{ex.module}</p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      ex.status === "completed" ? "bg-green-50 text-green-700" :
                      ex.status === "in_progress" ? "bg-blue-50 text-blue-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {ex.status === "completed" && <CheckCircle2 className="w-3 h-3" />}
                      {ex.status.replace("_", " ")}
                    </span>
                    {ex.score != null && <p className="text-xs text-gray-500 mt-1">{ex.score}%</p>}
                  </div>
                </div>
              ))
            ) : (
              <div className="px-5 py-8 text-center text-sm text-gray-400">No exercises attempted yet</div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border">
          <div className="px-5 py-4 border-b">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Award className="w-4 h-4 text-primary-600" /> Certification Attempts
            </h3>
          </div>
          <div className="divide-y max-h-80 overflow-y-auto">
            {data.certifications?.length > 0 ? (
              data.certifications.map((cert: any) => (
                <div key={cert.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{cert.certTitle}</p>
                    <p className="text-xs text-gray-500">
                      {cert.startedAt ? new Date(cert.startedAt).toLocaleDateString() : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      cert.status === "passed" ? "bg-green-50 text-green-700" :
                      cert.status === "failed" ? "bg-red-50 text-red-700" :
                      "bg-blue-50 text-blue-700"
                    }`}>
                      {cert.status}
                    </span>
                    {cert.score != null && (
                      <p className="text-xs text-gray-500 mt-1">{cert.score}% (pass: {cert.passingScore}%)</p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="px-5 py-8 text-center text-sm text-gray-400">No certifications attempted yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
