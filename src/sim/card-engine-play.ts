/**
 * 카드 엔진 플레이 도우미: 실제 명령(exploreAction·prologueAction·raising 관문)만 사용한다.
 * 빌드 검증 스크립트와 테스트가 공유한다. 실패한 명령은 이유와 함께 예외로 멈춘다.
 */
import {CITY_EXPLORATION_DEFS} from '../data/city-exploration.ts';
import {RAISING_CARDS} from '../data/raising.ts';
import {explorationOf,exploreAction,syncExploration} from '../core/city-exploration.ts';
import {startCityExploration} from '../core/city-exploration-start.ts';
import {newWorldCampaign} from '../core/world.ts';
import {personnelOf} from '../core/personnel-rules.ts';
import {raisingOf,selectRaisingPlan,actRaisingGate,finishRaisingGate,foundRaisingFaction} from '../core/raising.ts';
import {prologueAction} from '../core/prologue.ts';
import {engineOf,currentPuzzle} from '../core/card-engine.ts';
import {deckPolicyAction} from './debate-deck-policy.ts';
import {deckPreview,deckActions,deckGrade} from '../core/debate-deck.ts';
import {clauseContext,evaluateDebate} from '../core/debate-grade.ts';
import {fieldSummary} from '../core/debate-field.ts';
import type {DebateState} from '../core/social-types.ts';
import {canDuelAction,previewDuelAction,duelActionList} from '../core/duel.ts';
import {evaluateDuel,DUEL_OBJECTIVES,HOSTILE_POLICY} from '../data/duel-objectives.ts';
import type {RunState} from '../core/types.ts';
import type {DuelState} from '../core/social-types.ts';

