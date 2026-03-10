import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authenticate } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

const router = Router();
router.use(authenticate);

// GET /metrics - list metrics
router.get("/metrics", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { metricType, workCenterId, startDate, endDate } = req.query;
    const where: Record<string, unknown> = { tenantId };
    if (metricType) where.metricType = metricType as string;
    if (workCenterId) where.workCenterId = workCenterId as string;
    if (startDate || endDate) {
      where.periodStart = {};
      if (startDate) (where.periodStart as Record<string, Date>).gte = new Date(startDate as string);
      if (endDate) (where.periodStart as Record<string, Date>).lte = new Date(endDate as string);
    }
    const metrics = await prisma.operationsMetric.findMany({
      where,
      orderBy: { periodStart: "desc" },
    });
    res.json(metrics);
  } catch (err) {
    next(err);
  }
});

// POST /metrics - record a metric
router.post("/metrics", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { metricType, workCenterId, materialId, periodStart, periodEnd, value, target, unit } = req.body;
    if (!metricType || !periodStart || !periodEnd || value == null) {
      throw new AppError(400, "metricType, periodStart, periodEnd, and value are required");
    }
    const metric = await prisma.operationsMetric.create({
      data: {
        tenantId,
        metricType,
        workCenterId: workCenterId ?? null,
        materialId: materialId ?? null,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        value,
        target: target ?? null,
        unit: unit ?? null,
      },
    });
    res.status(201).json(metric);
  } catch (err) {
    next(err);
  }
});

// POST /metrics/batch - record multiple metrics
router.post("/metrics/batch", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const metrics = req.body as Array<{
      metricType: string;
      workCenterId?: string;
      materialId?: string;
      periodStart: string;
      periodEnd: string;
      value: number;
      target?: number;
      unit?: string;
    }>;
    if (!Array.isArray(metrics) || metrics.length === 0) {
      throw new AppError(400, "metrics array is required");
    }
    const created = await prisma.operationsMetric.createMany({
      data: metrics.map((m) => ({
        tenantId,
        metricType: m.metricType,
        workCenterId: m.workCenterId ?? null,
        materialId: m.materialId ?? null,
        periodStart: new Date(m.periodStart),
        periodEnd: new Date(m.periodEnd),
        value: m.value,
        target: m.target ?? null,
        unit: m.unit ?? null,
      })),
    });
    res.status(201).json({ count: created.count });
  } catch (err) {
    next(err);
  }
});

// GET /dashboard - calculated KPIs
router.get("/dashboard", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;

    const metrics = await prisma.operationsMetric.findMany({
      where: { tenantId },
      orderBy: { periodStart: "desc" },
    });

    const oeeMetrics = metrics.filter((m) => m.metricType === "oee");
    const oee = oeeMetrics.length > 0
      ? oeeMetrics.reduce((s, m) => s + m.value, 0) / oeeMetrics.length
      : null;

    const turnoverMetrics = metrics.filter((m) => m.metricType === "inventory_turnover");
    const inventoryTurnover = turnoverMetrics.length > 0
      ? turnoverMetrics.reduce((s, m) => s + m.value, 0) / turnoverMetrics.length
      : null;

    const fillRateMetrics = metrics.filter((m) => m.metricType === "fill_rate");
    const fillRate = fillRateMetrics.length > 0
      ? fillRateMetrics.reduce((s, m) => s + m.value, 0) / fillRateMetrics.length
      : null;

    const throughputMetrics = metrics.filter((m) => m.metricType === "throughput");
    const throughput = throughputMetrics.length > 0
      ? throughputMetrics.reduce((s, m) => s + m.value, 0) / throughputMetrics.length
      : null;

    const materials = await prisma.material.findMany({
      where: { tenantId },
    });
    const avgInventory = materials.length > 0
      ? materials.reduce((s, m) => s + (m.stockQuantity || 0) * (m.movingAvgPrice || m.standardPrice || 0), 0) / materials.length
      : 0;

    res.json({
      oee,
      inventoryTurnover,
      fillRate,
      throughput,
      avgInventory,
    });
  } catch (err) {
    next(err);
  }
});

// POST /calculate-oee - OEE = availability * performance * quality
router.post("/calculate-oee", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { workCenterId, plannedTime, runTime, totalPieces, goodPieces, idealCycleTime } = req.body;
    if (!workCenterId || plannedTime == null || runTime == null || totalPieces == null || goodPieces == null) {
      throw new AppError(400, "workCenterId, plannedTime, runTime, totalPieces, and goodPieces are required");
    }

    const availability = plannedTime > 0 ? runTime / plannedTime : 0;
    const idealTime = idealCycleTime != null ? totalPieces * idealCycleTime : 0;
    const performance = idealTime > 0 && runTime > 0 ? Math.min(1, idealTime / runTime) : totalPieces > 0 ? 1 : 0;
    const quality = totalPieces > 0 ? goodPieces / totalPieces : 0;

    const oee = availability * performance * quality;

    await prisma.operationsMetric.create({
      data: {
        tenantId,
        metricType: "oee",
        workCenterId,
        periodStart: new Date(),
        periodEnd: new Date(),
        value: oee,
        unit: "decimal",
      },
    });

    res.json({
      oee,
      availability,
      performance,
      quality,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
