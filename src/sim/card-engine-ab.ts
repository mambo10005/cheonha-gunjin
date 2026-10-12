/**
 * 설전·대결 A/B 완주 비교와 성문 내응 조합표. 같은 저장 상태에서 빌드만 바꿔 끝까지 진행한다.
 * A: 빌드(협력 교체 카드·책략·논거·인재 원칙·전술) 적용 / B: 빌드·지원·책략 제거.
 * 설전은 같은 자동 정책, 대결은 「연쇄 이해 정책」(남은 합 전체 탐색)과 「탐욕 정책」(1수 앞, 하한선) 두 가지로 진행한다.
 * 자동 정책 결과이며 사람의 판단·재미를 대신하지 않는다.
 */
import {writeFileSync} from 'node:fs';
import {freshRun,Player,bestDuel,smartDuel} from './card-engine-play.ts';
import {debateAction} from './card-engine-play.ts';
import {DEBATE_CARDS} from '../data/debate-cards.ts';
import {CLAUSES} from '../data/clauses.ts';
import {DUEL_V2_ACTIONS,DISTANCE_NAMES,STANCE_NAMES,duelIntent} from '../core/duel.ts';
import {evaluateDuel} from '../data/duel-objectives.ts';
import {engineOf,insideObstacles,debateEvaluationPreview,engineFoundingResult} from '../core/card-engine.ts';
import {raisingOf,selectRaisingPlan,actRaisingGate,finishRaisingGate} from '../core/raising.ts';
import {personnelOf} from '../core/personnel-rules.ts';
import {explorationOf} from '../core/city-exploration.ts';
import type {RunState} from '../core/types.ts';
import type {DebateState,DuelState} from '../core/social-types.ts';

const lib=(P:Player,id:string)=>P.p.library.find(l=>l.id===id&&P.p.loadouts.raising.includes(l.uid))!.uid;
/** 빌드 제거: 책략·논거·원칙·전술·관문 기록·연쇄 기록·동행 지원을 지우고 협력 교체 카드를 원래 공통 카드로 되돌린다. */
export function stripBuild(r:RunState,keepParty=false){const e=engineOf(r)!,p=personnelOf(r)!,q=raisingOf(r)!,x=explorationOf(r)!;e.stratagems=[];e.arguments=[];e.principles={};e.loadout={opening:null,response:null,gambit:null};e.legacy=e.legacy.filter(l=>l.id.startsWith('deal:'));e.stats={chains:{},consumed:{},produced:{},distinctOwners:[],burdenUses:0,forceDealt:0,cardsRemoved:0,cardsUpgraded:0,skips:0};
 for(const sw of e.pact?.swaps??[]){const l=p.library.find(l=>l.id===sw.added&&l.sourceType==='officer');if(l){l.id=sw.removed;l.sourceType='protagonist';l.sourceId=p.protagonistId;const c=q.cards.find(c=>c.personnelCard===l.uid);if(c)c.id=sw.removed;}}
 if(!keepParty){x.companions=[];p.party=[];}p.assistant=null;return r;}
function runDebate(s:DebateState,act:(a:string)=>void){const order:string[]=[];for(let i=0;i<200&&s.result==='ongoing';i++){const a=debateAction(s);if(a.startsWith('card:'))order.push(DEBATE_CARDS[s.deck!.cards.find(c=>c.uid===Number(a.slice(5)))!.id]?.name??a);else order.push(a==='end-round'?'/':a==='settle'?'합의 제안':a);act(a);}return order;}

