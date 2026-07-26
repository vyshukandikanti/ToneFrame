import { db, projectGlossariesTable, translationJobsTable, translatedSegmentsTable, speechSegmentsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "../lib/logger";

export const SUPPORTED_LANGUAGES = ["te", "ta", "kn", "hi", "ml", "mr", "bn", "en"];

export interface TranslationSegment {
  originalSegmentId: string;
  sourceText: string;
  startTime: number;
  endTime: number;
}

export interface TranslatedSegmentResult {
  originalSegmentId: string;
  translatedText: string;
  startTime: number;
  endTime: number;
  confidence?: number;
}

export interface TranslationProviderResult {
  translatedText: string;
  segments: TranslatedSegmentResult[];
  confidence?: number;
  tokenUsage?: number;
}

export interface TranslationProvider {
  name: string;
  translate(
    segments: TranslationSegment[],
    sourceLang: string,
    targetLang: string,
    glossary: Record<string, string>
  ): Promise<TranslationProviderResult>;
}

// Language code mapper to NLLB language tags (FLORES-200 format)
const NLLB_LANG_MAP: Record<string, string> = {
  en: "eng_Latn",
  hi: "hin_Deva",
  ta: "tam_Taml",
  te: "tel_Telu",
  ml: "mal_Mlym",
  kn: "kan_Knda",
  mr: "mar_Deva",
  bn: "ben_Beng",
};

// 1. Mock Provider
export class MockTranslationProvider implements TranslationProvider {
  name = "mock";

  async translate(
    segments: TranslationSegment[],
    sourceLang: string,
    targetLang: string,
    glossary: Record<string, string>
  ): Promise<TranslationProviderResult> {
    logger.info(`Mocking Translation [${sourceLang} -> ${targetLang}] for ${segments.length} segments`);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const translatedSegments = segments.map((seg) => {
      let text = `[${targetLang.toUpperCase()}] ${seg.sourceText}`;
      for (const [srcWord, tgtWord] of Object.entries(glossary)) {
        const regex = new RegExp(`\\b${srcWord}\\b`, "gi");
        text = text.replace(regex, tgtWord);
      }

      return {
        originalSegmentId: seg.originalSegmentId,
        translatedText: text,
        startTime: seg.startTime,
        endTime: seg.endTime,
        confidence: 0.95,
      };
    });

    return {
      translatedText: translatedSegments.map((s) => s.translatedText).join(" "),
      segments: translatedSegments,
      confidence: 0.95,
    };
  }
}

// 2. OpenAI Translation Provider
export class OpenAITranslationProvider implements TranslationProvider {
  name = "openai";

  async translate(
    segments: TranslationSegment[],
    sourceLang: string,
    targetLang: string,
    glossary: Record<string, string>
  ): Promise<TranslationProviderResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OpenAI Translation requires OPENAI_API_KEY");

    logger.info(`Translating ${segments.length} segments via OpenAI [${sourceLang} -> ${targetLang}]`);

    const glossaryInstruction = Object.keys(glossary).length > 0
      ? `Observe these glossary terms and translate them exactly as mapped:\n${Object.entries(glossary).map(([k, v]) => `- "${k}" -> "${v}"`).join("\n")}`
      : "";

    const userPrompt = `Translate this JSON array of transcript segments from "${sourceLang}" to "${targetLang}".
Preserve meaning, context, and structure across segment boundaries. Keep the exact index order.

JSON array:
${JSON.stringify(segments.map((s, idx) => ({ id: idx, text: s.sourceText })), null, 2)}

${glossaryInstruction}

Output ONLY a JSON object: {"translations": ["translation1", "translation2", ...]}`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_TRANSLATION_MODEL || "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a professional video localization translator. You translate transcript segments preserving context and tone." },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI translation API failed (${res.status}): ${err}`);
    }

    const data = (await res.json()) as any;
    const choice = JSON.parse(data.choices?.[0]?.message?.content || "{}");
    const translations: string[] = choice.translations || Object.values(choice)[0] as string[];

    if (!Array.isArray(translations) || translations.length !== segments.length) {
      throw new Error("OpenAI response array size does not match segments count");
    }

    const translatedSegs = segments.map((seg, idx) => {
      let text = translations[idx];
      // Apply manual glossary enforce as safety check
      for (const [srcWord, tgtWord] of Object.entries(glossary)) {
        const regex = new RegExp(`\\b${srcWord}\\b`, "gi");
        text = text.replace(regex, tgtWord);
      }
      return {
        originalSegmentId: seg.originalSegmentId,
        translatedText: text,
        startTime: seg.startTime,
        endTime: seg.endTime,
        confidence: 0.98,
      };
    });

    return {
      translatedText: translatedSegs.map((s) => s.translatedText).join(" "),
      segments: translatedSegs,
      confidence: 0.98,
      tokenUsage: data.usage?.total_tokens,
    };
  }
}

// 3. Google Gemini Translation Provider
export class GeminiTranslationProvider implements TranslationProvider {
  name = "gemini";

  async translate(
    segments: TranslationSegment[],
    sourceLang: string,
    targetLang: string,
    glossary: Record<string, string>
  ): Promise<TranslationProviderResult> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Gemini Translation requires GEMINI_API_KEY");

    logger.info(`Translating ${segments.length} segments via Gemini [${sourceLang} -> ${targetLang}]`);

    const glossaryInstruction = Object.keys(glossary).length > 0
      ? `Observe these glossary terms and translate them exactly as mapped:\n${Object.entries(glossary).map(([k, v]) => `- "${k}" -> "${v}"`).join("\n")}`
      : "";

    const userPrompt = `Translate this JSON array of transcript segments from "${sourceLang}" to "${targetLang}".
Preserve meaning, context, and structure across segment boundaries. Keep the exact index order.

JSON array:
${JSON.stringify(segments.map((s, idx) => ({ id: idx, text: s.sourceText })), null, 2)}

${glossaryInstruction}

Output ONLY a JSON object: {"translations": ["translation1", "translation2", ...]}`;

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini translation API failed (${res.status}): ${err}`);
    }

    const data = (await res.json()) as any;
    const textResp = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const choice = JSON.parse(textResp);
    const translations: string[] = choice.translations;

    if (!Array.isArray(translations) || translations.length !== segments.length) {
      throw new Error("Gemini response array size does not match segments count");
    }

    const translatedSegs = segments.map((seg, idx) => {
      let text = translations[idx];
      for (const [srcWord, tgtWord] of Object.entries(glossary)) {
        const regex = new RegExp(`\\b${srcWord}\\b`, "gi");
        text = text.replace(regex, tgtWord);
      }
      return {
        originalSegmentId: seg.originalSegmentId,
        translatedText: text,
        startTime: seg.startTime,
        endTime: seg.endTime,
        confidence: 0.97,
      };
    });

    return {
      translatedText: translatedSegs.map((s) => s.translatedText).join(" "),
      segments: translatedSegs,
      confidence: 0.97,
    };
  }
}

