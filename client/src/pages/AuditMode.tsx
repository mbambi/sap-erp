import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Shield, AlertTriangle, FileCheck, Search, Loader2 } from "lucide-react";
import { api } from "../api/client";
import PageHeader from "../components/PageHeader";
import { FormInput, FormSelect } from "../components/FormField";

const ENTITY_TYPES = [
  { value: "purchase_order", label: "Purchase Order" },
  { value: "sales_order", label: "Sales Order" },
  { value: "journal_entry", label: "Journal Entry" },
  { value: "material", label: "Material" },
  { value: "vendor", label: "Vendor" },
  { value: "customer", label: "Customer" },
  { value: "invoice", label: "Invoice" },
  { value: "delivery", label: "Delivery" },
];

interface AuditTrailEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName?: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

interface Anomaly {
  id: string;
  severity: "critical" | "warning" | "info";
  type: string;
  description: string;
  relatedEntity?: string;
  relatedEntityType?: string;
  timestamp: string;
}

interface ComplianceData {
  segregationViolations: number;
  segregationList?: { id: string; description: string }[];
  pendingApprovals: number;
  unsignedTransactions: number;
  overdueReviews: number;
  overallScore: number;
}

interface FinancialTraceStep {
  documentType: string;
  documentNumber: string;
  amount?: number;
  date?: string;
}

