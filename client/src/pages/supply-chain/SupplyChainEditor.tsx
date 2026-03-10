import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line,
} from "recharts";
import {
  Play, Plus, Trash2, Loader2, Save, MapPin, ArrowRight,
  Factory, Warehouse, Truck, Store, Users, Package,
} from "lucide-react";
import { api } from "../../api/client";
import PageHeader from "../../components/PageHeader";
import KPICard from "../../components/KPICard";

const NODE_TYPES = [
  { type: "supplier", label: "Supplier", icon: Package, color: "bg-blue-500" },
  { type: "factory", label: "Factory", icon: Factory, color: "bg-orange-500" },
  { type: "warehouse", label: "Warehouse", icon: Warehouse, color: "bg-green-500" },
  { type: "distribution_center", label: "Distribution Center", icon: Truck, color: "bg-purple-500" },
  { type: "retail", label: "Retail Store", icon: Store, color: "bg-pink-500" },
  { type: "customer", label: "Customer", icon: Users, color: "bg-gray-500" },
] as const;

interface SCNode {
  id: string;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
  capacity?: number;
}

interface SCLink {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  transportMode?: string;
  leadTimeDays?: number;
  costPerUnit?: number;
}

interface SimResult {
  summary: { totalCost: number; serviceLevel: number; totalProduced: number; totalDelivered: number };
  timeline: Array<{ period: number; produced: number; shipped: number; inventory: Record<string, number>; costs: number }>;
  disruptions: Array<{ period: number; nodeId: string; type: string; impact: string }>;
}

