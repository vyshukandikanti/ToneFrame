import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import { createServer, Server } from "http";
import app from "../app";

describe("Production Probes Smoke Tests", () => {
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

  test("GET /api/health returns healthy service summary", async () => {
    const res = await fetch("http://localhost:5000/api/health");
    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as any;
    assert.strictEqual(body.status, "healthy");
    assert.strictEqual(body.services.api, "healthy");
  });

  test("GET /metrics returns Prometheus formatting rules", async () => {
    const res = await fetch("http://localhost:5000/metrics");
    assert.strictEqual(res.status, 200);
    const text = await res.text();
    assert.ok(text.includes("http_request_duration_seconds"));
  });
});
