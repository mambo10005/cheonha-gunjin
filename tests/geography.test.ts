import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PLACES,SITES,SCENARIO_YEAR,GEOGRAPHY_VERSION,site} from '../src/data/geography.ts';
import {newRegionalRun,newRun,availableMoves,moveTo} from '../src/core/run.ts';
import {extraTravelFood,routeFacts,validGeography,refreshScout,configureRegionalDemo} from '../src/core/geography.ts';
import {movePreview,nodeInfo,canReach} from '../src/core/map-intel.ts';
import {memoryKV,saveRun,loadRun} from '../src/core/save.ts';
const reset=(r:ReturnType<typeof newRun>)=>{r.screen='map';r.pending={kind:'none'};r.battle=null;};
test('reviewed 190 time slice: unique IDs, parents, coordinates, confidence, provenance and separate game adjustment',()=>{
 assert.equal(new Set(PLACES.map(p=>p.id)).size,PLACES.length);assert.equal(new Set(SITES.map(s=>s.id)).size,22);
 assert.equal(PLACES.filter(p=>p.featureType==='county').length,6);
 for(const p of PLACES){assert.ok(p.validFrom<=SCENARIO_YEAR&&p.validTo>=SCENARIO_YEAR);assert.ok(!p.administrativeParent||PLACES.some(x=>x.id===p.administrativeParent));
  assert.ok(p.coordinate.longitude>=112&&p.coordinate.longitude<=114&&p.coordinate.latitude>=34&&p.coordinate.latitude<=35);
  assert.equal(p.coordinateConfidence,'approximate');assert.equal(p.nameConfidence,'attested');assert.ok(p.source.startsWith('https://')&&p.sourceLicense&&p.sourceCitation&&p.adjustment&&p.notes);}
 for(const s of SITES){assert.ok(PLACES.some(p=>p.id===s.placeId));assert.ok(s.mapX>0&&s.mapX<2000&&s.mapY>0&&s.mapY<1000);}
});
test('100 seeds: fixed terrain/geography, variable encounters, reachable alternatives and boss; no isolated nodes',()=>{
 const first=newRegionalRun(1,'caocao');
 for(let seed=1;seed<=100;seed++){const r=newRegionalRun(seed,'caocao');assert.deepEqual(r,newRegionalRun(seed,'caocao'));
  assert.deepEqual(r.map.flat().map(n=>n.terrain),first.map.flat().map(n=>n.terrain));
  for(const n of r.map.flat()){assert.ok(canReach(r,n,{floor:7,col:0}));assert.equal(n.terrain,site(n.floor,n.col).terrain);if(n.floor>0)assert.ok(r.map[n.floor-1].some(p=>p.next.includes(n.col)));}
  assert.ok(availableMoves(r).length>=2);assert.ok(validGeography(r));}
 assert.notDeepEqual(first.map,newRegionalRun(2,'caocao').map);
});
test('preview uses actual move, fixed terrain in combat, scout increase and route event consumption are atomic',()=>{
 for(let seed=1;seed<=30;seed++)for(const col of [0,1,2]){
  const r=newRegionalRun(seed,'caocao'),before=structuredClone(r),n=r.map[0][col],p=movePreview(r,n);assert.deepEqual(r,before);
  assert.ok(moveTo(r,col).ok);assert.deepEqual(r,p.state);assert.equal(r.geography!.currentSite,site(0,col).id);assert.equal(r.geography!.scout[site(0,col).id],4);
  if(r.battle)assert.equal(r.battle.terrain,n.terrain);assert.ok(validGeography(r));
  const arrival=structuredClone(r);assert.equal(moveTo(r,col).ok,false);assert.deepEqual(r,arrival);
  const kv=memoryKV();saveRun(kv,r);const restored=loadRun(kv);assert.ok(restored.ok);assert.deepEqual(restored.data,r);
 }
});
test('gate verification surcharge and passage exemption come from movement; no fake locked routes',()=>{
 const r=newRegionalRun(11,'caocao');moveTo(r,1);reset(r);const gate=r.map[1][1];
 assert.equal(routeFacts(r,gate).gateSurcharge,1);assert.equal(extraTravelFood(r,gate),1);assert.equal(movePreview(r,gate).food,r.food-2);
 r.social.passage={moves:1,discount:1};const p=movePreview(r,gate);assert.equal(p.food,r.food);assert.equal(p.passage,0);
 const actual=structuredClone(r);moveTo(actual,1);assert.deepEqual(actual,p.state);
});
test('limited march: all route costs exact, no reverse farming; depletion and unknown intel',()=>{
 const r=newRegionalRun(81001,'caocao');r.food=100;
 for(let f=0;f<8;f++){for(const n of availableMoves(r)){const p=movePreview(r,n),clone=structuredClone(r);moveTo(clone,n.col);assert.deepEqual(clone,p.state);}
  moveTo(r,1===f?1:0);if(f<7)reset(r);assert.ok(validGeography(r));}
 assert.equal(r.floor,7);assert.equal(r.geography!.visited.length,8);assert.equal(availableMoves(r).length,0);
 const poor=newRegionalRun(81001,'caocao');poor.food=0;poor.hp=5;moveTo(poor,2);assert.equal(poor.screen,'defeat');assert.equal(poor.hp,0);
 const fresh=newRegionalRun(1,'caocao');assert.equal(nodeInfo(fresh,fresh.map[4][0]).type,'거점 미확인');assert.equal(nodeInfo(fresh,fresh.map[0][2]).encounter,null);
 const before=structuredClone(fresh);refreshScout(fresh);assert.deepEqual(fresh,before);
});
test('save before and after arrival; old maps stay intact; malformed scouts/travel rejected',()=>{
 for(const r of [newRun(31,'caocao'),newRegionalRun(31,'caocao')]){const kv=memoryKV();saveRun(kv,r);const result=loadRun(kv);assert.ok(result.ok);assert.deepEqual(result.data,r);}
 const r=newRegionalRun(31,'caocao');moveTo(r,0);const kv=memoryKV();saveRun(kv,r);assert.ok(loadRun(kv).ok);
 r.geography!.scout[site(0,0).id]=5;saveRun(kv,r);assert.equal(loadRun(kv).ok,false);r.geography!.scout[site(0,0).id]=4;
 r.geography!.travel!.status='midway' as 'arrived';saveRun(kv,r);assert.equal(loadRun(kv).ok,false);
 assert.equal(r.geography!.dataVersion,GEOGRAPHY_VERSION);
});
test('unsupported geographic data falls back to original rule map without altering active content or resources',()=>{
 const r=newRegionalRun(42,'caocao');moveTo(r,1);const originalMap=structuredClone(r.map),kv=memoryKV();r.geography!.dataVersion='older-region-revision';r.geography!.position={mapX:9999,mapY:8888};saveRun(kv,r);
 const result=loadRun(kv);assert.ok(result.ok);assert.equal(result.data.geography,undefined);assert.deepEqual(result.data.map,originalMap);assert.equal(result.data.food,r.food);assert.deepEqual(result.data.pending,r.pending);assert.deepEqual(result.data.battle,r.battle);
});
test('81001 regional demo exposes actual diplomacy, deck debate and duel entrances while keeping terrain and routes',()=>{
 for(const col of [0,1,2]){const r=newRegionalRun(81001,'caocao'),before=r.map.map(row=>row.map(n=>({next:n.next,terrain:n.terrain})));configureRegionalDemo(r);assert.deepEqual(r.map.map(row=>row.map(n=>({next:n.next,terrain:n.terrain}))),before);
  const kv=memoryKV();saveRun(kv,r);assert.ok(loadRun(kv).ok);moveTo(r,col);assert.equal(r.pending.kind,['council','parley','duelOffer'][col]);saveRun(kv,r);assert.ok(loadRun(kv).ok);}
});
