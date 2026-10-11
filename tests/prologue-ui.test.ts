import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {build} from 'vite';
import {JSDOM} from 'jsdom';
import {loadCampaign,saveCampaign,CAMPAIGN_KEY} from '../src/core/campaign-save.ts';
import {newWorldCampaign} from '../src/core/world.ts';
import {startPrologue} from '../src/core/prologue.ts';
import {memoryKV} from '../src/core/save.ts';
import {raisingOf} from '../src/core/raising.ts';
import {prologueBotStep} from '../src/sim/prologue-policy.ts';
import {deckPolicyAction} from '../src/sim/debate-deck-policy.ts';
import {personnelOf} from '../src/core/personnel-rules.ts';

test('legacy saved prologue DOM: setup, contacts, optional cards, loadouts, late election, real debate, restoration and founding',{timeout:180000},async()=>{
 const built=await build({logLevel:'silent',build:{write:false}}),out=Array.isArray(built)?built[0]:built;assert.ok('output'in out);const js=out.output.find(x=>x.type==='chunk');assert.ok(js&&js.type==='chunk');const errors:string[]=[];
 const boot=(raw?:string)=>{const d=new JSDOM('<main id="app"></main>',{url:'http://localhost/',runScripts:'outside-only',beforeParse(w){w.structuredClone=structuredClone;w.matchMedia=(()=>({matches:true})) as unknown as typeof w.matchMedia;if(raw)w.localStorage.setItem(CAMPAIGN_KEY,raw);w.addEventListener('error',e=>errors.push(String(e.error)));}});d.window.eval(js.code);return d;};let d=boot();
 const click=(sel:string)=>{const b=d.window.document.querySelector<HTMLButtonElement>(sel);assert.ok(b,sel+' '+errors.join());assert.equal(b.disabled,false,sel);b.click();assert.deepEqual(errors,[]);};
 const change=(sel:string,value:string)=>{const el=d.window.document.querySelector<HTMLInputElement|HTMLSelectElement>(sel);assert.ok(el,sel);el.value=value;el.dispatchEvent(new d.window.Event('change',{bubbles:true}));};
 const state=()=>{const s=loadCampaign(d.window.localStorage);assert.ok(s.ok,JSON.stringify({errors,reason:!s.ok&&s.reason}));return s.data.activeExpedition!;};
 const reload=()=>{const before=state(),raw=d.window.localStorage.getItem(CAMPAIGN_KEY)!;d.window.close();d=boot(raw);click('[data-a="world-continue"]');assert.deepEqual(state(),before);};
 try{
  click('[data-a="world-new"]');assert.ok(d.window.document.querySelector('.campaign-setup'));assert.equal(d.window.document.querySelectorAll('[data-campaign-choice]').length,3);
  for(const image of d.window.document.querySelectorAll<HTMLImageElement>('.campaign-setup img'))assert.ok(existsSync('public'+image.getAttribute('src')));
  for(const sel of ['[data-founder]','[data-raising-assistant]','[data-world-doctrine]','[data-perk]','.campaign-deck-preview'])assert.equal(d.window.document.querySelector(sel),null);
  click('[data-campaign-choice="founder"][data-value="guojia"]');change('[data-raising-origin]','official');click('[data-world="select"][data-id="gong"]');assert.equal(d.window.document.querySelector('#campaign-hero-name')!.textContent,'곽가');assert.equal(d.window.document.querySelector<HTMLSelectElement>('[data-raising-origin]')!.value,'official');
  change('[data-world-seed]','-1');click('[data-world="start"]');assert.ok(d.window.document.querySelector('.campaign-setup'));
  // The public start now opens the spatial city, covered by city-exploration-ui.test.
  // Retain this interaction test for existing saves which deliberately keep the old route.
  const legacy=newWorldCampaign(131001).activeExpedition!;assert.ok(startPrologue(legacy,'xingyang','chengong','notable').ok);const kv=memoryKV();saveCampaign(kv,legacy);
  d.window.close();d=boot(kv.getItem(CAMPAIGN_KEY)!);click('[data-a="world-continue"]');assert.equal(raisingOf(state())!.cards.length,7);assert.ok(d.window.document.querySelector('.raising-route'));
  const phases=new Set<string>(),actions=new Set<string>();
  for(let i=0;i<180&&raisingOf(state())!.phase!=='founded';i++){
   const before=state(),q=raisingOf(before)!;if(!phases.has(q.phase)){reload();phases.add(q.phase);}
   if(q.phase==='debate'){const s=q.gate!.debate!;click(s.result==='ongoing'?`[data-raising="gate"][data-value="${deckPolicyAction(s)}"]`:'[data-raising="gate-finish"]');continue;}
   const expected=structuredClone(before);let command:{kind:string;action:string;value:string}|undefined;
   assert.ok(prologueBotStep(expected,'relations',(kind,action,value='')=>command={kind,action,value}),q.phase);assert.ok(command,q.phase);const cmd=command as {kind:string;action:string;value:string};actions.add(cmd.action.split(':')[0]);
   if(cmd.kind==='personnel'){
    if(cmd.action.startsWith('elect:')){const [,rep,support]=cmd.action.split(':');change('[data-personnel-representative]',rep);change('[data-personnel-assistant]',support);click('[data-personnel="elect"]');}
    else click(`[data-personnel="${cmd.action}"]`);
   }else{if(cmd.action==='play')click(`[data-raising="select-card"][data-value="${cmd.value}"]`);if(cmd.action==='found')change('[data-raising-name]','검증 의군');click(`[data-raising="${cmd.action}"][data-value="${cmd.value}"]`);}
   assert.deepEqual(state(),expected,cmd.action);
  }
  assert.equal(raisingOf(state())!.phase,'founded');assert.ok(personnelOf(state())!.stats.recruits>=3);for(const action of ['task','cooperate','recruit','equip','elect','refine','doctrine','found'])assert.ok(actions.has(action),action);reload();click('[data-world="panel"][data-id="personnel"]');assert.ok(d.window.document.querySelector('.personnel-library'));assert.ok(d.window.document.body.textContent!.includes('기한 만료'));assert.deepEqual(errors,[]);
 }finally{d.window.close();}
});
