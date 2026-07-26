import { test, describe } from "node:test";
import assert from "node:assert";
import { MockVoiceProvider, getEmotionSpeechParameters, synthesizeVoiceWithFallback } from "../services/voice";

describe("Voice Cloning & TTS Pipeline Tests", () => {
  test("Emotion Parameters Mapping - Happy/Sad modifiers", () => {
    const happy = getEmotionSpeechParameters("happy", 1.0);
    assert.strictEqual(happy.speed, 1.1);
    assert.strictEqual(happy.pitch, 0.15);

    const sad = getEmotionSpeechParameters("sad", 1.0);
    assert.strictEqual(sad.speed, 0.85);
    assert.strictEqual(sad.pitch, -0.15);
  });

  test("Mock Voice Provider - Returns PCM WAV file with valid headers", async () => {
    const provider = new MockVoiceProvider();
    const result = await provider.synthesize({ text: "Hello DubVerse!", language: "hi" });

    assert.strictEqual(result.sampleRate, 16000);
    assert.ok(result.duration >= 1.5);
    assert.ok(result.audioBuffer.length > 44);

    // Verify WAV format header bytes
    assert.strictEqual(result.audioBuffer.toString("utf8", 0, 4), "RIFF");
    assert.strictEqual(result.audioBuffer.toString("utf8", 8, 12), "WAVE");
  });

  test("Fallback Loop - Traverses providers successfully", async () => {
    process.env.VOICE_FALLBACK_ORDER = "fish,mock";
    const result = await synthesizeVoiceWithFallback({ text: "Demo fallback text", language: "ta" });

    assert.strictEqual(result.usedProvider, "mock");
    assert.ok(result.audioBuffer.length > 0);
  });
});
