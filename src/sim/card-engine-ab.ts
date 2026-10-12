/**
 * 설전·대결 A/B 완주 비교와 성문 내응 단계 전환표. 같은 저장 상태에서 빌드만 바꿔 끝까지 진행한다.
 * A: 빌드(협력 교체 카드·책략·논거·인재 원칙·전술) 적용 / B: 빌드·지원·책략 제거.
 * 설전·대결의 개별 수는 같은 자동 정책(미리보기 기반)으로 고른다. 사람의 판단이 아니다.
 */
import {writeFileSync} from 'node:fs';
import {freshRun,Player,bestDuel} from './card-engine-play.ts';
import {deckPolicyAction} from './debate-deck-policy.ts';
import {DEBATE_CARDS} from '../data/debate-cards.ts';
import {MARK_NAMES} from '../data/card-grammar.ts';
import {duelIntent} from '../core/duel.ts';
import {engineOf,insideConversions} from '../core/card-engine.ts';
import {raisingOf,selectRaisingPlan,actRaisingGate,finishRaisingGate} from '../core/raising.ts';
import {personnelOf} from '../core/personnel-rules.ts';
import {explorationOf} from '../core/city-exploration.ts';
import type {RunState} from '../core/types.ts';
import type {DebateState,DuelState} from '../core/social-types.ts';
import type {Mark} from '../core/card-engine-types.ts';

const lib=(P:Player,id:string)=>P.p.library.find(l=>l.id===id&&P.p.loadouts.raising.includes(l.uid))!.uid;
/** 빌드 제거: 책략·논거·원칙·전술·관문 기록·동행 지원을 지우고 협력 교체 카드를 원래 공통 카드로 되돌린다. */
export function stripBuild(r:RunState,keepParty=false){const e=engineOf(r)!,p=personnelOf(r)!,q=raisingOf(r)!,x=explorationOf(r)!;e.stratagems=[];e.arguments=[];e.principles={};e.loadout={opening:null,response:null,gambit:null};e.legacy=[];e.stats={chains:{},consumed:{},produced:{},distinctOwners:[],burdenUses:0,forceDealt:0,cardsRemoved:0,cardsUpgraded:0,skips:0};
 for(const sw of e.pact?.swaps??[]){const l=p.library.find(l=>l.id===sw.added&&l.sourceType==='officer');if(l){l.id=sw.removed;l.sourceType='protagonist';l.sourceId=p.protagonistId;const c=q.cards.find(c=>c.personnelCard===l.uid);if(c)c.id=sw.removed;}}
 if(!keepParty){x.companions=[];p.party=[];}p.assistant=null;return r;}
interface DebateStep {round:number;action:string;card:string;resolve:number;trust:number;burden:number;scores:string}
function runDebate(s:DebateState,act:(a:string)=>void){const steps:DebateStep[]=[];for(let i=0;i<200&&s.result==='ongoing';i++){const a=deckPolicyAction(s,'stable');const card=a.startsWith('card:')?s.deck!.cards.find(c=>c.uid===Number(a.slice(5)))?.id??a:a;act(a);const n=s.negotiation!;steps.push({round:s.round,action:a.split(':')[0],card:DEBATE_CARDS[card]?.name??card,resolve:s.resolve,trust:s.trust,burden:n.burden,scores:Object.entries(n.scores).filter(([,v])=>v).map(([k,v])=>`${({profit:'이익',safety:'안전',honor:'명예',authority:'권한'} as Record<string,string>)[k]}${v}`).join(' ')});}return steps;}
function debateSummary(r:RunState,s:DebateState,steps:DebateStep[]){const e=engineOf(r)!;return {deck:s.deck!.cards.map(c=>DEBATE_CARDS[c.id]?.name??c.id),order:steps.filter(v=>v.action==='card').map(v=>v.card),steps,marksProduced:Object.entries(e.stats.produced).map(([m,n])=>`${MARK_NAMES[m as Mark]} ${n}`),marksConsumed:Object.entries(e.stats.consumed).map(([m,n])=>`${MARK_NAMES[m as Mark]} ${n}`),arguments:e.arguments.map(a=>a.label),startLog:s.log.filter(t=>t.startsWith('지속 논거')||t.startsWith('조항')||t.startsWith('민회')),counters:s.deck!.counters,counterLog:s.log.filter(t=>t.includes('반론')).slice(-8),finalResolve:s.resolve,finalTrust:s.trust,burden:`${s.negotiation!.burden}/${s.negotiation!.burdenLimit}`,needs:s.negotiation!.needs,scores:s.negotiation!.scores,clauses:s.deck!.promises,result:s.result};}