export const BUILD_SEED=141001;
export function freshRun(seed=BUILD_SEED,protagonist='chengong',origin:'notable'|'militia'|'official'='notable'):RunState {const r=newWorldCampaign(seed).activeExpedition!;const s=startCityExploration(r,'xingyang',protagonist,origin);if(!s.ok)throw new Error(s.reason);return r;}
export class Player {
 trail:string[]=[];r:RunState;
 constructor(r:RunState){this.r=r;}
 get x(){return explorationOf(this.r)!;}
 get q(){return raisingOf(this.r)!;}
 get p(){return personnelOf(this.r)!;}
 get e(){return engineOf(this.r)!;}
 act(a:string){const res=exploreAction(this.r,a,this.x.revision);if(!res.ok)throw new Error(`${a}: ${res.reason}`);syncExploration(this.r);this.trail.push(a);this.noteCard(a);return this;}
 cardLog:string[]=[];
 noteCard(a:string){if(a.startsWith('card:')){const e=engineOf(this.r);this.cardLog.push(`[${this.x.location}·${this.x.tick}시] ${e?.log.at(-1)??a}`);}}
 try(a:string){const res=exploreAction(this.r,a,this.x.revision);if(res.ok){syncExploration(this.r);this.trail.push(a);this.noteCard(a);}return res;}
 officer(a:string){const res=prologueAction(this.r,a,this.p.revision);if(!res.ok)throw new Error(`officer ${a}: ${res.reason}`);this.trail.push('officer:'+a);return this;}
 visit(to:string){if(this.x.scene!=='map')this.act('leave');if(this.x.location!==to){const d=CITY_EXPLORATION_DEFS[this.x.cityId],queue=[[this.x.location]],seen=new Set<string>();let route:string[]=[];while(queue.length){const path=queue.shift()!,at=path.at(-1)!;if(at===to){route=path;break;}if(seen.has(at))continue;seen.add(at);for(const edge of d.links){const n=edge.a===at?edge.b:edge.b===at?edge.a:null;if(n&&!seen.has(n))queue.push([...path,n]);}}if(!route.length)throw new Error('no route '+to);for(const id of route.slice(1))this.act('move:'+id);}this.act('enter');return this;}
 /** 손패에서 카드 id로 사용. 없으면 false. */
 play(id:string){const c=this.q.cards.find(c=>c.id===id&&this.q.hand.includes(c.uid));if(!c)return false;this.act('card:'+c.uid);return true;}
 hand(){return this.q.hand.map(uid=>this.q.cards.find(c=>c.uid===uid)!.id);}
 /** 원하는 순서대로 손패에 있는 카드를 가능한 만큼 사용한다. */
 playAll(order:string[]){const used:string[]=[];for(const id of order){const c=this.q.cards.find(c=>c.id===id&&this.q.hand.includes(c.uid));if(!c)continue;const res=this.try('card:'+c.uid);if(res.ok)used.push(id);}return used;}
 puzzle(){return currentPuzzle(this.r);}
 cardName(id:string){return RAISING_CARDS[id]?.name??id;}
 debate(style:'stable'|'chain'='stable',gate=false){for(let i=0;i<200;i++){const s=gate?this.q.gate?.debate:this.x.debate;if(!s||s.result!=='ongoing')break;const a=debateAction(s,style);if(gate){const res=actRaisingGate(this.r,a,this.q.revision);if(!res.ok)throw new Error('gate debate '+res.reason);}else this.act('social:'+a);}return (gate?this.q.gate!.debate!:this.x.debate!).result;}
 duelPolicy:DuelPolicy='objective';
 duel(gate=false){for(let i=0;i<120;i++){const s=gate?this.q.gate?.duel:this.x.duel;if(!s||s.result!=='ongoing')break;const a=this.duelPolicy==='greedy'?bestDuel(s):s.deck?deckDuelAction(s,this.duelPolicy):smartDuel(s);if(gate){const res=actRaisingGate(this.r,a,this.q.revision);if(!res.ok)throw new Error('gate duel '+res.reason);}else this.act('social:'+a);}return (gate?this.q.gate!.duel!:this.x.duel!).result;}
 plan(plan:string){const res=selectRaisingPlan(this.r,plan,this.p.representative!,this.q.revision);if(!res.ok)throw new Error('plan '+res.reason);this.trail.push('plan:'+plan);return this;}
 finishGate(){const res=finishRaisingGate(this.r,this.q.revision);if(!res.ok)throw new Error('finish '+res.reason);return this;}
 found(){const w=this.r.campaign!.world!;const res=foundRaisingFaction(this.r,w.factionName,w.flagColor,this.q.revision);if(!res.ok)throw new Error('found '+res.reason);return this;}
}
/** 대결 덱 정책. smart: 이번 합에 쓸 카드 순서를 모두 펼쳐 상대 의도 실행 뒤 상태로 평가(연쇄 인식). greedy: 즉시 피해가 가장 큰 카드만(하한). */
/** 대결 덱 가치. objective: 사건 목표(DuelObjectiveDefinition.policy)를 반영 / deep: 체력·승리만(순수 탐색) / 둘 다 같은 두 합 탐색을 쓴다. */
export type DuelPolicy='objective'|'deep'|'greedy'|'smart';
export function deckDuelValue(s:DuelState,mode:'objective'|'deep'='objective'):number{const v=s.v2!,d=s.deck!;const def=DUEL_OBJECTIVES[v.objective];const w=mode==='objective'&&def?def.policy:HOSTILE_POLICY;
 const ev=s.result!=='ongoing'?evaluateDuel(s):null;
 if(s.result==='win'||s.result==='draw'){const r=ev!.rank;return (s.result==='win'?300*w.win:80*w.win)+r*260*w.rank-v.stats.rounds*6*w.rounds-(s.maxHp-s.hp)*2*w.hp-(ev!.injury.player==='major'?40:ev!.injury.player==='minor'?12:0)*w.injury;}
 if(s.result==='lose'||s.result==='surrender')return -1000;
 const technique=(v.stats.counters>=1||v.stats.openingsUsed>=1?18:0)+(d.stats.readResponses??0)*4;
 const reckless=((v.stats.forceHit??0)>=18||(v.stats.forceOverkill??0)>=8?120:0)+v.stats.blindFinishers*25+(d.stats.ignoredIntents??0)*35+Math.max(0,(d.stats.repeatAttacks??0)-1)*15+(d.stats.gambitExchange!==undefined&&d.stats.gambitExchange<=2&&def?.id==='practice'?60:0);
 // 목표 진척: 지금 이긴다고 가정했을 때 최상 등급 조건(승리 제외)을 얼마나 채웠는지. 남은 합이 있고 체력이 넉넉할 때만 잠재 가치로 본다.
 // 등급마다 (지금 이긴다면) 조건 충족 비율 × 그 등급의 가치 중 최댓값을 잠재 가치로 본다 — 실수로 최상 등급이 막혀도 다음 등급을 노린다
 let potential=0;if(mode==='objective'&&def){const sim=structuredClone(s);sim.result='win';const left=s.maxRounds-s.round;const hpScale=s.hp<=s.maxHp*.25?0.2:s.hp<=s.maxHp*.5?0.6:1;if(left>=1)for(const c of evaluateDuel(sim).checks){if(c.rank<=0)continue;const items=c.items.filter(i=>!i.text.startsWith('승리')&&!i.text.includes('기권'));const frac=items.length?items.filter(i=>i.ok).length/items.length:1;potential=Math.max(potential,(300*w.win+c.rank*260*w.rank)*frac*.75*hpScale*Math.min(1,left/2));}}
 // 합이 얼마 남지 않으면 판정으로 끝나므로 상대 체력을 깎는 쪽이 중요해진다(연습 시험 제외)
 const closing=def?.id!=='practice'&&s.maxRounds-s.round<=2?1.8:1;
 return potential+(s.enemyMaxHp-s.enemyHp)*2.2*w.enemy*closing-(s.maxHp-s.hp)*2.6*w.hp+(v.opening?9:0)*w.technique+(d.oppOpening?9:0)*w.technique+s.momentum*1.5-d.oppMomentum*1.5+(s.protection??0)*.4*w.hp-v.support*7*w.support-reckless*w.restraint-d.injuries.length*10*w.injury+technique*w.technique-(s.enemyShield??0)*.6-v.stats.rounds*4*w.rounds;}
