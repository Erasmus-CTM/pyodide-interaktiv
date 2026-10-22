// Actual Quarto handlers and the shared resolver; no second Python parser.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const {spawnSync}=require('node:child_process'),{JSDOM}=require('jsdom');
const quarto=process.env.QUARTO_BIN||'quarto',repo=path.join(__dirname,'..');
const skip=spawnSync(quarto,['--version']).error?'Quarto required':false;
function project(mode, options = {}) {
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
    'report.lua':'return {{Pandoc=function(doc)\nlocal f=assert(io.open(quarto.project.directory .. "/fragments.json","w")); f:write(quarto.json.encode(_G.__records)); f:close(); return doc end}}\n',
    '_ctm-assets/manifest.json':JSON.stringify({v:1,versions,files:{}}),
    ['_ctm-assets/pyodide/'+version+'/pyodide-lock.json']:JSON.stringify({packages:{numpy:{},networkx:{}}})
  };
  const collector = options.collector || 'valid';
  const assignment = collector === 'valid' ? '{add=function(item) table.insert(_G.__records,item) end}' :
    collector === 'invalid' ? '{add="invalid"}' : collector === 'boolean' ? 'true' : 'nil';
  files['collector.lua'] = 'return {{Meta=function(meta)\n_G.__records={}\n_G.__ctmAuthorImports=' + assignment + '\nreturn meta end}}\n';
  if (options.projectEval !== undefined) files['_quarto.yml'] = files['_quarto.yml'].replace('  enabled: false\n', '  enabled: false\n  eval: ' + options.projectEval + '\n');
  const fence=String.fromCharCode(96).repeat(3);
  const cell=(label,context,code)=>fence+'{pyodide-python}\n#| label: '+label+'\n#| context: '+context+'\n'+code+'\n'+fence+'\n';
  files['sub/page.qmd']='---\ntitle: assets\n---\n\nProse: import prose_package\n\n'+
    cell('setup','setup','import numpy as np')+'\n'+cell('output','output','print("import pretend_package")')+'\n'+
    cell('ordinary','interactive','from math import sqrt\n# import comment_package')+'\n'+
    fence+'{python}\n# pyodide: true, label=marked\nimport networkx as nx\n'+fence+'\n';
  if (options.body !== undefined) files['sub/page.qmd'] = '---\ntitle: assets\nengine: markdown\n---\n\n' + options.body;
  if (options.documentEval !== undefined) files['sub/page.qmd'] = files['sub/page.qmd'].replace('title: assets\n', 'title: assets\nexecute:\n  eval: ' + options.documentEval + '\n');
  for(const [name,source]of Object.entries(files)){const target=path.join(dir,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,source);}
  const library = path.join(dir, '_extensions/ctm-libs');
  if (options.missingAssets) fs.unlinkSync(path.join(library, 'lua/assets.lua'));
  if (options.tripwire || options.phase) {
    const file = path.join(library, 'lua/settings.lua');
    const source = fs.readFileSync(file, 'utf8');
    assert.ok(source.includes('function M.load(meta)'), 'actual settings entry');
    fs.writeFileSync(file, source.replace('function M.load(meta)', 'function M.load(meta)\n' +
      (options.tripwire ? 'error("META SETTINGS TRIPWIRE")' : '_G.__qpySettingsLoaded = true')));
  }
  if (options.phase) {
    const file = path.join(library, 'lua/runtime.lua');
    const source = fs.readFileSync(file, 'utf8');
    assert.ok(source.includes('function M.indexURL()'), 'actual runtime entry');
    fs.writeFileSync(file, source.replace('function M.indexURL()', 'function M.indexURL()\nassert(_G.__qpySettingsLoaded, "INDEX URL BEFORE SETTINGS")'));
  }
  return {dir,table,libs,version};
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

