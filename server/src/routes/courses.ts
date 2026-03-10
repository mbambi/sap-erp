import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authenticate, requireRoles } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

const router = Router();
router.use(authenticate);

// GET / - list courses (published for students, all for admin/instructor)
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const isAdminOrInstructor = req.user!.roles.some((r) => ["admin", "instructor"].includes(r));

    const where: any = { tenantId };
    if (!isAdminOrInstructor) where.isPublished = true;

    const courses = await prisma.course.findMany({
      where,
      include: { _count: { select: { lessons: true } } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });

    const withStats = await Promise.all(
      courses.map(async (c) => {
        const progressCount = await prisma.lessonProgress.count({
          where: { lesson: { courseId: c.id } },
        });
        return {
          ...c,
          lessonCount: c._count.lessons,
          enrollmentStats: { totalProgressRecords: progressCount },
        };
      })
    );

    res.json({ data: withStats });
  } catch (err) {
    next(err);
  }
});

// POST / - create course (admin/instructor)
router.post("/", requireRoles("admin", "instructor"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, title, description, instructor, difficulty, estimatedHours, sortOrder } = req.body;
    if (!code || !title) throw new AppError(400, "code and title required");

    const course = await prisma.course.create({
      data: {
        tenantId: req.user!.tenantId,
        code,
        title,
        description: description ?? null,
        instructor: instructor ?? null,
        difficulty: difficulty ?? "beginner",
        estimatedHours: estimatedHours ?? 10,
        sortOrder: sortOrder ?? 0,
        isPublished: false,
      },
    });
    res.status(201).json(course);
  } catch (err) {
    next(err);
  }
});

// PUT /:id - update course (admin/instructor)
router.put("/:id", requireRoles("admin", "instructor"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const course = await prisma.course.findUnique({ where: { id } });
    if (!course || course.tenantId !== req.user!.tenantId) throw new AppError(404, "Course not found");

    const { code, title, description, instructor, difficulty, estimatedHours, sortOrder } = req.body;
    const updated = await prisma.course.update({
      where: { id },
      data: {
        ...(code != null && { code }),
        ...(title != null && { title }),
        ...(description != null && { description }),
        ...(instructor != null && { instructor }),
        ...(difficulty != null && { difficulty }),
        ...(estimatedHours != null && { estimatedHours }),
        ...(sortOrder != null && { sortOrder }),
      },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// GET /:id - get course with lessons and user progress
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        lessons: { orderBy: { lessonNumber: "asc" } },
      },
    });
    if (!course || course.tenantId !== req.user!.tenantId) throw new AppError(404, "Course not found");

    const progress = await prisma.lessonProgress.findMany({
      where: {
        userId: req.user!.userId,
        lesson: { courseId: course.id },
      },
    });
    const progressMap = Object.fromEntries(progress.map((p) => [p.lessonId, p]));

    const lessonsWithProgress = course.lessons.map((l) => ({
      ...l,
      progress: progressMap[l.id] ?? null,
    }));

    res.json({ ...course, lessons: lessonsWithProgress });
  } catch (err) {
    next(err);
  }
});

// POST /:id/publish - publish course (admin/instructor)
router.post(
  "/:id/publish",
  requireRoles("admin", "instructor"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const course = await prisma.course.findUnique({ where: { id } });
      if (!course || course.tenantId !== req.user!.tenantId) throw new AppError(404, "Course not found");

      const updated = await prisma.course.update({
        where: { id },
        data: { isPublished: true },
      });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

// POST /:courseId/lessons - create lesson (admin/instructor)
router.post(
  "/:courseId/lessons",
  requireRoles("admin", "instructor"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const courseId = req.params.courseId as string;
      const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course || course.tenantId !== req.user!.tenantId) throw new AppError(404, "Course not found");

    const { lessonNumber, title, description, content, modulesUsed, objectives, estimatedMinutes, sortOrder } =
      req.body;
    if (!title) throw new AppError(400, "title required");

    const maxNum = await prisma.lesson.findFirst({
      where: { courseId },
      orderBy: { lessonNumber: "desc" },
      select: { lessonNumber: true },
    });
    const num = lessonNumber ?? (maxNum?.lessonNumber ?? 0) + 1;

    const lesson = await prisma.lesson.create({
      data: {
        courseId,
        lessonNumber: num,
        title,
        description: description ?? null,
        content: content ? JSON.stringify(content) : "{}",
        modulesUsed: modulesUsed ? JSON.stringify(modulesUsed) : null,
        objectives: objectives ? JSON.stringify(objectives) : null,
        estimatedMinutes: estimatedMinutes ?? 30,
        sortOrder: sortOrder ?? 0,
      },
    });
    res.status(201).json(lesson);
  } catch (err) {
    next(err);
  }
});

