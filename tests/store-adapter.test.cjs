const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "../_extensions/pyodide-interaktiv/qpyodide-storage.js"), "utf8");
function fixture(source, {epoch = "", enabled = true, manual = false, cells = null} = {}) {
  const values = new Map(), records = new Map(), handles = [], listeners = {}, actions = [];
  const storage = {getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); }, removeItem(key) { values.delete(key); }};
  if (manual) storage.setItem("qpyodide:local-storage-manual-mode", "1");
  function element() { return {children: [], append(...items) { this.children.push(...items); }, remove() { this.removed = true; },
    querySelectorAll() { return []; }, textContent: "", className: ""}; }
  const doc = {addEventListener(name, fn) { listeners[name] = fn; }, createElement: element, getElementById: element};
  const root = {qpyodideLang: "en", qpyodideLocalStorageOptions: {epoch},
    qpyodideCellDetails: cells || [{id: 1, code: "starter", options: {label: "cell", "ctm-store-id": "cell",
      "ctm-store-source": "0123456789abcdef", "ctm-store-save": true,
      "ctm-extra-source": "fedcba9876543210", "ctm-extra-save": true}}]};
  root.CTMStore = {enabled: () => enabled, setEnabled(value) { enabled = value; },
    clearPage() { actions.push("page"); }, clearCourse() { actions.push("course"); },
    register(options) {
      const handle = {options, changes: 0, cancels: 0, flushes: 0,
        restore() {
          if (!enabled || options.save === false) return {state: "disabled"};
          const legacy = options.legacy[0].read();
          if (legacy) {
            if (legacy.inputs === null) records.delete(options.id);
            else records.set(options.id, {source: options.source, inputs: legacy.inputs});
            options.legacy[0].remove(legacy);
          }
          const record = records.get(options.id);
          if (!record) return {state: "empty"};
          const state = record.source === options.source ? "restored" : "changed";
          if (state === "restored") options.write(record.inputs);
          return {state, record, outdated: state !== "restored"};
        },
        changed() { this.changes++; }, cancel() { this.cancels++; },
        flush() { this.flushes++; const inputs = options.read(); if (inputs === null) records.delete(options.id);
          else records.set(options.id, {source: options.source, inputs}); return true; },
        clear() { records.delete(options.id); options.clear(); }
      };
      handles.push(handle); return handle;
    }};
  const locales = {table() { return {sourceChanged: "Changed", showSaved: "Show saved", copyOutput: "Output"}; }};
  new Function("globalThis", "CTMLocales", "document", "localStorage", "location", source)(
    root, locales, doc, storage, {pathname: "/lesson.html"});
  const api = root.qpyodideStorage;
  function unit(uid = "1", original = "starter") {
    let code = original;
    const u = {uid, code: original, options: {label: uid, "ctm-store-save": true},
      hostDiv: element(), outputGraphDiv: element(), lastRunCode: null, lastOutput: null,
      getCode: () => code, invalidateFeedback() {}, updateInputGate() {}, statusUpdates: [],
      updateStorageStatus(restored) { this.statusUpdates.push({restored, saved: api.load(uid)}); },
      resetEditorToOriginal() { this.suppressStorageChanges = true; this.editor.setValue(original); this.suppressStorageChanges = false; },
      editor: {setValue(value) { code = value; if (!u.suppressStorageChanges) api.changed(uid); }}};
    return u;
  }
  return {root, api, values, records, handles, storage, unit, actions, listeners};
}
function expect(value, message) { if (!value) throw new Error(message); }

test("current epoch only migrates, replaces old shared record and never executes", () => {
const f = fixture(source, {epoch: "current"}), u = f.unit();
 f.records.set("cell", {source: "0123456789abcdef", inputs: {code: "new record"}});
 f.storage.setItem("qpyodide:code:epoch:old:/lesson.html:label:cell", "other group");
 f.storage.setItem("qpyodide:code:epoch:current:/lesson.html:label:cell", "cached page write");
 f.api.attach(u);
 expect(u.getCode() === "cached page write", "legacy must beat a new record");
 expect(!f.values.has("qpyodide:code:epoch:current:/lesson.html:label:cell"), "migrated key retained");
 expect(f.values.get("qpyodide:code:epoch:old:/lesson.html:label:cell") === "other group", "older epoch touched");
 expect(f.handles[0].changes === 0, "restore scheduled save");
});

