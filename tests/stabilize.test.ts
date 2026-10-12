import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDuel,resolveDuelAction,canDuelAction} from '../src/core/duel.ts';
import {enableDuelDeck,type DuelDeckSetup} from '../src/core/duel-deck.ts';
import {evaluateDuel,practiceMarks,DUEL_OBJECTIVES} from '../src/data/duel-objectives.ts';
import {OPP_CARDS,DUEL_ARCHETYPES} from '../src/data/duel-cards.ts';
import {freshRun,Player,deckDuelAction,deckDuelValue} from '../src/sim/card-engine-play.ts';
import {gambitGuide,duelDeckView} from '../src/ui/duel-deck-view.ts';
import {engineOf,burdenSettlementStatus,chooseBurdenSettlement,BURDEN_SETTLEMENTS,applyEngineFounding,removeLibraryCard} from '../src/core/card-engine.ts';
import {runChengpu,runDianwei} from '../src/sim/card-engine-builds.ts';
import {saveCampaign,loadCampaign} from '../src/core/campaign-save.ts';
import {memoryKV} from '../src/core/save.ts';
import {ISSUE_DEFS} from '../src/data/cities.ts';
import type {DuelState} from '../src/core/social-types.ts';
import type {OppKind} from '../src/data/duel-cards.ts';
import type {CityState} from '../src/core/city-types.ts';

const duel=(o:Partial<DuelDeckSetup>={},opp='inn_guard'):DuelState=>{const s=createDuel(777,'chengong',opp);return enableDuelDeck(s,{objective:'practice',archetype:'counter',distance:'mid',support:0,profile:'standard',maxRounds:5,...o});};
function hand(s:DuelState,ids:string[]){const d=s.deck!;d.discard.push(...d.hand.splice(0));return ids.map(id=>{let c=d.cards.find(c=>c.id===id&&!d.hand.includes(c.uid)&&!d.exhaust.includes(c.uid)&&!d.tacticHand.includes(c.uid));if(!c){c={uid:d.nextUid++,id};d.cards.push(c);}for(const k of ['draw','discard'] as const)d[k]=d[k].filter(u=>u!==c!.uid);d.hand.push(c.uid);return c.uid;});}
function intent(s:DuelState,card:string){const d=s.deck!;const k=OPP_CARDS[card].kind as OppKind;const amt=k==='attack'?7:k==='rush'?4:k==='jab'?3:k==='finisher'?11:k==='guard'?5:2;d.intent={uid:d.intent?.uid??900,card,kind:k,amount:amt,concealed:false};}
const play=(s:DuelState,a:string)=>{const r=resolveDuelAction(s,a,s.round);assert.ok(r.ok,`${a}: ${r.reason}`);};

test('yard: a blind all-in in the first exchange wins but is "힘은 있으나 거침" (not skill), and below the minimum exchanges → 재대결 필요',()=>{
 const s=duel({tactics:['t_all_in']});intent(s,'o_strike');s.v2!.distance='near';s.momentum=5;s.enemyHp=19;const g=s.deck!.tacticHand[0];play(s,'card:'+g);
 assert.equal(s.result,'win');const ev=evaluateDuel(s);assert.equal(ev.grade,'재대결 필요','one exchange is below the minimum');assert.ok(ev.adjust.some(t=>t.includes('재대결')));
 const t=duel({tactics:['t_all_in']});intent(t,'o_strike');play(t,'end');intent(t,'o_strike');t.v2!.distance='near';t.momentum=5;t.enemyHp=19;play(t,'card:'+t.deck!.tacticHand[0]);
 assert.equal(t.result,'win');const m=practiceMarks(t);assert.ok(m.neg.blind&&m.neg.earlyGambit);assert.equal(evaluateDuel(t).grade,'힘은 있으나 거침');
});

