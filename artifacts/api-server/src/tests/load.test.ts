import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import { createServer, Server } from "http";
import app from "../app";

describe("Production Stress Load Tests", () => {
  let server: Server;

  before(() => {
    // Set dummy DATABASE_URL to pass config schema check
    process.env.DATABASE_URL = "postgresql://postgres:password123@localhost:5432/dubverse";
    process.env.REDIS_URL = "redis://localhost:6379";
    process.env.JWT_SECRET = "supersecretjwtkey12345!";
    process.env.S3_BUCKET = "dubverse-bucket";

    server = createServer(app);
    return new Promise<void>((resolve) => {
      server.listen(5000, () => resolve());
    });
  });

  after(() => {
    return new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  test("Simulate concurrent user request traffic load", async () => {
    const concurrentRequests = 50;
    const start = Date.now();

    console.log(`[LoadTest] Launching ${concurrentRequests} concurrent request simulations...`);

    const promises = Array.from({ length: concurrentRequests }).map(async () => {
      const reqStart = Date.now();
      try {
        const res = await fetch("http://localhost:5000/api/health");
        const duration = Date.now() - reqStart;
        return { success: res.status === 200, duration, error: null };
      } catch (err: any) {
        return { success: false, duration: Date.now() - reqStart, error: err.message };
      }
    });

    const results = await Promise.all(promises);
    const totalDuration = Date.now() - start;

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    const avgDuration = results.reduce((acc, r) => acc + r.duration, 0) / concurrentRequests;

    console.log(`[LoadTest] Load test completed in ${totalDuration}ms`);
    console.log(`[LoadTest] Successful requests: ${successful}/${concurrentRequests}`);
    console.log(`[LoadTest] Failed requests: ${failed}/${concurrentRequests}`);
    console.log(`[LoadTest] Average API Latency: ${avgDuration.toFixed(2)}ms`);

    assert.strictEqual(successful, concurrentRequests, "All request attempts should succeed under load");
  });
});
