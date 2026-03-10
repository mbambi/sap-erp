import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileDown, FileUp, Plus, Loader2, ChevronRight, Trash2 } from "lucide-react";
import { api } from "../api/client";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import { FormInput, FormSelect } from "../components/FormField";

const PROCESS_TYPES = [
  { value: "procure-to-pay", label: "Procure-to-Pay" },
  { value: "order-to-cash", label: "Order-to-Cash" },
  { value: "make-to-stock", label: "Make-to-Stock" },
  { value: "custom", label: "Custom" },
];

const MODULE_COLORS: Record<string, string> = {
  Finance: "#3b82f6",
  MM: "#22c55e",
  SD: "#f97316",
  PP: "#a855f7",
  QM: "#ef4444",
  WM: "#6b7280",
};

interface ProcessNode {
  id: string;
  label: string;
  description?: string;
  tcode?: string;
  module: string;
  x: number;
  y: number;
}

interface ProcessEdge {
  id: string;
  fromId: string;
  toId: string;
}

interface ProcessFlow {
  id: string;
  name: string;
  type: string;
  nodes: ProcessNode[];
  edges: ProcessEdge[];
  createdAt?: string;
}

interface PrebuiltTemplate {
  type: string;
  name: string;
  nodes: ProcessNode[];
  edges: ProcessEdge[];
}

const NODE_WIDTH = 140;
const NODE_HEIGHT = 56;

function getEdgePath(from: ProcessNode, to: ProcessNode): string {
  const x1 = from.x + NODE_WIDTH;
  const y1 = from.y + NODE_HEIGHT / 2;
  const x2 = to.x;
  const y2 = to.y + NODE_HEIGHT / 2;
  const midX = (x1 + x2) / 2;
  const ctrlX = midX + (x2 - x1) * 0.2;
  return `M ${x1} ${y1} Q ${ctrlX} ${y1} ${midX} ${(y1 + y2) / 2} T ${x2} ${y2}`;
}

