import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authenticate, requireRoles } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

const router = Router();
router.use(authenticate);

const SCENARIOS: Record<string, { name: string; description: string; defaultConfig: Record<string, unknown> }> = {
  black_friday: {
    name: "Black Friday",
    description: "200% demand spike across all products for 48 hours",
    defaultConfig: { demandMultiplier: 3, duration: 48 },
  },
  supplier_bankruptcy: {
    name: "Supplier Bankruptcy",
    description: "Top supplier goes bankrupt, all POs cancelled",
    defaultConfig: { vendorId: "top" },
  },
  transport_strike: {
    name: "Transport Strike",
    description: "All shipments delayed 2 weeks",
    defaultConfig: { delayDays: 14 },
  },
  machine_cascade: {
    name: "Machine Cascade Failure",
    description: "50% of work centers fail simultaneously",
    defaultConfig: { failurePct: 50 },
  },
  cyber_attack: {
    name: "Cyber Attack",
    description: "ERP data corrupted, must reconcile",
    defaultConfig: { corruptionPct: 10 },
  },
};

function generateCrisisEvents(scenario: string, config: Record<string, unknown>): unknown[] {
  const events: Array<{ type: string; severity: string; message: string; timestamp: string }> = [];
  const now = new Date().toISOString();
  switch (scenario) {
    case "black_friday":
      events.push({ type: "demand_spike", severity: "critical", message: "200% demand spike detected across all products", timestamp: now });
      events.push({ type: "inventory_alert", severity: "high", message: "Stock levels critically low for top 5 SKUs", timestamp: now });
      break;
    case "supplier_bankruptcy":
      events.push({ type: "supplier_default", severity: "critical", message: "Primary supplier has declared bankruptcy - all POs cancelled", timestamp: now });
      events.push({ type: "shortage_risk", severity: "high", message: "Critical materials at risk - need alternative sourcing", timestamp: now });
      break;
    case "transport_strike":
      events.push({ type: "logistics_disruption", severity: "high", message: "Transport strike - all shipments delayed 14 days", timestamp: now });
      events.push({ type: "customer_impact", severity: "medium", message: "Customer delivery commitments at risk", timestamp: now });
      break;
    case "machine_cascade":
      events.push({ type: "equipment_failure", severity: "critical", message: "50% of work centers offline - production halted", timestamp: now });
      events.push({ type: "capacity_crisis", severity: "high", message: "Unable to meet production schedule", timestamp: now });
      break;
    case "cyber_attack":
      events.push({ type: "data_corruption", severity: "critical", message: "ERP data integrity compromised - reconciliation required", timestamp: now });
      events.push({ type: "audit_required", severity: "high", message: "Full data audit and recovery needed", timestamp: now });
      break;
    default:
      events.push({ type: "crisis", severity: "high", message: "Unexpected scenario initiated", timestamp: now });
  }
  return events;
}

// GET / - list stress tests
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const userId = req.user!.userId;
    const tests = await prisma.stressTest.findMany({
      where: { tenantId, userId },
      orderBy: { createdAt: "desc" },
    });
    res.json(tests);
  } catch (err) {
    next(err);
  }
});

// GET /scenarios - available scenario types
router.get("/scenarios", (_req: Request, res: Response) => {
  res.json(
    Object.entries(SCENARIOS).map(([key, val]) => ({
      id: key,
      ...val,
    }))
  );
});

// POST /start - start stress test
router.post("/start", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const userId = req.user!.userId;
    const { scenario, config } = req.body;
    if (!scenario) throw new AppError(400, "scenario required");
    const scenarioDef = SCENARIOS[scenario];
    if (!scenarioDef) throw new AppError(400, `Unknown scenario: ${scenario}`);
    const mergedConfig = { ...scenarioDef.defaultConfig, ...config };
    const events = generateCrisisEvents(scenario, mergedConfig);
    const test = await prisma.stressTest.create({
      data: {
        tenantId,
        userId,
        name: `${scenarioDef.name} - ${new Date().toLocaleDateString()}`,
        scenario,
        description: scenarioDef.description,
        config: JSON.stringify(mergedConfig),
        status: "running",
        events: JSON.stringify(events),
        studentActions: JSON.stringify([]),
        startedAt: new Date(),
      },
    });
    res.status(201).json({
      ...test,
      events: JSON.parse(test.events ?? "[]"),
    });
  } catch (err) {
    next(err);
  }
});

// POST /:id/action - record student action
router.post("/:id/action", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const userId = req.user!.userId;
    const id = String(req.params.id ?? "");
    const { actionType, details } = req.body;
    if (!actionType) throw new AppError(400, "actionType required");
    const test = await prisma.stressTest.findFirst({
      where: { id, tenantId, userId },
    });
    if (!test) throw new AppError(404, "Stress test not found");
    if (test.status !== "running") throw new AppError(400, "Test is not running");
    const actions = JSON.parse(test.studentActions ?? "[]") as Array<{ actionType: string; details?: unknown; timestamp: string }>;
    actions.push({ actionType, details, timestamp: new Date().toISOString() });
    await prisma.stressTest.update({
      where: { id: test.id },
      data: { studentActions: JSON.stringify(actions) },
    });
    res.json({ recorded: true });
  } catch (err) {
    next(err);
  }
});

// POST /:id/complete - complete stress test
router.post("/:id/complete", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const userId = req.user!.userId;
    const id = String(req.params.id ?? "");
    const test = await prisma.stressTest.findFirst({
      where: { id, tenantId, userId },
    });
    if (!test) throw new AppError(404, "Stress test not found");
    const actions = JSON.parse(test.studentActions ?? "[]") as unknown[];
    const responseTime = test.startedAt ? (Date.now() - test.startedAt.getTime()) / 60000 : 0;
    const actionScore = Math.min(100, actions.length * 15);
    const timeScore = Math.max(0, 100 - responseTime);
    const score = Math.round((actionScore * 0.6 + timeScore * 0.4) * 100) / 100;
    await prisma.stressTest.update({
      where: { id: test.id },
      data: {
        status: "completed",
        score,
        completedAt: new Date(),
      },
    });
    res.json({ score, status: "completed" });
  } catch (err) {
    next(err);
  }
});

// GET /:id - get test detail
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const userId = req.user!.userId;
    const id = String(req.params.id ?? "");
    const test = await prisma.stressTest.findFirst({
      where: { id, tenantId, userId },
    });
    if (!test) throw new AppError(404, "Stress test not found");
    res.json({
      ...test,
      events: test.events ? JSON.parse(test.events) : [],
      studentActions: test.studentActions ? JSON.parse(test.studentActions) : [],
    });
  } catch (err) {
    next(err);
  }
});

export default router;
