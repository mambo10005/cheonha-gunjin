import {test} from 'node:test';
import assert from 'node:assert/strict';
import {freshRun,Player} from '../src/sim/card-engine-play.ts';
import {engineOf,applyEngineFounding,burdenHandSafety,buildDebugReport,applyGateDuelRules} from '../src/core/card-engine.ts';
import {evaluateDebate} from '../src/core/debate-grade.ts';
import {CLAUSES,type ClauseContext} from '../src/data/clauses.ts';
import {evaluateDuel} from '../src/data/duel-objectives.ts';
import {GATE_PROFILES} from '../src/data/gate-profiles.ts';
import {createDuel,enableDuelV2,resolveDuelAction,canDuelAction,duelActionList} from '../src/core/duel.ts';
import {playCard,cardDef} from '../src/core/combat.ts';
import {currentEscortBattle} from '../src/sim/escort-battle-analysis.ts';
import {debateAB,duelAB,insideMatrix} from '../src/sim/card-engine-ab.ts';
import {runLusu} from '../src/sim/card-engine-builds.ts';
import {validEngine} from '../src/core/card-engine-validation.ts';
import {exploreAction} from '../src/core/city-exploration.ts';
import {CARD_GRAMMAR} from '../src/data/card-grammar.ts';
import type {DebateState,DuelState} from '../src/core/social-types.ts';
import type {CityState} from '../src/core/city-types.ts';

const ctx=(o:Partial<ClauseContext>={}):ClauseContext=>({context:'inn_documents',result:'success',scores:{safety:5,honor:3},needs:{safety:5,honor:2},trust:5,trustNeeded:3,burden:0,burdenLimit:3,rounds:2,maxRounds:5,plays:{grounds:1,petition:1},promises:[],argsInitial:4,argsPreserved:3,recordArgs:1,countersBlocked:1,countersHit:1,opinion:0,privateInterest:0,pledges:1,promiseMarks:0,talents:1,profile:'standard',...o});
const ev=(o:Partial<ClauseContext>={})=>evaluateDebate({} as DebateState,ctx(o));

test('debate grade comes from explicit per-grade conditions (clauses, trust, burden, preserved arguments, rounds, special objective)',()=>{
 const top=ev();assert.equal(top.grade,'탁월한 합의');assert.ok(top.clauses.includes('records')&&top.clauses.includes('levy_limit'));
 assert.equal(ev({burden:2}).grade,'일반 합의','burden 2 drops below favorable even on success');
 assert.equal(ev({argsPreserved:1}).grade,'유리한 합의','losing arguments to counters blocks the top grade');
 assert.equal(ev({rounds:4}).grade,'유리한 합의','using every round blocks the top grade');
 const noDocs=ev({plays:{grounds:1}});assert.ok(!noDocs.clauses.includes('records'));assert.match(noDocs.missing.find(m=>m.id==='records')!.reason,/2회 필요/);assert.equal(noDocs.grade,'유리한 합의');
 assert.equal(ev({result:'partial'}).grade,'조건부 합의');assert.equal(ev({result:'failure'}).grade,'결렬');
 const fav=ev({burden:1});assert.ok(fav.checks.find(c=>c.grade==='탁월한 합의')!.items.every(i=>i.ok)===false||fav.grade==='탁월한 합의');
});

test('clauses: costs conflict with gains, promises gate the resident limit, private interest blocks shared rule, profile changes requirements',()=>{
 const levy=ev({promises:['ration']});assert.ok(levy.clauses.includes('ration_levy'));assert.ok(!levy.clauses.includes('levy_limit'),'ration levy conflicts with the resident limit');assert.notEqual(levy.grade,'탁월한 합의','a cost clause blocks the top grade');
 assert.ok(!ev({pledges:0}).clauses.includes('levy_limit'),'fewer promises → no resident limit');
 const shared=(o:Partial<ClauseContext>)=>evaluateDebate({} as DebateState,ctx({context:'gate:assembly',scores:{honor:5},needs:{honor:3},opinion:5,talents:2,...o}));
 assert.ok(shared({}).clauses.includes('shared_gov'));assert.ok(!shared({privateInterest:2}).clauses.includes('shared_gov'));
 assert.ok(!shared({promises:['authority']}).clauses.includes('shared_gov'),'authority grant conflicts with shared rule');
 assert.ok(!shared({profile:'harsh',opinion:4}).clauses.includes('shared_gov'),'harsh asks for more public opinion');assert.ok(shared({profile:'lenient',opinion:3}).clauses.includes('shared_gov'));
 const strong=ev({plays:{grounds:1,petition:1,challenge:2}});assert.ok(strong.pressure,'strong pressure leaves a post-uprising distrust issue');
 for(const c of Object.values(CLAUSES))assert.ok(c.text&&c.effects,'every clause has a description and effects');
});

