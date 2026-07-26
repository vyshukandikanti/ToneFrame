import { test, describe } from "node:test";
import assert from "node:assert";
import { getWhisperProvider } from "../services/whisper";
import { translateWithFallback } from "../services/translation";
import { analyzeEmotionsWithFallback } from "../services/emotion";
import { diarizeSpeakersWithFallback } from "../services/speaker";
import { synthesizeVoiceWithFallback } from "../services/voice";
import { processLipSyncWithFallback } from "../services/lipsync";
import { renderVideoWithFallback, exportService } from "../services/rendering";

describe("End-to-End Video Dubbing Pipeline Integration", () => {
  test("Verify E2E stage transformations and asset generation consistency", async () => {
    // 1. Mock parameters
    const mockAudioPath = "src/tests/assets/dummy.wav";
    const mockVideoKey = "projects/uuid/video.mp4";
    const mockAudioKey = "projects/uuid/audio.wav";
    const mockSubsKey = "projects/uuid/subtitles.srt";

    console.log("[E2E Test] Starting mock pipeline execution...");

    // 2. Speech-to-Text Stage
    const whisper = getWhisperProvider();
    const whisperResult = await whisper.transcribe(mockAudioPath, { language: "en" });
    assert.ok(whisperResult.transcript.length > 0);
    assert.ok(whisperResult.segments.length > 0);
    console.log("[E2E Test] Speech Recognition: Success");

    // 3. Translation Stage
    const transSegs = whisperResult.segments.map((s, idx) => ({
      originalSegmentId: `seg-${idx}`,
      sourceText: s.text,
      startTime: s.start,
      endTime: s.end,
    }));
    const transResult = await translateWithFallback(transSegs, "en", "hi", {});
    assert.strictEqual(transResult.segments.length, transSegs.length);
    console.log("[E2E Test] Translation Stage: Success");

    // 4. Emotion Detection Stage
    const emotionInput = transSegs.map((s) => ({
      id: s.originalSegmentId,
      text: s.sourceText,
      start: s.startTime,
      end: s.endTime,
    }));
    const emotionResult = await analyzeEmotionsWithFallback(mockAudioPath, emotionInput);
    assert.strictEqual(emotionResult.segments.length, emotionInput.length);
    console.log("[E2E Test] Emotion Detection Stage: Success");

    // 5. Speaker Diarization Stage
    const diarizeResult = await diarizeSpeakersWithFallback(mockAudioPath, 2);
    assert.ok(diarizeResult.segments.length > 0);
    assert.ok(diarizeResult.speakers.length > 0);
    console.log("[E2E Test] Speaker Diarization Stage: Success");

    // 6. Voice Generation (TTS)
    const ttsResult = await synthesizeVoiceWithFallback({
      text: "Translated audio segment content",
      language: "hi",
      voiceName: "SPEAKER_00",
    });
    assert.ok(ttsResult.audioBuffer.length > 0);
    console.log("[E2E Test] Voice Cloning Stage: Success");

    // 7. Lip Sync Stage
    const lipsyncResult = await processLipSyncWithFallback({
      videoKey: mockVideoKey,
      audioKey: mockAudioKey,
      startTime: 0,
      endTime: 5,
    });
    assert.ok(lipsyncResult.outputVideoKey.includes("_lipsynced.mp4"));
    console.log("[E2E Test] Lip Sync Stage: Success");

    // 8. FFmpeg Rendering Stage
    const renderResult = await renderVideoWithFallback({
      lipSyncVideoKey: lipsyncResult.outputVideoKey,
      audioKey: mockAudioKey,
      subtitlesKey: mockSubsKey,
      hasWatermark: true,
      resolution: "1080p",
      format: "mp4",
    });
    assert.strictEqual(renderResult.resolution, "1080p");
    assert.strictEqual(renderResult.format, "mp4");
    assert.ok(renderResult.renderedVideoBuffer.length > 0);
    assert.ok(renderResult.thumbnailBuffer.length > 0);
    assert.ok(renderResult.previewVideoBuffer.length > 0);
    assert.ok(renderResult.waveformBuffer.length > 0);
    console.log("[E2E Test] Rendering Stage: Success");

    // 9. Export Packaging Stage
    const exportResult = await exportService.package({
      projectId: "project-uuid",
      renderJobId: "render-uuid",
      exportType: "video_package",
    });
    assert.ok(exportResult.packageBuffer.length > 0);
    assert.strictEqual(exportResult.format, "zip");
    console.log("[E2E Test] Export packaging: Success");
  });
});
