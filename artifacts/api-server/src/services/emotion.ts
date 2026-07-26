import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { logger } from "../lib/logger";

const execAsync = promisify(exec);

export const EMOTION_CATEGORIES = [
  "neutral",
  "happy",
  "sad",
  "angry",
  "fear",
  "excited",
  "calm",
  "surprise",
  "unknown"
] as const;

export type EmotionType = typeof EMOTION_CATEGORIES[number];

export interface EmotionSegmentAnalysis {
  segmentId: string;
  startTime: number;
  endTime: number;
  textEmotion: EmotionType;
  textConfidence: number;
  audioEmotion: EmotionType;
  audioConfidence: number;
  finalEmotion: EmotionType;
  confidence: number;
  intensity: number;
  speakerId?: string | null;
}

export interface EmotionProviderResult {
  segments: EmotionSegmentAnalysis[];
  avgConfidence: number;
  modelVersion: string;
}

export interface EmotionProvider {
  name: string;
  analyze(
    audioPathOrUrl: string,
    segments: { id: string; text: string; start: number; end: number; speakerId?: string | null }[]
  ): Promise<EmotionProviderResult>;
}

// Helper: Emotion Fusion algorithm
export function fuseEmotions(
  textEmotion: EmotionType,
  textConf: number,
  audioEmotion: EmotionType,
  audioConf: number
): { finalEmotion: EmotionType; confidence: number; intensity: number } {
  const threshold = parseFloat(process.env.EMOTION_CONFIDENCE_THRESHOLD || "0.4");

  let finalEmotion: EmotionType = textEmotion;
  let confidence = textConf;

  if (audioConf > textConf) {
    finalEmotion = audioEmotion;
    confidence = audioConf;
  }

  if (confidence < threshold) {
    finalEmotion = "unknown";
  }

  const intensity = parseFloat(((textConf + audioConf) / 2).toFixed(4));

  return {
    finalEmotion,
    confidence: parseFloat(confidence.toFixed(4)),
    intensity,
  };
}

// Helper: Emotion Smoothing algorithm
export function smoothEmotionTimeline(segments: EmotionSegmentAnalysis[]): EmotionSegmentAnalysis[] {
  const smoothingThreshold = parseFloat(process.env.EMOTION_SMOOTHING_WINDOW || "2");
  if (segments.length <= 2) return segments;

  const smoothed = [...segments];

  for (let i = 1; i < segments.length - 1; i++) {
    const prev = smoothed[i - 1];
    const curr = smoothed[i];
    const next = smoothed[i + 1];

    const duration = curr.endTime - curr.startTime;

    if (duration < smoothingThreshold && curr.finalEmotion !== prev.finalEmotion && curr.finalEmotion !== next.finalEmotion) {
      if (prev.finalEmotion === next.finalEmotion) {
        logger.debug(`Smoothing segment ${curr.segmentId} from '${curr.finalEmotion}' to '${prev.finalEmotion}'`);
        curr.finalEmotion = prev.finalEmotion;
        curr.confidence = parseFloat(((prev.confidence + next.confidence) / 2).toFixed(4));
      }
    }
  }

  return smoothed;
}

// Map Hugging Face prediction output labels to our schema
function normalizeEmotionLabel(label: string): EmotionType {
  const norm = label.toLowerCase().trim();
  if (norm.includes("neutral") || norm.includes("neu")) return "neutral";
  if (norm.includes("joy") || norm.includes("happy") || norm.includes("hap")) return "happy";
  if (norm.includes("sadness") || norm.includes("sad")) return "sad";
  if (norm.includes("anger") || norm.includes("angry") || norm.includes("ang")) return "angry";
  if (norm.includes("fear") || norm.includes("fearful")) return "fear";
  if (norm.includes("excited") || norm.includes("exc")) return "excited";
  if (norm.includes("calm") || norm.includes("cal")) return "calm";
  if (norm.includes("surprise") || norm.includes("surprised") || norm.includes("sur")) return "surprise";
  return "neutral";
}

// 1. Mock Emotion Provider
export class MockEmotionProvider implements EmotionProvider {
  name = "mock";

