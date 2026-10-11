import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {JSDOM} from 'jsdom';
import {loadRun} from '../src/core/save.ts';
test('regional compiled DOM: camera-only controls, drag/pinch/keys, search/layers/list, selection/cancel and single commit', {timeout:120000},async()=>{
 const b=await build({logLevel:'silent',define:{'import.meta.env.DEV':'true'},build:{write:false}}),o=Array.isArray(b)?b[0]:b;assert.ok('output' in o);const js=o.output.find(x=>x.type==='chunk');assert.ok(js&&js.type==='chunk');
 const errors:string[]=[];const boot=(saved:Record<string,string>={})=>{
  const d=new JSDOM('<main id="app"></main>',{url:'http://localhost/?dev=1',runScripts:'outside-only',beforeParse(w){w.structuredClone=structuredClone;w.matchMedia=(()=>({matches:true})) as unknown as typeof w.matchMedia;for(const [k,v] of Object.entries(saved))w.localStorage.setItem(k,v);w.addEventListener('error',e=>errors.push(String(e.error)));}});d.window.eval(js.code);return d;
 };
 let d=boot();const click=(q:string)=>{const el=d.window.document.querySelector<HTMLButtonElement>(q);assert.ok(el,q);el.click();};
 const state=()=>{const r=loadRun(d.window.localStorage);assert.ok(r.ok);return r.data;};
 const box=()=>d.window.document.querySelector('.geo-surface')!.getAttribute('viewBox');
 const pointer=(type:string,id:number,x:number,y:number)=>{const e=new d.window.MouseEvent(type,{bubbles:true,clientX:x,clientY:y});Object.defineProperty(e,'pointerId',{value:id});d.window.document.querySelector('.geo-surface')!.dispatchEvent(e);};
 try{
  click('[data-a="to-lords"]');click('[data-a="geography-demo"]');click('[data-a="doctrine"][data-id="scheme"]');const original=state();assert.ok(original.geography);
  click('[data-geo-action="focus"][data-value="all"]');const wide=box();click('[data-geo-action="zoom"][data-factor="0.8"]');assert.notEqual(box(),wide);
  const camera=()=>box()!.split(' ').map(Number);
  const wheel=(options:WheelEventInit)=>{const e=new d.window.WheelEvent('wheel',{clientX:200,clientY:100,bubbles:true,cancelable:true,...options});d.window.document.querySelector('.geo-surface')!.dispatchEvent(e);assert.equal(e.defaultPrevented,true);};
  const current=camera();wheel({deltaY:50});assert.ok(camera()[1]>current[1]);assert.equal(camera()[0],current[0]);assert.equal(camera()[2],current[2]);
  const vertical=camera();wheel({deltaY:40,shiftKey:true});assert.ok(camera()[0]>vertical[0]);assert.equal(camera()[1],vertical[1]);assert.equal(camera()[2],vertical[2]);
  const horizontal=camera();wheel({deltaX:-20});assert.ok(camera()[0]<horizontal[0]);assert.equal(camera()[1],horizontal[1]);
  wheel({deltaY:-1,deltaMode:1});assert.ok(camera()[1]<horizontal[1]);
  wheel({deltaY:10000,deltaMode:2});assert.equal(camera()[1],1000-camera()[3]);
  const scroll=d.window.document.querySelector<HTMLInputElement>('[data-geo-scroll="y"]')!;assert.equal(Number(scroll.value),camera()[1]);scroll.value='50';scroll.dispatchEvent(new d.window.Event('input',{bubbles:true}));assert.equal(camera()[1],50);
  const zoomBefore=camera();wheel({deltaY:-100,ctrlKey:true});assert.ok(camera()[2]<zoomBefore[2]);assert.deepEqual(state(),original);
  click('[data-geo-action="focus"][data-value="all"]');assert.ok([...d.window.document.querySelectorAll<HTMLInputElement>('[data-geo-scroll]')].every(el=>el.disabled));const full=box();wheel({deltaX:200,deltaY:200});assert.equal(box(),full);
  click('[data-geo-action="zoom"][data-factor="0.8"]');assert.ok([...d.window.document.querySelectorAll<HTMLInputElement>('[data-geo-scroll]')].every(el=>!el.disabled));
  const beforeDrag=box();pointer('pointerdown',1,200,100);pointer('pointermove',1,250,120);pointer('pointerup',1,250,120);assert.notEqual(box(),beforeDrag);
  const beforePinch=box();pointer('pointerdown',1,200,100);pointer('pointerdown',2,300,100);pointer('pointermove',2,330,100);pointer('pointermove',2,390,100);pointer('pointerup',1,200,100);pointer('pointerup',2,390,100);assert.notEqual(box(),beforePinch);
  const beforeKeys=box();const svg=d.window.document.querySelector('.geo-surface')!;svg.dispatchEvent(new d.window.KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));svg.dispatchEvent(new d.window.KeyboardEvent('keydown',{key:'+',bubbles:true}));assert.notEqual(box(),beforeKeys);
  const search=d.window.document.querySelector<HTMLInputElement>('[data-geo-search]')!;search.value='성고';search.dispatchEvent(new d.window.Event('input',{bubbles:true}));click('.geo-search-results [data-id="chenggao"]');assert.match(d.window.document.querySelector('.geo-detail')!.textContent!,/위치 추정/);
  click('[data-geo-action="layer"][data-value="influence"]');assert.ok(d.window.document.querySelector('.geo-influence'));click('[data-geo-action="layer"][data-value="terrain"]');assert.equal(d.window.document.querySelector('.geo-relief'),null);
  click('[data-geo-action="source"]');assert.match(d.window.document.querySelector('.geo-detail')!.textContent!,/재배포 금지/);
  click('[data-geo-action="mode"][data-value="overview"]');assert.ok(d.window.document.querySelector('.geo-overview'));click('[data-geo-action="mode"][data-value="list"]');assert.equal(d.window.document.querySelectorAll('.geo-list button').length,22);
  click('[data-map-action="select"][data-key="0:1"]');click('[data-map-action="cancel"]');assert.deepEqual(state(),original);
  click('[data-geo-action="mode"][data-value="region"]');click('[data-geo-action="focus"][data-value="boss"]');click('[data-geo-action="restore"]');click('[data-geo-action="text"]');
  click('[data-map-action="select"][data-key="0:1"]');click('[data-geo-action="focus"][data-value="route"]');const saved:Record<string,string>={};for(let i=0;i<d.window.localStorage.length;i++){const k=d.window.localStorage.key(i)!;saved[k]=d.window.localStorage.getItem(k)!;}
  const savedBox=box();d.window.close();d=boot(saved);click('[data-a="continue"]');assert.equal(box(),savedBox);assert.deepEqual(state(),original);
  const stale=d.window.document.querySelector<HTMLButtonElement>('[data-map-action="confirm"]')!;assert.ok(stale);stale.click();const moved=state();assert.equal(moved.floor,0);assert.equal(moved.geography!.visited.length,1);stale.click();assert.deepEqual(state(),moved);assert.deepEqual(errors,[]);
 }finally{d.window.close();}
});
