import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authenticate, requireRoles } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";
import { buildCrudRouter } from "../services/crud";

const router = Router();

router.use(
  "/definitions",
  buildCrudRouter({
    model: "workflowDefinition",
    module: "workflow",
    resource: "workflow_definition",
    searchFields: ["name", "module"],
  })
);

// My pending tasks
router.get("/my-tasks", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tasks = await prisma.workflowTask.findMany({
      where: {
        assigneeId: req.user!.userId,
        status: "pending",
      },
      include: {
        instance: { include: { definition: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(tasks);
  } catch (err) {
    next(err);
  }
});

// Complete a workflow task
router.post("/tasks/:id/complete", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const task = await prisma.workflowTask.findUnique({
      where: { id: req.params.id },
      include: { instance: { include: { definition: true } } },
    });
    if (!task) throw new AppError(404, "Task not found");
    if (task.assigneeId !== req.user!.userId) throw new AppError(403, "Not your task");
    if (task.status !== "pending") throw new AppError(400, "Task already completed");

    const { action, comment } = req.body;

    await prisma.workflowTask.update({
      where: { id: req.params.id },
      data: { status: "completed", action, comment, completedAt: new Date() },
    });

    const steps = JSON.parse(task.instance.definition.steps);
    const nextStepIdx = task.instance.currentStep + 1;

    if (action === "reject") {
      await prisma.workflowInstance.update({
        where: { id: task.instanceId },
        data: { status: "cancelled", completedAt: new Date() },
      });
    } else if (nextStepIdx >= steps.length) {
      await prisma.workflowInstance.update({
        where: { id: task.instanceId },
        data: { status: "completed", currentStep: nextStepIdx, completedAt: new Date() },
      });
    } else {
      const nextStep = steps[nextStepIdx];
      await prisma.workflowInstance.update({
        where: { id: task.instanceId },
        data: { currentStep: nextStepIdx },
      });
      if (nextStep.assigneeId) {
        await prisma.workflowTask.create({
          data: {
            instanceId: task.instanceId,
            stepNumber: nextStepIdx,
            assigneeId: nextStep.assigneeId,
            action: nextStep.action || "approve",
            dueDate: nextStep.dueDays
              ? new Date(Date.now() + nextStep.dueDays * 86400000)
              : undefined,
          },
        });
      }
    }

    res.json({ message: "Task completed" });
  } catch (err) {
    next(err);
  }
});

// Instances list
router.get("/instances", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instances = await prisma.workflowInstance.findMany({
      where: { definition: { tenantId: req.user!.tenantId } },
      include: { definition: true, tasks: true },
      orderBy: { startedAt: "desc" },
    });
    res.json(instances);
  } catch (err) {
    next(err);
  }
});

// ─── Configurable Workflow Rules ──────────────────────────────────────

// GET /rules — list workflow rules
router.get("/rules", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const definitions = await prisma.workflowDefinition.findMany({
      where: { tenantId },
    });

    const rules = definitions.map((d) => ({
      id: d.id,
      name: d.name,
      module: d.module,
      triggerEvent: d.triggerEvent,
      conditions: d.conditions ? JSON.parse(d.conditions) : [],
      steps: JSON.parse(d.steps),
      isActive: d.isActive,
    }));

    res.json(rules);
  } catch (err) {
    next(err);
  }
});

// POST /rules — create a configurable workflow rule
router.post("/rules", authenticate, requireRoles("admin", "instructor"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { name, module, triggerEvent, conditions, steps, description } = req.body;

    if (!name || !module || !triggerEvent || !steps) {
      throw new AppError(400, "name, module, triggerEvent, and steps are required");
    }

    /*
     * Example rule:
     * {
     *   name: "PO Approval > $10,000",
     *   module: "materials",
     *   triggerEvent: "PurchaseOrderCreated",
     *   conditions: [
     *     { field: "totalAmount", operator: "gt", value: 10000 }
     *   ],
     *   steps: [
     *     { name: "Manager Approval", type: "approval", role: "instructor", dueDays: 2 },
     *     { name: "Finance Review", type: "approval", role: "admin", dueDays: 3 }
     *   ]
     * }
     */

    const definition = await prisma.workflowDefinition.create({
      data: {
        tenantId,
        name,
        module,
        triggerEvent: triggerEvent,
        conditions: JSON.stringify(conditions ?? []),
        steps: JSON.stringify(steps),
        description: description ?? null,
        isActive: true,
      },
    });

    res.status(201).json(definition);
  } catch (err) {
    next(err);
  }
});