export default function AuditMode() {
  const [activeTab, setActiveTab] = useState<"trail" | "anomalies" | "compliance" | "trace">("trail");
  const [trailEntityType, setTrailEntityType] = useState("purchase_order");
  const [trailEntityId, setTrailEntityId] = useState("");
  const [journalId, setJournalId] = useState("");

  const { data: trailData = [], isLoading: trailLoading } = useQuery({
    queryKey: ["audit-trail", trailEntityType, trailEntityId],
    queryFn: () =>
      api.get<AuditTrailEntry[]>(
        `/audit-advanced/trail/${trailEntityType}/${trailEntityId}`
      ),
    enabled: activeTab === "trail" && !!trailEntityId.trim(),
  });

  const { data: anomalies = [], isLoading: anomaliesLoading } = useQuery({
    queryKey: ["audit-anomalies"],
    queryFn: () => api.get<Anomaly[]>("/audit-advanced/anomalies"),
    enabled: activeTab === "anomalies",
  });

  const { data: compliance, isLoading: complianceLoading } = useQuery({
    queryKey: ["audit-compliance"],
    queryFn: () => api.get<ComplianceData>("/audit-advanced/compliance"),
    enabled: activeTab === "compliance",
  });

  const { data: traceData = [], isLoading: traceLoading } = useQuery({
    queryKey: ["audit-trace", journalId],
    queryFn: () =>
      api.get<FinancialTraceStep[]>(`/audit-advanced/financial-trace/${journalId}`),
    enabled: activeTab === "trace" && !!journalId.trim(),
  });

  const SEVERITY_STYLES: Record<string, string> = {
    critical: "badge-red",
    warning: "badge-yellow",
    info: "badge-blue",
  };

  return (
    <div>
      <PageHeader
        title="Audit Mode"
        subtitle="Advanced audit and compliance dashboard"
      />

      <div className="flex border-b mb-6">
        {[
          { id: "trail" as const, label: "Audit Trail", icon: Search },
          { id: "anomalies" as const, label: "Anomalies", icon: AlertTriangle },
          { id: "compliance" as const, label: "Compliance", icon: Shield },
          { id: "trace" as const, label: "Financial Trace", icon: FileCheck },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.id
                ? "border-primary-600 text-primary-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Audit Trail tab */}
      {activeTab === "trail" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <FormSelect
              label="Entity Type"
              value={trailEntityType}
              onChange={(e) => setTrailEntityType(e.target.value)}
              options={ENTITY_TYPES}
            />
            <FormInput
              label="Entity ID"
              value={trailEntityId}
              onChange={(e) => setTrailEntityId(e.target.value)}
              placeholder="e.g. PO-0001"
            />
          </div>
          <div className="card overflow-hidden">
            <h3 className="px-4 py-3 border-b font-semibold">Timeline</h3>
            <div className="divide-y max-h-[500px] overflow-y-auto">
              {trailLoading ? (
                <div className="p-8 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                </div>
              ) : trailData.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  {trailEntityId ? "No changes found for this entity." : "Enter an entity ID to view the audit trail."}
                </div>
              ) : (
                trailData.map((entry) => (
                  <div key={entry.id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-primary-500 mt-1.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{entry.userName ?? entry.userId}</span>
                          <span className="text-xs text-gray-500">
                            {new Date(entry.timestamp).toLocaleString()}
                          </span>
                          <span className="badge badge-gray">{entry.action}</span>
                        </div>
                        {(entry.before || entry.after) && (
                          <div className="mt-2 text-sm space-y-1">
                            {entry.before && (
                              <p className="text-gray-600">
                                <span className="text-gray-400">Before:</span>{" "}
                                {JSON.stringify(entry.before)}
                              </p>
                            )}
                            {entry.after && (
                              <p className="text-gray-600">
                                <span className="text-gray-400">After:</span>{" "}
                                {JSON.stringify(entry.after)}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Anomalies tab */}
      {activeTab === "anomalies" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
            Sorted by severity
          </div>
          <div className="grid gap-4">
            {anomaliesLoading ? (
              <div className="card p-8 text-center">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
              </div>
            ) : anomalies.length === 0 ? (
              <div className="card p-8 text-center text-gray-400">
                No anomalies detected.
              </div>
            ) : (
              [...anomalies]
                .sort((a, b) => {
                  const order = { critical: 0, warning: 1, info: 2 };
                  return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
                })
                .map((a) => (
                  <div
                    key={a.id}
                    className="card p-4 hover:shadow-md transition-shadow cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      <span className={`badge ${SEVERITY_STYLES[a.severity] ?? "badge-gray"}`}>
                        {a.severity}
                      </span>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{a.type}</p>
                        <p className="text-sm text-gray-600 mt-1">{a.description}</p>
                        {a.relatedEntity && (
                          <p className="text-xs text-gray-500 mt-2">
                            Related: {a.relatedEntityType} {a.relatedEntity}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(a.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      )}

      {/* Compliance tab */}
      {activeTab === "compliance" && (
        <div className="space-y-6">
          {complianceLoading ? (
            <div className="card p-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
            </div>
          ) : compliance ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="card p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Overall Compliance Score
                  </h3>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 h-8 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-600 rounded-full transition-all"
                        style={{ width: `${compliance.overallScore}%` }}
                      />
                    </div>
                    <span className="text-2xl font-bold text-gray-900 w-16 text-right">
                      {compliance.overallScore}%
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="card p-4">
                    <p className="text-sm text-gray-500">Segregation of Duties Violations</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      {compliance.segregationViolations}
                    </p>
                    {compliance.segregationList && compliance.segregationList.length > 0 && (
                      <ul className="mt-2 text-xs text-gray-600 space-y-1">
                        {compliance.segregationList.slice(0, 3).map((s) => (
                          <li key={s.id}>• {s.description}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="card p-4">
                    <p className="text-sm text-gray-500">Pending Approvals</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      {compliance.pendingApprovals}
                    </p>
                  </div>
                  <div className="card p-4">
                    <p className="text-sm text-gray-500">Unsigned Transactions</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      {compliance.unsignedTransactions}
                    </p>
                  </div>
                  <div className="card p-4">
                    <p className="text-sm text-gray-500">Overdue Reviews</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      {compliance.overdueReviews}
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="card p-8 text-center text-gray-400">
              No compliance data available.
            </div>
          )}
        </div>
      )}

      {/* Financial Trace tab */}
      {activeTab === "trace" && (
        <div className="space-y-4">
          <FormInput
            label="Journal Entry ID"
            value={journalId}
            onChange={(e) => setJournalId(e.target.value)}
            placeholder="e.g. JE-0001"
          />
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Trace Visualization</h3>
            {traceLoading ? (
              <div className="py-12 text-center">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
              </div>
            ) : traceData.length === 0 ? (
              <p className="text-gray-400 text-center py-8">
                {journalId ? "No trace found for this journal entry." : "Enter a journal entry ID to trace."}
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                {traceData.map((step, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-semibold">
                      {i + 1}
                    </div>
                    {i > 0 && (
                      <div className="w-8 h-0.5 bg-gray-200 -ml-2" />
                    )}
                    <div className="card p-4 flex-1">
                      <p className="font-medium text-gray-900">{step.documentType}</p>
                      <p className="text-sm text-gray-600">{step.documentNumber}</p>
                      {step.amount != null && (
                        <p className="text-sm text-gray-500">
                          ${step.amount.toLocaleString()}
                        </p>
                      )}
                      {step.date && (
                        <p className="text-xs text-gray-400">
                          {new Date(step.date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    {i < traceData.length - 1 && (
                      <div className="text-gray-300">↓</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
