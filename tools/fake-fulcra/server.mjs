#!/usr/bin/env node
// A zero-dependency fake of the parts of the Fulcra API that sites use.
//
// Why: site CI must run a site's end-to-end test without a real Fulcra
// account. The fake accepts any bearer token, keeps everything in memory, and
// appends every write to a JSON-lines log so CI can assert that a signed-in
// visitor's data landed at the paths the site declares in site.json.
//
// Usage: node tools/fake-fulcra/server.mjs --port 8790 --log /tmp/fake.jsonl
import http from 'node:http';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

/** Read the userid claim out of an unsigned (or any) JWT. Falls back to "fake-user". */
export function useridFromToken(token) {
  try {
    const payload = token.split('.')[1];
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return claims['fulcradynamics.com/userid'] || 'fake-user';
  } catch {
    return 'fake-user';
  }
}

function normDir(p) {
  let d = '/' + String(p || '/').replace(/^\/+/, '').replace(/\/+$/, '');
  return d === '' ? '/' : d;
}

/**
 * Start the fake. Returns { server, port, close(), state }.
 * options: { port (0 = random), logPath }
 */
export async function startFake({ port = 0, logPath } = {}) {
  const state = {
    files: new Map(), // id -> { id, path, name, content_type, created_at, userid, body|null, seq }
    records: [], // { data_type, userid, record }
    seq: 0
  };
  let actualPort = port;

  function log(entry) {
    if (!logPath) return;
    fs.appendFileSync(logPath, JSON.stringify({ ...entry, at: new Date().toISOString() }) + '\n');
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const route = url.pathname.replace(/\/+$/, '') || '/';
    const send = (status, body, type = 'application/json') => {
      res.writeHead(status, { 'content-type': type });
      res.end(Buffer.isBuffer(body) || typeof body === 'string' ? body : JSON.stringify(body));
    };
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks);

    if (route === '/__health') return send(200, { ok: true });

    const auth = req.headers.authorization || '';
    const m = /^Bearer\s+(\S+)/i.exec(auth);
    // The upload URL is a pre-signed style URL, so it carries no bearer.
    const isUpload = route.startsWith('/__upload/');
    if (!m && !isUpload) return send(401, { error: 'missing bearer token' });
    const userid = m ? useridFromToken(m[1]) : null;

    try {
      if (req.method === 'GET' && route === '/user/v1alpha1/info') {
        return send(200, { userid, email: `${userid}@example.test` });
      }
      if (req.method === 'GET' && route === '/user/v1alpha1/preferences') {
        return send(200, { timezone: 'America/New_York' });
      }
      if (req.method === 'POST' && route === '/user/v0/register') return send(200, {});

      if (req.method === 'POST' && route === '/input/v1/file') {
        const body = JSON.parse(raw.toString('utf8') || '{}');
        if (!body.path || !body.name) return send(400, { error: 'path and name are required' });
        const id = randomUUID();
        state.files.set(id, {
          id,
          path: normDir(body.path),
          name: body.name,
          content_type: body.content_type || 'application/octet-stream',
          created_at: new Date().toISOString(),
          userid,
          body: null,
          seq: ++state.seq
        });
        return send(200, {
          file: { id, path: normDir(body.path), name: body.name },
          url: `http://127.0.0.1:${actualPort}/__upload/${id}`
        });
      }

      if (route.startsWith('/__upload/') && (req.method === 'POST' || req.method === 'PUT')) {
        const f = state.files.get(route.slice('/__upload/'.length));
        if (!f) return send(404, { error: 'unknown upload' });
        f.body = raw;
        f.seq = ++state.seq;
        log({
          kind: 'file',
          path: `${f.path === '/' ? '' : f.path}/${f.name}`,
          bytes: raw.length,
          userid: f.userid
        });
        return send(200, {});
      }

      if (req.method === 'GET' && route === '/input/v1/file') {
        const dir = normDir(url.searchParams.get('path'));
        const latest = new Map();
        for (const f of state.files.values()) {
          if (f.path !== dir || f.body === null || f.userid !== userid) continue;
          const prev = latest.get(f.name);
          if (!prev || f.seq > prev.seq) latest.set(f.name, f);
        }
        const files = [...latest.values()].map((f) => ({
          id: f.id,
          name: f.name,
          path: f.path,
          content_type: f.content_type,
          created_at: f.created_at
        }));
        return send(200, { files });
      }

      const dl = /^\/input\/v1\/file\/([^/]+)\/download$/.exec(route);
      if (req.method === 'GET' && dl) {
        const f = state.files.get(dl[1]);
        if (!f || f.body === null || f.userid !== userid) return send(404, { error: 'no such file' });
        return send(200, f.body, f.content_type);
      }

      const del = /^\/input\/v1\/file\/([^/]+)$/.exec(route);
      if (req.method === 'DELETE' && del) {
        const f = state.files.get(del[1]);
        if (!f || f.userid !== userid) return send(404, { error: 'no such file' });
        state.files.delete(del[1]);
        return send(200, {});
      }

      const ing = /^\/ingest\/v1\/record\/(.+)$/.exec(route);
      if (req.method === 'POST' && ing) {
        const dataType = decodeURIComponent(ing[1]);
        const text = raw.toString('utf8').trim();
        let items;
        try {
          const parsed = JSON.parse(text);
          items = Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          items = text.split('\n').filter(Boolean).map((l) => JSON.parse(l));
        }
        for (const record of items) state.records.push({ data_type: dataType, userid, record });
        log({ kind: 'record', dataType, bytes: raw.length, userid });
        return send(200, { ingested: items.length });
      }

      if (req.method === 'GET' && route === '/data/v1/records') {
        const dt = url.searchParams.get('data_type');
        const records = state.records
          .filter((r) => r.userid === userid && (!dt || r.data_type === dt))
          .map((r) => r.record);
        return send(200, { records });
      }

      return send(404, { error: `unknown route ${req.method} ${route}` });
    } catch (e) {
      return send(400, { error: String(e && e.message ? e.message : e) });
    }
  });

  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  actualPort = server.address().port;
  return {
    server,
    port: actualPort,
    state,
    close: () => new Promise((resolve) => { server.close(resolve); server.closeAllConnections?.(); })
  };
}

function arg(name, argv) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const port = Number(arg('--port', process.argv) ?? 8790);
  const logPath = arg('--log', process.argv);
  const f = await startFake({ port, logPath });
  console.log(`fake-fulcra listening on http://127.0.0.1:${f.port}`);
  const stop = () => process.exit(0);
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}
