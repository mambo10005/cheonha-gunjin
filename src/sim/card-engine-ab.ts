/**
 * 논박진·대결 덱 A/B 완주 비교와 성문 내응 조합표. 같은 저장 상태에서 빌드만 바꿔 끝까지 진행한다.
 * A: 빌드(협력 교체 카드·책략·탐색 증거·인재 참여·전술) / B: 빌드·인재 원칙·지원·책략·전술 제거.
 * 설전은 같은 자동 정책(복제 상태로 카드 효과와 상대 의도까지 본다), 대결은 「연쇄 인식」(두 합 앞까지 카드 순서 탐색)과
 * 「탐욕」(즉시 피해 최대 카드, 하한) 두 정책. 자동 정책 결과이며 사람의 판단·재미를 대신하지 않는다.
 */
import {writeFileSync} from 'node:fs';
import {freshRun,Player,debateAction,deckDuelAction} from './card-engine-play.ts';
import {DEBATE_CARDS} from '../data/debate-cards.ts';
import {ARGUMENT_DEFS} from '../data/debate-field.ts';
import {DUEL_CARDS,OPP_CARDS} from '../data/duel-cards.ts';
import {CLAUSES} from '../data/clauses.ts';
import {DISTANCE_NAMES,STANCE_NAMES} from '../core/duel.ts';
import {intentLabel} from '../core/duel-deck.ts';
import {intentText} from '../core/debate-field.ts';
import {evaluateDuel} from '../data/duel-objectives.ts';
import {engineOf,insideObstacles,debateEvaluationPreview,engineFoundingResult} from '../core/card-engine.ts';
import {raisingOf,selectRaisingPlan,actRaisingGate,finishRaisingGate} from '../core/raising.ts';
import {personnelOf} from '../core/personnel-rules.ts';
import {explorationOf} from '../core/city-exploration.ts';
import type {RunState} from '../core/types.ts';
import type {DebateState,DuelState} from '../core/social-types.ts';

const lib=(P:Player,id:string)=>P.p.library.find(l=>l.id===id&&P.p.loadouts.raising.includes(l.uid))!.uid;
/** 빌드 제거: 책략·탐색 논거·원칙·전술·관문 기록·연쇄 기록·동행(인재 참여)을 지우고 협력 교체 카드를 원래 공통 카드로 되돌린다. */
export function stripBuild(r:RunState,keepParty=false){const e=engineOf(r)!,p=personnelOf(r)!,q=raisingOf(r)!,x=explorationOf(r)!;e.stratagems=[];e.arguments=[];e.principles={};e.loadout={opening:null,response:null,gambit:null};e.legacy=e.legacy.filter(l=>l.id.startsWith('deal:'));e.stats={chains:{},consumed:{},produced:{},distinctOwners:[],burdenUses:0,forceDealt:0,cardsRemoved:0,cardsUpgraded:0,skips:0};
 for(const sw of e.pact?.swaps??[]){const l=p.library.find(l=>l.id===sw.added&&l.sourceType==='officer');if(l){l.id=sw.removed;l.sourceType='protagonist';l.sourceId=p.protagonistId;const c=q.cards.find(c=>c.personnelCard===l.uid);if(c)c.id=sw.removed;}}
 x.items=[];if(!keepParty){x.companions=[];p.party=[];}p.assistant=null;return r;}
/** 대결 덱에서 인재 원칙·지원 카드를 뺀다(대표가 인재 자신인 군영 대결의 B용). */
function stripDuelOfficers(s:DuelState){const d=s.deck!;d.officers=[];const drop=d.cards.filter(c=>c.source==='인재 지원').map(c=>c.uid);d.cards=d.cards.filter(c=>!drop.includes(c.uid));for(const k of ['draw','hand','discard','exhaust'] as const)d[k]=d[k].filter(u=>!drop.includes(u));while(d.hand.length<d.handSize&&d.draw.length)d.hand.push(d.draw.pop()!);}