/** 설전 A/B: 순욱 추천서 문서고 퍼즐을 같은 상태로 푼 뒤, 서리 설전을 끝까지. */
export function debateAB(){
 const P=new Player(freshRun());P.act('enter');P.act('inn:offer:recommendation');P.act('inn:accept:recommendation');
 for(const [add,rem] of [['x_document','coin'],['x_orthodox','manifesto']])P.act(`engine:pact-swap:${add}:${lib(P,rem)}`);P.act('engine:pact-stratagem:many_hands');P.act('engine:pact-close');P.act('inn:quest:recommendation:public-records');
 P.visit('archive');P.act('scene:inspect:ledger');for(const [f,c] of [['record_gap','x_document'],['clerk_guard','x_orthodox'],['refugee_distrust','recommend']]){P.act('engine:focus:'+f);P.play(c);}
 const snapshot=structuredClone(P.r);
 const run=(r:RunState,label:string)=>{const Q=new Player(r);Q.act('engine:resolve:debate');const s=Q.x.debate!;const start={needs:{...s.negotiation!.needs},trust:s.trust,resolve:s.resolve,burdenLimit:s.negotiation!.burdenLimit};const steps=runDebate(s,a=>Q.act('social:'+a));return {label,start,...debateSummary(Q.r,s,steps)};};
 return {A:run(structuredClone(snapshot),'A · 순욱 빌드(문서 정리·정론 제기·공론의 조항)'),B:run(stripBuild(structuredClone(snapshot)),'B · 빌드·책략·원칙 제거(공통 카드 복원)')};
}
interface DuelRound {round:number;action:string;enemy:string;hp:number;enemyHp:number;dealt:number;taken:number;momentum:number;protection:number;enemyShield:number;repeat:boolean;note:string}
function runDuel(s:DuelState,act:(a:string)=>void){const rounds:DuelRound[]=[];for(let i=0;i<10&&s.result==='ongoing';i++){const a=bestDuel(s),enemy=duelIntent(s),hp=s.hp,eh=s.enemyHp,logLen=s.log.length;act(a);const log=s.log.slice(logLen);rounds.push({round:s.round,action:a,enemy,hp:s.hp,enemyHp:s.enemyHp,dealt:eh-s.enemyHp,taken:hp-s.hp,momentum:s.momentum,protection:s.protection??0,enemyShield:s.enemyShield??0,repeat:log.some(t=>t.includes('연속')),note:log.filter(t=>!/^\d+회:/.test(t)).join(' / ')});}return rounds;}
/** 대결 A/B: 전위 빌드가 군영 장악 계획을 고르는 같은 시점에서 관문 대결을 끝까지. */
export async function duelAB(){
 const {runDianwei}=await import('./card-engine-builds.ts');const at=runDianwei(false).gateState;if(!at)throw new Error('관문 직전 상태 없음');
 const run=(r:RunState,label:string)=>{const q=raisingOf(r)!;const res=selectRaisingPlan(r,'barracks',personnelOf(r)!.representative!,q.revision);if(!res.ok)throw new Error(res.reason);const s=q.gate!.duel!;const start={enemyHp:s.enemyHp,hp:s.hp,momentum:s.momentum,protection:s.protection??0,counterBonus:s.counterBonus??0,loadout:s.loadout?[s.loadout.opening,s.loadout.response,s.loadout.gambit]:null,tactics:s.tactics,startLog:s.log.slice(-3)};const rounds=runDuel(s,a=>{const r2=actRaisingGate(r,a,q.revision);if(!r2.ok)throw new Error(r2.reason);});const result=s.result;finishRaisingGate(r,q.revision);const legacy=engineOf(r)?.legacy.filter(l=>l.id.startsWith('gate:')).map(l=>l.text)??[];return {label,start,rounds,actions:rounds.map(v=>v.action),result,hp:`${s.hp}/${s.maxHp}`,injuries:q.injuries??{},repeats:rounds.filter(v=>v.repeat).length,grade:legacy,distance:'현재 대결 모델에 거리·자세 개념 없음'};};
 return {A:run(structuredClone(at),'A · 전위 빌드(방비·반격 연쇄·선제 돌격/반격 태세/결사 일격·책략)'),B:run(stripBuild(structuredClone(at),true),'B · 빌드·지원·책략·전술 제거(전위 본인은 출전)')};
}
export function insideGradient(r0:RunState){const out:{grade:string;marks:string;conversions:string[];skip:boolean;start:string;result:string;rounds:string[]}[]=[];
 for(const marks of ['actual','none'] as const)for(const grade of ['success','partial','failure'] as const){const r=structuredClone(r0),e=engineOf(r)!;if(marks==='none'){e.stats.produced={};e.stats.chains={};e.legacy=e.legacy.filter(l=>!l.id.startsWith('escort:'));}
  const q=raisingOf(r)!;const res=selectRaisingPlan(r,'inside',personnelOf(r)!.representative!,q.revision);if(!res.ok)throw new Error(res.reason);q.gate!.debate!.result=grade;finishRaisingGate(r,q.revision);const conv=insideConversions(r,grade).map(c=>c.text);
  if(q.phase!=='duel'){out.push({grade,marks,conversions:conv,skip:true,start:'대결 없음',result:q.grade??'',rounds:[]});continue;}
  const s=q.gate!.duel!;const start=`상대 체력 ${s.enemyHp}·기세 ${s.momentum}·방비 ${s.protection??0}·적 방비 ${s.enemyShield??0}·지원 제거 ${!!s.noSupport}·기습 ${!!s.initiative}`;const rounds=runDuel(s,a=>{const r2=actRaisingGate(r,a,q.revision);if(!r2.ok)throw new Error(r2.reason);});out.push({grade,marks,conversions:conv,skip:false,start,result:s.result,rounds:rounds.map(v=>`${v.round}합 ${v.action} vs ${v.enemy} · 피해 ${v.dealt}/${v.taken}`)});}
 return out;}
if(import.meta.main){const debate=debateAB();const duel=await duelAB();const {runLusu}=await import('./card-engine-builds.ts');const lusu=runLusu();const inside=lusu.gateState?insideGradient(lusu.gateState):[];
 writeFileSync('docs/verification/card-engine-ab.json',JSON.stringify({debate,duel,inside},null,1));
 console.log(JSON.stringify({debateA:[debate.A.start,debate.A.order,debate.A.result,debate.A.clauses],debateB:[debate.B.start,debate.B.order,debate.B.result,debate.B.clauses],duelA:[duel.A.start,duel.A.actions,duel.A.result,duel.A.hp,duel.A.grade],duelB:[duel.B.start,duel.B.actions,duel.B.result,duel.B.hp,duel.B.grade],inside:inside.map(v=>[v.marks,v.grade,v.skip,v.start,v.result])},null,1));}
