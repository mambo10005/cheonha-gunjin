import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDuel,resolveDuelAction,canDuelAction,previewDuelAction} from '../src/core/duel.ts';
import {enableDuelDeck,type DuelDeckSetup} from '../src/core/duel-deck.ts';
import {evaluateDuel} from '../src/data/duel-objectives.ts';
import {DUEL_CARDS,OPP_CARDS} from '../src/data/duel-cards.ts';
import {validDuelDeck} from '../src/core/duel-deck-validation.ts';
import type {DuelState} from '../src/core/social-types.ts';
import type {OppKind} from '../src/data/duel-cards.ts';

const duel=(o:Partial<DuelDeckSetup>={},opp='inn_guard',general='chengong'):DuelState=>{const s=createDuel(777,general,opp);return enableDuelDeck(s,{objective:'escort_captain',archetype:'assault',distance:'mid',support:0,profile:'standard',maxRounds:5,...o});};
/** 손패를 원하는 카드로 바꾼다(덱에 없으면 만든다). */
function hand(s:DuelState,ids:string[]){const d=s.deck!;d.discard.push(...d.hand.splice(0));return ids.map(id=>{let c=d.cards.find(c=>c.id===id&&!d.hand.includes(c.uid)&&!d.exhaust.includes(c.uid));if(!c){c={uid:d.nextUid++,id};d.cards.push(c);}for(const k of ['draw','discard'] as const)d[k]=d[k].filter(u=>u!==c!.uid);d.hand.push(c.uid);return c.uid;});}
/** 다음 상대 의도를 고정한다. */
function intent(s:DuelState,card:string){const d=s.deck!;const k=OPP_CARDS[card].kind as OppKind;const amt=k==='attack'?7:k==='rush'?4:k==='jab'?3:k==='finisher'?11:k==='guard'?5:2;d.intent={uid:d.intent?.uid??900,card,kind:k,amount:amt,concealed:false};}
const play=(s:DuelState,a:string)=>{const r=resolveDuelAction(s,a,s.round);assert.ok(r.ok,`${a}: ${r.reason}`);};

test('duel deck: 9–12 cards (base 8 + tactics + talent support), hand 4, 3 tactic points; opponent archetype deck; draw/discard/exhaust cycle',()=>{
 const s=duel({tactics:['t_press','t_counter','t_all_in'],officers:['dianwei'],familyCard:'break'});const d=s.deck!;
 assert.ok(d.cards.length>=9&&d.cards.length<=12,String(d.cards.length));assert.equal(d.hand.length,4);assert.equal(d.points,3);assert.ok(d.cards.some(c=>c.id==='s_dianwei'));assert.ok(d.cards.some(c=>c.id==='t_all_in'));
 assert.equal(d.archetype,'assault');assert.ok(d.oppCards.every(c=>OPP_CARDS[c.id]));assert.ok(d.intent);
 const total=d.cards.length;play(s,'end');assert.equal(d.hand.length,4);assert.equal(d.draw.length+d.hand.length+d.discard.length+d.exhaust.length,total);assert.ok(validDuelDeck(d));
});

test('distance and stance change which cards work; reasons are shown',()=>{
 const s=duel({distance:'far'});const [st,pa,fi]=hand(s,['strike','parry','finisher']);
 assert.match(canDuelAction(s,'card:'+st,s.round).reason!,/거리/);assert.match(canDuelAction(s,'card:'+pa,s.round).reason!,/수세/);assert.match(canDuelAction(s,'card:'+fi,s.round).reason!,/거리|기세/);
 const t=duel({distance:'mid'});const [a,b]=hand(t,['stance_off','strike']);const before=t.enemyHp;play(t,'card:'+b);const plain=before-t.enemyHp;const u=duel({distance:'mid'});const [c,e]=hand(u,['stance_off','strike']);play(u,'card:'+c);const b2=u.enemyHp;play(u,'card:'+e);assert.equal(b2-u.enemyHp,plain+2,'offense stance strengthens strikes');void a;
});

