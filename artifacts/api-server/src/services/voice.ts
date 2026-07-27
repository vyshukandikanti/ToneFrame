import { logger } from "../lib/logger";

export interface SynthesizeOptions {
  text: string;
  language: string;
  speed?: number;
  pitch?: number;
  energy?: number;
  emotionPreset?: string;
  voiceName?: string;
}

export interface VoiceProviderResult {
  audioBuffer: Buffer;
  sampleRate: number;
  duration: number;
  confidence?: number;
}

export interface VoiceProvider {
  name: string;
  synthesize(options: SynthesizeOptions): Promise<VoiceProviderResult>;
}

// Generate valid playable dummy WAV file in memory
export function createMockWavBuffer(durationSeconds = 2, sampleRate = 16000): Buffer {
  const numSamples = Math.floor(durationSeconds * sampleRate);
  const buffer = Buffer.alloc(44 + numSamples * 2);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(1, 22); // Mono channel
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(numSamples * 2, 40);

  // Fill with an audible low-volume tone (placeholder voice) instead of silence,
  // so the dubbed track is audible end-to-end even without a real TTS provider.
  const frequency = 220; // Hz
  const amplitude = 6000; // ~18% of int16 range: clearly audible, not harsh
  for (let i = 0; i < numSamples; i++) {
    const sample = Math.round(Math.sin((2 * Math.PI * frequency * i) / sampleRate) * amplitude);
    buffer.writeInt16LE(sample, 44 + i * 2);
  }

  return buffer;
}

// Wrap raw 16-bit PCM audio bytes in a minimal WAV container.
export function pcmToWav(pcm: Buffer, sampleRate = 24000): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // Mono channel
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); // byte rate (mono, 16-bit)
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

// Mapping emotion values to speech parameters
export function getEmotionSpeechParameters(emotion: string, intensity = 0.8) {
  const norm = emotion.toLowerCase().trim();

  let speed = 1.0;
  let pitch = 0.0;
  let energy = 1.0;
  let preset = "neutral";

  switch (norm) {
    case "happy":
      speed = 1.1;
      pitch = 0.15 * intensity;
      energy = 1.1;
      preset = "happy";
      break;
    case "sad":
      speed = 0.85;
      pitch = -0.15 * intensity;
      energy = 0.8;
      preset = "sad";
      break;
    case "angry":
      speed = 1.15;
      pitch = 0.1 * intensity;
      energy = 1.3 * intensity;
      preset = "angry";
      break;
    case "excited":
      speed = 1.2;
      pitch = 0.2 * intensity;
      energy = 1.2;
      preset = "excited";
      break;
    case "fear":
      speed = 1.1;
      pitch = 0.1 * intensity;
      energy = 0.9;
      preset = "whisper";
      break;
    case "calm":
      speed = 0.9;
      pitch = -0.05 * intensity;
      energy = 0.85;
      preset = "calm";
      break;
    case "surprise":
      speed = 1.1;
      pitch = 0.25 * intensity;
      energy = 1.15;
      preset = "excited";
      break;
    case "neutral":
    default:
      break;
  }

  return { speed, pitch, energy, emotionPreset: preset };
}

// 1. Mock TTS Provider
export class MockVoiceProvider implements VoiceProvider {
  name = "mock";

  async synthesize(options: SynthesizeOptions): Promise<VoiceProviderResult> {
    logger.info(`Mocking Voice Generation [${options.language}] for text: "${options.text.substring(0, 30)}..."`);
    await new Promise((resolve) => setTimeout(resolve, 800));

    const words = options.text.trim().split(/\s+/).length;
    const duration = Math.max(1.5, parseFloat((words / 2.1).toFixed(2)));

    const audioBuffer = createMockWavBuffer(duration, 16000);

    return {
      audioBuffer,
      sampleRate: 16000,
      duration,
      confidence: 0.98,
    };
  }
}

