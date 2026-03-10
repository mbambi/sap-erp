import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../prisma";
import { config } from "../config";
import { authenticate, AuthPayload } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  tenantSlug: z.string().min(1),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  tenantSlug: z.string().min(1),
});

router.post("/login", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = loginSchema.parse(req.body);

    const tenant = await prisma.tenant.findUnique({
      where: { slug: body.tenantSlug },
    });
    if (!tenant || !tenant.isActive) {
      throw new AppError(401, "Invalid tenant or credentials");
    }

    const user = await prisma.user.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email: body.email } },
      include: { userRoles: { include: { role: true } } },
    });
    if (!user || !user.isActive) {
      throw new AppError(401, "Invalid credentials");
    }

    const valid = await bcrypt.compare(body.password, user.passwordHash);
    if (!valid) {
      throw new AppError(401, "Invalid credentials");
    }

    const roles = user.userRoles.map((ur) => ur.role.name);

    const payload: AuthPayload = {
      userId: user.id,
      tenantId: tenant.id,
      email: user.email,
      roles,
    };

    const token = jwt.sign(payload, config.jwtSecret, {
      expiresIn: config.jwtExpiry,
    } as jwt.SignOptions);

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles,
        tenantId: tenant.id,
        tenantName: tenant.name,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post("/register", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = registerSchema.parse(req.body);

    const tenant = await prisma.tenant.findUnique({
      where: { slug: body.tenantSlug },
    });
    if (!tenant || !tenant.isActive) {
      throw new AppError(400, "Invalid tenant");
    }

    const existing = await prisma.user.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email: body.email } },
    });
    if (existing) {
      throw new AppError(409, "Email already registered in this tenant");
    }

    const passwordHash = await bcrypt.hash(body.password, 12);

    let studentRole = await prisma.role.findUnique({
      where: { tenantId_name: { tenantId: tenant.id, name: "student" } },
    });
    if (!studentRole) {
      studentRole = await prisma.role.create({
        data: { tenantId: tenant.id, name: "student", isSystem: true },
      });
    }

    const user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: body.email,
        passwordHash,
        firstName: body.firstName,
        lastName: body.lastName,
        userRoles: { create: { roleId: studentRole.id } },
      },
    });

    res.status(201).json({
      message: "Registration successful",
      userId: user.id,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/me", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: {
        userRoles: { include: { role: { include: { permissions: true } } } },
        tenant: true,
      },
    });
    if (!user) throw new AppError(404, "User not found");

    const roles = user.userRoles.map((ur) => ur.role.name);
    const permissions = user.userRoles.flatMap((ur) =>
      ur.role.permissions.map((p) => ({
        module: p.module,
        action: p.action,
        resource: p.resource,
      }))
    );

    res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles,
      permissions,
      tenantId: user.tenantId,
      tenantName: user.tenant.name,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/tenants", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const tenants = await prisma.tenant.findMany({
      where: { isActive: true },
      select: { slug: true, name: true, university: true, description: true },
      orderBy: { name: "asc" },
    });
    res.json(tenants);
  } catch (err) {
    next(err);
  }
});

export default router;
