import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authenticate } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

const router = Router();
router.use(authenticate);

// POST /goods-issue - issue materials from inventory
router.post("/goods-issue", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tid = req.user!.tenantId;
    const { materialId, quantity, reason, reference } = req.body;

    const material = await prisma.material.findFirst({
      where: { id: materialId, tenantId: tid },
    });
    if (!material) throw new AppError(404, "Material not found");
    const qty = parseInt(quantity) || 0;
    if (qty <= 0) throw new AppError(400, "Quantity must be positive");
    const available = (material.stockQuantity ?? 0) - (material.reservedQty ?? 0);
    if (qty > available) throw new AppError(400, `Insufficient stock. Available: ${available}`);

    await prisma.$transaction([
      prisma.material.update({
        where: { id: materialId },
        data: { stockQuantity: { decrement: qty } },
      }),
      prisma.inventoryMovement.create({
        data: {
          materialId,
          movementType: "issue",
          quantity: qty,
          unit: material.baseUnit || "EA",
          fromLocation: null,
          toLocation: null,
          reference: reference || null,
          reason: reason || null,
          createdBy: req.user!.userId,
        },
      }),
    ]);

    const updated = await prisma.material.findUnique({ where: { id: materialId } });
    res.status(201).json({ message: "Goods issued", material: updated });
  } catch (err) {
    next(err);
  }
});

// POST /stock-transfer - transfer between locations
router.post("/stock-transfer", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tid = req.user!.tenantId;
    const { materialId, quantity, fromLocation, toLocation } = req.body;

    const material = await prisma.material.findFirst({
      where: { id: materialId, tenantId: tid },
    });
    if (!material) throw new AppError(404, "Material not found");
    const qty = parseInt(quantity) || 0;
    if (qty <= 0) throw new AppError(400, "Quantity must be positive");
    const available = (material.stockQuantity ?? 0) - (material.reservedQty ?? 0);
    if (qty > available) throw new AppError(400, `Insufficient stock. Available: ${available}`);

    const movement = await prisma.inventoryMovement.create({
      data: {
        materialId,
        movementType: "transfer",
        quantity: qty,
        unit: material.baseUnit || "EA",
        fromLocation: fromLocation || null,
        toLocation: toLocation || null,
        reference: null,
        reason: `Transfer from ${fromLocation || "?"} to ${toLocation || "?"}`,
        createdBy: req.user!.userId,
      },
    });

    res.status(201).json({ message: "Stock transfer recorded", movement });
  } catch (err) {
    next(err);
  }
});

// POST /inventory-count - physical count adjustment
router.post("/inventory-count", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tid = req.user!.tenantId;
    const { materialId, countedQty, location } = req.body;

    const material = await prisma.material.findFirst({
      where: { id: materialId, tenantId: tid },
    });
    if (!material) throw new AppError(404, "Material not found");

    const currentQty = material.stockQuantity ?? 0;
    const counted = parseInt(countedQty) ?? 0;
    const difference = counted - currentQty;

    await prisma.$transaction([
      prisma.material.update({
        where: { id: materialId },
        data: { stockQuantity: counted },
      }),
      prisma.inventoryMovement.create({
        data: {
          materialId,
          movementType: "adjustment",
          quantity: Math.abs(difference),
          unit: material.baseUnit || "EA",
          fromLocation: location || null,
          toLocation: location || null,
          reference: null,
          reason: `Physical count: ${currentQty} -> ${counted} (${difference >= 0 ? "+" : ""}${difference})`,
          createdBy: req.user!.userId,
        },
      }),
    ]);

    const updated = await prisma.material.findUnique({ where: { id: materialId } });
    res.status(201).json({
      message: "Inventory adjusted",
      material: updated,
      previousQty: currentQty,
      countedQty: counted,
      difference,
    });
  } catch (err) {
    next(err);
  }
});

