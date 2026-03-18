# Capacities MCP Worker

A Cloudflare Worker that wraps the Capacities API as a remote MCP server.
Connect Claude on any device -- iPhone, web, desktop, Claude Code -- to your
Capacities knowledge base.

## Why this exists

The community `capacities-mcp` package runs locally (stdio transport).
That works for Claude Code and Claude Desktop, but not for claude.ai (web)
or Claude on iOS/Android, which require a remote MCP server over HTTPS.

This Worker is that remote bridge.

## Architecture

```
Claude (web / iOS / Desktop / Code)
    |
    | HTTPS (Streamable HTTP or SSE)
    v
CF Worker (this project)
    |
    | HTTPS + Bearer token
    v
Capacities API (api.capacities.io)
```

## Setup

### 1. Prerequisites

- Capacities Pro subscription ($8/mo) with API key
- Cloudflare account (free tier is enough)
- Node.js 18+ and npm

### 2. Clone and install

```bash
cd capacities-mcp-worker
npm install
```

### 3. Set your Capacities API key as a secret

```bash
npx wrangler secret put CAPACITIES_API_KEY
# paste your key from Capacities Settings > API
```

### 4. Deploy

```bash
npm run deploy
```

Wrangler prints your URL, e.g.:
`https://capacities-mcp.<you>.workers.dev`

### 5. Test

```bash
curl https://capacities-mcp.<you>.workers.dev/health
# {"status":"ok","service":"capacities-mcp"}
```

### 6. Connect Claude (web + iOS)

1. Go to https://claude.ai
2. Settings > Connectors > Add Custom Connector
3. Name: "Capacities"
4. URL: `https://capacities-mcp.<you>.workers.dev/mcp`
5. Save

The connector syncs to your iPhone Claude app automatically.

### 7. Connect Claude Desktop (optional, alternative to local capacities-mcp)

Add to your Claude Desktop config:
```json
{
  "mcpServers": {
    "capacities": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://capacities-mcp.<you>.workers.dev/sse"]
    }
  }
}
```

### 8. Connect Claude Code (optional)

```bash
claude mcp add capacities \
  --transport sse \
  --url https://capacities-mcp.<you>.workers.dev/sse
```

Or keep using the local `capacities-mcp` package for Claude Code (faster,
no network hop).

## MCP Tools

| Tool | Description |
|------|-------------|
| `capacities_list_spaces` | List all your spaces |
| `capacities_get_space_info` | Get structures, collections, properties for a space |
| `capacities_search` | Search content by keyword (title or full-text) |
| `capacities_save_weblink` | Save a URL with tags, description, markdown notes |
| `capacities_save_to_daily_note` | Append markdown to today's daily note |
| `capacities_create_object` | Create any object type (page, custom types, etc.) |

## Example prompts

- "List my Capacities spaces"
- "Save this to my daily note: learned about Cloudflare R2 today"
- "Create a page called 'Ito's Lemma' with tags quant-finance and math"
- "Search for notes about stochastic calculus"
- "Save this URL to my research space: https://example.com/paper"

## Security

- The Capacities API key is stored as a Cloudflare Worker secret (encrypted)
- The Worker does not add its own auth layer (the MCP endpoint is public)
- If you want to restrict access, add Cloudflare Access or a bearer
  token check in the fetch handler (see comments in index.ts)

To add a simple bearer token gate, set a secret:
```bash
npx wrangler secret put MCP_AUTH_KEY
```
Then uncomment the auth check in `src/index.ts`.

## Limitations

- Capacities API cannot read full object content (search returns IDs/titles only)
- Rate limited to 120 requests per 60s per endpoint
- API is beta and subject to change

## Cost

- Capacities Pro: ~$8/mo
- Cloudflare Worker: $0 (free tier: 100k requests/day)
- Durable Objects: $0 for low usage
