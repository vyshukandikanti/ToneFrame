# DubVerse AI Cloud Deployment Guide

This guide details the instructions to configure, deploy, and verify the DubVerse AI application stack on live production cloud services.

---

## 1. Cloud Services Mapping
- **Frontend Hosting:** Vercel (preferred) or Cloudflare Pages.
- **Backend API Server:** Railway or Render.
- **Background Queue Workers:** Railway or Render (as a worker service, `START_HTTP=false`).
- **Managed Database:** Neon PostgreSQL or Supabase.
- **Managed Redis (BullMQ):** Upstash Redis or Railway Redis.
- **Managed Object Storage:** Cloudflare R2 or AWS S3.

---

## 2. Infrastructure Setup & Provisioning

### A. Database (Neon / Supabase)
1. Provision a new PostgreSQL database instance (version 15+).
2. Retrieve the connection URI:
   `postgresql://db_user:password@ep-host-name.neon.tech/dubverse?sslmode=require`
3. Configure the SSL parameter to enforce safe connection encryption.

### B. Redis Queue Cache (Upstash)
1. Create a new Upstash Redis cluster. Disable eviction (to guarantee that BullMQ active jobs are persistent).
2. Retrieve the `REDIS_URL` connection string:
   `rediss://default:token@host.upstash.io:6379`
   *(Ensure `rediss://` protocol is used for TLS/SSL).*

### C. Object Storage (Cloudflare R2)
1. Create a new R2 bucket (e.g. `dubverse-bucket`).
2. Generate API tokens with **Edit/Read** permissions.
3. Configure the access key endpoints:
   - Access Key ID: `AWS_ACCESS_KEY_ID`
   - Secret Access Key: `AWS_SECRET_ACCESS_KEY`
   - Endpoint: `https://<account_id>.r2.cloudflarestorage.com`

---

## 3. Database Migration Deployment Step
Run the schema pushes against the live database before starting backend app containers.
With your local environment variables pointed to the live database (`DATABASE_URL=postgresql://...`), run:
```bash
pnpm --filter @workspace/db push
```
Or, configure a one-off execution container in Railway executing `pnpm --filter @workspace/db push` that exits on completion.

---

## 4. Deployed Server Configurations

### A. Backend & Worker (Railway / Render)
Deploy using the root `Dockerfile.backend` and `Dockerfile.worker` respectively.

#### Required Environment variables (Backend)
- `PORT`: Automatically set by the hosting provider.
- `NODE_ENV`: `production`
- `DATABASE_URL`: Connection string to Neon database.
- `REDIS_URL`: Connection string to Upstash Redis.
- `JWT_SECRET`: Secure cryptographic token.
- `S3_BUCKET`: Name of your bucket.
- `AWS_ENDPOINT_URL_S3`: Cloudflare R2/S3 endpoint.
- `HF_TOKEN`, `REPLICATE_API_TOKEN`, `OPENAI_API_KEY`: Secrets for transcription, translation, and lip sync models.
- `START_HTTP`: `true`

#### Required Environment variables (Worker)
- Configure all variables same as Backend, but set `START_HTTP=false`.

### B. Frontend (Vercel)
Import the repository on Vercel and configure:
- **Build Command:** `pnpm run build`
- **Output Directory:** `artifacts/dubverse-ai/dist/public`
- **Environment Variables:**
  - `VITE_API_URL`: Your deployed Backend URL (e.g. `https://api.yourdomain.com`).
  - `VITE_SOCKET_URL`: Your deployed Backend URL (e.g. `https://api.yourdomain.com`).
- **SPA Rewrite Fallback:** The repository contains a pre-configured [vercel.json](file:///c:/Users/vyshu/Downloads/Module-One/Module-One/artifacts/dubverse-ai/vercel.json) that redirects routing subpaths back to `index.html` dynamically.

---

## 5. Rollback Procedure
If a production release introduces regression:
1. **Frontend:** Select the last stable deployment in the Vercel dashboard and click **Promote to Production**.
2. **Backend/Worker:** Revert to the last stable git commit SHA in your Railway project, or trigger the rollback action from the Railway settings panel.
3. **Database Schema:** If a database push must be reverted, schema pushes are backwards compatible (no columns are dropped automatically). To manually resolve schema drift, use `drizzle-kit push --force`.

---

## 6. Common Deployment Issues & Troubleshooting
- **WebSockets connection fails:** Ensure that your backend hosting provider (e.g. Railway) has port forwarding configured and doesn't terminate idle WebSocket connections. If using Render, ensure WebSockets are enabled in the service settings.
- **Upload limits exceeded:** Render/Railway proxy layers may cap request body limits. Enforce signed upload URLs so that clients upload files directly to Cloudflare R2/S3, bypassing backend HTTP limits completely.
