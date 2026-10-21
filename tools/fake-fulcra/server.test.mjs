import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startFake } from './server.mjs';

function fakeJwt(userid) {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b({ alg: 'none' })}.${b({ 'fulcradynamics.com/userid': userid })}.`;
}

async function setup() {
  const logPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'fake-')), 'log.jsonl');
  const f = await startFake({ port: 0, logPath });
  const base = `http://127.0.0.1:${f.port}`;
  const h = { authorization: `Bearer ${fakeJwt('u1')}`, 'content-type': 'application/json' };
  return { f, base, h, logPath };
}

test('health needs no auth, other routes 401 without bearer', async () => {
  const { f, base } = await setup();
  assert.equal((await fetch(`${base}/__health`)).status, 200);
  assert.equal((await fetch(`${base}/user/v1alpha1/info`)).status, 401);
  assert.equal((await fetch(`${base}/nope`, { headers: { authorization: 'Bearer x' } })).status, 404);
  await f.close();
});

test('info reads the userid claim', async () => {
  const { f, base, h } = await setup();
  const info = await (await fetch(`${base}/user/v1alpha1/info`, { headers: h })).json();
  assert.equal(info.userid, 'u1');
  const pref = await (await fetch(`${base}/user/v1alpha1/preferences`, { headers: h })).json();
  assert.equal(pref.timezone, 'America/New_York');
  await f.close();
});

test('file upload, list, download, delete, and log line', async () => {
  const { f, base, h, logPath } = await setup();
  const made = await (
    await fetch(`${base}/input/v1/file`, {
      method: 'POST',
      headers: h,
      body: JSON.stringify({ path: '/built-on-fulcra/demo', name: 'a.json', content_type: 'application/json', content_length: 7 })
    })
  ).json();
  assert.match(made.url, /\/__upload\//);
  await fetch(made.url, { method: 'POST', body: '{"a":1}' });
  const list = await (await fetch(`${base}/input/v1/file?path=/built-on-fulcra/demo`, { headers: h })).json();
  assert.equal(list.files.length, 1);
  assert.equal(list.files[0].name, 'a.json');
  const dl = await fetch(`${base}/input/v1/file/${list.files[0].id}/download`, { headers: h });
  assert.equal(await dl.text(), '{"a":1}');
  const lines = fs.readFileSync(logPath, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(lines.length, 1);
  assert.equal(lines[0].kind, 'file');
  assert.equal(lines[0].path, '/built-on-fulcra/demo/a.json');
  assert.equal(lines[0].bytes, 7);
  assert.equal(lines[0].userid, 'u1');
  assert.ok(lines[0].at);
  const del = await fetch(`${base}/input/v1/file/${list.files[0].id}`, { method: 'DELETE', headers: h });
  assert.equal(del.status, 200);
  const after = await (await fetch(`${base}/input/v1/file?path=/built-on-fulcra/demo`, { headers: h })).json();
  assert.equal(after.files.length, 0);
  await f.close();
});

test('list returns the latest version per name', async () => {
  const { f, base, h } = await setup();
  for (const body of ['one', 'two']) {
    const made = await (
      await fetch(`${base}/input/v1/file`, { method: 'POST', headers: h, body: JSON.stringify({ path: '/d', name: 'n.txt' }) })
    ).json();
    await fetch(made.url, { method: 'POST', body });
  }
  const list = await (await fetch(`${base}/input/v1/file?path=/d`, { headers: h })).json();
  assert.equal(list.files.length, 1);
  const dl = await fetch(`${base}/input/v1/file/${list.files[0].id}/download`, { headers: h });
  assert.equal(await dl.text(), 'two');
  await f.close();
});

test('record ingest (json and json lines) and read back, with log', async () => {
  const { f, base, h, logPath } = await setup();
  await fetch(`${base}/ingest/v1/record/my_type`, { method: 'POST', headers: h, body: JSON.stringify({ x: 1 }) });
  await fetch(`${base}/ingest/v1/record/my_type`, { method: 'POST', headers: h, body: '{"x":2}\n{"x":3}\n' });
  const got = await (await fetch(`${base}/data/v1/records?data_type=my_type`, { headers: h })).json();
  assert.deepEqual(got.records.map((r) => r.x), [1, 2, 3]);
  const lines = fs.readFileSync(logPath, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(lines.length, 2);
  assert.equal(lines[0].kind, 'record');
  assert.equal(lines[0].dataType, 'my_type');
  assert.equal(lines[0].userid, 'u1');
  await f.close();
});

test('register returns an empty object', async () => {
  const { f, base, h } = await setup();
  const r = await fetch(`${base}/user/v0/register`, { method: 'POST', headers: h, body: '{}' });
  assert.deepEqual(await r.json(), {});
  await f.close();
});