// GET /stock-overview - materials stock overview
router.get("/stock-overview", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tid = req.user!.tenantId;

    const materials = await prisma.material.findMany({
      where: { tenantId: tid, isActive: true },
    });

    const overview = materials.map((m) => {
      const stockQty = m.stockQuantity ?? 0;
      const reservedQty = m.reservedQty ?? 0;
      const availableQty = stockQty - reservedQty;
      const price = m.movingAvgPrice || m.standardPrice || 0;
      const stockValue = stockQty * price;
      const reorderPoint = m.reorderPoint ?? 0;
      const reorderAlert = stockQty < reorderPoint;

      return {
        materialId: m.id,
        materialNumber: m.materialNumber,
        description: m.description,
        stockQuantity: stockQty,
        reservedQty,
        availableQty,
        stockValue,
        reorderAlert,
        reorderPoint,
      };
    });

    res.json(overview);
  } catch (err) {
    next(err);
  }
});

// GET /movements - list inventory movements with pagination and filters
router.get("/movements", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tid = req.user!.tenantId;
    const { page = "1", limit = "20", materialId, movementType, dateFrom, dateTo } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const where: { material: { tenantId: string }; materialId?: string; movementType?: string; createdAt?: object } = {
      material: { tenantId: tid },
    };
    if (materialId && typeof materialId === "string") where.materialId = materialId;
    if (movementType && typeof movementType === "string") where.movementType = movementType;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) (where.createdAt as { gte?: Date }).gte = new Date(dateFrom as string);
      if (dateTo) (where.createdAt as { lte?: Date }).lte = new Date(dateTo as string);
    }

    const [items, total] = await Promise.all([
      prisma.inventoryMovement.findMany({
        where,
        include: { material: { select: { materialNumber: true, description: true } } },
        skip,
        take,
        orderBy: { createdAt: "desc" },
      }),
      prisma.inventoryMovement.count({ where }),
    ]);

    res.json({ items, total, page: parseInt(page as string), limit: take });
  } catch (err) {
    next(err);
  }
});

// GET /valuation - inventory valuation report
router.get("/valuation", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tid = req.user!.tenantId;

    const materials = await prisma.material.findMany({
      where: { tenantId: tid },
    });

    const totalStockValue = materials.reduce(
      (s, m) => s + (m.stockQuantity ?? 0) * (m.movingAvgPrice || m.standardPrice || 0),
      0
    );

    const byType: Record<string, number> = {};
    const byGroup: Record<string, number> = {};

    for (const m of materials) {
      const val = (m.stockQuantity ?? 0) * (m.movingAvgPrice || m.standardPrice || 0);
      const type = m.type || "other";
      const group = m.materialGroup || "ungrouped";
      byType[type] = (byType[type] || 0) + val;
      byGroup[group] = (byGroup[group] || 0) + val;
    }

    res.json({
      totalStockValue,
      byMaterialType: Object.entries(byType).map(([name, value]) => ({ name, value })),
      byMaterialGroup: Object.entries(byGroup).map(([name, value]) => ({ name, value })),
    });
  } catch (err) {
    next(err);
  }
});

// POST /batch-update - update batch/lot info on goods receipt items
router.post("/batch-update", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tid = req.user!.tenantId;
    const { items } = req.body; // [{ goodsReceiptItemId, batchNumber?, storageLocation? }]

    if (!Array.isArray(items) || items.length === 0) {
      throw new AppError(400, "items array required with at least one entry");
    }

    const results = [];
    for (const it of items) {
      const { goodsReceiptItemId, batchNumber, storageLocation } = it;

      const gri = await prisma.goodsReceiptItem.findFirst({
        where: {
          id: goodsReceiptItemId,
          goodsReceipt: { purchaseOrder: { tenantId: tid } },
        },
      });
      if (!gri) {
        results.push({ goodsReceiptItemId, success: false, error: "Not found" });
        continue;
      }

      const data: { batchNumber?: string; storageLocation?: string } = {};
      if (batchNumber !== undefined) data.batchNumber = batchNumber;
      if (storageLocation !== undefined) data.storageLocation = storageLocation;

      const updated = await prisma.goodsReceiptItem.update({
        where: { id: goodsReceiptItemId },
        data,
      });
      results.push({ goodsReceiptItemId, success: true, item: updated });
    }

    res.json({ updated: results.filter((r) => r.success).length, results });
  } catch (err) {
    next(err);
  }
});

export default router;
