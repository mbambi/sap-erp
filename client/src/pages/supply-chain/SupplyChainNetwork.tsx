import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2, Route, Package } from "lucide-react";
import { api } from "../../api/client";
import PageHeader from "../../components/PageHeader";
import Modal from "../../components/Modal";
import { FormInput, FormSelect } from "../../components/FormField";

interface SupplyChainNode {
  id: string;
  name: string;
  type: string;
  capacity?: number | null;
  holdingCost?: number | null;
  fixedCost?: number | null;
}

interface SupplyChainLink {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  fromNode?: SupplyChainNode;
  toNode?: SupplyChainNode;
  transportMode?: string;
  costPerUnit?: number | null;
  leadTimeDays?: number | null;
  capacity?: number | null;
}

interface NetworkResponse {
  nodes: SupplyChainNode[];
  links: SupplyChainLink[];
}

interface OptimizeResult {
  routes: { from: string; to: string; quantity: number; cost: number; totalCost: number }[];
  totalCost: number;
}

const NODE_COLORS: Record<string, string> = {
  supplier: "#f97316",
  factory: "#3b82f6",
  warehouse: "#22c55e",
  customer: "#a855f7",
};


export default function SupplyChainNetwork() {
  const queryClient = useQueryClient();
  const [showAddNode, setShowAddNode] = useState(false);
  const [showAddLink, setShowAddLink] = useState(false);
  const [optimizeResult, setOptimizeResult] = useState<OptimizeResult | null>(null);
  const [selectedNode, setSelectedNode] = useState<SupplyChainNode | null>(null);
  const [nodeForm, setNodeForm] = useState({
    name: "",
    type: "supplier",
    capacity: "",
    holdingCost: "",
    fixedCost: "",
  });
  const [linkForm, setLinkForm] = useState({
    fromNodeId: "",
    toNodeId: "",
    transportMode: "truck",
    costPerUnit: "",
    leadTimeDays: "",
    capacity: "",
  });

  const networkQuery = useQuery({
    queryKey: ["supply-chain-network"],
    queryFn: () => api.get<NetworkResponse>("/supply-chain/network"),
  });

  const optimizeMutation = useMutation({
    mutationFn: (data: { demand: Record<string, number>; supply: Record<string, number> }) =>
      api.post<OptimizeResult>("/supply-chain/optimize", data),
    onSuccess: (data) => setOptimizeResult(data),
  });

  const createNodeMutation = useMutation({
    mutationFn: (data: typeof nodeForm) =>
      api.post("/supply-chain/nodes", {
        name: data.name,
        type: data.type,
        capacity: data.capacity ? Number(data.capacity) : null,
        holdingCost: data.holdingCost ? Number(data.holdingCost) : null,
        fixedCost: data.fixedCost ? Number(data.fixedCost) : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supply-chain-network"] });
      setShowAddNode(false);
      setNodeForm({ name: "", type: "supplier", capacity: "", holdingCost: "", fixedCost: "" });
    },
  });

  const createLinkMutation = useMutation({
    mutationFn: (data: typeof linkForm) =>
      api.post("/supply-chain/links", {
        fromNodeId: data.fromNodeId,
        toNodeId: data.toNodeId,
        transportMode: data.transportMode,
        costPerUnit: data.costPerUnit ? Number(data.costPerUnit) : 0,
        leadTimeDays: data.leadTimeDays ? Number(data.leadTimeDays) : 1,
        capacity: data.capacity ? Number(data.capacity) : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supply-chain-network"] });
      setShowAddLink(false);
      setLinkForm({ fromNodeId: "", toNodeId: "", transportMode: "truck", costPerUnit: "", leadTimeDays: "", capacity: "" });
    },
  });

  const network = networkQuery.data ?? { nodes: [], links: [] };
  const nodes = network.nodes ?? [];
  const links = network.links ?? [];

  const { positions, svgWidth, svgHeight } = useMemo(() => {
    const w = 700;
    const h = 400;
    const layers: Record<string, SupplyChainNode[]> = {
      supplier: [],
      factory: [],
      warehouse: [],
      customer: [],
    };
    for (const n of nodes) {
      const layer = layers[n.type] ?? layers.factory;
      layer.push(n);
    }
    const layerOrder = ["supplier", "factory", "warehouse", "customer"];
    const posMap = new Map<string, { x: number; y: number }>();
    let xOffset = 80;
    for (const layerType of layerOrder) {
      const layerNodes = layers[layerType];
      const step = layerNodes.length > 1 ? (h - 80) / (layerNodes.length - 1) : h / 2;
      layerNodes.forEach((n, i) => {
        posMap.set(n.id, { x: xOffset, y: 40 + (layerNodes.length === 1 ? h / 2 - 20 : i * step) });
      });
      if (layerNodes.length > 0) xOffset += (w - 160) / 3;
    }
    return { positions: posMap, svgWidth: w, svgHeight: h };
  }, [nodes]);

  const handleOptimize = () => {
    const supply: Record<string, number> = {};
    const demand: Record<string, number> = {};
    for (const n of nodes) {
      if (n.type === "supplier") supply[n.id] = 100;
      if (n.type === "customer") demand[n.id] = 100;
    }
    if (Object.keys(demand).length === 0 || Object.keys(supply).length === 0) {
      setOptimizeResult({
        routes: [],
        totalCost: 0,
      });
      return;
    }
    optimizeMutation.mutate({ demand, supply });
  };

  const handleAddNode = () => {
    if (!nodeForm.name || !nodeForm.type) return;
    createNodeMutation.mutate(nodeForm);
  };

  const handleAddLink = () => {
    if (!linkForm.fromNodeId || !linkForm.toNodeId) return;
    createLinkMutation.mutate(linkForm);
  };

  const connectedLinks = useMemo(() => {
    if (!selectedNode) return [];
    return links.filter((l) => l.fromNodeId === selectedNode.id || l.toNodeId === selectedNode.id);
  }, [selectedNode, links]);

  return (
    <div>
      <PageHeader
        title="Supply Chain Network"
        subtitle="Visualize and optimize your supply chain"
        breadcrumb={[
          { label: "Home", path: "/" },
          { label: "Supply Chain", path: "/supply-chain" },
          { label: "Network" },
        ]}
      >
        <button
          onClick={handleOptimize}
          disabled={optimizeMutation.isPending || nodes.length === 0}
          className="btn-primary"
        >
          {optimizeMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Route className="w-4 h-4" />
          )}{" "}
          Optimize Routes
        </button>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Node & Link Management</h3>
            <div className="space-y-2">
              <button onClick={() => setShowAddNode(true)} className="btn-primary w-full btn-sm">
                <Plus className="w-3.5 h-3.5" /> Add Node
              </button>
              <button onClick={() => setShowAddLink(true)} className="btn-secondary w-full btn-sm">
                <Plus className="w-3.5 h-3.5" /> Add Link
              </button>
            </div>
          </div>

          {selectedNode && (
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Node Details</h3>
              <div className="space-y-2 text-sm">
                <p><span className="text-gray-500">Name:</span> <strong>{selectedNode.name}</strong></p>
                <p><span className="text-gray-500">Type:</span> <span className="capitalize">{selectedNode.type}</span></p>
                {selectedNode.capacity != null && (
                  <p><span className="text-gray-500">Capacity:</span> {selectedNode.capacity}</p>
                )}
                {selectedNode.holdingCost != null && (
                  <p><span className="text-gray-500">Holding Cost:</span> ${selectedNode.holdingCost}</p>
                )}
                {selectedNode.fixedCost != null && (
                  <p><span className="text-gray-500">Fixed Cost:</span> ${selectedNode.fixedCost}</p>
                )}
              </div>
              <div className="mt-4">
                <p className="text-xs font-medium text-gray-500 mb-2">Connected Links ({connectedLinks.length})</p>
                <ul className="space-y-1 text-xs">
                  {connectedLinks.map((l) => (
                    <li key={l.id} className="text-gray-600">
                      {l.fromNode?.name ?? l.fromNodeId} → {l.toNode?.name ?? l.toNodeId}
                      {l.costPerUnit != null && ` ($${l.costPerUnit}/unit)`}
                    </li>
                  ))}
                </ul>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="btn-secondary btn-sm mt-4 w-full"
              >
                Close
              </button>
            </div>
          )}
        </div>

        <div className="lg:col-span-3">
          <div className="card p-4 overflow-auto">
            <div className="flex items-center gap-4 mb-4 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#f97316]" /> Supplier</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#3b82f6]" /> Factory</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#22c55e]" /> Warehouse</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#a855f7]" /> Customer</span>
            </div>
            <svg
              width="100%"
              viewBox={`0 0 ${700} ${400}`}
              className="border border-gray-200 rounded-lg bg-gray-50"
            >
              {links.map((link) => {
                const from = positions.get(link.fromNodeId);
                const to = positions.get(link.toNodeId);
                if (!from || !to) return null;
                const midX = (from.x + to.x) / 2;
                const midY = (from.y + to.y) / 2;
                return (
                  <g key={link.id}>
                    <line
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                      stroke="#94a3b8"
                      strokeWidth={2}
                      markerEnd="url(#arrowhead)"
                    />
                    {link.costPerUnit != null && link.costPerUnit > 0 && (
                      <text x={midX} y={midY - 5} textAnchor="middle" className="text-[10px] fill-gray-600">
                        ${link.costPerUnit}/u
                      </text>
                    )}
                  </g>
                );
              })}
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="10"
                  markerHeight="7"
                  refX="9"
                  refY="3.5"
                  orient="auto"
                >
                  <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
                </marker>
              </defs>
              {nodes.map((node) => {
                const pos = positions.get(node.id);
                if (!pos) return null;
                const color = NODE_COLORS[node.type] ?? "#6b7280";
                const label = node.type.charAt(0).toUpperCase();
                return (
                  <g
                    key={node.id}
                    onClick={() => setSelectedNode(node)}
                    className="cursor-pointer"
                  >
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={24}
                      fill={color}
                      fillOpacity={0.9}
                      stroke="white"
                      strokeWidth={2}
                      className="hover:opacity-80 transition-opacity"
                    />
                    <text
                      x={pos.x}
                      y={pos.y + 5}
                      textAnchor="middle"
                      fill="white"
                      fontSize="14"
                      fontWeight="bold"
                    >
                      {label}
                    </text>
                    <text
                      x={pos.x}
                      y={pos.y + 36}
                      textAnchor="middle"
                      fill="#374151"
                      fontSize="12"
                      fontWeight="500"
                    >
                      {node.name}
                    </text>
                  </g>
                );
              })}
            </svg>
            {nodes.length === 0 && !networkQuery.isLoading && (
              <div className="py-16 text-center text-gray-400">
                <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No nodes in network. Add nodes and links to visualize.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal
        isOpen={showAddNode}
        onClose={() => setShowAddNode(false)}
        title="Add Node"
        footer={
          <>
            <button onClick={() => setShowAddNode(false)} className="btn-secondary">Cancel</button>
            <button
              onClick={handleAddNode}
              disabled={createNodeMutation.isPending || !nodeForm.name || !nodeForm.type}
              className="btn-primary"
            >
              {createNodeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}{" "}
              Add Node
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <FormInput
            label="Name"
            value={nodeForm.name}
            onChange={(e) => setNodeForm({ ...nodeForm, name: e.target.value })}
            placeholder="Node name"
          />
          <FormSelect
            label="Type"
            value={nodeForm.type}
            onChange={(e) => setNodeForm({ ...nodeForm, type: e.target.value })}
            options={[
              { value: "supplier", label: "Supplier" },
              { value: "factory", label: "Factory" },
              { value: "warehouse", label: "Warehouse" },
              { value: "customer", label: "Customer" },
            ]}
          />
          <FormInput
            label="Capacity"
            type="number"
            value={nodeForm.capacity}
            onChange={(e) => setNodeForm({ ...nodeForm, capacity: e.target.value })}
            placeholder="Optional"
          />
          <FormInput
            label="Holding Cost"
            type="number"
            value={nodeForm.holdingCost}
            onChange={(e) => setNodeForm({ ...nodeForm, holdingCost: e.target.value })}
            placeholder="Optional"
          />
          <FormInput
            label="Fixed Cost"
            type="number"
            value={nodeForm.fixedCost}
            onChange={(e) => setNodeForm({ ...nodeForm, fixedCost: e.target.value })}
            placeholder="Optional"
          />
        </div>
      </Modal>

      <Modal
        isOpen={showAddLink}
        onClose={() => setShowAddLink(false)}
        title="Add Link"
        footer={
          <>
            <button onClick={() => setShowAddLink(false)} className="btn-secondary">Cancel</button>
            <button
              onClick={handleAddLink}
              disabled={createLinkMutation.isPending || !linkForm.fromNodeId || !linkForm.toNodeId}
              className="btn-primary"
            >
              {createLinkMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}{" "}
              Add Link
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <FormSelect
            label="From Node"
            value={linkForm.fromNodeId}
            onChange={(e) => setLinkForm({ ...linkForm, fromNodeId: e.target.value })}
            options={nodes.map((n) => ({ value: n.id, label: n.name }))}
          />
          <FormSelect
            label="To Node"
            value={linkForm.toNodeId}
            onChange={(e) => setLinkForm({ ...linkForm, toNodeId: e.target.value })}
            options={nodes.map((n) => ({ value: n.id, label: n.name }))}
          />
          <FormSelect
            label="Transport Mode"
            value={linkForm.transportMode}
            onChange={(e) => setLinkForm({ ...linkForm, transportMode: e.target.value })}
            options={[
              { value: "truck", label: "Truck" },
              { value: "rail", label: "Rail" },
              { value: "ship", label: "Ship" },
              { value: "air", label: "Air" },
            ]}
          />
          <FormInput
            label="Cost Per Unit"
            type="number"
            value={linkForm.costPerUnit}
            onChange={(e) => setLinkForm({ ...linkForm, costPerUnit: e.target.value })}
          />
          <FormInput
            label="Lead Time (days)"
            type="number"
            value={linkForm.leadTimeDays}
            onChange={(e) => setLinkForm({ ...linkForm, leadTimeDays: e.target.value })}
          />
          <FormInput
            label="Capacity"
            type="number"
            value={linkForm.capacity}
            onChange={(e) => setLinkForm({ ...linkForm, capacity: e.target.value })}
            placeholder="Optional"
          />
        </div>
      </Modal>

      <Modal
        isOpen={!!optimizeResult}
        onClose={() => setOptimizeResult(null)}
        title="Optimization Results"
        size="lg"
        footer={<button onClick={() => setOptimizeResult(null)} className="btn-primary">Close</button>}
      >
        {optimizeResult && (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-green-600 font-medium">Total Cost</p>
              <p className="text-2xl font-bold text-green-900">${optimizeResult.totalCost.toFixed(2)}</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Recommended Routes</h4>
              {optimizeResult.routes.length === 0 ? (
                <p className="text-sm text-gray-500">No routes found. Ensure you have suppliers and customers with connecting links.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">From</th>
                      <th className="text-left py-2">To</th>
                      <th className="text-right py-2">Qty</th>
                      <th className="text-right py-2">Total Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {optimizeResult.routes.map((r, i) => (
                      <tr key={i}>
                        <td className="py-2">{r.from}</td>
                        <td className="py-2">{r.to}</td>
                        <td className="text-right py-2">{r.quantity}</td>
                        <td className="text-right py-2 font-medium">${r.totalCost.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