// POST /rules/evaluate — evaluate a document against workflow rules
router.post("/rules/evaluate", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const userId = req.user!.userId;
    const { triggerEvent, document } = req.body;

    if (!triggerEvent || !document) {
      throw new AppError(400, "triggerEvent and document are required");
    }

    const definitions = await prisma.workflowDefinition.findMany({
      where: { tenantId, triggerEvent, isActive: true },
    });

    const triggeredWorkflows: Array<{ definitionId: string; name: string; instanceId: string }> = [];

    for (const def of definitions) {
      const conditions = JSON.parse(def.conditions ?? "[]") as Array<{
        field: string;
        operator: string;
        value: number | string;
      }>;

      // Evaluate conditions
      let allMet = true;
      for (const cond of conditions) {
        const fieldValue = document[cond.field];
        if (fieldValue === undefined) { allMet = false; break; }

        switch (cond.operator) {
          case "gt": allMet = allMet && fieldValue > cond.value; break;
          case "gte": allMet = allMet && fieldValue >= cond.value; break;
          case "lt": allMet = allMet && fieldValue < cond.value; break;
          case "lte": allMet = allMet && fieldValue <= cond.value; break;
          case "eq": allMet = allMet && fieldValue === cond.value; break;
          case "neq": allMet = allMet && fieldValue !== cond.value; break;
          case "contains": allMet = allMet && String(fieldValue).includes(String(cond.value)); break;
          default: break;
        }
        if (!allMet) break;
      }

      if (!allMet) continue;

      // Create workflow instance
      const steps = JSON.parse(def.steps) as Array<{
        name: string;
        type: string;
        role?: string;
        assigneeId?: string;
        dueDays?: number;
      }>;

      const instance = await prisma.workflowInstance.create({
        data: {
          definitionId: def.id,
          triggeredBy: userId,
          documentId: document.id ?? null,
          documentType: triggerEvent,
          status: "active",
          currentStep: 0,
          contextData: JSON.stringify(document),
        },
      });

      // Create first task
      if (steps.length > 0) {
        const firstStep = steps[0];
        let assigneeId = firstStep.assigneeId;

        // If step has role but no specific assignee, find a user with that role
        if (!assigneeId && firstStep.role) {
          const roleUser = await prisma.user.findFirst({
            where: {
              tenantId,
              userRoles: { some: { role: { name: firstStep.role } } },
            },
          });
          assigneeId = roleUser?.id;
        }

        if (assigneeId) {
          await prisma.workflowTask.create({
            data: {
              instanceId: instance.id,
              stepNumber: 0,
              assigneeId,
              action: firstStep.type || "approve",
              dueDate: firstStep.dueDays
                ? new Date(Date.now() + firstStep.dueDays * 86400000)
                : undefined,
            },
          });
        }
      }

      triggeredWorkflows.push({
        definitionId: def.id,
        name: def.name,
        instanceId: instance.id,
      });
    }

    res.json({
      triggerEvent,
      rulesEvaluated: definitions.length,
      workflowsTriggered: triggeredWorkflows.length,
      workflows: triggeredWorkflows,
    });
  } catch (err) {
    next(err);
  }
});

// GET /rules/templates — predefined workflow rule templates
router.get("/rules/templates", authenticate, (_req: Request, res: Response) => {
  const templates = [
    {
      name: "PO Approval > $10,000",
      module: "materials",
      triggerEvent: "PurchaseOrderCreated",
      conditions: [{ field: "totalAmount", operator: "gt", value: 10000 }],
      steps: [
        { name: "Manager Approval", type: "approval", role: "instructor", dueDays: 2 },
        { name: "Finance Review", type: "approval", role: "admin", dueDays: 3 },
      ],
    },
    {
      name: "Sales Order Credit Check",
      module: "sales",
      triggerEvent: "SalesOrderCreated",
      conditions: [{ field: "totalAmount", operator: "gt", value: 50000 }],
      steps: [
        { name: "Credit Check", type: "review", role: "admin", dueDays: 1 },
        { name: "Sales Manager Approval", type: "approval", role: "instructor", dueDays: 2 },
      ],
    },
    {
      name: "Production Order Release",
      module: "production",
      triggerEvent: "ProductionOrderCreated",
      conditions: [{ field: "quantity", operator: "gt", value: 100 }],
      steps: [
        { name: "Material Availability Check", type: "review", role: "student", dueDays: 1 },
        { name: "Production Supervisor Approval", type: "approval", role: "instructor", dueDays: 2 },
      ],
    },
    {
      name: "Invoice 3-Way Match",
      module: "finance",
      triggerEvent: "InvoicePosted",
      conditions: [{ field: "amount", operator: "gt", value: 0 }],
      steps: [
        { name: "PO-GR-Invoice Match", type: "verification", role: "student", dueDays: 2 },
        { name: "AP Clerk Approval", type: "approval", role: "instructor", dueDays: 3 },
      ],
    },
    {
      name: "Quality Non-Conformance Escalation",
      module: "quality",
      triggerEvent: "QualityInspectionCompleted",
      conditions: [{ field: "result", operator: "eq", value: "failed" }],
      steps: [
        { name: "QM Manager Review", type: "review", role: "instructor", dueDays: 1 },
        { name: "Corrective Action", type: "action", role: "student", dueDays: 5 },
        { name: "Verification", type: "approval", role: "instructor", dueDays: 2 },
      ],
    },
  ];

  res.json(templates);
});

export default router;
