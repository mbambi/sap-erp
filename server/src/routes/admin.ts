import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../prisma";
import { authenticate, requireRoles } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

const router = Router();
router.use(authenticate);
router.use(requireRoles("admin", "instructor"));

// Tenant management
router.get("/tenants", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user!.roles.includes("admin")) {
      const tenant = await prisma.tenant.findUnique({ where: { id: req.user!.tenantId } });
      return res.json([tenant]);
    }
    const tenants = await prisma.tenant.findMany({ orderBy: { name: "asc" } });
    res.json(tenants);
  } catch (err) {
    next(err);
  }
});

router.post("/tenants", requireRoles("admin"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, slug, university, description } = req.body;
    if (!name || !slug) throw new AppError(400, "name and slug are required");

    const tenant = await prisma.tenant.create({
      data: { name, slug, university: university ?? null, description: description ?? null },
    });

    const systemRoles = ["admin", "instructor", "student", "auditor"];
    for (const roleName of systemRoles) {
      await prisma.role.create({
        data: { tenantId: tenant.id, name: roleName, isSystem: true },
      });
    }

    res.status(201).json(tenant);
  } catch (err) {
    next(err);
  }
});

// User management
router.get("/users", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await prisma.user.findMany({
      where: { tenantId: req.user!.tenantId },
      include: { userRoles: { include: { role: true } } },
      orderBy: { lastName: "asc" },
    });
    const safe = users.map(({ passwordHash, ...u }) => ({
      ...u,
      roles: u.userRoles.map((ur) => ur.role.name),
    }));
    res.json(safe);
  } catch (err) {
    next(err);
  }
});

router.post("/users", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { roleNames, password, email, firstName, lastName } = req.body;
    if (!email || !firstName || !lastName) throw new AppError(400, "email, firstName, lastName required");
    if (!password || password.length < 6) throw new AppError(400, "password is required and must be at least 6 characters");
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        firstName,
        lastName,
        tenantId: req.user!.tenantId,
        passwordHash,
      },
    });

    if (roleNames?.length) {
      for (const roleName of roleNames) {
        const role = await prisma.role.findUnique({
          where: { tenantId_name: { tenantId: req.user!.tenantId, name: roleName } },
        });
        if (role) {
          await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
        }
      }
    }

    res.status(201).json({ id: user.id, email: user.email });
  } catch (err) {
    next(err);
  }
});

router.put("/users/:id/roles", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user || user.tenantId !== req.user!.tenantId) {
      throw new AppError(404, "User not found");
    }

    await prisma.userRole.deleteMany({ where: { userId: user.id } });

    for (const roleName of req.body.roles || []) {
      const role = await prisma.role.findUnique({
        where: { tenantId_name: { tenantId: req.user!.tenantId, name: roleName } },
      });
      if (role) {
        await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
      }
    }

    res.json({ message: "Roles updated" });
  } catch (err) {
    next(err);
  }
});

// Roles & permissions
router.get("/roles", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const roles = await prisma.role.findMany({
      where: { tenantId: req.user!.tenantId },
      include: { permissions: true },
      orderBy: { name: "asc" },
    });
    res.json(roles);
  } catch (err) {
    next(err);
  }
});

// Audit log
router.get("/audit-log", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(200, parseInt(req.query.limit as string) || 50);
    const where: any = { tenantId: req.user!.tenantId };
    if (req.query.module) where.module = req.query.module;
    if (req.query.userId) where.userId = req.query.userId;

    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { firstName: true, lastName: true, email: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);
    res.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    next(err);
  }
});

export default router;
