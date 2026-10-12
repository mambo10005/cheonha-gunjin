import {test} from 'node:test';
import assert from 'node:assert/strict';
import {freshRun,Player} from '../src/sim/card-engine-play.ts';
import {CARD_GRAMMAR,AUTHORED_GRAMMAR,MARKS} from '../src/data/card-grammar.ts';
import {RAISING_CARDS} from '../src/data/raising.ts';
import {PERSONAL_CARDS,JOINT_CARDS} from '../src/data/personnel.ts';
import {TALENTS} from '../src/data/talents.ts';
import {STRATAGEMS} from '../src/data/stratagems.ts';
import {PUZZLES} from '../src/data/card-puzzles.ts';
import {engineOf,debateArguments,applyDebateArguments,escortBattleConversions,deckComposition,DECK_LIMIT,applyGateDuelRules,insideSkipsDuel,talentGrowth} from '../src/core/card-engine.ts';
import {previewRaisingCard,playRaisingCard} from '../src/core/raising.ts';
import {personnelAvailability} from '../src/core/personnel-rules.ts';
import {createDebate} from '../src/core/debate.ts';
import {prepareNegotiation} from '../src/core/negotiation.ts';
import {createDuel,resolveDuelAction,canDuelAction} from '../src/core/duel.ts';
import {saveCampaign,loadCampaign} from '../src/core/campaign-save.ts';
import {memoryKV} from '../src/core/save.ts';
import {validEngine} from '../src/core/card-engine-validation.ts';
import type {RunState} from '../src/core/types.ts';

/** 시험용: 지정한 카드를 보관함·활동 덱에 넣고 손패를 그 카드들로 바꾼다(소유자는 카드 정의를 따른다). */
function forceHand(P:Player,ids:string[],power=3){const q=P.q,p=P.p;q.discard.push(...q.hand.splice(0));for(const id of ids){const owners=PERSONAL_CARDS[id]?.owners.length?[...PERSONAL_CARDS[id].owners]:[p.protagonistId];const l={uid:p.nextUid++,id,sourceType:owners[0]===p.protagonistId?'protagonist' as const:'officer' as const,sourceId:owners[0],ownerType:'personal' as const,owners,activities:['raising' as const],expires:null,spent:false};p.library.push(l);const c={uid:q.nextUid++,id,personnelCard:l.uid};q.cards.push(c);q.hand.push(c.uid);}q.power=power;q.revision++;}
function recruit(P:Player,id:string){const o=P.p.officers[id];o.relationship='recruited';o.information=4;o.trust=60;o.loyalty=60;o.task=true;o.proof=true;}
function atStore(){const P=new Player(freshRun());P.act('enter');P.act('inn:area:yard');P.act('inn:select:dianwei');P.act('inn:offer:escort');P.act('inn:accept:escort');P.visit('store');return P;}
const marks=(P:Player)=>P.e.scene!.marks;
const reload=(r:RunState)=>{const kv=memoryKV();assert.ok(saveCampaign(kv,r));const loaded=loadCampaign(kv);assert.ok(loaded.ok,'reload');return loaded.data.activeExpedition!;};

test('every raising card has the common grammar: family, action, marks, followup/consume, variants, owner, upgrades, conversions',()=>{
 for(const id of Object.keys(RAISING_CARDS)){const g=CARD_GRAMMAR[id];assert.ok(g,id);assert.ok(['cause','intel','network','military','supply','scheme'].includes(g.family),id);assert.ok(['investigate','persuade','prepare','mobilize','trade','resolve'].includes(g.action),id);
  for(const m of Object.keys(g.produces))assert.ok(MARKS.includes(m as never),id+m);for(const k of ['explore','debate','duel','battle','admin'] as const)assert.ok(g.activityVariants[k],id+k);assert.ok(g.upgradeBranches.bold&&g.upgradeBranches.quiet,id);assert.ok(g.conversionRules.duel,id);}
 for(const t of Object.values(TALENTS))for(const id of [t.role,...t.unique,t.support,...t.joint,t.growth.replace.to])assert.ok(AUTHORED_GRAMMAR.includes(id),'authored '+id);
 assert.equal(JOINT_CARDS.length,4);assert.equal(Object.keys(STRATAGEMS).length,8);assert.equal(Object.keys(TALENTS).length,4);assert.equal(Object.keys(PUZZLES).length,3);
 for(const t of Object.values(TALENTS))assert.ok(t.joint.length>=1&&t.unique.length===2&&t.principle&&t.alt,t.id);
 // 금지 책략: 단순 자원·피해 +1 없음
 for(const s of Object.values(STRATAGEMS))assert.doesNotMatch(s.text,/^(자금|명분|피해) \+1/);
});