/** 설전 A/B: 순욱 추천서 문서고 퍼즐을 같은 상태로 푼 뒤 서리 설전을 끝까지. */
export function debateAB(){
 const P=new Player(freshRun());P.act('enter');P.act('inn:offer:recommendation');P.act('inn:accept:recommendation');
 for(const [add,rem] of [['x_document','coin'],['x_orthodox','manifesto']])P.act(`engine:pact-swap:${add}:${lib(P,rem)}`);P.act('engine:pact-stratagem:many_hands');P.act('engine:pact-close');P.act('inn:quest:recommendation:public-records');
 P.visit('archive');P.act('scene:inspect:ledger');for(const [f,c] of [['record_gap','x_document'],['clerk_guard','x_orthodox'],['refugee_distrust','recommend']]){P.act('engine:focus:'+f);P.play(c);}
 const snapshot=structuredClone(P.r);
 const run=(r:RunState,label:string)=>{const Q=new Player(r);Q.act('engine:resolve:debate');const s=Q.x.debate!;const start={needs:{...s.negotiation!.needs},trust:s.trust,resolve:s.resolve,args:s.engineArgs};const order=runDebate(s,a=>Q.act('social:'+a));const ev=debateEvaluationPreview(Q.r,s,'inn_documents')!;
  Q.act('finish-social');const legacy=Q.e.legacy.filter(l=>l.id.startsWith('deal:')).map(l=>l.text);
  return {label,start,order,rounds:s.round+1,trust:s.trust,burden:`${s.negotiation!.burden}/${s.negotiation!.burdenLimit}`,arguments:`${ev.ctx.argsPreserved}/${ev.ctx.argsInitial} 보존`,counters:`막음 ${ev.ctx.countersBlocked} · 맞음 ${ev.ctx.countersHit}`,clauses:ev.clauses.map(id=>CLAUSES[id].name),missing:ev.missing.map(m=>`${CLAUSES[m.id].name}: ${m.reason}`),grade:ev.grade,failed:ev.checks.find(c=>c.grade==='탁월한 합의')!.items.filter(i=>!i.ok).map(i=>i.text),afterUprising:legacy};};
 return {A:run(structuredClone(snapshot),'A · 순욱 빌드(문서 정리·정론 제기·공론의 조항)'),B:run(stripBuild(structuredClone(snapshot)),'B · 빌드·책략·원칙 제거(공통 카드 복원)')};
}
interface DuelRound {round:number;action:string;enemy:string;distance:string;stance:string;opening:boolean;momentum:number;protection:number;support:number;dealt:number;taken:number;hp:number;enemyHp:number}
function runDuel(s:DuelState,policy:'smart'|'greedy',act:(a:string)=>void){const rounds:DuelRound[]=[];for(let i=0;i<10&&s.result==='ongoing';i++){const a=policy==='smart'?smartDuel(s):bestDuel(s),enemy=duelIntent(s),hp=s.hp,eh=s.enemyHp;act(a);const v=s.v2!;rounds.push({round:s.round,action:DUEL_V2_ACTIONS[a]?.name??(a==='gambit'?'승부수 전술':a),enemy:({strike:'강공',probe:'견제',guard:'방어',finisher:'승부수'} as Record<string,string>)[enemy],distance:DISTANCE_NAMES[v.distance],stance:v.stance?STANCE_NAMES[v.stance]:'-',opening:v.opening,momentum:s.momentum,protection:s.protection??0,support:v.support,dealt:eh-s.enemyHp,taken:hp-s.hp,hp:s.hp,enemyHp:s.enemyHp});}return rounds;}
function duelReport(s:DuelState,rounds:DuelRound[]){const ev=evaluateDuel(s);return {rounds,result:s.result,grade:ev.grade,failed:ev.checks[0].items.filter(i=>!i.ok).map(i=>i.text),injury:ev.injury,excessive:ev.excessive,maxHit:s.v2!.stats.maxHit,counters:s.v2!.stats.counters,openingsUsed:s.v2!.stats.openingsUsed,blind:s.v2!.stats.blindFinishers,repeats:s.v2!.stats.repeats,hp:`${s.hp}/${s.maxHp}`};}
/** 대결 A/B: 전위 빌드의 군영 장악 직전 상태에서 관문 대결을 끝까지(두 정책). */
export async function duelAB(){
 const {runDianwei}=await import('./card-engine-builds.ts');const at=runDianwei(false).gateState;if(!at)throw new Error('관문 직전 상태 없음');
 const run=(r:RunState,label:string,policy:'smart'|'greedy')=>{const q=raisingOf(r)!;const res=selectRaisingPlan(r,'barracks',personnelOf(r)!.representative!,q.revision);if(!res.ok)throw new Error(res.reason);const s=q.gate!.duel!;const start={enemyHp:s.enemyHp,hp:s.hp,momentum:s.momentum,protection:s.protection??0,support:s.v2!.support,distance:DISTANCE_NAMES[s.v2!.distance],counterBonus:s.counterBonus??0,loadout:s.loadout?[s.loadout.opening,s.loadout.response,s.loadout.gambit]:null};
  const rounds=runDuel(s,policy,a=>{const r2=actRaisingGate(r,a,q.revision);if(!r2.ok)throw new Error(r2.reason);});const rep=duelReport(s,rounds);finishRaisingGate(r,q.revision);return {label,policy,start,...rep,campaign:q.grade,afterUprising:engineFoundingResult(r).filter(t=>t.includes('군영')||t.includes('병')),injuries:q.injuries??{}};};
 return {A:run(structuredClone(at),'A · 전위 빌드','smart'),B:run(stripBuild(structuredClone(at),true),'B · 빌드·지원·책략·전술 제거','smart'),Agreedy:run(structuredClone(at),'A · 전위 빌드(탐욕 정책)','greedy'),Bgreedy:run(stripBuild(structuredClone(at),true),'B · 빌드 제거(탐욕 정책)','greedy')};
}
/** 성문 내응 조합: 내부 협력·단서·명분(지지·공론)·비밀 통로를 바꿔 각 조합의 후속 대결 또는 생략을 끝까지. */
export function insideMatrix(r0:RunState){const rows:{inside:number;clue:number;cause:number;passage:boolean;debate:string;skip:boolean;obstacles:string;start:string;result:string;grade:string;campaign:string;issues:string[]}[]=[];
 for(const debate of ['success','partial'] as const)for(const passage of [false,true])for(const clue of [0,5])for(const cause of [0,4])for(const inside of [0,2,4]){const r=structuredClone(r0),e=engineOf(r)!;e.stats.produced={inside,clue,support:cause,opinion:0,ledger:3,momentum:inside>=4?6:0};e.legacy=e.legacy.filter(l=>l.id!=='escort:alternate');if(passage)e.legacy.push({id:'escort:alternate',kind:'gate',text:'비밀 우회로'});
  const q=raisingOf(r)!;const res=selectRaisingPlan(r,'inside',personnelOf(r)!.representative!,q.revision);if(!res.ok)throw new Error(res.reason);q.gate!.debate!.result=debate;finishRaisingGate(r,q.revision);const o=insideObstacles(r,debate)!;const obstacles=`감시 ${o.watch?'해결':'남음'} · 지휘관 ${({resolved:'해결',weakened:'약화',unresolved:'남음'})[o.commander]} · 병사 ${({resolved:'해결',weakened:'일부',unresolved:'남음'})[o.soldiers]}`;
  if(q.phase!=='duel'){rows.push({inside,clue,cause,passage,debate,skip:true,obstacles,start:'대결 없음',result:'-',grade:'-',campaign:q.grade??'',issues:engineOf(r)!.legacy.filter(l=>l.id.startsWith('issue:')).map(l=>l.text)});continue;}
  const s=q.gate!.duel!;const start=`상대 ${s.enemyHp} · 지원 ${s.v2!.support} · ${DISTANCE_NAMES[s.v2!.distance]} · 기세 ${s.momentum} · 기습 ${s.initiative?'예':'아니오'} · 상대 순서 ${s.pattern.join('/')}`;runDuel(s,'smart',a=>{const r2=actRaisingGate(r,a,q.revision);if(!r2.ok)throw new Error(r2.reason);});const ev=evaluateDuel(s);finishRaisingGate(r,q.revision);
  rows.push({inside,clue,cause,passage,debate,skip:false,obstacles,start,result:s.result,grade:ev.grade,campaign:q.grade??'',issues:engineOf(r)!.legacy.filter(l=>l.id.startsWith('issue:')).map(l=>l.text)});}
 return rows;}
