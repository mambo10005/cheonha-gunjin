import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {JSDOM} from 'jsdom';
import {loadCampaign} from '../src/core/campaign-save.ts';
import {explorationOf} from '../src/core/city-exploration.ts';
import {CITY_EXPLORATION_DEFS} from '../src/data/city-exploration.ts';
// 창고 호위 계약 조건 협상 DOM 확인. jsdom 공개 DOM 검사이며 실제 브라우저 플레이 결과는 아니다.
test('escort contract terms are offered as one grouped choice at the warehouse and the bonded term waits for the ledger',{timeout:180000},async()=>{
 const built=await build({logLevel:'silent',build:{write:false}}),out=Array.isArray(built)?built[0]:built;assert.ok('output' in out);const js=out.output.find(x=>x.type==='chunk');assert.ok(js&&js.type==='chunk');const errors:string[]=[];
 const dom=new JSDOM('<main id="app"></main>',{url:'http://localhost/',runScripts:'outside-only',beforeParse(w){w.structuredClone=structuredClone;w.matchMedia=(()=>({matches:true})) as unknown as typeof w.matchMedia;w.addEventListener('error',e=>errors.push(String(e.error)));}});dom.window.eval(js.code);const doc=dom.window.document;
 const click=(selector:string)=>{const b=doc.querySelector<HTMLButtonElement>(selector);assert.ok(b,selector);assert.equal(b.disabled,false,selector+' '+b.textContent);b.click();assert.deepEqual(errors,[]);};const act=(a:string)=>click(`[data-explore-action="${a}"]`);
 const change=(selector:string,value:string)=>{const el=doc.querySelector<HTMLInputElement|HTMLSelectElement>(selector)!;el.value=value;el.dispatchEvent(new dom.window.Event('change',{bubbles:true}));};
 const state=()=>{const data=loadCampaign(dom.window.localStorage);assert.ok(data.ok);return data.data.activeExpedition!;};
 const go=(to:string)=>{const d=CITY_EXPLORATION_DEFS.xingyang,from=explorationOf(state())!.location,queue=[[from]],seen=new Set<string>();let route:string[]=[];while(queue.length){const path=queue.shift()!,at=path.at(-1)!;if(at===to){route=path;break;}if(seen.has(at))continue;seen.add(at);for(const edge of d.links){const n=edge.a===at?edge.b:edge.b===at?edge.a:null;if(n&&!seen.has(n))queue.push([...path,n]);}}assert.ok(route.length,to);act('leave');for(const id of route.slice(1)){click(`[data-city-location="${id}"]`);act('move:'+id);}act('enter');};
 try{
  click('[data-a="world-new"]');change('[data-world-seed]','141001');click('[data-campaign-choice="founder"][data-value="chengong"]');change('[data-raising-origin]','notable');click('[data-world="start"]');act('enter');
  act('inn:select:dianwei');act('inn:offer:escort');act('inn:accept:escort');go('store');for(const id of ['cart','passage','guards'])act('scene:inspect:'+id);act('inn:quest:escort:investigate');
  const group=doc.querySelector('.inn-contract-terms');assert.ok(group,'contract terms group');assert.equal(group!.querySelectorAll('button').length,3);
  assert.ok(doc.querySelector<HTMLButtonElement>('[data-explore-action="inn:quest:escort:contract-bond"]')!.disabled,'bond needs ledger first');
  assert.equal(doc.querySelectorAll('[data-explore-action^="inn:quest:escort:contract"]').length,3,'contract choices appear once');
  act('scene:zone:office');act('scene:inspect:ledger');assert.equal(doc.querySelector<HTMLButtonElement>('[data-explore-action="inn:quest:escort:contract-bond"]')!.disabled,false);act('inn:quest:escort:contract-bond');assert.ok(explorationOf(state())!.inn!.quests.escort.evidence.includes('contract:4'));assert.equal(doc.querySelector('.inn-contract-terms'),null);
 }finally{dom.window.close();}
});

