import { Response, NextFunction } from "express";
import {
  db,
  projectsTable,
  speechRecognitionJobsTable,
  translationJobsTable,
  translatedSegmentsTable,
  translatedWordsTable,
  projectGlossariesTable,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { AuthenticatedRequest } from "../middlewares/auth";
import { enqueueJob } from "../services/jobs";
import { QUEUES } from "../config";
import { SUPPORTED_LANGUAGES } from "../services/translation";
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

// 1. GET /api/projects/:projectId/translations (List project translations)
export async function listTranslations(
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

    const translations = await db
      .select()
      .from(translationJobsTable)
      .where(eq(translationJobsTable.projectId, projectId))
      .orderBy(desc(translationJobsTable.createdAt));

    const formatted = translations.map((t) => ({
      id: t.id,
      projectId: t.projectId,
      speechJobId: t.speechJobId,
      sourceLanguage: t.sourceLanguage,
      targetLanguage: t.targetLanguage,
      translatedText: t.translatedText,
      confidence: t.confidence || undefined,
      provider: t.provider,
      version: t.version,
      isCurrent: t.isCurrent,
      processingTimeMs: t.processingTimeMs || undefined,
      tokenUsage: t.tokenUsage || undefined,
      retryCount: t.retryCount,
      createdAt: t.createdAt.toISOString(),
    }));

    res.status(200).json(formatted);
  } catch (err) {
    next(err);
  }
}

// 2. GET /api/projects/:projectId/translations/:language (Get details of specific translation)
export async function getTranslationByLanguage(
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
    const language = req.params.language as string;

    const isOwner = await checkProjectOwnership(projectId, req.user.id);
    if (!isOwner) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    // Fetch active current translation for target language
    const [translation] = await db
      .select()
      .from(translationJobsTable)
      .where(
        and(
          eq(translationJobsTable.projectId, projectId),
          eq(translationJobsTable.targetLanguage, language),
          eq(translationJobsTable.isCurrent, true)
        )
      )
      .limit(1);

    if (!translation) {
      res.status(404).json({ error: `Translation not found for language: ${language}` });
      return;
    }

    const segments = await db
      .select()
      .from(translatedSegmentsTable)
      .where(eq(translatedSegmentsTable.translationJobId, translation.id))
      .orderBy(translatedSegmentsTable.startTime);

    const formattedSegments = segments.map((s) => ({
      id: s.id,
      translationJobId: s.translationJobId,
      originalSegmentId: s.originalSegmentId,
      text: s.text,
      startTime: s.startTime,
      endTime: s.endTime,
      confidence: s.confidence || undefined,
      reviewStatus: s.reviewStatus,
      reviewerId: s.reviewerId || undefined,
      reviewedAt: s.reviewedAt?.toISOString() || undefined,
      createdAt: s.createdAt.toISOString(),
    }));

    res.status(200).json({
      id: translation.id,
      projectId: translation.projectId,
      speechJobId: translation.speechJobId,
      sourceLanguage: translation.sourceLanguage,
      targetLanguage: translation.targetLanguage,
      translatedText: translation.translatedText,
      confidence: translation.confidence || undefined,
      provider: translation.provider,
      version: translation.version,
      isCurrent: translation.isCurrent,
      processingTimeMs: translation.processingTimeMs || undefined,
      tokenUsage: translation.tokenUsage || undefined,
      retryCount: translation.retryCount,
      createdAt: translation.createdAt.toISOString(),
      segments: formattedSegments,
    });
  } catch (err) {
    next(err);
  }
}

// 3. POST /api/projects/:projectId/translations (Create/trigger translation job)
export async function createTranslationJob(
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
    const { targetLanguage } = req.body;

    const isOwner = await checkProjectOwnership(projectId, req.user.id);
    if (!isOwner) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    // 1. Language validation
    if (!targetLanguage || typeof targetLanguage !== "string") {
      res.status(400).json({ error: "targetLanguage parameter is required and must be a string." });
      return;
    }

    const normalizedTarget = targetLanguage.toLowerCase().trim();
    if (!SUPPORTED_LANGUAGES.includes(normalizedTarget)) {
      res.status(400).json({
        error: `Unsupported target language: "${targetLanguage}". Supported: ${SUPPORTED_LANGUAGES.join(", ")}`,
      });
      return;
    }

    // Check if active transcript exists to translate from
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
      res.status(400).json({ error: "Project has no active transcript. Reprocess speech-to-text first." });
      return;
    }

    logger.info(`Triggering translation for project: ${projectId} to target: ${normalizedTarget}`);

    // Queue up the translation job
    // We pass targetLanguage inside the job options or retrieve it during job fetch (we will read it from the worker's processing block)
    // Wait! How does the worker know what the target language is?
    // We can store targetLanguage metadata on the processing_job table or pass it inside the BullMQ job data payload!
    // Yes! EnqueueJob enqueues the job in BullMQ and saves the job metadata in DB. If we want to pass targetLanguage payload, we can extend enqueueJob or read from the queue parameters!
    // Let's see: in `jobs.ts`, we wrote `enqueueJob(projectId, stage, priority)`. Let's extend it or pass it.
    // Wait, let's look at `enqueueJob` definition in `src/services/jobs.ts`:
    // `enqueueJob(projectId, stage, priorityLevel)`
    // Can we pass an extra payload object (e.g. `{ targetLanguage }`) to `enqueueJob`?
    // Yes, let's modify `enqueueJob` to accept a custom metadata payload object and store it inside the BullMQ job options!
    // But wait, to keep it extremely simple without breaking Phase 3 schema, we can store the targetLanguage inside the BullMQ job options directly:
    // `enqueueJob(projectId, stage, priorityLevel, payload)` where `payload` is passed to BullMQ `queue.add(stage, { jobId, projectId, ...payload }, ...)`!
    // That is incredibly clean and requires zero database table modifications!
    // Let's modify `enqueueJob` in `src/services/jobs.ts` to accept an optional `payload?: Record<string, any>`.
    
    // Let's first implement `reprocessTranslationJob` and other controllers, then update `enqueueJob`.
    // Wait! Let's write the controller trigger using the modified enqueueJob:
    const dbJob = await enqueueJob(projectId, QUEUES.TRANSLATION, "NORMAL", { targetLanguage: normalizedTarget });

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

