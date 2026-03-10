import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, BookOpen, CheckCircle2, Clock, Users, Trash2, ChevronDown,
  ChevronRight, GripVertical, Award, AlertCircle, FileText, Send,
} from "lucide-react";
import { api } from "../../api/client";
import PageHeader from "../../components/PageHeader";

const MODULES = [
  "finance", "materials", "sales", "production", "warehouse",
  "quality", "maintenance", "hr", "controlling", "mrp",
];

const DIFFICULTIES = ["beginner", "intermediate", "advanced"];

interface StepDef {
  instruction: string;
  entityType: string;
  action: string;
  validationField: string;
  validationValue: string;
  points: number;
}

function CreateAssignment({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [module, setModule] = useState("finance");
  const [difficulty, setDifficulty] = useState("beginner");
  const [estimatedMinutes, setEstimatedMinutes] = useState(30);
  const [steps, setSteps] = useState<StepDef[]>([
    { instruction: "", entityType: "", action: "create", validationField: "", validationValue: "", points: 10 },
  ]);
  const [hints, setHints] = useState<string[]>([""]);

  const create = useMutation({
    mutationFn: (data: any) => api.post("/assignments", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["assignments"] }); onClose(); },
  });

  const addStep = () => setSteps([...steps, { instruction: "", entityType: "", action: "create", validationField: "", validationValue: "", points: 10 }]);
  const removeStep = (i: number) => setSteps(steps.filter((_, idx) => idx !== i));
  const updateStep = (i: number, field: string, value: any) => {
    const updated = [...steps];
    (updated[i] as any)[field] = value;
    setSteps(updated);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-lg">
      <div className="px-6 py-4 border-b flex items-center justify-between bg-gray-50 rounded-t-xl">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <Plus className="w-5 h-5 text-primary-600" /> Create Assignment
        </h3>
        <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700">&times;</button>
      </div>
      <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="input" placeholder="e.g., Procurement Cycle Practice" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Module</label>
              <select value={module} onChange={(e) => setModule(e.target.value)} className="input">
                {MODULES.map((m) => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="input">
                {DIFFICULTIES.map((d) => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Time (min)</label>
              <input type="number" value={estimatedMinutes} onChange={(e) => setEstimatedMinutes(+e.target.value)} className="input" />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input" rows={3}
            placeholder="Describe the learning objective of this assignment..." />
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-semibold text-gray-900">Steps</label>
            <button onClick={addStep} className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
              <Plus className="w-3 h-3" /> Add Step
            </button>
          </div>
          <div className="space-y-3">
            {steps.map((step, i) => (
              <div key={i} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center gap-2 mb-3">
                  <GripVertical className="w-4 h-4 text-gray-400" />
                  <span className="text-xs font-bold text-gray-500">STEP {i + 1}</span>
                  {steps.length > 1 && (
                    <button onClick={() => removeStep(i)} className="ml-auto text-red-400 hover:text-red-600">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <input value={step.instruction} onChange={(e) => updateStep(i, "instruction", e.target.value)}
                  className="input mb-2" placeholder="e.g., Create a Purchase Requisition for 100 units of Steel" />
                <div className="grid grid-cols-3 gap-2">
                  <input value={step.entityType} onChange={(e) => updateStep(i, "entityType", e.target.value)}
                    className="input text-xs" placeholder="Entity (e.g., PurchaseOrder)" />
                  <select value={step.action} onChange={(e) => updateStep(i, "action", e.target.value)} className="input text-xs">
                    <option value="create">Create</option>
                    <option value="update">Update</option>
                    <option value="complete">Complete</option>
                    <option value="approve">Approve</option>
                    <option value="post">Post</option>
                  </select>
                  <input type="number" value={step.points} onChange={(e) => updateStep(i, "points", +e.target.value)}
                    className="input text-xs" placeholder="Points" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">Hints (optional)</label>
            <button onClick={() => setHints([...hints, ""])} className="text-xs text-primary-600">+ Add Hint</button>
          </div>
          {hints.map((h, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <input value={h} onChange={(e) => { const u = [...hints]; u[i] = e.target.value; setHints(u); }}
                className="input text-sm" placeholder={`Hint ${i + 1}`} />
              {hints.length > 1 && (
                <button onClick={() => setHints(hints.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="px-6 py-4 border-t bg-gray-50 rounded-b-xl flex justify-end gap-3">
        <button onClick={onClose} className="btn-secondary text-sm">Cancel</button>
        <button onClick={() => create.mutate({ title, description, module, difficulty, estimatedMinutes, steps, hints: hints.filter(Boolean) })}
          disabled={!title || !description || steps.every((s) => !s.instruction)}
          className="btn-primary text-sm flex items-center gap-2">
          <Send className="w-4 h-4" /> Create Assignment
        </button>
      </div>
    </div>
  );
}

export default function AssignmentBuilder() {
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["assignments"],
    queryFn: () => api.get("/assignments"),
  });

  const { data: submissions } = useQuery({
    queryKey: ["assignment-submissions", expandedId],
    queryFn: () => api.get(`/assignments/${expandedId}/submissions`),
    enabled: !!expandedId,
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Assignment Builder" subtitle="Create exercises and auto-grade student submissions">
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Assignment
        </button>
      </PageHeader>

      {showCreate && <CreateAssignment onClose={() => setShowCreate(false)} />}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center"><BookOpen className="w-5 h-5 text-blue-600" /></div>
          <div><p className="text-xl font-bold text-gray-900">{assignments.length}</p><p className="text-xs text-gray-500">Assignments</p></div>
        </div>
        <div className="bg-white rounded-xl border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center"><CheckCircle2 className="w-5 h-5 text-green-600" /></div>
          <div><p className="text-xl font-bold text-gray-900">{assignments.reduce((sum: number, a: any) => sum + (a.stats?.completed || 0), 0)}</p><p className="text-xs text-gray-500">Completions</p></div>
        </div>
        <div className="bg-white rounded-xl border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center"><Clock className="w-5 h-5 text-amber-600" /></div>
          <div><p className="text-xl font-bold text-gray-900">{assignments.reduce((sum: number, a: any) => sum + (a.stats?.in_progress || 0), 0)}</p><p className="text-xs text-gray-500">In Progress</p></div>
        </div>
        <div className="bg-white rounded-xl border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center"><Award className="w-5 h-5 text-purple-600" /></div>
          <div><p className="text-xl font-bold text-gray-900">{assignments.length > 0 ? Math.round(assignments.reduce((sum: number, a: any) => sum + (a.stats?.completed || 0), 0) / Math.max(1, assignments.reduce((sum: number, a: any) => sum + Object.values(a.stats || {}).reduce((s: number, v: any) => s + v, 0), 0)) * 100) : 0}%</p><p className="text-xs text-gray-500">Completion Rate</p></div>
        </div>
      </div>

      {/* Assignment List */}
      <div className="bg-white rounded-xl border">
        <div className="px-5 py-4 border-b">
          <h3 className="text-sm font-semibold text-gray-900">All Assignments</h3>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : assignments.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No assignments yet. Create your first one!</p>
          </div>
        ) : (
          <div className="divide-y">
            {assignments.map((a: any) => (
              <div key={a.id}>
                <button onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
                  className="w-full px-5 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors text-left">
                  {expandedId === a.id ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 truncate">{a.title}</p>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                        a.difficulty === "beginner" ? "bg-green-50 text-green-700" :
                        a.difficulty === "intermediate" ? "bg-amber-50 text-amber-700" :
                        "bg-red-50 text-red-700"
                      }`}>{a.difficulty}</span>
                      <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{a.module}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{a.description}</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />{a.stats?.completed || 0}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{a.stats?.in_progress || 0}</span>
                    <span>{a.steps?.length || 0} steps</span>
                  </div>
                </button>

                {expandedId === a.id && submissions && (
                  <div className="px-5 pb-4 bg-gray-50">
                    <div className="bg-white rounded-lg border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Student</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Progress</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Score</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Time</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {(submissions.submissions || []).map((s: any) => (
                            <tr key={s.userId} className="hover:bg-gray-50">
                              <td className="px-4 py-2 text-gray-900 font-medium">{s.studentName}</td>
                              <td className="px-4 py-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-20 h-1.5 bg-gray-200 rounded-full">
                                    <div className="h-full bg-primary-500 rounded-full" style={{ width: `${(s.currentStep / s.totalSteps) * 100}%` }} />
                                  </div>
                                  <span className="text-xs text-gray-500">{s.currentStep}/{s.totalSteps}</span>
                                </div>
                              </td>
                              <td className="px-4 py-2 font-medium">{s.percentage}%</td>
                              <td className="px-4 py-2 text-gray-500">{s.timeSpent ? `${s.timeSpent} min` : "—"}</td>
                              <td className="px-4 py-2">
                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                                  s.status === "completed" ? "bg-green-50 text-green-700" :
                                  s.status === "in_progress" ? "bg-blue-50 text-blue-700" :
                                  "bg-gray-100 text-gray-600"
                                }`}>{s.status}</span>
                              </td>
                            </tr>
                          ))}
                          {(!submissions.submissions || submissions.submissions.length === 0) && (
                            <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">No submissions yet</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
