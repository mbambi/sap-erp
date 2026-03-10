import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authenticate } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

const router = Router();
router.use(authenticate);

// GET /events - list events
router.get("/events", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { module, caseId, startDate, endDate } = req.query;
    const where: Record<string, unknown> = { tenantId };
    if (module) where.module = module as string;
    if (caseId) where.caseId = caseId as string;
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) (where.timestamp as Record<string, Date>).gte = new Date(startDate as string);
      if (endDate) (where.timestamp as Record<string, Date>).lte = new Date(endDate as string);
    }
    const events = await prisma.processEvent.findMany({
      where,
      orderBy: { timestamp: "asc" },
    });
    res.json(events);
  } catch (err) {
    next(err);
  }
});

// POST /events - record new event
router.post("/events", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { caseId, activity, resource, module, documentId, attributes, duration } = req.body;
    if (!caseId || !activity || !module) throw new AppError(400, "caseId, activity, and module are required");
    const event = await prisma.processEvent.create({
      data: {
        tenantId,
        caseId,
        activity,
        resource: resource ?? null,
        module,
        documentId: documentId ?? null,
        attributes: attributes ? JSON.stringify(attributes) : null,
        duration: duration ?? null,
      },
    });
    res.status(201).json(event);
  } catch (err) {
    next(err);
  }
});

// POST /events/batch - record multiple events
router.post("/events/batch", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const events = req.body as Array<{
      caseId: string;
      activity: string;
      resource?: string;
      module: string;
      documentId?: string;
      attributes?: unknown;
      duration?: number;
    }>;
    if (!Array.isArray(events) || events.length === 0) {
      throw new AppError(400, "events array is required");
    }
    const created = await prisma.processEvent.createMany({
      data: events.map((e) => ({
        tenantId,
        caseId: e.caseId,
        activity: e.activity,
        resource: e.resource ?? null,
        module: e.module,
        documentId: e.documentId ?? null,
        attributes: e.attributes ? JSON.stringify(e.attributes) : null,
        duration: e.duration ?? null,
      })),
    });
    res.status(201).json({ count: created.count });
  } catch (err) {
    next(err);
  }
});

// GET /cases - list unique cases with event count and duration
router.get("/cases", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const events = await prisma.processEvent.findMany({
      where: { tenantId },
      orderBy: { timestamp: "asc" },
    });
    const caseMap = new Map<
      string,
      { caseId: string; eventCount: number; firstEvent: Date; lastEvent: Date; duration: number }
    >();
    for (const e of events) {
      const existing = caseMap.get(e.caseId);
      if (!existing) {
        caseMap.set(e.caseId, {
          caseId: e.caseId,
          eventCount: 1,
          firstEvent: e.timestamp,
          lastEvent: e.timestamp,
          duration: 0,
        });
      } else {
        existing.eventCount++;
        if (e.timestamp < existing.firstEvent) existing.firstEvent = e.timestamp;
        if (e.timestamp > existing.lastEvent) existing.lastEvent = e.timestamp;
      }
    }
    const cases = Array.from(caseMap.values()).map((c) => ({
      ...c,
      duration: (c.lastEvent.getTime() - c.firstEvent.getTime()) / 1000,
    }));
    res.json(cases);
  } catch (err) {
    next(err);
  }
});

// GET /cases/:caseId - get all events for a case
router.get("/cases/:caseId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { caseId } = req.params;
    const events = await prisma.processEvent.findMany({
      where: { tenantId, caseId },
      orderBy: { timestamp: "asc" },
    });
    res.json(events);
  } catch (err) {
    next(err);
  }
});

// GET /process-map - activity transitions with frequency and avg duration
router.get("/process-map", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const events = await prisma.processEvent.findMany({
      where: { tenantId },
      orderBy: { timestamp: "asc" },
    });
    const activities = [...new Set(events.map((e) => e.activity))];
    const transitionMap = new Map<string, { count: number; totalDuration: number }>();
    const caseEvents = new Map<string, typeof events>();
    for (const e of events) {
      if (!caseEvents.has(e.caseId)) caseEvents.set(e.caseId, []);
      caseEvents.get(e.caseId)!.push(e);
    }
    for (const caseEvts of caseEvents.values()) {
      caseEvts.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      for (let i = 0; i < caseEvts.length - 1; i++) {
        const from = caseEvts[i].activity;
        const to = caseEvts[i + 1].activity;
        const key = `${from}→${to}`;
        const duration = caseEvts[i + 1].duration ?? 0;
        const existing = transitionMap.get(key) || { count: 0, totalDuration: 0 };
        transitionMap.set(key, {
          count: existing.count + 1,
          totalDuration: existing.totalDuration + duration,
        });
      }
    }
    const transitions = Array.from(transitionMap.entries()).map(([key, v]) => {
      const [from, to] = key.split("→");
      return {
        from,
        to,
        count: v.count,
        avgDuration: v.count > 0 ? v.totalDuration / v.count : 0,
      };
    });
    res.json({ activities, transitions });
  } catch (err) {
    next(err);
  }
});

