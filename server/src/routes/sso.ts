import { Router, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../prisma";
import { config } from "../config";
import { AppError } from "../middleware/errorHandler";

const router = Router();

// OAuth 2.0 callback handler
// SECURITY: This endpoint must ONLY be called by the server itself after
// verifying the OAuth token with the identity provider. In production,
// replace with proper server-side OAuth flow (authorization code exchange).
router.post("/oauth/callback", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, firstName, lastName, provider, providerId, tenantSlug, serverSecret } = req.body;

    // Verify this is an internal server call, not a direct client request
    // In production, this should be replaced with proper OAuth token verification
    if (serverSecret !== config.jwtSecret) {
      throw new AppError(403, "SSO callback must be called server-side with proper verification");
    }

    if (!email || !tenantSlug) {
      throw new AppError(400, "email and tenantSlug required");
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new AppError(400, "Invalid email format");
    }

    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug },
    });
    if (!tenant || !tenant.isActive) {
      throw new AppError(400, "Invalid tenant");
    }

    let user = await prisma.user.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email } },
      include: { userRoles: { include: { role: true } } },
    });

    // Auto-create user on first SSO login
    if (!user) {
      let studentRole = await prisma.role.findUnique({
        where: { tenantId_name: { tenantId: tenant.id, name: "student" } },
      });
      if (!studentRole) {
        studentRole = await prisma.role.create({
          data: { tenantId: tenant.id, name: "student", isSystem: true },
        });
      }

      user = await prisma.user.create({
        data: {
          tenantId: tenant.id,
          email,
          passwordHash: "SSO_AUTH_NO_PASSWORD",
          firstName: firstName || email.split("@")[0],
          lastName: lastName || "",
          userRoles: { create: { roleId: studentRole.id } },
        },
        include: { userRoles: { include: { role: true } } },
      });
    }

    const roles = user.userRoles.map((ur) => ur.role.name);

    const token = jwt.sign(
      { userId: user.id, tenantId: tenant.id, email: user.email, roles },
      config.jwtSecret,
      { expiresIn: config.jwtExpiry } as jwt.SignOptions
    );

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

// SAML metadata endpoint (placeholder for SAML configuration)
router.get("/saml/metadata", (_req: Request, res: Response) => {
  res.json({
    entityId: `${config.corsOrigin}/api/sso/saml`,
    assertionConsumerServiceUrl: `${config.corsOrigin}/api/sso/saml/callback`,
    singleLogoutServiceUrl: `${config.corsOrigin}/api/sso/saml/logout`,
    nameIdFormat: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
    status: "configured",
    note: "Configure your IdP with these endpoints",
  });
});

// SSO configuration status
router.get("/status", (_req: Request, res: Response) => {
  res.json({
    oauth2: {
      enabled: !!process.env.OAUTH2_CLIENT_ID,
      providers: ["google", "microsoft", "github"].filter(() => !!process.env.OAUTH2_CLIENT_ID),
    },
    saml: {
      enabled: !!process.env.SAML_ENTRY_POINT,
    },
    ldap: {
      enabled: !!process.env.LDAP_URL,
    },
  });
});

export default router;
