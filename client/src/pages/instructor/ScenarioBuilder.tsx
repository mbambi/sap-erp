import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, Zap, Truck, Factory, TrendingUp, ShieldAlert,
  Play, Clock, Target, Settings2, Layers, ChevronRight, Check,
} from "lucide-react";
import { api } from "../../api/client";
import PageHeader from "../../components/PageHeader";

interface ScenarioDef {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  category: string;
  effects: string[];
  difficulty: "easy" | "medium" | "hard";
}

const SCENARIOS: ScenarioDef[] = [
  {
    id: "demand_spike", name: "Demand Spike", description: "Sudden 200% increase in customer demand for key products",
    icon: TrendingUp, color: "text-green-600 bg-green-50 border-green-200", category: "Market",
    effects: ["Sales orders triple for 2 weeks", "Inventory shortages likely", "Students must run MRP & expedite production"],
    difficulty: "medium",
  },
  {
    id: "supplier_delay", name: "Supplier Delay", description: "Primary supplier delays all deliveries by 3 weeks",
    icon: Truck, color: "text-amber-600 bg-amber-50 border-amber-200", category: "Supply Chain",
    effects: ["All pending POs delayed", "Safety stock gets consumed", "Students must find alternative suppliers"],
    difficulty: "medium",
  },
  {
    id: "machine_failure", name: "Machine Failure", description: "Critical production line equipment fails unexpectedly",
    icon: Factory, color: "text-red-600 bg-red-50 border-red-200", category: "Production",
    effects: ["Production capacity drops 50%", "Work orders pile up", "Students must reschedule production"],
    difficulty: "hard",
  },
  {
    id: "quality_recall", name: "Quality Recall", description: "Batch of finished goods fails quality inspection",
    icon: ShieldAlert, color: "text-purple-600 bg-purple-50 border-purple-200", category: "Quality",
    effects: ["Finished goods quarantined", "Customer complaints increase", "Students must process non-conformances"],
    difficulty: "hard",
  },
  {
    id: "price_increase", name: "Raw Material Price Surge", description: "Key raw materials increase in price by 40%",
    icon: AlertTriangle, color: "text-orange-600 bg-orange-50 border-orange-200", category: "Market",
    effects: ["Purchase costs increase significantly", "Margins compress", "Students must renegotiate or find alternatives"],
    difficulty: "easy",
  },
  {
    id: "new_regulation", name: "New Compliance Regulation", description: "New regulation requires additional quality checks on all products",
    icon: Layers, color: "text-indigo-600 bg-indigo-50 border-indigo-200", category: "Compliance",
    effects: ["Additional inspection lots required", "Production lead time increases", "Students must update processes"],
    difficulty: "medium",
  },
];

export default function ScenarioBuilder() {
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [activeScenarios, setActiveScenarios] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const triggerScenario = useMutation({
    mutationFn: async (scenarioId: string) => {
      const scenario = SCENARIOS.find((s) => s.id === scenarioId)!;
      
      const actions: Promise<any>[] = [];

      switch (scenarioId) {
        case "demand_spike":
          // Create surge of sales orders
          for (let i = 0; i < 5; i++) {
            actions.push(
              api.post("/notifications", {
                type: "crisis",
                title: `CRISIS: ${scenario.name}`,
                message: `${scenario.description}. Take corrective action immediately.`,
                module: "sales",
              }).catch(() => {})
            );
          }
          break;

        case "supplier_delay":
          actions.push(
            api.post("/notifications", {
              type: "crisis",
              title: `CRISIS: ${scenario.name}`,
              message: scenario.description,
              module: "materials",
            }).catch(() => {})
          );
          break;

        default:
          actions.push(
            api.post("/notifications", {
              type: "crisis",
              title: `CRISIS: ${scenario.name}`,
              message: scenario.description,
              module: "general",
            }).catch(() => {})
          );
      }

      await Promise.all(actions);
      return scenarioId;
    },
    onSuccess: (scenarioId) => {
      setActiveScenarios([...activeScenarios, scenarioId]);
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const selected = SCENARIOS.find((s) => s.id === selectedScenario);

  return (
    <div className="space-y-6">
      <PageHeader title="Scenario Builder" subtitle="Inject realistic business crises for students to resolve" />

      {/* Active Scenarios Banner */}
      {activeScenarios.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-red-800 mb-2 flex items-center gap-2">
            <Zap className="w-4 h-4" /> Active Scenarios ({activeScenarios.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {activeScenarios.map((id) => {
              const s = SCENARIOS.find((x) => x.id === id)!;
              return (
                <span key={id} className="inline-flex items-center gap-1.5 text-xs font-medium bg-red-100 text-red-700 px-2.5 py-1 rounded-full">
                  <s.icon className="w-3 h-3" /> {s.name}
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scenario list */}
        <div className="lg:col-span-2 space-y-3">
          {SCENARIOS.map((scenario) => {
            const isActive = activeScenarios.includes(scenario.id);
            return (
              <button key={scenario.id} onClick={() => setSelectedScenario(scenario.id)}
                className={`w-full text-left p-5 rounded-xl border-2 transition-all ${
                  selectedScenario === scenario.id ? "border-primary-500 bg-primary-50 shadow-md" :
                  isActive ? "border-red-300 bg-red-50" :
                  "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
                }`}>
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl border flex items-center justify-center flex-shrink-0 ${scenario.color}`}>
                    <scenario.icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-bold text-gray-900">{scenario.name}</h3>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                        scenario.difficulty === "easy" ? "bg-green-100 text-green-700" :
                        scenario.difficulty === "medium" ? "bg-amber-100 text-amber-700" :
                        "bg-red-100 text-red-700"
                      }`}>{scenario.difficulty}</span>
                      <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{scenario.category}</span>
                      {isActive && (
                        <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-full animate-pulse">ACTIVE</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600">{scenario.description}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 mt-1" />
                </div>
              </button>
            );
          })}
        </div>

        {/* Detail panel */}
        <div className="lg:col-span-1">
          {selected ? (
            <div className="bg-white rounded-xl border sticky top-4">
              <div className={`p-5 rounded-t-xl border-b ${selected.color}`}>
                <selected.icon className="w-8 h-8 mb-2" />
                <h3 className="text-lg font-bold">{selected.name}</h3>
                <p className="text-sm opacity-80 mt-1">{selected.description}</p>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Effects on ERP System</h4>
                  <ul className="space-y-2">
                    {selected.effects.map((effect, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                        {effect}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Learning Objectives</h4>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">Problem Solving</span>
                    <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">Decision Making</span>
                    <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">ERP Navigation</span>
                    <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">Process Execution</span>
                  </div>
                </div>

                <button
                  onClick={() => triggerScenario.mutate(selected.id)}
                  disabled={activeScenarios.includes(selected.id) || triggerScenario.isPending}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                    activeScenarios.includes(selected.id)
                      ? "bg-green-100 text-green-700 cursor-default"
                      : "bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-600/20"
                  }`}>
                  {activeScenarios.includes(selected.id) ? (
                    <><Check className="w-4 h-4" /> Scenario Active</>
                  ) : (
                    <><Zap className="w-4 h-4" /> Inject Crisis</>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-8 text-center">
              <Target className="w-8 h-8 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Select a scenario to view details and inject it</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