test('yard: parry → counter → opening → finisher earns 기술 인정; the gambit through an opening is not penalised',()=>{
 const s=duel({tactics:['t_all_in']});intent(s,'o_strike');const [p,so,sd,pa]=hand(s,['probe','step_out','stance_def','parry']);play(s,'card:'+p);play(s,'card:'+so);play(s,'card:'+sd);play(s,'card:'+pa);play(s,'end');
 assert.ok(s.v2!.opening&&s.v2!.stats.counters===1);intent(s,'o_guard');s.v2!.distance='near';s.momentum=3;s.enemyHp=Math.min(s.enemyHp,15);play(s,'card:'+s.deck!.tacticHand[0]);
 assert.equal(s.result,'win');const m=practiceMarks(s);assert.ok(m.pos.read&&m.pos.guard&&m.pos.opening);assert.equal(m.negCount,0);assert.equal(evaluateDuel(s).grade,'기술 인정');
});

test('yard: excessive force and ignoring a counter stance are negatives; a long steady bout without technique is 성실; a draw at the limit is judged, not lost on hp',()=>{
 const s=duel();intent(s,'o_counter');const [st]=hand(s,['strike']);s.v2!.distance='near';play(s,'card:'+st);play(s,'end');assert.equal(s.deck!.stats.ignoredIntents,1);
 const t=duel();for(let i=0;i<5&&t.result==='ongoing';i++){intent(t,i%2?'o_strike':'o_guard');const [sd,pa]=hand(t,['stance_def','parry']);play(t,'card:'+sd);play(t,'card:'+pa);play(t,'end');}
 assert.equal(t.result,'draw','practice never ends in an hp-ratio loss');assert.ok(['성실','담력 인정','기술 인정'].includes(evaluateDuel(t).grade));
 const u=duel({tactics:['t_all_in']});intent(u,'o_guard');play(u,'end');intent(u,'o_guard');play(u,'end');intent(u,'o_guard');u.v2!.distance='near';u.momentum=5;u.enemyHp=19;u.enemyShield=0;play(u,'card:'+u.deck!.tacticHand[0]);assert.ok(evaluateDuel(u).excessive);assert.equal(evaluateDuel(u).grade,'힘은 있으나 거침');
});

test('objective-aware policy: the yard value prefers restraint and technique while the deep policy rushes; greedy stays the lower bound',async()=>{
 const es=runDianwei(true).escortState!;const run=(policy:'objective'|'deep'|'greedy')=>{const P=new Player(structuredClone(es));P.x.fatigue=0;P.visit('inn');P.act('inn:area:yard');P.act('inn:courtyard');const s=P.x.duel!;for(let i=0;i<80&&s.result==='ongoing';i++)P.act('social:'+deckDuelAction(s,policy));return evaluateDuel(s);};
 const o=run('objective'),d=run('deep');assert.ok(o.rank>=d.rank,`objective ${o.grade} vs deep ${d.grade}`);assert.equal(o.grade,'기술 인정');assert.equal(d.grade,'힘은 있으나 거침');
 const s=duel({tactics:['t_all_in']});intent(s,'o_strike');s.v2!.distance='near';s.momentum=5;s.enemyHp=19;const win=structuredClone(s);play(win,'card:'+win.deck!.tacticHand[0]);
 assert.ok(deckDuelValue(win,'deep')>deckDuelValue(win,'objective'),'the same reckless win is worth less under the practice objective');
 for(const id of Object.keys(DUEL_OBJECTIVES))assert.ok(DUEL_OBJECTIVES[id].policy.rank>=0,'every objective declares policy weights');
});