test('joint escort opens the real battle screen from the city and returns to the city exploration screen after the battle',{timeout:180000},async()=>{
 const built=await build({logLevel:'silent',build:{write:false}}),out=Array.isArray(built)?built[0]:built;assert.ok('output' in out);const js=out.output.find(x=>x.type==='chunk');assert.ok(js&&js.type==='chunk');const errors:string[]=[];
 const boot=(raw?:string)=>{const d=new JSDOM('<main id="app"></main>',{url:'http://localhost/',runScripts:'outside-only',beforeParse(w){w.structuredClone=structuredClone;w.matchMedia=(()=>({matches:true})) as unknown as typeof w.matchMedia;if(raw)w.localStorage.setItem('cheonha-gunjin.campaign',raw);w.addEventListener('error',e=>errors.push(String(e.error)));}});d.window.eval(js.code);return d;};
 let dom=boot(),doc=dom.window.document;
 const click=(selector:string)=>{const b=doc.querySelector<HTMLButtonElement>(selector);assert.ok(b,selector);assert.equal(b.disabled,false,selector+' '+b.textContent);b.click();assert.deepEqual(errors,[]);};const act=(a:string)=>click(`[data-explore-action="${a}"]`);
 const change=(selector:string,value:string)=>{const el=doc.querySelector<HTMLInputElement|HTMLSelectElement>(selector)!;el.value=value;el.dispatchEvent(new dom.window.Event('change',{bubbles:true}));};
 const state=()=>{const data=loadCampaign(dom.window.localStorage);assert.ok(data.ok);return data.data.activeExpedition!;};
 const go=(to:string)=>{const d=CITY_EXPLORATION_DEFS.xingyang,from=explorationOf(state())!.location,queue=[[from]],seen=new Set<string>();let route:string[]=[];while(queue.length){const path=queue.shift()!,at=path.at(-1)!;if(at===to){route=path;break;}if(seen.has(at))continue;seen.add(at);for(const edge of d.links){const n=edge.a===at?edge.b:edge.b===at?edge.a:null;if(n&&!seen.has(n))queue.push([...path,n]);}}assert.ok(route.length,to);act('leave');for(const id of route.slice(1)){click(`[data-city-location="${id}"]`);act('move:'+id);}act('enter');};
 try{
  click('[data-a="world-new"]');change('[data-world-seed]','141001');click('[data-campaign-choice="founder"][data-value="chengong"]');change('[data-raising-origin]','notable');click('[data-world="start"]');act('enter');
  act('inn:select:dianwei');act('inn:offer:escort');act('inn:accept:escort');go('store');for(const id of ['cart','passage','guards'])act('scene:inspect:'+id);act('inn:quest:escort:investigate');act('inn:quest:escort:contract');go('gate');
  act('inn:quest:escort:joint-escort');assert.ok(doc.querySelector('.cinematic-battle'),'battle screen');assert.equal(doc.querySelectorAll('.enemy-unit').length,3);assert.equal(doc.querySelector('[data-location-scene]'),null,'city scene hidden during battle');assert.equal(state().screen,'battle');
  const raw=dom.window.localStorage.getItem('cheonha-gunjin.campaign')!;dom.window.close();dom=boot(raw);doc=dom.window.document;click('[data-a="world-continue"]');assert.ok(doc.querySelector('.cinematic-battle'),'battle resumes after reload');
  for(let i=0;i<80&&!doc.querySelector('[data-a="finish-battle"]');i++){const skip=doc.querySelector<HTMLButtonElement>('[data-a="skip-battle"]');if(skip&&doc.querySelector('[data-busy="true"]')){skip.click();continue;}click('[data-a="end-turn"]');}
  click('[data-a="finish-battle"]');assert.equal(state().battle,null);assert.equal(explorationOf(state())!.inn!.quests.escort.step,3);assert.ok(doc.querySelector('[data-location-scene]'),'back in the city');assert.equal(doc.querySelector('.cinematic-battle'),null);
 }finally{dom.window.close();}
});
