# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A Cloudflare Worker that exposes the Capacities API (api.capacities.io) as a remote MCP server. It bridges Claude clients (web, iOS, Desktop, Code) to a user's Capacities knowledge base over HTTPS.

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Local dev server (wrangler dev)
npm run deploy       # Deploy to Cloudflare Workers
npx wrangler secret put CAPACITIES_API_KEY  # Set API key secret
```

No test framework is configured yet.

## Architecture

Two source files:

- **`src/index.ts`** — Worker entry point and MCP tool definitions. The `CapacitiesMCP` class extends `McpAgent` (from the `agents` package) and registers six MCP tools in its `init()` method. The default export is the CF Worker fetch handler that routes `/health`, `/sse` (legacy SSE transport), and `/mcp` (Streamable HTTP transport) to the appropriate handlers.

- **`src/capacities.ts`** — Thin HTTP client for the Capacities REST API. `createClient(apiKey)` returns `{get, post}` methods that hit `https://api.capacities.io`.

The Worker uses a **Durable Object** (`CapacitiesMCP`) for MCP session state, declared in `wrangler.toml`.

## Key Dependencies

- `agents` — Cloudflare's agent framework; provides `McpAgent` base class with `serveSSE()` and `serve()` static methods
- `@modelcontextprotocol/sdk` — MCP protocol SDK; provides `McpServer` and tool registration
- `zod` — Schema validation for tool inputs (bundled via MCP SDK)

## Environment / Secrets

- `CAPACITIES_API_KEY` — Required. Stored as a Cloudflare Worker secret, accessed via `this.env.CAPACITIES_API_KEY`.
- `CAPACITIES_MCP` — Durable Object namespace binding (configured in wrangler.toml).

## Capacities API Constraints

- Rate limit: 120 requests per 60s per endpoint
- Search returns IDs/titles only, not full object content
- API is beta and subject to change
