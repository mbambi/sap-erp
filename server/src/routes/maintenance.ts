import { Router } from "express";
import { buildCrudRouter } from "../services/crud";

const router = Router();

router.use(
  "/equipment",
  buildCrudRouter({
    model: "equipment",
    module: "maintenance",
    resource: "equipment",
    searchFields: ["equipmentNumber", "description", "manufacturer"],
    include: { plant: true },
    defaultSort: { equipmentNumber: "asc" },
  })
);

router.use(
  "/work-orders",
  buildCrudRouter({
    model: "workOrder",
    module: "maintenance",
    resource: "work_order",
    searchFields: ["woNumber", "description"],
    include: { equipment: true },
    defaultSort: { createdAt: "desc" },
  })
);

router.use(
  "/maintenance-plans",
  buildCrudRouter({
    model: "maintenancePlan",
    module: "maintenance",
    resource: "maintenance_plan",
    tenantScoped: false,
    searchFields: ["name"],
    include: { equipment: true },
  })
);

export default router;
