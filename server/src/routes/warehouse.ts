import { Router } from "express";
import { buildCrudRouter } from "../services/crud";

const router = Router();

router.use(
  "/warehouses",
  buildCrudRouter({
    model: "warehouse",
    module: "warehouse",
    resource: "warehouse",
    searchFields: ["code", "name"],
    include: { plant: true },
    defaultSort: { code: "asc" },
  })
);

router.use(
  "/bins",
  buildCrudRouter({
    model: "warehouseBin",
    module: "warehouse",
    resource: "warehouse_bin",
    tenantScoped: false,
    searchFields: ["binCode", "zone"],
    include: { warehouse: true, material: true },
    defaultSort: { binCode: "asc" },
  })
);

export default router;
