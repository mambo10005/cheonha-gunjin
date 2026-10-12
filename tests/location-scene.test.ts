import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CITY_EXPLORATION_DEFS} from '../src/data/city-exploration.ts';
import {LOCATION_SCENE_DEFS} from '../src/data/location-scenes.ts';
import {explorationOf,exploreAction} from '../src/core/city-exploration.ts';
import {locationSceneKey} from '../src/core/location-scene.ts';
import {newWorldCampaign} from '../src/core/world.ts';
import {startCityExploration} from '../src/core/city-exploration-start.ts';
import {saveCampaign,loadCampaign,campaignSnapshot,CAMPAIGN_KEY} from '../src/core/campaign-save.ts';
import {memoryKV} from '../src/core/save.ts';
import type {RunState} from '../src/core/types.ts';
const fresh=()=>{const r=newWorldCampaign(141001).activeExpedition!;assert.ok(startCityExploration(r,'xingyang','chengong','notable').ok);/* 카드 엔진 이전 저장(레거시 규칙) 경로를 검증한다. 카드 엔진 경로는 tests/card-engine*.test.ts */delete r.campaign!.world!.raising!.engine;return r;};
const act=(r:RunState,a:string)=>{const result=exploreAction(r,a,explorationOf(r)!.revision);assert.ok(result.ok,a+' '+result.reason);};
const reload=(r:RunState)=>{const kv=memoryKV();assert.ok(saveCampaign(kv,r));const loaded=loadCampaign(kv);assert.ok(loaded.ok);return loaded.data.activeExpedition!;};
function visit(r:RunState,to:string){const x=explorationOf(r)!;if(x.scene!=='map')act(r,'leave');const d=CITY_EXPLORATION_DEFS.xingyang,queue=[[x.location]],seen=new Set<string>();let route:string[]=[];while(queue.length){const path=queue.shift()!,at=path.at(-1)!;if(at===to){route=path;break;}if(seen.has(at))continue;seen.add(at);for(const edge of d.links){const n=edge.a===at?edge.b:edge.b===at?edge.a:null;if(n&&!seen.has(n))queue.push([...path,n]);}}assert.ok(route.length);for(const id of route.slice(1))act(r,'move:'+id);act(r,'enter');}

test('all city places resolve to data-driven scene definitions with usable zones, people roles and investigations',()=>{
 for(const [city,definition] of Object.entries(CITY_EXPLORATION_DEFS))for(const location of definition.locations){
  const scene=LOCATION_SCENE_DEFS[locationSceneKey(city,location.id)];assert.ok(scene,`${city}:${location.id}`);assert.equal(scene.locationId,location.id);assert.ok(scene.zones.length>=3);assert.equal(new Set(scene.zones.map(z=>z.id)).size,scene.zones.length);assert.ok(scene.inspectables.length>=3);assert.ok(scene.managerRole);assert.ok(scene.preUprising.length&&scene.postUprising.length);
 }
});

test('location scene zone, character and inspection state persist and repeated inspection cannot consume time twice',()=>{
 let r=fresh();act(r,'enter');const x=explorationOf(r)!,before=x.tick;act(r,'scene:zone:counter');act(r,'scene:character:xunyu');act(r,'scene:talk:xunyu:route');act(r,'scene:inspect:ledger');const after=x.tick;assert.equal(after,before+1);assert.equal(x.locationScenes![locationSceneKey('xingyang','inn')].selectedCharacterId,'xunyu');assert.equal(x.locationScenes![locationSceneKey('xingyang','inn')].phase,'investigation');assert.ok(x.locationScenes![locationSceneKey('xingyang','inn')].clues.includes('ledger'));act(r,'scene:inspect:ledger');assert.equal(x.tick,after);r=reload(r);assert.equal(explorationOf(r)!.locationScenes![locationSceneKey('xingyang','inn')].selectedCharacterId,'xunyu');assert.ok(explorationOf(r)!.locationScenes![locationSceneKey('xingyang','inn')].inspected.includes('ledger'));
});

