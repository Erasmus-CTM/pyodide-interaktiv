// The page's readiness with ctm-libs' real CTMWorker and a fake Worker
// (step-3 design §18.5, D2): Run buttons, the status line and the startup
// cells follow the second stage; a failed second stage offers Retry and the
// cells run without it; MPLBACKEND reaches the worker; a restart during the
// second stage ends a waiting run (B1); after a restart Run waits for the new
// start, and an interrupted startup run does not go on in the new worker (S3);
// a restart during Retry is no failure.
// The same in a browser with real Pyodide: ctm-libs' tests/browser/worker.mjs
// (the worker) and the umbrella's browser gate (the page).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM} = require('jsdom');
const ext = path.join(__dirname, '../_extensions/pyodide-interaktiv');
const libs = process.env.CTM_LIBS_EXTENSION || path.join(__dirname, '../_extensions/ctm-libs');
const tick = () => new Promise(resolve => setImmediate(resolve));
const settle = async (promise, ms = 200) => Promise.race([promise.then(() => 'resolved', error => error),
  new Promise(resolve => setTimeout(() => resolve('pending'), ms))]);

const CELLS = [
  {id: 1, code: 'print(6 * 7)', options: {context: 'interactive'}},
  {id: 2, code: 'print("OUT", SETUP_VALUE)', options: {context: 'output'}},
  {id: 3, code: 'SETUP_VALUE = 5', options: {context: 'setup'}},
  {id: 4, code: 'print("LATER")', options: {context: 'output'}},
];

// A page as qpyodide.lua writes it: the settings, ctm-libs' catalogue and
// worker, then this extension's modules in their order.
function page({cells = CELLS, isolated = false} = {}) {
  const dom = new JSDOM('<header id="title-block-header"></header><main>'
    + cells.map(cell => `<div id="qpyodide-insertion-location-${cell.id}"></div>`).join('') + '</main>',
  {url: 'https://course.invalid/page.html', runScripts: 'outside-only'});
  const w = dom.window;
  const workers = [];
  class FakeWorker {
    constructor(url, options) { this.options = options; this.posted = []; this.terminated = false; workers.push(this); }
    postMessage(message) { this.posted.push(message); }
    terminate() { this.terminated = true; }
    reply(data) { this.onmessage({data}); }
    // Answers the n-th command of a type (default: the last one).
    answer(type, value = true, n = -1) {
      const message = this.posted.filter(m => m.type === type).at(n);
      assert.ok(message, 'no ' + type + ' was sent');
      this.reply({type: 'result', id: message.id, value});
    }
  }
  w.Worker = FakeWorker;
  w.URL.createObjectURL = () => 'blob:worker';
  w.URL.revokeObjectURL = () => {};
  w.crossOriginIsolated = isolated;
  w.console = {log() {}, warn() {}, error() {}, info() {}};
  // The settings script (qpyodide-document-settings.js, rendered).
  Object.assign(w, {
    qpyodideInstallPythonPackagesList: [''], qpyodideSetupPythonPackages: false, qpyodideShowStartupMessage: true,
    qpyodideCustomizedPyodideOptions: {indexURL: 'https://cdn.example/pyodide/v0.28.3/full/', env: {HOME: '/home/pyodide'}},
    qpyodideCanvasBackend: 'webagg', qpyodideLang: 'en', qpyodideCellDetails: cells,
    qpyodideFeedbackOptions: {enabled: false, storage: 'session', hints: true, uiLanguage: 'en'},
    qpyodideLocalStorageOptions: {enabled: false, epoch: ''},
  });
  for (const file of ['locales/ctm-locale.js', 'locales/common.js', 'locales/pyodide-interaktiv.js', 'locales/ui.js', 'ui/ctm-copy.js', 'runtime/pyodide-worker.js']) w.eval(fs.readFileSync(path.join(libs, file), 'utf8'));
  for (const file of ['qpyodide-locale.js', 'qpyodide-document-status.js', 'qpyodide-worker-plugin.js', 'qpyodide-document-engine-initialization.js']) w.eval(fs.readFileSync(path.join(ext, file), 'utf8'));
  w.eval(fs.readFileSync(path.join(ext, 'qpyodide-cell-classes.js'), 'utf8') + '\nglobalThis.EditorUnitForTests = EditorUnit;');
  // Everything but Monaco's editor is the real code.
  w.EditorUnitForTests.prototype.initMonaco = function () {
    let code = this.code;
    this.editor = {getValue: () => code, setValue: value => { code = value; }, __qpyodideinitialCode: code};
  };
  w.eval(fs.readFileSync(path.join(ext, 'qpyodide-cell-initialization.js'), 'utf8'));
  const runButtons = () => [...w.document.querySelectorAll('.qpyodide-button-run')];
  const status = () => w.document.getElementById('qpyodide-status-message-text').textContent.trim();
  const runCells = worker => worker.posted.filter(m => m.type === 'runCell').map(m => m.code);
  // Stage 1 of worker n: the answer to init.
  const stage1 = async n => { workers[n].answer('init'); await tick(); await tick(); };
  return {w, workers, runButtons, status, runCells, stage1, units: () => w.qpyodideCellContainer.cells};
}
// Answers every runCell a worker has been sent and not yet answered.
function answerRuns(worker, answered = new Set()) {
  for (const message of worker.posted.filter(m => m.type === 'runCell' && !answered.has(m.id))) {
    answered.add(message.id);
    worker.reply({type: 'result', id: message.id, value: {entries: [{type: 'stdout', message: 'ran ' + message.code}], images: []}});
  }
  return answered;
}
async function drain(worker, rounds = 8) {
  const answered = new Set();
  for (let i = 0; i < rounds; i++) { answerRuns(worker, answered); await tick(); }
}

