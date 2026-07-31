# syntax=docker/dockerfile:1

# ---- Builder: install all deps, compile TS, prune to prod ----
FROM node:22-slim AS builder
WORKDIR /app
ENV CI=true
# Provision pnpm up front. corepack's on-demand fetch can hit transient registry
# 522s under emulation, so activate it eagerly with a small retry loop.
# Keep in sync with `packageManager` in package.json — a mismatch installs against
# a lockfile written by a different pnpm.
RUN corepack enable \
 && for i in 1 2 3; do corepack prepare pnpm@11.17.0 --activate && break || sleep 5; done

# Manifests first for layer caching. pnpm-workspace.yaml carries `allowBuilds`
# (e.g. onnxruntime-node), which pnpm needs to run the native install scripts.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json tsconfig.build.json ./
COPY lib ./lib
# Compile directly with tsgo — NOT `pnpm run build`, which also runs lint and a
# `version` step that does `git add` and fails without a git repo.
RUN pnpm exec tsgo -p tsconfig.build.json

# Drop devDependencies but keep the downloaded native binaries (onnxruntime-node,
# @tursodatabase/*-gnu) so the runtime stage needs neither pnpm nor network.
RUN pnpm prune --prod

# ---- Runtime: slim image with only prod node_modules + baked data ----
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    Port=8080 \
    DataPath=/app/data

# onnxruntime's CPU backend links libgomp (OpenMP), absent from the slim image.
RUN apt-get update \
 && apt-get install -y --no-install-recommends libgomp1 \
 && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./

# Baked search index + embedding model (root-level transformers/) → no network needed at runtime.
# Test artifacts live in the top-level data-test/ (outside data/); .dockerignore also drops
# *.db-shm. So this copies the DB + WAL + JSONs, plus the model cache.
# The model cache path is cwd-relative, so WORKDIR /app is what puts it where the app looks.
COPY data ./data/
COPY transformers ./transformers/

# Run non-root; the data dir must stay writable (libSQL opens the DB in WAL mode
# and creates -wal/-shm on open).
RUN useradd --system --create-home --uid 1001 app \
 && chown -R app:app /app
USER app

LABEL org.opencontainers.image.title="learn-mcp-server" \
      org.opencontainers.image.description="MCP server for advanced search in kontent.ai learn materials, documentation & API reference" \
      org.opencontainers.image.source="https://github.com/kontent-ai/mcp-server" \
      org.opencontainers.image.licenses="MIT"

EXPOSE 8080
CMD ["node", "dist/bin.js", "shttp"]
