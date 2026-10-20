# Detailed functionality reference

[Start here](../README.md) · [Authoring guide](authoring.md)

## Usage

````markdown
```{pyodide-python}
x = [1, 2, 3, 4, 5]
print(sum(x))
```
````

Every cell offers **Run** (also Shift+Enter / Ctrl+Enter), **Reset**,
**Copy**, **Feedback**, and **+ Code block** (appends an empty, editable
extra editor — handy under read-only examples).

---

## AI Feedback

### Getting feedback

Click **Feedback** beside an editable cell. The default **Copy prompt** mode
needs no API key: copy the generated prompt into your chosen AI chat.

For direct feedback, click the **⚙ icon** beside Feedback, choose **Direct API**,
and enter your provider's API base URL, model and personal key. The provider must
support an OpenAI-compatible chat-completions endpoint and browser CORS access.
**Fetch models** lists compatible model IDs; it does not filter by price. Choose
your provider and model according to your institution's access and usage terms.

All cells and integrated exercises open the same settings dialog. Choose
**This tab** or **Remember on this device** for storage. A saved key is sent only
to the configured provider. Previously saved Pyodide settings can be imported
explicitly. No provider is selected automatically.

Feedback can be requested before Python has loaded or before code has run.
Direct mode with incomplete settings offers a button to open the same dialog.
The shared runtime owns API requests, model compatibility and Markdown/LaTeX
rendering.

### Progressive hints

The hint level rises with each successfully displayed response of the Feedback button on the same
cell (1 = gentle nudge, 2 = the problem explained concretely, 3 = the
solution approach described in words — never finished solution code).
Can be disabled via `feedback-hints: false`.

---

## Cell options (`#|`)

| Option | Default | Description |
|--------|---------|--------------|
| `context` | `interactive` | `interactive`, `output`, or `setup` |
| `read-only` | `false` | make the editor read-only (no Feedback button) |
| `autorun` | — | `true`: run the code automatically after Pyodide starts |
| `code-fold` | — | `true`/`1`/`hide`: cell starts collapsed; `false`/`0`/`show`: starts expanded. Falls back to the document's `code-fold:` when unset |
| `pdf-fallback` | — | `true`/`python`: in non-interactive formats (PDF, docx, …) show the cell as plain, Python-highlighted source instead of raw text; `false`: keep the old unstyled pass-through. Falls back to the document's `pyodide: pdf-fallback:` when unset |
| `<format>-autoexec` | — | `true`: for that one output format (e.g. `pdf-autoexec`, `html-autoexec`), actually *run* the cell via a local `python3`/`python` and show its real output instead of the interactive editor/`pdf-fallback`. Falls back to the document's `pyodide: <format>-autoexec:` when unset |
| `label` | — | unique ID of the cell (`data-id` attribute) |
| `classes` | — | additional CSS classes |
| `fig-cap` | — | caption for plots |
| `fig-width` / `fig-height` | `7` / `5` | plot size in inches |

---

## Document options (YAML front matter)

```yaml
pyodide:
  packages: [numpy, pandas]      # packages to install via micropip on startup
  base-url: https://cdn.jsdelivr.net/pyodide/v0.28.3/   # optional; WebAgg plots need Pyodide 0.28+
  build-variant: full
  show-startup-message: true
  feedback: true                 # show AI feedback buttons (default: true)
  feedback-storage: local        # default: local | session
  feedback-hints: true           # progressive hints (default: true)
  pdf-fallback: false            # PDF/docx: highlight {pyodide-python} as plain Python (default: false)
  pdf-autoexec: false            # PDF/docx: actually run {pyodide-python} cells and show real output (default: false)
  html-autoexec: false           # same, but for the HTML page itself (default: false)
  lang: de                       # UI language (default: en)
```

Packages imported in the code are additionally loaded on demand by Pyodide
(`loadPackagesFromImports`). `requests`/`urllib3` are shimmed via
`pyodide_http`, so `pd.read_csv(url)` works directly.

