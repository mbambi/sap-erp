import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authenticate } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";
import { runMrpEngine, MrpConfig } from "../services/mrpEngine";

const router = Router();
router.use(authenticate);

const tenantScope = (req: Request) => req.user!.tenantId;

// ─── MRP Runs ─────────────────────────────────────────────────────────

/** GET /runs - List MRP runs for tenant */
router.get("/runs", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 25);
    const status = req.query.status as string | undefined;
    const where: { tenantId: string; status?: string } = { tenantId };
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      prisma.mrpRun.findMany({
        where,
        orderBy: { runDate: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.mrpRun.count({ where }),
    ]);

    res.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

/** POST /runs - Create and execute an MRP run */
router.post("/runs", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);
    const userId = req.user!.userId;
    const { planningHorizonDays = 90 } = req.body;

    // Auto-generate run number MRP-XXXXXXX
    const runCount = await prisma.mrpRun.count({ where: { tenantId } });
    const runNumber = `MRP-${String(runCount + 1).padStart(7, "0")}`;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Create run record (draft first, then update to completed)
    const run = await prisma.mrpRun.create({
      data: {
        tenantId,
        runNumber,
        runDate: today,
        planningHorizonDays: Number(planningHorizonDays) || 90,
        status: "running",
        parameters: JSON.stringify({ planningHorizonDays }),
        createdBy: userId,
      },
    });

    try {
      const materials = await prisma.material.findMany({
        where: { tenantId, isActive: true },
      });

      const horizonEnd = new Date(today);
      horizonEnd.setDate(horizonEnd.getDate() + (run.planningHorizonDays || 90));

      const plannedOrders: Array<{
        materialId: string;
        orderType: string;
        quantity: number;
        unit: string;
        plannedDate: Date;
        dueDate: Date;
      }> = [];

      for (const material of materials) {
        // Demand: sales order open qty + forecast
        const soWhere = {
          salesOrder: {
            tenantId,
            status: { notIn: ["cancelled", "completed"] },
          },
          materialId: material.id,
        };
        const [soDemand, soDelivered] = await Promise.all([
          prisma.salesOrderItem.aggregate({
            where: soWhere,
            _sum: { quantity: true },
          }),
          prisma.salesOrderItem.aggregate({
            where: soWhere,
            _sum: { deliveredQty: true },
          }),
        ]);
        const openSoQty = (soDemand._sum.quantity ?? 0) - (soDelivered._sum.deliveredQty ?? 0);

        const forecast = await prisma.demandForecast.aggregate({
          where: {
            tenantId,
            materialId: material.id,
            periodEnd: { gte: today },
            periodStart: { lte: horizonEnd },
          },
          _sum: { forecastQty: true },
        });
        const forecastQty = forecast._sum.forecastQty ?? 0;

        const totalDemand = openSoQty + forecastQty;

        // Supply: PO open qty + current stock
        const poWhere = {
          purchaseOrder: {
            tenantId,
            status: { notIn: ["cancelled", "closed"] },
          },
          materialId: material.id,
        };
        const [poSupply, poReceived] = await Promise.all([
          prisma.purchaseOrderItem.aggregate({
            where: poWhere,
            _sum: { quantity: true },
          }),
          prisma.purchaseOrderItem.aggregate({
            where: poWhere,
            _sum: { receivedQty: true },
          }),
        ]);
        const openPoQty = (poSupply._sum.quantity ?? 0) - (poReceived._sum.receivedQty ?? 0);

        const stock = material.stockQuantity ?? 0;
        const safetyStock = material.safetyStock ?? 0;

        // Net requirement = demand - supply - stock + safety stock
        const netReq = totalDemand - openPoQty - stock + safetyStock;

        if (netReq > 0) {
          const qty = Math.ceil(netReq / (material.lotSize || 1)) * (material.lotSize || 1);
          const leadDays = material.leadTimeDays ?? 0;
          const plannedDate = new Date(today);
          plannedDate.setDate(plannedDate.getDate() + leadDays);
          const dueDate = new Date(plannedDate);

          const orderType =
            material.type === "raw" || material.type === "semi-finished" || material.type === "trading"
              ? "purchase"
              : "production";

          plannedOrders.push({
            materialId: material.id,
            orderType,
            quantity: qty,
            unit: material.baseUnit ?? "EA",
            plannedDate,
            dueDate,
          });
        }
      }

      // Create planned orders
      for (const po of plannedOrders) {
        await prisma.plannedOrder.create({
          data: {
            tenantId,
            mrpRunId: run.id,
            materialId: po.materialId,
            orderType: po.orderType,
            quantity: po.quantity,
            unit: po.unit,
            plannedDate: po.plannedDate,
            dueDate: po.dueDate,
            status: "planned",
          },
        });
      }

      const results = {
        materialsProcessed: materials.length,
        plannedOrdersCreated: plannedOrders.length,
        runNumber,
      };

      await prisma.mrpRun.update({
        where: { id: run.id },
        data: {
          status: "completed",
          results: JSON.stringify(results),
        },
      });

      const updatedRun = await prisma.mrpRun.findUnique({
        where: { id: run.id },
        include: { plannedOrders: true },
      });

      res.status(201).json(updatedRun);
    } catch (execErr) {
      await prisma.mrpRun.update({
        where: { id: run.id },
        data: { status: "error", results: JSON.stringify({ error: String(execErr) }) },
      });
      throw execErr;
    }
  } catch (err) {
    next(err);
  }
});

