import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authenticate, requireRoles } from "../middleware/auth";

const router = Router();
router.use(authenticate);
router.use(requireRoles("admin", "instructor"));

router.get("/class-overview", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;

    const [totalStudents, activeStudents, totalExercises, totalCourses] = await Promise.all([
      prisma.user.count({
        where: {
          tenantId,
          userRoles: { some: { role: { name: "student" } } },
        },
      }),
      prisma.user.count({
        where: {
          tenantId,
          userRoles: { some: { role: { name: "student" } } },
          lastLogin: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.exercise.count({ where: { tenantId } }),
      prisma.course.count({ where: { tenantId } }),
    ]);

    const exerciseProgress = await prisma.exerciseProgress.groupBy({
      by: ["status"],
      where: { exercise: { tenantId } },
      _count: true,
    });

    const recentActivity = await prisma.auditLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
    });

    res.json({
      totalStudents,
      activeStudents,
      totalExercises,
      totalCourses,
      exerciseProgress: Object.fromEntries(
        exerciseProgress.map((p) => [p.status, p._count])
      ),
      recentActivity: recentActivity.map((a) => ({
        id: a.id,
        action: a.action,
        module: a.module,
        resource: a.resource,
        user: a.user ? `${a.user.firstName} ${a.user.lastName}` : "System",
        timestamp: a.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.get("/module-mastery", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;

    const modules = [
      "finance", "materials", "sales", "production", "warehouse",
      "quality", "maintenance", "hr", "mrp", "controlling",
    ];

    const mastery: Record<string, { completed: number; total: number; percentage: number }> = {};

    for (const mod of modules) {
      const [total, completed] = await Promise.all([
        prisma.exerciseProgress.count({
          where: { exercise: { tenantId, module: mod } },
        }),
        prisma.exerciseProgress.count({
          where: { exercise: { tenantId, module: mod }, status: "completed" },
        }),
      ]);

      mastery[mod] = {
        completed,
        total: total || 1,
        percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    }

    res.json(mastery);
  } catch (err) {
    next(err);
  }
});

router.get("/student-progress", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;

    const students = await prisma.user.findMany({
      where: {
        tenantId,
        userRoles: { some: { role: { name: "student" } } },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        lastLogin: true,
        createdAt: true,
      },
      orderBy: { lastName: "asc" },
    });

    const studentIds = students.map((s) => s.id);

    const xpData = await prisma.userXP.findMany({
      where: { tenantId, userId: { in: studentIds } },
    });
    const xpMap = Object.fromEntries(xpData.map((x) => [x.userId, x]));

    const progressData = await prisma.exerciseProgress.findMany({
      where: { userId: { in: studentIds } },
      select: { userId: true, status: true },
    });

    const progressMap: Record<string, { completed: number; inProgress: number; total: number }> = {};
    for (const p of progressData) {
      if (!progressMap[p.userId]) {
        progressMap[p.userId] = { completed: 0, inProgress: 0, total: 0 };
      }
      progressMap[p.userId].total++;
      if (p.status === "completed") progressMap[p.userId].completed++;
      if (p.status === "in_progress") progressMap[p.userId].inProgress++;
    }

    const auditCounts = await prisma.auditLog.groupBy({
      by: ["userId"],
      where: { tenantId, userId: { in: studentIds } },
      _count: true,
    });
    const auditMap = Object.fromEntries(
      auditCounts.map((a) => [a.userId!, a._count])
    );

    res.json(
      students.map((s) => ({
        ...s,
        xp: xpMap[s.id]?.totalXP ?? 0,
        level: xpMap[s.id]?.level ?? 1,
        streak: xpMap[s.id]?.streak ?? 0,
        exercises: progressMap[s.id] ?? { completed: 0, inProgress: 0, total: 0 },
        transactions: auditMap[s.id] ?? 0,
      }))
    );
  } catch (err) {
    next(err);
  }
});

router.get("/activity-timeline", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const days = parseInt(req.query.days as string) || 30;

    const since = new Date();
    since.setDate(since.getDate() - days);

    const logs = await prisma.auditLog.findMany({
      where: { tenantId, createdAt: { gte: since } },
      select: { createdAt: true, module: true },
    });

    const timeline: Record<string, Record<string, number>> = {};
    for (const log of logs) {
      const day = log.createdAt.toISOString().split("T")[0];
      if (!timeline[day]) timeline[day] = {};
      timeline[day][log.module] = (timeline[day][log.module] || 0) + 1;
    }

    res.json(timeline);
  } catch (err) {
    next(err);
  }
});

export default router;
