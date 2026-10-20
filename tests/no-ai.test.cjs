// Builds without AI feedback (P22; step-3 design §6, E3), on their own
// (`filters: [pyodide-interaktiv]`): ai-feedback: enabled: false or
// CTM_FEEDBACK=off switch Pyodide's feedback off whatever the filter order;
// the cells get none of the AI-only fields (task, feedback-policy,
// feedback-context, the policy selection and context); a cell with
// `#| task:` stays a runnable cell and does not stop the build; an explicit
// pyodide: feedback: true is named once in the build message, which this
// extension prints itself. Needs Quarto.
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
const CELLS = '\n```{pyodide-python}\n#| task: Print two.\n#| feedback-policy: brief\n#| feedback-context: notes\nprint(0)\n```\n\n```{.python}\n# pyodide: task=Print three., feedback-policy=brief\nprint(0)\n```\n';
const AI_ONLY = ['task', 'feedback-policy', 'feedback-context', 'policySelection', 'feedbackContext'];

function project(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pyodide-no-ai-'));
  for (const name of ['pyodide-interaktiv', 'ctm-libs', 'ai-feedback']) fs.cpSync(path.join(repo, '_extensions', name), path.join(dir, '_extensions/Erasmus-CTM', name), { recursive: true });
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), text);
  return dir;
}
function render(dir, env = {}, args = []) {
  const r = spawnSync(quarto, ['render', ...args], { cwd: dir, encoding: 'utf8', timeout: 240000, env: { ...process.env, ...env } });
  return { ...r, stderr: (r.stderr || '').replace(/\x1b\[[0-9;]*m/g, '') };
}
function page(dir, file) {
  const html = fs.readFileSync(path.join(dir, file), 'utf8');
  const script = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(text => text.includes('globalThis.qpyodideCellDetails ='));
  const context = {}; context.globalThis = context;
  vm.runInNewContext(script, context);
  return { html, cells: JSON.parse(JSON.stringify(context.qpyodideCellDetails)), options: { ...context.qpyodideFeedbackOptions } };
}
const QUARTO_YML = 'project:\n  type: default\n  render: [page.qmd]\nfilters: [Erasmus-CTM/pyodide-interaktiv]\nai-feedback:\n  policy-files: policies.yml\n';
const POLICIES = 'ai-feedback:\n  policies:\n    brief:\n      max-words: 40\n';
const messages = stderr => [...stderr.matchAll(/AI feedback is off for this build \((.*?)\); (.*)\.$/gm)].map(m => ({ reason: m[1], items: m[2] }));

test('with AI feedback the cells carry their feedback fields (the reference build)', { skip }, () => {
  const dir = project({ '_quarto.yml': QUARTO_YML, 'policies.yml': POLICIES, 'page.qmd': '---\ntitle: t\n---\n' + CELLS });
  try {
    const r = render(dir);
    assert.equal(r.status, 0, r.stderr);
    const p = page(dir, 'page.html');
    assert.equal(p.options.enabled, true);
    assert.equal(p.cells[0].options.task, 'Print two.');
    assert.equal(p.cells[0].options.policySelection.name, 'brief');
    assert.match(p.html, /qpyodide-feedback\.js/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

for (const [how, env, extra] of [['ai-feedback: enabled: false', {}, '  enabled: false\n'], ['CTM_FEEDBACK=off', { CTM_FEEDBACK: 'off' }, '']]) {
  test('without AI feedback (' + how + '): no feedback, no AI-only fields, the cells still run; the page builds without without-ai', { skip }, () => {
    const dir = project({ '_quarto.yml': QUARTO_YML + extra, 'policies.yml': POLICIES, 'page.qmd': '---\ntitle: t\n---\n' + CELLS });
    try {
      const r = render(dir, env);
      assert.equal(r.status, 0, r.stderr);
      const p = page(dir, 'page.html');
      assert.equal(p.options.enabled, false);
      assert.doesNotMatch(p.html, /qpyodide-feedback\.js|feedback-core\.js|Print two\.|Print three\./);
      assert.equal(p.cells.length, 2);
      for (const cell of p.cells) for (const key of AI_ONLY) assert.equal(key in cell.options, false, key);
      assert.deepEqual(messages(r.stderr), [], 'the default is no request');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
}

test('an unknown policy name fails both builds alike', { skip }, () => {
  const dir = project({ '_quarto.yml': QUARTO_YML, 'policies.yml': POLICIES, 'page.qmd': '---\ntitle: t\n---\n' + CELLS.replace('#| feedback-policy: brief', '#| feedback-policy: nosuch') });
  try {
    for (const env of [{}, { CTM_FEEDBACK: 'off' }]) {
      const r = render(dir, env);
      assert.notEqual(r.status, 0, JSON.stringify(env));
      assert.match(r.stderr, /nosuch/);
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('an explicit pyodide: feedback: true is named once, printed by this extension (any filter order)', { skip }, () => {
  for (const filters of ['[Erasmus-CTM/pyodide-interaktiv]', '[Erasmus-CTM/ai-feedback, Erasmus-CTM/pyodide-interaktiv]', '[Erasmus-CTM/pyodide-interaktiv, Erasmus-CTM/ai-feedback]']) {
    const dir = project({ '_quarto.yml': QUARTO_YML.replace('[Erasmus-CTM/pyodide-interaktiv]', filters), 'policies.yml': POLICIES, 'page.qmd': '---\ntitle: t\npyodide:\n  feedback: true\n---\n' + CELLS });
    try {
      const r = render(dir, { CTM_FEEDBACK: 'off' });
      assert.equal(r.status, 0, r.stderr);
      assert.deepEqual(messages(r.stderr), [{ reason: 'CTM_FEEDBACK=off', items: 'left out on this page: pyodide-interaktiv feedback (pyodide: feedback: true in page.qmd)' }], filters + '\n' + r.stderr);
      assert.equal(page(dir, 'page.html').options.enabled, false, filters);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
});
