// In-memory fake of Supabase (PostgREST + auth + storage) installed with Playwright route().
// It lets the REAL persistence code paths run (dealMapper, optimistic update/rollback, services) with no server.
// Emulated DB behaviour (documented because it normally lives in SQL, verified separately in e2e/sql):
//  - deals.updated_at/id/created_at defaults, stage change -> deal_activities row (deal_audit trigger)
//  - zero-row PATCH/DELETE return [] (PostgREST behaviour), RLS denial via fake.deny(...)
import crypto from 'node:crypto';

export const FAKE_URL = 'http://fake.supabase.local';
const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

function parseVal(v) { return v; }
function cmp(a, b) { if (a == null && b == null) return 0; if (a == null) return -1; if (b == null) return 1; return a < b ? -1 : a > b ? 1 : 0; }
function coerce(rowVal, filterVal) {
  if (typeof rowVal === 'number') return Number(filterVal);
  if (typeof rowVal === 'boolean') return filterVal === 'true';
  return filterVal;
}
function matchOp(row, col, op, val, negate = false) {
  const rv = col.includes('->') ? col.split('->').reduce((o, k) => (o == null ? o : o[k.replace(/>/g, '')]), row) : row[col];
  let r;
  switch (op) {
    case 'eq': r = rv != null && String(rv) === String(val); break;
    case 'neq': r = rv == null || String(rv) !== String(val); break;
    case 'gt': r = cmp(rv, coerce(rv, val)) > 0; break;
    case 'gte': r = cmp(rv, coerce(rv, val)) >= 0; break;
    case 'lt': r = rv != null && cmp(rv, coerce(rv, val)) < 0; break;
    case 'lte': r = rv != null && cmp(rv, coerce(rv, val)) <= 0; break;
    case 'is': r = val === 'null' ? rv == null : val === 'true' ? rv === true : val === 'false' ? rv === false : rv === val; break;
    case 'in': { const list = val.replace(/^\(|\)$/g, '').split(',').map(s => s.replace(/^"|"$/g, '')); r = rv != null && list.includes(String(rv)); break; }
    case 'like': case 'ilike': { const re = new RegExp('^' + String(val).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/\*/g, '.*') + '$', op === 'ilike' ? 'i' : ''); r = rv != null && re.test(String(rv)); break; }
    case 'cs': r = Array.isArray(rv) && val.replace(/^[{[]|[}\]]$/g, '').split(',').every(x => rv.includes(x)); break;
    case 'ov': r = Array.isArray(rv) && val.replace(/^[{[]|[}\]]$/g, '').split(',').some(x => rv.includes(x)); break;
    case 'fts': case 'plfts': case 'phfts': case 'wfts': r = rv != null && String(rv).toLowerCase().includes(String(val).toLowerCase()); break;
    default: r = true;
  }
  return negate ? !r : r;
}
function splitTop(s) { const out = []; let d = 0, cur = ''; for (const ch of s) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && d === 0) { out.push(cur); cur = ''; } else cur += ch; } if (cur) out.push(cur); return out; }
function evalOrExpr(row, expr) { // "a.eq.1,b.ilike.%x%" or and(...)
  return splitTop(expr).some(part => {
    const m = part.match(/^and\((.*)\)$/);
    if (m) return splitTop(m[1]).every(p => evalCond(row, p));
    return evalCond(row, part);
  });
}
function evalCond(row, part) {
  const m = part.match(/^([^.]+(?:->>?[^.]+)?)\.(not\.)?([a-z]+)\.(.*)$/);
  if (!m) return true;
  return matchOp(row, m[1], m[3], m[4], !!m[2]);
}

export class FakeSupabase {
  constructor(seed = {}) {
    this.tables = {};
    this.log = []; // {method, table, query, body}
    this.rpcHandlers = {};
    this.denied = []; // {table, method} -> respond 42501
    this.failNext = []; // {table, method, status, body}
    this.storage = new Map();
    this.session = null;
    for (const [t, rows] of Object.entries(seed)) this.tables[t] = rows.map(r => ({ ...r }));
    this.installDefaultRpc();
  }
  table(t) { return (this.tables[t] ||= []); }
  deny(table, method = '*') { this.denied.push({ table, method }); }
  allow() { this.denied = []; }
  fail(table, method, status = 500, body = { message: 'forced failure', code: 'XX000' }, times = 1) { this.failNext.push({ table, method, status, body, times }); }
  requests(table, method) { return this.log.filter(l => (!table || l.table === table) && (!method || l.method === method)); }

