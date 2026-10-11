import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mk,atk,idle} from './helpers.ts';
import {captureCombat} from '../src/core/combat-events.ts';
import {playCard,endTurn,incomingPreview,previewBattleState,moveGeneral} from '../src/core/combat.ts';
import {newRun} from '../src/core/run.ts';
import {configureBattleDemo} from '../src/core/battle-demo.ts';
import {saveRun,loadRun,memoryKV} from '../src/core/save.ts';
import {battleScene} from '../src/ui/battle-scene.ts';
import {battleArt,BATTLE_PRESENTATION} from '../src/data/battle-presentation.ts';
test('event capture is optional and preserves complete rule outcome including RNG',()=>{
 const a=mk({hand:['feint'],generals:[{id:'guojia',row:'rear'}],drawPile:['spear'],intents:[atk('front',6)]}),b=structuredClone(a);
 playCard(a,0,{enemy:1});const {events}=captureCombat(b,()=>playCard(b,0,{enemy:1}));assert.deepEqual(a,b);
 assert.equal(events.filter(e=>e.kind==='cardCommitted').length,1);assert.equal(events.filter(e=>e.kind==='commandSpent').length,1);
 assert.deepEqual(events.map(e=>e.sequence),events.map((_,i)=>i));assert.ok(events.some(e=>e.kind==='intentChanged'&&e.lane==='rear'));
 assert.ok(events.some(e=>e.kind==='commanderAbilityTriggered'));assert.ok(events.some(e=>e.kind==='cardDrawn'));
 assert.equal(JSON.stringify(b).includes('sequence'),false);
});
test('preview card, intent, energy, draw and row guard never mutate original RNG/piles',()=>{
 const b=mk({hand:['formation','feint'],intents:[atk('front',6)],generals:[{id:'guojia',row:'rear'}],drawPile:['spear']}),before=structuredClone(b);
 const guard=previewBattleState(b,0,{row:'front'});assert.equal(guard!.block.front,5);
 const changed=previewBattleState(b,1,{enemy:1});assert.equal(changed!.enemies[0].intent!.kind,'attack');assert.equal(changed!.energy,4);
 assert.deepEqual(b,before);assert.equal(previewBattleState(b,1,{enemy:999}),null);
});
test('incoming uses actual counter kill to cancel remaining hits',()=>{
 const b=mk({enemies:['ytsoldier'],enemyHp:[3],intents:[atk('front',5,3)],generals:[{id:'dianwei',row:'front'}]});
 // Existing rules counter after all hits in a row, not after each individual hit.
 assert.equal(incomingPreview(b).front.net,15);
 const other=mk({enemies:['ytsoldier','ytsoldier'],enemyHp:[3,3],intents:[atk('front',5),atk('front',5)],generals:[{id:'dianwei',row:'front'}]});
 other.block.front=20;const before=structuredClone(other);const predicted=incomingPreview(other);assert.equal(predicted.front.net,0);assert.equal(predicted.front.blocked,10);assert.deepEqual(other,before);
});
test('incoming handles lone turncoat fallback and chained burn deaths',()=>{
 const b=mk({intents:[atk('front',6)]});b.enemies[0].turncoat=true;assert.equal(incomingPreview(b).front.net,6);
 const burn=mk({enemies:['ytsoldier','ytsoldier'],enemyHp:[7,7],intents:[atk('front',6),atk('front',6)],generals:[{id:'pangtong',row:'rear'}]});burn.enemies.forEach(e=>e.burn=4);assert.equal(incomingPreview(burn).front.net,0);
});
test('guard absorption, actual counter and death emit ordered semantic events',()=>{
 const b=mk({hand:['readied'],intents:[atk('front',6)],enemyHp:[3],generals:[{id:'dianwei',row:'front'}]});
 const prepare=captureCombat(b,()=>playCard(b,0)).events;assert.ok(prepare.some(e=>e.kind==='counterPrepared'));assert.ok(!prepare.some(e=>e.kind==='counterTriggered'));
 const {events}=captureCombat(b,()=>endTurn(b));const blocked=events.findIndex(e=>e.kind==='damageBlocked'),counter=events.findIndex(e=>e.kind==='counterTriggered'),dead=events.findIndex(e=>e.kind==='unitDefeated');assert.ok(blocked>=0&&counter>blocked&&dead>counter);assert.equal(events.at(-1)!.kind,'battleResolved');
 assert.equal(b.hp,58);assert.equal(b.result,'win');
});
test('no counter is emitted without an attack, and failed action emits nothing',()=>{
 const b=mk({hand:['feint'],intents:[idle],generals:[{id:'dianwei',row:'front'}]});b.counter.front=4;
 assert.equal(captureCombat(b,()=>playCard(b,0,{enemy:999})).events.length,0);
 assert.ok(!captureCombat(b,()=>endTurn(b)).events.some(e=>e.kind==='counterTriggered'));
});
test('free first swap and paid second swap emit actual row and cost',()=>{
 const b=mk({lordId:'caocao',generals:[{id:'dianwei',row:'front'},{id:'guojia',row:'rear'}]});
 const first=captureCombat(b,()=>moveGeneral(b,0)).events;assert.equal(first.find(e=>e.kind==='formationMoved')!.amount,0);assert.equal(b.generals[0].row,'rear');
 const second=captureCombat(b,()=>moveGeneral(b,0)).events;assert.equal(second.find(e=>e.kind==='formationMoved')!.amount,1);assert.equal(b.generals[0].row,'front');
});
test('demo save restores final transaction and unique hand/pile identities without any animation replay',()=>{
 const r=newRun(91001,'caocao');configureBattleDemo(r);const kv=memoryKV();const b=r.battle!;
 const before=structuredClone(b);saveRun(kv,r);assert.ok(loadRun(kv).ok);
 const {events}=captureCombat(b,()=>playCard(b,3,{enemy:1}));saveRun(kv,r);assert.ok(events.length>0);
 const loaded=loadRun(kv);assert.ok(loaded.ok);assert.deepEqual(loaded.data.battle,JSON.parse(JSON.stringify(b)));assert.notDeepEqual(b,before);
 for(const event of events){battleScene(event.state,{selected:null,target:null,busy:true,event});assert.deepEqual(loadRun(kv),loaded);}
 const ids=[...b.hand,...b.draw,...b.discard,...b.exhausted].map(x=>x.uid);assert.equal(ids.length,new Set(ids).size);
});
test('battle rendering separates actual and projected values, valid targets and controlled missing-art fallback',()=>{
 const b=mk({hand:['formation'],generals:[{id:'caoren',row:'front'}],intents:[atk('front',6)]});const before=structuredClone(b);
 const html=battleScene(b,{selected:0,target:{row:'front'},reduced:true});assert.match(html,/예상 방비 0 → 5/);assert.match(html,/병력 손실 1/);assert.match(html,/data-motion="reduced"/);assert.match(html,/banner-fallback/);assert.ok(!html.includes('data-general="dianwei"><img'));assert.deepEqual(before,b);
 assert.equal(battleArt('unknown').portrait,null);assert.equal(Object.keys(BATTLE_PRESENTATION).length>1,true);
});
