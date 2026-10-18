// The interactive-plot instance picks its Matplotlib backend from the Pyodide
// that actually loaded: WebAgg needs Pyodide 0.28+, so a project pinning an
// older Pyodide (e.g. 1.6's v0.27.2) keeps the 1.6/1.7 html5_canvas_backend.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const file = path.join(__dirname, '../_extensions/pyodide-interaktiv/qpyodide-canvas-plots.js');
const IMPORT = 'await import(indexURL + "pyodide.mjs")';

// Load the module with a fake Pyodide of the given version; return the
// Python setup it runs and the state it ends in.
async function boot(version, configured) {
  const source = fs.readFileSync(file, 'utf8');
  assert.ok(source.includes(IMPORT), 'the engine still imports pyodide.mjs');
  const ran = [];
  const ctx = vm.createContext({
    console: { log() {}, debug() {}, warn() {}, error() {} },
    performance: { now: () => 0 },
    QP_L: { canvasBarValueLabel: 'Value' },
    qpyodideCanvasBackend: configured,
    qpyodideCustomizedPyodideOptions: { indexURL: 'https://example.invalid/pyodide/', env: {} },
    __importPyodide: async () => ({
      loadPyodide: async () => ({
        version,
        loadPackage: async () => {},
        runPythonAsync: async code => { ran.push(code); }
      })
    })
  });
  ctx.globalThis = ctx;
  vm.runInContext(source.replace(IMPORT, 'await __importPyodide(indexURL + "pyodide.mjs")'), ctx);
  await vm.runInContext('qpyodideCanvasEngine()', ctx);
  return { setup: ran.join('\n'), state: ctx.qpyodideCanvasPlots };
}

for (const [version, configured] of [['0.27.2', 'html5-canvas'], ['0.27.2', 'auto'], ['0.26.4', 'auto']]) {
  test(`Pyodide ${version} (page setting ${configured}) keeps the 1.6 canvas backend`, async () => {
    const { setup, state } = await boot(version, configured);
    assert.equal(state.backend, 'html5-canvas');
    assert.equal(state.status, 'ready');
    assert.match(setup, /matplotlib\.use\('module:\/\/matplotlib_pyodide\.html5_canvas_backend', force=True\)/);
    assert.match(setup, /_qpc_wire_events\(fig\.canvas\)/);
    assert.doesNotMatch(setup, /webagg/i);
  });
}

for (const [version, configured] of [['0.28.3', 'webagg'], ['0.28.3', 'auto'], ['0.29.0', 'auto'], ['314.0.0', 'auto']]) {
  test(`Pyodide ${version} (page setting ${configured}) uses WebAgg`, async () => {
    const { setup, state } = await boot(version, configured);
    assert.equal(state.backend, 'webagg');
    assert.match(setup, /matplotlib\.use\('webagg', force=True\)/);
    assert.doesNotMatch(setup, /matplotlib_pyodide/);
  });
}

test('the loaded version wins over the page setting', async () => {
  assert.equal((await boot('0.27.2', 'webagg')).state.backend, 'html5-canvas');
  assert.equal((await boot('0.28.3', 'html5-canvas')).state.backend, 'webagg');
});

test('without a readable version, the page setting decides', async () => {
  assert.equal((await boot(undefined, 'html5-canvas')).state.backend, 'html5-canvas');
  assert.equal((await boot(undefined, 'auto')).state.backend, 'webagg');
});
