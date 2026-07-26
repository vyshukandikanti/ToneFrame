import ffmpeg from "fluent-ffmpeg";
// @ts-ignore
import ffprobeStatic from "ffprobe-static";

// Set ffprobe path from the static binary
ffmpeg.setFfprobePath(ffprobeStatic.path);

export interface VideoMetadata {
  width: number;
  height: number;
  fps: string;
  codec: string;
  durationSeconds: number;
  bitrate: number;
  resolution: string;
}

export function extractVideoMetadata(videoPathOrUrl: string): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPathOrUrl, (err, metadata) => {
      if (err) {
        return reject(err);
      }

      try {
        const videoStream = metadata.streams?.find((s) => s.codec_type === "video");
        if (!videoStream) {
          return reject(new Error("No video stream found in media file"));
        }

        const width = videoStream.width || 0;
        const height = videoStream.height || 0;
        const resolution = width && height ? `${width}x${height}` : "unknown";
        const codec = videoStream.codec_name || "unknown";

        // Parse average frame rate (avg_frame_rate is e.g. "30000/1001" or "25/1")
        let fps = "unknown";
        if (videoStream.avg_frame_rate) {
          const parts = videoStream.avg_frame_rate.split("/");
          if (parts.length === 2) {
            const num = parseFloat(parts[0]);
            const den = parseFloat(parts[1]);
            if (den !== 0) {
              fps = (num / den).toFixed(2);
            }
          } else {
            fps = videoStream.avg_frame_rate;
          }
        }

        // Duration (in seconds)
        const durationStr = String(videoStream.duration || metadata.format?.duration || "0");
        let durationSeconds = parseFloat(durationStr);
        durationSeconds = Math.round(durationSeconds);

        // Bitrate (in bps)
        const bitrateStr = String(videoStream.bit_rate || metadata.format?.bit_rate || "0");
        const bitrate = parseInt(bitrateStr, 10) || 0;

        resolve({
          width,
          height,
          fps,
          codec,
          durationSeconds,
          bitrate,
          resolution,
        });
      } catch (parseErr) {
        reject(parseErr);
      }
    });
  });
}
