import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authenticate } from "../middleware/auth";

const router = Router();
router.use(authenticate);

interface Recommendation {
  id: string;
  severity: "critical" | "warning" | "info";
  category: string;
  title: string;
  description: string;
  action: string;
  impact: string;
  data: Record<string, unknown>;
}

// GET /scan - scan entire ERP for issues and generate recommendations
router.get("/scan", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const recommendations: Recommendation[] = [];
    let recId = 0;

    // 1. Stockout risk detection
    const materials = await prisma.material.findMany({ where: { tenantId, isActive: true } });
    for (const m of materials) {
      if (m.stockQuantity < 0) {
        recommendations.push({
          id: `rec-${++recId}`,
          severity: "critical",
          category: "inventory",
          title: `Negative stock: ${m.materialNumber}`,
          description: `${m.description} has negative stock of ${m.stockQuantity} ${m.baseUnit}. This indicates goods were issued without sufficient receipt.`,
          action: `Create emergency purchase order for ${Math.abs(m.stockQuantity) + (m.safetyStock || 0)} ${m.baseUnit} of ${m.materialNumber}`,
          impact: "Resolve negative inventory and prevent production stoppages",
          data: { materialId: m.id, materialNumber: m.materialNumber, currentStock: m.stockQuantity, safetyStock: m.safetyStock },
        });
      } else if (m.safetyStock > 0 && m.stockQuantity <= m.safetyStock) {
        const orderQty = m.reorderPoint > 0 ? m.reorderPoint : Math.max(m.safetyStock * 2, 100);
        recommendations.push({
          id: `rec-${++recId}`,
          severity: m.stockQuantity <= m.safetyStock * 0.5 ? "critical" : "warning",
          category: "inventory",
          title: `Low stock: ${m.materialNumber}`,
          description: `${m.description} is at ${m.stockQuantity} ${m.baseUnit} (safety stock: ${m.safetyStock}). At risk of stockout.`,
          action: `Create purchase order for ${orderQty} ${m.baseUnit} of ${m.materialNumber}`,
          impact: `Restore inventory to safe level, prevent ${m.stockQuantity <= 0 ? "immediate" : "potential"} stockout`,
          data: { materialId: m.id, materialNumber: m.materialNumber, currentStock: m.stockQuantity, safetyStock: m.safetyStock, suggestedQty: orderQty },
        });
      }
    }

    // 2. Production bottleneck detection
    const workCenters = await prisma.workCenter.findMany({ where: { tenantId, isActive: true } });
    const schedules = await prisma.productionSchedule.findMany({
      where: { tenantId, status: { in: ["scheduled", "in_progress"] } },
    });

    const wcLoad: Record<string, { name: string; capacity: number; load: number; scheduleCount: number }> = {};
    for (const wc of workCenters) {
      wcLoad[wc.id] = { name: wc.name, capacity: wc.capacity * (wc.efficiency / 100), load: 0, scheduleCount: 0 };
    }
    for (const s of schedules) {
      if (wcLoad[s.workCenterId]) {
        wcLoad[s.workCenterId].load += 1;
        wcLoad[s.workCenterId].scheduleCount++;
      }
    }

    for (const [wcId, wc] of Object.entries(wcLoad)) {
      const utilization = wc.capacity > 0 ? (wc.load / wc.capacity) * 100 : 0;
      if (utilization > 90) {
        // Find alternative work centers
        const alternatives = workCenters.filter((w) => w.id !== wcId && (wcLoad[w.id]?.load ?? 0) / (wcLoad[w.id]?.capacity ?? 1) < 0.6);
        const altNames = alternatives.map((a) => a.name).join(", ");

        recommendations.push({
          id: `rec-${++recId}`,
          severity: utilization > 100 ? "critical" : "warning",
          category: "production",
          title: `Bottleneck at ${wc.name}`,
          description: `${wc.name} is at ${Math.round(utilization)}% utilization with ${wc.scheduleCount} active schedules.`,
          action: alternatives.length > 0
            ? `Reschedule operations to ${altNames} (currently under-utilized)`
            : `Add overtime shift at ${wc.name} or outsource machining`,
          impact: "Reduce production delays and improve throughput",
          data: { workCenterId: wcId, utilization: Math.round(utilization), activeSchedules: wc.scheduleCount, alternatives: alternatives.map((a) => ({ id: a.id, name: a.name })) },
        });
      }
    }

    // 3. Overdue purchase orders
    const overduePOs = await prisma.purchaseOrder.findMany({
      where: {
        tenantId,
        status: { in: ["sent", "confirmed"] },
        deliveryDate: { lt: new Date() },
      },
      include: { vendor: true },
    });

    for (const po of overduePOs) {
      const daysOverdue = Math.round((Date.now() - new Date(po.deliveryDate!).getTime()) / 86400000);
      recommendations.push({
        id: `rec-${++recId}`,
        severity: daysOverdue > 7 ? "critical" : "warning",
        category: "purchasing",
        title: `Overdue PO: ${po.poNumber}`,
        description: `PO ${po.poNumber} from ${po.vendor?.name ?? "unknown vendor"} is ${daysOverdue} days overdue. Expected delivery: ${new Date(po.deliveryDate!).toLocaleDateString()}.`,
        action: `Contact ${po.vendor?.name ?? "vendor"} for status update. If no response, expedite or source from alternate vendor.`,
        impact: `Prevent production delays for dependent materials`,
        data: { purchaseOrderId: po.id, poNumber: po.poNumber, vendorName: po.vendor?.name, daysOverdue, totalAmount: po.totalAmount },
      });
    }

    // 4. Overdue sales orders
    const overdueSOs = await prisma.salesOrder.findMany({
      where: {
        tenantId,
        status: { in: ["confirmed", "processing"] },
        requestedDate: { lt: new Date() },
      },
      include: { customer: true },
    });

    for (const so of overdueSOs) {
      const daysLate = Math.round((Date.now() - new Date(so.requestedDate!).getTime()) / 86400000);
      recommendations.push({
        id: `rec-${++recId}`,
        severity: daysLate > 5 ? "critical" : "warning",
        category: "sales",
        title: `Late sales order: ${so.soNumber}`,
        description: `SO ${so.soNumber} for ${so.customer?.name ?? "customer"} is ${daysLate} days past requested date.`,
        action: `Expedite fulfillment. Check inventory for ${so.soNumber} items, create delivery if stock available, or schedule production.`,
        impact: "Improve customer satisfaction and prevent order cancellation",
        data: { salesOrderId: so.id, orderNumber: so.soNumber, customerName: so.customer?.name, daysLate },
      });
    }

    // 5. Pending workflow approvals
    const pendingTasks = await prisma.workflowTask.findMany({
      where: { instance: { definition: { tenantId } }, status: "pending" },
      include: { instance: { include: { definition: true } } },
    });

    if (pendingTasks.length > 3) {
      recommendations.push({
        id: `rec-${++recId}`,
        severity: pendingTasks.length > 10 ? "warning" : "info",
        category: "workflow",
        title: `${pendingTasks.length} pending approvals`,
        description: `There are ${pendingTasks.length} workflow tasks awaiting approval. Oldest: ${pendingTasks[0] ? new Date(pendingTasks[0].createdAt).toLocaleDateString() : "N/A"}.`,
        action: "Review and process pending approvals to prevent process delays",
        impact: "Unblock dependent processes (purchase orders, production releases, etc.)",
        data: { count: pendingTasks.length, tasks: pendingTasks.slice(0, 5).map((t) => ({ id: t.id, stepNumber: t.stepNumber, action: t.action, workflow: t.instance.definition.name })) },
      });
    }

    // 6. Quality non-conformances open
    const openNCs = await prisma.nonConformance.findMany({
      where: { tenantId, status: { in: ["open", "in_progress"] } },
    });

    if (openNCs.length > 0) {
      const criticalNCs = openNCs.filter((nc) => nc.severity === "critical");
      if (criticalNCs.length > 0) {
        recommendations.push({
          id: `rec-${++recId}`,
          severity: "critical",
          category: "quality",
          title: `${criticalNCs.length} critical non-conformances`,
          description: `${criticalNCs.length} critical quality issues are unresolved. These may affect customer shipments.`,
          action: "Assign corrective actions and quarantine affected stock immediately",
          impact: "Prevent defective products from reaching customers",
          data: { count: criticalNCs.length, ncIds: criticalNCs.map((nc) => nc.id) },
        });
      }
    }

    // Sort by severity
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    recommendations.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    res.json({
      timestamp: new Date().toISOString(),
      totalRecommendations: recommendations.length,
      bySeverity: {
        critical: recommendations.filter((r) => r.severity === "critical").length,
        warning: recommendations.filter((r) => r.severity === "warning").length,
        info: recommendations.filter((r) => r.severity === "info").length,
      },
      byCategory: recommendations.reduce((acc, r) => {
        acc[r.category] = (acc[r.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      recommendations,
    });
  } catch (err) {
    next(err);
  }
});

// GET /scan/:category - scan specific category
router.get("/scan/:category", async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Reuse full scan and filter
    const fullUrl = `${req.protocol}://${req.get("host")}${req.baseUrl}/scan`;
    // Just call the scan handler internally by forwarding
    const tenantId = req.user!.tenantId;
    const category = req.params.category;

    // Simplified: redirect to full scan logic - let client filter
    // Forward the request to the full scan endpoint
    res.redirect(`${req.baseUrl}/scan`);
  } catch (err) {
    next(err);
  }
});