/** 이번 합 카드 순서(최대 4장)를 펼쳐 끝 상태들을 모은다. */
export function exchangeEnds(s:DuelState):{first:string;state:DuelState}[]{const out:{first:string;state:DuelState}[]=[];const playable=(st:DuelState)=>[...st.deck!.hand,...st.deck!.tacticHand].map(u=>'card:'+u).filter(a=>canDuelAction(st,a,st.round).ok);
 const dfs=(st:DuelState,first:string,depth:number)=>{if(st.result!=='ongoing'){out.push({first,state:st});return;}out.push({first:first||'end',state:previewDuelAction(st,'end').state});if(depth>=4)return;for(const a of playable(st))dfs(previewDuelAction(st,a).state,first||a,depth+1);};
 dfs(s,'',0);return out;}
export function deckDuelAction(s:DuelState,policy:DuelPolicy='objective'):string{const mode=policy==='deep'?'deep':'objective';
 if(policy==='greedy'){let best='end',bv=0;for(const a of [...s.deck!.hand,...s.deck!.tacticHand].map(u=>'card:'+u).filter(a=>canDuelAction(s,a,s.round).ok)){const n=previewDuelAction(s,a).state;const dmg=s.enemyHp-n.enemyHp;if(dmg>bv){bv=dmg;best=a;}}return best;}
 // 두 합 앞까지 본다: 이번 합 끝 상태 상위 6개에서 다음 합의 최선을 더한다
 const ends=exchangeEnds(s).map(e=>({...e,v:deckDuelValue(e.state,mode)})).sort((a,b)=>b.v-a.v);let best={a:ends[0]?.first??'end',v:-Infinity};
 const ongoing=ends.filter(e=>e.state.result==='ongoing').slice(0,16);const done=ends.filter(e=>e.state.result!=='ongoing');
 for(const e of [...done,...ongoing]){let v=e.v;if(e.state.result==='ongoing'){const next=exchangeEnds(e.state).map(n=>deckDuelValue(n.state,mode));v=Math.max(v*0.5,...next);}if(v>best.v)best={a:e.first,v};}
 return best.a;}
