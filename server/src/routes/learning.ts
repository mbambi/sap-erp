import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authenticate } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

const router = Router();
router.use(authenticate);

// Exercises
router.get("/exercises", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const exercises = await prisma.exercise.findMany({
      where: { tenantId: req.user!.tenantId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    const progress = await prisma.exerciseProgress.findMany({
      where: { userId: req.user!.userId },
    });

    const withProgress = exercises.map((ex) => {
      const p = progress.find((pr) => pr.exerciseId === ex.id);
      return {
        ...ex,
        steps: JSON.parse(ex.steps),
        hints: ex.hints ? JSON.parse(ex.hints) : [],
        progress: p
          ? { currentStep: p.currentStep, status: p.status, score: p.score }
          : { currentStep: 0, status: "not_started", score: null },
      };
    });

    res.json(withProgress);
  } catch (err) {
    next(err);
  }
});

router.get("/exercises/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ex = await prisma.exercise.findUnique({ where: { id: req.params.id } });
    if (!ex || ex.tenantId !== req.user!.tenantId) throw new AppError(404, "Exercise not found");

    const progress = await prisma.exerciseProgress.findUnique({
      where: { exerciseId_userId: { exerciseId: ex.id, userId: req.user!.userId } },
    });

    res.json({
      ...ex,
      steps: JSON.parse(ex.steps),
      hints: ex.hints ? JSON.parse(ex.hints) : [],
      solution: null, // Don't expose solution
      progress: progress || { currentStep: 0, status: "not_started" },
    });
  } catch (err) {
    next(err);
  }
});

// Update progress
router.post("/exercises/:id/progress", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ex = await prisma.exercise.findUnique({ where: { id: req.params.id } });
    if (!ex || ex.tenantId !== req.user!.tenantId) throw new AppError(404, "Exercise not found");

    const { currentStep, status, answers } = req.body;
    const steps = JSON.parse(ex.steps);
    const isComplete = status === "completed" || currentStep >= steps.length;

    const progress = await prisma.exerciseProgress.upsert({
      where: {
        exerciseId_userId: { exerciseId: ex.id, userId: req.user!.userId },
      },
      create: {
        exerciseId: ex.id,
        userId: req.user!.userId,
        currentStep: currentStep || 0,
        status: isComplete ? "completed" : "in_progress",
        startedAt: new Date(),
        completedAt: isComplete ? new Date() : undefined,
        answers: answers ? JSON.stringify(answers) : undefined,
      },
      update: {
        currentStep: currentStep || 0,
        status: isComplete ? "completed" : "in_progress",
        completedAt: isComplete ? new Date() : undefined,
        answers: answers ? JSON.stringify(answers) : undefined,
      },
    });

    res.json(progress);
  } catch (err) {
    next(err);
  }
});

// Scenarios
router.get("/scenarios", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const scenarios = await prisma.scenario.findMany({
      where: { tenantId: req.user!.tenantId, isActive: true },
      orderBy: { name: "asc" },
    });
    res.json(
      scenarios.map((s) => ({
        ...s,
        steps: JSON.parse(s.steps),
        sampleData: s.sampleData ? JSON.parse(s.sampleData) : null,
      }))
    );
  } catch (err) {
    next(err);
  }
});

// Admin: create exercises (instructors)
router.post("/exercises", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { steps, hints, solution, ...rest } = req.body;
    const exercise = await prisma.exercise.create({
      data: {
        ...rest,
        tenantId: req.user!.tenantId,
        steps: JSON.stringify(steps || []),
        hints: hints ? JSON.stringify(hints) : undefined,
        solution: solution ? JSON.stringify(solution) : undefined,
      },
    });
    res.status(201).json(exercise);
  } catch (err) {
    next(err);
  }
});

// Admin: create scenarios
router.post("/scenarios", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { steps, sampleData, ...rest } = req.body;
    const scenario = await prisma.scenario.create({
      data: {
        ...rest,
        tenantId: req.user!.tenantId,
        steps: JSON.stringify(steps || []),
        sampleData: sampleData ? JSON.stringify(sampleData) : undefined,
      },
    });
    res.status(201).json(scenario);
  } catch (err) {
    next(err);
  }
});

export default router;
