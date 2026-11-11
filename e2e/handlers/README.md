# Netlify function handler harness (Layer 3)

Executes the real handlers in `netlify/functions/**` in plain Node (no Netlify CLI) against two local stubs and asserts behaviour
(not just "does not throw").

```
node e2e/handlers/run.mjs                 # everything, prints PASS/FAIL/SKIP table, exit 1 on any FAIL
node e2e/handlers/run.mjs sdr workflows   # only scenarios whose file name contains one of the words
node e2e/handlers/run.mjs --verbose       # also print every check + the handlers' own console output
```

Needs only what the repo already has (Node 22, `esbuild` via Vite, `openai`, `@openai/agents`, `@supabase/supabase-js`).
Ports: 54401 (OpenAI), 54402 (Supabase), 54403 (function router); override with `STUB_OPENAI_PORT`, `STUB_SUPABASE_PORT`,
`STUB_FUNCTIONS_PORT`. Bundles are written to `e2e/handlers/.build/` (git-ignored; override with `HANDLERS_OUT`).

## How it works

* `lib/build.mjs` bundles every function with esbuild like Netlify's `node_bundler = "esbuild"` (one bundle per function, relative
  imports from `src/` and `skills/` bundled, `node_modules` external). Any unresolved import / missing export fails the build.
* `lib/stubOpenAI.mjs` is a stand-in for the OpenAI REST API (`OPENAI_BASE_URL`): `/v1/responses` (JSON and typed SSE events, function
  calls, web_search_call + url_citation annotations), moderations (`FLAG_ME` flags), embeddings (1536-d), images, speech,
  transcriptions, realtime client secrets, conversations + items (Agents SDK sessions). It **rejects like the real API**: invalid
  strict `json_schema`, `temperature` with reasoning effort, effort `none` on `gpt-6-astra`/`gpt-6.1-sol`, non-flat function tools,
  `json_object` without the word JSON. Scenarios steer it with `openai.script(fn)` and read `openai.requests(path)`.
  Both the plain SDK and `@openai/agents` honour `OPENAI_BASE_URL` (verified), so no `setDefaultOpenAIClient` is needed.
* `lib/stubSupabase.mjs` is an in-memory PostgREST/GoTrue/Storage: filters (`eq neq gt gte lt lte like ilike in is not.*`, json path
  `a->>b`), order/limit/range, `Prefer` return/upsert (`on_conflict`), `single()` 406 semantics, `rpc/claim_workflow_events`
  (incl. the 10-minute stale-claim rule) and `rpc/match_contacts`, `/auth/v1/user` (`good-jwt`), storage buckets/objects/public URLs.
  Every table/column touched is recorded in `stub.audit`.
* `lib/schemaCheck.mjs` parses `supabase/migrations/*.sql` and `scenarios/zz-schema-contract.mjs` fails if any handler reads/writes a
  table or column no migration creates, or omits a `NOT NULL` column without default. Known gaps are listed in that file.
* `lib/schemaLint.mjs` is a linter for OpenAI strict structured-output schemas (all properties required, `additionalProperties:false`,
  nullable as `['string','null']`, unsupported keywords). It runs over every `TASKS` schema, over the Agents SDK output schema and
  inside the OpenAI stub.
* `lib/functionServer.mjs` routes `/.netlify/functions/<name>` to the bundles (needed by `autopilot-run`, which fetches `trigger-autopilot`).

## Scenarios (`scenarios/*.mjs`, run in file-name order)

| file | handlers |
| --- | --- |
| 01-ai-gateway | `ai-gateway` v1: auth, rate limit, every task, aliases, schemas, CRM context, tools, streaming, error mapping |
| 02-openai-helpers | `_openai` (effort/temperature rules, tool loop, citations, auth helpers), `_aiClients`, `test-sdr-agent` |
| 03-streaming | `ai-stream`, `composeEmail` (SSE framing, errors, abort) |
| 04-image-voice-embed | `ai-image`, `ai-voice`, `ai-embed` |
| 05-sdr | `_sdrAgents`, `sdr-run`, `sdr-agent` (guardrails, approval + resume, handoff), `skills-api` |
| 06-workflows | `workflow-runner`, `workflow-run-now`, `_workflowSteps`, `scheduled-sla` |
| 07-other | `calendar-api`, `email-api`, `pipelineAI`, `enhanced-import`, `enhanced-contact-import`, `run-agent`, autopilot trio, `selectPersona`, `memory-get`, `mood-preview` |
| 08-client-contract | every endpoint literal in `src/` vs. functions / `config.path` / redirects that exist |
| zz-schema-contract | tables/columns used by handlers vs. migrations (must run last) |

SKIP rows are findings that are not failures of the handlers themselves (dead code, missing endpoints, missing tables).

## What the stubs cannot prove

* Real model behaviour: output quality, whether the live API accepts our exact schemas/parameters for `gpt-6*` / `gpt-image-2.6*` /
  `gpt-transcribe` / `gpt-realtime-2.1` (the stub encodes the documented rules, not the live service), web_search quality, real
  Agents SDK tool-calling heuristics, Realtime/WebRTC, rate limits.
* Real Supabase: RLS, column types/constraints/triggers (only table/column names and plain NOT NULL are checked), PostgREST error
  shapes under real JWTs, embedded-resource selects (`contacts(...)`, `contacts:contact_id(...)` are ignored by the stub),
  Storage policies, realtime, `vector`/pgvector, `auth.getUser` against real GoTrue.
* Netlify runtime: v2 streaming through the CDN/edge, scheduled-function triggering, redirects, cold starts, 10s/26s timeouts,
  per-instance in-memory rate limiting across instances, env-var scoping.
* DNS rebinding (the `assertSafeUrl` guard resolves once, then fetches).
