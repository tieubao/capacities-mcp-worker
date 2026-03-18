import { describe, it, expect } from "vitest";
import { checkAuth, type AuthEnv } from "./auth";

function makeEnv(authKey?: string): AuthEnv {
  return { MCP_AUTH_KEY: authKey };
}

function makeRequest(token?: string): Request {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return new Request("https://example.com/mcp", { headers });
}

describe("checkAuth", () => {
  it("returns null when MCP_AUTH_KEY is not set (open access)", () => {
    const result = checkAuth(makeRequest(), makeEnv());
    expect(result).toBeNull();
  });

  it("returns null when correct token is provided", () => {
    const result = checkAuth(makeRequest("my-secret"), makeEnv("my-secret"));
    expect(result).toBeNull();
  });

  it("returns 401 when no Authorization header is sent", () => {
    const result = checkAuth(makeRequest(), makeEnv("my-secret"));
    expect(result).toBeInstanceOf(Response);
    expect(result!.status).toBe(401);
  });

  it("returns 401 when wrong token is provided", () => {
    const result = checkAuth(makeRequest("wrong-token"), makeEnv("my-secret"));
    expect(result).toBeInstanceOf(Response);
    expect(result!.status).toBe(401);
  });

  it("returns 401 when Authorization header has no Bearer prefix", () => {
    const req = new Request("https://example.com/mcp", {
      headers: { Authorization: "my-secret" },
    });
    const result = checkAuth(req, makeEnv("my-secret"));
    expect(result).toBeInstanceOf(Response);
    expect(result!.status).toBe(401);
  });
});
