import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authenticate, requireRoles } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";
import crypto from "crypto";

const router = Router();
router.use(authenticate);

const tenantScope = (req: Request) => req.user!.tenantId;

/** GET /supplier - List supplier portal accesses (admin/instructor) */
router.get("/supplier", requireRoles("admin", "instructor"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const accesses = await prisma.portalAccess.findMany({
      where: { tenantId: tenantScope(req), portalType: "supplier", isActive: true },
    });
    res.json(accesses);
  } catch (err) {
    next(err);
  }
});

/** GET /customer - List customer portal accesses (admin/instructor) */
router.get("/customer", requireRoles("admin", "instructor"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const accesses = await prisma.portalAccess.findMany({
      where: { tenantId: tenantScope(req), portalType: "customer", isActive: true },
    });
    res.json(accesses);
  } catch (err) {
    next(err);
  }
});

/** POST /grant-access - Create portal access (admin/instructor) */
router.post("/grant-access", requireRoles("admin", "instructor"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { portalType, externalId, email, name, permissions } = req.body;
    if (!portalType || !externalId || !email || !name) {
      throw new AppError(400, "portalType, externalId, email, and name are required");
    }
    const accessToken = crypto.randomBytes(32).toString("hex");

    const access = await prisma.portalAccess.create({
      data: {
        tenantId: tenantScope(req),
        portalType,
        externalId,
        email,
        name,
        accessToken,
        permissions: permissions ? JSON.stringify(permissions) : "[]",
      },
    });
    res.status(201).json(access);
  } catch (err) {
    next(err);
  }
});

/** PUT /:id/revoke - Deactivate portal access (admin/instructor) */
router.put("/:id/revoke", requireRoles("admin", "instructor"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const access = await prisma.portalAccess.findFirst({
      where: { id, tenantId: tenantScope(req) },
    });
    if (!access) throw new AppError(404, "Portal access not found");

    const updated = await prisma.portalAccess.update({
      where: { id },
      data: { isActive: false },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/** GET /supplier/:vendorId/orders - Supplier view: POs for this vendor */
router.get("/supplier/:vendorId/orders", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tid = tenantScope(req);
    const vendorId = String(req.params.vendorId);

    const vendor = await prisma.vendor.findFirst({
      where: { id: vendorId, tenantId: tid },
    });
    if (!vendor) throw new AppError(404, "Vendor not found");

    const orders = await prisma.purchaseOrder.findMany({
      where: { tenantId: tid, vendorId },
      include: { items: { include: { material: true } } },
      orderBy: { orderDate: "desc" },
    });
    res.json(orders);
  } catch (err) {
    next(err);
  }
});

/** GET /supplier/:vendorId/invoices - Supplier view: supplier invoices */
router.get("/supplier/:vendorId/invoices", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tid = tenantScope(req);
    const vendorId = String(req.params.vendorId);

    const vendor = await prisma.vendor.findFirst({
      where: { id: vendorId, tenantId: tid },
    });
    if (!vendor) throw new AppError(404, "Vendor not found");

    const invoices = await prisma.supplierInvoice.findMany({
      where: { tenantId: tid, vendorId },
      orderBy: { invoiceDate: "desc" },
    });
    res.json(invoices);
  } catch (err) {
    next(err);
  }
});

/** POST /supplier/:vendorId/confirm-delivery - Supplier confirms delivery for a PO */
router.post("/supplier/:vendorId/confirm-delivery", requireRoles("admin", "instructor"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tid = tenantScope(req);
    const vendorId = String(req.params.vendorId);
    const poId = req.body.poId as string;

    if (!poId) throw new AppError(400, "poId is required");

    const po = await prisma.purchaseOrder.findFirst({
      where: { id: poId, tenantId: tid, vendorId },
    });
    if (!po) throw new AppError(404, "Purchase order not found");

    const items = await prisma.purchaseOrderItem.findMany({
      where: { poId: po.id },
    });

    const grCount = await prisma.goodsReceipt.count({ where: { poId } });
    const grNumber = `GR-${po.poNumber}-${String(grCount + 1).padStart(3, "0")}`;

    const gr = await prisma.goodsReceipt.create({
      data: {
        poId,
        grNumber,
        receiptDate: new Date(),
        notes: "Supplier confirmed delivery",
        createdBy: req.user!.userId,
        items: {
          create: items
            .filter((item) => item.quantity > item.receivedQty)
            .map((item) => ({
              materialId: item.materialId,
              quantity: item.quantity - item.receivedQty,
              batchNumber: null,
              storageLocation: null,
            })),
        },
      },
      include: { items: true },
    });

    for (const item of items) {
      await prisma.purchaseOrderItem.update({
        where: { id: item.id },
        data: { receivedQty: item.quantity },
      });
    }

    const totalReceived = items.reduce((s, i) => s + i.quantity, 0);
    const totalOrdered = items.reduce((s, i) => s + i.quantity, 0);
    const newStatus = totalReceived >= totalOrdered ? "received" : po.status;
    await prisma.purchaseOrder.update({
      where: { id: poId },
      data: { status: newStatus },
    });

    res.status(201).json(gr);
  } catch (err) {
    next(err);
  }
});

/** GET /customer/:customerId/orders - Customer view: SOs for this customer */
router.get("/customer/:customerId/orders", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tid = tenantScope(req);
    const customerId = String(req.params.customerId);

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, tenantId: tid },
    });
    if (!customer) throw new AppError(404, "Customer not found");

    const orders = await prisma.salesOrder.findMany({
      where: { tenantId: tid, customerId },
      include: { items: { include: { material: true } } },
      orderBy: { orderDate: "desc" },
    });
    res.json(orders);
  } catch (err) {
    next(err);
  }
});

/** GET /customer/:customerId/invoices - Customer view: invoices */
router.get("/customer/:customerId/invoices", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tid = tenantScope(req);
    const customerId = String(req.params.customerId);

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, tenantId: tid },
    });
    if (!customer) throw new AppError(404, "Customer not found");

    const invoices = await prisma.invoice.findMany({
      where: { customerId },
      include: { salesOrder: true },
      orderBy: { invoiceDate: "desc" },
    });
    res.json(invoices);
  } catch (err) {
    next(err);
  }
});

/** GET /customer/:customerId/shipments - Customer view: shipments */
router.get("/customer/:customerId/shipments", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tid = tenantScope(req);
    const customerId = String(req.params.customerId);

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, tenantId: tid },
    });
    if (!customer) throw new AppError(404, "Customer not found");

    const soNumbers = await prisma.salesOrder.findMany({
      where: { tenantId: tid, customerId },
      select: { soNumber: true },
    });
    const refs = soNumbers.map((s) => s.soNumber);

    const shipments = await prisma.shipment.findMany({
      where: {
        tenantId: tid,
        referenceType: "sales_order",
        referenceDoc: { in: refs },
      },
      orderBy: { plannedDate: "desc" },
    });
    res.json(shipments);
  } catch (err) {
    next(err);
  }
});

export default router;
