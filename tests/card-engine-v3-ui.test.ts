import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {JSDOM} from 'jsdom';
import {saveCampaign,loadCampaign,CAMPAIGN_KEY} from '../src/core/campaign-save.ts';
import {memoryKV} from '../src/core/save.ts';
import {runDianwei,runLusu} from '../src/sim/card-engine-builds.ts';
import type {RunState} from '../src/core/types.ts';
import {freshRun,Player} from '../src/sim/card-engine-play.ts';
// 관문 대결 2판·설전 등급·난도·사람 플레이 시험 묶음의 공개 DOM 확인(jsdom). 실제 브라우저 렌더링이나 사람의 플레이 결과는 아니다.
test('gate screens show duel v2 state, debate grade checklist, profile and inside panels; the drawer has the playtest package',{timeout:180000},async()=>{
 const built=await build({logLevel:'silent',build:{write:false}}),out=Array.isArray(built)?built[0]:built;assert.ok('output' in out);const js=out.output.find(x=>x.type==='chunk');assert.ok(js&&js.type==='chunk');const errors:string[]=[];
 const boot=(r:RunState)=>{const kv=memoryKV();assert.ok(saveCampaign(kv,r));const d=new JSDOM('<main id="app"></main>',{url:'http://localhost/',runScripts:'outside-only',beforeParse(w){w.structuredClone=structuredClone;w.matchMedia=(()=>({matches:true})) as unknown as typeof w.matchMedia;w.localStorage.setItem(CAMPAIGN_KEY,kv.getItem(CAMPAIGN_KEY)!);w.addEventListener('error',e=>errors.push(String(e.error)));}});d.window.eval(js.code);return d;};
 const run=(dom:JSDOM)=>{const doc=dom.window.document;const click=(sel:string)=>{const b=doc.querySelector<HTMLButtonElement>(sel);assert.ok(b,sel);assert.equal(b.disabled,false,sel+' '+b.textContent);b.click();assert.deepEqual(errors,[]);};const state=()=>{const data=loadCampaign(dom.window.localStorage);assert.ok(data.ok);return data.data.activeExpedition!;};return {doc,click,state};};
 let dom=boot(runDianwei(false).gateState!);
 try{
  let {doc,click,state}=run(dom);click('[data-a="world-continue"]');
  assert.ok(doc.querySelector('.engine-profile'),'profile panel on the plan screen');assert.match(doc.querySelector('.engine-profile')!.textContent!,/표준\(검토 중\)/);
  click('[data-explore-action="engine:profile:harsh"]');assert.equal(state().campaign!.world!.raising!.engine!.profile,'harsh');click('[data-explore-action="engine:profile:standard"]');
  click('[data-raising="plan"][data-value="barracks"]');
  const v2=doc.querySelector('.engine-duel-v2');assert.ok(v2,'duel v2 panel');assert.match(v2!.textContent!,/군영 장악/);assert.match(v2!.textContent!,/거리 중거리/);assert.match(v2!.textContent!,/상대 지원/);assert.match(v2!.textContent!,/완전 장악/);
  assert.match(doc.body.textContent!,/간보기/);assert.match(doc.body.textContent!,/보법 · 들어가기/);assert.match(doc.body.textContent!,/유인/);
  click('[data-raising="gate"][data-value="probe"]');const g=state().campaign!.world!.raising!.gate!.duel!;assert.equal(g.v2!.stats.actions[0],'probe');assert.match(doc.querySelector('.engine-duel-v2')!.textContent!,/간보기로 공개/);
  dom.window.close();
  dom=boot(runLusu().gateState!);({doc,click,state}=run(dom));click('[data-a="world-continue"]');
  assert.ok(doc.querySelector('.engine-inside-prep'),'inside obstacles panel');assert.match(doc.querySelector('.engine-inside-prep')!.textContent!,/감시/);
  click('[data-raising="plan"][data-value="inside"]');const grade=doc.querySelector('.engine-debate-grade');assert.ok(grade,'debate grade preview');assert.match(grade!.textContent!,/지금 최종 제안하면/);assert.match(grade!.textContent!,/탁월한 합의/);assert.match(grade!.textContent!,/유리한 합의/);
  assert.match(doc.body.textContent!,/라운드 1\/5/);
  dom.window.close();
  const P=new Player(freshRun());P.act('enter');P.act('inn:offer:escort');P.act('inn:accept:escort');P.act('engine:pact-close');P.act('leave');
  dom=boot(P.r);({doc,click,state}=run(dom));click('[data-a="world-continue"]');click('[data-explore-tab="engine"]');const pt=doc.querySelector('.engine-playtest');assert.ok(pt,'playtest package');assert.match(pt!.textContent!,/141001/);assert.ok(doc.querySelector('.engine-playtest-guide:not([open])'),'routes hidden until opened');
  click('[data-explore-action^="engine:survey:chain:"]');assert.equal(state().campaign!.world!.raising!.engine!.telemetry.survey!.chain,'그렇다');
 }finally{dom.window.close();}
});