test('marks are produced and consumed: a later card spends what an earlier card made',()=>{
 const P=atStore();forceHand(P,['clues','split']);P.play('clues');assert.equal(marks(P).clue,2);P.play('split');assert.equal(marks(P).clue??0,0);assert.equal(marks(P).inside,2);
 assert.ok(P.e.stats.consumed.clue>=2);
});

test('card order matters: followup bonus only when the previous card fits',()=>{
 const A=atStore();forceHand(A,['manifesto','recommend']);A.play('manifesto');A.play('recommend');
 const B=atStore();forceHand(B,['recommend','manifesto']);B.play('recommend');B.play('manifesto');
 // 인망의 추천은 직전 명분 카드 뒤에 지지 +1. 반대 순서에서는 없다.
 assert.ok((marks(A).support??0)>(marks(B).support??0),JSON.stringify([marks(A),marks(B)]));
});

test('obstacle key marks: holding the key mark lets a matching action clear more; wrong actions only leave marks',()=>{
 const P=atStore();P.act('engine:focus:blocked');forceHand(P,['help','clues','clues']);P.play('help');const pz=P.puzzle()!;assert.equal(pz.state.obstacles.find(o=>o.id==='blocked')!.hp,2,'persuade cannot clear a blocked lane');
 P.play('clues');assert.equal(P.puzzle()!.state.obstacles.find(o=>o.id==='blocked')!.hp,1);P.play('clues');assert.equal(P.puzzle()!.state.obstacles.find(o=>o.id==='blocked')!.hp,0,'second investigate spends the clue key for +1');
});

test('talent principles only work for recruited companions, and change how the deck chains',()=>{
 const off=atStore();forceHand(off,['manifesto','support_xunyu','manifesto']);recruit(off,'xunyu');off.play('manifesto');
 const on=atStore();recruit(on,'xunyu');on.x.companions=['xunyu'];on.p.party=['xunyu'];forceHand(on,['manifesto','support_xunyu','manifesto']);on.play('manifesto');on.play('support_xunyu');on.play('manifesto');
 assert.ok(on.e.log.some(t=>t.includes('순욱 · 공론의 인선')),'xunyu principle fires on owner change');
 const dw=atStore();recruit(dw,'dianwei');dw.x.companions=['dianwei'];dw.p.party=['dianwei'];forceHand(dw,['train']);dw.play('train');assert.equal(marks(dw).momentum,2,'선봉 호위: military momentum +1');
 const lu=atStore();recruit(lu,'lusu');lu.x.companions=['lusu'];lu.p.party=['lusu'];forceHand(lu,['clues','contact','food']);lu.play('clues');lu.play('contact');assert.ok(lu.e.log.some(t=>t.includes('노숙 · 양측의 계산')));const before=marks(lu).alert??0;lu.play('food');assert.equal(marks(lu).alert??0,before,'trade makes no alert with lusu');
 const cp=atStore();recruit(cp,'chengpu');cp.x.companions=['chengpu'];cp.p.party=['chengpu'];forceHand(cp,['poverty','clues']);const pw=cp.q.power;cp.play('poverty');assert.equal(cp.q.power,pw-1+1,'burden card refunds power with chengpu');assert.ok((marks(cp).supply??0)>=1);
});

