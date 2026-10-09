import { configureAccordDemo } from '../core/accord-demo.ts';
import { activeAgreements, declineCouncil } from '../core/accords.ts';
import { newRun, moveTo, leaveNode, supplyChoose, finishBattle, pickRewardCard, pickRewardExtra, restHeal, restDrill, deckPick } from '../core/run.ts';
import { villageDiplomacy } from '../core/social-run.ts';
import { botTurn } from './autoplay.ts';
import { socialBotStep } from './social-policy.ts';
export type AccordPolicy='none'|'sponsorship'|'alliance';
/** Entire real expedition; no forced victories, terms or injected agreements. */
export function runAccordScenario(policy:AccordPolicy) {
 const r=newRun(51001,'caocao');configureAccordDemo(r);let steps=0,openingBlock=0,openingDamage=0;
 for(;steps<500 && r.screen!=='victory' && r.screen!=='defeat';steps++) {
  if(r.screen==='map'){moveTo(r,0);continue;}
  if(r.screen==='battle' && r.battle){
   const b=r.battle;if(b.turn===1 && r.floor===5){openingBlock=b.block.front;openingDamage=b.enemies.reduce((n,e)=>n+e.maxHp-e.hp,0);}
   while(b.result==='ongoing' && b.turn<60)botTurn(b);
   if(b.result==='ongoing')throw new Error('전투 처리 제한 초과');finishBattle(r);continue;
  }
  const p=r.pending;
  if(p.kind==='council' && (policy==='none' || (policy==='sponsorship')!==(p.faction==='caravan'))){declineCouncil(r);continue;}
  if(p.kind==='parley' && p.mode==='supply' && !p.negotiated && policy==='alliance'){villageDiplomacy(r);continue;}
  if(socialBotStep(r))continue;
  if(p.kind==='supply'){supplyChoose(r,'food');continue;}
  if(p.kind==='reward'){if(!p.picked)pickRewardCard(r,p.cards[0]??null);if(p.extra && !p.extra.picked)pickRewardExtra(r,p.extra.options[0]??null);leaveNode(r);continue;}
  if(p.kind==='rest'){if(r.hp/r.maxHp<0.75)restHeal(r);else restDrill(r);continue;}
  if(p.kind==='deckPick'){deckPick(r,r.deck.find(c=>c.id==='spear')?.uid??null);continue;}
  if(p.kind==='none'){leaveNode(r);continue;}
  throw new Error('미처리 상태 '+p.kind);
 }
 if(steps>=500)throw new Error('원정 종료 제한 초과');
 return {policy,seed:r.seed,result:r.screen,floor:r.floor+1,hp:r.hp,food:r.food,openingBlock,openingDamage,relations:r.social.relations,growth:r.build.growth,agreements:r.social.accords.agreements.map(a=>({clause:a.clause,status:a.status,boosted:a.boosted})),active:activeAgreements(r).length};
}