test('defensive chain: probe → read attack → stance → parry → opponent strikes into full guard → opening + counter → next exchange clean finisher',()=>{
 const s=duel();intent(s,'o_strike');const [p,so,sd,pa]=hand(s,['probe','step_out','stance_def','parry']);s.deck!.points=3;
 play(s,'card:'+p);assert.ok(s.deck!.readThisExchange);play(s,'card:'+so);play(s,'card:'+sd);play(s,'card:'+pa);play(s,'end');
 assert.ok(s.v2!.opening,'parry opened a gap');assert.equal(s.v2!.stats.counters,1);
 s.v2!.distance='near';s.momentum=2;const [f]=hand(s,['finisher']);const hp=s.enemyHp;play(s,'card:'+f);assert.ok(hp-s.enemyHp>=12||s.enemyHp===0);assert.equal(s.v2!.stats.openingsUsed,1);assert.equal(evaluateDuel(s).excessive,false);
});

test('offensive chain: close in → offense stance → break guard → opponent posture breaks → clean subdue',()=>{
 const s=duel({distance:'mid',oppStartGuard:5});const [i,o,b]=hand(s,['step_in','stance_off','break']);play(s,'card:'+i);play(s,'card:'+o);play(s,'card:'+b);
 assert.equal(s.enemyShield,0);assert.ok(s.deck!.oppOpening,'broken guard opens the opponent');assert.equal(s.deck!.stats.guardBreaks,1);
 s.deck!.points=2;s.momentum=Math.max(2,s.momentum);const [f]=hand(s,['finisher']);s.deck!.oppOpening=true;const hp=s.enemyHp;play(s,'card:'+f);assert.ok(hp-s.enemyHp>=12||s.enemyHp===0);assert.equal(s.deck!.stats.cleanHits,1);
});

test('a blind gambit is punished and over-force lowers the grade: one big card is not the best line',()=>{
 const s=duel({objective:'barracks_gate',archetype:'command'},'champion');intent(s,'o_strike');s.v2!.distance='near';s.momentum=5;s.enemyHp=19;const [g]=hand(s,['t_all_in']);s.deck!.points=3;play(s,'card:'+g);
 assert.equal(s.result,'win');const ev=evaluateDuel(s);assert.ok(ev.excessive);assert.equal(ev.grade,'명목상 장악');
 const t=duel();intent(t,'o_strike');t.v2!.distance='near';t.momentum=2;const [f]=hand(t,['finisher']);const hp=t.hp;t.protection=0;play(t,'card:'+f);if(t.result==='ongoing'){play(t,'end');assert.ok(hp-t.hp>=7+4-1,'unread finisher eats a counter');}
});

test('opponent archetypes: counter-type punishes attack cards, endure grows guard, trick seals defence unless read, command calls soldiers that probes remove',()=>{
 const c=duel({archetype:'counter'});intent(c,'o_counter');c.v2!.distance='mid';const [st]=hand(c,['strike']);const hp=c.hp;c.protection=0;play(c,'card:'+st);assert.equal(c.hp,hp-3,'counter stance hits each attack card');
 const e=duel({archetype:'endure'});intent(e,'o_guard');const g=e.enemyShield??0;play(e,'end');assert.equal(e.enemyShield,g+5+1);
 const t=duel({archetype:'trick'});intent(t,'o_feint');play(t,'end');assert.deepEqual(t.deck!.blocked,['수세']);const [pa]=hand(t,['stance_def']);assert.match(canDuelAction(t,'card:'+pa,t.round).reason!,/봉쇄/);
 const r=duel({archetype:'trick'});intent(r,'o_feint');const [p]=hand(r,['probe']);play(r,'card:'+p);play(r,'end');assert.deepEqual(r.deck!.blocked,[],'reading the feint voids it');
 const m=duel({objective:'barracks_gate',archetype:'command',support:2},'champion');assert.equal(m.deck!.oppCards.filter(c=>c.id==='o_support').length,2);const [q]=hand(m,['probe']);play(m,'card:'+q);assert.equal(m.v2!.support,1);assert.equal(m.deck!.oppCards.filter(c=>c.id==='o_support').length,1);
});

