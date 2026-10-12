import {test} from 'node:test';
import assert from 'node:assert/strict';
import {freshRun,Player} from '../src/sim/card-engine-play.ts';
import {createDebate} from '../src/core/debate.ts';
import {prepareNegotiation} from '../src/core/negotiation.ts';
import {startDeckDebate,resolveDeckAction,deckPreview,canDeckAction,defaultDebateBuild,deckGrade} from '../src/core/debate-deck.ts';
import {setupField,attackTargets,playerAlive,fieldSummary,intentText} from '../src/core/debate-field.ts';
import {evaluateDebate,clauseContext} from '../src/core/debate-grade.ts';
import {ARGUMENT_DEFS,DEBATE_ARCHETYPES} from '../src/data/debate-field.ts';
import {DEBATE_CARDS} from '../src/data/debate-cards.ts';
import {validDebateField} from '../src/core/debate-deck-validation.ts';
import {saveCampaign,loadCampaign} from '../src/core/campaign-save.ts';
import {memoryKV} from '../src/core/save.ts';
import type {DebateState} from '../src/core/social-types.ts';

/** 시험용 논박진: 같은 시드, 원하는 카드를 손에 넣는다. */
function field(context:string,opts:{evidence?:string[];officers?:string[];opponent?:string}={}):DebateState{
 const s=createDebate(4242,'chengong',opts.opponent??'elder',{kind:'supply'});prepareNegotiation(s,6,0,0);const b=defaultDebateBuild();startDeckDebate(s,b);
 setupField(s,{context,officers:opts.officers??[],evidence:opts.evidence??[]});return s;}
function give(s:DebateState,ids:string[]){const d=s.deck!;d.discard.push(...d.hand.splice(0));for(const id of ids){const c={uid:d.nextUid++,id,temporary:true as const};d.cards.push(c);d.hand.push(c.uid);}s.resolve=6;return d.hand.slice(-ids.length);}
const act=(s:DebateState,a:string)=>{const r=resolveDeckAction(s,a,s.deck!.revision);assert.ok(r.ok,`${a}: ${r.reason}`);return r;};

test('argument field: archetype by context, core claims, supports, hidden interest, 5-card hand with prepared evidence, deck ≤ 12',()=>{
 const s=field('inn_documents',{evidence:['a_ledger','a_witness']});const f=s.field!;
 assert.equal(f.archetype,'official');assert.equal(f.playerCore.definitionId,'pc_records');assert.equal(f.opponentCore.definitionId,'o_core_official');
 assert.deepEqual(f.opponent.map(a=>a.definitionId),DEBATE_ARCHETYPES.official.supports);assert.equal(f.hidden[0].definitionId,'h_clerk');assert.ok(f.hidden[0].hidden);
 assert.equal(s.deck!.hand.length,5);const evid=s.deck!.hand.map(u=>s.deck!.cards.find(c=>c.uid===u)!).filter(c=>c.id==='evidence');assert.equal(evid.length,2,'prepared evidence is in the opening hand');assert.ok(s.deck!.cards.length<=12);
 assert.equal(field('inn_escort_terms').field!.archetype,'merchant');assert.equal(field('gate:assembly').field!.archetype,'assembly');assert.equal(field('gate:inside').field!.archetype,'military');
 assert.equal(field('gate:inside').maxRounds,4,'military debates are short');assert.ok(validDebateField(s.field));
});

test('argument limit: a fourth argument needs replace / instant / cancel — the oldest is never discarded automatically',()=>{
 const s=field('inn_documents');const [a,b,c,d]=give(s,['grounds','x_doc','plan','supplies']);
 act(s,'card:'+a);act(s,'card:'+b);act(s,'card:'+c);assert.equal(playerAlive(s.field!).length,3);
 const chk=canDeckAction(s,'card:'+d,s.deck!.revision);assert.equal(chk.ok,false);assert.match(chk.reason!,/교체|즉시|취소/);
 const before=s.field!.player.map(x=>x.argumentId);const inst=deckPreview(s,`card:${d}:instant`);assert.ok(inst.check.ok);assert.deepEqual(inst.state.field!.player.map(x=>x.argumentId),before,'instant use keeps every argument');
 act(s,`card:${d}:replace:${before[1]}`);assert.ok(!s.field!.player.some(x=>x.argumentId===before[1]));assert.ok(s.field!.player.some(x=>x.definitionId==='a_route'));assert.ok(s.field!.player.some(x=>x.argumentId===before[0]),'oldest stays unless chosen');
});

