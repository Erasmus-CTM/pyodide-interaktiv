const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const ext=path.join(__dirname,'../_extensions/pyodide-interaktiv');
for(const shared of [true,false]) test('upstream autosave controls retain code and work '+(shared?'in the shared feedback dialog':'without AI feedback'),()=>{
 const w=new JSDOM('<div id="qpyodide-status-right"></div>',{url:'https://course.invalid/page',runScripts:'outside-only'}).window;
 if(shared)for(const file of ['feedback-core.js','feedback-dom.js','ai-feedback.js'])w.eval(fs.readFileSync(path.join(process.env.CTM_LIBS_EXTENSION || path.join(__dirname,'../_extensions/ctm-libs'),'feedback',file),'utf8'));
 w.qpyodideLang='en';w.qpyodideLocalStorageOptions={enabled:true,epoch:''};w.qpyodideCellDetails=[{id:'one',code:'print(1)',options:{label:'one'}}];
 for(const file of ['qpyodide-locales.js','qpyodide-storage.js','qpyodide-storage-settings.js'])w.eval(fs.readFileSync(path.join(ext,file),'utf8'));
 const storage=w.qpyodideStorage;storage.save('one','draft');
 const section=w.document.querySelector('.qpyodide-storage-settings-section'),master=section.querySelector('input[type=checkbox]');
 master.click();assert.equal(storage.isUserDisabled(),true);assert.equal(storage.load('one'),'draft');
 master.click();const manual=section.querySelectorAll('input[type=radio]')[1];manual.click();assert.equal(storage.isManualMode(),true);assert.equal(storage.load('one'),'draft');
 w.document.querySelector('.qpyodide-storage-gear').click();assert.ok(w.document.querySelector('dialog[open]'));
 if(shared){w.AIFeedback.openSettings();assert.equal(w.document.querySelectorAll('dialog.ai-feedback-settings').length,1);assert.ok(w.document.querySelector('dialog.ai-feedback-settings').contains(section));}
 if(!shared){w.document.querySelector('dialog > button').click();assert.equal(w.document.querySelector('dialog[open]'),null);}
 let reset=0;w.confirm=()=>true;w.qpyodideResetAllStorageUnits=()=>reset++;
 section.querySelector('.qpyodide-storage-delete-btn').click();assert.equal(storage.load('one'),null);assert.equal(reset,1);w.close();
});
