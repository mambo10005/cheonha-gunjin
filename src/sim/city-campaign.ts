import {activeCity,cityApproach,chooseConquest,completeCampaign,delegateCity,departCity,newCityCampaign,occupyCity} from '../core/city.ts';
import {availableMoves,chooseEvent,chooseRecruit,eventOptionAllowed,finishBattle,leaveNode,moveTo,pickRewardCard,pickRewardExtra,restHeal,restDrill,supplyChoose,replaceGeneral,deckPick} from '../core/run.ts';
import {chooseDoctrine} from '../core/build.ts';
import {socialBotStep} from './social-policy.ts';
import {botTurn} from './autoplay.ts';
import {EVENTS} from '../data/events.ts';
import type {AdminPlan,CityId} from '../core/city-types.ts';
import type {RunState} from '../core/types.ts';
export function playCityCampaign(seed=101001,plan:AdminPlan='issues'){
 const r=newCityCampaign(seed);let steps=0,retreats=0;const failures:string[]=[];
 for(;steps<800;steps++){
  const c=r.campaign!;if(c.stage==='complete')break;
  if(c.activity){if(!socialBotStep(r)){failures.push('unhandled city debate');break;}continue;}
  if(c.stage==='approach'){const choice=r.food<2?'raid':c.approach.choices.includes('scout')?'protect':'scout';const result=cityApproach(r,choice);if(!result.ok){failures.push(result.reason!);break;}continue;}
  if(c.stage==='conquest'){const method=c.target==='chenggao'?'siege':'inside';const result=chooseConquest(r,method);if(!result.ok){const fallback=chooseConquest(r,'assault');if(!fallback.ok){failures.push(fallback.reason!);break;}}continue;}
  if(c.stage==='occupation'){occupyCity(r,c.target==='chenggao'?'military':c.target==='gong'?'merchant':'shared');continue;}
  if(c.stage==='admin'){delegateCity(r,plan);continue;}
  if(c.stage==='ready'){if(c.captured.length===3){completeCampaign(r);continue;}const next=(['chenggao','gong'] as CityId[]).find(id=>!c.captured.includes(id))!;departCity(r,next,'food');continue;}
  if(r.screen==='battle'&&r.battle){if(r.battle.result==='ongoing'&&r.battle.turn<60){botTurn(r.battle);continue;}if(r.battle.result==='ongoing'){failures.push('battle turn limit');break;}if(r.battle.result==='lose')retreats++;finishBattle(r);if(retreats>2){failures.push('retreat limit');break;}continue;}
  if(r.screen==='map'){
   if(!r.build.doctrines.length){chooseDoctrine(r,'bastion');continue;}
   const moves=availableMoves(r),score:Record<string,number>={rest:r.hp<40?10:5,supply:9,recruit:2,event:3,market:4,battle:0,elite:-3,boss:1};const node=moves.sort((a,b)=>score[b.type]-score[a.type]||a.col-b.col)[0];if(!node){failures.push('no reachable march');break;}moveTo(r,node.col);continue;
  }
  if(socialBotStep(r))continue;
  const p=r.pending;
  if(p.kind==='reward'){if(!p.picked)pickRewardCard(r,p.cards[0]??null);if(p.extra&&!p.extra.picked)pickRewardExtra(r,p.extra.options[0]);leaveNode(r);}
  else if(p.kind==='recruit')chooseRecruit(r,null);
  else if(p.kind==='replaceGeneral')replaceGeneral(r,null);
  else if(p.kind==='rest'){if(r.food>=2&&r.hp<r.maxHp)restHeal(r);else restDrill(r);}
  else if(p.kind==='supply')supplyChoose(r,r.hp<25?'hp':'food');
  else if(p.kind==='event'){if(p.resultText)leaveNode(r);else chooseEvent(r,EVENTS[p.eventId].options.findIndex((_,i)=>eventOptionAllowed(r,p.eventId,i)));}
  else if(p.kind==='deckPick')deckPick(r,null);
  else leaveNode(r);
 }
 return {run:r,completed:r.campaign!.stage==='complete',steps,retreats,failures,cities:r.campaign!.captured,results:Object.values(r.campaign!.cities).map(c=>({id:c!.id,outcome:c!.outcome,food:c!.food,issuesResolved:c!.stats.resolved,readiness:c!.readiness}))};
}
export function campaignTraceState(r:RunState){return {stage:r.campaign?.stage,phase:activeCity(r)?.phase,floor:r.floor,pending:r.pending.kind};}
