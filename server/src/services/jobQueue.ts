import { prisma } from "../prisma";
import { logger } from "../middleware/logger";

type JobHandler = (payload: any, tenantId: string, userId: string) => Promise<any>;

const handlers: Record<string, JobHandler> = {};

export function registerJobHandler(type: string, handler: JobHandler) {
  handlers[type] = handler;
}

export async function enqueueJob(
  tenantId: string,
  userId: string,
  type: string,
  payload: any
): Promise<string> {
  const job = await prisma.backgroundJob.create({
    data: {
      tenantId,
      type,
      status: "queued",
      payload: JSON.stringify(payload),
      createdBy: userId,
    },
  });

  // Process in-process for now; with Redis/BullMQ this becomes a queue dispatch
  setImmediate(() => processJob(job.id));

  return job.id;
}

async function processJob(jobId: string) {
  const job = await prisma.backgroundJob.findUnique({ where: { id: jobId } });
  if (!job || job.status !== "queued") return;

  const handler = handlers[job.type];
  if (!handler) {
    await prisma.backgroundJob.update({
      where: { id: jobId },
      data: { status: "failed", error: `No handler registered for job type: ${job.type}` },
    });
    return;
  }

  await prisma.backgroundJob.update({
    where: { id: jobId },
    data: { status: "processing", startedAt: new Date() },
  });

  try {
    const payload = JSON.parse(job.payload);
    const result = await handler(payload, job.tenantId, job.createdBy);

    await prisma.backgroundJob.update({
      where: { id: jobId },
      data: {
        status: "completed",
        result: JSON.stringify(result),
        progress: 100,
        completedAt: new Date(),
      },
    });

    logger.info(`Job ${jobId} (${job.type}) completed successfully`);
  } catch (err: any) {
    await prisma.backgroundJob.update({
      where: { id: jobId },
      data: {
        status: "failed",
        error: err.message || String(err),
        completedAt: new Date(),
      },
    });

    logger.error(`Job ${jobId} (${job.type}) failed: ${err.message}`);
  }
}

export async function getJobStatus(jobId: string, tenantId: string) {
  const job = await prisma.backgroundJob.findUnique({ where: { id: jobId } });
  if (!job || job.tenantId !== tenantId) return null;
  return {
    id: job.id,
    type: job.type,
    status: job.status,
    progress: job.progress,
    result: job.result ? JSON.parse(job.result) : null,
    error: job.error,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
  };
}
