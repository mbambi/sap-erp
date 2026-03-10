import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authenticate, requireRoles } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

const router = Router();
router.use(authenticate);

const tenantScope = (req: Request) => req.user!.tenantId;

const HORIZON_DAYS = 90;

/** GET /planning-board - MRP planning board data */
router.get("/planning-board", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tid = tenantScope(req);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const horizonEnd = new Date(today);
    horizonEnd.setDate(horizonEnd.getDate() + HORIZON_DAYS);

    const materials = await prisma.material.findMany({
      where: { tenantId: tid, isActive: true, type: { in: ["finished", "semi-finished"] } },
    });

    const result: Array<{
      materialId: string;
      materialNumber: string;
      description: string;
      currentStock: number;
      demand: number;
      supply: number;
      netRequirement: number;
      safetyStock: number;
      shortage: number;
      coverageDays: number;
    }> = [];

    for (const mat of materials) {
      const soWhere = {
        salesOrder: { tenantId: tid, status: { notIn: ["cancelled", "completed"] } },
        materialId: mat.id,
      };
      const [soDemand, soDelivered] = await Promise.all([
        prisma.salesOrderItem.aggregate({ where: soWhere, _sum: { quantity: true } }),
        prisma.salesOrderItem.aggregate({ where: soWhere, _sum: { deliveredQty: true } }),
      ]);
      const openSoQty = (soDemand._sum.quantity ?? 0) - (soDelivered._sum.deliveredQty ?? 0);

      const forecast = await prisma.demandForecast.aggregate({
        where: {
          tenantId: tid,
          materialId: mat.id,
          periodEnd: { gte: today },
          periodStart: { lte: horizonEnd },
        },
        _sum: { forecastQty: true },
      });
      const forecastQty = forecast._sum.forecastQty ?? 0;

      const demand = openSoQty + forecastQty;

      const poWhere = {
        purchaseOrder: { tenantId: tid, status: { notIn: ["cancelled", "closed"] } },
        materialId: mat.id,
      };
      const [poSupply, poReceived] = await Promise.all([
        prisma.purchaseOrderItem.aggregate({ where: poWhere, _sum: { quantity: true } }),
        prisma.purchaseOrderItem.aggregate({ where: poWhere, _sum: { receivedQty: true } }),
      ]);
      const openPoQty = (poSupply._sum.quantity ?? 0) - (poReceived._sum.receivedQty ?? 0);

      const plannedQty = await prisma.plannedOrder.aggregate({
        where: {
          tenantId: tid,
          materialId: mat.id,
          status: { notIn: ["cancelled", "converted"] },
        },
        _sum: { quantity: true },
      });

      const prodQty = await prisma.productionOrder.aggregate({
        where: {
          tenantId: tid,
          materialId: mat.id,
          status: { notIn: ["closed"] },
        },
        _sum: { quantity: true },
      });

      const supply = openPoQty + (plannedQty._sum.quantity ?? 0) + (prodQty._sum.quantity ?? 0);
      const currentStock = mat.stockQuantity ?? 0;
      const safetyStock = mat.safetyStock ?? 0;
      const netRequirement = demand - currentStock - supply;
      const shortage = Math.max(0, netRequirement);
      const dailyDemand = demand / HORIZON_DAYS;
      const coverageDays = dailyDemand > 0 ? (currentStock + supply) / dailyDemand : 999;

      result.push({
        materialId: mat.id,
        materialNumber: mat.materialNumber,
        description: mat.description,
        currentStock,
        demand,
        supply,
        netRequirement,
        safetyStock,
        shortage,
        coverageDays: Math.round(coverageDays * 10) / 10,
      });
    }

    result.sort((a, b) => b.shortage - a.shortage);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** GET /material/:materialId/timeline - Weekly buckets for next 12 weeks */
router.get("/material/:materialId/timeline", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tid = tenantScope(req);
    const materialId = String(req.params.materialId);

    const material = await prisma.material.findFirst({
      where: { id: materialId, tenantId: tid },
    });
    if (!material) throw new AppError(404, "Material not found");

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const buckets: Array<{
      week: number;
      weekStart: string;
      demand: number;
      supply: number;
      projectedStock: number;
      shortageFlag: boolean;
    }> = [];

    let runningStock = material.stockQuantity ?? 0;

    for (let w = 0; w < 12; w++) {
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() + w * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const soDemand = await prisma.salesOrderItem.aggregate({
        where: {
          materialId,
          salesOrder: {
            tenantId: tid,
            status: { notIn: ["cancelled", "completed"] },
            orderDate: { lte: weekEnd },
          },
        },
        _sum: { quantity: true },
      });
      const forecastDemand = await prisma.demandForecast.aggregate({
        where: {
          tenantId: tid,
          materialId,
          periodStart: { lte: weekEnd },
          periodEnd: { gte: weekStart },
        },
        _sum: { forecastQty: true },
      });
      const demand = (soDemand._sum?.quantity ?? 0) + (forecastDemand._sum?.forecastQty ?? 0);

      const poSupply = await prisma.purchaseOrderItem.aggregate({
        where: {
          materialId,
          purchaseOrder: {
            tenantId: tid,
            status: { notIn: ["cancelled", "closed"] },
            deliveryDate: { gte: weekStart, lte: weekEnd },
          },
        },
        _sum: { quantity: true },
      });
      const plannedSupply = await prisma.plannedOrder.aggregate({
        where: {
          tenantId: tid,
          materialId,
          status: { notIn: ["cancelled", "converted"] },
          dueDate: { gte: weekStart, lte: weekEnd },
        },
        _sum: { quantity: true },
      });
      const prodSupply = await prisma.productionOrder.aggregate({
        where: {
          tenantId: tid,
          materialId,
          status: { notIn: ["closed"] },
          plannedEnd: { gte: weekStart, lte: weekEnd },
        },
        _sum: { quantity: true },
      });
      const supply = (poSupply._sum?.quantity ?? 0) + (plannedSupply._sum?.quantity ?? 0) + (prodSupply._sum?.quantity ?? 0);

      runningStock = runningStock + supply - demand;
      const shortageFlag = runningStock < 0;

      buckets.push({
        week: w + 1,
        weekStart: weekStart.toISOString().slice(0, 10),
        demand,
        supply,
        projectedStock: runningStock,
        shortageFlag,
      });
    }

    res.json(buckets);
  } catch (err) {
    next(err);
  }
});

