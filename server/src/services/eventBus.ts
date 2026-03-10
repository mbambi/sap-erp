import { prisma } from "../prisma";
import { logger } from "../middleware/logger";

// ─── Domain Event Types ───────────────────────────────────────────────
export type ERPEventType =
  | "PurchaseRequisitionCreated"
  | "PurchaseOrderCreated"
  | "PurchaseOrderApproved"
  | "GoodsReceived"
  | "GoodsIssued"
  | "SalesOrderCreated"
  | "SalesOrderFulfilled"
  | "DeliveryCreated"
  | "InvoicePosted"
  | "PaymentExecuted"
  | "ProductionOrderCreated"
  | "ProductionOrderReleased"
  | "ProductionOrderCompleted"
  | "MaterialCreated"
  | "MaterialUpdated"
  | "InventoryAdjusted"
  | "QualityInspectionCompleted"
  | "MaintenanceOrderCreated"
  | "WorkflowTaskCompleted"
  | "JournalEntryPosted"
  | "CostAllocationRun"
  | "MRPRunCompleted"
  | "ForecastGenerated"
  | "ShipmentDispatched"
  | "StockBelowSafetyLevel"
  | "BenchmarkScoreUpdated"
  | "CustomEvent";

export interface ERPEvent {
  type: ERPEventType;
  tenantId: string;
  userId?: string;
  module: string;
  documentId?: string;
  documentType?: string;
  payload: Record<string, unknown>;
  timestamp?: Date;
  correlationId?: string;
}

export interface EventSubscription {
  id: string;
  eventTypes: ERPEventType[] | "*";
  handler: (event: ERPEvent & { id: string }) => Promise<void>;
  name: string;
}

// ─── Event Bus (In-Process, upgradeable to Kafka/NATS/Redis Streams) ─
class ERPEventBus {
  private subscriptions: EventSubscription[] = [];
  private eventLog: Array<ERPEvent & { id: string; processedBy: string[] }> = [];

  subscribe(subscription: Omit<EventSubscription, "id">): string {
    const id = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.subscriptions.push({ ...subscription, id });
    logger.info(`EventBus: Subscriber "${subscription.name}" registered for ${
      subscription.eventTypes === "*" ? "all events" : (subscription.eventTypes as string[]).join(", ")
    }`);
    return id;
  }

  unsubscribe(subscriptionId: string): void {
    this.subscriptions = this.subscriptions.filter((s) => s.id !== subscriptionId);
  }

  async publish(event: ERPEvent): Promise<{ eventId: string; subscribersNotified: number }> {
    const eventId = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const fullEvent = {
      ...event,
      id: eventId,
      timestamp: event.timestamp ?? new Date(),
    };

    const processedBy: string[] = [];

    // Persist to process event log for process mining
    try {
      await prisma.processEvent.create({
        data: {
          tenantId: event.tenantId,
          caseId: event.correlationId ?? event.documentId ?? eventId,
          activity: event.type,
          resource: event.userId ?? null,
          module: event.module,
          documentId: event.documentId ?? null,
          attributes: JSON.stringify({
            ...event.payload,
            eventType: event.type,
            documentType: event.documentType,
          }),
          duration: null,
        },
      });
    } catch (err) {
      logger.error("EventBus: Failed to persist event", { eventId, error: err });
    }

    // Notify subscribers
    const matchingSubscribers = this.subscriptions.filter(
      (sub) => sub.eventTypes === "*" || sub.eventTypes.includes(event.type)
    );

    for (const sub of matchingSubscribers) {
      try {
        await sub.handler(fullEvent);
        processedBy.push(sub.name);
      } catch (err) {
        logger.error(`EventBus: Subscriber "${sub.name}" failed for event ${eventId}`, { error: err });
      }
    }

    // Keep in-memory log (last 1000 events)
    this.eventLog.push({ ...fullEvent, processedBy });
    if (this.eventLog.length > 1000) {
      this.eventLog = this.eventLog.slice(-1000);
    }

    logger.info(`EventBus: Published ${event.type} → ${processedBy.length} subscribers`, {
      eventId,
      module: event.module,
    });

    return { eventId, subscribersNotified: processedBy.length };
  }

