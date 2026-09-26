// qpyodide-locales.js – UI text of the extension, per language
//
// The active language is stored in globalThis.qpyodideLang; it's set by the
// Lua filter from `pyodide: lang:` or Quarto's `lang:` (qpyodide-document-settings.js).
// This file is injected right after that and before all modules that use text.
//
// Adding a new language:
//   1. Create a block modeled on `de` (copy all keys).
//   2. Add the code to `supportedLangs` in qpyodide.lua.
//
// Values may contain HTML (many texts carry <code>, <strong>, <details>).
// Functions are used for texts with interpolated values.

globalThis.qpyodideLocales = {

  // =========================================================================
  // English
  // =========================================================================
  en: {
    // --- Cell toolbar --------------------------------------------------------
    runTitle:            "Run code (Shift + Enter)",
    runLabel:            '<i class="fa-solid fa-play qpyodide-icon-run-code"></i> <span>Run code</span>',
    runLoading:          "🟡 Python is loading …",
    labelReadOnly:       "Read-only",
    labelEditable:       "Editable",
    resetTitle:          "Reset",
    copyTitle:           "Copy code",
    feedbackTitle:       "AI feedback on the current code",
    feedbackLabel:       '<i class="fa-regular fa-comment-dots"></i> Feedback',
    showPythonCode:      "Show Python code",
    foldNudgeQuestion:   "Show all code cells?",
    foldNudgeShowAll:    "Show all",
    foldNudgeDismiss:    "No, thanks",
    addCodeBlockTitle:   "Append an additional code block",
    addCodeBlockLabel:   '<i class="fa-solid fa-plus"></i> Code block',
    runAtStartup:        "Runs at startup …",

    // --- Execution / stop ----------------------------------------------------
    stopLabel:           '<i class="fa-solid fa-stop"></i> <span>Stop</span>',
    stopTitle:           "Abort execution",
    stopTitleRestart:    "Abort execution (restarts Python, all variables are lost)",
    aborted:             "[Aborted]",
    abortedRestart:      "Aborted – Python was restarted (all variables have been reset).",

    // --- input() lock on the cell -------------------------------------------
    runTitleBlocked:     "Cannot be run – see the note below the toolbar",
    cellInputHintUnavailable:
      "⚠️ This cell uses <code>input()</code> and waits for you to type " +
      "something. To do that, Python has to pause – which needs a browser " +
      "feature that is <strong>not available</strong> on this page. The cell " +
      "therefore cannot be run here.",
    cellInputHintCheck:
      "⌨️ This cell uses <code>input()</code>, which is being enabled " +
      "right now …",
    cellInputHintNeedsReload:
      "⌨️ This cell uses <code>input()</code>, which needs a one-time " +
      "page reload to activate. Reload the page (F5) – code you have typed " +
      "is not saved, so copy it first if needed.",

    // --- Output for feedback (code was not run / run differently) ----------
    outputChanged:
      "(The code has been modified since it was last run. " +
      "Please run it again so the feedback sees the current output.)",
    outputNeedsInput:
      "(This code contains input() calls. To give feedback it has to be run " +
      "completely first – otherwise the feedback function would start it again, " +
      "it would wait for input and could not finish. " +
      "Please run the code first and provide all inputs.)",
    outputNotRun:        "(Please run the code before requesting feedback.)",

    // --- Document status line ------------------------------------------------
    loadingPython:       "🟡 Python (Pyodide) is loading …",
    engineReady:         "🟢 Ready!",
    engineFailed:        function (msg) { return "🔴 Python could not be loaded: " + msg; },
    // Worker messages: run in the Web Worker, passed there via the init
    // config (the worker doesn't see QP_L).
    workerLoading:       "Python (Pyodide) is loading in the background …",
    workerInitPackages:  "Python packages are being initialised …",
    workerExtraPackages: "Additional packages are being installed …",
    inputBtnOk:          "⌨️ <strong>input()</strong> available",
    inputBtnCheck:       "⟳ check <strong>input()</strong>",
    inputBtnUnavailable: "⚠️ <strong>input()</strong> not available",

    inputPanelIsolated:
      '<p style="margin:0 0 0.4rem"><strong>input()</strong> is active on this page.</p>' +
      '<p style="margin:0 0 0.4rem;font-size:0.88em">' +
      'Python runs here via ' +
      '<a href="https://pyodide.org" target="_blank" rel="noopener">Pyodide</a> as ' +
      '<em>WebAssembly</em> directly in the browser – without any server. That makes ' +
      '<code>input()</code> technically demanding: normally WebAssembly cannot pause ' +
      'execution to wait for keyboard input.</p>' +
      '<p style="margin:0;font-size:0.88em">' +
      'Here this is solved with <code>SharedArrayBuffer</code> + <code>Atomics.wait()</code>: ' +
      'Python runs in a web worker and "freezes" at the <code>input()</code> call while ' +
      'the page stays fully usable. For security reasons (Spectre mitigation) ' +
      '<code>SharedArrayBuffer</code> is only available under <em>cross-origin isolation</em>. ' +
      'That is why the page had to be reloaded once.</p>',

    inputPanelCheck:
      '<p style="margin:0 0 0.5rem">' +
        'Whether the Python function <code>input()</code> is available on this page can be ' +
        'determined with a <strong>single reload</strong>.' +
      '</p>' +
      '<div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.5rem">' +
        '<button type="button" id="qpyodide-coi-check-btn" class="qpyodide-button" disabled>' +
          '↺ Check now' +
        '</button>' +
        '<small id="qpyodide-coi-check-hint" class="qpyodide-input-reload-hint">' +
          'Preparing …' +
        '</small>' +
      '</div>' +
      '<details style="font-size:0.86em">' +
        '<summary style="cursor:pointer">Why is a reload necessary?</summary>' +
        '<div style="margin-top:0.4rem;padding:0.4rem 0.6rem;' +
          'background:var(--bs-tertiary-bg,#f8f9fa);' +
          'border:1px solid var(--bs-border-color,#dee2e6);border-radius:4px">' +
          '<p style="margin:0 0 0.4rem">Python runs here via ' +
          '<a href="https://pyodide.org" target="_blank" rel="noopener">Pyodide</a> as ' +
          '<em>WebAssembly</em> in the browser. For <code>input()</code> to work, ' +
          'the browser has to allow <code>SharedArrayBuffer</code> – which requires ' +
          '<em>cross-origin isolation</em>.</p>' +
          '<p style="margin:0">A <em>service worker</em> sets up this prerequisite for ' +
          'this page. For it to take effect the page has to be ' +
          '<strong>reloaded once</strong>. If that works, <code>input()</code> stays ' +
          'available from then on.</p>' +
        '</div>' +
      '</details>',

    inputPanelUnavailable:
      '<p style="margin:0 0 0.4rem">' +
        '<strong>input() is not available on this page.</strong>' +
      '</p>' +
      '<details style="font-size:0.86em">' +
        '<summary style="cursor:pointer">Why is input() not available?</summary>' +
        '<div style="margin-top:0.4rem;padding:0.4rem 0.6rem;' +
          'background:var(--bs-tertiary-bg,#f8f9fa);' +
          'border:1px solid var(--bs-border-color,#dee2e6);border-radius:4px">' +
          '<p style="margin:0 0 0.3rem">' +
          '<code>input()</code> requires <em>cross-origin isolation</em>, ' +
          'which the server has to support actively.</p>' +
          '<p style="margin:0 0 0.3rem"><strong>Typical causes:</strong></p>' +
          '<ul style="margin:0 0 0.3rem;padding-left:1.2rem">' +
            '<li>page opened directly as a file (not through a web server)</li>' +
            '<li>server does not support cross-origin isolation ' +
              '(e.g. many learning platforms such as Moodle)</li>' +
            '<li>browser has cross-origin isolation disabled</li>' +
          '</ul>' +
          '<p style="margin:0">Everything except <code>input()</code> – ' +
          'calculations, output, graphics – works normally.</p>' +
        '</div>' +
      '</details>',

    // --- Interactive plots (canvas via second Pyodide instance) -------------
    canvasPreparing:     "Preparing the interactive plot – loading a second Python environment (once per page) …",
    canvasRendering:     "Preparing the interactive plot …",
    canvasEngineFailed:  "The interactive view could not be loaded – showing the image instead.",
    canvasRenderFailed:  "This figure cannot be shown interactively – showing the image instead.",
    canvasBarValueLabel: "Value",

  },

  // =========================================================================
  // Deutsch
  // =========================================================================
  de: {
    // --- Cell toolbar --------------------------------------------------------
    runTitle:            "Code ausführen (Shift + Enter)",
    runLabel:            '<i class="fa-solid fa-play qpyodide-icon-run-code"></i> <span>Code ausführen</span>',
    runLoading:          "🟡 Python lädt …",
    labelReadOnly:       "Schreibgeschützt",
    labelEditable:       "Editierbar",
    resetTitle:          "Zurücksetzen",
    copyTitle:           "Code kopieren",
    feedbackTitle:       "KI-Feedback zum aktuellen Code",
    feedbackLabel:       '<i class="fa-regular fa-comment-dots"></i> Feedback',
    showPythonCode:      "Python-Code anzeigen",
    foldNudgeQuestion:   "Alle Code-Zellen anzeigen?",
    foldNudgeShowAll:    "Alle anzeigen",
    foldNudgeDismiss:    "Nein, danke",
    addCodeBlockTitle:   "Zusätzlichen Codeblock anhängen",
    addCodeBlockLabel:   '<i class="fa-solid fa-plus"></i> Codeblock',
    runAtStartup:        "Wird beim Start ausgeführt …",

    // --- Execution / stop ----------------------------------------------------
    stopLabel:           '<i class="fa-solid fa-stop"></i> <span>Stopp</span>',
    stopTitle:           "Ausführung abbrechen",
    stopTitleRestart:    "Ausführung abbrechen (startet Python neu, Variablen gehen verloren)",
    aborted:             "[Abgebrochen]",
    abortedRestart:      "Abgebrochen – Python wurde neu gestartet (alle Variablen wurden zurückgesetzt).",

    // --- input() lock on the cell -------------------------------------------
    runTitleBlocked:     "Ausführen nicht möglich – siehe Hinweis unter der Leiste",
    cellInputHintUnavailable:
      "⚠️ Diese Zelle nutzt <code>input()</code> und wartet damit auf eine " +
      "Eingabe. Dafür muss Python anhalten können – das erfordert eine " +
      "Browser-Funktion, die auf dieser Seite <strong>nicht zur Verfügung " +
      "steht</strong>. Die Zelle kann hier deshalb nicht ausgeführt werden.",
    cellInputHintCheck:
      "⌨️ Diese Zelle nutzt <code>input()</code>, das gerade aktiviert " +
      "wird …",
    cellInputHintNeedsReload:
      "⌨️ Diese Zelle nutzt <code>input()</code>, das einen einmaligen " +
      "Seiten-Reload braucht, um aktiviert zu werden. Seite neu laden (F5) – " +
      "getippter Code wird dabei nicht gespeichert, vorher kopieren.",

    // --- Output for feedback (code was not run / run differently) ----------
    outputChanged:
      "(Der Code wurde seit dem letzten Ausführen verändert. " +
      "Bitte den Code erneut ausführen, damit das Feedback die aktuelle Ausgabe sieht.)",
    outputNeedsInput:
      "(Dieser Code enthält input()-Aufrufe. Damit Feedback gegeben werden kann, " +
      "muss er zuerst vollständig ausgeführt werden – sonst würde die Feedback-Funktion " +
      "den Code erneut starten, dieser würde auf eine Eingabe warten und könnte nicht " +
      "zu Ende laufen. Bitte den Code zunächst ausführen und alle Eingaben tätigen.)",
    outputNotRun:        "(Bitte den Code erst ausführen, bevor Feedback angefordert wird.)",

    // --- Document status line ------------------------------------------------
    loadingPython:       "🟡 Python (Pyodide) wird geladen …",
    engineReady:         "🟢 Bereit!",
    engineFailed:        function (msg) { return "🔴 Python konnte nicht geladen werden: " + msg; },
    // Worker messages: run in the Web Worker, passed there via the init
    // config (the worker doesn't see QP_L).
    workerLoading:       "Python (Pyodide) wird im Hintergrund geladen …",
    workerInitPackages:  "Python-Pakete werden initialisiert …",
    workerExtraPackages: "Zusatzpakete werden installiert …",
    inputBtnOk:          "⌨️ <strong>input()</strong> verfügbar",
    inputBtnCheck:       "⟳ <strong>input()</strong> prüfen",
    inputBtnUnavailable: "⚠️ <strong>input()</strong> nicht verfügbar",

    inputPanelIsolated:
      '<p style="margin:0 0 0.4rem"><strong>input()</strong> ist auf dieser Seite aktiv.</p>' +
      '<p style="margin:0 0 0.4rem;font-size:0.88em">' +
      'Python läuft hier über ' +
      '<a href="https://pyodide.org" target="_blank" rel="noopener">Pyodide</a> als ' +
      '<em>WebAssembly</em> direkt im Browser – ganz ohne Server. Das macht ' +
      '<code>input()</code> technisch anspruchsvoll: Normalerweise kann WebAssembly ' +
      'die Ausführung nicht anhalten, um auf eine Tastatureingabe zu warten.</p>' +
      '<p style="margin:0;font-size:0.88em">' +
      'Hier wird das über <code>SharedArrayBuffer</code> + <code>Atomics.wait()</code> ' +
      'gelöst: Python läuft in einem Web Worker und „friert“ beim ' +
      '<code>input()</code>-Aufruf ein, während die Seite weiter bedienbar bleibt. ' +
      '<code>SharedArrayBuffer</code> ist aus Sicherheitsgründen (Spectre-Schutz) ' +
      'nur unter <em>Cross-Origin-Isolation</em> verfügbar. ' +
      'Die Seite musste dafür einmalig neu geladen werden.</p>',

    inputPanelCheck:
      '<p style="margin:0 0 0.5rem">' +
        'Ob die Python Funktion <code>input()</code> auf dieser Seite verfügbar ist, lässt sich mit ' +
        'einem <strong>einmaligen Neuladen</strong> überprüfen.' +
      '</p>' +
      '<div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.5rem">' +
        '<button type="button" id="qpyodide-coi-check-btn" class="qpyodide-button" disabled>' +
          '↺ Jetzt prüfen' +
        '</button>' +
        '<small id="qpyodide-coi-check-hint" class="qpyodide-input-reload-hint">' +
          'Wird vorbereitet …' +
        '</small>' +
      '</div>' +
      '<details style="font-size:0.86em">' +
        '<summary style="cursor:pointer">Warum ist ein Neuladen nötig?</summary>' +
        '<div style="margin-top:0.4rem;padding:0.4rem 0.6rem;' +
          'background:var(--bs-tertiary-bg,#f8f9fa);' +
          'border:1px solid var(--bs-border-color,#dee2e6);border-radius:4px">' +
          '<p style="margin:0 0 0.4rem">Python läuft hier über ' +
          '<a href="https://pyodide.org" target="_blank" rel="noopener">Pyodide</a> als ' +
          '<em>WebAssembly</em> im Browser. Damit <code>input()</code> funktioniert, ' +
          'muss der Browser <code>SharedArrayBuffer</code> freigeben – das setzt ' +
          '<em>Cross-Origin-Isolation</em> voraus.</p>' +
          '<p style="margin:0">Ein <em>Service Worker</em> richtet diese Voraussetzung ' +
          'für diese Seite ein. Damit er wirkt, muss die Seite ' +
          '<strong>einmal neu geladen</strong> werden. Klappt es, ist ' +
          '<code>input()</code> danach dauerhaft verfügbar.</p>' +
        '</div>' +
      '</details>',

    inputPanelUnavailable:
      '<p style="margin:0 0 0.4rem">' +
        '<strong>input() ist auf dieser Seite nicht verfügbar.</strong>' +
      '</p>' +
      '<details style="font-size:0.86em">' +
        '<summary style="cursor:pointer">Warum ist input() nicht verfügbar?</summary>' +
        '<div style="margin-top:0.4rem;padding:0.4rem 0.6rem;' +
          'background:var(--bs-tertiary-bg,#f8f9fa);' +
          'border:1px solid var(--bs-border-color,#dee2e6);border-radius:4px">' +
          '<p style="margin:0 0 0.3rem">' +
          '<code>input()</code> setzt <em>Cross-Origin-Isolation</em> voraus, ' +
          'die der Server aktiv unterstützen muss.</p>' +
          '<p style="margin:0 0 0.3rem"><strong>Typische Ursachen:</strong></p>' +
          '<ul style="margin:0 0 0.3rem;padding-left:1.2rem">' +
            '<li>Seite direkt als Datei geöffnet (nicht über Webserver)</li>' +
            '<li>Server unterstützt Cross-Origin-Isolation nicht ' +
              '(z. B. viele Lernplattformen wie Moodle)</li>' +
            '<li>Browser hat Cross-Origin-Isolation deaktiviert</li>' +
          '</ul>' +
          '<p style="margin:0">Alles außer <code>input()</code> – ' +
          'Berechnungen, Ausgaben, Grafiken – läuft normal.</p>' +
        '</div>' +
      '</details>',

    // --- Interactive plots (canvas via second Pyodide instance) -------------
    canvasPreparing:     "Interaktiver Plot wird vorbereitet – dafür wird einmalig pro Seite eine zweite Python-Umgebung geladen …",
    canvasRendering:     "Interaktiver Plot wird vorbereitet …",
    canvasEngineFailed:  "Die interaktive Ansicht konnte nicht geladen werden – es bleibt beim Bild.",
    canvasRenderFailed:  "Diese Figur lässt sich nicht interaktiv anzeigen – es bleibt beim Bild.",
    canvasBarValueLabel: "Wert",

  },

  // =========================================================================
  // Svenska
  // =========================================================================
  sv: {
    // --- Cell toolbar --------------------------------------------------------
    runTitle:            "Kör koden (Shift + Enter)",
    runLabel:            '<i class="fa-solid fa-play qpyodide-icon-run-code"></i> <span>Kör koden</span>',
    runLoading:          "🟡 Python laddas …",
    labelReadOnly:       "Skrivskyddad",
    labelEditable:       "Redigerbar",
    resetTitle:          "Återställ",
    copyTitle:           "Kopiera koden",
    feedbackTitle:       "AI-feedback på den aktuella koden",
    feedbackLabel:       '<i class="fa-regular fa-comment-dots"></i> Feedback',
    showPythonCode:      "Visa Python-koden",
    foldNudgeQuestion:   "Visa alla kodceller?",
    foldNudgeShowAll:    "Visa alla",
    foldNudgeDismiss:    "Nej tack",
    addCodeBlockTitle:   "Lägg till ytterligare ett kodblock",
    addCodeBlockLabel:   '<i class="fa-solid fa-plus"></i> Kodblock',
    runAtStartup:        "Körs vid start …",

    // --- Execution / stop ----------------------------------------------------
    stopLabel:           '<i class="fa-solid fa-stop"></i> <span>Stoppa</span>',
    stopTitle:           "Avbryt körningen",
    stopTitleRestart:    "Avbryt körningen (startar om Python, alla variabler går förlorade)",
    aborted:             "[Avbruten]",
    abortedRestart:      "Avbruten – Python startades om (alla variabler har återställts).",

    // --- input() lock on the cell -------------------------------------------
    runTitleBlocked:     "Går inte att köra – se anmärkningen under verktygsraden",
    cellInputHintUnavailable:
      "⚠️ Den här cellen använder <code>input()</code> och väntar på att du " +
      "skriver något. För det måste Python kunna pausa – och det kräver en " +
      "webbläsarfunktion som <strong>inte är tillgänglig</strong> på den här " +
      "sidan. Cellen kan därför inte köras här.",
    cellInputHintCheck:
      "⌨️ Den här cellen använder <code>input()</code>, som håller på att " +
      "aktiveras …",
    cellInputHintNeedsReload:
      "⌨️ Den här cellen använder <code>input()</code>, som behöver att sidan " +
      "laddas om en gång för att aktiveras. Ladda om sidan (F5) – kod som du " +
      "har skrivit sparas inte, kopiera den först om det behövs.",

    // --- Output for feedback (code was not run / run differently) ----------
    outputChanged:
      "(Koden har ändrats sedan den kördes senast. " +
      "Kör koden igen så att feedbacken ser den aktuella utskriften.)",
    outputNeedsInput:
      "(Den här koden innehåller anrop till input(). För att feedback ska kunna ges " +
      "måste den först köras helt – annars skulle feedbackfunktionen starta koden på " +
      "nytt, den skulle vänta på en inmatning och inte kunna köras klart. " +
      "Kör koden först och gör alla inmatningar.)",
    outputNotRun:        "(Kör koden innan du begär feedback.)",

    // --- Document status line ------------------------------------------------
    loadingPython:       "🟡 Python (Pyodide) laddas …",
    engineReady:         "🟢 Klart!",
    engineFailed:        function (msg) { return "🔴 Python kunde inte laddas: " + msg; },
    // Worker messages: run in the Web Worker, passed there via the init
    // config (the worker doesn't see QP_L).
    workerLoading:       "Python (Pyodide) laddas i bakgrunden …",
    workerInitPackages:  "Python-paket initieras …",
    workerExtraPackages: "Extrapaket installeras …",
    inputBtnOk:          "⌨️ <strong>input()</strong> tillgänglig",
    inputBtnCheck:       "⟳ Kontrollera <strong>input()</strong>",
    inputBtnUnavailable: "⚠️ <strong>input()</strong> inte tillgänglig",

    inputPanelIsolated:
      '<p style="margin:0 0 0.4rem"><strong>input()</strong> är aktiverad på den här sidan.</p>' +
      '<p style="margin:0 0 0.4rem;font-size:0.88em">' +
      'Python körs här via ' +
      '<a href="https://pyodide.org" target="_blank" rel="noopener">Pyodide</a> som ' +
      '<em>WebAssembly</em> direkt i webbläsaren – helt utan server. Det gör ' +
      '<code>input()</code> tekniskt krävande: normalt kan WebAssembly inte pausa ' +
      'körningen för att vänta på en inmatning.</p>' +
      '<p style="margin:0;font-size:0.88em">' +
      'Här löses det med <code>SharedArrayBuffer</code> + <code>Atomics.wait()</code>: ' +
      'Python körs i en Web Worker och ”fryser” vid anropet till ' +
      '<code>input()</code>, medan sidan fortsätter att gå att använda. ' +
      '<code>SharedArrayBuffer</code> är av säkerhetsskäl (skydd mot Spectre) ' +
      'bara tillgänglig under <em>cross-origin-isolering</em>. ' +
      'Därför måste sidan laddas om en gång.</p>',

    inputPanelCheck:
      '<p style="margin:0 0 0.5rem">' +
        'Om Python-funktionen <code>input()</code> är tillgänglig på den här sidan går ' +
        'att kontrollera genom att <strong>ladda om sidan en gång</strong>.' +
      '</p>' +
      '<div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.5rem">' +
        '<button type="button" id="qpyodide-coi-check-btn" class="qpyodide-button" disabled>' +
          '↺ Kontrollera nu' +
        '</button>' +
        '<small id="qpyodide-coi-check-hint" class="qpyodide-input-reload-hint">' +
          'Förbereds …' +
        '</small>' +
      '</div>' +
      '<details style="font-size:0.86em">' +
        '<summary style="cursor:pointer">Varför behöver sidan laddas om?</summary>' +
        '<div style="margin-top:0.4rem;padding:0.4rem 0.6rem;' +
          'background:var(--bs-tertiary-bg,#f8f9fa);' +
          'border:1px solid var(--bs-border-color,#dee2e6);border-radius:4px">' +
          '<p style="margin:0 0 0.4rem">Python körs här via ' +
          '<a href="https://pyodide.org" target="_blank" rel="noopener">Pyodide</a> som ' +
          '<em>WebAssembly</em> i webbläsaren. För att <code>input()</code> ska fungera ' +
          'måste webbläsaren tillåta <code>SharedArrayBuffer</code> – och det förutsätter ' +
          '<em>cross-origin-isolering</em>.</p>' +
          '<p style="margin:0">En <em>service worker</em> ställer in den förutsättningen ' +
          'för den här sidan. För att den ska få effekt måste sidan ' +
          '<strong>laddas om en gång</strong>. Om det fungerar är ' +
          '<code>input()</code> tillgänglig permanent därefter.</p>' +
        '</div>' +
      '</details>',

    inputPanelUnavailable:
      '<p style="margin:0 0 0.4rem">' +
        '<strong>input() är inte tillgänglig på den här sidan.</strong>' +
      '</p>' +
      '<details style="font-size:0.86em">' +
        '<summary style="cursor:pointer">Varför är input() inte tillgänglig?</summary>' +
        '<div style="margin-top:0.4rem;padding:0.4rem 0.6rem;' +
          'background:var(--bs-tertiary-bg,#f8f9fa);' +
          'border:1px solid var(--bs-border-color,#dee2e6);border-radius:4px">' +
          '<p style="margin:0 0 0.3rem">' +
          '<code>input()</code> förutsätter <em>cross-origin-isolering</em>, ' +
          'som servern aktivt måste stödja.</p>' +
          '<p style="margin:0 0 0.3rem"><strong>Vanliga orsaker:</strong></p>' +
          '<ul style="margin:0 0 0.3rem;padding-left:1.2rem">' +
            '<li>Sidan öppnad direkt som fil (inte via en webbserver)</li>' +
            '<li>Servern stöder inte cross-origin-isolering ' +
              '(t.ex. många lärplattformar som Moodle)</li>' +
            '<li>Webbläsaren har stängt av cross-origin-isolering</li>' +
          '</ul>' +
          '<p style="margin:0">Allt utom <code>input()</code> – ' +
          'beräkningar, utskrifter, grafik – fungerar som vanligt.</p>' +
        '</div>' +
      '</details>',

    // --- Interactive plots (canvas via second Pyodide instance) -------------
    canvasPreparing:     "Den interaktiva grafen förbereds – en andra Python-miljö laddas en gång per sida …",
    canvasRendering:     "Den interaktiva grafen förbereds …",
    canvasEngineFailed:  "Den interaktiva vyn kunde inte laddas – bilden visas i stället.",
    canvasRenderFailed:  "Den här figuren kan inte visas interaktivt – bilden visas i stället.",
    canvasBarValueLabel: "Värde",

  },

  // =========================================================================
  // Norsk (bokmål) – also reachable as "nb" via the alias below
  // =========================================================================
  no: {
    // --- Cell toolbar --------------------------------------------------------
    runTitle:            "Kjør koden (Shift + Enter)",
    runLabel:            '<i class="fa-solid fa-play qpyodide-icon-run-code"></i> <span>Kjør koden</span>',
    runLoading:          "🟡 Python lastes …",
    labelReadOnly:       "Skrivebeskyttet",
    labelEditable:       "Redigerbar",
    resetTitle:          "Tilbakestill",
    copyTitle:           "Kopier koden",
    feedbackTitle:       "KI-tilbakemelding på den gjeldende koden",
    feedbackLabel:       '<i class="fa-regular fa-comment-dots"></i> Tilbakemelding',
    showPythonCode:      "Vis Python-koden",
    foldNudgeQuestion:   "Vis alle kodeceller?",
    foldNudgeShowAll:    "Vis alle",
    foldNudgeDismiss:    "Nei takk",
    addCodeBlockTitle:   "Legg til enda en kodeblokk",
    addCodeBlockLabel:   '<i class="fa-solid fa-plus"></i> Kodeblokk',
    runAtStartup:        "Kjøres ved oppstart …",

    // --- Execution / stop ----------------------------------------------------
    stopLabel:           '<i class="fa-solid fa-stop"></i> <span>Stopp</span>',
    stopTitle:           "Avbryt kjøringen",
    stopTitleRestart:    "Avbryt kjøringen (starter Python på nytt, alle variabler går tapt)",
    aborted:             "[Avbrutt]",
    abortedRestart:      "Avbrutt – Python ble startet på nytt (alle variabler er tilbakestilt).",

    // --- input() lock on the cell -------------------------------------------
    runTitleBlocked:     "Kan ikke kjøres – se merknaden under verktøylinjen",
    cellInputHintUnavailable:
      "⚠️ Denne cellen bruker <code>input()</code> og venter på at du skriver " +
      "noe. For at det skal gå, må Python kunne stoppe midlertidig – og det " +
      "krever en nettleserfunksjon som <strong>ikke er tilgjengelig</strong> på " +
      "denne siden. Cellen kan derfor ikke kjøres her.",
    cellInputHintCheck:
      "⌨️ Denne cellen bruker <code>input()</code>, som holder på å bli " +
      "aktivert …",
    cellInputHintNeedsReload:
      "⌨️ Denne cellen bruker <code>input()</code>, som krever at siden lastes " +
      "inn på nytt én gang for å bli aktivert. Last inn siden på nytt (F5) – " +
      "kode du har skrevet, blir ikke lagret, så kopier den først ved behov.",

    // --- Output for feedback (code was not run / run differently) ----------
    outputChanged:
      "(Koden er endret siden den sist ble kjørt. " +
      "Kjør koden på nytt slik at tilbakemeldingen ser den gjeldende utskriften.)",
    outputNeedsInput:
      "(Denne koden inneholder kall til input(). For at det skal kunne gis tilbakemelding, " +
      "må den først kjøres helt gjennom – ellers ville tilbakemeldingsfunksjonen startet " +
      "koden på nytt, den ville ventet på en inntasting og ikke kunnet kjøre ferdig. " +
      "Kjør koden først og gjør alle inntastingene.)",
    outputNotRun:        "(Kjør koden før du ber om tilbakemelding.)",

    // --- Document status line ------------------------------------------------
    loadingPython:       "🟡 Python (Pyodide) lastes …",
    engineReady:         "🟢 Klar!",
    engineFailed:        function (msg) { return "🔴 Python kunne ikke lastes: " + msg; },
    // Worker messages: run in the Web Worker, passed there via the init
    // config (the worker doesn't see QP_L).
    workerLoading:       "Python (Pyodide) lastes i bakgrunnen …",
    workerInitPackages:  "Python-pakker initialiseres …",
    workerExtraPackages: "Tilleggspakker installeres …",
    inputBtnOk:          "⌨️ <strong>input()</strong> tilgjengelig",
    inputBtnCheck:       "⟳ Sjekk <strong>input()</strong>",
    inputBtnUnavailable: "⚠️ <strong>input()</strong> ikke tilgjengelig",

    inputPanelIsolated:
      '<p style="margin:0 0 0.4rem"><strong>input()</strong> er aktiv på denne siden.</p>' +
      '<p style="margin:0 0 0.4rem;font-size:0.88em">' +
      'Python kjører her via ' +
      '<a href="https://pyodide.org" target="_blank" rel="noopener">Pyodide</a> som ' +
      '<em>WebAssembly</em> direkte i nettleseren – helt uten server. Det gjør ' +
      '<code>input()</code> teknisk krevende: normalt kan WebAssembly ikke stoppe ' +
      'kjøringen for å vente på en inntasting.</p>' +
      '<p style="margin:0;font-size:0.88em">' +
      'Her løses det med <code>SharedArrayBuffer</code> + <code>Atomics.wait()</code>: ' +
      'Python kjører i en Web Worker og «fryser» ved kallet til ' +
      '<code>input()</code>, mens siden fortsatt kan brukes. ' +
      '<code>SharedArrayBuffer</code> er av sikkerhetsgrunner (Spectre-beskyttelse) ' +
      'bare tilgjengelig under <em>cross-origin-isolering</em>. ' +
      'Derfor måtte siden lastes inn på nytt én gang.</p>',

    inputPanelCheck:
      '<p style="margin:0 0 0.5rem">' +
        'Om Python-funksjonen <code>input()</code> er tilgjengelig på denne siden, kan ' +
        'sjekkes ved å <strong>laste inn siden på nytt én gang</strong>.' +
      '</p>' +
      '<div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.5rem">' +
        '<button type="button" id="qpyodide-coi-check-btn" class="qpyodide-button" disabled>' +
          '↺ Sjekk nå' +
        '</button>' +
        '<small id="qpyodide-coi-check-hint" class="qpyodide-input-reload-hint">' +
          'Forberedes …' +
        '</small>' +
      '</div>' +
      '<details style="font-size:0.86em">' +
        '<summary style="cursor:pointer">Hvorfor må siden lastes inn på nytt?</summary>' +
        '<div style="margin-top:0.4rem;padding:0.4rem 0.6rem;' +
          'background:var(--bs-tertiary-bg,#f8f9fa);' +
          'border:1px solid var(--bs-border-color,#dee2e6);border-radius:4px">' +
          '<p style="margin:0 0 0.4rem">Python kjører her via ' +
          '<a href="https://pyodide.org" target="_blank" rel="noopener">Pyodide</a> som ' +
          '<em>WebAssembly</em> i nettleseren. For at <code>input()</code> skal virke, ' +
          'må nettleseren gi tilgang til <code>SharedArrayBuffer</code> – og det ' +
          'forutsetter <em>cross-origin-isolering</em>.</p>' +
          '<p style="margin:0">En <em>service worker</em> setter opp denne forutsetningen ' +
          'for siden. For at den skal virke, må siden ' +
          '<strong>lastes inn på nytt én gang</strong>. Går det bra, er ' +
          '<code>input()</code> varig tilgjengelig etterpå.</p>' +
        '</div>' +
      '</details>',

    inputPanelUnavailable:
      '<p style="margin:0 0 0.4rem">' +
        '<strong>input() er ikke tilgjengelig på denne siden.</strong>' +
      '</p>' +
      '<details style="font-size:0.86em">' +
        '<summary style="cursor:pointer">Hvorfor er input() ikke tilgjengelig?</summary>' +
        '<div style="margin-top:0.4rem;padding:0.4rem 0.6rem;' +
          'background:var(--bs-tertiary-bg,#f8f9fa);' +
          'border:1px solid var(--bs-border-color,#dee2e6);border-radius:4px">' +
          '<p style="margin:0 0 0.3rem">' +
          '<code>input()</code> forutsetter <em>cross-origin-isolering</em>, ' +
          'som serveren aktivt må støtte.</p>' +
          '<p style="margin:0 0 0.3rem"><strong>Typiske årsaker:</strong></p>' +
          '<ul style="margin:0 0 0.3rem;padding-left:1.2rem">' +
            '<li>Siden er åpnet direkte som fil (ikke via en webserver)</li>' +
            '<li>Serveren støtter ikke cross-origin-isolering ' +
              '(f.eks. mange læringsplattformer som Moodle)</li>' +
            '<li>Nettleseren har slått av cross-origin-isolering</li>' +
          '</ul>' +
          '<p style="margin:0">Alt annet enn <code>input()</code> – ' +
          'beregninger, utskrifter, grafikk – virker som normalt.</p>' +
        '</div>' +
      '</details>',

    // --- Interactive plots (canvas via second Pyodide instance) -------------
    canvasPreparing:     "Den interaktive grafen forberedes – et andre Python-miljø lastes én gang per side …",
    canvasRendering:     "Den interaktive grafen forberedes …",
    canvasEngineFailed:  "Den interaktive visningen kunne ikke lastes – bildet vises i stedet.",
    canvasRenderFailed:  "Denne figuren kan ikke vises interaktivt – bildet vises i stedet.",
    canvasBarValueLabel: "Verdi",

  },

  // =========================================================================
  // Dansk
  // =========================================================================
  da: {
    // --- Cell toolbar --------------------------------------------------------
    runTitle:            "Kør koden (Shift + Enter)",
    runLabel:            '<i class="fa-solid fa-play qpyodide-icon-run-code"></i> <span>Kør koden</span>',
    runLoading:          "🟡 Python indlæses …",
    labelReadOnly:       "Skrivebeskyttet",
    labelEditable:       "Redigerbar",
    resetTitle:          "Nulstil",
    copyTitle:           "Kopiér koden",
    feedbackTitle:       "AI-feedback på den aktuelle kode",
    feedbackLabel:       '<i class="fa-regular fa-comment-dots"></i> Feedback',
    showPythonCode:      "Vis Python-koden",
    foldNudgeQuestion:   "Vis alle kodeceller?",
    foldNudgeShowAll:    "Vis alle",
    foldNudgeDismiss:    "Nej tak",
    addCodeBlockTitle:   "Tilføj endnu en kodeblok",
    addCodeBlockLabel:   '<i class="fa-solid fa-plus"></i> Kodeblok',
    runAtStartup:        "Køres ved opstart …",

    // --- Execution / stop ----------------------------------------------------
    stopLabel:           '<i class="fa-solid fa-stop"></i> <span>Stop</span>',
    stopTitle:           "Afbryd kørslen",
    stopTitleRestart:    "Afbryd kørslen (genstarter Python, alle variabler går tabt)",
    aborted:             "[Afbrudt]",
    abortedRestart:      "Afbrudt – Python blev genstartet (alle variabler er nulstillet).",

    // --- input() lock on the cell -------------------------------------------
    runTitleBlocked:     "Kan ikke køres – se bemærkningen under værktøjslinjen",
    cellInputHintUnavailable:
      "⚠️ Denne celle bruger <code>input()</code> og venter på, at du skriver " +
      "noget. For at det kan lade sig gøre, skal Python kunne holde pause – og " +
      "det kræver en browserfunktion, der <strong>ikke er tilgængelig</strong> " +
      "på denne side. Cellen kan derfor ikke køres her.",
    cellInputHintCheck:
      "⌨️ Denne celle bruger <code>input()</code>, som er ved at blive " +
      "aktiveret …",
    cellInputHintNeedsReload:
      "⌨️ Denne celle bruger <code>input()</code>, som kræver, at siden " +
      "genindlæses én gang for at blive aktiveret. Genindlæs siden (F5) – " +
      "kode, du har skrevet, gemmes ikke, så kopiér den først efter behov.",

    // --- Output for feedback (code was not run / run differently) ----------
    outputChanged:
      "(Koden er ændret, siden den sidst blev kørt. " +
      "Kør koden igen, så feedbacken ser den aktuelle udskrift.)",
    outputNeedsInput:
      "(Denne kode indeholder kald til input(). For at der kan gives feedback, " +
      "skal den først køres helt igennem – ellers ville feedbackfunktionen starte " +
      "koden igen, den ville vente på et input og ikke kunne køre færdig. " +
      "Kør koden først, og foretag alle input.)",
    outputNotRun:        "(Kør koden, før du beder om feedback.)",

    // --- Document status line ------------------------------------------------
    loadingPython:       "🟡 Python (Pyodide) indlæses …",
    engineReady:         "🟢 Klar!",
    engineFailed:        function (msg) { return "🔴 Python kunne ikke indlæses: " + msg; },
    // Worker messages: run in the Web Worker, passed there via the init
    // config (the worker doesn't see QP_L).
    workerLoading:       "Python (Pyodide) indlæses i baggrunden …",
    workerInitPackages:  "Python-pakker initialiseres …",
    workerExtraPackages: "Ekstra pakker installeres …",
    inputBtnOk:          "⌨️ <strong>input()</strong> tilgængelig",
    inputBtnCheck:       "⟳ Kontrollér <strong>input()</strong>",
    inputBtnUnavailable: "⚠️ <strong>input()</strong> ikke tilgængelig",

    inputPanelIsolated:
      '<p style="margin:0 0 0.4rem"><strong>input()</strong> er aktiv på denne side.</p>' +
      '<p style="margin:0 0 0.4rem;font-size:0.88em">' +
      'Python kører her via ' +
      '<a href="https://pyodide.org" target="_blank" rel="noopener">Pyodide</a> som ' +
      '<em>WebAssembly</em> direkte i browseren – helt uden server. Det gør ' +
      '<code>input()</code> teknisk krævende: normalt kan WebAssembly ikke sætte ' +
      'kørslen på pause for at vente på et input.</p>' +
      '<p style="margin:0;font-size:0.88em">' +
      'Her løses det med <code>SharedArrayBuffer</code> + <code>Atomics.wait()</code>: ' +
      'Python kører i en Web Worker og »fryser« ved kaldet til ' +
      '<code>input()</code>, mens siden fortsat kan bruges. ' +
      '<code>SharedArrayBuffer</code> er af sikkerhedsgrunde (Spectre-beskyttelse) ' +
      'kun tilgængelig under <em>cross-origin-isolering</em>. ' +
      'Derfor skulle siden genindlæses én gang.</p>',

    inputPanelCheck:
      '<p style="margin:0 0 0.5rem">' +
        'Om Python-funktionen <code>input()</code> er tilgængelig på denne side, kan ' +
        'kontrolleres ved at <strong>genindlæse siden én gang</strong>.' +
      '</p>' +
      '<div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.5rem">' +
        '<button type="button" id="qpyodide-coi-check-btn" class="qpyodide-button" disabled>' +
          '↺ Kontrollér nu' +
        '</button>' +
        '<small id="qpyodide-coi-check-hint" class="qpyodide-input-reload-hint">' +
          'Forberedes …' +
        '</small>' +
      '</div>' +
      '<details style="font-size:0.86em">' +
        '<summary style="cursor:pointer">Hvorfor skal siden genindlæses?</summary>' +
        '<div style="margin-top:0.4rem;padding:0.4rem 0.6rem;' +
          'background:var(--bs-tertiary-bg,#f8f9fa);' +
          'border:1px solid var(--bs-border-color,#dee2e6);border-radius:4px">' +
          '<p style="margin:0 0 0.4rem">Python kører her via ' +
          '<a href="https://pyodide.org" target="_blank" rel="noopener">Pyodide</a> som ' +
          '<em>WebAssembly</em> i browseren. For at <code>input()</code> kan virke, ' +
          'skal browseren give adgang til <code>SharedArrayBuffer</code> – og det ' +
          'forudsætter <em>cross-origin-isolering</em>.</p>' +
          '<p style="margin:0">En <em>service worker</em> opsætter denne forudsætning ' +
          'for siden. For at den kan virke, skal siden ' +
          '<strong>genindlæses én gang</strong>. Lykkes det, er ' +
          '<code>input()</code> varigt tilgængelig derefter.</p>' +
        '</div>' +
      '</details>',

    inputPanelUnavailable:
      '<p style="margin:0 0 0.4rem">' +
        '<strong>input() er ikke tilgængelig på denne side.</strong>' +
      '</p>' +
      '<details style="font-size:0.86em">' +
        '<summary style="cursor:pointer">Hvorfor er input() ikke tilgængelig?</summary>' +
        '<div style="margin-top:0.4rem;padding:0.4rem 0.6rem;' +
          'background:var(--bs-tertiary-bg,#f8f9fa);' +
          'border:1px solid var(--bs-border-color,#dee2e6);border-radius:4px">' +
          '<p style="margin:0 0 0.3rem">' +
          '<code>input()</code> forudsætter <em>cross-origin-isolering</em>, ' +
          'som serveren aktivt skal understøtte.</p>' +
          '<p style="margin:0 0 0.3rem"><strong>Typiske årsager:</strong></p>' +
          '<ul style="margin:0 0 0.3rem;padding-left:1.2rem">' +
            '<li>Siden er åbnet direkte som fil (ikke via en webserver)</li>' +
            '<li>Serveren understøtter ikke cross-origin-isolering ' +
              '(f.eks. mange læringsplatforme som Moodle)</li>' +
            '<li>Browseren har slået cross-origin-isolering fra</li>' +
          '</ul>' +
          '<p style="margin:0">Alt andet end <code>input()</code> – ' +
          'beregninger, udskrifter, grafik – virker som normalt.</p>' +
        '</div>' +
      '</details>',

    // --- Interactive plots (canvas via second Pyodide instance) -------------
    canvasPreparing:     "Det interaktive plot forberedes – der indlæses et andet Python-miljø én gang pr. side …",
    canvasRendering:     "Det interaktive plot forberedes …",
    canvasEngineFailed:  "Den interaktive visning kunne ikke indlæses – billedet vises i stedet.",
    canvasRenderFailed:  "Denne figur kan ikke vises interaktivt – billedet vises i stedet.",
    canvasBarValueLabel: "Værdi",

  }
};

// Norwegian: Bokmål is reachable under both common codes.
globalThis.qpyodideLocales.nb = globalThis.qpyodideLocales.no;

// Resolve the active language. Unknown language -> English (never undefined).
globalThis.QP_L = globalThis.qpyodideLocales[globalThis.qpyodideLang] ||
                  globalThis.qpyodideLocales.en;