test("disabled saving does not import or delete legacy code", () => {
const f = fixture(source, {enabled: false}), u = f.unit();
 f.storage.setItem("qpyodide:code:/lesson.html:label:cell", "private code");
 f.api.attach(u);
 expect(u.getCode() === "starter", "disabled restored code");
 expect(f.values.has("qpyodide:code:/lesson.html:label:cell"), "disabled deleted old data");
 u.editor.setValue("unsaved edit"); expect(f.handles[0].changes === 0 && f.api.load("1") === null, "disabled edit marked saved");
 expect(f.api.save("1") === false, "disabled manual save accepted");
});

test("manual mode cancels pending auto saves and explicit Save flushes current code", () => {
const f = fixture(source), u = f.unit(); f.api.attach(u);
 u.editor.setValue("auto edit"); expect(f.handles[0].changes === 1, "edit not saved");
 f.api.setManualMode(true); expect(f.handles[0].cancels === 1, "manual mode did not cancel pending autosave");
 u.editor.setValue("manual edit"); expect(f.handles[0].changes === 1, "manual edit autosaved");
 f.api.save("1"); expect(f.handles[0].flushes === 1 && f.records.get("cell").inputs.code === "manual edit", "explicit save lost code");
 u.editor.setValue("starter"); f.api.save("1"); expect(!f.records.has("cell"), "starter persisted");
});

test("clear cancels the store and reset never schedules a synthetic save", () => {
const f = fixture(source), u = f.unit(); f.api.attach(u);
 u.editor.setValue("edit"); const before = f.handles[0].changes;
 f.api.clear("1"); expect(u.getCode() === "starter", "clear did not reset");
 expect(f.handles[0].changes === before, "reset re-saved starter");
 u.editor.setValue("keep live"); f.api.clear("1", {keepCode: true});
 expect(u.getCode() === "keep live", "clear saved code changed live editor");
});

test("changed source stays readonly", () => {
const f = fixture(source), u = f.unit();
 f.records.set("cell", {source: "different", inputs: {code: "old source answer"}});
 f.api.attach(u); expect(u.getCode() === "starter", "changed answer autofilled");
 expect(u.hostDiv.children.length === 1 && u.hostDiv.children[0].children[1].textContent === "old source answer", "missing readonly offer");
});

test("dormant extra editor restores once and exports no interpreter state", () => {
const f = fixture(source);
 f.api.registerIdentity("1.2", "extra:label:cell");
 f.storage.setItem("qpyodide:code:/lesson.html:extra:label:cell", "extra answer");
 let mounts = 0, extra;
 f.api.prepareExtra("1.2", () => { mounts++; extra = f.unit("1.2", ""); f.api.attach(extra); return extra; });
 expect(mounts === 1 && extra.getCode() === "extra answer", "extra not restored once");
 const parts = f.handles[0].options.exportItem().parts;
 expect(parts.length === 1 && parts[0].kind === "code", "stored/exported Python state");
});

test("storage exceptions leave the editor usable", () => {
const f = fixture(source), u = f.unit();
 f.storage.getItem = () => { throw new Error("SecurityError"); };
 f.api.attach(u); expect(u.getCode() === "starter", "storage error changed editor");
 u.editor.setValue("usable"); expect(u.getCode() === "usable", "editor unusable");
});


