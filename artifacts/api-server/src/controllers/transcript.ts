import { Response, NextFunction } from "express";
import {
  db,
  projectsTable,
  speechRecognitionJobsTable,
  speechSegmentsTable,
  speechWordsTable,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
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

// 1. GET /api/projects/:projectId/transcript
export async function getTranscript(
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

    // Fetch the active current transcript
    const [speechJob] = await db
      .select()
      .from(speechRecognitionJobsTable)
      .where(
        and(
          eq(speechRecognitionJobsTable.projectId, projectId),
          eq(speechRecognitionJobsTable.isCurrent, true)
        )
      )
      .limit(1);

    if (!speechJob) {
      res.status(404).json({ error: "No active transcript found for this project." });
      return;
    }

    res.status(200).json({
      id: speechJob.id,
      projectId: speechJob.projectId,
      jobId: speechJob.jobId || undefined,
      transcript: speechJob.transcript,
      language: speechJob.language || undefined,
      languageConfidence: speechJob.languageConfidence || undefined,
      confidence: speechJob.confidence || undefined,
      srtKey: speechJob.srtKey || undefined,
      vttKey: speechJob.vttKey || undefined,
      jsonKey: speechJob.jsonKey || undefined,
      version: speechJob.version,
      isCurrent: speechJob.isCurrent,
      createdAt: speechJob.createdAt.toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

// 2. GET /api/projects/:projectId/transcript/segments
export async function getTranscriptSegments(
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

    // Get current speech recognition job
    const [speechJob] = await db
      .select({ id: speechRecognitionJobsTable.id })
      .from(speechRecognitionJobsTable)
      .where(
        and(
          eq(speechRecognitionJobsTable.projectId, projectId),
          eq(speechRecognitionJobsTable.isCurrent, true)
        )
      )
      .limit(1);

    if (!speechJob) {
      res.status(404).json({ error: "No active transcript found for this project." });
      return;
    }

    const segments = await db
      .select()
      .from(speechSegmentsTable)
      .where(eq(speechSegmentsTable.speechJobId, speechJob.id))
      .orderBy(speechSegmentsTable.startTime);

    const formattedSegments = segments.map((s) => ({
      id: s.id,
      speechJobId: s.speechJobId,
      text: s.text,
      startTime: s.startTime,
      endTime: s.endTime,
      confidence: s.confidence || undefined,
      speakerId: s.speakerId || undefined,
    }));

    res.status(200).json(formattedSegments);
  } catch (err) {
    next(err);
  }
}

// 3. GET /api/projects/:projectId/transcript/words
export async function getTranscriptWords(
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

    // Get current speech recognition job
    const [speechJob] = await db
      .select({ id: speechRecognitionJobsTable.id })
      .from(speechRecognitionJobsTable)
      .where(
        and(
          eq(speechRecognitionJobsTable.projectId, projectId),
          eq(speechRecognitionJobsTable.isCurrent, true)
        )
      )
      .limit(1);

    if (!speechJob) {
      res.status(404).json({ error: "No active transcript found for this project." });
      return;
    }

    const words = await db
      .select()
      .from(speechWordsTable)
      .where(eq(speechWordsTable.speechJobId, speechJob.id))
      .orderBy(speechWordsTable.startTime);

    const formattedWords = words.map((w) => ({
      id: w.id,
      speechJobId: w.speechJobId,
      segmentId: w.segmentId,
      word: w.word,
      startTime: w.startTime,
      endTime: w.endTime,
      confidence: w.confidence || undefined,
    }));

    res.status(200).json(formattedWords);
  } catch (err) {
    next(err);
  }
}

// 4. POST /api/projects/:projectId/transcript/reprocess
export async function reprocessTranscript(
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

    logger.info(`Manually triggering Speech-to-Text reprocessing for project: ${projectId}`);

    // Queue up a new speech-to-text background job
    // The prioritisation can be High for manual user trigger
    const dbJob = await enqueueJob(projectId, QUEUES.SPEECH_TO_TEXT, "HIGH");

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
