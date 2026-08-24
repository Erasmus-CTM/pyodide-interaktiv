----
--- qpyodide.lua – Pandoc Lua filter of the `pyodide-interaktiv` extension
---
--- Clean rework of coatless-quarto/pyodide with integrated,
--- provider-neutral AI feedback (OpenAI-compatible APIs).
---
--- The filter collects all `{pyodide-python}` code blocks, replaces them with
--- insertion markers, and injects the extension's JS/CSS files exactly once
--- per document. Everything runs entirely client-side (Pyodide/WebAssembly).
---
--- Injected files (order matters):
---   in-header : qpyodide-styling.css
---               qpyodide-document-settings.js   (template, placeholders get replaced)
---               qpyodide-locales.js             (UI text per language; defines QP_L)
---               qpyodide-document-status.js
---               qpyodide-feedback.js
---               qpyodide-document-engine-initialization.js
---               qpyodide-canvas-plots.js        (interaktive Plots, zweite Instanz)
---   before-body: qpyodide-monaco-editor-init.html
---   after-body : qpyodide-cell-classes.js
---                qpyodide-cell-initialization.js
---
--- A cell/document can also opt into `*-autoexec` (e.g. `pdf-autoexec`,
--- `html-autoexec`): instead of the interactive editor or a highlighted
--- source-only fallback, the cell is actually run via a local `python3`/
--- `python` interpreter at render time and replaced with its real output.
--- See collectAndRunAutoexecCells() / cellWantsAutoexecHere() below and the
--- README's "Real, executed output" section.
----

----
--- Setup variables for default initialization

-- Define a variable to check if pyodide is present.
local missingPyodideCell = true

-- Define a variable to only include the initialization once
local hasDonePyodideSetup = false

--- Setup default initialization values
-- Default values taken from:
-- https://pyodide.org/en/stable/usage/api/js-api.html#globalThis.loadPyodide

-- Define a base compatibile version
local baseVersionPyodide = "0.27.2"

-- Define where Pyodide can be found. Default:
-- https://cdn.jsdelivr.net/pyodide/v0.z.y/full/
-- https://cdn.jsdelivr.net/pyodide/v0.z.y/debug/
local baseUrl = "https://cdn.jsdelivr.net/pyodide/v".. baseVersionPyodide .."/"
local buildVariant = "full/"
local indexURL = baseUrl .. buildVariant

-- Define user directory
local homeDir = "/home/pyodide"

-- Define whether a startup status message should be displayed
local showStartUpMessage = "true"

-- Define an empty string if no packages need to be installed.
local installPythonPackagesList = "''"

----
--- Setup variables for localization (i18n)

-- Active UI language. Resolved per render pass from `pyodide: lang:` or Quarto's
-- own `lang:`; see resolveLang(). Default: English.
local lang = "en"

-- Supported locales. Extend this set together with qpyodide-locales.js.
local supportedLangs = {
  ["en"] = true,
  ["de"] = true,
  ["sv"] = true,
  ["no"] = true,
  ["nb"] = true,
  ["da"] = true
}

-- Noscript message per locale
local noscriptMessages = {
  en = "Please enable JavaScript to experience the dynamic code cell content on this page.",
  de = "Bitte JavaScript aktivieren, um die interaktiven Code-Zellen dieser Seite zu nutzen.",
  sv = "Aktivera JavaScript för att kunna använda de interaktiva kodcellerna på den här sidan.",
  no = "Slå på JavaScript for å kunne bruke de interaktive kodecellene på denne siden.",
  nb = "Slå på JavaScript for å kunne bruke de interaktive kodecellene på denne siden.",
  da = "Slå JavaScript til for at kunne bruge de interaktive kodeceller på denne side."
}

----
--- Setup variables for the AI feedback feature

-- Whether the feedback button should be rendered at all
local feedbackEnabled = "true"

-- Default persistence for the feedback configuration: "local" or "session"
local feedbackStorage = "local"

-- Whether progressive hints (hint level rises with each click) are active
local feedbackHints = "true"

----
--- Setup variables for non-interactive output formats (PDF, docx, ...)

-- Whether `{pyodide-python}` cells fall back to plain, Python-highlighted
-- source in formats where the Pyodide/WASM runtime never runs. Off by
-- default -- opt in via `pyodide: pdf-fallback: true` document-wide, or
-- `#| pdf-fallback: true` on an individual cell.
local pdfFallback = "false"

----
--- Setup variables for real, executed output in any format (`*-autoexec`)

