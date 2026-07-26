# DubVerse AI Actual Cloud Deployment Playbook

This handbook contains the interactive steps, variables, and commands required to deploy the DubVerse AI application from GitHub to Neon (PostgreSQL), Upstash (Redis), Cloudflare R2 (Storage), Railway/Render (Backend API & Worker), and Vercel (Frontend).

---

## 1. Deployed Infrastructure Diagram
```mermaid
graph TD
    Client[React/Vite SPA on Vercel]
    Gateway[Nginx Reverse Proxy / Gateway]
    API[Express Server on Railway]
    Worker[BullMQ Worker on Railway]
    DB[(Neon Managed PostgreSQL)]
    Cache[(Upstash Managed Redis)]
    Storage[(Cloudflare R2 Bucket)]

    Client -->|HTTPS / WSS| Gateway
    Gateway -->|Forward| API
    API -->|Read/Write| DB
    API -->|Enqueue Jobs| Cache
    Worker -->|Process Jobs| Cache
    Worker -->|Write Output| DB
    Worker -->|Upload Assets| Storage
    API -->|Signed URLs| Storage
```

---

## 2. Step-by-Step Deployment Instructions

### Step 2.1: Managed Database (Neon PostgreSQL)
1. Sign up on [Neon.tech](https://neon.tech) and create a project named `dubverse`.
2. Provision a new PostgreSQL 15 database instance.
3. Locate the Connection String in your Neon Dashboard and append `?sslmode=require` to enforce encryption:
   ```env
   DATABASE_URL=postgresql://alex:password@ep-cool-snowflake-12345.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

### Step 2.2: Managed Cache Broker (Upstash Redis)
1. Sign up on [Upstash.com](https://upstash.com) and create a Redis database named `dubverse-queues`.
2. Disable eviction under database settings to ensure BullMQ jobs are persistent.
3. Retrieve the **Redis Connection URL** (copy the `rediss://` format for SSL support):
   ```env
   REDIS_URL=rediss://default:token@cool-monkey-12345.upstash.io:6379
   ```

### Step 2.3: Production Object Storage (Cloudflare R2)
1. Sign up on [Cloudflare.com](https://cloudflare.com) and navigate to **R2 Object Storage**.
2. Click **Create Bucket** and name it `dubverse-assets`. Set Region to `auto`.
3. In Bucket settings, click **CORS Policy** and paste the following configuration:
   ```json
   [
     {
       "AllowedHeaders": ["*"],
       "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
       "AllowedOrigins": ["https://your-app.vercel.app", "http://localhost:5173"],
       "ExposeHeaders": ["ETag"]
     }
   ]
   ```
4. Under R2 Overview, click **Manage R2 API Tokens** and create a token with **Edit/Read** permissions. Copy the credentials:
   - Access Key ID: `AWS_ACCESS_KEY_ID`
   - Secret Access Key: `AWS_SECRET_ACCESS_KEY`
   - Endpoint: `https://<account_id>.r2.cloudflarestorage.com`

---

## 3. Database Migration Execution
Ensure that all PostgreSQL tables exist before starting the application services.
Execute this schema push script locally using your live database connection URL:
```bash
# In the project root, run:
cross-env DATABASE_URL="postgresql://alex:password@ep-cool-snowflake-12345.us-east-2.aws.neon.tech/neondb?sslmode=require" pnpm --filter @workspace/db push
```

---

## 4. Deployed Application Services

### Step 4.1: Backend API & BullMQ Worker (Railway)
1. Connect your GitHub repository to [Railway.app](https://railway.app).
2. Click **New Service** -> **GitHub Repo** -> Choose your repo.
3. **Backend Service Setup (`dubverse-backend`):**
   - In Settings, set Build Command to empty (it uses the `Dockerfile.backend` file automatically).
   - Expose Port `5000`.
   - Add the following Environment variables:
     - `PORT=5000`
     - `NODE_ENV=production`
     - `START_HTTP=true`
     - `DATABASE_URL` *(Neon Postgres connection URI)*
     - `REDIS_URL` *(Upstash Redis connection URI)*
     - `JWT_SECRET` *(Secure cryptographic string)*
     - `S3_BUCKET=dubverse-assets`
     - `AWS_ACCESS_KEY_ID` & `AWS_SECRET_ACCESS_KEY` *(Cloudflare R2 keys)*
     - `AWS_ENDPOINT_URL_S3` *(Cloudflare R2 custom endpoint)*
     - `AWS_REGION=us-east-1`
     - `HF_TOKEN`, `REPLICATE_API_TOKEN`, `OPENAI_API_KEY`: API secrets for models fallbacks.
     - `WHISPER_PROVIDER=replicate`
     - `TRANSLATION_PROVIDER=gemini`
     - `VOICE_PROVIDER=fishspeech`
     - `LIPSYNC_PROVIDER=wav2lip`
     - `RENDERING_PROVIDER=ffmpeg`
   - Railway will provide a public URL for your backend API server (e.g. `https://api.railway.app`).

4. **Worker Service Setup (`dubverse-worker`):**
   - Create a second service from the same GitHub Repo.
   - Name it `dubverse-worker`.
   - Under Settings, specify the Dockerfile path: `Dockerfile.worker`.
   - Add all backend environment variables, but set:
     - `START_HTTP=false`

---

### Step 4.2: Frontend Application (Vercel)
1. Import your GitHub repository into [Vercel.com](https://vercel.com).
2. Set Root Directory to `artifacts/dubverse-ai`.
3. Select Framework Preset as **Vite**.
4. Configure the Environment variables:
   - `VITE_API_URL`: Your deployed Railway backend URL (e.g., `https://api.railway.app`).
   - `VITE_SOCKET_URL`: Your deployed Railway backend URL (e.g., `https://api.railway.app`).
5. Click **Deploy**. Vercel will automatically build the client-side code and apply the routing fallback rules specified in the `vercel.json` file.

---

## 5. Post-Deployment Verification Checkpoints
After deploying all services:
1. Verify system status health: `GET https://api.railway.app/api/health`
2. Check DB status: `GET https://api.railway.app/api/health/database` (Returns `{"status": "healthy"}`)
3. Check Redis status: `GET https://api.railway.app/api/health/redis` (Returns `{"status": "healthy"}`)
4. Access the frontend app URL on Vercel and verify register/login triggers.
