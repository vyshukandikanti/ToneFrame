import client from "prom-client";

// Enable collection of default metrics
client.collectDefaultMetrics({ register: client.register });

// API requests duration histogram
export const httpRequestDurationSeconds = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
});

// BullMQ Queue sizes gauge
export const queueSizeGauge = new client.Gauge({
  name: "bullmq_queue_size",
  help: "Number of active or waiting items in BullMQ queues",
  labelNames: ["queue_name", "status"],
});

// Completed jobs count
export const completedJobsCounter = new client.Counter({
  name: "bullmq_jobs_completed_total",
  help: "Total number of successfully processed background jobs",
  labelNames: ["queue_name"],
});

// Failed jobs count
export const failedJobsCounter = new client.Counter({
  name: "bullmq_jobs_failed_total",
  help: "Total number of failed background jobs",
  labelNames: ["queue_name"],
});

// Upload throughput counter
export const uploadThroughputCounter = new client.Counter({
  name: "dubverse_upload_throughput_bytes_total",
  help: "Total size of uploaded original videos in bytes",
});

// Active workers gauge
export const activeWorkersGauge = new client.Gauge({
  name: "dubverse_active_workers",
  help: "Active background queue worker instance counts",
  labelNames: ["queue_name"],
});

// Expose metrics registry text format
export async function getMetrics(): Promise<string> {
  return await client.register.metrics();
}

export const metricsContentType = client.register.contentType;
