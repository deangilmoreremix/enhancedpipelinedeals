export const label = 'harness-smoke';
export default async function ({ t, loadFunction }) {
  const names = ['ai-gateway', 'ai-stream', 'workflow-runner'];
  for (const n of names) await t(`bundle ${n} loads`, async () => { const m = await loadFunction(n); if (!m.handler && !m.default) throw new Error('no export'); });
}