/** POST /reschedule - Update planned order date */
router.post("/reschedule", requireRoles("admin", "instructor"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { plannedOrderId, newDate } = req.body;
    if (!plannedOrderId || !newDate) throw new AppError(400, "plannedOrderId and newDate are required");

    const order = await prisma.plannedOrder.findFirst({
      where: { id: plannedOrderId, tenantId: tenantScope(req) },
    });
    if (!order) throw new AppError(404, "Planned order not found");

    const d = new Date(newDate);
    const updated = await prisma.plannedOrder.update({
      where: { id: plannedOrderId },
      data: { plannedDate: d, dueDate: d },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/** POST /change-supplier - Update vendor for purchase-type planned order */
router.post("/change-supplier", requireRoles("admin", "instructor"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { plannedOrderId, newVendorId } = req.body;
    if (!plannedOrderId || !newVendorId) throw new AppError(400, "plannedOrderId and newVendorId are required");

    const tid = tenantScope(req);
    const order = await prisma.plannedOrder.findFirst({
      where: { id: plannedOrderId, tenantId: tid },
    });
    if (!order) throw new AppError(404, "Planned order not found");
    if (order.orderType !== "purchase") throw new AppError(400, "Only purchase-type planned orders can have supplier changed");

    const vendor = await prisma.vendor.findFirst({
      where: { id: newVendorId, tenantId: tid },
    });
    if (!vendor) throw new AppError(404, "Vendor not found");

    const updated = await prisma.plannedOrder.update({
      where: { id: plannedOrderId },
      data: { vendorId: newVendorId },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/** POST /adjust-safety-stock - Update material safety stock */
router.post("/adjust-safety-stock", requireRoles("admin", "instructor"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { materialId, newSafetyStock } = req.body;
    if (!materialId || newSafetyStock == null) throw new AppError(400, "materialId and newSafetyStock are required");

    const material = await prisma.material.findFirst({
      where: { id: materialId, tenantId: tenantScope(req) },
    });
    if (!material) throw new AppError(404, "Material not found");

    const updated = await prisma.material.update({
      where: { id: materialId },
      data: { safetyStock: Math.max(0, parseInt(String(newSafetyStock), 10) || 0) },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
