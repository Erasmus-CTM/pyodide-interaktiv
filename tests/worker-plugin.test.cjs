// pyodide-interaktiv's part of ctm-libs' worker (qpyodide-worker-plugin.js),
// with a fake Pyodide: runCell's output capture, the input() prompt hook at
// stage 1, and the plot setup at the first cell run (D2): run once, tried
// again only once matplotlib is loaded, and without it no figure collection
// (N4). The worker's queue and stages are ctm-libs' (its tests/worker*.cjs).
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');

function plugin(pyodide) {
  const page = {}; page.globalThis = page;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../_extensions/pyodide-interaktiv/qpyodide-worker-plugin.js'), 'utf8'), page);
  let entries = [], prompt = null, factory = null;
  const posted = [];
  const worker = {registerPlugin: f => { factory = f; }, self: {postMessage: m => posted.push(m)}, console: {warn() {}}};
  vm.runInNewContext(page.QPYODIDE_WORKER_PLUGIN, worker);
  const api = {pyodide: () => pyodide, capture: {start() { entries = []; }, push(e) { entries.push(e); }, entries: () => entries}, setPrompt(p) { prompt = p; }};
  const registered = factory(api);
  return {registered, worker, posted, prompt: () => prompt, stdout: text => entries.push({message: text, type: 'stdout'})};
}
function fakePyodide({setupFails = false} = {}) {
  const ran = [], fake = {loadedPackages: {}, ran};
  fake.loadPackagesFromImports = async () => {};
  fake.runPythonAsync = async code => {
    ran.push(code.startsWith('import matplotlib') ? 'PY_SETUP' : code);
    if (code.startsWith('import matplotlib') && setupFails) throw new Error('No module named matplotlib');
    if (code === 'raise') throw new Error('Traceback: ValueError');
    if (code === '"<b>bold</b>"') return '<b>bold</b>';
    return undefined;
  };
  fake.globals = {get: () => { const f = () => ({toJs: () => [['PNG'], [], [], [], []], destroy() {}}); f.destroy = () => {}; return f; }};
  return fake;
}

test('stage 1: the input() hook sets the prompt through the worker\'s setPrompt', () => {
  const p = plugin(fakePyodide());
  assert.match(p.registered.stage1, /js\._qpyodide_set_prompt\(str\(prompt\)\)/);
  assert.doesNotMatch(p.registered.stage1, /matplotlib/);
  p.worker.self._qpyodide_set_prompt('Name? ');
  assert.equal(p.prompt(), 'Name? ');
});

test('runCell: the plot setup once, at the first run; output, HTML and figures as in 1.8', async () => {
  const py = fakePyodide();
  const p = plugin(py);
  let result = await p.registered.commands.runCell({code: 'print(1)', wantPickle: false});
  assert.deepEqual(py.ran, ['PY_SETUP', 'print(1)']);
  assert.deepEqual([...result.images], ['PNG']);
  result = await p.registered.commands.runCell({code: '"<b>bold</b>"'});
  assert.equal(result.html, '<b>bold</b>');
  assert.deepEqual(py.ran.filter(c => c === 'PY_SETUP'), ['PY_SETUP']);
  result = await p.registered.commands.runCell({code: 'raise'});
  assert.deepEqual(result.entries.map(e => e.type), ['stderr']);
  assert.deepEqual(JSON.parse(JSON.stringify(p.posted)), [{type: 'streamStderr', text: 'Error: Traceback: ValueError'}]);
});

test('a failed plot setup: cells run without figure collection, and it is tried again once matplotlib is there (N4)', async () => {
  const py = fakePyodide({setupFails: true});
  const p = plugin(py);
  let result = await p.registered.commands.runCell({code: 'print(1)'});
  assert.deepEqual([...result.entries], []);
  assert.deepEqual([...result.images], []);
  await p.registered.commands.runCell({code: 'print(2)'});
  assert.deepEqual(py.ran, ['PY_SETUP', 'print(1)', 'print(2)'], 'not tried again without matplotlib');
  py.loadedPackages.matplotlib = 'default channel';
  await p.registered.commands.runCell({code: 'print(3)'});
  assert.deepEqual(py.ran.slice(-2), ['PY_SETUP', 'print(3)']);
});
