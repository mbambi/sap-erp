import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../prisma";
import { authenticate } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

const router = Router();
router.use(authenticate);

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const tenantId = req.user!.tenantId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: { include: { role: true } },
        tenant: { select: { name: true, university: true, slug: true } },
      },
    });
    if (!user) throw new AppError(404, "User not found");

    let profile = await prisma.userProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      profile = await prisma.userProfile.create({
        data: { userId, tenantId },
      });
    }

    const xp = await prisma.userXP.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
    });

    const achievements = await prisma.userAchievement.findMany({
      where: { userId },
      include: { achievement: true },
      orderBy: { unlockedAt: "desc" },
      take: 10,
    });

    const exerciseStats = await prisma.exerciseProgress.groupBy({
      by: ["status"],
      where: { userId },
      _count: true,
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.userRoles.map((ur) => ur.role.name),
        tenant: user.tenant,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
      },
      profile,
      gamification: {
        xp: xp?.totalXP ?? 0,
        level: xp?.level ?? 1,
        streak: xp?.streak ?? 0,
        achievements: achievements.map((a) => ({
          ...a.achievement,
          unlockedAt: a.unlockedAt,
        })),
      },
      exerciseStats: Object.fromEntries(
        exerciseStats.map((s) => [s.status, s._count])
      ),
    });
  } catch (err) {
    next(err);
  }
});

router.put("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const tenantId = req.user!.tenantId;
    const { bio, department, title, phone, timezone, language, theme, emailNotifications, dashboardLayout } = req.body;

    const profile = await prisma.userProfile.upsert({
      where: { userId },
      update: {
        ...(bio !== undefined && { bio }),
        ...(department !== undefined && { department }),
        ...(title !== undefined && { title }),
        ...(phone !== undefined && { phone }),
        ...(timezone !== undefined && { timezone }),
        ...(language !== undefined && { language }),
        ...(theme !== undefined && { theme }),
        ...(emailNotifications !== undefined && { emailNotifications }),
        ...(dashboardLayout !== undefined && { dashboardLayout: JSON.stringify(dashboardLayout) }),
      },
      create: { userId, tenantId, bio, department, title, phone, timezone, language, theme },
    });

    res.json(profile);
  } catch (err) {
    next(err);
  }
});

router.put("/name", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { firstName, lastName } = req.body;

    if (!firstName || !lastName) throw new AppError(400, "firstName and lastName required");

    const user = await prisma.user.update({
      where: { id: userId },
      data: { firstName, lastName },
      select: { id: true, firstName: true, lastName: true, email: true },
    });

    res.json(user);
  } catch (err) {
    next(err);
  }
});

router.put("/password", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      throw new AppError(400, "currentPassword and newPassword required");
    }
    if (newPassword.length < 6) {
      throw new AppError(400, "New password must be at least 6 characters");
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError(404, "User not found");

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new AppError(401, "Current password is incorrect");

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    next(err);
  }
});

export default router;
