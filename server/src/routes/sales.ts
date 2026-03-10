import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authenticate } from "../middleware/auth";
import { auditLog } from "../middleware/audit";
import { AppError } from "../middleware/errorHandler";

const router = Router();

// Sales Orders
const soRouter = Router();
soRouter.use(authenticate);
soRouter.use(auditLog("sales", "sales_order"));

soRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 25);
    const where: any = { tenantId: req.user!.tenantId };
    if (req.query.status) where.status = req.query.status;
    if (req.query.search) {
      where.OR = [
        { soNumber: { contains: req.query.search as string } },
        { customer: { name: { contains: req.query.search as string } } },
      ];
    }
    const [data, total] = await Promise.all([
      prisma.salesOrder.findMany({
        where,
        include: { customer: true, items: { include: { material: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.salesOrder.count({ where }),
    ]);
    res.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    next(err);
  }
});

soRouter.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const so = await prisma.salesOrder.findUnique({
      where: { id: req.params.id },
      include: {
        customer: true,
        items: { include: { material: true } },
        deliveries: { include: { items: true } },
        invoices: { include: { items: true } },
      },
    });
    if (!so || so.tenantId !== req.user!.tenantId) throw new AppError(404, "SO not found");
    res.json(so);
  } catch (err) {
    next(err);
  }
});

soRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { items, ...header } = req.body;
    if (!items || items.length === 0) throw new AppError(400, "At least one item required");

    const count = await prisma.salesOrder.count({ where: { tenantId: req.user!.tenantId } });
    const soNumber = `SO-${String(count + 1).padStart(7, "0")}`;

    const totalAmount = items.reduce(
      (s: number, i: any) => s + (i.quantity || 0) * (i.unitPrice || 0) * (1 - (i.discount || 0) / 100),
      0
    );

    const so = await prisma.salesOrder.create({
      data: {
        ...header,
        tenantId: req.user!.tenantId,
        soNumber,
        totalAmount,
        createdBy: req.user!.userId,
        items: {
          create: items.map((item: any, idx: number) => ({
            ...item,
            lineNumber: idx + 1,
            totalPrice: (item.quantity || 0) * (item.unitPrice || 0) * (1 - (item.discount || 0) / 100),
          })),
        },
      },
      include: { customer: true, items: { include: { material: true } } },
    });
    res.status(201).json(so);
  } catch (err) {
    next(err);
  }
});

soRouter.post("/:id/confirm", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const so = await prisma.salesOrder.findUnique({ where: { id: req.params.id } });
    if (!so || so.tenantId !== req.user!.tenantId) throw new AppError(404, "SO not found");
    if (so.status !== "draft") throw new AppError(400, "Only draft orders can be confirmed");

    const updated = await prisma.salesOrder.update({
      where: { id: req.params.id },
      data: { status: "confirmed" },
      include: { customer: true, items: { include: { material: true } } },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// Create delivery from sales order
soRouter.post("/:id/deliver", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const so = await prisma.salesOrder.findUnique({
      where: { id: req.params.id },
      include: { items: true },
    });
    if (!so || so.tenantId !== req.user!.tenantId) throw new AppError(404, "SO not found");
    if (!["confirmed", "processing"].includes(so.status)) {
      throw new AppError(400, "Order must be confirmed");
    }

    const count = await prisma.delivery.count({ where: { soId: so.id } });
    const deliveryNumber = `DL-${so.soNumber}-${count + 1}`;

    const delivery = await prisma.delivery.create({
      data: {
        deliveryNumber,
        soId: so.id,
        customerId: so.customerId,
        createdBy: req.user!.userId,
        items: {
          create: so.items.map((item) => ({
            materialId: item.materialId,
            quantity: item.quantity - item.deliveredQty,
          })),
        },
      },
      include: { items: true },
    });

    // Reduce stock
    for (const item of delivery.items) {
      await prisma.material.update({
        where: { id: item.materialId },
        data: { stockQuantity: { decrement: item.quantity } },
      });
    }

    await prisma.salesOrder.update({
      where: { id: so.id },
      data: { status: "processing" },
    });

    res.status(201).json(delivery);
  } catch (err) {
    next(err);
  }
});

// Create invoice from sales order
soRouter.post("/:id/invoice", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const so = await prisma.salesOrder.findUnique({
      where: { id: req.params.id },
      include: { items: true, customer: true },
    });
    if (!so || so.tenantId !== req.user!.tenantId) throw new AppError(404, "SO not found");

    const count = await prisma.invoice.count({ where: { soId: so.id } });
    const invoiceNumber = `INV-${so.soNumber}-${count + 1}`;

    const taxRate = 0.1;
    const subtotal = so.totalAmount;
    const taxAmount = subtotal * taxRate;
    const totalAmount = subtotal + taxAmount;

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        soId: so.id,
        customerId: so.customerId,
        dueDate,
        subtotal,
        taxAmount,
        totalAmount,
        createdBy: req.user!.userId,
        items: {
          create: so.items.map((item) => ({
            description: `${item.materialId} x ${item.quantity}`,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
          })),
        },
      },
      include: { items: true, customer: true },
    });
    res.status(201).json(invoice);
  } catch (err) {
    next(err);
  }
});

router.use("/orders", soRouter);

// Deliveries list
router.get("/deliveries", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 25);
    const data = await prisma.delivery.findMany({
      where: { salesOrder: { tenantId: req.user!.tenantId } },
      include: { customer: true, salesOrder: true, items: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });
    const total = await prisma.delivery.count({
      where: { salesOrder: { tenantId: req.user!.tenantId } },
    });
    res.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    next(err);
  }
});

// Invoices list
router.get("/invoices", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 25);
    const data = await prisma.invoice.findMany({
      where: { salesOrder: { tenantId: req.user!.tenantId } },
      include: { customer: true, salesOrder: true, items: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });
    const total = await prisma.invoice.count({
      where: { salesOrder: { tenantId: req.user!.tenantId } },
    });
    res.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    next(err);
  }
});

export default router;
