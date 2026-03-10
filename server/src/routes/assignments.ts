import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authenticate, requireRoles } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

const router = Router();
router.use(authenticate);

// ─── Assignment CRUD (Instructor) ────────────────────────────────────

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const exercises = await prisma.exercise.findMany({
      where: { tenantId },
      orderBy: { sortOrder: "asc" },
    });

    const enriched = await Promise.all(
      exercises.map(async (ex) => {
        const progressCounts = await prisma.exerciseProgress.groupBy({
          by: ["status"],
          where: { exerciseId: ex.id },
          _count: true,
        });
        return {
          ...ex,
          steps: JSON.parse(ex.steps || "[]"),
          hints: ex.hints ? JSON.parse(ex.hints) : [],
          solution: ex.solution ? JSON.parse(ex.solution) : null,
          stats: Object.fromEntries(progressCounts.map((p) => [p.status, p._count])),
        };
      })
    );

    res.json(enriched);
  } catch (err) {
    next(err);
  }
});

router.post(
  "/",
  requireRoles("admin", "instructor"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;
      const { title, description, module, difficulty, steps, hints, estimatedMinutes, validationRules } = req.body;

      if (!title || !description || !module || !steps) {
        throw new AppError(400, "title, description, module, and steps are required");
      }

      const stepsArray = Array.isArray(steps) ? steps : JSON.parse(steps);

      // Enhance steps with validation rules
      const enhancedSteps = stepsArray.map((step: any, idx: number) => ({
        stepNumber: idx + 1,
        instruction: step.instruction || step,
        entityType: step.entityType || null,
        action: step.action || "create",
        validationField: step.validationField || null,
        validationValue: step.validationValue || null,
        points: step.points || 10,
      }));

      const exercise = await prisma.exercise.create({
        data: {
          tenantId,
          title,
          description,
          module,
          difficulty: difficulty || "beginner",
          steps: JSON.stringify(enhancedSteps),
          hints: hints ? JSON.stringify(hints) : null,
          solution: validationRules ? JSON.stringify(validationRules) : null,
          estimatedMinutes: estimatedMinutes || 30,
          sortOrder: 0,
        },
      });

      res.status(201).json({
        ...exercise,
        steps: enhancedSteps,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── Student Assignment Interaction ──────────────────────────────────

router.post("/:id/start", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const exerciseId = req.params.id;

    const exercise = await prisma.exercise.findUnique({
      where: { id: exerciseId },
    });
    if (!exercise || exercise.tenantId !== req.user!.tenantId) {
      throw new AppError(404, "Assignment not found");
    }

    const progress = await prisma.exerciseProgress.upsert({
      where: { exerciseId_userId: { exerciseId, userId } },
      update: {
        status: "in_progress",
        startedAt: new Date(),
        currentStep: 0,
      },
      create: {
        exerciseId,
        userId,
        status: "in_progress",
        currentStep: 0,
        startedAt: new Date(),
      },
    });

    res.json({
      progress,
      exercise: {
        ...exercise,
        steps: JSON.parse(exercise.steps || "[]"),
        hints: exercise.hints ? JSON.parse(exercise.hints) : [],
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/check-step", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const tenantId = req.user!.tenantId;
    const exerciseId = req.params.id;
    const { stepNumber } = req.body;

    const exercise = await prisma.exercise.findUnique({ where: { id: exerciseId } });
    if (!exercise || exercise.tenantId !== tenantId) {
      throw new AppError(404, "Assignment not found");
    }

    const steps = JSON.parse(exercise.steps || "[]");
    const step = steps.find((s: any) => s.stepNumber === stepNumber);
    if (!step) throw new AppError(400, "Invalid step number");

    // Auto-check: verify the entity was created/modified by checking audit log
    let passed = false;
    let feedback = "";

    if (step.entityType && step.action) {
      const recentAction = await prisma.auditLog.findFirst({
        where: {
          tenantId,
          userId,
          module: exercise.module,
          action: { contains: step.action },
          createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) },
        },
        orderBy: { createdAt: "desc" },
      });

      if (recentAction) {
        passed = true;
        feedback = `Step ${stepNumber} completed: ${step.instruction}`;
      } else {
        feedback = `Step ${stepNumber} not yet completed. Please perform the required action: ${step.instruction}`;
      }
    } else {
      // Manual check - trust the student's self-report
      passed = true;
      feedback = `Step ${stepNumber} marked as complete`;
    }

    const totalSteps = steps.length;
    const newStep = passed ? Math.min(stepNumber, totalSteps) : stepNumber - 1;
    const allDone = passed && stepNumber >= totalSteps;

    // Calculate score
    const pointsEarned = passed ? (step.points || 10) : 0;

    const progress = await prisma.exerciseProgress.upsert({
      where: { exerciseId_userId: { exerciseId, userId } },
      update: {
        currentStep: newStep,
        status: allDone ? "completed" : "in_progress",
        ...(allDone && { completedAt: new Date() }),
        score: { increment: pointsEarned },
      },
      create: {
        exerciseId,
        userId,
        currentStep: newStep,
        status: allDone ? "completed" : "in_progress",
        startedAt: new Date(),
        ...(allDone && { completedAt: new Date() }),
        score: pointsEarned,
      },
    });

    // Award XP on completion
    if (allDone) {
      await prisma.userXP.upsert({
        where: { userId_tenantId: { userId, tenantId } },
        update: { totalXP: { increment: 50 } },
        create: { userId, tenantId, totalXP: 50 },
      });

      await prisma.notification.create({
        data: {
          tenantId,
          userId,
          type: "achievement",
          title: "Assignment Completed!",
          message: `You completed "${exercise.title}" and earned 50 XP`,
          module: exercise.module,
          link: "/learning/analytics",
        },
      });
    }

    res.json({ passed, feedback, progress, pointsEarned, allDone });
  } catch (err) {
    next(err);
  }
});

// ─── Instructor Grading Dashboard ────────────────────────────────────

router.get(
  "/:id/submissions",
  requireRoles("admin", "instructor"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;
      const exerciseId = req.params.id;

      const exercise = await prisma.exercise.findUnique({ where: { id: exerciseId } });
      if (!exercise || exercise.tenantId !== tenantId) {
        throw new AppError(404, "Assignment not found");
      }

      const submissions = await prisma.exerciseProgress.findMany({
        where: { exerciseId },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
        orderBy: { completedAt: "desc" },
      });

      const steps = JSON.parse(exercise.steps || "[]");
      const totalPoints = steps.reduce((sum: number, s: any) => sum + (s.points || 10), 0);

      res.json({
        exercise: { ...exercise, steps, totalPoints },
        submissions: submissions.map((s) => ({
          userId: s.user.id,
          studentName: `${s.user.firstName} ${s.user.lastName}`,
          email: s.user.email,
          status: s.status,
          currentStep: s.currentStep,
          totalSteps: steps.length,
          score: s.score,
          maxScore: totalPoints,
          percentage: totalPoints > 0 ? Math.round(((s.score || 0) / totalPoints) * 100) : 0,
          startedAt: s.startedAt,
          completedAt: s.completedAt,
          timeSpent: s.startedAt && s.completedAt
            ? Math.round((new Date(s.completedAt).getTime() - new Date(s.startedAt).getTime()) / 60000)
            : null,
        })),
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