// GET /statistics - process statistics
router.get("/statistics", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const events = await prisma.processEvent.findMany({
      where: { tenantId },
      orderBy: { timestamp: "asc" },
    });
    const caseMap = new Map<string, { first: Date; last: Date; path: string[] }>();
    for (const e of events) {
      const existing = caseMap.get(e.caseId);
      if (!existing) {
        caseMap.set(e.caseId, {
          first: e.timestamp,
          last: e.timestamp,
          path: [e.activity],
        });
      } else {
        existing.path.push(e.activity);
        if (e.timestamp > existing.last) existing.last = e.timestamp;
      }
    }
    const durations = Array.from(caseMap.values()).map(
      (c) => (c.last.getTime() - c.first.getTime()) / 1000
    );
    const avgCaseDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

    const pathCounts = new Map<string, number>();
    for (const c of caseMap.values()) {
      const pathKey = c.path.join(" → ");
      pathCounts.set(pathKey, (pathCounts.get(pathKey) || 0) + 1);
    }
    const sortedPaths = Array.from(pathCounts.entries()).sort((a, b) => b[1] - a[1]);
    const mostCommonPath = sortedPaths[0] ? { path: sortedPaths[0][0], count: sortedPaths[0][1] } : null;

    const activityDurations = new Map<string, number[]>();
    for (const e of events) {
      if (e.duration != null) {
        const arr = activityDurations.get(e.activity) || [];
        arr.push(e.duration);
        activityDurations.set(e.activity, arr);
      }
    }
    const bottleneckActivities = Array.from(activityDurations.entries())
      .map(([activity, durs]) => ({
        activity,
        avgDuration: durs.reduce((a, b) => a + b, 0) / durs.length,
      }))
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, 5);

    res.json({
      avgCaseDuration,
      mostCommonPath,
      bottleneckActivities,
    });
  } catch (err) {
    next(err);
  }
});

// ─── Enhanced Process Mining: Bottleneck Detection ────────────────────
router.get("/bottlenecks", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { module: filterModule } = req.query;
    const where: Record<string, unknown> = { tenantId };
    if (filterModule) where.module = filterModule as string;

    const events = await prisma.processEvent.findMany({ where, orderBy: { timestamp: "asc" } });

    // Group by case
    const caseEvents = new Map<string, typeof events>();
    for (const e of events) {
      if (!caseEvents.has(e.caseId)) caseEvents.set(e.caseId, []);
      caseEvents.get(e.caseId)!.push(e);
    }

    // Calculate wait times between activities
    const transitionTimes = new Map<string, number[]>();
    const activityWait = new Map<string, number[]>();

    for (const caseEvts of caseEvents.values()) {
      caseEvts.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      for (let i = 0; i < caseEvts.length - 1; i++) {
        const from = caseEvts[i].activity;
        const to = caseEvts[i + 1].activity;
        const waitMs = caseEvts[i + 1].timestamp.getTime() - caseEvts[i].timestamp.getTime();
        const key = `${from} → ${to}`;
        if (!transitionTimes.has(key)) transitionTimes.set(key, []);
        transitionTimes.get(key)!.push(waitMs);
        if (!activityWait.has(to)) activityWait.set(to, []);
        activityWait.get(to)!.push(waitMs);
      }
    }

    const bottlenecks = Array.from(transitionTimes.entries())
      .map(([transition, times]) => {
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        const sorted = [...times].sort((a, b) => a - b);
        const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? avg;
        return {
          transition,
          avgWaitMs: Math.round(avg),
          p95WaitMs: Math.round(p95),
          avgWaitHuman: formatDuration(avg),
          p95WaitHuman: formatDuration(p95),
          occurrences: times.length,
        };
      })
      .sort((a, b) => b.avgWaitMs - a.avgWaitMs);

    const activityBottlenecks = Array.from(activityWait.entries())
      .map(([activity, times]) => ({
        activity,
        avgWaitMs: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
        avgWaitHuman: formatDuration(times.reduce((a, b) => a + b, 0) / times.length),
        occurrences: times.length,
      }))
      .sort((a, b) => b.avgWaitMs - a.avgWaitMs)
      .slice(0, 10);

    res.json({ transitionBottlenecks: bottlenecks.slice(0, 20), activityBottlenecks });
  } catch (err) {
    next(err);
  }
});

