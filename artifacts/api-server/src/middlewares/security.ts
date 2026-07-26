import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cors from "cors";
import express from "express";

// 1. General Rate Limiter (max 100 requests per 15 minutes per IP)
export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    error: "Too many requests from this IP. Please try again after 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// 2. Sensitive endpoint Rate Limiter (login/register limits: max 15 requests per 15 minutes)
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: {
    error: "Too many authentication attempts. Please try again after 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// 3. Central security middleware mounting utility
export function setupSecurityMiddlewares(app: express.Express): void {
  // Helmet HTTP security headers
  app.use(helmet());

  // CORS config allowing requests
  app.use(
    cors({
      origin: true, // Echo request origin
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
    })
  );

  // Set request payload body limits (e.g. 100MB max limit to allow multipart video uploads)
  app.use(express.json({ limit: "100mb" }));
  app.use(express.urlencoded({ extended: true, limit: "100mb" }));
}
