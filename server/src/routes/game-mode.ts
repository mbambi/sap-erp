import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authenticate, requireRoles } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

const router = Router();
router.use(authenticate);

router.get("/sessions", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const status = req.query.status as string | undefined;
    const where: any = { tenantId };
    if (status) where.status = status;

    const sessions = await prisma.gameSession.findMany({
      where,
      include: { players: true },
      orderBy: { createdAt: "desc" },
    });

    res.json(sessions.map((s) => ({
      ...s,
      playerCount: s.players.length,
      settings: JSON.parse(s.settings || "{}"),
    })));
  } catch (err) {
    next(err);
  }
});

router.post("/sessions", requireRoles("admin", "instructor"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const userId = req.user!.userId;
    const { name, description, duration = 30, settings = {} } = req.body;

    if (!name) throw new AppError(400, "Game name is required");

    const session = await prisma.gameSession.create({
      data: {
        tenantId,
        name,
        description,
        duration,
        settings: JSON.stringify({
          difficulty: "medium",
          eventsEnabled: true,
          demandVolatility: 0.3,
          supplierReliability: 0.85,
          machineFailureRate: 0.05,
          ...settings,
        }),
        createdBy: userId,
      },
    });

    res.status(201).json(session);
  } catch (err) {
    next(err);
  }
});

router.post("/sessions/:id/join", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const userId = req.user!.userId;
    const { companyName } = req.body;

    const session = await prisma.gameSession.findUnique({
      where: { id: req.params.id },
    });
    if (!session || session.tenantId !== tenantId) {
      throw new AppError(404, "Game session not found");
    }
    if (session.status !== "lobby") {
      throw new AppError(400, "Game has already started");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });

    const player = await prisma.gamePlayer.upsert({
      where: { gameSessionId_userId: { gameSessionId: session.id, userId } },
      update: { companyName: companyName || `${user?.firstName}'s Corp` },
      create: {
        gameSessionId: session.id,
        userId,
        companyName: companyName || `${user?.firstName}'s Corp`,
      },
    });

    res.json(player);
  } catch (err) {
    next(err);
  }
});

router.post("/sessions/:id/start", requireRoles("admin", "instructor"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const session = await prisma.gameSession.findUnique({
      where: { id: req.params.id },
      include: { players: true },
    });
    if (!session || session.tenantId !== tenantId) {
      throw new AppError(404, "Game session not found");
    }
    if (session.status !== "lobby") {
      throw new AppError(400, "Game is not in lobby state");
    }
    if (session.players.length < 1) {
      throw new AppError(400, "Need at least 1 player to start");
    }

    const updated = await prisma.gameSession.update({
      where: { id: session.id },
      data: { status: "active", startDate: new Date(), currentDay: 1 },
      include: { players: true },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.post("/sessions/:id/advance-day", requireRoles("admin", "instructor"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const session = await prisma.gameSession.findUnique({
      where: { id: req.params.id },
      include: { players: true },
    });
    if (!session || session.tenantId !== tenantId) {
      throw new AppError(404, "Game session not found");
    }
    if (session.status !== "active") {
      throw new AppError(400, "Game is not active");
    }

    const newDay = session.currentDay + 1;
    const settings = JSON.parse(session.settings || "{}");

    // Generate random events for this day
    const events: any[] = [];
    if (settings.eventsEnabled) {
      if (Math.random() < (settings.demandVolatility ?? 0.3)) {
        events.push({
          type: "demand_spike",
          severity: Math.random() > 0.5 ? "high" : "medium",
          description: `Unexpected demand surge on day ${newDay}`,
        });
      }
      if (Math.random() < (settings.machineFailureRate ?? 0.05)) {
        events.push({
          type: "machine_breakdown",
          severity: "high",
          description: `Machine breakdown reported on day ${newDay}`,
        });
      }
      if (Math.random() > (settings.supplierReliability ?? 0.85)) {
        events.push({
          type: "supplier_delay",
          severity: "medium",
          description: `Supplier shipment delayed on day ${newDay}`,
        });
      }
    }

    // Update player scores based on their current data
    for (const player of session.players) {
      const revenue = player.revenue + (Math.random() * 5000);
      const cost = player.totalCost + (Math.random() * 3000);
      const profit = revenue - cost;
      const inventoryTurnover = 3 + Math.random() * 9;
      const serviceLevel = Math.max(50, player.serviceLevel - Math.random() * 5 + Math.random() * 8);
      const cashFlow = profit * 0.8;
      const onTimeDelivery = Math.max(60, player.onTimeDelivery - Math.random() * 3 + Math.random() * 5);
      const qualityScore = Math.max(70, player.qualityScore - Math.random() * 2 + Math.random() * 3);

      const overallScore = (
        (profit / Math.max(revenue, 1)) * 30 +
        (inventoryTurnover / 12) * 20 +
        (serviceLevel / 100) * 25 +
        (onTimeDelivery / 100) * 15 +
        (qualityScore / 100) * 10
      );

      await prisma.gamePlayer.update({
        where: { id: player.id },
        data: {
          revenue,
          totalCost: cost,
          profit,
          inventoryTurnover,
          serviceLevel,
          cashFlow,
          onTimeDelivery,
          qualityScore,
          overallScore,
        },
      });
    }

    // Update rankings
    const ranked = await prisma.gamePlayer.findMany({
      where: { gameSessionId: session.id },
      orderBy: { overallScore: "desc" },
    });
    for (let i = 0; i < ranked.length; i++) {
      await prisma.gamePlayer.update({
        where: { id: ranked[i].id },
        data: { rank: i + 1 },
      });
    }

    const isComplete = newDay >= session.duration;
    await prisma.gameSession.update({
      where: { id: session.id },
      data: {
        currentDay: newDay,
        status: isComplete ? "completed" : "active",
        ...(isComplete && { endDate: new Date() }),
      },
    });

    const updatedPlayers = await prisma.gamePlayer.findMany({
      where: { gameSessionId: session.id },
      orderBy: { rank: "asc" },
    });

    res.json({ day: newDay, events, players: updatedPlayers, isComplete });
  } catch (err) {
    next(err);
  }
});

router.get("/leaderboard", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const sessionId = req.query.sessionId as string;

    if (!sessionId) throw new AppError(400, "sessionId required");

    const session = await prisma.gameSession.findUnique({
      where: { id: sessionId },
    });
    if (!session || session.tenantId !== tenantId) {
      throw new AppError(404, "Game session not found");
    }

    const players = await prisma.gamePlayer.findMany({
      where: { gameSessionId: sessionId },
      orderBy: { overallScore: "desc" },
    });

    // Fetch user names
    const userIds = players.map((p) => p.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

    res.json({
      session: {
        id: session.id,
        name: session.name,
        status: session.status,
        currentDay: session.currentDay,
        totalDays: session.duration,
      },
      leaderboard: players.map((p, idx) => ({
        rank: idx + 1,
        userId: p.userId,
        userName: userMap[p.userId]
          ? `${userMap[p.userId].firstName} ${userMap[p.userId].lastName}`
          : "Unknown",
        companyName: p.companyName,
        revenue: Math.round(p.revenue),
        profit: Math.round(p.profit),
        inventoryTurnover: Math.round(p.inventoryTurnover * 10) / 10,
        serviceLevel: Math.round(p.serviceLevel * 10) / 10,
        onTimeDelivery: Math.round(p.onTimeDelivery * 10) / 10,
        qualityScore: Math.round(p.qualityScore * 10) / 10,
        overallScore: Math.round(p.overallScore * 10) / 10,
      })),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