// POST /apply - simulate applying a recommendation (what-if)
router.post("/apply", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { recommendationId, action } = req.body;
    if (!recommendationId) return res.status(400).json({ error: "recommendationId required" });

    // In a real system this would execute the action
    // For education, we explain what would happen
    const outcomes: Record<string, { steps: string[]; impact: string; risk: string }> = {
      inventory: {
        steps: [
          "1. Create Purchase Requisition (ME51N)",
          "2. Convert to Purchase Order (ME21N)",
          "3. Send PO to vendor",
          "4. Receive Goods (MIGO)",
          "5. Post Invoice (MIRO)",
        ],
        impact: "Stock level restored, production can proceed",
        risk: "Lead time may cause temporary stockout if not expedited",
      },
      production: {
        steps: [
          "1. Analyze work center capacity (CR07)",
          "2. Identify operations to reschedule",
          "3. Update routing to alternate work center",
          "4. Recalculate production schedule",
          "5. Confirm rescheduled operations",
        ],
        impact: "Reduced bottleneck, improved throughput",
        risk: "Alternate work center may have lower efficiency",
      },
      purchasing: {
        steps: [
          "1. Contact vendor for delivery status",
          "2. If unresponsive, identify alternate sources",
          "3. Create expedite request or new PO",
          "4. Update delivery schedule in system",
          "5. Notify production planning of new dates",
        ],
        impact: "Material supply restored, production continues",
        risk: "Alternate vendor may have higher cost or different quality",
      },
      sales: {
        steps: [
          "1. Check available-to-promise (ATP)",
          "2. If stock available, create delivery (VL01N)",
          "3. If not, check production schedule",
          "4. Contact customer with updated timeline",
          "5. Process delivery and update SO status",
        ],
        impact: "Customer order fulfilled, satisfaction maintained",
        risk: "Expediting costs may reduce margin",
      },
      workflow: {
        steps: [
          "1. Review pending approval list",
          "2. Open each task and evaluate",
          "3. Approve or reject with comments",
          "4. System processes next workflow step",
          "5. Dependent processes unblocked",
        ],
        impact: "Process flow restored, no more bottlenecks in approvals",
        risk: "Hasty approvals may bypass necessary checks",
      },
      quality: {
        steps: [
          "1. Quarantine affected materials (QM01)",
          "2. Perform root cause analysis",
          "3. Create corrective action plan",
          "4. Implement fixes and verify",
          "5. Release quarantined stock or dispose",
        ],
        impact: "Quality issue contained, customer risk mitigated",
        risk: "Material disposal may cause temporary shortage",
      },
    };

    // Extract category from recommendationId pattern or use provided
    const category = action ?? "inventory";
    const outcome = outcomes[category] ?? outcomes.inventory;

    res.json({
      recommendationId,
      simulation: true,
      outcome,
      message: "This is a simulated outcome. In production, the system would execute these steps automatically.",
    });
  } catch (err) {
    next(err);
  }
});

export default router;
