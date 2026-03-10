import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authenticate, requireRoles } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";
import { eventBus } from "../services/eventBus";

const router = Router();
router.use(authenticate);

// ─── Roles for multi-user simulation ──────────────────────────────────
const SIMULATION_ROLES = [
  { role: "procurement_manager", label: "Procurement Manager", permissions: ["create_pr", "create_po", "manage_vendors"] },
  { role: "production_planner", label: "Production Planner", permissions: ["create_production_order", "manage_bom", "run_mrp"] },
  { role: "warehouse_operator", label: "Warehouse Operator", permissions: ["goods_receipt", "goods_issue", "stock_transfer"] },
  { role: "finance_controller", label: "Finance Controller", permissions: ["post_invoice", "execute_payment", "journal_entry"] },
  { role: "sales_manager", label: "Sales Manager", permissions: ["create_sales_order", "manage_customers", "create_delivery"] },
  { role: "quality_inspector", label: "Quality Inspector", permissions: ["create_inspection", "record_results", "non_conformance"] },
];

// In-memory simulation sessions
const activeSessions = new Map<string, {
  id: string;
  tenantId: string;
  name: string;
  createdBy: string;
  startedAt: Date;
  players: Array<{
    userId: string;
    userName: string;
    role: string;
    joinedAt: Date;
    actions: Array<{ action: string; timestamp: Date; details: string }>;
  }>;
  events: Array<{ type: string; userId: string; timestamp: Date; description: string }>;
  status: "waiting" | "active" | "paused" | "completed";
  scenario?: string;
}>();

// GET /roles — list simulation roles
router.get("/roles", (_req: Request, res: Response) => {
  res.json(SIMULATION_ROLES);
});

