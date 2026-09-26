const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM} = require('jsdom');
const ext = path.join(__dirname, '../_extensions/pyodide-interaktiv');
const tick = () => new Promise(resolve => setImmediate(resolve));
function page({language='en', storage='session', hints=true, enabled=true} = {}) {
  const dom = new JSDOM('<main></main>', {url:'https://course.invalid/examples.html', runScripts:'outside-only'});
  const w = dom.window;
  w.AbortController = AbortController;
  for (const file of ['feedback-core.js','feedback-dom.js','ai-feedback.js']) w.eval(fs.readFileSync(path.join(process.env.AI_FEEDBACK_EXTENSION,file),'utf8'));
  w.qpyodideLang = language;
  w.qpyodideFeedbackOptions = {enabled,hints,storage};
  w.eval(fs.readFileSync(path.join(ext,'qpyodide-locales.js'),'utf8'));
  w.eval(fs.readFileSync(path.join(ext,'qpyodide-feedback.js'),'utf8'));
  let runs = 0, execute = async () => ({entries:[{type:'stdout',message:'80'}], images:[]});
  const proxy = {runCell: async (...args) => {runs++; return execute(...args);}, clearInterrupt(){}};
  w.qpyodideReady = Promise.resolve(proxy); w.mainPyodide = proxy;
  w.qpyodideInputAvailable = () => false;
  w.eval(fs.readFileSync(path.join(ext,'qpyodide-cell-classes.js'),'utf8')+'\nglobalThis.Unit=EditorUnit;');
  // Exercise real DOM/button/run/cache code; replace only the external Monaco API.
  w.Unit.prototype.initMonaco = function() {
    let code = this.code;
    this.editor = {getValue:()=>code, setValue:value=>{code=value;this.invalidateFeedback({preserveRunOutput:true});this.updateInputGate();}, __qpyodideinitialCode:code};
  };
  let uid=0;
  const unit = (code='print(80)', options={}) => {
    const host=w.document.createElement('div');w.document.body.append(host);
    return new w.Unit({uid:String(++uid),code,options:{task:'Print the price including tax.', ...options},hostDiv:host});
  };
  return {w,F:w.AIFeedback,unit,proxy,runs:()=>runs,setExecute:fn=>{execute=fn;}};
}
const evidence = unit => JSON.parse(JSON.stringify(unit.getFeedbackEvidence()));
async function prompt(unit) {await unit.feedbackHandle.request();return unit.outputFeedbackDiv.querySelector('pre')?.textContent;}

