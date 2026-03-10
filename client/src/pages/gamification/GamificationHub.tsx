import { useQuery } from "@tanstack/react-query";
import { Trophy, Award, Lock, CheckCircle2 } from "lucide-react";
import { api } from "../../api/client";
import { useAuthStore } from "../../stores/auth";
import PageHeader from "../../components/PageHeader";

export default function GamificationHub() {
  const { user } = useAuthStore();
  const { data: xpData } = useQuery({
    queryKey: ["my-xp"],
    queryFn: () => api.get<{ totalXP: number; level: number; streak: number }>("/gamification/my-xp"),
  });

  const { data: achievements = [] } = useQuery({
    queryKey: ["achievements"],
    queryFn: () => api.get<any[]>("/gamification/achievements"),
  });

  const { data: leaderboard = [] } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => api.get<any[]>("/gamification/leaderboard"),
  });

  const totalXP = xpData?.totalXP ?? 0;
  const level = Math.floor(totalXP / 100) + 1;
  const nextLevelXP = level * 100;
  const xpInLevel = totalXP % 100;
  const progressPercent = (xpInLevel / 100) * 100;
  const streak = xpData?.streak ?? 0;

  const currentUserId = user?.id;

  const rankStyle = (rank: number) => {
    if (rank === 1) return "bg-amber-100 text-amber-800 border-amber-200";
    if (rank === 2) return "bg-gray-200 text-gray-700 border-gray-300";
    if (rank === 3) return "bg-amber-700/20 text-amber-900 border-amber-800/30";
    return "bg-gray-50 text-gray-600 border-gray-200";
  };

  return (
    <div>
      <PageHeader
        title="Your ERP Journey"
        subtitle="Track your progress, earn achievements, and climb the leaderboard"
      />

      {/* Profile Card */}
      <div className="card p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center">
              <span className="text-2xl font-bold text-primary-600 text-center">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {user?.firstName} {user?.lastName}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="badge badge-blue">Level {level}</span>
                {streak > 0 && (
                  <span className="text-sm text-amber-600">🔥 {streak} day streak</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex-1">
            <div className="flex justify-between text-sm text-gray-500 mb-1">
              <span>{xpInLevel} / 100 XP</span>
              <span>Level {level + 1} at {nextLevelXP} XP</span>
            </div>
            <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-500 rounded-full transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Achievements */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Award className="w-5 h-5 text-amber-500" />
          Achievements
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {achievements.map((a: any) => (
            <div
              key={a.id}
              className={`card p-4 transition-all ${
                a.unlocked ? "opacity-100" : "opacity-60"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl ${
                    a.unlocked ? "bg-amber-50" : "bg-gray-100"
                  }`}
                >
                  {a.unlocked ? a.icon || "🏆" : <Lock className="w-6 h-6 text-gray-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-gray-900 text-sm">{a.name}</h4>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{a.description}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs font-medium text-primary-600">+{a.xpReward} XP</span>
                    {a.unlocked && a.unlockedAt && (
                      <span className="text-xs text-gray-400 flex items-center gap-0.5">
                        <CheckCircle2 className="w-3 h-3" />
                        {new Date(a.unlockedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Leaderboard */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" />
          Leaderboard
        </h3>
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Rank
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  XP
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Level
                </th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((u: any, i: number) => {
                const isCurrentUser = u.userId === currentUserId;
                return (
                  <tr
                    key={u.userId}
                    className={`border-b last:border-0 ${
                      isCurrentUser ? "bg-primary-50" : "hover:bg-gray-50"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${rankStyle(
                          i + 1
                        )}`}
                      >
                        #{i + 1}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {u.firstName} {u.lastName}
                      {isCurrentUser && (
                        <span className="ml-2 text-xs text-primary-600">(You)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{u.totalXP}</td>
                    <td className="px-4 py-3">
                      <span className="badge badge-blue">Level {u.level}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {leaderboard.length === 0 && (
            <div className="px-4 py-12 text-center text-gray-400">
              No leaderboard data yet. Start earning XP!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
