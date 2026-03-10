import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authenticate } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

const router = Router();
router.use(authenticate);

// GET /policies - list all policies with material info
router.get("/policies", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const policies = await prisma.inventoryPolicy.findMany({
      where: { tenantId },
    });
    const materialIds = [...new Set(policies.map((p) => p.materialId))];
    const materials = await prisma.material.findMany({
      where: { id: { in: materialIds } },
    });
    const materialMap = Object.fromEntries(materials.map((m) => [m.id, m]));
    const result = policies.map((p) => ({
      ...p,
      material: materialMap[p.materialId] ?? null,
    }));
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /policies/:materialId - get policy for specific material
router.get("/policies/:materialId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { materialId } = req.params;
    const policy = await prisma.inventoryPolicy.findUnique({
      where: { tenantId_materialId: { tenantId, materialId } },
    });
    if (!policy) throw new AppError(404, "Policy not found");
    const material = await prisma.material.findUnique({ where: { id: materialId } });
    res.json({ ...policy, material });
  } catch (err) {
    next(err);
  }
});

// POST /policies - create/update policy (upsert)
router.post("/policies", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const {
      materialId,
      policyType,
      orderQuantity,
      reorderPoint,
      safetyStock,
      minStock,
      maxStock,
      reviewPeriodDays,
      annualDemand,
      orderingCost,
      holdingCostPct,
      serviceLevelPct,
      abcClass,
      calculatedEOQ,
      calculatedROP,
    } = req.body;
    if (!materialId || !policyType) throw new AppError(400, "materialId and policyType are required");
    const policy = await prisma.inventoryPolicy.upsert({
      where: { tenantId_materialId: { tenantId, materialId } },
      create: {
        tenantId,
        materialId,
        policyType,
        orderQuantity: orderQuantity ?? null,
        reorderPoint: reorderPoint ?? null,
        safetyStock: safetyStock ?? null,
        minStock: minStock ?? null,
        maxStock: maxStock ?? null,
        reviewPeriodDays: reviewPeriodDays ?? null,
        annualDemand: annualDemand ?? null,
        orderingCost: orderingCost ?? null,
        holdingCostPct: holdingCostPct ?? null,
        serviceLevelPct: serviceLevelPct ?? null,
        abcClass: abcClass ?? null,
        calculatedEOQ: calculatedEOQ ?? null,
        calculatedROP: calculatedROP ?? null,
      },
      update: {
        policyType,
        orderQuantity: orderQuantity ?? undefined,
        reorderPoint: reorderPoint ?? undefined,
        safetyStock: safetyStock ?? undefined,
        minStock: minStock ?? undefined,
        maxStock: maxStock ?? undefined,
        reviewPeriodDays: reviewPeriodDays ?? undefined,
        annualDemand: annualDemand ?? undefined,
        orderingCost: orderingCost ?? undefined,
        holdingCostPct: holdingCostPct ?? undefined,
        serviceLevelPct: serviceLevelPct ?? undefined,
        abcClass: abcClass ?? undefined,
        calculatedEOQ: calculatedEOQ ?? undefined,
        calculatedROP: calculatedROP ?? undefined,
      },
    });
    res.json(policy);
  } catch (err) {
    next(err);
  }
});

// POST /calculate-eoq - EOQ = sqrt(2*D*S / H), H = unitPrice * holdingCostPct
router.post("/calculate-eoq", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { materialId, annualDemand, orderingCost, holdingCostPct } = req.body;
    if (!materialId || annualDemand == null || orderingCost == null || holdingCostPct == null) {
      throw new AppError(400, "materialId, annualDemand, orderingCost, and holdingCostPct are required");
    }
    const material = await prisma.material.findUnique({ where: { id: materialId } });
    if (!material) throw new AppError(404, "Material not found");
    const unitPrice = material.standardPrice || material.movingAvgPrice || 1;
    const H = unitPrice * (holdingCostPct / 100);
    const D = annualDemand;
    const S = orderingCost;
    const EOQ = H > 0 ? Math.sqrt((2 * D * S) / H) : 0;

    const policy = await prisma.inventoryPolicy.upsert({
      where: { tenantId_materialId: { tenantId, materialId } },
      create: {
        tenantId,
        materialId,
        policyType: "eoq",
        annualDemand: D,
        orderingCost: S,
        holdingCostPct,
        calculatedEOQ: EOQ,
        lastCalculated: new Date(),
      },
      update: {
        annualDemand: D,
        orderingCost: S,
        holdingCostPct,
        calculatedEOQ: EOQ,
        lastCalculated: new Date(),
      },
    });
    res.json({ EOQ, policy });
  } catch (err) {
    next(err);
  }
});

// POST /calculate-rop - ROP = avgDailyDemand * leadTime + safetyStock
router.post("/calculate-rop", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { materialId, annualDemand, leadTimeDays, safetyStock } = req.body;
    if (!materialId || annualDemand == null || leadTimeDays == null) {
      throw new AppError(400, "materialId, annualDemand, and leadTimeDays are required");
    }
    const material = await prisma.material.findUnique({ where: { id: materialId } });
    if (!material) throw new AppError(404, "Material not found");
    const leadTime = leadTimeDays;
    const avgDailyDemand = annualDemand / 365;
    const safety = safetyStock ?? material.safetyStock ?? 0;
    const ROP = avgDailyDemand * leadTime + safety;

    const policy = await prisma.inventoryPolicy.upsert({
      where: { tenantId_materialId: { tenantId, materialId } },
      create: {
        tenantId,
        materialId,
        policyType: "rop",
        annualDemand,
        safetyStock: safety,
        calculatedROP: ROP,
        lastCalculated: new Date(),
      },
      update: {
        annualDemand,
        safetyStock: safety,
        calculatedROP: ROP,
        lastCalculated: new Date(),
      },
    });
    res.json({ ROP, policy });
  } catch (err) {
    next(err);
  }
});

// POST /abc-classification - classify by value (price * annual demand)
router.post("/abc-classification", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const policies = await prisma.inventoryPolicy.findMany({
      where: { tenantId, annualDemand: { not: null } },
    });
    const materials = await prisma.material.findMany({
      where: { id: { in: policies.map((p) => p.materialId) } },
    });
    const materialMap = Object.fromEntries(materials.map((m) => [m.id, m]));

    const withValue = policies
      .map((p) => {
        const mat = materialMap[p.materialId];
        const price = mat?.standardPrice ?? mat?.movingAvgPrice ?? 0;
        const demand = p.annualDemand ?? 0;
        return { policy: p, value: price * demand };
      })
      .sort((a, b) => b.value - a.value);

    const totalValue = withValue.reduce((sum, x) => sum + x.value, 0);
    let cumValue = 0;
    const classifications: Array<{ materialId: string; abcClass: string; value: number }> = [];

    for (const { policy, value } of withValue) {
      cumValue += value;
      const pct = totalValue > 0 ? (cumValue / totalValue) * 100 : 0;
      const abcClass = pct <= 80 ? "A" : pct <= 95 ? "B" : "C";
      await prisma.inventoryPolicy.update({
        where: { tenantId_materialId: { tenantId, materialId: policy.materialId } },
        data: { abcClass },
      });
      classifications.push({ materialId: policy.materialId, abcClass, value });
    }

    res.json({ classifications });
  } catch (err) {
    next(err);
  }
});

export default router;
