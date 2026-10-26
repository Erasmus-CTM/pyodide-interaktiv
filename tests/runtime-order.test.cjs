// Real Quarto pages retain their runtime/worker and Settings dependencies in registration order.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process'),{JSDOM}=require('jsdom');
const quarto=process.env.QUARTO_BIN||'quarto',repo=path.resolve(__dirname,'..');
const skip=spawnSync(quarto,['--version']).error?'Quarto required':false;
const fence=String.fromCharCode(96).repeat(3);
const cell=(options='')=>fence+'{pyodide-python}\n'+options+'print(42)\n'+fence+'\n';
const cases=[
 {name:'normal',body:cell()},
 {name:'basic',settings:'  preload-packages: false\n  packages: []\n',body:cell()},
 {name:'scientific',settings:'  preload-packages: false\n  packages: [numpy, scipy, sympy, matplotlib, networkx]\n',body:cell()},
 {name:'output-only',body:cell('#| context: output\n')},
 {name:'setup-only',body:cell('#| context: setup\n')},
 {name:'eval-false',body:cell('#| eval: false\n'),absent:true},
 {name:'empty',body:'',absent:true},
 {name:'no-cell',body:'Unchanged authored prose.\n',absent:true}
];
const normalize=u=>u.replace(/.*(?:site_libs\/|_files\/libs\/)/,'').replace(/quarto-contrib\/([\w-]+?)-\d+\.\d+\.\d+[^/]*\//,'$1/');
test('actual page modes retain ordered runtime dependencies and inert pages stay inert',{skip},()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qpy-runtime-order-'));
 try{
  for(const name of ['pyodide-interaktiv','ctm-libs','ai-feedback'])fs.cpSync(
   name==='ctm-libs'&&process.env.CTM_LIBS_EXTENSION?process.env.CTM_LIBS_EXTENSION:path.join(repo,'_extensions',name),
   path.join(dir,'_extensions',name),{recursive:true});
  fs.writeFileSync(path.join(dir,'_quarto.yml'),'project:\n  type: default\n  render: ['+cases.map(x=>x.name+'.qmd').join(', ')+']\nfilters: [pyodide-interaktiv]\nexecute:\n  enabled: false\nformat:\n  html:\n    theme: [default, system.scss]\nai-feedback:\n  enabled: false\npyodide:\n  feedback: false\n');
  fs.writeFileSync(path.join(dir,'system.scss'),'/*-- scss:defaults --*/\n$web-font-path: false;\n');
  for(const c of cases)fs.writeFileSync(path.join(dir,c.name+'.qmd'),'---\ntitle: runtime order\n'+(c.settings?'pyodide:\n'+c.settings:'')+'---\n\n'+c.body);
  const render=spawnSync(quarto,['render'],{cwd:dir,encoding:'utf8',timeout:240000});
  assert.equal(render.status,0,(render.stdout||'')+(render.stderr||'')+String(render.error||''));
  const sharedSettings=fs.existsSync(path.join(dir,'_extensions/ctm-libs/ui/ctm-settings.js'));
 const report=[];
  for(const c of cases){
   const html=fs.readFileSync(path.join(dir,c.name+'.html'),'utf8'),doc=new JSDOM(html).window.document;
   const scripts=[...doc.querySelectorAll('script[src]')].map(e=>({url:normalize(e.getAttribute('src')),attributes:[...e.attributes].filter(a=>a.name!=='src').map(a=>[a.name,a.value])}));
   const runtime=['ctm-runtime/pyodide-runtime.js','ctm-worker/pyodide-worker.js'];
   const locale=['ctm-locale/ctm-locale.js','ctm-locale/common.js'];
   const settings=['ctm-locale-ui/ui.js','ctm-layout/ctm-layout.js','ctm-layout/ctm-settings.js'];
   // Ordinary/output cells register their worker before the shared store. A
   // setup-only page has no store registration: document setup requests the
   // shared Settings shell first, then the runtime and worker. The old shipped
   // library has no shared Settings shell and retains its historical order.
   const expected=sharedSettings ? (c.name==='setup-only'?[...locale,...settings,...runtime]:[...runtime,...locale,...settings]) : [...runtime,...locale];
   if(c.absent){
    assert.ok(!scripts.some(s=>runtime.includes(s.url)),c.name+' must not gain runtime/worker');
    assert.ok(!html.includes('globalThis.qpyodideCellDetails ='),c.name+' must not gain deferred cell configuration');
   }else{
    const positions=expected.map(url=>{const hits=scripts.flatMap((s,i)=>s.url===url?[i]:[]);assert.equal(hits.length,1,c.name+' '+url);assert.deepEqual(scripts[hits[0]].attributes,[]);return hits[0];});
    assert.deepEqual([...positions].sort((a,b)=>a-b),positions,c.name+' preserves the complete ordered dependencies for its library and page mode');
    const startup=['qpyodide-locale.js','qpyodide-worker-plugin.js','qpyodide-document-engine-initialization.js',
     'qpyodide-cell-classes.js','qpyodide-cell-initialization.js'].map(file=>{
      const hits=scripts.flatMap((script,i)=>script.url==='pyodide-interaktiv/'+file?[i]:[]);
      assert.equal(hits.length,1,c.name+' '+file);return hits[0];
     });
    assert.deepEqual([...startup].sort((a,b)=>a-b),startup,c.name+' keeps locale/worker adapters before engine and cell scripts');
    assert.ok(Math.max(...positions)<startup[0],c.name+' loads shared dependencies before component adapters');
    assert.ok(html.includes('globalThis.qpyodideCellDetails ='),c.name+' keeps deferred cell configuration');
   }
   report.push({page:c.name,active:!c.absent,scripts});
   doc.defaultView.close();
  }
  console.log('Rendered runtime-order evidence: '+JSON.stringify(report));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
