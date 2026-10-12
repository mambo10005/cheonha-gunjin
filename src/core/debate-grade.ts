/**
 * 설전 결과 등급: 숨은 점수 대신 등급별 필수 조건을 명시하고, 충족 여부를 그대로 보여 준다.
 * 조항은 설전 끝 상태로 정해지고 즉시 효과·거병 후 정책·의무·집단 관계·시설·인재·후속 사건으로 남는다.
 */
import {CLAUSES,SPECIAL_OBJECTIVES,type ClauseContext,type DebateGrade} from '../data/clauses.ts';
import type {DebateState} from './social-types.ts';
export interface DebateCheck {text:string;ok:boolean}
export interface DebateEvaluation {context:string;base:string;grade:DebateGrade;checks:{grade:DebateGrade;items:DebateCheck[]}[];clauses:string[];missing:{id:string;reason:string}[];conflicts:string[];pressure:boolean;rounds:number;ctx:ClauseContext}
export function clauseContext(s:DebateState,context:string,extra:Partial<ClauseContext>):ClauseContext {
 const n=s.negotiation!,d=s.deck;const hit=d?.stats.countersHit??0;const initial=extra.argsInitial??0;
 return {context,result:s.result,scores:{...n.scores},needs:{...n.needs} as Record<string,number>,trust:s.trust,trustNeeded:n.trustNeeded,burden:n.burden,burdenLimit:n.burdenLimit,rounds:s.round,maxRounds:s.maxRounds,plays:{...(d?.stats.plays??{})},promises:[...(d?.promises??[])],argsInitial:initial,argsPreserved:Math.max(0,initial-hit),recordArgs:Math.max(0,(extra.recordArgs??0)-Math.max(0,hit-(initial-(extra.recordArgs??0)))),countersBlocked:d?.stats.countersBlocked??0,countersHit:hit,opinion:0,privateInterest:0,pledges:0,promiseMarks:0,talents:0,profile:'standard',...extra};
}
export function evaluateDebate(s:DebateState,ctx:ClauseContext):DebateEvaluation {
 const got:string[]=[],missing:{id:string;reason:string}[]=[];
 for(const c of Object.values(CLAUSES)){if(!c.contexts.includes(ctx.context)&&!(c.tier==='cost'))continue;const why=c.requires(ctx);if(why===null)got.push(c.id);else if(c.tier!=='cost')missing.push({id:c.id,reason:why});}
 const conflicts:string[]=[];for(const id of [...got]){const c=CLAUSES[id];for(const other of c.conflicts)if(got.includes(other)&&CLAUSES[other].tier!=='cost'&&c.tier==='cost'){got.splice(got.indexOf(other),1);conflicts.push(`${c.name} 때문에 ${CLAUSES[other].name} 불성립`);}}
 const nonCost=got.filter(id=>CLAUSES[id].tier!=='cost'),advanced=got.filter(id=>CLAUSES[id].tier==='advanced'),cost=got.filter(id=>CLAUSES[id].tier==='cost');
 const special=SPECIAL_OBJECTIVES[ctx.context]??{text:`라운드 ${Math.max(1,ctx.maxRounds-2)} 안에 합의`,check:(c:ClauseContext)=>c.rounds<=Math.max(1,c.maxRounds-2)};
 const favorable:DebateCheck[]=[{text:'기본 목표 완전 달성',ok:ctx.result==='success'},{text:`비용 아닌 조항 1개 이상 (${nonCost.length})`,ok:nonCost.length>=1},{text:`최종 신뢰 ${ctx.trustNeeded+1} 이상 (${ctx.trust})`,ok:ctx.trust>=ctx.trustNeeded+1},{text:`최종 부담 1 이하 (${ctx.burden})`,ok:ctx.burden<=1}];
 const excellent:DebateCheck[]=[...favorable,{text:`고급 조항 1개 이상 (${advanced.length})`,ok:advanced.length>=1},{text:`플레이어 논거 2개 이상 보존 (${ctx.argsPreserved}/${ctx.argsInitial})`,ok:ctx.argsPreserved>=2},{text:`비용 조항 없음 (${cost.length})`,ok:cost.length===0},{text:`라운드 ${ctx.maxRounds-1} 이하 (${ctx.rounds+1})`,ok:ctx.rounds+1<=ctx.maxRounds-1},{text:'특별 목표 · '+special.text,ok:special.check(ctx,got)}];
 const checks:{grade:DebateGrade;items:DebateCheck[]}[]=[{grade:'탁월한 합의',items:excellent},{grade:'유리한 합의',items:favorable},{grade:'일반 합의',items:[{text:'기본 목표 완전 달성',ok:ctx.result==='success'}]},{grade:'조건부 합의',items:[{text:'첫 요구와 신뢰 2 달성(부분 합의)',ok:ctx.result!=='failure'}]}];
 const grade=(checks.find(c=>c.items.every(i=>i.ok))?.grade??'결렬') as DebateGrade;
 const pressure=(ctx.plays.challenge??0)>=2||ctx.rounds<=0&&ctx.result==='success'&&(ctx.plays.challenge??0)>=1;
 return {context:ctx.context,base:ctx.result,grade,checks,clauses:got,missing,conflicts,pressure,rounds:ctx.rounds+1,ctx};
}