// ── 설전 ──
interface DebateRound {round:number;hand:string[];plays:string[];intent:string;events:string[]}
const cardName=(s:DebateState,a:string)=>{const c=s.deck!.cards.find(c=>c.uid===Number(a.split(':')[1]));if(!c)return a;const extra=a.split(':')[2]==='instant'?'(즉시)':a.split(':')[2]==='replace'?'(교체)':'';return DEBATE_CARDS[c.id].name+(c.argDef?`·${ARGUMENT_DEFS[c.argDef].name}`:'')+extra;};
function runDebate(s:DebateState,act:(a:string)=>void){const rounds:DebateRound[]=[];let cur:DebateRound|null=null;const f=s.field!;
 for(let i=0;i<200&&s.result==='ongoing';i++){if(!cur){cur={round:s.round+1,hand:s.deck!.hand.map(u=>{const c=s.deck!.cards.find(c=>c.uid===u)!;return DEBATE_CARDS[c.id].name+(c.argDef?`·${ARGUMENT_DEFS[c.argDef].name}`:'');}),plays:[],intent:f.intents[0]?intentText(s,f,f.intents[0]):'',events:[]};}
  const a=debateAction(s);const h=f.history.length;const label=a.startsWith('card:')?cardName(s,a):a.startsWith('target:')?`겨눔→${ARGUMENT_DEFS[[f.opponentCore,...f.opponent,...f.hidden].find(x=>x.argumentId===a.slice(7))?.definitionId??'']?.name??''}`:a==='end-round'?'라운드 종료':a==='settle'?'최종 제안':a;
  act(a);cur.plays.push(label);cur.events.push(...f.history.slice(h));if(a==='end-round'||s.result!=='ongoing'){rounds.push(cur);cur=null;}}
 return rounds;}
function debateReport(r:RunState,s:DebateState,context:string,rounds:DebateRound[],label:string){const ev=debateEvaluationPreview(r,s,context)!;const f=s.field!;
 return {label,rounds,result:s.result,grade:ev.grade,clauses:ev.clauses.map(id=>CLAUSES[id].name),trust:`${s.trust}/${s.negotiation!.trustNeeded}`,burden:`${s.negotiation!.burden}/${s.negotiation!.burdenLimit}`,
  field:{placed:f.stats.placed,lost:f.stats.lost,destroyedOpp:f.stats.destroyedOpp,exposed:f.stats.exposed,protectedHits:f.stats.protectedHits,blocked:f.stats.blocked,instant:f.stats.instant,replaced:f.stats.replaced,converted:f.stats.converted,coreBroken:f.stats.coreBroken,oppCoreBroken:f.stats.oppCoreBroken,alive:f.player.filter(a=>a.durability>0).map(a=>ARGUMENT_DEFS[a.definitionId].name),opponentLeft:f.opponent.filter(a=>a.durability>0).map(a=>ARGUMENT_DEFS[a.definitionId].name),audience:f.audience.map(a=>ARGUMENT_DEFS[a.definitionId].name),hiddenLeft:f.hidden.filter(h=>h.hidden).map(h=>ARGUMENT_DEFS[h.definitionId].name),evidence:f.preparedEvidence.map(d=>ARGUMENT_DEFS[d].name),officers:f.officers},
  links:ev.links,failed:ev.checks.find(c=>c.grade==='탁월한 합의')!.items.filter(i=>!i.ok).map(i=>i.text)};}
