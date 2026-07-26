import * as Sentry from "@sentry/node";
import { CONFIG } from "../config";
import { logger } from "../lib/logger";

export function initSentry(): void {
  if (!CONFIG.SENTRY_DSN) {
    logger.info("[Sentry] SENTRY_DSN is not configured. Crash reporting is disabled.");
    return;
  }

  Sentry.init({
    dsn: CONFIG.SENTRY_DSN,
    environment: CONFIG.NODE_ENV,
    tracesSampleRate: 1.0, // Adjust in production
  });

  logger.info(`[Sentry] SDK initialized in ${CONFIG.NODE_ENV} environment.`);
}

export function captureException(err: any, context?: Record<string, any>): void {
  if (!CONFIG.SENTRY_DSN) {
    logger.error(err, "Unhandled exception (Sentry disabled)", context);
    return;
  }

  Sentry.withScope((scope) => {
    if (context) {
      Object.entries(context).forEach(([key, val]) => {
        scope.setExtra(key, val);
      });
    }
    Sentry.captureException(err);
  });
}

export function setupSentryErrorHandler(app: any): void {
  if (CONFIG.SENTRY_DSN) {
    Sentry.setupExpressErrorHandler(app);
  }
}
export default Sentry;
