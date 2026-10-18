# Installation and setup

[Start here](../README.md) · [Authoring guide](authoring.md)

## Installation

These examples currently use the integration preview:

```bash
quarto add Erasmus-CTM/pyodide-interaktiv@feature/shared-feedback-integration
```

This also installs the shared ai-feedback extension that AI feedback uses: the
repository ships a copy of it (`_extensions/ai-feedback`, recorded in
`.github/ai-feedback-source.json`), so projects made for earlier versions with
built-in feedback build unchanged after the update. Feedback is on unless
`pyodide: feedback: false`; with it off, ai-feedback is not loaded. A page that
uses an optional extension that is not installed (`::: {.ai-feedback}`
activities without ai-feedback, `.jsxgraph` boards without JSXGraph) stops
rendering with the install command.

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

For feedback directly on the page, follow the [shared connection guide](https://github.com/Erasmus-CTM/ai-feedback/blob/main/docs/installation.md#provider-settings-and-data-sent). Without a connection, Feedback prepares a message to copy into an AI chat.

## Enable feedback in an HTML page

```yaml
filters: [pyodide-interaktiv]
ai-feedback:
  mode: copy
pyodide:
  feedback: true
```

Add a `#| task:` line to each exercise so feedback knows what students are being asked to do.

## Maintaining the shipped ai-feedback

The copy in `_extensions/ai-feedback` is generated, never edited by hand.
Update it from an ai-feedback checkout at the commit to ship:

```sh
python scripts/sync-ai-feedback.py ../ai-feedback
```

CI checks that the copy equals the recorded commit. This is a temporary
arrangement for existing projects, to be revisited with the maintainers; the
CTM Assessment package ignores this copy and uses its own pinned ai-feedback.