test('same success, different clauses → different city state after the uprising',()=>{
 const city=():CityState=>({policies:[],promises:[],groups:{locals:0,traders:0,refugees:0},metrics:{order:50,security:50,life:50,economy:50,morale:50},districts:[{id:'hall',damage:2},{id:'store',damage:2}]} as unknown as CityState);
 const run=(legacy:string[])=>{const P=new Player(freshRun());const e=engineOf(P.r)!;e.legacy=legacy.map(id=>({id,kind:'gate' as const,text:id}));const c=city();const lines=applyEngineFounding(P.r,c,()=>true);return {c,lines};};
 const a=run(['deal:records','deal:levy_limit']),b=run(['deal:ration_levy','deal:distrust']);
 assert.equal(a.c.districts.find(d=>d.id==='hall')!.damage,0,'records preserve the hall');assert.equal(b.c.districts.find(d=>d.id==='hall')!.damage,2);
 assert.ok(a.c.promises.some(p=>p.id==='safety'));assert.ok(b.c.promises.some(p=>p.id==='ration'));
 assert.equal(a.c.groups.locals,1);assert.equal(b.c.groups.locals,-2);assert.ok(b.c.metrics.order<a.c.metrics.order);
 assert.ok(a.lines.some(l=>l.includes('관청 기록 보존')));assert.ok(b.lines.some(l=>l.includes('불신')));
});

const v2=(objective:string,o:{support?:number;distance?:'near'|'mid'|'far';pattern?:DuelState['pattern']}={})=>{const s=createDuel(3,'chengong','champion');enableDuelV2(s,objective,{support:o.support??0,distance:o.distance??'mid',profile:'standard',maxRounds:5,pattern:o.pattern});s.patternOffset=0;return s;};

test('duel v2: distance, guard counter opens a gap, lure, blind finisher is countered, probe reveals and strips support',()=>{
 const far=v2('practice',{distance:'far',pattern:['guard','strike','strike','strike']});resolveDuelAction(far,'strike',far.round);assert.equal(far.enemyHp,far.enemyMaxHp,'nothing reaches from far');const rush=v2('practice',{distance:'far',pattern:['strike','strike','strike','strike']});const hp=rush.hp;resolveDuelAction(rush,'guard',rush.round);assert.equal(rush.hp,hp,'an enemy strike from far only closes in');assert.equal(rush.v2!.distance,'mid');
 const g=v2('practice',{pattern:['strike','finisher','strike','strike']});g.protection=6;resolveDuelAction(g,'guard',g.round);assert.ok(g.v2!.opening,'full guard opens a gap');assert.equal(g.v2!.stats.counters,1);
 g.momentum=3;g.v2!.distance='near';const before=g.enemyHp;resolveDuelAction(g,'finisher',g.round);assert.ok(before-g.enemyHp>=12);assert.equal(g.v2!.stats.openingsUsed,1);assert.equal(evaluateDuel(g).excessive,false,'a finisher through a gap is clean');
 const blind=v2('practice',{distance:'near',pattern:['strike','strike','strike','strike']});blind.momentum=3;const h=blind.hp;resolveDuelAction(blind,'finisher',blind.round);assert.equal(blind.v2!.stats.blindFinishers,1);assert.ok(h-blind.hp>=4,'unread finisher eats a counter');
 const lure=v2('practice',{distance:'far',pattern:['finisher','strike','strike','strike']});resolveDuelAction(lure,'lure',lure.round);
 const pr=v2('barracks_gate',{support:2});assert.equal(pr.enemyShield,6);resolveDuelAction(pr,'probe',pr.round);assert.equal(pr.v2!.support,1);assert.equal(pr.v2!.revealed,1);
 assert.deepEqual(duelActionList(pr).slice(0,6),['probe','step-in','step-out','strike','guard','lure']);assert.equal(canDuelAction(pr,'finisher',pr.round).ok,false,'finisher needs momentum and near distance');
});

