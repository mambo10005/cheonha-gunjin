import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {build} from 'vite';
import {JSDOM} from 'jsdom';
import {loadCampaign,CAMPAIGN_KEY} from '../src/core/campaign-save.ts';
import {explorationOf} from '../src/core/city-exploration.ts';
import {raisingOf} from '../src/core/raising.ts';
import {personnelOf} from '../src/core/personnel-rules.ts';
import {chooseCityExplorationDecision,applyCityExplorationDecision} from '../src/sim/city-exploration-policy.ts';
import {CITY_EXPLORATION_DEFS} from '../src/data/city-exploration.ts';
import {worldRoute} from '../src/core/world.ts';

test('public DOM: city exploration, physical recruitment, growth, restored same-city administration and first expedition',{timeout:240000},async()=>{
 const built=await build({logLevel:'silent',build:{write:false}}),out=Array.isArray(built)?built[0]:built;assert.ok('output'in out);const chunk=out.output.find(x=>x.type==='chunk');assert.ok(chunk&&chunk.type==='chunk');
 const errors:string[]=[];
 const boot=(raw?:string)=>{const d=new JSDOM('<main id="app"></main>',{url:'http://localhost/',runScripts:'outside-only',beforeParse(w){w.structuredClone=structuredClone;w.matchMedia=(()=>({matches:true})) as unknown as typeof w.matchMedia;if(raw)w.localStorage.setItem(CAMPAIGN_KEY,raw);w.addEventListener('error',e=>errors.push(String(e.error)));}});d.window.eval(chunk.code);return d;};
 let d=boot();
 const click=(selector:string)=>{const button=d.window.document.querySelector<HTMLButtonElement>(selector);assert.ok(button,selector+' '+errors.join('\n'));assert.equal(button.disabled,false,selector);button.click();assert.deepEqual(errors,[]);};
 const change=(selector:string,value:string)=>{const field=d.window.document.querySelector<HTMLInputElement|HTMLSelectElement>(selector);assert.ok(field,selector);field.value=value;field.dispatchEvent(new d.window.Event('change',{bubbles:true}));};
 const state=()=>{const loaded=loadCampaign(d.window.localStorage);assert.ok(loaded.ok,JSON.stringify({errors,reason:!loaded.ok&&loaded.reason}));return loaded.data.activeExpedition!;};
 const reload=()=>{const before=state(),raw=d.window.localStorage.getItem(CAMPAIGN_KEY)!;d.window.close();d=boot(raw);click('[data-a="world-continue"]');assert.deepEqual(state(),before);};
 try{
  click('[data-a="world-new"]');change('[data-world-seed]','141001');click('[data-campaign-choice="founder"][data-value="chengong"]');change('[data-raising-origin]','notable');click('[data-world="select"][data-id="xingyang"]');click('[data-world="start"]');
  assert.ok(d.window.document.querySelector('.city-exploration-screen'));assert.equal(d.window.document.querySelector('.raising-route'),null);assert.equal(raisingOf(state())!.cards.length,7);
  // Location scenes are tall: management panels must open above the scene,
  // directly after the toolbar rather than beyond the bottom of the page.
  click('[data-explore-action="enter"]');assert.equal(explorationOf(state())!.scene,'location');const place=explorationOf(state())!.location;assert.ok(d.window.document.querySelector(`.location-scene[data-location-scene="xingyang:${place}"]`));assert.ok(d.window.document.querySelector('.exploration-layout.location-layout'));assert.ok(d.window.document.querySelector('.exploration-play-space.scene-play-space'));assert.ok(d.window.document.querySelectorAll('.location-zones button').length>=3);const zoneAction=d.window.document.querySelector<HTMLElement>('.location-zones button')!.dataset.exploreAction!;click(`[data-explore-action="${zoneAction}"]`);const inspectAction=d.window.document.querySelector<HTMLElement>('.location-inspectables [data-explore-action^="scene:inspect:"]')!.dataset.exploreAction!;click(`[data-explore-action="${inspectAction}"]`);assert.ok(explorationOf(state())!.locationScenes?.[`xingyang:${place}`]?.inspected.length);reload();
  const beforePanels=state();
  for(const [id,title] of [['roster','함께하는 사람들'],['library','카드 보관함과 활동 덱'],['items','품 안의 물건'],['preparation','거병을 향한 준비'],['record','소문과 발자취']]){
   click(`[data-explore-tab="${id}"]`);
   const panel=d.window.document.querySelector<HTMLElement>('.exploration-drawer')!,layout=d.window.document.querySelector('.exploration-layout')!;
   assert.ok(panel,id);assert.equal(panel.querySelector('h2')!.textContent,title);
   assert.ok(panel.compareDocumentPosition(layout)&d.window.Node.DOCUMENT_POSITION_FOLLOWING,id+' panel must precede the location scene');
   assert.equal(d.window.document.querySelector(`.exploration-tabs [data-explore-tab="${id}"]`)!.getAttribute('aria-expanded'),'true');
   assert.equal(d.window.document.activeElement,panel.querySelector('h2'));assert.deepEqual(state(),beforePanels);
  }
  click('.exploration-drawer [data-explore-tab="record"]');assert.equal(d.window.document.querySelector('.exploration-drawer'),null);
  click('[data-explore-tab="items"]');d.window.document.activeElement!.dispatchEvent(new d.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(d.window.document.querySelector('.exploration-drawer'),null);assert.deepEqual(state(),beforePanels);
  assert.ok(d.window.document.querySelector('.inn-screen[data-inn-view="overview"]'));
  assert.ok(d.window.document.querySelectorAll('.inn-people-strip .inn-person img').length>=1);assert.ok(d.window.document.querySelectorAll('.inn-elsewhere .btn').length>=1);
  click('[data-explore-action="inn:area:counter"]');click('[data-explore-action="inn:select:innkeeper"]');assert.ok(d.window.document.querySelector('.inn-dialogue-person[src="/assets/inn/innkeeper-v1.webp"]'));click('[data-explore-action="inn:topic:greet"]');
  click('[data-explore-action="inn:area:hall"]');click('[data-explore-action="inn:select:xunyu"]');assert.ok(d.window.document.querySelector('.inn-dialogue-person[src="/assets/inn/xunyu-v1.webp"]'));assert.equal(d.window.document.querySelector('[data-explore-action="officer:task:xunyu"]'),null);
  click('[data-explore-action="inn:offer:recommendation"]');assert.ok(d.window.document.querySelector('.inn-quest-offer ol'));assert.ok(d.window.document.body.textContent!.includes('보상은 귀환 보고 뒤 지급'));reload();
  click('[data-explore-action="leave"]');
  const original=state(),initial=explorationOf(original)!;assert.equal(d.window.document.querySelector('.city-exploration-marker')?.getAttribute('data-location'),initial.location);
  for(const image of d.window.document.querySelectorAll<HTMLImageElement>('.city-exploration-screen img')){const path=image.getAttribute('src');if(path?.startsWith('/'))assert.ok(existsSync('public'+path),path);}
  click('[data-city-location="market"]');const selected=explorationOf(state())!;assert.equal(selected.location,initial.location);assert.equal(selected.tick,initial.tick);assert.equal(selected.rng,initial.rng);assert.equal(raisingOf(state())!.rng,raisingOf(original)!.rng);
  click('[data-explore-camera="in"]');const camera=explorationOf(state())!;assert.equal(camera.location,initial.location);assert.equal(camera.tick,initial.tick);assert.ok(camera.camera.zoom>initial.camera.zoom);reload();
  const seen=new Set<string>(),layers=new Set<string>();let moved=false,paidTime=false;
  for(let step=0;step<260&&raisingOf(state())!.phase!=='founded';step++){
   const before=state(),x=explorationOf(before)!,q=raisingOf(before)!,key=q.phase+'/'+x.scene;
   if(!seen.has(key)){reload();seen.add(key);}
   const decision=chooseCityExplorationDecision(before,'logistics');assert.ok(decision,'no decision '+key);layers.add(decision.layer);
   if(decision.channel==='explore'&&decision.action.startsWith('move:'))click(`[data-city-location="${decision.action.slice(5)}"]`);
   if(decision.channel==='explore'&&decision.action==='enter'&&x.selected!==x.location)click(`[data-city-location="${x.location}"]`);
   const expected=structuredClone(state()),result=applyCityExplorationDecision(expected,decision);assert.ok(result.ok,result.reason);
   if(decision.channel==='explore'){
    if(decision.action.startsWith('card:'))click(`[data-explore-card="${decision.action.slice(5)}"]`);
    if(decision.action.startsWith('social:card:'))click(`[data-explore-social-card="${decision.action.slice(7)}"]`);
    if(!d.window.document.querySelector(`[data-explore-action="${decision.action}"]`))click(`[data-explore-tab="${decision.action==='plan'?'preparation':decision.action.startsWith('item:')?'items':'roster'}"]`);
    click(`[data-explore-action="${decision.action}"]`);
   }else if(decision.channel==='personnel'){
    if(decision.action.startsWith('elect:')){const [,rep,assistant]=decision.action.split(':');change('[data-personnel-representative]',rep);change('[data-personnel-assistant]',assistant);click('[data-personnel="elect"]');}
    else {if(!d.window.document.querySelector(`[data-personnel="${decision.action}"]`))click(`[data-explore-tab="${decision.action.startsWith('growth:')?'roster':'library'}"]`);click(`[data-personnel="${decision.action}"]`);}
   }else click(`[data-raising="${decision.action}"][data-value="${decision.value??''}"]`);
   const after=state();assert.deepEqual(after,expected,JSON.stringify(decision));
   if(decision.action.startsWith('move:')){moved=true;assert.notEqual(explorationOf(after)!.location,x.location);paidTime||=explorationOf(after)!.tick>x.tick;}
  }
  assert.equal(raisingOf(state())!.phase,'founded');assert.ok(moved&&paidTime);assert.ok(personnelOf(state())!.stats.recruits>0);for(const layer of ['exploration','event','relationship','deck','uprising'])assert.ok(layers.has(layer),layer);
  const city=state().campaign!.cities.xingyang!;assert.equal(city.id,'xingyang');assert.ok(city.exploration?.converted);assert.ok(Object.values(city.exploration!.locations).some(l=>l.secured));assert.ok(d.window.document.querySelector('.city-exploration-screen'));assert.equal(d.window.document.querySelector('.raising-route'),null);reload();assert.deepEqual(errors,[]);
  const visit=(target:string)=>{
   if(explorationOf(state())!.scene!=='map')click('[data-explore-action="leave"]');
   const def=CITY_EXPLORATION_DEFS.xingyang,todo=[[explorationOf(state())!.location]],visited=new Set<string>();let path:string[]=[];
   while(todo.length){const route=todo.shift()!,at=route.at(-1)!;if(at===target){path=route;break;}if(visited.has(at))continue;visited.add(at);for(const link of def.links){const next=link.a===at?link.b:link.b===at?link.a:null;if(next&&!visited.has(next))todo.push([...route,next]);}}
   assert.ok(path.length,'reachable '+target);for(const id of path.slice(1)){click(`[data-city-location="${id}"]`);click(`[data-explore-action="move:${id}"]`);}click('[data-explore-action="enter"]');assert.equal(explorationOf(state())!.location,target);
  };
  visit('hall');const recruit=state().campaign!.roster.find(id=>id!==personnelOf(state())!.protagonistId)!;assert.ok(recruit);change('[data-role="civil"]',recruit);click('[data-city="appoint"][data-id="civil"]');assert.equal(state().campaign!.cities.xingyang!.roles.civil,recruit);
  visit('market');const treasury=state().campaign!.world!.treasury;click('[data-world="tax"][data-id="xingyang"]');assert.equal(state().campaign!.world!.treasury,treasury+5);
  visit('barracks');const reserve=state().campaign!.cities.xingyang!.reserveTroops??0;click('[data-world="levy"]');assert.equal(state().campaign!.cities.xingyang!.reserveTroops,reserve+12);
  visit('store');assert.ok(d.window.document.body.textContent!.includes('도시 비축 군량'));const provisions=state().campaign!.cities.xingyang!.food;reload();click('[data-world="map"]');click('[data-world="select"][data-id="chenggao"]');
  const quote=worldRoute(state(),'chenggao');change('[data-troops]','12');change('[data-provisions]',String(Math.min(provisions,quote.capacity,Math.max(quote.cost+2,8))));click('[data-world="depart"][data-id="chenggao"]');assert.equal(state().campaign!.world!.stage,'operation');assert.equal(state().campaign!.stage,'expedition');assert.equal(state().campaign!.world!.operation?.origin,'xingyang');assert.ok(state().campaign!.cities.xingyang!.food<provisions);reload();assert.deepEqual(errors,[]);
  // JSDOM exercises public controls and serialized state; it does not measure CSS layout,
  // screen sizes, graphical effects, browser policy, animation smoothness or human enjoyment.
 }finally{d.window.close();}
});
