const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const css=fs.readFileSync(path.join(__dirname,'../_extensions/pyodide-interaktiv/qpyodide-styling.css'),'utf8');
const status=fs.readFileSync(path.join(__dirname,'../_extensions/pyodide-interaktiv/qpyodide-document-status.js'),'utf8');
const icon=/<i class="fa-solid fa-spinner fa-spin qpyodide-icon-status-spinner"><\/i>/.exec(status)[0];
// Representative SVG markup with an abbreviated path. These JSDOM computed-CSS
// fixtures do not exercise real vendor replacement, layout or animation playback.
const svg='<svg class="svg-inline--fa fa-spinner fa-spin qpyodide-icon-status-spinner" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="spinner" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M304 48a48 48 0 1 0 -96 0 48 48 0 1 0 96 0z"></path></svg>';
function sized(window,node){
  const style=window.getComputedStyle(node);
  assert.equal(style.display,'inline-block');
  assert.equal(style.width,'1em');
  assert.equal(style.height,'1em');
}
test('owned computed styles cover the placeholder and representative SVG without vendor CSS',()=>{
  const dom=new JSDOM('<style>'+css+'</style><p aria-live="assertive" style="font-size:20px">'+icon+'<span>Loading Python</span></p>');
  const {window}=dom,p=window.document.querySelector('p');
  sized(window,p.firstElementChild);
  p.firstElementChild.outerHTML=svg;
  sized(window,p.firstElementChild);
  assert.equal(p.getAttribute('aria-live'),'assertive');
  assert.equal(p.querySelector('span').textContent,'Loading Python');
  assert.equal(p.firstElementChild.getAttribute('aria-hidden'),'true');
  assert.equal(p.firstElementChild.getAttribute('viewBox'),'0 0 512 512');
  dom.window.close();
});
test('representative late vendor CSS retains sizing properties, animation metadata and accessibility',()=>{
  const dom=new JSDOM('<style>'+css+'</style><p>'+svg+'</p>'),{window}=dom;
  const late=window.document.createElement('style');
  // Representative vendor CSS excerpt; this is not the real loader lifecycle.
  late.textContent='.svg-inline--fa{display:var(--fa-display,inline-block);height:1em;overflow:visible;vertical-align:-.125em}.fa-spin{animation-name:fa-spin;animation-duration:2s;animation-iteration-count:infinite}';
  window.document.head.append(late);
  const node=window.document.querySelector('svg');
  // JSDOM does not resolve display:var(); the owned width/height contract and
  // unchanged vendor animation/accessibility are checked independently.
  const computed=window.getComputedStyle(node);
  assert.equal(computed.width,'1em');assert.equal(computed.height,'1em');
  assert.equal(computed.animationName,'fa-spin');assert.equal(computed.animationDuration,'2s');
  assert.equal(node.getAttribute('aria-hidden'),'true');assert.equal(node.getAttribute('role'),'img');
  dom.window.close();
});