// 4. POST /api/projects/:projectId/translations/retranslate (Retrigger translation)
export async function reprocessTranslationJob(
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
    const { targetLanguage } = req.body;

    const isOwner = await checkProjectOwnership(projectId, req.user.id);
    if (!isOwner) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    if (!targetLanguage || typeof targetLanguage !== "string") {
      res.status(400).json({ error: "targetLanguage parameter is required and must be a string." });
      return;
    }

    const normalizedTarget = targetLanguage.toLowerCase().trim();
    if (!SUPPORTED_LANGUAGES.includes(normalizedTarget)) {
      res.status(400).json({
        error: `Unsupported target language: "${targetLanguage}". Supported: ${SUPPORTED_LANGUAGES.join(", ")}`,
      });
      return;
    }

    const dbJob = await enqueueJob(projectId, QUEUES.TRANSLATION, "HIGH", { targetLanguage: normalizedTarget });

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

// 5. DELETE /api/projects/:projectId/translations/:language (Delete translation)
export async function deleteTranslation(
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
    const language = req.params.language as string;

    const isOwner = await checkProjectOwnership(projectId, req.user.id);
    if (!isOwner) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const [translation] = await db
      .select({ id: translationJobsTable.id })
      .from(translationJobsTable)
      .where(
        and(
          eq(translationJobsTable.projectId, projectId),
          eq(translationJobsTable.targetLanguage, language)
        )
      )
      .limit(1);

    if (!translation) {
      res.status(404).json({ error: `Translation not found for language: ${language}` });
      return;
    }

    await db.delete(translationJobsTable).where(eq(translationJobsTable.id, translation.id));

    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
}

// 6. GET /api/projects/:projectId/glossaries (List project glossary terms)
export async function listGlossaries(
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

    const glossaries = await db
      .select()
      .from(projectGlossariesTable)
      .where(eq(projectGlossariesTable.projectId, projectId))
      .orderBy(desc(projectGlossariesTable.createdAt));

    const formatted = glossaries.map((g) => ({
      id: g.id,
      projectId: g.projectId,
      sourceText: g.sourceText,
      targetText: g.targetText,
      targetLanguage: g.targetLanguage,
      createdAt: g.createdAt.toISOString(),
    }));

    res.status(200).json(formatted);
  } catch (err) {
    next(err);
  }
}

// 7. POST /api/projects/:projectId/glossaries (Add glossary term)
export async function addGlossaryTerm(
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
    const { sourceText, targetText, targetLanguage } = req.body;

    const isOwner = await checkProjectOwnership(projectId, req.user.id);
    if (!isOwner) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    if (!sourceText || !targetText || !targetLanguage) {
      res.status(400).json({ error: "sourceText, targetText, and targetLanguage parameters are required." });
      return;
    }

    const [term] = await db
      .insert(projectGlossariesTable)
      .values({
        projectId,
        sourceText: sourceText.trim(),
        targetText: targetText.trim(),
        targetLanguage: targetLanguage.toLowerCase().trim(),
      })
      .returning();

    res.status(201).json({
      id: term.id,
      projectId: term.projectId,
      sourceText: term.sourceText,
      targetText: term.targetText,
      targetLanguage: term.targetLanguage,
      createdAt: term.createdAt.toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

// 8. DELETE /api/projects/:projectId/glossaries/:glossaryId (Delete glossary term)
export async function deleteGlossaryTerm(
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
    const glossaryId = req.params.glossaryId as string;

    const isOwner = await checkProjectOwnership(projectId, req.user.id);
    if (!isOwner) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const [term] = await db
      .select({ id: projectGlossariesTable.id })
      .from(projectGlossariesTable)
      .where(and(eq(projectGlossariesTable.id, glossaryId), eq(projectGlossariesTable.projectId, projectId)))
      .limit(1);

    if (!term) {
      res.status(404).json({ error: "Glossary term not found" });
      return;
    }

    await db.delete(projectGlossariesTable).where(eq(projectGlossariesTable.id, glossaryId));

    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
}
