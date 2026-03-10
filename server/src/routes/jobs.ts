import { Router, Request, Response, NextFunction } from "express";
import { authenticate } from "../middleware/auth";
import { getJobStatus } from "../services/jobQueue";
import { prisma } from "../prisma";

const router = Router();
router.use(authenticate);

router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const status = await getJobStatus(req.params.id, tenantId);
    if (!status) return res.status(404).json({ error: { message: "Job not found" } });
    res.json(status);
  } catch (err) {
    next(err);
  }
});

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const status = req.query.status as string | undefined;
    const type = req.query.type as string | undefined;
    const limit = Math.min(50, parseInt(req.query.limit as string) || 20);

    const where: any = { tenantId };
    if (status) where.status = status;
    if (type) where.type = type;

    const jobs = await prisma.backgroundJob.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    res.json(jobs.map((j) => ({
      id: j.id,
      type: j.type,
      status: j.status,
      progress: j.progress,
      error: j.error,
      createdAt: j.createdAt,
      startedAt: j.startedAt,
      completedAt: j.completedAt,
    })));
  } catch (err) {
    next(err);
  }
});

export default router;
