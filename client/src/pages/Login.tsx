import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Landmark,
  Loader2,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles,
  BookOpen,
  Shield,
  Users,
  Gamepad2,
} from "lucide-react";
import { useAuthStore } from "../stores/auth";
import { api } from "../api/client";

const FEATURES = [
  {
    icon: BookOpen,
    label: "46+ ERP Modules",
    desc: "Finance, Materials, Sales, Production, HR, and more",
  },
  {
    icon: Gamepad2,
    label: "Supply Chain Game",
    desc: "Compete to run the most profitable company",
  },
  {
    icon: Sparkles,
    label: "AI-Powered Learning",
    desc: "Smart exercises, auto-grading, and progress tracking",
  },
  {
    icon: Shield,
    label: "Enterprise Grade",
    desc: "Multi-tenant, SSO-ready, audit-compliant platform",
  },
];

export default function Login() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [tenantSlug, setTenantSlug] = useState("");
  const [tenants, setTenants] = useState<
    { slug: string; name: string; university?: string }[]
  >([]);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const navigate = useNavigate();
  const { login, register } = useAuthStore();

  useEffect(() => {
    api
      .get("/auth/tenants")
      .then(setTenants)
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      if (mode === "login") {
        await login(email, password, tenantSlug);
        navigate("/");
      } else {
        await register({ email, password, firstName, lastName, tenantSlug });
        setSuccess("Account created! You can now sign in.");
        setMode("login");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel - Branding */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-slate-900 via-primary-950 to-indigo-950 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 bg-primary-500 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-indigo-500 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-cyan-500 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
              <Landmark className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">
                SAP ERP
              </h1>
              <p className="text-[11px] text-primary-300 font-medium tracking-wider uppercase">
                Learning Platform
              </p>
            </div>
          </div>

          <div className="max-w-xl">
            <h2 className="text-5xl font-bold text-white leading-[1.1] tracking-tight">
              Learn Enterprise
              <br />
              Resource Planning
              <br />
              <span className="bg-gradient-to-r from-primary-400 to-cyan-400 text-transparent bg-clip-text">
                by Doing
              </span>
            </h2>
            <p className="text-lg text-slate-400 mt-6 leading-relaxed max-w-md">
              The only ERP simulator built for universities. Practice real
              business processes in a safe, interactive environment.
            </p>

            <div className="grid grid-cols-2 gap-4 mt-10">
              {FEATURES.map((f) => (
                <div
                  key={f.label}
                  className="flex items-start gap-3 p-3 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10"
                >
                  <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                    <f.icon className="w-4 h-4 text-primary-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{f.label}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex -space-x-2">
              {[
                "bg-blue-500",
                "bg-green-500",
                "bg-purple-500",
                "bg-amber-500",
              ].map((c, i) => (
                <div
                  key={i}
                  className={`w-8 h-8 rounded-full ${c} border-2 border-slate-900 flex items-center justify-center`}
                >
                  <Users className="w-3 h-3 text-white" />
                </div>
              ))}
            </div>
            <p className="text-sm text-slate-400">
              <span className="text-white font-semibold">500+</span> students
              learning ERP worldwide
            </p>
          </div>
        </div>
      </div>

      {/* Right panel - Form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50 lg:max-w-xl">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 rounded-xl bg-primary-600 flex items-center justify-center">
              <Landmark className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">
              SAP ERP Learning
            </h1>
          </div>

          <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                {mode === "login" ? "Welcome back" : "Create account"}
              </h2>
              <p className="text-sm text-gray-500 mt-1.5">
                {mode === "login"
                  ? "Sign in to continue your ERP learning journey"
                  : "Join the platform and start learning ERP"}
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                {error}
              </div>
            )}
            {success && (
              <div className="mb-4 p-3 bg-green-50 border border-green-100 rounded-xl text-sm text-green-700 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                {success}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Organization
                </label>
                <select
                  value={tenantSlug}
                  onChange={(e) => setTenantSlug(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white transition-shadow"
                  required
                >
                  <option value="">Select your university...</option>
                  {tenants.map((t) => (
                    <option key={t.slug} value={t.slug}>
                      {t.name}
                      {t.university && ` — ${t.university}`}
                    </option>
                  ))}
                </select>
              </div>

              {mode === "register" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      First Name
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow"
                      required
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow"
                  placeholder="you@university.edu"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 pr-10 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow"
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 focus:ring-4 focus:ring-primary-200 disabled:opacity-50 transition-all shadow-lg shadow-primary-600/20"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
                {mode === "login" ? "Sign In" : "Create Account"}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => {
                  setMode(mode === "login" ? "register" : "login");
                  setError("");
                  setSuccess("");
                }}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                {mode === "login"
                  ? "New here? Create an account"
                  : "Already have an account? Sign in"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