test('joint cards need both owners present and turn marks into strong effects',()=>{
 const P=atStore();for(const id of ['lusu','dianwei'])recruit(P,id);P.x.companions=['lusu','dianwei'];P.p.party=['lusu','dianwei'];P.act('engine:focus:blocked');forceHand(P,['clues','joint_feint']);P.play('clues');P.play('joint_feint');assert.equal(P.puzzle()!.state.obstacles.find(o=>o.id==='blocked')!.hp,0);assert.ok((marks(P).momentum??0)>=2);
 const solo=atStore();recruit(solo,'lusu');solo.x.companions=['lusu'];solo.p.party=['lusu'];forceHand(solo,['joint_feint']);const l=solo.p.library.find(l=>l.id==='joint_feint')!;assert.ok(personnelAvailability(solo.r,l,'raising'),'dianwei absent → disabled');
});

test('growth chooses one of add/upgrade/replace/principle; replacement swaps a card instead of only adding',()=>{
 const P=atStore();recruit(P,'xunyu');P.p.officers.xunyu.xp=2;const role={uid:P.p.nextUid++,id:'role_network_a',sourceType:'officer' as const,sourceId:'xunyu',ownerType:'personal' as const,owners:['xunyu'],activities:['raising' as const],expires:null,spent:false};P.p.library.push(role);
 const n=P.p.library.length;assert.ok(talentGrowth(P.r,'xunyu','replace').ok);assert.equal(P.p.library.length,n,'no extra card');assert.equal(role.id,'role_network_b');assert.equal(P.p.officers.xunyu.growth,'authority');
 const Q=atStore();recruit(Q,'lusu');Q.p.officers.lusu.xp=2;assert.ok(talentGrowth(Q.r,'lusu','principle').ok);assert.equal(Q.e.principles.lusu,'alt');
 const R=atStore();recruit(R,'dianwei');R.p.officers.dianwei.xp=2;const before=R.p.library.length;assert.ok(talentGrowth(R.r,'dianwei','add').ok);assert.equal(R.p.library.length,before+1);assert.ok(!R.p.loadouts.raising.includes(R.p.library.at(-1)!.uid),'added to storage, not auto-equipped');
});

test('active deck is 12 cards with category caps; recruited cards stay in storage and absent talents are disabled',()=>{
 const P=new Player(freshRun());P.act('enter');assert.equal(P.p.loadouts.raising.length,7);const comp=deckComposition(P.r);assert.deepEqual(comp,{protagonist:4,origin:2,talent:0,region:0,burden:1});
 // 출신·도시 칸이 차 있으면 다른 출신 카드를 추가할 수 없다
 P.act('leave');const extra={uid:P.p.nextUid++,id:'pledge',sourceType:'protagonist' as const,sourceId:'chengong',ownerType:'personal' as const,owners:['chengong'],activities:['raising' as const],expires:null,spent:false};P.p.library.push(extra);assert.equal(P.try(`officer:equip:${extra.uid}:raising`).ok,false,'burden/promise slot full');
 const t={uid:P.p.nextUid++,id:'role_network_a',sourceType:'officer' as const,sourceId:'xunyu',ownerType:'personal' as const,owners:['xunyu'],activities:['raising' as const],expires:null,spent:false};P.p.library.push(t);recruit(P,'xunyu');
 assert.match(String(P.try(`officer:equip:${t.uid}:raising`).reason),/동행/,'not a companion → cannot equip');P.act('companion:xunyu');assert.ok(P.try(`officer:equip:${t.uid}:raising`).ok);
 for(let i=0;i<10;i++){const l={uid:P.p.nextUid++,id:'help',sourceType:'event' as const,sourceId:'test',ownerType:'faction' as const,owners:[],activities:['raising' as const],expires:null,spent:false};P.p.library.push(l);P.try(`officer:equip:${l.uid}:raising`);}
 assert.ok(P.p.loadouts.raising.length<=DECK_LIMIT);assert.equal(deckComposition(P.r).region,1,'region slot holds one');
});