  installDefaultRpc() {
    this.rpcHandlers.search_deals = ({ q, lim }) => {
      const ql = String(q || '').toLowerCase();
      return this.table('deals').filter(d => !d.deleted_at && [d.title, d.company, d.contact, d.notes].some(f => String(f || '').toLowerCase().includes(ql))).slice(0, lim || 20);
    };
    this.rpcHandlers.pipeline_aggregates = (args) => {
      const rows = this.table('deals').filter(d => !d.deleted_at);
      const by = {};
      for (const d of rows) { const k = d.stage; by[k] ||= { stage: k, count: 0, total: 0 }; by[k].count++; by[k].total += Number(d.value || 0); }
      return Object.values(by).map(g => ({ stage: g.stage, count: g.count, sum: g.total, total: g.total, avg: g.total / g.count, min: 0, max: g.total }));
    };
    this.rpcHandlers.merge_deals = ({ p_primary, p_duplicate, p_secondary, primary_id, duplicate_id, secondary_id, survivor_id, loser_id } = {}) => {
      const keep = p_primary || primary_id || survivor_id; const gone = p_duplicate || p_secondary || duplicate_id || secondary_id || loser_id;
      const loser = this.table('deals').find(d => d.id === gone);
      if (loser) loser.deleted_at = now();
      for (const t of ['notes', 'tasks', 'deal_files', 'deal_activities']) this.table(t).forEach(r => { if (r.deal_id === gone) r.deal_id = keep; });
      return this.table('deals').find(d => d.id === keep) || null;
    };
    this.rpcHandlers.get_deal_activities = ({ p_deal_id, deal_id }) => this.table('deal_activities').filter(a => a.deal_id === (p_deal_id || deal_id));
    this.rpcHandlers.initialize_all_feature_flags = () => null;
    this.rpcHandlers.set_rls_mode = () => null;
  }

  async install(context) {
    await context.route(/^https?:\/\/(?!localhost|127\.0\.0\.1|fake\.supabase\.local)/, r => r.abort());
    await context.route('**/auth/v1/**', r => this.auth(r));
    await context.route('**/rest/v1/**', r => this.rest(r));
    await context.route('**/storage/v1/**', r => this.storageRoute(r));
    await context.route('**/functions/v1/**', r => r.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"no function"}' }));
    await context.routeWebSocket(/fake\.supabase\.local\/realtime/, ws => { ws.onMessage(() => {}); }).catch(() => {});
  }

  cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': 'content-range, content-type' };
  json(route, status, body, extra = {}) { return route.fulfill({ status, headers: { ...this.cors, ...extra }, contentType: 'application/json', body: JSON.stringify(body) }); }

