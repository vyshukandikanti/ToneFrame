import { createServer } from "http";
import app from "./app";
import { logger } from "./lib/logger";
import { initializeSocketServer } from "./services/socket";
import { startWorkers, shutdownWorkers } from "./workers";

const rawPort = process.env["PORT"] || "5000";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

import { initSentry } from "./services/sentry";

// Initialize Sentry Crash Reporting
initSentry();

// 1. Create HTTP server wrapping Express app
const server = createServer(app);

// 2. Start background queue workers
startWorkers();

const startHttp = process.env["START_HTTP"] !== "false";

if (startHttp) {
  // 3. Initialize Socket.io WebSocket server
  initializeSocketServer(server);

  // 4. Start listening
  server.listen(port, () => {
    logger.info({ port }, "Server listening with WebSocket and Background Worker infrastructure initialized.");
  });
} else {
  logger.info("Server started in WORKER-ONLY mode (HTTP server and WebSockets are disabled).");
}

// 5. Graceful shutdown handler
async function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal} signal. Shutting down gracefully...`);
  
  // Stop workers from accepting new jobs and finish active ones
  try {
    await shutdownWorkers();
  } catch (err) {
    logger.error(err, "Error shutting down workers");
  }

  // Close HTTP server
  server.close(() => {
    logger.info("HTTP server closed.");
    process.exit(0);
  });
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
