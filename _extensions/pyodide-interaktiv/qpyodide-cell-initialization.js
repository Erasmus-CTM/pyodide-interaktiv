// qpyodide-cell-initialization.js – build cells and kick off the startup phase
//
// Builds the matching cell for every code block collected by the Lua filter
// (see qpyodide-cell-classes.js) and runs the setup/output/autorun cells
// after Pyodide starts.

qpyodideCellDetails.forEach((entry) => {
  qpyodideCellContainer.addCell(qpyodideCreateCell(entry));
});

qpyodideReady
  .then(() => qpyodideCellContainer.runStartupCells())
  .catch((err) => console.error("qpyodide: startup phase failed", err));
