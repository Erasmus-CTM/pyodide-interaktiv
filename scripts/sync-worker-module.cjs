// Generate a self-hosted module from the canonical compatibility plugin source.
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const dir = path.join(__dirname, '../_extensions/pyodide-interaktiv');
const context = {}; context.globalThis = context;
vm.runInNewContext(fs.readFileSync(path.join(dir, 'qpyodide-worker-plugin.js'), 'utf8'), context);
const source = 'let factory;\nconst registerPlugin = f => { factory = f; };\n' + context.QPYODIDE_WORKER_PLUGIN + '\nexport default factory;\n';
const output = path.join(dir, 'qpyodide-worker-module.js');
if (process.argv.includes('--check')) {
  if (!fs.existsSync(output) || fs.readFileSync(output, 'utf8') !== source) throw new Error('Run node scripts/sync-worker-module.cjs');
} else fs.writeFileSync(output, source);