-- Recognized `<format>-autoexec` targets, in priority order. A render only
-- ever targets a single output format, so at most one of these ever
-- matches during one render pass; the first match becomes the active key
-- (e.g. "pdf-autoexec"). Add another Quarto format name here to support
-- e.g. `revealjs-autoexec` or `pptx-autoexec`.
local autoexecFormats = { "html", "pdf", "docx" }

-- Document-wide defaults, one per `<format>-autoexec` key found under the
-- `pyodide:` YAML block (e.g. `pyodide: { pdf-autoexec: true, html-autoexec:
-- true }`). Off by default; a cell's own `#| <format>-autoexec: ...`
-- overrides its document-wide default, the same way `pdf-fallback` does.
local autoexecDocDefaults = {}

-- Output of running every opted-in cell for this render pass, filled in by
-- collectAndRunAutoexecCells() -- a Pandoc-level pass that runs before
-- enablePyodideCodeCell ever sees a cell. Stays nil if nothing opted in, or
-- if no Python interpreter could be found.
local autoexecResults = nil
local autoexecIndex = 0

----
--- Setup variables for tracking number of code cells

-- Define a counter variable
local qPyodideCounter = 0

-- Initialize a table to store the CodeBlock elements
local qPyodideCapturedCodeBlocks = {}

-- Initialize a table that contains the default cell-level options
local qPyodideDefaultCellOptions = {
  ["context"] = "interactive",
  ["warning"] = "true",
  ["message"] = "true",
  ["results"] = "markup",
  ["read-only"] = "false",
  ["output"] = "true",
  ["comment"] = "",
  ["code-fold"] = "",
  ["pdf-fallback"] = "",
  ["label"] = "",
  ["autorun"] = "",
  ["classes"] = "",
  ["dpi"] = 72,
  ["fig-cap"] = "",
  ["fig-width"] = 7,
  ["fig-height"] = 5,
  ["out-width"] = "700px",
  ["out-height"] = ""
}

----
--- Process initialization

-- Check if variable missing or an empty string
local function isVariableEmpty(s)
  return s == nil or s == ''
end

-- Check if variable is present
local function isVariablePopulated(s)
  return not isVariableEmpty(s)
end

-- Check if a raw string/boolean option value (document YAML or `#|` cell
-- comment) should be interpreted as "on".
local function isTruthy(value)
  if isVariableEmpty(value) then
    return false
  end
  local normalized = tostring(value):lower()
  return normalized == "true" or normalized == "1"
end

-- Copy the top level value and its direct children
-- Details: http://lua-users.org/wiki/CopyTable
local function shallowcopy(original)
  -- Determine if its a table
  if type(original) == 'table' then
    -- Copy the top level to remove references
    local copy = {}
    for key, value in pairs(original) do
        copy[key] = value
    end
    -- Return the copy
    return copy
  else
    -- If original is not a table, return it directly since it's already a copy
    return original
  end
end

-- Custom method for cloning a table with a shallow copy.
function table.clone(original)
  return shallowcopy(original)
end

local function mergeCellOptions(localOptions)
  -- Copy default options to the mergedOptions table
  local mergedOptions = table.clone(qPyodideDefaultCellOptions)

  -- Override default options with local options
  for key, value in pairs(localOptions) do
    if type(value) == "string" then
      value = value:gsub("[\"']", "")
    end
    mergedOptions[key] = value
  end

  -- Return the customized options
  return mergedOptions
end

-- Parse the different Pyodide options set in the YAML frontmatter, e.g.
--
-- ```yaml
-- ----
-- pyodide:
--   base-url: https://cdn.jsdelivr.net/pyodide/[version]
--   build-variant: full
--   packages: ['matplotlib', 'pandas']
--   feedback: true
--   feedback-storage: local
--   feedback-hints: true
-- ----
-- ```
--
-- Determine the UI language for this render pass.
--
-- Order of precedence:
--   1. `pyodide: lang: xx`  – explicit override
--   2. Quarto's own `lang:` – set per profile in a multilingual project
--   3. "en"                 – fallback
--
-- Region subtags are dropped ("de-DE" -> "de"); unsupported languages fall back
-- to English instead of failing the render.
local function resolveLang(meta)
  local raw = nil

  local pyodide = meta.pyodide
  if isVariablePopulated(pyodide) and isVariablePopulated(pyodide["lang"]) then
    raw = pandoc.utils.stringify(pyodide["lang"])
  elseif isVariablePopulated(meta["lang"]) then
    raw = pandoc.utils.stringify(meta["lang"])
  end

  if raw == nil or raw == "" then
    return "en"
  end

  local base = raw:lower():match("^(%a+)")
  if base and supportedLangs[base] then
    return base
  end

  return "en"
end