test('the ready state follows stage 2: Run, the status line and the startup cells; MPLBACKEND reaches the worker', async () => {
  const p = page();
  const [worker] = p.workers;
  const init = worker.posted.find(m => m.type === 'init');
  assert.deepEqual({...init.config.env}, {HOME: '/home/pyodide', MPLBACKEND: 'AGG'});
  assert.deepEqual([...init.config.background.packages], ['pyodide_http', 'micropip', 'matplotlib']);
  await p.stage1(0);
  // Stage 1 done: other components' checks may run, this extension's cells not yet.
  assert.ok(p.w.mainPyodide, 'the proxy is published after stage 1');
  assert.equal(p.w.qpyodideCellsReady, false);
  assert.ok(p.runButtons().every(button => button.disabled), 'Run waits for stage 2');
  assert.deepEqual(p.runCells(worker), [], 'no startup cell before stage 2');
  let ready = 0;
  p.w.addEventListener('qpyodide-cells-ready', () => ready++);
  worker.reply({type: 'setup', ok: true});
  await tick();
  assert.equal(p.w.qpyodideCellsReady, true);
  assert.equal(ready, 1);
  assert.equal(p.status(), p.w.QP_L.engineReady);
  assert.ok(p.runButtons().every(button => !button.disabled));
  await drain(worker);
  assert.deepEqual(p.runCells(worker), ['SETUP_VALUE = 5', 'print("OUT", SETUP_VALUE)', 'print("LATER")'], 'setup cells first, once');
  p.w.close();
});

test('a failed stage 2: the status line names the effect and offers Retry; the cells run; Retry asks the worker again', async () => {
  const p = page();
  const [worker] = p.workers;
  await p.stage1(0);
  worker.reply({type: 'setup', ok: false, message: 'matplotlib: HTTP 404'});
  await tick();
  assert.equal(p.w.qpyodideCellsReady, true, 'cells run without the extra packages');
  assert.ok(p.runButtons().every(button => !button.disabled));
  const failed = p.w.QP_L.setupFailed('matplotlib: HTTP 404');
  assert.equal(p.status(), failed + ' ' + p.w.QP_L.setupRetry);
  await drain(worker);
  assert.equal(p.runCells(worker).length, 3, 'the startup cells ran');
  const retry = p.w.document.querySelector('.qpyodide-button-retry');
  assert.ok(retry, 'a Retry button');
  retry.click();
  assert.equal(worker.posted.at(-1).type, 'setupRetry');
  assert.equal(p.status(), p.w.QP_L.workerInitPackages);
  worker.reply({type: 'setup', ok: false, message: 'again'});
  await tick();
  assert.equal(p.status(), p.w.QP_L.setupFailed('again') + ' ' + p.w.QP_L.setupRetry, 'a second failure offers Retry again');
  p.w.document.querySelector('.qpyodide-button-retry').click();
  worker.reply({type: 'setup', ok: true});
  await tick();
  assert.equal(p.status(), p.w.QP_L.engineReady);
  p.w.close();
});