/** GET /runs/:id - Get run details with planned orders */
router.get("/runs/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);
    const run = await prisma.mrpRun.findUnique({
      where: { id: req.params.id },
      include: { plannedOrders: true },
    });
    if (!run || run.tenantId !== tenantId) {
      throw new AppError(404, "MRP run not found");
    }
    res.json(run);
  } catch (err) {
    next(err);
  }
});

/** POST /runs/advanced - Run MRP with lot sizing policies & full net-requirements */
router.post("/runs/advanced", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);
    const userId = req.user!.userId;
    const {
      planningHorizonDays = 90,
      lotSizingPolicy = "lot_for_lot",
      fixedLotSize,
      includeForecast = true,
      includeSafetyStock = true,
    } = req.body;

    const runCount = await prisma.mrpRun.count({ where: { tenantId } });
    const runNumber = `MRP-${String(runCount + 1).padStart(7, "0")}`;

    const run = await prisma.mrpRun.create({
      data: {
        tenantId,
        runNumber,
        runDate: new Date(),
        planningHorizonDays: Number(planningHorizonDays),
        status: "running",
        parameters: JSON.stringify({
          planningHorizonDays, lotSizingPolicy, fixedLotSize, includeForecast, includeSafetyStock,
        }),
        createdBy: userId,
      },
    });

    try {
      const config: MrpConfig = {
        tenantId,
        userId,
        planningHorizonDays: Number(planningHorizonDays),
        lotSizingPolicy,
        fixedLotSize: fixedLotSize ? Number(fixedLotSize) : undefined,
        includeForecast,
        includeSafetyStock,
      };

      const result = await runMrpEngine(config);

      // Persist planned orders
      for (const po of result.plannedOrders) {
        await prisma.plannedOrder.create({
          data: {
            tenantId,
            mrpRunId: run.id,
            materialId: po.materialId,
            orderType: po.orderType,
            quantity: po.quantity,
            unit: po.unit,
            plannedDate: po.plannedDate,
            dueDate: po.dueDate,
            status: "planned",
          },
        });
      }

      await prisma.mrpRun.update({
        where: { id: run.id },
        data: {
          status: "completed",
          results: JSON.stringify(result.summary),
        },
      });

      const updatedRun = await prisma.mrpRun.findUnique({
        where: { id: run.id },
        include: { plannedOrders: true },
      });

      res.status(201).json({
        run: updatedRun,
        requirements: result.requirements,
        messages: result.messages,
        summary: result.summary,
      });
    } catch (execErr) {
      await prisma.mrpRun.update({
        where: { id: run.id },
        data: { status: "error", results: JSON.stringify({ error: String(execErr) }) },
      });
      throw execErr;
    }
  } catch (err) {
    next(err);
  }
});

// ─── Demand Forecasts ──────────────────────────────────────────────────

