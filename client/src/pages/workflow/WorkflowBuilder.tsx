import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Play,
  Square,
  Diamond,
  Circle,
  GitBranch,
  Link2,
  Save,
  Trash2,
} from "lucide-react";
import { api } from "../../api/client";
import PageHeader from "../../components/PageHeader";

type NodeType = "start" | "approval" | "condition" | "action" | "end";

interface Node {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  name: string;
  condition?: string;
  approverRole?: string;
}

interface Link {
  id: string;
  from: string;
  to: string;
  label?: string;
}

const NODE_TYPES: { type: NodeType; label: string; icon: React.ElementType }[] = [
  { type: "start", label: "Start", icon: Play },
  { type: "approval", label: "Approval", icon: Square },
  { type: "condition", label: "Condition", icon: Diamond },
  { type: "action", label: "Action", icon: GitBranch },
  { type: "end", label: "End", icon: Circle },
];

let nodeId = 1;
let linkId = 1;

function generateId(prefix: string) {
  return `${prefix}-${Date.now()}-${++nodeId}`;
}

function generateLinkId() {
  return `link-${Date.now()}-${++linkId}`;
}

export default function WorkflowBuilder() {
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [connectMode, setConnectMode] = useState(false);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);

  const addNode = (type: NodeType) => {
    const x = 100 + nodes.length * 80;
    const y = 150 + (nodes.length % 3) * 60;
    const name =
      type === "start"
        ? "Start"
        : type === "end"
        ? "End"
        : type === "condition"
        ? "Condition"
        : type === "approval"
        ? "Approval"
        : "Action";
    setNodes((prev) => [
      ...prev,
      {
        id: generateId("node"),
        type,
        x,
        y,
        name,
        ...(type === "condition" && { condition: "amount > 10000?" }),
        ...(type === "approval" && { approverRole: "manager" }),
      },
    ]);
  };

  const updateNode = (id: string, updates: Partial<Node>) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, ...updates } : n))
    );
  };

  const deleteNode = (id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setLinks((prev) => prev.filter((l) => l.from !== id && l.to !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);

  const handleNodeMouseDown = (e: React.MouseEvent, id: string) => {
    if (connectMode) {
      if (connectFrom) {
        if (connectFrom !== id) {
          setLinks((prev) => [
            ...prev,
            { id: generateLinkId(), from: connectFrom, to: id },
          ]);
        }
        setConnectFrom(null);
        setConnectMode(false);
      } else {
        setConnectFrom(id);
      }
      return;
    }
    e.stopPropagation();
    const node = nodes.find((n) => n.id === id);
    if (!node) return;
    dragRef.current = { id, offsetX: e.clientX - node.x, offsetY: e.clientY - node.y };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const { id, offsetX, offsetY } = dragRef.current;
      setNodes((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, x: e.clientX - offsetX, y: e.clientY - offsetY } : n
        )
      );
    };
    const handleMouseUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const saveMutation = useMutation({
    mutationFn: (data: { name: string; steps: any }) =>
      api.post("/workflow/definitions", {
        name: data.name,
        module: "materials",
        triggerEvent: "po_created",
        description: "Workflow from builder",
        steps: JSON.stringify(data.steps),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workflow"] }),
  });

  const saveWorkflow = () => {
    const steps = nodes
      .filter((n) => n.type !== "start" && n.type !== "end")
      .map((n, i) => ({
        type: n.type,
        name: n.name,
        condition: n.condition,
        approverRole: n.approverRole,
        assigneeId: null,
      }));
    saveMutation.mutate({
      name: "PO Approval",
      steps: { nodes, links, steps },
    });
  };

  const loadExample = () => {
    const exNodes: Node[] = [
      { id: "n1", type: "start", x: 80, y: 150, name: "Start" },
      {
        id: "n2",
        type: "condition",
        x: 220,
        y: 150,
        name: "Amount > 10000?",
        condition: "amount > 10000",
      },
      { id: "n3", type: "approval", x: 380, y: 80, name: "Manager Approval", approverRole: "manager" },
      { id: "n4", type: "approval", x: 380, y: 220, name: "Finance Approval", approverRole: "finance" },
      { id: "n5", type: "action", x: 520, y: 150, name: "Auto-Approve" },
      { id: "n6", type: "end", x: 660, y: 80, name: "End" },
      { id: "n7", type: "end", x: 660, y: 220, name: "End" },
    ];
    const exLinks: Link[] = [
      { id: "l1", from: "n1", to: "n2" },
      { id: "l2", from: "n2", to: "n3", label: "Yes" },
      { id: "l3", from: "n2", to: "n5", label: "No" },
      { id: "l4", from: "n3", to: "n4" },
      { id: "l5", from: "n4", to: "n6" },
      { id: "l6", from: "n5", to: "n7" },
    ];
    setNodes(exNodes);
    setLinks(exLinks);
    setSelectedId(null);
  };

  const selected = nodes.find((n) => n.id === selectedId);

  const getNodePos = (id: string) => nodes.find((n) => n.id === id);
  const nodeStyle = (n: Node) => {
    const base = "absolute cursor-move select-none";
    if (n.type === "start")
      return `${base} w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center`;
    if (n.type === "end")
      return `${base} w-10 h-10 rounded-full bg-red-500 flex items-center justify-center`;
    if (n.type === "condition")
      return `${base} w-20 h-20 bg-amber-400 transform rotate-45 flex items-center justify-center`;
    return `${base} px-3 py-2 rounded-lg min-w-[80px] text-center text-sm`;
  };
  const nodeBg = (n: Node) => {
    if (n.type === "approval") return "bg-blue-500 text-white";
    if (n.type === "action") return "bg-gray-500 text-white";
    return "";
  };

  return (
    <div>
      <PageHeader
        title="Workflow Builder"
        subtitle="Design approval workflows visually"
      />

      <div className="flex gap-2 mb-4">
        {NODE_TYPES.map(({ type, label, icon: Icon }) => (
          <button
            key={type}
            onClick={() => addNode(type)}
            className="btn-secondary flex items-center gap-1.5 text-sm"
          >
            <Icon className="w-3.5 h-3.5" />+ {label}
          </button>
        ))}
        <button
          onClick={() => setConnectMode(!connectMode)}
          className={`btn ${connectMode ? "btn-primary" : "btn-secondary"} flex items-center gap-1.5 text-sm`}
        >
          <Link2 className="w-3.5 h-3.5" />
          Connect
        </button>
        <button onClick={loadExample} className="btn-secondary text-sm">
          Load PO Approval Example
        </button>
        <button
          onClick={saveWorkflow}
          disabled={nodes.length === 0}
          className="btn-primary flex items-center gap-1.5 ml-auto"
        >
          <Save className="w-4 h-4" />
          Save Workflow
        </button>
      </div>

      <div className="flex gap-6">
        <div
          ref={canvasRef}
          className="flex-1 card overflow-hidden relative min-h-[400px] bg-gray-50"
          onClick={() => setSelectedId(null)}
        >
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {links.map((l) => {
              const from = getNodePos(l.from);
              const to = getNodePos(l.to);
              if (!from || !to) return null;
              const fx = from.x + (from.type === "start" || from.type === "end" ? 20 : 40);
              const fy = from.y + (from.type === "start" || from.type === "end" ? 20 : 20);
              const tx = to.x + (to.type === "start" || to.type === "end" ? 20 : 40);
              const ty = to.y + (to.type === "start" || to.type === "end" ? 20 : 20);
              const mx = (fx + tx) / 2;
              return (
                <g key={l.id}>
                  <path
                    d={`M ${fx} ${fy} C ${mx} ${fy}, ${mx} ${ty}, ${tx} ${ty}`}
                    fill="none"
                    stroke="#94a3b8"
                    strokeWidth="2"
                  />
                </g>
              );
            })}
          </svg>
          {nodes.map((n) => (
            <div
              key={n.id}
              className={`${nodeStyle(n)} ${nodeBg(n)} ${
                n.type !== "start" && n.type !== "end" ? "border-2" : ""
              } ${selectedId === n.id ? "border-primary-500 ring-2 ring-primary-200" : "border-transparent"}`}
              style={{
                left: n.x,
                top: n.y,
                transform: n.type === "condition" ? "rotate(-45deg)" : undefined,
              }}
              onMouseDown={(e) => handleNodeMouseDown(e, n.id)}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedId(n.id);
              }}
            >
              {n.type === "start" && <Play className="w-5 h-5 text-white" />}
              {n.type === "end" && <Circle className="w-5 h-5 text-white fill-white" />}
              {(n.type === "condition" || n.type === "approval" || n.type === "action") && (
                <span className="text-xs font-medium truncate max-w-[70px] block">
                  {n.name}
                </span>
              )}
            </div>
          ))}
        </div>

        {selected && (
          <div className="w-72 card p-4 shrink-0">
            <h4 className="font-semibold text-gray-900 mb-3">Node Properties</h4>
            <div className="space-y-3">
              <div>
                <label className="label">Name</label>
                <input
                  value={selected.name}
                  onChange={(e) => updateNode(selected.id, { name: e.target.value })}
                  className="input"
                />
              </div>
              {selected.type === "condition" && (
                <div>
                  <label className="label">Condition</label>
                  <input
                    value={selected.condition ?? ""}
                    onChange={(e) => updateNode(selected.id, { condition: e.target.value })}
                    className="input"
                    placeholder="amount > 10000?"
                  />
                </div>
              )}
              {selected.type === "approval" && (
                <div>
                  <label className="label">Approver Role</label>
                  <input
                    value={selected.approverRole ?? ""}
                    onChange={(e) => updateNode(selected.id, { approverRole: e.target.value })}
                    className="input"
                    placeholder="manager"
                  />
                </div>
              )}
              <button
                onClick={() => deleteNode(selected.id)}
                className="btn-danger btn-sm flex items-center gap-1 w-full justify-center"
              >
                <Trash2 className="w-3 h-3" />
                Delete Node
              </button>
            </div>
          </div>
        )}
      </div>

      {saveMutation.isSuccess && (
        <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm">
          Workflow saved successfully.
        </div>
      )}
      {saveMutation.isError && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          {String(saveMutation.error)}
        </div>
      )}
    </div>
  );
}
