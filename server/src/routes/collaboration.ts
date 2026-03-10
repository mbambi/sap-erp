import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authenticate } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

const router = Router();
router.use(authenticate);

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

// POST /heartbeat - update user presence
router.post("/heartbeat", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const userId = req.user!.userId;
    const { currentPage, currentAction } = req.body;
    const roles = req.user!.roles;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });
    const userName = user ? `${user.firstName} ${user.lastName}` : "Unknown";
    await prisma.userPresence.upsert({
      where: { tenantId_userId: { tenantId, userId } },
      create: {
        tenantId,
        userId,
        userName,
        currentPage: currentPage ?? null,
        currentAction: currentAction ?? null,
        role: roles[0] ?? null,
        isOnline: true,
        lastSeen: new Date(),
      },
      update: {
        currentPage: currentPage ?? undefined,
        currentAction: currentAction ?? undefined,
        role: roles[0] ?? undefined,
        isOnline: true,
        lastSeen: new Date(),
      },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// GET /online - list online users (lastSeen within 5 min)
router.get("/online", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const threshold = new Date(Date.now() - ONLINE_THRESHOLD_MS);
    const users = await prisma.userPresence.findMany({
      where: { tenantId, isOnline: true, lastSeen: { gte: threshold } },
      select: { userId: true, userName: true, currentPage: true, role: true, lastSeen: true },
    });
    res.json(users);
  } catch (err) {
    next(err);
  }
});

// GET /activity-feed - recent ERP actions (last 20 AuditLog)
router.get("/activity-feed", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const logs = await prisma.auditLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { user: { select: { firstName: true, lastName: true } } },
    });
    const feed = logs.map((l) => ({
      user: l.user ? `${l.user.firstName} ${l.user.lastName}` : "System",
      action: l.action,
      entity: `${l.module}/${l.resource}`,
      entityId: l.resourceId,
      time: l.createdAt,
    }));
    res.json(feed);
  } catch (err) {
    next(err);
  }
});

// POST /offline - mark current user offline
router.post("/offline", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const userId = req.user!.userId;
    await prisma.userPresence.updateMany({
      where: { tenantId, userId },
      data: { isOnline: false },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
