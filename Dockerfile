# Base image
FROM node:24-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Copy configuration files
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY lib/db/package.json ./lib/db/
COPY lib/api-spec/package.json ./lib/api-spec/
COPY lib/api-zod/package.json ./lib/api-zod/
COPY lib/api-client-react/package.json ./lib/api-client-react/
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY artifacts/dubverse-ai/package.json ./artifacts/dubverse-ai/
COPY scripts/package.json ./scripts/

# Install dependencies (ignoring lifecycle scripts for Windows safety during build)
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --ignore-scripts

# Copy project source files
COPY lib ./lib
COPY artifacts ./artifacts
COPY scripts ./scripts

# Build the workspace libraries and application
RUN pnpm run build

# Production image
FROM node:24-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Copy node_modules and built bundles from base
COPY --from=base /app /app

EXPOSE 5000

# Run command
CMD ["node", "./artifacts/api-server/dist/index.mjs"]
