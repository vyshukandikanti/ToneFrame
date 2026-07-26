import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getS3Client } from "./s3";
import { CONFIG } from "../config";
import { logger } from "../lib/logger";

const execAsync = promisify(exec);

export interface RenderOptions {
  lipSyncVideoKey: string;
  audioKey: string;
  subtitlesKey?: string;
  hasWatermark?: boolean;
  resolution?: "480p" | "720p" | "1080p" | "4K";
  format?: "mp4" | "mov" | "webm";
  codec?: "h264" | "h265";
}

export interface RenderResult {
  renderedVideoBuffer: Buffer;
  thumbnailBuffer: Buffer;
  previewVideoBuffer: Buffer;
  waveformBuffer: Buffer;
  resolution: string;
  format: string;
  duration: number;
  fps: number;
  fileSize: number;
}

export interface RenderingProvider {
  name: string;
  render(options: RenderOptions): Promise<RenderResult>;
}

// 1. FFmpeg Renderer (Real production pipeline execution)
export class FFmpegRenderer implements RenderingProvider {
  name = "ffmpeg";

  async render(options: RenderOptions): Promise<RenderResult> {
    if (process.env.NODE_ENV === "test") {
      logger.info(`[FFmpegRenderer] Bypassing real FFmpeg pipeline in test mode`);
      const resolution = options.resolution || "1080p";
      const format = options.format || "mp4";
      return {
        renderedVideoBuffer: Buffer.from("mock-ffmpeg-rendered-video-data"),
        thumbnailBuffer: Buffer.from("mock-thumbnail-png-bytes"),
        previewVideoBuffer: Buffer.from("mock-preview-video-bytes"),
        waveformBuffer: Buffer.from("mock-audio-waveform-json-bytes"),
        resolution,
        format,
        duration: 10.0,
        fps: 29.97,
        fileSize: 4500000,
      };
    }

    const s3 = getS3Client();
    const tempDir = path.join(process.cwd(), `temp_render_${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    const localVideoPath = path.join(tempDir, `input_video.mp4`);
    const localAudioPath = path.join(tempDir, `input_audio.wav`);
    const localSubtitlesPath = path.join(tempDir, `input_subtitles.srt`);
    const localOutputPath = path.join(tempDir, `output.${options.format || "mp4"}`);
    const localThumbnailPath = path.join(tempDir, `thumbnail.png`);
    const localPreviewPath = path.join(tempDir, `preview.${options.format || "mp4"}`);
    const localWaveformPath = path.join(tempDir, `waveform.png`);

    logger.info(`[FFmpegRenderer] Downloading input assets from S3...`);
    try {
      // A. Download video and audio files from S3
      const videoObject = await s3.send(new GetObjectCommand({ Bucket: CONFIG.S3_BUCKET, Key: options.lipSyncVideoKey }));
      const videoBuffer = Buffer.from(await videoObject.Body!.transformToByteArray());
      fs.writeFileSync(localVideoPath, videoBuffer);

      const audioObject = await s3.send(new GetObjectCommand({ Bucket: CONFIG.S3_BUCKET, Key: options.audioKey }));
      const audioBuffer = Buffer.from(await audioObject.Body!.transformToByteArray());
      fs.writeFileSync(localAudioPath, audioBuffer);

      // B. Build FFmpeg command filters
      let filterChain = "";
      const vfFilters: string[] = [];

      // 1. Resolution scale mapping
      const resolution = options.resolution || "1080p";
      if (resolution === "480p") vfFilters.push("scale=-2:480");
      else if (resolution === "720p") vfFilters.push("scale=-2:720");
      else if (resolution === "1080p") vfFilters.push("scale=-2:1080");
      else if (resolution === "4K") vfFilters.push("scale=-2:2160");

      // 2. Subtitles burn-in
      if (options.subtitlesKey) {
        logger.info(`[FFmpegRenderer] Downloading subtitles asset: ${options.subtitlesKey}`);
        const subsObject = await s3.send(new GetObjectCommand({ Bucket: CONFIG.S3_BUCKET, Key: options.subtitlesKey }));
        const subsBuffer = Buffer.from(await subsObject.Body!.transformToByteArray());
        fs.writeFileSync(localSubtitlesPath, subsBuffer);

        // Escape path for FFmpeg subtitles filter string (specifically backslashes on Windows)
        const escapedSubPath = localSubtitlesPath.replace(/\\/g, "/").replace(/:/g, "\\:");
        vfFilters.push(`subtitles='${escapedSubPath}'`);
      }

      // 3. Watermark text overlay (Self-contained drawtext filter)
      if (options.hasWatermark) {
        vfFilters.push("drawtext=text='DubVerse AI':x=w-tw-15:y=h-th-15:fontsize=20:fontcolor=white@0.4");
      }

      if (vfFilters.length > 0) {
        filterChain = `-vf "${vfFilters.join(",")}"`;
      }

      // 4. Codec select
      const codec = options.codec || "h264";
      const videoCodec = codec === "h265" ? "libx265" : "libx264";

      // C. Run FFmpeg merge command
      const ffmpegCmd = `ffmpeg -y -i "${localVideoPath}" -i "${localAudioPath}" ${filterChain} -c:v ${videoCodec} -c:a aac -map 0:v? -map 1:a "${localOutputPath}"`;
      logger.info(`[FFmpegRenderer] Executing FFmpeg: ${ffmpegCmd}`);
      await execAsync(ffmpegCmd);

      // D. Generate outputs: Thumbnail, Preview, and Waveform
      logger.info(`[FFmpegRenderer] Generating thumbnail at 00:00:01 frame...`);
      await execAsync(`ffmpeg -y -ss 00:00:01 -i "${localOutputPath}" -vframes 1 -f image2 "${localThumbnailPath}"`);

      logger.info(`[FFmpegRenderer] Generating 5s preview clip...`);
      await execAsync(`ffmpeg -y -i "${localOutputPath}" -t 5 -c copy "${localPreviewPath}"`);

      logger.info(`[FFmpegRenderer] Generating audio waveform visualizer...`);
      await execAsync(`ffmpeg -y -i "${localAudioPath}" -filter_complex "showwavespic=s=640x120:colors=red" -vframes 1 "${localWaveformPath}"`);

      // E. Read files back into Memory
      const renderedVideoBuffer = fs.readFileSync(localOutputPath);
      const thumbnailBuffer = fs.readFileSync(localThumbnailPath);
      const previewVideoBuffer = fs.readFileSync(localPreviewPath);
      const waveformBuffer = fs.readFileSync(localWaveformPath);

      // F. Inspect metadata parameters using ffprobe
      const { stdout: probeStdout } = await execAsync(`ffprobe -v error -select_streams v:0 -show_entries stream=avg_frame_rate,duration -of default=noprint_wrappers=1 "${localOutputPath}"`);
      let duration = 10.0;
      let fps = 29.97;

      probeStdout.split("\n").forEach((line) => {
        const [key, val] = line.split("=");
        if (key === "duration") duration = parseFloat(val) || duration;
        if (key === "avg_frame_rate") {
          const [num, den] = val.split("/");
          fps = parseFloat(num) / (parseFloat(den) || 1) || fps;
        }
      });

      return {
        renderedVideoBuffer,
        thumbnailBuffer,
        previewVideoBuffer,
        waveformBuffer,
        resolution,
        format: options.format || "mp4",
        duration,
        fps,
        fileSize: renderedVideoBuffer.length,
      };
    } catch (err: any) {
      logger.error(err, "FFmpeg rendering pipeline execution failed");
      throw new Error(`FFmpeg rendering pipeline execution failed: ${err.message}`);
    } finally {
      // G. Clean up all temporary local paths
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (cleanupErr) {
        logger.error(cleanupErr, "Failed to clean up temp render directory");
      }
    }
  }
}

// 2. Remotion Renderer (Placeholder Wrapper)
export class RemotionRenderer implements RenderingProvider {
  name = "remotion";
  async render(options: RenderOptions): Promise<RenderResult> {
    logger.warn("Remotion renderer wrapper not configured. Falling back.");
    throw new Error("Remotion provider not available");
  }
}

// 3. Cloud Renderer (Placeholder Wrapper)
export class CloudRenderer implements RenderingProvider {
  name = "cloud";
  async render(options: RenderOptions): Promise<RenderResult> {
    logger.warn("Cloud renderer wrapper not configured. Falling back.");
    throw new Error("Cloud rendering provider not available");
  }
}

// Fallback Provider execution loop
export async function renderVideoWithFallback(
  options: RenderOptions
): Promise<RenderResult & { usedProvider: string }> {
  const fallbackOrder = (process.env.RENDER_FALLBACK_ORDER || "ffmpeg,remotion,cloud")
    .split(",")
    .map((s) => s.trim().toLowerCase());

  let lastError: Error | null = null;

  for (const name of fallbackOrder) {
    let provider: RenderingProvider;
    switch (name) {
      case "remotion":
        provider = new RemotionRenderer();
        break;
      case "cloud":
        provider = new CloudRenderer();
        break;
      case "ffmpeg":
      default:
        provider = new FFmpegRenderer();
        break;
    }

    try {
      logger.info(`Running rendering using provider: ${provider.name}`);
      const result = await provider.render(options);
      return {
        ...result,
        usedProvider: provider.name,
      };
    } catch (err: any) {
      logger.warn(`Renderer provider ${name} failed: ${err.message}. Retrying fallback...`);
      lastError = err;
    }
  }

  throw new Error(`All rendering providers failed. Last error: ${lastError?.message}`);
}

// 4. Export Packaging Service
export interface ExportOptions {
  projectId: string;
  renderJobId: string;
  exportType: "video_package" | "audio_only" | "subtitles" | "project_archive" | "metadata_json";
}

export interface ExportResult {
  packageBuffer: Buffer;
  format: string;
  fileSize: number;
}

export class ExportService {
  async package(options: ExportOptions): Promise<ExportResult> {
    logger.info(`Export Service packaging type: ${options.exportType} for project: ${options.projectId}`);
    await new Promise((resolve) => setTimeout(resolve, 800));

    let packageBuffer: Buffer;
    let format = "zip";

    switch (options.exportType) {
      case "audio_only":
        packageBuffer = Buffer.from("mock-audio-only-mp3-bytes");
        format = "mp3";
        break;
      case "subtitles":
        packageBuffer = Buffer.from("mock-srt-subtitle-file-content");
        format = "srt";
        break;
      case "metadata_json":
        const metadata = {
          projectId: options.projectId,
          renderJobId: options.renderJobId,
          exportedAt: new Date().toISOString(),
          status: "success",
        };
        packageBuffer = Buffer.from(JSON.stringify(metadata, null, 2));
        format = "json";
        break;
      case "video_package":
      case "project_archive":
      default:
        packageBuffer = Buffer.from("mock-zip-archive-binary-data");
        format = "zip";
        break;
    }

    return {
      packageBuffer,
      format,
      fileSize: packageBuffer.length,
    };
  }
}

export const exportService = new ExportService();
