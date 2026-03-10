import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authenticate } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

const router = Router();
router.use(authenticate);

// GET /conditions - list pricing conditions with filters
router.get("/conditions", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tid = req.user!.tenantId;
    const { page = "1", limit = "20", conditionType, materialId, customerId } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const where: { tenantId: string; conditionType?: string; materialId?: string; customerId?: string } = {
      tenantId: tid,
      isActive: true,
    };
    if (conditionType && typeof conditionType === "string") where.conditionType = conditionType;
    if (materialId && typeof materialId === "string") where.materialId = materialId;
    if (customerId && typeof customerId === "string") where.customerId = customerId;

    const [items, total] = await Promise.all([
      prisma.pricingCondition.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
      }),
      prisma.pricingCondition.count({ where }),
    ]);

    res.json({ items, total, page: parseInt(page as string), limit: take });
  } catch (err) {
    next(err);
  }
});

// POST /conditions - create pricing condition
router.post("/conditions", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tid = req.user!.tenantId;
    const { conditionType, name, materialId, customerId, validFrom, validTo, value, currency, minQuantity } = req.body;

    const condition = await prisma.pricingCondition.create({
      data: {
        tenantId: tid,
        conditionType: conditionType || "base_price",
        name: name || "Condition",
        materialId: materialId || null,
        customerId: customerId || null,
        validFrom: validFrom ? new Date(validFrom) : new Date(),
        validTo: validTo ? new Date(validTo) : null,
        value: value ?? 0,
        currency: currency || "USD",
        minQuantity: minQuantity ?? null,
      },
    });
    res.status(201).json(condition);
  } catch (err) {
    next(err);
  }
});

// PUT /conditions/:id - update
router.put("/conditions/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tid = req.user!.tenantId;
    const existing = await prisma.pricingCondition.findFirst({
      where: { id: req.params.id, tenantId: tid },
    });
    if (!existing) throw new AppError(404, "Pricing condition not found");

    const { conditionType, name, materialId, customerId, validFrom, validTo, value, currency, minQuantity, isActive } = req.body;
    const data: Record<string, unknown> = {};
    if (conditionType !== undefined) data.conditionType = conditionType;
    if (name !== undefined) data.name = name;
    if (materialId !== undefined) data.materialId = materialId;
    if (customerId !== undefined) data.customerId = customerId;
    if (validFrom !== undefined) data.validFrom = new Date(validFrom);
    if (validTo !== undefined) data.validTo = validTo ? new Date(validTo) : null;
    if (value !== undefined) data.value = value;
    if (currency !== undefined) data.currency = currency;
    if (minQuantity !== undefined) data.minQuantity = minQuantity;
    if (isActive !== undefined) data.isActive = isActive;

    const updated = await prisma.pricingCondition.update({
      where: { id: req.params.id },
      data,
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /conditions/:id - delete
router.delete("/conditions/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tid = req.user!.tenantId;
    const existing = await prisma.pricingCondition.findFirst({
      where: { id: req.params.id, tenantId: tid },
    });
    if (!existing) throw new AppError(404, "Pricing condition not found");

    await prisma.pricingCondition.delete({ where: { id: req.params.id } });
    res.json({ message: "Pricing condition deleted" });
  } catch (err) {
    next(err);
  }
});

// POST /calculate-price - calculate final price with conditions
router.post("/calculate-price", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tid = req.user!.tenantId;
    const { materialId, customerId, quantity } = req.body;

    const material = await prisma.material.findFirst({
      where: { id: materialId, tenantId: tid },
    });
    if (!material) throw new AppError(404, "Material not found");

    const qty = parseFloat(quantity) || 1;
    const now = new Date();

    const conditions = await prisma.pricingCondition.findMany({
      where: {
        tenantId: tid,
        isActive: true,
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gte: now } }],
      },
    });

    // Filter by material/customer and min quantity
    const applicable = conditions.filter((c) => {
      if (c.materialId && c.materialId !== materialId) return false;
      if (c.customerId && c.customerId !== customerId) return false;
      if (c.minQuantity != null && qty < c.minQuantity) return false;
      return true;
    });

    let basePrice = material.standardPrice ?? material.movingAvgPrice ?? 0;

    const basePriceCond = applicable.find((c) => c.conditionType === "base_price");
    if (basePriceCond) basePrice = basePriceCond.value;

    const discounts: { name: string; type: string; value: number }[] = [];
    const surcharges: { name: string; type: string; value: number }[] = [];
    let freight = 0;
    let taxRate = 0;

    for (const c of applicable) {
      if (c.conditionType === "discount_pct") {
        const discountAmt = basePrice * (c.value / 100);
        discounts.push({ name: c.name, type: "percentage", value: discountAmt });
      } else if (c.conditionType === "discount_amt") {
        discounts.push({ name: c.name, type: "amount", value: c.value });
      } else if (c.conditionType === "surcharge") {
        surcharges.push({ name: c.name, type: "surcharge", value: c.value });
      } else if (c.conditionType === "freight") {
        freight += c.value;
      } else if (c.conditionType === "tax") {
        taxRate = c.value;
      }
    }

    const totalDiscount = discounts.reduce((s, d) => s + d.value, 0);
    const totalSurcharge = surcharges.reduce((s, s2) => s + s2.value, 0);
    const subtotal = Math.max(0, basePrice - totalDiscount + totalSurcharge + freight);
    const tax = subtotal * (taxRate / 100);
    const total = subtotal + tax;

    res.json({
      basePrice,
      discounts,
      surcharges,
      freight,
      tax: taxRate,
      taxAmount: tax,
      subtotal,
      total,
      quantity: qty,
      unitPrice: total / qty,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