test('B1: Stop on a run that waits for stage 2 ends it; the next start\'s Run works', async () => {
  const p = page({cells: [CELLS[0], {id: 5, code: 'print(1)', options: {context: 'interactive'}}]});
  await p.stage1(0);
  // A run during stage 2 (the button is disabled; a run from code, as a
  // startup cell or an older page would do) waits for stage 2.
  const [unit] = p.units()[0].units;
  const run = unit.runCode(unit.getCode());
  await tick();
  assert.equal(unit.runButton.textContent.trim(), 'Stop');
  assert.deepEqual(p.runCells(p.workers[0]), []);
  unit.runButton.click();                       // Stop without isolation: a restart
  const text = await Promise.race([run, new Promise(resolve => setTimeout(() => resolve('still waiting'), 500))]);
  assert.equal(text, p.w.QP_L.abortedRestart, 'the run ends with the restart');
  assert.match(unit.outputCodeDiv.textContent, /Python was restarted/);
  assert.equal(p.workers.length, 2);
  assert.equal(p.workers[0].posted.filter(m => m.type === 'runCell').length, 0, 'nothing sent to the old worker');
  // The second start: Run waits for its stage 2, then works.
  assert.ok(p.runButtons().every(button => button.disabled), 'Run waits for the new start');
  await p.stage1(1);
  assert.ok(p.runButtons().every(button => button.disabled), 'Run waits for the new stage 2');
  p.workers[1].reply({type: 'setup', ok: true});
  await tick();
  assert.ok(p.runButtons().every(button => !button.disabled));
  p.runButtons()[1].click();
  await tick(); await tick();
  assert.deepEqual(p.runCells(p.workers[1]), ['print(1)'], 'a click reaches the new worker');
  p.w.close();
});

test('S3: after a restart Run stays disabled until the new start is ready, also when a running cell ends', async () => {
  const p = page({cells: [CELLS[0], {id: 5, code: 'while True: pass', options: {context: 'interactive'}}]});
  await p.stage1(0);
  p.workers[0].reply({type: 'setup', ok: true});
  await tick();
  // A check's stop() restarts the worker while no cell runs.
  p.w.mainPyodide.restart('Stopped by a check.');
  await tick();
  assert.equal(p.w.qpyodideCellsReady, false);
  assert.ok(p.runButtons().every(button => button.disabled), 'disabled after a restart');
  await p.stage1(1);
  p.workers[1].reply({type: 'setup', ok: true});
  await tick();
  assert.ok(p.runButtons().every(button => !button.disabled));
  // Stop on a running cell: its run ends, and the buttons wait for the third start.
  const [, cell] = p.units();
  const unit = cell.units[0];
  const run = unit.runCode(unit.getCode());
  await tick(); await tick();
  assert.deepEqual(p.runCells(p.workers[1]).at(-1), 'while True: pass');
  unit.runButton.click();
  await run;
  assert.ok(p.runButtons().every(button => button.disabled), 'the ended run does not enable Run before the new start');
  assert.equal(unit.runButton.textContent.trim(), p.w.QP_L.runLoading);
  await p.stage1(2);
  p.workers[2].reply({type: 'setup', ok: true});
  await tick();
  assert.ok(p.runButtons().every(button => !button.disabled));
  assert.equal(p.status(), p.w.QP_L.engineReady);
  p.w.close();
});

