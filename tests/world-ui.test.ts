import {newWorldCampaign,configureStart} from '../src/core/world.ts';
import {startRaising} from '../src/core/raising.ts';
import {campaignSnapshot} from '../src/core/campaign-save.ts';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {JSDOM} from 'jsdom';
import {loadCampaign,CAMPAIGN_KEY} from '../src/core/campaign-save.ts';
import {activeCity,canAdminCard,previewCityAction} from '../src/core/city.ts';
import {raisingOf,previewRaisingCard} from '../src/core/raising.ts';
import {raisingBotStep} from '../src/sim/raising-policy.ts';
import {deckPolicyAction} from '../src/sim/debate-deck-policy.ts';
test('legacy saved-run public DOM: six-node raising deck, collection/refinement, gate, real city conversion, previews, reload and paid departure',{timeout:180000},async()=>{
 const result=await build({logLevel:'silent',build:{write:false}}),out=Array.isArray(result)?result[0]:result;assert.ok('output' in out);const js=out.output.find(x=>x.type==='chunk');assert.ok(js&&js.type==='chunk');const errors:string[]=[];
 const boot=(saved:Record<string,string>={})=>{const dom=new JSDOM('<main id="app"></main>',{url:'http://localhost/',runScripts:'outside-only',beforeParse(w){w.structuredClone=structuredClone;w.matchMedia=(()=>({matches:true})) as unknown as typeof w.matchMedia;for(const [k,v] of Object.entries(saved))w.localStorage.setItem(k,v);w.addEventListener('error',e=>errors.push(String(e.error)));}});dom.window.eval(js.code);return dom;};const legacy=newWorldCampaign(121001).activeExpedition!;configureStart(legacy,'xingyang','wanderer','chengong','people','granary');startRaising(legacy,'notable','guard');let d=boot({[CAMPAIGN_KEY]:JSON.stringify({version:7,data:campaignSnapshot(legacy)})});
 const click=(q:string)=>{const el=d.window.document.querySelector<HTMLButtonElement>(q);assert.ok(el,q+' '+errors.join());assert.equal(el.disabled,false,q);el.click();};
 const state=()=>{const c=loadCampaign(d.window.localStorage);assert.ok(c.ok,JSON.stringify({errors,reason:!c.ok&&c.reason,raw:d.window.localStorage.getItem(CAMPAIGN_KEY)}));return c.data.activeExpedition!;};
 const change=(q:string,value:string)=>{const el=d.window.document.querySelector<HTMLInputElement|HTMLSelectElement>(q);assert.ok(el,q);el.value=value;el.dispatchEvent(new d.window.Event('change',{bubbles:true}));};
 const rc=(a:string,v='')=>click(`[data-raising="${a}"][data-value="${v}"]`);
 const reload=()=>{const prior=state(),saved:Record<string,string>={};for(let i=0;i<d.window.localStorage.length;i++){const key=d.window.localStorage.key(i)!;saved[key]=d.window.localStorage.getItem(key)!;}assert.ok(saved[CAMPAIGN_KEY]);d.window.close();d=boot(saved);click('[data-a="world-continue"]');assert.deepEqual(state(),prior);};
 try{
  click('[data-a="world-continue"]');assert.equal(raisingOf(state())!.cards.length,10);assert.ok(d.window.document.querySelector('.raising-route'));
  const restored=new Set<string>();
  for(let i=0;i<150&&raisingOf(state())!.phase!=='founded';i++){
   const before=state(),q=raisingOf(before)!;
   if(['node','reward','debate','result'].includes(q.phase)&&!restored.has(q.phase)){reload();restored.add(q.phase);}
   const expected=structuredClone(before);assert.ok(raisingBotStep(expected,'balanced'),q.phase);const after=raisingOf(expected)!;
   if(q.phase==='map')rc('node',after.node!);
   else if(q.phase==='node'){
    if(q.event===null)rc('choice','0');
    else if(after.phase==='reward')rc('finish');
    else if(after.played>q.played){const uid=q.hand.find(uid=>JSON.stringify(raisingOf(previewRaisingCard(before,uid).state))===JSON.stringify(after));assert.notEqual(uid,undefined);rc('select-card',String(uid));assert.ok(d.window.document.querySelector('.raising-preview'));rc('play',String(uid));}
    else rc('assist');
   }else if(q.phase==='reward'){
    let a='resource';const addedAlly=after.allies.find(id=>!q.allies.includes(id));
    if(after.regional!==q.regional)a='ally:'+after.regional;
    else if(addedAlly)a='ally:'+addedAlly;
    else if(after.cards.length>q.cards.length)a='add:'+after.cards.find(c=>!q.cards.some(b=>b.uid===c.uid))!.id;
    else if(after.cards.length<q.cards.length)a='remove:'+q.cards.find(c=>!after.cards.some(b=>b.uid===c.uid))!.uid;
    else if(after.stats.upgrades>q.stats.upgrades){const c=after.cards.find(c=>c.upgrade&&!q.cards.find(b=>b.uid===c.uid)!.upgrade)!;a=`upgrade:${c.uid}:${c.upgrade}`;}
    else if(after.schemes.length>q.schemes.length)a='scheme:'+after.schemes.find(id=>!q.schemes.includes(id));
    else if(after.stats.skips>q.stats.skips)a='skip';
    rc('reward',a);
   }else if(q.phase==='plan'){change('[data-raising-representative]',after.gate!.representative);rc('plan',after.plan!);}
   else if(q.phase==='debate'){if(q.gate!.debate!.result==='ongoing')rc('gate',deckPolicyAction(q.gate!.debate!));else rc('gate-finish');}
   else if(q.phase==='result'){change('[data-raising-name]','검증 의군');rc('found');}
   else assert.fail(q.phase);
   assert.deepEqual(state(),expected,'transaction '+q.phase);
  }
  const founded=state();assert.equal(raisingOf(founded)!.phase,'founded');assert.equal(raisingOf(founded)!.visited.length,6);assert.equal(raisingOf(founded)!.stats.removes,1);assert.equal(raisingOf(founded)!.stats.upgrades,1);assert.ok(founded.campaign!.cities.xingyang!.promises.length);reload();
  click('[data-world="select"][data-id="xingyang"]');click('[data-world="city"][data-id="xingyang"]');assert.equal(d.window.document.querySelector('[data-city="end"]'),null);
  click('[data-city="drawer"][data-id="generals"]');change('[data-role="civil"]','chengong');click('[data-city="appoint"][data-id="civil"]');assert.equal(activeCity(state())!.roles.civil,'chengong');assert.ok(!state().generals.some(g=>g.id==='chengong'));
  const r=state(),uid=activeCity(r)!.hand.find(uid=>canAdminCard(r,uid).ok);assert.notEqual(uid,undefined);const preview=previewCityAction(r,{kind:'card',uid:uid!});click(`[data-city="select-card"][data-id="${uid}"]`);click(`[data-city="play"][data-id="${uid}"]`);assert.deepEqual(state(),preview.state);
  click('[data-world="map"]');click('[data-world="levy"]');const troops=activeCity(state())!.reserveTroops!;click('[data-world="select"][data-id="chenggao"]');change('[data-troops]',String(troops));change('[data-provisions]','8');const before=state(),food=activeCity(before)!.food;click('[data-world="depart"][data-id="chenggao"]');const departed=state();assert.equal(departed.campaign!.world!.stage,'operation');assert.equal(activeCity(departed)!.reserveTroops,0);assert.equal(activeCity(departed)!.food,food-8);assert.ok(d.window.document.querySelector('[data-world="march"]'));assert.deepEqual(errors,[]);
 }finally{d.window.close();}
});
