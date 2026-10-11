import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {JSDOM} from 'jsdom';
import {newWorldCampaign,configureStart} from '../src/core/world.ts';
import {startRaising,raisingOf} from '../src/core/raising.ts';
import {raisingBotStep} from '../src/sim/raising-policy.ts';
import {previewDuelAction,canDuelAction} from '../src/core/duel.ts';
import {saveCampaign,loadCampaign,CAMPAIGN_KEY} from '../src/core/campaign-save.ts';
import {memoryKV} from '../src/core/save.ts';
let code:Promise<string>|undefined;
function compiled(){return code??=(async()=>{const result=await build({logLevel:'silent',build:{write:false}}),out=Array.isArray(result)?result[0]:result;assert.ok('output'in out);const js=out.output.find(x=>x.type==='chunk');assert.ok(js&&js.type==='chunk');return js.code;})();}
function boot(js:string,raw:string){const errors:string[]=[];const d=new JSDOM('<main id="app"></main>',{url:'http://localhost/',runScripts:'outside-only',beforeParse(w){w.structuredClone=structuredClone;w.matchMedia=(()=>({matches:true})) as unknown as typeof w.matchMedia;w.localStorage.setItem(CAMPAIGN_KEY,raw);w.addEventListener('error',e=>errors.push(String(e.error)));}});d.window.eval(js);const click=(selector:string)=>{const b=d.window.document.querySelector<HTMLButtonElement>(selector);assert.ok(b,selector+errors.join());assert.equal(b.disabled,false);b.click();};click('[data-a="world-continue"]');return {d,errors,click};}
test('public DOM military gate: select proxy, prepared tactics, every-round reload, victory and campaign conversion',{timeout:120000},async()=>{
 const r=newWorldCampaign(121001).activeExpedition!;configureStart(r,'xingyang','wanderer','zhangliao','people','granary');startRaising(r,'militia','guard');while(raisingOf(r)!.phase!=='plan')assert.ok(raisingBotStep(r,'military'));const kv=memoryKV();saveCampaign(kv,r);const js=await compiled();let ui=boot(js,kv.getItem(CAMPAIGN_KEY)!);
 const state=()=>{const c=loadCampaign(ui.d.window.localStorage);assert.ok(c.ok);return c.data.activeExpedition!;};
 try{const select=ui.d.window.document.querySelector<HTMLSelectElement>('[data-raising-representative]')!;select.value='dianwei';ui.click('[data-raising="plan"][data-value="barracks"]');assert.equal(raisingOf(state())!.gate!.duel!.generalId,'dianwei');
  for(let i=0;i<5&&raisingOf(state())!.gate!.duel!.result==='ongoing';i++){const s=raisingOf(state())!.gate!.duel!;const action=['strike','probe','guard','finisher',...(s.tactics??[])].filter(a=>canDuelAction(s,a,s.round).ok).map(a=>({a,p:previewDuelAction(s,a).state})).sort((a,b)=>((b.p.result==='win'?100:0)+b.p.hp/b.p.maxHp-b.p.enemyHp/b.p.enemyMaxHp)-((a.p.result==='win'?100:0)+a.p.hp/a.p.maxHp-a.p.enemyHp/a.p.enemyMaxHp))[0].a;ui.click(`[data-raising="gate"][data-value="${action}"]`);const raw=ui.d.window.localStorage.getItem(CAMPAIGN_KEY)!,prior=state();assert.deepEqual(ui.errors,[]);ui.d.window.close();ui=boot(js,raw);assert.deepEqual(state(),prior);}
  ui.click('[data-raising="gate-finish"]');assert.equal(raisingOf(state())!.phase,'result');ui.click('[data-raising="found"]');assert.equal(raisingOf(state())!.phase,'founded');assert.ok(state().campaign!.roster.includes('dianwei'));assert.ok(state().campaign!.cities.xingyang!.reserveTroops!>0);assert.deepEqual(ui.errors,[]);
 }finally{ui.d.window.close();}
});
test('public DOM preserves old preparation stocks and offers an explicit one-time card-run migration',{timeout:120000},async()=>{
 const r=newWorldCampaign(111001).activeExpedition!;configureStart(r,'xingyang','wanderer','chengong','people','granary');const original=structuredClone(r.campaign!.world!.preparation),kv=memoryKV();saveCampaign(kv,r);const ui=boot(await compiled(),kv.getItem(CAMPAIGN_KEY)!);
 try{assert.ok(ui.d.window.document.body.textContent!.includes('이전 거병 준비 저장'));ui.click('[data-world="migrateRaising"]');const loaded=loadCampaign(ui.d.window.localStorage);assert.ok(loaded.ok);const p=loaded.data.world!.preparation;for(const key of ['funds','food','troops','support','exposure'] as const)assert.equal(p[key],original[key]);assert.equal(loaded.data.world!.raising!.cards.length,10);assert.ok(ui.d.window.document.querySelector('.raising-route'));assert.equal(ui.d.window.document.querySelector('[data-world="migrateRaising"]'),null);assert.deepEqual(ui.errors,[]);}finally{ui.d.window.close();}
});
