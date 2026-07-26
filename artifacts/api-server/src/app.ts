import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

import { setupSentryErrorHandler } from "./services/sentry";

const app: Express = express();
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
import { setupSecurityMiddlewares, globalRateLimiter } from "./middlewares/security";

setupSecurityMiddlewares(app);
app.use(cookieParser());
app.use(globalRateLimiter);

import { httpRequestDurationSeconds, getMetrics, metricsContentType } from "./services/metrics";

// Request duration instrumentation middleware
app.use((req, res, next) => {
  const start = process.hrtime();
  res.on("finish", () => {
    if (req.path === "/metrics" || req.path.startsWith("/health")) return;
    
    const diff = process.hrtime(start);
    const duration = diff[0] + diff[1] / 1e9;
    const route = req.route ? req.route.path : req.path;
    
    httpRequestDurationSeconds.observe(
      {
        method: req.method,
        route: route || "unknown",
        status_code: res.statusCode.toString(),
      },
      duration
    );
  });
  next();
});

app.get("/metrics", async (req, res) => {
  try {
    res.setHeader("Content-Type", metricsContentType);
    res.send(await getMetrics());
  } catch (err: any) {
    res.status(500).send(err.message || "Failed to fetch metrics");
  }
});

app.use("/api", router);

// Sentry error capture handler
setupSentryErrorHandler(app);

export default app;
