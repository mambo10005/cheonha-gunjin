import {writeFileSync} from 'node:fs';
import {isDeepStrictEqual} from 'node:util';
import {CITY_EXPLORATION_POLICIES,playCityExploration,type CityExplorationPolicy} from './city-exploration-policy.ts';
import {explorationOf} from '../core/city-exploration.ts';
import {personnelOf,isRecruited} from '../core/personnel-rules.ts';
import {raisingOf} from '../core/raising.ts';
import {CITY_EXPLORATION_DEFS} from '../data/city-exploration.ts';
import {OFFICERS} from '../data/personnel.ts';
const sum=(entries:Record<string,number>[])=>{const out:Record<string,number>={};for(const entry of entries)for(const [k,v] of Object.entries(entry))out[k]=(out[k]??0)+v;return out;};
function measure(seed:number,policy:CityExplorationPolicy){
 const result=playCityExploration(seed,policy),r=result.r,p=personnelOf(r)!,q=raisingOf(r)!,x=explorationOf(r)!;
 return {seed,policy,success:result.success,grade:q.grade,steps:result.steps,restores:result.restores,errors:result.errors,post:result.post,
  locations:x.stats.visits,encounters:x.stats.encounters,approaches:x.stats.approaches,cardUses:x.stats.cards,itemUses:x.stats.items,withdrawals:x.stats.withdrawals,failures:x.stats.failures,debates:x.stats.debates,duels:x.stats.duels,protagonistGrowth:x.stats.growth,plans:x.stats.plans,dispatches:x.stats.dispatches,
  exposure:r.campaign!.world!.preparation.exposure,time:x.tick,personalEpisodes:x.flags.filter(flag=>flag.startsWith('personal:')),secured:Object.entries(x.locations).filter(([,l])=>l.secured).map(([id])=>id),library:p.library.map(c=>({id:c.id,source:c.sourceType,owner:c.owners})),deck:q.cards.length,cardEquips:p.stats.equips,officerCardUses:p.stats.officerPlays??{},officerGrowth:p.stats.growth,
  officers:Object.values(p.officers).map(o=>({id:o.id,encountered:o.information>=2,recruited:isRecruited(o),relationship:o.relationship,task:o.task,cooperation:o.cooperation,proof:o.proof,growth:o.growth,trust:o.trust,loyalty:o.loyalty})),decisions:result.decisions};
}
const runs:ReturnType<typeof measure>[]=[];
for(let seed=141001;seed<=141006;seed++)for(const policy of CITY_EXPLORATION_POLICIES)runs.push(measure(seed,policy));
const replayA=playCityExploration(141001,'logistics',true),replayB=playCityExploration(141001,'logistics',false);
const deterministicReplay=isDeepStrictEqual(replayA.r,replayB.r)&&isDeepStrictEqual(replayA.decisions,replayB.decisions);
const locationMetrics=Object.fromEntries(CITY_EXPLORATION_DEFS.xingyang.locations.map(location=>{const visited=runs.filter(r=>(r.locations[location.id]??0)>0),secured=runs.filter(r=>r.secured.includes(location.id));return [location.id,{name:location.name,visitedRuns:visited.length,visitRate:visited.length/runs.length,totalVisits:visited.reduce((n,r)=>n+(r.locations[location.id]??0),0),securedRuns:secured.length,retainedAfterFound:secured.filter(r=>r.success).length}];}));
const officerMetrics=Object.fromEntries(Object.keys(OFFICERS).map(id=>{const all=runs.map(r=>r.officers.find(o=>o.id===id)!),encountered=all.filter(o=>o.encountered),recruited=all.filter(o=>o.recruited);return [id,{name:OFFICERS[id].name,encounteredRuns:encountered.length,encounterRate:encountered.length/runs.length,recruitedRuns:recruited.length,recruitRate:recruited.length/runs.length,taskRuns:all.filter(o=>o.task).length,cooperationRuns:all.filter(o=>o.cooperation).length,proofRuns:all.filter(o=>o.proof).length,growthRuns:all.filter(o=>o.growth).length,relationshipAtExit:sum(all.map(o=>({[o.relationship]:1}))),usedRuns:runs.filter(r=>(r.officerCardUses[id]??0)>0).length}];}));
const summary={runs:runs.length,success:runs.filter(r=>r.success).length,conditional:runs.filter(r=>['conditional','incomplete'].includes(r.grade??'')).length,errors:runs.filter(r=>r.errors.length).map(r=>({seed:r.seed,policy:r.policy,errors:r.errors})),restores:runs.reduce((n,r)=>n+r.restores,0),deterministicReplay,
 meanExposure:runs.reduce((n,r)=>n+r.exposure,0)/runs.length,meanPlaces:runs.reduce((n,r)=>n+Object.keys(r.locations).filter(k=>r.locations[k]>0).length,0)/runs.length,unvisitedLocations:Object.entries(locationMetrics).filter(([,v])=>!v.visitedRuns).map(([id])=>id),locationMetrics,officerMetrics,
 cardAcquisitions:sum(runs.map(r=>sum(r.library.filter(c=>!['protagonist','city'].includes(c.source)).map(c=>({[c.id]:1}))))),cardUses:sum(runs.map(r=>r.cardUses)),itemUses:sum(runs.map(r=>r.itemUses)),debates:runs.reduce((n,r)=>n+r.debates,0),duels:runs.reduce((n,r)=>n+r.duels,0),withdrawals:runs.reduce((n,r)=>n+r.withdrawals,0),failures:runs.reduce((n,r)=>n+r.failures,0),protagonistGrowth:sum(runs.map(r=>r.protagonistGrowth)),officerGrowth:sum(runs.map(r=>r.officerGrowth)),planUnlocks:sum(runs.map(r=>r.plans)),dispatches:runs.reduce((n,r)=>n+r.dispatches,0),
 personalEpisodes:sum(runs.map(r=>sum(r.personalEpisodes.map(id=>({[id]:1}))))),afterFound:{adminRuns:runs.filter(r=>r.post.adminActions>0).length,appointedRuns:runs.filter(r=>r.post.appointment).length,departures:runs.filter(r=>r.post.departure).length,retainedLocations:runs.reduce((n,r)=>n+r.post.retainedLocations,0)},
 byPolicy:Object.fromEntries(CITY_EXPLORATION_POLICIES.map(policy=>{const group=runs.filter(r=>r.policy===policy);return [policy,{runs:group.length,success:group.filter(r=>r.success).length,meanRecruits:group.reduce((n,r)=>n+r.officers.filter(o=>o.recruited).length,0)/group.length,meanPlaces:group.reduce((n,r)=>n+Object.values(r.locations).filter(v=>v>0).length,0)/group.length,grades:sum(group.map(r=>({[r.grade??'none']:1}))),firstDepartures:group.filter(r=>r.post.departure).length}];})),
 interpretation:'실제 규칙을 사용한 제한된 자동 정책 표본입니다. 장소·인재의 방문 편향을 드러내며, 특정 경로의 상위 호환성·공정한 인과적 성능 비교·난이도 적정성·인간의 재미·실제 브라우저를 검증하지 않습니다. 장소별 거병 후 활용은 확보 상태 보존과 실제 내정 행동을 따로 기록합니다.'};
writeFileSync('city-exploration-benchmark.json',JSON.stringify({summary,runs},null,2));
console.log(JSON.stringify(summary,null,2));if(summary.errors.length||!deterministicReplay)process.exitCode=1;
