/** Tiny chainable Supabase stand-in for unit tests: records every call per table and resolves configurable results. */
export interface MockCall { table: string; ops: Array<[string, ...unknown[]]> }
type Result = { data: unknown; error: { message: string } | null };
type Resolver = Result | ((call: MockCall) => Result);

export function createMockSupabase() {
  const calls: MockCall[] = [];
  const results = new Map<string, Resolver>();
  let session: { user: { id: string } } | null = { user: { id: 'user-1' } };

  const client = {
    from(table: string) {
      const call: MockCall = { table, ops: [] };
      calls.push(call);
      const b: any = {};
      for (const m of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'neq', 'in', 'is', 'gte', 'lte', 'order', 'limit', 'single', 'maybeSingle']) {
        b[m] = (...args: unknown[]) => { call.ops.push([m, ...args]); return b; };
      }
      b.then = (res: any, rej: any) => {
        const r = results.get(table);
        const out: Result = typeof r === 'function' ? r(call) : (r ?? { data: [], error: null });
        return Promise.resolve(out).then(res, rej);
      };
      return b;
    },
    auth: { getSession: async () => ({ data: { session } }) },
  };

  return {
    client,
    calls,
    /** Result (or resolver) returned by any query on `table`. */
    on(table: string, result: Resolver) { results.set(table, result); },
    setSession(s: typeof session) { session = s; },
    reset() { calls.length = 0; results.clear(); session = { user: { id: 'user-1' } }; },
    /** Calls on a table that include the given operation (e.g. 'insert'). */
    withOp(table: string, op: string) { return calls.filter((c) => c.table === table && c.ops.some((o) => o[0] === op)); },
    tables() { return [...new Set(calls.map((c) => c.table))]; },
  };
}

export const mockDb = createMockSupabase();