test('puzzle clues, managers, items and talents become persistent debate arguments shown before the debate',()=>{
 const P=new Player(freshRun());P.act('enter');P.act('inn:offer:recommendation');P.act('inn:accept:recommendation');P.act('inn:quest:recommendation:public-records');P.visit('archive');
 forceHand(P,['clues','manifesto','recommend']);P.act('scene:inspect:ledger');P.act('engine:focus:record_gap');P.play('clues');P.act('engine:focus:clerk_guard');P.play('manifesto');P.play('recommend');
 P.act('engine:resolve:debate');const args=debateArguments(P.r);assert.ok(args.some(a=>a.source==='책임자 관계'));assert.ok(args.some(a=>a.source==='조사 단서'));
 const s=P.x.debate!;assert.ok(s.log.some(t=>t.startsWith('지속 논거')),'applied at debate start');
 const d=createDebate(5,'chengong','elder',{kind:'supply'});prepareNegotiation(d,5,0,0);const trust=d.trust;applyDebateArguments(P.r,d);assert.ok(d.trust>trust);
});

test('duel tactic loadout comes from deck families and talents; gambit is usable once',()=>{
 const P=atStore();assert.equal(P.try('engine:tactic:opening:press').ok,false,'no military card or dianwei → no 선제 돌격');assert.ok(P.try('engine:tactic:opening:read').ok);P.act('engine:tactic:response:second');P.act('engine:tactic:gambit:oath');
 const s=createDuel(9,'chengong','champion');const hp=s.enemyHp;applyGateDuelRules(P.r,s,'assembly',null);assert.ok(s.loadout?.revealed);assert.equal(s.enemyHp,hp);
 assert.ok(canDuelAction(s,'gambit',s.round).ok);assert.ok(resolveDuelAction(s,'gambit',s.round).ok);if(s.result==='ongoing')assert.equal(canDuelAction(s,'gambit',s.round).ok,false);
});

test('quest preparation converts into temporary battle cards and burdens shown before the battle',()=>{
 const P=atStore();forceHand(P,['help','fund']);P.act('engine:focus:keeper_alert');P.play('help');P.play('fund');assert.equal(P.puzzle()!.state.obstacles.find(o=>o.id==='keeper_alert')!.hp,0);
 P.act('engine:resolve:contract-shared');const conv=escortBattleConversions(P.r).map(c=>c.card);assert.ok(conv.includes('formation'));assert.ok(conv.includes('rabble'),'shared liability → burden card');assert.ok(conv.filter(c=>c==='unrest').length>=1,'unsolved obstacles → unrest');
 P.act('engine:reward:skip');P.visit('gate');const deck=P.r.deck.length;P.act('inn:quest:escort:joint-escort');const b=P.r.battle!;const all=[...b.draw,...b.hand,...b.discard].map(c=>c.id);assert.ok(all.includes('rabble')&&all.includes('formation'));assert.equal(P.r.deck.length,deck,'temporary cards are not added to the campaign deck');
});

test('burden cards are usable but weak alone: they never reduce obstacles, yet feed burden builds',()=>{
 const P=atStore();P.act('engine:focus:ledger_gap');forceHand(P,['poverty','rumor']);P.play('poverty');P.play('rumor');assert.equal(P.puzzle()!.state.obstacles.find(o=>o.id==='ledger_gap')!.hp,2,'burden force 0');assert.equal(marks(P).burden,2);
 const Q=atStore();Q.e.stratagems=['heavy_burden'];forceHand(Q,['poverty','c_turn','poverty']);Q.play('poverty');Q.play('poverty');assert.ok((marks(Q).supply??0)>=1&&(marks(Q).promise??0)>=1,'짐을 진 맹세 converts burden');
});

