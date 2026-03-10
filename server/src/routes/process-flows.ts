import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authenticate, requireRoles } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

const router = Router();
router.use(authenticate);

// Prebuilt templates (must be before /:id)
const PREBUILT_FLOWS = [
  {
    id: "prebuilt-ptp",
    name: "Procure-to-Pay",
    processType: "procure_to_pay",
    nodes: [
      { id: "n1", type: "start", label: "Supplier", description: "External supplier", tcode: "ME21N", x: 0, y: 100 },
      { id: "n2", type: "process", label: "Purchase Requisition", description: "Create PR", tcode: "ME51N", x: 150, y: 100 },
      { id: "n3", type: "process", label: "Approval", description: "PR approval", tcode: "ME54N", x: 300, y: 100 },
      { id: "n4", type: "process", label: "Purchase Order", description: "Create PO", tcode: "ME21N", x: 450, y: 100 },
      { id: "n5", type: "process", label: "Goods Receipt", description: "GR against PO", tcode: "MIGO", x: 600, y: 100 },
      { id: "n6", type: "process", label: "Invoice", description: "Verify invoice", tcode: "MIRO", x: 750, y: 100 },
      { id: "n7", type: "end", label: "Payment", description: "Payment run", tcode: "F110", x: 900, y: 100 },
    ],
    edges: [
      { id: "e1", source: "n1", target: "n2", label: "" },
      { id: "e2", source: "n2", target: "n3", label: "" },
      { id: "e3", source: "n3", target: "n4", label: "" },
      { id: "e4", source: "n4", target: "n5", label: "" },
      { id: "e5", source: "n5", target: "n6", label: "" },
      { id: "e6", source: "n6", target: "n7", label: "" },
    ],
  },
  {
    id: "prebuilt-otc",
    name: "Order-to-Cash",
    processType: "order_to_cash",
    nodes: [
      { id: "n1", type: "start", label: "Customer", description: "Customer order", tcode: "VA01", x: 0, y: 100 },
      { id: "n2", type: "process", label: "Sales Order", description: "Create SO", tcode: "VA01", x: 150, y: 100 },
      { id: "n3", type: "process", label: "Delivery", description: "Create delivery", tcode: "VL01N", x: 300, y: 100 },
      { id: "n4", type: "process", label: "Goods Issue", description: "Pick and ship", tcode: "VL02N", x: 450, y: 100 },
      { id: "n5", type: "process", label: "Invoice", description: "Create invoice", tcode: "VF01", x: 600, y: 100 },
      { id: "n6", type: "end", label: "Payment", description: "Receive payment", tcode: "F-28", x: 750, y: 100 },
    ],
    edges: [
      { id: "e1", source: "n1", target: "n2", label: "" },
      { id: "e2", source: "n2", target: "n3", label: "" },
      { id: "e3", source: "n3", target: "n4", label: "" },
      { id: "e4", source: "n4", target: "n5", label: "" },
      { id: "e5", source: "n5", target: "n6", label: "" },
    ],
  },
  {
    id: "prebuilt-mts",
    name: "Make-to-Stock",
    processType: "production",
    nodes: [
      { id: "n1", type: "start", label: "Demand Forecast", description: "Forecast demand", tcode: "MD04", x: 0, y: 100 },
      { id: "n2", type: "process", label: "MRP Run", description: "Run MRP", tcode: "MD01", x: 150, y: 100 },
      { id: "n3", type: "process", label: "Planned Order", description: "Planned orders", tcode: "MD04", x: 300, y: 100 },
      { id: "n4", type: "process", label: "Production Order", description: "Convert to prod order", tcode: "CO41", x: 450, y: 100 },
      { id: "n5", type: "process", label: "Material Consumption", description: "Issue materials", tcode: "MIGO", x: 600, y: 100 },
      { id: "n6", type: "process", label: "Quality Check", description: "Inspection", tcode: "QE51N", x: 750, y: 100 },
      { id: "n7", type: "end", label: "Goods Receipt", description: "GR production", tcode: "MIGO", x: 900, y: 100 },
    ],
    edges: [
      { id: "e1", source: "n1", target: "n2", label: "" },
      { id: "e2", source: "n2", target: "n3", label: "" },
      { id: "e3", source: "n3", target: "n4", label: "" },
      { id: "e4", source: "n4", target: "n5", label: "" },
      { id: "e5", source: "n5", target: "n6", label: "" },
      { id: "e6", source: "n6", target: "n7", label: "" },
    ],
  },
];

