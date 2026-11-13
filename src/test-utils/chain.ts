/** Tiny chainable PostgREST builder double: every method returns the chain; awaiting yields `result`. */
export function chain(result: { data?: any; error?: any } = { data: [], error: null }) {
  const calls: Array<[string, unknown[]]> = [];
  const c: any = new Proxy({}, {
    get(_t, prop: string) {
      if (prop === 'then') return (res: any, rej: any) => Promise.resolve(result).then(res, rej);
      if (prop === 'calls') return calls;
      if (prop === 'single' || prop === 'maybeSingle') {
        return (...a: unknown[]) => {
          calls.push([prop, a]);
          const d = Array.isArray(result.data) ? result.data[0] ?? null : result.data;
          return Promise.resolve({ ...result, data: d });
        };
      }
      return (...a: unknown[]) => { calls.push([prop, a]); return c; };
    },
  });
  return c as any;
}
