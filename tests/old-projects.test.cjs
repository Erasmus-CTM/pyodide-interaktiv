// Projects made for pyodide-interaktiv 1.6 (built-in feedback) build unchanged
// after `quarto add Erasmus-CTM/pyodide-interaktiv`, which also installs the
// ctm-libs and the ai-feedback forwarder shipped in this repository. Needs
// Quarto; skipped otherwise.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const quarto = process.env.QUARTO_BIN || 'quarto';
const skip = spawnSync(quarto, ['--version']).error ? 'Quarto required' : false;
const repo = path.join(__dirname, '..');

// What `quarto add Erasmus-CTM/pyodide-interaktiv` installs: every extension
// in the repository's _extensions/, under the owner folder.
function project(extensions = ['pyodide-interaktiv', 'ctm-libs', 'ai-feedback'], edit = text => text) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pyodide-old-project-'));
  fs.cpSync(path.join(__dirname, 'fixtures/v1.6-project'), dir, { recursive: true });
  for (const name of extensions) fs.cpSync(path.join(repo, '_extensions', name), path.join(dir, '_extensions/Erasmus-CTM', name), { recursive: true });
  const config = path.join(dir, '_quarto.yml');
  fs.writeFileSync(config, edit(fs.readFileSync(config, 'utf8')));
  return dir;
}
function render(dir) {
  const r = spawnSync(quarto, ['render'], { cwd: dir, encoding: 'utf8', timeout: 180000 });
  const file = path.join(dir, 'index.html');
  return { ...r, html: fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '' };
}

test('the repository ships ctm-libs and the ai-feedback forwarder, so the update installs them', () => {
  assert.ok(fs.existsSync(path.join(repo, '_extensions/ctm-libs/lua/ctm.lua')));
  assert.ok(fs.existsSync(path.join(repo, '_extensions/ai-feedback/feedback-quarto.lua')));
});

