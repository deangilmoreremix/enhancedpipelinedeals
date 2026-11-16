// Contract violations the REAL app currently triggers (found by the strict fake). They are real defects in src/ (or
// benign probes) that e2e cannot fix. They are listed (never hidden) in every run's notes and do NOT fail scenarios;
// run with E2E_STRICT_KNOWN=1 to make them fail. Delete an entry once the src fix lands.
export const KNOWN_VIOLATIONS = [
    src: 'src/services/storageBucketService.ts:16-42,84 (called from src/bootstrap.tsx:15); src/services/supabaseImageService.ts:528',
    why: 'client calls storage.createBucket for contact-avatars/deal-attachments/contact-documents, which do not exist in migrations; buckets can only be created with the service role, so this always fails with 403.' },
  { id: 'KV3', match: { kind: 'rls', target: /^prompt_executions SELECT as authenticated$/ },
    src: 'src/scripts/initializeFeatures.ts:148',
    why: 'table-existence probe (select=count) hits a table with RLS enabled and NO policies: harmless (only 42P01 is inspected) but shows the table is unreachable for clients.' },
];
export const knownFor = (v) => KNOWN_VIOLATIONS.find(k => Object.entries(k.match).every(([key, x]) => (x instanceof RegExp ? x.test(String(v[key])) : v[key] === x)));
