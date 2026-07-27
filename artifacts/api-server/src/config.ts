import fs from "fs";
import path from "path";
import { z } from "zod";

export interface QueueConfig {
  name: string;
  concurrency: number;
  retryLimit: number;
}

export const QUEUES = {
  VIDEO_PREPARATION: "video-preparation",
  SPEECH_TO_TEXT: "speech-to-text",
  TRANSLATION: "translation",
  EMOTION_DETECTION: "emotion-detection",
  SPEAKER_DIARIZATION: "speaker-diarization",
  VOICE_CLONING: "voice-cloning",
  LIP_SYNC: "lip-sync",
  RENDERING: "rendering",
  EXPORT: "export",
} as const;

export type QueueType = typeof QUEUES[keyof typeof QUEUES];

// Helper to load secret from Environment or Docker Secrets
function getSecret(key: string, defaultValue = ""): string {
  // 1. Check env variable
  if (process.env[key]) {
    return process.env[key]!;
  }

  // 2. Check Docker Secret path
  const dockerSecretPath = `/run/secrets/${key}`;
  if (fs.existsSync(dockerSecretPath)) {
    try {
      return fs.readFileSync(dockerSecretPath, "utf8").trim();
    } catch (err) {
      console.warn(`[Config] Failed to read Docker Secret at ${dockerSecretPath}:`, err);
    }
  }

  return defaultValue;
}

// Zod Schema to validate required configurations in production
const ConfigSchema = z.object({
  PORT: z.number().default(5000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  JWT_SECRET: z.string().min(8, "JWT_SECRET must be at least 8 characters"),
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid connection string"),
  REDIS_URL: z.string().url("REDIS_URL must be a valid connection string"),
  AWS_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().min(1, "S3_BUCKET is required"),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_ENDPOINT_URL_S3: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  JOB_TIMEOUT_MS: z.number().default(600000),
});

// Load raw values
const rawConfig = {
  PORT: parseInt(process.env.PORT || "5000", 10),
  NODE_ENV: (process.env.NODE_ENV || "development") as any,
  JWT_SECRET: getSecret("JWT_SECRET", "fallback-secret-for-dev"),
  DATABASE_URL: getSecret("DATABASE_URL", "postgresql://postgres:password123@localhost:5432/dubverse"),
  REDIS_URL: getSecret("REDIS_URL", "redis://127.0.0.1:6379"),
  AWS_REGION: getSecret("AWS_REGION", "us-east-1"),
  S3_BUCKET: getSecret("S3_BUCKET", getSecret("S3_BUCKET_NAME", "dubverse-assets")),
  AWS_ACCESS_KEY_ID: getSecret("AWS_ACCESS_KEY_ID"),
  AWS_SECRET_ACCESS_KEY: getSecret("AWS_SECRET_ACCESS_KEY"),
  AWS_ENDPOINT_URL_S3: getSecret("AWS_ENDPOINT_URL_S3"),
  SENTRY_DSN: getSecret("SENTRY_DSN"),
  JOB_TIMEOUT_MS: parseInt(process.env.JOB_TIMEOUT_MS || "600000", 10),
};

// Validate configurations
const validation = ConfigSchema.safeParse(rawConfig);
if (!validation.success) {
  console.error("❌ Invalid configuration setup:");
  console.error(JSON.stringify(validation.error.format(), null, 2));
  process.exit(1);
}

const validatedConfig = validation.data;

export const CONFIG = {
  ...validatedConfig,
  queues: {
    [QUEUES.VIDEO_PREPARATION]: {
      name: QUEUES.VIDEO_PREPARATION,
      concurrency: parseInt(process.env.CONCURRENCY_VIDEO_PREPARATION || "2", 10),
      retryLimit: parseInt(process.env.LIMIT_RETRY_VIDEO_PREPARATION || "3", 10),
    },
    [QUEUES.SPEECH_TO_TEXT]: {
      name: QUEUES.SPEECH_TO_TEXT,
      concurrency: parseInt(process.env.CONCURRENCY_SPEECH_TO_TEXT || "1", 10),
      retryLimit: parseInt(process.env.LIMIT_RETRY_SPEECH_TO_TEXT || "3", 10),
    },
    [QUEUES.TRANSLATION]: {
      name: QUEUES.TRANSLATION,
      concurrency: parseInt(process.env.CONCURRENCY_TRANSLATION || "3", 10),
      retryLimit: parseInt(process.env.LIMIT_RETRY_TRANSLATION || "3", 10),
    },
    [QUEUES.EMOTION_DETECTION]: {
      name: QUEUES.EMOTION_DETECTION,
      concurrency: parseInt(process.env.CONCURRENCY_EMOTION_DETECTION || "2", 10),
      retryLimit: parseInt(process.env.LIMIT_RETRY_EMOTION_DETECTION || "3", 10),
    },
    [QUEUES.SPEAKER_DIARIZATION]: {
      name: QUEUES.SPEAKER_DIARIZATION,
      concurrency: parseInt(process.env.CONCURRENCY_SPEAKER_DIARIZATION || "1", 10),
      retryLimit: parseInt(process.env.LIMIT_RETRY_SPEAKER_DIARIZATION || "3", 10),
    },
    [QUEUES.VOICE_CLONING]: {
      name: QUEUES.VOICE_CLONING,
      concurrency: parseInt(process.env.CONCURRENCY_VOICE_CLONING || "1", 10),
      retryLimit: parseInt(process.env.LIMIT_RETRY_VOICE_CLONING || "3", 10),
    },
    [QUEUES.LIP_SYNC]: {
      name: QUEUES.LIP_SYNC,
      concurrency: parseInt(process.env.CONCURRENCY_LIP_SYNC || "1", 10),
      retryLimit: parseInt(process.env.LIMIT_RETRY_LIP_SYNC || "3", 10),
    },
    [QUEUES.RENDERING]: {
      name: QUEUES.RENDERING,
      concurrency: parseInt(process.env.CONCURRENCY_RENDERING || "2", 10),
      retryLimit: parseInt(process.env.LIMIT_RETRY_RENDERING || "3", 10),
    },
    [QUEUES.EXPORT]: {
      name: QUEUES.EXPORT,
      concurrency: parseInt(process.env.CONCURRENCY_EXPORT || "2", 10),
      retryLimit: parseInt(process.env.LIMIT_RETRY_EXPORT || "3", 10),
    },
  } as Record<QueueType, QueueConfig>,
};