export default function SupplyChainEditor() {
  const [newNodeType, setNewNodeType] = useState("supplier");
  const [newNodeName, setNewNodeName] = useState("");
  const [linkFrom, setLinkFrom] = useState("");
  const [linkTo, setLinkTo] = useState("");
  const [simPeriods, setSimPeriods] = useState(12);
  const [simResult, setSimResult] = useState<SimResult | null>(null);

  const { data: editorData, isLoading } = useQuery({
    queryKey: ["supply-chain-editor"],
    queryFn: () => api.get("/supply-chain/editor"),
  });

  const { data: networkData, refetch } = useQuery({
    queryKey: ["supply-chain-network"],
    queryFn: () => api.get("/supply-chain/network"),
  });

  const addNodeMut = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post("/supply-chain/nodes", body),
    onSuccess: () => { refetch(); setNewNodeName(""); },
  });

  const deleteNodeMut = useMutation({
    mutationFn: (id: string) => api.delete(`/supply-chain/nodes/${id}`),
    onSuccess: () => refetch(),
  });

  const addLinkMut = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post("/supply-chain/links", body),
    onSuccess: () => { refetch(); setLinkFrom(""); setLinkTo(""); },
  });

  const simulateMut = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post("/supply-chain/simulate", body),
    onSuccess: (data) => setSimResult(data as SimResult),
  });

  const nodes: SCNode[] = networkData?.nodes ?? [];
  const links: SCLink[] = networkData?.links ?? [];

  const handleAddNode = useCallback(() => {
    if (!newNodeName.trim()) return;
    addNodeMut.mutate({
      name: newNodeName,
      type: newNodeType,
      latitude: 40 + Math.random() * 10,
      longitude: -80 + Math.random() * 20,
    });
  }, [newNodeName, newNodeType, addNodeMut]);

  const handleAddLink = useCallback(() => {
    if (!linkFrom || !linkTo || linkFrom === linkTo) return;
    addLinkMut.mutate({ fromNodeId: linkFrom, toNodeId: linkTo, transportMode: "truck", leadTimeDays: 3, costPerUnit: 1.5 });
  }, [linkFrom, linkTo, addLinkMut]);

  const handleSimulate = useCallback(() => {
    simulateMut.mutate({ periods: simPeriods, disruptions: [{ period: Math.floor(simPeriods / 3), nodeId: nodes[0]?.id, type: "delay", severity: 0.5 }] });
  }, [simPeriods, nodes, simulateMut]);

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /></div>;

  return (
    <div className="space-y-6">
      <PageHeader title="Supply Chain Map Editor" subtitle="Visual drag-and-drop supply chain builder with simulation" />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard title="Nodes" value={nodes.length} icon={MapPin} />
        <KPICard title="Links" value={links.length} icon={ArrowRight} />
        <KPICard title="Templates" value={editorData?.nodeTemplates?.length ?? 6} icon={Package} />
        <KPICard title="Service Level" value={simResult ? `${simResult.summary.serviceLevel}%` : "—"} icon={Users} />
      </div>

      {/* Node Builder */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Add Node</h3>
        <div className="flex flex-wrap gap-3">
          {NODE_TYPES.map((nt) => (
            <button key={nt.type} onClick={() => setNewNodeType(nt.type)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${newNodeType === nt.type ? `${nt.color} text-white` : "bg-gray-800 text-gray-400 hover:text-white"}`}>
              <nt.icon className="w-4 h-4" /> {nt.label}
            </button>
          ))}
        </div>
        <div className="flex gap-3 mt-4">
          <input value={newNodeName} onChange={(e) => setNewNodeName(e.target.value)} placeholder="Node name..." className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm" />
          <button onClick={handleAddNode} disabled={addNodeMut.isPending} className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm">
            {addNodeMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add
          </button>
        </div>
      </div>

      {/* Network View */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Network Nodes</h3>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {nodes.length === 0 && <p className="text-gray-500 text-sm">No nodes yet. Add one above.</p>}
            {nodes.map((n) => {
              const meta = NODE_TYPES.find((t) => t.type === n.type);
              const Icon = meta?.icon ?? Package;
              return (
                <div key={n.id} className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg ${meta?.color ?? "bg-gray-600"} flex items-center justify-center`}>
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{n.name}</p>
                      <p className="text-gray-400 text-xs capitalize">{n.type?.replace(/_/g, " ")}</p>
                    </div>
                  </div>
                  <button onClick={() => deleteNodeMut.mutate(n.id)} className="text-gray-500 hover:text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Create Link</h3>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <select value={linkFrom} onChange={(e) => setLinkFrom(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm">
              <option value="">From node...</option>
              {nodes.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
            </select>
            <select value={linkTo} onChange={(e) => setLinkTo(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm">
              <option value="">To node...</option>
              {nodes.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
            </select>
          </div>
          <button onClick={handleAddLink} disabled={addLinkMut.isPending} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm">
            <ArrowRight className="w-4 h-4" /> Create Link
          </button>

          <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
            {links.map((l) => {
              const from = nodes.find((n) => n.id === l.fromNodeId);
              const to = nodes.find((n) => n.id === l.toNodeId);
              return (
                <div key={l.id} className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2 text-sm text-gray-300">
                  <span>{from?.name ?? "?"}</span>
                  <ArrowRight className="w-3 h-3 text-gray-500" />
                  <span>{to?.name ?? "?"}</span>
                  <span className="ml-auto text-gray-500">{l.transportMode} · {l.leadTimeDays}d</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Simulation */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Run Simulation</h3>
        <div className="flex items-center gap-4 mb-4">
          <label className="text-gray-400 text-sm">Periods:</label>
          <input type="number" value={simPeriods} onChange={(e) => setSimPeriods(Number(e.target.value))} min={1} max={52} className="w-20 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" />
          <button onClick={handleSimulate} disabled={simulateMut.isPending || nodes.length < 2}
            className="flex items-center gap-2 px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm disabled:opacity-50">
            {simulateMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Simulate
          </button>
        </div>

        {simResult && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-gray-400 text-xs">Total Cost</p>
                <p className="text-white text-xl font-bold">${simResult.summary.totalCost.toLocaleString()}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-gray-400 text-xs">Service Level</p>
                <p className="text-white text-xl font-bold">{simResult.summary.serviceLevel}%</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-gray-400 text-xs">Total Produced</p>
                <p className="text-white text-xl font-bold">{simResult.summary.totalProduced.toLocaleString()}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-gray-400 text-xs">Total Delivered</p>
                <p className="text-white text-xl font-bold">{simResult.summary.totalDelivered.toLocaleString()}</p>
              </div>
            </div>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={simResult.timeline}>
                  <XAxis dataKey="period" stroke="#6b7280" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8, color: "#fff" }} />
                  <Line type="monotone" dataKey="produced" stroke="#3b82f6" strokeWidth={2} name="Produced" dot={false} />
                  <Line type="monotone" dataKey="shipped" stroke="#10b981" strokeWidth={2} name="Shipped" dot={false} />
                  <Line type="monotone" dataKey="costs" stroke="#ef4444" strokeWidth={2} name="Costs" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