// 4. Meta SeamlessM4T Provider (Hugging Face Inference API)
export class SeamlessM4TProvider implements TranslationProvider {
  name = "seamless";

  async translate(
    segments: TranslationSegment[],
    sourceLang: string,
    targetLang: string,
    glossary: Record<string, string>
  ): Promise<TranslationProviderResult> {
    const token = process.env.HF_TOKEN;
    if (!token) throw new Error("SeamlessM4T translation requires HF_TOKEN");

    const modelId = process.env.SEAMLESS_MODEL_ID || "facebook/seamless-m4t-v2-large";
    logger.info(`Translating ${segments.length} segments via SeamlessM4T on Hugging Face: ${modelId}`);

    const translatedSegs = await Promise.all(
      segments.map(async (seg) => {
        const res = await fetch(`https://api-inference.huggingface.co/models/${modelId}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: seg.sourceText,
            parameters: {
              src_lang: sourceLang,
              tgt_lang: targetLang,
            },
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Hugging Face SeamlessM4T API failed: ${errText}`);
        }

        const data = await res.json() as any;
        let text = (Array.isArray(data) ? data[0]?.translation_text : data.translation_text) || seg.sourceText;

        for (const [srcWord, tgtWord] of Object.entries(glossary)) {
          const regex = new RegExp(`\\b${srcWord}\\b`, "gi");
          text = text.replace(regex, tgtWord);
        }

        return {
          originalSegmentId: seg.originalSegmentId,
          translatedText: text,
          startTime: seg.startTime,
          endTime: seg.endTime,
          confidence: 0.94,
        };
      })
    );

    return {
      translatedText: translatedSegs.map((s) => s.translatedText).join(" "),
      segments: translatedSegs,
      confidence: 0.94,
    };
  }
}

// 5. NLLB Provider (Hugging Face Inference API)
export class NLLBProvider implements TranslationProvider {
  name = "nllb";

