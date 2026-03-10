import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authenticate } from "../middleware/auth";
import { auditLog } from "../middleware/audit";
import { AppError } from "../middleware/errorHandler";
import { buildCrudRouter } from "../services/crud";

const router = Router();

// Materials master
router.use(
  "/items",
  buildCrudRouter({
    model: "material",
    module: "materials",
    resource: "material",
    searchFields: ["materialNumber", "description", "materialGroup"],
    defaultSort: { materialNumber: "asc" },
  })
);

// Plants
router.use(
  "/plants",
  buildCrudRouter({
    model: "plant",
    module: "materials",
    resource: "plant",
    searchFields: ["code", "name"],
    defaultSort: { code: "asc" },
  })
);

// Purchase Orders
const poRouter = Router();
poRouter.use(authenticate);
poRouter.use(auditLog("materials", "purchase_order"));

poRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 25);
    const where: any = { tenantId: req.user!.tenantId };
    if (req.query.status) where.status = req.query.status;
    if (req.query.search) {
      where.OR = [
        { poNumber: { contains: req.query.search as string } },
        { vendor: { name: { contains: req.query.search as string } } },
      ];
    }
    const [data, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        include: { vendor: true, items: { include: { material: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.purchaseOrder.count({ where }),
    ]);
    res.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    next(err);
  }
});

poRouter.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: req.params.id },
      include: { vendor: true, items: { include: { material: true } }, goodsReceipts: { include: { items: true } } },
    });
    if (!po || po.tenantId !== req.user!.tenantId) throw new AppError(404, "PO not found");
    res.json(po);
  } catch (err) {
    next(err);
  }
});

poRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { items, ...header } = req.body;
    if (!items || items.length === 0) {
      throw new AppError(400, "At least one line item required");
    }

    const count = await prisma.purchaseOrder.count({ where: { tenantId: req.user!.tenantId } });
    const poNumber = `PO-${String(count + 1).padStart(7, "0")}`;

    const totalAmount = items.reduce(
      (s: number, i: any) => s + (i.quantity || 0) * (i.unitPrice || 0),
      0
    );

    const po = await prisma.purchaseOrder.create({
      data: {
        ...header,
        tenantId: req.user!.tenantId,
        poNumber,
        totalAmount,
        createdBy: req.user!.userId,
        items: {
          create: items.map((item: any, idx: number) => ({
            ...item,
            lineNumber: idx + 1,
            totalPrice: (item.quantity || 0) * (item.unitPrice || 0),
          })),
        },
      },
      include: { vendor: true, items: { include: { material: true } } },
    });
    res.status(201).json(po);
  } catch (err) {
    next(err);
  }
});

poRouter.post("/:id/approve", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const po = await prisma.purchaseOrder.findUnique({ where: { id: req.params.id } });
    if (!po || po.tenantId !== req.user!.tenantId) throw new AppError(404, "PO not found");
    if (po.status !== "draft") throw new AppError(400, "Only draft POs can be approved");

    const updated = await prisma.purchaseOrder.update({
      where: { id: req.params.id },
      data: { status: "approved", approvedBy: req.user!.userId, approvedAt: new Date() },
      include: { vendor: true, items: { include: { material: true } } },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// Goods Receipt
poRouter.post("/:id/goods-receipt", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: req.params.id },
      include: { items: true },
    });
    if (!po || po.tenantId !== req.user!.tenantId) throw new AppError(404, "PO not found");
    if (!["approved", "ordered"].includes(po.status)) {
      throw new AppError(400, "PO must be approved or ordered");
    }

    const { items } = req.body;
    const grCount = await prisma.goodsReceipt.count({ where: { poId: po.id } });
    const grNumber = `GR-${po.poNumber}-${grCount + 1}`;

    const gr = await prisma.goodsReceipt.create({
      data: {
        poId: po.id,
        grNumber,
        createdBy: req.user!.userId,
        items: {
          create: (items || po.items).map((item: any) => ({
            materialId: item.materialId,
            quantity: item.quantity,
            batchNumber: item.batchNumber,
            storageLocation: item.storageLocation,
          })),
        },
      },
      include: { items: true },
    });

    // Update material stock
    for (const item of gr.items) {
      await prisma.material.update({
        where: { id: item.materialId },
        data: { stockQuantity: { increment: item.quantity } },
      });
      await prisma.inventoryMovement.create({
        data: {
          materialId: item.materialId,
          movementType: "receipt",
          quantity: item.quantity,
          reference: grNumber,
          createdBy: req.user!.userId,
        },
      });
    }

    // Check if PO is fully received
    const allReceived = po.items.every((pi) => {
      const receivedForItem = items?.find((i: any) => i.materialId === pi.materialId);
      return (pi.receivedQty + (receivedForItem?.quantity || pi.quantity)) >= pi.quantity;
    });
    if (allReceived) {
      await prisma.purchaseOrder.update({ where: { id: po.id }, data: { status: "received" } });
    } else {
      await prisma.purchaseOrder.update({ where: { id: po.id }, data: { status: "ordered" } });
    }

    res.status(201).json(gr);
  } catch (err) {
    next(err);
  }
});

router.use("/purchase-orders", poRouter);

// Inventory movements
router.use(
  "/inventory-movements",
  buildCrudRouter({
    model: "inventoryMovement",
    module: "materials",
    resource: "inventory_movement",
    tenantScoped: false,
    searchFields: ["reference", "movementType"],
    include: { material: true },
  })
);

export default router;