/** GET /forecasts - List demand forecasts */
router.get("/forecasts", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 25);
    const materialId = req.query.materialId as string | undefined;

    const where: { tenantId: string; materialId?: string } = { tenantId };
    if (materialId) where.materialId = materialId;

    const [data, total] = await Promise.all([
      prisma.demandForecast.findMany({
        where,
        orderBy: { periodStart: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.demandForecast.count({ where }),
    ]);

    const materialIds = [...new Set(data.map((f) => f.materialId))];
    const materials =
      materialIds.length > 0
        ? await prisma.material.findMany({
            where: { id: { in: materialIds } },
            select: { id: true, materialNumber: true, description: true },
          })
        : [];
    const materialMap = Object.fromEntries(materials.map((m) => [m.id, m]));

    const enriched = data.map((f) => ({
      ...f,
      material: materialMap[f.materialId] ?? null,
    }));

    res.json({
      data: enriched,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

/** POST /forecasts - Create forecast manually or auto-generate moving average */
router.post("/forecasts", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);
    const userId = req.user!.userId;
    const { materialId, periodStart, periodEnd, forecastQty, method = "manual", autoGenerate } = req.body;

    if (autoGenerate) {
      // Auto-generate using moving average for a material
      const matId = materialId as string;
      if (!matId) throw new AppError(400, "materialId required for auto-generate");

      const material = await prisma.material.findFirst({
        where: { id: matId, tenantId },
      });
      if (!material) throw new AppError(404, "Material not found");

      const periods = parseInt(req.body.periods as string) || 6;
      const horizonDays = parseInt(req.body.horizonDays as string) || 90;

      const historical = await prisma.demandForecast.findMany({
        where: { tenantId, materialId: matId },
        orderBy: { periodStart: "desc" },
        take: periods,
      });

      const salesHistory = await prisma.salesOrderItem.findMany({
        where: {
          materialId: matId,
          salesOrder: { tenantId, status: "completed" },
        },
        select: { quantity: true },
      });

      const quantities = [
        ...historical.map((h) => h.forecastQty),
        ...salesHistory.map((s) => s.quantity),
      ].filter((q) => q > 0);

      const movingAvg =
        quantities.length > 0
          ? quantities.slice(0, periods).reduce((a, b) => a + b, 0) / Math.min(periods, quantities.length)
          : 0;

      const forecasts: Array<{ periodStart: Date; periodEnd: Date; forecastQty: number }> = [];
      const start = new Date();
      start.setHours(0, 0, 0, 0);

      for (let i = 0; i < Math.ceil(horizonDays / 30); i++) {
        const periodStart = new Date(start);
        periodStart.setMonth(periodStart.getMonth() + i);
        const periodEnd = new Date(periodStart);
        periodEnd.setMonth(periodEnd.getMonth() + 1);
        periodEnd.setDate(periodEnd.getDate() - 1);
        forecasts.push({
          periodStart,
          periodEnd,
          forecastQty: Math.round(movingAvg * 10) / 10,
        });
      }

      const created = await prisma.$transaction(
        forecasts.map((f) =>
          prisma.demandForecast.create({
            data: {
              tenantId,
              materialId: matId,
              periodStart: f.periodStart,
              periodEnd: f.periodEnd,
              forecastQty: f.forecastQty,
              method: "moving_avg",
              confidence: quantities.length >= periods ? 0.8 : 0.5,
              createdBy: userId,
            },
          })
        )
      );

      res.status(201).json({ data: created, method: "moving_avg" });
      return;
    }

    // Manual create
    if (!materialId || !periodStart || !periodEnd || forecastQty == null) {
      throw new AppError(400, "materialId, periodStart, periodEnd, and forecastQty are required");
    }

    const material = await prisma.material.findFirst({
      where: { id: materialId, tenantId },
    });
    if (!material) throw new AppError(404, "Material not found");

    const forecast = await prisma.demandForecast.create({
      data: {
        tenantId,
        materialId,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        forecastQty: Number(forecastQty),
        method: method || "manual",
        confidence: req.body.confidence ? Number(req.body.confidence) : null,
        createdBy: userId,
      },
    });

    res.status(201).json(forecast);
  } catch (err) {
    next(err);
  }
});

// ─── Planned Orders ──────────────────────────────────────────────────

/** GET /planned-orders - List planned orders */
router.get("/planned-orders", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 25);
    const status = req.query.status as string | undefined;
    const mrpRunId = req.query.mrpRunId as string | undefined;

    const where: { tenantId: string; status?: string; mrpRunId?: string } = { tenantId };
    if (status) where.status = status;
    if (mrpRunId) where.mrpRunId = mrpRunId;

    const [data, total] = await Promise.all([
      prisma.plannedOrder.findMany({
        where,
        include: { mrpRun: true },
        orderBy: { plannedDate: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.plannedOrder.count({ where }),
    ]);

    const materialIds = [...new Set(data.map((o) => o.materialId))];
    const materials =
      materialIds.length > 0
        ? await prisma.material.findMany({
            where: { id: { in: materialIds } },
            select: { id: true, materialNumber: true, description: true, type: true },
          })
        : [];
    const materialMap = Object.fromEntries(materials.map((m) => [m.id, m]));

    const enriched = data.map((o) => ({
      ...o,
      material: materialMap[o.materialId] ?? null,
    }));

    res.json({
      data: enriched,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

/** POST /planned-orders/:id/firm - Change status to firmed */
router.post("/planned-orders/:id/firm", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);
    const order = await prisma.plannedOrder.findUnique({
      where: { id: req.params.id },
    });
    if (!order || order.tenantId !== tenantId) {
      throw new AppError(404, "Planned order not found");
    }
    if (order.status !== "planned") {
      throw new AppError(400, `Cannot firm order with status ${order.status}`);
    }

    const updated = await prisma.plannedOrder.update({
      where: { id: req.params.id },
      data: { status: "firmed" },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/** POST /planned-orders/:id/convert - Convert to actual PO or production order */
router.post("/planned-orders/:id/convert", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);
    const userId = req.user!.userId;
    const order = await prisma.plannedOrder.findUnique({
      where: { id: req.params.id },
    });
    if (!order || order.tenantId !== tenantId) {
      throw new AppError(404, "Planned order not found");
    }
    if (order.status === "converted") {
      throw new AppError(400, "Order already converted");
    }

    const material = await prisma.material.findUnique({
      where: { id: order.materialId },
    });
    if (!material || material.tenantId !== tenantId) {
      throw new AppError(404, "Material not found");
    }

    const unitPrice = material.movingAvgPrice > 0 ? material.movingAvgPrice : material.standardPrice;

    if (order.orderType === "purchase") {
      const { vendorId } = req.body;
      if (!vendorId) throw new AppError(400, "vendorId required to convert to purchase order");

      const vendor = await prisma.vendor.findFirst({
        where: { id: vendorId, tenantId },
      });
      if (!vendor) throw new AppError(404, "Vendor not found");

      const poCount = await prisma.purchaseOrder.count({ where: { tenantId } });
      const poNumber = `PO-${String(poCount + 1).padStart(7, "0")}`;

      const totalPrice = order.quantity * unitPrice;

      const po = await prisma.purchaseOrder.create({
        data: {
          tenantId,
          poNumber,
          vendorId,
          orderDate: new Date(),
          deliveryDate: order.dueDate,
          status: "draft",
          totalAmount: totalPrice,
          currency: "USD",
          createdBy: userId,
          items: {
            create: {
              lineNumber: 1,
              materialId: order.materialId,
              quantity: Math.round(order.quantity),
              unit: order.unit,
              unitPrice,
              totalPrice,
              deliveryDate: order.dueDate,
            },
          },
        },
        include: { vendor: true, items: { include: { material: true } } },
      });

      await prisma.plannedOrder.update({
        where: { id: req.params.id },
        data: { status: "converted", convertedTo: po.id },
      });

      res.status(201).json({
        plannedOrder: await prisma.plannedOrder.findUnique({ where: { id: req.params.id } }),
        purchaseOrder: po,
      });
    } else {
      // Production order
      const prodCount = await prisma.productionOrder.count({ where: { tenantId } });
      const orderNumber = `PROD-${String(prodCount + 1).padStart(7, "0")}`;

      const plannedStart = order.plannedDate;
      const plannedEnd = order.dueDate;

      const prodOrder = await prisma.productionOrder.create({
        data: {
          tenantId,
          orderNumber,
          materialId: order.materialId,
          quantity: Math.round(order.quantity),
          unit: order.unit,
          plannedStart,
          plannedEnd,
          status: "planned",
          createdBy: userId,
        },
      });

      await prisma.plannedOrder.update({
        where: { id: req.params.id },
        data: { status: "converted", convertedTo: prodOrder.id },
      });

      res.status(201).json({
        plannedOrder: await prisma.plannedOrder.findUnique({ where: { id: req.params.id } }),
        productionOrder: prodOrder,
      });
    }
  } catch (err) {
    next(err);
  }
});

export default router;
