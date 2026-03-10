import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authenticate } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

const router = Router();
router.use(authenticate);

const XP_PER_LEVEL = 100;

// GET /my-xp - get current user's XP and level
router.get("/my-xp", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const tenantId = req.user!.tenantId;
    let userXP = await prisma.userXP.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
    });
    if (!userXP) {
      userXP = await prisma.userXP.create({
        data: { userId, tenantId, totalXP: 0, level: 1, streak: 0 },
      });
    }
    res.json(userXP);
  } catch (err) {
    next(err);
  }
});

// POST /award-xp - award XP to current user
router.post("/award-xp", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const tenantId = req.user!.tenantId;
    const { amount, reason } = req.body;
    if (amount == null || amount < 0) throw new AppError(400, "amount (non-negative) is required");

    let userXP = await prisma.userXP.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
    });
    if (!userXP) {
      userXP = await prisma.userXP.create({
        data: { userId, tenantId, totalXP: 0, level: 1, streak: 0 },
      });
    }

    const today = new Date().toISOString().slice(0, 10);
    const lastDate = userXP.lastActivityDate?.toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    let newStreak = userXP.streak;
    if (lastDate === yesterday) newStreak += 1;
    else if (lastDate !== today) newStreak = 1;

    const newTotalXP = userXP.totalXP + amount;
    const newLevel = Math.floor(newTotalXP / XP_PER_LEVEL) + 1;

    const updated = await prisma.userXP.update({
      where: { userId_tenantId: { userId, tenantId } },
      data: {
        totalXP: newTotalXP,
        level: newLevel,
        streak: newStreak,
        lastActivityDate: new Date(),
      },
    });

    // Check achievements
    const achievements = await prisma.achievement.findMany();
    const unlocked = await prisma.userAchievement.findMany({
      where: { userId },
      select: { achievementId: true },
    });
    const unlockedIds = new Set(unlocked.map((u) => u.achievementId));
    for (const a of achievements) {
      if (unlockedIds.has(a.id)) continue;
      try {
        const cond = JSON.parse(a.condition || "{}");
        if (cond.totalXP != null && newTotalXP >= cond.totalXP) {
          await prisma.userAchievement.create({
            data: { userId, achievementId: a.id },
          });
          await prisma.userXP.update({
            where: { userId_tenantId: { userId, tenantId } },
            data: { totalXP: { increment: a.xpReward } },
          });
        }
      } catch {
        // ignore invalid condition JSON
      }
    }

    res.json({ ...updated, reason });
  } catch (err) {
    next(err);
  }
});

// GET /leaderboard - top 20 users by XP in tenant
router.get("/leaderboard", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const userXPs = await prisma.userXP.findMany({
      where: { tenantId },
      orderBy: { totalXP: "desc" },
      take: 20,
    });
    const userIds = userXPs.map((u) => u.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds }, tenantId },
    });
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
    const result = userXPs.map((uxp) => {
      const u = userMap[uxp.userId];
      return {
        userId: uxp.userId,
        firstName: u?.firstName ?? "",
        lastName: u?.lastName ?? "",
        totalXP: uxp.totalXP,
        level: uxp.level,
      };
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /achievements - list all achievements with user's unlock status
router.get("/achievements", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const achievements = await prisma.achievement.findMany();
    const unlocked = await prisma.userAchievement.findMany({
      where: { userId },
      include: { achievement: true },
    });
    const unlockedMap = Object.fromEntries(unlocked.map((u) => [u.achievementId, u.unlockedAt]));
    const result = achievements.map((a) => ({
      ...a,
      unlocked: !!unlockedMap[a.id],
      unlockedAt: unlockedMap[a.id] ?? null,
    }));
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /check-achievements - check and unlock earned achievements
router.post("/check-achievements", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const tenantId = req.user!.tenantId;
    const userXP = await prisma.userXP.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
    });
    const totalXP = userXP?.totalXP ?? 0;

    const achievements = await prisma.achievement.findMany();
    const unlocked = await prisma.userAchievement.findMany({
      where: { userId },
      select: { achievementId: true },
    });
    const unlockedIds = new Set(unlocked.map((u) => u.achievementId));
    const newlyUnlocked: string[] = [];

    for (const a of achievements) {
      if (unlockedIds.has(a.id)) continue;
      try {
        const cond = JSON.parse(a.condition || "{}");
        if (cond.totalXP != null && totalXP >= cond.totalXP) {
          await prisma.userAchievement.create({
            data: { userId, achievementId: a.id },
          });
          newlyUnlocked.push(a.code);
        }
      } catch {
        // ignore
      }
    }

    res.json({ newlyUnlocked });
  } catch (err) {
    next(err);
  }
});

// GET /my-achievements - list user's unlocked achievements
router.get("/my-achievements", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const userAchievements = await prisma.userAchievement.findMany({
      where: { userId },
      include: { achievement: true },
      orderBy: { unlockedAt: "desc" },
    });
    res.json(userAchievements.map((ua) => ({ ...ua.achievement, unlockedAt: ua.unlockedAt })));
  } catch (err) {
    next(err);
  }
});

export default router;
