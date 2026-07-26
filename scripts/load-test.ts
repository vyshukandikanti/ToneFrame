// Set dummy environment variables before loading any database/config modules
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://postgres:password123@localhost:5432/dubverse";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.JWT_SECRET = "supersecretjwtkey12345!";
process.env.S3_BUCKET = "dubverse-bucket";

async function runLoadTest() {
  // Dynamically import to ensure environment variables are populated beforehand
  const { getWhisperProvider } = await import("../artifacts/api-server/src/services/whisper");
  const { translateWithFallback } = await import("../artifacts/api-server/src/services/translation");
  const { synthesizeVoiceWithFallback } = await import("../artifacts/api-server/src/services/voice");

  const concurrencyLevels = [1, 5, 10, 25];
  console.log("=== DubVerse AI Pipeline Load & Stress Testing ===");

  for (const concurrency of concurrencyLevels) {
    console.log(`\n[LoadTest] Simulating ${concurrency} concurrent pipeline jobs...`);
    const start = Date.now();

    const tasks = Array.from({ length: concurrency }).map(async (_, idx) => {
      const jobStart = Date.now();
      try {
        // Run Whisper
        const whisper = getWhisperProvider();
        await whisper.transcribe("artifacts/api-server/src/tests/assets/dummy.wav", { language: "en" });

        // Run Translate
        await translateWithFallback(
          [{ originalSegmentId: `seg-${idx}`, sourceText: "Concurreny stress test segment text data", startTime: 0, endTime: 3 }],
          "en",
          "hi",
          {}
        );

        // Run Voice Gen
        await synthesizeVoiceWithFallback({
          text: "TTS concurrency segment output",
          language: "hi",
          voiceName: "SPEAKER_00",
        });

        return { success: true, duration: Date.now() - jobStart, error: null };
      } catch (err: any) {
        return { success: false, duration: Date.now() - jobStart, error: err.message };
      }
    });

    const results = await Promise.all(tasks);
    const totalDuration = Date.now() - start;

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    const avgDuration = results.reduce((acc, r) => acc + r.duration, 0) / concurrency;

    console.log(`[LoadTest] Concurrency ${concurrency} Results:`);
    console.log(` - Completed in: ${totalDuration}ms`);
    console.log(` - Successful: ${successful}/${concurrency}`);
    console.log(` - Failed: ${failed}/${concurrency}`);
    console.log(` - Average Job Execution Latency: ${avgDuration.toFixed(2)}ms`);
    console.log(` - Throughput: ${(concurrency / (totalDuration / 1000)).toFixed(2)} jobs/sec`);
  }
}

runLoadTest().catch(console.error);