export function bestDuel(s:DuelState){if(s.deck)return deckDuelAction(s,'greedy');const options=duelActionList(s).filter(a=>a!=='surrender'&&canDuelAction(s,a,s.round).ok);return options.map(a=>{const n=previewDuelAction(s,a).state;return {a,v:n.result==='win'?1000:n.result==='lose'?-1000:n.hp/n.maxHp-n.enemyHp/n.enemyMaxHp+n.momentum*.03};}).sort((a,b)=>b.v-a.v)[0]?.a??'guard';}
/** 연쇄를 이해하는 대결 정책: 상대 순서가 정해져 있으므로 남은 합을 끝까지 탐색해 목표 등급·남은 체력이 가장 좋은 행동을 고른다. */
export function smartDuel(s:DuelState){if(s.deck)return deckDuelAction(s,'smart');let best={a:'guard',v:-Infinity};for(const a of duelActionList(s).filter(a=>a!=='surrender'&&canDuelAction(s,a,s.round).ok)){const v=searchDuel(previewDuelAction(s,a).state,3);if(v>best.v)best={a,v};}return best.a;}
function scoreDuel(s:DuelState){if(!s.v2)return s.result==='win'?1000+s.hp:s.result==='lose'?-1000:s.hp-s.enemyHp;const ev=evaluateDuel(s);return (s.result==='lose'||s.result==='surrender'?-1000:ev.rank*1000)+s.hp*5-s.v2.stats.rounds;}
function searchDuel(s:DuelState,depth:number):number{if(s.result!=='ongoing'||depth<=0)return s.result==='ongoing'?scoreDuel(s)-500+(s.enemyMaxHp-s.enemyHp)*3:scoreDuel(s);let best=-Infinity;for(const a of duelActionList(s).filter(a=>a!=='surrender'&&canDuelAction(s,a,s.round).ok)){const v=searchDuel(previewDuelAction(s,a).state,depth-1);if(v>best)best=v;}return best;}
/** 설전 정책: 기존 자동 정책에, 조항·부담을 신경 쓰는 플레이어 판단을 더한다.
 * 1) 지금 합의가 완전 합의이고 부담 1 이하면 바로 제안  2) 부담이 있으면 「조항 정리」로 먼저 줄임
 * 3) 신뢰가 이미 충분하면 부담을 더하는 카드(비용 떠안기·불리함을 받다·위임 약정)는 쓰지 않음 */
const BURDEN_CARDS=['yield','c_accept','authority'];
/** 논박진 평가: 지금 최종 제안했을 때의 등급·조항 + 전장 상태(살아 있는 내 논거, 남은 위험 논거, 청중). 자동 정책용. */
const GRADE_RANK:Record<string,number>={'결렬':0,'조건부 합의':1,'일반 합의':2,'유리한 합의':3,'탁월한 합의':4};
export function fieldValue(s:DebateState):number{const f=s.field!,n=s.negotiation!;const st=structuredClone(s);if(st.result==='ongoing')st.result=deckGrade(st);const ev=evaluateDebate(st,clauseContext(st,f.context,{argsInitial:0}));const fs=fieldSummary(f);
 const need=Object.entries(n.needs).reduce((v,[k,x])=>v+Math.min(n.scores[k as 'profit'],x!)-x!,0);
 return GRADE_RANK[ev.grade]*30+ev.clauses.filter(c=>!['ration_levy','authority_grant'].includes(c)).length*6+need*7+Math.min(s.trust,n.trustNeeded+1)*4-Math.max(0,n.burden-1)*4+f.player.reduce((v,a)=>v+a.durability+a.protection*.6,0)*1.2+(fs.coreAlive?(f.playerCore.durability+f.playerCore.protection*.7)*2.5:-80)-f.opponent.reduce((v,a)=>v+a.durability,0)*1.5-fs.dangerAlive.length*4-fs.audienceDoubt*5+f.stats.exposed*3-f.impatience*.5-f.locked.length*3;}
