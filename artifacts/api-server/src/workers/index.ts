import { Worker, Job } from "bullmq";
import { getRedisClient } from "../services/redis";
import {
  db,
  processingJobsTable,
  uploadedVideosTable,
  speechRecognitionJobsTable,
  speechSegmentsTable,
  speechWordsTable,
  projectGlossariesTable,
  translationJobsTable,
  translatedSegmentsTable,
  translatedWordsTable,
  emotionJobsTable,
  emotionSegmentsTable,
  speakerJobsTable,
  speakersTable,
  speakerSegmentsTable,
  voiceGenerationJobsTable,
  generatedVoiceSegmentsTable,
  voiceAssetsTable,
  voiceProfilesTable,
  lipSyncJobsTable,
  lipSyncSegmentsTable,
  lipSyncAssetsTable,
  renderJobsTable,
  renderedAssetsTable,
  exportJobsTable,
  exportAssetsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { CONFIG, QUEUES, QueueType } from "../config";
import { getQueue, updateProgress, completeJob, failJob, enqueueJob } from "../services/jobs";
import { generatePresignedDownloadUrl, uploadTextAsset, uploadAudioBuffer } from "../services/s3";
import { extractAudioFromVideo, generateSrt, generateVtt } from "../services/audio";
import { getWhisperProvider } from "../services/whisper";
import {
  translateWithFallback,
  getTranslationMemory,
  TranslationSegment,
  TranslatedSegmentResult,
} from "../services/translation";
import {
  analyzeEmotionsWithFallback,
} from "../services/emotion";
import {
  diarizeSpeakersWithFallback,
} from "../services/speaker";
import {
  synthesizeVoiceWithFallback,
  getEmotionSpeechParameters,
  createMockWavBuffer,
} from "../services/voice";
import {
  processLipSyncWithFallback,
} from "../services/lipsync";
import {
  renderVideoWithFallback,
  exportService,
} from "../services/rendering";
import { broadcastJobUpdate } from "../services/socket";
import { logger } from "../lib/logger";

const workers: Record<string, Worker> = {};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function checkCancellation(jobId: string): Promise<boolean> {
  const [job] = await db
    .select({ status: processingJobsTable.status })
    .from(processingJobsTable)
    .where(eq(processingJobsTable.id, jobId))
    .limit(1);
  return job?.status === "cancelled";
}

async function handleDlq(jobId: string, projectId: string, stage: string, errorMsg: string) {
  try {
    const dlq = getQueue("dead-letter-queue");
    await dlq.add("dlq-item", {
      jobId,
      projectId,
      stage,
      errorMessage: errorMsg,
      failedAt: new Date().toISOString(),
    });
    logger.info(`Job ${jobId} (stage: ${stage}) pushed to Dead Letter Queue (DLQ).`);
  } catch (err) {
    logger.error(err, `Failed to push job ${jobId} to DLQ`);
  }
}

function createWorkerProcessor(stage: QueueType) {
  return async (bullJob: Job) => {
    const { jobId, projectId } = bullJob.data;
    const workerId = `worker-${process.pid}-${stage}`;
    const startedAt = new Date();

    logger.info({
      message: `Worker ${workerId} started job ${jobId} for stage ${stage}`,
      jobId,
      projectId,
      stage,
      workerId,
    });

    const waitTimeMs = startedAt.getTime() - bullJob.timestamp;
    await db
      .update(processingJobsTable)
      .set({
        status: "processing",
        startedAt,
        workerId,
      })
      .where(eq(processingJobsTable.id, jobId));

    try {
      // DEDICATED SPEECH-TO-TEXT PIPELINE
      if (stage === QUEUES.SPEECH_TO_TEXT) {
        broadcastJobUpdate(projectId, "job:stage_changed", {
          id: jobId,
          projectId,
          stage,
          status: "processing",
          progress: 0,
        });

        const [video] = await db
          .select()
          .from(uploadedVideosTable)
          .where(eq(uploadedVideosTable.projectId, projectId))
          .limit(1);

        if (!video) {
          throw new Error("No video file registered for this project. Cannot execute transcription.");
        }

        if (await checkCancellation(jobId)) {
          throw new Error("Job cancelled by user");
        }

        const audioExtractStart = Date.now();
        const downloadUrl = await generatePresignedDownloadUrl(video.s3Key);
        const audioPath = await extractAudioFromVideo(downloadUrl, projectId, video.s3Key, video.fileSize);
        const audioExtractDuration = Date.now() - audioExtractStart;

        await updateProgress(jobId, 30);

        if (await checkCancellation(jobId)) {
          throw new Error("Job cancelled by user");
        }

        const whisperStart = Date.now();
        const provider = getWhisperProvider();
        const whisperResult = await provider.transcribe(audioPath);
        const whisperDuration = Date.now() - whisperStart;

        await updateProgress(jobId, 70);

        if (await checkCancellation(jobId)) {
          throw new Error("Job cancelled by user");
        }

        const dbStart = Date.now();

        const existingTranscripts = await db
          .select()
          .from(speechRecognitionJobsTable)
          .where(eq(speechRecognitionJobsTable.projectId, projectId));

        if (existingTranscripts.length > 0) {
          await db
            .update(speechRecognitionJobsTable)
            .set({ isCurrent: false })
            .where(eq(speechRecognitionJobsTable.projectId, projectId));
        }

        const nextVersion = existingTranscripts.length + 1;

        const srtContent = generateSrt(whisperResult.segments);
        const vttContent = generateVtt(whisperResult.segments);
        const jsonContent = JSON.stringify(whisperResult, null, 2);

        const srtKey = `projects/${projectId}/transcripts/version-${nextVersion}.srt`;
        const vttKey = `projects/${projectId}/transcripts/version-${nextVersion}.vtt`;
        const jsonKey = `projects/${projectId}/transcripts/version-${nextVersion}.json`;

        try {
          await uploadTextAsset(srtKey, srtContent, "text/plain");
          await uploadTextAsset(vttKey, vttContent, "text/vtt");
          await uploadTextAsset(jsonKey, jsonContent, "application/json");
        } catch (s3Err) {
          logger.error(s3Err, "S3 subtitle assets upload failed. Proceeding with database records.");
        }

        const [speechJob] = await db
          .insert(speechRecognitionJobsTable)
          .values({
            projectId,
            jobId,
            transcript: whisperResult.transcript,
            language: whisperResult.language,
            languageConfidence: whisperResult.languageConfidence ? parseFloat(whisperResult.languageConfidence.toFixed(4)) : null,
            confidence: whisperResult.confidence ? parseFloat(whisperResult.confidence.toFixed(4)) : null,
            srtKey,
            vttKey,
            jsonKey,
            version: nextVersion,
            isCurrent: true,
          })
          .returning();

        if (whisperResult.segments.length > 0) {
          const segmentsData = whisperResult.segments.map((seg) => ({
            speechJobId: speechJob.id,
            text: seg.text,
            startTime: seg.start,
            endTime: seg.end,
            confidence: seg.confidence ? parseFloat(seg.confidence.toFixed(4)) : null,
            speakerId: null,
          }));

          const insertedSegments = await db.insert(speechSegmentsTable).values(segmentsData).returning();

          const wordsData: any[] = [];
          whisperResult.segments.forEach((seg, idx) => {
            const dbSeg = insertedSegments[idx];
            if (seg.words && seg.words.length > 0) {
              seg.words.forEach((w) => {
                wordsData.push({
                  speechJobId: speechJob.id,
                  segmentId: dbSeg.id,
                  word: w.word,
                  startTime: w.start,
                  endTime: w.end,
                  confidence: w.confidence ? parseFloat(w.confidence.toFixed(4)) : null,
                });
              });
            }
          });

          if (wordsData.length > 0) {
            await db.insert(speechWordsTable).values(wordsData);
          }
        }

        const dbDuration = Date.now() - dbStart;
        const totalDuration = Date.now() - startedAt.getTime();

        logger.info({
          message: `Speech-to-Text pipeline completed successfully for project ${projectId}`,
          jobId,
          projectId,
          metrics: {
            audioExtractionTimeMs: audioExtractDuration,
            whisperInferenceTimeMs: whisperDuration,
            databaseWriteTimeMs: dbDuration,
            totalProcessingTimeMs: totalDuration,
          },
        });

        await completeJob(jobId, workerId);
        return;
      }

      // DEDICATED TRANSLATION PIPELINE
      if (stage === QUEUES.TRANSLATION) {
        const targetLanguage = bullJob.data.targetLanguage || "hi";
        broadcastJobUpdate(projectId, "job:stage_changed", {
          id: jobId,
          projectId,
          stage,
          status: "processing",
          progress: 0,
        });

        const [speechJob] = await db
          .select()
          .from(speechRecognitionJobsTable)
          .where(and(eq(speechRecognitionJobsTable.projectId, projectId), eq(speechRecognitionJobsTable.isCurrent, true)))
          .limit(1);

        if (!speechJob) {
          throw new Error("No active speech transcript found to translate. Please trigger Speech-to-Text first.");
        }

        const speechSegments = await db
          .select()
          .from(speechSegmentsTable)
          .where(eq(speechSegmentsTable.speechJobId, speechJob.id))
          .orderBy(speechSegmentsTable.startTime);

        if (speechSegments.length === 0) {
          throw new Error("Active transcript contains no speech segments.");
        }

        const glossaries = await db
          .select()
          .from(projectGlossariesTable)
          .where(and(eq(projectGlossariesTable.projectId, projectId), eq(projectGlossariesTable.targetLanguage, targetLanguage)));

        const glossaryMap: Record<string, string> = {};
        for (const item of glossaries) {
          glossaryMap[item.sourceText.toLowerCase()] = item.targetText;
        }

        const batchSize = parseInt(process.env.TRANSLATION_BATCH_SIZE || "5", 10);
        const sourceLang = speechJob.language || "en";
        const finalTranslatedSegments: TranslatedSegmentResult[] = [];

        let tokenUsageTotal = 0;
        let finalProvider = "mock";
        let finalConfidence = 1.0;
        let cumulativeRetryCount = 0;

        const translationStart = Date.now();

        for (let i = 0; i < speechSegments.length; i += batchSize) {
          if (await checkCancellation(jobId)) {
            throw new Error("Job cancelled by user");
          }

          const batch = speechSegments.slice(i, i + batchSize);
          const segmentsToTranslate: TranslationSegment[] = [];

          for (const seg of batch) {
            const cachedTranslation = await getTranslationMemory(seg.text, sourceLang, targetLanguage);
            if (cachedTranslation) {
              finalTranslatedSegments.push({
                originalSegmentId: seg.id,
                translatedText: cachedTranslation,
                startTime: seg.startTime,
                endTime: seg.endTime,
                confidence: 1.0,
              });
            } else {
              segmentsToTranslate.push({
                originalSegmentId: seg.id,
                sourceText: seg.text,
                startTime: seg.startTime,
                endTime: seg.endTime,
              });
            }
          }

          if (segmentsToTranslate.length > 0) {
            const translateResult = await translateWithFallback(
              segmentsToTranslate,
              sourceLang,
              targetLanguage,
              glossaryMap
            );

            finalTranslatedSegments.push(...translateResult.segments);
            tokenUsageTotal += translateResult.tokenUsage || 0;
            finalProvider = translateResult.usedProvider;
            finalConfidence = Math.min(finalConfidence, translateResult.confidence || 1.0);
            cumulativeRetryCount += translateResult.retryCount;
          }

          const progressPercent = Math.min(90, Math.round(((i + batch.length) / speechSegments.length) * 90));
          await updateProgress(jobId, progressPercent);
        }

        const translationDuration = Date.now() - translationStart;

        const dbStart = Date.now();

        const existingTranslations = await db
          .select()
          .from(translationJobsTable)
          .where(and(eq(translationJobsTable.projectId, projectId), eq(translationJobsTable.targetLanguage, targetLanguage)));

        if (existingTranslations.length > 0) {
          await db
            .update(translationJobsTable)
            .set({ isCurrent: false })
            .where(and(eq(translationJobsTable.projectId, projectId), eq(translationJobsTable.targetLanguage, targetLanguage)));
        }

        const nextVersion = existingTranslations.length + 1;
        const fullTranslatedText = finalTranslatedSegments.map((s) => s.translatedText).join(" ");

        const [transJob] = await db
          .insert(translationJobsTable)
          .values({
            projectId,
            speechJobId: speechJob.id,
            sourceLanguage: sourceLang,
            targetLanguage,
            translatedText: fullTranslatedText,
            confidence: parseFloat(finalConfidence.toFixed(4)),
            provider: finalProvider,
            version: nextVersion,
            isCurrent: true,
            processingTimeMs: translationDuration,
            tokenUsage: tokenUsageTotal || null,
            retryCount: cumulativeRetryCount,
          })
          .returning();

        if (finalTranslatedSegments.length > 0) {
          const segmentsData = finalTranslatedSegments.map((seg) => ({
            translationJobId: transJob.id,
            originalSegmentId: seg.originalSegmentId,
            text: seg.translatedText,
            startTime: seg.startTime,
            endTime: seg.endTime,
            confidence: seg.confidence ? parseFloat(seg.confidence.toFixed(4)) : null,
            reviewStatus: "ai-generated",
          }));

          const insertedSegments = await db.insert(translatedSegmentsTable).values(segmentsData).returning();

          const wordsData: any[] = [];
          finalTranslatedSegments.forEach((seg, idx) => {
            const dbSeg = insertedSegments[idx];
            const wordsList = seg.translatedText.trim().split(/\s+/).filter(Boolean);

            if (wordsList.length > 0) {
              const segmentDuration = seg.endTime - seg.startTime;
              const wordDuration = segmentDuration / wordsList.length;

              wordsList.forEach((wordText, wordIdx) => {
                wordsData.push({
                  translationJobId: transJob.id,
                  segmentId: dbSeg.id,
                  word: wordText,
                  startTime: parseFloat((seg.startTime + wordIdx * wordDuration).toFixed(3)),
                  endTime: parseFloat((seg.startTime + (wordIdx + 1) * wordDuration).toFixed(3)),
                  confidence: seg.confidence ? parseFloat(seg.confidence.toFixed(4)) : null,
                });
              });
            }
          });

          if (wordsData.length > 0) {
            await db.insert(translatedWordsTable).values(wordsData);
          }
        }

        const dbDuration = Date.now() - dbStart;
        const totalDuration = Date.now() - startedAt.getTime();

        logger.info({
          message: `Translation pipeline completed successfully for project ${projectId} to language ${targetLanguage}`,
          jobId,
          projectId,
          metrics: {
            translationTimeMs: translationDuration,
            databaseWriteTimeMs: dbDuration,
            totalProcessingTimeMs: totalDuration,
            usedProvider: finalProvider,
            tokenUsage: tokenUsageTotal,
            retryCount: cumulativeRetryCount,
          },
        });

        await completeJob(jobId, workerId);
        return;
      }

      // DEDICATED EMOTION DETECTION PIPELINE
      if (stage === QUEUES.EMOTION_DETECTION) {
        broadcastJobUpdate(projectId, "job:stage_changed", {
          id: jobId,
          projectId,
          stage,
          status: "processing",
          progress: 0,
        });

        const [speechJob] = await db
          .select()
          .from(speechRecognitionJobsTable)
          .where(and(eq(speechRecognitionJobsTable.projectId, projectId), eq(speechRecognitionJobsTable.isCurrent, true)))
          .limit(1);

        if (!speechJob) {
          throw new Error("No active speech transcript found. Please trigger Speech-to-Text first.");
        }

        const speechSegments = await db
          .select()
          .from(speechSegmentsTable)
          .where(eq(speechSegmentsTable.speechJobId, speechJob.id))
          .orderBy(speechSegmentsTable.startTime);

        if (speechSegments.length === 0) {
          throw new Error("Active transcript contains no speech segments.");
        }

        const [translationJob] = await db
          .select({ id: translationJobsTable.id })
          .from(translationJobsTable)
          .where(and(eq(translationJobsTable.projectId, projectId), eq(translationJobsTable.isCurrent, true)))
          .limit(1);

        const [video] = await db
          .select()
          .from(uploadedVideosTable)
          .where(eq(uploadedVideosTable.projectId, projectId))
          .limit(1);

        if (!video) {
          throw new Error("No video file registered for this project. Cannot execute emotion detection.");
        }

        const downloadUrl = await generatePresignedDownloadUrl(video.s3Key);
        const audioPath = await extractAudioFromVideo(downloadUrl, projectId, video.s3Key, video.fileSize);

        await updateProgress(jobId, 30);

        if (await checkCancellation(jobId)) {
          throw new Error("Job cancelled by user");
        }

        const emotionStart = Date.now();
        const segmentsToAnalyze = speechSegments.map((s) => ({
          id: s.id,
          text: s.text,
          start: s.startTime,
          end: s.endTime,
          speakerId: s.speakerId,
        }));

        const analysisResult = await analyzeEmotionsWithFallback(audioPath, segmentsToAnalyze);
        const emotionDuration = Date.now() - emotionStart;

        await updateProgress(jobId, 70);

        if (await checkCancellation(jobId)) {
          throw new Error("Job cancelled by user");
        }

        const dbStart = Date.now();

        const existingEmotionJobs = await db
          .select()
          .from(emotionJobsTable)
          .where(eq(emotionJobsTable.projectId, projectId));

        if (existingEmotionJobs.length > 0) {
          await db
            .update(emotionJobsTable)
            .set({ isCurrent: false })
            .where(eq(emotionJobsTable.projectId, projectId));
        }

        const nextVersion = existingEmotionJobs.length + 1;

        const [emJob] = await db
          .insert(emotionJobsTable)
          .values({
            projectId,
            speechJobId: speechJob.id,
            translationJobId: translationJob?.id || null,
            provider: analysisResult.usedProvider,
            version: nextVersion,
            isCurrent: true,
            avgConfidence: parseFloat(analysisResult.avgConfidence.toFixed(4)),
            modelVersion: analysisResult.modelVersion,
            processingTimeMs: emotionDuration,
          })
          .returning();

        if (analysisResult.segments.length > 0) {
          const segmentsData = analysisResult.segments.map((seg) => ({
            emotionJobId: emJob.id,
            segmentId: seg.segmentId,
            textEmotion: seg.textEmotion,
            audioEmotion: seg.audioEmotion,
            finalEmotion: seg.finalEmotion,
            confidence: parseFloat(seg.confidence.toFixed(4)),
            intensity: parseFloat(seg.intensity.toFixed(4)),
            startTime: seg.startTime,
            endTime: seg.endTime,
            speakerId: seg.speakerId || null,
          }));

          await db.insert(emotionSegmentsTable).values(segmentsData);
        }

        const dbDuration = Date.now() - dbStart;
        const totalDuration = Date.now() - startedAt.getTime();

        logger.info({
          message: `Emotion Detection pipeline completed successfully for project ${projectId}`,
          jobId,
          projectId,
          metrics: {
            emotionDetectionTimeMs: emotionDuration,
            databaseWriteTimeMs: dbDuration,
            totalProcessingTimeMs: totalDuration,
            usedProvider: analysisResult.usedProvider,
            avgConfidence: analysisResult.avgConfidence,
            modelVersion: analysisResult.modelVersion,
          },
        });

        await completeJob(jobId, workerId);
        return;
      }

      // DEDICATED SPEAKER DIARIZATION PIPELINE
      if (stage === QUEUES.SPEAKER_DIARIZATION) {
        broadcastJobUpdate(projectId, "job:stage_changed", {
          id: jobId,
          projectId,
          stage,
          status: "processing",
          progress: 0,
        });

        const [speechJob] = await db
          .select()
          .from(speechRecognitionJobsTable)
          .where(and(eq(speechRecognitionJobsTable.projectId, projectId), eq(speechRecognitionJobsTable.isCurrent, true)))
          .limit(1);

        if (!speechJob) {
          throw new Error("No active speech transcript found. Reprocess Speech-to-Text first.");
        }

        const speechSegments = await db
          .select()
          .from(speechSegmentsTable)
          .where(eq(speechSegmentsTable.speechJobId, speechJob.id))
          .orderBy(speechSegmentsTable.startTime);

        if (speechSegments.length === 0) {
          throw new Error("Active transcript contains no speech segments.");
        }

        const [video] = await db
          .select()
          .from(uploadedVideosTable)
          .where(eq(uploadedVideosTable.projectId, projectId))
          .limit(1);

        if (!video) {
          throw new Error("No video file registered for this project. Cannot execute speaker diarization.");
        }

        const downloadUrl = await generatePresignedDownloadUrl(video.s3Key);
        const audioPath = await extractAudioFromVideo(downloadUrl, projectId, video.s3Key, video.fileSize);

        await updateProgress(jobId, 30);

        if (await checkCancellation(jobId)) {
          throw new Error("Job cancelled by user");
        }

        const diarizeStart = Date.now();
        const diarizeResult = await diarizeSpeakersWithFallback(audioPath);
        const diarizeDuration = Date.now() - diarizeStart;

        await updateProgress(jobId, 70);

        if (await checkCancellation(jobId)) {
          throw new Error("Job cancelled by user");
        }

        const dbStart = Date.now();

        const existingSpeakerJobs = await db
          .select()
          .from(speakerJobsTable)
          .where(eq(speakerJobsTable.projectId, projectId));

        if (existingSpeakerJobs.length > 0) {
          await db
            .update(speakerJobsTable)
            .set({ isCurrent: false })
            .where(eq(speakerJobsTable.projectId, projectId));
        }

        const nextVersion = existingSpeakerJobs.length + 1;

        const [spJob] = await db
          .insert(speakerJobsTable)
          .values({
            projectId,
            speechJobId: speechJob.id,
            provider: diarizeResult.usedProvider,
            version: nextVersion,
            isCurrent: true,
            speakerCount: diarizeResult.speakers.length,
            avgConfidence: parseFloat(diarizeResult.avgConfidence.toFixed(4)),
            processingTimeMs: diarizeDuration,
          })
          .returning();

        const dbSpeakers: any[] = [];
        for (const spProfile of diarizeResult.speakers) {
          const spSegments = diarizeResult.segments.filter((s) => s.speakerLabel === spProfile.speakerLabel);

          const totalSpeakingTime = spSegments.reduce((sum, s) => sum + (s.endTime - s.startTime), 0);
          const numberOfSegments = spSegments.length;
          const averageConfidence = spSegments.reduce((sum, s) => sum + s.confidence, 0) / (numberOfSegments || 1);
          const firstAppearance = spSegments.length > 0 ? Math.min(...spSegments.map((s) => s.startTime)) : 0;
          const lastAppearance = spSegments.length > 0 ? Math.max(...spSegments.map((s) => s.endTime)) : 0;

          const [dbSpeaker] = await db
            .insert(speakersTable)
            .values({
              projectId,
              speakerJobId: spJob.id,
              speakerLabel: spProfile.speakerLabel,
              displayName: spProfile.displayName,
              gender: spProfile.gender || null,
              estimatedAge: spProfile.estimatedAge || null,
              dominantLanguage: spProfile.dominantLanguage || null,
              speakerEmbedding: spProfile.embeddingVector || null,
              totalSpeakingTime: parseFloat(totalSpeakingTime.toFixed(4)),
              numberOfSegments,
              averageConfidence: parseFloat(averageConfidence.toFixed(4)),
              firstAppearance: parseFloat(firstAppearance.toFixed(4)),
              lastAppearance: parseFloat(lastAppearance.toFixed(4)),
              createdByUser: false,
              isLocked: false,
            })
            .returning();

          dbSpeakers.push(dbSpeaker);
        }

        if (diarizeResult.segments.length > 0) {
          const segmentsData = diarizeResult.segments.map((seg) => {
            const correspondingSpeaker = dbSpeakers.find((s) => s.speakerLabel === seg.speakerLabel);
            return {
              speakerJobId: spJob.id,
              speakerId: correspondingSpeaker.id,
              startTime: seg.startTime,
              endTime: seg.endTime,
              confidence: parseFloat(seg.confidence.toFixed(4)),
            };
          });

          await db.insert(speakerSegmentsTable).values(segmentsData);
        }

        for (const speechSeg of speechSegments) {
          const matchingSpeakerSeg =
            diarizeResult.segments.find((s) => s.startTime <= speechSeg.startTime && s.endTime >= speechSeg.endTime) ||
            diarizeResult.segments.find((s) => Math.abs(s.startTime - speechSeg.startTime) < 1.0);

          if (matchingSpeakerSeg) {
            const dbSpeaker = dbSpeakers.find((s) => s.speakerLabel === matchingSpeakerSeg.speakerLabel);
            if (dbSpeaker) {
              await db
                .update(speechSegmentsTable)
                .set({ speakerId: dbSpeaker.id })
                .where(eq(speechSegmentsTable.id, speechSeg.id));
            }
          }
        }

        const dbDuration = Date.now() - dbStart;
        const totalDuration = Date.now() - startedAt.getTime();

        logger.info({
          message: `Speaker Diarization pipeline completed successfully for project ${projectId}`,
          jobId,
          projectId,
          metrics: {
            diarizationTimeMs: diarizeDuration,
            databaseWriteTimeMs: dbDuration,
            totalProcessingTimeMs: totalDuration,
            usedProvider: diarizeResult.usedProvider,
            speakerCount: diarizeResult.speakers.length,
          },
        });

        await completeJob(jobId, workerId);
        await enqueueJob(projectId, QUEUES.VOICE_CLONING, "NORMAL");
        return;
      }

      // DEDICATED VOICE CLONING & TTS PIPELINE
      if (stage === QUEUES.VOICE_CLONING) {
        broadcastJobUpdate(projectId, "job:stage_changed", {
          id: jobId,
          projectId,
          stage,
          status: "processing",
          progress: 0,
        });

        const [translationJob] = await db
          .select()
          .from(translationJobsTable)
          .where(and(eq(translationJobsTable.projectId, projectId), eq(translationJobsTable.isCurrent, true)))
          .limit(1);

        if (!translationJob) {
          throw new Error("No active translated segments found. Reprocess translation first.");
        }

        const translatedSegments = await db
          .select()
          .from(translatedSegmentsTable)
          .where(eq(translatedSegmentsTable.translationJobId, translationJob.id))
          .orderBy(translatedSegmentsTable.startTime);

        if (translatedSegments.length === 0) {
          throw new Error("Translation contains no segments.");
        }

        const [emotionJob] = await db
          .select({ id: emotionJobsTable.id })
          .from(emotionJobsTable)
          .where(and(eq(emotionJobsTable.projectId, projectId), eq(emotionJobsTable.isCurrent, true)))
          .limit(1);

        const emotionSegs = emotionJob
          ? await db.select().from(emotionSegmentsTable).where(eq(emotionSegmentsTable.emotionJobId, emotionJob.id))
          : [];

        const ttsStart = Date.now();
        const generatedSegmentsData: any[] = [];

        let finalConfidenceTotal = 0;
        let finalProvider = "mock";

        for (let i = 0; i < translatedSegments.length; i++) {
          if (await checkCancellation(jobId)) {
            throw new Error("Job cancelled by user");
          }

          const seg = translatedSegments[i];

          const [originalSpeechSeg] = await db
            .select({ speakerId: speechSegmentsTable.speakerId })
            .from(speechSegmentsTable)
            .where(eq(speechSegmentsTable.id, seg.originalSegmentId))
            .limit(1);

          let profile: any = null;
          if (originalSpeechSeg?.speakerId) {
            [profile] = await db
              .select()
              .from(voiceProfilesTable)
              .where(eq(voiceProfilesTable.speakerId, originalSpeechSeg.speakerId))
              .limit(1);
          }

          const emotionSeg = emotionSegs.find((e) => e.segmentId === seg.originalSegmentId);
          const emotionLabel = emotionSeg?.finalEmotion || "neutral";
          const emotionIntensity = emotionSeg?.intensity || 0.8;
          const emotionParams = getEmotionSpeechParameters(emotionLabel, emotionIntensity);

          const finalSpeed = (profile?.speed || 1.0) * emotionParams.speed;
          const finalPitch = (profile?.pitch || 0.0) + emotionParams.pitch;

          const ttsResult = await synthesizeVoiceWithFallback({
            text: seg.text,
            language: translationJob.targetLanguage,
            speed: finalSpeed,
            pitch: finalPitch,
            voiceName: profile?.voiceName || undefined,
            emotionPreset: emotionParams.emotionPreset,
          });

          const segmentS3Key = `projects/${projectId}/voices/segments/version-1-${seg.id}.wav`;
          await uploadAudioBuffer(segmentS3Key, ttsResult.audioBuffer, "audio/wav");

          generatedSegmentsData.push({
            translatedSegmentId: seg.id,
            s3Key: segmentS3Key,
            duration: ttsResult.duration,
            sampleRate: ttsResult.sampleRate,
            confidence: ttsResult.confidence ? parseFloat(ttsResult.confidence.toFixed(4)) : null,
          });

          finalConfidenceTotal += ttsResult.confidence || 0.95;
          finalProvider = ttsResult.usedProvider;

          const progressPercent = Math.min(80, Math.round(((i + 1) / translatedSegments.length) * 80));
          await updateProgress(jobId, progressPercent);
        }

        const ttsDuration = Date.now() - ttsStart;

        const dbStart = Date.now();

        const existingJobs = await db
          .select()
          .from(voiceGenerationJobsTable)
          .where(eq(voiceGenerationJobsTable.projectId, projectId));

        if (existingJobs.length > 0) {
          await db
            .update(voiceGenerationJobsTable)
            .set({ isCurrent: false })
            .where(eq(voiceGenerationJobsTable.projectId, projectId));
        }

        const nextVersion = existingJobs.length + 1;

        const [voiceJob] = await db
          .insert(voiceGenerationJobsTable)
          .values({
            projectId,
            translationJobId: translationJob.id,
            emotionJobId: emotionJob?.id || null,
            provider: finalProvider,
            modelVersion: "neural-v2.0",
            isCurrent: true,
            processingTimeMs: ttsDuration,
          })
          .returning();

        const segmentsToInsert = generatedSegmentsData.map((s) => ({
          voiceJobId: voiceJob.id,
          translatedSegmentId: s.translatedSegmentId,
          s3Key: s.s3Key,
          duration: s.duration,
          sampleRate: s.sampleRate,
          confidence: s.confidence,
        }));

        await db.insert(generatedVoiceSegmentsTable).values(segmentsToInsert);

        const totalDuration = generatedSegmentsData.reduce((sum, s) => sum + s.duration, 0);
        const combinedWavBuffer = createMockWavBuffer(totalDuration, 16000);

        const combinedWavKey = `projects/${projectId}/voices/outputs/combined-${nextVersion}.wav`;
        const combinedMp3Key = `projects/${projectId}/voices/outputs/combined-${nextVersion}.mp3`;
        const combinedFlacKey = `projects/${projectId}/voices/outputs/combined-${nextVersion}.flac`;

        await uploadAudioBuffer(combinedWavKey, combinedWavBuffer, "audio/wav");
        await uploadAudioBuffer(combinedMp3Key, combinedWavBuffer, "audio/mpeg");
        await uploadAudioBuffer(combinedFlacKey, combinedWavBuffer, "audio/flac");

        const assetsData = [
          { projectId, voiceJobId: voiceJob.id, s3Key: combinedWavKey, format: "wav", duration: totalDuration, sampleRate: 16000 },
          { projectId, voiceJobId: voiceJob.id, s3Key: combinedMp3Key, format: "mp3", duration: totalDuration, sampleRate: 16000 },
          { projectId, voiceJobId: voiceJob.id, s3Key: combinedFlacKey, format: "flac", duration: totalDuration, sampleRate: 16000 },
        ];

        await db.insert(voiceAssetsTable).values(assetsData);

        const dbDuration = Date.now() - dbStart;
        const totalDurationMs = Date.now() - startedAt.getTime();

        logger.info({
          message: `Voice Cloning pipeline completed successfully for project ${projectId}`,
          jobId,
          projectId,
          metrics: {
            synthesisTimeMs: ttsDuration,
            databaseWriteTimeMs: dbDuration,
            totalProcessingTimeMs: totalDurationMs,
            usedProvider: finalProvider,
          },
        });

        await completeJob(jobId, workerId);
        await enqueueJob(projectId, QUEUES.LIP_SYNC, "NORMAL");
        return;
      }

      // DEDICATED AI LIP SYNC PIPELINE
      if (stage === QUEUES.LIP_SYNC) {
        broadcastJobUpdate(projectId, "job:stage_changed", {
          id: jobId,
          projectId,
          stage,
          status: "processing",
          progress: 0,
        });

        const [voiceJob] = await db
          .select()
          .from(voiceGenerationJobsTable)
          .where(and(eq(voiceGenerationJobsTable.projectId, projectId), eq(voiceGenerationJobsTable.isCurrent, true)))
          .limit(1);

        if (!voiceJob) {
          throw new Error("No active dubbed voice tracks found. Run Voice Cloning first.");
        }

        const [speakerJob] = await db
          .select({ id: speakerJobsTable.id })
          .from(speakerJobsTable)
          .where(and(eq(speakerJobsTable.projectId, projectId), eq(speakerJobsTable.isCurrent, true)))
          .limit(1);

        if (!speakerJob) {
          throw new Error("No active speaker profile found. Run Diarization first.");
        }

        const voiceSegments = await db
          .select()
          .from(generatedVoiceSegmentsTable)
          .where(eq(generatedVoiceSegmentsTable.voiceJobId, voiceJob.id));

        if (voiceSegments.length === 0) {
          throw new Error("Dubbed tracks contain no segments.");
        }

        const [video] = await db
          .select()
          .from(uploadedVideosTable)
          .where(eq(uploadedVideosTable.projectId, projectId))
          .limit(1);

        if (!video) {
          throw new Error("No original video file found.");
        }

        const lipSyncStart = Date.now();
        const segmentsToInsert: any[] = [];

        let cumulativeConfidence = 0;
        let usedProviderName = "mock";

        for (let i = 0; i < voiceSegments.length; i++) {
          if (await checkCancellation(jobId)) {
            throw new Error("Job cancelled by user");
          }

          const voiceSeg = voiceSegments[i];

          const [translatedSeg] = await db
            .select({ originalSegmentId: translatedSegmentsTable.originalSegmentId })
            .from(translatedSegmentsTable)
            .where(eq(translatedSegmentsTable.id, voiceSeg.translatedSegmentId))
            .limit(1);

          let originalSpeechSeg: any = null;
          if (translatedSeg) {
            [originalSpeechSeg] = await db
              .select()
              .from(speechSegmentsTable)
              .where(eq(speechSegmentsTable.id, translatedSeg.originalSegmentId))
              .limit(1);
          }

          const result = await processLipSyncWithFallback({
            videoKey: video.s3Key,
            audioKey: voiceSeg.s3Key,
            startTime: originalSpeechSeg?.startTime || 0,
            endTime: originalSpeechSeg?.endTime || voiceSeg.duration,
            faceLabel: originalSpeechSeg?.speakerId ? `face_${originalSpeechSeg.speakerId}` : undefined,
          });

          segmentsToInsert.push({
            segmentId: voiceSeg.translatedSegmentId,
            speakerId: originalSpeechSeg?.speakerId || null,
            startTime: originalSpeechSeg?.startTime || 0,
            endTime: originalSpeechSeg?.endTime || voiceSeg.duration,
            inputVideoKey: video.s3Key,
            inputAudioKey: voiceSeg.s3Key,
            outputVideoKey: result.outputVideoKey,
            faceTrackingId: originalSpeechSeg?.speakerId ? `track_${originalSpeechSeg.speakerId}` : null,
            qualityScore: parseFloat(result.lipSyncScore.toFixed(4)),
          });

          cumulativeConfidence += result.lipSyncScore;
          usedProviderName = result.usedProvider;

          const progressPercent = Math.min(80, Math.round(((i + 1) / voiceSegments.length) * 80));
          await updateProgress(jobId, progressPercent);
        }

        const lipSyncDuration = Date.now() - lipSyncStart;

        const dbStart = Date.now();

        await db
          .update(lipSyncJobsTable)
          .set({ status: "outdated" })
          .where(eq(lipSyncJobsTable.projectId, projectId));

        const avgConfidence = cumulativeConfidence / (voiceSegments.length || 1);

        const [spJob] = await db
          .insert(lipSyncJobsTable)
          .values({
            projectId,
            voiceGenerationJobId: voiceJob.id,
            speakerJobId: speakerJob.id,
            provider: usedProviderName,
            modelVersion: "wav2lip-hq-v2",
            status: "completed",
            processingTimeMs: lipSyncDuration,
            confidence: parseFloat(avgConfidence.toFixed(4)),
          })
          .returning();

        const segmentsWithJob = segmentsToInsert.map((s) => ({
          lipSyncJobId: spJob.id,
          ...s,
        }));
        await db.insert(lipSyncSegmentsTable).values(segmentsWithJob);

        const combinedVideoBuffer = Buffer.from("mock-binary-video-data");
        const nextVersion = 1;

        const combinedMp4Key = `projects/${projectId}/lipsync/outputs/combined-${nextVersion}.mp4`;
        const combinedMovKey = `projects/${projectId}/lipsync/outputs/combined-${nextVersion}.mov`;
        const combinedWebmKey = `projects/${projectId}/lipsync/outputs/combined-${nextVersion}.webm`;

        await uploadAudioBuffer(combinedMp4Key, combinedVideoBuffer, "video/mp4");
        await uploadAudioBuffer(combinedMovKey, combinedVideoBuffer, "video/quicktime");
        await uploadAudioBuffer(combinedWebmKey, combinedVideoBuffer, "video/webm");

        const assetsData = [
          { projectId, jobId: spJob.id, format: "mp4", resolution: "1920x1080", fps: 29.97, duration: video.durationSeconds || 10, fileSize: 10240, mimeType: "video/mp4", s3Key: combinedMp4Key },
          { projectId, jobId: spJob.id, format: "mov", resolution: "1920x1080", fps: 29.97, duration: video.durationSeconds || 10, fileSize: 10240, mimeType: "video/quicktime", s3Key: combinedMovKey },
          { projectId, jobId: spJob.id, format: "webm", resolution: "1920x1080", fps: 29.97, duration: video.durationSeconds || 10, fileSize: 10240, mimeType: "video/webm", s3Key: combinedWebmKey },
        ];

        await db.insert(lipSyncAssetsTable).values(assetsData);

        const dbDuration = Date.now() - dbStart;
        const totalDurationMs = Date.now() - startedAt.getTime();

        logger.info({
          message: `AI Lip Sync pipeline completed successfully for project ${projectId}`,
          jobId,
          projectId,
          metrics: {
            lipSyncTimeMs: lipSyncDuration,
            databaseWriteTimeMs: dbDuration,
            totalProcessingTimeMs: totalDurationMs,
            usedProvider: usedProviderName,
          },
        });

        await completeJob(jobId, workerId);
        await enqueueJob(projectId, QUEUES.RENDERING, "NORMAL");
        return;
      }

      // DEDICATED RENDERING PIPELINE
      if (stage === QUEUES.RENDERING) {
        broadcastJobUpdate(projectId, "job:stage_changed", {
          id: jobId,
          projectId,
          stage,
          status: "processing",
          progress: 0,
        });

        broadcastJobUpdate(projectId, "render:started", {
          jobId,
          projectId,
          status: "rendering",
          progress: 0,
        });

        // 1. Fetch active lip sync job
        const [lipsyncJob] = await db
          .select()
          .from(lipSyncJobsTable)
          .where(and(eq(lipSyncJobsTable.projectId, projectId), eq(lipSyncJobsTable.status, "completed")))
          .limit(1);

        if (!lipsyncJob) {
          throw new Error("No active Lip Sync track found. Reprocess Lip Sync first.");
        }

        // 2. Fetch active translation job subtitles path
        const [translationJob] = await db
          .select({ vttKey: translationJobsTable.translatedText }) // mock key mapping
          .from(translationJobsTable)
          .where(and(eq(translationJobsTable.projectId, projectId), eq(translationJobsTable.isCurrent, true)))
          .limit(1);

        const resolution = bullJob.data.resolution || "1080p";
        const format = bullJob.data.format || "mp4";
        const codec = bullJob.data.codec || "h264";
        const hasSubtitles = !!bullJob.data.hasSubtitles;
        const hasWatermark = !!bullJob.data.hasWatermark;

        // 3. Run default FFmpeg renderer helper
        const renderStart = Date.now();
        const renderResult = await renderVideoWithFallback({
          lipSyncVideoKey: `projects/${projectId}/lipsync/outputs/combined-1.mp4`,
          audioKey: `projects/${projectId}/voices/outputs/combined-1.wav`,
          subtitlesKey: hasSubtitles ? `projects/${projectId}/transcripts/version-1.vtt` : undefined,
          hasWatermark,
          resolution,
          format,
          codec,
        });
        const renderDuration = Date.now() - renderStart;

        await updateProgress(jobId, 60);

        broadcastJobUpdate(projectId, "render:progress", {
          jobId,
          projectId,
          status: "rendering",
          progress: 60,
        });

        if (await checkCancellation(jobId)) {
          throw new Error("Job cancelled by user");
        }

        // 4. Upload rendered video, thumbnail, preview, and waveforms
        const dbStart = Date.now();

        const videoKey = `projects/${projectId}/renders/final-output-${Date.now()}.${renderResult.format}`;
        const thumbnailKey = `projects/${projectId}/renders/thumbnail-${Date.now()}.png`;
        const previewKey = `projects/${projectId}/renders/preview-${Date.now()}.${renderResult.format}`;
        const waveformKey = `projects/${projectId}/renders/waveform-${Date.now()}.json`;

        await uploadAudioBuffer(videoKey, renderResult.renderedVideoBuffer, `video/${renderResult.format === "mov" ? "quicktime" : renderResult.format}`);
        await uploadAudioBuffer(thumbnailKey, renderResult.thumbnailBuffer, "image/png");
        await uploadAudioBuffer(previewKey, renderResult.previewVideoBuffer, `video/${renderResult.format === "mov" ? "quicktime" : renderResult.format}`);
        await uploadAudioBuffer(waveformKey, renderResult.waveformBuffer, "application/json");

        // Deactivate old renders
        await db
          .update(renderJobsTable)
          .set({ status: "outdated" })
          .where(eq(renderJobsTable.projectId, projectId));

        const [rJob] = await db
          .insert(renderJobsTable)
          .values({
            projectId,
            lipSyncJobId: lipsyncJob.id,
            provider: renderResult.usedProvider,
            status: "completed",
            resolution,
            format,
            codec,
            hasSubtitles,
            hasWatermark,
            processingTimeMs: renderDuration,
          })
          .returning();

        // Save rendered asset details
        const [asset] = await db
          .insert(renderedAssetsTable)
          .values({
            projectId,
            renderJobId: rJob.id,
            s3Key: videoKey,
            format: renderResult.format,
            resolution: renderResult.resolution,
            fps: renderResult.fps,
            duration: renderResult.duration,
            fileSize: renderResult.fileSize,
            checksum: "mock-checksum-hash-val",
            mimeType: `video/${renderResult.format}`,
            thumbnailS3Key: thumbnailKey,
            previewS3Key: previewKey,
            waveformS3Key: waveformKey,
            version: 1,
            isCurrent: true,
          })
          .returning();

        const dbDuration = Date.now() - dbStart;
        const totalDurationMs = Date.now() - startedAt.getTime();

        logger.info({
          message: `Rendering pipeline completed successfully for project ${projectId}`,
          jobId,
          projectId,
          metrics: {
            renderTimeMs: renderDuration,
            databaseWriteTimeMs: dbDuration,
            totalProcessingTimeMs: totalDurationMs,
            usedProvider: renderResult.usedProvider,
          },
        });

        broadcastJobUpdate(projectId, "render:completed", {
          jobId,
          projectId,
          renderJobId: rJob.id,
          status: "completed",
          progress: 100,
        });

        // 5. Complete job & chain Export stage next
        await completeJob(jobId, workerId);
        await enqueueJob(projectId, QUEUES.EXPORT, "NORMAL", {
          exportType: "video_package",
          renderJobId: rJob.id,
        });
        return;
      }

      // DEDICATED EXPORT PIPELINE
      if (stage === QUEUES.EXPORT) {
        broadcastJobUpdate(projectId, "job:stage_changed", {
          id: jobId,
          projectId,
          stage,
          status: "processing",
          progress: 0,
        });

        broadcastJobUpdate(projectId, "export:started", {
          jobId,
          projectId,
          status: "processing",
          progress: 0,
        });

        const exportType = bullJob.data.exportType || "video_package";
        const renderJobId = bullJob.data.renderJobId || null;

        // 1. Run Export service packager
        const exportStart = Date.now();
        const exportResult = await exportService.package({
          projectId,
          renderJobId,
          exportType,
        });
        const exportDuration = Date.now() - exportStart;

        await updateProgress(jobId, 70);

        broadcastJobUpdate(projectId, "export:progress", {
          jobId,
          projectId,
          status: "processing",
          progress: 70,
        });

        if (await checkCancellation(jobId)) {
          throw new Error("Job cancelled by user");
        }

        // 2. Upload export archive package
        const dbStart = Date.now();
        const exportS3Key = `projects/${projectId}/exports/pkg-${exportType}-${Date.now()}.${exportResult.format}`;

        let mimeType = "application/zip";
        if (exportResult.format === "mp3") mimeType = "audio/mpeg";
        if (exportResult.format === "srt") mimeType = "text/plain";
        if (exportResult.format === "json") mimeType = "application/json";

        await uploadAudioBuffer(exportS3Key, exportResult.packageBuffer, mimeType);

        // Save Export Job
        const [exJob] = await db
          .insert(exportJobsTable)
          .values({
            projectId,
            renderJobId,
            status: "completed",
            exportType,
            processingTimeMs: exportDuration,
          })
          .returning();

        // Save Export Asset
        await db
          .insert(exportAssetsTable)
          .values({
            projectId,
            exportJobId: exJob.id,
            s3Key: exportS3Key,
            format: exportResult.format,
            fileSize: exportResult.fileSize,
            checksum: "mock-checksum-export-val",
            mimeType,
          });

        const dbDuration = Date.now() - dbStart;
        const totalDurationMs = Date.now() - startedAt.getTime();

        logger.info({
          message: `Export pipeline completed successfully for project ${projectId} type: ${exportType}`,
          jobId,
          projectId,
          metrics: {
            exportTimeMs: exportDuration,
            databaseWriteTimeMs: dbDuration,
            totalProcessingTimeMs: totalDurationMs,
          },
        });

        broadcastJobUpdate(projectId, "export:completed", {
          jobId,
          projectId,
          status: "completed",
          progress: 100,
        });

        await completeJob(jobId, workerId);
        return;
      }

      // GENERIC PROCESSING SIMULATION FOR OTHER STAGES
      for (let progress = 10; progress <= 90; progress += 20) {
        if (await checkCancellation(jobId)) {
          logger.warn(`Job ${jobId} cancelled. Halting worker execution.`);
          throw new Error("Job cancelled by user");
        }

        await sleep(500);
        await updateProgress(jobId, progress);
      }

      if (await checkCancellation(jobId)) {
        throw new Error("Job cancelled by user");
      }

      const completedAt = new Date();
      const executionTimeMs = completedAt.getTime() - startedAt.getTime();

      await completeJob(jobId, workerId);

      logger.info({
        message: `Worker ${workerId} successfully completed job ${jobId}`,
        jobId,
        projectId,
        stage,
        workerId,
        metrics: {
          queueWaitTimeMs: waitTimeMs,
          processingTimeMs: executionTimeMs,
          totalTimeMs: waitTimeMs + executionTimeMs,
        },
      });
    } catch (err: any) {
      const failedAt = new Date();
      const executionTimeMs = failedAt.getTime() - startedAt.getTime();
      const isCancelled = err.message === "Job cancelled by user";

      logger.error({
        message: `Worker ${workerId} failed on job ${jobId}`,
        jobId,
        projectId,
        stage,
        workerId,
        error: err.message,
        isCancelled,
        metrics: {
          queueWaitTimeMs: waitTimeMs,
          processingTimeMs: executionTimeMs,
        },
      });

      if (stage === QUEUES.RENDERING) {
        broadcastJobUpdate(projectId, "render:failed", {
          jobId,
          projectId,
          error: err.message,
        });
      } else if (stage === QUEUES.EXPORT) {
        broadcastJobUpdate(projectId, "export:failed", {
          jobId,
          projectId,
          error: err.message,
        });
      }

      if (isCancelled) {
        return;
      }

      const attemptsMade = bullJob.attemptsMade + 1;
      const maxAttempts = bullJob.opts.attempts || 3;

      if (attemptsMade >= maxAttempts) {
        await failJob(jobId, `Exceeded retry limit of ${maxAttempts}. Last error: ${err.message}`, workerId);
        await handleDlq(jobId, projectId, stage, err.message);
      } else {
        await db
          .update(processingJobsTable)
          .set({
            status: "failed",
            errorMessage: `Attempt ${attemptsMade} failed: ${err.message}`,
          })
          .where(eq(processingJobsTable.id, jobId));

        throw err;
      }
    }
  };
}

export function startWorkers(): void {
  const queueNames = Object.values(QUEUES);

  for (const name of queueNames) {
    const queueConfig = CONFIG.queues[name];
    if (!queueConfig) continue;

    logger.info(`Starting worker for queue: ${name} (concurrency: ${queueConfig.concurrency})`);

    const worker = new Worker(name, createWorkerProcessor(name), {
      connection: getRedisClient(),
      concurrency: queueConfig.concurrency,
    });

    worker.on("failed", (job, err) => {
      logger.error(err, `Worker execution failed on queue ${name} for job ${job?.id}`);
    });

    worker.on("error", (err) => {
      logger.error(err, `Worker error on queue ${name}`);
    });

    workers[name] = worker;
  }
}

export async function shutdownWorkers(): Promise<void> {
  logger.info("Gracefully shutting down all background workers...");
  const closePromises = Object.entries(workers).map(([name, worker]) => {
    logger.info(`Closing worker: ${name}`);
    return worker.close();
  });
  await Promise.all(closePromises);
  logger.info("All background workers have been successfully shut down.");
}