**How the options combine (1.9).** On HTML pages the `pyodide:` options are
read key by key: `_quarto.yml`, the active profiles, `_quarto.yml.local`,
the `_metadata.yml` files and the page's front matter each contribute their
keys, the nearest winning, so a page that sets `pyodide: lang: de` keeps the
project's `feedback: false` (before 1.9 a page's own `pyodide:` map replaced
the project's). The on/off options (`show-startup-message`, `feedback`,
`feedback-hints`, `local-storage`, `html-autoexec`) take `true`, `false`,
`1` or `0`; any other value warns once and uses the default (before, a
value such as `feedback: yes` broke the page's script). A key that looks
like a credential (`api-key`, `token`, `secret`, …) stops the render:
Quarto metadata is published with the site. PDF, docx and the other
formats read the options as before (`pdf-fallback: python`, `1`, `0`).
`base-url` and `build-variant` pin a project's own Pyodide; without them the
page uses the version of ctm-libs (the one the other CTM components grade
with).

Quarto's own standard `code-fold:` (document, profile, or project
`_quarto.yml`) sets the default open/closed state of every interactive
cell's code editor; no separate `pyodide:` option is needed. Enable
`code-tools: true` as well to also get the page's "Show All Code"/"Hide
All Code" toggle, which folds/unfolds pyodide cells alongside regular code
blocks. Override it per cell with `#| code-fold: true`.

