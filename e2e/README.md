# Browser E2E (Layer 1)

Headless Chromium via the preinstalled `playwright` library (no new dependency, no `@playwright/test`).

```bash
node e2e/run.mjs                 # all scenarios, demo + fake-Supabase modes
node e2e/run.mjs --only B,C      # subset (ids: A B B2 C D E F G H I J K L M N O)
node e2e/run.mjs --mode demo     # demo mode only (no Supabase env, app runs on bundled mock data)
node e2e/run.mjs --mode fake     # Supabase-connected path against the in-memory fake
```

* Servers: `vite` on :5199 (demo) and :5198 (fake: `VITE_SUPABASE_URL=http://fake.supabase.local`, `VITE_SUPABASE_ANON_KEY=fake`). Existing servers on those ports are reused; ports via `E2E_PORT_DEMO` / `E2E_PORT_FAKE`.
* Results (`results.json`, `results.md`) and screenshots: `$E2E_RESULTS` (default: the scratchpad `e2e-results/`). Never committed.
* `lib/fakeSupabase.mjs` (STRICT, see below): in-memory PostgREST (`/rest/v1/<table>` filters, order, range, `Prefer: return=representation`, upsert, single-object Accept, rpc stubs `search_deals`/`pipeline_aggregates`/`merge_deals`/`get_deal_activities`), `/auth/v1`, `/storage/v1`, realtime websocket swallowed. It also emulates the deal-audit trigger (stage change -> `deal_activities`) and the `workflow_run_history` view; the real SQL is verified separately in `e2e/sql`. Test hooks: `fake.deny(table, method)` (42501), `fake.fail(table, method, status)`, `fake.requests(table, method)`, `fake.table(name)`.
* The app exposes `window.__e2e` (deal/view/selection/permission/company/contact zustand stores) **only in the Vite dev server** (`import.meta.env.DEV`, see `src/bootstrap.tsx`); it is absent from production builds.
* Every scenario records console errors, page errors and failed requests; known-noise (handled AI-gateway 404s in the sandbox, demo-mode "Failed to fetch" on pages that query the placeholder Supabase URL) is filtered in `lib/browser.mjs` / scenario A.
* Drag and drop uses real `page.mouse` steps (needs a tall viewport because cards are very tall); `Alt+Arrow` is covered separately.

## Strict fake Supabase (contract gate)

The fake loads `lib/schema.json` (generated from the real migrations by `e2e/sql/run.sh`, i.e. `emit-schema.sql`; regenerate it whenever a migration changes) and refuses to be more lenient than the real database. Verdict helpers live in `lib/strict.mjs`.

| Request | Fake answer (real PostgREST/Storage shape) | Logged as |
|---|---|---|
| unknown table / view | 404 `PGRST205` | `schema` |
| unknown column in select / filter / order / `or()` / `on_conflict` | 400 `42703` | `schema` |
| unknown column in an insert/update body, or a generated column written | 400 `PGRST204` / `428C9` | `schema` |
| NOT NULL column without default missing on insert | 400 `23502` | `constraint` |
| unknown RPC, wrong/missing arg names | 404 `PGRST202` | `schema` |
| RPC without EXECUTE for the role (e.g. `initialize_all_feature_flags` is service_role only) | 403/401 `42501` | `rls` |
| INSERT (or upsert / `return=representation`) with no policy for the role | 403 `42501` | `rls` |
| SELECT / UPDATE / DELETE with no policy for the role | 200 with zero rows (so `assertRowsAffected` paths run) | `rls` (`RLS-ZERO-ROWS`) |
| write to a view | 400 `55000` | `schema` |
| `object/public/...` on a private bucket (`deal-files`) | 400 `Bucket not found` | `storage` |
| unknown bucket, createBucket/updateBucket (service role only), storage op without a storage policy for the role, oversize upload, signed URL for a missing object | Storage error shapes | `storage` |

* Role comes from the request: the anon key alone -> `anon`; a user JWT -> `authenticated`. In fake mode `newPage` signs in a default user (`DEFAULT_USER`) so the app behaves like a real signed-in session; pass `anon: true` to stay signed out. RLS is modelled in *open mode*: a policy for (role, op) means allowed (workspace-mode row filtering is covered by `fake.deny` in scenario G and by `e2e/sql`).
* Every violation is recorded in `fake.violations`. After each scenario the runner **fails it** if any violation is not declared with `fake.expectViolation(match)`; a declared expectation that never happened also fails (stale test). `match` is a kind string, a message RegExp, or `{kind, code, method, target}` (values may be RegExps).
* `fake.deny(table, method)` / `fake.fail(...)` remain explicit test hooks (denials answer 42501 but are not violations).
* RPC handlers use the real signatures (`merge_deals(keep, merge_ids, p_fields)`, `pipeline_aggregates(p_stage_keys, p_op, p_field)`, ...). An RPC that exists in the schema but has no handler answers 501 and is logged as `fake-gap`.
* `lib/knownViolations.mjs` lists real app defects found by the strict fake that live in `src/` (they are printed on every scenario that hits them, do not fail the run, and can be made fatal with `E2E_STRICT_KNOWN=1`). Remove an entry when its src fix lands.

### Contract-path scenarios (fake mode)
I workflow create/edit/delete persists (incl. zero-row delete error) · J signed-in/anon feature-flag reads · K RLS-denied deal create shows an error and leaves no phantom deal · L merge duplicates uses one `merge_deals` RPC and moves notes · M favorites keep `deals.is_favorite` and the `favorites` row in sync · N analytics/views/timeline only use existing columns/RPC args · O self-check of the strict fake with `expectViolation`.