function withProject(mode, options, check, args = []) {
  const p = project(mode, options);
  try {
    const result = spawnSync(quarto, ['render', ...args], {cwd: p.dir,
      env: {...process.env, CTM_COMPONENT_DEV: '1'}, encoding: 'utf8', timeout: 240000});
    check(p, result, result.stdout + result.stderr);
  } finally {fs.rmSync(p.dir, {recursive: true, force: true});}
}
const fence = String.fromCharCode(96).repeat(3);
const ordinary = (label, extra = '') => fence + '{pyodide-python}\n#| label: ' + label + '\n' + extra + 'import numpy\n' + fence + '\n';
const marked = (label, extra = '') => fence + '{python}\n# pyodide: true, label=' + label + extra + '\nimport networkx\n' + fence + '\n';
function renderedSettings(p) {
  const html = fs.readFileSync(path.join(p.dir, 'sub/page.html'), 'utf8');
  const script = [...new JSDOM(html).window.document.scripts].find(s => s.textContent.includes('globalThis.qpyodideCellDetails ='));
  assert.ok(script, 'actual component settings script');
  const context = {}; vm.runInNewContext(script.textContent, context);
  return context;
}
for (const mode of ['cdn', 'local']) test('missing assets API precedes Meta in ' + mode, {skip}, () => {
  withProject(mode, {missingAssets: true, tripwire: true, body: ordinary('active')}, (p, r, output) => {
    assert.notEqual(r.status, 0);
    assert.match(output, /pyodide-interaktiv needs the shared assets API/);
    assert.match(output, /quarto add https:\/\/erasmus-ctm.github.io\/ctm-assessment\/ctm-assessment.tar.gz/);
    assert.match(output, /quarto add Erasmus-CTM\/pyodide-interaktiv/);
    assert.doesNotMatch(output, /META SETTINGS TRIPWIRE/);
  });
});
for (const collector of ['missing', 'invalid', 'boolean']) test('local assets refuse ' + collector + ' collector', {skip}, () => {
  withProject('local', {collector, body: ordinary('active')}, (p, r, output) => {
    assert.notEqual(r.status, 0);
    assert.match(output, /local asset builds require the CTM Assessment author-import collector/);
  });
});
test('legacy CDN renders with no umbrella collector', {skip}, () => {
  withProject('cdn', {collector: 'missing', body: ordinary('active')}, (p, r, output) => {
    assert.equal(r.status, 0, output);
    assert.equal(renderedSettings(p).qpyodideCellDetails.length, 1);
  });
});
for (const mode of ['cdn', 'local']) test('index URL is selected after settings in ' + mode, {skip}, () => {
  withProject(mode, {phase: true, body: ordinary('active')}, (p, r, output) => {
    assert.equal(r.status, 0, output);
    const url = renderedSettings(p).qpyodideCustomizedPyodideOptions.indexURL;
    assert.equal(url, mode === 'local' ? '../_ctm-assets/pyodide/' + p.version + '/' :
      'https://cdn.jsdelivr.net/pyodide/v' + p.version + '/full/');
  });
});
test('inert CDN page needs neither assets API nor runtime URL', {skip}, () => {
  withProject('cdn', {missingAssets: true, phase: true, body: 'Plain text.\n'}, (p, r, output) => {
    assert.equal(r.status, 0, output);
    const html = fs.readFileSync(path.join(p.dir, 'sub/page.html'), 'utf8');
    assert.doesNotMatch(html, /globalThis.qpyodideCellDetails =/);
  });
});
test('eval false ordinary fragments are excluded while executable marked cells remain collected', {skip}, () => {
  const body = ordinary('disabled', '#| eval: false\n') +
    ordinary('disabled-setup', '#| eval: false\n#| context: setup\n') +
    ordinary('disabled-output', '#| eval: false\n#| context: output\n') +
    marked('disabled-marked', ', eval=false') + ordinary('active');
  withProject('local', {body}, (p, r, output) => {
    assert.equal(r.status, 0, output);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(p.dir, 'fragments.json'), 'utf8')), [
      {source: 'import networkx', packages: ['numpy', 'networkx'], origin: 'pyodide-interaktiv:disabled-marked:cell'},
      {source: 'import numpy', packages: ['numpy', 'networkx'], origin: 'pyodide-interaktiv:active:cell'}
    ]);
    assert.deepEqual(Array.from(renderedSettings(p).qpyodideCellDetails, c => c.options.label), ['disabled-marked', 'active']);
  });
});
for (const level of ['projectEval', 'documentEval']) test(level + ' false excludes fragments but cell true overrides', {skip}, () => {
  const body = ordinary('disabled') + marked('disabled-marked') + ordinary('active', '#| eval: true\n');
  withProject('local', {[level]: false, body}, (p, r, output) => {
    assert.equal(r.status, 0, output);
    const fragments = JSON.parse(fs.readFileSync(path.join(p.dir, 'fragments.json'), 'utf8'));
    assert.deepEqual(fragments.map(x => x.origin), ['pyodide-interaktiv:disabled-marked:cell', 'pyodide-interaktiv:active:cell']);
    assert.equal(fragments[0].source, 'import networkx');
    assert.equal(fragments[1].source, 'import numpy');
    assert.deepEqual(Array.from(renderedSettings(p).qpyodideCellDetails, c => c.options.label), ['disabled-marked', 'active']);
  });
});
test('non HTML source fallback preserves legacy rendering', {skip}, () => {
  withProject('cdn', {body: ordinary('active')}, (p, r, output) => {
    assert.equal(r.status, 0, output);
    const source = fs.readFileSync(path.join(p.dir, 'sub/page.md'), 'utf8');
    assert.match(source, /import numpy/);
    assert.doesNotMatch(source, /globalThis.qpyodideCellDetails =/);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(p.dir, 'fragments.json'), 'utf8')), []);
  }, ['--to', 'gfm']);
});
