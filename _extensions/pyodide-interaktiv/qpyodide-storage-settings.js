// The page bar owns course privacy/deletion. This gear retains only the
// Pyodide-specific manual-save choice; it delegates enablement to CTMStore.
(function(root) {
  "use strict";
  if (!root.qpyodideStorage?.anyEnabled) return;
  const QP_L = root.QP_L;
  const section = document.createElement("div");
  section.className = "qpyodide-storage-settings-section";
  const group = document.createElement("div");
  group.className = "qpyodide-storage-mode-group";
  const choices = [
    [false, QP_L.storageModeAutoLabel, QP_L.storageModeAutoTitle],
    [true, QP_L.storageModeManualLabel, QP_L.storageModeManualTitle]
  ];
  const inputs = choices.map(([manual, label, title]) => {
    const wrapper = document.createElement("label");
    wrapper.className = "qpyodide-storage-toggle-label"; wrapper.title = title;
    const input = document.createElement("input");
    input.type = "radio"; input.name = "qpyodide-storage-mode";
    input.checked = root.qpyodideStorage.isManualMode() === manual;
    input.onchange = () => {
      if (!input.checked) return;
      root.qpyodideStorage.setManualMode(manual);
      root.qpyodideRefreshStorageUI?.();
    };
    wrapper.append(input, document.createTextNode(label)); group.append(wrapper);
    return input;
  });
  section.append(group);
  function refresh() {
    const enabled = !!root.CTMStore?.enabled();
    inputs.forEach(input => { input.disabled = !enabled; });
  }
  document.addEventListener("ctm:store-enabled", refresh); refresh();
  const feedback = root.AIFeedback;
  let dialog, open;
  if (feedback?.buildSettings) {
    dialog = feedback.buildSettings(); open = () => feedback.openSettings();
  } else {
    dialog = document.createElement("dialog"); dialog.className = "qpyodide-storage-settings";
    const title = document.createElement("h2"); title.textContent = QP_L.settingsTitleStorageOnly;
    const close = document.createElement("button");
    close.type = "button"; close.textContent = "×"; close.setAttribute("aria-label", QP_L.closeBtn || "Close");
    close.onclick = () => dialog.close ? dialog.close() : dialog.removeAttribute("open");
    dialog.append(title, close); document.body.append(dialog);
    open = () => dialog.showModal ? dialog.showModal() : dialog.setAttribute("open", "");
  }
  dialog.append(section);
  const gear = document.createElement("button"); gear.type = "button";
  gear.className = "btn btn-light btn-sm qpyodide-button qpyodide-storage-gear";
  gear.textContent = "⚙"; gear.title = QP_L.settingsTitleStorageOnly; gear.setAttribute("aria-label", gear.title);
  gear.onclick = open;
  const anchor = document.getElementById("qpyodide-status-right");
  if (anchor) anchor.append(gear);
  else {
    const first = document.querySelector('[id^="qpyodide-insertion-location-"]');
    if (first) first.before(gear); else document.body.prepend(gear);
  }
})(globalThis);
