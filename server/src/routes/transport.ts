import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authenticate } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

const router = Router();
router.use(authenticate);

const tenantScope = (req: Request) => req.user!.tenantId;

/** GET /shipments - List shipments with pagination */
router.get("/shipments", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 25);
    const type = req.query.type as string | undefined;
    const status = req.query.status as string | undefined;
    const carrier = req.query.carrier as string | undefined;

    const where: { tenantId: string; type?: string; status?: string; carrier?: string } = { tenantId };
    if (type) where.type = type;
    if (status) where.status = status;
    if (carrier) where.carrier = carrier;

    const [data, total] = await Promise.all([
      prisma.shipment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.shipment.count({ where }),
    ]);

    res.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

/** POST /shipments - Create shipment */
router.post("/shipments", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);
    const userId = req.user!.userId;

    const count = await prisma.shipment.count({ where: { tenantId } });
    const shipmentNumber = `SHP-${String(count + 1).padStart(7, "0")}`;

    const shipment = await prisma.shipment.create({
      data: {
        ...req.body,
        tenantId,
        shipmentNumber,
        createdBy: userId,
      },
    });

    res.status(201).json(shipment);
  } catch (err) {
    next(err);
  }
});

/** PUT /shipments/:id - Update shipment */
router.put("/shipments/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);
    const existing = await prisma.shipment.findUnique({ where: { id: req.params.id } });

    if (!existing || existing.tenantId !== tenantId) {
      throw new AppError(404, "Shipment not found");
    }

    const shipment = await prisma.shipment.update({
      where: { id: req.params.id },
      data: req.body,
    });

    res.json(shipment);
  } catch (err) {
    next(err);
  }
});

/** POST /shipments/:id/dispatch - Set status to in_transit */
router.post("/shipments/:id/dispatch", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);
    const shipment = await prisma.shipment.findUnique({ where: { id: req.params.id } });

    if (!shipment || shipment.tenantId !== tenantId) {
      throw new AppError(404, "Shipment not found");
    }

    const updated = await prisma.shipment.update({
      where: { id: req.params.id },
      data: {
        status: "in_transit",
        actualDate: new Date(),
      },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/** POST /shipments/:id/deliver - Set status to delivered */
router.post("/shipments/:id/deliver", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);
    const shipment = await prisma.shipment.findUnique({ where: { id: req.params.id } });

    if (!shipment || shipment.tenantId !== tenantId) {
      throw new AppError(404, "Shipment not found");
    }

    const updated = await prisma.shipment.update({
      where: { id: req.params.id },
      data: {
        status: "delivered",
        actualDate: new Date(),
      },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/** GET /carriers - List distinct carriers */
router.get("/carriers", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);

    const shipments = await prisma.shipment.findMany({
      where: { tenantId, carrier: { not: null } },
      select: { carrier: true },
      distinct: ["carrier"],
    });

    const carriers = shipments.map((s) => s.carrier).filter(Boolean) as string[];

    res.json(carriers);
  } catch (err) {
    next(err);
  }
});

/** GET /cost-analysis - Freight cost analysis */
router.get("/cost-analysis", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);

    const shipments = await prisma.shipment.findMany({
      where: { tenantId },
    });

    const totalFreight = shipments.reduce((s, sh) => s + (sh.freightCost || 0), 0);
    const byCarrier: Record<string, number> = {};
    const byMode: Record<string, number> = {};

    for (const sh of shipments) {
      const cost = sh.freightCost || 0;
      const carrier = sh.carrier || "Unknown";
      const mode = sh.mode || "truck";
      byCarrier[carrier] = (byCarrier[carrier] || 0) + cost;
      byMode[mode] = (byMode[mode] || 0) + cost;
    }

    const avgCostPerShipment = shipments.length > 0 ? totalFreight / shipments.length : 0;

    res.json({
      totalFreight,
      costByCarrier: byCarrier,
      costByMode: byMode,
      avgCostPerShipment,
      shipmentCount: shipments.length,
    });
  } catch (err) {
    next(err);
  }
});

/** GET /tracking/:shipmentNumber - Get tracking details */
router.get("/tracking/:shipmentNumber", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);
    const { shipmentNumber } = req.params;

    const shipment = await prisma.shipment.findFirst({
      where: { tenantId, shipmentNumber },
    });

    if (!shipment) {
      throw new AppError(404, "Shipment not found");
    }

    res.json({
      shipmentNumber: shipment.shipmentNumber,
      status: shipment.status,
      carrier: shipment.carrier,
      trackingNumber: shipment.trackingNumber,
      plannedDate: shipment.plannedDate,
      actualDate: shipment.actualDate,
      origin: shipment.originAddress,
      destination: shipment.destAddress,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