  getRecentEvents(limit = 50): Array<ERPEvent & { id: string; processedBy: string[] }> {
    return this.eventLog.slice(-limit).reverse();
  }

  getSubscriptions(): Array<{ id: string; name: string; eventTypes: ERPEventType[] | "*" }> {
    return this.subscriptions.map((s) => ({
      id: s.id,
      name: s.name,
      eventTypes: s.eventTypes,
    }));
  }

  getEventStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const evt of this.eventLog) {
      stats[evt.type] = (stats[evt.type] || 0) + 1;
    }
    return stats;
  }
}

export const eventBus = new ERPEventBus();

// ─── Built-in Subscribers ─────────────────────────────────────────────

// 1. Inventory Service — update stock on goods movements
eventBus.subscribe({
  name: "InventoryService",
  eventTypes: ["GoodsReceived", "GoodsIssued", "InventoryAdjusted", "StockBelowSafetyLevel"],
  handler: async (event) => {
    const { type, tenantId, payload } = event;
    if (type === "GoodsReceived" && payload.materialId && payload.quantity) {
      await prisma.material.updateMany({
        where: { id: payload.materialId as string, tenantId },
        data: { stockQuantity: { increment: payload.quantity as number } },
      });
    }
    if (type === "GoodsIssued" && payload.materialId && payload.quantity) {
      await prisma.material.updateMany({
        where: { id: payload.materialId as string, tenantId },
        data: { stockQuantity: { decrement: payload.quantity as number } },
      });
    }
  },
});

// 2. Finance Service — auto-create journal entries for financial events
eventBus.subscribe({
  name: "FinanceService",
  eventTypes: ["InvoicePosted", "PaymentExecuted", "GoodsReceived"],
  handler: async (event) => {
    logger.info(`FinanceService: Processing ${event.type} for tenant ${event.tenantId}`, {
      documentId: event.documentId,
    });
    // Stub: in production, would auto-create journal entries
  },
});

// 3. Analytics Service — aggregate metrics for dashboards
eventBus.subscribe({
  name: "AnalyticsService",
  eventTypes: "*",
  handler: async (event) => {
    // Events are already persisted to ProcessEvent; analytics can query from there
    logger.debug(`AnalyticsService: Indexed event ${event.type}`);
  },
});

// 4. Process Mining Service — enhanced event capture
eventBus.subscribe({
  name: "ProcessMiningService",
  eventTypes: [
    "PurchaseRequisitionCreated",
    "PurchaseOrderCreated",
    "PurchaseOrderApproved",
    "GoodsReceived",
    "InvoicePosted",
    "PaymentExecuted",
    "SalesOrderCreated",
    "DeliveryCreated",
    "ProductionOrderCreated",
    "ProductionOrderReleased",
    "ProductionOrderCompleted",
  ],
  handler: async (event) => {
    logger.debug(`ProcessMiningService: Captured ${event.type} for case ${event.correlationId ?? event.documentId}`);
  },
});

// 5. Notification Service — create user notifications for important events
eventBus.subscribe({
  name: "NotificationService",
  eventTypes: [
    "PurchaseOrderApproved",
    "StockBelowSafetyLevel",
    "ProductionOrderReleased",
    "QualityInspectionCompleted",
    "WorkflowTaskCompleted",
  ],
  handler: async (event) => {
    if (!event.userId) return;
    try {
      await prisma.notification.create({
        data: {
          tenantId: event.tenantId,
          userId: event.userId,
          title: formatEventTitle(event.type),
          message: `${event.type} — ${event.documentType ?? "Document"}: ${event.documentId ?? "N/A"}`,
          type: "info",
          module: event.module,
          link: event.documentId ? `/${event.module}/${event.documentId}` : null,
        },
      });
    } catch {
      // Notification creation is best-effort
    }
  },
});

function formatEventTitle(type: ERPEventType): string {
  return type.replace(/([A-Z])/g, " $1").trim();
}
