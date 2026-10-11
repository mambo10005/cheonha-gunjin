import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {JSDOM} from 'jsdom';
import {loadRun} from '../src/core/save.ts';
test('compiled battle DOM: preview, keyboard targets, execution lock/skip, refresh, swap and reduced mode', {timeout:120000},async()=>{
 const buildResult=await build({logLevel:'silent',define:{'import.meta.env.DEV':'true'},build:{write:false}}),bundle=Array.isArray(buildResult)?buildResult[0]:buildResult;
 assert.ok('output' in bundle);const js=bundle.output.find(x=>x.type==='chunk');assert.ok(js&&js.type==='chunk');
 const errors:string[]=[];
 const boot=(saved:Record<string,string>={})=>{const d=new JSDOM('<main id="app"></main>',{url:'http://localhost/?dev=1',runScripts:'outside-only',beforeParse(w){w.structuredClone=structuredClone;w.matchMedia=(()=>({matches:false})) as unknown as typeof w.matchMedia;for(const [key,value]of Object.entries(saved))w.localStorage.setItem(key,value);w.addEventListener('error',e=>errors.push(String(e.error)));}});d.window.eval(js.code);return d;};
 let d=boot();const click=(q:string)=>{const e=d.window.document.querySelector<HTMLButtonElement>(q);assert.ok(e,q);e.click();};
 const state=()=>{const r=loadRun(d.window.localStorage);assert.ok(r.ok);return r.data;};
 const key=(k:string)=>d.window.dispatchEvent(new d.window.KeyboardEvent('keydown',{key:k,bubbles:true,cancelable:true}));
 const storage=()=>Object.fromEntries(Array.from({length:d.window.localStorage.length},(_,i)=>{const k=d.window.localStorage.key(i)!;return [k,d.window.localStorage.getItem(k)!];}));
 try{
  click('[data-a="to-lords"]');click('[data-a="battle-demo"]');assert.equal(state().seed,91001);assert.equal(d.window.document.querySelectorAll('.enemy-unit').length,3);
  const before=state();key('2');key('ArrowRight');assert.match(d.window.document.querySelector('.battle-preview')!.textContent!,/예상/);assert.deepEqual(state(),before);key('Escape');assert.deepEqual(state(),before);
  key('4');key('ArrowRight');key('Enter');const committed=state();assert.equal(committed.battle!.enemies[0].intent!.kind,'attack');assert.equal(committed.battle!.energy,5);
  assert.equal(d.window.document.querySelector('[data-busy]')!.getAttribute('data-busy'),'true');
  click('[data-a="card"][data-i="0"]');assert.deepEqual(state(),committed);click('[data-a="skip-battle"]');assert.deepEqual(state(),committed);
  assert.equal(d.window.document.querySelector('[data-busy]')!.getAttribute('data-busy'),'false');
  click('[data-a="battle-swap"][data-i="0"]');const moved=state();assert.equal(moved.battle!.generals[0].row,'rear');
  const saved=storage();d.window.close();d=boot(saved);click('[data-a="continue"]');assert.deepEqual(state(),moved);assert.equal(d.window.document.querySelector('[data-busy]')!.getAttribute('data-busy'),'false');
  const settings=d.window.document.querySelector<HTMLInputElement>('[data-battle-setting="reduced"]')!;settings.checked=true;settings.dispatchEvent(new d.window.Event('change',{bubbles:true}));
  const reducedBefore=state();click('[data-a="battle-swap"][data-i="0"]');assert.equal(state().battle!.energy,reducedBefore.battle!.energy-1);assert.equal(d.window.document.querySelector('[data-busy]')!.getAttribute('data-busy'),'false');
  const image=d.window.document.querySelector<HTMLImageElement>('[data-battle-portrait]')!;assert.ok(image);image.dispatchEvent(new d.window.Event('error'));assert.equal(d.window.document.querySelector('[data-general="guojia"] [data-battle-portrait]'),null);assert.match(d.window.document.querySelector('[data-general="guojia"]')!.textContent!,/곽가/);
  key('3');key('Enter');assert.ok(state().battle!.counter.front>0);const prepared=state();key('E');const after=state();assert.equal(after.battle!.turn,prepared.battle!.turn+1);assert.deepEqual(errors,[]);
  d.window.close();d=boot();Object.defineProperty(d.window,'innerWidth',{value:390,configurable:true});click('[data-a="to-lords"]');click('[data-a="battle-demo"]');const touchBefore=state();click('[data-a="card"][data-i="1"]');click('[data-a="target-row"][data-row="front"]');assert.deepEqual(state(),touchBefore);click('[data-a="execute-card"]');assert.equal(state().battle!.block.front,5);assert.equal(state().battle!.energy,3);click('[data-a="skip-battle"]');assert.deepEqual(errors,[]);
 }finally{d.window.close();}
});
