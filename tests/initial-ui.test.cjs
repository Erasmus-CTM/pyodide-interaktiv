const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const dir=path.join(__dirname,'../_extensions/pyodide-interaktiv');
const source=fs.readFileSync(path.join(dir,'qpyodide-cell-classes.js'),'utf8');
// Exercise the actual unchanged AMD method body: callbacks are held so this
// regression distinguishes registration ownership from editor/vendor behavior.
const start=source.indexOf('  initMonaco() {'),end=source.indexOf('  /** Wires up button clicks',start);
const method=source.slice(start,end).replace('  initMonaco() {','function initMonaco() {');
test('initial editors register their AMD work; user-added extra editors still initialize after the barrier closes',()=>{
  for(const initial of [true,false]) {
    const callbacks=[],tracked=[];
    const root={qpyodideBuildingInitialUI:initial,MathExerciseRuntime:{trackInitialUI(p){if(!initial)throw new Error('barrier closed');tracked.push(p);}}};
    const run=new Function('globalThis','require','qpyodideBuildingInitialUI','unit',method+';return initMonaco.call(unit);');
    run(root,(deps,callback)=>callbacks.push(callback),initial,{});
    assert.equal(callbacks.length,1,'the real AMD construction path remains active');
    assert.equal(tracked.length,initial?1:0,'later extra editor must not register after closure');
  }
});
test('initial cell construction scopes readiness tracking and always releases the batch flag',()=>{
  const init=fs.readFileSync(path.join(dir,'qpyodide-cell-initialization.js'),'utf8');
  for(const fail of [false,true]) {
    const seen=[],w={qpyodideCellDetails:[{id:1}],qpyodideCellsReady:false,
      document:{getElementById:()=>null},window:{addEventListener(){}},
      qpyodideCellContainer:{addCell(){},runStartupCells(){throw new Error('must not run');}}};
    vm.createContext(w);vm.runInContext('globalThis.qpyodideBuildingInitialUI=false;globalThis.batch=()=>globalThis.qpyodideBuildingInitialUI;',w);
    w.qpyodideCreateCell=()=>{seen.push(w.batch());if(fail)throw new Error('construction failed');return {};};
    if(fail)assert.throws(()=>vm.runInContext(init,w),/construction failed/);else vm.runInContext(init,w);
    assert.deepEqual(seen,[true]);assert.equal(w.batch(),false);
  }
});

test('initial editor readiness rejects actual AMD, construction and layout failures with the original error',async()=>{
  for(const stage of ['amd','create','layout']) {
    const error=new Error(stage+' failed'),tracked=[];
    let callback,amdFailure;
    const root={qpyodideBuildingInitialUI:true,MathExerciseRuntime:{trackInitialUI:p=>tracked.push(p)}};
    const editor={getModel:()=>({setEOL(){}}),createContextKey(){},onDidFocusEditorText(){},onDidChangeModelContent(){}};
    const monaco={editor:{create(){if(stage==='create')throw error;return editor;},EndOfLineSequence:{LF:0}}};
    const win={CTMLayout:{fitEditor(){throw error;}}};
    const run=new Function('globalThis','require','qpyodideBuildingInitialUI','unit','monaco','window','qpyodideMonacoTheme',method+';return initMonaco.call(unit);');
    run(root,(deps,ok,fail)=>{callback=ok;amdFailure=fail;},true,{options:{}},monaco,win,()=> 'vs');
    const result=assert.rejects(tracked[0],e=>e===error);
    if(stage==='amd')amdFailure(error);else assert.doesNotThrow(()=>callback());
    await result;
  }
});

test('Monaco WebKit proactive clipboard writes are guarded before editor construction',async()=>{
  for(const exam of [false,true])for(const available of [false,true]) {
    let installs=0,callback;const sentinel=new Error('editor construction sentinel'),tracked=[];
    class ClipboardService {installWebKitWriteTextWorkaround(){installs++;}}
    const original=ClipboardService.prototype.installWebKitWriteTextWorkaround;
    const root={qpyodideBuildingInitialUI:true,qpyodideExamOutput:exam,navigator:available?{clipboard:{write(){}}}:{},ClipboardItem:available?class {}:undefined,MathExerciseRuntime:{trackInitialUI:p=>tracked.push(p)}};
    const monaco={editor:{create(){new ClipboardService().installWebKitWriteTextWorkaround();throw sentinel;}}};
    const run=new Function('globalThis','require','qpyodideBuildingInitialUI','unit','monaco','window','qpyodideMonacoTheme',method+';return initMonaco.call(unit);');
    run(root,(deps,ok)=>{if(typeof deps==='string'){assert.equal(deps,'vs/platform/clipboard/browser/clipboardService');return {BrowserClipboardService:ClipboardService};}assert.deepEqual(deps,['vs/editor/editor.main']);callback=ok;},true,{options:{}},monaco,{},()=> 'vs');
    const result=assert.rejects(tracked[0],e=>e===sentinel);callback();await result;
    assert.equal(installs,!exam&&available?1:0);
    assert.notEqual(ClipboardService.prototype.installWebKitWriteTextWorkaround,original);
  }
});