test('lure forces a passive opponent to attack, then turns the attack into a near-range opening',()=>{
 const s=duel();s.deck!.oppMomentum=1;intent(s,'o_guard');const [l]=hand(s,['lure']);play(s,'card:'+l);assert.equal(s.deck!.intent!.kind,'attack');assert.ok(s.deck!.intent!.forced);play(s,'end');assert.equal(s.v2!.distance,'near');assert.ok(s.v2!.opening);
});

test('injuries add burden cards unless medicine was prepared; talent principles and support cards only for participants',()=>{
 const s=duel();s.hp=Math.floor(s.maxHp*.55);s.protection=0;intent(s,'o_strike');play(s,'end');assert.ok(s.deck!.injuries.length>=1);assert.ok(s.deck!.cards.some(c=>c.id==='pain'));
 const m=duel({medicine:1});m.hp=Math.floor(m.maxHp*.55);m.protection=3;intent(m,'o_strike');play(m,'end');assert.equal(m.deck!.injuries.length,0);
 const no=duel({officers:[]},'inn_guard','dianwei');assert.ok(!no.deck!.cards.some(c=>c.id==='s_dianwei'));const yes=duel({officers:['dianwei']});assert.ok(yes.deck!.cards.some(c=>c.id==='s_dianwei'));
 const [b1,b2,b3]=hand(yes,['step_in','stance_off','break']);yes.enemyShield=3;play(yes,'card:'+b1);play(yes,'card:'+b2);play(yes,'card:'+b3);assert.ok(yes.deck!.cards.some(c=>c.id==='counter_strike'),'Dian Wei principle: first guard break → counter card');
 const x=duel({officers:['xunyu']});assert.equal(x.maxRounds,6,'Xun Yu: formal rule — one more exchange');const [fx]=hand(x,['s_xunyu']);play(x,'card:'+fx);x.result='draw';assert.ok(evaluateDuel(x).rank>=1);assert.ok(evaluateDuel(x).adjust.length>0);
 const l=duel({officers:['lusu']});l.result='lose';assert.equal(evaluateDuel(l).grade,'조건부 인정','Lu Su: lost contract duel becomes conditional');
});

test('preview leaves the duel untouched; same seed and same choices give the same duel',()=>{
 const s=duel({tactics:['t_read']});const before=JSON.stringify(s);for(const u of s.deck!.hand)previewDuelAction(s,'card:'+u);previewDuelAction(s,'end');assert.equal(JSON.stringify(s),before);
 const run=()=>{const t=duel({tactics:['t_read']});for(let i=0;i<12&&t.result==='ongoing';i++){const u=t.deck!.hand.find(u=>canDuelAction(t,'card:'+u,t.round).ok);resolveDuelAction(t,u!==undefined?'card:'+u:'end',t.round);if(i%2)resolveDuelAction(t,'end',t.round);}return JSON.stringify(t);};assert.equal(run(),run());
 assert.ok(Object.values(DUEL_CARDS).every(c=>Array.isArray(c.produces)&&Array.isArray(c.consumes)),'every card declares produces/consumes');
});

