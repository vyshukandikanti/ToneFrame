import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import app from "../app";
import { Server } from "http";

describe("API Server Tests", () => {
  let server: Server;
  let baseUrl: string;

  before(() => {
    return new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address();
        if (address && typeof address === "object") {
          baseUrl = `http://localhost:${address.port}/api`;
        }
        resolve();
      });
    });
  });

  after(() => {
    return new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
    });
  });

  test("GET /healthz - Server health check", async () => {
    const res = await fetch(`${baseUrl}/healthz`);
    assert.strictEqual(res.status, 200);

    const body = await res.json() as { status: string };
    assert.strictEqual(body.status, "ok");
  });

  test("POST /auth/register - Validation failure (missing fields)", async () => {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "invalid-email" }),
    });
    assert.strictEqual(res.status, 400);

    const body = await res.json() as { error: string };
    assert.strictEqual(body.error, "Validation failed");
  });

  test("POST /auth/login - Validation failure (missing fields)", async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@example.com" }),
    });
    assert.strictEqual(res.status, 400);

    const body = await res.json() as { error: string };
    assert.strictEqual(body.error, "Validation failed");
  });

  test("GET /projects - Requires authentication", async () => {
    const res = await fetch(`${baseUrl}/projects`);
    assert.strictEqual(res.status, 401);
  });

  test("POST /projects - Requires authentication", async () => {
    const res = await fetch(`${baseUrl}/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test Project" }),
    });
    assert.strictEqual(res.status, 401);
  });

  test("POST /projects/1234/upload-url - Requires authentication", async () => {
    const res = await fetch(`${baseUrl}/projects/1234/upload-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: "video.mp4", fileSize: 1000, contentType: "video/mp4" }),
    });
    assert.strictEqual(res.status, 401);
  });
});
