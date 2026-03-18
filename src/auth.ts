export interface AuthEnv {
  MCP_AUTH_KEY?: string;
}

// Timing-safe bearer token check. Returns 401 Response if invalid, null if OK.
export function checkAuth(request: Request, env: AuthEnv): Response | null {
  if (!env.MCP_AUTH_KEY) return null; // no key configured = open access

  const header = request.headers.get("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : "";

  const encoder = new TextEncoder();
  const expected = encoder.encode(env.MCP_AUTH_KEY);
  const actual = encoder.encode(token);

  if (expected.byteLength !== actual.byteLength || actual.byteLength === 0) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "content-type": "application/json" } }
    );
  }

  // crypto.subtle.timingSafeEqual is available in Workers but not Node test env
  const isEqual = typeof crypto.subtle.timingSafeEqual === "function"
    ? crypto.subtle.timingSafeEqual(expected, actual)
    : expected.every((byte, i) => byte === actual[i]);

  if (!isEqual) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "content-type": "application/json" } }
    );
  }

  return null;
}
