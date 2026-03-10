import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authenticate } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

const router = Router();
router.use(authenticate);

// ─── Pre-built Crisis Scenarios ───────────────────────────────────────

const SCENARIOS = [
  {
    id: "supplier-delay",
    name: "Supplier Delay Crisis",
    description: "Key supplier delays all deliveries by 3 weeks due to factory fire",
    totalDays: 60,
    events: [
      { day: 1, type: "normal", description: "Business as usual — orders flowing normally" },
      { day: 5, type: "crisis", description: "Supplier Alpha reports factory fire — all shipments delayed 3 weeks", impact: { supplierDelay: 21, affectedMaterials: ["M-100", "M-101", "M-102"] } },
      { day: 6, type: "effect", description: "MRP generates urgent planned orders for alternate suppliers" },
      { day: 10, type: "effect", description: "Safety stock depleted for M-100, production line at risk" },
      { day: 14, type: "decision_point", description: "Decision: Expedite from alternate supplier at 2x cost or wait?", options: ["expedite", "wait", "partial_expedite"] },
      { day: 21, type: "effect", description: "Production Order PO-001 delayed — downstream sales orders affected" },
      { day: 26, type: "recovery", description: "Partial shipment arrives from alternate supplier" },
      { day: 35, type: "recovery", description: "Original supplier resumes at 50% capacity" },
      { day: 50, type: "recovery", description: "Full supply restored — backlog clearing begins" },
      { day: 60, type: "resolution", description: "All backlogs cleared — lessons learned review" },
    ],
  },
  {
    id: "demand-spike",
    name: "Demand Spike",
    description: "Unexpected 300% demand increase from viral product trend",
    totalDays: 45,
    events: [
      { day: 1, type: "normal", description: "Steady-state demand at 100 units/day" },
      { day: 5, type: "crisis", description: "Social media trend causes 300% demand spike for Product FG-001" },
      { day: 6, type: "effect", description: "Current inventory covers only 2 days of elevated demand" },
      { day: 7, type: "effect", description: "Warehouse stock exhausted — backorders accumulating" },
      { day: 8, type: "decision_point", description: "Decision: Increase production shifts or outsource?", options: ["overtime", "outsource", "ration_orders"] },
      { day: 10, type: "effect", description: "Customer complaints rising — service level drops to 45%" },
      { day: 15, type: "effect", description: "Raw material shortage detected — suppliers can't keep up" },
      { day: 20, type: "recovery", description: "Overtime production starts delivering extra output" },
      { day: 30, type: "recovery", description: "Demand stabilizes at 150% of original (new baseline)" },
      { day: 45, type: "resolution", description: "New production capacity established, service level restored" },
    ],
  },
  {
    id: "machine-failure",
    name: "Critical Machine Failure",
    description: "Main CNC machine breaks down — single point of failure in production",
    totalDays: 30,
    events: [
      { day: 1, type: "normal", description: "CNC-1 running at 85% utilization" },
      { day: 3, type: "crisis", description: "CNC-1 catastrophic bearing failure — estimated 2-week repair" },
      { day: 3, type: "effect", description: "3 production orders cannot proceed — all depend on CNC-1" },
      { day: 4, type: "decision_point", description: "Decision: Outsource machining, rush-repair, or reschedule?", options: ["outsource_machining", "rush_repair", "reschedule_orders"] },
      { day: 5, type: "effect", description: "Downstream assembly starved of machined components" },
      { day: 7, type: "effect", description: "Sales orders SO-001, SO-002 delivery dates at risk" },
      { day: 10, type: "effect", description: "Customer notified of potential delays" },
      { day: 14, type: "recovery", description: "CNC-2 reconfigured to handle critical operations (reduced throughput)" },
      { day: 21, type: "recovery", description: "CNC-1 repair completed — testing begins" },
      { day: 25, type: "recovery", description: "CNC-1 back to full production" },
      { day: 30, type: "resolution", description: "All delayed orders fulfilled — preventive maintenance plan created" },
    ],
  },
  {
    id: "quality-recall",
    name: "Quality Recall Event",
    description: "Batch quality failure triggers product recall affecting multiple customers",
    totalDays: 40,
    events: [
      { day: 1, type: "normal", description: "Production running with standard quality checks" },
      { day: 4, type: "crisis", description: "QM inspection finds defective batch — 500 units shipped to 8 customers" },
      { day: 5, type: "effect", description: "Recall initiated — reverse logistics activated" },
      { day: 5, type: "decision_point", description: "Decision: Full recall, selective recall, or customer-by-customer assessment?", options: ["full_recall", "selective_recall", "assess_each"] },
      { day: 7, type: "effect", description: "Root cause identified: contaminated raw material from Supplier Beta" },
      { day: 10, type: "effect", description: "200 units returned so far — rework assessment underway" },
      { day: 15, type: "effect", description: "Non-conformance report filed against Supplier Beta" },
      { day: 20, type: "recovery", description: "Replacement batch produced and quality-verified" },
      { day: 30, type: "recovery", description: "All recalled units replaced — customer satisfaction follow-up" },
      { day: 40, type: "resolution", description: "Corrective actions implemented — supplier audit completed" },
    ],
  },
  {
    id: "multi-crisis",
    name: "Perfect Storm (Multi-Crisis)",
    description: "Simultaneous supplier delay + demand spike + quality issue",
    totalDays: 60,
    events: [
      { day: 1, type: "normal", description: "All systems operational" },
      { day: 5, type: "crisis", description: "Supplier Alpha delays deliveries by 2 weeks" },
      { day: 8, type: "crisis", description: "Major customer doubles order quantity unexpectedly" },
      { day: 10, type: "decision_point", description: "Decision: How to prioritize with constrained resources?", options: ["prioritize_existing", "split_allocation", "strategic_triage"] },
      { day: 12, type: "crisis", description: "Quality issue found in current production batch" },
      { day: 15, type: "effect", description: "Service level drops to 30% — multiple customers affected" },
      { day: 20, type: "effect", description: "Cash flow pressure from delayed revenue + expediting costs" },
      { day: 25, type: "decision_point", description: "Decision: Seek emergency financing or reduce scope?", options: ["emergency_credit", "reduce_scope", "renegotiate_terms"] },
      { day: 30, type: "recovery", description: "Alternate supplier onboarded — partial supply restored" },
      { day: 40, type: "recovery", description: "Quality issue resolved — production resumes" },
      { day: 50, type: "recovery", description: "Demand stabilizing — fulfillment catching up" },
      { day: 60, type: "resolution", description: "Full recovery — risk mitigation plan established" },
    ],
  },
];

