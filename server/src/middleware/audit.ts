import { Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";

export function auditLog(module: string, resource: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method === "GET") return next();

    const originalJson = res.json.bind(res);
    const startTime = Date.now();

    let oldValue: any = null;

    // Capture before-state for updates and deletes
    if ((req.method === "PUT" || req.method === "PATCH" || req.method === "DELETE") && req.params.id) {
      try {
        const model = (prisma as any)[resource];
        if (model?.findUnique) {
          oldValue = await model.findUnique({ where: { id: req.params.id } });
        }
      } catch {}
    }

    res.json = function (body: any) {
      if (req.user) {
        const action = req.method === "POST" ? "CREATE"
          : req.method === "PUT" || req.method === "PATCH" ? "UPDATE"
          : req.method === "DELETE" ? "DELETE"
          : req.method;

        const duration = Date.now() - startTime;

        prisma.auditLog.create({
          data: {
            tenantId: req.user.tenantId,
            userId: req.user.userId,
            action,
            module,
            resource,
            resourceId: req.params.id || body?.id,
            oldValue: oldValue ? JSON.stringify(oldValue).slice(0, 8000) : null,
            newValue: req.method !== "DELETE" && body
              ? JSON.stringify(body).slice(0, 8000)
              : null,
            ipAddress: req.ip || req.headers["x-forwarded-for"] as string || "unknown",
          },
        }).catch(() => {});
      }
      return originalJson(body);
    };
    next();
  };
}
