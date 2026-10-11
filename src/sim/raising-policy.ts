import {RAISING_CARDS,NODES,PLANS,ALLIES} from '../data/raising.ts';
import {GENERALS} from '../data/generals.ts';
import {raisingOf,enterRaisingNode,raisingNodeChoice,playRaisingCard,finishRaisingNode,chooseRaisingReward,selectRaisingPlan,actRaisingGate,finishRaisingGate,foundRaisingFaction,recoverRaising,previewRaisingCard,raisingAmount,raisingParticipants,assistRaisingNode} from '../core/raising.ts';
import {canDuelAction,previewDuelAction} from '../core/duel.ts';
import {deckPolicyAction} from './debate-deck-policy.ts';
import {nextFloat} from '../core/rng.ts';
import type {RunState} from '../core/types.ts';
export type RaisingPolicy='cause'|'military'|'intel'|'balanced'|'quiet'|'fast'|'random';
export const RAISING_POLICIES:RaisingPolicy[]=['cause','military','intel','balanced','quiet','fast','random'];
function resourceValue(r:RunState,policy:RaisingPolicy){return raisingAmount(r,'funds')+raisingAmount(r,'food')*.8+raisingAmount(r,'troops')*(policy==='military'?.8:.35)+raisingAmount(r,'support')*(policy==='cause'?3:1.2)+raisingAmount(r,'legitimacy')*(policy==='cause'?2:1)+raisingAmount(r,'intel')*(policy==='intel'?2:1)+raisingAmount(r,'influence')*(policy==='intel'?2:.8)+raisingAmount(r,'training')*(policy==='military'?3:1)-raisingAmount(r,'exposure')*(policy==='quiet'?3:.5)-raisingAmount(r,'debt')*.7;}
export function raisingBotStep(r:RunState,policy:RaisingPolicy='balanced'):boolean {
 const q=raisingOf(r);if(!q)return false;
 if(q.phase==='map'){
  if(policy==='fast'&&q.step>=3){q.phase='plan';q.revision++;return true;}
  const nodes=q.route[q.step].filter(n=>!(raisingAmount(r,'exposure')>=12&&n.lane===1&&!NODES[n.kind].rest));
  const preferred=policy==='military'?'military':policy==='intel'?'intel':policy==='cause'?'cause':null;
  const ranked=nodes.map(n=>({n,value:(preferred&&NODES[n.kind].families.includes(preferred)?3:0)-NODES[n.kind].risk+(q.step<2&&NODES[n.kind].ally==='elder'?1:0)})).sort((a,b)=>b.value-a.value);const n=policy==='random'?nodes[Math.floor(nextFloat(q)*nodes.length)]:ranked[0].n;return enterRaisingNode(r,n.id).ok;
 }
 if(q.phase==='node'){
  if(q.event===null)return raisingNodeChoice(r,0,q.revision).ok;
  const options=q.hand.map(uid=>({uid,...previewRaisingCard(r,uid)})).filter(o=>o.check.ok).map(o=>({...o,value:resourceValue(o.state,policy)-resourceValue(r,policy)+(raisingOf(o.state)!.stats.chains-q.stats.chains)*2})).sort((a,b)=>b.value-a.value);
  if(options.length&&q.played<10){const choice=policy==='random'?options[Math.floor(nextFloat(q)*options.length)]:options[0];return playRaisingCard(r,choice.uid,q.revision).ok;}
  if(q.progress<NODES[q.route.flat().find(n=>n.id===q.node)!.kind].need){
   // A finite emergency contribution, not an endlessly repeatable event.
   return assistRaisingNode(r,q.revision).ok;
  }
  return finishRaisingNode(r,q.revision).ok;
 }
 if(q.phase==='reward'){
  const rw=q.reward!;let action='skip';const burden=q.cards.find(c=>RAISING_CARDS[c.id].burden),upgrade=q.cards.find(c=>!c.upgrade&&RAISING_CARDS[c.id].family===(policy==='military'?'military':policy==='intel'?'intel':'cause'));
  if(q.step===0&&!ALLIES[rw.ally].regional&&!q.allies.includes(rw.ally)&&q.allies.length<2||q.step===0&&ALLIES[rw.ally].regional&&!q.regional)action='ally:'+rw.ally;
  else if(q.step===1)action='add:'+rw.cards[0];
  else if(q.step===2&&upgrade)action=`upgrade:${upgrade.uid}:${policy==='military'?'bold':'quiet'}`;
  else if(q.step===3&&burden)action='remove:'+burden.uid;
  else if(q.schemes.length<2&&!q.schemes.includes(rw.scheme))action='scheme:'+rw.scheme;
  else if(raisingAmount(r,'food')<6||raisingAmount(r,'funds')<2)action='resource';
  else if(policy==='random')action=['skip','add:'+rw.cards[Math.floor(nextFloat(q)*3)],'resource'][Math.floor(nextFloat(q)*3)];
  return chooseRaisingReward(r,action,q.revision).ok;
 }
 if(q.phase==='plan'){
  const plan=policy==='military'?'barracks':policy==='intel'?'inside':policy==='random'?Object.keys(PLANS)[Math.floor(nextFloat(q)*3)]:'assembly';
  const ids=raisingParticipants(r);const representative=plan==='assembly'?q.representative:ids.sort((a,b)=>(GENERALS[b].activities?.duel??0)-(GENERALS[a].activities?.duel??0))[0];return selectRaisingPlan(r,plan,representative,q.revision).ok;
 }
 if(q.phase==='debate'){const s=q.gate!.debate!;return s.result==='ongoing'?actRaisingGate(r,deckPolicyAction(s,policy==='quiet'?'stable':policy==='intel'?'chain':'immediate'),q.revision).ok:finishRaisingGate(r,q.revision).ok;}
 if(q.phase==='duel'){const s=q.gate!.duel!;if(s.result!=='ongoing')return finishRaisingGate(r,q.revision).ok;const actions=['strike','probe','guard','finisher',...(s.tactics??[])].filter(a=>canDuelAction(s,a,s.round).ok).map(a=>{const p=previewDuelAction(s,a).state;return {a,score:p.result==='win'?1000:p.result==='lose'?-1000:p.hp/p.maxHp-p.enemyHp/p.enemyMaxHp+p.momentum*.03};}).sort((a,b)=>b.score-a.score);return actRaisingGate(r,policy==='random'?actions[Math.floor(nextFloat(q)*actions.length)].a:actions[0].a,q.revision).ok;}
 if(q.phase==='result')return foundRaisingFaction(r,'검증 의군','#b95339',q.revision).ok;
 if(q.phase==='escape')return recoverRaising(r,q.revision).ok;
 return false;
}
export function playRaising(r:RunState,policy:RaisingPolicy='balanced',limit=500){let steps=0;const errors:string[]=[];for(;steps<limit;steps++){if(raisingOf(r)?.phase==='founded'||r.campaign!.world!.stage==='failed')break;if(!raisingBotStep(r,policy)){errors.push(`stalled ${raisingOf(r)?.phase}/${raisingOf(r)?.step}`);break;}}return {r,steps,errors,success:raisingOf(r)?.phase==='founded'};}
