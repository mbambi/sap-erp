import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authenticate, requireRoles } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";
import bcrypt from "bcryptjs";

const router = Router();
router.use(authenticate);

// ─── Transaction Codes ───────────────────────────────────────────────

router.get("/tcodes", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const tcodes = await prisma.transactionCode.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
    });
    res.json(tcodes);
  } catch (err) {
    next(err);
  }
});

router.get("/tcodes/:code", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tcode = await prisma.transactionCode.findUnique({
      where: { code: req.params.code.toUpperCase() },
    });
    if (!tcode) throw new AppError(404, `Transaction code ${req.params.code} not found`);
    res.json(tcode);
  } catch (err) {
    next(err);
  }
});

// ─── Sandbox Reset ───────────────────────────────────────────────────

router.post("/sandbox-reset", requireRoles("admin", "instructor"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tid = req.user!.tenantId;

    // Delete transactional data, keep master data structure
    await prisma.$transaction([
      prisma.journalLineItem.deleteMany({ where: { journalEntry: { tenantId: tid } } }),
      prisma.journalEntry.deleteMany({ where: { tenantId: tid } }),
      prisma.goodsReceiptItem.deleteMany({ where: { goodsReceipt: { purchaseOrder: { tenantId: tid } } } }),
      prisma.goodsReceipt.deleteMany({ where: { purchaseOrder: { tenantId: tid } } }),
      prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrder: { tenantId: tid } } }),
      prisma.purchaseOrder.deleteMany({ where: { tenantId: tid } }),
      prisma.invoiceItem.deleteMany({ where: { invoice: { salesOrder: { tenantId: tid } } } }),
      prisma.invoice.deleteMany({ where: { salesOrder: { tenantId: tid } } }),
      prisma.deliveryItem.deleteMany({ where: { delivery: { salesOrder: { tenantId: tid } } } }),
      prisma.delivery.deleteMany({ where: { salesOrder: { tenantId: tid } } }),
      prisma.salesOrderItem.deleteMany({ where: { salesOrder: { tenantId: tid } } }),
      prisma.salesOrder.deleteMany({ where: { tenantId: tid } }),
      prisma.inventoryMovement.deleteMany({ where: { material: { tenantId: tid } } }),
      prisma.plannedOrder.deleteMany({ where: { tenantId: tid } }),
      prisma.mrpRun.deleteMany({ where: { tenantId: tid } }),
      prisma.productionSchedule.deleteMany({ where: { tenantId: tid } }),
      prisma.productionOrder.deleteMany({ where: { tenantId: tid } }),
      prisma.workflowTask.deleteMany({ where: { instance: { definition: { tenantId: tid } } } }),
      prisma.workflowInstance.deleteMany({ where: { definition: { tenantId: tid } } }),
      prisma.processEvent.deleteMany({ where: { tenantId: tid } }),
      prisma.operationsMetric.deleteMany({ where: { tenantId: tid } }),
      prisma.exerciseProgress.deleteMany({ where: { exercise: { tenantId: tid } } }),
      prisma.auditLog.deleteMany({ where: { tenantId: tid } }),
    ]);

    // Reset material stock quantities
    await prisma.material.updateMany({
      where: { tenantId: tid },
      data: { stockQuantity: 0, reservedQty: 0 },
    });

    // Reset XP
    await prisma.userXP.updateMany({
      where: { tenantId: tid },
      data: { totalXP: 0, level: 1, streak: 0 },
    });

    res.json({ message: "Sandbox reset complete. Transactional data cleared, master data preserved." });
  } catch (err) {
    next(err);
  }
});

// ─── CSV Export ──────────────────────────────────────────────────────

