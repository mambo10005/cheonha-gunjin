import {playRaising} from './raising-policy.ts';
import {newWorldCampaign,configureStart,prepareAction,advancePreparation,foundFaction,risingAllowed,worldOf,muster,diplomacyWorld,endWorldTurn,departWorld,worldMoves,marchWorld,retreatWorld,reconcileWorld,recruitTalent} from '../core/world.ts';
import {activeCity,appointGeneral,canAdminCard,playAdminCard,constructCity,cityApproach,chooseConquest,occupyCity,delegateCity} from '../core/city.ts';
import {chooseDoctrine} from '../core/build.ts';
import {botTurn} from './autoplay.ts';
import {socialBotStep} from './social-policy.ts';
import {finishBattle,leaveNode,pickRewardCard,pickRewardExtra,supplyChoose,restHeal,chooseRecruit,deckPick,replaceGeneral,chooseEvent,eventOptionAllowed} from '../core/run.ts';
import {EVENTS} from '../data/events.ts';
import {ADMIN_CARDS,FACILITY_DEFS} from '../data/cities.ts';
import {saveCampaign,loadCampaign} from '../core/campaign-save.ts';
import {memoryKV} from '../core/save.ts';
import type {CityId} from '../core/city-types.ts';
import type {StartType} from '../core/world-types.ts';
import type {RunState} from '../core/types.ts';
export function prepareBot(r:RunState){
 const w=worldOf(r)!;if(w.raising){playRaising(r);return;}
 // A limited sequence of paid missions, with clue persistence and exposure control.
 if(w.startType==='castellan'){foundFaction(r,'volunteers');return;}
 for(const actions of [['talent','credit','support'],['talent','recruit','base']]){for(const action of actions)prepareAction(r,action);advancePreparation(r);}
 for(const a of ['conceal','credit','support'])prepareAction(r,a);
 if(risingAllowed(r,'volunteers').ok){foundFaction(r,'volunteers');return;}
 advancePreparation(r);for(const a of ['conceal','grain','support'])prepareAction(r,a);foundFaction(r,'volunteers');
}
export function operationBotStep(r:RunState):boolean {
 reconcileWorld(r);if(worldOf(r)!.stage!=='operation')return true;
 const c=r.campaign!;
 if(c.activity){return socialBotStep(r);}
 if(c.stage==='approach'){const a=!c.approach.choices.includes('scout')?'scout':r.food<2?'raid':'cut';return cityApproach(r,r.food<2&&!c.approach.choices.includes('raid')?'raid':a).ok;}
 if(c.stage==='conquest'){const method=r.generals.some(g=>g.id==='guojia'||g.id==='chengong')&&c.approach.intel>=2?'persuade':'assault';return chooseConquest(r,method).ok;}
 if(c.stage==='occupation'){return occupyCity(r,'shared').ok;}
 if(r.screen==='battle'&&r.battle){if(r.battle.result==='ongoing'&&r.battle.turn<60){botTurn(r.battle);return true;}if(r.battle.result!=='ongoing')return finishBattle(r).ok;return false;}
 if(r.screen==='map'){if(!r.build.doctrines.length)return chooseDoctrine(r,'bastion').ok;const nodes=worldMoves(r);const node=nodes[0];return node?marchWorld(r,node.col).ok:false;}
 if(socialBotStep(r))return true;
 const p=r.pending;
 if(p.kind==='reward'){if(!p.picked)pickRewardCard(r,p.cards[0]??null);if(p.extra&&!p.extra.picked)pickRewardExtra(r,p.extra.options[0]);return leaveNode(r).ok;}
 if(p.kind==='supply')return supplyChoose(r,'food').ok;
 if(p.kind==='rest')return restHeal(r).ok;
 if(p.kind==='recruit')return chooseRecruit(r,null).ok;
 if(p.kind==='deckPick')return deckPick(r,null).ok;
 if(p.kind==='replaceGeneral')return replaceGeneral(r,null).ok;
 if(p.kind==='event'){if(p.resultText)return leaveNode(r).ok;return chooseEvent(r,EVENTS[p.eventId].options.findIndex((_,i)=>eventOptionAllowed(r,p.eventId,i))).ok;}
 return leaveNode(r).ok;
}
function cityBot(r:RunState){
 const c=r.campaign!,w=worldOf(r)!,city=activeCity(r)!;
 const foodFacility=city.blueprints.find(id=>FACILITY_DEFS[id].effects.some(e=>e.field==='food'&&e.amount>0));if(foodFacility)constructCity(r,foodFacility);
 // Draft without an invented starting army; every levy consumes actual civilian stock.
 if((city.reserveTroops??0)<40)muster(r,'levy');
 const food=city.hand.find(uid=>{const card=city.cards.find(c=>c.uid===uid)!;return canAdminCard(r,uid).ok&&ADMIN_CARDS[card.id].effects.some(e=>e.field==='food'&&e.amount>0);});if(food)playAdminCard(r,food);
 if(city.food<10)diplomacyWorld(r,'trade');
 const candidate=w.candidates.find(p=>p.city===city.id&&!p.recruited);if(candidate&&w.treasury>=4&&w.ap>=2){recruitTalent(r,candidate.id);recruitTalent(r,candidate.id);}
 if(c.roster.length>=3&&!city.roles.civil&&r.generals.length>2){const governor=r.generals.find(g=>g.id==='chengpu'||g.id==='chengong');if(governor)appointGeneral(r,'civil',governor.id);}
}
export function playWorldCampaign(seed=111001,startCity:CityId='xingyang',type:StartType='wanderer',maxSteps=500){
 const c=newWorldCampaign(seed),r=c.activeExpedition!,kv=memoryKV();const errors:string[]=[];let saves=0,restoreFailures=0,battles=0,debates=0,steps=0,stalled=0;const seenBattles=new Set(),seenDebates=new Set();
 configureStart(r,startCity,type,'chengong','people','granary');prepareBot(r);
 for(;steps<maxSteps;steps++){
  const w=worldOf(r)!;if(w.stage==='won'||w.stage==='failed'||w.stage==='preparing')break;
  if(w.stage==='strategy'){
   const city=activeCity(r)!;cityBot(r);
   if(c.captured.length>=2){endWorldTurn(r);continue;}
   const target=w.rival.core;const result=departWorld(r,target,Math.min(r.maxHp,city.reserveTroops??0),Math.min(city.food,14));
   if(!result.ok){delegateCity(r,'support');endWorldTurn(r);stalled++;if(stalled>18){errors.push(result.reason!);break;}}
  }else if(w.stage==='operation'){
   if(r.battle&&!seenBattles.has(r.battle)){seenBattles.add(r.battle);battles++;}
   if(r.pending.kind==='debate'&&!seenDebates.has(r.pending.state)){seenDebates.add(r.pending.state);debates++;}
   if(!operationBotStep(r)){errors.push(`unhandled ${r.screen}/${r.pending.kind}/${c.stage}`);retreatWorld(r);break;}
  }else break;
  reconcileWorld(r);saveCampaign(kv,r);const loaded=loadCampaign(kv);saves++;if(!loaded.ok){restoreFailures++;errors.push(`restore ${w.stage}/${c.stage}/${r.screen}/${r.floor}/${r.pending.kind}`);break;}
 }
 return {campaign:c,run:r,completed:c.world!.stage==='won',seed,startCity,type,steps,battles,debates,saves,restoreFailures,stalled,errors};
}