test('opponent intents come from a seeded intent deck, show their target, hit real arguments; protection and guard absorb',()=>{
 const a=field('inn_documents'),b=field('inn_documents');assert.deepEqual(a.field!.pattern,b.field!.pattern,'same seed, same intent deck');
 const s=field('inn_escort_terms');const [g]=give(s,['grounds']);act(s,'card:'+g);while(s.field!.intents[0].kind!=='attack'){act(s,'end-round');if(s.result!=='ongoing')return;const [x]=give(s,['grounds']);if(playerAlive(s.field!).length<3)act(s,'card:'+x);}
 const it=s.field!.intents[0];assert.match(intentText(s,s.field!,it),/논거 공격 →/);const target=s.field!.player.find(x=>x.argumentId===it.target)!;const dur=target.durability;
 const [p]=give(s,['assurance']);act(s,'card:'+p);assert.equal(target.protection,1,'mediation protects the threatened argument');act(s,'end-round');
 assert.ok(target.durability>=dur-Math.max(0,it.amount-1),'protection absorbed part of the hit');
});

test('hidden arguments cannot be attacked until exposed; exposing the clerk reveals a contradiction that cracks the official core',()=>{
 const s=field('inn_documents');const h=s.field!.hidden[0];assert.ok(!attackTargets(s.field!).some(a=>a===h));assert.equal(canDeckAction(s,'target:'+h.argumentId,s.deck!.revision).ok,false);
 const core=s.field!.opponentCore.durability;const [i]=give(s,['inspect']);act(s,'card:'+i);assert.ok(h.exposed&&!h.hidden);assert.equal(s.field!.opponentCore.durability,core-3);assert.ok(canDeckAction(s,'target:'+h.argumentId,s.deck!.revision).ok);
});

test('four methods work differently: 정론 places/unlocks, 압박 hits hard and delays, 계책 redirects/converts, 중재 protects both and calms',()=>{
 const s=field('inn_documents');s.field!.locked=['records'];const [g,p]=give(s,['grounds','petition']);act(s,'card:'+g);assert.ok(s.field!.player.some(a=>a.definitionId==='a_grounds'));act(s,'card:'+p);assert.deepEqual(s.field!.locked,[]);
 const t=field('inn_documents');const target=t.field!.opponent.find(a=>a.definitionId==='o_procedure')!;act(t,'target:'+target.argumentId);const [c]=give(t,['challenge']);const kind=t.field!.intents[0].kind;act(t,'card:'+c);assert.equal(target.durability,0);assert.equal(t.field!.pressure,1);if(kind!=='react')assert.equal(t.field!.intents[0].source,'지연','breaking an argument with pressure delays the intent');
 const u=field('inn_escort_terms');const [x,y]=give(u,['grounds','supplies']);act(u,'card:'+x);act(u,'card:'+y);u.field!.intents[0]={id:'mer_weak',kind:'attack',target:u.field!.player[0].argumentId,amount:3,concealed:false,source:'test'};const [br]=give(u,['bridge']);act(u,'card:'+br);assert.ok(u.field!.intents[0].redirected);
 const v=field('inn_escort_terms');const weak=v.field!.opponent.find(a=>a.durability<=2)!;const [cv]=give(v,['c_turn']);act(v,'target:'+weak.argumentId);act(v,'card:'+cv);assert.equal(v.field!.stats.converted,1);assert.ok(v.field!.player.some(a=>a.definitionId==='a_turned'));
 const w=field('inn_escort_terms');w.field!.impatience=3;const [m]=give(w,['l_med']);act(w,'card:'+m);assert.equal(w.field!.impatience,2);assert.equal(w.field!.opponentCore.protection,1,'mediation also respects the other side');
});