router.get("/export/:entity", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tid = req.user!.tenantId;
    const entity = req.params.entity;

    const modelMap: Record<string, () => Promise<any[]>> = {
      materials: () => prisma.material.findMany({ where: { tenantId: tid } }),
      vendors: () => prisma.vendor.findMany({ where: { tenantId: tid } }),
      customers: () => prisma.customer.findMany({ where: { tenantId: tid } }),
      employees: () => prisma.employee.findMany({ where: { tenantId: tid } }),
      "gl-accounts": () => prisma.gLAccount.findMany({ where: { tenantId: tid } }),
      "cost-centers": () => prisma.costCenter.findMany({ where: { tenantId: tid } }),
      equipment: () => prisma.equipment.findMany({ where: { tenantId: tid } }),
    };

    const fetcher = modelMap[entity];
    if (!fetcher) throw new AppError(400, `Unknown entity: ${entity}`);

    const data = await fetcher();
    if (data.length === 0) {
      res.setHeader("Content-Type", "text/csv");
      res.send("No data");
      return;
    }

    const keys = Object.keys(data[0]).filter((k) => k !== "tenantId" && k !== "passwordHash");
    const header = keys.join(",");
    const rows = data.map((row: any) =>
      keys.map((k) => {
        const val = row[k];
        if (val === null || val === undefined) return "";
        const str = String(val);
        return str.includes(",") || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
      }).join(",")
    );

    const csv = [header, ...rows].join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=${entity}-export.csv`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

// ─── CSV Import ──────────────────────────────────────────────────────

router.post("/import/:entity", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tid = req.user!.tenantId;
    const entity = req.params.entity;
    const { rows } = req.body; // Array of objects

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      throw new AppError(400, "No data rows provided");
    }

    let imported = 0;
    const errors: string[] = [];

    if (entity === "materials") {
      for (const row of rows) {
        try {
          await prisma.material.create({
            data: {
              tenantId: tid,
              materialNumber: row.materialNumber,
              description: row.description,
              type: row.type || "raw",
              baseUnit: row.baseUnit || "EA",
              standardPrice: parseFloat(row.standardPrice) || 0,
              stockQuantity: parseInt(row.stockQuantity) || 0,
              reorderPoint: parseInt(row.reorderPoint) || 0,
              safetyStock: parseInt(row.safetyStock) || 0,
              leadTimeDays: parseInt(row.leadTimeDays) || 0,
            },
          });
          imported++;
        } catch (e: any) {
          errors.push(`Row ${row.materialNumber}: ${e.message}`);
        }
      }
    } else if (entity === "vendors") {
      for (const row of rows) {
        try {
          await prisma.vendor.create({
            data: { tenantId: tid, vendorNumber: row.vendorNumber, name: row.name, email: row.email, paymentTerms: row.paymentTerms || "NET30" },
          });
          imported++;
        } catch (e: any) {
          errors.push(`Row ${row.vendorNumber}: ${e.message}`);
        }
      }
    } else if (entity === "customers") {
      for (const row of rows) {
        try {
          await prisma.customer.create({
            data: { tenantId: tid, customerNumber: row.customerNumber, name: row.name, email: row.email, creditLimit: parseFloat(row.creditLimit) || 0 },
          });
          imported++;
        } catch (e: any) {
          errors.push(`Row ${row.customerNumber}: ${e.message}`);
        }
      }
    } else {
      throw new AppError(400, `Import not supported for: ${entity}`);
    }

    res.json({ imported, errors: errors.slice(0, 20), totalErrors: errors.length });
  } catch (err) {
    next(err);
  }
});

// ─── API Playground metadata ─────────────────────────────────────────

router.get("/api-docs", async (_req: Request, res: Response) => {
  res.json({
    modules: [
      {
        name: "Authentication", base: "/api/auth",
        endpoints: [
          { method: "POST", path: "/login", desc: "Login with credentials", body: { email: "admin@demo.edu", password: "password123", tenantSlug: "demo-university" } },
          { method: "GET", path: "/me", desc: "Get current user profile" },
          { method: "GET", path: "/tenants", desc: "List available tenants" },
        ],
      },
      {
        name: "Finance", base: "/api/finance",
        endpoints: [
          { method: "GET", path: "/gl-accounts", desc: "List GL accounts" },
          { method: "GET", path: "/journal-entries", desc: "List journal entries" },
          { method: "POST", path: "/journal-entries", desc: "Create journal entry", body: { companyCodeId: "...", postingDate: "2024-01-15", documentDate: "2024-01-15", description: "Office supplies", lineItems: [{ glAccountId: "...", debit: 500, credit: 0 }, { glAccountId: "...", debit: 0, credit: 500 }] } },
          { method: "GET", path: "/vendors", desc: "List vendors" },
          { method: "GET", path: "/customers", desc: "List customers" },
          { method: "GET", path: "/trial-balance", desc: "Get trial balance" },
        ],
      },
      {
        name: "Materials", base: "/api/materials",
        endpoints: [
          { method: "GET", path: "/items", desc: "List materials" },
          { method: "POST", path: "/items", desc: "Create material" },
          { method: "GET", path: "/purchase-orders", desc: "List purchase orders" },
          { method: "POST", path: "/purchase-orders", desc: "Create PO" },
          { method: "POST", path: "/purchase-orders/:id/approve", desc: "Approve PO" },
          { method: "POST", path: "/purchase-orders/:id/goods-receipt", desc: "Post goods receipt" },
        ],
      },
      {
        name: "Sales", base: "/api/sales",
        endpoints: [
          { method: "GET", path: "/orders", desc: "List sales orders" },
          { method: "POST", path: "/orders", desc: "Create sales order" },
          { method: "POST", path: "/orders/:id/confirm", desc: "Confirm order" },
          { method: "POST", path: "/orders/:id/deliver", desc: "Create delivery" },
          { method: "POST", path: "/orders/:id/invoice", desc: "Create invoice" },
        ],
      },
      {
        name: "MRP", base: "/api/mrp",
        endpoints: [
          { method: "POST", path: "/runs", desc: "Execute MRP run" },
          { method: "GET", path: "/planned-orders", desc: "List planned orders" },
          { method: "POST", path: "/planned-orders/:id/convert", desc: "Convert to PO/Production" },
          { method: "POST", path: "/forecasts", desc: "Create demand forecast" },
        ],
      },
      {
        name: "Supply Chain", base: "/api/supply-chain",
        endpoints: [
          { method: "GET", path: "/network", desc: "Get supply chain network" },
          { method: "POST", path: "/nodes", desc: "Create network node" },
          { method: "POST", path: "/links", desc: "Create network link" },
          { method: "POST", path: "/optimize", desc: "Run transportation optimization" },
        ],
      },
      {
        name: "Operations", base: "/api/operations",
        endpoints: [
          { method: "GET", path: "/dashboard", desc: "Operations KPI dashboard" },
          { method: "POST", path: "/calculate-oee", desc: "Calculate OEE" },
        ],
      },
    ],
  });
});

// ─── Scenario Simulator ──────────────────────────────────────────────

router.post("/simulate/supplier-delay", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { vendorId, delayDays, affectedMaterials } = req.body;
    const tid = req.user!.tenantId;

    const openPOs = await prisma.purchaseOrder.findMany({
      where: { tenantId: tid, vendorId, status: { in: ["approved", "ordered"] } },
      include: { items: { include: { material: true } }, vendor: true },
    });

    const impacts: any[] = [];
    for (const po of openPOs) {
      for (const item of po.items) {
        const mat = item.material;
        const currentStock = mat.stockQuantity;
        const dailyUsage = mat.reorderPoint > 0 ? mat.reorderPoint / (mat.leadTimeDays || 7) : 1;
        const daysOfStock = currentStock / dailyUsage;
        const willRunOut = daysOfStock < delayDays;

        impacts.push({
          material: mat.materialNumber,
          description: mat.description,
          currentStock,
          dailyUsage: Math.round(dailyUsage * 100) / 100,
          daysOfStock: Math.round(daysOfStock),
          delayDays,
          willRunOut,
          shortageQty: willRunOut ? Math.ceil((delayDays - daysOfStock) * dailyUsage) : 0,
          recommendation: willRunOut
            ? "URGENT: Find alternative supplier or expedite"
            : "Monitor: Stock sufficient to cover delay",
        });
      }
    }

    // Check downstream impact on sales orders
    const openSOs = await prisma.salesOrder.findMany({
      where: { tenantId: tid, status: { in: ["confirmed", "processing"] } },
      include: { items: { include: { material: true } }, customer: true },
    });

    const customerImpacts = openSOs.filter((so) =>
      so.items.some((si) => impacts.some((imp) => imp.material === si.material.materialNumber && imp.willRunOut))
    ).map((so) => ({
      soNumber: so.soNumber,
      customer: so.customer.name,
      status: "AT RISK - Potential late delivery",
    }));

    res.json({
      scenario: "Supplier Delay",
      vendor: openPOs[0]?.vendor?.name || vendorId,
      delayDays,
      materialImpacts: impacts,
      customerImpacts,
      summary: {
        materialsAffected: impacts.length,
        shortages: impacts.filter((i) => i.willRunOut).length,
        customersAtRisk: customerImpacts.length,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post("/simulate/demand-spike", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { materialId, spikeMultiplier, durationDays } = req.body;
    const tid = req.user!.tenantId;

    const material = await prisma.material.findFirst({
      where: { tenantId: tid, id: materialId },
    });
    if (!material) throw new AppError(404, "Material not found");

    const normalDailyDemand = material.reorderPoint > 0 ? material.reorderPoint / (material.leadTimeDays || 7) : 5;
    const spikeDemand = normalDailyDemand * (spikeMultiplier || 2);
    const totalSpikeDemand = spikeDemand * (durationDays || 14);
    const currentStock = material.stockQuantity;
    const daysBeforeStockout = currentStock / spikeDemand;
    const additionalNeeded = Math.max(0, totalSpikeDemand - currentStock);

    const actions = [];
    if (additionalNeeded > 0) {
      actions.push({
        action: "Run MRP",
        description: `Execute MRP to generate planned orders for ${Math.ceil(additionalNeeded)} units`,
        priority: "HIGH",
      });
      actions.push({
        action: "Emergency Procurement",
        description: `Create purchase order for ${Math.ceil(additionalNeeded)} units with expedited delivery`,
        priority: "HIGH",
      });
    }
    if (material.type === "finished") {
      actions.push({
        action: "Increase Production",
        description: `Create production order for ${Math.ceil(additionalNeeded * 1.1)} units (10% buffer)`,
        priority: "MEDIUM",
      });
    }
    actions.push({
      action: "Notify Sales",
      description: "Alert sales team about potential delivery delays if supply cannot meet demand",
      priority: "MEDIUM",
    });

    res.json({
      scenario: "Demand Spike",
      material: { number: material.materialNumber, description: material.description },
      analysis: {
        normalDailyDemand: Math.round(normalDailyDemand * 100) / 100,
        spikeDemand: Math.round(spikeDemand * 100) / 100,
        spikeMultiplier: spikeMultiplier || 2,
        durationDays: durationDays || 14,
        totalSpikeDemand: Math.round(totalSpikeDemand),
        currentStock,
        daysBeforeStockout: Math.round(daysBeforeStockout * 10) / 10,
        additionalUnitsNeeded: Math.ceil(additionalNeeded),
        estimatedCost: Math.ceil(additionalNeeded) * material.standardPrice,
      },
      recommendedActions: actions,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
