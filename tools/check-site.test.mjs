import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkSite, scanPlaceholders, scanHostedModel } from './check-site.mjs';

const ID = 'demo-site';

/** A tiny site that passes every check. Returns its directory. */
function makeSite() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'site-'));
  const dir = path.join(root, ID);
  const w = (f, t) => {
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    fs.writeFileSync(path.join(dir, f), t);
  };
  w('site.json', JSON.stringify({
    schema: 'built-on-fulcra.site.v1', id: ID, name: 'Demo', oneLine: 'A demo.', deployProject: ID, domain: null,
    skill: '/skill.md', fork: '/fork.md',
    fulcraPaths: { reads: [`/built-on-fulcra/${ID}/in/`], writes: [`/built-on-fulcra/${ID}/out/`] },
    signInReason: 'Save your entries to your own Fulcra account.', hooks: ['skill-load', 'data-handoff'],
    coreFlow: [{ title: 'Look around', signedOut: true }, { title: 'Save an entry', signedOut: false }]
  }, null, 2));
  w('static/skill.md', `---\nname: ${ID}\ndescription: Reads the demo data.\n---\nRead /built-on-fulcra/${ID}/in/ and /built-on-fulcra/${ID}/out/.\nSetup: https://docs.fulcradynamics.com/agent-get-started.txt\n`);
  w('static/fork.md', `Source: https://github.com/fulcradynamics/built-on-fulcra/tree/main/sites/${ID}\nUse the build-and-deploy-a-web-app skill.\n`);
  w('README.md', '# Demo\n');
  w('package.json', JSON.stringify({ scripts: { build: 'x', check: 'x', 'test:e2e': 'x' } }));
  w('.env.example', 'PUBLIC_AUTH0_DOMAIN="x"\n');
  w('src/lib/components/LoginDeviceFlow.svelte', '<script>user.startLogin(p); user.completeLogin(a, b);</script>\n<p>Hello</p>\n');
  for (const f of ['src/lib/auth0-device-flow.js', 'src/lib/user.js', 'src/routes/api/auth/device/code/+server.js', 'src/routes/api/auth/device/token/+server.js', 'src/routes/api/auth/token/+server.js']) w(f, '// ok\n');
  w('src/routes/+page.svelte', '<h1>Demo</h1>\n');
  return dir;
}

const ids = (dir) => checkSite(dir).problems.map((p) => p.id);

test('a good site passes', () => {
  const r = checkSite(makeSite());
  assert.deepEqual(r.problems, []);
  assert.equal(r.siteId, ID);
});

test('skill.md missing a declared path fails', () => {
  const d = makeSite();
  fs.writeFileSync(path.join(d, 'static/skill.md'), `---\nname: ${ID}\ndescription: x\n---\nhttps://docs.fulcradynamics.com/agent-get-started.txt\n`);
  assert.ok(ids(d).includes('skill-md'));
});

test('fork.md missing the source link fails', () => {
  const d = makeSite();
  fs.writeFileSync(path.join(d, 'static/fork.md'), 'build-and-deploy-a-web-app\n');
  assert.ok(ids(d).includes('fork-md'));
});

test('a "coming soon" line fails', () => {
  const d = makeSite();
  fs.appendFileSync(path.join(d, 'src/routes/+page.svelte'), '<p>Sharing is coming soon</p>\n');
  assert.ok(ids(d).includes('coming-next'));
});

test('removing user.startLogin( fails', () => {
  const d = makeSite();
  fs.writeFileSync(path.join(d, 'src/lib/components/LoginDeviceFlow.svelte'), '<script>user.completeLogin(a, b);</script>\n');
  assert.ok(ids(d).includes('signin-missing'));
});

test('an anthropic import fails', () => {
  const d = makeSite();
  fs.writeFileSync(path.join(d, 'src/lib/llm.js'), "import Anthropic from '@anthropic-ai/sdk';\n");
  assert.ok(ids(d).includes('hosted-model'));
});

test('a committed .env fails but .env.example is fine', () => {
  const d = makeSite();
  fs.writeFileSync(path.join(d, '.env'), 'A=b\n');
  assert.ok(ids(d).includes('env-committed'));
});

test('scanPlaceholders skips comments and finds disabled stubs', () => {
  assert.deepEqual(scanPlaceholders('a.svelte', '<!-- coming soon -->\n// TBD\n'), []);
  assert.equal(scanPlaceholders('a.svelte', '<button disabled>Go</button>')[0].id, 'disabled-stub');
  assert.equal(scanPlaceholders('a.svelte', '<button disabled={busy}>Go</button>').length, 0);
});

test('scanHostedModel finds keys and hosts', () => {
  assert.equal(scanHostedModel('a.js', 'fetch("https://api.openai.com/v1")')[0].id, 'hosted-model');
  assert.equal(scanHostedModel('a.js', 'process.env.ANTHROPIC_API_KEY').length, 1);
  assert.equal(scanHostedModel('a.js', "import OpenAI from 'openai';").length, 1);
  assert.equal(scanHostedModel('a.js', 'const openaiLike = 1;').length, 0);
});