If a reader manually expands one folded cell while at least two others
are still folded, a small one-time hint appears underneath offering to
reveal every remaining cell in one click ("Show all" / "No, thanks") —
with only one other folded cell left, clicking it directly is no more
effort, so the hint won't appear. Text is fully localized
(see [UI language](#ui-language)).

---

## Marker cells: real Quarto crossrefs

`{pyodide-python}`/`<format>-autoexec` figures can't be cross-referenced
with `@fig-...` and come out as raster PNGs in PDF (see [Known
limitations](#known-limitations)). For a real, numbered, linkable figure,
write a normal `{python}` cell instead and opt it into HTML with a
`# pyodide: ...` marker comment:

````
```{python}
#| label: fig-parabola
#| fig-cap: "The parabola $y=x^2$."
# pyodide: autorun, read-only=false
import numpy as np
import matplotlib.pyplot as plt
x = np.linspace(-2, 2, 200)
plt.plot(x, x**2)
plt.show()
```
````

The marker takes the same options as the [cell options
table](#cell-options-) (`autorun`, `read-only`, `code-fold`, ...) and is
stripped from the shown source everywhere; `#| label:`/`#| fig-cap:` stay
Quarto's own. PDF/docx/etc. keep Quarto's real, engine-produced figure
untouched — only the marker line disappears. HTML swaps the computed
output for the interactive editor but keeps Quarto's figure float, caption,
and crossref anchor around it, so `@fig-parabola` from another page still
resolves. Needs a real Python kernel at render time, same as any other
`{python}` cell; with `execute: enabled: false` the marker still works but
there's no real figure to keep either way.

Prefer this over `<format>-autoexec` when the figure needs a working
`@fig-...` reference or real vector PDF output; prefer `*-autoexec` for
running an actual `{pyodide-python}` cell for real in a non-interactive
format.

---

## UI language

Shipped languages: **English (`en`)**, **German (`de`)**, **Swedish (`sv`)**,
**Norwegian Bokmål (`nb`, also as `no`; Nynorsk `nn` shows Bokmål)**, and
**Danish (`da`)**.
**The default is English** – without any setting, the UI appears in English.
Any additional language can be added yourself, see
[Adding another language](#adding-another-language).

The extension reads the language in this order:

1. `pyodide: lang:` – explicit override
2. `ctm-assessment: lang:` – the language of every CTM component at once
3. **Quarto's own `lang:`** – the normal case
4. `en` – fallback

Quarto's standard key is therefore enough; no extra option is needed:

```yaml
---
title: "My Notebook"
lang: de
filters:
  - Erasmus-CTM/pyodide-interaktiv
---
```

Regional variants are shortened (`de-DE` → `de`). An unsupported language
(e.g. `fr`) silently falls back to English and does **not** break rendering.
The resolved code is `globalThis.qpyodideLang` (`nb` for `no`).

All visible text is translated – toolbar, status line, the `input()`
panel, the AI feedback panel, and error messages – as well as the
instruction given to the AI: on an English page, the tutor responds in
English.

### Multilingual projects

Since the language comes from Quarto's own `lang:`, the extension works
with multilingual setups without any extra effort. With a Quarto-profile-
based setup, one `lang:` per profile is enough:

```yaml
# _quarto-de.yml
project:
  output-dir: docs/de
lang: de
```

```yaml
# _quarto-en.yml
project:
  output-dir: docs/en
lang: en
```

Each language is its own render pass; the text is then fixed in the
respective HTML output. A language switcher linking to the other version
therefore also switches the extension's language automatically.

### Adding another language

All visible text lives in **one** place, the message catalogue
`pyodide-interaktiv` of ctm-libs (`_extensions/ctm-libs/locales/pyodide-interaktiv.js`,
shipped here as a generated copy; the CTM Assessment package has the same
file). Each language is a block with the same keys as `en`; values may hold
HTML, and `engineFailed` and `setupFailed` are templates with the argument
`{msg}`. A new language is a pull request to
[ctm-libs](https://github.com/Erasmus-CTM/ctm-libs): add the code to
`$languages` and the block with every key, then run
`python scripts/check-locales.py` there (format, completeness, arguments).
Only what a human reads gets translated: HTML markup and CSS classes,
element IDs (`qpyodide-coi-check-btn`), Python and web identifiers
(`input()`, `SharedArrayBuffer`) stay as they are. Once ctm-libs has it,
`python scripts/sync-ctm-libs.py` brings it here.

---

## Plots and animations: `plt.show()`

Guiding principle: **code behaves like in a local IDE.** `plt.show()` is
the trigger for output — without a call, nothing appears; with a call,
everything currently open appears. Shown figures are closed in the
process, just as locally closing the windows ends a blocking `show()`; a
following `plt.plot()` therefore starts a new figure instead of drawing
into the old one.

A custom `show()` replacement is necessary anyway because AGG isn't
interactive: the real `plt.show()` would do nothing here except warn
(*"FigureCanvasAgg is non-interactive, and thus cannot be shown"*).

`fig.show()` also works and shows only that one figure.

A cell run corresponds to a script run: figures that were never shown by
the end are discarded. Otherwise they would pile up across repeated runs
of the same cell, and a later `plt.show()` would output all of them at
once.

### Interactive plots and the Pyodide version

Interactive plots use Matplotlib's WebAgg backend in a second Pyodide
instance. WebAgg needs **Pyodide 0.28 or later**: from 0.28 on, Pyodide
patches it to talk to the page directly; older releases would need a
Tornado server, which Pyodide does not ship. The default (no `base-url`)
is Pyodide 0.28.3.

**Migration note (projects from 1.6/1.7 that pin `base-url`).** Earlier
versions documented `base-url: https://cdn.jsdelivr.net/pyodide/v0.27.2/`.
Such a project keeps building and keeps its interactive plots without
changes: for a Pyodide below 0.28 the extension uses the 1.6/1.7 plot
backend (matplotlib-pyodide's `html5_canvas_backend`) instead of WebAgg.
That backend is frozen; toolbar and layout improvements are made for
WebAgg only. To move to WebAgg, remove `base-url` or point it at Pyodide
0.28 or later (e.g. `https://cdn.jsdelivr.net/pyodide/v0.28.3/`); note that
a newer Pyodide also brings newer Python packages.

The version is read from the URL (`/v0.27.2/` or `pyodide@0.27.2`). For a
URL without a version, such as a self-hosted copy, the page picks the
backend from the Pyodide it actually loads. The choice appears in the page
as `qpyodideCanvasBackend` (`webagg`, `html5-canvas` or `auto`) and, after
the first plot, in the browser console.

### Matplotlib regression page

[`plots_test.qmd`](../plots_test.qmd) is a standalone regression page for the
interactive Matplotlib path. It covers MathText and subplot titles, toolbar
layout and navigation, the snap cursor, multiple figures from one cell, and
the explicit `canvas: false` PNG fallback. Render it from the repository root
with `quarto render plots_test.qmd`.

### Animations

An animation needs no extra call – the same code as locally:

````markdown
```{pyodide-python}
import matplotlib.pyplot as plt
import matplotlib.animation as animation
import numpy as np

fig, ax = plt.subplots()
x = np.linspace(0, 2 * np.pi, 100)
line, = ax.plot(x, np.sin(x))

def update(frame):
    line.set_ydata(np.sin(x + frame / 10))
    return line,

ani = animation.FuncAnimation(fig, update, frames=60, blit=True, interval=33)
plt.show()
```
````

In the worker there is no GUI that could drive an animation's timer – the
result would be a normally drawn still image. That means `show()` needs to
be able to find the animation belonging to a figure, and matplotlib keeps
no registry for that. The extension maintains one: a wrapper around
`matplotlib.animation.Animation.__init__` registers every created
animation (covering `FuncAnimation` and `ArtistAnimation` alike). If a
shown figure has an animation attached, it's rendered via `to_jshtml()`
into a JS player instead of a PNG.

The registry entry incidentally keeps the animation alive, so even an
animation without a variable assignment survives until `plt.show()`. If
the `show()` call is missing entirely, matplotlib warns as it would
locally with *"Animation was deleted without rendering anything"* – this
warning comes from the library and is deliberately not suppressed.

If `to_jshtml()` fails (e.g. due to a drawing function that can't be
rendered), the figure falls back to the normal PNG path; the reason
appears in the browser console. A static plot in the same cell is
rendered normally regardless, and switched to canvas if applicable.

#### Speed: `interval`, not `frames`

A common stumbling block, and not a quirk of this extension – it's the
same locally: `to_jshtml()` derives the playback speed from `ani._interval`,
the gap between two frames in milliseconds. `FuncAnimation` defaults to
**200 ms**, i.e. 5 fps, which visibly stutters. `frames` only controls
*how many* frames are drawn – more of them makes the animation longer, not
smoother.

```python
animation.FuncAnimation(fig, update, frames=60, interval=33)  # ~30 fps
zeige_animation(ani, fps=30)                                  # same, after the fact
```

With a fixed number of frames, a higher speed shortens the runtime: 60
frames take 12 seconds at 200 ms, but only 2 seconds at 33 ms. Anyone who
wants both smooth *and* long needs to raise `frames` too – and that has a
real cost, see below. The player has two speed buttons in the bottom left
(×0.7 and ÷0.7 respectively) to try this out in the browser without
re-rendering.

> **Cost:** `to_jshtml()` pre-renders *all* frames and embeds them as
> base64 PNGs in the page. With many frames, the run takes correspondingly
> longer. Beyond `plt.rcParams["animation.embed_limit"]` (default 20 MB),
> matplotlib aborts the embedding with a warning.

### `zeige_animation()` – for special cases

The helper from earlier versions is still available. For normal display it
is no longer needed; it's useful when the format or frame rate needs to be
controlled:

```python
zeige_animation(ani, format="gif")   # animated GIF instead of a player
zeige_animation(ani, fps=30)         # custom frame rate
```

It returns HTML and closes the figure itself, so it needs no
`plt.show()`. A subsequent `plt.show()` no longer finds the figure – so
there's no duplicate output. `format="gif"` requires `Pillow` to be loaded
(`pyodide: packages: [Pillow]`).

### Rich HTML output in general

If a cell's last statement returns an HTML string, it's embedded as HTML –
**including execution of embedded `<script>` tags**. `zeige_animation()`,
`zeige_svg()`, and libraries like Plotly build on this.

---

## Architecture

```
_extensions/pyodide-interaktiv/
  qpyodide.lua                                 Pandoc Lua filter (adds everything)
  ctm-bootstrap.lua                            Finds ctm-libs (generated copy, byte-identical in every CTM component)
  qpyodide-document-settings.js                Template: document-wide settings (inline classic script)
  qpyodide-locale.js                           QP_L: the UI text (ctm-libs' catalogue) in the page's language
  qpyodide-document-status.js                  Status line in the title block
  qpyodide-feedback.js                         AI feedback adapter (ctm-libs' feedback)
  qpyodide-worker-plugin.js                    This extension's part of the worker: runCell, plots, input() prompt
  qpyodide-document-engine-initialization.js   Starts the worker (ctm-libs' CTMWorker), status, restart
  qpyodide-canvas-plots.js                     Interactive plots (second Pyodide on the main thread)
  qpyodide-storage.js, qpyodide-storage-settings.js   Local-storage autosave
  qpyodide-monaco-editor-init.html             Monaco loader
  qpyodide-cell-classes.js                     EditorUnit + interactive/output/setup cells
  qpyodide-cell-initialization.js              Build cells, kick off the startup phase
  qpyodide-styling.css                         Styling on top of Bootstrap variables
_extensions/ctm-libs/                          Generated copy of ctm-libs (see installation)
```

The CSS and the modules are cacheable files (HTML dependencies
`pyodide-interaktiv` and, with feedback on, `pyodide-interaktiv-feedback`);
only the page's settings and cells are inline. The interface strings are
ctm-libs' catalogue `pyodide-interaktiv`; the Python worker, its RPC and
`coi-serviceworker.js` are ctm-libs' (`runtime/pyodide-worker.js`,
`CTMWorker`), shared with the other CTM components.

**Start-up in two stages.** First the interpreter (and `pyodide: packages`,
which a check may import): `qpyodideReady` resolves, and other components'
checks on the page can run. Then pyodide_http, micropip and matplotlib load
in the background without getting in a check's way: they download in small
pieces that pause while a check downloads, and install while nothing else
runs. This extension's cells wait for both: the status line says "Ready"
and Run is enabled only then, as before. The plot setup (importing
`pyplot`) runs with the first cell run, startup cells included. If the
extra packages cannot be loaded, the status line says so and offers
**Retry**; cells run anyway (a cell that imports matplotlib shows the
error).

Core principles of this rework compared to the earlier fork
(`Pyodide-Feedback`):

- **Python in a Web Worker:** the page stays usable during execution. On
  cross-origin-isolated pages (COOP/COEP headers), **Stop** aborts
  gracefully via `KeyboardInterrupt` (variables are preserved); otherwise
  **Stop** hard-restarts the worker (variables are lost, setup/output/
  autorun cells run again automatically).
- **One** feedback implementation (`qpyodide-feedback.js`) instead of
  duplicated cell logic; execution, output rendering, feedback, and
  settings UI are separate layers.
- No more *silent* model guessing and no Flask backend branch; instead an
  explicit **"Fetch models"** button with a free-tier filter.
- `pyodide: packages:` works again (micropip installation on startup);
  `setup`/`output` cells and `autorun` actually run after start-up.
- matplotlib renders in the worker via the AGG backend (`MPLBACKEND=AGG`);
  plots come back as PNG (instead of a live canvas in the main thread).
- Theme adaptation: CSS via `var(--bs-…)`, Monaco switches live between
  `vs`/`vs-dark` (Quarto dark mode / `prefers-color-scheme`).
- Model output is rendered escaped (mini-Markdown); errors appear as a
  clear message with HTTP status instead of `alert()`.

### Global interfaces (for other extensions)

`qpyodideReady` / `qpyodideInstance` (Promise) and `mainPyodide` provide a
**worker proxy** with RPC variants of `runPythonAsync`,
`loadPackagesFromImports`, `loadPackage`, `globals.set`, and `toPy` –
compatible with
[Erasmus-CTM/py-exercise](https://github.com/Erasmus-CTM/Py-Exercise),
which must come **after** this extension in the filter list. Direct
Pyodide internals (e.g. `pyodide.FS`) are no longer reachable from the main
thread, since the runtime lives in the worker. The contract is ctm-libs'
(`CTMWorker`, its docs/api.md).

Since 1.9 they mean **the interpreter is ready** (the first stage); the
extra packages may still be loading (`proxy.whenSetup` resolves after them).
`globalThis.qpyodideCellsReady` (and the window event
`qpyodide-cells-ready`) tell when this extension's own cells may run.
`qpyodideLang` is the resolved language (`nb`, not `no`); the global
`qpyodideLocales` is gone (`QP_L` keeps its keys). Learner code sees
`MPLBACKEND=AGG` in `os.environ`.

---

## Known limitations

- **Graceful abort requires cross-origin isolation:** `SharedArrayBuffer`
  (and thus `setInterruptBuffer`) is only available if the web server sets
  the `Cross-Origin-Opener-Policy: same-origin` and
  `Cross-Origin-Embedder-Policy: require-corp` headers. Without these
  headers, **Stop** still works – but as a hard worker restart, which
  loses all Python variables (setup cells run again).
- Only one cell can compute at a time (UI lock); the page itself stays
  usable during that.
- The runtime is reloaded when navigating to another page of the project.
  Possible extension: a **SharedWorker**, to keep Pyodide alive across
  page navigations.
- The first cell run includes the plot setup (importing `pyplot`, about a
  second or two), which before 1.9 happened before Run was enabled.
- The background download relies on the browser's cache: a private window
  does not keep the 6.7 MB matplotlib wheel in its in-memory cache, and with
  the cache switched off in the developer tools nothing is kept; then a
  check started early can wait for that download.
- Markdown output (`format: gfm`, …) keeps the cells' markup and settings
  but not the scripts (HTML dependencies are HTML-only).
- `embed-resources: true` gives a single working file, but not an offline
  one. The extension's own assets (Monaco, Font Awesome, the CSS and JS)
  are inlined, so icons and the editor come up with no external files – but
  the Pyodide runtime itself is still fetched from the CDN at load time,
  because the WebAssembly binaries cannot be embedded. Two consequences,
  both measured: the file has to be served over http(s), since opening it
  directly as a local `file://` leaves the Pyodide worker unable to start;
  and cross-origin isolation never comes up, because the COI service
  worker is inlined along with everything else and a service worker cannot
  register from an inlined script – so **Stop** degrades to a hard worker
  restart, as described above.
- HTML detection for rich output is heuristic: the return value of the
  last statement is only embedded as HTML if it looks entirely like HTML
  (starts with `<`, ends with `>`).
- Static plots come back from the worker as PNG; interactive matplotlib
  widgets (zooming into the plot) don't exist there – a second Pyodide
  instance handles that (see Canvas plots). Animations run entirely in the
  worker regardless.
- `<format>-autoexec` needs a `python3`/`python` interpreter on the machine
  that renders the document, and reproduces stdout, the trailing
  expression's value and matplotlib figures – but no other rich HTML
  output.
- `<format>-autoexec` figures are shown by `plt.show()` / `fig.show()`,
  exactly like in the browser: a figure that is never shown is discarded
  at the end of the cell instead of spilling into the next one.
  For `pdf` the PNGs are written to a `qpyodide-figures/` directory next
  to the generated `.tex` (LaTeX runs as a separate step and needs a real
  file); worth adding to `.gitignore`. Every other format embeds them
  directly into the document as `data:` URIs and leaves no files behind.
- `<format>-autoexec` puts `#| fig-cap:` on the figure, so it is captioned
  and numbered – but `#| label: fig-...` cannot be cross-referenced with
  `@fig-...`. Quarto builds its cross-reference index while normalizing
  the parsed document, which happens before any extension filter runs, so
  a figure created by this filter is invisible to it. The reference stays
  unresolved (`?@fig-...`). Use a [marker cell](#marker-cells-real-quarto-crossrefs)
  instead when the figure needs a working reference.
- A [marker cell](#marker-cells-real-quarto-crossrefs) with `#| echo: false` stays
  Quarto's plain static output instead of becoming interactive: Quarto's own engine
  already omits the source from the AST before this filter ever sees the cell, so
  there is no marker left to find. `#| include: false` behaves the same way (the
  whole cell is gone before this filter runs) but that one is the actually intended
  outcome either way.
- A marker cell that raises with `#| error: true` can leak its own marker line into
  the printed traceback in every format: Jupyter bakes the traceback's source-context
  excerpt in at execution time, before this filter runs, so it still contains the
  original line. Cosmetic only – the interactive editor in HTML still has a clean,
  marker-free copy of the source next to it.

---

## Security: cross-origin isolation and the service worker

`input()` requires `SharedArrayBuffer`, which browsers only expose under
*cross-origin isolation* for security reasons (Spectre protection). A
bundled service worker (`coi-serviceworker.js`, from ctm-libs; the file is
unchanged, so browsers see no service-worker update) sets up this isolation
automatically by attaching two headers to all responses on the page:

| Header | Value | Effect |
|--------|-------|--------|
| `Cross-Origin-Opener-Policy` | `same-origin` | prevents other pages from getting a reference to the page's window |
| `Cross-Origin-Embedder-Policy` | `credentialless` | restricts which cross-origin resources the page may load |

**These headers increase the page's security — they do not decrease it.**
`SharedArrayBuffer` is not less safe under cross-origin isolation; on the
contrary, the isolation closes exactly the attack surface (timing via
cross-origin windows) that Spectre attacks exploit. All major browser
vendors have classified and standardized this mechanism as safe.

### Scope of the service worker

The service worker registers with scope `/` on the page's domain and
therefore intercepts **all requests on that origin** — not just a single
page:

- **Own domain** (e.g. GitHub Pages `user.github.io`): no problem, the
  whole domain belongs to the project.
- **Shared domain** (e.g. `learning-platform.university.edu`): the SW
  would in theory also attach the headers to other pages on that domain,
  which can break cross-origin resources embedded there without CORS. For
  this reason, learning platforms like Moodle usually block SW
  registration – `input()` is then unavailable, and the page shows a
  corresponding notice. This is not a security problem but a
  compatibility one.

**There is no security risk for students:** either `input()` works (with
security-enhancing COI isolation), or the browser blocks the service
worker and `input()` is simply unavailable – the browser remains equally
protected in both cases.

---

## Shared AI feedback (integration branch)

AI feedback is part of ctm-libs, which is installed together with this
extension (the repository ships a copy; see [installation](installation.md)).
The Pyodide filter loads it automatically; existing filter lists need no
extra entry. The
gear opens one shared settings dialog for all exercises on the page; copy-prompt
mode is the default. Previously saved Pyodide credentials are offered for explicit
import in that dialog. Settings storage follows `ai-feedback: storage:` when it
is set, otherwise `pyodide: feedback-storage:` (default `local`; `session` keeps
settings for one tab); learners can change it in the dialog.

Supply `#| task: ...` for the assignment and optionally
`#| feedback-context: context-id` for explicitly selected prose. Omitted feedback
context collects preceding section prose. `context: none` opts out; `context: id`
selects the same reusable `.ai-context` blocks as the other integrations.
`context: interactive/setup/output` keeps its execution meaning; use the
`feedback-context` alias when configuring both. With no task, feedback reviews the code without inventing
an assignment. Three hints retain the original tutor policy: even the last hint
explains the approach in words without supplying finished code.

Feedback never runs Python. A matching completed run can contribute stdout and
a generic execution status, never raw stderr, HTML, figures or setup source.
Editing, Reset, a new Run or a worker restart invalidate that evidence and cancel
pending feedback. Selected-line runs provide no evidence for a different full
editor. Run, Stop, input, plots, setup/output, autorun, readonly and additional
editors keep their execution behavior.

Feedback follows the selected English, German, Swedish, Norwegian or Danish
language (`no` is read as `nb`); teaching instructions live in shared YAML. Shared settings support English, German and
Norwegian for these locales; Swedish and Danish use English shared controls.
`feedback: false` removes the feedback dependency (unless the page has
`.ai-feedback` activities); a page without Pyodide cells or activities loads
nothing of this extension. **A build without AI feedback**
(`ai-feedback: enabled: false` or `CTM_FEEDBACK=off`) switches Pyodide's
feedback off in any filter order and writes none of the AI-only fields
(`task`, `feedback-policy`, `feedback-context`, the policy selection and
context) into the page; a cell with `#| task:` stays a runnable cell, and an
explicit `pyodide: feedback: true` is named once in the build message.
`feedback-hints: false` uses
review mode. `npm ci && npm test` runs adapter and execution-boundary regressions. In VS Code, **Terminal → Run Task…** offers the same commands (`.vscode/tasks.json`): the default test task runs the tests, the default build task renders and then tests.
The tests use the shipped `_extensions/ctm-libs`; set `CTM_LIBS_EXTENSION`
to another ctm-libs extension folder to test against it, and
`CTM_LEGACY_AI_FEEDBACK` to an ai-feedback 0.8.1 extension folder for the
tests of old projects (CI checks it out).
The workbench in `Erasmus-CTM/ctm-assessment` pins this feature branch before any
consumer migration PR.

## Configurable shared teaching policies

AI Feedback 0.8 loads named definitions from `ai-feedback.policy-files` and
`page-policy-files` (one path or an ordered list, relative to the project root).
Files contain `ai-feedback.policies` and optional targeted `exercises` entries.
Loading a file alone does not change the baseline. Explicitly select
`project-policy` or `page-policy`; use `#| feedback-policy: name` on a cell for
an exercise specialization.

A named policy can `extend` another using `extends: parent-name`. Omitted fields
inherit from its parent and effective integration baseline. `base-prompt`
applies throughout the activity; each step adds its `step-prompt`. A supplied
`steps` list replaces the complete inherited sequence; `steps: []` selects review
mode. Step limits and solution permissions override policy-level values.
Run/Check resets by default; select `reset-on-run: false` to preserve progression.
Explicit Reset always restarts it. The old `prompt`, authored `defaults` and
`integrations` forms are rejected.

See the [shared policy guide](https://github.com/Erasmus-CTM/ctm-libs/blob/main/docs/feedback-policies.md).

### Standalone example

`example.qmd` demonstrates this package with shared feedback. Run `quarto render example.qmd` (the shipped ctm-libs is used). No other integration extension is required. The example builds automatically on pushes and pull requests; download the `standalone-example` Actions artifact. Feedback defaults to copy mode, which needs no API key.

### Page and exercise feedback policies

Put teaching policy definitions in YAML files and activate them explicitly with
`project-policy`, `page-policy` or a cell's `#| feedback-policy: name`. A policy
file registers definitions; `page-policy-files` alone does not change page
behavior. The same named policy can be reused across integrations.

YAML `ai-feedback.exercises.<integration>.<label>` targets one authored label;
an explicit named selection takes precedence over that entry. Omitted settings
inherit; `steps` replaces the entire list. See the
[shared policy guide](https://github.com/Erasmus-CTM/ctm-libs/blob/main/docs/feedback-policies.md).


### Local-storage autosave (`local-storage`)

Off by default. When enabled (`pyodide: local-storage: true`, or per cell
via `#| local-storage: true`), an editable cell's code is autosaved to the
browser's `localStorage` as the student types, and restored the next time
they open that page — **the restored code is never run automatically**;
students still have to press "Run code" themselves. Only the source code is
persisted, never output or Python variables, so the Pyodide runtime is
always recreated fresh on reload; a cell marked `context: setup` still runs
invisibly at startup exactly as before.

A cell shows a small "💾 Saved"/"💾 Restored" status next to its
Editable label, plus a 🗑 button to drop just that cell's saved copy (e.g.
before leaving a shared computer) without touching what's currently in the
editor. A cell that could save but hasn't yet gets a faint "💾 Savable"
marker instead, so it's clear at a glance which cells are actually live —
distinct from cells that are read-only or opted out. Once the live editor
content (or the saved copy itself) matches the cell's original code again —
whether because the student edited it back by hand or a restore turned out
to be a no-op — the label drops back to "Savable"/hidden on its own; it
never keeps announcing "Saved"/"Restored" for content that's no longer
actually different. The existing Reset button restores the cell's original
course code *and* clears its saved copy in one step — it asks for
confirmation first if that would discard code different from the original.
A "+ Code block" editor added by a student persists exactly like a normal
cell (save/restore/delete-all all apply to it too).

Saved code is scoped to the current page path, so identical exercises on
different pages (e.g. "Week 1" vs. "Week 2") never collide, and it never
leaves the browser (no sync between devices; clearing browser/site data
removes it, same as any other `localStorage` data).

Cells are matched to their saved code by, in order: their explicit
`#| label:` (most stable — survives the cell moving around the page), then
a hash of the cell's original code (survives reordering, not edits to the
original), disambiguated by occurrence number if identical code appears in
more than one cell. Cells without a stable label are therefore best given
one if their original code is likely to change later.

Students get their own device-wide controls, independent of the
document/cell settings above, folded into the existing gear-icon settings
panel (shown whenever AI feedback or local-storage could apply, even if the
other one is off): a "Save code in this browser" master checkbox, and
underneath it a choice between "Automatically save while typing" (default)
and "Only save cells where I click Save" (each capable cell gets an
explicit 💾 Save button instead of autosaving). Flipping either setting
applies immediately, with no page reload, and never touches or hides
code that's already saved — only whether *new* saving is currently allowed.
The panel also has two delete buttons, both with a confirmation first and
both resetting every currently open cell on the page back to its original
code afterward, so nothing gets silently autosaved right back: "Delete
saved code on this page" (only the current page) and "Delete all saved code
in this project" (every page on the site).

#### Resetting between sessions on shared computers (`local-storage-epoch`)

On lab/exam-room PCs where several people use the same browser profile in a
row, relying on every student remembering to clear their own code isn't
reliable. `pyodide: local-storage-epoch:` gives the instructor a way to
force a clean slate independent of that:

```yaml
pyodide:
  local-storage-epoch: false                 # default: off, saved code survives re-renders
  local-storage-epoch: true                  # a fresh value every render -- re-rendering alone
                                              # retires every previously saved answer on this page
  local-storage-epoch: "exam-2026-08-24-am"  # any other text: used verbatim, stable across
                                              # re-renders/redeploys until you change it by hand
```

The epoch is folded into every saved-code storage key. When it changes,
code saved under the old key simply can't be found anymore — functionally
identical to it having been cleared, without needing to hunt down and
delete each old entry (they become permanently unreachable, inert bytes in
that browser's storage until it evicts them or the profile's site data is
cleared). `true` is the "just re-render before the next group sits down"
option; a manual string is for setups where the site gets redeployed for
unrelated reasons during the exam window and an automatic per-render reset
would be too aggressive — bump the string by hand only when you actually
want a reset.

---