  async auth(route) {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: this.cors });
    const u = new URL(req.url());
    if (u.pathname.endsWith('/user')) return this.session ? this.json(route, 200, this.session.user) : this.json(route, 401, { message: 'not logged in', code: 401 });
    if (u.pathname.endsWith('/token') || u.pathname.endsWith('/signup')) return this.json(route, 200, this.session || { access_token: 'x', token_type: 'bearer', expires_in: 3600, refresh_token: 'x', user: { id: 'anon', aud: 'authenticated', email: 'demo@example.com' } });
    return this.json(route, 200, {});
  }

  async storageRoute(route) {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: this.cors });
    const u = new URL(req.url());
    const p = u.pathname.replace('/storage/v1/', '');
    this.log.push({ method: req.method(), table: 'storage', query: p });
    if (p.startsWith('object/sign/')) return this.json(route, 200, { signedURL: `/object/sign/${p.slice(12)}?token=fake` });
    if (p.startsWith('object/list/')) return this.json(route, 200, [...this.storage.keys()].map(k => ({ name: k.split('/').pop() })));
    if (p === 'bucket' || p.startsWith('bucket')) return this.json(route, 200, req.method() === 'GET' ? [{ id: 'deal-files', name: 'deal-files' }] : { name: 'deal-files' });
    if (req.method() === 'POST' || req.method() === 'PUT') { this.storage.set(p.replace(/^object\//, ''), req.postDataBuffer()); return this.json(route, 200, { Key: p.replace(/^object\//, ''), Id: uuid() }); }
    if (req.method() === 'DELETE') { this.json(route, 200, []); return; }
    if (req.method() === 'GET') { const k = p.replace(/^object\/(public|authenticated|sign)\//, ''); const b = this.storage.get(k); return route.fulfill({ status: b ? 200 : 404, headers: this.cors, body: b || '' }); }
    return this.json(route, 200, {});
  }

  async rest(route) {
    const req = route.request();
    const method = req.method();
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: this.cors });
    const u = new URL(req.url());
    const path = u.pathname.replace('/rest/v1/', '').replace(/^\//, '');
    const headers = req.headers();
    const prefer = headers['prefer'] || '';
    const wantSingle = (headers['accept'] || '').includes('vnd.pgrst.object');
    let body = null; try { body = req.postDataJSON(); } catch {}
    const q = u.searchParams;

    if (path.startsWith('rpc/')) {
      const fn = path.slice(4);
      this.log.push({ method: 'RPC', table: fn, body });
      const h = this.rpcHandlers[fn];
      if (!h) return this.json(route, 404, { code: 'PGRST202', message: `Could not find the function public.${fn}`, details: null, hint: null });
      const forced = this.takeFail(fn, 'RPC'); if (forced) return this.json(route, forced.status, forced.body);
      try { return this.json(route, 200, await h(body || Object.fromEntries(q))); } catch (e) { return this.json(route, 400, { code: 'P0001', message: String(e.message || e) }); }
    }

    const table = path;
    this.log.push({ method, table, query: u.search, body });
    const forced = this.takeFail(table, method); if (forced) return this.json(route, forced.status, forced.body);
    if (this.denied.some(d => d.table === table && (d.method === '*' || d.method === method))) {
      if (method === 'GET') return this.json(route, 200, []);
      return this.json(route, 403, { code: '42501', message: `new row violates row-level security policy for table "${table}"`, details: null, hint: null });
    }

    // views emulated from base tables (defined in supabase/migrations)
    const rows = table === 'workflow_run_history' ? this.runHistoryView() : this.table(table);
    const filters = [...q.entries()].filter(([k]) => !['select', 'order', 'limit', 'offset', 'columns', 'on_conflict'].includes(k));
    const applyFilters = (list) => list.filter(r => filters.every(([k, v]) => {
      if (k === 'or') return evalOrExpr(r, v.replace(/^\(|\)$/g, ''));
      if (k === 'and') return splitTop(v.replace(/^\(|\)$/g, '')).every(p => evalCond(r, p));
      const m = v.match(/^(not\.)?([a-z]+)\.(.*)$/s);
      if (!m) return true;
      return matchOp(r, k, m[2], m[3], !!m[1]);
    }));

    let out; let status = 200; const extra = {};
    if (method === 'GET' || method === 'HEAD') {
      let list = applyFilters(rows);
      const order = q.get('order');
      if (order) for (const spec of order.split(',').reverse()) { const [c, dir, nulls] = spec.split('.'); const mul = dir === 'desc' ? -1 : 1; list = [...list].sort((a, b) => { const A = a[c], B = b[c]; if (A == null || B == null) { if (A == B) return 0; const nf = nulls === 'nullsfirst'; return (A == null ? (nf ? -1 : 1) : (nf ? 1 : -1)); } return mul * cmp(A, B); }); }
      const total = list.length;
      const range = headers['range'];
      let off = Number(q.get('offset') || 0), lim = q.get('limit') ? Number(q.get('limit')) : Infinity;
      if (range && /^\d+-\d*$/.test(range)) { const [a, b] = range.split('-'); off = Number(a); lim = b === '' ? Infinity : Number(b) - Number(a) + 1; }
      list = list.slice(off, off + lim);
      const sel = q.get('select');
      list = list.map(r => this.project(r, sel));
      if (/count=/.test(prefer)) extra['content-range'] = `${list.length ? off : '*'}-${off + Math.max(list.length - 1, 0)}/${total}`; // content-range
      if (method === 'HEAD') return route.fulfill({ status: 200, headers: { ...this.cors, ...extra } });
      out = list;
    } else if (method === 'POST') {
      const items = Array.isArray(body) ? body : [body];
      const onConflict = q.get('on_conflict');
      const merge = /resolution=merge-duplicates/.test(prefer);
      const ignore = /resolution=ignore-duplicates/.test(prefer);
      out = [];
      for (const it of items) {
        const row = { ...this.defaults(table), ...it };
        if (onConflict) {
          const cols = onConflict.split(',');
          const ex = rows.find(r => cols.every(c => r[c] === row[c] || (r[c] == null && row[c] == null)));
          if (ex) { if (merge) Object.assign(ex, it); if (!ignore) out.push({ ...ex }); continue; }
        } else if (row.id && rows.some(r => r.id === row.id)) {
          if (merge) { Object.assign(rows.find(r => r.id === row.id), it); out.push({ ...rows.find(r => r.id === row.id) }); continue; }
          return this.json(route, 409, { code: '23505', message: 'duplicate key value violates unique constraint', details: null, hint: null });
        }
        rows.push(row); out.push({ ...row }); this.afterInsert(table, row);
      }
      status = 201;
    } else if (method === 'PATCH') {
      const matched = applyFilters(rows);
      out = matched.map(r => { const before = { ...r }; Object.assign(r, body); if (table === 'deals' || table === 'notes' || table === 'tasks') r.updated_at = body?.updated_at || now(); this.afterUpdate(table, before, r); return { ...r }; });
    } else if (method === 'DELETE') {
      const matched = applyFilters(rows);
      out = matched.map(r => ({ ...r }));
      this.tables[table] = rows.filter(r => !matched.includes(r));
    } else return this.json(route, 405, { message: 'method' });

    const wantRep = /return=representation/.test(prefer) || method === 'GET';
    if (!wantRep) return route.fulfill({ status: method === 'POST' ? 201 : 204, headers: { ...this.cors, ...extra } });
    out = out.map(r => this.project(r, q.get('select')));
    if (wantSingle) {
      if (out.length !== 1) return this.json(route, 406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `The result contains ${out.length} rows`, hint: null });
      return this.json(route, status, out[0], extra);
    }
    return this.json(route, status, out, extra);
  }

  runHistoryView() {
    return this.table('workflow_executions').map(e => {
      const w = this.table('deal_workflows').find(x => x.id === e.workflow_id);
      const steps = Array.isArray(e.steps) ? e.steps : [];
      return { ...e, workflow_name: w?.name ?? null, source: e.source ?? 'client', record_id: e.record_id ?? e.context?.recordId ?? null,
        duration_ms: e.duration ?? (e.completed_at ? new Date(e.completed_at) - new Date(e.started_at) : null), steps_total: steps.length, steps_failed: steps.filter(s => s.status === 'failed').length };
    });
  }
  project(r, sel) {
    if (!sel || sel === '*') return { ...r };
    if (sel.includes('(')) return { ...r }; // embeds: return whole row
    const cols = sel.split(',').map(s => s.trim()).filter(Boolean);
    if (cols.includes('*')) return { ...r };
    const o = {}; for (const c of cols) { const name = c.includes(':') ? c.split(':')[1] : c; if (name in r) o[c.includes(':') ? c.split(':')[0] : c] = r[name]; } return o;
  }
  defaults(table) {
    const d = { id: uuid() };
    if (['deals', 'notes', 'tasks', 'deal_files', 'deal_activities', 'companies', 'contacts', 'saved_pipeline_views', 'deal_workflows', 'workflow_executions', 'pipeline_stages', 'favorites'].includes(table)) { d.created_at = now(); d.updated_at = now(); }
    if (table === 'deals') { d.value = 0; d.priority = 'medium'; }
    return d;
  }
  afterInsert(table, row) {
    if (table === 'deals') this.table('deal_activities').push({ id: uuid(), deal_id: row.id, type: 'created', title: 'Deal created', description: row.title, created_at: now(), occurred_at: now() });
  }
  afterUpdate(table, before, after) {
    if (table !== 'deals') return;
    const at = now();
    if (before.stage !== after.stage) this.table('deal_activities').push({ id: uuid(), deal_id: after.id, type: 'stage_change', title: 'Stage changed', description: `${before.stage} -> ${after.stage}`, metadata: { from: before.stage, to: after.stage }, created_at: at, occurred_at: at });
    if (!before.deleted_at && after.deleted_at) this.table('deal_activities').push({ id: uuid(), deal_id: after.id, type: 'deleted', title: 'Deal deleted', created_at: at, occurred_at: at });
  }
  takeFail(table, method) {
    const i = this.failNext.findIndex(f => f.table === table && (f.method === '*' || f.method === method));
    if (i < 0) return null; const f = this.failNext[i]; if (--f.times <= 0) this.failNext.splice(i, 1); return f;
  }
}

/** Seed matching src/data/mockDeals shape: stages + deals + a contact + a company. */
export function defaultSeed() {
  const iso = (d) => new Date(Date.now() + d * 86400000).toISOString();
  const stages = [
    ['qualification', 'Qualification', 0, '#3B82F6', 30, false, false],
    ['proposal', 'Proposal', 1, '#8B5CF6', 50, false, false],
    ['negotiation', 'Negotiation', 2, '#F59E0B', 70, false, false],
    ['closed-won', 'Closed Won', 3, '#10B981', 100, true, false],
    ['closed-lost', 'Closed Lost', 4, '#EF4444', 0, false, true],
  ].map(([key, name, position, color, probability, is_won, is_lost], i) => ({ id: `stage-${i + 1}`, pipeline_id: null, key, name, position, color, probability, is_won, is_lost, is_hidden: false, wip_limit: null, created_at: iso(-30), updated_at: iso(-30) }));
  const mk = (n, title, company, contact, stage, value, priority, position, extra = {}) => ({
    id: `00000000-0000-4000-8000-00000000000${n}`, title, company, contact, stage, value, amount_micros: value * 1e6, priority, probability: 30, position,
    created_at: iso(-10 - n), updated_at: iso(-n), due_date: iso(5 + n), assigned_to: n % 2 ? 'Alex Owner' : 'Sam Rep', tags: n % 2 ? ['enterprise'] : [], is_favorite: false, deleted_at: null, ...extra });
  const deals = [
    mk(1, 'Enterprise Software License', 'TechCorp Inc.', 'Sarah Johnson', 'qualification', 75000, 'high', 1000, { contact_id: 'c0000000-0000-4000-8000-000000000001' }),
    mk(2, 'Marketing Automation Platform', 'GrowthCo', 'Mike Chen', 'qualification', 45000, 'medium', 2000),
    mk(3, 'Cloud Infrastructure Setup', 'Enterprise Corp', 'David Kumar', 'proposal', 120000, 'high', 1000),
    mk(4, 'Security Audit Package', 'SecureNet', 'Lena Park', 'negotiation', 55000, 'low', 1000),
    mk(5, 'Analytics Suite', 'DataWorks', 'Omar Ali', 'closed-won', 85000, 'medium', 1000),
    mk(6, 'Legacy Migration', 'OldCo', 'Tia Bell', 'closed-lost', 30000, 'low', 1000),
  ];
  const contacts = [{ id: 'c0000000-0000-4000-8000-000000000001', name: 'Sarah Johnson', first_name: 'Sarah', last_name: 'Johnson', email: 'sarah@techcorp.com', company: 'TechCorp Inc.', title: 'CTO', status: 'prospect', created_at: iso(-20), updated_at: iso(-2) }];
  const companies = [{ id: 'co000000-0000-4000-8000-000000000001', name: 'TechCorp Inc.', created_at: iso(-20), updated_at: iso(-2) }];
  deals[0].company_id = companies[0].id;
  const profiles = [{ id: 'a0000000-0000-4000-8000-000000000001', name: 'Alex Rivera', avatar: null }, { id: 'a0000000-0000-4000-8000-000000000002', name: 'Sam Rep', avatar: null }];
  return { profiles, user_roles: [], roles: [], pipeline_stages: stages, deals, contacts, companies, notes: [], tasks: [], deal_files: [], deal_activities: [], saved_pipeline_views: [], favorites: [], deal_workflows: [], workflow_executions: [], app_settings: [], feature_flags: [] };
}
