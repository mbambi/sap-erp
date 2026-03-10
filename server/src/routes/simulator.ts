import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authenticate } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

const router = Router();
router.use(authenticate);

const tenantScope = (req: Request) => req.user!.tenantId;

/** GET /sessions - List simulation sessions */
router.get("/sessions", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);

    const sessions = await prisma.simulationSession.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      include: { events: true },
    });

    res.json(sessions);
  } catch (err) {
    next(err);
  }
});

/** POST /sessions - Create new simulation */
router.post("/sessions", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);
    const userId = req.user!.userId;
    const {
      name,
      totalDays = 30,
      parameters = {},
    } = req.body;

    const params = {
      demandVolatility: parameters.demandVolatility ?? 0.2,
      leadTimeVariability: parameters.leadTimeVariability ?? 0.15,
      machineFailureProbability: parameters.machineFailureProbability ?? 0.05,
      transportDelay: parameters.transportDelay ?? 0.1,
    };

    const session = await prisma.simulationSession.create({
      data: {
        tenantId,
        name: name || `Simulation ${new Date().toISOString().slice(0, 10)}`,
        totalDays: Number(totalDays) || 30,
        parameters: JSON.stringify(params),
        createdBy: userId,
      },
    });

    res.status(201).json(session);
  } catch (err) {
    next(err);
  }
});

/** GET /sessions/:id - Get session details with events */
router.get("/sessions/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);
    const session = await prisma.simulationSession.findUnique({
      where: { id: req.params.id },
      include: { events: { orderBy: { day: "asc" } } },
    });

    if (!session || session.tenantId !== tenantId) {
      throw new AppError(404, "Session not found");
    }

    res.json(session);
  } catch (err) {
    next(err);
  }
});

function generateEventsForDay(
  day: number,
  params: {
    demandVolatility: number;
    leadTimeVariability: number;
    machineFailureProbability: number;
    transportDelay: number;
  }
) {
  const events: { eventType: string; severity: string; description: string; affectedEntity?: string }[] = [];

  if (Math.random() < params.demandVolatility) {
    events.push({
      eventType: "customer_order",
      severity: Math.random() > 0.5 ? "medium" : "high",
      description: `Unexpected customer order received - demand spike on day ${day}`,
      affectedEntity: `MAT-${Math.floor(Math.random() * 1000)}`,
    });
  }

  if (Math.random() < params.leadTimeVariability) {
    events.push({
      eventType: "supplier_delay",
      severity: "medium",
      description: `Supplier delivery delayed - extended lead time`,
      affectedEntity: `VND-${Math.floor(Math.random() * 100)}`,
    });
  }

  if (Math.random() < params.machineFailureProbability) {
    events.push({
      eventType: "machine_breakdown",
      severity: Math.random() > 0.7 ? "critical" : "high",
      description: `Work center breakdown - production halted`,
      affectedEntity: `WC-${Math.floor(Math.random() * 20)}`,
    });
  }

  if (Math.random() < params.transportDelay) {
    events.push({
      eventType: "transport_delay",
      severity: "low",
      description: `Transport delay - shipment delayed in transit`,
      affectedEntity: `SHP-${Math.floor(Math.random() * 500)}`,
    });
  }

  if (Math.random() < 0.08) {
    events.push({
      eventType: "quality_issue",
      severity: Math.random() > 0.6 ? "high" : "medium",
      description: `Quality defect detected in incoming materials`,
      affectedEntity: `MAT-${Math.floor(Math.random() * 1000)}`,
    });
  }

  return events;
}

/** POST /sessions/:id/start - Start simulation */
router.post("/sessions/:id/start", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);
    const session = await prisma.simulationSession.findUnique({
      where: { id: req.params.id },
    });

    if (!session || session.tenantId !== tenantId) {
      throw new AppError(404, "Session not found");
    }
    if (session.status !== "setup") {
      throw new AppError(400, "Session already started or completed");
    }

    const params = JSON.parse(session.parameters || "{}");
    const day1Events = generateEventsForDay(1, {
      demandVolatility: params.demandVolatility ?? 0.2,
      leadTimeVariability: params.leadTimeVariability ?? 0.15,
      machineFailureProbability: params.machineFailureProbability ?? 0.05,
      transportDelay: params.transportDelay ?? 0.1,
    });

    const createdEvents = await Promise.all(
      day1Events.map((e) =>
        prisma.simulationEvent.create({
          data: {
            sessionId: session.id,
            day: 1,
            eventType: e.eventType,
            severity: e.severity,
            description: e.description,
            affectedEntity: e.affectedEntity,
            parameters: JSON.stringify({ generated: true }),
          },
        })
      )
    );

    await prisma.simulationSession.update({
      where: { id: session.id },
      data: {
        status: "running",
        currentDay: 1,
        state: JSON.stringify({ day: 1, eventsGenerated: day1Events.length }),
      },
    });

    const updated = await prisma.simulationSession.findUnique({
      where: { id: session.id },
      include: { events: true },
    });

    res.json({
      session: updated,
      day1Events: createdEvents,
    });
  } catch (err) {
    next(err);
  }
});

