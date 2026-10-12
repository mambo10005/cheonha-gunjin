import {test} from 'node:test';
import assert from 'node:assert/strict';
import {freshRun,Player} from '../src/sim/card-engine-play.ts';
import {buildXunyu,buildDianwei,buildLusu,runChengpu} from '../src/sim/card-engine-builds.ts';
import {engineOf,insideConversions,applyGateDuelRules,buildDebugReport,COMMON_CARDS,PACT_CARDS} from '../src/core/card-engine.ts';
import {createDuel,resolveDuelAction} from '../src/core/duel.ts';
import {saveCampaign,loadCampaign} from '../src/core/campaign-save.ts';
import {memoryKV} from '../src/core/save.ts';
import {RAISING_CARDS} from '../src/data/raising.ts';
import {PERSONAL_CARDS} from '../src/data/personnel.ts';
import {startCityExploration} from '../src/core/city-exploration-start.ts';
import {newWorldCampaign} from '../src/core/world.ts';

const lib=(P:Player,id:string)=>P.p.library.find(l=>l.id===id&&P.p.loadouts.raising.includes(l.uid))!.uid;
function forceHand(P:Player,ids:string[],power=3){const q=P.q,p=P.p;q.discard.push(...q.hand.splice(0));for(const id of ids){const owners=PERSONAL_CARDS[id]?.owners.length?[...PERSONAL_CARDS[id].owners]:[p.protagonistId];const l={uid:p.nextUid++,id,sourceType:owners[0]===p.protagonistId?'protagonist' as const:'officer' as const,sourceId:owners[0],ownerType:'personal' as const,owners,activities:['raising' as const],expires:null,spent:false};p.library.push(l);p.loadouts.raising.push(l.uid);const c={uid:q.nextUid++,id,personnelCard:l.uid};q.cards.push(c);q.hand.push(c.uid);}q.power=power;q.revision++;}

test('start deck: 3 common verbs + protagonist + origin + city + burden, differing by protagonist and origin',()=>{
 for(const [hero,origin] of [['chengong','notable'],['zhangliao','militia'],['guojia','official']] as const){const r=newWorldCampaign(141001).activeExpedition!;assert.ok(startCityExploration(r,'xingyang',hero,origin).ok);const p=r.campaign!.personnel!,ids=p.loadouts.raising.map(uid=>p.library.find(l=>l.uid===uid)!.id);
  assert.equal(ids.length,7);assert.equal(ids.filter(id=>COMMON_CARDS.includes(id)).length,3,hero);assert.ok(!ids.includes('food'));assert.ok(ids.some(id=>RAISING_CARDS[id].owner===hero),hero+' card');}
});

test('first major talent pact replaces up to two common cards (deck size unchanged), may be deferred, and the new cards open the next visit',()=>{
 const P=new Player(freshRun());P.act('enter');P.act('inn:area:yard');P.act('inn:select:dianwei');P.act('inn:offer:escort');P.act('inn:accept:escort');assert.equal(P.e.pact?.talent,'dianwei');assert.deepEqual(P.e.pact!.cards,PACT_CARDS.dianwei);
 P.act('engine:pact-close');const pactOf=()=>engineOf(P.r)!.pact;assert.equal(pactOf(),null,'closing with no choice defers the pact');
 P.act('leave');P.act('enter');P.act('inn:select:lusu');P.act('inn:offer:accounts');P.act('inn:accept:accounts');assert.equal(pactOf()?.talent,'lusu');
 const size=P.p.loadouts.raising.length,coin=lib(P,'coin');assert.equal(P.try(`engine:pact-swap:l_ledger:${lib(P,'poverty')}`).ok,false,'only common cards');
 P.act(`engine:pact-swap:l_ledger:${coin}`);P.act(`engine:pact-swap:l_trade:${lib(P,'manifesto')}`);assert.equal(P.try(`engine:pact-swap:l_convert:${lib(P,'clues')}`).ok,false,'max two');
 assert.equal(P.p.loadouts.raising.length,size);assert.ok(P.p.library.some(l=>l.uid===coin),'old card kept in storage');assert.ok(!P.p.loadouts.raising.includes(coin));
 assert.equal(pactOf()!.stratagems.length,3);P.act('engine:pact-stratagem:ledger_net');assert.deepEqual(P.e.stratagems,['ledger_net']);P.act('engine:pact-close');
 P.visit('market');const hand=P.hand();assert.ok(hand.includes('l_ledger')&&hand.includes('l_trade'),'pact cards in the first hand');
});

test('three builds: first five plays differ, and each core stratagem fires at least twice before the first quest is reported',{timeout:120000},()=>{
 const builds=[buildXunyu(),buildDianwei(),buildLusu()];
 const firsts=builds.map(b=>b.firstPlays.join('>'));assert.equal(new Set(firsts).size,3,firsts.join(' | '));
 for(const [b,id] of [[builds[0],'many_hands'],[builds[1],'open_flag'],[builds[2],'ledger_net']] as const)assert.ok((b.firstQuestStratagems[id]??0)>=2,b.name+JSON.stringify(b.firstQuestStratagems));
 for(const b of builds)assert.ok(['great','success','conditional'].includes(b.grade??''),b.name+' '+b.grade+' '+b.notes.at(-1));
});