test('gambit guide shows opening, damage, over-force, objective impact and grade change without a modal; tactic cards wait in a prepared slot',()=>{
 const s=duel({tactics:['t_all_in','t_counter','t_press']});assert.equal(s.deck!.tacticHand.length,3);assert.ok(!s.deck!.draw.some(u=>s.deck!.tacticHand.includes(u)),'tactics are not shuffled into the draw pile');
 intent(s,'o_strike');s.v2!.distance='near';s.momentum=5;s.enemyHp=19;const g=s.deck!.tacticHand.find(u=>s.deck!.cards.find(c=>c.uid===u)!.id==='t_all_in')!;const guide=gambitGuide(s,g);
 assert.match(guide,/현재 빈틈 없음/);assert.match(guide,/예상 피해 \d+/);assert.match(guide,/과잉 무력|반격/);assert.match(guide,/사건 평가 뒤뜰 연습 시험/);assert.match(guide,/→/);
 const html=duelDeckView(s,(a,l)=>`<button data-x="${a}">${l}</button>`);assert.ok(html.includes('duel-guide'));assert.ok(!html.includes('confirm('));assert.ok(html.includes('준비 전술 ·'));
 s.v2!.opening=true;assert.match(gambitGuide(s,g),/현재 빈틈 있음/);
});

test('burden ledger counts creation, use, conversion and exhaustion; settlement opens only on real use and applies once at founding',()=>{
 const o=runChengpu(true,'fund');assert.equal(o.ledger.created,1,'the shared-liability contract created a burden card');assert.ok(o.ledger.used>=2);assert.ok(o.ledger.converted>=1);assert.ok(o.ledger.exhausted>=1);assert.equal(o.settlement,'공동 기금');
 assert.ok(o.report.policies.includes('merchants'));assert.ok(o.report.gate.some(t=>t.includes('공동 기금')));
 const c=runChengpu(false,'fund');assert.equal(c.ledger.converted+c.ledger.exhausted,0);assert.match(c.settlement,/조건 미충족/);assert.ok(!c.report.policies.includes('merchants'));
 const P=new Player(freshRun());const e=engineOf(P.r)!;assert.equal(burdenSettlementStatus(P.r)!.eligible,false);e.burdenLedger={created:0,used:2,converted:0,exhausted:1};assert.equal(burdenSettlementStatus(P.r)!.eligible,true);
 assert.equal(chooseBurdenSettlement(P.r,'nope').ok,false);assert.ok(chooseBurdenSettlement(P.r,'share').ok);assert.equal(chooseBurdenSettlement(P.r,'fund').ok,false,'only once');
});

test('settlement options differ: fund adds money+policy+merchant duty, share clears a duty for coin, carry creates the ledger issue with reward and risk; never twice',()=>{
 const city=():CityState=>({policies:[],promises:[{id:'shared',due:3,status:'active'}],groups:{locals:0,traders:0,refugees:0},metrics:{order:50,security:50,life:50,economy:50,morale:50},districts:[],issues:[]} as unknown as CityState);
 const run=(id:string)=>{const P=new Player(freshRun());const e=engineOf(P.r)!;e.burdenLedger={created:1,used:2,converted:1,exhausted:0};e.burdenSettlement=id;P.r.campaign!.world!.treasury=10;const c=city();const lines=applyEngineFounding(P.r,c,()=>true);const again=applyEngineFounding(P.r,c,()=>true);return {c,lines,again,treasury:P.r.campaign!.world!.treasury};};
 const f=run('fund');assert.equal(f.treasury,13);assert.ok(f.c.policies.some(p=>p.id==='merchants'));assert.ok(f.c.promises.some(p=>p.id==='escort'),'merchant duty (호송 안전) created');assert.ok(!f.again.some(l=>l.startsWith('부담 결산')),'applied once');assert.equal(f.c.promises.filter(p=>p.id==='escort').length,1);assert.equal(f.c.promises.length,2);
 const s=run('share');assert.equal(s.treasury,8);assert.equal(s.c.promises.find(p=>p.id==='shared')!.status,'fulfilled');assert.ok(s.lines.some(l=>l.includes('사고 책임 분담')),'duty named in Korean, not by id');
 const k=run('carry');assert.ok(k.c.issues.some(i=>i.id==='ledger_carry'));assert.ok(ISSUE_DEFS.ledger_carry.reward.length&&ISSUE_DEFS.ledger_carry.effects.length,'reward and risk');assert.equal(k.treasury,10);
 assert.equal(Object.keys(BURDEN_SETTLEMENTS).length,3);
 const P=new Player(freshRun());const l=P.p.library.find(l=>l.id==='poverty')!;const e=engineOf(P.r)!;const before=e.burdenLedger!.exhausted;if(!P.p.loadouts.raising.includes(l.uid)||P.p.loadouts.raising.length>6){assert.ok(removeLibraryCard(P.r,l.uid).ok);assert.equal(e.burdenLedger!.exhausted,before+1);}
});

