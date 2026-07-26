import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import { logger } from "../lib/logger";

const TEMP_DIR = path.join(process.cwd(), "scratch", "temp");

// Reusable timestamp formatter
function formatTimestamp(seconds: number, separator: "," | "."): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}${separator}${String(ms).padStart(3, "0")}`;
}

export function generateSrt(segments: any[]): string {
  return segments
    .map((seg, i) => {
      const idx = i + 1;
      const start = formatTimestamp(seg.start, ",");
      const end = formatTimestamp(seg.end, ",");
      return `${idx}\n${start} --> ${end}\n${seg.text.trim()}\n`;
    })
    .join("\n");
}

export function generateVtt(segments: any[]): string {
  const header = "WEBVTT\n\n";
  const body = segments
    .map((seg, i) => {
      const idx = i + 1;
      const start = formatTimestamp(seg.start, ".");
      const end = formatTimestamp(seg.end, ".");
      return `${idx}\n${start} --> ${end}\n${seg.text.trim()}\n`;
    })
    .join("\n");
  return header + body;
}

export interface AudioCacheInfo {
  s3Key: string;
  fileSize: number;
  extractedPath: string;
}

export const audioManager = {
  async extractAudioFromVideo(
    videoPathOrUrl: string,
    projectId: string,
    s3Key: string,
    fileSize: number
  ): Promise<string> {
    const projectTempDir = path.join(TEMP_DIR, projectId);
    if (!fs.existsSync(projectTempDir)) {
      fs.mkdirSync(projectTempDir, { recursive: true });
    }

    const cachedAudioPath = path.join(projectTempDir, "audio.wav");
    const cacheInfoPath = path.join(projectTempDir, "cache_info.json");

    // 1. Audio Cache Check
    if (fs.existsSync(cachedAudioPath) && fs.existsSync(cacheInfoPath)) {
      try {
        const rawInfo = fs.readFileSync(cacheInfoPath, "utf-8");
        const info = JSON.parse(rawInfo) as AudioCacheInfo;

        // If key and size match, cache is valid!
        if (info.s3Key === s3Key && info.fileSize === fileSize && fs.existsSync(info.extractedPath)) {
          logger.info(`Audio cache hit for project ${projectId}. Reusing extracted audio: ${info.extractedPath}`);
          return info.extractedPath;
        }
      } catch (cacheErr) {
        logger.warn(cacheErr, `Could not parse audio cache info for project ${projectId}`);
      }
    }

    logger.info(`Audio cache miss for project ${projectId}. Commencing audio extraction from: ${videoPathOrUrl}`);

    // 2. Audio extraction using FFmpeg
    return new Promise((resolve, reject) => {
      ffmpeg(videoPathOrUrl)
        .noVideo()
        .audioCodec("pcm_s16le") // extract uncompressed PCM audio
        .audioChannels(1) // mono channel
        .audioFrequency(16000) // 16kHz sample rate (recommended for speech models)
        .format("wav")
        .on("start", (cmd) => {
          logger.debug(`FFmpeg command: ${cmd}`);
        })
        .on("end", () => {
          logger.info(`Successfully extracted audio to: ${cachedAudioPath}`);

          // Write cache details
          const info: AudioCacheInfo = {
            s3Key,
            fileSize,
            extractedPath: cachedAudioPath,
          };
          fs.writeFileSync(cacheInfoPath, JSON.stringify(info, null, 2));

          resolve(cachedAudioPath);
        })
        .on("error", (err) => {
          logger.error(err, "FFmpeg audio extraction failed");
          reject(new Error(`FFmpeg audio extraction failed: ${err.message}`));
        })
        .save(cachedAudioPath);
    });
  }
};

export async function extractAudioFromVideo(
  videoPathOrUrl: string,
  projectId: string,
  s3Key: string,
  fileSize: number
): Promise<string> {
  return audioManager.extractAudioFromVideo(videoPathOrUrl, projectId, s3Key, fileSize);
}

export function cleanupProjectAudioCache(projectId: string) {
  const projectTempDir = path.join(TEMP_DIR, projectId);
  if (fs.existsSync(projectTempDir)) {
    try {
      fs.rmSync(projectTempDir, { recursive: true, force: true });
      logger.info(`Cleaned up temp audio cache for project: ${projectId}`);
    } catch (err) {
      logger.error(err, `Error cleaning up audio cache for project ${projectId}`);
    }
  }
}
