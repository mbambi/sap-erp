import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authenticate } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

const router = Router();
router.use(authenticate);

const tenantScope = (req: Request) => req.user!.tenantId;

/** POST /record - Record an ERP event */
router.post("/record", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);
    const userId = req.user!.userId;
    const { eventType, entityType, entityId, payload, delta, simulationDay } = req.body;

    if (!eventType || !entityType || !entityId || !payload) {
      throw new AppError(400, "eventType, entityType, entityId, and payload are required");
    }

    const event = await prisma.eRPEvent.create({
      data: {
        tenantId,
        eventType,
        entityType,
        entityId,
        payload: typeof payload === "string" ? payload : JSON.stringify(payload),
        delta: delta != null ? (typeof delta === "string" ? delta : JSON.stringify(delta)) : null,
        userId,
        simulationDay: simulationDay ?? null,
      },
    });

    res.status(201).json(event);
  } catch (err) {
    next(err);
  }
});

/** GET /timeline - Get timeline of all events for tenant */
router.get("/timeline", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 25);
    const entityType = req.query.entityType as string | undefined;
    const dayFrom = req.query.dayFrom != null ? parseInt(req.query.dayFrom as string) : undefined;
    const dayTo = req.query.dayTo != null ? parseInt(req.query.dayTo as string) : undefined;

    const where: { tenantId: string; entityType?: string; simulationDay?: { gte?: number; lte?: number } } = {
      tenantId,
    };
    if (entityType) where.entityType = entityType;
    if (dayFrom != null || dayTo != null) {
      where.simulationDay = {};
      if (dayFrom != null) where.simulationDay.gte = dayFrom;
      if (dayTo != null) where.simulationDay.lte = dayTo;
    }

    const [events, total] = await Promise.all([
      prisma.eRPEvent.findMany({
        where,
        orderBy: { timestamp: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.eRPEvent.count({ where }),
    ]);

    res.json({
      data: events,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

/** GET /entity/:entityType/:entityId - Get full event history for a specific entity */
router.get("/entity/:entityType/:entityId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);
    const { entityType, entityId } = req.params;

    const events = await prisma.eRPEvent.findMany({
      where: { tenantId, entityType, entityId },
      orderBy: { timestamp: "asc" },
    });

    res.json(events);
  } catch (err) {
    next(err);
  }
});

/** GET /day/:day - Get all events for a specific simulation day */
router.get("/day/:day", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);
    const day = parseInt(req.params.day);
    if (isNaN(day)) throw new AppError(400, "Invalid day parameter");

    const events = await prisma.eRPEvent.findMany({
      where: { tenantId, simulationDay: day },
      orderBy: { timestamp: "asc" },
    });

    res.json(events);
  } catch (err) {
    next(err);
  }
});

/** POST /snapshot/:day - Reconstruct system state at a given day */
router.post("/snapshot/:day", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);
    const day = parseInt(req.params.day);
    if (isNaN(day)) throw new AppError(400, "Invalid day parameter");

    const events = await prisma.eRPEvent.findMany({
      where: { tenantId, simulationDay: { lte: day } },
      orderBy: [{ simulationDay: "asc" }, { timestamp: "asc" }],
    });

    const entities: Record<string, Record<string, unknown>> = {};
    for (const ev of events) {
      const key = `${ev.entityType}:${ev.entityId}`;
      try {
        const payload = typeof ev.payload === "string" ? JSON.parse(ev.payload) : ev.payload;
        entities[key] = payload;
      } catch {
        entities[key] = { raw: ev.payload };
      }
    }

    const grouped: Record<string, unknown[]> = {};
    for (const [key, payload] of Object.entries(entities)) {
      const [entityType] = key.split(":");
      if (!grouped[entityType]) grouped[entityType] = [];
      grouped[entityType].push(payload);
    }

    const purchase_orders = grouped["purchase_order"] || [];
    const materials = grouped["material"] || [];
    const inventory: Record<string, unknown> = {};
    for (const m of materials as { id?: string; stockQuantity?: number }[]) {
      if (m?.id) inventory[m.id] = m.stockQuantity ?? 0;
    }

    res.json({
      day,
      entities: {
        purchase_orders,
        materials,
        inventory,
        ...grouped,
      },
    });
  } catch (err) {
    next(err);
  }
});

