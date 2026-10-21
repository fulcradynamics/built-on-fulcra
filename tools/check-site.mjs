#!/usr/bin/env node
// Static checks for one site under sites/<id>/. See the README for the contract.
// Usage: node tools/check-site.mjs sites/<id>
// Prints one line per problem as "<id>: <file>:<line> <text>" and exits 1,
// or prints "ok <siteId>" and exits 0.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const ID_RE = /^[a-z][a-z0-9-]{2,40}$/;
export const HOOKS = ['skill-load', 'data-handoff', 'share-with-another-person'];
export const SKILL_DOCS_URL = 'https://docs.fulcradynamics.com/agent-get-started.txt';

// Copied from Company OS so a site fails here for the same reasons it would there.
export const PLACEHOLDER_RULES = [
  { id: 'coming-next', re: /\bcoming\s+(?:next|soon)\b/i },
  { id: 'not-available', re: /\bnot\s+(?:yet\s+)?(?:available|implemented|supported|built|ready)\b|\bavailable\s+soon\b|\bto\s+be\s+(?:implemented|built|added)\b|\bwill\s+be\s+(?:implemented|built|added)\s+(?:later|soon)\b/i },
  { id: 'lorem', re: /\blorem\s+ipsum\b|\bplaceholder\s+(?:text|copy|content|data)\b|\bTBD\b/i },
  { id: 'disabled-stub', re: /<(?:button|input|select|textarea)\b[^>]*?\sdisabled(?![\w-]|\s*=\s*\{)/i }
];
export const UI_FILE = /\.(?:svelte|html|js|ts|md|svx|json)$/i;
export const NOT_UI = /(?:^|\/)(?:e2e|tests?|__tests__|fixtures?|node_modules|\.svelte-kit|build)\/|\.(?:test|spec)\.[a-z]+$|(?:^|\/)(?:README\.md|package(?:-lock)?\.json|tsconfig\.json|cloudrun\.env\.yaml)$/i;
const COMMENT_LINE = /^\s*(\/\/|\/\*|\*|<!--)/;

const HOSTED_MODEL_RULES = [
  /api\.anthropic\.com/,
  /api\.openai\.com/,
  /generativelanguage\.googleapis\.com/,
  /@anthropic-ai\//,
  /(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"]openai(?:\/[^'"]*)?['"]/,
  /\b(?:ANTHROPIC_API_KEY|OPENAI_API_KEY)\b/
];

const REQUIRED_FILES = [
  'src/lib/components/LoginDeviceFlow.svelte',
  'src/lib/auth0-device-flow.js',
  'src/lib/user.js',
  'src/routes/api/auth/device/code/+server.js',
  'src/routes/api/auth/device/token/+server.js',
  'src/routes/api/auth/token/+server.js'
];

const SKIP_DIRS = new Set(['node_modules', '.svelte-kit', 'build', '.git']);

/** All files under dir as posix-style paths relative to dir. */
export function listFiles(dir, rel = '') {
  const out = [];
  for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...listFiles(dir, r));
    else out.push(r);
  }
  return out;
}

/** Placeholder-copy problems in one UI file's text. */
export function scanPlaceholders(file, text) {
  const problems = [];
  text.split('\n').forEach((line, i) => {
    if (COMMENT_LINE.test(line)) return;
    for (const rule of PLACEHOLDER_RULES) {
      if (rule.re.test(line)) problems.push({ id: rule.id, file, line: i + 1, text: line.trim().slice(0, 120) });
    }
  });
  return problems;
}

/** Hosted-model references in one source file's text. */
export function scanHostedModel(file, text) {
  const problems = [];
  text.split('\n').forEach((line, i) => {
    if (HOSTED_MODEL_RULES.some((re) => re.test(line))) {
      problems.push({ id: 'hosted-model', file, line: i + 1, text: line.trim().slice(0, 120) });
    }
  });
  return problems;
}