test('archetypes differ: merchant contracts raise costs each round unless the ledger negates; village answers pressure with doubt',()=>{
 const m=field('inn_escort_terms',{opponent:'merchant'});const need=m.negotiation!.needs.profit!;m.field!.intents[0]={id:'vil_shift',kind:'shift',target:null,amount:0,concealed:false,source:'t'};m.field!.intents[0].kind='react';m.field!.intents[0].react='';act(m,'end-round');assert.ok(m.negotiation!.needs.profit!>need,'contract cost rises');
 const l=field('inn_escort_terms',{evidence:['a_ledger'],opponent:'merchant'});const [ev]=[l.deck!.hand.find(u=>l.deck!.cards.find(c=>c.uid===u)!.argDef==='a_ledger')!];act(l,'card:'+ev);const need2=l.negotiation!.needs.profit!;l.field!.intents[0]={id:'delay',kind:'react',target:null,amount:0,react:'',concealed:false,source:'지연'};act(l,'end-round');assert.equal(l.negotiation!.needs.profit,need2+1,'ledger negates one of the two increases (contract + hidden credit)');
 const v=field('shrine');assert.equal(v.field!.archetype,'village');const [c]=give(v,['challenge']);act(v,'card:'+c);assert.ok(v.field!.audience.some(a=>a.definitionId==='au_doubt'),'coercion breeds audience doubt');
});

test('clauses follow living arguments: records needs a document alive; merchant credit needs the hidden interest exposed; grade lists the links',()=>{
 const s=field('inn_documents');const [d]=give(s,['x_doc']);act(s,'card:'+d);s.negotiation!.scores={profit:9,safety:9,honor:9,authority:9};s.trust=6;
 const ok=structuredClone(s);ok.result=deckGrade(ok);const ev=evaluateDebate(ok,clauseContext(ok,'inn_documents',{}));assert.ok(ev.clauses.includes('records'));assert.ok(ev.links.some(t=>t.includes('정리된 문서')&&t.includes('문서 보존')));
 const broken=structuredClone(ok);const doc=broken.field!.player.find(a=>a.definitionId==='a_doc')!;doc.durability=0;broken.field!.player=broken.field!.player.filter(a=>a.durability>0);const ev2=evaluateDebate(broken,clauseContext(broken,'inn_documents',{}));assert.ok(!ev2.clauses.includes('records'));assert.match(ev2.missing.find(m=>m.id==='records')!.reason,/문서 논거/);
 const m=field('inn_escort_terms');m.negotiation!.scores={profit:12,safety:12,honor:12,authority:12};m.trust=6;const c1=structuredClone(m);c1.result='success';assert.ok(!evaluateDebate(c1,clauseContext(c1,'inn_escort_terms',{})).clauses.includes('trade_credit'));
 const [i]=give(m,['inspect']);act(m,'card:'+i);const c2=structuredClone(m);c2.result='success';assert.ok(evaluateDebate(c2,clauseContext(c2,'inn_escort_terms',{})).clauses.includes('trade_credit'));
});

test('excellent agreement needs living evidence, no dangerous opposing argument and no audience doubt',()=>{
 const s=field('inn_documents');const [d]=give(s,['x_doc']);act(s,'card:'+d);s.negotiation!.scores={profit:9,safety:9,honor:9,authority:9};s.trust=6;const c=structuredClone(s);c.result='success';
 const items=evaluateDebate(c,clauseContext(c,'inn_documents',{})).checks.find(x=>x.grade==='탁월한 합의')!.items;assert.ok(items.some(i=>i.text.startsWith('핵심 증거 논거 생존')&&i.ok));assert.ok(items.some(i=>i.text.startsWith('위험 상대 논거 제거')&&!i.ok),'공식 권한 still stands');
 c.field!.opponent=c.field!.opponent.filter(a=>!ARGUMENT_DEFS[a.definitionId].danger);c.field!.audience=[{...c.field!.playerCore,argumentId:'arg99',definitionId:'au_doubt',owner:'audience',core:false}];const items2=evaluateDebate(c,clauseContext(c,'inn_documents',{})).checks.find(x=>x.grade==='탁월한 합의')!.items;assert.ok(items2.some(i=>i.text.startsWith('청중의 의심 없음')&&!i.ok));
 assert.equal(fieldSummary(s.field!).coreAlive,true);
});

