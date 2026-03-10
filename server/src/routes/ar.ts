import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authenticate } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

const router = Router();
router.use(authenticate);

// GET /customer-invoices - list customer invoices with pagination
router.get("/customer-invoices", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tid = req.user!.tenantId;
    const { page = "1", limit = "20", status } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const where: { salesOrder: { tenantId: string }; status?: string } = {
      salesOrder: { tenantId: tid },
    };
    if (status && typeof status === "string") where.status = status;

    const [items, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: { customer: true, salesOrder: true },
        skip,
        take,
        orderBy: { createdAt: "desc" },
      }),
      prisma.invoice.count({ where }),
    ]);

    res.json({ items, total, page: parseInt(page as string), limit: take });
  } catch (err) {
    next(err);
  }
});

// GET /aging-report - aging analysis
router.get("/aging-report", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tid = req.user!.tenantId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const invoices = await prisma.invoice.findMany({
      where: {
        salesOrder: { tenantId: tid },
        status: { in: ["sent", "overdue"] },
      },
      include: { customer: true },
    });

    const buckets = { current: 0, days31_60: 0, days61_90: 0, over90: 0 };
    const byCustomer: Record<
      string,
      { customerId: string; customerName: string; current: number; days31_60: number; days61_90: number; over90: number; total: number }
    > = {};

    for (const inv of invoices) {
      const openAmount = inv.totalAmount - inv.paidAmount;
      if (openAmount <= 0) continue;

      const dueDate = new Date(inv.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000));

      let bucket: keyof typeof buckets;
      if (daysOverdue <= 0) bucket = "current";
      else if (daysOverdue <= 30) bucket = "current";
      else if (daysOverdue <= 60) bucket = "days31_60";
      else if (daysOverdue <= 90) bucket = "days61_90";
      else bucket = "over90";

      buckets[bucket] += openAmount;

      const custId = inv.customerId;
      if (!byCustomer[custId]) {
        byCustomer[custId] = {
          customerId: custId,
          customerName: inv.customer.name,
          current: 0,
          days31_60: 0,
          days61_90: 0,
          over90: 0,
          total: 0,
        };
      }
      byCustomer[custId][bucket] += openAmount;
      byCustomer[custId].total += openAmount;
    }

    const totals = {
      current: buckets.current,
      days31_60: buckets.days31_60,
      days61_90: buckets.days61_90,
      over90: buckets.over90,
      total: buckets.current + buckets.days31_60 + buckets.days61_90 + buckets.over90,
    };

    res.json({
      byCustomer: Object.values(byCustomer),
      totals,
      buckets: {
        current: "0-30 days",
        days31_60: "31-60 days",
        days61_90: "61-90 days",
        over90: "90+ days",
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /receive-payment - record incoming payment
router.post("/receive-payment", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tid = req.user!.tenantId;
    const { invoiceId, amount, paymentMethod, paymentDate, reference } = req.body;

    const inv = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        salesOrder: { tenantId: tid },
      },
    });
    if (!inv) throw new AppError(404, "Invoice not found");
    if (inv.status === "paid") throw new AppError(400, "Invoice already paid");

    const newPaidAmount = inv.paidAmount + (amount ?? inv.totalAmount - inv.paidAmount);
    const isFullyPaid = newPaidAmount >= inv.totalAmount;

    const paymentCount = await prisma.payment.count({ where: { tenantId: tid } });
    const paymentNumber = `PAY-${String(paymentCount + 1).padStart(7, "0")}`;

    const payment = await prisma.payment.create({
      data: {
        tenantId: tid,
        paymentNumber,
        type: "incoming",
        customerId: inv.customerId,
        invoiceRef: inv.invoiceNumber,
        amount: amount ?? inv.totalAmount - inv.paidAmount,
        currency: inv.currency,
        paymentMethod: paymentMethod || "bank_transfer",
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        reference: reference || null,
        status: "completed",
        createdBy: req.user!.userId,
      },
    });

    const updated = await prisma.invoice.update({
      where: { id: inv.id },
      data: {
        paidAmount: newPaidAmount,
        status: isFullyPaid ? "paid" : inv.status,
      },
    });

    res.status(201).json({ payment, invoice: updated });
  } catch (err) {
    next(err);
  }
});

// GET /customer-balance/:customerId - customer balance
router.get("/customer-balance/:customerId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tid = req.user!.tenantId;
    const { customerId } = req.params;

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, tenantId: tid },
    });
    if (!customer) throw new AppError(404, "Customer not found");

    const invoices = await prisma.invoice.findMany({
      where: {
        customerId,
        salesOrder: { tenantId: tid },
        status: { notIn: ["cancelled"] },
      },
    });
    const totalInvoiced = invoices.reduce((s, i) => s + i.totalAmount, 0);
    const totalPaid = invoices.reduce((s, i) => s + i.paidAmount, 0);
    const balance = totalInvoiced - totalPaid;

    res.json({
      customerId,
      customerName: customer.name,
      totalInvoiced,
      totalPaid,
      balance,
    });
  } catch (err) {
    next(err);
  }
});

// GET /payment-status - summary
router.get("/payment-status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tid = req.user!.tenantId;

    const invoices = await prisma.invoice.findMany({
      where: {
        salesOrder: { tenantId: tid },
        status: { in: ["sent", "paid", "overdue"] },
      },
    });

    const totalReceivables = invoices.reduce((s, i) => s + (i.totalAmount - i.paidAmount), 0);
    const totalCollected = invoices.reduce((s, i) => s + i.paidAmount, 0);
    const totalInvoiced = invoices.reduce((s, i) => s + i.totalAmount, 0);

    const overdueInvoices = invoices.filter((i) => {
      const openAmount = i.totalAmount - i.paidAmount;
      if (openAmount <= 0) return false;
      return new Date(i.dueDate) < new Date();
    });
    const overdueAmount = overdueInvoices.reduce((s, i) => s + (i.totalAmount - i.paidAmount), 0);

    const collectionRate = totalInvoiced > 0 ? (totalCollected / totalInvoiced) * 100 : 0;

    res.json({
      totalReceivables,
      totalCollected,
      overdueAmount,
      collectionRate: Math.round(collectionRate * 100) / 100,
      overdueCount: overdueInvoices.length,
    });
  } catch (err) {
    next(err);
  }
});

// POST /credit-check/:customerId - credit check
router.post("/credit-check/:customerId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tid = req.user!.tenantId;
    const { customerId } = req.params;
    const { orderAmount } = req.body;

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, tenantId: tid },
    });
    if (!customer) throw new AppError(404, "Customer not found");

    const invoices = await prisma.invoice.findMany({
      where: {
        customerId,
        salesOrder: { tenantId: tid },
        status: { notIn: ["cancelled", "paid"] },
      },
    });
    const currentBalance = invoices.reduce((s, i) => s + (i.totalAmount - i.paidAmount), 0);
    const creditLimit = customer.creditLimit ?? 0;
    const availableCredit = Math.max(0, creditLimit - currentBalance);
    const requestedAmount = parseFloat(orderAmount) || 0;
    const approved = currentBalance + requestedAmount <= creditLimit;

    res.json({
      approved,
      creditLimit,
      currentBalance,
      availableCredit,
      orderAmount: requestedAmount,
      wouldExceedBy: approved ? 0 : currentBalance + requestedAmount - creditLimit,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
