import { Request, Response, NextFunction, Router } from "express";
import { prisma } from "../prisma";
import { authenticate } from "../middleware/auth";
import { auditLog } from "../middleware/audit";
import { AppError } from "../middleware/errorHandler";

type ModelDelegate = {
  findMany: (args?: any) => Promise<any[]>;
  findUnique: (args: any) => Promise<any>;
  create: (args: any) => Promise<any>;
  update: (args: any) => Promise<any>;
  delete: (args: any) => Promise<any>;
  count: (args?: any) => Promise<number>;
};

interface CrudOptions {
  model: keyof typeof prisma;
  module: string;
  resource: string;
  tenantScoped?: boolean;
  searchFields?: string[];
  include?: Record<string, any>;
  defaultSort?: Record<string, string>;
  beforeCreate?: (data: any, req: Request) => Promise<any>;
  beforeUpdate?: (data: any, req: Request) => Promise<any>;
}

export function buildCrudRouter(options: CrudOptions): Router {
  const router = Router();
  const {
    module: mod,
    resource,
    tenantScoped = true,
    searchFields = [],
    include,
    defaultSort = { createdAt: "desc" },
  } = options;

  const getModel = (): ModelDelegate => {
    return (prisma as any)[options.model] as ModelDelegate;
  };

  router.use(authenticate);
  router.use(auditLog(mod, resource));

  router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const model = getModel();
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
      const search = (req.query.search as string) || "";
      const skip = (page - 1) * limit;

      const where: any = {};
      if (tenantScoped) where.tenantId = req.user!.tenantId;

      if (search && searchFields.length > 0) {
        where.OR = searchFields.map((field) => ({
          [field]: { contains: search },
        }));
      }

      // Apply filter query params
      for (const [key, value] of Object.entries(req.query)) {
        if (["page", "limit", "search", "sort", "order"].includes(key)) continue;
        if (typeof value === "string" && value) {
          where[key] = value;
        }
      }

      const [data, total] = await Promise.all([
        model.findMany({
          where,
          include,
          orderBy: defaultSort,
          skip,
          take: limit,
        }),
        model.count({ where }),
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

  router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const model = getModel();
      const record = await model.findUnique({
        where: { id: req.params.id },
        include,
      });
      if (!record) throw new AppError(404, `${resource} not found`);
      if (tenantScoped && record.tenantId !== req.user!.tenantId) {
        throw new AppError(403, "Access denied");
      }
      res.json(record);
    } catch (err) {
      next(err);
    }
  });

  router.post("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const model = getModel();
      let data = { ...req.body };
      if (tenantScoped) data.tenantId = req.user!.tenantId;
      if (options.beforeCreate) data = await options.beforeCreate(data, req);
      const record = await model.create({ data, include });
      res.status(201).json(record);
    } catch (err: any) {
      if (err.code === "P2002") {
        return next(new AppError(409, `${resource} already exists with that key`));
      }
      next(err);
    }
  });

  router.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const model = getModel();
      const existing = await model.findUnique({ where: { id: req.params.id } });
      if (!existing) throw new AppError(404, `${resource} not found`);
      if (tenantScoped && existing.tenantId !== req.user!.tenantId) {
        throw new AppError(403, "Access denied");
      }
      let data = { ...req.body };
      delete data.id;
      delete data.tenantId;
      delete data.createdAt;
      if (options.beforeUpdate) data = await options.beforeUpdate(data, req);
      const record = await model.update({
        where: { id: req.params.id },
        data,
        include,
      });
      res.json(record);
    } catch (err) {
      next(err);
    }
  });

  router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const model = getModel();
      const existing = await model.findUnique({ where: { id: req.params.id } });
      if (!existing) throw new AppError(404, `${resource} not found`);
      if (tenantScoped && existing.tenantId !== req.user!.tenantId) {
        throw new AppError(403, "Access denied");
      }
      await model.delete({ where: { id: req.params.id } });
      res.json({ message: `${resource} deleted` });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
