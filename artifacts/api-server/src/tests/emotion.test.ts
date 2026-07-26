import { test, describe } from "node:test";
import assert from "node:assert";
import { MockEmotionProvider, fuseEmotions, smoothEmotionTimeline, analyzeEmotionsWithFallback } from "../services/emotion";

describe("Emotion Detection Pipeline Tests", () => {
  test("Emotion Fusion - Matches highest confidence affect and maps low confidence to unknown", () => {
    // Both above threshold, audio higher confidence
    const fused1 = fuseEmotions("neutral", 0.5, "happy", 0.8);
    assert.strictEqual(fused1.finalEmotion, "happy");
    assert.strictEqual(fused1.confidence, 0.8);
    assert.strictEqual(fused1.intensity, 0.65);

    // Confidence below threshold (e.g. set to 0.6)
    process.env.EMOTION_CONFIDENCE_THRESHOLD = "0.6";
    const fused2 = fuseEmotions("neutral", 0.3, "happy", 0.5);
    assert.strictEqual(fused2.finalEmotion, "unknown");
  });

  test("Emotion Smoothing - Segments shorter than threshold are smoothed if deviating from both neighbors", () => {
    // Config smoothing threshold: 2 seconds
    process.env.EMOTION_SMOOTHING_WINDOW = "2";

    const segments: any[] = [
      { segmentId: "1", startTime: 0, endTime: 3, finalEmotion: "neutral", confidence: 0.8 },
      { segmentId: "2", startTime: 3, endTime: 4.5, finalEmotion: "happy", confidence: 0.9, intensity: 0.85 }, // duration 1.5s < 2s
      { segmentId: "3", startTime: 4.5, endTime: 8, finalEmotion: "neutral", confidence: 0.7 }
    ];

    const smoothed = smoothEmotionTimeline(segments);
    assert.strictEqual(smoothed[1].finalEmotion, "neutral");
    assert.strictEqual(smoothed[1].confidence, 0.75); // average of neighbors
  });

  test("Mock Provider - Generates analysis segments with textual and acoustic data", async () => {
    const provider = new MockEmotionProvider();
    const result = await provider.analyze("/mock/audio.wav", [
      { id: "seg-1", text: "Exciting day!", start: 0, end: 3.5 }
    ]);

    assert.strictEqual(result.modelVersion, "mock-v1.0");
    assert.ok(result.segments.length > 0);
    assert.strictEqual(result.segments[0].segmentId, "seg-1");
  });

  test("Fallback Loop - Proceeds to next provider if first fails", async () => {
    process.env.EMOTION_FALLBACK_ORDER = "pytorch,mock";
    const result = await analyzeEmotionsWithFallback("/mock/audio.wav", [
      { id: "seg-1", text: "Exciting day!", start: 0, end: 3.5 }
    ]);

    assert.strictEqual(result.usedProvider, "mock");
  });
});
