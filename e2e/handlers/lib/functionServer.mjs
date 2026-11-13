/** Tiny "netlify dev" substitute: routes /.netlify/functions/<name> to the bundled v1 handlers (for function-to-function fetches). */
import http from 'node:http';

export function createFunctionServer({ port, loadFunction }) {
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const m = /^\/\.netlify\/functions\/([\w-]+)/.exec(req.url);
    if (!m) { res.writeHead(404); return res.end('not found'); }
    try {
      const mod = await loadFunction(m[1]);
      const out = await mod.handler({ httpMethod: req.method, headers: req.headers, path: req.url, queryStringParameters: null, body: Buffer.concat(chunks).toString('utf8') || null }, {});
      res.writeHead(out.statusCode, { 'Content-Type': 'application/json', ...(out.headers ?? {}) });
      res.end(out.body ?? '');
    } catch (e) { res.writeHead(500); res.end(JSON.stringify({ error: String(e.message) })); }
  });
  return {
    port,
    start: () => new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); }),
    stop: () => new Promise((r) => server.close(r)),
  };
}
