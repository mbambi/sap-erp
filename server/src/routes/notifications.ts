import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authenticate } from "../middleware/auth";

const router = Router();
router.use(authenticate);

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const userId = req.user!.userId;
    const unreadOnly = req.query.unread === "true";
    const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
    const offset = parseInt(req.query.offset as string) || 0;

    const where: any = { tenantId, userId };
    if (unreadOnly) where.isRead = false;

    const [data, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { tenantId, userId, isRead: false } }),
    ]);

    res.json({ data, total, unreadCount });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/read", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const userId = req.user!.userId;

    const notification = await prisma.notification.findUnique({
      where: { id: req.params.id },
    });
    if (!notification || notification.tenantId !== tenantId || notification.userId !== userId) {
      return res.status(404).json({ error: { message: "Notification not found" } });
    }

    const updated = await prisma.notification.update({
      where: { id: req.params.id },
      data: { isRead: true },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.post("/read-all", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const userId = req.user!.userId;

    await prisma.notification.updateMany({
      where: { tenantId, userId, isRead: false },
      data: { isRead: true },
    });

    res.json({ message: "All notifications marked as read" });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const userId = req.user!.userId;

    const notification = await prisma.notification.findUnique({
      where: { id: req.params.id },
    });
    if (!notification || notification.tenantId !== tenantId || notification.userId !== userId) {
      return res.status(404).json({ error: { message: "Notification not found" } });
    }

    await prisma.notification.delete({ where: { id: req.params.id } });
    res.json({ message: "Notification deleted" });
  } catch (err) {
    next(err);
  }
});

export default router;