/** 각 후보 행동을 실제 처리 함수로 복제 실행하고, 라운드 종료(상대 의도)까지 본 뒤 가장 좋은 행동을 고른다. */
export function fieldDebateAction(s:DebateState):string{const d=s.deck!;
 const settle=structuredClone(s);settle.result=deckGrade(settle);const evS=evaluateDebate(settle,clauseContext(settle,s.field!.context,{}));
 const settleRank=(st:DebateState)=>{const c=structuredClone(st);c.result=deckGrade(c);return c.result==='success'||c.result==='partial'?GRADE_RANK[evaluateDebate(c,clauseContext(c,st.field!.context,{})).grade]:0;};
 if(settle.result==='success'&&(evS.grade==='탁월한 합의'||s.round>=s.maxRounds-2&&GRADE_RANK[evS.grade]>=2)){
  // 마지막 라운드 전: 카드 1~2장으로 최종 제안 등급이 오르면 그 순서를 먼저 쓴다(겨눔 포함)
  const base=GRADE_RANK[evS.grade];let pick:string|null=null,best=base;const acts=(st:DebateState)=>deckActions(st).filter(a=>a!=='end-round'&&a!=='settle'&&a!=='advice');
  for(const a of acts(s)){const p1=deckPreview(s,a);if(!p1.check.ok)continue;const r1=settleRank(p1.state);if(r1>best){best=r1;pick=a;}for(const b of acts(p1.state)){const p2=deckPreview(p1.state,b);if(!p2.check.ok)continue;const r2=settleRank(p2.state);if(r2>best){best=r2;pick=a;}}}
  return pick??'settle';}
 const after=(st:DebateState)=>{if(st.result!=='ongoing')return st;const e=structuredClone(st);deckPreviewInto(e,'end-round');return e;};
 let best='end-round',bestV=fieldValue(after(s))-0.5;
 for(const a of deckActions(s)){if(a==='end-round'||a==='settle'||a==='advice')continue;const pv=deckPreview(s,a);if(!pv.check.ok)continue;if(a.startsWith('target:')){continue;}const v=fieldValue(after(pv.state))+(pv.state.resolve>0?.3:0);if(v>bestV+0.01){bestV=v;best=a;}}
 // 겨눔: 공격 카드를 쓸 때 위험 논거부터
 if(best.startsWith('card:')&&s.field){const t=deckActions(s).filter(a=>a.startsWith('target:'));let tb='',tv=bestV;for(const ta of t){const st=structuredClone(s);deckPreviewInto(st,ta);const pv=deckPreview(st,best);if(!pv.check.ok)continue;const v=fieldValue(after(pv.state));if(v>tv+0.5){tv=v;tb=ta;}}if(tb)return tb;}
 if(best==='end-round'&&settle.result==='success'&&s.round>=s.maxRounds-1)return 'settle';void d;return best;}
function deckPreviewInto(st:DebateState,a:string){const pv=deckPreview(st,a);Object.assign(st,pv.state);}
export function debateAction(s:DebateState,style:'stable'|'chain'='stable'){if(s.field)return fieldDebateAction(s);const d=s.deck!,n=s.negotiation!;const card=(uid:number)=>d.cards.find(c=>c.uid===uid)!.id;
 const pv=deckPreview(s,'settle');const settleOk=pv.check.ok&&pv.state.result==='success';
 if(n.burden>0){const r=d.hand.find(uid=>card(uid)==='redress'&&deckPreview(s,'card:'+uid).check.ok);if(r!==undefined)return 'card:'+r;}
 if(settleOk)return 'settle';
 if(s.trust>=n.trustNeeded&&d.hand.some(uid=>BURDEN_CARDS.includes(card(uid)))){const c=structuredClone(s);c.deck!.hand=c.deck!.hand.filter(uid=>!BURDEN_CARDS.includes(card(uid)));const a=deckPolicyAction(c,style);if(!a.startsWith('card:')||d.hand.includes(Number(a.slice(5))))return a;}
 return deckPolicyAction(s,style);}
