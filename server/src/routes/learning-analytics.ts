import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authenticate } from "../middleware/auth";

const router = Router();
router.use(authenticate);

router.get("/my-progress", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const userId = req.user!.userId;

    const [exerciseProgress, lessonProgress, certAttempts, xp] = await Promise.all([
      prisma.exerciseProgress.findMany({
        where: { userId },
        include: { exercise: { select: { title: true, module: true, difficulty: true, estimatedMinutes: true } } },
        orderBy: { completedAt: "desc" },
      }),
      prisma.lessonProgress.findMany({
        where: { userId },
        include: { lesson: { select: { title: true, courseId: true, estimatedMinutes: true } } },
      }),
      prisma.certificationAttempt.findMany({
        where: { userId },
        include: { certification: { select: { title: true, passingScore: true } } },
        orderBy: { startedAt: "desc" },
      }),
      prisma.userXP.findUnique({
        where: { userId_tenantId: { userId, tenantId } },
      }),
    ]);

    // Module proficiency
    const moduleStats: Record<string, { completed: number; total: number; totalScore: number }> = {};
    for (const ep of exerciseProgress) {
      const mod = ep.exercise.module;
      if (!moduleStats[mod]) moduleStats[mod] = { completed: 0, total: 0, totalScore: 0 };
      moduleStats[mod].total++;
      if (ep.status === "completed") {
        moduleStats[mod].completed++;
        moduleStats[mod].totalScore += ep.score ?? 0;
      }
    }

    const proficiency = Object.entries(moduleStats).map(([module, stats]) => ({
      module,
      completed: stats.completed,
      total: stats.total,
      percentage: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
      avgScore: stats.completed > 0 ? Math.round(stats.totalScore / stats.completed) : 0,
    }));

    // Time tracking
    const totalTimeMinutes = exerciseProgress
      .filter((ep) => ep.status === "completed" && ep.exercise?.estimatedMinutes)
      .reduce((sum, ep) => sum + (ep.exercise.estimatedMinutes || 0), 0);

    // Transactions count (from audit logs)
    const transactionCount = await prisma.auditLog.count({
      where: { tenantId, userId },
    });

    // Activity by day (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentLogs = await prisma.auditLog.findMany({
      where: { tenantId, userId, createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
    });

    const activityByDay: Record<string, number> = {};
    for (const log of recentLogs) {
      const day = log.createdAt.toISOString().split("T")[0];
      activityByDay[day] = (activityByDay[day] || 0) + 1;
    }

    res.json({
      proficiency,
      xp: {
        totalXP: xp?.totalXP ?? 0,
        level: xp?.level ?? 1,
        streak: xp?.streak ?? 0,
      },
      stats: {
        exercisesCompleted: exerciseProgress.filter((ep) => ep.status === "completed").length,
        exercisesTotal: exerciseProgress.length,
        lessonsCompleted: lessonProgress.filter((lp) => lp.status === "completed").length,
        lessonsTotal: lessonProgress.length,
        certificationsPassed: certAttempts.filter((ca) => ca.status === "passed").length,
        certificationsAttempted: certAttempts.length,
        totalTimeMinutes,
        transactionCount,
      },
      activityByDay,
      recentExercises: exerciseProgress.slice(0, 10).map((ep) => ({
        id: ep.id,
        exerciseTitle: ep.exercise.title,
        module: ep.exercise.module,
        status: ep.status,
        score: ep.score,
        completedAt: ep.completedAt,
      })),
      certifications: certAttempts.map((ca) => ({
        id: ca.id,
        certTitle: ca.certification.title,
        status: ca.status,
        score: ca.score,
        passingScore: ca.certification.passingScore,
        startedAt: ca.startedAt,
        completedAt: ca.completedAt,
      })),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
