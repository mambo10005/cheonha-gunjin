import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {JSDOM} from 'jsdom';
import {loadRun} from '../src/core/save.ts';
test('compiled map DOM: select/cancel, keyboard, commit once, save restore selection, drawers and preferences', {timeout:90000},async()=>{
 const b=await build({logLevel:'silent',define:{'import.meta.env.DEV':'true'},build:{write:false}}),out=Array.isArray(b)?b[0]:b;assert.ok('output' in out);const c=out.output.find(o=>o.type==='chunk');assert.ok(c&&c.type==='chunk');
 const errors:string[]=[];const boot=(saved:Record<string,string>={})=>{const d=new JSDOM('<main id="app"></main>',{url:'http://localhost/?dev=1',runScripts:'outside-only',beforeParse(w){w.structuredClone=structuredClone;w.matchMedia=(()=>({matches:true})) as unknown as typeof w.matchMedia;for(const [k,v] of Object.entries(saved))w.localStorage.setItem(k,v);w.addEventListener('error',e=>errors.push(String(e.error)));}});d.window.eval(c.code);return d;};
 let dom=boot();const click=(q:string)=>{const el=dom.window.document.querySelector<HTMLButtonElement>(q);assert.ok(el,q);assert.equal(el.disabled,false);el.click();};const state=()=>{const r=loadRun(dom.window.localStorage);assert.ok(r.ok);return r.data;};
 try{
  click('[data-a="to-lords"]');click('[data-a="deck-debate-demo"][data-id="guojia"]');click('[data-a="doctrine"][data-id="scheme"]');
  const before=state();click('[data-map-action="select"][data-key="0:0"]');assert.deepEqual(state(),before);assert.ok(dom.window.document.querySelector('[data-map-action="confirm"]'));
  click('[data-map-action="cancel"]');assert.deepEqual(state(),before);assert.equal(dom.window.document.querySelector('[data-map-action="confirm"]'),null);
  const node=dom.window.document.querySelector<HTMLButtonElement>('.atlas-node.reachable')!;node.focus();node.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));assert.notEqual(dom.window.document.activeElement,node);
  click('[data-map-action="select"][data-key="0:1"]');const saved:Record<string,string>={};for(let i=0;i<dom.window.localStorage.length;i++){const k=dom.window.localStorage.key(i)!;saved[k]=dom.window.localStorage.getItem(k)!;}dom.window.close();dom=boot(saved);click('[data-a="continue"]');assert.deepEqual(state(),before);assert.ok(dom.window.document.querySelector('.atlas-node.selected[data-key="0:1"]'));
  for(const name of ['legend','records','army','accords','settings']){click(`[data-map-action="drawer"][data-value="${name}"]`);assert.ok(dom.window.document.querySelector('[role="dialog"][aria-modal="true"]'));click('[data-map-action="close"]');}
  click('[data-map-action="drawer"][data-value="settings"]');click('[data-map-action="contrast"]');assert.equal(dom.window.document.querySelector('.expedition-map')!.getAttribute('data-contrast'),'high');click('[data-map-action="motion"][data-value="off"]');click('[data-map-action="close"]');
  assert.equal(dom.window.document.querySelector('.expedition-map')!.getAttribute('data-motion'),'off');assert.deepEqual(state(),before);
  const stale=dom.window.document.querySelector<HTMLButtonElement>('[data-map-action="confirm"]')!;stale.click();const moved=state();assert.equal(moved.floor,0);assert.equal(moved.col,1);assert.equal(moved.food,before.food-1);stale.click();assert.deepEqual(state(),moved);assert.equal(moved.mapTrail!.length,1);
  assert.deepEqual(errors,[]);
 }finally{dom.window.close();}
});
