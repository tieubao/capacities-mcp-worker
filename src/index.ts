import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createClient } from "./capacities";

interface Env {
  MCP_OBJECT: DurableObjectNamespace;
  CAPACITIES_API_KEY: string;
}

export class CapacitiesMCP extends McpAgent<Env, {}, {}> {
  server = new McpServer({
    name: "capacities-mcp",
    version: "0.1.0",
  });

  private get api() {
    return createClient(this.env.CAPACITIES_API_KEY);
  }

  async init() {

    // ---- list_spaces ----
    this.server.tool(
      "capacities_list_spaces",
      "List all personal Capacities spaces. Returns space IDs and names.",
      {},
      async () => {
        const data = await this.api.get("/spaces");
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      }
    );

    // ---- get_space_info ----
    this.server.tool(
      "capacities_get_space_info",
      "Get detailed info about a space including structures (object types), collections, and property definitions. Needed to know which structureIds to use when creating objects.",
      {
        spaceId: z.string().describe("Space ID (find in Capacities Settings > Space settings)"),
      },
      async ({ spaceId }) => {
        const data = await this.api.get(`/space-info/${spaceId}`);
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      }
    );

    // ---- search ----
    this.server.tool(
      "capacities_search",
      "Search content across Capacities spaces. Returns matching object titles and IDs (not full content, API limitation).",
      {
        searchTerm: z.string().describe("Text to search for"),
        spaceIds: z.array(z.string()).optional().describe("Limit search to specific space IDs"),
        mode: z.enum(["fullText", "title"]).optional().default("fullText").describe("Search mode"),
      },
      async ({ searchTerm, spaceIds, mode }) => {
        const body: Record<string, unknown> = { searchTerm, mode: mode || "fullText" };
        if (spaceIds?.length) body.spaceIds = spaceIds;
        const data = await this.api.post("/lookup", body);
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      }
    );

    // ---- save_weblink ----
    this.server.tool(
      "capacities_save_weblink",
      "Save a URL as a weblink object in Capacities. Supports tags, custom title, description, and markdown notes.",
      {
        spaceId: z.string().describe("Target space ID"),
        url: z.string().url().describe("URL to save"),
        title: z.string().optional().describe("Custom title (otherwise auto-fetched)"),
        description: z.string().optional().describe("Description of the weblink"),
        tags: z.array(z.string()).optional().describe("Tags (must match existing tags exactly, or new ones are created)"),
        mdText: z.string().optional().describe("Markdown text to add to the notes section"),
      },
      async ({ spaceId, url, title, description, tags, mdText }) => {
        const body: Record<string, unknown> = { spaceId, url };
        if (title) body.titleOverwrite = title;
        if (description) body.descriptionOverwrite = description;
        if (tags?.length) body.tags = tags;
        if (mdText) body.mdText = mdText;
        const data = await this.api.post("/save-weblink", body);
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      }
    );

    // ---- save_to_daily_note ----
    this.server.tool(
      "capacities_save_to_daily_note",
      "Append markdown content to today's daily note in a space. Great for quick captures, learning logs, and meeting notes.",
      {
        spaceId: z.string().describe("Target space ID"),
        mdText: z.string().describe("Markdown content to append"),
        origin: z.string().optional().describe("Label for the origin, e.g. 'claude-mcp'"),
        noTimestamp: z.boolean().optional().default(false).describe("Skip the automatic timestamp"),
      },
      async ({ spaceId, mdText, origin, noTimestamp }) => {
        const body: Record<string, unknown> = { spaceId, mdText };
        if (origin) body.origin = origin;
        if (noTimestamp) body.noTimestamp = true;
        const data = await this.api.post("/save-to-daily-note", body);
        return { content: [{ type: "text" as const, text: data ? JSON.stringify(data, null, 2) : "Saved to daily note." }] };
      }
    );

    // ---- create_object ----
    this.server.tool(
      "capacities_create_object",
      "Create a new object (page, note, or any custom type) in Capacities. Use get_space_info first to find available structureIds for the space.",
      {
        spaceId: z.string().describe("Target space ID"),
        structureId: z.string().describe("Structure ID for the object type (get from space-info). Common: page, weblink, or custom type IDs."),
        title: z.string().describe("Title of the new object"),
        mdText: z.string().optional().describe("Markdown content for the object body"),
        tags: z.array(z.string()).optional().describe("Tags to apply"),
      },
      async ({ spaceId, structureId, title, mdText, tags }) => {
        const body: Record<string, unknown> = { spaceId, structureId, title };
        if (mdText) body.mdText = mdText;
        if (tags?.length) body.tags = tags;
        const data = await this.api.post("/create-object", body);
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      }
    );
  }
}

// ---- Worker entry point ----

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === "/" || url.pathname === "/health") {
      return new Response(
        JSON.stringify({ status: "ok", service: "capacities-mcp" }),
        { headers: { "content-type": "application/json" } }
      );
    }

    // SSE transport (legacy clients like Claude Desktop via mcp-remote)
    if (url.pathname.startsWith("/sse")) {
      return CapacitiesMCP.serveSSE("/sse").fetch(request, env, ctx);
    }

    // Streamable HTTP transport (claude.ai, Claude iOS)
    if (url.pathname.startsWith("/mcp")) {
      return CapacitiesMCP.serve("/mcp").fetch(request, env, ctx);
    }

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