// ─── Conformance Checking ─────────────────────────────────────────────
router.post("/conformance", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { idealProcess } = req.body;

    if (!Array.isArray(idealProcess) || idealProcess.length < 2) {
      throw new AppError(400, "idealProcess must be an array of activity names (min 2)");
    }

    const events = await prisma.processEvent.findMany({
      where: { tenantId },
      orderBy: { timestamp: "asc" },
    });

    const caseEvents = new Map<string, string[]>();
    for (const e of events) {
      if (!caseEvents.has(e.caseId)) caseEvents.set(e.caseId, []);
      caseEvents.get(e.caseId)!.push(e.activity);
    }

    const idealStr = idealProcess.join(" → ");
    const results: Array<{
      caseId: string;
      actualPath: string;
      conformant: boolean;
      deviations: string[];
      fitness: number;
    }> = [];

    let conformantCount = 0;

    for (const [caseId, activities] of caseEvents.entries()) {
      const actualStr = activities.join(" → ");
      const deviations: string[] = [];

      // Check for missing activities
      for (const ideal of idealProcess) {
        if (!activities.includes(ideal)) {
          deviations.push(`Missing activity: ${ideal}`);
        }
      }

      // Check for extra activities
      for (const actual of activities) {
        if (!idealProcess.includes(actual)) {
          deviations.push(`Extra activity: ${actual}`);
        }
      }

      // Check order violations
      let lastIdx = -1;
      for (const ideal of idealProcess) {
        const idx = activities.indexOf(ideal);
        if (idx !== -1 && idx < lastIdx) {
          deviations.push(`Order violation: ${ideal} appears before expected`);
        }
        if (idx !== -1) lastIdx = idx;
      }

      // Calculate fitness (0-1)
      const matchingSteps = idealProcess.filter((a) => activities.includes(a)).length;
      const fitness = matchingSteps / idealProcess.length;

      const conformant = deviations.length === 0;
      if (conformant) conformantCount++;

      results.push({
        caseId,
        actualPath: actualStr,
        conformant,
        deviations,
        fitness: Math.round(fitness * 100) / 100,
      });
    }

    const totalCases = caseEvents.size;

    res.json({
      idealProcess: idealStr,
      totalCases,
      conformantCases: conformantCount,
      nonConformantCases: totalCases - conformantCount,
      conformanceRate: totalCases > 0 ? Math.round((conformantCount / totalCases) * 10000) / 100 : 0,
      cases: results,
    });
  } catch (err) {
    next(err);
  }
});

// ─── Process Variants Discovery ───────────────────────────────────────
router.get("/variants", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const events = await prisma.processEvent.findMany({
      where: { tenantId },
      orderBy: { timestamp: "asc" },
    });

    const caseEvents = new Map<string, { activities: string[]; first: Date; last: Date }>();
    for (const e of events) {
      const existing = caseEvents.get(e.caseId);
      if (!existing) {
        caseEvents.set(e.caseId, { activities: [e.activity], first: e.timestamp, last: e.timestamp });
      } else {
        existing.activities.push(e.activity);
        if (e.timestamp > existing.last) existing.last = e.timestamp;
      }
    }

    const variantMap = new Map<string, { count: number; avgDuration: number; caseIds: string[] }>();
    for (const [caseId, data] of caseEvents.entries()) {
      const key = data.activities.join(" → ");
      const duration = (data.last.getTime() - data.first.getTime()) / 1000;
      const existing = variantMap.get(key);
      if (!existing) {
        variantMap.set(key, { count: 1, avgDuration: duration, caseIds: [caseId] });
      } else {
        existing.avgDuration = (existing.avgDuration * existing.count + duration) / (existing.count + 1);
        existing.count++;
        if (existing.caseIds.length < 5) existing.caseIds.push(caseId);
      }
    }

    const variants = Array.from(variantMap.entries())
      .map(([path, data]) => ({
        path,
        steps: path.split(" → "),
        count: data.count,
        percentage: caseEvents.size > 0 ? Math.round((data.count / caseEvents.size) * 10000) / 100 : 0,
        avgDurationSec: Math.round(data.avgDuration),
        sampleCaseIds: data.caseIds,
      }))
      .sort((a, b) => b.count - a.count);

    res.json({ totalCases: caseEvents.size, totalVariants: variants.length, variants });
  } catch (err) {
    next(err);
  }
});

// ─── Social Network Analysis (resource handover) ──────────────────────
router.get("/social-network", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const events = await prisma.processEvent.findMany({
      where: { tenantId, resource: { not: null } },
      orderBy: { timestamp: "asc" },
    });

    const caseEvents = new Map<string, Array<{ resource: string; activity: string }>>();
    for (const e of events) {
      if (!e.resource) continue;
      if (!caseEvents.has(e.caseId)) caseEvents.set(e.caseId, []);
      caseEvents.get(e.caseId)!.push({ resource: e.resource, activity: e.activity });
    }

    const handovers = new Map<string, number>();
    for (const caseEvts of caseEvents.values()) {
      for (let i = 0; i < caseEvts.length - 1; i++) {
        if (caseEvts[i].resource !== caseEvts[i + 1].resource) {
          const key = `${caseEvts[i].resource} → ${caseEvts[i + 1].resource}`;
          handovers.set(key, (handovers.get(key) || 0) + 1);
        }
      }
    }

    const nodes = new Set<string>();
    const edges = Array.from(handovers.entries()).map(([key, count]) => {
      const [from, to] = key.split(" → ");
      nodes.add(from);
      nodes.add(to);
      return { from, to, count };
    });

    res.json({
      nodes: Array.from(nodes),
      edges: edges.sort((a, b) => b.count - a.count),
    });
  } catch (err) {
    next(err);
  }
});

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}min`;
  if (ms < 86400000) return `${(ms / 3600000).toFixed(1)}h`;
  return `${(ms / 86400000).toFixed(1)}d`;
}

export default router;