// POST /sessions — create a simulation session
router.post("/sessions", requireRoles("admin", "instructor"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const userId = req.user!.userId;
    const { name, scenario } = req.body;

    if (!name) throw new AppError(400, "name is required");

    const sessionId = `sim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const session = {
      id: sessionId,
      tenantId,
      name,
      createdBy: userId,
      startedAt: new Date(),
      players: [],
      events: [],
      status: "waiting" as const,
      scenario,
    };

    activeSessions.set(sessionId, session);

    res.status(201).json({
      sessionId,
      name,
      status: "waiting",
      availableRoles: SIMULATION_ROLES,
    });
  } catch (err) {
    next(err);
  }
});

// GET /sessions — list sessions for this tenant
router.get("/sessions", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const sessions = Array.from(activeSessions.values())
      .filter((s) => s.tenantId === tenantId)
      .map((s) => ({
        id: s.id,
        name: s.name,
        status: s.status,
        playerCount: s.players.length,
        startedAt: s.startedAt,
        scenario: s.scenario,
        players: s.players.map((p) => ({ userName: p.userName, role: p.role })),
      }));

    res.json(sessions);
  } catch (err) {
    next(err);
  }
});

// POST /sessions/:id/join — join a session with a role
router.post("/sessions/:id/join", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = activeSessions.get(req.params.id);
    if (!session) throw new AppError(404, "Session not found");
    if (session.tenantId !== req.user!.tenantId) throw new AppError(403, "Wrong tenant");

    const { role } = req.body;
    if (!role || !SIMULATION_ROLES.find((r) => r.role === role)) {
      throw new AppError(400, `Invalid role. Choose from: ${SIMULATION_ROLES.map((r) => r.role).join(", ")}`);
    }

    // Check role not taken
    if (session.players.find((p) => p.role === role)) {
      throw new AppError(409, `Role "${role}" is already taken`);
    }

    // Check user not already in session
    if (session.players.find((p) => p.userId === req.user!.userId)) {
      throw new AppError(409, "You are already in this session");
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { firstName: true, lastName: true },
    });

    session.players.push({
      userId: req.user!.userId,
      userName: user ? `${user.firstName} ${user.lastName}` : "Unknown",
      role,
      joinedAt: new Date(),
      actions: [],
    });

    session.events.push({
      type: "player_joined",
      userId: req.user!.userId,
      timestamp: new Date(),
      description: `${user?.firstName} joined as ${role}`,
    });

    res.json({
      sessionId: session.id,
      role,
      permissions: SIMULATION_ROLES.find((r) => r.role === role)?.permissions ?? [],
      players: session.players.map((p) => ({ userName: p.userName, role: p.role })),
    });
  } catch (err) {
    next(err);
  }
});

// POST /sessions/:id/start — start the simulation
router.post("/sessions/:id/start", requireRoles("admin", "instructor"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = activeSessions.get(req.params.id);
    if (!session) throw new AppError(404, "Session not found");
    if (session.tenantId !== req.user!.tenantId) throw new AppError(403, "Wrong tenant");
    if (session.players.length < 2) throw new AppError(400, "Need at least 2 players");

    session.status = "active";
    session.events.push({
      type: "simulation_started",
      userId: req.user!.userId,
      timestamp: new Date(),
      description: "Simulation started",
    });

    res.json({ status: "active", players: session.players.length });
  } catch (err) {
    next(err);
  }
});

// POST /sessions/:id/action — perform an action in the simulation
router.post("/sessions/:id/action", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = activeSessions.get(req.params.id);
    if (!session) throw new AppError(404, "Session not found");
    if (session.status !== "active") throw new AppError(400, "Session not active");

    const player = session.players.find((p) => p.userId === req.user!.userId);
    if (!player) throw new AppError(403, "You are not in this session");

    const { action, details, documentId } = req.body;
    if (!action) throw new AppError(400, "action is required");

    // Validate action against role permissions
    const roleConfig = SIMULATION_ROLES.find((r) => r.role === player.role);
    if (!roleConfig?.permissions.includes(action)) {
      throw new AppError(403, `Action "${action}" not permitted for role "${player.role}"`);
    }

    // Record action
    player.actions.push({
      action,
      timestamp: new Date(),
      details: details ?? "",
    });

    session.events.push({
      type: "action_performed",
      userId: req.user!.userId,
      timestamp: new Date(),
      description: `${player.userName} (${player.role}): ${action} — ${details ?? ""}`,
    });

    // Publish to event bus for cross-module integration
    const eventTypeMap: Record<string, string> = {
      create_po: "PurchaseOrderCreated",
      goods_receipt: "GoodsReceived",
      goods_issue: "GoodsIssued",
      create_sales_order: "SalesOrderCreated",
      create_delivery: "DeliveryCreated",
      post_invoice: "InvoicePosted",
      execute_payment: "PaymentExecuted",
      create_production_order: "ProductionOrderCreated",
    };

    const eventType = eventTypeMap[action];
    if (eventType) {
      await eventBus.publish({
        type: eventType as Parameters<typeof eventBus.publish>[0]["type"],
        tenantId: session.tenantId,
        userId: req.user!.userId,
        module: player.role,
        documentId,
        correlationId: session.id,
        payload: { simulationSession: session.id, action, details },
      });
    }

    res.json({
      action,
      timestamp: new Date(),
      sessionEvents: session.events.slice(-10),
    });
  } catch (err) {
    next(err);
  }
});

// GET /sessions/:id — get full session state
router.get("/sessions/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = activeSessions.get(req.params.id);
    if (!session) throw new AppError(404, "Session not found");
    if (session.tenantId !== req.user!.tenantId) throw new AppError(403, "Wrong tenant");

    res.json({
      id: session.id,
      name: session.name,
      status: session.status,
      startedAt: session.startedAt,
      scenario: session.scenario,
      players: session.players.map((p) => ({
        userName: p.userName,
        role: p.role,
        joinedAt: p.joinedAt,
        actionCount: p.actions.length,
        lastAction: p.actions[p.actions.length - 1] ?? null,
      })),
      recentEvents: session.events.slice(-20),
      totalEvents: session.events.length,
    });
  } catch (err) {
    next(err);
  }
});

// GET /sessions/:id/feed — real-time event feed (polling endpoint)
router.get("/sessions/:id/feed", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = activeSessions.get(req.params.id);
    if (!session) throw new AppError(404, "Session not found");
    if (session.tenantId !== req.user!.tenantId) throw new AppError(403, "Wrong tenant");

    const since = req.query.since ? new Date(req.query.since as string) : new Date(0);
    const newEvents = session.events.filter((e) => e.timestamp > since);

    res.json({
      events: newEvents,
      playerStatuses: session.players.map((p) => ({
        userName: p.userName,
        role: p.role,
        lastAction: p.actions[p.actions.length - 1],
      })),
    });
  } catch (err) {
    next(err);
  }
});

// POST /sessions/:id/end — end the simulation
router.post("/sessions/:id/end", requireRoles("admin", "instructor"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = activeSessions.get(req.params.id);
    if (!session) throw new AppError(404, "Session not found");
    if (session.tenantId !== req.user!.tenantId) throw new AppError(403, "Wrong tenant");

    session.status = "completed";

    // Generate per-player stats
    const playerStats = session.players.map((p) => ({
      userName: p.userName,
      role: p.role,
      totalActions: p.actions.length,
      actions: p.actions,
    }));

    res.json({
      status: "completed",
      duration: (Date.now() - session.startedAt.getTime()) / 1000,
      totalEvents: session.events.length,
      playerStats,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
