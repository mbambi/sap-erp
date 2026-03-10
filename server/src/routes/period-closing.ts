import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authenticate, requireRoles } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

const router = Router();
router.use(authenticate);

const tenantScope = (req: Request) => req.user!.tenantId;

const DEFAULT_CHECKLIST = [
  { id: "review_journals", name: "Review and post all draft journal entries", description: "Review and post all draft journal entries", status: "pending", completedAt: null as string | null, completedBy: null as string | null },
  { id: "run_depreciation", name: "Run asset depreciation for the period", description: "Run asset depreciation for the period", status: "pending", completedAt: null, completedBy: null },
  { id: "inventory_valuation", name: "Complete inventory valuation", description: "Complete inventory valuation", status: "pending", completedAt: null, completedBy: null },
  { id: "reconcile_ap", name: "Reconcile accounts payable", description: "Reconcile accounts payable", status: "pending", completedAt: null, completedBy: null },
  { id: "reconcile_ar", name: "Reconcile accounts receivable", description: "Reconcile accounts receivable", status: "pending", completedAt: null, completedBy: null },
  { id: "review_accruals", name: "Post accrual entries", description: "Post accrual entries", status: "pending", completedAt: null, completedBy: null },
  { id: "generate_statements", name: "Generate financial statements", description: "Generate financial statements", status: "pending", completedAt: null, completedBy: null },
  { id: "close_period", name: "Close fiscal period", description: "Close fiscal period", status: "pending", completedAt: null, completedBy: null },
];

/** GET /status - Overview of period status for current year (must be before /:id) */
router.get("/status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tid = tenantScope(req);
    const currentYear = new Date().getFullYear();

    const periods = await prisma.closingPeriod.findMany({
      where: { tenantId: tid, year: currentYear },
    });

    const open = periods.filter((p) => p.status === "open").length;
    const inProgress = periods.filter((p) => p.status === "in_progress").length;
    const closed = periods.filter((p) => p.status === "closed").length;

    res.json({
      year: currentYear,
      open,
      in_progress: inProgress,
      closed,
      total: periods.length,
    });
  } catch (err) {
    next(err);
  }
});

/** GET / - List closing periods */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { year, status } = req.query;
    const where: { tenantId: string; year?: number; status?: string } = {
      tenantId: tenantScope(req),
    };
    const yearVal = Array.isArray(year) ? year[0] : year;
    const statusVal = Array.isArray(status) ? status[0] : status;
    if (yearVal) where.year = parseInt(String(yearVal));
    if (statusVal && typeof statusVal === "string") where.status = statusVal;

    const periods = await prisma.closingPeriod.findMany({
      where,
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });
    res.json(periods);
  } catch (err) {
    next(err);
  }
});

/** POST / - Create closing period (admin/instructor) */
router.post("/", requireRoles("admin", "instructor"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { year, month } = req.body;
    if (!year || !month) throw new AppError(400, "year and month are required");

    const tid = tenantScope(req);
    const existing = await prisma.closingPeriod.findFirst({
      where: { tenantId: tid, year: Number(year), month: Number(month) },
    });
    if (existing) throw new AppError(400, "Closing period already exists for this year/month");

    const checklist = DEFAULT_CHECKLIST.map((t) => ({ ...t }));

    const period = await prisma.closingPeriod.create({
      data: {
        tenantId: tid,
        year: Number(year),
        month: Number(month),
        status: "open",
        checklist: JSON.stringify(checklist),
        startedAt: new Date(),
      },
    });
    res.status(201).json(period);
  } catch (err) {
    next(err);
  }
});

/** GET /:id - Get closing period with full checklist */
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const period = await prisma.closingPeriod.findFirst({
      where: { id, tenantId: tenantScope(req) },
    });
    if (!period) throw new AppError(404, "Closing period not found");
    const checklist = JSON.parse(period.checklist) as typeof DEFAULT_CHECKLIST;
    res.json({ ...period, checklist });
  } catch (err) {
    next(err);
  }
});

/** POST /:id/task/:taskId/complete - Mark task complete (admin/instructor) */
router.post("/:id/task/:taskId/complete", requireRoles("admin", "instructor"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const taskId = String(req.params.taskId);
    const period = await prisma.closingPeriod.findFirst({
      where: { id, tenantId: tenantScope(req) },
    });
    if (!period) throw new AppError(404, "Closing period not found");

    const checklist = JSON.parse(period.checklist) as Array<{ id: string; status: string; completedAt: string | null; completedBy: string | null }>;
    const task = checklist.find((t) => t.id === taskId);
    if (!task) throw new AppError(404, "Task not found");

    task.status = "completed";
    task.completedAt = new Date().toISOString();
    task.completedBy = req.user!.userId;

    const updated = await prisma.closingPeriod.update({
      where: { id },
      data: { checklist: JSON.stringify(checklist) },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/** POST /:id/task/:taskId/reopen - Mark task incomplete (admin/instructor) */
router.post("/:id/task/:taskId/reopen", requireRoles("admin", "instructor"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const taskId = String(req.params.taskId);
    const period = await prisma.closingPeriod.findFirst({
      where: { id, tenantId: tenantScope(req) },
    });
    if (!period) throw new AppError(404, "Closing period not found");

    const checklist = JSON.parse(period.checklist) as Array<{ id: string; status: string; completedAt: string | null; completedBy: string | null }>;
    const task = checklist.find((t) => t.id === taskId);
    if (!task) throw new AppError(404, "Task not found");

    task.status = "pending";
    task.completedAt = null;
    task.completedBy = null;

    const updated = await prisma.closingPeriod.update({
      where: { id },
      data: { checklist: JSON.stringify(checklist) },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/** POST /:id/close - Close the period (admin/instructor) */
router.post("/:id/close", requireRoles("admin", "instructor"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const period = await prisma.closingPeriod.findFirst({
      where: { id, tenantId: tenantScope(req) },
    });
    if (!period) throw new AppError(404, "Closing period not found");
    if (period.status === "closed") throw new AppError(400, "Period is already closed");

    const checklist = JSON.parse(period.checklist) as Array<{ status: string }>;
    const allComplete = checklist.every((t) => t.status === "completed");
    if (!allComplete) {
      throw new AppError(400, "All checklist tasks must be completed before closing");
    }

    await prisma.$transaction([
      prisma.closingPeriod.update({
        where: { id },
        data: {
          status: "closed",
          completedAt: new Date(),
          completedBy: req.user!.userId,
        },
      }),
      prisma.fiscalPeriod.updateMany({
        where: {
          tenantId: tenantScope(req),
          year: period.year,
          period: period.month,
        },
        data: { status: "closed", closedBy: req.user!.userId, closedAt: new Date() },
      }),
    ]);

    const updated = await prisma.closingPeriod.findUnique({
      where: { id },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/** POST /:id/reopen - Reopen closed period (admin only) */
router.post("/:id/reopen", requireRoles("admin"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const period = await prisma.closingPeriod.findFirst({
      where: { id, tenantId: tenantScope(req) },
    });
    if (!period) throw new AppError(404, "Closing period not found");
    if (period.status !== "closed") throw new AppError(400, "Only closed periods can be reopened");

    const updated = await prisma.closingPeriod.update({
      where: { id },
      data: {
        status: "open",
        completedAt: null,
        completedBy: null,
      },
    });

    await prisma.fiscalPeriod.updateMany({
      where: {
        tenantId: tenantScope(req),
        year: period.year,
        period: period.month,
      },
      data: { status: "open", closedBy: null, closedAt: null },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
