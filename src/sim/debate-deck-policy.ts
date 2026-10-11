import {deckActions,deckPreview,activeCard,chooseDeckReward} from '../core/debate-deck.ts';
import {DEBATE_CARDS} from '../data/debate-cards.ts';
import type {DebateState} from '../core/social-types.ts';
import type {RunState} from '../core/types.ts';
import {nextFloat} from '../core/rng.ts';
export type DebatePolicy='immediate'|'stable'|'chain'|'refine'|'random';
export const DEBATE_POLICIES:DebatePolicy[]=['immediate','stable','chain','refine','random'];
export function deckPolicyAction(s:DebateState,policy:DebatePolicy='immediate',randomSource={rng:s.rng}):string{
 const options=deckActions(s).map(action=>({action,...deckPreview(s,action)})).filter(o=>o.check.ok);
 if(policy==='random'){const safe=options.filter(o=>o.action!=='settle'||o.state.result!=='failure');return safe[Math.floor(nextFloat(randomSource)*safe.length)]?.action??'end-round';}
 const score=(o:typeof options[number])=>{
  if(o.state.result==='success')return 1000;if(o.state.result==='partial'&&o.action==='settle')return s.round>=3?300:-100;
  if(o.state.result==='failure')return -1000;
  const n=o.state.negotiation!,base=s.negotiation!;let value=0;
  for(const [axis,need] of Object.entries(n.needs))value+=Math.min(n.scores[axis as keyof typeof n.scores],need!)*4;
  const card=activeCard(s,Number(o.action.slice(5)));const family=card?DEBATE_CARDS[card.id].family:null;
  value+=Math.min(5,o.state.trust)*(policy==='stable'?4:1)-n.burden*(policy==='stable'?3:.8)+o.state.resolve*.3;
  value+=o.state.deck!.guard*(policy==='stable'?2:.4)+(o.state.deck!.hand.length-s.deck!.hand.length)*.25;
  if(policy==='chain')value+=(o.state.deck!.stats.chains-s.deck!.stats.chains)*3+(family==='information'?1:0);
  if(policy==='refine')value+=(o.state.deck!.exhaust.length-s.deck!.exhaust.length)*3+(card&&DEBATE_CARDS[card.id].hindrance?4:0);
  if(o.action==='end-round')value-=1;
  if(n.food<base.food)value-=1;
  return value;
 };
 return options.reduce((a,b)=>score(a)>=score(b)?a:b).action;
}
export function deckRewardPolicy(run:RunState,policy:DebatePolicy='immediate'):void{
 if(run.pending.kind!=='debateReward')return;const b=run.debateBuild;
 const removable=b.cards.find(c=>!c.owner&&DEBATE_CARDS[c.id].family==='pressure');
 if(policy==='refine'&&removable&&b.cards.filter(c=>!c.owner).length>4){chooseDeckReward(run,'remove:'+removable.uid);return;}
 const upgrade=b.cards.find(c=>!c.upgrade&&DEBATE_CARDS[c.id].upgrades);
 if(policy==='stable'&&upgrade){chooseDeckReward(run,`upgrade:${upgrade.uid}:stable`);return;}
 if(policy==='chain'&&!b.seals.includes(run.pending.reward.seal)){chooseDeckReward(run,'seal:'+run.pending.reward.seal+(b.seals.length>=b.slots?':'+b.seals[0]:''));return;}
 if(b.cards.length>=12){chooseDeckReward(run,'skip');return;}
 chooseDeckReward(run,'add:'+run.pending.reward.offers[0]);
}
