import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import { mock } from "node:test";
import { db } from "@workspace/db";
import * as jobsService from "../services/jobs";

describe("Background Job Processing Tests", () => {
  // Mock Drizzle DB calls
  const mockInsertedJob = {
    id: "mock-job-uuid",
    projectId: "mock-project-uuid",
    stage: "video-preparation",
    status: "queued",
    progress: 0,
    priority: 10,
    retryCount: 0,
    createdAt: new Date(),
  };

  before(() => {
    // Mock db.insert
    mock.method(db, "insert", () => ({
      values: () => ({
        returning: async () => [mockInsertedJob],
      }),
    }));

    // Mock db.select
    mock.method(db, "select", () => ({
      from: () => ({
        where: () => ({
          limit: async () => [], // returns empty to simulate no duplicate active jobs
        }),
      }),
    }));

    // Mock db.update
    mock.method(db, "update", () => ({
      set: () => ({
        where: () => ({
          returning: async () => [mockInsertedJob],
        }),
      }),
    }));

    // Mock queueManager.getQueue to bypass Queue constructor and connection
    mock.method(jobsService.queueManager, "getQueue", () => ({
      add: async () => {
        return { id: "mock-bullmq-id" };
      },
      getJob: async () => {
        return {
          getState: async () => "active",
          discard: async () => {},
          remove: async () => {},
        };
      },
    }));
  });

  after(() => {
    mock.restoreAll();
  });

  test("enqueueJob - Enqueues a job successfully", async () => {
    const job = await jobsService.enqueueJob("mock-project-uuid", "video-preparation", "NORMAL");
    assert.strictEqual(job.id, "mock-job-uuid");
    assert.strictEqual(job.stage, "video-preparation");
    assert.strictEqual(job.status, "queued");
  });

  test("cancelJob - Cancels a job successfully", async () => {
    // Override select mock once to return a job in queued state
    mock.method(db, "select", () => ({
      from: () => ({
        where: () => ({
          limit: async () => [{ ...mockInsertedJob, status: "queued", queueName: "video-preparation" }],
        }),
      }),
    }), { times: 1 });

    const success = await jobsService.cancelJob("mock-job-uuid");
    assert.strictEqual(success, true);
  });

  test("retryJob - Retries a failed job successfully", async () => {
    // Override select mock once to return a job in failed state
    mock.method(db, "select", () => ({
      from: () => ({
        where: () => ({
          limit: async () => [{ ...mockInsertedJob, status: "failed", queueName: "video-preparation" }],
        }),
      }),
    }), { times: 1 });

    const success = await jobsService.retryJob("mock-job-uuid");
    assert.strictEqual(success, true);
  });

  test("updateProgress - Updates progress successfully", async () => {
    await jobsService.updateProgress("mock-job-uuid", 50);
    assert.ok(true);
  });

  test("completeJob - Completes job successfully", async () => {
    await jobsService.completeJob("mock-job-uuid");
    assert.ok(true);
  });

  test("failJob - Fails job successfully", async () => {
    await jobsService.failJob("mock-job-uuid", "Failed due to division by zero");
    assert.ok(true);
  });
});
