import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Clock,
  User,
  ChevronLeft,
  PlayCircle,
  CheckCircle2,
  Circle,
  Plus,
  ToggleLeft,
  ToggleRight,
  GraduationCap,
} from "lucide-react";
import { api } from "../api/client";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import { useAuthStore } from "../stores/auth";

type View = "catalog" | "detail";

interface Course {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  instructor?: string | null;
  difficulty: string;
  estimatedHours: number;
  isPublished: boolean;
  lessonCount: number;
}

interface Lesson {
  id: string;
  lessonNumber: number;
  title: string;
  description?: string | null;
  content: string;
  modulesUsed?: string | null;
  objectives?: string | null;
  estimatedMinutes: number;
  progress?: { status: string; score?: number } | null;
}

const difficultyColor = (d: string) =>
  d === "beginner" ? "badge-green" : d === "intermediate" ? "badge-yellow" : "badge-red";

const moduleColor = (m: string) => {
  const colors: Record<string, string> = {
    Finance: "bg-blue-100 text-blue-800",
    MM: "bg-emerald-100 text-emerald-800",
    SD: "bg-purple-100 text-purple-800",
    PP: "bg-amber-100 text-amber-800",
    FI: "bg-blue-100 text-blue-800",
  };
  return colors[m] || "bg-gray-100 text-gray-700";
};

function renderRichContent(content: string) {
  try {
    const parsed = JSON.parse(content || "{}");
    if (Array.isArray(parsed)) {
      return parsed.map((block: any, i: number) => {
        if (block.type === "paragraph") {
          return <p key={i} className="mb-2">{block.text || block.content}</p>;
        }
        if (block.type === "list") {
          return (
            <ul key={i} className="list-disc list-inside mb-2 space-y-1">
              {(block.items || []).map((item: string, j: number) => (
                <li key={j}>{item}</li>
              ))}
            </ul>
          );
        }
        return <p key={i} className="mb-2">{JSON.stringify(block)}</p>;
      });
    }
    if (typeof parsed === "object" && parsed.blocks) {
      return parsed.blocks.map((b: any, i: number) => (
        <p key={i} className="mb-2">{b.text || b.content || ""}</p>
      ));
    }
    return <p>{typeof parsed === "string" ? parsed : JSON.stringify(parsed)}</p>;
  } catch {
    return <p className="whitespace-pre-wrap">{content || "No content"}</p>;
  }
}