test('duel objectives: a 23-damage gambit cannot bypass evaluation; excessive force, rounds and support set the grade',()=>{
 const s=v2('barracks_gate',{support:0,distance:'near',pattern:['probe','probe','probe','probe']});s.enemyHp=19;s.loadout={opening:null,response:null,gambit:'all_in',used:[]};s.momentum=5;resolveDuelAction(s,'gambit',s.round);assert.equal(s.result,'win');
 const r=evaluateDuel(s);assert.ok(r.excessive,'one blind 19+ hit is excessive force');assert.equal(r.grade,'명목상 장악');
 const clean=v2('barracks_gate',{support:0,pattern:['strike','strike','strike','strike']});clean.protection=6;clean.counterBonus=3;resolveDuelAction(clean,'guard',clean.round);clean.v2!.distance='near';clean.momentum=3;clean.enemyHp=Math.min(clean.enemyHp,10);resolveDuelAction(clean,'finisher',clean.round);assert.equal(clean.result,'win');assert.equal(evaluateDuel(clean).grade,'완전 장악');
 const prepared=v2('barracks_gate',{support:2,pattern:['strike','strike','strike','strike']});prepared.protection=6;prepared.counterBonus=3;resolveDuelAction(prepared,'guard',prepared.round);assert.equal(prepared.v2!.support,1,'a prepared counter scatters one watching supporter');
 const plain=v2('barracks_gate',{support:2,pattern:['strike','strike','strike','strike']});plain.protection=6;resolveDuelAction(plain,'guard',plain.round);assert.equal(plain.v2!.support,2);
 const esc=v2('escort_captain');esc.result='draw';assert.equal(evaluateDuel(esc).grade,'조건부 인정');
});

test('gate profiles change opponents, support, distance and rounds rather than scaling numbers',()=>{
 const P=new Player(freshRun());const e=engineOf(P.r)!;
 for(const id of ['lenient','standard','harsh'] as const){assert.ok(exploreAction(P.r,'engine:profile:'+id,P.x.revision).ok);const s=createDuel(3,'chengong','champion');const hp=s.enemyHp;applyGateDuelRules(P.r,s,'barracks',null);assert.equal(s.enemyHp,hp);assert.equal(s.v2!.distance,GATE_PROFILES[id].duel.startDistance);assert.equal(s.maxRounds,GATE_PROFILES[id].duel.maxRounds);assert.equal(s.v2!.support,GATE_PROFILES[id].duel.support+2);}
 assert.equal(e.profile,'harsh');assert.equal(exploreAction(P.r,'engine:profile:brutal',P.x.revision).ok,false);
 assert.match(GATE_PROFILES.standard.name,/검토 중/);
});

test('escort formation is a playable chain: start block, the first block card generates one counter card, consumed once',async()=>{
 const b=await currentEscortBattle();assert.equal(b.flags.escortChain,1);
 const bb=structuredClone(b);const idx=bb.hand.findIndex(c=>cardDef(c).effects.some(e=>e.k.startsWith('block')));if(idx<0){bb.hand.push({uid:99001,id:'formation'});}
 const i=bb.hand.findIndex(c=>cardDef(c).effects.some(e=>e.k.startsWith('block')));const d=cardDef(bb.hand[i]);bb.energy=9;const res=playCard(bb,i,d.target==='row'?{row:'rear'}:{});assert.ok(res.ok,res.reason);
 assert.equal(bb.hand.filter(c=>c.id==='counterstrike').length,1);assert.equal(bb.flags.escortChain,0);
 const j=bb.hand.findIndex(c=>c.id!=='counterstrike'&&cardDef(c).effects.some(e=>e.k.startsWith('block')));if(j>=0){const dj=cardDef(bb.hand[j]);playCard(bb,j,dj.target==='row'?{row:'rear'}:{});assert.equal(bb.hand.filter(c=>c.id==='counterstrike').length,1,'only once');}
});

