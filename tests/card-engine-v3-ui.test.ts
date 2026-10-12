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
  const deck=doc.querySelector('.duel-deck');assert.ok(deck,'duel deck view');assert.match(deck!.textContent!,/지휘형/);assert.match(deck!.textContent!,/중거리/);assert.match(deck!.textContent!,/상대 다음 의도/);assert.match(deck!.textContent!,/병사 지원 카드/);assert.match(deck!.textContent!,/전술력 3\/3/);
  assert.ok(doc.querySelectorAll('.duel-hand .duel-card').length>=4,'hand of 4');assert.match(deck!.textContent!,/준비 전술·인재 지원/);
  const g0=state().campaign!.world!.raising!.gate!.duel!;const playable=g0.deck!.hand.find(u=>!doc.querySelector<HTMLButtonElement>(`[data-raising="gate"][data-value="card:${u}"]`)?.disabled);assert.ok(playable!==undefined);
  click(`[data-raising="gate"][data-value="card:${playable}"]`);const g=state().campaign!.world!.raising!.gate!.duel!;assert.equal(g.v2!.stats.actions.length,1);assert.ok(g.deck!.exhaust.includes(playable!)||g.deck!.discard.includes(playable!));
  click('[data-raising="gate"][data-value="end"]');assert.equal(state().campaign!.world!.raising!.gate!.duel!.round,1);assert.match(doc.querySelector('.duel-deck')!.textContent!,/1합/);
  dom.window.close();
  dom=boot(runLusu().gateState!);({doc,click,state}=run(dom));click('[data-a="world-continue"]');
  assert.ok(doc.querySelector('.engine-inside-prep'),'inside obstacles panel');assert.match(doc.querySelector('.engine-inside-prep')!.textContent!,/감시/);
  click('[data-raising="plan"][data-value="inside"]');const field=doc.querySelector('.debate-field');assert.ok(field,'argument field');assert.match(field!.textContent!,/군사형/);assert.match(field!.textContent!,/핵심 입장|피 흘리지 않는 개방/);assert.match(field!.textContent!,/예상/);assert.match(field!.textContent!,/상대 의도/);assert.ok(doc.querySelectorAll('.field-hand .field-card').length===5,'opening hand 5');assert.match(field!.textContent!,/주요 조항/);
  assert.match(field!.textContent!,/라운드 1\/4/,'military: short rounds');
  const opp=doc.querySelector<HTMLButtonElement>('.field-side.theirs button.field-arg');assert.ok(opp);opp!.click();assert.deepEqual(errors,[]);assert.ok(state().campaign!.world!.raising!.gate!.debate!.field!.focus,'target an opposing argument');
  dom.window.close();
  const P=new Player(freshRun());P.act('enter');P.act('inn:offer:escort');P.act('inn:accept:escort');P.act('engine:pact-close');P.act('leave');
  dom=boot(P.r);({doc,click,state}=run(dom));click('[data-a="world-continue"]');click('[data-explore-tab="engine"]');const pt=doc.querySelector('.engine-playtest');assert.ok(pt,'playtest package');assert.match(pt!.textContent!,/141001/);assert.ok(doc.querySelector('.engine-playtest-guide:not([open])'),'routes hidden until opened');
  click('[data-explore-action^="engine:survey:chain:"]');assert.equal(state().campaign!.world!.raising!.engine!.telemetry.survey!.chain,'그렇다');
 }finally{dom.window.close();}
});
