import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import { mock } from "node:test";
import { db } from "@workspace/db";
import { MockTranslationProvider, translateWithFallback, getTranslationMemory } from "../services/translation";

describe("Translation Engine Pipeline Tests", () => {
  before(() => {
    // Mock DB calls for Translation Memory lookups
    mock.method(db, "select", () => ({
      from: () => ({
        innerJoin: () => ({
          innerJoin: () => ({
            where: () => ({
              limit: async () => [{
                text: "Translated hello from TM"
              }],
            })
          })
        })
      })
    }));
  });

  after(() => {
    mock.restoreAll();
  });

  test("Translation Memory - Query matches text and returns cache", async () => {
    const cached = await getTranslationMemory("Hello", "en", "hi");
    assert.strictEqual(cached, "Translated hello from TM");
  });

  test("Glossary Substitutions - Mock translates and replaces glossary mapping", async () => {
    const provider = new MockTranslationProvider();
    const segments = [
      {
        originalSegmentId: "seg-1",
        sourceText: "Hello Google and OpenAI.",
        startTime: 0,
        endTime: 2,
      }
    ];
    const glossary = {
      "google": "Alphabet",
      "openai": "ChatGPT-maker"
    };

    const result = await provider.translate(segments, "en", "hi", glossary);
    assert.ok(result.translatedText.includes("Alphabet"));
    assert.ok(result.translatedText.includes("ChatGPT-maker"));
  });

  test("Fallback Loop - Proceeds to next provider if first failures occur", async () => {
    process.env.TRANSLATION_FALLBACK_ORDER = "nllb,mock";
    const segments = [
      {
        originalSegmentId: "seg-1",
        sourceText: "Test text",
        startTime: 0,
        endTime: 2,
      }
    ];

    const result = await translateWithFallback(segments, "en", "hi", {});
    assert.strictEqual(result.usedProvider, "mock");
    assert.strictEqual(result.retryCount, 1);
  });
});