test('burden hand safety: an opening hand never holds more than one burden card when a replacement exists',()=>{
 const P=new Player(freshRun());const q=P.q;const burdenIds=Object.keys(CARD_GRAMMAR).filter(id=>CARD_GRAMMAR[id].burden);assert.ok(burdenIds.length>=2);
 const all=[...q.hand,...q.draw];const mk=(id:string)=>{const uid=9000+q.cards.length;q.cards.push({uid,id} as typeof q.cards[number]);return uid;};
 const b1=mk(burdenIds[0]),b2=mk(burdenIds[1]);q.hand=[b1,b2,...all.slice(0,3)];q.draw=all.slice(3);burdenHandSafety(P.r);
 assert.equal(q.hand.filter(uid=>CARD_GRAMMAR[q.cards.find(c=>c.uid===uid)!.id]?.burden).length,1);assert.ok(q.draw.includes(b2));
});

test('A/B: build debate gets better clauses and grade; Dian Wei duel beats the stripped deck on rounds/support; inside matrix is not one grade',async()=>{
 const d=debateAB();const rank=(g:string)=>['결렬','조건부 합의','일반 합의','유리한 합의','탁월한 합의'].indexOf(g);assert.ok(rank(d.A.grade)>rank(d.B.grade),`${d.A.grade} vs ${d.B.grade}`);assert.ok(d.A.clauses.length>d.B.clauses.length);
 const u=await duelAB();assert.equal(u.A.grade,'완전 장악');assert.notEqual(u.B.grade,'완전 장악');assert.ok(u.B.rounds.length>u.A.rounds.length);
 const lusu=runLusu();const m=insideMatrix(lusu.gateState!);const kinds=new Set(m.map(i=>i.skip?'생략':i.grade));assert.ok(kinds.size>=3,[...kinds].join(','));assert.ok(m.some(i=>i.issues.length>0)&&m.some(i=>i.issues.length===0));
});

test('playtest: survey answers and grades go into the local report and survive validation',()=>{
 const P=new Player(freshRun());assert.ok(exploreAction(P.r,'engine:survey:chain:'+encodeURIComponent('그렇다'),P.x.revision).ok);
 const rep=buildDebugReport(P.r)!;assert.equal(rep.version,2);assert.equal(rep.survey.chain,'그렇다');assert.ok(Array.isArray(rep.debates)&&Array.isArray(rep.duels));assert.equal(rep.profile,'standard');
 assert.ok(validEngine(engineOf(P.r)));const bad=structuredClone(engineOf(P.r)!);(bad as {profile:string}).profile='brutal';assert.equal(validEngine(bad),false);
});

test('a gate duel in v2 (profile round limits, distance, support) survives save and reload',async()=>{
 const {runDianwei}=await import('../src/sim/card-engine-builds.ts');const {selectRaisingPlan,raisingOf}=await import('../src/core/raising.ts');const {personnelOf}=await import('../src/core/personnel-rules.ts');const {saveCampaign,loadCampaign}=await import('../src/core/campaign-save.ts');const {memoryKV}=await import('../src/core/save.ts');
 for(const profile of ['standard','harsh'] as const){const r=structuredClone(runDianwei(false).gateState!);engineOf(r)!.profile=profile;const q=raisingOf(r)!;const res=selectRaisingPlan(r,'barracks',personnelOf(r)!.representative!,q.revision);assert.ok(res.ok,res.reason);const s=q.gate!.duel!;assert.ok(s.v2);assert.ok(resolveDuelAction(s,'probe',s.round).ok);
  const kv=memoryKV();assert.ok(saveCampaign(kv,r));const loaded=loadCampaign(kv);assert.ok(loaded.ok,'reload '+profile);const d=raisingOf(loaded.data.activeExpedition!)!.gate!.duel!;assert.equal(d.v2!.distance,s.v2!.distance);assert.equal(d.v2!.support,s.v2!.support);assert.equal(d.maxRounds,GATE_PROFILES[profile].duel.maxRounds);}
});
