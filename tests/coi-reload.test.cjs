// The check reload for cross-origin isolation happens once per tab
// (qpyodide-document-status.js, with coi-serviceworker.js from ctm-libs).
//
// coi-serviceworker.js stops the check when the reload "did not help" by the
// navigation type "reload". WebKit reports a reload by location.reload() as
// "navigate" (Playwright's WebKit in the umbrella's first-visit comparison),
// so the worker registered again, said "ready" again, and the page reloaded
// again, every two seconds, restarting everything on the page each time (set
// review S10: ctm-nav's deep-link load never settled in the browser
// comparison). A page that reloaded a moment ago and is still not isolated
// now concludes by itself that input() is unavailable, unless the worker does
// not control it (a hard reload), and the conclusion expires after 24 hours
// (review S11, S12).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM, VirtualConsole} = require('jsdom');

const script = fs.readFileSync(path.join(__dirname, '../_extensions/pyodide-interaktiv/qpyodide-document-status.js'), 'utf8');
const ORIGIN = 'https://course.invalid';
const tick = () => new Promise(resolve => setImmediate(resolve));

// One page load, as the browser would run it: `session` and `local` are the
// tab's and the origin's storage from the loads before, `outcome` what
// coi-serviceworker.js has said by then. A reload is counted as jsdom's
// "not implemented: navigation".
async function load({session = {}, local = {}, outcome = 'ready', isolated = false, controlled = true, initialUI = Promise.resolve(), timers} = {}) {
  const reloads = [], errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => { if (/navigation/.test(error.message)) reloads.push(error.message); });
  const dom = new JSDOM('<header id="title-block-header"></header><main></main>', {url: ORIGIN + '/page.html', runScripts: 'outside-only', virtualConsole});
  const w = dom.window;
  w.console = {log() {}, warn() {}, error(...args) { errors.push(args); }, info() {}};
  w.crossOriginIsolated = isolated;
  w.MathExerciseRuntime = {whenInitialUIReady: () => initialUI};
  if (timers) { w.setTimeout = (fn, ms) => { timers.push({fn, ms}); return timers.length; }; w.clearTimeout = () => {}; }
  // jsdom has no service workers: `controlled` is navigator.serviceWorker.controller (null after a hard reload).
  Object.defineProperty(w.navigator, 'serviceWorker', {value: {controller: controlled ? {} : null}, configurable: true});
  // The settings script's globals the module reads (qpyodide-document-settings.js).
  Object.assign(w, {qpyodideShowStartupMessage: false, qpyodideLang: 'en', qpyodideCellDetails: []});
  for (const [key, value] of Object.entries(session)) w.sessionStorage.setItem(key, value);
  for (const [key, value] of Object.entries(local)) w.localStorage.setItem(key, value);
  if (outcome) w.qpyodideCoiOutcome = outcome;
  const states = [];
  w.addEventListener('qpyodide-input-state', event => states.push(event.detail));
  w.eval(script);
  await tick();
  const dump = storage => Object.fromEntries(Array.from({length: storage.length}, (_, i) => [storage.key(i), storage.getItem(storage.key(i))]));
  return {w, reloads, states, errors, session: () => dump(w.sessionStorage), local: () => dump(w.localStorage), state: () => w.qpyodideInputState};
}
// The tab after a reload: its session storage stays, except the flag that
// coi-serviceworker.js reads and removes first thing.
const afterReload = page => { const {['qpyodide-coi-reload-pending']: flag, ...rest} = page.session(); assert.equal(flag, '1'); return rest; };

test('the first load that is ready and not isolated reloads once, and records it', async () => {
  const first = await load();
  assert.equal(first.reloads.length, 1);
  assert.equal(first.session()['qpyodide-coi-reload-pending'], '1');
  assert.ok(Number(first.session()['qpyodide-coi-reload-sent']) > Date.now() - 5000);
  assert.equal(first.state(), 'check');
});

