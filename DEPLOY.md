# Deploying to Azure Container Instances (via Docker Hub)

This server is packaged as a Docker image with the search index (`data/*.db`) and the
embedding-model cache (`.cache/transformers`) **baked in**, so the running container needs no
secrets and no network. The MCP endpoint is served over Streamable HTTP at `POST /mcp`
(health check at `GET /health`).

Deployment target: **Azure Container Instances (ACI)**, managed through the **Azure Portal**
(no `az` CLI required). The image is distributed via **Docker Hub** and served over **plain
HTTP** (ACI has no built-in TLS — fine for testing).

Two things to know about ACI:

- It can only run an image **pulled from a registry** — there's no "upload image". Build
  locally, push to Docker Hub, and ACI pulls it.
- A container instance's image is **immutable** — to change the image you delete the instance
  and create a new one (reuse the same resource group).

> **Build the image locally**, not in CI: the vector DB and model cache are gitignored, so
> only your working copy has them.
>
> **Architecture:** ACI runs **linux/amd64**. On an Apple Silicon / ARM machine you must build
> the pushed image with `--platform linux/amd64` (the `docker:build:linux` script does this).
> A native build is fine for local testing only.

## Prerequisites

- Docker (with Buildx) and a Docker Hub account.
- The runtime data present locally: `data/search-records-vector.db` and
  `.cache/transformers/Xenova/all-MiniLM-L6-v2/…`. If missing, run `pnpm install && pnpm run init`
  (needs `LearnHost` reachable) to build them first.

## 1. Test locally (optional but recommended)

Fast native-arch build:

```bash
pnpm run docker:build                       # docker build -t learn-mcp:local .
docker run --rm -p 8080:8080 learn-mcp:local
curl localhost:8080/health                  # → {"status":"ok",...}
npx @modelcontextprotocol/inspector         # connect to http://localhost:8080/mcp, run a search
```

## 2. Build the amd64 image and push to Docker Hub

Use a **private** repo (the image bundles data + model); a public repo also works and needs no
pull credentials in ACI. Replace `<user>` with your Docker Hub username.

```bash
docker login                                # Docker Hub
pnpm run docker:build:linux                 # docker build --platform linux/amd64 -t learn-mcp:linux .
docker tag learn-mcp:linux <user>/learn-mcp:0.0.1
docker push <user>/learn-mcp:0.0.1
```

## 3. Create the container in the Azure Portal

1. Delete the existing sample container instance (keep the resource group).
2. **Create → Container Instances**, in the same resource group / region. Configure:
   - **Image source:** *Other registry* → **Image:** `docker.io/<user>/learn-mcp:0.0.1`.
     - If the repo is **private**: registry login server `index.docker.io`, plus your Docker
       Hub username and password/PAT.
   - **Size:** **1 vCPU, 2 GB** memory (raise the ~1.5 GB default — the ONNX model needs room).
   - **Networking:** Public; set a **DNS name label** (e.g. `kontent-learn-mcp` →
     `kontent-learn-mcp.<region>.azurecontainer.io`); open **TCP port 8080**.
   - **Advanced → Environment variables:** none required (the image defaults `Port=8080`; set
     `Port` here only to change it, keeping it in sync with the open port).
   - **Restart policy:** On failure (or Always).
3. Create, and wait for the instance to reach **Running**.

## 4. Verify

The instance **Overview** shows the FQDN / public IP.

```bash
curl http://<fqdn>:8080/health
```

Point an MCP client at the endpoint (note **http**, and the `:8080` port):

```json
{ "mcpServers": { "kontent-learn": { "type": "http", "url": "http://<fqdn>:8080/mcp" } } }
```

The first request loads the embedding model into memory (a few seconds); later requests are
fast. View logs in the Portal under the container instance → **Containers → Logs**.

## Notes

- **HTTP only.** ACI provides no TLS. Some MCP clients require `https` for remote servers; if
  you need it, front the instance with Azure Front Door or Application Gateway to terminate TLS.
- **Cost.** ACI has no scale-to-zero and bills while running — stop the instance when idle.
- **`POST /init` is unauthenticated.** With the index baked in it isn't needed at runtime, but
  it is exposed and would trigger a heavy reindex (and needs `LearnHost`) if called. Consider
  gating or removing it in `lib/transport/shttp.ts` before any non-test exposure.
