import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authenticate, requireRoles } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

const router = Router();
router.use(authenticate);

// GET / - list documents
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { entityType, entityId, type, page, limit } = req.query;
    const where: any = { tenantId };
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (type) where.type = type;

    const p = Math.max(1, parseInt(page as string) || 1);
    const l = Math.min(100, parseInt(limit as string) || 25);

    const [data, total] = await Promise.all([
      prisma.document.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (p - 1) * l,
        take: l,
      }),
      prisma.document.count({ where }),
    ]);

    res.json({ data, pagination: { page: p, limit: l, total, totalPages: Math.ceil(total / l) } });
  } catch (err) {
    next(err);
  }
});

// POST / - create/upload document
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, type, entityType, entityId, description, content, tags } = req.body;
    if (!name || !type) throw new AppError(400, "name and type required");

    const doc = await prisma.document.create({
      data: {
        tenantId: req.user!.tenantId,
        name,
        type,
        entityType: entityType ?? null,
        entityId: entityId ?? null,
        description: description ?? null,
        content: content ?? null,
        size: content ? Buffer.byteLength(content, "utf8") : 0,
        tags: tags ? JSON.stringify(tags) : null,
        uploadedBy: req.user!.userId,
      },
    });
    res.status(201).json(doc);
  } catch (err) {
    next(err);
  }
});

// GET /entity/:entityType/:entityId - list docs for entity (must be before /:id)
router.get("/entity/:entityType/:entityId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entityType = req.params.entityType as string;
    const entityId = req.params.entityId as string;
    const data = await prisma.document.findMany({
      where: {
        tenantId: req.user!.tenantId,
        entityType,
        entityId,
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

// GET /:id - get document detail
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc || doc.tenantId !== req.user!.tenantId) throw new AppError(404, "Document not found");
    res.json(doc);
  } catch (err) {
    next(err);
  }
});

// DELETE /:id - delete (admin/instructor or owner)
router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc || doc.tenantId !== req.user!.tenantId) throw new AppError(404, "Document not found");

    const isAdminOrInstructor = req.user!.roles.some((r) => ["admin", "instructor"].includes(r));
    const isOwner = doc.uploadedBy === req.user!.userId;
    if (!isAdminOrInstructor && !isOwner) throw new AppError(403, "Insufficient permissions");

    await prisma.document.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// POST /generate-pdf - generate text-based PDF representation
router.post("/generate-pdf", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entityType, entityId } = req.body;
    if (!entityType || !entityId) throw new AppError(400, "entityType and entityId required");

    let name = "";
    let content = "";
    let type = "invoice_pdf";

    if (entityType === "purchase_order" || entityType === "po") {
      const po = await prisma.purchaseOrder.findFirst({
        where: { id: entityId, tenantId: req.user!.tenantId },
        include: { vendor: true, items: { include: { material: true } } },
      });
      if (!po) throw new AppError(404, "Purchase order not found");
      name = `PO-${po.poNumber}.txt`;
      type = "po_pdf";
      content = [
        "PURCHASE ORDER",
        `PO Number: ${po.poNumber}`,
        `Vendor: ${po.vendor?.name}`,
        `Order Date: ${po.orderDate.toISOString().slice(0, 10)}`,
        `Status: ${po.status}`,
        "",
        "Line Items:",
        ...po.items.map(
          (i) =>
            `  - ${i.material?.description || i.materialId}: ${i.quantity} @ ${i.unitPrice} = ${i.totalPrice}`
        ),
        "",
        `Total: ${po.totalAmount} ${po.currency}`,
      ].join("\n");
    } else if (entityType === "invoice") {
      const inv = await prisma.invoice.findFirst({
        where: { id: entityId },
        include: { customer: true, salesOrder: true, items: true },
      });
      if (!inv || inv.salesOrder?.tenantId !== req.user!.tenantId) throw new AppError(404, "Invoice not found");
      name = `Invoice-${inv.invoiceNumber}.txt`;
      type = "invoice_pdf";
      content = [
        "INVOICE",
        `Invoice Number: ${inv.invoiceNumber}`,
        `Customer: ${inv.customer?.name}`,
        `Invoice Date: ${inv.invoiceDate.toISOString().slice(0, 10)}`,
        `Due Date: ${inv.dueDate.toISOString().slice(0, 10)}`,
        `Status: ${inv.status}`,
        "",
        "Line Items:",
        ...inv.items.map((i) => `  - ${i.description}: ${i.quantity} @ ${i.unitPrice} = ${i.totalPrice}`),
        "",
        `Subtotal: ${inv.subtotal}`,
        `Tax: ${inv.taxAmount}`,
        `Total: ${inv.totalAmount} ${inv.currency}`,
      ].join("\n");
    } else if (entityType === "sales_order") {
      const so = await prisma.salesOrder.findFirst({
        where: { id: entityId, tenantId: req.user!.tenantId },
        include: { customer: true, items: { include: { material: true } } },
      });
      if (!so) throw new AppError(404, "Sales order not found");
      name = `SO-${so.soNumber}.txt`;
      type = "invoice_pdf";
      content = [
        "SALES ORDER",
        `SO Number: ${so.soNumber}`,
        `Customer: ${so.customer?.name}`,
        `Order Date: ${so.orderDate.toISOString().slice(0, 10)}`,
        `Status: ${so.status}`,
        "",
        "Line Items:",
        ...so.items.map(
          (i) =>
            `  - ${i.material?.description || i.materialId}: ${i.quantity} @ ${i.unitPrice} = ${i.totalPrice}`
        ),
        "",
        `Total: ${so.totalAmount} ${so.currency}`,
      ].join("\n");
    } else {
      throw new AppError(400, "Unsupported entityType for PDF generation");
    }

    const base64Content = Buffer.from(content, "utf8").toString("base64");
    res.json({ name, content: base64Content, type });
  } catch (err) {
    next(err);
  }
});

export default router;
