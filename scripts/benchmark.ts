// Set dummy environment variables before loading any database/config modules
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://postgres:password123@localhost:5432/dubverse";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.JWT_SECRET = "supersecretjwtkey12345!";
process.env.S3_BUCKET = "dubverse-bucket";

import fs from "fs";
import path from "path";

async function runBenchmarks() {
  // Dynamically import to ensure environment variables are populated beforehand
  const { getWhisperProvider } = await import("../artifacts/api-server/src/services/whisper");
  const { translateWithFallback } = await import("../artifacts/api-server/src/services/translation");
  const { synthesizeVoiceWithFallback } = await import("../artifacts/api-server/src/services/voice");
  const { renderVideoWithFallback } = await import("../artifacts/api-server/src/services/rendering");

  console.log("=== DubVerse AI Pipeline Performance Benchmarks ===");
  const startCpu = process.cpuUsage();
  const startTime = Date.now();

  const results: Record<string, { durationMs: number; memoryMb: number }> = {};

  // 1. Speech Recognition Benchmark
  console.log("Benchmarking Speech Recognition...");
  let start = Date.now();
  const whisper = getWhisperProvider();
  await whisper.transcribe("artifacts/api-server/src/tests/assets/dummy.wav", { language: "en" });
  results["Speech Recognition"] = {
    durationMs: Date.now() - start,
    memoryMb: process.memoryUsage().heapUsed / 1024 / 1024,
  };

  // 2. Translation Benchmark
  console.log("Benchmarking Translation...");
  start = Date.now();
  await translateWithFallback(
    [{ originalSegmentId: "1", sourceText: "Hello world localization", startTime: 0, endTime: 2 }],
    "en",
    "hi",
    {}
  );
  results["Translation"] = {
    durationMs: Date.now() - start,
    memoryMb: process.memoryUsage().heapUsed / 1024 / 1024,
  };

  // 3. Voice Generation Benchmark
  console.log("Benchmarking Voice Generation...");
  start = Date.now();
  await synthesizeVoiceWithFallback({
    text: "Sample translation text voice generation speed test",
    language: "hi",
    voiceName: "SPEAKER_00",
  });
  results["Voice Generation"] = {
    durationMs: Date.now() - start,
    memoryMb: process.memoryUsage().heapUsed / 1024 / 1024,
  };

  // 4. Rendering Pipeline Benchmark
  console.log("Benchmarking Video Rendering...");
  start = Date.now();
  await renderVideoWithFallback({
    lipSyncVideoKey: "projects/uuid/video.mp4",
    audioKey: "projects/uuid/audio.wav",
    resolution: "1080p",
    format: "mp4",
  });
  results["FFmpeg Rendering"] = {
    durationMs: Date.now() - start,
    memoryMb: process.memoryUsage().heapUsed / 1024 / 1024,
  };

  const totalTime = Date.now() - startTime;
  const cpuUsage = process.cpuUsage(startCpu);

  // Generate Reports
  const reportsDir = "./benchmarks";
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  // A. JSON report
  const jsonReport = {
    timestamp: new Date().toISOString(),
    totalDurationMs: totalTime,
    cpuUsage,
    results,
  };
  fs.writeFileSync(path.join(reportsDir, "report.json"), JSON.stringify(jsonReport, null, 2));

  // B. CSV report
  let csvContent = "Stage,DurationMs,MemoryMB\n";
  Object.entries(results).forEach(([stage, data]) => {
    csvContent += `"${stage}",${data.durationMs},${data.memoryMb.toFixed(2)}\n`;
  });
  fs.writeFileSync(path.join(reportsDir, "report.csv"), csvContent);

  // C. Markdown summary
  let mdContent = `# Performance Benchmark Summary\n\n`;
  mdContent += `* **Executed At:** ${new Date().toISOString()}\n`;
  mdContent += `* **Total E2E Pipeline Duration:** ${(totalTime / 1000).toFixed(2)}s\n`;
  mdContent += `* **User CPU Time:** ${(cpuUsage.user / 1000000).toFixed(2)}s\n`;
  mdContent += `* **System CPU Time:** ${(cpuUsage.system / 1000000).toFixed(2)}s\n\n`;
  mdContent += `| Stage | Duration (ms) | Memory Used (MB) |\n`;
  mdContent += `| :--- | :---: | :---: |\n`;
  Object.entries(results).forEach(([stage, data]) => {
    mdContent += `| ${stage} | ${data.durationMs} | ${data.memoryMb.toFixed(2)} |\n`;
  });

  fs.writeFileSync(path.join(reportsDir, "report.md"), mdContent);
  console.log("\nBenchmarks completed successfully! Reports saved to './benchmarks/'");
}

runBenchmarks().catch(console.error);
