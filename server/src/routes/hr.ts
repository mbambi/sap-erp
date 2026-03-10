import { Router } from "express";
import { buildCrudRouter } from "../services/crud";
import { authenticate, requireRoles } from "../middleware/auth";

const router = Router();
router.use(authenticate, requireRoles("admin", "instructor"));

router.use(
  "/employees",
  buildCrudRouter({
    model: "employee",
    module: "hr",
    resource: "employee",
    searchFields: ["employeeNumber", "firstName", "lastName", "email"],
    include: { plant: true, manager: true, orgUnit: true },
    defaultSort: { employeeNumber: "asc" },
  })
);

router.use(
  "/org-units",
  buildCrudRouter({
    model: "orgUnit",
    module: "hr",
    resource: "org_unit",
    tenantScoped: false,
    searchFields: ["name", "code"],
    include: { parent: true, children: true },
    defaultSort: { code: "asc" },
  })
);

router.use(
  "/leave-requests",
  buildCrudRouter({
    model: "leaveRequest",
    module: "hr",
    resource: "leave_request",
    tenantScoped: false,
    searchFields: ["leaveType"],
    include: { employee: true },
    defaultSort: { createdAt: "desc" },
  })
);

router.use(
  "/time-entries",
  buildCrudRouter({
    model: "timeEntry",
    module: "hr",
    resource: "time_entry",
    tenantScoped: false,
    searchFields: ["project", "activity"],
    include: { employee: true },
    defaultSort: { date: "desc" },
  })
);

export default router;
