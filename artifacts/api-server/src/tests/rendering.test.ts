import { test, describe } from "node:test";
import assert from "node:assert";
import { FFmpegRenderer, renderVideoWithFallback, exportService } from "../services/rendering";

describe("Rendering & Export Pipeline Tests", () => {
  test("FFmpeg Renderer - Generates valid video render asset details", async () => {
    const provider = new FFmpegRenderer();
    const result = await provider.render({
      lipSyncVideoKey: "video.mp4",
      audioKey: "audio.wav",
      resolution: "1080p",
      format: "mp4",
    });

    assert.strictEqual(result.resolution, "1080p");
    assert.strictEqual(result.format, "mp4");
    assert.ok(result.renderedVideoBuffer.length > 0);
    assert.ok(result.previewVideoBuffer.length > 0);
  });

  test("Export Service - Packages project assets according to exportType", async () => {
    const subtitlesResult = await exportService.package({
      projectId: "project-uuid",
      renderJobId: "render-job-uuid",
      exportType: "subtitles",
    });
    assert.strictEqual(subtitlesResult.format, "srt");
    assert.strictEqual(subtitlesResult.packageBuffer.toString(), "mock-srt-subtitle-file-content");

    const jsonResult = await exportService.package({
      projectId: "project-uuid",
      renderJobId: "render-job-uuid",
      exportType: "metadata_json",
    });
    assert.strictEqual(jsonResult.format, "json");
    const parsed = JSON.parse(jsonResult.packageBuffer.toString());
    assert.strictEqual(parsed.projectId, "project-uuid");
  });

  test("Fallback Loop - Walks through providers successfully", async () => {
    process.env.RENDER_FALLBACK_ORDER = "remotion,ffmpeg";
    const result = await renderVideoWithFallback({
      lipSyncVideoKey: "video.mp4",
      audioKey: "audio.wav",
    });

    assert.strictEqual(result.usedProvider, "ffmpeg");
    assert.ok(result.renderedVideoBuffer.length > 0);
  });
});