test('warehouse clue inspection is once-only and is required before resolving the escort request',()=>{
 const r=fresh();act(r,'enter');act(r,'inn:offer:escort');act(r,'inn:accept:escort');visit(r,'store');act(r,'inn:quest:escort:investigate');const x=explorationOf(r)!,q=x.inn!.quests.escort;assert.equal(q.step,1);let rejected=exploreAction(r,'inn:quest:escort:contract',x.revision);assert.equal(rejected.ok,false);for(const id of ['cart','passage','guards'])act(r,'scene:inspect:'+id);assert.ok(['cart','passage','guards'].every(id=>q.evidence.includes(id)));const tick=x.tick;act(r,'scene:inspect:cart');assert.equal(x.tick,tick);assert.equal(exploreAction(r,'inn:quest:escort:contract',x.revision).ok,true);
});

test('older escort saves keep completed receipts and resume old approvals at physical transport',()=>{
 const r=fresh();act(r,'enter');act(r,'inn:offer:escort');act(r,'inn:accept:escort');const data=campaignSnapshot(r),quest=data.cities.xingyang?.exploration?.inn?.quests.escort;assert.ok(quest);quest.status='readyToReport';quest.step=2;quest.evidence.push('guard');const kv=memoryKV();kv.setItem(CAMPAIGN_KEY,JSON.stringify({version:7,data}));const loaded=loadCampaign(kv);assert.ok(loaded.ok);const migrated=loaded.data.activeExpedition!.campaign!.cities.xingyang!.exploration!.inn!.quests.escort;assert.equal(migrated.status,'active');assert.equal(migrated.step,2);assert.ok(migrated.evidence.includes('legacy-approved'));
 const receipt=campaignSnapshot(r),completed=receipt.cities.xingyang?.exploration?.inn?.quests.escort;assert.ok(completed);completed.status='completed';completed.reported=true;completed.step=2;const second=memoryKV();second.setItem(CAMPAIGN_KEY,JSON.stringify({version:7,data:receipt}));const restored=loadCampaign(second);assert.ok(restored.ok);assert.equal(restored.data.activeExpedition!.campaign!.cities.xingyang!.exploration!.inn!.quests.escort.step,3);
});

test('warehouse alternate passage requires gathered witnesses and intel, then records Lu Su cooperation',()=>{
 const r=fresh();act(r,'enter');act(r,'inn:offer:escort');act(r,'inn:accept:escort');r.campaign!.world!.raising!.intel=1;const initialTrust=r.campaign!.personnel!.officers.lusu.trust;visit(r,'store');for(const id of ['cart','passage','guards','workers'])act(r,'scene:inspect:'+id);const q=explorationOf(r)!.inn!.quests.escort;assert.equal(q.step,1);const exposure=r.campaign!.world!.preparation.exposure;act(r,'inn:quest:escort:alternate');assert.equal(q.step,2);assert.equal(r.campaign!.world!.preparation.exposure,exposure+1);assert.equal(r.campaign!.personnel!.officers.lusu.trust,initialTrust+5);assert.ok(r.campaign!.personnel!.officers.lusu.proof);visit(r,'gate');act(r,'inn:quest:escort:transport');assert.equal(q.step,3);visit(r,'inn');act(r,'inn:report:escort');assert.equal(q.status,'completed');assert.ok(innDialogue(r).includes('우회로'),`${q.conclusion} / ${innDialogue(r)}`);
});
function innDialogue(r:RunState){return explorationOf(r)!.inn!.dialogue;}

test('inn scene zones and inn rooms share one state: zone changes move the inn room, locked rooms stay locked, picking a person moves the zone',()=>{
 const r=fresh();act(r,'enter');const x=explorationOf(r)!,key=locationSceneKey('xingyang','inn');
 act(r,'scene:zone:yard');assert.equal(x.inn!.area,'yard');assert.equal(x.locationScenes![key].zoneId,'yard');
 const tick=x.tick,locked=exploreAction(r,'scene:zone:private',x.revision);assert.equal(locked.ok,false);assert.equal(x.inn!.area,'yard');assert.equal(x.tick,tick);
 act(r,'inn:select:innkeeper');assert.equal(x.inn!.area,'counter');assert.equal(x.locationScenes![key].zoneId,'counter');
 act(r,'inn:area:hall');assert.equal(x.locationScenes![key].zoneId,'hall');assert.equal(x.tick,tick);
 const loaded=reload(r),y=explorationOf(loaded)!;assert.equal(y.inn!.area,'hall');assert.equal(y.locationScenes![key].zoneId,'hall');
});