test('S3: a restart during the startup cells stops that run; the new start runs them from the setup cells on, once', async () => {
  const p = page();
  await p.stage1(0);
  p.workers[0].reply({type: 'setup', ok: true});
  await tick(); await tick();
  // The setup cell is answered; the first output cell is running.
  p.workers[0].answer('runCell', {entries: [], images: []}, 0);
  await tick(); await tick(); await tick();
  assert.deepEqual(p.runCells(p.workers[0]), ['SETUP_VALUE = 5', 'print("OUT", SETUP_VALUE)']);
  p.w.mainPyodide.restart('Stopped by a check.');
  await tick(); await tick();
  assert.deepEqual(p.runCells(p.workers[1]), [], 'the old startup run does not go on in the new worker');
  await p.stage1(1);
  assert.deepEqual(p.runCells(p.workers[1]), [], 'nor before the new stage 2');
  p.workers[1].reply({type: 'setup', ok: true});
  await drain(p.workers[1]);
  assert.deepEqual(p.runCells(p.workers[1]), ['SETUP_VALUE = 5', 'print("OUT", SETUP_VALUE)', 'print("LATER")']);
  assert.equal(p.status(), p.w.QP_L.engineReady);
  p.w.close();
});

test('a restart before stage 2 ends: no failure in the status line, and the startup cells run once, for the new start', async () => {
  const p = page();
  await p.stage1(0);
  p.w.mainPyodide.restart('Stopped by a check.');
  await tick(); await tick();
  assert.doesNotMatch(p.status(), /🟠|🔴/, 'a restart is no failure: ' + p.status());
  assert.equal(p.w.document.querySelector('.qpyodide-button-retry'), null);
  await p.stage1(1);
  p.workers[1].reply({type: 'setup', ok: true});
  await drain(p.workers[1]);
  assert.deepEqual(p.runCells(p.workers[1]), ['SETUP_VALUE = 5', 'print("OUT", SETUP_VALUE)', 'print("LATER")'], 'once');
  assert.deepEqual(p.runCells(p.workers[0]), []);
  p.w.close();
});

test('S3: a restart during an autorun cell stops the startup run after it; the new start runs every startup cell in order', async () => {
  // runCode ends without throwing when the restart rejects its call, so the
  // old startup run must notice the restart itself.
  const p = page({cells: [
    {id: 1, code: 'SETUP_VALUE = 5', options: {context: 'setup'}},
    {id: 2, code: 'print("A")', options: {context: 'interactive', autorun: 'true'}},
    {id: 3, code: 'print("B")', options: {context: 'interactive', autorun: 'true'}},
  ]});
  await p.stage1(0);
  p.workers[0].reply({type: 'setup', ok: true});
  await tick(); await tick();
  p.workers[0].answer('runCell', {entries: [], images: []}, 0);
  for (let i = 0; i < 4; i++) await tick();
  assert.deepEqual(p.runCells(p.workers[0]), ['SETUP_VALUE = 5', 'print("A")']);
  p.w.mainPyodide.restart('Stopped by a check.');
  for (let i = 0; i < 4; i++) await tick();
  await p.stage1(1);
  p.workers[1].reply({type: 'setup', ok: true});
  await drain(p.workers[1], 12);
  assert.deepEqual(p.runCells(p.workers[1]), ['SETUP_VALUE = 5', 'print("A")', 'print("B")']);
  assert.ok(p.runButtons().every(button => !button.disabled), 'Run is free again');
  p.w.close();
});

test('a restart during Retry is no failure: no orange text, no Retry; the new start becomes ready', async () => {
  const p = page();
  await p.stage1(0);
  p.workers[0].reply({type: 'setup', ok: false, message: 'matplotlib: HTTP 404'});
  await tick();
  p.w.document.querySelector('.qpyodide-button-retry').click();
  assert.equal(p.workers[0].posted.at(-1).type, 'setupRetry');
  assert.equal(p.status(), p.w.QP_L.workerInitPackages);
  // A check's stop() while Retry is under way: the retried stage 2 rejects
  // with error.restarted.
  p.w.mainPyodide.restart('Stopped by a check.');
  for (let i = 0; i < 4; i++) await tick();
  assert.doesNotMatch(p.status(), /🟠|🔴/, 'a restart is no failure: ' + p.status());
  assert.equal(p.w.document.querySelector('.qpyodide-button-retry'), null, 'no Retry');
  assert.ok(p.runButtons().every(button => button.disabled), 'Run waits for the new start');
  await p.stage1(1);
  p.workers[1].reply({type: 'setup', ok: true});
  await tick();
  assert.equal(p.status(), p.w.QP_L.engineReady);
  assert.ok(p.runButtons().every(button => !button.disabled));
  p.w.close();
});