test('gate rules test the build: barracks support tracks the barracks puzzle (not enemy hp); inside skips only when all three obstacles are resolved',()=>{
 const P=atStore();const e=P.e;const s=createDuel(3,'chengong','champion');const base=s.enemyHp;applyGateDuelRules(P.r,s,'barracks',null);assert.equal(s.enemyHp,base,'difficulty is not raised through hp');assert.equal(s.v2!.support,3,'standard 1 + garrison alert + discipline left');assert.equal(s.enemyShield,9);
 e.puzzles.barracks={id:'barracks',status:'resolved',focus:null,obstacles:PUZZLES.barracks.obstacles.map(o=>({id:o.id,hp:0,max:o.hp})),marks:{},alert:0,resolution:'drill',plays:3,inspected:[],items:[],log:[]};const s2=createDuel(3,'chengong','champion');applyGateDuelRules(P.r,s2,'barracks',null);assert.equal(s2.v2!.support,1);assert.equal(s2.enemyHp,base);
 assert.equal(insideSkipsDuel(P.r,'success'),false);e.legacy.push({id:'escort:alternate',kind:'gate',text:''});assert.equal(insideSkipsDuel(P.r,'success'),false,'alternate alone is not enough');e.stats.produced.inside=4;e.stats.produced.ledger=3;assert.equal(insideSkipsDuel(P.r,'success'),true);assert.equal(insideSkipsDuel(P.r,'partial'),false,'a partial debate leaves the commander');
});

test('preview equals the actual play (marks, obstacles, stats), and draw/power gains are capped per visit',()=>{
 const P=atStore();forceHand(P,['clues','split','food']);const pv=previewRaisingCard(P.r,P.q.hand[0]);P.play('clues');assert.deepEqual(engineOf(pv.state),engineOf(P.r));
 const Q=atStore();Q.e.stratagems=['burn_bridge'];forceHand(Q,['food','food','food','food','loot','loan','hide','medicine'],5);for(let i=0;i<8;i++){const uid=Q.q.hand[0];if(uid===undefined)break;const res=playRaisingCard(Q.r,uid,Q.q.revision);if(!res.ok)break;}
 assert.ok(Q.e.scene!.draws<=3);assert.ok(Q.e.scene!.powerGain<=2);assert.ok(Q.q.power<=5);for(const m of MARKS)assert.ok((Q.e.scene!.marks[m]??0)<=8);
});

test('save and restore mid-scene keeps marks and chain without duplicating bonuses',()=>{
 const A=atStore();forceHand(A,['manifesto','recommend']);A.play('manifesto');const B=new Player(reload(A.r));assert.ok(validEngine(B.e));A.play('recommend');B.play('recommend');assert.deepEqual(B.e.scene,A.e.scene);assert.deepEqual(B.e.stats,A.e.stats);
 const C=new Player(reload(B.r));assert.deepEqual(C.e,B.e);
});

test('alert limit fails the event: the yard closes, the request is marked and only follow-ups remain',()=>{
 const P=atStore();forceHand(P,['redress','redress','loot'],5);for(const id of ['redress','redress','loot'])P.play(id);const e=P.e.puzzles.escort;assert.equal(e.status,'failed');assert.ok(P.x.locations.store.closedUntil>P.x.tick);assert.ok(P.x.inn!.quests.escort.evidence.includes('blocked'));
});

test('event reward: card goes to storage, or skip, upgrade, remove, relation, stratagem; stratagem swap costs time and funds',()=>{
 const P=atStore();forceHand(P,['help','fund','coin']);P.act('engine:focus:keeper_alert');P.play('help');P.play('fund');P.act('engine:resolve:contract-shared');const rw=P.e.reward!;assert.equal(rw.cards.length,3);
 const n=P.p.library.length,deck=P.p.loadouts.raising.length;P.act('engine:reward:card:'+rw.cards[0]);assert.equal(P.p.library.length,n+1);assert.equal(P.p.loadouts.raising.length,deck,'not auto-added to the active deck');assert.equal(P.e.reward,null);
 P.e.stratagems=['relay_trust','many_hands'];const funds=P.r.campaign!.world!.preparation.funds,tick=P.x.tick;assert.equal(P.try('engine:stratagem:open_flag').ok,false);assert.ok(P.try('engine:stratagem:open_flag:many_hands').ok);assert.equal(P.r.campaign!.world!.preparation.funds,funds-1);assert.equal(P.x.tick,tick+1);
});