  async translate(
    segments: TranslationSegment[],
    sourceLang: string,
    targetLang: string,
    glossary: Record<string, string>
  ): Promise<TranslationProviderResult> {
    const token = process.env.HF_TOKEN;
    if (!token) throw new Error("NLLB translation requires HF_TOKEN");

    const modelId = process.env.NLLB_MODEL_ID || "facebook/nllb-200-distilled-600M";
    logger.info(`Translating ${segments.length} segments via NLLB on Hugging Face: ${modelId}`);

    const srcNllb = NLLB_LANG_MAP[sourceLang] || "eng_Latn";
    const tgtNllb = NLLB_LANG_MAP[targetLang] || "hin_Deva";

    const translatedSegs = await Promise.all(
      segments.map(async (seg) => {
        const res = await fetch(`https://api-inference.huggingface.co/models/${modelId}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: seg.sourceText,
            parameters: {
              src_lang: srcNllb,
              tgt_lang: tgtNllb,
            },
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Hugging Face NLLB API failed: ${errText}`);
        }

        const data = await res.json() as any;
        let text = (Array.isArray(data) ? data[0]?.translation_text : data.translation_text) || seg.sourceText;

        for (const [srcWord, tgtWord] of Object.entries(glossary)) {
          const regex = new RegExp(`\\b${srcWord}\\b`, "gi");
          text = text.replace(regex, tgtWord);
        }

        return {
          originalSegmentId: seg.originalSegmentId,
          translatedText: text,
          startTime: seg.startTime,
          endTime: seg.endTime,
          confidence: 0.95,
        };
      })
    );

    return {
      translatedText: translatedSegs.map((s) => s.translatedText).join(" "),
      segments: translatedSegs,
      confidence: 0.95,
    };
  }
}

// Translation Memory (TM) query helper
export async function getTranslationMemory(
  sourceText: string,
  sourceLang: string,
  targetLang: string
): Promise<string | null> {
  try {
    const [prev] = await db
      .select({ text: translatedSegmentsTable.text })
      .from(translatedSegmentsTable)
      .innerJoin(translationJobsTable, eq(translatedSegmentsTable.translationJobId, translationJobsTable.id))
      .innerJoin(speechSegmentsTable, eq(translatedSegmentsTable.originalSegmentId, speechSegmentsTable.id))
      .where(
        and(
          eq(speechSegmentsTable.text, sourceText.trim()),
          eq(translationJobsTable.sourceLanguage, sourceLang),
          eq(translationJobsTable.targetLanguage, targetLang)
        )
      )
      .limit(1);

    if (prev?.text) {
      logger.info(`Translation Memory (TM) hit for text: "${sourceText.substring(0, 30)}..."`);
      return prev.text;
    }
  } catch (err) {
    logger.error(err, "Failed to query Translation Memory (TM)");
  }
  return null;
}

// Provider Fallback Runner
export async function translateWithFallback(
  segments: TranslationSegment[],
  sourceLang: string,
  targetLang: string,
  glossary: Record<string, string>
): Promise<TranslationProviderResult & { usedProvider: string; retryCount: number }> {
  const defaultFallback = ["nllb", "seamless", "gemini", "openai", "mock"];
  const configuredFallback = process.env.TRANSLATION_FALLBACK_ORDER
    ? process.env.TRANSLATION_FALLBACK_ORDER.split(",").map((s) => s.trim().toLowerCase())
    : defaultFallback;

  let lastError: Error | null = null;
  let retryCount = 0;

  for (const name of configuredFallback) {
    let provider: TranslationProvider;
    switch (name) {
      case "openai":
        provider = new OpenAITranslationProvider();
        break;
      case "gemini":
        provider = new GeminiTranslationProvider();
        break;
      case "seamless":
        provider = new SeamlessM4TProvider();
        break;
      case "nllb":
        provider = new NLLBProvider();
        break;
      case "mock":
      default:
        provider = new MockTranslationProvider();
        break;
    }

    try {
      logger.info(`Attempting translation with provider: ${provider.name}`);
      const result = await provider.translate(segments, sourceLang, targetLang, glossary);
      return {
        ...result,
        usedProvider: provider.name,
        retryCount,
      };
    } catch (err: any) {
      logger.warn(`Translation provider ${name} failed: ${err.message}. Retrying fallback...`);
      lastError = err;
      retryCount++;
    }
  }

  throw new Error(`All translation providers in fallback list failed. Last error: ${lastError?.message}`);
}