test('inspecting the cart, passage and guards in the warehouse completes the first escort step by itself, and older saves stuck there recover on the next scene action',()=>{
 const r=fresh();act(r,'enter');act(r,'inn:offer:escort');act(r,'inn:accept:escort');visit(r,'store');const x=explorationOf(r)!,q=x.inn!.quests.escort;
 act(r,'scene:inspect:cart');act(r,'scene:inspect:passage');assert.equal(q.step,0);const tick=x.tick;act(r,'scene:inspect:guards');assert.equal(q.step,1);assert.equal(x.tick,tick+1,'only the inspection itself costs time');
 assert.ok(q.approaches.includes('scene-inspection'));assert.equal(exploreAction(r,'inn:quest:escort:investigate',x.revision).ok,false);
 const old=fresh();act(old,'enter');act(old,'inn:offer:escort');act(old,'inn:accept:escort');visit(old,'store');const y=explorationOf(old)!,oq=y.inn!.quests.escort;oq.evidence.push('cart','passage','guards');assert.equal(oq.step,0);
 const t2=y.tick;act(old,'scene:zone:office');assert.equal(oq.step,1);assert.equal(y.tick,t2);
});

import {charactersAt} from '../src/core/city-exploration.ts';
test('Lu Su proposes a joint check of porter testimony and the loading lane; accepting costs one hour, records both clues and his trust, and opens the alternate route without intel',()=>{
 const r=fresh();act(r,'enter');act(r,'inn:offer:escort');act(r,'inn:accept:escort');visit(r,'store');const x=explorationOf(r)!,q=x.inn!.quests.escort,key=locationSceneKey('xingyang','store');
 assert.ok(charactersAt(r).includes('lusu'),'노숙이 창고에 있다');r.campaign!.world!.raising!.intel=0;
 assert.equal(exploreAction(r,'scene:joint:lusu:accept',x.revision).ok,false,'제안을 듣기 전에는 답할 수 없다');
 act(r,'scene:character:lusu');act(r,'scene:talk:lusu:route');assert.ok(x.locationScenes![key].usedInteractions.includes('proposal:lusu:pending'));
 const tick=x.tick,trust=r.campaign!.personnel!.officers.lusu.trust;act(r,'scene:joint:lusu:accept');
 assert.equal(x.tick,tick+1);assert.ok(['workers','passage','lusu-joint'].every(v=>q.evidence.includes(v)));assert.equal(r.campaign!.personnel!.officers.lusu.trust,Math.min(100,trust+3));
 assert.ok(x.locationScenes![key].inspected.includes('workers'));assert.equal(exploreAction(r,'scene:joint:lusu:accept',x.revision).ok,false,'한 번만');
 act(r,'scene:talk:lusu:route');assert.ok(!x.locationScenes![key].usedInteractions.includes('proposal:lusu:pending'),'답한 제안은 다시 나오지 않는다');
 for(const id of ['cart','guards'])act(r,'scene:inspect:'+id);assert.equal(q.step,1);act(r,'inn:quest:escort:alternate');assert.equal(q.step,2);
});
test('declining Lu Su costs nothing and leaves the clues to be inspected directly',()=>{
 const r=fresh();act(r,'enter');act(r,'inn:offer:escort');act(r,'inn:accept:escort');visit(r,'store');const x=explorationOf(r)!,q=x.inn!.quests.escort;
 act(r,'scene:character:lusu');act(r,'scene:talk:lusu:route');const tick=x.tick;act(r,'scene:joint:lusu:decline');assert.equal(x.tick,tick);assert.ok(!q.evidence.includes('lusu-joint'));assert.ok(!q.evidence.includes('workers'));
});