export default function ProcessFlowDesigner() {
  const queryClient = useQueryClient();
  const svgRef = useRef<SVGSVGElement>(null);
  const [processType, setProcessType] = useState("procure-to-pay");
  const [nodes, setNodes] = useState<ProcessNode[]>([]);
  const [edges, setEdges] = useState<ProcessEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<ProcessNode | null>(null);
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showAddNode, setShowAddNode] = useState(false);
  const [showLoadTemplate, setShowLoadTemplate] = useState(false);
  const [newNodeForm, setNewNodeForm] = useState({
    label: "",
    description: "",
    tcode: "",
    module: "MM",
  });

  const prebuiltQuery = useQuery({
    queryKey: ["process-flows", "prebuilt"],
    queryFn: () => api.get<PrebuiltTemplate[]>("/process-flows/prebuilt"),
    retry: false,
  });

  const savedFlowsQuery = useQuery({
    queryKey: ["process-flows", "saved"],
    queryFn: () => api.get<ProcessFlow[]>("/process-flows"),
    retry: false,
  });

  const saveMutation = useMutation({
    mutationFn: (data: { name: string; type: string; nodes: ProcessNode[]; edges: ProcessEdge[] }) =>
      api.post("/process-flows", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["process-flows", "saved"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/process-flows/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["process-flows", "saved"] });
    },
  });

  const prebuiltTemplates = prebuiltQuery.data ?? [];
  const savedFlows = savedFlowsQuery.data ?? [];

  const handleLoadTemplate = useCallback(
    (template: PrebuiltTemplate) => {
      setNodes(template.nodes.map((n) => ({ ...n, x: n.x ?? 100, y: n.y ?? 100 })));
      setEdges(template.edges);
      setProcessType(template.type);
      setShowLoadTemplate(false);
    },
    []
  );

  const handleNewFlow = useCallback(() => {
    setNodes([]);
    setEdges([]);
    setSelectedNode(null);
  }, []);

  const handleSave = useCallback(() => {
    const name = `Flow ${new Date().toLocaleDateString()}`;
    saveMutation.mutate({ name, type: processType, nodes, edges });
  }, [processType, nodes, edges, saveMutation]);

  const handleLoadSaved = useCallback((flow: ProcessFlow) => {
    setNodes(flow.nodes);
    setEdges(flow.edges);
    setProcessType(flow.type);
    setSelectedNode(null);
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, nodeId: string) => {
      e.stopPropagation();
      const node = nodes.find((n) => n.id === nodeId);
      if (node) {
        setDraggingNode(nodeId);
        setDragOffset({ x: e.clientX - node.x, y: e.clientY - node.y });
      }
    },
    [nodes]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!draggingNode) return;
      setNodes((prev) =>
        prev.map((n) =>
          n.id === draggingNode ? { ...n, x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y } : n
        )
      );
    },
    [draggingNode, dragOffset]
  );

  const handleMouseUp = useCallback(() => {
    setDraggingNode(null);
  }, []);

  const handleAddNode = useCallback(() => {
    if (!newNodeForm.label || !newNodeForm.module) return;
    const id = `node-${Date.now()}`;
    const newNode: ProcessNode = {
      id,
      label: newNodeForm.label,
      description: newNodeForm.description || undefined,
      tcode: newNodeForm.tcode || undefined,
      module: newNodeForm.module,
      x: 100 + (nodes.length % 3) * 180,
      y: 80 + Math.floor(nodes.length / 3) * 100,
    };
    setNodes((prev) => [...prev, newNode]);
    setNewNodeForm({ label: "", description: "", tcode: "", module: "MM" });
    setShowAddNode(false);
  }, [newNodeForm, nodes.length]);

  const tcodeToRoute: Record<string, string> = {
    ME21N: "/materials/purchase-orders",
    MIGO: "/materials/inventory",
    FB50: "/finance/journal-entries",
    VA01: "/sales/orders",
    CO01: "/production/orders",
    MD01: "/mrp",
  };

  const svgWidth = 800;
  const svgHeight = Math.max(500, Math.ceil(nodes.length / 4) * 120 + 100);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Process Flow Designer"
        subtitle="Design and visualize business process flows"
        breadcrumb={[{ label: "Home", path: "/" }, { label: "Process Flows" }]}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={processType}
            onChange={(e) => setProcessType(e.target.value)}
            className="input w-auto max-w-[180px]"
          >
            {PROCESS_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <button onClick={() => setShowLoadTemplate(true)} className="btn-secondary btn-sm">
            <FileDown className="w-4 h-4" /> Load Template
          </button>
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending || nodes.length === 0}
            className="btn-primary btn-sm"
          >
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}{" "}
            Save
          </button>
          <button onClick={handleNewFlow} className="btn-secondary btn-sm">
            <Plus className="w-4 h-4" /> New Flow
          </button>
        </div>
      </PageHeader>

      <div className="flex gap-4" style={{ minHeight: 500 }}>
        <div className="flex-1 card overflow-hidden p-4" style={{ width: "80%" }}>
          <div
            className="relative overflow-auto rounded-lg border border-gray-200 bg-gray-50/50"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <svg
              ref={svgRef}
              width="100%"
              height={svgHeight}
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="min-h-[400px]"
              onClick={() => setSelectedNode(null)}
            >
              <defs>
                <marker
                  id="arrow-pf"
                  markerWidth={10}
                  markerHeight={10}
                  refX={9}
                  refY={3}
                  orient="auto"
                >
                  <path d="M0,0 L0,6 L9,3 z" fill="#64748b" />
                </marker>
              </defs>
              {edges.map((edge) => {
                const from = nodes.find((n) => n.id === edge.fromId);
                const to = nodes.find((n) => n.id === edge.toId);
                if (!from || !to) return null;
                return (
                  <path
                    key={edge.id}
                    d={getEdgePath(from, to)}
                    fill="none"
                    stroke="#64748b"
                    strokeWidth={2}
                    markerEnd="url(#arrow-pf)"
                  />
                );
              })}
              {nodes.map((node) => {
                const color = MODULE_COLORS[node.module] ?? "#6b7280";
                const isSelected = selectedNode?.id === node.id;
                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x}, ${node.y})`}
                    onMouseDown={(e) => handleMouseDown(e, node.id)}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedNode(node);
                    }}
                    className="cursor-move"
                  >
                    <rect
                      width={NODE_WIDTH}
                      height={NODE_HEIGHT}
                      rx={8}
                      fill={color}
                      fillOpacity={0.9}
                      stroke={isSelected ? "#1e293b" : "white"}
                      strokeWidth={isSelected ? 3 : 2}
                    />
                    <rect x={8} y={10} width={28} height={28} rx={6} fill="rgba(255,255,255,0.3)" />
                    <text x={44} y={24} fontSize={12} fontWeight="600" fill="white">
                      {node.label}
                    </text>
                    {node.tcode && (
                      <text x={44} y={42} fontSize={10} fill="rgba(255,255,255,0.9)">
                        {node.tcode}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        <div className="w-80 flex-shrink-0 space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Node Details</h3>
            {selectedNode ? (
              <div className="space-y-3">
                <p className="text-sm">
                  <span className="text-gray-500">Label:</span>{" "}
                  <strong>{selectedNode.label}</strong>
                </p>
                {selectedNode.description && (
                  <p className="text-sm text-gray-600">{selectedNode.description}</p>
                )}
                {selectedNode.tcode && (
                  <p className="text-sm">
                    <span className="text-gray-500">T-Code:</span>{" "}
                    <span className="font-mono badge badge-blue">{selectedNode.tcode}</span>
                  </p>
                )}
                <p className="text-sm">
                  <span className="text-gray-500">Module:</span> {selectedNode.module}
                </p>
                {selectedNode.tcode && tcodeToRoute[selectedNode.tcode] && (
                  <a
                    href={tcodeToRoute[selectedNode.tcode]}
                    className="btn-primary w-full btn-sm flex items-center justify-center gap-2"
                  >
                    Open Transaction <ChevronRight className="w-4 h-4" />
                  </a>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Click a node to view details</p>
            )}
          </div>
          <button onClick={() => setShowAddNode(true)} className="btn-primary w-full btn-sm">
            <Plus className="w-4 h-4" /> Add Node
          </button>
        </div>
      </div>

      {savedFlows.length > 0 && (
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Saved Flows</h3>
          <div className="flex flex-wrap gap-2">
            {savedFlows.map((flow) => (
              <div
                key={flow.id}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50"
              >
                <span className="text-sm font-medium">{flow.name}</span>
                <button
                  onClick={() => handleLoadSaved(flow)}
                  className="btn-secondary btn-sm py-1"
                >
                  Load
                </button>
                <button
                  onClick={() => deleteMutation.mutate(flow.id)}
                  disabled={deleteMutation.isPending}
                  className="btn-icon text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal
        isOpen={showLoadTemplate}
        onClose={() => setShowLoadTemplate(false)}
        title="Load Template"
        size="lg"
      >
        {prebuiltQuery.isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          </div>
        ) : prebuiltTemplates.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No prebuilt templates available. The API may not be configured yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {prebuiltTemplates.map((t) => (
              <button
                key={t.type}
                onClick={() => handleLoadTemplate(t)}
                className="p-4 rounded-lg border border-gray-200 hover:border-primary-500 hover:bg-primary-50/30 text-left transition-colors"
              >
                <p className="font-medium text-gray-900">{t.name}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {t.nodes.length} nodes, {t.edges.length} edges
                </p>
              </button>
            ))}
          </div>
        )}
      </Modal>

      <Modal
        isOpen={showAddNode}
        onClose={() => setShowAddNode(false)}
        title="Add Node"
        footer={
          <>
            <button onClick={() => setShowAddNode(false)} className="btn-secondary">
              Cancel
            </button>
            <button
              onClick={handleAddNode}
              disabled={!newNodeForm.label || !newNodeForm.module}
              className="btn-primary"
            >
              Add Node
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <FormInput
            label="Label"
            value={newNodeForm.label}
            onChange={(e) => setNewNodeForm({ ...newNodeForm, label: e.target.value })}
            placeholder="e.g. Create Purchase Order"
          />
          <FormInput
            label="Description"
            value={newNodeForm.description}
            onChange={(e) => setNewNodeForm({ ...newNodeForm, description: e.target.value })}
            placeholder="Optional"
          />
          <FormInput
            label="T-Code"
            value={newNodeForm.tcode}
            onChange={(e) => setNewNodeForm({ ...newNodeForm, tcode: e.target.value })}
            placeholder="e.g. ME21N"
          />
          <FormSelect
            label="Module"
            value={newNodeForm.module}
            onChange={(e) => setNewNodeForm({ ...newNodeForm, module: e.target.value })}
            options={[
              { value: "Finance", label: "Finance" },
              { value: "MM", label: "MM" },
              { value: "SD", label: "SD" },
              { value: "PP", label: "PP" },
              { value: "QM", label: "QM" },
              { value: "WM", label: "WM" },
            ]}
          />
        </div>
      </Modal>
    </div>
  );
}