// 2. Fish Speech Provider (Fish Audio REST API)
export class FishSpeechProvider implements VoiceProvider {
  name = "fish";
  async synthesize(options: SynthesizeOptions): Promise<VoiceProviderResult> {
    const apiKey = process.env.FISH_AUDIO_API_KEY;
    if (!apiKey) throw new Error("Fish Speech requires FISH_AUDIO_API_KEY");

    logger.info(`Synthesizing via Fish Speech API (Voice reference: ${options.voiceName || "default"})`);

    const res = await fetch("https://api.fish.audio/v1/tts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        model: process.env.FISH_TTS_MODEL || "speech-1.6",
      },
      body: JSON.stringify({
        text: options.text,
        chunk_length: 200,
        format: "wav",
        reference_id: options.voiceName || process.env.FISH_TTS_REFERENCE_ID || undefined,
        prosody: {
          speed: options.speed || 1.0,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Fish Speech API failed (${res.status}): ${err}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    const words = options.text.trim().split(/\s+/).length;
    const duration = Math.max(1.5, words / 2.1);

    return {
      audioBuffer,
      sampleRate: 44100,
      duration,
      confidence: 0.98,
    };
  }
}

// 3. CosyVoice 2 Provider (REST backend service wrapper)
export class CosyVoiceProvider implements VoiceProvider {
  name = "cosyvoice";
  async synthesize(options: SynthesizeOptions): Promise<VoiceProviderResult> {
    const serviceUrl = process.env.COSYVOICE_API_URL || "http://127.0.0.1:50000/tts";
    logger.info(`Synthesizing via CosyVoice service at: ${serviceUrl}`);

    const res = await fetch(serviceUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: options.text,
        speaker: options.voiceName || "default",
        speed: options.speed || 1.0,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`CosyVoice API failed (${res.status}): ${err}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    const words = options.text.trim().split(/\s+/).length;
    const duration = Math.max(1.5, words / 2.1);

    return {
      audioBuffer,
      sampleRate: 22050,
      duration,
      confidence: 0.97,
    };
  }
}

// 4. Indus TTS-2 Provider (REST backend service wrapper)
export class IndusVoiceProvider implements VoiceProvider {
  name = "indus";
  async synthesize(options: SynthesizeOptions): Promise<VoiceProviderResult> {
    const serviceUrl = process.env.INDUS_TTS_API_URL || "http://127.0.0.1:40000/tts";
    logger.info(`Synthesizing via Indus TTS-2 service at: ${serviceUrl}`);

    const res = await fetch(serviceUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: options.text,
        voice: options.voiceName || "default",
        language: options.language,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Indus TTS API failed (${res.status}): ${err}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    const words = options.text.trim().split(/\s+/).length;
    const duration = Math.max(1.5, words / 2.1);

    return {
      audioBuffer,
      sampleRate: 24000,
      duration,
      confidence: 0.96,
    };
  }
}

// 5. ElevenLabs API Provider
export class ElevenLabsVoiceProvider implements VoiceProvider {
  name = "elevenlabs";

  async synthesize(options: SynthesizeOptions): Promise<VoiceProviderResult> {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) throw new Error("ElevenLabs requires ELEVENLABS_API_KEY");

    const voiceId = options.voiceName || process.env.ELEVENLABS_DEFAULT_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
    logger.info(`Synthesizing via ElevenLabs API (Voice ID: ${voiceId})`);

    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: options.text,
        model_id: process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`ElevenLabs TTS failed (${res.status}): ${err}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    const words = options.text.trim().split(/\s+/).length;
    const duration = Math.max(1.5, words / 2.1);

    return {
      audioBuffer,
      sampleRate: 44100,
      duration,
      confidence: 0.99,
    };
  }
}

// 6. OpenAI-compatible TTS Provider (works with OpenAI or Groq PlayAI TTS via /audio/speech)
export class OpenAISpeechProvider implements VoiceProvider {
  name = "openai-tts";
  async synthesize(options: SynthesizeOptions): Promise<VoiceProviderResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OpenAI-compatible TTS requires OPENAI_API_KEY");

    const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
    const model = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
    const voice = options.voiceName || process.env.OPENAI_TTS_VOICE || "alloy";

    logger.info(`Synthesizing via OpenAI-compatible TTS (${baseUrl}, model: ${model}, voice: ${voice})`);

    const res = await fetch(`${baseUrl}/audio/speech`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        voice,
        input: options.text,
        response_format: "wav",
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI-compatible TTS failed (${res.status}): ${err}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    const words = options.text.trim().split(/\s+/).length;
    const duration = Math.max(1.5, words / 2.1);

    return {
      audioBuffer,
      sampleRate: 24000,
      duration,
      confidence: 0.96,
    };
  }
}

// 7. Google Gemini TTS Provider (free tier via Google AI Studio, no card required)
export class GeminiTTSProvider implements VoiceProvider {
  name = "gemini-tts";
  async synthesize(options: SynthesizeOptions): Promise<VoiceProviderResult> {
    const apiKey = process.env.GEMINI_TTS_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Gemini TTS requires GEMINI_API_KEY");

    const model = process.env.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts";
    const voice = options.voiceName || process.env.GEMINI_TTS_VOICE || "Kore";

    logger.info(`Synthesizing via Gemini TTS (model: ${model}, voice: ${voice})`);

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: options.text }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
            },
          },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini TTS failed (${res.status}): ${err}`);
    }

    const data = (await res.json()) as any;
    const b64 = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!b64) throw new Error("Gemini TTS returned no audio data");

    const pcm = Buffer.from(b64, "base64");
    const sampleRate = 24000;
    const audioBuffer = pcmToWav(pcm, sampleRate);

    const words = options.text.trim().split(/\s+/).length;
    const duration = Math.max(1.5, words / 2.1);

    return {
      audioBuffer,
      sampleRate,
      duration,
      confidence: 0.95,
    };
  }
}

// Fallback Provider execution loop
export async function synthesizeVoiceWithFallback(
  options: SynthesizeOptions
): Promise<VoiceProviderResult & { usedProvider: string }> {
  const fallbackOrder = (process.env.VOICE_FALLBACK_ORDER || "fish,cosyvoice,indus,elevenlabs,mock")
    .split(",")
    .map((s) => s.trim().toLowerCase());

  let lastError: Error | null = null;

  for (const name of fallbackOrder) {
    let provider: VoiceProvider;
    switch (name) {
      case "fish":
        provider = new FishSpeechProvider();
        break;
      case "cosyvoice":
        provider = new CosyVoiceProvider();
        break;
      case "indus":
        provider = new IndusVoiceProvider();
        break;
      case "elevenlabs":
        provider = new ElevenLabsVoiceProvider();
        break;
      case "openai-tts":
        provider = new OpenAISpeechProvider();
        break;
      case "gemini-tts":
        provider = new GeminiTTSProvider();
        break;
      case "mock":
      default:
        provider = new MockVoiceProvider();
        break;
    }

    try {
      logger.info(`Running TTS generation using provider: ${provider.name}`);
      const result = await provider.synthesize(options);
      return {
        ...result,
        usedProvider: provider.name,
      };
    } catch (err: any) {
      logger.warn(`TTS provider ${name} failed: ${err.message}. Retrying fallback...`);
      lastError = err;
    }
  }

  throw new Error(`All voice cloning providers failed. Last error: ${lastError?.message}`);
}