test("labelled cells do not shift legacy identities of identical unlabelled cells", () => {
const f = fixture(source, {cells: [
  {id: 1, code: "same", options: {label: "named", "ctm-store-id": "named", "ctm-store-source": "0123456789abcdef"}},
  {id: 2, code: "same", options: {"ctm-store-id": "first", "ctm-store-source": "0123456789abcdef"}},
  {id: 3, code: "same", options: {"ctm-store-id": "second", "ctm-store-source": "0123456789abcdef"}}
]});
f.storage.setItem("qpyodide:code:/lesson.html:label:named", "named answer");
f.storage.setItem("qpyodide:code:/lesson.html:hash:yjccrj", "first answer");
f.storage.setItem("qpyodide:code:/lesson.html:hash:yjccrj:2", "second answer");
const first = f.unit("2", "same"), second = f.unit("3", "same");
f.api.attach(first); f.api.attach(second);
expect(first.getCode() === "first answer", "first unlabelled answer shifted");
expect(second.getCode() === "second answer", "second unlabelled answer shifted");
expect(f.values.get("qpyodide:code:/lesson.html:label:named") === "named answer", "labelled key was deleted by another cell");
expect(!f.values.has("qpyodide:code:/lesson.html:hash:yjccrj") && !f.values.has("qpyodide:code:/lesson.html:hash:yjccrj:2"), "migrated hash keys retained");
});

test("queued, canceled and refused writes never acknowledge edited code", () => {
  const f = fixture(source), u = f.unit(); f.api.attach(u);
  u.editor.setValue("queued edit");
  expect(f.api.load("1") === null && !f.api.hasSaved("1"), "queued edit marked saved");
  f.api.setManualMode(true);
  expect(f.api.load("1") === null && f.records.size === 0, "canceled edit marked saved");
  f.handles[0].flush = () => false;
  expect(f.api.save("1") === false && f.api.load("1") === null, "refused save marked saved");
});
test("refused replacement keeps only acknowledged code and starter deletes it", () => {
  const f = fixture(source, {manual: true}), u = f.unit(); f.api.attach(u);
  u.editor.setValue("durable answer");
  expect(f.api.save("1") === true && f.api.load("1") === "durable answer", "successful write not acknowledged");
  const flush = f.handles[0].flush.bind(f.handles[0]);
  f.handles[0].flush = () => false; u.editor.setValue("refused replacement");
  expect(f.api.save("1") === false && f.api.load("1") === "durable answer", "refused write replaced acknowledged code");
  f.handles[0].flush = flush; u.editor.setValue("starter");
  expect(f.api.save("1") === true && !f.api.hasSaved("1"), "starter deletion retained acknowledgement");
});

test("autosave invalidates an earlier acknowledgement before a later manual edit", () => {
  const f = fixture(source), u = f.unit(); f.api.attach(u);
  u.editor.setValue("answer A"); f.api.save("1");
  expect(f.api.load("1") === "answer A", "manual write not acknowledged");
  u.editor.setValue("answer B"); f.handles[0].flush();
  f.api.setManualMode(true); u.editor.setValue("answer A");
  expect(f.records.get("cell").inputs.code === "answer B", "test did not persist replacement");
  expect(f.api.load("1") === null, "old acknowledgement reused after autosave replacement");
  f.api.save("1"); f.api.setManualMode(false); u.editor.setValue("starter"); f.handles[0].flush();
  f.api.setManualMode(true); u.editor.setValue("answer A");
  expect(!f.records.has("cell") && !f.api.hasSaved("1"), "deleted acknowledgement reused");
});

test("reset before delayed extra attachment removes both stale offers and restored code", () => {
  for (const sourceHash of ["different", "fedcba9876543210"]) {
    const f = fixture(source);
    f.api.registerIdentity("1.2", "extra:label:cell");
    f.records.set("extra:cell", {source: sourceHash, inputs: {code: "deleted extra answer"}});
    let mounts = 0;
    f.api.prepareExtra("1.2", () => { mounts++; });
    expect(mounts === 1, "test did not defer a requested mount");
    f.handles[0].clear();
    const extra = f.unit("1.2", ""); f.api.attach(extra);
    expect(extra.getCode() === "", "deleted pending code restored on late attach");
    expect(extra.hostDiv.children.length === 0, "deleted answer offered on late attach");
    expect(!f.api.hasSaved("1.2"), "deleted acknowledgement returned on late attach");
    expect(extra.statusUpdates.every(update => !update.restored), "late attach retained restored status");
    expect(!f.records.has("extra:cell"), "clear reimported deleted answer");
  }
});

