import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authenticate } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

const router = Router();
router.use(authenticate);

const tenantScope = (req: Request) => req.user!.tenantId;

/** GET /estimates - List cost estimates */
router.get("/estimates", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);

    const estimates = await prisma.costEstimate.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });

    res.json(estimates);
  } catch (err) {
    next(err);
  }
});

/** POST /estimate - Calculate cost estimate for a material */
router.post("/estimate", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);
    const { materialId, productionOrderId, quantity = 1 } = req.body;

    if (!materialId) throw new AppError(400, "materialId is required");

    const material = await prisma.material.findFirst({
      where: { id: materialId, tenantId },
    });
    if (!material) throw new AppError(404, "Material not found");

    const qty = Number(quantity) || 1;

    const bom = await prisma.billOfMaterial.findFirst({
      where: { materialId, tenantId, isActive: true },
      include: {
        components: { include: { material: true } },
        routings: true,
      },
    });

    let materialCost = 0;
    const materialBreakdown: { materialId: string; description: string; quantity: number; unitPrice: number; total: number }[] = [];

    if (bom?.components?.length) {
      for (const comp of bom.components) {
        const compQty = (comp.quantity || 0) * qty;
        const unitPrice = comp.material?.standardPrice || 0;
        const total = compQty * unitPrice;
        materialCost += total;
        materialBreakdown.push({
          materialId: comp.materialId,
          description: comp.material?.description || "Unknown",
          quantity: compQty,
          unitPrice,
          total,
        });
      }
    }

    let laborCost = 0;
    const laborBreakdown: { stepNo: number; workCenter: string; runTime: number; laborRate: number; total: number }[] = [];

    if (bom?.routings?.length) {
      for (const r of bom.routings) {
        const runTime = (r.runTime || 0) * qty;
        const laborRate = r.laborRate || 0;
        const total = runTime * laborRate;
        laborCost += total;
        laborBreakdown.push({
          stepNo: r.stepNo,
          workCenter: r.workCenter,
          runTime,
          laborRate,
          total,
        });
      }
    }

    const overheadCost = laborCost * 0.35;
    const totalCost = materialCost + laborCost + overheadCost;
    const costPerUnit = totalCost / qty;

    const breakdown = {
      materialCost,
      materialBreakdown,
      laborCost,
      laborBreakdown,
      overheadCost,
      overheadRate: 0.35,
      totalCost,
      quantity: qty,
      costPerUnit,
    };

    const estimate = await prisma.costEstimate.create({
      data: {
        tenantId,
        materialId,
        productionOrderId: productionOrderId || null,
        materialCost,
        laborCost,
        overheadCost,
        totalCost,
        costPerUnit,
        quantity: qty,
        breakdown: JSON.stringify(breakdown),
        status: "estimated",
      },
    });

    res.status(201).json({
      ...estimate,
      breakdown,
    });
  } catch (err) {
    next(err);
  }
});

/** GET /estimates/:id - Get estimate detail */
router.get("/estimates/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);
    const estimate = await prisma.costEstimate.findUnique({
      where: { id: req.params.id },
    });

    if (!estimate || estimate.tenantId !== tenantId) {
      throw new AppError(404, "Estimate not found");
    }

    const breakdown = estimate.breakdown ? JSON.parse(estimate.breakdown) : null;

    res.json({ ...estimate, breakdown });
  } catch (err) {
    next(err);
  }
});

/** POST /estimates/:id/release - Set status to released */
router.post("/estimates/:id/release", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);
    const estimate = await prisma.costEstimate.findUnique({
      where: { id: req.params.id },
    });

    if (!estimate || estimate.tenantId !== tenantId) {
      throw new AppError(404, "Estimate not found");
    }

    const updated = await prisma.costEstimate.update({
      where: { id: req.params.id },
      data: { status: "released" },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/** GET /variance - Compare estimated vs actual costs for completed production orders */
router.get("/variance", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);

    const completedOrders = await prisma.productionOrder.findMany({
      where: { tenantId, status: "completed" },
    });

    const estimates = await prisma.costEstimate.findMany({
      where: { tenantId, productionOrderId: { not: null } },
    });

    const variances: {
      productionOrderId: string;
      orderNumber: string;
      estimatedCost: number;
      actualCost: number;
      variance: number;
      variancePct: number;
    }[] = [];

    for (const order of completedOrders) {
      const est = estimates.find((e) => e.productionOrderId === order.id);
      if (!est) continue;

      const estimatedCost = est.totalCost;
      const material = await prisma.material.findUnique({
        where: { id: order.materialId },
      });
      const actualCost = (order.yieldQty || order.quantity) * (material?.movingAvgPrice || material?.standardPrice || 0);
      const variance = actualCost - estimatedCost;
      const variancePct = estimatedCost > 0 ? (variance / estimatedCost) * 100 : 0;

      variances.push({
        productionOrderId: order.id,
        orderNumber: order.orderNumber,
        estimatedCost,
        actualCost,
        variance,
        variancePct,
      });
    }

    res.json({ variances });
  } catch (err) {
    next(err);
  }
});

export default router;
