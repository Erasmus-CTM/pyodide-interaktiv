# Changes

## 1.9.0 (working branch `feature/shared-feedback-integration`)

pyodide-interaktiv runs on ctm-libs, the library of CTM Assessment
(consolidation step 3). `quarto add Erasmus-CTM/pyodide-interaktiv` stays the
whole install.

### For course authors

- **Install:** the command now also writes `_extensions/Erasmus-CTM/ctm-libs`
  (a generated copy the repository ships) and an `ai-feedback` forwarder that
  replaces the ai-feedback 0.8.1 folder of older projects;
  `filters: [ai-feedback, ...]` keeps working with one warning. Projects that
  commit `_extensions/` or allow only the extension's own folder in
  `.gitignore` add `ctm-libs` and `ai-feedback`; without ctm-libs the render
  stops with `quarto add Erasmus-CTM/pyodide-interaktiv`. A page that lists a
  stale 0.8.1 folder stops with "remove ai-feedback from filters: and delete
  the old folder".
- **`pyodide:` options combine key by key** on HTML pages: a page's own
  `pyodide:` map no longer drops the project's keys (F-79). Keys, defaults and
  meanings are unchanged (`1` and `0` included); a value that broke the page's
  script (`feedback: yes`) now warns and uses the default; a credential-like
  key stops the render. PDF, docx and the other formats read them as before.
- **Languages:** `ctm-assessment: lang` applies too; Nynorsk (`nn`) shows
  Bokmål instead of English; the strings are unchanged, byte for byte.
- **Start-up:** on pages with other CTM components (mathematics, Python
  exercises), their checks no longer wait for matplotlib and the other extra
  packages, which load in the background without getting in a check's way.
  This extension's cells look as before: "Ready" and Run once everything is
  loaded. The plot setup runs with the first cell run. If the extra packages
  cannot be loaded, the status line says that plots are not available and
  that other Python code works normally, with **Retry**, and cells run
  without them.
  After Stop restarts Python (pages without cross-origin isolation), Run
  waits until the new start is ready, and the setup cells run again before
  any other startup cell.
- **Cacheable files:** the CSS and scripts load as files (about 180 KB less
  inline per page; faster repeat visits); `embed-resources: true` works.
- **Builds without AI feedback** (`ai-feedback: enabled: false`,
  `CTM_FEEDBACK=off`) switch Pyodide's feedback off in any filter order and
  write none of the AI-only fields (the hidden `#| task:` text included); a
  cell with `#| task:` stays a runnable cell.
- Pages without Pyodide cells or AI feedback activities load nothing of this
  extension.
- The Pyodide version is ctm-libs' (0.28.3); `pyodide: base-url` still pins a
  project's own.

### For developers

- The Python worker and its RPC are ctm-libs' `CTMWorker`; this extension's
  part is `qpyodide-worker-plugin.js` (runCell, plots, the input() prompt).
  `qpyodideReady`, `qpyodideInstance` and `mainPyodide` mean "the interpreter
  is ready"; new `qpyodideCellsReady` (and the event `qpyodide-cells-ready`)
  for this extension's cells; `qpyodideLocales` is gone and `qpyodideLang` is
  `nb` for `no`; `qpyodideFeedbackOptions.uiLanguage`; `MPLBACKEND=AGG` in the
  worker.
- `coi-serviceworker.js` comes from ctm-libs, unchanged.
- `feedback-loader.lua` and the shipped ai-feedback 0.8.1 go;
  `scripts/sync-ctm-libs.py` (with `--check` in CI) replaces
  `scripts/sync-ai-feedback.py`; CI reads review refs with the umbrella's
  `tools/ci/review-dependencies.py`. The tests read ctm-libs from
  `CTM_LIBS_EXTENSION` or the shipped copy.
- **Markdown output** (`format: gfm`, `commonmark`, …): cells show as
  highlighted Python source, as with `pdf-fallback`, with one build warning
  per page; before, the output carried the cells' scripts, which only work
  where raw HTML is passed through.
