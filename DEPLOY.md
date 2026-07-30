# Deploying to Azure Container Instances (via Docker Hub)

This server is packaged as a Docker image with the search index (`data/*.db`) and the
embedding model (root-level `transformers/`) **baked in**, so the running container needs no
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

> **Build the image locally**, not in CI: the vector DB is gitignored (the embedding model is
> committed under `transformers/`), so a CI runner without the DB can't build a working image.
>
> **Architecture:** ACI runs **linux/amd64**. On an Apple Silicon / ARM machine you must build
> the pushed image with `--platform linux/amd64` (the `docker:build:linux` script does this).
> A native build is fine for local testing only.

## Prerequisites

- Docker (with Buildx) and a Docker Hub account.
- The runtime data present locally: `data/search-records-vector.db` and
  `transformers/Xenova/all-MiniLM-L6-v2/…`. If missing, run `pnpm install && pnpm run init`
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

Replace `<user>` with your Docker Hub username. A private repo is fine (the image bundles data
+ model), and a public repo works too — but either way, supply Docker Hub credentials to ACI
so pulls are authenticated (see the rate-limiting note in Troubleshooting).

```bash
docker login                                # Docker Hub
pnpm run docker:build:linux                 # docker build --platform linux/amd64 -t learn-mcp:linux .
docker tag learn-mcp:linux <user>/learn-mcp:latest
docker push <user>/learn-mcp:latest
```

Re-pushing `:latest` re-points the tag at the new image, so a redeploy is always: push, then
recreate the instance (ACI is immutable — see step 3).

## 3. Create the container in the Azure Portal

1. Delete the existing sample container instance (keep the resource group).
2. **Create → Container Instances**, in the same resource group / region. Configure:
   - **Image source:** *Other registry* → **Image:** `docker.io/<user>/learn-mcp:latest`.
     - Write the **`:latest` tag explicitly** so the reference is unambiguous.
     - **Provide registry credentials even for a public repo** (see the rate-limiting note
       below): login server `index.docker.io`, user name `<user>`, password = a Docker Hub
       **Personal Access Token**.
   - **Size:** **1 vCPU, 2 GB** memory (raise the ~1.5 GB default — the ONNX model needs room).
   - **Networking:** Public; set a **DNS name label** (e.g. `kontent-learn-mcp` →
     `kontent-learn-mcp.<region>.azurecontainer.io`).
     - ⚠️ **Ports: change the default `80` to `8080`.** Azure defaults the exposed port to
       **80**, but this app listens on **8080** and **ACI does not remap ports** — if you leave
       it at 80, connections to `:8080` time out and connections to `:80` are reset. Open
       **TCP 8080** and nothing else. (Don't instead switch the app to port 80: the container
       runs as a non-root user and can't bind to ports below 1024.)
   - **Advanced → Environment variables:** none required (the image defaults `Port=8080`; set
     `Port` here only to change it, and keep it in sync with the exposed port).
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

## Troubleshooting

### The live URL/IP doesn't respond (but logs say "running on port 8080")

ACI defaults the container group's exposed port to **80** and does **not** remap ports, while
this app listens on **8080**. If you left the port at 80:

- `http://<fqdn>:8080/health` → connection **times out** (8080 isn't exposed).
- `http://<fqdn>/health` (port 80) → connection **reset** (80 is exposed but nothing listens).

Fix: recreate the container group with **TCP 8080** exposed (ACI is immutable — delete and
recreate). Then use the full URL **with scheme and port**: `http://<fqdn>:8080/mcp`. A browser
defaults to `:80`, so you must type `:8080` explicitly. Also note `GET /mcp` returns **405** by
design (the endpoint is `POST /mcp`); test reachability with `GET /health`.

### Docker Hub rate limiting — `RegistryErrorResponse`, "please retry later"

Docker Hub heavily throttles **anonymous** pulls, counted **per IP**. ACI pulls over Azure's
shared egress IPs, whose anonymous quota is often already exhausted by other tenants, so the
pull fails with `RegistryErrorResponse` even though the image is public.

Fix: **authenticate the pull** with a Personal Access Token (PAT). Authenticated pulls count
against your account, not the shared IP, and get much higher limits.

1. Create a PAT: sign in at hub.docker.com → avatar → **Account settings → Personal access
   tokens → Generate new token**. Give it **Read-only** access and copy it (shown once).
2. (Optional) Authenticate your local Docker too: `docker login -u <user>` and paste the PAT
   as the password.
3. In the ACI create flow, set the image registry credentials:
   - **Image registry login server:** `index.docker.io`
   - **Image registry user name:** `<user>`
   - **Image registry password:** the PAT
4. The PAT is a secret — keep it out of source control; it lives only in the ACI credentials
   field and your local `docker login`.

If Docker Hub throttling remains a recurring problem, use **Azure Container Registry** instead
(same cloud, no Docker Hub limits): create an ACR, enable its Admin user,
`docker login <name>.azurecr.io`, push, and point ACI at the ACR image.

### `InaccessibleImage`

The image reference doesn't resolve. Check, in order: a typo in `<user>` or the repo name, a push
that never completed (`docker manifest inspect docker.io/<user>/learn-mcp:latest` should succeed),
and — for a private repo — missing or invalid registry credentials.

## Notes

- **HTTP only.** ACI provides no TLS. Some MCP clients require `https` for remote servers; if
  you need it, front the instance with Azure Front Door or Application Gateway to terminate TLS.
- **Cost.** ACI has no scale-to-zero and bills while running — stop the instance when idle.
- **`:latest` is a moving pointer**, so there's no tagged rollback target and two builds of the
  same source can't be told apart by tag. Cross-check what's live with
  `curl http://<fqdn>:8080/health`, which reports the `package.json` version. If rollback becomes
  a real need, push an immutable tag (the version or a short git SHA) alongside `latest`.
- **`POST /init` is unauthenticated.** With the index baked in it isn't needed at runtime, but
  it is exposed and would trigger a heavy reindex (and needs `LearnHost`) if called. Consider
  gating or removing it in `lib/transport/shttp.ts` before any non-test exposure.