export default function Courses() {
  const queryClient = useQueryClient();
  const { user, hasRole } = useAuthStore();
  const isAdminOrInstructor = hasRole("admin") || hasRole("instructor");

  const [view, setView] = useState<View>("catalog");
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [showCreateCourse, setShowCreateCourse] = useState(false);
  const [showAddLesson, setShowAddLesson] = useState(false);
  const [courseForm, setCourseForm] = useState({
    code: "",
    title: "",
    description: "",
    instructor: "",
    difficulty: "beginner",
    estimatedHours: 10,
  });
  const [lessonForm, setLessonForm] = useState({
    lessonNumber: 0,
    title: "",
    content: "{}",
    modulesUsed: [] as string[],
    estimatedMinutes: 30,
  });

  const { data: coursesRes } = useQuery({
    queryKey: ["courses"],
    queryFn: () => api.get<{ data: Course[] }>("/courses"),
  });
  const courses = coursesRes?.data ?? [];

  const { data: myProgressRes } = useQuery({
    queryKey: ["courses", "my-progress"],
    queryFn: () => api.get<{ data: { lessonId: string; status: string; lesson: { courseId: string } }[] }>("/courses/my-progress"),
  });
  const myProgress = myProgressRes?.data ?? [];

  const { data: courseDetail } = useQuery({
    queryKey: ["courses", selectedCourseId],
    queryFn: () => api.get<Course & { lessons: Lesson[] }>(`/courses/${selectedCourseId}`),
    enabled: !!selectedCourseId && view === "detail",
  });

  const { data: studentsRes } = useQuery({
    queryKey: ["courses", selectedCourseId, "students"],
    queryFn: () => api.get<{ data: { userId: string; progress: { status: string; score?: number }[] }[] }>(`/courses/${selectedCourseId}/students`),
    enabled: !!selectedCourseId && view === "detail" && isAdminOrInstructor,
  });

  const { data: usersRes } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => api.get<{ id: string; firstName: string; lastName: string }[]>("/admin/users"),
    enabled: isAdminOrInstructor && !!studentsRes?.data?.length,
  });
  const usersList = Array.isArray(usersRes) ? usersRes : (usersRes as { data?: { id: string; firstName: string; lastName: string }[] })?.data ?? [];
  const userMap = new Map(usersList.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));

  const createCourse = useMutation({
    mutationFn: (data: typeof courseForm) => api.post("/courses", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      setShowCreateCourse(false);
      setCourseForm({ code: "", title: "", description: "", instructor: "", difficulty: "beginner", estimatedHours: 10 });
    },
  });

  const publishCourse = useMutation({
    mutationFn: (id: string) => api.post(`/courses/${id}/publish`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["courses"] }),
  });

  const addLesson = useMutation({
    mutationFn: (data: typeof lessonForm) =>
      api.post(`/courses/${selectedCourseId}/lessons`, {
        ...data,
        modulesUsed: data.modulesUsed.length ? data.modulesUsed : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses", selectedCourseId] });
      setShowAddLesson(false);
      setLessonForm({ lessonNumber: 0, title: "", content: "{}", modulesUsed: [], estimatedMinutes: 30 });
    },
  });

  const completeLesson = useMutation({
    mutationFn: ({ courseId, lessonId }: { courseId: string; lessonId: string }) =>
      api.post(`/courses/${courseId}/lessons/${lessonId}/complete`, {}),
    onSuccess: (_, { courseId }) => {
      queryClient.invalidateQueries({ queryKey: ["courses", courseId] });
      queryClient.invalidateQueries({ queryKey: ["courses", "my-progress"] });
      setActiveLesson((prev) => (prev ? { ...prev, progress: { status: "completed" } } : null));
    },
  });

  const getProgressForCourse = (courseId: string) => {
    const completed = myProgress.filter(
      (p) => p.lesson?.courseId === courseId && p.status === "completed"
    ).length;
    const course = courses.find((c) => c.id === courseId);
    const total = course?.lessonCount ?? 0;
    return { completed, total, pct: total ? (completed / total) * 100 : 0 };
  };

  const openCourse = (course: Course) => {
    setSelectedCourseId(course.id);
    setView("detail");
  };

  const backToCatalog = () => {
    setView("catalog");
    setSelectedCourseId(null);
    setActiveLesson(null);
  };

  const getLessonStatus = (lesson: Lesson) => {
    const p = lesson.progress;
    if (!p) return "not_started";
    return p.status;
  };

  return (
    <div>
      <PageHeader
        title="Course Catalog"
        subtitle="Browse and complete SAP ERP courses"
        breadcrumb={view === "detail" ? [{ label: "Courses", path: "/courses" }, { label: courseDetail?.title ?? "" }] : undefined}
      >
        {view === "catalog" && (
          <div className="flex items-center gap-2">
            {isAdminOrInstructor && (
              <button
                onClick={() => setShowCreateCourse(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Create Course
              </button>
            )}
          </div>
        )}
        {view === "detail" && (
          <button
            onClick={backToCatalog}
            className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900"
          >
            <ChevronLeft className="w-4 h-4" /> Back to Catalog
          </button>
        )}
      </PageHeader>

      {view === "catalog" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {courses.map((course) => {
            const { completed, total, pct } = getProgressForCourse(course.id);
            return (
              <div
                key={course.id}
                onClick={() => openCourse(course)}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 cursor-pointer hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-2">
                  <span className={`badge ${difficultyColor(course.difficulty)}`}>{course.difficulty}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${course.isPublished ? "badge-green" : "badge-gray"}`}>
                    {course.isPublished ? "Published" : "Draft"}
                  </span>
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{course.title}</h3>
                {course.instructor && (
                  <p className="text-sm text-gray-500 flex items-center gap-1 mb-2">
                    <User className="w-3.5 h-3.5" /> {course.instructor}
                  </p>
                )}
                <div className="flex items-center gap-4 text-xs text-gray-400 mb-3">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {course.estimatedHours} hrs
                  </span>
                  <span>{course.lessonCount} lessons</span>
                </div>
                <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">{completed} of {total} completed</p>
              </div>
            );
          })}
        </div>
      )}

      {view === "detail" && courseDetail && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{courseDetail.title}</h2>
                {courseDetail.description && (
                  <p className="text-gray-600 dark:text-gray-300 mt-1">{courseDetail.description}</p>
                )}
                <div className="flex flex-wrap gap-2 mt-3">
                  {courseDetail.instructor && (
                    <span className="text-sm text-gray-500 flex items-center gap-1">
                      <User className="w-3.5 h-3.5" /> {courseDetail.instructor}
                    </span>
                  )}
                  <span className={`badge ${difficultyColor(courseDetail.difficulty)}`}>{courseDetail.difficulty}</span>
                  <span className="text-sm text-gray-500 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> {courseDetail.estimatedHours} hrs
                  </span>
                </div>
              </div>
              {isAdminOrInstructor && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowAddLesson(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Add Lesson
                  </button>
                  {!courseDetail.isPublished && (
                    <button
                      onClick={() => publishCourse.mutate(courseDetail.id)}
                      disabled={publishCourse.isPending}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-4 py-2"
                    >
                      Publish
                    </button>
                  )}
                  {courseDetail.isPublished && (
                    <span className="flex items-center gap-1 text-emerald-600">
                      <ToggleRight className="w-5 h-5" /> Published
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="border-l-2 border-gray-200 dark:border-gray-600 pl-6 space-y-4 mt-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Learning Path</h3>
              {(courseDetail.lessons ?? []).map((lesson) => {
                const status = getLessonStatus(lesson);
                const isCompleted = status === "completed";
                const isInProgress = status === "in_progress";
                const bubbleClass = isCompleted
                  ? "bg-emerald-500 text-white"
                  : isInProgress
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300";
                const objectives = (() => {
                  try {
                    const o = JSON.parse(lesson.objectives || "[]");
                    return Array.isArray(o) ? o.slice(0, 2) : [];
                  } catch {
                    return [];
                  }
                })();
                return (
                  <div key={lesson.id} className="relative flex gap-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${bubbleClass}`}>
                      {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : lesson.lessonNumber}
                    </div>
                    <div className="flex-1 pb-4">
                      <h4 className="font-medium text-gray-900 dark:text-white">{lesson.title}</h4>
                      <p className="text-xs text-gray-500 mt-0.5">{lesson.estimatedMinutes} min</p>
                      {objectives.length > 0 && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {objectives.join(" • ")}
                        </p>
                      )}
                      <button
                        onClick={() => setActiveLesson(lesson)}
                        className="mt-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-3 py-1.5 text-sm"
                      >
                        {isCompleted ? "Review" : isInProgress ? "Continue" : "Start"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Progress: {courseDetail.lessons?.filter((l) => l.progress?.status === "completed").length ?? 0} of {courseDetail.lessons?.length ?? 0} lessons completed
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Total score: {courseDetail.lessons
                  ?.filter((l) => l.progress?.score != null)
                  .reduce((s, l) => s + (l.progress?.score ?? 0), 0) ?? 0}
              </p>
            </div>

            {isAdminOrInstructor && studentsRes?.data && (
              <div className="mt-6">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Student Progress</h3>
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-600">
                      <th className="py-2 font-medium">Student</th>
                      <th className="py-2 font-medium">Lessons Completed</th>
                      <th className="py-2 font-medium">Avg Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentsRes.data.map(({ userId, progress }) => {
                      const completed = progress.filter((p) => p.status === "completed").length;
                      const scores = progress.filter((p) => p.score != null).map((p) => p.score!);
                      const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
                      return (
                        <tr key={userId} className="border-b border-gray-100 dark:border-gray-700">
                          <td className="py-2">{userMap.get(userId) ?? userId.slice(0, 8)}</td>
                          <td className="py-2">{completed}</td>
                          <td className="py-2">{avg.toFixed(1)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <Modal
        isOpen={!!activeLesson}
        onClose={() => setActiveLesson(null)}
        title={activeLesson?.title ?? "Lesson"}
        size="lg"
        footer={
          activeLesson && activeLesson.progress?.status !== "completed" && (
            <button
              onClick={() =>
                completeLesson.mutate({
                  courseId: selectedCourseId!,
                  lessonId: activeLesson.id,
                })
              }
              disabled={completeLesson.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2"
            >
              Mark Complete
            </button>
          )
        }
      >
        {activeLesson && (
          <div className="space-y-4">
            {activeLesson.modulesUsed && (() => {
              try {
                const mods = JSON.parse(activeLesson.modulesUsed);
                return Array.isArray(mods) && mods.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {mods.map((m: string) => (
                      <span key={m} className={`text-xs px-2 py-0.5 rounded-full ${moduleColor(m)}`}>
                        {m}
                      </span>
                    ))}
                  </div>
                ) : null;
              } catch {
                return null;
              }
            })()}
            <div className="prose prose-sm max-w-none dark:prose-invert">
              {renderRichContent(activeLesson.content)}
            </div>
            {activeLesson.objectives && (() => {
              try {
                const obj = JSON.parse(activeLesson.objectives);
                return Array.isArray(obj) && obj.length > 0 ? (
                  <div className="mt-4">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-2">Learning Objectives</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
                      {obj.map((o: string, i: number) => (
                        <li key={i}>{o}</li>
                      ))}
                    </ul>
                  </div>
                ) : null;
              } catch {
                return null;
              }
            })()}
          </div>
        )}
      </Modal>

      <Modal
        isOpen={showCreateCourse}
        onClose={() => setShowCreateCourse(false)}
        title="Create Course"
        footer={
          <button
            onClick={() => createCourse.mutate(courseForm)}
            disabled={createCourse.isPending || !courseForm.code || !courseForm.title}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2"
          >
            Create
          </button>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Code</label>
            <input
              className="input"
              value={courseForm.code}
              onChange={(e) => setCourseForm((f) => ({ ...f, code: e.target.value }))}
              placeholder="COURSE-001"
            />
          </div>
          <div>
            <label className="label">Title</label>
            <input
              className="input"
              value={courseForm.title}
              onChange={(e) => setCourseForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Course title"
            />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              className="input min-h-[80px]"
              value={courseForm.description}
              onChange={(e) => setCourseForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Course description"
            />
          </div>
          <div>
            <label className="label">Instructor</label>
            <input
              className="input"
              value={courseForm.instructor}
              onChange={(e) => setCourseForm((f) => ({ ...f, instructor: e.target.value }))}
              placeholder="Instructor name"
            />
          </div>
          <div>
            <label className="label">Difficulty</label>
            <select
              className="input"
              value={courseForm.difficulty}
              onChange={(e) => setCourseForm((f) => ({ ...f, difficulty: e.target.value }))}
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
          <div>
            <label className="label">Estimated Hours</label>
            <input
              type="number"
              className="input"
              value={courseForm.estimatedHours}
              onChange={(e) => setCourseForm((f) => ({ ...f, estimatedHours: +e.target.value }))}
              min={1}
            />
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showAddLesson}
        onClose={() => setShowAddLesson(false)}
        title="Add Lesson"
        footer={
          <button
            onClick={() => addLesson.mutate(lessonForm)}
            disabled={addLesson.isPending || !lessonForm.title}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2"
          >
            Add Lesson
          </button>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Lesson Number</label>
            <input
              type="number"
              className="input"
              value={lessonForm.lessonNumber || ""}
              onChange={(e) => setLessonForm((f) => ({ ...f, lessonNumber: +e.target.value || 0 }))}
              placeholder="Auto"
            />
          </div>
          <div>
            <label className="label">Title</label>
            <input
              className="input"
              value={lessonForm.title}
              onChange={(e) => setLessonForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Lesson title"
            />
          </div>
          <div>
            <label className="label">Content (JSON)</label>
            <textarea
              className="input font-mono text-sm min-h-[120px]"
              value={lessonForm.content}
              onChange={(e) => setLessonForm((f) => ({ ...f, content: e.target.value }))}
              placeholder='[{"type":"paragraph","text":"..."}]'
            />
          </div>
          <div>
            <label className="label">Modules Used (comma-separated)</label>
            <input
              className="input"
              value={lessonForm.modulesUsed.join(", ")}
              onChange={(e) =>
                setLessonForm((f) => ({
                  ...f,
                  modulesUsed: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                }))
              }
              placeholder="Finance, MM, SD"
            />
          </div>
          <div>
            <label className="label">Estimated Minutes</label>
            <input
              type="number"
              className="input"
              value={lessonForm.estimatedMinutes}
              onChange={(e) => setLessonForm((f) => ({ ...f, estimatedMinutes: +e.target.value }))}
              min={1}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
