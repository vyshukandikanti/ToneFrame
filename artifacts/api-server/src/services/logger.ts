import pino from "pino";
import path from "path";

const isProduction = process.env.NODE_ENV === "production";
const logLevel = process.env.LOG_LEVEL ?? "info";

// Ensure logs directory exists
const logDirectory = "./logs";

export const logger = pino({
  level: logLevel,
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']",
    "password",
    "token",
    "accessToken",
  ],
  transport: {
    targets: [
      // Target 1: Console Logger
      {
        target: isProduction ? "pino/file" : "pino-pretty",
        level: logLevel,
        options: isProduction ? {} : { colorize: true },
      },
      // Target 2: File Logger (persisted in logs directory)
      {
        target: "pino/file",
        level: logLevel,
        options: {
          destination: path.join(logDirectory, "combined.log"),
          mkdir: true,
        },
      },
    ],
  },
});
export default logger;