test('a 1.6 project builds unchanged, with feedback and its settings', { skip }, () => {
  const dir = project();
  try {
    const r = render(dir);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.html, /feedback-core\.js/);
    assert.match(r.html, /enabled: true/);
    assert.match(r.html, /storage: "session"/);
    // The shared settings leave storage to pyodide's feedback-storage.
    const shared = JSON.parse(r.html.match(/window\.__aiFeedbackConfig = (\{.*?\});/)[1]);
    assert.equal(Object.hasOwn(shared, 'storage'), false);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('feedback: false loads nothing of ai-feedback', { skip }, () => {
  const dir = project(undefined, text => text.replace('feedback: true', 'feedback: false'));
  try {
    const r = render(dir);
    assert.equal(r.status, 0, r.stderr);
    assert.doesNotMatch(r.html, /feedback-core\.js/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('copied by hand without ctm-libs, the render names the install command', { skip }, () => {
  const dir = project(['pyodide-interaktiv']);
  try {
    const r = render(dir);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /pyodide-interaktiv needs its library ctm-libs, which is missing next to it\. Install pyodide-interaktiv again: quarto add Erasmus-CTM\/pyodide-interaktiv/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('feedback: false with an activity on the page keeps hidden callouts out of its context', { skip }, () => {
  const dir = project(undefined, text => text.replace('feedback: true', 'feedback: false'));
  try {
    fs.appendFileSync(path.join(dir, 'index.qmd'), '\n::: {.callout-note .ai-feedback-ignore}\nSECRET SOLUTION 42\n:::\n\n::: {.ai-feedback}\nExplain.\n:::\n');
    const r = render(dir);
    assert.equal(r.status, 0, r.stderr);
    const data = [...r.html.matchAll(/class="ai-feedback-data"[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
    assert.ok(data.length > 0, 'activity data present');
    assert.doesNotMatch(data, /SECRET SOLUTION/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// Interactive plots: WebAgg needs Pyodide 0.28+. A 1.6 project pins v0.27.2
// via base-url and must keep its interactive plots, on the 1.6 canvas backend.
const backendOf = html => (html.match(/qpyodideCanvasBackend = "([^"]*)"/) || [])[1];
const indexUrlOf = html => (html.match(/"indexURL": "([^"]*)"/) || [])[1];

test('a 1.6 project pinning Pyodide 0.27.2 keeps interactive plots on the 1.6 canvas backend', { skip }, () => {
  const dir = project();
  try {
    const r = render(dir);
    assert.equal(r.status, 0, r.stderr);
    // `build-variant: full` (as documented) must still give a directory URL.
    assert.equal(indexUrlOf(r.html), 'https://cdn.jsdelivr.net/pyodide/v0.27.2/full/');
    assert.equal(backendOf(r.html), 'html5-canvas');
    // The interactive-plot module is a cacheable file next to the page (D1).
    const plots = r.html.match(/src="([^"]*\/qpyodide-canvas-plots\.js)"/);
    assert.ok(plots, 'qpyodide-canvas-plots.js is loaded');
    assert.match(fs.readFileSync(path.join(dir, plots[1]), 'utf8'), /matplotlib_pyodide\.html5_canvas_backend/);
    // Nothing to fix for the author: no warning about plots.
    assert.doesNotMatch(r.stderr, /interactive plots/i);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('without base-url, plots use WebAgg on Pyodide 0.28.3', { skip }, () => {
  const dir = project(undefined, text => text.replace(/^  base-url:.*\n/m, ''));
  try {
    const r = render(dir);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(indexUrlOf(r.html), 'https://cdn.jsdelivr.net/pyodide/v0.28.3/full/');
    assert.equal(backendOf(r.html), 'webagg');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('a base-url without a version leaves the backend to the loaded Pyodide', { skip }, () => {
  const dir = project(undefined, text => text.replace(/^  base-url:.*$/m, '  base-url: /pyodide/'));
  try {
    const r = render(dir);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(indexUrlOf(r.html), '/pyodide/full/');
    assert.equal(backendOf(r.html), 'auto');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('base-url and build-variant without trailing slashes still give a directory URL', { skip }, () => {
  const dir = project(undefined, text => text.replace('pyodide/v0.27.2/', 'pyodide/v0.27.2'));
  try {
    const r = render(dir);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(indexUrlOf(r.html), 'https://cdn.jsdelivr.net/pyodide/v0.27.2/full/');
    assert.equal(backendOf(r.html), 'html5-canvas');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('build-variant: full/ is kept as it is', { skip }, () => {
  const dir = project(undefined, text => text.replace('build-variant: full', 'build-variant: full/'));
  try {
    const r = render(dir);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(indexUrlOf(r.html), 'https://cdn.jsdelivr.net/pyodide/v0.27.2/full/');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// Projects of pyodide-interaktiv 1.8 keep their ai-feedback 0.8.1 folder after
// updating only when they do not reinstall it (Quarto removes nothing). The
// forwarder this repository ships replaces it on `quarto add`. A stale 0.8.1
// folder that a page lists next to pyodide-interaktiv 1.9 stops the page with
// the migration message, in either filter order (step-3 design §18.4).
// CTM_LEGACY_AI_FEEDBACK: the 0.8.1 extension folder (CI checks it out).
const legacy = process.env.CTM_LEGACY_AI_FEEDBACK;
const skipLegacy = skip || (legacy && fs.existsSync(path.join(legacy, 'feedback-quarto.lua')) ? false : 'Set CTM_LEGACY_AI_FEEDBACK to the ai-feedback 0.8.1 extension folder');

for (const filters of [['Erasmus-CTM/ai-feedback', 'Erasmus-CTM/pyodide-interaktiv'], ['Erasmus-CTM/pyodide-interaktiv', 'Erasmus-CTM/ai-feedback']]) {
  test('a stale ai-feedback 0.8.1 listed next to 1.9 stops with the migration message: ' + filters.join(', '), { skip: skipLegacy }, () => {
    const dir = project(['pyodide-interaktiv', 'ctm-libs'], text => text.replace('  - Erasmus-CTM/pyodide-interaktiv\n', filters.map(f => '  - ' + f + '\n').join('')));
    try {
      fs.cpSync(legacy, path.join(dir, '_extensions/Erasmus-CTM/ai-feedback'), { recursive: true });
      const r = render(dir);
      assert.notEqual(r.status, 0);
      assert.match(r.stderr, /combines filters that use different ai-feedback versions: .*\(0\.8\.1\) and .*\. AI feedback is part of CTM Assessment and of pyodide-interaktiv 1\.9: remove ai-feedback from filters: and delete the old folder\./s);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
}

test('after the update the forwarder replaces the 0.8.1 folder: ai-feedback listed still renders, with one warning', { skip }, () => {
  const dir = project(undefined, text => text.replace('  - Erasmus-CTM/pyodide-interaktiv\n', '  - Erasmus-CTM/ai-feedback\n  - Erasmus-CTM/pyodide-interaktiv\n'));
  try {
    const r = render(dir);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stderr.match(/filters: \[ai-feedback\] is deprecated/g)?.length, 1, r.stderr);
    assert.match(r.html, /feedback-core\.js/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
