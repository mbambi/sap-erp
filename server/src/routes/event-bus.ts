import { Router, Request, Response, NextFunction } from "express";
import { authenticate, requireRoles } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";
import { eventBus, ERPEventType } from "../services/eventBus";

const router = Router();
router.use(authenticate);

// POST /publish — publish an event to the bus
router.post("/publish", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const userId = req.user!.userId;
    const { type, module, documentId, documentType, payload, correlationId } = req.body;
    if (!type || !module) throw new AppError(400, "type and module are required");

    const result = await eventBus.publish({
      type: type as ERPEventType,
      tenantId,
      userId,
      module,
      documentId: documentId ?? undefined,
      documentType: documentType ?? undefined,
      payload: payload ?? {},
      correlationId: correlationId ?? undefined,
    });

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// POST /publish-batch — publish multiple events
router.post("/publish-batch", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const userId = req.user!.userId;
    const { events } = req.body;
    if (!Array.isArray(events) || events.length === 0) throw new AppError(400, "events array required");
    if (events.length > 100) throw new AppError(400, "Maximum 100 events per batch");

    const results = [];
    for (const evt of events) {
      const result = await eventBus.publish({
        type: evt.type as ERPEventType,
        tenantId,
        userId,
        module: evt.module,
        documentId: evt.documentId,
        documentType: evt.documentType,
        payload: evt.payload ?? {},
        correlationId: evt.correlationId,
      });
      results.push(result);
    }

    res.status(201).json({ published: results.length, results });
  } catch (err) {
    next(err);
  }
});

// GET /recent — get recent events from the in-memory log
router.get("/recent", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
    const events = eventBus.getRecentEvents(limit);
    // Filter to tenant
    const tenantId = req.user!.tenantId;
    const filtered = events.filter((e) => e.tenantId === tenantId);
    res.json(filtered);
  } catch (err) {
    next(err);
  }
});

// GET /subscriptions — list active subscribers
router.get("/subscriptions", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(eventBus.getSubscriptions());
  } catch (err) {
    next(err);
  }
});

// GET /stats — event statistics
router.get("/stats", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(eventBus.getEventStats());
  } catch (err) {
    next(err);
  }
});

// GET /event-types — list all available event types
router.get("/event-types", (_req: Request, res: Response) => {
  const types: ERPEventType[] = [
    "PurchaseRequisitionCreated", "PurchaseOrderCreated", "PurchaseOrderApproved",
    "GoodsReceived", "GoodsIssued", "SalesOrderCreated", "SalesOrderFulfilled",
    "DeliveryCreated", "InvoicePosted", "PaymentExecuted",
    "ProductionOrderCreated", "ProductionOrderReleased", "ProductionOrderCompleted",
    "MaterialCreated", "MaterialUpdated", "InventoryAdjusted",
    "QualityInspectionCompleted", "MaintenanceOrderCreated", "WorkflowTaskCompleted",
    "JournalEntryPosted", "CostAllocationRun", "MRPRunCompleted",
    "ForecastGenerated", "ShipmentDispatched", "StockBelowSafetyLevel",
    "BenchmarkScoreUpdated", "CustomEvent",
  ];
  res.json(types);
});

// POST /simulate-flow — simulate a full P2P or O2C flow for demo/learning
router.post("/simulate-flow", requireRoles("admin", "instructor"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const userId = req.user!.userId;
    const { flow } = req.body;
    const correlationId = `flow_${Date.now()}`;

    const flows: Record<string, Array<{ type: ERPEventType; module: string; delay: number }>> = {
      "procure-to-pay": [
        { type: "PurchaseRequisitionCreated", module: "materials", delay: 0 },
        { type: "PurchaseOrderCreated", module: "materials", delay: 500 },
        { type: "PurchaseOrderApproved", module: "workflow", delay: 1000 },
        { type: "GoodsReceived", module: "warehouse", delay: 2000 },
        { type: "InvoicePosted", module: "finance", delay: 3000 },
        { type: "PaymentExecuted", module: "finance", delay: 4000 },
      ],
      "order-to-cash": [
        { type: "SalesOrderCreated", module: "sales", delay: 0 },
        { type: "ProductionOrderCreated", module: "production", delay: 500 },
        { type: "ProductionOrderReleased", module: "production", delay: 1000 },
        { type: "ProductionOrderCompleted", module: "production", delay: 2000 },
        { type: "DeliveryCreated", module: "sales", delay: 3000 },
        { type: "InvoicePosted", module: "finance", delay: 3500 },
        { type: "PaymentExecuted", module: "finance", delay: 4500 },
      ],
      "plan-to-produce": [
        { type: "ForecastGenerated", module: "mrp", delay: 0 },
        { type: "MRPRunCompleted", module: "mrp", delay: 500 },
        { type: "PurchaseRequisitionCreated", module: "materials", delay: 1000 },
        { type: "PurchaseOrderCreated", module: "materials", delay: 1500 },
        { type: "GoodsReceived", module: "warehouse", delay: 2500 },
        { type: "ProductionOrderCreated", module: "production", delay: 3000 },
        { type: "ProductionOrderReleased", module: "production", delay: 3500 },
        { type: "ProductionOrderCompleted", module: "production", delay: 5000 },
      ],
    };

    const selectedFlow = flows[flow ?? "procure-to-pay"];
    if (!selectedFlow) throw new AppError(400, `Unknown flow. Available: ${Object.keys(flows).join(", ")}`);

    const results = [];
    for (const step of selectedFlow) {
      const result = await eventBus.publish({
        type: step.type,
        tenantId,
        userId,
        module: step.module,
        correlationId,
        payload: { simulatedFlow: flow ?? "procure-to-pay", step: step.type },
      });
      results.push({ ...result, type: step.type, delay: step.delay });
    }

    res.status(201).json({
      correlationId,
      flow: flow ?? "procure-to-pay",
      eventsPublished: results.length,
      results,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
