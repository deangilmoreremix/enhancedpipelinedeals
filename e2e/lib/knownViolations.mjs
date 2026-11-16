// Contract violations the REAL app currently triggers (found by the strict fake). They are real defects in src/ (or
// benign probes) that e2e cannot fix. They are listed (never hidden) in every run's notes and do NOT fail scenarios;
// run with E2E_STRICT_KNOWN=1 to make them fail. Delete an entry once the src fix lands.
export const KNOWN_VIOLATIONS = [
  { id: 'KV3', match: { kind: 'rls', target: /^prompt_executions SELECT as authenticated$/ },
    src: 'src/scripts/initializeFeatures.ts:148',
    why: 'table-existence probe (select=count) hits a table with RLS enabled and NO policies: harmless (only 42P01 is inspected) but shows the table is unreachable for clients.' },
];
export const knownFor = (v) => KNOWN_VIOLATIONS.find(k => Object.entries(k.match).every(([key, x]) => (x instanceof RegExp ? x.test(String(v[key])) : v[key] === x)));