test('inside gate: each unresolved obstacle changes the real follow-up deck (watch hides & adds watch cards, commander keeps command cards & guard, soldiers add support cards)',async()=>{
 const {runLusu}=await import('../src/sim/card-engine-builds.ts');const {engineOf}=await import('../src/core/card-engine.ts');const {raisingOf,selectRaisingPlan,finishRaisingGate}=await import('../src/core/raising.ts');const {personnelOf}=await import('../src/core/personnel-rules.ts');
 const base=runLusu().gateState!;
 const setup=(produced:Record<string,number>,debate:'success'|'partial',passage:boolean,field?:(f:import('../src/core/debate-field-types.ts').DebateField)=>void)=>{const r=structuredClone(base),e=engineOf(r)!;e.stats.produced=produced;e.legacy=e.legacy.filter(l=>l.id!=='escort:alternate');if(passage)e.legacy.push({id:'escort:alternate',kind:'gate',text:''});
  const q=raisingOf(r)!;assert.ok(selectRaisingPlan(r,'inside',personnelOf(r)!.representative!,q.revision).ok);const g=q.gate!.debate!;g.result=debate;if(field&&g.field)field(g.field);finishRaisingGate(r,q.revision);return q;};
 const none=setup({inside:0,clue:0,support:0,ledger:0},'partial',false);assert.equal(none.phase,'duel');const d0=none.gate!.duel!.deck!;
 assert.equal(d0.archetype,'trick','watch left → tricky gate guard');assert.ok(d0.oppCards.some(c=>c.id==='o_watch'));assert.ok(d0.oppCards.some(c=>c.id==='o_command'));assert.equal(d0.oppCards.filter(c=>c.id==='o_support').length,2);assert.ok(d0.intent!.concealed,'first intent hidden');assert.equal(none.gate!.duel!.enemyShield,4);
 const some=setup({inside:2,clue:5,support:4,ledger:3},'partial',false);assert.equal(some.phase,'duel');const d1=some.gate!.duel!.deck!;
 assert.equal(d1.archetype,'endure');assert.ok(!d1.oppCards.some(c=>c.id==='o_watch'||c.id==='o_command'||c.id==='o_support'));assert.ok(!d1.intent!.concealed);assert.equal(some.gate!.duel!.enemyShield,2);assert.equal(d1.drawRank,3,'cause/trust → a draw still counts as a quiet opening');assert.equal(d0.drawRank,0);
 const all=setup({inside:4,clue:5,support:4,ledger:3},'success',true);assert.notEqual(all.phase,'duel','all three resolved → no duel');
 const mil=setup({inside:0,clue:0,support:0,ledger:3},'success',false,f=>{f.stats.oppCoreBroken=true;f.opponent=f.opponent.filter(a=>a.definitionId!=='o_soldiers');f.exposedDefs.push('h_order');});
 const d2=mil.gate!.duel!.deck!;assert.ok(!d2.oppCards.some(c=>c.id==='o_command'),'debate broke the command claim');assert.ok(d2.prepared.some(p=>p.includes('숨은 지시')));assert.ok(!d2.intent!.concealed);
 assert.ok(d2.oppCards.filter(c=>c.id==='o_support').length<2,'debate removed a soldier support card');
});

test('duel results become later debate conditions (not rewards): practice → Dian Wei guarantee argument, over-force → watchful audience',async()=>{
 const {freshRun,Player}=await import('../src/sim/card-engine-play.ts');const {engineDuelFinished,engineFieldSetup}=await import('../src/core/card-engine.ts');
 const P=new Player(freshRun());const s=duel({objective:'practice',archetype:'counter'});s.result='win';s.v2!.stats.counters=1;s.v2!.stats.distances=['mid','near'];s.v2!.stats.stances=['defense','offense'];
 engineDuelFinished(P.r,s,'inn_courtyard');assert.ok(P.e.arguments.some(a=>a.id==='duel:dianwei-vouch'));assert.ok(engineFieldSetup(P.r,'inn_documents').evidence.includes('a_vouch'));
 const t=duel();t.result='win';t.v2!.stats.forceHit=20;engineDuelFinished(P.r,t,'inn_escort');assert.ok(engineFieldSetup(P.r,'gate:assembly').audience!.includes('au_watch'));
});
