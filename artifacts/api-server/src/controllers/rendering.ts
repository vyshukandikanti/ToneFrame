import { Response, NextFunction } from "express";
import {
  db,
  projectsTable,
  renderJobsTable,
  renderedAssetsTable,
  exportJobsTable,
  exportAssetsTable,
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

// 1. GET /api/projects/:projectId/renders (List rendering jobs)
export async function listProjectRenders(
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
      .from(renderJobsTable)
      .where(eq(renderJobsTable.projectId, projectId))
      .orderBy(desc(renderJobsTable.createdAt));

    const formatted = jobs.map((j) => ({
      id: j.id,
      projectId: j.projectId,
      lipSyncJobId: j.lipSyncJobId || undefined,
      provider: j.provider,
      status: j.status,
      resolution: j.resolution,
      format: j.format,
      codec: j.codec,
      hasSubtitles: j.hasSubtitles,
      hasWatermark: j.hasWatermark,
      processingTimeMs: j.processingTimeMs || undefined,
      errorMessage: j.errorMessage || undefined,
      createdAt: j.createdAt.toISOString(),
    }));

    res.status(200).json(formatted);
  } catch (err) {
    next(err);
  }
}

// 2. POST /api/projects/:projectId/renders (Trigger rendering workflow)
export async function triggerRender(
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

    const { resolution, format, codec, hasSubtitles, hasWatermark } = req.body;
    logger.info(`Triggering render for project: ${projectId} - Res: ${resolution}, Format: ${format}`);

    // Queue Rendering job
    const dbJob = await enqueueJob(projectId, QUEUES.RENDERING, "HIGH", {
      resolution: resolution || "1080p",
      format: format || "mp4",
      codec: codec || "h264",
      hasSubtitles: !!hasSubtitles,
      hasWatermark: !!hasWatermark,
    });

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

// 3. POST /api/projects/:projectId/renders/reprocess (Re-render final video)
export async function reprocessRender(
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

    const { resolution, format, codec, hasSubtitles, hasWatermark } = req.body;
    logger.info(`Retriggering render for project: ${projectId}`);

    // Queue Rendering job with Critical priority
    const dbJob = await enqueueJob(projectId, QUEUES.RENDERING, "CRITICAL", {
      resolution: resolution || "1080p",
      format: format || "mp4",
      codec: codec || "h264",
      hasSubtitles: !!hasSubtitles,
      hasWatermark: !!hasWatermark,
    });

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

// 4. GET /api/projects/:projectId/renders/assets (Get rendered assets with signed download URLs)
export async function getRenderedAssets(
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
      .from(renderedAssetsTable)
      .where(eq(renderedAssetsTable.projectId, projectId))
      .orderBy(desc(renderedAssetsTable.createdAt));

    const formatted = await Promise.all(
      assets.map(async (a) => {
        const downloadUrl = await generatePresignedDownloadUrl(a.s3Key);
        const thumbnailUrl = a.thumbnailS3Key ? await generatePresignedDownloadUrl(a.thumbnailS3Key) : undefined;
        const previewUrl = a.previewS3Key ? await generatePresignedDownloadUrl(a.previewS3Key) : undefined;
        const waveformUrl = a.waveformS3Key ? await generatePresignedDownloadUrl(a.waveformS3Key) : undefined;

        return {
          id: a.id,
          projectId: a.projectId,
          renderJobId: a.renderJobId,
          s3Key: a.s3Key,
          format: a.format,
          resolution: a.resolution,
          fps: a.fps || undefined,
          duration: a.duration,
          fileSize: a.fileSize,
          checksum: a.checksum || undefined,
          mimeType: a.mimeType || undefined,
          thumbnailS3Key: a.thumbnailS3Key || undefined,
          thumbnailUrl,
          previewS3Key: a.previewS3Key || undefined,
          previewUrl,
          waveformS3Key: a.waveformS3Key || undefined,
          waveformUrl,
          downloadUrl,
          version: a.version,
          isCurrent: a.isCurrent,
          createdAt: a.createdAt.toISOString(),
        };
      })
    );

    res.status(200).json(formatted);
  } catch (err) {
    next(err);
  }
}

// 5. GET /api/projects/:projectId/exports (List export jobs)
export async function listProjectExports(
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
      .from(exportJobsTable)
      .where(eq(exportJobsTable.projectId, projectId))
      .orderBy(desc(exportJobsTable.createdAt));

    const formatted = jobs.map((j) => ({
      id: j.id,
      projectId: j.projectId,
      renderJobId: j.renderJobId || undefined,
      status: j.status,
      exportType: j.exportType,
      errorMessage: j.errorMessage || undefined,
      processingTimeMs: j.processingTimeMs || undefined,
      createdAt: j.createdAt.toISOString(),
    }));

    res.status(200).json(formatted);
  } catch (err) {
    next(err);
  }
}

// 6. POST /api/projects/:projectId/exports (Trigger export packaging)
export async function triggerExport(
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

    const { exportType } = req.body;
    logger.info(`Triggering export for project: ${projectId} - Type: ${exportType}`);

    // Queue Export job
    const dbJob = await enqueueJob(projectId, QUEUES.EXPORT, "HIGH", {
      exportType: exportType || "video_package",
    });

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

// 7. GET /api/projects/:projectId/exports/assets (Get packaged export assets with signed URLs)
export async function getExportAssets(
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
      .from(exportAssetsTable)
      .where(eq(exportAssetsTable.projectId, projectId))
      .orderBy(desc(exportAssetsTable.createdAt));

    const formatted = await Promise.all(
      assets.map(async (a) => {
        const downloadUrl = await generatePresignedDownloadUrl(a.s3Key);
        return {
          id: a.id,
          projectId: a.projectId,
          exportJobId: a.exportJobId,
          s3Key: a.s3Key,
          format: a.format,
          fileSize: a.fileSize,
          checksum: a.checksum || undefined,
          mimeType: a.mimeType || undefined,
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
