import { Response, NextFunction } from "express";
import {
  db,
  projectsTable,
  speechRecognitionJobsTable,
  emotionJobsTable,
  emotionSegmentsTable,
} from "@workspace/db";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { AuthenticatedRequest } from "../middlewares/auth";
import { enqueueJob } from "../services/jobs";
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

// 1. GET /api/projects/:projectId/emotions (Get summary of active emotion job)
export async function getProjectEmotions(
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

    const [emotionJob] = await db
      .select()
      .from(emotionJobsTable)
      .where(
        and(
          eq(emotionJobsTable.projectId, projectId),
          eq(emotionJobsTable.isCurrent, true)
        )
      )
      .limit(1);

    if (!emotionJob) {
      res.status(404).json({ error: "No active emotion analysis found for this project." });
      return;
    }

    res.status(200).json({
      id: emotionJob.id,
      projectId: emotionJob.projectId,
      speechJobId: emotionJob.speechJobId,
      translationJobId: emotionJob.translationJobId || undefined,
      provider: emotionJob.provider,
      version: emotionJob.version,
      isCurrent: emotionJob.isCurrent,
      avgConfidence: emotionJob.avgConfidence || undefined,
      modelVersion: emotionJob.modelVersion || undefined,
      processingTimeMs: emotionJob.processingTimeMs || undefined,
      createdAt: emotionJob.createdAt.toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

// 2. GET /api/projects/:projectId/emotions/timeline (Get segment-level logs with query bounds)
export async function getEmotionTimeline(
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

    const startQuery = req.query.start ? parseFloat(req.query.start as string) : undefined;
    const endQuery = req.query.end ? parseFloat(req.query.end as string) : undefined;

    // Get active current emotion job
    const [emotionJob] = await db
      .select({ id: emotionJobsTable.id })
      .from(emotionJobsTable)
      .where(
        and(
          eq(emotionJobsTable.projectId, projectId),
          eq(emotionJobsTable.isCurrent, true)
        )
      )
      .limit(1);

    if (!emotionJob) {
      res.status(404).json({ error: "No active emotion analysis found for this project." });
      return;
    }

    // Build timeline query clauses
    const clauses = [eq(emotionSegmentsTable.emotionJobId, emotionJob.id)];
    if (startQuery !== undefined && !isNaN(startQuery)) {
      clauses.push(gte(emotionSegmentsTable.startTime, startQuery));
    }
    if (endQuery !== undefined && !isNaN(endQuery)) {
      clauses.push(lte(emotionSegmentsTable.endTime, endQuery));
    }

    const segments = await db
      .select()
      .from(emotionSegmentsTable)
      .where(and(...clauses))
      .orderBy(emotionSegmentsTable.startTime);

    const formatted = segments.map((s) => ({
      id: s.id,
      emotionJobId: s.emotionJobId,
      segmentId: s.segmentId,
      textEmotion: s.textEmotion,
      audioEmotion: s.audioEmotion,
      finalEmotion: s.finalEmotion,
      confidence: s.confidence,
      intensity: s.intensity,
      startTime: s.startTime,
      endTime: s.endTime,
      speakerId: s.speakerId || undefined,
      createdAt: s.createdAt.toISOString(),
    }));

    res.status(200).json(formatted);
  } catch (err) {
    next(err);
  }
}

// 3. POST /api/projects/:projectId/emotions/reprocess (Trigger pipeline)
export async function reprocessEmotionJob(
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

    logger.info(`Manually triggering Emotion Detection reprocessing for project: ${projectId}`);

    // Queue emotion-detection job with High priority
    const dbJob = await enqueueJob(projectId, QUEUES.EMOTION_DETECTION, "HIGH");

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