test('a reload that reports navigation type "navigate" is not repeated: input() is unavailable, for 24 hours', async () => {
  const first = await load();
  // coi-serviceworker.js does not recognise the reload (type "navigate"): it registers again and says "ready" again.
  const second = await load({session: afterReload(first)});
  assert.equal(second.reloads.length, 0, 'the page reloaded a second time (an endless reload every two seconds in WebKit)');
  assert.equal(second.state(), 'unavailable');
  assert.ok(Number(second.local()['qpyodide-coi-check-failed']) > Date.now() - 5000);
  // The permanent verdict of coi-serviceworker.js is not written by this page.
  assert.equal(second.local()['qpyodide-coi-unavailable-' + ORIGIN], undefined);
});

test('after the verdict a third load of the tab does not reload either', async () => {
  const first = await load();
  const second = await load({session: afterReload(first)});
  const third = await load({session: second.session(), local: second.local()});
  assert.equal(third.reloads.length, 0);
});

test('a reload long ago is no reason to stop: a stale record reloads again', async () => {
  const first = await load({session: {'qpyodide-coi-reload-sent': String(Date.now() - 10 * 60 * 1000)}});
  assert.equal(first.reloads.length, 1);
});

test('an isolated page does not reload, and a user who is typing keeps the page', async () => {
  assert.equal((await load({isolated: true, session: {'qpyodide-coi-reload-sent': String(Date.now())}})).reloads.length, 0);
  const typing = await load({outcome: ''});
  typing.w.dispatchEvent(new typing.w.Event('keydown'));
  typing.w.dispatchEvent(new typing.w.CustomEvent('coi-sw-ready'));
  await tick();
  assert.equal(typing.reloads.length, 0);
  assert.equal(typing.state(), 'needs-reload');
});

test('waiting for the event: ready arrives later and the page reloads once', async () => {
  const page = await load({outcome: ''});
  assert.equal(page.reloads.length, 0);
  page.w.dispatchEvent(new page.w.CustomEvent('coi-sw-ready'));
  await tick();
  assert.equal(page.reloads.length, 1);
});

const HOUR = 60 * 60 * 1000;

test('S11: a hard reload (no worker controls the page) is not the failed check: it reloads once more, never more than twice', async () => {
  const first = await load({controlled: false});
  assert.equal(first.reloads.length, 1);
  // Ctrl+Shift+R within two minutes: ready, not isolated, and the worker does not control the page.
  const hard = await load({session: afterReload(first), controlled: false});
  assert.equal(hard.reloads.length, 1, 'the hard reload was taken for the failed check');
  assert.equal(hard.state(), 'check');
  assert.equal(hard.local()['qpyodide-coi-check-failed'], undefined);
  assert.equal(hard.session()['qpyodide-coi-reload-count'], '2');
  // Now controlled and still not isolated: that is the failed check.
  const third = await load({session: afterReload(hard), controlled: true});
  assert.equal(third.reloads.length, 0);
  assert.equal(third.state(), 'unavailable');
  // A second hard reload does not make a loop either: at most two reloads in the two minutes.
  const hardAgain = await load({session: afterReload(hard), controlled: false});
  assert.equal(hardAgain.reloads.length, 0);
  assert.equal(hardAgain.state(), 'unavailable');
});

test('S12: the conclusion expires after 24 hours; until then a new tab does not check again', async () => {
  const failed = Date.now() - 23 * HOUR;
  const fresh = await load({local: {'qpyodide-coi-check-failed': String(failed)}});
  assert.equal(fresh.reloads.length, 0);
  assert.equal(fresh.state(), 'unavailable');
  const expired = await load({local: {'qpyodide-coi-check-failed': String(Date.now() - 25 * HOUR)}});
  assert.equal(expired.reloads.length, 1, 'a failure from yesterday still switches input() off');
  assert.equal(expired.state(), 'check');
  // ... and the check after the expiry is one reload again, then concludes again.
  const again = await load({session: afterReload(expired), local: expired.local()});
  assert.equal(again.reloads.length, 0);
  assert.ok(Number(again.local()['qpyodide-coi-check-failed']) > Date.now() - 5000);
});

