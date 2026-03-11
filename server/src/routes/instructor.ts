import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authenticate, requireRoles } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

const router = Router();
router.use(authenticate);
router.use(requireRoles("admin", "instructor"));

const tenantScope = (req: Request) => req.user!.tenantId;

/** GET /actions - List all instructor actions for tenant */
router.get("/actions", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);

    const actions = await prisma.instructorAction.findMany({
      where: { tenantId },
      orderBy: { appliedAt: "desc" },
    });

    res.json(actions);
  } catch (err) {
    next(err);
  }
});

/** POST /inject-crisis - Inject a crisis */
router.post("/inject-crisis", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);
    const userId = req.user!.userId;
    const { crisisType, parameters = {} } = req.body;

    if (!crisisType) throw new AppError(400, "crisisType is required");

    let description = "";
    let targetEntity: string | null = null;

    switch (crisisType) {
      case "supplier_failure": {
        const { vendorId, durationDays } = parameters;
        if (!vendorId) throw new AppError(400, "vendorId required for supplier_failure");

        // Verify vendor belongs to this tenant
        const vendor = await prisma.vendor.findFirst({
          where: { id: vendorId, tenantId },
        });
        if (!vendor) throw new AppError(404, "Vendor not found in this tenant");

        const pos = await prisma.purchaseOrder.findMany({
          where: { tenantId, vendorId, status: { in: ["approved", "ordered"] } },
        });

        for (const po of pos) {
          await prisma.purchaseOrder.update({
            where: { id: po.id },
            data: {
              deliveryDate: po.deliveryDate
                ? new Date(po.deliveryDate.getTime() + (durationDays || 7) * 24 * 60 * 60 * 1000)
                : new Date(Date.now() + (durationDays || 7) * 24 * 60 * 60 * 1000),
            },
          });
        }

        description = `Supplier failure: vendor ${vendorId}, ${durationDays || 7} days delay`;
        targetEntity = vendorId;
        break;
      }

      case "demand_spike": {
        const { materialId, multiplier = 2, durationDays = 7 } = parameters;
        if (!materialId) throw new AppError(400, "materialId required for demand_spike");

        const material = await prisma.material.findFirst({
          where: { id: materialId, tenantId },
        });
        if (!material) throw new AppError(404, "Material not found");

        const customers = await prisma.customer.findMany({
          where: { tenantId },
          take: 3,
        });
        const baseQty = Math.ceil((material.stockQuantity || 0) * 0.2) || 10;
        const extraQty = Math.ceil(baseQty * (multiplier as number));

        for (const cust of customers) {
          await prisma.salesOrder.create({
            data: {
              tenantId,
              soNumber: `SO-SPIKE-${Date.now()}-${cust.id.slice(0, 8)}`,
              customerId: cust.id,
              status: "confirmed",
              totalAmount: extraQty * (material.standardPrice || 0),
              createdBy: userId,
              items: {
                create: {
                  lineNumber: 1,
                  materialId,
                  quantity: extraQty,
                  unitPrice: material.standardPrice || 0,
                  totalPrice: extraQty * (material.standardPrice || 0),
                },
              },
            },
          });
        }

        description = `Demand spike: material ${materialId}, multiplier ${multiplier}`;
        targetEntity = materialId;
        break;
      }

      case "warehouse_fire": {
        const { warehouseId, inventoryLossPct = 50 } = parameters;
        if (!warehouseId) throw new AppError(400, "warehouseId required for warehouse_fire");

        // Verify warehouse belongs to this tenant
        const warehouse = await prisma.warehouse.findFirst({
          where: { id: warehouseId, tenantId },
        });
        if (!warehouse) throw new AppError(404, "Warehouse not found in this tenant");

        const bins = await prisma.warehouseBin.findMany({
          where: { warehouseId, warehouse: { tenantId } },
        });

        for (const bin of bins) {
          if (bin.quantity > 0) {
            const loss = Math.ceil(bin.quantity * ((inventoryLossPct as number) / 100));
            await prisma.warehouseBin.update({
              where: { id: bin.id },
              data: { quantity: Math.max(0, bin.quantity - loss) },
            });
            if (bin.materialId) {
              const mat = await prisma.material.findUnique({ where: { id: bin.materialId } });
              if (mat) {
                await prisma.material.update({
                  where: { id: bin.materialId },
                  data: { stockQuantity: Math.max(0, (mat.stockQuantity || 0) - loss) },
                });
              }
            }
          }
        }

        description = `Warehouse fire: ${warehouseId}, ${inventoryLossPct}% inventory loss`;
        targetEntity = warehouseId;
        break;
      }

      case "machine_breakdown": {
        const { workCenterCode, durationDays = 3 } = parameters;
        if (!workCenterCode) throw new AppError(400, "workCenterCode required for machine_breakdown");

        const wc = await prisma.workCenter.findFirst({
          where: { tenantId, code: workCenterCode },
        });
        if (!wc) throw new AppError(404, "Work center not found");

        await prisma.workCenter.update({
          where: { id: wc.id },
          data: { status: "maintenance" },
        });

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + (durationDays as number));

        description = `Machine breakdown: ${workCenterCode}, ${durationDays} days`;
        targetEntity = workCenterCode;
        break;
      }

      case "quality_crisis": {
        const { materialId } = parameters;
        if (!materialId) throw new AppError(400, "materialId required for quality_crisis");

        const lotCount = await prisma.inspectionLot.count({ where: { tenantId } });
        const lot = await prisma.inspectionLot.create({
          data: {
            tenantId,
            lotNumber: `QL-${String(lotCount + 1).padStart(6, "0")}`,
            materialId,
            quantity: 100,
            origin: "goods_receipt",
            status: "in_inspection",
            defectiveQty: 45,
            inspectedQty: 50,
          },
        });

        description = `Quality crisis: material ${materialId}, high defect rate`;
        targetEntity = materialId;
        break;
      }

      default:
        throw new AppError(400, `Unknown crisis type: ${crisisType}`);
    }

    const expiresAt = parameters.durationDays
      ? new Date(Date.now() + (parameters.durationDays as number) * 24 * 60 * 60 * 1000)
      : null;

    const action = await prisma.instructorAction.create({
      data: {
        tenantId,
        actionType: "inject_crisis",
        description,
        parameters: JSON.stringify({ crisisType, ...parameters }),
        targetEntity,
        expiresAt,
        createdBy: userId,
      },
    });

    res.status(201).json(action);
  } catch (err) {
    next(err);
  }
});

