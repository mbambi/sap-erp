import { useState, useEffect } from "react";
import { api } from "../../api/client";
import {
  Users, BookOpen, Activity, Trophy, TrendingUp, BarChart3,
  Clock, Target, ChevronRight,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";

const COLORS = ["#2563eb", "#16a34a", "#ea580c", "#9333ea", "#0891b2", "#dc2626", "#ca8a04", "#4f46e5"];

export default function InstructorAnalytics() {
  const [overview, setOverview] = useState<any>(null);
  const [mastery, setMastery] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [ov, ma, st] = await Promise.all([
        api.get("/instructor-analytics/class-overview"),
        api.get("/instructor-analytics/module-mastery"),
        api.get("/instructor-analytics/student-progress"),
      ]);
      setOverview(ov);
      setMastery(ma);
      setStudents(st);
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

  const masteryData = mastery
    ? Object.entries(mastery).map(([mod, data]: [string, any]) => ({
        module: mod.charAt(0).toUpperCase() + mod.slice(1),
        percentage: data.percentage,
        completed: data.completed,
        total: data.total,
      }))
    : [];

  const radarData = masteryData.map((m) => ({
    subject: m.module,
    value: m.percentage,
    fullMark: 100,
  }));

  const exerciseData = overview?.exerciseProgress
    ? Object.entries(overview.exerciseProgress).map(([status, count]) => ({
        name: status.replace("_", " ").replace(/\b\w/g, (l: string) => l.toUpperCase()),
        value: count as number,
      }))
    : [];

  const kpis = [
    { label: "Total Students", value: overview?.totalStudents ?? 0, icon: Users, color: "text-blue-600 bg-blue-50", change: "" },
    { label: "Active (7d)", value: overview?.activeStudents ?? 0, icon: Activity, color: "text-green-600 bg-green-50", change: "" },
    { label: "Exercises", value: overview?.totalExercises ?? 0, icon: BookOpen, color: "text-purple-600 bg-purple-50", change: "" },
    { label: "Courses", value: overview?.totalCourses ?? 0, icon: Target, color: "text-orange-600 bg-orange-50", change: "" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Instructor Analytics</h1>
        <p className="text-gray-500 mt-1">Monitor class performance and student progress</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-xl border p-4">
            <div className="flex items-center justify-between">
              <div className={`w-10 h-10 rounded-lg ${kpi.color} flex items-center justify-center`}>
                <kpi.icon className="w-5 h-5" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900 mt-3">{kpi.value}</p>
            <p className="text-xs text-gray-500 mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary-600" /> Module Mastery (% Complete)
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={masteryData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="module" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={60} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => `${v}%`} />
              <Bar dataKey="percentage" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Target className="w-4 h-4 text-primary-600" /> Skills Radar
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
              <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9 }} />
              <Radar name="Mastery" dataKey="value" stroke="#2563eb" fill="#2563eb" fillOpacity={0.3} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Exercise Completion</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={exerciseData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label>
                {exerciseData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2 mt-2 justify-center">
            {exerciseData.map((d, i) => (
              <span key={d.name} className="inline-flex items-center gap-1 text-[10px]">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                {d.name}: {d.value}
              </span>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-xl border p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-primary-600" /> Recent Activity
          </h3>
          <div className="space-y-2 max-h-[280px] overflow-y-auto">
            {overview?.recentActivity?.map((a: any) => (
              <div key={a.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                  <Activity className="w-3.5 h-3.5 text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900 truncate">{a.user} &middot; {a.action}</p>
                  <p className="text-[10px] text-gray-500">{a.module} / {a.resource}</p>
                </div>
                <span className="text-[10px] text-gray-400">{new Date(a.timestamp).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-primary-600" /> Student Progress
          </h3>
          <span className="text-xs text-gray-500">{students.length} students</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs">
                <th className="px-4 py-3 text-left font-medium">Student</th>
                <th className="px-4 py-3 text-left font-medium">Email</th>
                <th className="px-4 py-3 text-center font-medium">Level</th>
                <th className="px-4 py-3 text-center font-medium">XP</th>
                <th className="px-4 py-3 text-center font-medium">Exercises</th>
                <th className="px-4 py-3 text-center font-medium">Transactions</th>
                <th className="px-4 py-3 text-center font-medium">Last Active</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {students.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{s.firstName} {s.lastName}</td>
                  <td className="px-4 py-3 text-gray-500">{s.email}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-xs font-medium">
                      Lv.{s.level}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center font-medium">{s.xp}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-green-600">{s.exercises.completed}</span>
                    <span className="text-gray-400">/{s.exercises.total}</span>
                  </td>
                  <td className="px-4 py-3 text-center">{s.transactions}</td>
                  <td className="px-4 py-3 text-center text-xs text-gray-400">
                    {s.lastLogin ? new Date(s.lastLogin).toLocaleDateString() : "Never"}
                  </td>
                </tr>
              ))}
              {students.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No students found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