function readJson(abs, file, problems) {
  try {
    return JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch (e) {
    problems.push({ id: 'bad-json', file, line: 1, text: String(e.message).slice(0, 120) });
    return null;
  }
}

/** Run every check. Returns { siteId, problems: [{id,file,line,text}] }. */
export function checkSite(siteDir) {
  const problems = [];
  const add = (id, file, text, line = 1) => problems.push({ id, file, line, text });
  const dirId = path.basename(path.resolve(siteDir));
  const exists = (f) => fs.existsSync(path.join(siteDir, f));
  const read = (f) => fs.readFileSync(path.join(siteDir, f), 'utf8');

  if (!ID_RE.test(dirId)) add('bad-id', dirId, `folder name must match ${ID_RE}`);

  // site.json
  let site = null;
  if (!exists('site.json')) add('missing-file', 'site.json', 'site.json is required');
  else site = readJson(path.join(siteDir, 'site.json'), 'site.json', problems);
  const reads = [];
  const writes = [];
  if (site) {
    const need = (cond, text) => cond || add('site-json', 'site.json', text);
    need(site.schema === 'built-on-fulcra.site.v1', 'schema must be built-on-fulcra.site.v1');
    need(site.id === dirId, `id must equal the folder name (${dirId})`);
    for (const k of ['name', 'oneLine', 'deployProject']) need(typeof site[k] === 'string' && site[k].trim(), `${k} must be a non-empty string`);
    need(site.domain === null || (typeof site.domain === 'string' && site.domain.trim()), 'domain must be a host or null');
    need(site.skill === '/skill.md', 'skill must be /skill.md');
    need(site.fork === '/fork.md', 'fork must be /fork.md');
    need(site.signInReason === null || (typeof site.signInReason === 'string' && site.signInReason.trim()), 'signInReason must be null or a non-empty string');
    need(Array.isArray(site.hooks) && site.hooks.every((h) => HOOKS.includes(h)), `hooks must be a list of ${HOOKS.join(', ')}`);
    need(
      Array.isArray(site.coreFlow) && site.coreFlow.length > 0 && site.coreFlow.every((s) => s && typeof s.title === 'string' && s.title.trim() && typeof s.signedOut === 'boolean'),
      'coreFlow must be a non-empty list of { title, signedOut }'
    );
    const fp = site.fulcraPaths;
    if (!fp || !Array.isArray(fp.reads) || !Array.isArray(fp.writes)) {
      add('site-json', 'site.json', 'fulcraPaths must have reads and writes lists');
    } else {
      const prefix = `/built-on-fulcra/${dirId}/`;
      for (const p of [...fp.reads, ...fp.writes]) {
        if (typeof p !== 'string' || !p.startsWith(prefix)) add('site-json', 'site.json', `path ${p} must start with ${prefix}`);
      }
      reads.push(...fp.reads);
      writes.push(...fp.writes);
      if (site.signInReason !== null && site.signInReason !== undefined && fp.writes.length === 0) {
        add('site-json', 'site.json', 'writes must be non-empty when signInReason is set');
      }
    }
  }

  // skill.md
  if (!exists('static/skill.md')) add('missing-file', 'static/skill.md', 'static/skill.md is required');
  else {
    const t = read('static/skill.md');
    const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(t);
    if (!fm) add('skill-md', 'static/skill.md', 'YAML frontmatter is required');
    else {
      const name = /^name:\s*(.+?)\s*$/m.exec(fm[1]);
      const desc = /^description:\s*(.+?)\s*$/m.exec(fm[1]);
      if (!name || name[1].replace(/^["']|["']$/g, '') !== dirId) add('skill-md', 'static/skill.md', `frontmatter name must be ${dirId}`);
      if (!desc || !desc[1].replace(/^["']|["']$/g, '').trim()) add('skill-md', 'static/skill.md', 'frontmatter description must be non-empty');
    }
    for (const p of [...reads, ...writes]) if (!t.includes(p)) add('skill-md', 'static/skill.md', `skill must mention ${p}`);
    if (!t.includes(SKILL_DOCS_URL)) add('skill-md', 'static/skill.md', `skill must contain ${SKILL_DOCS_URL}`);
  }

  // fork.md
  if (!exists('static/fork.md')) add('missing-file', 'static/fork.md', 'static/fork.md is required');
  else {
    const t = read('static/fork.md');
    const link = `https://github.com/fulcradynamics/built-on-fulcra/tree/main/sites/${dirId}`;
    if (!t.includes(link)) add('fork-md', 'static/fork.md', `fork.md must contain ${link}`);
    if (!t.includes('build-and-deploy-a-web-app')) add('fork-md', 'static/fork.md', 'fork.md must mention build-and-deploy-a-web-app');
  }

  // README, package.json
  if (!exists('README.md') || !read('README.md').trim()) add('missing-file', 'README.md', 'a non-empty README.md is required');
  if (!exists('package.json')) add('missing-file', 'package.json', 'package.json is required');
  else {
    const pkg = readJson(path.join(siteDir, 'package.json'), 'package.json', problems);
    if (pkg) for (const s of ['build', 'check', 'test:e2e']) if (!pkg.scripts || !pkg.scripts[s]) add('package-json', 'package.json', `missing script ${s}`);
  }

  // Template sign-in must survive.
  for (const f of REQUIRED_FILES) if (!exists(f)) add('signin-missing', f, 'template sign-in file is required');
  if (exists('src/lib/components/LoginDeviceFlow.svelte')) {
    const t = read('src/lib/components/LoginDeviceFlow.svelte');
    for (const call of ['user.startLogin(', 'user.completeLogin(']) if (!t.includes(call)) add('signin-missing', 'src/lib/components/LoginDeviceFlow.svelte', `must still call ${call}`);
  }

  const files = listFiles(siteDir);

  // Committed env files.
  for (const f of files) {
    const base = f.split('/').pop();
    if (/^\.env(\..+)?$/.test(base) && base !== '.env.example') add('env-committed', f, 'do not commit env files (.env.example is fine)');
  }

  // Placeholder copy and hosted-model calls.
  for (const f of files) {
    if (NOT_UI.test(f)) continue;
    const text = fs.readFileSync(path.join(siteDir, f), 'utf8');
    if (UI_FILE.test(f)) problems.push(...scanPlaceholders(f, text));
    if (f.startsWith('src/') && /\.(?:svelte|js|ts|mjs|cjs|svx)$/i.test(f)) problems.push(...scanHostedModel(f, text));
  }

  return { siteId: dirId, problems };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const dir = process.argv[2];
  if (!dir || !fs.existsSync(dir)) {
    console.error('usage: node tools/check-site.mjs sites/<id>');
    process.exit(2);
  }
  const { siteId, problems } = checkSite(dir);
  if (problems.length) {
    for (const p of problems) console.log(`${p.id}: ${p.file}:${p.line} ${p.text}`);
    process.exit(1);
  }
  console.log(`ok ${siteId}`);
}