/** POST /sessions/:id/advance - Advance to next day */
router.post("/sessions/:id/advance", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);
    const session = await prisma.simulationSession.findUnique({
      where: { id: req.params.id },
      include: { events: true },
    });

    if (!session || session.tenantId !== tenantId) {
      throw new AppError(404, "Session not found");
    }
    if (session.status !== "running") {
      throw new AppError(400, "Session is not running");
    }

    const newDay = session.currentDay + 1;
    if (newDay > session.totalDays) {
      throw new AppError(400, "Simulation already at final day");
    }

    const params = JSON.parse(session.parameters || "{}");
    const dayEvents = generateEventsForDay(newDay, {
      demandVolatility: params.demandVolatility ?? 0.2,
      leadTimeVariability: params.leadTimeVariability ?? 0.15,
      machineFailureProbability: params.machineFailureProbability ?? 0.05,
      transportDelay: params.transportDelay ?? 0.1,
    });

    const createdEvents = await Promise.all(
      dayEvents.map((e) =>
        prisma.simulationEvent.create({
          data: {
            sessionId: session.id,
            day: newDay,
            eventType: e.eventType,
            severity: e.severity,
            description: e.description,
            affectedEntity: e.affectedEntity,
            parameters: JSON.stringify({ generated: true }),
          },
        })
      )
    );

    const state = session.state ? JSON.parse(session.state) : {};
    state.day = newDay;
    state.lastAdvance = new Date().toISOString();

    await prisma.simulationSession.update({
      where: { id: session.id },
      data: {
        currentDay: newDay,
        state: JSON.stringify(state),
      },
    });

    const updated = await prisma.simulationSession.findUnique({
      where: { id: session.id },
      include: { events: { where: { day: newDay } } },
    });

    res.json({
      session: updated,
      newDay,
      events: createdEvents,
    });
  } catch (err) {
    next(err);
  }
});

/** POST /sessions/:id/respond - Student responds to an event */
router.post("/sessions/:id/respond", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);
    const { eventId, action, details } = req.body;

    const session = await prisma.simulationSession.findUnique({
      where: { id: req.params.id },
    });

    if (!session || session.tenantId !== tenantId) {
      throw new AppError(404, "Session not found");
    }

    const event = await prisma.simulationEvent.findFirst({
      where: { id: eventId, sessionId: session.id },
    });

    if (!event) throw new AppError(404, "Event not found");

    const playerResponse = JSON.stringify({ action, details, respondedAt: new Date().toISOString() });
    const resolved = ["expedite_order", "increase_stock", "contact_supplier", "activate_backup", "quality_inspection"].includes(
      String(action).toLowerCase()
    );

    await prisma.simulationEvent.update({
      where: { id: eventId },
      data: {
        playerResponse,
        resolved,
        resolvedAt: resolved ? new Date() : null,
      },
    });

    const updated = await prisma.simulationEvent.findUnique({
      where: { id: eventId },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/** POST /sessions/:id/pause - Pause simulation */
router.post("/sessions/:id/pause", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);
    const session = await prisma.simulationSession.findUnique({
      where: { id: req.params.id },
    });

    if (!session || session.tenantId !== tenantId) {
      throw new AppError(404, "Session not found");
    }
    if (session.status !== "running") {
      throw new AppError(400, "Session is not running");
    }

    const updated = await prisma.simulationSession.update({
      where: { id: session.id },
      data: { status: "paused" },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/** POST /sessions/:id/complete - Complete simulation and calculate score */
router.post("/sessions/:id/complete", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);
    const session = await prisma.simulationSession.findUnique({
      where: { id: req.params.id },
      include: { events: true },
    });

    if (!session || session.tenantId !== tenantId) {
      throw new AppError(404, "Session not found");
    }

    const events = session.events;
    const total = events.length;
    const resolved = events.filter((e) => e.resolved).length;
    const missed = total - resolved;
    const responseQuality = total > 0 ? (resolved / total) * 100 : 100;
    const criticalResolved = events.filter(
      (e) => e.severity === "critical" && e.resolved
    ).length;
    const criticalTotal = events.filter((e) => e.severity === "critical").length;
    const criticalScore = criticalTotal > 0 ? (criticalResolved / criticalTotal) * 100 : 100;

    const finalScore = Math.min(
      100,
      Math.round(
        responseQuality * 0.5 +
          criticalScore * 0.3 +
          (total > 0 ? Math.max(0, 100 - missed * 5) * 0.2 : 20)
      )
    );

    const results = {
      eventsTotal: total,
      eventsResolved: resolved,
      eventsMissed: missed,
      responseQuality,
      criticalScore,
      finalScore,
      inventoryMaintained: 85,
      ordersFulfilled: 90,
    };

    const updated = await prisma.simulationSession.update({
      where: { id: session.id },
      data: {
        status: "completed",
        results: JSON.stringify(results),
      },
    });

    res.json({ session: updated, results });
  } catch (err) {
    next(err);
  }
});

/** GET /sessions/:id/scoreboard - Return scoring details */
router.get("/sessions/:id/scoreboard", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);
    const session = await prisma.simulationSession.findUnique({
      where: { id: req.params.id },
      include: { events: true },
    });

    if (!session || session.tenantId !== tenantId) {
      throw new AppError(404, "Session not found");
    }

    const events = session.events;
    const total = events.length;
    const resolved = events.filter((e) => e.resolved).length;
    const missed = total - resolved;
    const responseQuality = total > 0 ? (resolved / total) * 100 : 100;

    let finalScore = 0;
    if (session.results) {
      try {
        const r = JSON.parse(session.results);
        finalScore = r.finalScore ?? 0;
      } catch {
        finalScore = Math.round(responseQuality);
      }
    } else {
      finalScore = Math.round(responseQuality);
    }

    res.json({
      eventsTotal: total,
      eventsResolved: resolved,
      eventsMissed: missed,
      responseQuality,
      finalScore: Math.min(100, finalScore),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
