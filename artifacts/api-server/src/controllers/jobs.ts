import { Response, NextFunction } from "express";
import { db, processingJobsTable, projectsTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { AuthenticatedRequest } from "../middlewares/auth";
import { cancelJob, retryJob, getQueue } from "../services/jobs";
import { checkRedisHealth } from "../services/redis";
import { QUEUES } from "../config";
import { logger } from "../lib/logger";

// 1. List Jobs
export async function listJobs(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const jobs = await db
      .select({
        id: processingJobsTable.id,
        projectId: processingJobsTable.projectId,
        projectName: projectsTable.name,
        stage: processingJobsTable.stage,
        status: processingJobsTable.status,
        progress: processingJobsTable.progress,
        retryCount: processingJobsTable.retryCount,
        errorMessage: processingJobsTable.errorMessage,
        createdAt: processingJobsTable.createdAt,
        startedAt: processingJobsTable.startedAt,
        completedAt: processingJobsTable.completedAt,
      })
      .from(processingJobsTable)
      .innerJoin(projectsTable, eq(processingJobsTable.projectId, projectsTable.id))
      .where(eq(projectsTable.userId, req.user.id))
      .orderBy(desc(processingJobsTable.createdAt));

    const formattedJobs = jobs.map((j) => ({
      id: j.id,
      projectId: j.projectId,
      projectName: j.projectName,
      stage: j.stage,
      status: j.status,
      progress: j.progress,
      retryCount: j.retryCount,
      errorMessage: j.errorMessage || undefined,
      createdAt: j.createdAt.toISOString(),
      startedAt: j.startedAt?.toISOString() || undefined,
      completedAt: j.completedAt?.toISOString() || undefined,
    }));

    res.status(200).json(formattedJobs);
  } catch (err) {
    next(err);
  }
}

// 2. Get Job Details
export async function getJob(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const jobId = req.params.jobId as string;

    const [job] = await db
      .select({
        id: processingJobsTable.id,
        projectId: processingJobsTable.projectId,
        projectName: projectsTable.name,
        userId: projectsTable.userId,
        stage: processingJobsTable.stage,
        status: processingJobsTable.status,
        progress: processingJobsTable.progress,
        priority: processingJobsTable.priority,
        retryCount: processingJobsTable.retryCount,
        workerId: processingJobsTable.workerId,
        errorMessage: processingJobsTable.errorMessage,
        createdAt: processingJobsTable.createdAt,
        startedAt: processingJobsTable.startedAt,
        completedAt: processingJobsTable.completedAt,
      })
      .from(processingJobsTable)
      .innerJoin(projectsTable, eq(processingJobsTable.projectId, projectsTable.id))
      .where(and(eq(processingJobsTable.id, jobId), eq(projectsTable.userId, req.user.id)))
      .limit(1);

    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }

    res.status(200).json({
      id: job.id,
      projectId: job.projectId,
      projectName: job.projectName,
      stage: job.stage,
      status: job.status,
      progress: job.progress,
      priority: job.priority,
      retryCount: job.retryCount,
      workerId: job.workerId || undefined,
      errorMessage: job.errorMessage || undefined,
      createdAt: job.createdAt.toISOString(),
      startedAt: job.startedAt?.toISOString() || undefined,
      completedAt: job.completedAt?.toISOString() || undefined,
    });
  } catch (err) {
    next(err);
  }
}

// 3. Get Project Jobs
export async function getProjectJobs(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const projectId = req.params.projectId as string;

    // Verify project ownership
    const [project] = await db
      .select()
      .from(projectsTable)
      .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, req.user.id)))
      .limit(1);

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const jobs = await db
      .select()
      .from(processingJobsTable)
      .where(eq(processingJobsTable.projectId, projectId))
      .orderBy(desc(processingJobsTable.createdAt));

    const formattedJobs = jobs.map((j) => ({
      id: j.id,
      projectId: j.projectId,
      stage: j.stage,
      status: j.status,
      progress: j.progress,
      priority: j.priority,
      retryCount: j.retryCount,
      errorMessage: j.errorMessage || undefined,
      createdAt: j.createdAt.toISOString(),
      startedAt: j.startedAt?.toISOString() || undefined,
      completedAt: j.completedAt?.toISOString() || undefined,
    }));

    res.status(200).json(formattedJobs);
  } catch (err) {
    next(err);
  }
}

// 4. Cancel Job
export async function cancelJobHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const jobId = req.params.jobId as string;

    // Verify job belongs to user's project
    const [job] = await db
      .select({ id: processingJobsTable.id })
      .from(processingJobsTable)
      .innerJoin(projectsTable, eq(processingJobsTable.projectId, projectsTable.id))
      .where(and(eq(processingJobsTable.id, jobId), eq(projectsTable.userId, req.user.id)))
      .limit(1);

    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }

    const success = await cancelJob(jobId);
    res.status(200).json({ success });
  } catch (err) {
    next(err);
  }
}

// 5. Retry Job
export async function retryJobHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const jobId = req.params.jobId as string;

    // Verify ownership
    const [job] = await db
      .select({ id: processingJobsTable.id })
      .from(processingJobsTable)
      .innerJoin(projectsTable, eq(processingJobsTable.projectId, projectsTable.id))
      .where(and(eq(processingJobsTable.id, jobId), eq(projectsTable.userId, req.user.id)))
      .limit(1);

    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }

    const success = await retryJob(jobId);
    res.status(200).json({ success });
  } catch (err) {
    next(err);
  }
}

// 6. Monitoring & Health Stats
export async function getRedisHealth(req: AuthenticatedRequest, res: Response): Promise<void> {
  const health = await checkRedisHealth();
  res.status(health.status === "healthy" ? 200 : 503).json(health);
}

export async function getQueueMetrics(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const queueNames = Object.values(QUEUES);
    const metrics: Record<string, any> = {};

    for (const name of queueNames) {
      const q = getQueue(name);
      const counts = await q.getJobCounts();
      metrics[name] = {
        waiting: counts.waiting,
        active: counts.active,
        completed: counts.completed,
        failed: counts.failed,
      };
    }

    // Aggregate DB metrics
    const [dbStats] = await db
      .select({
        totalJobs: sql<number>`count(${processingJobsTable.id})::int`,
        completedJobs: sql<number>`count(case when ${processingJobsTable.status} = 'completed' then 1 end)::int`,
        failedJobs: sql<number>`count(case when ${processingJobsTable.status} = 'failed' then 1 end)::int`,
        totalRetries: sql<number>`sum(${processingJobsTable.retryCount})::int`,
        avgDurationSec: sql<number>`coalesce(avg(extract(epoch from (${processingJobsTable.completedAt} - ${processingJobsTable.startedAt}))), 0)::float`,
      })
      .from(processingJobsTable);

    res.status(200).json({
      queues: metrics,
      dbMetrics: {
        totalJobs: dbStats.totalJobs || 0,
        completedJobs: dbStats.completedJobs || 0,
        failedJobs: dbStats.failedJobs || 0,
        totalRetries: dbStats.totalRetries || 0,
        avgDurationSec: Math.round(dbStats.avgDurationSec || 0),
        successRate: dbStats.totalJobs ? ((dbStats.completedJobs / dbStats.totalJobs) * 100).toFixed(1) + "%" : "0%",
      },
    });
  } catch (err) {
    next(err);
  }
}
