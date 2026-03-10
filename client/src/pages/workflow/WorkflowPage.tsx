import { useQuery } from "@tanstack/react-query";
import { GitBranch, CheckCircle2, Clock, XCircle, AlertCircle } from "lucide-react";
import { api } from "../../api/client";
import PageHeader from "../../components/PageHeader";
import StatusBadge from "../../components/StatusBadge";

export default function WorkflowPage() {
  const { data: tasks = [] } = useQuery({
    queryKey: ["my-tasks"],
    queryFn: () => api.get("/workflow/my-tasks"),
  });

  const { data: instances = [] } = useQuery({
    queryKey: ["workflow-instances"],
    queryFn: () => api.get("/workflow/instances"),
  });

  return (
    <div>
      <PageHeader
        title="Workflow & Approvals"
        subtitle="Manage approval processes and track workflow status"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-50">
            <Clock className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{tasks.length}</p>
            <p className="text-sm text-gray-500">Pending Tasks</p>
          </div>
        </div>
        <div className="card p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-50">
            <GitBranch className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{instances.filter((i: any) => i.status === "active").length}</p>
            <p className="text-sm text-gray-500">Active Workflows</p>
          </div>
        </div>
        <div className="card p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-50">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{instances.filter((i: any) => i.status === "completed").length}</p>
            <p className="text-sm text-gray-500">Completed</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="px-5 py-4 border-b">
            <h3 className="text-sm font-semibold">My Pending Tasks</h3>
          </div>
          <div className="divide-y">
            {tasks.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-300" />
                No pending tasks
              </div>
            ) : (
              tasks.map((task: any) => (
                <div key={task.id} className="px-5 py-3 flex items-center gap-4">
                  <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{task.instance?.definition?.name}</p>
                    <p className="text-xs text-gray-500">Step {task.stepNumber + 1} — {task.action}</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn-success btn-sm">Approve</button>
                    <button className="btn-danger btn-sm">Reject</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card">
          <div className="px-5 py-4 border-b">
            <h3 className="text-sm font-semibold">Workflow Instances</h3>
          </div>
          <div className="divide-y">
            {instances.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">
                No workflow instances yet
              </div>
            ) : (
              instances.slice(0, 10).map((inst: any) => (
                <div key={inst.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{inst.definition?.name}</p>
                    <p className="text-xs text-gray-500">
                      Started {new Date(inst.startedAt).toLocaleDateString()} — Step {inst.currentStep + 1}
                    </p>
                  </div>
                  <StatusBadge status={inst.status} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="card p-5 mt-6">
        <h3 className="text-sm font-semibold mb-3">ERP Process Flows</h3>
        <p className="text-sm text-gray-500 mb-4">
          Visual overview of standard ERP business processes and their approval workflows.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            {
              name: "Procure-to-Pay",
              steps: ["Purchase Requisition", "PO Creation", "PO Approval", "Goods Receipt", "Invoice Verification", "Payment"],
              color: "blue",
            },
            {
              name: "Order-to-Cash",
              steps: ["Sales Inquiry", "Quotation", "Sales Order", "Delivery", "Billing", "Payment Collection"],
              color: "green",
            },
          ].map((flow) => (
            <div key={flow.name} className="border rounded-lg p-4">
              <h4 className="font-medium text-sm mb-3">{flow.name}</h4>
              <div className="flex flex-wrap items-center gap-1">
                {flow.steps.map((step, i) => (
                  <div key={i} className="flex items-center">
                    <span className={`text-xs px-2 py-1 rounded ${
                      flow.color === "blue" ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700"
                    }`}>
                      {step}
                    </span>
                    {i < flow.steps.length - 1 && (
                      <span className="text-gray-300 mx-0.5">→</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