test('S12: an isolated page (server headers, exam build) deletes an earlier conclusion', async () => {
  const page = await load({isolated: true, local: {'qpyodide-coi-check-failed': String(Date.now())}});
  assert.equal(page.reloads.length, 0);
  assert.equal(page.local()['qpyodide-coi-check-failed'], undefined);
});

test('blocked storage: the check reloads once and does not throw', async () => {
  const page = await load({outcome: ''});
  for (const kind of ['sessionStorage', 'localStorage']) {
    Object.defineProperty(page.w, kind, {get() { throw new Error('blocked'); }, configurable: true});
  }
  page.w.dispatchEvent(new page.w.CustomEvent('coi-sw-ready'));
  await tick();
  assert.equal(page.reloads.length, 1);
});

const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => {resolve=a; reject=b;}); return {promise, resolve, reject}; };
test('pending UI prevents reload and Python release; duplicate ready events commit exactly once', async()=>{
  const ui=deferred(), p=await load({initialUI:ui.promise});
  assert.equal(p.reloads.length,0); assert.equal(p.w.qpyodideCoiCanStart,undefined);
  p.w.dispatchEvent(new p.w.Event('coi-sw-ready')); p.w.dispatchEvent(new p.w.Event('coi-sw-ready'));
  ui.resolve(); await tick(); assert.equal(p.reloads.length,1);
  assert.equal(p.session()['qpyodide-coi-reload-count'],'1');
  assert.equal(p.w.qpyodideCoiCanStart,undefined,'old document never starts Python'); p.w.close();
});
test('interaction while UI waits releases the current page without writing any reload flags', async()=>{
  const ui=deferred(), p=await load({initialUI:ui.promise});
  p.w.dispatchEvent(new p.w.Event('input')); await p.w.qpyodideCoiSettled;
  ui.resolve(); await tick(); p.w.dispatchEvent(new p.w.Event('coi-sw-ready')); await tick();
  assert.equal(p.reloads.length,0); assert.deepEqual(p.session(),{}); assert.equal(p.state(),'needs-reload'); p.w.close();
});
test('deadline keeps the page usable and late readiness or duplicate ready cannot reload it', async()=>{
  const ui=deferred(), timers=[], p=await load({initialUI:ui.promise,timers});
  const deadline=timers.find(t=>t.ms===30000); assert.ok(deadline); deadline.fn();
  await p.w.qpyodideCoiSettled; ui.resolve(); await tick();
  p.w.dispatchEvent(new p.w.Event('coi-sw-ready')); await tick();
  assert.equal(p.reloads.length,0); assert.deepEqual(p.session(),{}); assert.equal(p.state(),'needs-reload'); p.w.close();
});
test('failed UI is retained visibly and cancels automatic reload', async()=>{
  const ui=deferred(), p=await load({initialUI:ui.promise}), error=new Error('module failure');
  ui.reject(error); await tick(); await p.w.qpyodideCoiSettled;
  assert.equal(p.errors.length,1); assert.equal(p.errors[0][1],error);
  assert.equal(p.state(),'needs-reload'); assert.equal(p.reloads.length,0); assert.deepEqual(p.session(),{}); p.w.close();
});
test('recent reload limits are rechecked after UI settles', async()=>{
  const ui=deferred(), p=await load({initialUI:ui.promise});
  p.w.sessionStorage.setItem('qpyodide-coi-reload-sent',String(Date.now()));
  p.w.sessionStorage.setItem('qpyodide-coi-reload-count','1');
  ui.resolve(); await tick(); assert.equal(p.reloads.length,0); assert.equal(p.state(),'unavailable');
  assert.equal(p.session()['qpyodide-coi-reload-pending'],undefined); p.w.close();
});
test('already isolated and unavailable outcomes never wait for initial UI', async()=>{
  const ui=deferred();
  for (const options of [{isolated:true},{outcome:'unavailable'}]) {
    const p=await load({...options,initialUI:ui.promise}); await p.w.qpyodideCoiSettled;
    assert.equal(p.w.qpyodideCoiCanStart,true); assert.equal(p.reloads.length,0); p.w.close();
  }
});