test('B1 (set review): a Run clicked as soon as Run is enabled waits for the setup cells; it says so meanwhile', async () => {
  // Two setup cells, the second defines what the interactive cell uses.
  const p = page({cells: [
    {id: 1, code: 'A = 1', options: {context: 'setup'}},
    {id: 2, code: 'B = A + 1', options: {context: 'setup'}},
    {id: 3, code: 'print(B)', options: {context: 'interactive'}},
  ]});
  await p.stage1(0);
  p.workers[0].reply({type: 'setup', ok: true});
  await tick(); await tick();
  assert.deepEqual(p.runCells(p.workers[0]), ['A = 1'], 'the first setup cell runs');
  const button = p.runButtons()[0];
  assert.equal(button.disabled, false, 'Run is enabled with the cells');
  assert.equal(p.w.qpyodideStartupPhaseDone, false);
  button.click();
  for (let i = 0; i < 4; i++) await tick();
  assert.deepEqual(p.runCells(p.workers[0]), ['A = 1'], 'the Run waits: nothing between the setup cells');
  assert.equal(button.textContent.trim(), p.w.QP_L.runLoading.replace(/<[^>]*>/g, '').trim(), 'the button says it waits');
  p.workers[0].answer('runCell', {entries: [], images: []}, 0);
  for (let i = 0; i < 4; i++) await tick();
  assert.deepEqual(p.runCells(p.workers[0]), ['A = 1', 'B = A + 1']);
  p.workers[0].answer('runCell', {entries: [], images: []}, 1);
  for (let i = 0; i < 6; i++) await tick();
  assert.deepEqual(p.runCells(p.workers[0]), ['A = 1', 'B = A + 1', 'print(B)'], 'then the Run');
  assert.equal(p.w.qpyodideStartupPhaseDone, true);
  p.workers[0].answer('runCell', {entries: [{type: 'stdout', message: '2'}], images: []}, 2);
  for (let i = 0; i < 4; i++) await tick();
  assert.ok(p.runButtons().every(b => !b.disabled), 'Run is free again');
  p.w.close();
});

test('S9 (set review): Runs clicked on two cells during the setup cells both run after them, in click order; each button shows it waits', async () => {
  const p = page({cells: [
    {id: 1, code: 'A = 1', options: {context: 'setup'}},
    {id: 2, code: 'B = A + 1', options: {context: 'setup'}},
    {id: 3, code: 'print("first", B)', options: {context: 'interactive'}},
    {id: 4, code: 'print("second", B)', options: {context: 'interactive'}},
  ]});
  await p.stage1(0);
  p.workers[0].reply({type: 'setup', ok: true});
  await tick(); await tick();
  const [first, second] = p.runButtons();
  // The second cell is clicked first: click order, not page order.
  second.click();
  await tick();
  first.click();
  await tick();
  const waiting = p.w.QP_L.runLoading.replace(/<[^>]*>/g, '').trim();
  assert.deepEqual([first.textContent.trim(), second.textContent.trim()], [waiting, waiting], 'both buttons say they wait');
  assert.ok(first.disabled && second.disabled);
  const answered = new Set();
  for (let round = 0; round < 12; round++) { answerRuns(p.workers[0], answered); for (let i = 0; i < 4; i++) await tick(); }
  assert.deepEqual(p.runCells(p.workers[0]), ['A = 1', 'B = A + 1', 'print("second", B)', 'print("first", B)'], 'no click is lost');
  assert.ok(p.runButtons().every(b => !b.disabled && b.textContent.trim() !== waiting), 'Run is free again');
  p.w.close();
});