if(import.meta.main){const debate=debateAB();const duel=await duelAB();const {runLusu}=await import('./card-engine-builds.ts');const lusu=runLusu();const inside=lusu.gateState?insideMatrix(lusu.gateState):[];
 writeFileSync('docs/verification/card-engine-ab.json',JSON.stringify({debate,duel,inside},null,1));
 console.log(JSON.stringify({debate:[debate.A,debate.B].map(d=>({l:d.label,order:d.order.join(' '),grade:d.grade,clauses:d.clauses,trust:d.trust,burden:d.burden,args:d.arguments,rounds:d.rounds,after:d.afterUprising,failed:d.failed,missing:d.missing})),duel:[duel.A,duel.B,duel.Agreedy,duel.Bgreedy].map(d=>({l:d.label,start:d.start,acts:d.rounds.map(x=>`${x.action}@${x.distance}/${x.stance}${x.opening?'*':''} ${x.dealt}/${x.taken}`).join(' > '),grade:d.grade,result:d.result,hp:d.hp,failed:d.failed,campaign:d.campaign,after:d.afterUprising})),insideGrades:[...new Set(inside.map(i=>i.skip?'생략':i.grade))],inside:inside.map(i=>`${i.debate} in${i.inside} cl${i.clue} ca${i.cause} ${i.passage?'P':'-'} → ${i.skip?'생략':i.grade}(${i.campaign}) ${i.obstacles}`)},null,1));}
