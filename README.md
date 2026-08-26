# pyodide-interaktiv – Quarto Extension

**A clean rework of [coatless-quarto/pyodide](https://github.com/coatless-quarto/pyodide)
that runs Python in a Web Worker** — the page stays responsive during execution, long
computations no longer freeze the tab, and every cell has a Stop button.
Includes a full **AI Feedback** feature: each interactive Python cell gets a Feedback button
that sends the current code plus runtime output to any OpenAI-compatible LLM (or, without
an API key, generates a ready-to-paste prompt for ChatGPT/Claude/etc.).
Everything runs client-side via [Pyodide](https://pyodide.org) (WebAssembly) — no server, no Python kernel required.

---

## Installation

```bash
quarto add Erasmus-CTM/Pyodide-interaktiv
```

Enable it in your document:

```yaml
filters:
  - Erasmus-CTM/pyodide-interaktiv
```

---

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

### Quick start for beginners

**Without an API key** (simplest way):

1. Click the **⚙ icon** at the top.
2. Select feedback mode **"Copy prompt"** and save.
3. Click **Feedback** on a cell → paste the generated text into
   ChatGPT, Claude, etc. Done.

**With a free API key** (feedback appears directly on the page):

1. Create a free account at [OpenRouter](https://openrouter.ai) and
   generate a key at [openrouter.ai/keys](https://openrouter.ai/keys).
2. In the panel, select the **"OpenRouter" provider preset** — the base URL
   and a free model are filled in automatically — and paste the key.
3. Optional: click **"Fetch models"** — by default the list shows
   **only free models** (so nobody accidentally spends money);
   clicking one fills the model field.
4. Save. The panel collapses, and every cell now has a working
   **Feedback** button.

### Setup (all fields)

The **⚙ icon** at the top of the document opens the collapsible settings
panel for:

| Field | Meaning |
|-------|---------|
| Provider preset | fills in the base URL + example model for OpenRouter, Cerebras, Groq, OpenAI, or Ollama |
| Base URL | the API endpoint, e.g. `https://openrouter.ai/api/v1` |
| API key | stays strictly local in the browser |
| Model | freely editable; **"Fetch models"** lists the provider's models — by default only free ones (with a warning for providers that don't expose pricing info) |
| Feedback mode | **Direct API** (default) or **Copy prompt** |
| Storage | `localStorage` (persistent) or `sessionStorage` (per tab) |

The panel collapses automatically after saving. The ℹ️ button gives
beginner-friendly, per-provider guidance on where to find the base URL,
key, and a (free) model.

### Supported providers (any OpenAI-compatible API)

The call is a generic `POST {baseUrl}/chat/completions` with
`Authorization: Bearer {key}`; both `max_tokens` **and**
`max_completion_tokens` are set (with automatic retry if a provider
rejects one of the fields).

| Provider | Base URL | Note |
|----------|---------|------|
| [OpenRouter](https://openrouter.ai) | `https://openrouter.ai/api/v1` | free models have a `:free` suffix |
| [Cerebras](https://cloud.cerebras.ai) | `https://api.cerebras.ai/v1` | very fast, free tier |
| [Groq](https://console.groq.com) | `https://api.groq.com/openai/v1` | fast, free tier |
| [OpenAI](https://platform.openai.com) | `https://api.openai.com/v1` | paid |
| [Ollama](https://ollama.com) (local) | `http://localhost:11434/v1` | no API key needed |

### "Copy prompt" mode (no API key)

Clicking **Feedback** generates a copyable text **including the system
prompt**, which can be pasted into ChatGPT, Claude, etc.

### Clicking Feedback before setup is done

If a cell's Feedback button is clicked before the base URL/model are
configured, the error message includes its own **⚙ button**. Clicking it
moves the (single, shared) settings panel right into that cell, next to
the error — no scrolling anywhere. Clicking the gear icon at the top of
the page instead moves the panel back there.

### Progressive hints

The hint level rises with each click of the Feedback button on the same
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
  base-url: https://cdn.jsdelivr.net/pyodide/v0.27.2/
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
**Norwegian Bokmål (`no`, also as `nb`)**, and **Danish (`da`)**.
**The default is English** – without any setting, the UI appears in English.
Any additional language can be added yourself, see
[Adding another language](#adding-another-language).

The extension reads the language in this order:

1. `pyodide: lang:` – explicit override
2. **Quarto's own `lang:`** – the normal case
3. `en` – fallback

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

All visible text lives in **one** place:
`_extensions/pyodide-interaktiv/qpyodide-locales.js`. It has one block per
language (`en`, `de`, `sv`, `no`, `da`) with an identical set of keys.

**1. Create a language block.** Copy the `en` or `de` block, change the
language code, and translate the values. **All** keys must be present –
if one is missing, that label will later be `undefined`.

Only what a human reads gets translated. These stay unchanged:

| Stays unchanged | Example |
|---|---|
| HTML markup and CSS classes | `<i class="fa-solid fa-play">`, `<strong>` |
| Element IDs (referenced by JavaScript) | `qpyodide-coi-check-btn`, `qpyodide-coi-check-hint` |
| Python and web identifiers | `input()`, `SharedArrayBuffer`, `Atomics.wait()` |
| API field names and URLs | `Base URL`, `choices[0].message.content` |

Five entries are **functions**, not strings (`engineFailed`,
`feedbackHintLevel`, `modelChoose`, `errModelListFailed`,
`modelHintKeyNeeded`); `hintInstructions` is an object with levels `1`–`3`.
This structure must be preserved – only the text inside gets translated.

Two content requirements in the `systemPrompt`: the instruction to answer
**in the respective language**, and the length limit of **about 250
words**, must be present in every language – otherwise AI feedback gets
cut off mid-sentence.

**2. Register the language code.** In
`_extensions/pyodide-interaktiv/qpyodide.lua`, add it in two places:

```lua
local supportedLangs = {
  ["en"] = true,
  ["fr"] = true          -- new
}

local noscriptMessages = {
  en = "Please enable JavaScript …",
  fr = "Veuillez activer JavaScript …"   -- new
}
```

Without an entry in `supportedLangs`, the filter silently falls back to
English, even if the block exists in the JS file.

**3. Multiple codes for the same language** (optional). Norwegian shows
the pattern: the block is called `no`, but is also reachable as `nb`. For
that, there's an alias line at the end of `qpyodide-locales.js`, and
**both** codes are in `supportedLangs`:

```js
globalThis.qpyodideLocales.nb = globalThis.qpyodideLocales.no;
```

**4. Verify.** Regional variants are shortened to the base code (`sv-SE` →
`sv`); an unknown code silently falls back to English. Whether the new
block is complete can be checked against `en`:

```bash
deno eval "eval(Deno.readTextFileSync('_extensions/pyodide-interaktiv/qpyodide-locales.js'));
const L = globalThis.qpyodideLocales, base = Object.keys(L.en);
for (const l of Object.keys(L))
  console.log(l, base.filter(k => !(k in L[l])).join(', ') || 'complete');"
```

Then `deno check _extensions/pyodide-interaktiv/qpyodide-locales.js`
(syntax check) and a test render with `lang: <code>`.

> `deno` doesn't need to be installed separately – Quarto ships it, on
> Windows under `%LOCALAPPDATA%\Programs\Quarto\bin\tools\x86_64\deno.exe`,
> on macOS/Linux in the corresponding `bin/tools` directory of the Quarto
> installation.

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
  qpyodide.lua                                 Pandoc Lua filter (injects everything)
  qpyodide-document-settings.js                Template: document-wide settings
  qpyodide-document-status.js                  Status line in the title block
  qpyodide-feedback.js                         AI feedback: settings UI + API client
  qpyodide-document-engine-initialization.js   Pyodide worker (boot, RPC, interrupt/restart)
  qpyodide-monaco-editor-init.html             Monaco loader
  qpyodide-cell-classes.js                     EditorUnit + interactive/output/setup cells
  qpyodide-cell-initialization.js              Build cells, kick off the startup phase
  qpyodide-styling.css                         Styling on top of Bootstrap variables
```

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
  `setup`/`output` cells and `autorun` actually run after boot.
- matplotlib renders in the worker via the AGG backend; plots come back as
  PNG (instead of a live canvas in the main thread).
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
thread, since the runtime lives in the worker.

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
- `embed-resources` is not supported because of the WebAssembly binaries.
- HTML detection for rich output is heuristic: the return value of the
  last statement is only embedded as HTML if it looks entirely like HTML
  (starts with `<`, ends with `>`).
- Static plots come back from the worker as PNG; interactive matplotlib
  widgets (zooming into the plot) don't exist there – a second Pyodide
  instance handles that (see Canvas plots). Animations run entirely in the
  worker regardless.
- `<format>-autoexec` needs a `python3`/`python` interpreter on the machine
  that renders the document, and only reproduces stdout/the trailing
  expression's value, not matplotlib figures or other rich HTML output.
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
bundled service worker (`coi-serviceworker.js`) sets up this isolation
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

## Funding

Part of this work was funded by the Erasmus+ project “Computational
Thinking makes sense of Mathematics” (2023-1-NO01-KA220-HED-000166744).

## Origin and license

Fork of [coatless-quarto/pyodide](https://github.com/coatless-quarto/pyodide)
by James Joseph Balamuta. The upstream repository currently has no LICENSE
file – nor has it ever had one in its commit history – so the license
status of the code carried over from it is unclear and not covered by
"MIT" or any other license.

Own additions and modifications by CTM Workshop (including the Web Worker
architecture, AI feedback, canvas plots, and multilingual support) are
licensed under the
[GNU Affero General Public License v3.0](LICENSE).

`coi-serviceworker.js` is based on
[gzuidhof/coi-serviceworker](https://github.com/gzuidhof/coi-serviceworker)
(MIT license).