test('talent chain: consecutive cards of one talent raise private interest, alternating talents build public opinion',()=>{
 const s=field('gate:assembly');const d=s.deck!;const mk=(id:string,owner:string)=>{const c={uid:d.nextUid++,id,temporary:true as const,personnelCard:900+d.nextUid,personnelOwners:[owner]};d.cards.push(c);d.hand.push(c.uid);return c.uid;};s.resolve=6;
 const a=mk('redress','xunyu'),b=mk('redress','xunyu'),c=mk('plan','lusu');act(s,'card:'+a);act(s,'card:'+b);assert.equal(s.field!.privateInterest,1);act(s,'card:'+c);assert.equal(s.field!.opinion,1);
});

test('preview never changes the original field or rng; same seed and choices give the same result',()=>{
 const s=field('inn_escort_terms',{evidence:['a_witness']});const before=JSON.stringify(s);for(const u of s.deck!.hand){deckPreview(s,'card:'+u);deckPreview(s,`card:${u}:instant`);}deckPreview(s,'end-round');assert.equal(JSON.stringify(s),before);
 const run=()=>{const t=field('inn_escort_terms',{evidence:['a_witness']});for(let i=0;i<4&&t.result==='ongoing';i++){const u=t.deck!.hand.find(u=>canDeckAction(t,'card:'+u,t.deck!.revision).ok);if(u!==undefined)resolveDeckAction(t,'card:'+u,t.deck!.revision);resolveDeckAction(t,'end-round',t.deck!.revision);}return JSON.stringify(t);};assert.equal(run(),run());
});

test('engine exploration debates open the field with exploration evidence; a mid-debate field survives save and reload; non-engine debates keep the old counters',()=>{
 const P=new Player(freshRun());const lib=(id:string)=>P.p.library.find(l=>l.id===id&&P.p.loadouts.raising.includes(l.uid))!.uid;P.act('enter');P.act('inn:offer:recommendation');P.act('inn:accept:recommendation');for(const [x,y] of [['x_document','coin'],['x_orthodox','manifesto']])P.act(`engine:pact-swap:${x}:${lib(y)}`);P.act('engine:pact-stratagem:many_hands');P.act('engine:pact-close');P.act('inn:quest:recommendation:public-records');
 P.visit('archive');P.act('scene:inspect:ledger');for(const [f,c] of [['record_gap','x_document'],['clerk_guard','x_orthodox'],['refugee_distrust','recommend']]){P.act('engine:focus:'+f);P.play(c);}
 const res=P.try('engine:resolve:debate');assert.ok(res.ok,res.reason);const s=P.x.debate!;assert.ok(s.field);assert.equal(s.field!.context,'inn_documents');
 const u=s.deck!.hand.find(u=>canDeckAction(s,'card:'+u,s.deck!.revision).ok);if(u!==undefined)P.act('social:card:'+u);P.act('social:end-round');
 const kv=memoryKV();assert.ok(saveCampaign(kv,P.r));const loaded=loadCampaign(kv);assert.ok(loaded.ok);const l=loaded.data.activeExpedition!.campaign!.cities.xingyang!.exploration!.debate!;assert.deepEqual(l.field,s.field);
 const old=createDebate(5,'chengong','merchant',{kind:'supply'});prepareNegotiation(old,5,0,0);startDeckDebate(old,defaultDebateBuild());assert.equal(old.field,undefined);assert.equal(old.deck!.counters.length,5);
 assert.ok(DEBATE_CARDS.evidence&&DEBATE_CARDS.x_doc.fieldText);
});
