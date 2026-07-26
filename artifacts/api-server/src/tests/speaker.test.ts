import { test, describe } from "node:test";
import assert from "node:assert";
import { MockSpeakerProvider, diarizeSpeakersWithFallback } from "../services/speaker";

describe("Speaker Diarization Pipeline Tests", () => {
  test("Speaker Statistics - Mock generates valid timelines and classifications", async () => {
    const provider = new MockSpeakerProvider();
    const result = await provider.diarize("/mock/audio.wav");

    assert.strictEqual(result.speakers.length, 2);
    assert.strictEqual(result.speakers[0].speakerLabel, "SPEAKER_00");
    assert.strictEqual(result.speakers[1].speakerLabel, "SPEAKER_01");

    // Calc stats manually to verify logic
    const totalSpeakingTime = result.segments
      .filter((s) => s.speakerLabel === "SPEAKER_00")
      .reduce((sum, s) => sum + (s.endTime - s.startTime), 0);
    assert.strictEqual(totalSpeakingTime, 3.5);
  });

  test("Fallback Loop - Proceeds to next provider if first failures occur", async () => {
    process.env.SPEAKER_FALLBACK_ORDER = "pyannote,mock";
    const result = await diarizeSpeakersWithFallback("/mock/audio.wav");

    assert.strictEqual(result.usedProvider, "mock");
    assert.strictEqual(result.speakers.length, 2);
  });
});
