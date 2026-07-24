# syntax=docker/dockerfile:1

# ---- Builder: install all deps, compile TS, prune to prod ----
FROM node:22-slim AS builder
WORKDIR /app
ENV CI=true
# Provision pnpm up front. corepack's on-demand fetch can hit transient registry
# 522s under emulation, so activate it eagerly with a small retry loop.
RUN corepack enable \
 && for i in 1 2 3; do corepack prepare pnpm@11.10.0 --activate && break || sleep 5; done

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
    DataPath=/app/data \
    CacheDir=/app/.cache/transformers

# onnxruntime's CPU backend links libgomp (OpenMP), absent from the slim image.
RUN apt-get update \
 && apt-get install -y --no-install-recommends libgomp1 \
 && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./

# Baked search index + embedding-model cache → no network needed at runtime.
COPY data/search-records-vector.db data/search-records-vector.db-wal ./data/
COPY data/*.json ./data/
COPY .cache/transformers ./.cache/transformers

# Run non-root; the data dir must stay writable (libSQL opens the DB in WAL mode
# and creates -wal/-shm on open).
RUN useradd --system --create-home --uid 1001 app \
 && chown -R app:app /app
USER app

EXPOSE 8080
CMD ["node", "dist/bin.js", "shttp"]