test("scoped persistence loss forgets acknowledgement without resetting live code or output", () => {
  const f = fixture(source, {manual: true, cells: [
    {id: 1, code: "starter", options: {"ctm-store-id": "first", "ctm-store-source": "0123456789abcdef"}},
    {id: 2, code: "starter", options: {"ctm-store-id": "second", "ctm-store-source": "fedcba9876543210"}}
  ]}), first = f.unit("1"), second = f.unit("2");
  f.api.attach(first); f.api.attach(second);
  first.editor.setValue("first answer"); second.editor.setValue("second answer");
  f.api.save("1"); f.api.save("2");
  first.lastOutput = "keep visible result"; first.lastRunCode = first.getCode();
  const before = f.handles[0].changes;
  // Core owns course/page/component/runtime matching. Invoke only its selected
  // entry callback, as for raw deletion or an optout without an explicit reset.
  f.records.delete("first"); f.handles[0].options.forget();
  expect(!f.api.hasSaved("1"), "deleted record still acknowledged");
  expect(first.getCode() === "first answer" && first.lastOutput === "keep visible result", "persistence loss reset live work");
  expect(first.statusUpdates.at(-1).saved === null, "Saved status not refreshed");
  expect(f.api.load("2") === "second answer" && f.records.get("second").inputs.code === "second answer", "sibling acknowledgement or data touched");
  expect(f.handles[0].changes === before, "forget scheduled a save");
  f.api.setUserDisabled(true); f.records.delete("second"); f.handles[1].options.forget();
  expect(!f.api.hasSaved("2") && second.getCode() === "second answer", "device off retained acknowledgement or reset input");
});

test("persistence loss removes an outdated offer before and after mounting", () => {
  const f = fixture(source), primary = f.unit();
  f.records.set("cell", {source: "different", inputs: {code: "old primary answer"}});
  f.api.attach(primary); const offer = primary.hostDiv.children[0];
  f.records.delete("cell"); f.handles[0].options.forget();
  expect(offer.removed && primary.getCode() === "starter", "mounted offer retained or editor changed");
  f.api.attach(primary);
  expect(primary.hostDiv.children.length === 1 && offer.removed, "attach recreated deleted offer");

  f.api.registerIdentity("1.2", "extra:label:cell");
  f.records.set("extra:cell", {source: "different", inputs: {code: "old extra answer"}});
  f.api.prepareExtra("1.2", () => {});
  f.records.delete("extra:cell"); f.handles[1].options.forget();
  const extra = f.unit("1.2", ""); f.api.attach(extra);
  expect(extra.hostDiv.children.length === 0 && !f.api.hasSaved("1.2"), "delayed extra recreated deleted offer");
});

test("a matched external overwrite invalidates the old acknowledgement without restoring remote code", () => {
  const f = fixture(source, {manual: true}), u = f.unit(); f.api.attach(u);
  u.editor.setValue("local answer A"); f.api.save("1");
  f.records.set("cell", {source: "0123456789abcdef", inputs: {code: "remote answer B"}});
  // Storage-event matching and comparison happen in CTMStore, not this adapter.
  f.handles[0].options.forget();
  expect(f.api.load("1") === null, "remote overwrite left stale local acknowledgement");
  expect(u.getCode() === "local answer A", "remote overwrite replaced live editor");
  expect(f.records.get("cell").inputs.code === "remote answer B", "forget rewrote remote record");
  expect(f.handles[0].changes === 0, "manual external overwrite scheduled a save");
});

test("device off before a delayed exact restore attaches preserves an empty extra editor", () => {
  const f = fixture(source);
  f.api.registerIdentity("1.2", "extra:label:cell");
  f.records.set("extra:cell", {source: "fedcba9876543210", inputs: {code: "now deleted"}});
  f.api.prepareExtra("1.2", () => {});
  f.api.setUserDisabled(true); f.records.delete("extra:cell");
  f.handles[0].options.forget();
  const extra = f.unit("1.2", ""); f.api.attach(extra);
  expect(extra.getCode() === "" && !f.api.hasSaved("1.2"), "disabled late attach resurrected saved code");
  expect(extra.statusUpdates.every(update => !update.restored && update.saved === null), "disabled late attach claimed Restored");
  expect(extra.hostDiv.children.length === 0, "disabled late attach offered deleted code");
});
