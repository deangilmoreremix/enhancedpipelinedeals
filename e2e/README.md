# Browser E2E (Layer 1)

Headless Chromium via the preinstalled `playwright` library (no new dependency, no `@playwright/test`).

```bash
node e2e/run.mjs                 # all scenarios, demo + fake-Supabase modes
node e2e/run.mjs --only B,C      # subset (ids: A B B2 C D E F G)
node e2e/run.mjs --mode demo     # demo mode only (no Supabase env, app runs on bundled mock data)
node e2e/run.mjs --mode fake     # Supabase-connected path against the in-memory fake
```

* Servers: `vite` on :5199 (demo) and :5198 (fake: `VITE_SUPABASE_URL=http://fake.supabase.local`, `VITE_SUPABASE_ANON_KEY=fake`). Existing servers on those ports are reused; ports via `E2E_PORT_DEMO` / `E2E_PORT_FAKE`.
* Results (`results.json`, `results.md`) and screenshots: `$E2E_RESULTS` (default: the scratchpad `e2e-results/`). Never committed.
* `lib/fakeSupabase.mjs`: in-memory PostgREST (`/rest/v1/<table>` filters, order, range, `Prefer: return=representation`, upsert, single-object Accept, rpc stubs `search_deals`/`pipeline_aggregates`/`merge_deals`/`get_deal_activities`), `/auth/v1`, `/storage/v1`, realtime websocket swallowed. It also emulates the deal-audit trigger (stage change -> `deal_activities`) and the `workflow_run_history` view; the real SQL is verified separately in `e2e/sql`. Test hooks: `fake.deny(table, method)` (42501), `fake.fail(table, method, status)`, `fake.requests(table, method)`, `fake.table(name)`.
* The app exposes `window.__e2e` (deal/view/selection/permission/company/contact zustand stores) **only in the Vite dev server** (`import.meta.env.DEV`, see `src/bootstrap.tsx`); it is absent from production builds.
* Every scenario records console errors, page errors and failed requests; known-noise (handled AI-gateway 404s in the sandbox, demo-mode "Failed to fetch" on pages that query the placeholder Supabase URL) is filtered in `lib/browser.mjs` / scenario A.
* Drag and drop uses real `page.mouse` steps (needs a tall viewport because cards are very tall); `Alt+Arrow` is covered separately.
