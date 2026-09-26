// Pyodide domain adapter. Shared runtime owns settings, transport and rendering.
(function (root) {
  'use strict';
  const options = root.qpyodideFeedbackOptions || {enabled: false, hints: true};
  // Legacy document storage is a default only; explicit shared settings win.
  root.__aiFeedbackConfig = {storage: options.storage || 'local', ...root.__aiFeedbackConfig};
  const F = root.AIFeedback;
  const locale = root.QP_L;
  const language = root.qpyodideLocales?.[root.qpyodideLang] ? root.qpyodideLang : 'en';
  const uiLanguage = language === 'no' ? 'nb' : language;
  root.qpyodideFeedback = {
    enabled: !!options.enabled,
    openSettings: () => F?.openSettings(),
    attach(unit) {
      if (!this.enabled || !unit.feedbackButton) return null;
      const version = F && String(F.version).split('.').map(Number);
      const output = unit.feedbackDiv;
      output.classList.add('ai-feedback-output');
      output.setAttribute('aria-live', 'polite');
      if (!version || !(version[0] > 0 || version[1] >= 3)) {
        unit.feedbackButton.disabled = true;
        output.textContent = 'Pyodide feedback requires ai-feedback 0.3.0 or later. Update the installed extension and render again. Run remains available.';
        return null;
      }
      unit.feedbackButton.disabled = false; // Feedback needs no Python runtime.
      const gear = F.settingsButton(uiLanguage);
      gear.classList.add('qpyodide-feedback-gear');
      unit.feedbackButton.after(gear);
      return F.attach({id: 'pyodide-' + unit.uid, button: unit.feedbackButton, output,
        uiLanguage,
        getRequest() {
          const code = unit.getCode();
          const refs = unit.options?.['feedback-context'];
          const materials = refs && refs !== 'none'
            ? F.collectExplicitContexts(refs).map(ctx => ({id: ctx.id, role: 'context', text: ctx.content})) : [];
          return {profile: 'python',
            task: unit.options?.task || 'Review the learner’s current Python program against its visible code and comments. No separate assignment was supplied; do not invent requirements.',
            materials, responses: [{id: 'code', format: 'code', language: 'python', value: code}],
            evidence: unit.getEvidence(), _revision: unit.getRevision(),
            criteria: [locale.systemPrompt],
            feedback: {language: language === 'no' ? 'nb' : language,
              mode: options.hints ? 'hints' : 'review', maxWords: 250, allowFullRewrite: false,
              steps: options.hints ? [locale.hintInstructions[1], locale.hintInstructions[2], locale.hintInstructions[3]] : []}
          };
        }
      });
    }
  };
})(globalThis);
