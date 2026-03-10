import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authenticate, requireRoles } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

const router = Router();
router.use(authenticate);

const tenantScope = (req: Request) => req.user!.tenantId;

/** GET / - List assets with pagination, filter by category, status */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 25);
    const category = req.query.category as string | undefined;
    const status = req.query.status as string | undefined;

    const where: { tenantId: string; category?: string; status?: string } = { tenantId };
    if (category) where.category = category;
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      prisma.asset.findMany({
        where,
        orderBy: { assetNumber: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.asset.count({ where }),
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

function calcMonthlyDepr(
  acquisitionCost: number,
  currentValue: number,
  usefulLifeMonths: number,
  salvageValue: number,
  method: string
): number {
  if (usefulLifeMonths <= 0) return 0;
  if (method === "straight_line") {
    return (acquisitionCost - salvageValue) / usefulLifeMonths;
  }
  if (method === "declining_balance") {
    return currentValue * (2 / usefulLifeMonths);
  }
  return (acquisitionCost - salvageValue) / usefulLifeMonths;
}

/** POST / - Create asset */
router.post("/", requireRoles("admin", "instructor"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);
    const {
      assetNumber,
      description,
      category,
      acquisitionDate,
      acquisitionCost,
      usefulLifeMonths,
      depreciationMethod = "straight_line",
      salvageValue = 0,
      location,
      assignedTo,
      costCenterId,
    } = req.body;

    if (!assetNumber || !description || !category || !acquisitionDate || acquisitionCost == null) {
      throw new AppError(400, "assetNumber, description, category, acquisitionDate, acquisitionCost required");
    }

    const cost = Number(acquisitionCost);
    const salvage = Number(salvageValue) || 0;
    const lifeMonths = Number(usefulLifeMonths) || 60;
    const method = String(depreciationMethod || "straight_line");

    const monthlyDepr = calcMonthlyDepr(cost, cost, lifeMonths, salvage, method);

    const asset = await prisma.asset.create({
      data: {
        tenantId,
        assetNumber,
        description,
        category,
        acquisitionDate: new Date(acquisitionDate),
        acquisitionCost: cost,
        currentValue: cost,
        usefulLifeMonths: lifeMonths,
        depreciationMethod: method,
        salvageValue: salvage,
        monthlyDepr,
        location,
        assignedTo,
        costCenterId,
      },
    });

    res.status(201).json(asset);
  } catch (err) {
    next(err);
  }
});

/** PUT /:id - Update asset */
router.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);
    const existing = await prisma.asset.findUnique({ where: { id: req.params.id } });

    if (!existing || existing.tenantId !== tenantId) {
      throw new AppError(404, "Asset not found");
    }

    const asset = await prisma.asset.update({
      where: { id: req.params.id },
      data: req.body,
    });

    res.json(asset);
  } catch (err) {
    next(err);
  }
});

/** POST /:id/depreciate - Run depreciation for current month */
router.post("/:id/depreciate", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);
    const asset = await prisma.asset.findUnique({ where: { id: req.params.id } });

    if (!asset || asset.tenantId !== tenantId) {
      throw new AppError(404, "Asset not found");
    }
    if (asset.status !== "active") {
      throw new AppError(400, "Cannot depreciate non-active asset");
    }

    const period = new Date().toISOString().slice(0, 7);
    const existing = await prisma.assetDepreciation.findFirst({
      where: { assetId: asset.id, period },
    });
    if (existing) throw new AppError(400, "Depreciation already run for this period");

    const amount = calcMonthlyDepr(
      asset.acquisitionCost,
      asset.currentValue,
      asset.usefulLifeMonths,
      asset.salvageValue,
      asset.depreciationMethod
    );
    const newBookValue = Math.max(asset.salvageValue, asset.currentValue - amount);

    await prisma.$transaction([
      prisma.assetDepreciation.create({
        data: {
          assetId: asset.id,
          period,
          amount,
          bookValue: newBookValue,
          method: asset.depreciationMethod,
        },
      }),
      prisma.asset.update({
        where: { id: asset.id },
        data: {
          accumulatedDepr: asset.accumulatedDepr + amount,
          currentValue: newBookValue,
        },
      }),
    ]);

    const updated = await prisma.asset.findUnique({
      where: { id: asset.id },
      include: { depreciationEntries: { where: { period } } },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/** POST /run-depreciation - Run depreciation for ALL active assets for current month */
router.post("/run-depreciation", requireRoles("admin", "instructor"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);
    const period = new Date().toISOString().slice(0, 7);

    const assets = await prisma.asset.findMany({
      where: { tenantId, status: "active" },
    });

    const results: { assetId: string; amount: number; success: boolean; error?: string }[] = [];

    for (const asset of assets) {
      try {
        const existing = await prisma.assetDepreciation.findFirst({
          where: { assetId: asset.id, period },
        });
        if (existing) {
          results.push({ assetId: asset.id, amount: 0, success: false, error: "Already depreciated" });
          continue;
        }

        const amount = calcMonthlyDepr(
          asset.acquisitionCost,
          asset.currentValue,
          asset.usefulLifeMonths,
          asset.salvageValue,
          asset.depreciationMethod
        );
        const newBookValue = Math.max(asset.salvageValue, asset.currentValue - amount);

        await prisma.$transaction([
          prisma.assetDepreciation.create({
            data: {
              assetId: asset.id,
              period,
              amount,
              bookValue: newBookValue,
              method: asset.depreciationMethod,
            },
          }),
          prisma.asset.update({
            where: { id: asset.id },
            data: {
              accumulatedDepr: asset.accumulatedDepr + amount,
              currentValue: newBookValue,
            },
          }),
        ]);

        results.push({ assetId: asset.id, amount, success: true });
      } catch (e) {
        results.push({ assetId: asset.id, amount: 0, success: false, error: (e as Error).message });
      }
    }

    res.json({ period, results });
  } catch (err) {
    next(err);
  }
});

/** GET /summary - Asset summary */
router.get("/summary", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);

    const assets = await prisma.asset.findMany({
      where: { tenantId },
    });

    const totalAssets = assets.length;
    const totalValue = assets.reduce((s, a) => s + a.currentValue, 0);
    const totalDepreciation = assets.reduce((s, a) => s + a.accumulatedDepr, 0);

    const byCategory: Record<string, number> = {};
    for (const a of assets) {
      byCategory[a.category] = (byCategory[a.category] || 0) + 1;
    }

    const needingMaintenance = assets.filter((a) => a.status === "under_maintenance").length;

    res.json({
      totalAssets,
      totalValue,
      totalDepreciation,
      assetsByCategory: byCategory,
      assetsNeedingMaintenance: needingMaintenance,
    });
  } catch (err) {
    next(err);
  }
});

/** POST /:id/dispose - Dispose asset */
router.post("/:id/dispose", requireRoles("admin", "instructor"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);
    const { disposalValue } = req.body;

    const asset = await prisma.asset.findUnique({ where: { id: req.params.id } });

    if (!asset || asset.tenantId !== tenantId) {
      throw new AppError(404, "Asset not found");
    }

    const updated = await prisma.asset.update({
      where: { id: req.params.id },
      data: {
        status: "disposed",
        disposalDate: new Date(),
        disposalValue: disposalValue != null ? Number(disposalValue) : asset.currentValue,
      },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
