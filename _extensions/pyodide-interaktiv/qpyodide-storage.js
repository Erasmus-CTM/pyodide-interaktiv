// Shared CTMStore adapter for editable Pyodide cells. Only code is persisted;
// Python state and output stay in the live page. This module owns the old
// qpyodide key format and manual-save preference, never a second answer store.
globalThis.qpyodideStorage = (() => {
  const MANUAL_KEY = "qpyodide:local-storage-manual-mode";
  const entries = new Map();
  const descriptors = new Map();
  const text = () => CTMLocales.table("ui", globalThis.qpyodideLang || "en");
  const store = () => globalThis.CTMStore;
  function oldHash(value) {
    let hash = 5381;
    for (let i = 0; i < value.length; i++) hash = ((hash * 33) ^ value.charCodeAt(i)) >>> 0;
    return hash.toString(36);
  }
  const counts = Object.create(null);
  for (const cell of globalThis.qpyodideCellDetails || []) {
    if (["setup", "output"].includes(cell.options?.context)) continue;
    const label = cell.options?.label?.trim();
    // Old computeIdentities never counted labelled cells as hash occurrences.
    // Counting them here would shift another cell's migrated answer.
    const hash = oldHash(cell.code || "");
    const n = label ? 0 : (counts[hash] = (counts[hash] || 0) + 1);
    const legacy = label ? "label:" + label : "hash:" + hash + (n > 1 ? ":" + n : "");
    descriptors.set(String(cell.id), {
      id: cell.options?.["ctm-store-id"] || legacy,
      source: cell.options?.["ctm-store-source"] || "",
      save: cell.options?.["ctm-store-save"] !== false && cell.options?.["ctm-store-save"] !== "false",
      original: cell.code || "", legacy, extraSource: cell.options?.["ctm-extra-source"], extraSave: cell.options?.["ctm-extra-save"]
    });
  }
  function getPreference(key) { try { return localStorage.getItem(key); } catch (_) { return null; } }
  function manual() { return getPreference(MANUAL_KEY) === "1"; }
  function legacy(entry) {
    return {
      read() {
        const epoch = globalThis.qpyodideLocalStorageOptions?.epoch || "";
        const key = "qpyodide:code:" + (epoch ? "epoch:" + epoch + ":" : "") +
          location.pathname + ":" + entry.description.legacy;
        let code;
        try { code = localStorage.getItem(key); } catch (_) { return null; }
        return code === null ? null : {inputs: code === entry.description.original ? null : {code}, keys: [key]};
      },
      remove(candidate) { candidate.keys.forEach(key => { try { localStorage.removeItem(key); } catch (_) {} }); }
    };
  }
  function writeCode(entry, code) {
    entry.saved = code;
    if (!entry.unit) { entry.pending = code; entry.mount?.(); }
    if (!entry.unit?.editor) { entry.pending = code; return; }
    const unit = entry.unit;
    unit.suppressStorageChanges = true;
    try { unit.editor.setValue(code); } finally { unit.suppressStorageChanges = false; }
    unit.invalidateFeedback();
    unit.updateInputGate();
    unit.updateStorageStatus(true);
  }
  function offerOld(entry) {
    if (!entry.unit || !["changed", "withdrawn"].includes(entry.restored?.state) || entry.offer) return;
    const panel = document.createElement("details");
    panel.className = "qpyodide-saved-outdated";
    const summary = document.createElement("summary");
    summary.textContent = text().sourceChanged + " " + text().showSaved;
    const code = document.createElement("pre");
    code.textContent = entry.restored.record?.inputs?.code || "";
    panel.append(summary, code); entry.unit.hostDiv.append(panel); entry.offer = panel;
  }
  // Core calls this only after matching the affected registered entry.
  // Losing persistence is not an instruction to erase the live editor/output.
  function forget(entry) {
    entry.saved = null; entry.pending = null; entry.restored = null;
    entry.offer?.remove(); entry.offer = null;
    entry.unit?.updateStorageStatus(false);
  }
  function makeEntry(uid, description, unit = null, mount = null) {
    let entry = entries.get(uid);
    if (entry) { if (unit) entry.unit = unit; if (mount) entry.mount = mount; return entry; }
    entry = {description, unit, mount, pending: null, saved: null, offer: null, restored: null};
    entries.set(uid, entry);
    if (!store()) return entry;
    entry.handle = store().register({
      component: "pyodide-interaktiv", id: description.id, source: description.source,
      element: unit?.hostDiv || document.getElementById("qpyodide-insertion-location-" + uid.split(".")[0]),
      save: description.save,
      read() {
        const code = entry.unit ? entry.unit.getCode() : entry.pending;
        return code == null || code === description.original ? null : {code};
      },
      write(inputs) { if (typeof inputs?.code === "string") writeCode(entry, inputs.code); },
      forget() { forget(entry); },
      clear() {
        forget(entry);
        if (entry.unit && !entry.keepCode) {
          entry.unit.feedbackHandle?.reset();
          entry.unit.invalidateFeedback();
          entry.unit.resetEditorToOriginal();
          entry.unit.updateStorageStatus(false);
        }
      },
      legacy: [legacy(entry)],
      exportItem() {
        if (!entry.unit) return null;
        const unit = entry.unit, code = unit.getCode();
        const parts = [{kind: "code", label: unit.options.label || description.id, text: code}];
        if (unit.lastRunCode === code && unit.lastOutput) parts.push({kind: "output", label: text().copyOutput, text: unit.lastOutput});
        if (unit.lastRunCode === code) {
          (unit.lastPlotImages || []).forEach((png, i) => {
            parts.push({kind: "image", label: text().figureLabel(i + 1), dataURL: "data:image/png;base64," + png});
          });
        }
        return {title: unit.options["fig-cap"] || unit.options.label || description.id, parts};
      }
    });
    return entry;
  }
  function restore(entry) {
    if (entry.didRestore || !entry.handle) return;
    entry.didRestore = true;
    entry.restored = entry.handle.restore();
    if (entry.restored?.state === "restored") entry.saved = entry.restored.record?.inputs?.code ?? null;
    if (["changed", "withdrawn"].includes(entry.restored?.state) && entry.mount) entry.mount();
    offerOld(entry);
  }
  const api = {
    docEnabled: true, anyEnabled: (globalThis.qpyodideCellDetails || []).some(cell => !["setup", "output"].includes(cell.options?.context)),
    identityFor(uid) { return descriptors.get(String(uid))?.legacy || null; },
    registerIdentity(uid, identity) {
      const parent = descriptors.get(String(uid).split(".")[0]);
      if (!parent) return;
      descriptors.set(String(uid), {id: "extra:" + parent.id, source: parent.extraSource || parent.source, save: parent.extraSave !== false && parent.extraSave !== "false", original: "", legacy: identity});
    },
    attach(unit) {
      const uid = String(unit.uid), description = descriptors.get(uid);
      if (!description) return null;
      const entry = makeEntry(uid, description, unit);
      restore(entry);
      if (entry.pending !== null) { const code = entry.pending; entry.pending = null; writeCode(entry, code); }
      offerOld(entry);
      unit.updateStorageStatus(entry.restored?.state === "restored");
      return entry.handle;
    },
    attachOutput(cell, element) {
      if (!store()) return null;
      return store().register({
        component: "pyodide-interaktiv", id: cell.options["ctm-store-id"], source: cell.options["ctm-store-source"],
        element, save: false, read: () => null, write() {}, clear() {},
        exportItem() {
          const parts = [{kind: "output", label: text().copyOutput, text: cell.outputCodeDiv.innerText || cell.outputCodeDiv.textContent || ""}];
          (cell.lastPlotImages || []).forEach((png, i) => parts.push({
            kind: "image", label: text().figureLabel(i + 1), dataURL: "data:image/png;base64," + png
          }));
          return {title: cell.options["fig-cap"] || cell.options.label || cell.options["ctm-store-id"], parts};
        }
      });
    },
    prepareExtra(uid, mount) {
      const description = descriptors.get(String(uid));
      if (!description) return;
      const entry = makeEntry(String(uid), description, null, mount);
      restore(entry);
    },
    cellEnabled(options) { return !!store()?.enabled() && options?.["ctm-store-save"] !== false && options?.["ctm-store-save"] !== "false"; },
    isUserDisabled() { return !store()?.enabled(); },
    setUserDisabled(off) { store()?.setEnabled(!off); },
    isManualMode: manual,
    setManualMode(value) {
      entries.forEach(entry => entry.handle?.cancel?.());
      try { if (value) localStorage.setItem(MANUAL_KEY, "1"); else localStorage.removeItem(MANUAL_KEY); } catch (_) {}
    },
    changed(uid) {
      const entry = entries.get(String(uid));
      if (!entry || manual() || !store()?.enabled() || entry.description.save === false) return;
      // Without an autosave acknowledgement, a later flush may replace or
      // delete this value. Never keep an acknowledgement across that edit.
      entry.saved = null;
      entry.handle?.changed();
    },
    save(uid) {
      const entry = entries.get(String(uid));
      if (!entry || !store()?.enabled() || entry.description.save === false) return false;
      if (entry.handle?.flush) {
        const code = entry.unit?.getCode() ?? null;
        const saved = entry.handle.flush();
        if (saved) entry.saved = code === entry.description.original ? null : code;
        return saved;
      }
      entry.handle?.changed(); return false;
    },
    load(uid) { return entries.get(String(uid))?.saved ?? null; },
    hasSaved(uid) { return api.load(uid) !== null; },
    clear(uid, {keepCode = false} = {}) {
      const entry = entries.get(String(uid));
      if (!entry) return;
      entry.keepCode = keepCode;
      try { entry.handle?.clear(); } finally { entry.keepCode = false; }
    },
    clearPage() { store()?.clearPage(); },
    clearAll() { store()?.clearCourse(); }
  };
  document.addEventListener("ctm:store-enabled", () => globalThis.qpyodideRefreshStorageUI?.());
  return api;
})();