/** 설전 A/B ① 순욱 추천서 서리 설전(관리형). */
export function debateAB(){
 const P=new Player(freshRun());P.act('enter');P.act('inn:offer:recommendation');P.act('inn:accept:recommendation');
 for(const [add,rem] of [['x_document','coin'],['x_orthodox','manifesto']])P.act(`engine:pact-swap:${add}:${lib(P,rem)}`);P.act('engine:pact-stratagem:many_hands');P.act('engine:pact-close');P.act('inn:quest:recommendation:public-records');
 P.visit('archive');P.act('scene:inspect:ledger');for(const [f,c] of [['record_gap','x_document'],['clerk_guard','x_orthodox'],['refugee_distrust','recommend']]){P.act('engine:focus:'+f);P.play(c);}
 const snapshot=structuredClone(P.r);
 const run=(r:RunState,label:string)=>{const Q=new Player(r);Q.act('engine:resolve:debate');const s=Q.x.debate!;const rounds=runDebate(s,a=>Q.act('social:'+a));const rep=debateReport(Q.r,s,'inn_documents',rounds,label);Q.act('finish-social');return {...rep,afterUprising:Q.e.legacy.filter(l=>l.id.startsWith('deal:')).map(l=>l.text)};};
 return {A:run(structuredClone(snapshot),'A · 순욱 빌드(문서 정리·정론 제기·탐색 증거)'),B:run(stripBuild(structuredClone(snapshot)),'B · 빌드·책략·탐색 증거 제거')};
}
/** 설전 A/B ② 민회와 격문 관문(복수 청중). A: 순욱 참여. B: 인재 원칙·지원·책략·증거 제거. */
export async function assemblyAB(){const {runXunyu}=await import('./card-engine-builds.ts');const at=runXunyu().gateState;if(!at)throw new Error('민회 직전 상태 없음');
 const run=(r:RunState,label:string)=>{const q=raisingOf(r)!;const res=selectRaisingPlan(r,'assembly',personnelOf(r)!.representative!,q.revision);if(!res.ok)throw new Error(res.reason);const s=q.gate!.debate!;const rounds=runDebate(s,a=>{const x=actRaisingGate(r,a,q.revision);if(!x.ok)throw new Error(x.reason);});const rep=debateReport(r,s,'gate:assembly',rounds,label);finishRaisingGate(r,q.revision);return {...rep,campaign:q.grade,afterUprising:engineFoundingResult(r).filter(t=>t.includes('조항')||t.includes('불신'))};};
 return {A:run(structuredClone(at),'A · 순욱 빌드(민회)'),B:run(stripBuild(structuredClone(at)),'B · 빌드·순욱 원칙·지원 제거(민회)')};}

// ── 대결 ──
interface DuelExchange {exchange:number;intent:string;plays:string[];after:string}
function runDuel(s:DuelState,policy:'smart'|'greedy',act:(a:string)=>void){const xs:DuelExchange[]=[];let cur:DuelExchange|null=null;
 for(let i=0;i<150&&s.result==='ongoing';i++){if(!cur)cur={exchange:s.round+1,intent:intentLabel(s,s.deck!.intent),plays:[],after:''};const a=deckDuelAction(s,policy);const label=a.startsWith('card:')?DUEL_CARDS[s.deck!.cards.find(c=>c.uid===Number(a.slice(5)))!.id].name:a==='end'?'합 마치기':a;act(a);cur.plays.push(label);
  if(a==='end'||s.result!=='ongoing'){const v=s.v2!,d=s.deck!;cur.after=`${DISTANCE_NAMES[v.distance]}·${v.stance?STANCE_NAMES[v.stance]:'-'} · 체력 ${s.hp}/${s.maxHp} · 상대 ${s.enemyHp}/${s.enemyMaxHp}(방비 ${s.enemyShield??0}) · 기세 ${s.momentum}/${d.oppMomentum} · 빈틈 ${v.opening?'내':''}${d.oppOpening?'상대':''}${!v.opening&&!d.oppOpening?'없음':''} · 지원 ${v.support}`;xs.push(cur);cur=null;}}
 return xs;}
