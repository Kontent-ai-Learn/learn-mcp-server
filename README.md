# Kontent.ai Learn MCP Server

[![npm version](https://img.shields.io/npm/v/@kontent-ai/learn-mcp-server.svg)](https://www.npmjs.com/package/@kontent-ai/learn-mcp-server)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE.md)

AI-powered semantic search over [Kontent.ai](https://kontent.ai) Learn — documentation, developer guides, and API reference — exposed through the [Model Context Protocol](https://modelcontextprotocol.io). Point Claude, Cursor, or VS Code at it and ask questions in natural language to get grounded, source-linked answers straight from the docs.

> This is the **Learn** MCP server (read-only search over documentation). For managing content in your projects, see the general-purpose [Kontent.ai MCP Server](https://github.com/kontent-ai/mcp-server).

## Key Features

- 🔎 **Semantic documentation search** — ask a question, get the most relevant Learn articles back in full (title, source URL, and complete content) so the assistant can answer directly without fetching URLs.
- 🧩 **API reference lookups** — retrieve the full details of a specific API **endpoint** (URLs, code samples, request/response schemas, query parameters, headers) or a specific API **object** (properties, types, modifiers, nested properties).
- 🖥️ **Runs fully locally** — embeddings are computed on-device with [transformers.js](https://github.com/huggingface/transformers.js) and stored in a local [Turso](https://github.com/tursodatabase)/libSQL vector database. No external AI API key is required for search.
- 🔌 **Two transports** — `stdio` for local MCP clients and Streamable HTTP for hosted/remote setups.

## Available Tools

| Tool                   | Description                                                                                                                                                                         |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `search-content`       | Searches Kontent.ai Learn documentation and developer guides. Returns the most relevant documents in full (title, source URL, and complete content).                                |
| `get-endpoint-details` | Retrieves details for a requested API endpoint: endpoint URL, title, description, code samples, request/response body schemas, query parameters, and headers.                       |
| `get-object-details`   | Retrieves details for a requested API reference object: URL, title, description, the API it belongs to, and its properties (name, type, description, modifiers, nested properties). |

All tools are **read-only** and operate on public Kontent.ai Learn content.

## How It Works

On initialization the server pulls content from the Learn host and builds a local search index:

1. **Fetch** search records, API-reference endpoints, and API-reference objects from the Learn AI endpoints, caching each response as JSON on disk.
2. **Chunk & embed** the documents with the `Xenova/all-MiniLM-L6-v2` model (384-dim embeddings).
3. **Store** documents and chunk embeddings in a local libSQL/Turso vector database.
4. **Search** at query time by embedding the query and ranking documents by cosine similarity.

Indexing is incremental — unchanged documents keep their embeddings across restarts, so re-initializing only re-embeds what changed.

## Quickstart

### Prerequisites

- **Node.js >= 22** and **pnpm**
- Access to a **Learn host** that exposes the AI content endpoints (configured via `LearnHost`, default `http://localhost:3000`):
  - `/learn/api/mcp/getSearchRecords`
  - `/learn/api/mcp/getApiReferenceEndpoints`
  - `/learn/api/mcp/getApiReferenceObjects`

### Build the index

The server serves queries from a local index, so it must be initialized once (and re-run whenever the source content changes):

```bash
# From an installed package
npx @kontent-ai/learn-mcp-server@latest shttp   # then POST http://localhost:3002/init

# Or from a local checkout
pnpm install
pnpm run sync                                   # builds the index into ./data
```

## Configuration

The `stdio` transport is the simplest way to connect a local MCP client. Add the server to your client's MCP configuration:

### Claude Desktop / Cursor

```json
{
  "mcpServers": {
    "kontent-ai-learn": {
      "command": "npx",
      "args": ["@kontent-ai/learn-mcp-server@latest", "stdio"],
      "env": {
        "LearnHost": "http://localhost:3000"
      }
    }
  }
}
```

### VS Code (`.vscode/mcp.json`)

```json
{
  "servers": {
    "kontent-ai-learn": {
      "type": "stdio",
      "command": "npx",
      "args": ["@kontent-ai/learn-mcp-server@latest", "stdio"],
      "env": {
        "LearnHost": "http://localhost:3000"
      }
    }
  }
}
```

### Claude Code (CLI)

```bash
claude mcp add kontent-ai-learn -- npx @kontent-ai/learn-mcp-server@latest stdio
```

### Streamable HTTP

Start the server in HTTP mode and point your client at the `/mcp` endpoint:

```bash
npx @kontent-ai/learn-mcp-server@latest shttp   # listens on http://localhost:3002/mcp
```

```json
{
  "mcpServers": {
    "kontent-ai-learn": {
      "url": "http://localhost:3002/mcp"
    }
  }
}
```

## Transport Options

| Transport           | Command                                         | Notes                                                           |
| ------------------- | ----------------------------------------------- | --------------------------------------------------------------- |
| **stdio**           | `npx @kontent-ai/learn-mcp-server@latest stdio` | For local MCP clients that spawn the server as a child process. |
| **Streamable HTTP** | `npx @kontent-ai/learn-mcp-server@latest shttp` | HTTP server exposing MCP over HTTP.                             |

The HTTP server exposes:

- `POST /mcp` — the MCP endpoint
- `GET /health` — health check (status, timestamp, version)
- `POST /init` — (re)build the search index; returns counts of indexed search records, API-reference endpoints, objects, and the diff (added/changed/removed/unchanged).

## Environment Variables

All variables are optional; copy `.env.template` to `.env` to override defaults.

| Variable                 | Default                                | Description                                                   |
| ------------------------ | -------------------------------------- | ------------------------------------------------------------- |
| `Port`                   | `3002`                                 | Port for the Streamable HTTP transport.                       |
| `DataPath`               | `data`                                 | Directory for the vector database and the cached JSON.        |
| `LearnHost`              | `http://localhost:3000`                | Base URL of the Learn host exposing the AI content endpoints. |

Endpoint URLs are composed as `LearnHost` + the corresponding path.

The embedding model cache is the committed root-level `transformers/` folder. It is resolved relative to the working directory the server is started from and is **not** configurable via `DataPath`.

## Security

The server is read-only and exposes only public Kontent.ai Learn documentation — it requires no API keys or credentials and performs no write operations. As with any MCP server, be mindful that document content is passed to the connected AI client.

## Development

```bash
pnpm install

# Run from source with hot reload
pnpm run dev:stdio      # stdio transport
pnpm run dev:shttp      # Streamable HTTP transport

# Build the index from the configured LearnHost
pnpm run sync

# Build & run the compiled server
pnpm run build
pnpm run start:stdio    # or start:shttp

# Quality
pnpm run lint           # biome + eslint
pnpm run biome:fix      # auto-format & fix

# Tests (builds a local test index from ./samples first)
pnpm test               # full suite
pnpm run test:unit
pnpm run test:integration
```

### Project structure

```
lib/
  content/       # fetching & caching Learn data (+ Zod models under content/models)
  indexing/      # chunking, embeddings, incremental indexer
  database/      # libSQL/Turso access, tables, vector retrieval
  search/        # query embedding + semantic search
  tools/         # MCP tool definitions (search-content, get-endpoint-details, get-object-details)
  transport/     # stdio & Streamable HTTP entry points
  cache/         # in-memory & file caches
  initialization/# index build/init orchestration
scripts/         # init / clean / search CLI helpers
samples/         # sample data used to build the test index
tests/           # unit & integration tests
transformers/    # committed transformers.js model cache (Xenova/all-MiniLM-L6-v2)
```

Tests use an isolated index under `data-test/` (gitignored), so running them never touches production data.

## License

[MIT](./LICENSE.md)
