import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authenticate } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

const router = Router();
router.use(authenticate);

const tenantScope = (req: Request) => req.user!.tenantId;

/** POST /explain/production-order - Explain why a production order exists */
router.post("/explain/production-order", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);
    const { productionOrderId } = req.body;

    if (!productionOrderId) throw new AppError(400, "productionOrderId is required");

    const po = await prisma.productionOrder.findFirst({
      where: { id: productionOrderId, tenantId },
      include: { tenant: true },
    });

    if (!po) throw new AppError(404, "Production order not found");

    const material = await prisma.material.findUnique({
      where: { id: po.materialId },
    });

    const bom = await prisma.billOfMaterial.findFirst({
      where: { materialId: po.materialId, tenantId },
      include: { components: { include: { material: true } } },
    });

    const salesOrders = await prisma.salesOrder.findMany({
      where: {
        tenantId,
        items: { some: { materialId: po.materialId } },
        status: { not: "cancelled" },
      },
      include: { items: true, customer: true },
    });

    const steps = [
      { step: 1, name: "Production Order", description: `Order ${po.orderNumber} for ${po.quantity} ${po.unit} of material`, document: po },
      { step: 2, name: "Material", description: material?.description || "Material", document: material },
      { step: 3, name: "Demand Source", description: `Driven by ${salesOrders.length} sales order(s)`, document: salesOrders },
      { step: 4, name: "BOM", description: bom ? `BOM ${bom.bomNumber} with ${bom.components.length} components` : "No BOM", document: bom },
      { step: 5, name: "Components", description: bom?.components.map((c) => `${c.material.description} x ${c.quantity}`).join(", ") || "N/A" },
    ];

    res.json({
      productionOrderId,
      explanation: {
        steps,
        summary: `Production order ${po.orderNumber} exists to fulfill demand for ${material?.description || "material"} from ${salesOrders.length} sales order(s). BOM defines ${bom?.components.length || 0} components.`,
      },
    });
  } catch (err) {
    next(err);
  }
});

/** POST /explain/planned-order - Explain a planned order */
router.post("/explain/planned-order", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);
    const { plannedOrderId } = req.body;

    if (!plannedOrderId) throw new AppError(400, "plannedOrderId is required");

    const po = await prisma.plannedOrder.findFirst({
      where: { id: plannedOrderId, tenantId },
    });

    if (!po) throw new AppError(404, "Planned order not found");

    const material = await prisma.material.findUnique({
      where: { id: po.materialId },
    });

    const demandForecasts = await prisma.demandForecast.findMany({
      where: { tenantId, materialId: po.materialId },
    });

    const mrpRun = po.mrpRunId
      ? await prisma.mrpRun.findUnique({ where: { id: po.mrpRunId } })
      : null;

    res.json({
      plannedOrderId,
      explanation: {
        steps: [
          { name: "Planned Order", description: `${po.orderType} for ${po.quantity} ${po.unit}`, document: po },
          { name: "Material", description: material?.description, document: material },
          { name: "Demand Trigger", description: `Forecasts: ${demandForecasts.length}`, document: demandForecasts },
          { name: "Stock Levels", description: `Current: ${material?.stockQuantity ?? 0}, Safety: ${material?.safetyStock ?? 0}`, document: { stockLevel: material?.stockQuantity, safetyStock: material?.safetyStock } },
          { name: "MRP Calculation", description: mrpRun ? `From MRP run ${mrpRun.runNumber}` : "Manual/standalone", document: mrpRun },
        ],
        summary: `Planned order triggered by demand for ${material?.description}. Stock: ${material?.stockQuantity ?? 0}, order quantity: ${po.quantity}.`,
      },
    });
  } catch (err) {
    next(err);
  }
});

/** POST /explain/stock-level - Explain current stock level for a material */
router.post("/explain/stock-level", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);
    const { materialId } = req.body;

    if (!materialId) throw new AppError(400, "materialId is required");

    const material = await prisma.material.findFirst({
      where: { id: materialId, tenantId },
    });

    if (!material) throw new AppError(404, "Material not found");

    const movements = await prisma.inventoryMovement.findMany({
      where: { materialId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const inflows = movements.filter((m) => ["receipt", "transfer"].includes(m.movementType));
    const outflows = movements.filter((m) => ["issue", "scrap", "adjustment"].includes(m.movementType));

    const timeline = movements.map((m) => ({
      date: m.createdAt,
      type: m.movementType,
      quantity: m.quantity,
      direction: ["receipt", "transfer"].includes(m.movementType) ? "in" : "out",
      reference: m.reference,
    }));

    res.json({
      materialId,
      explanation: {
        currentStock: material.stockQuantity,
        reservedQty: material.reservedQty,
        safetyStock: material.safetyStock,
        inflows: inflows.length,
        outflows: outflows.length,
        timeline,
        summary: `Stock level ${material.stockQuantity} from ${inflows.length} inflows and ${outflows.length} outflows.`,
      },
    });
  } catch (err) {
    next(err);
  }
});

