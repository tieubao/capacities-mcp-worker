const API_BASE = "https://api.capacities.io";

export class CapacitiesApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly endpoint: string,
    public readonly body: string
  ) {
    super(CapacitiesApiError.friendlyMessage(status, endpoint, body));
    this.name = "CapacitiesApiError";
  }

  private static friendlyMessage(status: number, endpoint: string, body: string): string {
    switch (true) {
      case status === 401 || status === 403:
        return "Capacities API authentication failed. Check that your API key is valid in Capacities Settings > API.";
      case status === 429:
        return `Rate limit exceeded for ${endpoint}. The Capacities API limits requests per 60-second window. Wait and retry.`;
      case status >= 500:
        return `Capacities API is temporarily unavailable (${status}). Try again shortly.`;
      default:
        return `Capacities API request failed (${status}): ${body.slice(0, 200)}`;
    }
  }
}

export interface CapacitiesClient {
  get(path: string): Promise<unknown>;
  post(path: string, body: unknown): Promise<unknown>;
}

export function createClient(apiKey: string): CapacitiesClient {
  async function request(method: string, path: string, body?: unknown): Promise<unknown> {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new CapacitiesApiError(res.status, path, text);
    }

    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return res.json();
    }
    return res.text();
  }

  return {
    get: (path) => request("GET", path),
    post: (path, body) => request("POST", path, body),
  };
}
