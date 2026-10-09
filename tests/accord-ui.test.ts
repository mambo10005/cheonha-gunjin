import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {build} from 'vite';
import {RUN_KEY,loadRun,saveRun} from '../src/core/save.ts';
import type {RunState} from '../src/core/types.ts';

test('새 설전·협정 화면: 실제 입력·저장 복원·호송/작전 지원·지정 성장', {timeout:30000}, async()=>{
 const bundle=await build({logLevel:'silent',build:{write:false}});const out=(Array.isArray(bundle)?bundle[0]:bundle);assert.ok('output' in out);const chunk=out.output.find(o=>o.type==='chunk');assert.ok(chunk && chunk.type==='chunk');
 const html=readFileSync('index.html','utf8').replace(/<script[^>]+src="\/src\/ui\/main.ts"[^>]*><\/script>/,'');const errors:string[]=[];
 const app=(saved?:string)=>{const d=new JSDOM(html,{url:'http://localhost/',runScripts:'outside-only',beforeParse(w){w.structuredClone=structuredClone;if(saved)w.localStorage.setItem(RUN_KEY,saved);w.addEventListener('error',e=>errors.push(String(e.error)));}});d.window.eval(chunk.code);return d;};
 let dom=app();
 const click=(sel:string)=>{let e=dom.window.document.querySelector<HTMLButtonElement>(sel);if(!e && sel.includes('debate-action')){const choice=sel.match(/data-choice="([^"]+)"/)?.[1];dom.window.document.querySelector<HTMLButtonElement>('[data-debate-select="'+choice+'"]')?.click();e=dom.window.document.querySelector<HTMLButtonElement>(sel);}assert.ok(e,sel);assert.equal(e.disabled,false,sel);e.click();};
 const state=():RunState=>{const l=loadRun(dom.window.localStorage);assert.ok(l.ok);return l.data;};
 const reload=()=>{const text=dom.window.localStorage.getItem(RUN_KEY)!;dom.window.close();dom=app(text);click('[data-a="continue"]');};
 const move=()=>{click('[data-a="move"][data-col="0"]');if(state().pending.kind==='growth'){click('[data-kind="growth"][data-choice="recover"]');if(dom.window.document.querySelector('[data-a="leave"]'))click('[data-a="leave"]');click('[data-a="move"][data-col="0"]');}};
 const leave=()=>{if(state().screen==='map')return;click('[data-a="leave"]');if(state().pending.kind==='growth'){click('[data-kind="growth"][data-choice="recover"]');if(state().screen==='node')click('[data-a="leave"]');}};
 try {
  click('[data-a="to-lords"]');click('[data-a="accord-demo"]');move();click('[data-kind="begin-debate"][data-choice="sponsorship"]');click('[data-kind="debate-action"][data-choice="disclose"]');const before=state();reload();assert.deepEqual(state(),before);click('[data-kind="debate-action"][data-choice="withdraw"]');click('[data-kind="finish-debate"]');click('[data-kind="decline-council"]');leave();
  move();click('[data-a="supply"][data-c="food"]');leave();move();click('[data-kind="village-diplomacy"]');click('[data-kind="sign-agreement"][data-choice="escort"]');leave();move();
  const select=dom.window.document.querySelector<HTMLSelectElement>('#social-general')!;select.value='guojia';click('[data-kind="sign-agreement"][data-choice="operation"]');leave();move();click('[data-a="supply"][data-c="food"]');leave();const armed=state();reload();assert.deepEqual(state(),armed);
  move();click('[data-kind="decline-duel"]');assert.equal(state().battle!.block.front,8);assert.equal(state().battle!.enemies[0].hp,state().battle!.enemies[0].maxHp-4);
  // The engine tests exercise combat. This UI fixture isolates result dispatch and bound growth.
  const battle=state();battle.battle!.result='win';saveRun(dom.window.localStorage,battle);reload();click('[data-a="finish-battle"]');const growth=state();assert.equal(growth.pending.kind,'growth');if(growth.pending.kind==='growth')assert.equal(growth.pending.general,'guojia');click('[data-kind="growth"][data-choice="planner"]');assert.equal(state().build.growth.guojia.level,1);assert.equal(state().social.accords.agreements.filter(a=>a.status==='fulfilled').length,2);const completed=state();reload();assert.deepEqual(state(),completed);assert.deepEqual(errors,[]);
 }finally{dom.window.close();}
});
