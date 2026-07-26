# DubVerse AI Production Deployment Guide

This guide details the steps required to build, configure, migrate, and run the DubVerse AI application suite in a production environment.

---

## 1. Prerequisites
Before deploying, ensure the following infrastructure is provisioned:
- **Docker & Docker Compose:** Version 20.10+ and 2.10+ respectively.
- **PostgreSQL Database:** Version 15+ (with SSL support enabled in production).
- **Redis Cache Store:** Version 7+ (used for BullMQ background queues).
- **Object Storage:** AWS S3 or Cloudflare R2 bucket configured.

---

## 2. Environment Configuration
Create a `.env` file in the root directory based on `.env.example`. Ensure the following keys are populated:

### Database & Redis
- `DATABASE_URL`: Connection string (`postgresql://user:password@host:port/database?sslmode=require`).
- `REDIS_URL`: Connection string (`redis://host:port` or `rediss://...` for SSL).
- `JWT_SECRET`: A secure cryptographically random key.

### Object Storage (S3 / R2)
- `AWS_ACCESS_KEY_ID`: S3/R2 client credential key.
- `AWS_SECRET_ACCESS_KEY`: S3/R2 client credential secret.
- `S3_BUCKET`: Name of your storage bucket.
- `AWS_REGION`: Bucket region (e.g. `us-east-1`).
- `AWS_ENDPOINT_URL_S3`: (Optional) Overridden endpoint URL (e.g., for MinIO or custom R2 endpoints).

### AI Provider Keys
- `HF_TOKEN`: Required for Hugging Face Inference API models (Emotion and NLLB translation).
- `REPLICATE_API_TOKEN`: Required for Replicate predictions (Pyannote, Wav2Lip, MuseTalk, SadTalker).
- `FISH_AUDIO_API_KEY`: Required for Fish Audio TTS voice clones.
- `ELEVENLABS_API_KEY`: Required for ElevenLabs syntheses.

---

## 3. Database Migration Step
DubVerse AI separates database schema migration pushes from the application runtime to ensure standard deployment lifecycle boundaries.

To apply database pushes in production, run:
```bash
docker compose run --rm db-migrator
```
This spawns a transient container that executes `pnpm --filter @workspace/db push` and exits automatically.

---

## 4. Container Deployment Command Block
To build and spin up the complete application container stack, run:
```bash
# Build production multi-stage images
docker compose build

# Start the services in detached mode
docker compose up -d
```

### Services Checklist
- **`postgres`:** Database instance (if not using cloud RDS).
- **`redis`:** Queue broker.
- **`minio`:** Local object storage instance (fallback).
- **`db-migrator`:** Syncs Drizzle models to Postgres.
- **`backend`:** Express application API server. Exposes health at `/api/health`.
- **`worker`:** Dedicated BullMQ task consumer.
- **`frontend`:** Vite production static assets served via Nginx.
- **`gateway`:** Reverse proxy handling TLS/SSL termination, rate limiting, and SPA pathing.

---

## 5. Health Probe Endpoints
The backend API server container exposes standard JSON status routing paths:
- System overview summary: `GET /api/health`
- PostgreSQL connectivity: `GET /api/health/database`
- Cache broker connectivity: `GET /api/health/redis`
- Object storage connectivity: `GET /api/health/storage`
- AI service providers fallback status: `GET /api/health/providers`

---

## 6. Troubleshooting Diagnostics
- **Check container status:** `docker compose ps`
- **Inspect service logs:** `docker compose logs -f <service_name>`
- **Verify Nginx configuration check:** `docker compose exec gateway nginx -t`