test('entry points: barracks trainer duel now runs on the deck engine with the trainer objective; the outside road duel stays legacy and is labelled 간이 겨루기; legacy debates are labelled 간이 교섭',async()=>{
 const o=runDianwei(false);assert.ok(o.P.e.duels!.some(d=>d.context==='barracks'&&d.grade==='지휘 인정'));assert.ok(o.P.e.legacy.some(l=>l.id==='duel:trainer-command'));
 const {raisingOf,selectRaisingPlan}=await import('../src/core/raising.ts');const {personnelOf}=await import('../src/core/personnel-rules.ts');const r=structuredClone(o.gateState!);const q=raisingOf(r)!;assert.ok(selectRaisingPlan(r,'barracks',personnelOf(r)!.representative!,q.revision).ok);assert.ok(q.gate!.duel!.deck!.prepared.some(p=>p.includes('시작 기세')),'trainer recognition raises starting momentum');
 const src=await import('node:fs').then(fs=>fs.readFileSync('src/ui/city-exploration-screen.ts','utf8'));assert.ok(src.includes('간이 겨루기')&&src.includes('간이 교섭'));assert.ok(!src.includes('도시에서 만난 사람과의 설전</span>'));
 assert.equal(DUEL_ARCHETYPES.counter.deck.filter(c=>c==='o_jab'||c==='o_strike'||c==='o_finisher').length,4,'the sparring partner attacks often enough to be read and parried');
});

test('legacy saves: an in-progress legacy duel (no deck) keeps resolving with the old actions, and a deck duel with a prepared tactic slot survives reload',async()=>{
 const legacy=createDuel(9,'chengong','champion');assert.equal(legacy.deck,undefined);assert.ok(canDuelAction(legacy,'strike',legacy.round).ok);assert.ok(resolveDuelAction(legacy,'strike',legacy.round).ok);
 const es=runDianwei(true).escortState!;const P=new Player(structuredClone(es));P.act('engine:resolve:duel');const s=P.x.duel!;assert.ok(s.deck!.tacticHand.length>=1);P.act('social:card:'+s.deck!.tacticHand[0]);
 const kv=memoryKV();assert.ok(saveCampaign(kv,P.r));const l=loadCampaign(kv);assert.ok(l.ok);const d=l.data.activeExpedition!.campaign!.cities.xingyang!.exploration!.duel!.deck!;assert.deepEqual(d.tacticHand,s.deck!.tacticHand);assert.deepEqual(d.stats.readResponses,s.deck!.stats.readResponses);
});
test('saves: a game that resolved the barracks puzzle by 보급 약속 (choice outside the event approach list) still saves and loads, and the settlement panel state loads before founding',()=>{
 const cp=runChengpu(true,null);const r=cp.state!;assert.equal(r.campaign!.cities.xingyang!.exploration!.events.barracks.choice,'supply');
 const kv=memoryKV();assert.ok(saveCampaign(kv,r));const l=loadCampaign(kv);assert.ok(l.ok,'result-phase save after an engine puzzle resolution must load');
 const run=l.data.activeExpedition!;const e=engineOf(run);assert.ok(e&&e.burdenLedger&&e.burdenLedger.used>=2);assert.ok(burdenSettlementStatus(run)!.eligible);
});
