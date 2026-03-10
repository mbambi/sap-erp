import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  GraduationCap, BookOpen, PlayCircle, CheckCircle2, ChevronRight,
  Clock, Lightbulb, ArrowRight, BarChart3, Star
} from "lucide-react";
import { api } from "../../api/client";
import PageHeader from "../../components/PageHeader";
import Modal from "../../components/Modal";

export default function LearningHub() {
  const queryClient = useQueryClient();
  const [activeExercise, setActiveExercise] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"exercises" | "scenarios">("exercises");

  const { data: exercises = [] } = useQuery({
    queryKey: ["exercises"],
    queryFn: () => api.get("/learning/exercises"),
  });

  const { data: scenarios = [] } = useQuery({
    queryKey: ["scenarios"],
    queryFn: () => api.get("/learning/scenarios"),
  });

  const updateProgress = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.post(`/learning/exercises/${id}/progress`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["exercises"] }),
  });

  const completedCount = exercises.filter((e: any) => e.progress?.status === "completed").length;
  const inProgressCount = exercises.filter((e: any) => e.progress?.status === "in_progress").length;

  const difficultyColor = (d: string) =>
    d === "beginner" ? "badge-green" : d === "intermediate" ? "badge-yellow" : "badge-red";

  const moduleColor = (m: string) => {
    const colors: Record<string, string> = {
      finance: "bg-blue-50 text-blue-600",
      materials: "bg-emerald-50 text-emerald-600",
      sales: "bg-purple-50 text-purple-600",
      production: "bg-amber-50 text-amber-600",
      hr: "bg-red-50 text-red-600",
      warehouse: "bg-cyan-50 text-cyan-600",
    };
    return colors[m] || "bg-gray-50 text-gray-600";
  };

  return (
    <div>
      <PageHeader
        title="Learning Hub"
        subtitle="Practice ERP concepts with guided exercises and real-world scenarios"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-50">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{completedCount}</p>
            <p className="text-sm text-gray-500">Completed</p>
          </div>
        </div>
        <div className="card p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-50">
            <PlayCircle className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{inProgressCount}</p>
            <p className="text-sm text-gray-500">In Progress</p>
          </div>
        </div>
        <div className="card p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-purple-50">
            <BookOpen className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{exercises.length}</p>
            <p className="text-sm text-gray-500">Total Exercises</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab("exercises")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "exercises"
              ? "bg-primary-600 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          <BookOpen className="w-4 h-4 inline mr-1.5" />
          Guided Exercises
        </button>
        <button
          onClick={() => setActiveTab("scenarios")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "scenarios"
              ? "bg-primary-600 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          <PlayCircle className="w-4 h-4 inline mr-1.5" />
          Process Scenarios
        </button>
      </div>

      {activeTab === "exercises" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {exercises.map((ex: any) => (
            <div key={ex.id} className="card overflow-hidden hover:shadow-md transition-shadow">
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <span className={`badge ${difficultyColor(ex.difficulty)}`}>{ex.difficulty}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${moduleColor(ex.module)}`}>
                    {ex.module}
                  </span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{ex.title}</h3>
                <p className="text-sm text-gray-500 mb-3 line-clamp-2">{ex.description}</p>

                <div className="flex items-center gap-4 text-xs text-gray-400 mb-4">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {ex.estimatedMinutes} min
                  </span>
                  <span className="flex items-center gap-1">
                    <BarChart3 className="w-3 h-3" /> {ex.steps?.length || 0} steps
                  </span>
                </div>

                {ex.progress?.status === "completed" ? (
                  <div className="flex items-center gap-2 text-sm text-emerald-600">
                    <CheckCircle2 className="w-4 h-4" /> Completed
                  </div>
                ) : ex.progress?.status === "in_progress" ? (
                  <div>
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>Step {ex.progress.currentStep + 1} of {ex.steps?.length}</span>
                      <span>{Math.round(((ex.progress.currentStep + 1) / (ex.steps?.length || 1)) * 100)}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-500 rounded-full transition-all"
                        style={{ width: `${((ex.progress.currentStep + 1) / (ex.steps?.length || 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                ) : null}
              </div>

              <button
                onClick={() => setActiveExercise(ex)}
                className="w-full px-5 py-3 border-t text-sm font-medium text-primary-600 hover:bg-primary-50 transition-colors flex items-center justify-center gap-1"
              >
                {ex.progress?.status === "completed" ? "Review" : ex.progress?.status === "in_progress" ? "Continue" : "Start Exercise"}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {activeTab === "scenarios" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {scenarios.map((sc: any) => (
            <div key={sc.id} className="card p-5">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-primary-50 to-primary-100 flex-shrink-0">
                  <PlayCircle className="w-6 h-6 text-primary-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">{sc.name}</h3>
                  <p className="text-sm text-gray-500 mb-3">{sc.description}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(sc.steps || []).map((step: any, i: number) => (
                      <span key={i} className="inline-flex items-center gap-1 text-xs bg-gray-100 px-2 py-0.5 rounded-full">
                        <span className="w-4 h-4 rounded-full bg-primary-100 text-primary-600 text-[10px] flex items-center justify-center font-medium">{i + 1}</span>
                        {step.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {scenarios.length === 0 && (
            <div className="col-span-2 card p-12 text-center text-gray-400">
              No scenarios available yet. Ask your instructor to create some!
            </div>
          )}
        </div>
      )}

      <Modal
        isOpen={!!activeExercise}
        onClose={() => setActiveExercise(null)}
        title={activeExercise?.title || "Exercise"}
        size="lg"
      >
        {activeExercise && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">{activeExercise.description}</p>

            <div className="space-y-3">
              {(activeExercise.steps || []).map((step: any, idx: number) => {
                const currentStep = activeExercise.progress?.currentStep || 0;
                const isCompleted = idx < currentStep;
                const isCurrent = idx === currentStep;
                const isLocked = idx > currentStep && activeExercise.progress?.status !== "completed";

                return (
                  <div
                    key={idx}
                    className={`p-4 rounded-lg border-2 transition-colors ${
                      isCompleted ? "border-emerald-200 bg-emerald-50" :
                      isCurrent ? "border-primary-300 bg-primary-50" :
                      "border-gray-100 bg-gray-50"
                    } ${isLocked ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        isCompleted ? "bg-emerald-500 text-white" :
                        isCurrent ? "bg-primary-500 text-white" :
                        "bg-gray-200 text-gray-500"
                      }`}>
                        {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold">{step.title}</h4>
                        <p className="text-sm text-gray-600 mt-0.5">{step.instruction}</p>
                        {step.hint && isCurrent && (
                          <div className="mt-2 flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 p-2 rounded">
                            <Lightbulb className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                            <span>{step.hint}</span>
                          </div>
                        )}
                        {isCurrent && activeExercise.progress?.status !== "completed" && (
                          <button
                            onClick={() => {
                              const newStep = currentStep + 1;
                              const totalSteps = activeExercise.steps.length;
                              updateProgress.mutate({
                                id: activeExercise.id,
                                data: {
                                  currentStep: newStep,
                                  status: newStep >= totalSteps ? "completed" : "in_progress",
                                },
                              });
                              setActiveExercise({
                                ...activeExercise,
                                progress: {
                                  ...activeExercise.progress,
                                  currentStep: newStep,
                                  status: newStep >= totalSteps ? "completed" : "in_progress",
                                },
                              });
                            }}
                            className="btn-primary btn-sm mt-3"
                          >
                            Mark Complete <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {activeExercise.progress?.status === "completed" && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-center">
                <Star className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="font-semibold text-emerald-800">Exercise Completed!</p>
                <p className="text-sm text-emerald-600">Great job! You've finished all steps.</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
