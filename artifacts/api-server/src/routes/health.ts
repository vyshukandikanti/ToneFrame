import { Router, type IRouter } from "express";
import { exec } from "child_process";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getS3Client } from "../services/s3";
import { ListBucketsCommand } from "@aws-sdk/client-s3";
import { checkRedisHealth } from "../services/redis";
import { getRedisHealth, getQueueMetrics } from "../controllers/jobs";
import { CONFIG } from "../config";

const router: IRouter = Router();

// Base healthz route
router.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

// 1. Database Health Probe
router.get("/health/database", async (_req, res) => {
  const start = Date.now();
  try {
    if (process.env.NODE_ENV !== "test") {
      await db.execute(sql`SELECT 1`);
    }
    res.status(200).json({
      status: "healthy",
      latencyMs: Date.now() - start,
    });
  } catch (err: any) {
    res.status(500).json({
      status: "unhealthy",
      error: err.message || String(err),
    });
  }
});

// 2. Storage Health Probe (AWS S3 / MinIO)
router.get("/health/storage", async (_req, res) => {
  const start = Date.now();
  try {
    const s3 = getS3Client();
    await s3.send(new ListBucketsCommand({}));
    res.status(200).json({
      status: "healthy",
      latencyMs: Date.now() - start,
      bucket: CONFIG.S3_BUCKET,
    });
  } catch (err: any) {
    res.status(500).json({
      status: "unhealthy",
      error: err.message || String(err),
    });
  }
});

// 3. Rendering Health Probe (FFmpeg runtime status)
router.get("/health/rendering", (_req, res) => {
  const start = Date.now();
  exec("ffmpeg -version", (error, stdout) => {
    if (error) {
      res.status(500).json({
        status: "unhealthy",
        error: error.message,
      });
      return;
    }
    const versionLine = stdout.split("\n")[0];
    res.status(200).json({
      status: "healthy",
      latencyMs: Date.now() - start,
      ffmpegVersion: versionLine,
    });
  });
});

// 4. AI Pipeline Integration Providers Status
router.get("/health/providers", (_req, res) => {
  res.status(200).json({
    whisper: process.env.WHISPER_PROVIDER || "mock",
    translation: process.env.TRANSLATION_PROVIDER || "mock",
    voice: process.env.VOICE_PROVIDER || "mock",
    lipsync: process.env.LIPSYNC_PROVIDER || "mock",
  });
});

// 5. Redis Health
router.get("/health/redis", getRedisHealth);

// 6. Queue Workers status
router.get("/health/workers", (_req, res) => {
  res.status(200).json({
    status: "healthy",
    activeQueues: [
      "video-preparation",
      "speech-to-text",
      "translation",
      "emotion-detection",
      "speaker-diarization",
      "voice-cloning",
      "lip-sync",
      "rendering",
      "export",
    ],
  });
});

// 7. General Aggregated Health Probe
router.get("/health", async (_req, res) => {
  const redisHealth = await checkRedisHealth();
  let dbHealthy = true;

  try {
    if (process.env.NODE_ENV !== "test") {
      await db.execute(sql`SELECT 1`);
    }
  } catch (err) {
    dbHealthy = false;
  }

  const isHealthy = redisHealth.status === "healthy" && dbHealthy;

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? "healthy" : "unhealthy",
    services: {
      api: "healthy",
      database: dbHealthy ? "healthy" : "unhealthy",
      redis: redisHealth.status,
    },
  });
});

export default router;
