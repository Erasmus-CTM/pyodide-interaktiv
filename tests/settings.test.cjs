// pyodide: options (step-3 design §18.2). On HTML pages they combine key by
// key across the project and the page (F-79) through ctm-libs' settings
// reader, credential-like keys stop the render (A1), the on/off options keep
// the meaning of true, false, 1 and 0, and a value that broke the page's
// script before now warns and uses the default. PDF, docx and the other
// formats read Quarto's merged map as before. Needs Quarto.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');

const quarto = process.env.QUARTO_BIN || 'quarto';
const skip = spawnSync(quarto, ['--version']).error ? 'Quarto required' : false;
const repo = path.join(__dirname, '..');
const CELL = '\n```{pyodide-python}\nprint(6 * 7)\n```\n';

// A project as `quarto add Erasmus-CTM/pyodide-interaktiv` leaves it.
function project(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pyodide-settings-'));
  for (const name of ['pyodide-interaktiv', 'ctm-libs', 'ai-feedback']) fs.cpSync(path.join(repo, '_extensions', name), path.join(dir, '_extensions/Erasmus-CTM', name), { recursive: true });
  for (const [name, text] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true }); fs.writeFileSync(path.join(dir, name), text); }
  return dir;
}
function render(dir, args = []) {
  const r = spawnSync(quarto, ['render', ...args], { cwd: dir, encoding: 'utf8', timeout: 240000 });
  return { ...r, stderr: (r.stderr || '').replace(/\x1b\[[0-9;]*m/g, '') };
}
const yml = (pages, extra = '') => 'project:\n  type: default\n  render: [' + pages.join(', ') + ']\nfilters: [Erasmus-CTM/pyodide-interaktiv]\n' + extra;
// The page's settings script, evaluated: the globals it defines.
function settings(dir, page) {
  const html = fs.readFileSync(path.join(dir, page.replace(/\.qmd$/, '.html')), 'utf8');
  const script = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(text => text.includes('globalThis.qpyodideCellDetails ='));
  assert.ok(script, 'settings script on ' + page);
  const context = {}; context.globalThis = context;
  vm.runInNewContext(script, context);   // throws if the script is broken
  return context;
}
function withProject(files, run) {
  const dir = project(files);
  try { return run(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test('F-79: a page\'s pyodide: map no longer drops the project\'s keys', { skip }, () => withProject({
  '_quarto.yml': yml(['page.qmd'], 'pyodide:\n  feedback: false\n  packages: [sympy, networkx]\n  home-dir: /home/learner\n'),
  'page.qmd': '---\ntitle: t\npyodide:\n  lang: de\n---\n' + CELL,
}, dir => {
  const r = render(dir);
  assert.equal(r.status, 0, r.stderr);
  const s = settings(dir, 'page.qmd');
  assert.equal(s.qpyodideFeedbackOptions.enabled, false);
  assert.deepEqual([...s.qpyodideInstallPythonPackagesList], ['sympy', 'networkx']);
  assert.equal(s.qpyodideCustomizedPyodideOptions.env.HOME, '/home/learner');
  assert.equal(s.qpyodideLang, 'de');
}));

test('1 and 0 keep their meaning, as YAML numbers and as strings; empty values are unset', { skip }, () => withProject({
  '_quarto.yml': yml(['page.qmd']),
  'page.qmd': '---\ntitle: t\npyodide:\n  show-startup-message: 0\n  feedback: 1\n  feedback-hints: "0"\n  local-storage: 1\n  feedback-storage: ""\n---\n' + CELL,
}, dir => {
  const r = render(dir);
  assert.equal(r.status, 0, r.stderr);
  const s = settings(dir, 'page.qmd');
  assert.equal(s.qpyodideShowStartupMessage, false);
  assert.deepEqual({ ...s.qpyodideFeedbackOptions }, { enabled: true, storage: 'local', hints: false });
  assert.equal(s.qpyodideLocalStorageOptions.enabled, true);
  assert.doesNotMatch(r.stderr, /must be true or false/);
}));

test('a value that broke the page\'s script warns once and uses the default; the script stays valid', { skip }, () => withProject({
  '_quarto.yml': yml(['page.qmd']),
  'page.qmd': '---\ntitle: t\npyodide:\n  feedback: yes please\n  show-startup-message: maybe\n---\n' + CELL,
}, dir => {
  const r = render(dir);
  assert.equal(r.status, 0, r.stderr);
  const s = settings(dir, 'page.qmd');
  assert.equal(s.qpyodideFeedbackOptions.enabled, true);
  assert.equal(s.qpyodideShowStartupMessage, true);
  assert.equal(r.stderr.match(/pyodide: feedback must be true or false \(or 1 or 0\) \(found yes please in page\.qmd\); using true/g).length, 1, r.stderr);
  assert.match(r.stderr, /pyodide: show-startup-message must be true or false/);
}));

test('a credential-like key under pyodide: stops the render (A1)', { skip }, () => withProject({
  '_quarto.yml': yml(['page.qmd'], 'pyodide:\n  api-key: sk-123\n'),
  'page.qmd': '---\ntitle: t\n---\n' + CELL,
}, dir => {
  const r = render(dir);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /pyodide: api-key in _quarto\.yml looks like a credential/);
}));

test('home-dir is escaped for its JavaScript string (M8)', { skip }, () => withProject({
  '_quarto.yml': yml(['page.qmd']),
  'page.qmd': '---\ntitle: t\npyodide:\n  home-dir: \'/home/a"b\\\\c\'\n---\n' + CELL,
}, dir => {
  const r = render(dir);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(settings(dir, 'page.qmd').qpyodideCustomizedPyodideOptions.env.HOME, '/home/a"b\\\\c');
}));

test('a page without Pyodide cells or activities gets nothing of pyodide-interaktiv (E14)', { skip }, () => withProject({
  '_quarto.yml': yml(['plain.qmd'], 'pyodide:\n  feedback: true\n'),
  'plain.qmd': '---\ntitle: t\n---\n\nNo cells here.\n',
}, dir => {
  const r = render(dir);
  assert.equal(r.status, 0, r.stderr);
  const html = fs.readFileSync(path.join(dir, 'plain.html'), 'utf8');
  assert.doesNotMatch(html, /qpyodide|feedback-core\.js|coi-serviceworker/);
}));

test('LaTeX/PDF: pdf-fallback (python) and pdf-autoexec from _quarto.yml reach the render, as before', { skip }, () => withProject({
  '_quarto.yml': yml(['fallback.qmd', 'run.qmd'], 'pyodide:\n  pdf-fallback: python\n'),
  'fallback.qmd': '---\ntitle: t\n---\n' + CELL,
  'run.qmd': '---\ntitle: t\npyodide:\n  pdf-autoexec: 1\n---\n' + CELL,
}, dir => {
  const r = render(dir, ['--to', 'latex']);
  assert.equal(r.status, 0, r.stderr);
  const fallback = fs.readFileSync(path.join(dir, 'fallback.tex'), 'utf8');
  assert.match(fallback, /\\begin\{Highlighting\}[\s\S]*\\BuiltInTok\{print\}|\\begin\{Highlighting\}[\s\S]*print/);
  assert.doesNotMatch(fallback, /pyodide-python/);
  const run = fs.readFileSync(path.join(dir, 'run.tex'), 'utf8');
  assert.match(run, /\b42\b/, 'the cell ran at render time');
}));