/** POST /freeze-inventory - Freeze all inventory movements */
router.post("/freeze-inventory", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);
    const userId = req.user!.userId;

    const action = await prisma.instructorAction.create({
      data: {
        tenantId,
        actionType: "freeze_inventory",
        description: "Inventory movements frozen",
        parameters: JSON.stringify({ frozen: true }),
        createdBy: userId,
      },
    });

    res.status(201).json({ message: "Inventory frozen", action });
  } catch (err) {
    next(err);
  }
});

/** POST /unfreeze-inventory - Unfreeze inventory */
router.post("/unfreeze-inventory", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);

    await prisma.instructorAction.updateMany({
      where: { tenantId, actionType: "freeze_inventory", isActive: true },
      data: { isActive: false },
    });

    res.json({ message: "Inventory unfrozen" });
  } catch (err) {
    next(err);
  }
});

/** POST /change-demand - Manually override demand forecast */
router.post("/change-demand", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);
    const userId = req.user!.userId;
    const { materialId, newDemand, periodDays = 30 } = req.body;

    if (!materialId || newDemand == null) throw new AppError(400, "materialId and newDemand required");

    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + (periodDays as number));

    const forecast = await prisma.demandForecast.create({
      data: {
        tenantId,
        materialId,
        periodStart: start,
        periodEnd: end,
        forecastQty: Number(newDemand),
        method: "manual",
        createdBy: userId,
      },
    });

    const action = await prisma.instructorAction.create({
      data: {
        tenantId,
        actionType: "change_demand",
        description: `Demand override: ${materialId} = ${newDemand}`,
        parameters: JSON.stringify({ materialId, newDemand, periodDays }),
        targetEntity: materialId,
        createdBy: userId,
      },
    });

    res.status(201).json({ forecast, action });
  } catch (err) {
    next(err);
  }
});

/** POST /reset-crisis - Undo all active crises */
router.post("/reset-crisis", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);

    const actions = await prisma.instructorAction.findMany({
      where: { tenantId, isActive: true },
    });

    for (const a of actions) {
      const params = a.parameters ? JSON.parse(a.parameters) : {};
      if (a.actionType === "inject_crisis" && params.crisisType === "machine_breakdown" && params.workCenterCode) {
        const wc = await prisma.workCenter.findFirst({
          where: { tenantId, code: params.workCenterCode },
        });
        if (wc) {
          await prisma.workCenter.update({
            where: { id: wc.id },
            data: { status: "available" },
          });
        }
      }
    }

    await prisma.instructorAction.updateMany({
      where: { tenantId, isActive: true },
      data: { isActive: false },
    });

    res.json({ message: "All active crises reset" });
  } catch (err) {
    next(err);
  }
});

/** GET /student-activity - View all student activity */
router.get("/student-activity", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);

    const [auditLogs, exerciseProgress, sessions] = await Promise.all([
      prisma.auditLog.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.exerciseProgress.findMany({
        where: { exercise: { tenantId } },
        include: { exercise: true },
        orderBy: { completedAt: "desc" },
        take: 50,
        }).catch((err) => {
          console.error("[InstructorDashboard] Failed to fetch exercise progress:", err);
          return [];
        }),
      prisma.simulationSession.findMany({
        where: { tenantId },
        include: { events: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    res.json({
      recentTransactions: auditLogs,
      exerciseProgress,
      simulationSessions: sessions,
    });
  } catch (err) {
    next(err);
  }
});

/** GET /dashboard - Instructor dashboard */
router.get("/dashboard", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantScope(req);

    const [activeCrises, studentCount, exercises, sessions] = await Promise.all([
      prisma.instructorAction.count({
        where: { tenantId, isActive: true },
      }),
      prisma.user.count({ where: { tenantId } }),
      prisma.exercise.findMany({
        where: { tenantId },
        include: { progress: true },
      }),
      prisma.simulationSession.findMany({
        where: { tenantId },
      }),
    ]);

    const totalProgress = exercises.reduce((s, e) => s + e.progress.length, 0);
    const completedCount = exercises.reduce((s, e) => s + e.progress.filter((p) => p.status === "completed").length, 0);
    const completionRate = totalProgress > 0 ? (completedCount / totalProgress) * 100 : 0;

    const avgScore =
      sessions.filter((s) => s.results).length > 0
        ? sessions
            .filter((s) => s.results)
            .reduce((sum, s) => {
              try {
                const r = JSON.parse(s.results!);
                return sum + (r.finalScore || 0);
              } catch {
                return sum;
              }
            }, 0) / sessions.filter((s) => s.results).length
        : 0;

    res.json({
      activeCrises,
      studentCount,
      exerciseCount: exercises.length,
      exerciseCompletionRate: Math.round(completionRate) || 0,
      simulationCount: sessions.length,
      averageSimulationScore: Math.round(avgScore) || 0,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