function duelReport(s:DuelState,xs:DuelExchange[]){const ev=evaluateDuel(s),d=s.deck!;return {deck:d.cards.map(c=>DUEL_CARDS[c.id].name),opponent:{archetype:d.archetype,deck:d.oppCards.map(c=>OPP_CARDS[c.id].name)},prepared:d.prepared,exchanges:xs,result:s.result,grade:ev.grade,adjust:ev.adjust,failed:ev.checks[0].items.filter(i=>!i.ok).map(i=>i.text),injury:ev.injury,injuries:d.injuries,excessive:ev.excessive,counters:s.v2!.stats.counters,openingsUsed:s.v2!.stats.openingsUsed,guardBreaks:d.stats.guardBreaks,blind:s.v2!.stats.blindFinishers,maxHit:s.v2!.stats.maxHit,hp:`${s.hp}/${s.maxHp}`,sequences:d.stats.sequences};}
/** 대결 A/B ① 군영 장악(지휘형). A: 전위 빌드. B: 빌드 제거 + 전위 원칙·지원 카드 제외(탐색 전환은 남김). */
export async function duelAB(){
 const {runDianwei}=await import('./card-engine-builds.ts');const at=runDianwei(false).gateState;if(!at)throw new Error('관문 직전 상태 없음');
 const run=(r:RunState,label:string,policy:'smart'|'greedy',strip:boolean)=>{const q=raisingOf(r)!;const res=selectRaisingPlan(r,'barracks',personnelOf(r)!.representative!,q.revision);if(!res.ok)throw new Error(res.reason);const s=q.gate!.duel!;if(strip)stripDuelOfficers(s);
  const xs=runDuel(s,policy,a=>{const r2=actRaisingGate(r,a,q.revision);if(!r2.ok)throw new Error(r2.reason);});const rep=duelReport(s,xs);finishRaisingGate(r,q.revision);return {label,policy,...rep,campaign:q.grade,afterUprising:engineFoundingResult(r).filter(t=>t.includes('군영')||t.includes('병'))};};
 return {A:run(structuredClone(at),'A · 전위 빌드','smart',false),B:run(stripBuild(structuredClone(at),true),'B · 전위 원칙·지원·전술 제거','smart',true),Agreedy:run(structuredClone(at),'A · 전위 빌드(탐욕)','greedy',false),Bgreedy:run(stripBuild(structuredClone(at),true),'B · 제거(탐욕)','greedy',true)};
}
/** 대결 A/B ② 창고 호위 대표(맹공형)와 ③ 전위 뒤뜰 시험(반격형). */
export async function escortYardAB(){const {runDianwei}=await import('./card-engine-builds.ts');const es=runDianwei(true).escortState;if(!es)throw new Error('호위 대표 직전 상태 없음');
 const exploreRun=(r:RunState,label:string,policy:'smart'|'greedy',start:(P:Player)=>void)=>{const P=new Player(r);start(P);const s=P.x.duel!;const xs=runDuel(s,policy,a=>P.act('social:'+a));const rep=duelReport(s,xs);P.act('finish-social');const e=P.e;return {label,policy,...rep,relation:personnelOf(P.r)!.officers.dianwei?.trust??null,carry:e.arguments.filter(a=>a.id.startsWith('duel:')||a.id.startsWith('aud:')).map(a=>a.label)};};
 const escort=(P:Player)=>P.act('engine:resolve:duel');const yard=(P:Player)=>{P.visit('inn');P.act('inn:area:yard');P.act('inn:courtyard');};
 return {escortA:exploreRun(structuredClone(es),'A · 전위 빌드(호위 대표)','smart',escort),escortB:exploreRun(stripBuild(structuredClone(es)),'B · 빌드 제거(호위 대표)','smart',escort),escortGreedy:exploreRun(structuredClone(es),'A · 탐욕(호위 대표)','greedy',escort),
  yardA:exploreRun(structuredClone(es),'A · 전위 빌드(뒤뜰)','smart',yard),yardB:exploreRun(stripBuild(structuredClone(es)),'B · 빌드 제거(뒤뜰)','smart',yard)};}
