import { Queue } from "bullmq";
import { getRedisClient } from "./redis";
import { db, processingJobsTable, projectsTable } from "@workspace/db";
import { eq, and, or, inArray, desc } from "drizzle-orm";
import { CONFIG, QUEUES, QueueType } from "../config";
import { broadcastJobUpdate } from "./socket";
import { logger } from "../lib/logger";

const queues: Record<string, Queue> = {};

export const queueManager = {
  getQueue(queueName: string): Queue {
    if (!queues[queueName]) {
      logger.info(`Initializing BullMQ Queue: ${queueName}`);
      queues[queueName] = new Queue(queueName, {
        connection: getRedisClient(),
        defaultJobOptions: {
          removeOnComplete: 100, // keep last 100 completed jobs
          removeOnFail: 500, // keep last 500 failed jobs
        },
      });
    }
    return queues[queueName];
  }
};

export function getQueue(queueName: string): Queue {
  return queueManager.getQueue(queueName);
}

// Priority mapping: BullMQ uses positive integers where lower is higher priority (1 = highest)
export const PRIORITIES = {
  CRITICAL: 1,
  HIGH: 5,
  NORMAL: 10,
  LOW: 20,
} as const;

export type PriorityLevel = keyof typeof PRIORITIES;

export function getPriorityValue(level: PriorityLevel): number {
  return PRIORITIES[level] || PRIORITIES.NORMAL;
}

export async function enqueueJob(
  projectId: string,
  stage: QueueType,
  priorityLevel: PriorityLevel = "NORMAL",
  payload?: Record<string, any>
): Promise<any> {
  const queueConfig = CONFIG.queues[stage];
  if (!queueConfig) {
    throw new Error(`Queue configuration not found for stage: ${stage}`);
  }

  // 1. Idempotency Check: Prevent duplicate processing for active jobs
  const [existingActiveJob] = await db
    .select()
    .from(processingJobsTable)
    .where(
      and(
        eq(processingJobsTable.projectId, projectId),
        eq(processingJobsTable.stage, stage),
        inArray(processingJobsTable.status, ["queued", "preparing", "processing"])
      )
    )
    .limit(1);

  if (existingActiveJob) {
    logger.warn(`Job for project ${projectId} and stage ${stage} is already active (id: ${existingActiveJob.id}). Skipping enqueue.`);
    return existingActiveJob;
  }

  // 2. Create job record in database
  const [dbJob] = await db
    .insert(processingJobsTable)
    .values({
      projectId,
      queueName: queueConfig.name,
      stage,
      status: "queued",
      progress: 0,
      priority: getPriorityValue(priorityLevel),
      retryCount: 0,
    })
    .returning();

  // Update project status to "queued" or "preparing"
  const projectStatus = stage === QUEUES.VIDEO_PREPARATION ? "preparing" : "queued";
  await db
    .update(projectsTable)
    .set({ status: projectStatus, updatedAt: new Date() })
    .where(eq(projectsTable.id, projectId));

  // 3. Add to BullMQ Queue
  const queue = getQueue(queueConfig.name);
  await queue.add(
    stage,
    { jobId: dbJob.id, projectId, ...payload },
    {
      jobId: dbJob.id, // Sync BullMQ Job ID with DB Job ID
      priority: dbJob.priority,
      attempts: queueConfig.retryLimit,
      backoff: {
        type: "exponential",
        delay: 5000, // starting delay: 5s
      },
    }
  );

  logger.info(`Enqueued job ${dbJob.id} for stage ${stage} (Project: ${projectId})`);

  // Broadcast WebSocket update
  broadcastJobUpdate(projectId, "job:started", {
    id: dbJob.id,
    projectId: dbJob.projectId,
    stage: dbJob.stage,
    status: dbJob.status,
    progress: dbJob.progress,
    createdAt: dbJob.createdAt.toISOString(),
  });

  return dbJob;
}

export async function cancelJob(jobId: string): Promise<boolean> {
  const [job] = await db
    .select()
    .from(processingJobsTable)
    .where(eq(processingJobsTable.id, jobId))
    .limit(1);

  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  if (["completed", "failed", "cancelled"].includes(job.status)) {
    logger.warn(`Job ${jobId} is already in final state: ${job.status}. Cannot cancel.`);
    return false;
  }

  // Update status in Database
  await db
    .update(processingJobsTable)
    .set({
      status: "cancelled",
      completedAt: new Date(),
    })
    .where(eq(processingJobsTable.id, jobId));

  // Try to remove from BullMQ
  try {
    const queue = getQueue(job.queueName);
    const bullJob = await queue.getJob(jobId);
    if (bullJob) {
      const state = await bullJob.getState();
      if (state === "active") {
        // If already active, discard/cancel
        await bullJob.discard();
      }
      await bullJob.remove();
      logger.info(`Removed job ${jobId} from BullMQ queue ${job.queueName}`);
    }
  } catch (err) {
    logger.error(err, `Error removing job ${jobId} from BullMQ`);
  }

  // Update project status to "cancelled"
  await db
    .update(projectsTable)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(projectsTable.id, job.projectId));

  // Broadcast update
  broadcastJobUpdate(job.projectId, "job:cancelled", {
    id: job.id,
    projectId: job.projectId,
    stage: job.stage,
    status: "cancelled",
    progress: job.progress,
    completedAt: new Date().toISOString(),
  });

  return true;
}

