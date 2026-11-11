import path from 'node:path';
import { assert } from '../lib/util.mjs';
import { loadSchema, checkAudit } from '../lib/schemaCheck.mjs';

export const label = 'handlers vs migrations (table/column contract)';

/** Runs LAST (file name sorts after the others): every table/column any handler touched must exist in the migrations. */
export default async function ({ t, supa, REPO }) {
  const tables = loadSchema(path.join(REPO, 'supabase/migrations'));
  await t(`parsed ${tables.size} tables from migrations; audit has ${supa.audit.length} requests`, async () => { assert.ok(tables.size > 20); assert.ok(supa.audit.length > 50); });
  // Gaps owned by the SQL migrations (not fixable from netlify/functions). Remove an entry once a migration creates the table.
  const KNOWN_GAPS = [];
  const all = checkAudit(supa.audit, tables);
  const problems = [];
  for (const p of all) {
    const gap = KNOWN_GAPS.find((g) => g.match.test(p));
    if (gap) t.skip(`known migration gap: ${p}`, gap.reason); else problems.push(p);
  }
  const seen = [...new Set(supa.audit.map((a) => a.table))].sort();
  await t(`all ${seen.length} touched tables/columns exist in supabase/migrations/*.sql`, async () => assert.deepEqual(problems, []));
  t.note('tables touched', seen.join(', '));
}