/** 성문 내응: 설전(완전/부분)×우회로×단서×명분×내부 협력 48조합을 끝까지. 해결한 장애 수별 후속 덱·첫 의도·현안. */
export function insideMatrix(r0:RunState){const rows:{inside:number;clue:number;cause:number;passage:boolean;debate:string;resolved:number;skip:boolean;obstacles:string;oppDeck:string;firstIntent:string;start:string;result:string;grade:string;campaign:string;issues:string[]}[]=[];
 for(const debate of ['success','partial'] as const)for(const passage of [false,true])for(const clue of [0,5])for(const cause of [0,4])for(const inside of [0,2,4]){const r=structuredClone(r0),e=engineOf(r)!;e.stats.produced={inside,clue,support:cause,opinion:0,ledger:3,momentum:inside>=4?6:0};e.legacy=e.legacy.filter(l=>l.id!=='escort:alternate');if(passage)e.legacy.push({id:'escort:alternate',kind:'gate',text:'비밀 우회로'});
  const q=raisingOf(r)!;const res=selectRaisingPlan(r,'inside',personnelOf(r)!.representative!,q.revision);if(!res.ok)throw new Error(res.reason);q.gate!.debate!.result=debate;finishRaisingGate(r,q.revision);const o=insideObstacles(r,debate)!;const resolved=[o.watch,o.commander==='resolved',o.soldiers==='resolved'].filter(Boolean).length;const obstacles=`감시 ${o.watch?'해결':'남음'} · 지휘관 ${({resolved:'해결',weakened:'약화',unresolved:'남음'})[o.commander]} · 병사 ${({resolved:'해결',weakened:'일부',unresolved:'남음'})[o.soldiers]}`;
  if(q.phase!=='duel'){rows.push({inside,clue,cause,passage,debate,resolved,skip:true,obstacles,oppDeck:'-',firstIntent:'-',start:'대결 없음',result:'-',grade:'-',campaign:q.grade??'',issues:engineOf(r)!.legacy.filter(l=>l.id.startsWith('issue:')).map(l=>l.text)});continue;}
  const s=q.gate!.duel!,d=s.deck!;const oppDeck=`${d.archetype}: ${d.oppCards.map(c=>OPP_CARDS[c.id].name).join('·')}`;const firstIntent=intentLabel(s,d.intent);const start=`상대 ${s.enemyHp} · 방비 ${s.enemyShield??0} · 지원 ${s.v2!.support} · ${DISTANCE_NAMES[s.v2!.distance]} · 기세 ${s.momentum}`;
  runDuel(s,'smart',a=>{const r2=actRaisingGate(r,a,q.revision);if(!r2.ok)throw new Error(r2.reason);});const ev=evaluateDuel(s);finishRaisingGate(r,q.revision);
  rows.push({inside,clue,cause,passage,debate,resolved,skip:false,obstacles,oppDeck,firstIntent,start,result:s.result,grade:ev.grade,campaign:q.grade??'',issues:engineOf(r)!.legacy.filter(l=>l.id.startsWith('issue:')).map(l=>l.text)});}
 return rows;}
if(import.meta.main){const debate=debateAB();const assembly=await assemblyAB();const duel=await duelAB();const escortYard=await escortYardAB();const {runLusu}=await import('./card-engine-builds.ts');const lusu=runLusu();const inside=lusu.gateState?insideMatrix(lusu.gateState):[];
 writeFileSync('docs/verification/card-engine-ab.json',JSON.stringify({debate,assembly,duel,escortYard,inside},null,1));
 const brief=(x:{label:string;grade:string;result:string})=>`${x.label}: ${x.result} · ${x.grade}`;
 console.log([brief(debate.A),brief(debate.B),brief(assembly.A),brief(assembly.B),...Object.values(duel).map(d=>`${brief(d)} · ${d.exchanges.length}합 · ${d.hp}`),...Object.values(escortYard).map(d=>`${brief(d)} · ${d.exchanges.length}합 · ${d.hp}`)].join('\n'));
 const by:Record<string,string[]>={};for(const i of inside){const k=`해결 ${i.resolved}`;(by[k]??=[]).push(i.skip?'생략':i.grade);}console.log(JSON.stringify(Object.fromEntries(Object.entries(by).map(([k,v])=>[k,[...new Set(v)]]))));}
