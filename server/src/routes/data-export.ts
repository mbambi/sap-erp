import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authenticate } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

const router = Router();
router.use(authenticate);

const EXPORTABLE_ENTITIES: Record<string, { model: string; tenantScoped: boolean }> = {
  materials: { model: "material", tenantScoped: true },
  customers: { model: "customer", tenantScoped: true },
  vendors: { model: "vendor", tenantScoped: true },
  purchase_orders: { model: "purchaseOrder", tenantScoped: true },
  sales_orders: { model: "salesOrder", tenantScoped: true },
  journal_entries: { model: "journalEntry", tenantScoped: true },
  employees: { model: "employee", tenantScoped: true },
  production_orders: { model: "productionOrder", tenantScoped: true },
  inventory_movements: { model: "inventoryMovement", tenantScoped: false },
  boms: { model: "billOfMaterial", tenantScoped: true },
  cost_centers: { model: "costCenter", tenantScoped: true },
  audit_logs: { model: "auditLog", tenantScoped: true },
};

router.get("/entities", (_req: Request, res: Response) => {
  res.json(Object.keys(EXPORTABLE_ENTITIES).map((key) => ({
    key,
    label: key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
  })));
});

router.get("/csv/:entity", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const entity = req.params.entity;
    const config = EXPORTABLE_ENTITIES[entity];

    if (!config) throw new AppError(400, `Unknown entity: ${entity}`);

    const model = (prisma as any)[config.model];
    if (!model) throw new AppError(500, "Model not found");

    const where = config.tenantScoped ? { tenantId } : {};
    const limit = Math.min(10000, parseInt(req.query.limit as string) || 1000);

    const data = await model.findMany({ where, take: limit, orderBy: { createdAt: "desc" } });

    if (data.length === 0) {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${entity}.csv"`);
      return res.send("No data found");
    }

    const headers = Object.keys(data[0]).filter((k) => k !== "tenantId");

    const escapeCSV = (val: any): string => {
      if (val === null || val === undefined) return "";
      const str = String(val);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvRows = [
      headers.join(","),
      ...data.map((row: any) =>
        headers.map((h) => escapeCSV(row[h])).join(",")
      ),
    ];

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${entity}_${new Date().toISOString().split("T")[0]}.csv"`);
    res.send(csvRows.join("\n"));
  } catch (err) {
    next(err);
  }
});

router.get("/json/:entity", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const entity = req.params.entity;
    const config = EXPORTABLE_ENTITIES[entity];

    if (!config) throw new AppError(400, `Unknown entity: ${entity}`);

    const model = (prisma as any)[config.model];
    const where = config.tenantScoped ? { tenantId } : {};
    const limit = Math.min(10000, parseInt(req.query.limit as string) || 1000);

    const data = await model.findMany({ where, take: limit, orderBy: { createdAt: "desc" } });

    res.setHeader("Content-Disposition", `attachment; filename="${entity}_${new Date().toISOString().split("T")[0]}.json"`);
    res.json({ entity, exportedAt: new Date().toISOString(), count: data.length, data });
  } catch (err) {
    next(err);
  }
});

router.get("/summary", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;

    const counts: Record<string, number> = {};
    for (const [key, config] of Object.entries(EXPORTABLE_ENTITIES)) {
      const model = (prisma as any)[config.model];
      if (model) {
        const where = config.tenantScoped ? { tenantId } : {};
        counts[key] = await model.count({ where });
      }
    }

    res.json(counts);
  } catch (err) {
    next(err);
  }
});

export default router;