export async function retryJob(jobId: string): Promise<boolean> {
  const [job] = await db
    .select()
    .from(processingJobsTable)
    .where(eq(processingJobsTable.id, jobId))
    .limit(1);

  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  if (job.status !== "failed") {
    logger.warn(`Job ${jobId} is not in failed state (current status: ${job.status}). Cannot retry.`);
    return false;
  }

  const queueConfig = CONFIG.queues[job.stage as QueueType];
  if (!queueConfig) {
    throw new Error(`Queue configuration not found for stage: ${job.stage}`);
  }

  // Reset job in database
  const [updatedJob] = await db
    .update(processingJobsTable)
    .set({
      status: "queued",
      progress: 0,
      errorMessage: null,
      startedAt: null,
      completedAt: null,
      retryCount: job.retryCount + 1,
    })
    .where(eq(processingJobsTable.id, jobId))
    .returning();

  // Update project status
  await db
    .update(projectsTable)
    .set({ status: "queued", updatedAt: new Date() })
    .where(eq(projectsTable.id, job.projectId));

  // Re-enqueue in BullMQ
  const queue = getQueue(job.queueName);
  await queue.add(
    job.stage,
    { jobId: job.id, projectId: job.projectId },
    {
      jobId: job.id,
      priority: job.priority,
      attempts: queueConfig.retryLimit,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
    }
  );

  logger.info(`Initiated retry for job ${job.id} (stage: ${job.stage}). Retry count: ${updatedJob.retryCount}`);

  // Broadcast WebSocket update
  broadcastJobUpdate(job.projectId, "job:started", {
    id: updatedJob.id,
    projectId: updatedJob.projectId,
    stage: updatedJob.stage,
    status: updatedJob.status,
    progress: updatedJob.progress,
  });

  return true;
}

export async function updateProgress(jobId: string, progress: number): Promise<void> {
  const [job] = await db
    .update(processingJobsTable)
    .set({ progress })
    .where(eq(processingJobsTable.id, jobId))
    .returning();

  if (job) {
    broadcastJobUpdate(job.projectId, "job:progress", {
      id: job.id,
      projectId: job.projectId,
      stage: job.stage,
      progress,
    });
  }
}

export async function completeJob(jobId: string, workerId?: string): Promise<void> {
  const now = new Date();
  const [job] = await db
    .update(processingJobsTable)
    .set({
      status: "completed",
      progress: 100,
      completedAt: now,
      workerId: workerId || null,
    })
    .where(eq(processingJobsTable.id, jobId))
    .returning();

  if (job) {
    // If it's the final stage (e.g. export), mark project as completed
    const isFinalStage = job.stage === QUEUES.EXPORT;
    const projectStatus = isFinalStage ? "completed" : "processing";

    await db
      .update(projectsTable)
      .set({ status: projectStatus, updatedAt: now })
      .where(eq(projectsTable.id, job.projectId));

    broadcastJobUpdate(job.projectId, "job:completed", {
      id: job.id,
      projectId: job.projectId,
      stage: job.stage,
      status: "completed",
      progress: 100,
      completedAt: now.toISOString(),
    });
  }
}

export async function failJob(jobId: string, errorMessage: string, workerId?: string): Promise<void> {
  const now = new Date();
  const [job] = await db
    .update(processingJobsTable)
    .set({
      status: "failed",
      errorMessage,
      completedAt: now,
      workerId: workerId || null,
    })
    .where(eq(processingJobsTable.id, jobId))
    .returning();

  if (job) {
    await db
      .update(projectsTable)
      .set({ status: "failed", updatedAt: now })
      .where(eq(projectsTable.id, job.projectId));

    broadcastJobUpdate(job.projectId, "job:failed", {
      id: job.id,
      projectId: job.projectId,
      stage: job.stage,
      status: "failed",
      progress: job.progress,
      errorMessage,
      completedAt: now.toISOString(),
    });
  }
}
