import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";
import { authenticate } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

const router = Router();
router.use(authenticate);

// GET /work-centers - list work centers
router.get("/work-centers", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const workCenters = await prisma.workCenter.findMany({
      where: { tenantId, isActive: true },
      orderBy: { code: "asc" },
    });
    res.json(workCenters);
  } catch (err) {
    next(err);
  }
});

// POST /work-centers - create work center
router.post("/work-centers", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { code, name, type, capacity, efficiency, costRate, status, plantId } = req.body;
    if (!code || !name || !type) throw new AppError(400, "code, name, and type are required");
    const workCenter = await prisma.workCenter.create({
      data: {
        tenantId,
        code,
        name,
        type: type || "machine",
        capacity: capacity ?? 8,
        efficiency: efficiency ?? 100,
        costRate: costRate ?? 0,
        status: status ?? "available",
        plantId: plantId || null,
      },
    });
    res.status(201).json(workCenter);
  } catch (err) {
    next(err);
  }
});

// PUT /work-centers/:id - update work center
router.put("/work-centers/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;
    const existing = await prisma.workCenter.findFirst({ where: { id, tenantId } });
    if (!existing) throw new AppError(404, "Work center not found");
    const { code, name, type, capacity, efficiency, costRate, status, plantId } = req.body;
    const workCenter = await prisma.workCenter.update({
      where: { id },
      data: {
        ...(code !== undefined && { code }),
        ...(name !== undefined && { name }),
        ...(type !== undefined && { type }),
        ...(capacity !== undefined && { capacity }),
        ...(efficiency !== undefined && { efficiency }),
        ...(costRate !== undefined && { costRate }),
        ...(status !== undefined && { status }),
        ...(plantId !== undefined && { plantId }),
      },
    });
    res.json(workCenter);
  } catch (err) {
    next(err);
  }
});

// GET /schedule - get all production schedules
router.get("/schedule", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { workCenterId, status } = req.query;
    const where: Record<string, unknown> = { tenantId };
    if (workCenterId) where.workCenterId = workCenterId as string;
    if (status) where.status = status as string;
    const schedules = await prisma.productionSchedule.findMany({
      where,
      include: { workCenter: true },
      orderBy: [{ plannedStart: "asc" }, { sequence: "asc" }],
    });
    res.json(schedules);
  } catch (err) {
    next(err);
  }
});

// POST /schedule - create schedule entry
router.post("/schedule", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { productionOrderId, workCenterId, operation, setupTime, runTime, plannedStart, plannedEnd, sequence } = req.body;
    if (!productionOrderId || !workCenterId || !operation || !plannedStart || !plannedEnd) {
      throw new AppError(400, "productionOrderId, workCenterId, operation, plannedStart, and plannedEnd are required");
    }
    const schedule = await prisma.productionSchedule.create({
      data: {
        tenantId,
        productionOrderId,
        workCenterId,
        operation,
        setupTime: setupTime ?? 0,
        runTime: runTime ?? 0,
        plannedStart: new Date(plannedStart),
        plannedEnd: new Date(plannedEnd),
        sequence: sequence ?? 0,
      },
      include: { workCenter: true },
    });
    res.status(201).json(schedule);
  } catch (err) {
    next(err);
  }
});

// PUT /schedule/:id - update schedule (status, actual times)
router.put("/schedule/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;
    const existing = await prisma.productionSchedule.findFirst({ where: { id, tenantId } });
    if (!existing) throw new AppError(404, "Schedule not found");
    const { status, actualStart, actualEnd } = req.body;
    const schedule = await prisma.productionSchedule.update({
      where: { id },
      data: {
        ...(status !== undefined && { status }),
        ...(actualStart !== undefined && { actualStart: actualStart ? new Date(actualStart) : null }),
        ...(actualEnd !== undefined && { actualEnd: actualEnd ? new Date(actualEnd) : null }),
      },
      include: { workCenter: true },
    });
    res.json(schedule);
  } catch (err) {
    next(err);
  }
});

// GET /capacity - capacity utilization per work center
router.get("/capacity", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const workCenters = await prisma.workCenter.findMany({
      where: { tenantId, isActive: true },
      include: {
        schedules: {
          where: { status: { in: ["scheduled", "in_progress"] } },
        },
      },
    });
    const utilization = workCenters.map((wc) => {
      const availableHours = wc.capacity * (wc.efficiency / 100);
      const scheduledHours = wc.schedules.reduce((sum, s) => {
        const setup = s.setupTime || 0;
        const run = s.runTime || 0;
        return sum + setup + run;
      }, 0);
      const utilizationPct = availableHours > 0 ? (scheduledHours / availableHours) * 100 : 0;
      return {
        workCenterId: wc.id,
        workCenterCode: wc.code,
        workCenterName: wc.name,
        availableHours,
        scheduledHours,
        utilizationPct: Math.round(utilizationPct * 100) / 100,
        isBottleneck: utilizationPct > 90,
      };
    });
    res.json(utilization);
  } catch (err) {
    next(err);
  }
});

// GET /gantt-data - schedule data for Gantt chart
router.get("/gantt-data", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const schedules = await prisma.productionSchedule.findMany({
      where: { tenantId },
      include: { workCenter: true },
      orderBy: [{ plannedStart: "asc" }, { sequence: "asc" }],
    });
    const statusColors: Record<string, string> = {
      scheduled: "#4CAF50",
      in_progress: "#2196F3",
      completed: "#9E9E9E",
      delayed: "#F44336",
    };
    const ganttData = schedules.map((s) => ({
      id: s.id,
      workCenter: s.workCenter.name,
      operation: s.operation,
      start: s.plannedStart,
      end: s.plannedEnd,
      status: s.status,
      color: statusColors[s.status] || "#757575",
    }));
    res.json(ganttData);
  } catch (err) {
    next(err);
  }
});

export default router;
