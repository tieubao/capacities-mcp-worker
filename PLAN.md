# Capacities MCP Worker — Improvement Plan

## Context
The worker is deployed and functional but has no error handling in tools, no auth on the MCP endpoint, no tests, and no CI. The Capacities API only has 5 documented endpoints (all already implemented), so there are no new tools to add. Focus is on hardening what exists.

## Phase 1: Error Handling
**Why:** Raw API errors (status codes, JSON blobs) leak to MCP clients. Users need actionable messages.

**`src/capacities.ts`**
- Add `CapacitiesApiError` class with `status`, `endpoint`, `body` fields
- Map status codes to friendly messages:
  - 401/403 → "API auth failed, check your key"
  - 429 → "Rate limited, wait and retry"
  - 500+ → "API temporarily unavailable"
  - Other → truncated body (200 chars max)
- No changes needed in tool handlers — MCP SDK already catches thrown errors and wraps them with `isError: true`

**`src/index.ts`**
- Add early guard in the `api` getter: throw if `CAPACITIES_API_KEY` is empty

## Phase 2: MCP Endpoint Auth
**Why:** The `/mcp` and `/sse` endpoints are currently open to anyone.

**`src/index.ts`**
- Add optional `MCP_AUTH_KEY` to `Env` interface
- Add `checkAuth(request, env)` that returns 401 Response or null
- If `MCP_AUTH_KEY` is set → require `Authorization: Bearer <token>`. If not set → open access (easy dev)
- Use `crypto.subtle.timingSafeEqual` for comparison
- `/health` stays unauthenticated

## Phase 3: Tests (Vitest)
**Why:** No tests exist. Need baseline coverage before adding CI.

**New files:**
- `vitest.config.ts` — minimal config
- `src/capacities.test.ts` — mock fetch, test success/401/429/500 responses
- `src/auth.test.ts` — test checkAuth with/without MCP_AUTH_KEY

**`package.json`** — add `vitest` dev dep, `"test"` and `"typecheck"` scripts

Plain vitest (not `@cloudflare/vitest-pool-workers`) — the code under test only uses standard `fetch`.

## Phase 4: CI (GitHub Actions)
**Why:** Automate type-check + tests on PRs, deploy on merge to master.

**New file: `.github/workflows/ci.yml`**
- `check` job: runs on all PRs and pushes → `npm ci`, `tsc --noEmit`, `vitest run`
- `deploy` job: only on push to master, after check passes → `wrangler deploy`
- Requires `CLOUDFLARE_API_TOKEN` GitHub secret (user must add)

## Files Changed

| File | Action | Phase |
|------|--------|-------|
| `src/capacities.ts` | Modify | 1 |
| `src/index.ts` | Modify | 1 + 2 |
| `vitest.config.ts` | Create | 3 |
| `src/capacities.test.ts` | Create | 3 |
| `src/auth.test.ts` | Create | 3 |
| `package.json` | Modify | 3 |
| `.github/workflows/ci.yml` | Create | 4 |

## Verification
- **Phase 1:** `npm run dev` → call tool with bad API key → confirm clean error message
- **Phase 2:** Deploy → set `MCP_AUTH_KEY` secret → confirm 401 without token, success with token
- **Phase 3:** `npm test` and `npm run typecheck` pass
- **Phase 4:** Open PR → check job runs. Merge → deploy job runs.
