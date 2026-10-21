// Actual Quarto handlers and the shared resolver; no second Python parser.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const {spawnSync}=require('node:child_process'),{JSDOM}=require('jsdom');
const quarto=process.env.QUARTO_BIN||'quarto',repo=path.join(__dirname,'..');
const skip=spawnSync(quarto,['--version']).error?'Quarto required':false;
function project(mode) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qpy-assets-')),libs=process.env.CTM_LIBS_EXTENSION||path.join(repo,'_extensions/ctm-libs');
  for(const name of ['pyodide-interaktiv','ai-feedback'])fs.cpSync(path.join(repo,'_extensions',name),path.join(dir,'_extensions',name),{recursive:true});
  fs.cpSync(libs,path.join(dir,'_extensions/ctm-libs'),{recursive:true});
  const table=JSON.parse(fs.readFileSync(path.join(libs,'assets.json'),'utf8'));
  const runtime=fs.readFileSync(path.join(libs,'runtime/pyodide-runtime.js'),'utf8');
  const version=runtime.match(/var indexURL = '[^']+\/v([^/]+)\/full\/';/)[1];
  const versions=Object.fromEntries(Object.entries(table.assets).map(([k,v])=>[k,v.version]));versions.pyodide=version;
  const files={
    '_quarto.yml':'project:\n  type: default\n  render: [sub/page.qmd]\n  resources: ["_ctm-assets/**"]\nfilters: [collector.lua, pyodide-interaktiv, report.lua]\nformat:\n  html:\n    theme: [default, offline-system.scss]\nexecute:\n  enabled: false\nctm-assessment:\n  assets: '+mode+'\nai-feedback:\n  enabled: false\npyodide:\n  feedback: false\n  packages: [numpy, networkx]\n',
    'offline-system.scss':'/*-- scss:defaults --*/\n$web-font-path: false;\n',
    'collector.lua':'return {{Meta=function(meta)\n_G.__records={}\n_G.__ctmAuthorImports={add=function(item) table.insert(_G.__records,item) end}\nreturn meta end}}\n',
    'report.lua':'return {{Pandoc=function(doc)\nlocal f=assert(io.open("fragments.json","w")); f:write(quarto.json.encode(_G.__records)); f:close(); return doc end}}\n',
    '_ctm-assets/manifest.json':JSON.stringify({v:1,versions,files:{}}),
    ['_ctm-assets/pyodide/'+version+'/pyodide-lock.json']:JSON.stringify({packages:{numpy:{},networkx:{}}})
  };
  const fence=String.fromCharCode(96).repeat(3);
  const cell=(label,context,code)=>fence+'{pyodide-python}\n#| label: '+label+'\n#| context: '+context+'\n'+code+'\n'+fence+'\n';
  files['sub/page.qmd']='---\ntitle: assets\n---\n\nProse: import prose_package\n\n'+
    cell('setup','setup','import numpy as np')+'\n'+cell('output','output','print("import pretend_package")')+'\n'+
    cell('ordinary','interactive','from math import sqrt\n# import comment_package')+'\n'+
    fence+'{python}\n# pyodide: true, label=marked\nimport networkx as nx\n'+fence+'\n';
  for(const [name,source]of Object.entries(files)){const target=path.join(dir,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,source);}
  return {dir,table,libs};
}
for(const mode of ['cdn','local'])test('nested '+mode+' pages resolve Monaco/SVG icons and collect actual authored cells',{skip},()=>{
  const p=project(mode);
  try{
    const r=spawnSync(quarto,['render'],{cwd:p.dir,env:{...process.env,CTM_COMPONENT_DEV:'1'},encoding:'utf8',timeout:240000});
    assert.equal(r.status,0,r.stderr);
    const html=fs.readFileSync(path.join(p.dir,'sub/page.html'),'utf8'),doc=new JSDOM(html,{url:'https://course.test/sub/page.html'}).window.document;
    const fragments=JSON.parse(fs.readFileSync(path.join(p.dir,'fragments.json'),'utf8'));
    const settings=[...doc.scripts].find(s=>s.textContent.includes('globalThis.qpyodideCellDetails ='));
    const context={};vm.runInNewContext(settings.textContent,context);
    const cells=context.qpyodideCellDetails;
    assert.equal(cells.length,4);assert.equal(fragments.length,4);
    for(const cell of cells){
      const fragment=fragments.find(x=>x.origin==='pyodide-interaktiv:'+cell.options.label+':cell');
      assert.ok(fragment,'fragment for '+cell.options.label);
      assert.equal(fragment.source,cell.code,'exact already-parsed code');
      assert.deepEqual(fragment.packages,['numpy','networkx'],'effective document packages');
      assert.doesNotMatch(fragment.source,/#\||# pyodide:/,'no option or marker reparsing');
    }
    const config=[...doc.scripts].find(s=>s.textContent.startsWith('globalThis.CTM_ASSETS='));
    const scope={};vm.runInNewContext(config.textContent,scope);
    assert.equal(scope.CTM_ASSETS.mode,mode);
    const base=name=>mode==='local'?'https://course.test/_ctm-assets/'+p.table.assets[name].local.replaceAll('{version}',p.table.assets[name].version):
      p.table.assets[name].cdn.replaceAll('{version}',p.table.assets[name].version);
    const loader=[...doc.scripts].find(s=>s.src.endsWith('/min/vs/loader.js'));
    assert.equal(loader.src,base('monaco-editor')+'min/vs/loader.js');
    assert.ok([...doc.querySelectorAll('link')].some(n=>n.href===base('monaco-editor')+'min/vs/editor/editor.main.css'));
    assert.ok([...doc.scripts].some(s=>s.src===base('font-awesome')+'js/all.min.js'),'SVG kit retained');
    let configured;
    const js=fs.readFileSync(path.join(p.libs,'assets.js'),'utf8');
    const amd={URL,document:{baseURI:'https://course.test/sub/page.html'},CTM_ASSETS:scope.CTM_ASSETS,require:{config:c=>{configured=c;}}};
    vm.runInNewContext(js,amd);
    vm.runInNewContext(doc.querySelector('#qpyodide-monaco-editor-init').textContent,amd);
    assert.equal(configured.paths.vs,base('monaco-editor')+'min/vs','actual resolver returns absolute AMD base');
    assert.doesNotMatch(html,/\{\{MONACOLOADER\}\}|cdnjs\.cloudflare\.com/);
  }finally{fs.rmSync(p.dir,{recursive:true,force:true});}
});
