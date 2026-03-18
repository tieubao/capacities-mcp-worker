import { describe, it, expect, vi, beforeEach } from "vitest";
import { createClient, CapacitiesApiError } from "./capacities";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function textResponse(text: string, status = 200) {
  return new Response(text, {
    status,
    headers: { "content-type": "text/plain" },
  });
}

describe("createClient", () => {
  const client = createClient("test-api-key");

  it("GET sends correct headers and returns JSON", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ spaces: [] }));

    const result = await client.get("/spaces");

    expect(result).toEqual({ spaces: [] });
    expect(mockFetch).toHaveBeenCalledWith("https://api.capacities.io/spaces", {
      method: "GET",
      headers: {
        Authorization: "Bearer test-api-key",
        "Content-Type": "application/json",
      },
      body: undefined,
    });
  });

  it("POST sends body and returns JSON", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: "123" }));

    const result = await client.post("/lookup", { searchTerm: "test" });

    expect(result).toEqual({ id: "123" });
    expect(mockFetch).toHaveBeenCalledWith("https://api.capacities.io/lookup", {
      method: "POST",
      headers: {
        Authorization: "Bearer test-api-key",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ searchTerm: "test" }),
    });
  });

  it("returns text for non-JSON responses", async () => {
    mockFetch.mockResolvedValueOnce(textResponse("OK"));

    const result = await client.get("/some-endpoint");
    expect(result).toBe("OK");
  });

  it("throws CapacitiesApiError with friendly message on 401", async () => {
    mockFetch.mockResolvedValueOnce(textResponse("Unauthorized", 401));

    try {
      await client.get("/spaces");
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(CapacitiesApiError);
      expect((e as CapacitiesApiError).status).toBe(401);
      expect((e as Error).message).toContain("authentication failed");
    }
  });

  it("throws CapacitiesApiError with rate-limit message on 429", async () => {
    mockFetch.mockResolvedValueOnce(textResponse("Too Many Requests", 429));

    try {
      await client.get("/spaces");
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(CapacitiesApiError);
      expect((e as CapacitiesApiError).status).toBe(429);
      expect((e as Error).message).toContain("Rate limit exceeded");
    }
  });

  it("throws CapacitiesApiError with server-error message on 500", async () => {
    mockFetch.mockResolvedValueOnce(textResponse("Internal Server Error", 500));

    try {
      await client.get("/spaces");
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(CapacitiesApiError);
      expect((e as CapacitiesApiError).status).toBe(500);
      expect((e as Error).message).toContain("temporarily unavailable");
    }
  });

  it("truncates long error bodies to 200 chars", async () => {
    const longBody = "x".repeat(500);
    mockFetch.mockResolvedValueOnce(textResponse(longBody, 400));

    try {
      await client.get("/spaces");
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(CapacitiesApiError);
      expect((e as Error).message.length).toBeLessThan(300);
    }
  });
});
