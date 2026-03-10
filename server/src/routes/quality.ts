import { Router } from "express";
import { buildCrudRouter } from "../services/crud";

const router = Router();

router.use(
  "/inspection-lots",
  buildCrudRouter({
    model: "inspectionLot",
    module: "quality",
    resource: "inspection_lot",
    searchFields: ["lotNumber"],
    include: { material: true, results: true, nonConformances: true },
    defaultSort: { createdAt: "desc" },
  })
);

router.use(
  "/non-conformances",
  buildCrudRouter({
    model: "nonConformance",
    module: "quality",
    resource: "non_conformance",
    tenantScoped: false,
    searchFields: ["ncNumber", "description"],
    include: { inspectionLot: true },
    defaultSort: { createdAt: "desc" },
  })
);

export default router;
