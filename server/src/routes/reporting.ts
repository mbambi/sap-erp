import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authenticate } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

const router = Router();
router.use(authenticate);

// Dashboard KPIs
router.get("/dashboard", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tid = req.user!.tenantId;

    const [
      totalPOs,
      openPOs,
      totalSOs,
      openSOs,
      totalMaterials,
      lowStockMaterials,
      totalEmployees,
      pendingLeaves,
      totalJournals,
      openWorkOrders,
      totalCustomers,
      totalVendors,
    ] = await Promise.all([
      prisma.purchaseOrder.count({ where: { tenantId: tid } }),
      prisma.purchaseOrder.count({ where: { tenantId: tid, status: { in: ["draft", "approved", "ordered"] } } }),
      prisma.salesOrder.count({ where: { tenantId: tid } }),
      prisma.salesOrder.count({ where: { tenantId: tid, status: { in: ["draft", "confirmed", "processing"] } } }),
      prisma.material.count({ where: { tenantId: tid } }),
      prisma.material.count({ where: { tenantId: tid, stockQuantity: { lte: prisma.material.fields?.reorderPoint as any || 0 } } }).catch(() => 0),
      prisma.employee.count({ where: { tenantId: tid } }),
      prisma.leaveRequest.count({ where: { employee: { tenantId: tid }, status: "pending" } }),
      prisma.journalEntry.count({ where: { tenantId: tid, status: "posted" } }),
      prisma.workOrder.count({ where: { tenantId: tid, status: { in: ["open", "in_progress"] } } }),
      prisma.customer.count({ where: { tenantId: tid } }),
      prisma.vendor.count({ where: { tenantId: tid } }),
    ]);

    // Recent sales orders
    const recentSOs = await prisma.salesOrder.findMany({
      where: { tenantId: tid },
      include: { customer: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    // Recent POs
    const recentPOs = await prisma.purchaseOrder.findMany({
      where: { tenantId: tid },
      include: { vendor: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    res.json({
      kpis: {
        totalPOs,
        openPOs,
        totalSOs,
        openSOs,
        totalMaterials,
        lowStockMaterials,
        totalEmployees,
        pendingLeaves,
        totalJournals,
        openWorkOrders,
        totalCustomers,
        totalVendors,
      },
      recentSOs,
      recentPOs,
    });
  } catch (err) {
    next(err);
  }
});

// Financial analytics
router.get("/financial", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tid = req.user!.tenantId;

    const [invoices, purchaseOrders, materials] = await Promise.all([
      prisma.invoice.findMany({
        where: { salesOrder: { tenantId: tid }, status: { in: ["sent", "paid"] } },
        select: { totalAmount: true, invoiceDate: true },
      }),
      prisma.purchaseOrder.findMany({
        where: { tenantId: tid, status: { in: ["approved", "ordered", "received"] } },
        select: { totalAmount: true, createdAt: true },
      }),
      prisma.material.findMany({
        where: { tenantId: tid },
        select: { type: true, stockQuantity: true, standardPrice: true, movingAvgPrice: true },
      }),
    ]);

    const revenue = invoices.reduce((s, i) => s + i.totalAmount, 0);
    const expenses = purchaseOrders.reduce((s, p) => s + p.totalAmount, 0);
    const grossMargin = revenue > 0 ? ((revenue - expenses) / revenue) * 100 : 0;
    const cashFlow = revenue - expenses;

    const revenueByMonth = invoices.reduce((acc: Record<string, number>, inv) => {
      const m = inv.invoiceDate.toISOString().slice(0, 7);
      acc[m] = (acc[m] || 0) + inv.totalAmount;
      return acc;
    }, {});
    const expenseByMonth = purchaseOrders.reduce((acc: Record<string, number>, po) => {
      const m = po.createdAt.toISOString().slice(0, 7);
      acc[m] = (acc[m] || 0) + po.totalAmount;
      return acc;
    }, {});

    const allMonths = [...new Set([...Object.keys(revenueByMonth), ...Object.keys(expenseByMonth)])].sort();
    const monthlyData = allMonths.map((m) => ({
      month: m,
      revenue: revenueByMonth[m] || 0,
      expenses: expenseByMonth[m] || 0,
    }));

    const expenseCategories = purchaseOrders.length > 0
      ? [{ name: "Procurement", value: expenses }]
      : [];

    const inventoryByType = materials.reduce((acc: Record<string, number>, m) => {
      const type = m.type || "other";
      const val = (m.stockQuantity || 0) * (m.movingAvgPrice || m.standardPrice || 0);
      acc[type] = (acc[type] || 0) + val;
      return acc;
    }, {});
    const inventoryDonut = Object.entries(inventoryByType).map(([name, value]) => ({ name, value }));

    const avgInventory = materials.length > 0
      ? materials.reduce((s, m) => s + (m.stockQuantity || 0) * (m.movingAvgPrice || m.standardPrice || 0), 0)
      : 0;
    const cogs = expenses;
    const inventoryTurnover = avgInventory > 0 ? cogs / avgInventory : 0;
    const daysOfInventory = inventoryTurnover > 0 ? 365 / inventoryTurnover : 0;

    res.json({
      revenue,
      expenses,
      grossMargin,
      cashFlow,
      monthlyData,
      expenseCategories,
      inventoryDonut,
      inventoryTurnover,
      daysOfInventory,
      avgInventory,
    });
  } catch (err) {
    next(err);
  }
});

// Saved reports CRUD
router.get("/reports", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reports = await prisma.savedReport.findMany({
      where: { tenantId: req.user!.tenantId },
      orderBy: { updatedAt: "desc" },
    });
    res.json(reports);
  } catch (err) {
    next(err);
  }
});

router.post("/reports", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const report = await prisma.savedReport.create({
      data: {
        ...req.body,
        tenantId: req.user!.tenantId,
        createdBy: req.user!.userId,
      },
    });
    res.status(201).json(report);
  } catch (err) {
    next(err);
  }
});

router.put("/reports/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.savedReport.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.tenantId !== req.user!.tenantId) {
      throw new AppError(404, "Report not found");
    }
    const report = await prisma.savedReport.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(report);
  } catch (err) {
    next(err);
  }
});

router.delete("/reports/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.savedReport.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.tenantId !== req.user!.tenantId) {
      throw new AppError(404, "Report not found");
    }
    await prisma.savedReport.delete({ where: { id: req.params.id } });
    res.json({ message: "Report deleted" });
  } catch (err) {
    next(err);
  }
});

export default router;
