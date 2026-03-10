import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authenticate, requireRoles } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

const router = Router();
router.use(authenticate);

// POST /etl/run - ETL: extract, transform, load (admin/instructor)
router.post(
  "/etl/run",
  requireRoles("admin", "instructor"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;
      const dateKey = new Date().toISOString().slice(0, 10);

      // Clear existing fact data for tenant
      await prisma.factSales.deleteMany({ where: { tenantId } });
      await prisma.factInventory.deleteMany({ where: { tenantId } });

      let salesCount = 0;
      let inventoryCount = 0;

      // FactSales: from SalesOrderItems with posted invoices
      const postedInvoices = await prisma.invoice.findMany({
        where: {
          salesOrder: { tenantId },
          status: { in: ["sent", "paid"] },
        },
        include: {
          salesOrder: {
            include: {
              items: { include: { material: true } },
              customer: true,
            },
          },
        },
      });

      const processedSoIds = new Set<string>();
      for (const inv of postedInvoices) {
        if (processedSoIds.has(inv.soId)) continue;
        processedSoIds.add(inv.soId);
        const so = inv.salesOrder;
        const invDateKey = inv.invoiceDate.toISOString().slice(0, 10);
        const region = so.customer.state || so.customer.country || null;

        for (const item of so.items) {
          const revenue = item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100);
          const cost = item.quantity * (item.material?.standardPrice ?? 0);
          const profit = revenue - cost;

          await prisma.factSales.create({
            data: {
              tenantId,
              dateKey: invDateKey,
              customerId: so.customerId,
              materialId: item.materialId,
              companyCode: null,
              quantity: item.quantity,
              revenue,
              cost,
              profit,
              discount: item.discount || 0,
              region,
            },
          });
          salesCount++;
        }
      }

      // FactInventory: snapshot current stock per warehouse
      const bins = await prisma.warehouseBin.findMany({
        where: {
          warehouse: { tenantId },
          materialId: { not: null },
          quantity: { gt: 0 },
        },
        include: { material: true },
      });

      const invAgg = new Map<string, { qty: number; value: number }>();
      for (const bin of bins) {
        if (!bin.materialId) continue;
        const key = `${bin.warehouseId}|${bin.materialId}`;
        const qty = bin.quantity;
        const value = qty * (bin.material?.standardPrice ?? 0);
        const existing = invAgg.get(key);
        if (existing) {
          existing.qty += qty;
          existing.value += value;
        } else {
          invAgg.set(key, { qty, value });
        }
      }

      for (const [key, { qty, value }] of invAgg) {
        const [warehouseId, materialId] = key.split("|");
        await prisma.factInventory.create({
          data: {
            tenantId,
            dateKey,
            materialId,
            warehouseId,
            stockQuantity: qty,
            stockValue: value,
            inboundQty: 0,
            outboundQty: 0,
          },
        });
        inventoryCount++;
      }

      res.json({
        loaded: { factSales: salesCount, factInventory: inventoryCount },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /sales - query fact_sales with filters
router.get("/sales", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { dateFrom, dateTo, customerId, materialId, groupBy } = req.query;

    const where: any = { tenantId };
    if (dateFrom) where.dateKey = { ...where.dateKey, gte: dateFrom as string };
    if (dateTo) where.dateKey = { ...where.dateKey, lte: dateTo as string };
    if (customerId) where.customerId = customerId;
    if (materialId) where.materialId = materialId;

    const records = await prisma.factSales.findMany({ where });

    if (!groupBy || groupBy === "none") {
      return res.json({ data: records });
    }

    // Aggregate by groupBy
    const agg = new Map<string, { quantity: number; revenue: number; cost: number; profit: number; discount: number }>();
    for (const r of records) {
      let key: string;
      if (groupBy === "customer") key = r.customerId;
      else if (groupBy === "material") key = r.materialId;
      else if (groupBy === "month") key = r.dateKey.slice(0, 7);
      else if (groupBy === "region") key = r.region || "unknown";
      else key = "all";

      const cur = agg.get(key) || { quantity: 0, revenue: 0, cost: 0, profit: 0, discount: 0 };
      cur.quantity += r.quantity;
      cur.revenue += r.revenue;
      cur.cost += r.cost;
      cur.profit += r.profit;
      cur.discount += r.discount;
      agg.set(key, cur);
    }

    const gb = (groupBy as string) || "customer";
    const result = Array.from(agg.entries()).map(([key, v]) => ({ [gb === "month" ? "month" : gb]: key, ...v }));
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// GET /inventory - query fact_inventory
router.get("/inventory", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { date, materialId } = req.query;

    const where: any = { tenantId };
    if (date) where.dateKey = date as string;
    if (materialId) where.materialId = materialId;

    const data = await prisma.factInventory.findMany({ where });
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

// GET /sales/cube - OLAP-style pivot
router.get("/sales/cube", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { dimensions, measures, dateFrom, dateTo } = req.query;

    const where: any = { tenantId };
    if (dateFrom) where.dateKey = { ...where.dateKey, gte: dateFrom as string };
    if (dateTo) where.dateKey = { ...where.dateKey, lte: dateTo as string };

    const records = await prisma.factSales.findMany({ where });
    const dims = (dimensions as string)?.split(",") || ["customer", "material", "time"];
    const meas = (measures as string)?.split(",") || ["revenue", "cost", "profit", "quantity"];

    const agg = new Map<string, Record<string, number>>();
    for (const r of records) {
      const timeKey = r.dateKey.slice(0, 7);
      const keyParts: string[] = [];
      if (dims.includes("customer")) keyParts.push(r.customerId);
      if (dims.includes("material")) keyParts.push(r.materialId);
      if (dims.includes("time")) keyParts.push(timeKey);
      const key = keyParts.join("|");

      const cur = agg.get(key) || { revenue: 0, cost: 0, profit: 0, quantity: 0 };
      if (meas.includes("revenue")) cur.revenue += r.revenue;
      if (meas.includes("cost")) cur.cost += r.cost;
      if (meas.includes("profit")) cur.profit += r.profit;
      if (meas.includes("quantity")) cur.quantity += r.quantity;
      agg.set(key, cur);
    }

    const result = Array.from(agg.entries()).map(([key, values]) => {
      const parts = key.split("|");
      const row: Record<string, string | number> = {};
      let i = 0;
      if (dims.includes("customer")) row.customerId = parts[i++];
      if (dims.includes("material")) row.materialId = parts[i++];
      if (dims.includes("time")) row.month = parts[i++];
      return { ...row, ...values };
    });

    res.json({ data: result, dimensions: dims, measures: meas });
  } catch (err) {
    next(err);
  }
});

// GET /kpis - key metrics
router.get("/kpis", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { dateFrom, dateTo } = req.query;

    const where: any = { tenantId };
    if (dateFrom) where.dateKey = { ...where.dateKey, gte: dateFrom as string };
    if (dateTo) where.dateKey = { ...where.dateKey, lte: dateTo as string };

    const sales = await prisma.factSales.findMany({ where });

    const totalRevenue = sales.reduce((s, r) => s + r.revenue, 0);
    const totalCost = sales.reduce((s, r) => s + r.cost, 0);
    const totalProfit = totalRevenue - totalCost;
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    const byCustomer = new Map<string, number>();
    const byMaterial = new Map<string, number>();
    const byMonth = new Map<string, number>();

    for (const r of sales) {
      byCustomer.set(r.customerId, (byCustomer.get(r.customerId) ?? 0) + r.revenue);
      byMaterial.set(r.materialId, (byMaterial.get(r.materialId) ?? 0) + r.revenue);
      const m = r.dateKey.slice(0, 7);
      byMonth.set(m, (byMonth.get(m) ?? 0) + r.revenue);
    }

    const topCustomers = Array.from(byCustomer.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, revenue]) => ({ customerId: id, revenue }));

    const topProducts = Array.from(byMaterial.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, revenue]) => ({ materialId: id, revenue }));

    const salesTrend = Array.from(byMonth.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, revenue]) => ({ month, revenue }));

    res.json({
      totalRevenue,
      totalCost,
      totalProfit,
      profitMargin,
      topCustomers,
      topProducts,
      salesTrend,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