// PUT /:courseId/lessons/:lessonId - update lesson (admin/instructor)
router.put(
  "/:courseId/lessons/:lessonId",
  requireRoles("admin", "instructor"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const courseId = req.params.courseId as string;
      const lessonId = req.params.lessonId as string;
      const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
      const course = lesson ? await prisma.course.findUnique({ where: { id: lesson.courseId } }) : null;
      if (!lesson || !course || lesson.courseId !== courseId || course.tenantId !== req.user!.tenantId)
        throw new AppError(404, "Lesson not found");

      const { lessonNumber, title, description, content, modulesUsed, objectives, estimatedMinutes, sortOrder } =
        req.body;
      const updated = await prisma.lesson.update({
        where: { id: lessonId },
      data: {
        ...(lessonNumber != null && { lessonNumber }),
        ...(title != null && { title }),
        ...(description != null && { description }),
        ...(content != null && { content: JSON.stringify(content) }),
        ...(modulesUsed != null && { modulesUsed: JSON.stringify(modulesUsed) }),
        ...(objectives != null && { objectives: JSON.stringify(objectives) }),
        ...(estimatedMinutes != null && { estimatedMinutes }),
        ...(sortOrder != null && { sortOrder }),
      },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// GET /:courseId/lessons/:lessonId - get lesson with user progress
router.get("/:courseId/lessons/:lessonId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const courseId = req.params.courseId as string;
    const lessonId = req.params.lessonId as string;
    const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
    const course = lesson ? await prisma.course.findUnique({ where: { id: lesson.courseId } }) : null;
    if (!lesson || !course || lesson.courseId !== courseId || course.tenantId !== req.user!.tenantId)
      throw new AppError(404, "Lesson not found");

    const progress = await prisma.lessonProgress.findUnique({
      where: { lessonId_userId: { lessonId, userId: req.user!.userId } },
    });

    res.json({ ...lesson, progress: progress ?? null });
  } catch (err) {
    next(err);
  }
});

// POST /:courseId/lessons/:lessonId/start - start lesson
router.post("/:courseId/lessons/:lessonId/start", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const courseId = req.params.courseId as string;
    const lessonId = req.params.lessonId as string;
    const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
    const course = lesson ? await prisma.course.findUnique({ where: { id: lesson.courseId } }) : null;
    if (!lesson || !course || lesson.courseId !== courseId || course.tenantId !== req.user!.tenantId)
      throw new AppError(404, "Lesson not found");

    const progress = await prisma.lessonProgress.upsert({
      where: { lessonId_userId: { lessonId, userId: req.user!.userId } },
      create: {
        lessonId,
        userId: req.user!.userId,
        status: "in_progress",
        startedAt: new Date(),
        attempts: 1,
      },
      update: {
        status: "in_progress",
        startedAt: new Date(),
        attempts: { increment: 1 },
      },
    });
    res.json(progress);
  } catch (err) {
    next(err);
  }
});

// POST /:courseId/lessons/:lessonId/complete - complete lesson
router.post("/:courseId/lessons/:lessonId/complete", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const courseId = req.params.courseId as string;
    const lessonId = req.params.lessonId as string;
    const { score } = req.body;
    const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
    const course = lesson ? await prisma.course.findUnique({ where: { id: lesson.courseId } }) : null;
    if (!lesson || !course || lesson.courseId !== courseId || course.tenantId !== req.user!.tenantId)
      throw new AppError(404, "Lesson not found");

    const progress = await prisma.lessonProgress.upsert({
      where: { lessonId_userId: { lessonId, userId: req.user!.userId } },
      create: {
        lessonId,
        userId: req.user!.userId,
        status: "completed",
        score: score ?? null,
        startedAt: new Date(),
        completedAt: new Date(),
        attempts: 1,
      },
      update: {
        status: "completed",
        score: score ?? undefined,
        completedAt: new Date(),
      },
    });
    res.json(progress);
  } catch (err) {
    next(err);
  }
});

// GET /my-progress - all course/lesson progress for current user
router.get("/my-progress", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const progress = await prisma.lessonProgress.findMany({
      where: { userId: req.user!.userId },
      include: { lesson: { include: { course: true } } },
    });
    res.json({ data: progress });
  } catch (err) {
    next(err);
  }
});

// GET /:id/students - students' progress for course (admin/instructor)
router.get(
  "/:id/students",
  requireRoles("admin", "instructor"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const course = await prisma.course.findUnique({ where: { id } });
    if (!course || course.tenantId !== req.user!.tenantId) throw new AppError(404, "Course not found");

    const progress = await prisma.lessonProgress.findMany({
      where: { lesson: { courseId: course.id } },
      include: { lesson: true },
    });

    const byUser = new Map<string, any[]>();
    for (const p of progress) {
      const list = byUser.get(p.userId) || [];
      list.push(p);
      byUser.set(p.userId, list);
    }

    res.json({
      data: Array.from(byUser.entries()).map(([userId, records]) => ({
        userId,
        progress: records,
      })),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