  async analyze(
    audioPathOrUrl: string,
    segments: { id: string; text: string; start: number; end: number; speakerId?: string | null }[]
  ): Promise<EmotionProviderResult> {
    logger.info(`Running Mock Emotion Analysis on audio: ${audioPathOrUrl} for ${segments.length} segments`);
    await new Promise((resolve) => setTimeout(resolve, 1200));

    const mockEmotions: EmotionType[] = ["neutral", "happy", "sad", "angry", "excited", "calm", "surprise"];

    const analyzedSegments: EmotionSegmentAnalysis[] = segments.map((seg, idx) => {
      const textEmotion = mockEmotions[idx % mockEmotions.length];
      const audioEmotion = mockEmotions[(idx + 1) % mockEmotions.length];

      const textConfidence = 0.5 + (idx % 5) * 0.1;
      const audioConfidence = 0.4 + (idx % 6) * 0.1;

      const { finalEmotion, confidence, intensity } = fuseEmotions(
        textEmotion,
        textConfidence,
        audioEmotion,
        audioConfidence
      );

      return {
        segmentId: seg.id,
        startTime: seg.start,
        endTime: seg.end,
        textEmotion,
        textConfidence,
        audioEmotion,
        audioConfidence,
        finalEmotion,
        confidence,
        intensity,
        speakerId: seg.speakerId || null,
      };
    });

    const smoothed = smoothEmotionTimeline(analyzedSegments);
    const avgConfidence = smoothed.reduce((sum, s) => sum + s.confidence, 0) / (smoothed.length || 1);

    return {
      segments: smoothed,
      avgConfidence: parseFloat(avgConfidence.toFixed(4)),
      modelVersion: "mock-v1.0",
    };
  }
}

// 2. PyTorch Emotion Classifier Wrapper (represented via local script fallback)
export class PyTorchEmotionProvider implements EmotionProvider {
  name = "pytorch";
  async analyze(
    audioPathOrUrl: string,
    segments: { id: string; text: string; start: number; end: number; speakerId?: string | null }[]
  ): Promise<EmotionProviderResult> {
    // Run local python pytorch script if configured, otherwise throw
    const scriptPath = process.env.PYTORCH_EMOTION_SCRIPT || "./scripts/pytorch_emotion.py";
    if (!fs.existsSync(scriptPath)) {
      throw new Error("PyTorch local script path not found");
    }

    const tempJsonPath = path.join(path.dirname(audioPathOrUrl), `emotion-input-${Date.now()}.json`);
    fs.writeFileSync(tempJsonPath, JSON.stringify(segments));

    logger.info(`Running PyTorch local classifier command on audio: ${audioPathOrUrl}`);
    const cmd = `python "${scriptPath}" --audio "${audioPathOrUrl}" --segments "${tempJsonPath}"`;
    try {
      const { stdout } = await execAsync(cmd);
      fs.unlinkSync(tempJsonPath);
      const data = JSON.parse(stdout);
      return data;
    } catch (err: any) {
      if (fs.existsSync(tempJsonPath)) fs.unlinkSync(tempJsonPath);
      throw new Error(`PyTorch local classifier failed: ${err.message}`);
    }
  }
}

// 3. HuggingFace Transformer Wrapper
export class HuggingFaceEmotionProvider implements EmotionProvider {
  name = "huggingface";

  async analyze(
    audioPathOrUrl: string,
    segments: { id: string; text: string; start: number; end: number; speakerId?: string | null }[]
  ): Promise<EmotionProviderResult> {
    const token = process.env.HF_TOKEN;
    if (!token) throw new Error("Hugging Face Emotion requires HF_TOKEN");

    const textModel = process.env.HF_TEXT_EMOTION_MODEL || "j-hartmann/emotion-english-distilroberta-base";
    const audioModel = process.env.HF_AUDIO_EMOTION_MODEL || "superb/wav2vec2-base-superb-er";

    logger.info(`Running Hugging Face Emotion Analysis via models: Text=[${textModel}], Audio=[${audioModel}]`);

    const analyzedSegments: EmotionSegmentAnalysis[] = await Promise.all(
      segments.map(async (seg) => {
        // A. Call Text Emotion model
        let textEmotion: EmotionType = "neutral";
        let textConfidence = 0.8;
        try {
          const res = await fetch(`https://api-inference.huggingface.co/models/${textModel}`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ inputs: seg.text }),
          });
          if (res.ok) {
            const data = (await res.json()) as any[];
            const predictions = Array.isArray(data[0]) ? data[0] : data;
            const top = predictions.reduce((prev: any, current: any) => (prev.score > current.score ? prev : current), { score: 0 });
            if (top?.label) {
              textEmotion = normalizeEmotionLabel(top.label);
              textConfidence = top.score;
            }
          }
        } catch (err) {
          logger.warn(`HF Text emotion classification failed for segment ${seg.id}, using fallback`);
        }

        // B. Call Audio Emotion model (requires cropping segment wav file first)
        let audioEmotion: EmotionType = "neutral";
        let audioConfidence = 0.7;
        const tempSegmentPath = path.join(path.dirname(audioPathOrUrl), `tmp-seg-${seg.id}.wav`);
        try {
          // Crop audio using FFmpeg
          const duration = seg.end - seg.start;
          await execAsync(`ffmpeg -y -i "${audioPathOrUrl}" -ss ${seg.start} -t ${duration} -c copy "${tempSegmentPath}"`);

          const audioBytes = fs.readFileSync(tempSegmentPath);
          const res = await fetch(`https://api-inference.huggingface.co/models/${audioModel}`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "audio/wav",
            },
            body: audioBytes,
          });

