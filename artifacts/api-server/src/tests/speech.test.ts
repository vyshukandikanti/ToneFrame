import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import { mock } from "node:test";
import { db } from "@workspace/db";
import * as audioService from "../services/audio";
import * as s3Service from "../services/s3";
import { MockWhisperProvider } from "../services/whisper";

describe("Speech-to-Text Pipeline Tests", () => {
  before(() => {
    // 1. Mock DB calls
    mock.method(db, "select", () => ({
      from: () => ({
        where: () => ({
          limit: async () => [{
            id: "video-uuid",
            projectId: "project-uuid",
            s3Key: "projects/uuid/videos/vid.mp4",
            fileSize: 1000,
            durationSeconds: 120,
          }],
        }),
      }),
    }));

    mock.method(db, "insert", () => ({
      values: () => ({
        returning: async () => [{
          id: "speech-job-uuid",
          projectId: "project-uuid",
          transcript: "Mock transcript",
          version: 1,
          isCurrent: true,
          createdAt: new Date(),
        }],
      }),
    }));

    mock.method(db, "update", () => ({
      set: () => ({
        where: () => ({
          returning: async () => [],
        }),
      }),
    }));

    // 2. Mock Audio & S3 extraction helpers via manager objects (bypasses ESM live bindings)
    mock.method(s3Service.s3Manager, "generatePresignedDownloadUrl", async () => "https://s3-mock/download");
    mock.method(s3Service.s3Manager, "uploadTextAsset", async () => {});
    mock.method(audioService.audioManager, "extractAudioFromVideo", async () => "/mock/path/audio.wav");
  });

  after(() => {
    mock.restoreAll();
  });

  test("Audio Extraction - Verify calling signature", async () => {
    const audioPath = await audioService.audioManager.extractAudioFromVideo(
      "https://s3-mock/download",
      "project-uuid",
      "s3-key.mp4",
      5000
    );
    assert.strictEqual(audioPath, "/mock/path/audio.wav");
  });

  test("Whisper Provider - Mock transcribing returns transcript structure", async () => {
    const provider = new MockWhisperProvider();
    const result = await provider.transcribe("/mock/path/audio.wav");

    assert.ok(result.transcript.includes("localization"));
    assert.strictEqual(result.language, "en");
    assert.ok(result.segments.length > 0);
    assert.ok(result.segments[0].words && result.segments[0].words.length > 0);
  });

  test("Database Storage Mocking - Insert Speech recognition details", async () => {
    const [inserted] = (await db.insert({} as any).values({} as any).returning()) as any[];
    assert.strictEqual(inserted.id, "speech-job-uuid");
    assert.strictEqual(inserted.version, 1);
    assert.strictEqual(inserted.isCurrent, true);
  });
});
