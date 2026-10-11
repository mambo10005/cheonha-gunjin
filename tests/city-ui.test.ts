import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {JSDOM} from 'jsdom';
import {loadRun} from '../src/core/save.ts';
import {activeCity,canAdminCard,previewCityAction} from '../src/core/city.ts';
import {FACILITY_DEFS} from '../src/data/cities.ts';
test('compiled city DOM: full playable cycle, appointments, policy/facility/seal, exact preview, restore and one-time departure',{timeout:120000},async()=>{
 const b=await build({logLevel:'silent',define:{'import.meta.env.DEV':'true'},build:{write:false}}),out=Array.isArray(b)?b[0]:b;assert.ok('output' in out);const js=out.output.find(x=>x.type==='chunk');assert.ok(js&&js.type==='chunk');const errors:string[]=[];
 const boot=(saved:Record<string,string>={})=>{const d=new JSDOM('<main id="app"></main>',{url:'http://localhost/?dev=1',runScripts:'outside-only',beforeParse(w){w.structuredClone=structuredClone;w.matchMedia=(()=>({matches:true})) as unknown as typeof w.matchMedia;for(const [k,v] of Object.entries(saved))w.localStorage.setItem(k,v);w.addEventListener('error',e=>errors.push(String(e.error)));}});d.window.eval(js.code);return d;};
 let d=boot();const click=(q:string)=>{const el=d.window.document.querySelector<HTMLButtonElement>(q);assert.ok(el,q);assert.equal(el.disabled,false,q);el.click();};const state=()=>{const s=loadRun(d.window.localStorage);assert.ok(s.ok);return s.data;};
 const select=(q:string,value:string)=>{const el=d.window.document.querySelector<HTMLSelectElement>(q);assert.ok(el);el.value=value;el.dispatchEvent(new d.window.Event('change',{bubbles:true}));};
 try{
  click('[data-a="to-lords"]');click('[data-a="city-campaign"]');assert.equal(state().campaign!.seed,101001);
  click('[data-city="approach"][data-id="scout"]');click('[data-city="approach"][data-id="protect"]');click('[data-city="conquest"][data-id="inside"]');click('[data-city="occupy"][data-id="shared"]');assert.equal(state().campaign!.stage,'admin');
  const beforeBrowse=state();click('[data-city="district"][data-id="gate"]');assert.match(d.window.document.querySelector('.city-context h2')!.textContent!,/성문/);assert.deepEqual(state(),beforeBrowse);
  click('[data-city="drawer"][data-id="generals"]');select('[data-role="civil"]','chengpu');click('[data-city="appoint"][data-id="civil"]');assert.equal(activeCity(state())!.roles.civil,'chengpu');assert.ok(!state().generals.some(g=>g.id==='chengpu'));
  click('[data-city="drawer"][data-id="policy"]');click('[data-city="policy"][data-id="settlement"]');click('[data-city="seal"][data-id="harmony"]');assert.equal(activeCity(state())!.policies.length,1);
  click('[data-city="drawer"][data-id="facilities"]');const facility=activeCity(state())!.blueprints.find(id=>FACILITY_DEFS[id].district!=='hall')!;click(`[data-city="facility"][data-id="${facility}"]`);assert.equal(activeCity(state())!.districts.filter(d=>d.facility).length,1);
  click('[data-city="end"]');assert.equal(activeCity(state())!.phase,2);assert.ok(d.window.document.querySelector('.city-turn')!.textContent!.includes('카드 사용은 단계를 종료하지 않습니다'));
  const r=state(),uid=activeCity(r)!.hand.find(uid=>canAdminCard(r,uid).ok)!;const p=previewCityAction(r,{kind:'card',uid});click(`[data-city="select-card"][data-id="${uid}"]`);assert.deepEqual(state(),r);assert.ok(d.window.document.querySelector('.city-context')!.textContent!.includes('사용 후 예상'));click(`[data-city="play"][data-id="${uid}"]`);assert.deepEqual(state(),p.state);
  click('[data-city="text"]');assert.match(d.window.document.querySelector('.city-screen')!.getAttribute('style')!,/1.25/);click('[data-city="contrast"]');assert.equal(d.window.document.querySelector('.city-screen')!.getAttribute('data-contrast'),'true');
  click('[data-city="drawer"][data-id="relations"]');assert.match(d.window.document.querySelector('.city-drawer')!.textContent!,/약속|협정/);click('[data-city="drawer"][data-id="records"]');assert.ok(d.window.document.querySelector('.city-drawer'));
  const prior=state(),saved:Record<string,string>={};for(let i=0;i<d.window.localStorage.length;i++){const k=d.window.localStorage.key(i)!;saved[k]=d.window.localStorage.getItem(k)!;}d.window.close();d=boot(saved);click('[data-a="continue"]');assert.deepEqual(state(),prior);
  for(let phase=2;phase<=5;phase++){select('[data-plan]','issues');click('[data-city="delegate"]');}assert.equal(state().campaign!.stage,'ready');
  const departure=d.window.document.querySelector<HTMLButtonElement>('[data-city="depart"][data-id="chenggao"]')!;assert.ok(departure);departure.click();const departed=state();assert.equal(departed.campaign!.stage,'expedition');assert.equal(departed.geography!.corridor!.to,'chenggao');assert.ok(d.window.document.body.textContent!.includes('성고'));departure.click();assert.deepEqual(state(),departed);assert.deepEqual(errors,[]);
 }finally{d.window.close();}
});
