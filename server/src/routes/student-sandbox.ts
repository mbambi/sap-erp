import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authenticate } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

const router = Router();
router.use(authenticate);

router.get("/my-company", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const userId = req.user!.userId;

    let company = await prisma.studentCompany.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });

    if (!company) {
      company = await prisma.studentCompany.create({
        data: {
          tenantId,
          userId,
          companyName: `${user?.firstName ?? "Student"} Manufacturing`,
          industry: "manufacturing",
          cashBalance: 100000,
        },
      });
    }

    const stats = await Promise.all([
      prisma.material.count({ where: { tenantId } }),
      prisma.salesOrder.count({ where: { tenantId } }),
      prisma.purchaseOrder.count({ where: { tenantId } }),
      prisma.productionOrder.count({ where: { tenantId } }),
    ]);

    res.json({
      company,
      stats: {
        materials: stats[0],
        salesOrders: stats[1],
        purchaseOrders: stats[2],
        productionOrders: stats[3],
      },
    });
  } catch (err) {
    next(err);
  }
});

router.put("/my-company", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const userId = req.user!.userId;
    const { companyName, industry, description } = req.body;

    const company = await prisma.studentCompany.upsert({
      where: { tenantId_userId: { tenantId, userId } },
      update: {
        ...(companyName && { companyName }),
        ...(industry && { industry }),
        ...(description !== undefined && { description }),
      },
      create: {
        tenantId,
        userId,
        companyName: companyName || "My Company",
        industry: industry || "manufacturing",
        description,
      },
    });

    res.json(company);
  } catch (err) {
    next(err);
  }
});

router.post("/reset", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const userId = req.user!.userId;
    const { scope = "all" } = req.body;

    const deleteOps: Promise<any>[] = [];

    if (scope === "all" || scope === "finance") {
      deleteOps.push(
        prisma.journalEntry.deleteMany({ where: { tenantId } }),
        prisma.payment.deleteMany({ where: { tenantId } }),
        prisma.supplierInvoice.deleteMany({ where: { tenantId } }),
      );
    }

    if (scope === "all" || scope === "sales") {
      deleteOps.push(
        prisma.invoice.deleteMany({ where: { salesOrder: { tenantId } } }),
        prisma.delivery.deleteMany({ where: { salesOrder: { tenantId } } }),
        prisma.salesOrder.deleteMany({ where: { tenantId } }),
      );
    }

    if (scope === "all" || scope === "procurement") {
      deleteOps.push(
        prisma.goodsReceipt.deleteMany({ where: { purchaseOrder: { tenantId } } }),
        prisma.purchaseOrder.deleteMany({ where: { tenantId } }),
        prisma.purchaseRequisition.deleteMany({ where: { tenantId } }),
      );
    }

    if (scope === "all" || scope === "production") {
      deleteOps.push(
        prisma.productionOrder.deleteMany({ where: { tenantId } }),
        prisma.productionSchedule.deleteMany({ where: { tenantId } }),
        prisma.plannedOrder.deleteMany({ where: { tenantId } }),
        prisma.mrpRun.deleteMany({ where: { tenantId } }),
      );
    }

    if (scope === "all" || scope === "inventory") {
      deleteOps.push(
        prisma.inventoryMovement.deleteMany({ where: { material: { tenantId } } }),
      );
      // Reset stock quantities
      await prisma.material.updateMany({
        where: { tenantId },
        data: { stockQuantity: 0, reservedQty: 0 },
      });
    }

    await Promise.all(deleteOps);

    // Reset company financials
    await prisma.studentCompany.update({
      where: { tenantId_userId: { tenantId, userId } },
      data: { cashBalance: 100000, revenue: 0, expenses: 0, profit: 0, inventoryValue: 0, serviceLevel: 100 },
    }).catch((err) => {
      // Student company may not exist yet, continue anyway
      console.error("[StudentSandbox] Failed to reset company financials:", err);
    });

    await prisma.notification.create({
      data: {
        tenantId,
        userId,
        type: "info",
        title: "Sandbox Reset",
        message: `Your sandbox data (${scope}) has been reset successfully.`,
        module: "sandbox",
      },
    });

    res.json({ message: `Sandbox reset (${scope}) completed`, scope });
  } catch (err) {
    next(err);
  }
});

export default router;
