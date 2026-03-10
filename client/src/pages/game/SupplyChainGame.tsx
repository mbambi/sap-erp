import { useState, useEffect } from "react";
import { api } from "../../api/client";
import { useAuthStore } from "../../stores/auth";
import {
  Gamepad2, Trophy, Users, Play, Plus, ChevronRight, Crown,
  TrendingUp, DollarSign, Package, Truck, Star, Zap, Clock,
  BarChart3, Target,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function SupplyChainGame() {
  const { user } = useAuthStore();
  const isStaff = user?.roles?.some((r) => ["admin", "instructor"].includes(r));

  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDuration, setNewDuration] = useState(30);

  useEffect(() => { loadSessions(); }, []);

  const loadSessions = async () => {
    try {
      const data = await api.get("/game-mode/sessions");
      setSessions(data);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const createSession = async () => {
    if (!newName) return;
    try {
      await api.post("/game-mode/sessions", { name: newName, duration: newDuration });
      setNewName("");
      setShowCreate(false);
      loadSessions();
    } catch {}
  };

  const joinSession = async (sessionId: string) => {
    try {
      await api.post(`/game-mode/sessions/${sessionId}/join`, {});
      loadSessions();
    } catch {}
  };

  const startSession = async (sessionId: string) => {
    try {
      await api.post(`/game-mode/sessions/${sessionId}/start`);
      loadSessions();
    } catch {}
  };

  const advanceDay = async (sessionId: string) => {
    try {
      const result = await api.post(`/game-mode/sessions/${sessionId}/advance-day`);
      loadLeaderboard(sessionId);
      loadSessions();
    } catch {}
  };

  const loadLeaderboard = async (sessionId: string) => {
    try {
      const data = await api.get("/game-mode/leaderboard", { sessionId });
      setLeaderboard(data);
      setSelectedSession(data.session);
    } catch {}
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const rankColors = ["text-yellow-500", "text-gray-400", "text-amber-700"];
  const rankBg = ["bg-yellow-50", "bg-gray-50", "bg-amber-50"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Gamepad2 className="w-6 h-6 text-primary-600" /> Supply Chain Game
          </h1>
          <p className="text-gray-500 mt-1">Compete to run the most profitable company</p>
        </div>
        {isStaff && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700"
          >
            <Plus className="w-4 h-4" /> New Game
          </button>
        )}
      </div>

      {showCreate && (
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Create New Game Session</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Game Name</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Fall 2026 Competition"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duration (days)</label>
              <input type="number" value={newDuration} onChange={(e) => setNewDuration(Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={createSession} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">Create</button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Game Sessions</h3>
          {sessions.map((s) => (
            <div key={s.id} className={`bg-white rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md ${
              selectedSession?.id === s.id ? "ring-2 ring-primary-600" : ""
            }`} onClick={() => loadLeaderboard(s.id)}>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-900">{s.name}</h4>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  s.status === "active" ? "bg-green-50 text-green-700" :
                  s.status === "completed" ? "bg-gray-100 text-gray-600" :
                  "bg-yellow-50 text-yellow-700"
                }`}>{s.status}</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {s.playerCount} players</span>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Day {s.currentDay}/{s.duration}</span>
              </div>
              <div className="flex gap-2 mt-3">
                {s.status === "lobby" && (
                  <>
                    <button onClick={(e) => { e.stopPropagation(); joinSession(s.id); }}
                      className="flex-1 px-3 py-1.5 text-xs font-medium bg-primary-50 text-primary-600 rounded-lg hover:bg-primary-100">
                      Join Game
                    </button>
                    {isStaff && (
                      <button onClick={(e) => { e.stopPropagation(); startSession(s.id); }}
                        className="flex-1 px-3 py-1.5 text-xs font-medium bg-green-50 text-green-600 rounded-lg hover:bg-green-100 flex items-center justify-center gap-1">
                        <Play className="w-3 h-3" /> Start
                      </button>
                    )}
                  </>
                )}
                {s.status === "active" && isStaff && (
                  <button onClick={(e) => { e.stopPropagation(); advanceDay(s.id); }}
                    className="flex-1 px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 flex items-center justify-center gap-1">
                    <ChevronRight className="w-3 h-3" /> Advance Day
                  </button>
                )}
              </div>
            </div>
          ))}
          {sessions.length === 0 && (
            <div className="bg-white rounded-xl border p-6 text-center">
              <Gamepad2 className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No game sessions yet</p>
              {isStaff && <p className="text-xs text-gray-400 mt-1">Create one to get started</p>}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-6">
          {leaderboard ? (
            <>
              <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-xl p-5 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <Trophy className="w-5 h-5" /> {leaderboard.session.name}
                    </h3>
                    <p className="text-primary-100 text-sm mt-1">
                      Day {leaderboard.session.currentDay} of {leaderboard.session.totalDays} &middot; {leaderboard.session.status}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold">{leaderboard.leaderboard.length}</p>
                    <p className="text-primary-200 text-xs">Players</p>
                  </div>
                </div>
              </div>

              {leaderboard.leaderboard.length > 0 && (
                <div className="bg-white rounded-xl border">
                  <div className="px-5 py-4 border-b">
                    <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                      <Crown className="w-4 h-4 text-yellow-500" /> Leaderboard
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500 text-xs">
                          <th className="px-4 py-3 text-left font-medium">#</th>
                          <th className="px-4 py-3 text-left font-medium">Player</th>
                          <th className="px-4 py-3 text-right font-medium">Profit</th>
                          <th className="px-4 py-3 text-right font-medium">Service %</th>
                          <th className="px-4 py-3 text-right font-medium">Inv. Turn</th>
                          <th className="px-4 py-3 text-right font-medium">On-Time %</th>
                          <th className="px-4 py-3 text-right font-medium">Quality</th>
                          <th className="px-4 py-3 text-right font-medium">Score</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {leaderboard.leaderboard.map((p: any) => (
                          <tr key={p.userId} className={`${p.rank <= 3 ? rankBg[p.rank - 1] : ""} hover:bg-gray-50`}>
                            <td className="px-4 py-3">
                              {p.rank <= 3 ? (
                                <span className={`text-lg ${rankColors[p.rank - 1]}`}>
                                  {p.rank === 1 ? "🥇" : p.rank === 2 ? "🥈" : "🥉"}
                                </span>
                              ) : (
                                <span className="text-gray-500 font-medium">#{p.rank}</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-medium text-gray-900">{p.userName}</p>
                              <p className="text-xs text-gray-500">{p.companyName}</p>
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-green-600">${p.profit.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right">{p.serviceLevel}%</td>
                            <td className="px-4 py-3 text-right">{p.inventoryTurnover}x</td>
                            <td className="px-4 py-3 text-right">{p.onTimeDelivery}%</td>
                            <td className="px-4 py-3 text-right">{p.qualityScore}%</td>
                            <td className="px-4 py-3 text-right">
                              <span className="font-bold text-primary-600">{p.overallScore}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {leaderboard.leaderboard.length > 0 && (
                <div className="bg-white rounded-xl border p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary-600" /> Score Comparison
                  </h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={leaderboard.leaderboard}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="companyName" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="overallScore" fill="#2563eb" radius={[4, 4, 0, 0]} name="Overall Score" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white rounded-xl border p-10 text-center">
              <Trophy className="w-16 h-16 text-gray-200 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">Select a Game Session</h3>
              <p className="text-sm text-gray-500 mt-1">Click on a session to view the leaderboard and scores</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
