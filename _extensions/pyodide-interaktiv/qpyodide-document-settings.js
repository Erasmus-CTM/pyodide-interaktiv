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

// UI language for this render pass ----
//
// Set by the Lua filter from `pyodide: lang:` or Quartos own `lang:`.
// qpyodide-locales.js picks the matching translation table from this value.
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
globalThis.qpyodideFeedbackOptions = {
  enabled: {{FEEDBACKENABLED}},
  storage: "{{FEEDBACKSTORAGE}}",
  hints: {{FEEDBACKHINTS}}
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
