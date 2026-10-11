import {CITY_EXPLORATION_DEFS} from '../data/city-exploration.ts';
import {INN_QUESTS} from '../data/inn.ts';
import {innOf,innQuestActions} from '../core/inn.ts';
import {OFFICERS} from '../data/personnel.ts';
import {RAISING_CARDS} from '../data/raising.ts';
import {explorationOf,exploreAction,syncExploration,availableApproaches,personalApproaches,charactersAt} from '../core/city-exploration.ts';
import {startCityExploration} from '../core/city-exploration-start.ts';
import {prologueAction} from '../core/prologue.ts';
import {isRecruited,personnelOf} from '../core/personnel-rules.ts';
import {raisingOf,selectRaisingPlan,actRaisingGate,finishRaisingGate,foundRaisingFaction,recoverRaising,raisingPlanQuote} from '../core/raising.ts';
import {canDuelAction,previewDuelAction} from '../core/duel.ts';
import {deckPolicyAction} from './debate-deck-policy.ts';
import {newWorldCampaign,departWorld,worldRoute,openWorldCity,muster,endWorldTurn,cityRevenue,mobilizeOfficer} from '../core/world.ts';
import {activeCity,appointGeneral,canAdminCard,playAdminCard} from '../core/city.ts';
import {saveCampaign,loadCampaign} from '../core/campaign-save.ts';
import {memoryKV} from '../core/save.ts';
import type {RunState} from '../core/types.ts';
import type {Result} from '../core/run.ts';
import type {DuelState} from '../core/social-types.ts';
import type {CityId} from '../core/city-types.ts';

