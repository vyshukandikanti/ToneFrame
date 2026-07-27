import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { logger } from "../lib/logger";

const execAsync = promisify(exec);

export interface WhisperWord {
  word: string;
  start: number;
  end: number;
  confidence?: number;
}

export interface WhisperSegment {
  text: string;
  start: number;
  end: number;
  confidence?: number;
  words?: WhisperWord[];
}

export interface WhisperResult {
  transcript: string;
  language: string;
  languageConfidence?: number;
  confidence?: number;
  segments: WhisperSegment[];
}

export interface WhisperProvider {
  transcribe(audioPath: string, options?: { language?: string }): Promise<WhisperResult>;
}

// 1. Mock Provider
export class MockWhisperProvider implements WhisperProvider {
  async transcribe(audioPath: string, options?: { language?: string }): Promise<WhisperResult> {
    logger.info(`Mocking Whisper transcription for: ${audioPath}`);
    await new Promise((resolve) => setTimeout(resolve, 1500)); // simulate model run

    const mockLanguage = options?.language || process.env.WHISPER_LANGUAGE || "en";

    const segments: WhisperSegment[] = [
      {
        text: "Hello and welcome to the localization video guide.",
        start: 0.0,
        end: 3.5,
        confidence: 0.98,
        words: [
          { word: "Hello", start: 0.0, end: 0.5, confidence: 0.99 },
          { word: "and", start: 0.5, end: 0.8, confidence: 0.97 },
          { word: "welcome", start: 0.8, end: 1.4, confidence: 0.99 },
          { word: "to", start: 1.4, end: 1.6, confidence: 0.98 },
          { word: "the", start: 1.6, end: 1.8, confidence: 0.97 },
          { word: "localization", start: 1.8, end: 2.8, confidence: 0.99 },
          { word: "video", start: 2.8, end: 3.1, confidence: 0.98 },
          { word: "guide.", start: 3.1, end: 3.5, confidence: 0.95 },
        ],
      },
      {
        text: "In this walkthrough, we show how to generate voice clones.",
        start: 3.8,
        end: 7.2,
        confidence: 0.95,
        words: [
          { word: "In", start: 3.8, end: 4.0, confidence: 0.96 },
          { word: "this", start: 4.0, end: 4.3, confidence: 0.94 },
          { word: "walkthrough,", start: 4.3, end: 5.1, confidence: 0.97 },
          { word: "we", start: 5.1, end: 5.3, confidence: 0.98 },
          { word: "show", start: 5.3, end: 5.6, confidence: 0.95 },
          { word: "how", start: 5.6, end: 5.8, confidence: 0.96 },
          { word: "to", start: 5.8, end: 6.0, confidence: 0.98 },
          { word: "generate", start: 6.0, end: 6.5, confidence: 0.94 },
          { word: "voice", start: 6.5, end: 6.8, confidence: 0.97 },
          { word: "clones.", start: 6.8, end: 7.2, confidence: 0.92 },
        ],
      },
    ];

    const transcript = segments.map((s) => s.text).join(" ");

    return {
      transcript,
      language: mockLanguage,
      languageConfidence: 0.99,
      confidence: 0.965,
      segments,
    };
  }
}

// 2. OpenAI Whisper Provider
export class OpenAIWhisperProvider implements WhisperProvider {
  async transcribe(audioPath: string, options?: { language?: string }): Promise<WhisperResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OpenAI Whisper requires OPENAI_API_KEY environment variable");
    }

    logger.info(`Sending audio to OpenAI Whisper API: ${audioPath}`);

    const fileData = fs.readFileSync(audioPath);
    const blob = new Blob([fileData], { type: "audio/wav" });
    const formData = new FormData();
    formData.append("file", blob, path.basename(audioPath));
    formData.append("model", process.env.WHISPER_MODEL || "whisper-1");
    formData.append("response_format", "verbose_json");
    formData.append("timestamp_granularities[]", "segment");
    formData.append("timestamp_granularities[]", "word");

    const targetLang = options?.language || process.env.WHISPER_LANGUAGE;
    if (targetLang) {
      formData.append("language", targetLang);
    }

    const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
    const res = await fetch(`${baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI Whisper API failed (${res.status}): ${errText}`);
    }

    const verboseJson = (await res.json()) as any;

    const segments: WhisperSegment[] = (verboseJson.segments || []).map((seg: any) => {
      const segmentWords = (verboseJson.words || [])
        .filter((w: any) => w.start >= seg.start && w.end <= seg.end)
        .map((w: any) => ({
          word: w.word,
          start: w.start,
          end: w.end,
          confidence: w.confidence || undefined,
        }));

      return {
        text: seg.text,
        start: seg.start,
        end: seg.end,
        confidence: seg.confidence || undefined,
        words: segmentWords.length > 0 ? segmentWords : undefined,
      };
    });

    return {
      transcript: verboseJson.text || "",
      language: verboseJson.language || "unknown",
      languageConfidence: 0.99,
      confidence: segments.reduce((sum, s) => sum + (s.confidence || 1.0), 0) / (segments.length || 1),
      segments,
    };
  }
}

