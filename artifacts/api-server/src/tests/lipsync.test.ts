import { test, describe } from "node:test";
import assert from "node:assert";
import { MockLipSyncProvider, validateQualityScore, processLipSyncWithFallback } from "../services/lipsync";

describe("AI Lip Sync Pipeline Tests", () => {
  test("Quality score validation constraints", () => {
    const validResult = {
      outputVideoKey: "video_sync.mp4",
      lipSyncScore: 0.85,
      frameAlignment: 0.94,
      audioVideoOffset: -0.02,
    };
    assert.ok(validateQualityScore(validResult));

    const invalidScoreResult = { ...validResult, lipSyncScore: 0.5 };
    assert.strictEqual(validateQualityScore(invalidScoreResult), false);

    const invalidOffsetResult = { ...validResult, audioVideoOffset: 0.15 };
    assert.strictEqual(validateQualityScore(invalidOffsetResult), false);
  });

  test("Mock Provider - Generates valid video sync fields", async () => {
    const provider = new MockLipSyncProvider();
    const result = await provider.process({
      videoKey: "input.mp4",
      audioKey: "input.wav",
      startTime: 0,
      endTime: 5.5,
    });

    assert.strictEqual(result.outputVideoKey, "input_lipsynced.mp4");
    assert.ok(result.lipSyncScore >= 0.7);
  });

  test("Fallback Loop - Walks through providers successfully", async () => {
    process.env.LIP_SYNC_FALLBACK_ORDER = "wav2lip,mock";
    const result = await processLipSyncWithFallback({
      videoKey: "input.mp4",
      audioKey: "input.wav",
      startTime: 0,
      endTime: 5.5,
    });

    assert.strictEqual(result.usedProvider, "mock");
    assert.ok(result.lipSyncScore >= 0.7);
  });
});
