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
// now concludes by itself that input() is unavailable.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM, VirtualConsole} = require('jsdom');

const script = fs.readFileSync(path.join(__dirname, '../_extensions/pyodide-interaktiv/qpyodide-document-status.js'), 'utf8');
const ORIGIN = 'https://course.invalid';

// One page load, as the browser would run it: `session` and `local` are the
// tab's and the origin's storage from the loads before, `outcome` what
// coi-serviceworker.js has said by then. A reload is counted as jsdom's
// "not implemented: navigation".
function load({session = {}, local = {}, outcome = 'ready', isolated = false} = {}) {
  const reloads = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => { if (/navigation/.test(error.message)) reloads.push(error.message); });
  const dom = new JSDOM('<header id="title-block-header"></header><main></main>', {url: ORIGIN + '/page.html', runScripts: 'outside-only', virtualConsole});
  const w = dom.window;
  w.console = {log() {}, warn() {}, error() {}, info() {}};
  w.crossOriginIsolated = isolated;
  // The settings script's globals the module reads (qpyodide-document-settings.js).
  Object.assign(w, {qpyodideShowStartupMessage: false, qpyodideLang: 'en', qpyodideCellDetails: []});
  for (const [key, value] of Object.entries(session)) w.sessionStorage.setItem(key, value);
  for (const [key, value] of Object.entries(local)) w.localStorage.setItem(key, value);
  if (outcome) w.qpyodideCoiOutcome = outcome;
  const states = [];
  w.addEventListener('qpyodide-input-state', event => states.push(event.detail));
  w.eval(script);
  const dump = storage => Object.fromEntries(Array.from({length: storage.length}, (_, i) => [storage.key(i), storage.getItem(storage.key(i))]));
  return {w, reloads, states, session: () => dump(w.sessionStorage), local: () => dump(w.localStorage), state: () => w.qpyodideInputState};
}
// The tab after a reload: its session storage stays, except the flag that
// coi-serviceworker.js reads and removes first thing.
const afterReload = page => { const {['qpyodide-coi-reload-pending']: flag, ...rest} = page.session(); assert.equal(flag, '1'); return rest; };

test('the first load that is ready and not isolated reloads once, and records it', () => {
  const first = load();
  assert.equal(first.reloads.length, 1);
  assert.equal(first.session()['qpyodide-coi-reload-pending'], '1');
  assert.ok(Number(first.session()['qpyodide-coi-reload-sent']) > Date.now() - 5000);
  assert.equal(first.state(), 'check');
});

test('a reload that reports navigation type "navigate" is not repeated: input() is unavailable, for this origin', () => {
  const first = load();
  // coi-serviceworker.js does not recognise the reload (type "navigate"): it registers again and says "ready" again.
  const second = load({session: afterReload(first)});
  assert.equal(second.reloads.length, 0, 'the page reloaded a second time (an endless reload every two seconds in WebKit)');
  assert.equal(second.state(), 'unavailable');
  assert.equal(second.local()['qpyodide-coi-unavailable-' + ORIGIN], '1');
});

test('after the verdict a third load of the tab does not reload either', () => {
  const first = load();
  const second = load({session: afterReload(first)});
  const third = load({session: second.session(), local: second.local()});
  assert.equal(third.reloads.length, 0);
});

test('a reload long ago is no reason to stop: a stale record reloads again', () => {
  const first = load({session: {'qpyodide-coi-reload-sent': String(Date.now() - 10 * 60 * 1000)}});
  assert.equal(first.reloads.length, 1);
});

test('an isolated page does not reload, and a user who is typing keeps the page', () => {
  assert.equal(load({isolated: true, session: {'qpyodide-coi-reload-sent': String(Date.now())}}).reloads.length, 0);
  const typing = load({outcome: ''});
  typing.w.dispatchEvent(new typing.w.Event('keydown'));
  typing.w.dispatchEvent(new typing.w.CustomEvent('coi-sw-ready'));
  assert.equal(typing.reloads.length, 0);
  assert.equal(typing.state(), 'needs-reload');
});

test('waiting for the event: ready arrives later and the page reloads once', () => {
  const page = load({outcome: ''});
  assert.equal(page.reloads.length, 0);
  page.w.dispatchEvent(new page.w.CustomEvent('coi-sw-ready'));
  assert.equal(page.reloads.length, 1);
});
