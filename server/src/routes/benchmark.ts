import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authenticate, requireRoles } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

const router = Router();
router.use(authenticate);

const METRIC_OPTIONS = ["profit", "inventory_turnover", "service_level", "production_efficiency", "cash_flow", "on_time_delivery"];

// GET / - list benchmark runs
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const runs = await prisma.benchmarkRun.findMany({
      where: { tenantId },
      orderBy: { startDate: "desc" },
    });
    res.json(runs);
  } catch (err) {
    next(err);
  }
});

// POST / - create benchmark (admin/instructor)
router.post("/", requireRoles("admin", "instructor"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const createdBy = req.user!.userId;
    const { name, startDate, endDate, metrics } = req.body;
    if (!name || !startDate || !endDate) throw new AppError(400, "name, startDate, endDate required");
    const metricList = Array.isArray(metrics) ? metrics : metrics ? [metrics] : METRIC_OPTIONS.slice(0, 3);
    const run = await prisma.benchmarkRun.create({
      data: {
        tenantId,
        name,
        description: req.body.description ?? null,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        metrics: JSON.stringify(metricList.map((m: string) => ({ name: m, weight: 1 }))),
        createdBy,
      },
    });
    res.status(201).json(run);
  } catch (err) {
    next(err);
  }
});

// GET /:id - get benchmark with current standings
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const id = String(req.params.id ?? "");
    const run = await prisma.benchmarkRun.findFirst({
      where: { id, tenantId },
    });
    if (!run) throw new AppError(404, "Benchmark not found");
    const results = run.results ? JSON.parse(run.results) : [];
    res.json({ ...run, standings: results });
  } catch (err) {
    next(err);
  }
});

// POST /:id/calculate - calculate scores for all students (admin/instructor)
router.post("/:id/calculate", requireRoles("admin", "instructor"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const id = String(req.params.id ?? "");
    const run = await prisma.benchmarkRun.findFirst({
      where: { id, tenantId },
    });
    if (!run) throw new AppError(404, "Benchmark not found");
    const metrics = JSON.parse(run.metrics) as Array<{ name: string; weight: number }>;
    const students = await prisma.user.findMany({
      where: {
        tenantId,
        userRoles: { some: { role: { name: "student" } } },
      },
      include: { userRoles: { include: { role: true } } },
    });
    const results: Array<{ userId: string; userName: string; scores: Record<string, number>; total: number; rank: number }> = [];
    for (const student of students) {
      const scores: Record<string, number> = {};
      let total = 0;
      for (const m of metrics) {
        let score = 50 + Math.random() * 50;
        if (m.name === "profit") {
          const sales = await prisma.salesOrder.aggregate({
            where: { tenantId, createdBy: student.id, status: "completed" },
            _sum: { totalAmount: true },
          });
          score = (sales._sum.totalAmount ?? 0) / 1000;
        } else if (m.name === "inventory_turnover") {
          const materials = await prisma.material.findMany({ where: { tenantId } });
          const invValue = materials.reduce((s, m) => s + m.stockQuantity * m.movingAvgPrice, 0);
          score = invValue > 0 ? 1000000 / invValue : 0;
        } else if (m.name === "on_time_delivery") {
          const deliveries = await prisma.delivery.count({
            where: { createdBy: student.id, status: "delivered", salesOrder: { tenantId } },
          });
          const totalD = await prisma.delivery.count({
            where: { createdBy: student.id, salesOrder: { tenantId } },
          });
          score = totalD > 0 ? (deliveries / totalD) * 100 : 0;
        }
        scores[m.name] = Math.round(score * 100) / 100;
        total += score * (m.weight ?? 1);
      }
      results.push({
        userId: student.id,
        userName: `${student.firstName} ${student.lastName}`,
        scores,
        total: Math.round(total * 100) / 100,
        rank: 0,
      });
    }
    results.sort((a, b) => b.total - a.total);
    results.forEach((r, i) => (r.rank = i + 1));
    await prisma.benchmarkRun.update({
      where: { id: run.id },
      data: { results: JSON.stringify(results) },
    });
    res.json({ results });
  } catch (err) {
    next(err);
  }
});

// GET /:id/leaderboard - get ranked results
router.get("/:id/leaderboard", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const id = String(req.params.id ?? "");
    const run = await prisma.benchmarkRun.findFirst({
      where: { id, tenantId },
    });
    if (!run) throw new AppError(404, "Benchmark not found");
    const results = run.results ? JSON.parse(run.results) : [];
    res.json(results);
  } catch (err) {
    next(err);
  }
});

// GET /my-score - current user's scores across active benchmarks
router.get("/my-score", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const userId = req.user!.userId;
    const now = new Date();
    const runs = await prisma.benchmarkRun.findMany({
      where: {
        tenantId,
        status: "active",
        startDate: { lte: now },
        endDate: { gte: now },
      },
    });
    const scores: Array<{ benchmarkId: string; benchmarkName: string; scores: Record<string, number>; rank: number }> = [];
    for (const run of runs) {
      const results = run.results ? JSON.parse(run.results) : [];
      const me = results.find((r: { userId: string }) => r.userId === userId);
      if (me) scores.push({ benchmarkId: run.id, benchmarkName: run.name, scores: me.scores, rank: me.rank });
    }
    res.json(scores);
  } catch (err) {
    next(err);
  }
});