local function setPyodideInitializationOptions(meta)

  -- Resolve the language first: it must also work for documents that have no
  -- `pyodide:` block at all, so this happens before the early return below.
  lang = resolveLang(meta)

  -- Retrieve the pyodide options from meta
  local pyodide = meta.pyodide

  -- Does this exist? If not, just return meta as we'll just use the defaults.
  if isVariableEmpty(pyodide) then
    return meta
  end

  -- The base URL used for downloading Python WebAssembly binaries
  if isVariablePopulated(pyodide["base-url"]) then
    baseUrl = pandoc.utils.stringify(pyodide["base-url"])
  end

  -- The build variant for Python WebAssembly binaries. Default: 'full'
  if isVariablePopulated(pyodide["build-variant"]) then
    buildVariant = pandoc.utils.stringify(pyodide["build-variant"])
  end

  if isVariablePopulated(pyodide["build-variant"]) or isVariablePopulated(pyodide["base-url"]) then
    indexURL = baseUrl .. buildVariant
  end

  -- The WebAssembly user's home directory and initial working directory. Default: '/home/pyodide'
  if isVariablePopulated(pyodide['home-dir']) then
    homeDir = pandoc.utils.stringify(pyodide["home-dir"])
  end

  -- Display a startup message indicating the pyodide state at the top of the document.
  if isVariablePopulated(pyodide['show-startup-message']) then
    showStartUpMessage = pandoc.utils.stringify(pyodide["show-startup-message"])
  end

  -- Enable/disable the AI feedback button. Default: true
  if isVariablePopulated(pyodide['feedback']) then
    feedbackEnabled = pandoc.utils.stringify(pyodide["feedback"])
  end

  -- Default persistence for feedback credentials: "local" or "session"
  if isVariablePopulated(pyodide['feedback-storage']) then
    feedbackStorage = pandoc.utils.stringify(pyodide["feedback-storage"])
  end

  -- Enable/disable progressive hints. Default: true
  if isVariablePopulated(pyodide['feedback-hints']) then
    feedbackHints = pandoc.utils.stringify(pyodide["feedback-hints"])
  end

  -- Document-wide default for the PDF/non-interactive fallback. Default:
  -- false (unchanged legacy behavior). Overridable per cell via
  -- `#| pdf-fallback: ...`.
  if isVariablePopulated(pyodide['pdf-fallback']) then
    pdfFallback = pandoc.utils.stringify(pyodide["pdf-fallback"])
  end

  -- Document-wide defaults for real, executed output. Every `<name>-
  -- autoexec` key under `pyodide:` is captured here, whether or not "name"
  -- is a format this particular render matches -- only the one matching
  -- the currently active render (see autoexecFormats) is ever read back.
  for key, value in pairs(pyodide) do
    if type(key) == "string" and key:match("%-autoexec$") then
      autoexecDocDefaults[key] = pandoc.utils.stringify(value)
    end
  end

  -- Attempt to install different packages.
  if isVariablePopulated(pyodide["packages"]) then
    -- Create a custom list
    local package_list = {}

    -- Iterate through each list item and enclose it in quotes
    for _, package_name in pairs(pyodide["packages"]) do
      table.insert(package_list, "'" .. pandoc.utils.stringify(package_name) .. "'")
    end

    installPythonPackagesList = table.concat(package_list, ", ")
  end

  return meta
end