/** POST /explain/price - Explain how a sales order price was calculated */
router.post("/explain/price", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);
    const { salesOrderId } = req.body;

    if (!salesOrderId) throw new AppError(400, "salesOrderId is required");

    const so = await prisma.salesOrder.findFirst({
      where: { id: salesOrderId, tenantId },
      include: { items: { include: { material: true } } },
    });

    if (!so) throw new AppError(404, "Sales order not found");

    const conditions = await prisma.pricingCondition.findMany({
      where: { tenantId, isActive: true },
    });

    const breakdown = so.items.map((item) => {
      const basePrice = item.unitPrice || item.material?.standardPrice || 0;
      const discount = item.discount || 0;
      const discountAmt = basePrice * (discount / 100);
      const netPrice = basePrice - discountAmt;
      const lineTotal = netPrice * item.quantity;
      return {
        material: item.material?.description,
        quantity: item.quantity,
        basePrice,
        discountPct: discount,
        discountAmt,
        netPrice,
        lineTotal,
      };
    });

    const totalAmount = breakdown.reduce((s, b) => s + b.lineTotal, 0);

    res.json({
      salesOrderId,
      explanation: {
        steps: [
          { name: "Base Price", description: "From material standard price or item unit price" },
          { name: "Conditions", description: `Applied: ${conditions.length} pricing conditions`, document: conditions },
          { name: "Discount", description: "Item-level discount applied" },
          { name: "Final Price", description: `Total: ${totalAmount} ${so.currency}` },
        ],
        breakdown,
        totalAmount,
        currency: so.currency,
        summary: `Price calculated from base price, conditions, and discounts. Total: ${totalAmount} ${so.currency}.`,
      },
    });
  } catch (err) {
    next(err);
  }
});

/** POST /explain/payment - Explain payment status */
router.post("/explain/payment", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);
    const { invoiceId } = req.body;

    if (!invoiceId) throw new AppError(400, "invoiceId is required");

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, salesOrder: { tenantId } },
      include: { salesOrder: true, customer: true },
    });

    if (!invoice) throw new AppError(404, "Invoice not found");

    const payments = await prisma.payment.findMany({
      where: { tenantId, invoiceRef: invoice.invoiceNumber },
    });

    res.json({
      invoiceId,
      explanation: {
        steps: [
          { name: "Invoice Created", description: invoice.invoiceDate.toISOString(), timestamp: invoice.invoiceDate },
          { name: "Match Status", description: "N/A for sales invoice" },
          { name: "Payment", description: payments.length > 0 ? `Paid: ${payments[0].paymentDate}` : "Pending", timestamp: payments[0]?.paymentDate },
        ],
        invoiceCreated: invoice.invoiceDate,
        dueDate: invoice.dueDate,
        status: invoice.status,
        paidAmount: invoice.paidAmount,
        totalAmount: invoice.totalAmount,
        payments,
        summary: `Invoice ${invoice.invoiceNumber} created ${invoice.invoiceDate.toISOString().slice(0, 10)}. Status: ${invoice.status}. Paid: ${invoice.paidAmount}/${invoice.totalAmount}.`,
      },
    });
  } catch (err) {
    next(err);
  }
});

/** POST /explain/process-flow - Trace full process flow for a document */
router.post("/explain/process-flow", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);
    const { documentType, documentId } = req.body;

    if (!documentType || !documentId) throw new AppError(400, "documentType and documentId are required");

    const processEvents = await prisma.processEvent.findMany({
      where: { tenantId, documentId: documentId },
      orderBy: { timestamp: "asc" },
    });

    const steps = processEvents.map((e) => ({
      name: e.activity,
      status: e.timestamp ? "completed" : "pending",
      timestamp: e.timestamp,
      document: e.documentId,
      resource: e.resource,
    }));

    if (steps.length === 0) {
      steps.push({
        name: "Document created",
        status: "completed",
        timestamp: new Date(),
        document: documentId,
        resource: null,
      });
    }

    res.json({
      documentType,
      documentId,
      flow: {
        steps,
        summary: `${steps.length} steps in process flow.`,
      },
    });
  } catch (err) {
    next(err);
  }
});

/** GET /decision-log - Recent system decisions with explanations */
router.get("/decision-log", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);
    const limit = Math.min(50, parseInt(req.query.limit as string) || 20);

    const [mrpRuns, plannedOrders, productionOrders] = await Promise.all([
      prisma.mrpRun.findMany({
        where: { tenantId },
        orderBy: { runDate: "desc" },
        take: limit,
      }),
      prisma.plannedOrder.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.productionOrder.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
    ]);

    const decisions = [
      ...mrpRuns.map((r) => ({ type: "MRP_RUN", document: r.runNumber, date: r.runDate, description: `MRP run ${r.runNumber}` })),
      ...plannedOrders.map((p) => ({ type: "PLANNED_ORDER", document: p.id, date: p.createdAt, description: `Planned ${p.orderType} for ${p.quantity}` })),
      ...productionOrders.map((p) => ({ type: "PRODUCTION_ORDER", document: p.orderNumber, date: p.createdAt, description: `Production order ${p.orderNumber}` })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, limit);

    res.json({ decisions });
  } catch (err) {
    next(err);
  }
});

export default router;