// 3. Local Whisper Provider (CLI execution wrapper)
export class LocalWhisperProvider implements WhisperProvider {
  async transcribe(audioPath: string, options?: { language?: string }): Promise<WhisperResult> {
    const model = process.env.WHISPER_MODEL || "base";
    const language = options?.language || process.env.WHISPER_LANGUAGE || "en";
    const beamSize = process.env.WHISPER_BEAM_SIZE || "5";
    const device = process.env.WHISPER_DEVICE || "cpu";

    const outputDir = path.dirname(audioPath);
    const cmd = `whisper "${audioPath}" --model ${model} --language ${language} --output_format json --output_dir "${outputDir}" --device ${device}`;

    logger.info(`Running local Whisper CLI command: ${cmd}`);
    try {
      await execAsync(cmd);
      const jsonPath = audioPath.replace(path.extname(audioPath), ".json");

      if (!fs.existsSync(jsonPath)) {
        throw new Error(`Whisper CLI completed but output JSON was not found at: ${jsonPath}`);
      }

      const rawJson = fs.readFileSync(jsonPath, "utf-8");
      const result = JSON.parse(rawJson);

      fs.unlinkSync(jsonPath);

      const segments: WhisperSegment[] = (result.segments || []).map((seg: any) => ({
        text: seg.text,
        start: seg.start,
        end: seg.end,
        confidence: seg.confidence || (seg.avg_logprob ? Math.exp(seg.avg_logprob) : undefined),
        words: seg.words?.map((w: any) => ({
          word: w.word,
          start: w.start,
          end: w.end,
          confidence: w.probability || undefined,
        })),
      }));

      return {
        transcript: result.text || "",
        language: result.language || language,
        languageConfidence: 0.99,
        confidence: result.segments?.reduce((sum: number, s: any) => sum + (s.confidence || 0.95), 0) / (result.segments?.length || 1),
        segments,
      };
    } catch (err: any) {
      throw new Error(`Local Whisper CLI failed: ${err.message}`);
    }
  }
}

// 4. Faster Whisper Provider (REST backend service wrapper)
export class FasterWhisperProvider implements WhisperProvider {
  async transcribe(audioPath: string, options?: { language?: string }): Promise<WhisperResult> {
    const serviceUrl = process.env.FASTER_WHISPER_URL || "http://127.0.0.1:8000/v1/transcribe";
    logger.info(`Sending audio to Faster Whisper service at: ${serviceUrl}`);

    const fileData = fs.readFileSync(audioPath);
    const blob = new Blob([fileData], { type: "audio/wav" });
    const formData = new FormData();
    formData.append("file", blob, path.basename(audioPath));
    formData.append("language", options?.language || process.env.WHISPER_LANGUAGE || "en");
    formData.append("beam_size", process.env.WHISPER_BEAM_SIZE || "5");

    const res = await fetch(serviceUrl, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Faster Whisper API failed (${res.status}): ${errText}`);
    }

    const data = (await res.json()) as any;

    const segments: WhisperSegment[] = (data.segments || []).map((seg: any) => ({
      text: seg.text,
      start: seg.start,
      end: seg.end,
      confidence: seg.confidence,
      words: seg.words?.map((w: any) => ({
        word: w.word,
        start: w.start,
        end: w.end,
        confidence: w.confidence,
      })),
    }));

    return {
      transcript: data.text || "",
      language: data.language || "en",
      languageConfidence: data.language_probability,
      confidence: data.confidence,
      segments,
    };
  }
}

// Resolved Provider factory
export function getWhisperProvider(): WhisperProvider {
  const provider = process.env.WHISPER_PROVIDER || "mock";
  logger.info(`Configured Whisper Provider resolved: ${provider}`);

  switch (provider.toLowerCase()) {
    case "openai":
      return new OpenAIWhisperProvider();
    case "local":
      return new LocalWhisperProvider();
    case "faster":
      return new FasterWhisperProvider();
    case "mock":
    default:
      return new MockWhisperProvider();
  }
}