// GET / - list flows, filter by processType
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const processType = req.query.processType as string | undefined;
    const where: { tenantId: string; isActive?: boolean; processType?: string } = { tenantId };
    if (processType) where.processType = processType;
    const flows = await prisma.processFlow.findMany({
      where,
      orderBy: { updatedAt: "desc" },
    });
    res.json(flows);
  } catch (err) {
    next(err);
  }
});

// GET /templates - list template flows (isTemplate=true), include global (prebuilt) templates
router.get("/templates", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const dbFlows = await prisma.processFlow.findMany({
      where: { tenantId, isTemplate: true, isActive: true },
      orderBy: { name: "asc" },
    });
    const globalTemplates = PREBUILT_FLOWS.map((f) => ({ ...f, isTemplate: true, source: "prebuilt" }));
    res.json([...globalTemplates, ...dbFlows]);
  } catch (err) {
    next(err);
  }
});

// GET /prebuilt - hardcoded templates
router.get("/prebuilt", (_req: Request, res: Response) => {
  res.json(PREBUILT_FLOWS);
});

// POST / - create flow (admin/instructor)
router.post("/", requireRoles("admin", "instructor"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const createdBy = req.user!.userId;
    const { name, description, processType, nodes, edges, isTemplate } = req.body;
    if (!name || !processType) throw new AppError(400, "name and processType required");
    const flow = await prisma.processFlow.create({
      data: {
        tenantId,
        createdBy,
        name,
        description: description ?? null,
        processType,
        nodes: JSON.stringify(nodes ?? []),
        edges: JSON.stringify(edges ?? []),
        isTemplate: isTemplate ?? false,
      },
    });
    res.status(201).json(flow);
  } catch (err) {
    next(err);
  }
});

// GET /:id - get flow detail
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const id = req.params.id;
    if (id.startsWith("prebuilt-")) {
      const prebuilt = PREBUILT_FLOWS.find((f) => f.id === id);
      if (!prebuilt) throw new AppError(404, "Prebuilt flow not found");
      return res.json(prebuilt);
    }
    const flow = await prisma.processFlow.findFirst({
      where: { id, tenantId },
    });
    if (!flow) throw new AppError(404, "Flow not found");
    res.json(flow);
  } catch (err) {
    next(err);
  }
});

// PUT /:id - update flow (admin/instructor)
router.put("/:id", requireRoles("admin", "instructor"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const id = req.params.id;
    if (id.startsWith("prebuilt-")) throw new AppError(400, "Cannot modify prebuilt flows");
    const { name, nodes, edges } = req.body;
    const flow = await prisma.processFlow.findFirst({ where: { id, tenantId } });
    if (!flow) throw new AppError(404, "Flow not found");
    const updated = await prisma.processFlow.update({
      where: { id },
      data: {
        ...(name != null && { name }),
        ...(nodes != null && { nodes: JSON.stringify(nodes) }),
        ...(edges != null && { edges: JSON.stringify(edges) }),
      },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /:id - delete (admin/instructor)
router.delete("/:id", requireRoles("admin", "instructor"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const id = req.params.id;
    if (id.startsWith("prebuilt-")) throw new AppError(400, "Cannot delete prebuilt flows");
    const flow = await prisma.processFlow.findFirst({ where: { id, tenantId } });
    if (!flow) throw new AppError(404, "Flow not found");
    await prisma.processFlow.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
