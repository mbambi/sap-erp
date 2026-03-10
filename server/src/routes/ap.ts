import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authenticate, requireRoles } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

const router = Router();
router.use(authenticate);

// GET /purchase-requisitions - list PRs with pagination, filter by status
router.get("/purchase-requisitions", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tid = req.user!.tenantId;
    const { page = "1", limit = "20", status } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const where: { tenantId: string; status?: string } = { tenantId: tid };
    if (status && typeof status === "string") where.status = status;

    const [items, total] = await Promise.all([
      prisma.purchaseRequisition.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
      }),
      prisma.purchaseRequisition.count({ where }),
    ]);

    res.json({ items, total, page: parseInt(page as string), limit: take });
  } catch (err) {
    next(err);
  }
});

// POST /purchase-requisitions - create PR (auto-generate prNumber PR-XXXXXXX)
router.post("/purchase-requisitions", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tid = req.user!.tenantId;
    const { materialId, description, quantity, unit, estimatedPrice, requestedDate, vendorId } = req.body;

    const count = await prisma.purchaseRequisition.count({ where: { tenantId: tid } });
    const prNumber = `PR-${String(count + 1).padStart(7, "0")}`;

    const pr = await prisma.purchaseRequisition.create({
      data: {
        tenantId: tid,
        prNumber,
        materialId: materialId || null,
        description: description || "",
        quantity: quantity ?? 1,
        unit: unit || "EA",
        estimatedPrice: estimatedPrice ?? null,
        requestedDate: requestedDate ? new Date(requestedDate) : null,
        vendorId: vendorId || null,
        requestedBy: req.user!.userId,
      },
    });
    res.status(201).json(pr);
  } catch (err) {
    next(err);
  }
});

// POST /purchase-requisitions/:id/approve - approve a PR
router.post("/purchase-requisitions/:id/approve", requireRoles("admin", "instructor"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tid = req.user!.tenantId;
    const pr = await prisma.purchaseRequisition.findFirst({
      where: { id: req.params.id, tenantId: tid },
    });
    if (!pr) throw new AppError(404, "Purchase requisition not found");
    if (pr.status !== "open") throw new AppError(400, "Only open PRs can be approved");

    const updated = await prisma.purchaseRequisition.update({
      where: { id: pr.id },
      data: { status: "approved", approvedBy: req.user!.userId, approvedAt: new Date() },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// POST /purchase-requisitions/:id/convert - convert PR to PO
router.post("/purchase-requisitions/:id/convert", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tid = req.user!.tenantId;
    const pr = await prisma.purchaseRequisition.findFirst({
      where: { id: req.params.id, tenantId: tid },
    });
    if (!pr) throw new AppError(404, "Purchase requisition not found");
    if (pr.status !== "approved") throw new AppError(400, "Only approved PRs can be converted");
    if (!pr.vendorId) throw new AppError(400, "PR must have a vendor to convert");
    if (!pr.materialId) throw new AppError(400, "PR must have a material to convert");

    const poCount = await prisma.purchaseOrder.count({ where: { tenantId: tid } });
    const poNumber = `PO-${String(poCount + 1).padStart(7, "0")}`;

    const unitPrice = pr.estimatedPrice ?? 0;
    const totalAmount = pr.quantity * unitPrice;

    const po = await prisma.purchaseOrder.create({
      data: {
        tenantId: tid,
        poNumber,
        vendorId: pr.vendorId,
        status: "draft",
        totalAmount,
        currency: "USD",
        createdBy: req.user!.userId,
        items: {
          create: {
            lineNumber: 1,
            materialId: pr.materialId!,
            quantity: Math.round(pr.quantity),
            unit: pr.unit,
            unitPrice,
            totalPrice: totalAmount,
          },
        },
      },
      include: { items: true },
    });

    await prisma.purchaseRequisition.update({
      where: { id: pr.id },
      data: { status: "converted", convertedPOId: po.id },
    });

    res.status(201).json({ purchaseOrder: po, message: "PR converted to PO" });
  } catch (err) {
    next(err);
  }
});

// GET /supplier-invoices - list supplier invoices with pagination
router.get("/supplier-invoices", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tid = req.user!.tenantId;
    const { page = "1", limit = "20", status } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const where: { tenantId: string; status?: string } = { tenantId: tid };
    if (status && typeof status === "string") where.status = status;

    const [items, total] = await Promise.all([
      prisma.supplierInvoice.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
      prisma.supplierInvoice.count({ where }),
    ]);

    res.json({ items, total, page: parseInt(page as string), limit: take });
  } catch (err) {
    next(err);
  }
});

