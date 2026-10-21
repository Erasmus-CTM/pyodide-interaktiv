const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "../_extensions/pyodide-interaktiv/qpyodide-storage.js"), "utf8");
function fixture(source, {epoch = "", enabled = true, manual = false} = {}) {
  const values = new Map(), records = new Map(), handles = [], listeners = {}, actions = [];
  const storage = {getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); }, removeItem(key) { values.delete(key); }};
  if (manual) storage.setItem("qpyodide:local-storage-manual-mode", "1");
  function element() { return {children: [], append(...items) { this.children.push(...items); }, remove() {},
    querySelectorAll() { return []; }, textContent: "", className: ""}; }
  const doc = {addEventListener(name, fn) { listeners[name] = fn; }, createElement: element, getElementById: element};
  const root = {qpyodideLang: "en", qpyodideLocalStorageOptions: {epoch},
    qpyodideCellDetails: [{id: 1, code: "starter", options: {label: "cell", "ctm-store-id": "cell",
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
      getCode: () => code, invalidateFeedback() {}, updateInputGate() {}, updateStorageStatus() {},
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
