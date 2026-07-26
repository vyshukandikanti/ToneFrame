import { Response, NextFunction } from "express";
import {
  db,
  projectsTable,
  voiceGenerationJobsTable,
  voiceAssetsTable,
  voiceProfilesTable,
  speakersTable,
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

// 1. GET /api/projects/:projectId/voices (List active voice generation jobs)
export async function listProjectVoices(
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
      .from(voiceGenerationJobsTable)
      .where(eq(voiceGenerationJobsTable.projectId, projectId))
      .orderBy(desc(voiceGenerationJobsTable.createdAt));

    const formatted = jobs.map((j) => ({
      id: j.id,
      projectId: j.projectId,
      translationJobId: j.translationJobId,
      emotionJobId: j.emotionJobId || undefined,
      provider: j.provider,
      modelVersion: j.modelVersion || undefined,
      isCurrent: j.isCurrent,
      processingTimeMs: j.processingTimeMs || undefined,
      createdAt: j.createdAt.toISOString(),
    }));

    res.status(200).json(formatted);
  } catch (err) {
    next(err);
  }
}

// 2. POST /api/projects/:projectId/voices/generate (Trigger voice cloning/generation job)
export async function generateVoices(
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

    logger.info(`Triggering voice generation for project: ${projectId}`);

    // Queue Voice Cloning job
    const dbJob = await enqueueJob(projectId, QUEUES.VOICE_CLONING, "HIGH");

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

// 3. PATCH /api/projects/:projectId/voices/:voiceProfileId (Update voice profile details)
export async function updateVoiceProfile(
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
    const voiceProfileId = req.params.voiceProfileId as string;

    const isOwner = await checkProjectOwnership(projectId, req.user.id);
    if (!isOwner) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const [existing] = await db
      .select()
      .from(voiceProfilesTable)
      .innerJoin(speakersTable, eq(voiceProfilesTable.speakerId, speakersTable.id))
      .where(and(eq(voiceProfilesTable.id, voiceProfileId), eq(speakersTable.projectId, projectId)))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Voice profile not found" });
      return;
    }

    const { provider, voiceName, model, language, emotionPreset, speed, pitch, sampleRate } = req.body;

    const [updated] = await db
      .update(voiceProfilesTable)
      .set({
        provider: provider !== undefined ? provider : existing.voice_profiles.provider,
        voiceName: voiceName !== undefined ? voiceName : existing.voice_profiles.voiceName,
        model: model !== undefined ? model : existing.voice_profiles.model,
        language: language !== undefined ? language : existing.voice_profiles.language,
        emotionPreset: emotionPreset !== undefined ? emotionPreset : existing.voice_profiles.emotionPreset,
        speed: speed !== undefined ? speed : existing.voice_profiles.speed,
        pitch: pitch !== undefined ? pitch : existing.voice_profiles.pitch,
        sampleRate: sampleRate !== undefined ? sampleRate : existing.voice_profiles.sampleRate,
        updatedAt: new Date(),
      })
      .where(eq(voiceProfilesTable.id, voiceProfileId))
      .returning();

    res.status(200).json({
      id: updated.id,
      speakerId: updated.speakerId,
      provider: updated.provider,
      voiceName: updated.voiceName,
      model: updated.model || undefined,
      language: updated.language || undefined,
      emotionPreset: updated.emotionPreset || undefined,
      speed: updated.speed || undefined,
      pitch: updated.pitch || undefined,
      sampleRate: updated.sampleRate || undefined,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

// 4. GET /api/projects/:projectId/voices/assets (Retrieve generated voice assets with signed URLs)
export async function getVoiceAssets(
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
      .from(voiceAssetsTable)
      .where(eq(voiceAssetsTable.projectId, projectId))
      .orderBy(desc(voiceAssetsTable.createdAt));

    const formatted = await Promise.all(
      assets.map(async (a) => {
        const downloadUrl = await generatePresignedDownloadUrl(a.s3Key);
        return {
          id: a.id,
          projectId: a.projectId,
          voiceJobId: a.voiceJobId,
          s3Key: a.s3Key,
          format: a.format,
          duration: a.duration,
          sampleRate: a.sampleRate,
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