// GET /scenarios - list available replay scenarios
router.get("/scenarios", (_req: Request, res: Response) => {
  res.json(SCENARIOS.map(({ id, name, description, totalDays, events }) => ({
    id, name, description, totalDays, eventCount: events.length,
    crisisCount: events.filter((e) => e.type === "crisis").length,
    decisionPoints: events.filter((e) => e.type === "decision_point").length,
  })));
});

// GET /scenarios/:id - get full scenario
router.get("/scenarios/:id", (req: Request, res: Response) => {
  const scenario = SCENARIOS.find((s) => s.id === req.params.id);
  if (!scenario) return res.status(404).json({ error: "Scenario not found" });
  res.json(scenario);
});

// POST /scenarios/:id/play - simulate a scenario with decisions
router.post("/scenarios/:id/play", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const scenario = SCENARIOS.find((s) => s.id === req.params.id);
    if (!scenario) throw new AppError(404, "Scenario not found");

    const { decisions = {} } = req.body as { decisions?: Record<number, string> };

    // Simulate the scenario day by day
    const timeline: Array<{
      day: number;
      events: typeof scenario.events;
      metrics: { serviceLevel: number; cost: number; inventory: number; backorders: number };
      decision?: { chosen: string; impact: string };
    }> = [];

    let serviceLevel = 98;
    let cost = 0;
    let inventory = 1000;
    let backorders = 0;

    for (let day = 1; day <= scenario.totalDays; day++) {
      const dayEvents = scenario.events.filter((e) => e.day === day);
      const dailyCost = inventory * 0.5; // holding cost
      cost += dailyCost;

      // Apply event effects
      for (const event of dayEvents) {
        if (event.type === "crisis") {
          serviceLevel = Math.max(0, serviceLevel - 15 - Math.random() * 10);
          inventory = Math.max(0, inventory * 0.7);
          backorders += Math.round(30 + Math.random() * 50);
        } else if (event.type === "effect") {
          serviceLevel = Math.max(0, serviceLevel - 3);
          cost += 500 + Math.random() * 1000;
        } else if (event.type === "decision_point") {
          const decision = decisions[day];
          if (decision) {
            // Different decisions have different outcomes
            if (decision.includes("expedite") || decision.includes("overtime") || decision.includes("rush") || decision.includes("outsource")) {
              cost += 5000;
              serviceLevel = Math.min(100, serviceLevel + 8);
              inventory += 200;
            } else if (decision.includes("wait") || decision.includes("reduce")) {
              serviceLevel = Math.max(0, serviceLevel - 5);
              backorders += 20;
            } else {
              cost += 2000;
              serviceLevel = Math.min(100, serviceLevel + 3);
              inventory += 80;
            }
          }
        } else if (event.type === "recovery") {
          serviceLevel = Math.min(100, serviceLevel + 5 + Math.random() * 5);
          inventory += 100 + Math.random() * 150;
          backorders = Math.max(0, backorders - 15);
        } else if (event.type === "resolution") {
          serviceLevel = Math.min(100, serviceLevel + 10);
          backorders = 0;
        }
      }

      // Natural daily changes
      inventory = Math.max(0, inventory - 20 + Math.random() * 10);
      if (inventory < 50) backorders += Math.round(5 + Math.random() * 10);

      if (dayEvents.length > 0 || day % 5 === 0) {
        timeline.push({
          day,
          events: dayEvents,
          metrics: {
            serviceLevel: Math.round(serviceLevel * 100) / 100,
            cost: Math.round(cost),
            inventory: Math.round(inventory),
            backorders,
          },
          ...(dayEvents.some((e) => e.type === "decision_point") && decisions[day]
            ? { decision: { chosen: decisions[day], impact: "Applied" } }
            : {}),
        });
      }
    }

    // Score the student's performance
    const avgServiceLevel = timeline.reduce((s, t) => s + t.metrics.serviceLevel, 0) / timeline.length;
    const finalCost = cost;
    const score = Math.round(
      avgServiceLevel * 0.4 +
      Math.max(0, 100 - finalCost / 500) * 0.3 +
      Math.max(0, 100 - backorders) * 0.3
    );

    res.json({
      scenario: { id: scenario.id, name: scenario.name },
      timeline,
      score: {
        overall: Math.min(100, Math.max(0, score)),
        serviceLevel: Math.round(avgServiceLevel * 100) / 100,
        totalCost: Math.round(finalCost),
        finalBackorders: backorders,
        decisionsCount: Object.keys(decisions).length,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /replay - replay recorded ERP events with controls
router.post("/replay", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { fromDay = 1, toDay, speed = 1, entityTypes } = req.body as {
      fromDay?: number;
      toDay?: number;
      speed?: number;
      entityTypes?: string[];
    };

    const where: any = {
      tenantId,
      ...(fromDay != null || toDay != null ? {
        simulationDay: {
          ...(fromDay != null ? { gte: fromDay } : {}),
          ...(toDay != null ? { lte: toDay } : {}),
        },
      } : {}),
      ...(entityTypes?.length ? { entityType: { in: entityTypes } } : {}),
    };

    const events = await prisma.eRPEvent.findMany({
      where,
      orderBy: [{ simulationDay: "asc" }, { timestamp: "asc" }],
    });

    // Group events by day for frame-by-frame replay
    const frames: Record<number, typeof events> = {};
    for (const ev of events) {
      const day = ev.simulationDay ?? 0;
      if (!frames[day]) frames[day] = [];
      frames[day].push(ev);
    }

    const sortedDays = Object.keys(frames).map(Number).sort((a, b) => a - b);

    // Build state snapshots at each frame
    const snapshots = sortedDays.map((day) => {
      const dayEvents = frames[day];
      const entities: Record<string, unknown> = {};
      for (const ev of dayEvents) {
        try {
          entities[`${ev.entityType}:${ev.entityId}`] = typeof ev.payload === "string" ? JSON.parse(ev.payload) : ev.payload;
        } catch {
          entities[`${ev.entityType}:${ev.entityId}`] = ev.payload;
        }
      }
      return {
        day,
        eventCount: dayEvents.length,
        types: [...new Set(dayEvents.map((e) => e.eventType))],
        entities,
      };
    });

    res.json({
      totalFrames: snapshots.length,
      totalEvents: events.length,
      dayRange: { from: sortedDays[0] ?? 0, to: sortedDays[sortedDays.length - 1] ?? 0 },
      speed,
      frames: snapshots,
    });
  } catch (err) {
    next(err);
  }
});

// GET /replay/entity-types - list entity types for filtering
router.get("/replay/entity-types", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const events = await prisma.eRPEvent.findMany({
      where: { tenantId },
      select: { entityType: true },
      distinct: ["entityType"],
    });
    res.json(events.map((e) => e.entityType));
  } catch (err) {
    next(err);
  }
});

export default router;
