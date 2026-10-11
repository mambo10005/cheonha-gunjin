import {writeFileSync} from 'node:fs';
import {newWorldCampaign} from '../core/world.ts';
import {startCityExploration} from '../core/city-exploration-start.ts';
import {explorationOf,exploreAction} from '../core/city-exploration.ts';
import {innOf,innQuestActions} from '../core/inn.ts';
import {raisingOf} from '../core/raising.ts';
import {saveCampaign,loadCampaign} from '../core/campaign-save.ts';
import {memoryKV} from '../core/save.ts';
import {chooseCityExplorationDecision,applyCityExplorationDecision,type CityExplorationDecision,type CityExplorationPolicy} from './city-exploration-policy.ts';
import {nextFloat} from '../core/rng.ts';
const profiles:Record<string,CityExplorationPolicy>={talent:'civic',rumor:'logistics',quest:'civic',cardGrowth:'intelligence',uprising:'military',lowExposure:'logistics',avoidDuel:'logistics',debate:'intelligence',randomValid:'civic'};
export function runInnProfile(seed:number,profile:string,reload=true){let r=newWorldCampaign(seed).activeExpedition!;startCityExploration(r,'xingyang',profiles[profile]==='military'?'zhangliao':'chengong','notable');const kv=memoryKV(),chooser={rng:seed^0x317aae},trace:CityExplorationDecision[]=[],errors:string[]=[];let restores=0;
 for(let step=0;step<350&&raisingOf(r)!.phase!=='founded';step++){
  const x=explorationOf(r)!,s=innOf(r)!,base=chooseCityExplorationDecision(r,profiles[profile]);if(!base)break;
  const extras:string[]=[];
  if(x.location==='inn'&&x.scene==='location'){
   if(profile==='rumor'&&s.rumors.length<1)extras.push(s.view.kind==='conversation'&&s.view.person==='innkeeper'?'inn:topic:rumor':s.view.kind==='rumors'?'inn:rumor:buy':'inn:select:innkeeper');
   if(profile==='lowExposure'&&x.fatigue>=4&&!s.lodgedDays.includes(Math.floor(x.tick/6)))extras.push('inn:lodge:safe','inn:lodge:meal');
   if(profile==='randomValid')extras.push('inn:select:innkeeper','inn:topic:today','inn:topic:mood','inn:topic:rumor','inn:rumor:buy','inn:observe:join','inn:lodge:meal','inn:area:yard','inn:courtyard:duel');
  }
  if(profile==='randomValid')for(const quest of Object.values(s.quests))for(const a of innQuestActions(r,quest))extras.push(`inn:quest:${quest.id}:${a}`);
  const legal=extras.filter(a=>!trace.some(d=>d.action===a)&&exploreAction(structuredClone(r),a,x.revision).ok).map(a=>({layer:'event' as const,channel:'explore' as const,action:a}));
  const candidates=[base,...legal],decision=profile==='randomValid'?candidates[Math.floor(nextFloat(chooser)*candidates.length)]:legal[0]??base;
  const result=applyCityExplorationDecision(r,decision);if(!result.ok){errors.push(result.reason??'command failed');break;}trace.push(decision);
  if(reload){saveCampaign(kv,r);const loaded=loadCampaign(kv);if(!loaded.ok){errors.push('restore '+loaded.reason);break;}r=loaded.data.activeExpedition!;restores++;}
 }
 const s=innOf(r)!;return {seed,profile,trace,errors,restores,founded:raisingOf(r)!.phase==='founded',quests:Object.fromEntries(Object.entries(s.quests).map(([id,q])=>[id,{status:q.status,result:q.result,step:q.step,reported:q.reported}])),stats:s.stats,trust:s.trust,reputation:s.reputation,exposure:r.campaign!.world!.preparation.exposure,state:r};
}
const runs=[141001,141002,141003].flatMap(seed=>Object.keys(profiles).map(profile=>runInnProfile(seed,profile)));
const a=runInnProfile(141001,'quest'),b=runInnProfile(141001,'quest',false),deterministicReplay=JSON.stringify(a.state)===JSON.stringify(b.state)&&JSON.stringify(a.trace)===JSON.stringify(b.trace);
const summary={runs:runs.length,founded:runs.filter(r=>r.founded).length,reported:runs.filter(r=>Object.values(r.quests).some(q=>q.reported)).length,restores:runs.reduce((n,r)=>n+r.restores,0),errors:runs.flatMap(r=>r.errors),deterministicReplay,questStatus:Object.fromEntries(Object.keys(profiles).map(p=>[p,runs.filter(r=>r.profile===p).map(r=>r.quests)])),interpretation:'정책 9종의 제한된 규칙 표본. 무작위 정책도 합법 입력만 사용한다. 승률은 인간의 재미나 실제 브라우저 검증이 아니다.'};
writeFileSync('inn-benchmark.json',JSON.stringify({summary,runs:runs.map(({state,...r})=>r)},null,2));console.log(JSON.stringify(summary,null,2));if(summary.errors.length||!deterministicReplay)process.exitCode=1;
