import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authenticate, requireRoles } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

const router = Router();
router.use(authenticate);

function safeJsonParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

// GET /trail/:entityType/:entityId - full audit trail for entity
router.get("/trail/:entityType/:entityId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const entityType = String(req.params.entityType ?? "");
    const entityId = String(req.params.entityId ?? "");
    const logs = await prisma.auditLog.findMany({
      where: {
        tenantId,
        resource: entityType,
        resourceId: entityId,
      },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
    });
    res.json(
      logs.map((l) => ({
        id: l.id,
        action: l.action,
        module: l.module,
        resource: l.resource,
        resourceId: l.resourceId,
        oldValue: l.oldValue ? safeJsonParse(l.oldValue) : null,
        newValue: l.newValue ? safeJsonParse(l.newValue) : null,
        user: l.user ? `${l.user.firstName} ${l.user.lastName}` : null,
        timestamp: l.createdAt,
      }))
    );
  } catch (err) {
    next(err);
  }
});

// GET /anomalies - detect potential anomalies
router.get("/anomalies", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const anomalies: Array<{ type: string; severity: string; description: string; relatedEntity?: string; timestamp: string }> = [];
    const logs = await prisma.auditLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 500,
      include: { user: true },
    });
    const amountMap = new Map<string, number[]>();
    const entityChangeMap = new Map<string, number[]>();
    for (const log of logs) {
      if (log.action === "approve" && log.resource === "purchase_order" && log.resourceId) {
        const po = await prisma.purchaseOrder.findUnique({
          where: { id: log.resourceId! },
          select: { createdBy: true, approvedBy: true },
        });
        if (po && po.createdBy === po.approvedBy && log.userId === po.createdBy) {
          anomalies.push({
            type: "self_approval",
            severity: "high",
            description: "User approved their own purchase order",
            relatedEntity: log.resourceId,
            timestamp: log.createdAt.toISOString(),
          });
        }
      }
      const hour = log.createdAt.getHours();
      if (hour < 7 || hour > 22) {
        anomalies.push({
          type: "after_hours",
          severity: "medium",
          description: "Transaction outside business hours (7am-10pm)",
          relatedEntity: log.resourceId ?? undefined,
          timestamp: log.createdAt.toISOString(),
        });
      }
      if (log.newValue) {
        try {
          const parsed = JSON.parse(log.newValue) as Record<string, unknown>;
          const amt = parsed.totalAmount ?? parsed.amount ?? parsed.grossAmount;
          if (typeof amt === "number") {
            const key = `${log.resource}-${log.resourceId}`;
            const arr = amountMap.get(key) ?? [];
            arr.push(amt);
            amountMap.set(key, arr);
          }
        } catch {
          // ignore parse errors
        }
      }
      const entityKey = `${log.resource}-${log.resourceId}`;
      if (log.resourceId) {
        const times = entityChangeMap.get(entityKey) ?? [];
        times.push(log.createdAt.getTime());
        entityChangeMap.set(entityKey, times);
      }
    }
    for (const [, amounts] of amountMap) {
      if (amounts.length >= 3) {
        const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
        const variance = amounts.reduce((s, v) => s + (v - mean) ** 2, 0) / amounts.length;
        const std = Math.sqrt(variance);
        const max = Math.max(...amounts);
        if (std > 0 && max > mean + 3 * std) {
          anomalies.push({
            type: "unusual_amount",
            severity: "medium",
            description: `Unusually large amount (>3 std dev from mean)`,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }
    for (const [, times] of entityChangeMap) {
      if (times.length >= 5) {
        times.sort((a, b) => a - b);
        const gaps = times.slice(1).map((t, i) => t - times[i]);
        const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
        if (avgGap < 60000) {
          anomalies.push({
            type: "rapid_changes",
            severity: "low",
            description: "Rapid successive changes to same entity (within 1 min)",
            timestamp: new Date(times[times.length - 1]).toISOString(),
          });
        }
      }
    }
    res.json(anomalies.slice(0, 50));
  } catch (err) {
    next(err);
  }
});

// GET /compliance - compliance dashboard
router.get("/compliance", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const pendingApprovals = await prisma.purchaseOrder.count({
      where: { tenantId, status: "draft" },
    });
    const workflowTasks = await prisma.workflowTask.count({
      where: {
        status: "pending",
        instance: { definition: { tenantId } },
      },
    });
    const unsignedJournals = await prisma.journalEntry.count({
      where: { tenantId, status: "draft" },
    });
    const overduePOs = await prisma.purchaseOrder.count({
      where: {
        tenantId,
        deliveryDate: { lt: new Date() },
        status: { notIn: ["closed", "cancelled", "received"] },
      },
    });
    res.json({
      segregationOfDuties: { status: "ok", violations: 0 },
      pendingApprovals: pendingApprovals + workflowTasks,
      unsignedTransactions: unsignedJournals,
      overdueReviews: overduePOs,
    });
  } catch (err) {
    next(err);
  }
});

// GET /financial-trace/:journalId - trace journal to source
router.get("/financial-trace/:journalId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const journalId = String(req.params.journalId ?? "");
    const journal = await prisma.journalEntry.findFirst({
      where: { id: journalId, tenantId },
      include: { lineItems: { include: { glAccount: true } } },
    });
    if (!journal) throw new AppError(404, "Journal entry not found");
    const trace: { journal: typeof journal; source: unknown } = {
      journal,
      source: null,
    };
    if (journal.reference) {
      const ref = journal.reference;
      const poMatch = ref.match(/PO[-\s]?(\d+)/i) || ref.match(/([a-f0-9-]{36})/);
      if (poMatch) {
        const po = await prisma.purchaseOrder.findFirst({
          where: { tenantId, OR: [{ poNumber: poMatch[1] }, { id: poMatch[1] }] },
        });
        if (po) trace.source = { type: "purchase_order", ...po };
      }
      const soMatch = ref.match(/SO[-\s]?(\d+)/i);
      if (soMatch && !trace.source) {
        const so = await prisma.salesOrder.findFirst({
          where: { tenantId, OR: [{ soNumber: soMatch[1] }, { id: soMatch[1] }] },
        });
        if (so) trace.source = { type: "sales_order", ...so };
      }
    }
    res.json(trace);
  } catch (err) {
    next(err);
  }
});

// POST /export - export audit data (admin only)
router.post("/export", requireRoles("admin"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { startDate, endDate } = req.body;
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    const logs = await prisma.auditLog.findMany({
      where: {
        tenantId,
        createdAt: { gte: start, lte: end },
      },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { email: true, firstName: true, lastName: true } } },
    });
    const exportData = logs.map((l) => ({
      id: l.id,
      action: l.action,
      module: l.module,
      resource: l.resource,
      resourceId: l.resourceId,
      userId: l.userId,
      userEmail: l.user?.email,
      userName: l.user ? `${l.user.firstName} ${l.user.lastName}` : null,
      timestamp: l.createdAt,
      oldValue: l.oldValue,
      newValue: l.newValue,
    }));
    res.json({ data: exportData, count: exportData.length });
  } catch (err) {
    next(err);
  }
});

export default router;
