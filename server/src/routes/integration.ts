import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authenticate, requireRoles } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

const router = Router();

// POST /webhook/receive - inbound webhook
// In a learning platform, this is a simulation endpoint — require authentication
router.post("/webhook/receive", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    await prisma.integrationLog.create({
      data: {
        tenantId,
        direction: "inbound",
        eventType: "webhook_receive",
        payload: JSON.stringify(req.body),
        response: JSON.stringify({ received: true }),
        statusCode: 200,
        success: true,
      },
    });
    res.status(200).json({ received: true });
  } catch (err) {
    next(err);
  }
});

router.use(authenticate);

// GET /endpoints - list (admin/instructor)
router.get(
  "/endpoints",
  authenticate,
  requireRoles("admin", "instructor"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await prisma.integrationEndpoint.findMany({
        where: { tenantId: req.user!.tenantId },
        orderBy: { createdAt: "desc" },
      });
      res.json({ data });
    } catch (err) {
      next(err);
    }
  }
);

// POST /endpoints - create (admin/instructor)
router.post(
  "/endpoints",
  authenticate,
  requireRoles("admin", "instructor"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, type, direction, url, method, headers, authType, eventTrigger } = req.body;
      if (!name || !type || !direction) throw new AppError(400, "name, type, direction required");

      const ep = await prisma.integrationEndpoint.create({
        data: {
          tenantId: req.user!.tenantId,
          name,
          type: type || "rest_api",
          direction: direction || "outbound",
          url: url ?? null,
          method: method ?? "POST",
          headers: headers ? JSON.stringify(headers) : null,
          authType: authType ?? null,
          eventTrigger: eventTrigger ?? null,
          isActive: true,
        },
      });
      res.status(201).json(ep);
    } catch (err) {
      next(err);
    }
  }
);

// PUT /endpoints/:id - update (admin/instructor)
router.put(
  "/endpoints/:id",
  authenticate,
  requireRoles("admin", "instructor"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const ep = await prisma.integrationEndpoint.findUnique({ where: { id } });
      if (!ep || ep.tenantId !== req.user!.tenantId) throw new AppError(404, "Endpoint not found");

      const { name, type, direction, url, method, headers, authType, eventTrigger, isActive } = req.body;
      const updated = await prisma.integrationEndpoint.update({
        where: { id },
        data: {
          ...(name != null && { name }),
          ...(type != null && { type }),
          ...(direction != null && { direction }),
          ...(url != null && { url }),
          ...(method != null && { method }),
          ...(headers != null && { headers: JSON.stringify(headers) }),
          ...(authType != null && { authType }),
          ...(eventTrigger != null && { eventTrigger }),
          ...(isActive != null && { isActive }),
        },
      });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /endpoints/:id - delete (admin/instructor)
router.delete(
  "/endpoints/:id",
  authenticate,
  requireRoles("admin", "instructor"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const ep = await prisma.integrationEndpoint.findUnique({ where: { id } });
      if (!ep || ep.tenantId !== req.user!.tenantId) throw new AppError(404, "Endpoint not found");

      await prisma.integrationEndpoint.delete({ where: { id } });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

// POST /endpoints/:id/test - test endpoint
router.post(
  "/endpoints/:id/test",
  authenticate,
  requireRoles("admin", "instructor"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const ep = await prisma.integrationEndpoint.findUnique({ where: { id } });
      if (!ep || ep.tenantId !== req.user!.tenantId) throw new AppError(404, "Endpoint not found");

      const samplePayload = req.body.payload || { test: true, timestamp: new Date().toISOString() };
      const start = Date.now();
      let statusCode = 200;
      let success = true;
      let errorMessage: string | null = null;
      let responseBody: any = { received: true };

      if (ep.url) {
        try {
          const res = await fetch(ep.url, {
            method: (ep.method as string) || "POST",
            headers: ep.headers ? JSON.parse(ep.headers) : { "Content-Type": "application/json" },
            body: JSON.stringify(samplePayload),
          });
          statusCode = res.status;
          success = res.ok;
          responseBody = { status: res.status, ok: res.ok };
        } catch (e: any) {
          success = false;
          errorMessage = e?.message || "Request failed";
        }
      }

      const duration = Date.now() - start;

      await prisma.integrationLog.create({
        data: {
          tenantId: req.user!.tenantId,
          endpointId: ep.id,
          direction: "outbound",
          eventType: "test",
          payload: JSON.stringify(samplePayload),
          response: JSON.stringify(responseBody),
          statusCode,
          success,
          errorMessage,
          duration,
        },
      });

      res.json({
        success,
        statusCode,
        duration,
        message: success ? "Test completed" : errorMessage,
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /logs - list integration logs
router.get("/logs", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { page, limit, success, eventType, endpointId } = req.query;
    const p = Math.max(1, parseInt(page as string) || 1);
    const l = Math.min(100, parseInt(limit as string) || 25);

    const where: any = { tenantId };
    if (success !== undefined) where.success = success === "true";
    if (eventType) where.eventType = eventType;
    if (endpointId) where.endpointId = endpointId;

    const [data, total] = await Promise.all([
      prisma.integrationLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (p - 1) * l,
        take: l,
      }),
      prisma.integrationLog.count({ where }),
    ]);

    res.json({ data, pagination: { page: p, limit: l, total, totalPages: Math.ceil(total / l) } });
  } catch (err) {
    next(err);
  }
});

// POST /simulate-event - simulate outbound event (teaching)
router.post("/simulate-event", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { eventType, payload } = req.body;
    const log = await prisma.integrationLog.create({
      data: {
        tenantId: req.user!.tenantId,
        direction: "outbound",
        eventType: eventType || "simulated",
        payload: JSON.stringify(payload || { simulated: true, at: new Date().toISOString() }),
        response: JSON.stringify({ simulated: true }),
        statusCode: 200,
        success: true,
        duration: 0,
      },
    });
    res.status(201).json(log);
  } catch (err) {
    next(err);
  }
});

// GET /architecture - integration architecture description
router.get("/architecture", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const endpoints = await prisma.integrationEndpoint.findMany({
      where: { tenantId: req.user!.tenantId, isActive: true },
    });

    const eventTypes = [
      "PO_CREATED",
      "PO_APPROVED",
      "SO_SHIPPED",
      "INVOICE_POSTED",
      "GOODS_RECEIVED",
      "webhook_receive",
      "test",
    ];

    const dataFlows = endpoints.map((ep) => ({
      id: ep.id,
      name: ep.name,
      type: ep.type,
      direction: ep.direction,
      eventTrigger: ep.eventTrigger,
      url: ep.url,
    }));

    res.json({
      endpoints: endpoints.map((e) => ({
        id: e.id,
        name: e.name,
        type: e.type,
        direction: e.direction,
        eventTrigger: e.eventTrigger,
      })),
      eventTypes,
      dataFlows,
      description: "SAP ERP Integration layer with webhooks and REST endpoints for event-driven flows.",
    });
  } catch (err) {
    next(err);
  }
});

export default router;
