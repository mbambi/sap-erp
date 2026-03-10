import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authenticate, requireRoles } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

const router = Router();

// GET /health - public health check
router.get("/health", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const uptime = process.uptime();
    res.json({
      status: "ok",
      database: "connected",
      uptime: Math.floor(uptime),
      version: process.env.npm_package_version || "1.0.0",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

router.use(authenticate);

// GET /metrics - list recent metrics (admin/instructor)
router.get(
  "/metrics",
  requireRoles("admin", "instructor"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type, limit } = req.query;
      const where: any = {};
      if (req.user!.tenantId) where.tenantId = req.user!.tenantId;
      if (type) where.metricType = type;

      const data = await prisma.systemMetric.findMany({
        where,
        orderBy: { timestamp: "desc" },
        take: Math.min(500, parseInt(limit as string) || 100),
      });
      res.json({ data });
    } catch (err) {
      next(err);
    }
  }
);

// GET /dashboard - system overview (admin only)
router.get(
  "/dashboard",
  requireRoles("admin"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const metrics = await prisma.systemMetric.findMany({
        where: {
          timestamp: { gte: today },
          metricType: { in: ["api_response_time", "error_rate", "active_users", "db_query_time"] },
        },
      });

      const byType = new Map<string, number[]>();
      for (const m of metrics) {
        const arr = byType.get(m.metricType) || [];
        arr.push(m.value);
        byType.set(m.metricType, arr);
      }

      const responseTimes = byType.get("api_response_time") || [];
      const sorted = [...responseTimes].sort((a, b) => a - b);
      const avgResponseTime = responseTimes.length ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0;
      const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
      const p99 = sorted[Math.floor(sorted.length * 0.99)] ?? 0;

      const errorRates = byType.get("error_rate") || [];
      const errorRate = errorRates.length ? errorRates.reduce((a, b) => a + b, 0) / errorRates.length : 0;

      const activeUsers = byType.get("active_users") || [];
      const totalActiveUsers = activeUsers.length ? Math.max(...activeUsers) : 0;

      const dbQueries = byType.get("db_query_time") || [];
      const dbStats = dbQueries.length
        ? { avg: dbQueries.reduce((a, b) => a + b, 0) / dbQueries.length, count: dbQueries.length }
        : { avg: 0, count: 0 };

      res.json({
        apiResponseTimes: { avg: avgResponseTime, p95, p99 },
        totalRequestsToday: responseTimes.length,
        errorRate,
        activeUsers: totalActiveUsers,
        dbQueryStats: dbStats,
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /record - record a metric (admin only)
router.post("/record", requireRoles("admin"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { metricType, endpoint, value, unit, tags } = req.body;
    if (!metricType || value == null) throw new AppError(400, "metricType and value required");

    const metric = await prisma.systemMetric.create({
      data: {
        tenantId: req.user!.tenantId,
        metricType,
        endpoint: endpoint ?? null,
        value: parseFloat(value),
        unit: unit ?? null,
        tags: tags ? JSON.stringify(tags) : null,
      },
    });
    res.status(201).json(metric);
  } catch (err) {
    next(err);
  }
});

// GET /usage - tenant usage stats (admin/instructor)
router.get(
  "/usage",
  requireRoles("admin", "instructor"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;

      const [userCount, poCount, soCount, journalCount, materialCount] = await Promise.all([
        prisma.user.count({ where: { tenantId } }),
        prisma.purchaseOrder.count({ where: { tenantId } }),
        prisma.salesOrder.count({ where: { tenantId } }),
        prisma.journalEntry.count({ where: { tenantId } }),
        prisma.material.count({ where: { tenantId } }),
      ]);

      const docSize = await prisma.document.aggregate({
        where: { tenantId },
        _sum: { size: true },
      });

      res.json({
        userCount,
        transactionCounts: {
          purchaseOrders: poCount,
          salesOrders: soCount,
          journalEntries: journalCount,
        },
        materialCount,
        storageUsed: docSize._sum.size ?? 0,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
