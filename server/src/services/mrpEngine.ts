import { prisma } from "../prisma";

export interface MrpConfig {
  tenantId: string;
  userId: string;
  planningHorizonDays: number;
  lotSizingPolicy: "lot_for_lot" | "eoq" | "fixed_lot" | "min_max";
  fixedLotSize?: number;
  includeForecast: boolean;
  includeSafetyStock: boolean;
}

interface MaterialRequirement {
  materialId: string;
  materialNumber: string;
  description: string;
  type: string;
  grossRequirement: number;
  scheduledReceipts: number;
  currentStock: number;
  safetyStock: number;
  netRequirement: number;
  plannedOrderQty: number;
  orderType: "purchase" | "production";
  leadTimeDays: number;
  lotSizingPolicy: string;
  rescheduleMessage?: string;
}

export async function runMrpEngine(config: MrpConfig) {
  const { tenantId, planningHorizonDays, lotSizingPolicy, includeForecast, includeSafetyStock } = config;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizonEnd = new Date(today);
  horizonEnd.setDate(horizonEnd.getDate() + planningHorizonDays);

  const materials = await prisma.material.findMany({
    where: { tenantId, isActive: true },
  });

  const requirements: MaterialRequirement[] = [];
  const plannedOrders: any[] = [];
  const messages: string[] = [];

  for (const material of materials) {
    // 1. Gross Requirement = open SO demand + forecast demand
    const soItems = await prisma.salesOrderItem.findMany({
      where: {
        materialId: material.id,
        salesOrder: {
          tenantId,
          status: { notIn: ["cancelled", "completed"] },
        },
      },
      select: { quantity: true, deliveredQty: true },
    });
    const soDemand = soItems.reduce((sum, i) => sum + (i.quantity - i.deliveredQty), 0);

    let forecastDemand = 0;
    if (includeForecast) {
      const forecasts = await prisma.demandForecast.aggregate({
        where: {
          tenantId,
          materialId: material.id,
          periodEnd: { gte: today },
          periodStart: { lte: horizonEnd },
        },
        _sum: { forecastQty: true },
      });
      forecastDemand = forecasts._sum.forecastQty ?? 0;
    }

    // BOM explosion: if material is a component in a BOM for any production order
    const bomDemandItems = await prisma.bOMComponent.findMany({
      where: {
        materialId: material.id,
        bom: {
          tenantId,
        },
      },
      include: {
        bom: true,
      },
    });

    let dependentDemand = 0;
    for (const comp of bomDemandItems) {
      const linkedProductionOrders = await prisma.productionOrder.findMany({
        where: {
          tenantId,
          materialId: comp.bom.materialId,
          status: { in: ["planned", "released", "in_progress"] },
        },
        select: { quantity: true, yieldQty: true },
      });
      for (const po of linkedProductionOrders) {
        const outstanding = po.quantity - po.yieldQty;
        if (outstanding > 0) {
          dependentDemand += outstanding * comp.quantity;
        }
      }
    }

    const grossRequirement = soDemand + forecastDemand + dependentDemand;

    // 2. Scheduled Receipts = open PO qty not yet received
    const poItems = await prisma.purchaseOrderItem.findMany({
      where: {
        materialId: material.id,
        purchaseOrder: {
          tenantId,
          status: { notIn: ["cancelled", "closed"] },
        },
      },
      select: { quantity: true, receivedQty: true },
    });
    const scheduledReceipts = poItems.reduce((sum, i) => sum + (i.quantity - i.receivedQty), 0);

    // 3. Net Requirement
    const stock = material.stockQuantity ?? 0;
    const safetyStock = includeSafetyStock ? (material.safetyStock ?? 0) : 0;

    const availableBalance = stock + scheduledReceipts - safetyStock;
    const netRequirement = Math.max(0, grossRequirement - availableBalance);

    // 4. Lot Sizing
    let plannedOrderQty = 0;
    let policyUsed = lotSizingPolicy;

    if (netRequirement > 0) {
      switch (lotSizingPolicy) {
        case "lot_for_lot":
          plannedOrderQty = netRequirement;
          break;

        case "eoq": {
          const annualDemand = grossRequirement * (365 / planningHorizonDays);
          const orderingCost = 50; // default ordering cost
          const holdingCostPct = 0.2;
          const unitCost = material.standardPrice || material.movingAvgPrice || 10;
          const holdingCost = unitCost * holdingCostPct;

          if (annualDemand > 0 && holdingCost > 0) {
            const eoq = Math.sqrt((2 * annualDemand * orderingCost) / holdingCost);
            plannedOrderQty = Math.max(netRequirement, Math.ceil(eoq));
          } else {
            plannedOrderQty = netRequirement;
          }

          // Check if material has a specific inventory policy with custom params
          const policy = await prisma.inventoryPolicy.findUnique({
            where: { tenantId_materialId: { tenantId, materialId: material.id } },
          });
          if (policy?.calculatedEOQ) {
            plannedOrderQty = Math.max(netRequirement, Math.ceil(policy.calculatedEOQ));
          }
          break;
        }

        case "fixed_lot": {
          const lotSize = config.fixedLotSize || material.lotSize || 1;
          plannedOrderQty = Math.ceil(netRequirement / lotSize) * lotSize;
          break;
        }

        case "min_max": {
          const policy = await prisma.inventoryPolicy.findUnique({
            where: { tenantId_materialId: { tenantId, materialId: material.id } },
          });
          const minStock = policy?.minStock ?? material.reorderPoint ?? 0;
          const maxStock = policy?.maxStock ?? (minStock * 3);

          if (stock < minStock) {
            plannedOrderQty = Math.max(netRequirement, maxStock - stock);
          } else {
            plannedOrderQty = netRequirement;
          }
          break;
        }
      }
    }

    // 5. Determine order type
    const orderType: "purchase" | "production" =
      material.type === "raw" || material.type === "trading"
        ? "purchase"
        : "production";

    // 6. Reschedule messages
    let rescheduleMessage: string | undefined;
    if (scheduledReceipts > 0 && netRequirement > 0) {
      rescheduleMessage = `Consider expediting open orders. Net shortfall: ${Math.round(netRequirement)} ${material.baseUnit}`;
    }
    if (scheduledReceipts > grossRequirement + safetyStock && netRequirement === 0) {
      rescheduleMessage = `Excess supply detected. Consider deferring or cancelling open orders.`;
    }

    const req: MaterialRequirement = {
      materialId: material.id,
      materialNumber: material.materialNumber,
      description: material.description,
      type: material.type,
      grossRequirement: Math.round(grossRequirement),
      scheduledReceipts: Math.round(scheduledReceipts),
      currentStock: stock,
      safetyStock,
      netRequirement: Math.round(netRequirement),
      plannedOrderQty: Math.round(plannedOrderQty),
      orderType,
      leadTimeDays: material.leadTimeDays ?? 0,
      lotSizingPolicy: policyUsed,
      rescheduleMessage,
    };
    requirements.push(req);

    if (plannedOrderQty > 0) {
      const plannedDate = new Date(today);
      plannedDate.setDate(plannedDate.getDate() + (material.leadTimeDays ?? 0));

      plannedOrders.push({
        tenantId,
        materialId: material.id,
        orderType,
        quantity: Math.round(plannedOrderQty),
        unit: material.baseUnit ?? "EA",
        plannedDate,
        dueDate: plannedDate,
        status: "planned",
      });
    }

    if (rescheduleMessage) {
      messages.push(`${material.materialNumber}: ${rescheduleMessage}`);
    }
  }

  return {
    requirements,
    plannedOrders,
    messages,
    summary: {
      materialsProcessed: materials.length,
      materialsWithShortage: requirements.filter((r) => r.netRequirement > 0).length,
      plannedOrdersGenerated: plannedOrders.length,
      purchaseOrders: plannedOrders.filter((o) => o.orderType === "purchase").length,
      productionOrders: plannedOrders.filter((o) => o.orderType === "production").length,
      rescheduleMessages: messages.length,
      lotSizingPolicy: lotSizingPolicy,
    },
  };
}
