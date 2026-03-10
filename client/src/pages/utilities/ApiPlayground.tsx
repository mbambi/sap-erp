import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Send, Zap } from "lucide-react";
import { api } from "../../api/client";
import { useAuthStore } from "../../stores/auth";
import PageHeader from "../../components/PageHeader";

interface Endpoint {
  method: string;
  path: string;
  desc?: string;
  body?: any;
}

interface Module {
  name: string;
  base: string;
  endpoints: Endpoint[];
}

export default function ApiPlayground() {
  const { token } = useAuthStore();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<{ module: Module; endpoint: Endpoint } | null>(null);
  const [method, setMethod] = useState("GET");
  const [url, setUrl] = useState("");
  const [body, setBody] = useState("{}");
  const [response, setResponse] = useState<{
    status: number;
    time: number;
    data: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const { data } = useQuery({
    queryKey: ["api-docs"],
    queryFn: () => api.get<{ modules: Module[] }>("/utilities/api-docs"),
  });

  const modules = data?.modules ?? [];

  const selectEndpoint = (mod: Module, ep: Endpoint) => {
    setSelected({ module: mod, endpoint: ep });
    setMethod(ep.method);
    setUrl(`/api${mod.base}${ep.path}`);
    setBody(
      ep.body ? JSON.stringify(ep.body, null, 2) : "{}"
    );
    setResponse(null);
  };

  const sendRequest = async () => {
    if (!token) return;
    setLoading(true);
    setResponse(null);
    const start = performance.now();
    try {
      const fullUrl = url.startsWith("http") ? url : `${window.location.origin}${url}`;
      const opts: RequestInit = {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      };
      if (["POST", "PUT"].includes(method) && body.trim()) {
        try {
          opts.body = JSON.stringify(JSON.parse(body));
        } catch {
          opts.body = body;
        }
      }
      const res = await fetch(fullUrl, opts);
      const elapsed = Math.round(performance.now() - start);
      let dataStr: string;
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const json = await res.json();
        dataStr = JSON.stringify(json, null, 2);
      } else {
        dataStr = await res.text();
      }
      setResponse({ status: res.status, time: elapsed, data: dataStr });
    } catch (e: any) {
      setResponse({
        status: 0,
        time: Math.round(performance.now() - start),
        data: `Error: ${e.message}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const methodColor = (m: string) => {
    if (m === "GET") return "bg-emerald-100 text-emerald-800";
    if (m === "POST") return "bg-blue-100 text-blue-800";
    if (m === "PUT") return "bg-amber-100 text-amber-800";
    if (m === "DELETE") return "bg-red-100 text-red-800";
    return "bg-gray-100 text-gray-700";
  };

  const statusColor = (s: number) => {
    if (s >= 200 && s < 300) return "bg-emerald-100 text-emerald-800";
    if (s >= 400 && s < 500) return "bg-amber-100 text-amber-800";
    if (s >= 500) return "bg-red-100 text-red-800";
    return "bg-gray-100 text-gray-700";
  };

  return (
    <div>
      <PageHeader
        title="API Playground"
        subtitle="Test ERP APIs interactively"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: API modules */}
        <div className="lg:col-span-1 card overflow-hidden">
          <div className="px-4 py-3 border-b font-medium text-gray-900">
            API Modules
          </div>
          <div className="max-h-[600px] overflow-y-auto">
            {modules.map((mod) => {
              const isExp = expanded[mod.name] ?? true;
              return (
                <div key={mod.name}>
                  <button
                    onClick={() =>
                      setExpanded((p) => ({ ...p, [mod.name]: !p[mod.name] }))
                    }
                    className="w-full px-4 py-2 flex items-center gap-2 text-left hover:bg-gray-50"
                  >
                    {isExp ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                    <span className="font-medium text-sm">{mod.name}</span>
                  </button>
                  {isExp && (
                    <div className="border-t">
                      {mod.endpoints.map((ep) => (
                        <button
                          key={ep.path}
                          onClick={() => selectEndpoint(mod, ep)}
                          className={`w-full px-4 py-2 pl-8 flex items-center gap-2 text-left text-sm hover:bg-gray-50 ${
                            selected?.endpoint === ep ? "bg-primary-50" : ""
                          }`}
                        >
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded font-mono ${methodColor(
                              ep.method
                            )}`}
                          >
                            {ep.method}
                          </span>
                          <span className="font-mono text-gray-600 truncate">
                            {ep.path}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Request builder */}
        <div className="lg:col-span-2 card overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b font-medium text-gray-900">
            Request Builder
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="flex gap-2 items-center">
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="input w-24"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
              </select>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="/api/..."
                className="input flex-1 font-mono text-sm"
              />
              <button
                onClick={sendRequest}
                disabled={loading}
                className="btn-primary flex items-center gap-2"
              >
                {loading ? (
                  <Zap className="w-4 h-4 animate-pulse" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Send Request
              </button>
            </div>

            {["POST", "PUT"].includes(method) && (
              <div>
                <label className="label">Request Body (JSON)</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="input min-h-[120px] font-mono text-sm"
                  placeholder="{}"
                />
              </div>
            )}

            {response && (
              <div className="border rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-gray-50 flex items-center gap-4">
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded ${statusColor(
                      response.status
                    )}`}
                  >
                    {response.status}
                  </span>
                  <span className="text-xs text-gray-500">
                    {response.time} ms
                  </span>
                </div>
                <pre className="p-4 bg-gray-900 text-gray-100 text-xs font-mono overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap break-words">
                  {response.data}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