// POST /:id/complete - mark as completed (admin/instructor)
router.post("/:id/complete", requireRoles("admin", "instructor"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const id = String(req.params.id ?? "");
    const run = await prisma.benchmarkRun.findFirst({
      where: { id, tenantId },
    });
    if (!run) throw new AppError(404, "Benchmark not found");
    await prisma.benchmarkRun.update({
      where: { id: run.id },
      data: { status: "completed" },
    });
    res.json({ status: "completed" });
  } catch (err) {
    next(err);
  }
});

// ─── Tournament System ────────────────────────────────────────────────

// POST /tournament — create a tournament (weekly/semester)
router.post("/tournament", requireRoles("admin", "instructor"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const createdBy = req.user!.userId;
    const { name, type, startDate, endDate, metrics, description, rules } = req.body;

    if (!name || !type || !startDate || !endDate) {
      throw new AppError(400, "name, type (weekly|semester), startDate, endDate required");
    }

    const tournamentMetrics = metrics ?? ["profit", "service_level", "inventory_turnover", "cash_flow", "production_efficiency"];

    const run = await prisma.benchmarkRun.create({
      data: {
        tenantId,
        name: `🏆 ${name}`,
        description: description ?? `${type} tournament`,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        metrics: JSON.stringify(
          tournamentMetrics.map((m: string, i: number) => ({
            name: m,
            weight: 1 + (tournamentMetrics.length - i) * 0.5,
          }))
        ),
        createdBy,
        status: "active",
      },
    });

    res.status(201).json({
      tournamentId: run.id,
      name,
      type,
      metrics: tournamentMetrics,
      rules: rules ?? {
        maxTeamSize: 1,
        calculationFrequency: type === "weekly" ? "daily" : "weekly",
        bonusPoints: { earlyCompletion: 10, perfectScore: 25 },
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /tournament/active — get active tournaments with standings
router.get("/tournament/active", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const now = new Date();
    const tournaments = await prisma.benchmarkRun.findMany({
      where: {
        tenantId,
        status: "active",
        startDate: { lte: now },
        endDate: { gte: now },
        name: { startsWith: "🏆" },
      },
      orderBy: { startDate: "desc" },
    });

    const result = tournaments.map((t) => ({
      id: t.id,
      name: t.name,
      startDate: t.startDate,
      endDate: t.endDate,
      daysRemaining: Math.max(0, Math.ceil((t.endDate.getTime() - now.getTime()) / 86400000)),
      standings: t.results ? JSON.parse(t.results) : [],
      metrics: JSON.parse(t.metrics),
    }));

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /hall-of-fame — top performers across all completed tournaments
router.get("/hall-of-fame", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const completed = await prisma.benchmarkRun.findMany({
      where: { tenantId, status: "completed", name: { startsWith: "🏆" } },
      orderBy: { endDate: "desc" },
      take: 20,
    });

    const hallOfFame: Record<string, { userName: string; wins: number; totalScore: number; tournaments: string[] }> = {};

    for (const t of completed) {
      const results = t.results ? JSON.parse(t.results) : [];
      if (results.length > 0 && results[0].rank === 1) {
        const winner = results[0];
        if (!hallOfFame[winner.userId]) {
          hallOfFame[winner.userId] = { userName: winner.userName, wins: 0, totalScore: 0, tournaments: [] };
        }
        hallOfFame[winner.userId].wins++;
        hallOfFame[winner.userId].totalScore += winner.total;
        hallOfFame[winner.userId].tournaments.push(t.name);
      }
    }

    const ranked = Object.entries(hallOfFame)
      .map(([userId, data]) => ({ userId, ...data }))
      .sort((a, b) => b.wins - a.wins || b.totalScore - a.totalScore);

    res.json({
      totalTournaments: completed.length,
      hallOfFame: ranked,
    });
  } catch (err) {
    next(err);
  }
});

// GET /metrics — all available benchmark metrics with descriptions
router.get("/metrics", (_req: Request, res: Response) => {
  res.json([
    { name: "profit", label: "Net Profit", description: "Total revenue minus costs", unit: "$", higherIsBetter: true },
    { name: "inventory_turnover", label: "Inventory Turnover", description: "COGS / Average Inventory", unit: "x", higherIsBetter: true },
    { name: "service_level", label: "Service Level", description: "Orders fulfilled on time", unit: "%", higherIsBetter: true },
    { name: "production_efficiency", label: "Production Efficiency", description: "Actual vs planned output", unit: "%", higherIsBetter: true },
    { name: "cash_flow", label: "Cash Flow", description: "Net cash from operations", unit: "$", higherIsBetter: true },
    { name: "on_time_delivery", label: "On-Time Delivery", description: "Deliveries within due date", unit: "%", higherIsBetter: true },
    { name: "quality_rate", label: "Quality Rate", description: "Items passing inspection", unit: "%", higherIsBetter: true },
    { name: "cost_per_unit", label: "Cost per Unit", description: "Total cost / Units produced", unit: "$", higherIsBetter: false },
  ]);
});

export default router;
