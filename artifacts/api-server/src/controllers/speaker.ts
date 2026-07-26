import { Response, NextFunction } from "express";
import {
  db,
  projectsTable,
  speakersTable,
  speakerJobsTable,
  speakerSegmentsTable,
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

// 1. GET /api/projects/:projectId/speakers (List all detected speakers)
export async function getProjectSpeakers(
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

    const speakers = await db
      .select()
      .from(speakersTable)
      .innerJoin(speakerJobsTable, eq(speakersTable.speakerJobId, speakerJobsTable.id))
      .where(and(eq(speakersTable.projectId, projectId), eq(speakerJobsTable.isCurrent, true)))
      .orderBy(speakersTable.speakerLabel);

    const formatted = speakers.map(({ speakers: s }) => ({
      id: s.id,
      projectId: s.projectId,
      speakerJobId: s.speakerJobId,
      speakerLabel: s.speakerLabel,
      displayName: s.displayName,
      gender: s.gender || undefined,
      estimatedAge: s.estimatedAge || undefined,
      dominantLanguage: s.dominantLanguage || undefined,
      voiceProfileId: s.voiceProfileId || undefined,
      sampleAudioPath: s.sampleAudioPath || undefined,
      faceId: s.faceId || undefined,
      avatarThumbnail: s.avatarThumbnail || undefined,
      notes: s.notes || undefined,
      createdByUser: s.createdByUser,
      isLocked: s.isLocked,
      totalSpeakingTime: s.totalSpeakingTime,
      numberOfSegments: s.numberOfSegments,
      averageConfidence: s.averageConfidence,
      firstAppearance: s.firstAppearance,
      lastAppearance: s.lastAppearance,
      createdAt: s.createdAt.toISOString(),
    }));

    res.status(200).json(formatted);
  } catch (err) {
    next(err);
  }
}

// 2. GET /api/projects/:projectId/speakers/timeline (Get speakers segment timeline logs)
export async function getSpeakerTimeline(
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

    // Fetch active speaker job details
    const [speakerJob] = await db
      .select({ id: speakerJobsTable.id })
      .from(speakerJobsTable)
      .where(and(eq(speakerJobsTable.projectId, projectId), eq(speakerJobsTable.isCurrent, true)))
      .limit(1);

    if (!speakerJob) {
      res.status(404).json({ error: "No active speaker diarization found for this project." });
      return;
    }

    const segments = await db
      .select()
      .from(speakerSegmentsTable)
      .where(eq(speakerSegmentsTable.speakerJobId, speakerJob.id))
      .orderBy(speakerSegmentsTable.startTime);

    const formatted = segments.map((s) => ({
      id: s.id,
      speakerJobId: s.speakerJobId,
      speakerId: s.speakerId,
      startTime: s.startTime,
      endTime: s.endTime,
      confidence: s.confidence,
      createdAt: s.createdAt.toISOString(),
    }));

    res.status(200).json(formatted);
  } catch (err) {
    next(err);
  }
}

// 3. PATCH /api/projects/:projectId/speakers/:speakerId (Update speaker metadata traits)
export async function updateSpeaker(
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
    const speakerId = req.params.speakerId as string;

    const isOwner = await checkProjectOwnership(projectId, req.user.id);
    if (!isOwner) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const [existing] = await db
      .select()
      .from(speakersTable)
      .where(and(eq(speakersTable.id, speakerId), eq(speakersTable.projectId, projectId)))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Speaker not found" });
      return;
    }

    const { displayName, gender, estimatedAge, dominantLanguage, notes, voiceProfileId } = req.body;

    const [updated] = await db
      .update(speakersTable)
      .set({
        displayName: displayName !== undefined ? displayName : existing.displayName,
        gender: gender !== undefined ? gender : existing.gender,
        estimatedAge: estimatedAge !== undefined ? estimatedAge : existing.estimatedAge,
        dominantLanguage: dominantLanguage !== undefined ? dominantLanguage : existing.dominantLanguage,
        notes: notes !== undefined ? notes : existing.notes,
        voiceProfileId: voiceProfileId !== undefined ? voiceProfileId : existing.voiceProfileId,
      })
      .where(eq(speakersTable.id, speakerId))
      .returning();

    res.status(200).json({
      id: updated.id,
      projectId: updated.projectId,
      speakerJobId: updated.speakerJobId,
      speakerLabel: updated.speakerLabel,
      displayName: updated.displayName,
      gender: updated.gender || undefined,
      estimatedAge: updated.estimatedAge || undefined,
      dominantLanguage: updated.dominantLanguage || undefined,
      voiceProfileId: updated.voiceProfileId || undefined,
      sampleAudioPath: updated.sampleAudioPath || undefined,
      faceId: updated.faceId || undefined,
      avatarThumbnail: updated.avatarThumbnail || undefined,
      notes: updated.notes || undefined,
      createdByUser: updated.createdByUser,
      isLocked: updated.isLocked,
      totalSpeakingTime: updated.totalSpeakingTime,
      numberOfSegments: updated.numberOfSegments,
      averageConfidence: updated.averageConfidence,
      firstAppearance: updated.firstAppearance,
      lastAppearance: updated.lastAppearance,
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

// 4. POST /api/projects/:projectId/speakers/reprocess (Trigger speaker diarization)
export async function reprocessSpeakerJob(
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

    logger.info(`Manually triggering Speaker Diarization reprocessing for project: ${projectId}`);

    // Queue speaker-diarization job with High priority
    const dbJob = await enqueueJob(projectId, QUEUES.SPEAKER_DIARIZATION, "HIGH");

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
