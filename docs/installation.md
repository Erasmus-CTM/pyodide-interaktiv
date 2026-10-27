# Installation and setup

[Start here](../README.md) · [Authoring guide](authoring.md)

## Installation

These examples currently use the integration preview:

```bash
quarto add Erasmus-CTM/pyodide-interaktiv@feature/shared-feedback-integration
```

This installs three folders under `_extensions/Erasmus-CTM/`: the extension,
**ctm-libs** (the library of CTM Assessment, which pyodide-interaktiv runs on:
settings, languages, the Python worker, AI feedback) and an **ai-feedback**
forwarder. The repository ships a generated copy of ctm-libs
(`_extensions/ctm-libs`, recorded in `.github/ctm-libs-source.json`), so
this one command stays the whole install, and projects made for earlier
versions build unchanged after the update. Feedback is on unless
`pyodide: feedback: false`. A page that uses JSXGraph boards (`.jsxgraph`)
without the JSXGraph extension stops rendering with the install command.

Projects that commit `_extensions/`, or allow only
`_extensions/Erasmus-CTM/pyodide-interaktiv` in `.gitignore` (for example
`!_extensions/*/*/*`), add `ctm-libs` and `ai-feedback` too: without
ctm-libs next to the extension the render stops with
`Install pyodide-interaktiv again: quarto add Erasmus-CTM/pyodide-interaktiv@feature/shared-feedback-integration`.

**Projects set up for 1.8 or earlier** kept an `ai-feedback` 0.8.1 folder.
`quarto add Erasmus-CTM/pyodide-interaktiv@feature/shared-feedback-integration` replaces it with the forwarder:
`filters: [ai-feedback, ...]` keeps working, with one warning (list only
`Erasmus-CTM/pyodide-interaktiv`). A page that lists a 0.8.1 folder that was
not replaced stops with "remove ai-feedback from filters: and delete the old
folder".

**Inside CTM Assessment** (`filters: [ctm-assessment]`) the package's own
ctm-libs serves every component; the copy shipped here is not used. A page
that would combine two ctm-libs versions stops.

**Quarto 1.10:** this release sends pages with blocks such as
`{math-exercise}`, `{py-exercise}` or `{pyodide-python}` to Jupyter (an
upstream regression, reported). Until it is fixed, add `engine: markdown` to
the front matter of each such page (in `_quarto.yml` it has no effect), or use
Quarto 1.8.

Enable it in your document:

```yaml
filters:
  - Erasmus-CTM/pyodide-interaktiv
```

---


## Feedback setup

For feedback directly on the page, follow the [shared connection guide](https://github.com/Erasmus-CTM/ctm-libs/blob/main/docs/installation.md#provider-settings-and-data-sent). Without a connection, Feedback prepares a message to copy into an AI chat.

## Enable feedback in an HTML page

```yaml
filters: [pyodide-interaktiv]
ai-feedback:
  mode: copy
pyodide:
  feedback: true
```

Add a `#| task:` line to each exercise so feedback knows what students are being asked to do.

## Maintaining the shipped ctm-libs

The copies in `_extensions/ctm-libs`, `_extensions/ai-feedback` and
`_extensions/pyodide-interaktiv/ctm-bootstrap.lua` are generated from a
ctm-libs commit, never edited by hand:

```sh
python scripts/sync-ctm-libs.py ../ctm-libs          # a ctm-libs checkout at the commit to ship
```

CI (`ctm-libs.yml`) checks that they equal the recorded commit, byte for
byte. Every consolidation pull request syncs them to the ctm-libs commit
that CTM Assessment pins; a lag between pull requests is allowed. A review
commit may name another ctm-libs commit in a `CTM-Review-Refs` trailer
(`{"ctm-libs": "<sha>"}`): CI then builds and tests against it, read by the
umbrella's `tools/ci/review-dependencies.py`.
