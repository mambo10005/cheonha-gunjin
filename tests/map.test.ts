import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newRun,availableMoves,moveTo} from '../src/core/run.ts';
import {chooseDoctrine} from '../src/core/build.ts';
import {movePreview,nodeInfo,nodeKey,canReach,obligationLabels} from '../src/core/map-intel.ts';
import {mapLayout,curve} from '../src/ui/map-presentation.ts';
import {configureDeckDemo} from '../src/core/debate-deck-demo.ts';
import {saveRun,loadRun,memoryKV} from '../src/core/save.ts';
test('100 seeds: all 22 nodes reach boss, no isolated nodes; layout never worsens combinatorial crossings',()=>{
 for(let seed=1;seed<=100;seed++){
  const r=newRun(seed,'caocao'),copy=structuredClone(r),layout=mapLayout(r);
  assert.equal(r.map.flat().length,22);assert.ok(layout.crossings<=layout.baseline);
  for(const n of r.map.flat()){
   assert.ok(canReach(r,n,{floor:7,col:0}));if(n.floor>0)assert.ok(r.map[n.floor-1].some(p=>p.next.includes(n.col)));
   for(const m of r.map[n.floor].filter(m=>m!==n))assert.ok(Math.abs(layout.points.get(nodeKey(n))!.x-layout.points.get(nodeKey(m))!.x)>=300);
  }
  assert.deepEqual(r,copy);assert.deepEqual(mapLayout(r),layout);assert.deepEqual(newRun(seed,'caocao'),r);
 }
});
test('move preview clones real movement: passage consumption, food shortage, support and seeded RNG unchanged',()=>{
 const r=newRun(61001,'caocao');r.map[0][0].terrain='mountain';r.social.passage={moves:1,discount:1};r.social.support={block:4,damage:2,rewardPenalty:1};r.food=0;
 const before=structuredClone(r),p=movePreview(r,r.map[0][0]);assert.deepEqual(r,before);assert.equal(p.hp,55);assert.equal(p.passage,0);
 const actual=structuredClone(r);moveTo(actual,0);assert.deepEqual(actual,p.state);assert.equal(p.state.social.support,null);
 assert.equal(moveTo(actual,0).ok,false);assert.equal(actual.mapTrail!.length,1);
});
test('growth interception is previewed as growth, no cost, position or trail change',()=>{
 const r=newRun(61001,'caocao');configureDeckDemo(r);chooseDoctrine(r,'scheme');moveTo(r,0);r.screen='map';r.pending={kind:'none'};
 const p=movePreview(r,r.map[1][0]);assert.equal(p.growth,true);assert.equal(p.moved,false);assert.equal(p.food,r.food);assert.deepEqual(p.state.mapTrail,r.mapTrail);
});
test('future intel does not expose enemy IDs, event outcome or generated reward candidates',()=>{
 const r=newRun(32,'caocao'),late=r.map[5].find(n=>n.type==='elite')!;const i=nodeInfo(r,late);assert.equal(i.encounter,null);assert.equal(i.known,false);assert.match(i.risk,/미확인/);
 const boss=nodeInfo(r,r.map[7][0]);assert.ok(boss.encounter);assert.match(bossNotesText(boss),/동탁/);
 function bossNotesText(i:ReturnType<typeof nodeInfo>){return i.encounter!.name;}
});
test('obligation badges attach to exact coordinates and route choices retain actual connections',()=>{
 const r=newRun(61001,'caocao');configureDeckDemo(r);
 r.social.accords.agreements.push({uid:1,clause:'escort',faction:'villages',target:{floor:5,col:0},supply:{floor:4,col:0},beneficiary:null,stage:'waiting',status:'active',deposit:0,boosted:true,createdFloor:2});r.social.accords.nextUid=2;
 assert.equal(obligationLabels(r,r.map[4][0]).length,1);assert.equal(obligationLabels(r,r.map[4][1]).length,0);assert.equal(obligationLabels(r,r.map[5][0]).length,1);
 r.map[3][1].next=[1];r.map[4][1].next=[1];assert.equal(canReach(r,r.map[3][1],{floor:4,col:0}),false);
});
test('new trail saves and restores; older saves without trail remain valid and do not invent history',()=>{
 const r=newRun(61001,'caocao');configureDeckDemo(r);moveTo(r,0);const kv=memoryKV();saveRun(kv,r);const a=loadRun(kv);assert.ok(a.ok);assert.deepEqual(a.data.mapTrail,[{floor:0,col:0}]);
 delete r.mapTrail;saveRun(kv,r);const b=loadRun(kv);assert.ok(b.ok);assert.equal(b.data.mapTrail,undefined);
 r.mapTrail=[{floor:1,col:0}];saveRun(kv,r);assert.equal(loadRun(kv).ok,false);
});
test('every available route preview matches exact commit and all SVG paths correspond to real edges',()=>{
 for(const seed of [31001,41001,51001,61001]){
  const r=newRun(seed,'caocao'),l=mapLayout(r);for(const n of availableMoves(r)){const p=movePreview(r,n),a=structuredClone(r);moveTo(a,n.col);assert.deepEqual(a,p.state);}
  for(const n of r.map.flat())for(const c of n.next){const next=r.map[n.floor+1][c];assert.match(curve(l.points.get(nodeKey(n))!,l.points.get(nodeKey(next))!),/^M/);}
 }
});
