import { Router } from "express";
import { buildCrudRouter } from "../services/crud";

const router = Router();

router.use(
  "/boms",
  buildCrudRouter({
    model: "billOfMaterial",
    module: "production",
    resource: "bom",
    searchFields: ["bomNumber", "description"],
    include: { material: true, components: { include: { material: true } }, routings: true },
    defaultSort: { bomNumber: "asc" },
  })
);

router.use(
  "/orders",
  buildCrudRouter({
    model: "productionOrder",
    module: "production",
    resource: "production_order",
    searchFields: ["orderNumber"],
    defaultSort: { createdAt: "desc" },
  })
);

export default router;
