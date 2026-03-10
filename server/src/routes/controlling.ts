import { Router } from "express";
import { buildCrudRouter } from "../services/crud";

const router = Router();

router.use(
  "/cost-centers",
  buildCrudRouter({
    model: "costCenter",
    module: "controlling",
    resource: "cost_center",
    searchFields: ["code", "name"],
    include: { parent: true, children: true },
    defaultSort: { code: "asc" },
  })
);

router.use(
  "/internal-orders",
  buildCrudRouter({
    model: "internalOrder",
    module: "controlling",
    resource: "internal_order",
    searchFields: ["orderNumber", "description"],
    defaultSort: { createdAt: "desc" },
  })
);

export default router;
