// qpyodide-document-settings.js – document-wide settings (template)
//
// This file is a template: the {{PLACEHOLDERS}} are replaced by the Lua
// filter (qpyodide.lua, function initializationPyodide) during rendering.
// It's injected as the first module into the <head>, so that all further
// modules can access the global settings.

// Document level settings ----

// Determine if we need to install python packages
globalThis.qpyodideInstallPythonPackagesList = [{{INSTALLPYTHONPACKAGESLIST}}];

// Check to see if we have an empty array, if we do set to skip the installation.
globalThis.qpyodideSetupPythonPackages = !(qpyodideInstallPythonPackagesList.indexOf("") !== -1);

// Automatically preload the HTTP shim and plotting packages? Defaults to true.
// Explicit pyodide: packages entries still install when this is false.
globalThis.qpyodidePreloadPackages = {{PRELOADPACKAGES}};
globalThis.qpyodideExamOutput = {{EXAMOUTPUT}};
globalThis.qpyodideStopAfter = {{STOPAFTER}};

// Display a startup message?
globalThis.qpyodideShowStartupMessage = {{SHOWSTARTUPMESSAGE}};

// Describe the Pyodide settings that should be used.
// Data only (no functions) – the configuration is passed to the Pyodide
// web worker via postMessage; the worker collects stdout/stderr itself.
globalThis.qpyodideCustomizedPyodideOptions = {
  "indexURL": "{{INDEXURL}}",
  "env": {
    "HOME": "{{HOMEDIR}}",
  }
}

// Interactive plot backend ----
//
// "webagg" (Pyodide 0.28+), "html5-canvas" (an older Pyodide pinned via
// `pyodide: base-url:`) or "auto" (the base URL names no version; decided
// from the loaded Pyodide). See qpyodide-canvas-plots.js.
globalThis.qpyodideCanvasBackend = "{{CANVASBACKEND}}";

// UI language for this render pass ----
//
// Set by the Lua filter (ctm.locale: `pyodide: lang:`, `ctm-assessment: lang:`,
// Quarto's own `lang:`): a language of the catalogue (en, de, sv, nb, da).
globalThis.qpyodideLang = "{{LANG}}";

// Store cell data
globalThis.qpyodideCellDetails = {{QPYODIDECELLDETAILS}};

// AI feedback feature settings ----
//
// enabled : show a Feedback button per interactive cell?
// storage : default for where credentials are stored
//           ("local" = localStorage, persistent; "session" = sessionStorage, per tab).
//           Can be changed by the user in the settings panel.
// hints   : progressive hints – the hint level rises with each click of the
//           Feedback button on the same cell.
// uiLanguage : the language of the feedback interface and of the feedback
//              (this extension's interface language).
globalThis.qpyodideFeedbackOptions = {
  enabled: {{FEEDBACKENABLED}},
  storage: "{{FEEDBACKSTORAGE}}",
  hints: {{FEEDBACKHINTS}},
  uiLanguage: "{{LANG}}"
};

// Local-storage autosave feature settings ----
//
// enabled : document-wide default (`pyodide: local-storage: true`); a
//           cell's own `#| local-storage: true/false` overrides this.
// epoch   : "" (off) unless `pyodide: local-storage-epoch:` was set. When
//           non-empty, it's folded into every saved-code storage key, so
//           re-rendering with a new epoch value makes every previously
//           saved answer on this page unreachable -- an exam-room "next
//           group gets a clean slate" reset. See qpyodide-storage.js.
globalThis.qpyodideLocalStorageOptions = {
  enabled: {{LOCALSTORAGEENABLED}},
  epoch: "{{LOCALSTORAGEEPOCH}}"
};