export const CITY_EXPLORATION_POLICIES=['civic','military','intelligence','logistics'] as const;
export type CityExplorationPolicy=typeof CITY_EXPLORATION_POLICIES[number];
export type CityExplorationLayer='exploration'|'event'|'relationship'|'deck'|'uprising'|'administration'|'expedition';
export interface CityExplorationDecision {layer:CityExplorationLayer;channel:'explore'|'personnel'|'raising';action:string;value?:string;}
const priorities:Record<CityExplorationPolicy,string[]>={
 civic:['inn','homes','archive','hall','shrine','market','store','barracks','gate','outside'],
 military:['inn','homes','market','barracks','gate','store','outside','archive','hall','shrine'],
 intelligence:['inn','archive','hall','market','gate','store','homes','shrine','barracks','outside'],
 logistics:['inn','market','store','homes','archive','hall','shrine','barracks','gate','outside'],
};
const action=(layer:CityExplorationLayer,channel:CityExplorationDecision['channel'],a:string,value?:string):CityExplorationDecision=>({layer,channel,action:a,...(value===undefined?{}:{value})});
export function applyCityExplorationDecision(r:RunState,d:CityExplorationDecision):Result {
 let result:Result;
 if(d.channel==='explore')result=exploreAction(r,d.action,explorationOf(r)!.revision);
 else if(d.channel==='personnel')result=prologueAction(r,d.action,personnelOf(r)!.revision);
 else {const q=raisingOf(r)!;result=d.action==='plan'?selectRaisingPlan(r,d.value!,personnelOf(r)!.representative!,q.revision):d.action==='gate'?actRaisingGate(r,d.value!,q.revision):d.action==='gate-finish'?finishRaisingGate(r,q.revision):d.action==='found'?foundRaisingFaction(r,r.campaign!.world!.factionName,r.campaign!.world!.flagColor,q.revision):d.action==='recover'?recoverRaising(r,q.revision):{ok:false,reason:'없는 자동 거병 명령'};}
 if(result.ok)syncExploration(r);return result;
}
function legal(r:RunState,d:CityExplorationDecision){return applyCityExplorationDecision(structuredClone(r),d).ok;}
function firstLegal(r:RunState,decisions:CityExplorationDecision[]){return decisions.find(d=>legal(r,d))??null;}
function duelDecision(s:DuelState){
 const options=['strike','probe','guard','finisher',...(s.tactics??[])].filter(a=>canDuelAction(s,a,s.round).ok);
 // Local combat tactics only. Route, relationship and deck decisions never use this score.
 return options.map(a=>{const n=previewDuelAction(s,a).state;return {a,value:n.result==='win'?1000:n.result==='lose'?-1000:n.hp/n.maxHp-n.enemyHp/n.enemyMaxHp+n.momentum*.03};}).sort((a,b)=>b.value-a.value)[0]?.a??'guard';
}
function uprisingDecision(r:RunState,policy:CityExplorationPolicy):CityExplorationDecision|null {
 const q=raisingOf(r)!,p=personnelOf(r)!,x=explorationOf(r)!;
 if(q.phase==='plan'){
  if(!p.representative){const rep=policy==='military'&&p.party.find(id=>OFFICERS[id].family==='military'&&isRecruited(p.officers[id]))||p.protagonistId,support=p.party.find(id=>id!==rep&&isRecruited(p.officers[id]))??'';return action('uprising','personnel',`elect:${rep}:${support}`);}
  if(!p.refined){const card=p.library.find(c=>p.loadouts.raising.includes(c.uid)&&!c.upgrade);if(card)return action('deck','personnel','refine:'+card.uid);}
  const preferred=policy==='military'?'barracks':policy==='intelligence'?'inside':'assembly';
  const plans=[...x.unlockedPlans].sort((a,b)=>Number(b===preferred)-Number(a===preferred)||(raisingPlanQuote(r,b)!.readiness-raisingPlanQuote(r,a)!.readiness));
  return firstLegal(r,plans.map(id=>action('uprising','raising','plan',id)));
 }
 if(q.phase==='debate'){const s=q.gate!.debate!;return action('uprising','raising',s.result==='ongoing'?'gate':'gate-finish',s.result==='ongoing'?deckPolicyAction(s,policy==='intelligence'?'chain':'stable'):undefined);}
 if(q.phase==='duel'){const s=q.gate!.duel!;return action('uprising','raising',s.result==='ongoing'?'gate':'gate-finish',s.result==='ongoing'?duelDecision(s):undefined);}
 if(q.phase==='result')return p.doctrine?action('uprising','raising','found'):action('uprising','personnel','doctrine:'+(policy==='military'?'strategy':'people'));
 if(q.phase==='escape')return action('uprising','raising','recover');
 return null;
}
function relationshipDecision(r:RunState,policy:CityExplorationPolicy):CityExplorationDecision|null {
 const p=personnelOf(r)!,x=explorationOf(r)!;
 if(x.scene!=='location')return null;
 for(const id of charactersAt(r)){
  const o=p.officers[id];if(!o||isRecruited(o))continue;
  if(['xunyu','dianwei','lusu'].includes(id)&&o.task&&x.location==='inn'&&(x.inn?.view.kind!=='conversation'||x.inn.view.person!==id))return action('relationship','explore','inn:select:'+id);
  const choices:CityExplorationDecision[]=[];
  if(!o.task)choices.push(action('relationship','explore','officer:task:'+id));
  if(o.task&&!o.cooperation)choices.push(...['card','relation'].map(kind=>action('relationship','explore',`officer:cooperate:${id}:${kind}`)));
  if(o.cooperation==='card'&&!o.proof){const support=raisingOf(r)!.cards.find(c=>c.id===OFFICERS[id].support&&raisingOf(r)!.hand.includes(c.uid));if(support)choices.push(action('relationship','explore','card:'+support.uid));}
  if(policy==='logistics'&&o.cooperation)for(const choice of personalApproaches(r,id).filter(a=>a.ok).sort((a,b)=>Number(b.kind==='card')-Number(a.kind==='card')))choices.push(action('relationship','explore',`personal:${id}:${choice.id}`));
  if(o.task&&o.proof)choices.push(action('relationship','explore',`officer:recruit:${id}:${policy==='military'?'b':'a'}`));
  const found=firstLegal(r,choices);if(found)return found;
 }
 return null;
}
/** Quest navigation, encounters and reporting are separate from resource/deck priorities. */
function innDecision(r:RunState,policy:CityExplorationPolicy):CityExplorationDecision|null {
 const x=explorationOf(r)!,s=innOf(r);if(!s||x.converted||!['map','node'].includes(raisingOf(r)!.phase)||['debate','duel'].includes(x.scene))return null;
 const questId=policy==='military'?'escort':'recommendation',quest=s.quests[questId];
 if(x.location==='inn'&&x.scene==='location'&&!s.heard.includes('greet'))return action('relationship','explore',s.view.kind==='conversation'&&s.view.person==='innkeeper'?'inn:topic:greet':'inn:select:innkeeper');
 if(!quest&&x.location==='inn'&&x.scene==='location')return firstLegal(r,[action('relationship','explore','inn:offer:'+questId)]);
 if(quest?.status==='offered'&&x.location==='inn'&&x.scene==='location')return action('relationship','explore','inn:accept:'+questId);
 if(!quest||!['accepted','active','readyToReport'].includes(quest.status))return null;
 const def=INN_QUESTS[questId],target=def.steps[quest.step].location;
 if(x.location===target){
  if(x.scene==='map')return action('exploration','explore','enter');
  if(questId==='escort'&&quest.step===1){for(const clue of ['cart','passage','guards'])if(!quest.evidence.includes(clue))return action('relationship','explore','scene:inspect:'+clue);}
  const names=innQuestActions(r,quest),order=quest.result==='failure'?['retry-investigate','pay-guards','pay','conditional']:policy==='logistics'?['public-records','investigate','pay','pay-guards','conditional','report']:['public-records','investigate','debate','duel','truth','conditional','report'];
  if(questId==='escort'&&quest.step===1){const order=quest.result==='failure'?['contract','alternate','debate','duel']:policy==='military'?['duel','debate','contract','alternate']:['debate','contract','alternate','duel'];return firstLegal(r,order.filter(a=>names.includes(a)).map(a=>action('relationship','explore',`inn:quest:${questId}:${a}`)));}
  if(questId==='escort'&&quest.step===2)return firstLegal(r,names.map(a=>action('relationship','explore',`inn:quest:${questId}:${a}`)));
  const choices=[...names].sort((a,b)=>(order.indexOf(a)<0?99:order.indexOf(a))-(order.indexOf(b)<0?99:order.indexOf(b))).filter(a=>a!=='retry-investigate'||quest.result==='failure');
  return firstLegal(r,choices.map(a=>action('relationship','explore',`inn:quest:${questId}:${a}`)));
 }
 if(x.scene!=='map')return action('exploration','explore','leave');
 const d=CITY_EXPLORATION_DEFS[x.cityId],todo=[[x.location]],seen=new Set<string>();
 while(todo.length){const route=todo.shift()!,at=route.at(-1)!;if(at===target)return firstLegal(r,[action('exploration','explore','move:'+route[1])]);if(seen.has(at))continue;seen.add(at);for(const link of d.links){const next=link.a===at?link.b:link.b===at?link.a:null;if(next&&!seen.has(next))todo.push([...route,next]);}}
 return null;
}
function deckDecision(r:RunState,policy:CityExplorationPolicy):CityExplorationDecision|null {
 const p=personnelOf(r)!,x=explorationOf(r)!;if(x.scene!=='map'||raisingOf(r)!.phase!=='map')return null;
 const choices:CityExplorationDecision[]=[];
 if(x.growth.offered&&!x.growth.branch)choices.push(action('deck','explore','growth:'+(policy==='military'?'resolve':'insight')));
 for(const o of Object.values(p.officers).filter(isRecruited)){
  if(o.xp>=2&&!o.growth)choices.push(action('deck','personnel',`growth:${o.id}:${policy==='military'?'authority':'expert'}`));
  if(!x.companions.includes(o.id)&&x.companions.length<x.companionSlots)choices.push(action('relationship','explore','companion:'+o.id));
  if(policy==='logistics'&&!x.companions.includes(o.id)&&!x.dispatches.some(d=>d.officer===o.id))choices.push(action('relationship','explore',`dispatch:${o.id}:market`));
 }
 for(const card of p.library){
  if(card.ownerType==='temporary'&&p.loadouts.raising.includes(card.uid)&&p.officers[card.owners[0]]?.proof)choices.push(action('deck','personnel',`equip:${card.uid}:raising`));
  if(card.sourceType==='officer'&&card.ownerType==='personal'&&card.owners.every(id=>p.party.includes(id))&&!p.loadouts.raising.includes(card.uid)&&p.loadouts.raising.length<12)choices.push(action('deck','personnel',`equip:${card.uid}:raising`));
 }
 return firstLegal(r,choices);
}
function eventDecision(r:RunState,policy:CityExplorationPolicy):CityExplorationDecision|null {
 const x=explorationOf(r)!,q=raisingOf(r)!;
 if(['map','location'].includes(x.scene)){
  const usable=x.items.filter(item=>item.id==='medicine'&&x.fatigue>=3||item.id==='ration'&&r.campaign!.world!.preparation.food<10||item.id==='map'&&!x.flags.includes('guided')||item.id==='ledger'&&x.location==='market'&&x.event?.status==='active'&&x.event.itemUsed!=='ledger');
  const item=firstLegal(r,usable.map(item=>action('event','explore','item:'+item.uid)));if(item)return item;
  if(x.pendingItem){const disposable=x.items.filter(item=>item.important===x.pendingItem!.important).sort((a,b)=>Number(a.id==='seal')-Number(b.id==='seal'))[0];if(disposable)return action('event','explore','discard:'+disposable.uid);}
 }
 if(x.scene==='debate'&&x.debate)return action('event','explore',x.debate.result==='ongoing'?'social:'+deckPolicyAction(x.debate,policy==='intelligence'?'chain':'stable'):'finish-social');
 if(x.scene==='duel'&&x.duel)return action('event','explore',x.duel.result==='ongoing'?'social:'+duelDecision(x.duel):'finish-social');
 if(x.scene==='result')return firstLegal(r,[action('event','explore','leave')]);
 if(x.scene!=='location')return null;
 const e=x.event;
 if(e?.status==='active'&&x.location!=='inn'){
  const approaches=availableApproaches(r),order=policy==='military'?['duel','card','item','companion','investigate','talk','trade','debate','risk']:policy==='intelligence'?['card','item','investigate','debate','companion','talk','trade','duel','risk']:policy==='logistics'?['item','card','trade','companion','investigate','debate','talk','duel','risk']:['item','card','talk','investigate','debate','companion','trade','duel','risk'];
  const candidates=[...approaches].sort((a,b)=>order.indexOf(a.kind)-order.indexOf(b.kind));
  for(const approach of candidates){
   if(approach.kind==='card'&&!e.committedFamilies.includes(approach.family!)){
    const d=firstLegal(r,q.hand.map(uid=>q.cards.find(c=>c.uid===uid)!).filter(c=>RAISING_CARDS[c.id].family===approach.family).map(c=>action('event','explore','card:'+c.uid)));if(d)return d;
   }
   if(approach.kind==='item'&&e.itemUsed!==approach.item){const item=x.items.find(item=>item.id===approach.item);if(item){const d=action('event','explore','item:'+item.uid);if(legal(r,d))return d;}}
   if(approach.ok)return action('event','explore','approach:'+approach.id);
  }
 }
 // Use real remaining preparation cards before leaving, with resource needs kept separate from route preferences.
 const families=(r.campaign!.world!.preparation.food<6?['supply','funds','cause','intel','network','military']:['funds','supply','cause','intel','network','military']);
 const cards=q.hand.map(uid=>q.cards.find(c=>c.uid===uid)!).sort((a,b)=>families.indexOf(RAISING_CARDS[a.id].family)-families.indexOf(RAISING_CARDS[b.id].family));
 const card=firstLegal(r,cards.map(c=>action('deck','explore','card:'+c.uid)));if(card)return card;
 return firstLegal(r,[action('event','explore','leave')]);
}
function explorationDecision(r:RunState,policy:CityExplorationPolicy):CityExplorationDecision|null {
 const x=explorationOf(r)!;if(x.scene!=='map')return null;
 if(!x.unlockedPlans.length&&x.budget-x.tick<=3)return action('uprising','explore','desperate-plan');
 if(x.unlockedPlans.length&&(x.tick>=x.budget-7||Object.values(x.locations).filter(l=>l.secured).length>=5))return action('uprising','explore','plan');
 const current=x.events[x.location];if(!current||current.status==='active'){
  const enter=action('exploration','explore','enter');if(legal(r,enter))return enter;
 }
 const def=CITY_EXPLORATION_DEFS[x.cityId],adjacent=(id:string)=>def.links.filter(l=>l.a===id||l.b===id).map(l=>l.a===id?l.b:l.a);
 const routes=(target:string)=>{const todo=[[x.location]],seen=new Set([x.location]);while(todo.length){const path=todo.shift()!;if(path.at(-1)===target)return path;for(const id of adjacent(path.at(-1)!))if(!seen.has(id)){seen.add(id);todo.push([...path,id]);}}return [];};
 const timeSensitive=!x.unlockedPlans.length&&x.budget-x.tick<=18?(policy==='military'?['barracks','gate','shrine']:policy==='intelligence'?['gate','shrine','barracks']:['shrine','gate','barracks']):[];
 const targets=[...new Set([...timeSensitive,...priorities[policy]])].filter(id=>x.locations[id]&&id!==x.location&&!x.events[id]?.claimed);
 for(const target of targets){const path=routes(target);if(path.length>1){const move=action('exploration','explore','move:'+path[1]);if(legal(r,move))return move;}}
 return firstLegal(r,[action('uprising','explore','plan'),...adjacent(x.location).map(id=>action('exploration','explore','move:'+id))]);
}
export function chooseCityExplorationDecision(r:RunState,policy:CityExplorationPolicy='civic'):CityExplorationDecision|null {
 if(!explorationOf(r)||raisingOf(r)?.phase==='founded')return null;
 // Five explicit decision layers: no shared global utility score or hidden-state RNG draws.
 return uprisingDecision(r,policy)??innDecision(r,policy)??relationshipDecision(r,policy)??deckDecision(r,policy)??eventDecision(r,policy)??explorationDecision(r,policy);
}
export function cityExplorationBotStep(r:RunState,policy:CityExplorationPolicy='civic',trace?:(d:CityExplorationDecision)=>void){const d=chooseCityExplorationDecision(r,policy);if(!d)return false;const result=applyCityExplorationDecision(r,d);if(result.ok)trace?.(d);return result.ok;}
export interface CityExplorationRun {r:RunState;steps:number;restores:number;errors:string[];success:boolean;decisions:CityExplorationDecision[];post:{adminActions:number;appointment:string|null;departure:boolean;target:CityId|null;retainedLocations:number};}
export function playCityExploration(seed=141001,policy:CityExplorationPolicy='civic',reload=true,afterFound=true):CityExplorationRun {
 let r=newWorldCampaign(seed).activeExpedition!;const initial=startCityExploration(r,'xingyang',policy==='military'?'zhangliao':policy==='intelligence'?'guojia':'chengong',policy==='military'?'militia':policy==='intelligence'?'official':'notable');
 const kv=memoryKV(),errors:string[]=initial.ok?[]:[initial.reason??'start failed'],decisions:CityExplorationDecision[]=[];let steps=0,restores=0;
 const restore=()=>{if(!reload)return true;if(!saveCampaign(kv,r)){errors.push('save failed');return false;}const loaded=loadCampaign(kv);if(!loaded.ok){errors.push('restore '+loaded.reason+' '+raisingOf(r)?.phase+'/'+explorationOf(r)?.scene);return false;}r=loaded.data.activeExpedition!;restores++;return true;};
 restore();
 for(;steps<500&&!errors.length&&raisingOf(r)?.phase!=='founded'&&r.campaign!.world!.stage!=='failed';steps++){
  const d=chooseCityExplorationDecision(r,policy);if(!d){errors.push('no decision '+raisingOf(r)?.phase+'/'+explorationOf(r)?.scene);break;}
  const res=applyCityExplorationDecision(r,d);if(!res.ok){errors.push(JSON.stringify(d)+' '+res.reason);break;}decisions.push(d);if(!restore())break;
 }
 const success=raisingOf(r)?.phase==='founded',post:CityExplorationRun['post']={adminActions:0,appointment:null,departure:false,target:null,retainedLocations:success?Object.values(explorationOf(r)!.locations).filter(l=>l.secured).length:0};
 if(success&&afterFound&&!errors.length){
  const commit=(fn:(r:RunState)=>Result)=>{const result=fn(r);return result.ok&&restore();};
  commit(r=>openWorldCity(r,r.campaign!.world!.startCity));
  const candidates=Object.values(personnelOf(r)!.officers).filter(isRecruited).map(o=>o.id).sort((a,b)=>Number(OFFICERS[b].family==='cause')-Number(OFFICERS[a].family==='cause'));
  for(const id of candidates)if(legalCity(r,s=>appointGeneral(s,'civil',id))&&commit(s=>appointGeneral(s,'civil',id))){post.appointment=id;break;}
  // Explicitly selected activity cards retain ownership; administration uses the existing actual hand.
  for(let i=0;i<8;i++){const c=activeCity(r)!,uid=c.hand.find(uid=>canAdminCard(r,uid).ok);if(uid===undefined)break;if(commit(s=>playAdminCard(s,uid)))post.adminActions++;else break;}
  for(let turn=0;turn<4;turn++){
   const c=activeCity(r)!,w=r.campaign!.world!,target=w.rival.core,route=worldRoute(r,target);
   if((c.reserveTroops??0)<12)commit(s=>muster(s,'levy'));
   if(w.treasury<2)commit(s=>cityRevenue(s,c.id,true));
   if(!r.generals.length){const id=w.reserveOfficers[0];if(id)commit(s=>mobilizeOfficer(s,id));}
   if(legalCity(r,s=>departWorld(s,target,12,Math.min(c.food,route.capacity,Math.max(route.cost+2,8)))))if(commit(s=>departWorld(s,target,12,Math.min(c.food,route.capacity,Math.max(route.cost+2,8))))){post.departure=true;post.target=target;break;}
   if(!commit(s=>endWorldTurn(s)))break;
  }
 }
 if(steps===500)errors.push('action limit');return {r,steps,restores,errors,success,decisions,post};
}
function legalCity(r:RunState,fn:(r:RunState)=>Result){return fn(structuredClone(r)).ok;}