/** GET /diff/:day1/:day2 - Compare system state between two days */
router.get("/diff/:day1/:day2", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);
    const day1 = parseInt(req.params.day1);
    const day2 = parseInt(req.params.day2);
    if (isNaN(day1) || isNaN(day2)) throw new AppError(400, "Invalid day parameters");

    const [events1, events2] = await Promise.all([
      prisma.eRPEvent.findMany({
        where: { tenantId, simulationDay: { lte: day1 } },
        orderBy: [{ simulationDay: "asc" }, { timestamp: "asc" }],
      }),
      prisma.eRPEvent.findMany({
        where: { tenantId, simulationDay: { lte: day2 } },
        orderBy: [{ simulationDay: "asc" }, { timestamp: "asc" }],
      }),
    ]);

    const buildState = (evs: typeof events1) => {
      const state: Record<string, unknown> = {};
      for (const ev of evs) {
        const key = `${ev.entityType}:${ev.entityId}`;
        try {
          state[key] = typeof ev.payload === "string" ? JSON.parse(ev.payload) : ev.payload;
        } catch {
          state[key] = ev.payload;
        }
      }
      return state;
    };

    const state1 = buildState(events1);
    const state2 = buildState(events2);

    const added: unknown[] = [];
    const modified: { key: string; before: unknown; after: unknown }[] = [];
    const removed: unknown[] = [];

    const keys1 = new Set(Object.keys(state1));
    const keys2 = new Set(Object.keys(state2));

    for (const key of keys2) {
      if (!keys1.has(key)) {
        added.push(state2[key]);
      } else if (JSON.stringify(state1[key]) !== JSON.stringify(state2[key])) {
        modified.push({ key, before: state1[key], after: state2[key] });
      }
    }
    for (const key of keys1) {
      if (!keys2.has(key)) {
        removed.push(state1[key]);
      }
    }

    res.json({ added, modified, removed });
  } catch (err) {
    next(err);
  }
});

/** POST /rewind/:day - Rewind: show state at given day plus "what if" suggestions */
router.post("/rewind/:day", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);
    const day = parseInt(req.params.day);
    if (isNaN(day)) throw new AppError(400, "Invalid day parameter");

    const events = await prisma.eRPEvent.findMany({
      where: { tenantId, simulationDay: { lte: day } },
      orderBy: [{ simulationDay: "asc" }, { timestamp: "asc" }],
    });

    const entities: Record<string, Record<string, unknown>> = {};
    for (const ev of events) {
      const key = `${ev.entityType}:${ev.entityId}`;
      try {
        entities[key] = typeof ev.payload === "string" ? JSON.parse(ev.payload) : (ev.payload as Record<string, unknown>);
      } catch {
        entities[key] = { raw: ev.payload };
      }
    }

    const whatIfSuggestions = [
      "What if you had ordered materials earlier?",
      "What if the supplier had delivered on time?",
      "What if you had increased safety stock?",
      "What if production had started sooner?",
      "What if you had negotiated better payment terms?",
    ];

    res.json({
      day,
      state: entities,
      whatIfSuggestions,
    });
  } catch (err) {
    next(err);
  }
});

/** GET /statistics - Event statistics */
router.get("/statistics", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);

    const events = await prisma.eRPEvent.findMany({
      where: { tenantId },
    });

    const byType: Record<string, number> = {};
    const byDay: Record<number, number> = {};
    const entityActivity: Record<string, number> = {};

    for (const ev of events) {
      byType[ev.eventType] = (byType[ev.eventType] || 0) + 1;
      if (ev.simulationDay != null) {
        byDay[ev.simulationDay] = (byDay[ev.simulationDay] || 0) + 1;
      }
      const key = `${ev.entityType}:${ev.entityId}`;
      entityActivity[key] = (entityActivity[key] || 0) + 1;
    }

    const mostActiveEntities = Object.entries(entityActivity)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([entity, count]) => ({ entity, count }));

    res.json({
      eventsByType: byType,
      eventsByDay: byDay,
      mostActiveEntities,
      totalEvents: events.length,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
