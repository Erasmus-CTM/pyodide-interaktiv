const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM} = require('jsdom');

test('exam renderer treats executable HTML as literal text and skips canvas upgrades', async () => {
  const dom = new JSDOM('<main></main>', {runScripts:'outside-only'});
  const w = dom.window;
  w.qpyodideExamOutput = true;
  w.eval(fs.readFileSync(path.join(__dirname,'../_extensions/pyodide-interaktiv/qpyodide-cell-classes.js'),'utf8'));
  const target = w.document.querySelector('main');
  const html = '<img src="https://outside.invalid/a" onerror="while(true){}"><script>while(true){}</script>';
  await w.qpyodideRenderHtmlOutput(target,html);
  assert.equal(target.textContent,html);
  assert.equal(target.querySelector('img,script'),null);
  let upgrades = 0;
  w.qpyodideCanvasWanted = () => true;
  w.qpyodideCanvasUpgrade = () => upgrades++;
  w.qpyodideRenderPlots(target,{images:[],pickles:['PICKLE']},{});
  assert.equal(upgrades,0);
  dom.window.close();
});