test('Feedback before Run never executes, shares settings and retains three no-solution hints', async () => {
  const {w,F,unit,runs} = page(); const u=unit('name=input("Name?")');
  assert.equal(u.runButton.disabled,true); assert.equal(u.feedbackButton.disabled,false);
  for(let level=1;level<=4;level++) {
    const text=await prompt(u);
    assert.ok(text.includes(F.shippedPolicies.integrations['pyodide-interaktiv'].steps[Math.min(level,3)-1].prompt));
    assert.match(text,/"evidence":\[\]/); assert.match(text,/Do not supply a complete/);
  }
  assert.equal(runs(),0); assert.equal(F.loadConfig().storage,'session');
  u.toolbarDiv.querySelector('.ai-feedback-gear').click(); F.openSettings();
  assert.equal(w.document.querySelectorAll('dialog.ai-feedback-settings').length,1); w.close();
});
test('matching run evidence includes stdout but never raw stderr, HTML or plot data',async()=>{
  const {w,unit,setExecute}=page();const u=unit();
  setExecute(async()=>({entries:[{type:'stdout',message:'visible'},{type:'stderr',message:'SECRET_TRACEBACK'}],images:[],html:'<b>HTML_SECRET</b>'}));
  await u.runCode(u.getCode()); const text=await prompt(u);
  assert.match(text,/visible/);assert.match(text,/run reported an error/);assert.doesNotMatch(text,/SECRET_TRACEBACK|HTML_SECRET/);
  u.editor.setValue('changed');u.editor.setValue('print(80)');assert.deepEqual(evidence(u),[]);w.close();
});
for(const action of ['edit','reset','restart']) test(action+' during a run cannot restore evidence',async()=>{
  const {w,unit,setExecute}=page();const u=unit();let finish;
  setExecute(()=>new Promise(resolve=>{finish=resolve;}));
  const pending=u.runCode(u.getCode());await tick();
  if(action==='edit'){u.editor.setValue('different');u.editor.setValue('print(80)');}
  if(action==='reset')u.resetButton.click();
  if(action==='restart')w.dispatchEvent(new w.Event('qpyodide-runtime-restart'));
  finish({entries:[{type:'stdout',message:'late'}],images:[],html:'<b>completed run</b>'});await pending;
  assert.deepEqual(evidence(u),[]); if(action==='reset')assert.equal(u.outputCodeDiv.textContent,'');
  if(action==='edit')assert.match(u.outputCodeDiv.textContent,/completed run/);w.close();
});
test('partial execution renders HTML but cannot claim evidence for the whole editor',async()=>{
  const {w,unit,setExecute}=page();const u=unit('a=1\nprint(a)');
  setExecute(async()=>({entries:[],images:[],html:'<b>selected output</b>'}));
  await u.runCode('print(a)');assert.match(u.outputCodeDiv.textContent,/selected output/);assert.deepEqual(evidence(u),[]);w.close();
});
test('hard restart preserves the visible Stop error while discarding feedback evidence',async()=>{
  const {w,unit,setExecute}=page();const u=unit();let reject;
  setExecute(()=>new Promise((_,r)=>{reject=r;}));const pending=u.runCode(u.getCode());await tick();
  w.dispatchEvent(new w.Event('qpyodide-runtime-restart'));reject(new Error('Stopped; runtime restarted'));
  await pending;assert.match(u.outputCodeDiv.textContent,/Stopped; runtime restarted/);assert.deepEqual(evidence(u),[]);w.close();
});
test('new Run quietly cancels pending feedback, even with unchanged code',async()=>{
  const {w,F,unit}=page();const u=unit();let finish;
  F.createClient=()=>({request:()=>new Promise(resolve=>{finish=resolve;})});F.saveConfig({mode:'api',storage:'session'});
  const pending=u.feedbackHandle.request();await tick();await u.runCode(u.getCode());finish({text:'STALE',format:'markdown'});await pending;
  assert.equal(u.outputFeedbackDiv.textContent,'');assert.equal(w.sessionStorage.getItem('ai-feedback-hints-v2|/examples.html|pyodide-1'),null);w.close();
});
test('different editors have independent evidence; readonly/disabled cells have no Feedback',async()=>{
  const {w,unit}=page();const first=unit(),second=unit();await first.runCode(first.getCode());assert.equal(evidence(first).length,2);assert.deepEqual(evidence(second),[]);
  assert.equal(unit('x=1',{'read-only':'true'}).feedbackButton,null);w.close();
  const disabled=page({enabled:false});assert.equal(disabled.unit().feedbackButton,null);disabled.w.close();
});
test('older runtime disables Feedback without disabling Run',()=>{
  const {w,F,unit}=page();F.version='0.2.1';const u=unit();assert.equal(u.feedbackButton.disabled,true);assert.equal(u.runButton.disabled,false);assert.match(u.outputFeedbackDiv.textContent,/0.5.0/);w.close();
});
for(const language of ['en','de','sv','no','da','nb'])test('localized tutor policy survives: '+language,async()=>{
  const {w,unit}=page({language});const u=unit();const text=await prompt(u);assert.ok(text.includes(w.AIFeedback.shippedPolicies.integrations['pyodide-interaktiv'].prompt));assert.match(text,new RegExp('Write explanations in '+(language==='no'?'nb':language))); w.close();
});
test('review mode has no hint counter and explicit shared defaults take precedence',async()=>{
  const {w,F,unit}=page({hints:false});w.__aiFeedbackConfig={storage:'local'};const u=unit();await prompt(u);assert.equal(u.outputFeedbackDiv.querySelector('.ai-feedback-hint'),null);assert.equal(F.loadConfig().storage,'local');w.close();
});

test('Run resets hint progression unless the integration policy opts out',async()=>{
 const {w,unit}=page();const u=unit();await prompt(u);await prompt(u);
 assert.equal(u.outputFeedbackDiv.querySelector('.ai-feedback-hint').textContent,'Hint 2');
 await u.runCode(u.getCode());await prompt(u);assert.equal(u.outputFeedbackDiv.querySelector('.ai-feedback-hint').textContent,'Hint 1');
 w.__aiFeedbackPolicies={layers:[{integrations:{'pyodide-interaktiv':{'reset-on-run':false}}}]};
 await prompt(u);await u.runCode(u.getCode());await prompt(u);assert.equal(u.outputFeedbackDiv.querySelector('.ai-feedback-hint').textContent,'Hint 2');
 u.resetButton.click();await prompt(u);assert.equal(u.outputFeedbackDiv.querySelector('.ai-feedback-hint').textContent,'Hint 1');w.close();
});
