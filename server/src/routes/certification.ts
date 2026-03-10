import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authenticate, requireRoles } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

const router = Router();
router.use(authenticate);

// GET / - list certifications
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.certification.findMany({
      where: { tenantId: req.user!.tenantId, isActive: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

// POST / - create certification (admin/instructor)
router.post("/", requireRoles("admin", "instructor"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, title, description, modulesCovered, passingScore, timeLimit, tasks } = req.body;
    if (!code || !title) throw new AppError(400, "code and title required");

    const cert = await prisma.certification.create({
      data: {
        tenantId: req.user!.tenantId,
        code,
        title,
        description: description ?? null,
        modulesCovered: modulesCovered ? JSON.stringify(modulesCovered) : "[]",
        passingScore: passingScore ?? 70,
        timeLimit: timeLimit ?? null,
        tasks: tasks ? JSON.stringify(tasks) : "[]",
        isActive: true,
      },
    });
    res.status(201).json(cert);
  } catch (err) {
    next(err);
  }
});

// PUT /:id - update (admin/instructor)
router.put("/:id", requireRoles("admin", "instructor"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const cert = await prisma.certification.findUnique({ where: { id } });
    if (!cert || cert.tenantId !== req.user!.tenantId) throw new AppError(404, "Certification not found");

    const { code, title, description, modulesCovered, passingScore, timeLimit, tasks, isActive } = req.body;
    const updated = await prisma.certification.update({
      where: { id },
      data: {
        ...(code != null && { code }),
        ...(title != null && { title }),
        ...(description != null && { description }),
        ...(modulesCovered != null && { modulesCovered: JSON.stringify(modulesCovered) }),
        ...(passingScore != null && { passingScore }),
        ...(timeLimit != null && { timeLimit }),
        ...(tasks != null && { tasks: JSON.stringify(tasks) }),
        ...(isActive != null && { isActive }),
      },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// GET /:id - get certification detail with user's attempts
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const cert = await prisma.certification.findUnique({
      where: { id },
    });
    if (!cert || cert.tenantId !== req.user!.tenantId) throw new AppError(404, "Certification not found");

    const attempts = await prisma.certificationAttempt.findMany({
      where: { certificationId: cert.id, userId: req.user!.userId },
      orderBy: { startedAt: "desc" },
    });

    res.json({ ...cert, myAttempts: attempts });
  } catch (err) {
    next(err);
  }
});

// POST /:id/start - start attempt
router.post("/:id/start", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const cert = await prisma.certification.findUnique({ where: { id } });
    if (!cert || cert.tenantId !== req.user!.tenantId) throw new AppError(404, "Certification not found");
    if (!cert.isActive) throw new AppError(400, "Certification is not active");

    const existing = await prisma.certificationAttempt.findFirst({
      where: { certificationId: cert.id, userId: req.user!.userId, status: "in_progress" },
    });
    if (existing) throw new AppError(400, "You already have an attempt in progress");

    const attempt = await prisma.certificationAttempt.create({
      data: {
        certificationId: cert.id,
        userId: req.user!.userId,
        status: "in_progress",
      },
    });
    res.status(201).json(attempt);
  } catch (err) {
    next(err);
  }
});

// POST /:id/submit - submit attempt
router.post("/:id/submit", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { taskResults } = req.body;
    const id = req.params.id as string;
    const cert = await prisma.certification.findUnique({ where: { id } });
    if (!cert || cert.tenantId !== req.user!.tenantId) throw new AppError(404, "Certification not found");

    const attempt = await prisma.certificationAttempt.findFirst({
      where: { certificationId: cert.id, userId: req.user!.userId, status: "in_progress" },
    });
    if (!attempt) throw new AppError(400, "No in-progress attempt found");

    const tasks = (typeof cert.tasks === "string" ? JSON.parse(cert.tasks) : cert.tasks) as any[];
    const results = (taskResults || []) as { taskId: string; completed: boolean; evidence?: any }[];
    const completedCount = results.filter((r) => r.completed).length;
    const totalTasks = Math.max(tasks.length, 1);
    const score = (completedCount / totalTasks) * 100;
    const passed = score >= cert.passingScore;

    const startedAt = attempt.startedAt.getTime();
    const timeSpent = Math.floor((Date.now() - startedAt) / 1000);

    const updated = await prisma.certificationAttempt.update({
      where: { id: attempt.id },
      data: {
        status: passed ? "passed" : "failed",
        score,
        completedAt: new Date(),
        taskResults: JSON.stringify(results),
        timeSpent,
      },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// GET /:id/attempts - list attempts (admin/instructor: all, students: own)
router.get("/:id/attempts", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const cert = await prisma.certification.findUnique({ where: { id } });
    if (!cert || cert.tenantId !== req.user!.tenantId) throw new AppError(404, "Certification not found");

    const isAdminOrInstructor = req.user!.roles.some((r) => ["admin", "instructor"].includes(r));
    const where: any = { certificationId: cert.id };
    if (!isAdminOrInstructor) where.userId = req.user!.userId;

    const data = await prisma.certificationAttempt.findMany({
      where,
      orderBy: { startedAt: "desc" },
    });
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

// GET /my-attempts - all my certification attempts
router.get("/my-attempts", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.certificationAttempt.findMany({
      where: { userId: req.user!.userId },
      include: { certification: true },
      orderBy: { startedAt: "desc" },
    });
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

// GET /:id/leaderboard - top scores
router.get("/:id/leaderboard", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const cert = await prisma.certification.findUnique({ where: { id } });
    if (!cert || cert.tenantId !== req.user!.tenantId) throw new AppError(404, "Certification not found");

    const limit = Math.min(50, parseInt(req.query.limit as string) || 10);
    const data = await prisma.certificationAttempt.findMany({
      where: { certificationId: cert.id, status: { in: ["passed", "failed"] } },
      orderBy: [{ score: "desc" }, { timeSpent: "asc" }],
      take: limit,
    });

    res.json({ data });
  } catch (err) {
    next(err);
  }
});

export default router;