test('inside gate: three obstacles (watch/commander/soldiers) convert step by step into the follow-up duel',()=>{
 const P=new Player(freshRun());const e=P.e;const ids=(g:string)=>insideConversions(P.r,g).map(c=>c.id);
 assert.deepEqual(ids('success'),['watch-open','commander','support-open','loyalty']);
 e.stats.produced={inside:2};assert.deepEqual(ids('partial'),['watch-open','commander-open','no-support','loyalty-open']);
 e.stats.produced={inside:4,clue:5,support:3,momentum:6,ledger:3};e.legacy.push({id:'escort:alternate',kind:'gate',text:''});assert.deepEqual(ids('failure'),['initiative','commander','no-support','loyalty','momentum','distance']);
 e.insideDistance='far';const s=createDuel(3,'chengong','sentinel');applyGateDuelRules(P.r,s,'inside','failure');assert.ok(s.v2&&s.deck);assert.equal(s.v2!.objective,'inside_gate');assert.equal(s.v2!.support,0);assert.equal(s.v2!.distance,'far');assert.equal(s.deck!.archetype,'endure','watch resolved → enduring gate guard');assert.ok(!s.deck!.intent!.concealed,'clue reveals the first intent');assert.ok(!s.deck!.oppCards.some(c=>c.id==='o_support'));
 assert.ok(resolveDuelAction(s,'card:'+s.deck!.hand[0],s.round).ok||resolveDuelAction(s,'end',s.round).ok);
});

test('barracks gate reads guard/counter chains: start protection and counter bonus come from the build',()=>{
 const P=new Player(freshRun());const s0=createDuel(3,'chengong','champion');applyGateDuelRules(P.r,s0,'barracks',null);const s1=createDuel(3,'chengong','champion');P.e.stats.produced={guard:5,momentum:6};P.e.stats.consumed={guard:4};applyGateDuelRules(P.r,s1,'barracks',null);
 assert.equal((s1.protection??0)-(s0.protection??0),5);assert.equal(s1.counterBonus,6);assert.equal(s1.momentum-s0.momentum,2);
});

test('burden: heavy_burden converts a burden card into supply/promise and burns it; shared liability creates a burden card; favor reward needs two burden uses',()=>{
 const P=new Player(freshRun());P.act('enter');P.act('inn:area:yard');P.act('inn:select:dianwei');P.act('inn:offer:escort');P.act('inn:accept:escort');P.act('engine:pact-stratagem:heavy_burden');P.act('engine:pact-close');P.visit('store');
 forceHand(P,['poverty','help','fund']);const c=P.q.cards.find(c=>c.id==='poverty'&&P.q.hand.includes(c.uid))!;P.play('poverty');assert.equal(P.e.scene!.marks.burden??0,0);assert.ok((P.e.scene!.marks.supply??0)>=1&&(P.e.scene!.marks.promise??0)>=1);assert.ok(P.q.exhaust.includes(c.uid),'burned');
 P.act('engine:focus:keeper_alert');P.play('help');P.play('fund');const n=P.p.library.filter(l=>l.id==='debt_note').length;P.act('engine:resolve:contract-shared');assert.equal(P.p.library.filter(l=>l.id==='debt_note').length,n+1,'debt note generated');
 const burden=P.p.library.find(l=>l.id==='debt_note')!;assert.equal(P.try(`engine:reward:burden-favor:${burden.uid}`).ok,false,'needs two burden uses');P.e.stats.burdenUses=2;assert.ok(P.try(`engine:reward:burden-favor:${burden.uid}`).ok);assert.equal(burden.id,'fund');
});

test('burden build runs from start to uprising; it is neither strictly stronger nor simply weaker than the plain supply variant',{timeout:120000},()=>{
 const A=runChengpu(true),B=runChengpu(false);
 assert.ok(A.report.grade&&B.report.grade,'both reach the uprising');assert.ok(A.burdenUses>=2);assert.ok((A.report.stratagemTriggers.heavy_burden??0)>=2);assert.ok(A.exhausted.includes('debt_note')||A.exhausted.includes('fund'),'a burden card was burned');
 assert.ok(B.burdenMarks.produced>A.burdenMarks.produced,'plain deck keeps burden marks');
});

test('local debug report: card use/unused, marks, stratagems, rewards, swaps, per-event plays, sequences, withdrawals; saved in the campaign only',()=>{
 const P=new Player(freshRun());P.act('enter');P.act('inn:offer:recommendation');P.act('inn:accept:recommendation');P.act(`engine:pact-swap:x_document:${lib(P,'coin')}`);P.act('engine:pact-stratagem:many_hands');P.act('engine:pact-close');P.act('inn:quest:recommendation:public-records');P.visit('archive');P.act('scene:inspect:ledger');P.play('x_document');P.act('leave');P.act('enter');
 const rep=buildDebugReport(P.r)!;for(const k of ['cardPlays','unusedInDeck','marksProduced','marksConsumed','stratagemTriggers','rewards','deckSwaps','cardsPerEvent','sequences','withdrawals','cancels','afterFailure','results'])assert.ok(k in rep,k);
 assert.equal(rep.cardPlays.x_document,1);assert.ok(rep.unusedInDeck.length>0);assert.ok(rep.deckSwaps.some(s=>s.includes('x_document')));assert.ok(rep.withdrawals>=0);assert.ok(!JSON.stringify(rep).includes('@'),'no personal data');
 const kv=memoryKV();assert.ok(saveCampaign(kv,P.r));const loaded=loadCampaign(kv);assert.ok(loaded.ok);assert.deepEqual(engineOf(loaded.data.activeExpedition!)!.telemetry,P.e.telemetry);
});