-- Read a file that lives next to this .lua filter (resolved via Quarto's path API).
local function readTemplateFile(template)
  local path = quarto.utils.resolve_path(template)
  local file = io.open(path, "r")
  if not file then
    error("\nWe were unable to read the template file `" .. template .. "` from the extension directory.\n\n" ..
          "Double check that the extension is fully available by comparing the \n" ..
          "`_extensions/Erasmus-CTM/pyodide-interaktiv` directory with the main repository:\n" ..
          "https://github.com/Erasmus-CTM/Pyodide-interaktiv/tree/main/_extensions/pyodide-interaktiv\n\n" ..
          "You may need to modify `.gitignore` to allow the extension files using:\n" ..
          "!_extensions/*/*/*\n")
    return nil
  end
  local content = file:read "*a"
  file:close()
  return content
end

-- Replace {{ KEYWORD }} placeholders in a template string.
local function substitute_in_file(contents, substitutions)
  contents = contents:gsub("{{%s*(.-)%s*}}", substitutions)
  return contents
end

local function initializationPyodide()

  -- Write cell code as JSON into an inline <script>: if the code contains
  -- the string "</script>", the HTML parser ends the script tag mid-way and
  -- the rest of the page shows up as text. "</" is therefore escaped to
  -- "<\/" (identical in JSON and JavaScript, but harmless in HTML).
  local cellDetails = quarto.json.encode(qPyodideCapturedCodeBlocks)
  cellDetails = cellDetails:gsub("</", "<\\/")

  -- Setup different Pyodide specific initialization variables
  local substitutions = {
    ["INDEXURL"] = indexURL,
    ["HOMEDIR"] = homeDir,
    ["SHOWSTARTUPMESSAGE"] = showStartUpMessage,
    ["INSTALLPYTHONPACKAGESLIST"] = installPythonPackagesList,
    ["QPYODIDECELLDETAILS"] = cellDetails,
    ["FEEDBACKENABLED"] = feedbackEnabled,
    ["FEEDBACKSTORAGE"] = feedbackStorage,
    ["FEEDBACKHINTS"] = feedbackHints,
    ["LANG"] = lang
  }

  -- Make sure we perform a copy
  local initializationTemplate = readTemplateFile("qpyodide-document-settings.js")

  -- Make the necessary substitutions
  local initializedPyodideConfiguration = substitute_in_file(initializationTemplate, substitutions)

  return initializedPyodideConfiguration
end

local function generateHTMLElement(tag)
  -- Store a map containing opening and closing tabs
  local tagMappings = {
      module = { opening = "<script type=\"module\">\n", closing = "\n</script>" },
      js = { opening = "<script type=\"text/javascript\">\n", closing = "\n</script>" },
      css = { opening = "<style type=\"text/css\">\n", closing = "\n</style>" }
  }

  -- Find the tag
  local tagMapping = tagMappings[tag]

  -- If present, extract tag and return
  if tagMapping then
      return tagMapping.opening, tagMapping.closing
  else
      quarto.log.error("Invalid tag specified")
  end
end

-- Custom functions to include values into Quarto
-- https://quarto.org/docs/extensions/lua-api.html#includes

local function includeTextInHTMLTag(location, text, tag)

  -- Obtain the HTML element opening and closing tag
  local openingTag, closingTag = generateHTMLElement(tag)

  -- Insert the file into the document using the correct opening and closing tags
  quarto.doc.include_text(location, openingTag .. text .. closingTag)

end

local function includeFileInHTMLTag(location, file, tag)

  -- Obtain the HTML element opening and closing tag
  local openingTag, closingTag = generateHTMLElement(tag)

  -- Retrieve the file contents
  local fileContents = readTemplateFile(file)

  -- Insert the file into the document using the correct opening and closing tags
  quarto.doc.include_text(location, openingTag .. fileContents .. closingTag)

end


-- Setup Pyodide's pre-requisites once per document.
local function ensurePyodideSetup()

  -- If we've included the initialization, then bail.
  if hasDonePyodideSetup then
    return
  end

  -- Otherwise, let's include the initialization script _once_
  hasDonePyodideSetup = true

  -- COI service worker: copy the file into the site root and register it in
  -- the browser. Enables SharedArrayBuffer (and thus real input()) on HTTPS
  -- hosts like GitHub Pages, without server-side COOP/COEP header config.
  --
  -- Important: io.open() with a relative path writes relative to the
  -- directory of the document CURRENTLY being rendered, not to the project
  -- root. In website projects with subfolders (e.g. Chapter_1/, Chapter_2/,
  -- ...), the file would otherwise end up scattered across the source tree
  -- (e.g. Qmd-Files/Chapter_1/coi-serviceworker.js) instead of in the actual
  -- output directory - the <script src="/coi-serviceworker.js"> reference
  -- (rewritten correctly and relatively by Quarto, see below) then points
  -- nowhere (404), even though the path in the HTML is correct.
  -- quarto.project.output_directory points to the active profile's actual
  -- output directory (e.g. docs/de); writing there fixes this. For
  -- standalone documents without a project (quarto.project is then nil),
  -- the previous document-relative path remains as a fallback.
  local coiContent = readTemplateFile("coi-serviceworker.js")
  if coiContent then
    local coiPath = "coi-serviceworker.js"
    if quarto.project and quarto.project.output_directory then
      coiPath = quarto.project.output_directory .. "/coi-serviceworker.js"
    end
    local coiOut = io.open(coiPath, "w")
    if coiOut then
      coiOut:write(coiContent)
      coiOut:close()
    end
  end
  quarto.doc.include_text("in-header", '<script src="/coi-serviceworker.js"></script>')

  local initializedConfigurationPyodide = initializationPyodide()

  -- Insert different partial files to create a monolithic document.
  -- https://quarto.org/docs/extensions/lua-api.html#includes

  -- Embed Support Files to Avoid Resource Registration Issues
  -- Note: We're not able to use embed-resources due to the web assembly binary
  -- and the potential for additional service worker files.
  quarto.doc.include_text("in-header", [[
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/monaco-editor@0.46.0/min/vs/editor/editor.main.css" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" integrity="sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA==" crossorigin="anonymous" referrerpolicy="no-referrer" />
  ]])

  -- Insert CSS styling and external style sheets
  includeFileInHTMLTag("in-header", "qpyodide-styling.css", "css")

  -- Insert the Pyodide initialization routine
  includeTextInHTMLTag("in-header", initializedConfigurationPyodide, "module")

  -- Insert the UI translations. Must come directly after the settings module
  -- (which defines globalThis.qpyodideLang) and before every module that reads
  -- globalThis.QP_L at load time.
  includeFileInHTMLTag("in-header", "qpyodide-locales.js", "module")

  -- Insert JS routine to add document status header
  includeFileInHTMLTag("in-header", "qpyodide-document-status.js", "module")

  -- Insert the AI feedback module (settings UI + API client); it deactivates
  -- itself when `pyodide: feedback: false` is set in the document metadata.
  includeFileInHTMLTag("in-header", "qpyodide-feedback.js", "module")

  -- Insert JS routine to bring Pyodide online
  includeFileInHTMLTag("in-header", "qpyodide-document-engine-initialization.js", "module")

  -- Insert the interactive-plot module (second Pyodide instance on the main
  -- thread, loaded on demand when the first plot appears)
  includeFileInHTMLTag("in-header", "qpyodide-canvas-plots.js", "module")

  -- Insert the Monaco Editor initialization
  quarto.doc.include_file("before-body", "qpyodide-monaco-editor-init.html")

  -- Insert the cell data at the end of the document
  includeFileInHTMLTag("after-body", "qpyodide-cell-classes.js", "module")

  includeFileInHTMLTag("after-body", "qpyodide-cell-initialization.js", "module")

end

local function qPyodideJSCellInsertionCode(counter)
  local insertionLocation = '<div id="qpyodide-insertion-location-' .. counter ..'"></div>\n'
  local noscriptWarning = '<noscript>' .. (noscriptMessages[lang] or noscriptMessages.en) .. '</noscript>'
  return insertionLocation .. noscriptWarning
end

-- Bridge to Quarto's own resolved document/project/profile-level options
-- (`code-fold:` today; the same primitive works for any other key Quarto
-- resolves the same way, e.g. `echo`, `eval`, `warning`, `code-summary`).
--
-- Quarto resolves these (project + profile + document, with format-level
-- defaulting) into a `param()` lookup that its own *core* filters (bundled
-- in main.lua) call as a bare global -- but that global is only injected
-- into main.lua's Lua state, not into the separate sandbox extension
-- filters run in (confirmed empirically: `param` is undefined here, while
-- `_G.param` still resolves to the same function via the shared top-level
-- `_G` table). There is no documented public replacement for this in the
-- extension Lua API as of Quarto 1.8 (`quarto.metadata.get` exists but
-- does not return format params such as `code-fold`). Reached defensively
-- so a future Quarto release that removes this can only make resolved
-- values fall back to "not set", never error out.
local function readDocumentQuartoParam(name)
  local paramFn = rawget(_G, "param")
  if type(paramFn) ~= "function" then
    return nil
  end
  local ok, value = pcall(paramFn, name)
  if not ok then
    return nil
  end
  return value
end

local function stringifyQuartoParam(value)
  if value == nil then
    return nil
  elseif type(value) == "boolean" or type(value) == "number" then
    return tostring(value)
  elseif type(value) == "string" then
    return value
  end
  local ok, result = pcall(pandoc.utils.stringify, value)
  if ok then
    return result
  end
  return nil
end

-- Resolve one Quarto-native option for a cell: the cell's own `#| <name>:`
-- override takes precedence over Quarto's document/project/profile-level
-- default for the same key; `fallback` applies when neither is set.
-- Returns the resolved value lowercased (raw strings/booleans/numbers
-- only -- callers interpret the result themselves, same as Quarto's own
-- `foldAttribute()`/`attribute()` helpers do for their respective option).
local function resolveQuartoParam(name, cellOverride, fallback)
  local raw

  if isVariablePopulated(cellOverride) then
    raw = cellOverride
  else
    raw = stringifyQuartoParam(readDocumentQuartoParam(name))
  end

  if raw == nil or raw == "" then
    return fallback
  end

  return raw:lower()
end

-- Resolve the initial fold state ("hide" = start collapsed, "show" = start
-- expanded) for one pyodide cell, mirroring Quarto's own `foldAttribute()`
-- (see share/filters/main.lua -> foldcode.lua) so that this extension picks
-- up the exact same `code-fold` setting Quarto's native code-fold uses.
--
-- Precedence:
--   1. `#| code-fold: ...` set directly on the cell
--   2. Quarto's own `code-fold:` -- document YAML, a profile, or the
--      project's `_quarto.yml`.
--   3. Neither set -> "show" (previous, unconditional default is preserved)
local function resolveFoldState(cellOverride)
  local resolved = resolveQuartoParam("code-fold", cellOverride, "show")

  if resolved == "true" or resolved == "1" or resolved == "hide" then
    return "hide"
  else
    -- Covers "false", "0", "show", "none", and anything unrecognized.
    return "show"
  end
end

-- Whether a CodeBlock is one of this extension's `{pyodide-python}` cells.
local function isPyodideCell(el)
  return el.attr and el.attr.classes:includes("{pyodide-python}")
end

-- Extract Quarto code cell options from the block's text
local function extractCodeBlockOptions(block)

  -- Access the text aspect of the code block
  local code = block.text

  -- Define two local tables:
  --  the block's attributes
  --  the block's code lines
  local cellOptions = {}
  local newCodeLines = {}

  -- Iterate over each line in the code block
  for line in code:gmatch("([^\r\n]*)[\r\n]?") do
    -- Check if the line starts with "#|" and extract the key-value pairing
    -- e.g. #| key: value goes to cellOptions[key] -> value
    local key, value = line:match("^#|%s*(.-):%s*(.-)%s*$")

    -- If a special comment is found, then add the key-value pairing to the cellOptions table
    if key and value then
      cellOptions[key] = value
    else
      -- Otherwise, it's not a special comment, keep the code line
      table.insert(newCodeLines, line)
    end
  end

  -- Merge cell options with default options
  cellOptions = mergeCellOptions(cellOptions)

  -- Set the codeblock text to exclude the special comments.
  cellCode = table.concat(newCodeLines, '\n')

  -- Return the code alongside options
  return cellCode, cellOptions
end

-- Interpret a `pdf-fallback` value (document- or cell-level, always a raw
-- string coming out of YAML/`#|` parsing) as on/off.
local function isPdfFallbackEnabled(value)
  if isVariableEmpty(value) then
    return false
  end
  local normalized = tostring(value):lower()
  return normalized == "true" or normalized == "python" or normalized == "1"
end

-- Which `<format>-autoexec` key applies to the format currently being
-- rendered, or nil if none of autoexecFormats matches (autoexec then simply
-- doesn't apply for this render -- existing pdf-fallback/interactive
-- handling is unaffected).
local function resolveAutoexecOptionKeyForCurrentFormat()
  for _, format in ipairs(autoexecFormats) do
    if quarto.doc.is_format(format) then
      return format .. "-autoexec"
    end
  end
  return nil
end

-- Whether one cell wants real, executed output for the format currently
-- being rendered: the cell's own `#| <format>-autoexec: ...` overrides the
-- document-wide default for that same key.
local function cellWantsAutoexecHere(cellOptions)
  local key = resolveAutoexecOptionKeyForCurrentFormat()
  if key == nil then
    return false
  end

  local override = cellOptions[key]
  if isVariablePopulated(override) then
    return isTruthy(override)
  end

  return isTruthy(autoexecDocDefaults[key])
end

----
--- Temp-file helpers for autoexec. Deliberately not os.tmpname(): on
--- Windows it can hand back a root-directory path that io.open() then
--- fails to create.

local autoexecTmpCounter = 0
math.randomseed(os.time())

local function autoexecTmpDir()
  return os.getenv("TMPDIR") or os.getenv("TEMP") or os.getenv("TMP") or "/tmp"
end

local function makeAutoexecTmpPath(suffix)
  autoexecTmpCounter = autoexecTmpCounter + 1
  local sep = package.config:sub(1, 1)
  return autoexecTmpDir() .. sep .. "qpyautoexec_" .. tostring(os.time()) .. "_" ..
      tostring(math.random(100000, 999999)) .. "_" .. autoexecTmpCounter .. suffix
end

-- A trailing bare expression's value is printed too (if not None), mirroring
-- how the interactive Pyodide runtime auto-displays a cell's last
-- expression. Everything else only ever prints what the code itself prints.
local autoexecDriverPrelude = [[
import ast, sys, traceback

_ns = {}

def _run(i, path, label):
    try:
        with open(path, "r", encoding="utf-8") as f:
            src = f.read()
        # Compiled under a short synthetic filename (not the real temp
        # path): keeps tracebacks short enough to fit the page and avoids
        # leaking local temp-directory/username paths into the document.
        tree = ast.parse(src, filename=label, mode="exec")
        last_expr = None
        if tree.body and isinstance(tree.body[-1], ast.Expr):
            last_expr = tree.body.pop()
        exec(compile(tree, label, "exec"), _ns)
        if last_expr is not None:
            value = eval(compile(ast.Expression(last_expr.value), label, "eval"), _ns)
            if value is not None:
                print(str(value))
    except Exception:
        # Printed to stdout on purpose: only stdout is captured by the Lua
        # side (pandoc.pipe), so an error must land there to end up in the
        # cell's own output slot instead of vanishing into the render log.
        # Frames are filtered down to the cell's own code (filename ==
        # label): without this, every traceback would also show this
        # driver's own exec/eval call sites and their real temp-file paths
        # (leaking the local username/temp dir into the rendered document),
        # the same way Jupyter/IPython hide their own execution machinery
        # from a cell's traceback.
        exc_type, exc_value, exc_tb = sys.exc_info()
        frames = [f for f in traceback.extract_tb(exc_tb) if f.filename == label]
        print("Traceback (most recent call last):")
        sys.stdout.writelines(traceback.format_list(frames))
        sys.stdout.writelines(traceback.format_exception_only(exc_type, exc_value))
    sys.stdout.flush()
    print("<<<QPYAUTOEXEC_END_%d>>>" % i)

]]

-- Run every opted-in cell's cleaned source in ONE Python subprocess, in
-- document order, sharing one namespace -- mirroring how the interactive
-- Pyodide runtime in the browser keeps state across cells. Returns a list
-- of per-cell output strings, or nil if no interpreter could be found.
local function runAutoexecCellsForReal(cellSources)
  if #cellSources == 0 then
    return {}
  end

  local tmpFiles = {}
  local driverLines = { autoexecDriverPrelude }
  for i, src in ipairs(cellSources) do
    local path = makeAutoexecTmpPath(".py")
    local f = io.open(path, "w")
    if not f then
      io.stderr:write("qpyodide.lua: could not write temp file '" .. path .. "' for autoexec.\n")
      return nil
    end
    table.insert(tmpFiles, path)
    f:write(src)
    f:close()
    local escapedPath = path:gsub("\\", "\\\\")
    table.insert(driverLines, string.format('_run(%d, "%s", "<cell %d>")', i, escapedPath, i))
  end

  local driverPath = makeAutoexecTmpPath("_driver.py")
  local df = io.open(driverPath, "w")
  if not df then
    io.stderr:write("qpyodide.lua: could not write temp driver file '" .. driverPath .. "' for autoexec.\n")
    return nil
  end
  table.insert(tmpFiles, driverPath)
  df:write(table.concat(driverLines, "\n"))
  df:close()

  local candidates = { "python3", "python" }
  local combinedOutput = nil
  for _, cmd in ipairs(candidates) do
    local ok, result = pcall(pandoc.pipe, cmd, { driverPath }, "")
    if ok then
      combinedOutput = result
      break
    end
  end

  for _, path in ipairs(tmpFiles) do
    os.remove(path)
  end

  if combinedOutput == nil then
    io.stderr:write(
      "qpyodide.lua: no Python interpreter found for autoexec (tried python3, python) -- " ..
      "leaving opted-in {pyodide-python} cells at their normal, non-autoexec handling.\n"
    )
    return nil
  end

  -- Python's print() on Windows writes CRLF (text-mode stdout); normalize
  -- to LF so the marker search below matches regardless of platform.
  combinedOutput = combinedOutput:gsub("\r\n", "\n")

  local outputs = {}
  local rest = combinedOutput
  for i = 1, #cellSources do
    local marker = "<<<QPYAUTOEXEC_END_" .. i .. ">>>\n"
    local startPos, endPos = rest:find(marker, 1, true)
    if startPos then
      outputs[i] = rest:sub(1, startPos - 1)
      rest = rest:sub(endPos + 1)
    else
      outputs[i] = rest
      rest = ""
    end
  end

  return outputs
end

-- Pandoc-level pass that runs before enablePyodideCodeCell ever sees a
-- cell: collect every opted-in {pyodide-python} cell's cleaned source, in
-- document order, and run them all together, once -- so state shared
-- between cells (e.g. a variable from an earlier cell) works the same way
-- it does in the interactive, browser-side Pyodide runtime.
local function collectAndRunAutoexecCells(doc)
  if resolveAutoexecOptionKeyForCurrentFormat() == nil then
    return doc
  end

  local cellSources = {}
  doc:walk({
    CodeBlock = function(el)
      if isPyodideCell(el) then
        local code, cellOptions = extractCodeBlockOptions(el)
        if cellWantsAutoexecHere(cellOptions) then
          table.insert(cellSources, code)
        end
      end
      return el
    end
  })

  autoexecResults = runAutoexecCellsForReal(cellSources)
  autoexecIndex = 0

  return doc
end

-- Transform a {pyodide-python} code block into its real, executed output
-- (`*-autoexec`), a Pyodide interactive editor, or plain highlighted source
-- (`pdf-fallback`) -- depending on the current format and the cell's options.
local function enablePyodideCodeCell(el)

  -- Not a Pyodide cell: leave untouched regardless of output format.
  if not isPyodideCell(el) then
    return el
  end

  local cellCode, cellOptions = extractCodeBlockOptions(el)

  -- Real, executed output takes priority over both the interactive HTML
  -- editor and the PDF/docx `pdf-fallback` static-highlight path below.
  -- collectAndRunAutoexecCells() already ran every opted-in cell (this one
  -- included) before this function ever sees them, in the same document
  -- order used here, so autoexecIndex lines up with autoexecResults.
  if cellWantsAutoexecHere(cellOptions) then
    autoexecIndex = autoexecIndex + 1

    if autoexecResults ~= nil then
      local outputText = (autoexecResults[autoexecIndex] or ""):gsub("%s+$", "")
      local blocks = { pandoc.CodeBlock(cellCode, pandoc.Attr(el.attr.identifier, { "python" }, {})) }
      if outputText ~= "" then
        table.insert(blocks, pandoc.CodeBlock(outputText, pandoc.Attr("", { "cell-output", "cell-output-stdout" }, {})))
      end
      return pandoc.Div(blocks, pandoc.Attr("", { "cell" }, {}))
    end
    -- No Python interpreter was found: fall through to the normal handling
    -- below instead of breaking the render.
  end

  -- Non-interactive output formats (PDF, docx, ...): the client-side
  -- Pyodide/WASM runtime never runs here, and Quarto's own execution
  -- engines already skipped this block during the compute phase (that's
  -- the whole point of the non-standard "pyodide-python" language tag) --
  -- so there is no computed output to show. Opt-in via
  -- `pyodide: pdf-fallback: true` (document-wide) or `#| pdf-fallback:
  -- true` (per cell, overrides the document default) to present the
  -- source as normal, properly highlighted Python instead of the raw,
  -- unstyled `{pyodide-python}` block; the `#|` cell-option comments that
  -- a real Python engine would otherwise have hidden are stripped either
  -- way. Off by default: the block passes through unchanged.
  if not (quarto.doc.is_format("html") or quarto.doc.is_format("markdown")) then
    local fallback = pdfFallback
    if isVariablePopulated(cellOptions["pdf-fallback"]) then
      fallback = cellOptions["pdf-fallback"]
    end

    if isPdfFallbackEnabled(fallback) then
      return pandoc.CodeBlock(cellCode, pandoc.Attr(el.attr.identifier, {"python"}, {}))
    end

    return el
  end

  -- We detected a Pyodide cell
  missingPyodideCell = false

  -- Resolve the initial fold state against Quarto's own `code-fold`
  -- (document/project/profile), with the cell's own `#| code-fold:` taking
  -- precedence. Overwrites the raw option with the resolved "hide"/"show".
  cellOptions["code-fold"] = resolveFoldState(cellOptions["code-fold"])

  -- Modify the counter variable each time this is run to create
  -- unique code cells
  qPyodideCounter = qPyodideCounter + 1

  -- Create a new table for the CodeBlock
  local codeBlockData = {
    id = qPyodideCounter,
    code = cellCode,
    options = cellOptions
  }

  -- Store the CodeDiv in the global table
  table.insert(qPyodideCapturedCodeBlocks, codeBlockData)

  -- Return an insertion point inside the document
  return pandoc.RawInline('html', qPyodideJSCellInsertionCode(qPyodideCounter))
end

local function stitchDocument(doc)

  -- Do not attach Pyodide as the page lacks any active Pyodide cells
  if missingPyodideCell then
    return doc
  end

  -- Release injections into the HTML document after each cell
  -- is visited and we have collected all the content.
  ensurePyodideSetup()

  return doc
end

return {
  {
    Meta = setPyodideInitializationOptions
  },
  {
    Pandoc = collectAndRunAutoexecCells
  },
  {
    CodeBlock = enablePyodideCodeCell
  },
  {
    Pandoc = stitchDocument
  }
}