// POST /supplier-invoices - create supplier invoice
router.post("/supplier-invoices", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tid = req.user!.tenantId;
    const { invoiceNumber, vendorId, poId, grId, invoiceDate, dueDate, grossAmount, taxAmount, netAmount, currency, notes } = req.body;

    const inv = await prisma.supplierInvoice.create({
      data: {
        tenantId: tid,
        invoiceNumber: invoiceNumber || `SI-${Date.now()}`,
        vendorId,
        poId: poId || null,
        grId: grId || null,
        invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),
        dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        grossAmount: grossAmount ?? 0,
        taxAmount: taxAmount ?? 0,
        netAmount: netAmount ?? grossAmount ?? 0,
        currency: currency || "USD",
        notes: notes || null,
        createdBy: req.user!.userId,
      },
    });
    res.status(201).json(inv);
  } catch (err) {
    next(err);
  }
});

// POST /supplier-invoices/:id/match - 3-way matching
router.post("/supplier-invoices/:id/match", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tid = req.user!.tenantId;
    const inv = await prisma.supplierInvoice.findFirst({
      where: { id: req.params.id, tenantId: tid },
    });
    if (!inv) throw new AppError(404, "Supplier invoice not found");

    const invoiceAmount = inv.netAmount;
    let poAmount: number | null = null;
    let grAmount: number | null = null;

    if (inv.poId) {
      const po = await prisma.purchaseOrder.findFirst({
        where: { id: inv.poId, tenantId: tid },
        include: { items: true },
      });
      if (po) {
        poAmount = po.totalAmount;
      }
    }

    if (inv.grId) {
      const gr = await prisma.goodsReceipt.findFirst({
        where: { id: inv.grId },
        include: { items: true, purchaseOrder: { include: { items: true } } },
      });
      if (gr?.purchaseOrder) {
        const poItems = gr.purchaseOrder.items;
        grAmount = gr.items.reduce((sum, gri) => {
          const poItem = poItems.find((p) => p.materialId === gri.materialId);
          return sum + gri.quantity * (poItem?.unitPrice ?? 0);
        }, 0);
      }
    }

    const TOLERANCE = 0.01;
    let matchStatus = "mismatch";
    let status = inv.status;
    let variance: number | null = null;

    if (poAmount !== null && grAmount !== null) {
      const poMatch = Math.abs(invoiceAmount - poAmount) / (poAmount || 1) <= TOLERANCE;
      const grMatch = Math.abs(invoiceAmount - grAmount) / (grAmount || 1) <= TOLERANCE;
      const poGrMatch = Math.abs(poAmount - grAmount) / (poAmount || 1) <= TOLERANCE;

      if (poMatch && grMatch && poGrMatch) {
        matchStatus = "3way_matched";
        status = "verified";
      } else if (poMatch) {
        matchStatus = "2way_matched";
      } else {
        variance = invoiceAmount - (poAmount ?? 0);
      }
    } else if (poAmount !== null) {
      if (Math.abs(invoiceAmount - poAmount) / (poAmount || 1) <= TOLERANCE) {
        matchStatus = "2way_matched";
      } else {
        variance = invoiceAmount - poAmount;
      }
    }

    const updated = await prisma.supplierInvoice.update({
      where: { id: inv.id },
      data: { matchStatus, status, poAmount, grAmount, variance },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// POST /supplier-invoices/:id/approve - approve matched invoice for payment
router.post("/supplier-invoices/:id/approve", requireRoles("admin", "instructor"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tid = req.user!.tenantId;
    const inv = await prisma.supplierInvoice.findFirst({
      where: { id: req.params.id, tenantId: tid },
    });
    if (!inv) throw new AppError(404, "Supplier invoice not found");
    if (inv.matchStatus === "mismatch") throw new AppError(400, "Cannot approve invoice with mismatch");
    if (inv.status === "paid") throw new AppError(400, "Invoice already paid");

    const updated = await prisma.supplierInvoice.update({
      where: { id: inv.id },
      data: { status: "approved" },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// GET /payments - list payments (filter by type=outgoing for AP)
router.get("/payments", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tid = req.user!.tenantId;
    const { page = "1", limit = "20", type = "outgoing" } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const where: { tenantId: string; type?: string } = { tenantId: tid };
    if (type && typeof type === "string") where.type = type;

    const [items, total] = await Promise.all([
      prisma.payment.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
      prisma.payment.count({ where }),
    ]);

    res.json({ items, total, page: parseInt(page as string), limit: take });
  } catch (err) {
    next(err);
  }
});

// POST /payment-run - automatic payment run
router.post("/payment-run", requireRoles("admin", "instructor"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tid = req.user!.tenantId;

    const invoices = await prisma.supplierInvoice.findMany({
      where: { tenantId: tid, status: "approved" },
    });

    const payments: { id: string; paymentNumber: string; amount: number; vendorId: string }[] = [];
    const paymentCount = await prisma.payment.count({ where: { tenantId: tid } });

    for (let i = 0; i < invoices.length; i++) {
      const inv = invoices[i];
      const paymentNumber = `PAY-${String(paymentCount + i + 1).padStart(7, "0")}`;

      const payment = await prisma.payment.create({
        data: {
          tenantId: tid,
          paymentNumber,
          type: "outgoing",
          vendorId: inv.vendorId,
          invoiceRef: inv.invoiceNumber,
          amount: inv.netAmount,
          currency: inv.currency,
          paymentDate: new Date(),
          status: "completed",
          createdBy: req.user!.userId,
        },
      });

      await prisma.supplierInvoice.update({
        where: { id: inv.id },
        data: { status: "paid", paymentRef: paymentNumber },
      });

      payments.push({
        id: payment.id,
        paymentNumber: payment.paymentNumber,
        amount: payment.amount,
        vendorId: inv.vendorId,
      });
    }

    res.json({
      summary: {
        invoicesProcessed: invoices.length,
        totalAmount: payments.reduce((s, p) => s + p.amount, 0),
        paymentsCreated: payments.length,
      },
      payments,
    });
  } catch (err) {
    next(err);
  }
});

// GET /vendor-balance/:vendorId - vendor balance
router.get("/vendor-balance/:vendorId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tid = req.user!.tenantId;
    const { vendorId } = req.params;

    const vendor = await prisma.vendor.findFirst({
      where: { id: vendorId, tenantId: tid },
    });
    if (!vendor) throw new AppError(404, "Vendor not found");

    const openInvoices = await prisma.supplierInvoice.findMany({
      where: { tenantId: tid, vendorId, status: { notIn: ["paid"] } },
    });
    const openInvoiceTotal = openInvoices.reduce((s, i) => s + i.netAmount, 0);

    const payments = await prisma.payment.findMany({
      where: { tenantId: tid, vendorId, type: "outgoing", status: "completed" },
    });
    const totalPayments = payments.reduce((s, p) => s + p.amount, 0);

    // Balance = open invoices (amount we owe); payments reduce liability when invoices are marked paid
    const balance = openInvoiceTotal;

    res.json({
      vendorId,
      vendorName: vendor.name,
      openInvoiceTotal,
      totalPayments,
      balance,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