          if (res.ok) {
            const data = (await res.json()) as any[];
            const predictions = Array.isArray(data[0]) ? data[0] : data;
            const top = predictions.reduce((prev: any, current: any) => (prev.score > current.score ? prev : current), { score: 0 });
            if (top?.label) {
              audioEmotion = normalizeEmotionLabel(top.label);
              audioConfidence = top.score;
            }
          }
        } catch (err) {
          logger.warn(`HF Audio emotion classification failed for segment ${seg.id}, using fallback`);
        } finally {
          if (fs.existsSync(tempSegmentPath)) {
            fs.unlinkSync(tempSegmentPath);
          }
        }

        const { finalEmotion, confidence, intensity } = fuseEmotions(
          textEmotion,
          textConfidence,
          audioEmotion,
          audioConfidence
        );

        return {
          segmentId: seg.id,
          startTime: seg.start,
          endTime: seg.end,
          textEmotion,
          textConfidence,
          audioEmotion,
          audioConfidence,
          finalEmotion,
          confidence,
          intensity,
          speakerId: seg.speakerId || null,
        };
      })
    );

    const smoothed = smoothEmotionTimeline(analyzedSegments);
    const avgConfidence = smoothed.reduce((sum, s) => sum + s.confidence, 0) / (smoothed.length || 1);

    return {
      segments: smoothed,
      avgConfidence: parseFloat(avgConfidence.toFixed(4)),
      modelVersion: `${textModel} + ${audioModel}`,
    };
  }
}

// 4. OpenSMILE Analyser Wrapper
export class OpenSmileEmotionProvider implements EmotionProvider {
  name = "opensmile";
  async analyze(
    audioPathOrUrl: string,
    segments: { id: string; text: string; start: number; end: number; speakerId?: string | null }[]
  ): Promise<EmotionProviderResult> {
    const binPath = process.env.OPENSMILE_BIN_PATH || "SMILExtract";
    const configPath = process.env.OPENSMILE_CONFIG_PATH || "config/gemaps/GeMAPSv01b.conf";

    const tempOutputPath = path.join(path.dirname(audioPathOrUrl), `opensmile-out-${Date.now()}.csv`);

    logger.info(`Running OpenSMILE binary to extract acoustic features: ${binPath}`);
    const cmd = `"${binPath}" -C "${configPath}" -I "${audioPathOrUrl}" -O "${tempOutputPath}"`;

    try {
      await execAsync(cmd);
      if (!fs.existsSync(tempOutputPath)) {
        throw new Error("OpenSMILE completed but output file not generated");
      }

      fs.unlinkSync(tempOutputPath);

      // Perform fallback to mock for classification logic since OpenSMILE extracts raw features
      const mock = new MockEmotionProvider();
      const res = await mock.analyze(audioPathOrUrl, segments);
      return {
        ...res,
        modelVersion: "OpenSMILE Features + Mock Classifier",
      };
    } catch (err: any) {
      if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
      throw new Error(`OpenSMILE binary execution failed: ${err.message}`);
    }
  }
}

// Provider Fallback Loop
export async function analyzeEmotionsWithFallback(
  audioPathOrUrl: string,
  segments: { id: string; text: string; start: number; end: number; speakerId?: string | null }[]
): Promise<EmotionProviderResult & { usedProvider: string }> {
  const fallbackOrder = (process.env.EMOTION_FALLBACK_ORDER || "pytorch,huggingface,opensmile,mock")
    .split(",")
    .map((s) => s.trim().toLowerCase());

  let lastError: Error | null = null;

  for (const name of fallbackOrder) {
    let provider: EmotionProvider;
    switch (name) {
      case "pytorch":
        provider = new PyTorchEmotionProvider();
        break;
      case "huggingface":
        provider = new HuggingFaceEmotionProvider();
        break;
      case "opensmile":
        provider = new OpenSmileEmotionProvider();
        break;
      case "mock":
      default:
        provider = new MockEmotionProvider();
        break;
    }

    try {
      logger.info(`Running emotion detection using provider: ${provider.name}`);
      const result = await provider.analyze(audioPathOrUrl, segments);
      return {
        ...result,
        usedProvider: provider.name,
      };
    } catch (err: any) {
      logger.warn(`Emotion provider ${name} failed: ${err.message}. Retrying fallback...`);
      lastError = err;
    }
  }

  throw new Error(`All emotion detection providers failed. Last error: ${lastError?.message}`);
}
