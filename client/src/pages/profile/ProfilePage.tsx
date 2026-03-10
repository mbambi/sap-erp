import { useState, useEffect } from "react";
import { api } from "../../api/client";
import { useAuthStore } from "../../stores/auth";
import {
  User, Mail, Shield, Clock, Award, Star, BookOpen,
  Save, Key, Building2, Trophy, Zap, Target,
} from "lucide-react";

interface ProfileData {
  user: any;
  profile: any;
  gamification: any;
  exerciseStats: Record<string, number>;
}

export default function ProfilePage() {
  const { user: authUser, loadUser } = useAuthStore();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"overview" | "settings" | "security">("overview");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [bio, setBio] = useState("");
  const [department, setDepartment] = useState("");
  const [title, setTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [theme, setTheme] = useState("light");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const res = await api.get("/profile");
      setData(res);
      setFirstName(res.user.firstName);
      setLastName(res.user.lastName);
      setBio(res.profile.bio || "");
      setDepartment(res.profile.department || "");
      setTitle(res.profile.title || "");
      setPhone(res.profile.phone || "");
      setTimezone(res.profile.timezone || "UTC");
      setTheme(res.profile.theme || "light");
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      await api.put("/profile/name", { firstName, lastName });
      await api.put("/profile", { bio, department, title, phone, timezone, theme });
      await loadUser();
      await loadProfile();
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (newPassword !== confirmPassword) {
      setPasswordMsg("Passwords do not match");
      return;
    }
    try {
      await api.put("/profile/password", { currentPassword, newPassword });
      setPasswordMsg("Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPasswordMsg(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const stats = [
    { label: "XP Points", value: data?.gamification?.xp ?? 0, icon: Zap, color: "text-yellow-600 bg-yellow-50" },
    { label: "Level", value: data?.gamification?.level ?? 1, icon: Star, color: "text-purple-600 bg-purple-50" },
    { label: "Streak", value: `${data?.gamification?.streak ?? 0} days`, icon: Target, color: "text-orange-600 bg-orange-50" },
    { label: "Exercises Done", value: data?.exerciseStats?.completed ?? 0, icon: BookOpen, color: "text-green-600 bg-green-50" },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-xl p-6 text-white">
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold backdrop-blur-sm">
            {authUser?.firstName?.[0]}{authUser?.lastName?.[0]}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{authUser?.firstName} {authUser?.lastName}</h1>
            <p className="text-primary-100 flex items-center gap-2 mt-1">
              <Mail className="w-4 h-4" /> {authUser?.email}
            </p>
            <div className="flex items-center gap-3 mt-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/20 text-xs font-medium backdrop-blur-sm">
                <Shield className="w-3 h-3" /> {authUser?.roles?.join(", ")}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/20 text-xs font-medium backdrop-blur-sm">
                <Building2 className="w-3 h-3" /> {authUser?.tenantName}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-xl border p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg ${s.color} flex items-center justify-center`}>
              <s.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border">
        <div className="border-b flex">
          {(["overview", "settings", "security"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t ? "border-primary-600 text-primary-600" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t === "overview" ? "Overview" : t === "settings" ? "Edit Profile" : "Security"}
            </button>
          ))}
        </div>

        <div className="p-6">
          {tab === "overview" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Recent Achievements</h3>
                {data?.gamification?.achievements?.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {data.gamification.achievements.map((a: any) => (
                      <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border">
                        <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center text-lg">
                          {a.icon || "🏆"}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{a.name}</p>
                          <p className="text-xs text-gray-500">{a.description}</p>
                        </div>
                        <span className="ml-auto text-xs text-primary-600 font-medium">+{a.xpReward} XP</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">No achievements yet. Start completing exercises to earn badges!</p>
                )}
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Account Info</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-gray-500">Member since:</span> <span className="ml-2 text-gray-900">{new Date(data?.user.createdAt).toLocaleDateString()}</span></div>
                  <div><span className="text-gray-500">Last login:</span> <span className="ml-2 text-gray-900">{data?.user.lastLogin ? new Date(data.user.lastLogin).toLocaleString() : "N/A"}</span></div>
                  <div><span className="text-gray-500">Tenant:</span> <span className="ml-2 text-gray-900">{data?.user.tenant?.name}</span></div>
                  <div><span className="text-gray-500">University:</span> <span className="ml-2 text-gray-900">{data?.user.tenant?.university || "N/A"}</span></div>
                </div>
              </div>
            </div>
          )}

          {tab === "settings" && (
            <div className="space-y-4 max-w-lg">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <input value={firstName} onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input value={lastName} onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <input value={department} onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input value={title} onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
                  <select value={timezone} onChange={(e) => setTimezone(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none">
                    {["UTC", "US/Eastern", "US/Central", "US/Mountain", "US/Pacific", "Europe/London", "Europe/Berlin", "Asia/Tokyo"].map((tz) => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Theme</label>
                  <select value={theme} onChange={(e) => setTheme(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none">
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                    <option value="system">System</option>
                  </select>
                </div>
              </div>
              <button onClick={saveProfile} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
                <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          )}

          {tab === "security" && (
            <div className="space-y-4 max-w-lg">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Key className="w-4 h-4" /> Change Password
              </h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" />
              </div>
              {passwordMsg && (
                <p className={`text-sm ${passwordMsg.includes("success") ? "text-green-600" : "text-red-600"}`}>{passwordMsg}</p>
              )}
              <button onClick={changePassword}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">
                <Key className="w-4 h-4" /> Update Password
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
