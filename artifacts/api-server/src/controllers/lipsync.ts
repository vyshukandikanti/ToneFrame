import { Response, NextFunction } from "express";
import {
  db,
  projectsTable,
  lipSyncJobsTable,
  lipSyncAssetsTable,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { AuthenticatedRequest } from "../middlewares/auth";
import { enqueueJob } from "../services/jobs";
import { generatePresignedDownloadUrl } from "../services/s3";
import { QUEUES } from "../config";
import { logger } from "../lib/logger";

// Helper to check project ownership
async function checkProjectOwnership(projectId: string, userId: string): Promise<boolean> {
  const [project] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, userId)))
    .limit(1);
  return !!project;
}

// 1. GET /api/projects/:projectId/lipsync (List active lip sync jobs)
export async function getProjectLipSync(
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
    const isOwner = await checkProjectOwnership(projectId, req.user.id);
    if (!isOwner) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const jobs = await db
      .select()
      .from(lipSyncJobsTable)
      .where(eq(lipSyncJobsTable.projectId, projectId))
      .orderBy(desc(lipSyncJobsTable.createdAt));

    const formatted = jobs.map((j) => ({
      id: j.id,
      projectId: j.projectId,
      voiceGenerationJobId: j.voiceGenerationJobId,
      speakerJobId: j.speakerJobId,
      provider: j.provider,
      modelVersion: j.modelVersion || undefined,
      status: j.status,
      processingTimeMs: j.processingTimeMs || undefined,
      confidence: j.confidence || undefined,
      createdAt: j.createdAt.toISOString(),
    }));

    res.status(200).json(formatted);
  } catch (err) {
    next(err);
  }
}

// 2. POST /api/projects/:projectId/lipsync/generate (Trigger lip sync generation)
export async function generateLipSync(
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
    const isOwner = await checkProjectOwnership(projectId, req.user.id);
    if (!isOwner) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    logger.info(`Triggering Lip Sync generation for project: ${projectId}`);

    // Queue Lip Sync job
    const dbJob = await enqueueJob(projectId, QUEUES.LIP_SYNC, "HIGH");

    res.status(201).json({
      id: dbJob.id,
      projectId: dbJob.projectId,
      stage: dbJob.stage,
      status: dbJob.status,
      progress: dbJob.progress,
      priority: dbJob.priority,
      retryCount: dbJob.retryCount,
      createdAt: dbJob.createdAt.toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

// 3. GET /api/projects/:projectId/lipsync/assets (Retrieve generated video assets with signed URLs)
export async function getLipSyncAssets(
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
    const isOwner = await checkProjectOwnership(projectId, req.user.id);
    if (!isOwner) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const assets = await db
      .select()
      .from(lipSyncAssetsTable)
      .where(eq(lipSyncAssetsTable.projectId, projectId))
      .orderBy(desc(lipSyncAssetsTable.createdAt));

    const formatted = await Promise.all(
      assets.map(async (a) => {
        const downloadUrl = await generatePresignedDownloadUrl(a.s3Key);
        return {
          id: a.id,
          projectId: a.projectId,
          jobId: a.jobId,
          format: a.format,
          resolution: a.resolution || undefined,
          fps: a.fps || undefined,
          duration: a.duration,
          fileSize: a.fileSize,
          checksum: a.checksum || undefined,
          mimeType: a.mimeType || undefined,
          s3Key: a.s3Key,
          downloadUrl,
          createdAt: a.createdAt.toISOString(),
        };
      })
    );

    res.status(200).json(formatted);
  } catch (err) {
    next(err);
  }
}

// 4. POST /api/projects/:projectId/lipsync/reprocess (Retrigger lip sync processing)
export async function reprocessLipSync(
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
    const isOwner = await checkProjectOwnership(projectId, req.user.id);
    if (!isOwner) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    logger.info(`Retriggering Lip Sync generation for project: ${projectId}`);

    // Queue Lip Sync job with Critical priority
    const dbJob = await enqueueJob(projectId, QUEUES.LIP_SYNC, "CRITICAL");

    res.status(200).json({
      id: dbJob.id,
      projectId: dbJob.projectId,
      stage: dbJob.stage,
      status: dbJob.status,
      progress: dbJob.progress,
      priority: dbJob.priority,
      retryCount: dbJob.retryCount,
      createdAt: dbJob.createdAt.toISOString(),
    });
  } catch (err) {
    next(err);
  }
}
