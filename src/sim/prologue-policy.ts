import {OFFICERS,JOINT_CARDS} from '../data/personnel.ts';
import {NODES,RAISING_CARDS} from '../data/raising.ts';
import {prologueAction,startPrologue} from '../core/prologue.ts';
import {personnelOf,isRecruited} from '../core/personnel-rules.ts';
import {raisingOf,enterRaisingNode,playRaisingCard,canPlayRaising,chooseRaisingReward,selectRaisingPlan} from '../core/raising.ts';
import {raisingBotStep} from './raising-policy.ts';
import {newWorldCampaign} from '../core/world.ts';
import {saveCampaign,loadCampaign} from '../core/campaign-save.ts';
import {memoryKV} from '../core/save.ts';
import type {RunState} from '../core/types.ts';
export const PROLOGUE_POLICIES=['relations','military','intel','small','generalist','joint','random'] as const;
export type ProloguePolicy=typeof PROLOGUE_POLICIES[number];
export function prologueBotStep(r:RunState,policy:ProloguePolicy='relations',trace?:(kind:'personnel'|'raising',action:string,value?:string)=>void):boolean {
 const p=personnelOf(r)!,q=raisingOf(r)!;
 const act=(a:string)=>{trace?.('personnel',a);return prologueAction(r,a,p.revision).ok;};
 if(q.phase==='map'){
  for(const l of p.library)if(l.ownerType==='temporary'&&p.loadouts.raising.includes(l.uid)&&p.officers[l.owners[0]].proof&&p.loadouts.raising.length>6)return act(`equip:${l.uid}:raising`);
  for(const o of Object.values(p.officers))if(isRecruited(o)&&!p.party.includes(o.id)&&p.party.length<3)return act('party:'+o.id);
  if(policy==='joint')for(const l of p.library.filter(l=>l.sourceType==='joint'&&!p.loadouts.raising.includes(l.uid))){for(const owner of l.owners){const cards=p.loadouts.raising.map(uid=>p.library.find(c=>c.uid===uid)!).filter(c=>c.owners.includes(owner));if(cards.length>=2)return act(`equip:${cards[0].uid}:raising`);}return act(`equip:${l.uid}:raising`);}
  for(const l of p.library)if(l.ownerType==='personal'&&l.sourceType==='officer'&&(policy!=='joint'||!p.library.some(c=>c.sourceType==='joint'&&c.owners.includes(l.owners[0])))&&p.party.includes(l.owners[0])&&!p.loadouts.raising.includes(l.uid)&&p.loadouts.raising.length<(policy==='small'?9:13)&&!p.loadouts.raising.some(uid=>{const v=p.library.find(c=>c.uid===uid)!;return v.id===l.id;})){if(act(`equip:${l.uid}:raising`))return true;}
  for(const o of Object.values(p.officers))if(isRecruited(o)&&o.xp>=2&&!o.growth)return act(`growth:${o.id}:${policy==='military'?'authority':'expert'}`);
  if(policy==='joint')for(const j of JOINT_CARDS)if(j.owners.every(id=>p.party.includes(id)&&isRecruited(p.officers[id])&&p.officers[id].proof&&p.officers[id].trust>=45)&&!p.jointEvents.includes(j.id)&&r.campaign!.world!.preparation.food>=2)return act('joint:'+j.id);
  const nodes=q.route[q.step].filter(n=>!(r.campaign!.world!.preparation.exposure>=12&&n.lane===1&&!NODES[n.kind].rest));
  const scored=nodes.map(n=>{const id=p.encounters[n.id],o=p.officers[id],d=OFFICERS[id];return {n,score:(!isRecruited(o)&&p.stats.recruits<3?6:0)+(policy==='generalist'&&!d.major?10:0)+(policy==='joint'&&['chengpu','local_captain'].includes(id)?20:0)+(policy==='military'&&d.family==='military'?5:0)+(policy==='intel'&&d.family==='intel'?5:0)-NODES[n.kind].risk};}).sort((a,b)=>b.score-a.score);
  const id=(policy==='random'?nodes[(r.seed+q.step)%nodes.length]:scored[0].n).id;trace?.('raising','node',id);return enterRaisingNode(r,id).ok;
 }
 if(q.phase==='node'){
  const id=p.encounters[q.node!],o=p.officers[id];
  if(!isRecruited(o)&&!o.task&&q.power&&r.campaign!.world!.preparation[OFFICERS[id].task.resource]>=OFFICERS[id].task.cost)return act('task:'+id);
  if(o.task&&!o.cooperation)return act(`cooperate:${id}:${p.party.length<3?'card':'relation'}`);
  const support=q.hand.map(uid=>q.cards.find(c=>c.uid===uid)!).find(c=>c.id===OFFICERS[id].support&&canPlayRaising(r,c.uid,q.revision).ok);if(support&&!o.proof){trace?.('raising','play',String(support.uid));return playRaisingCard(r,support.uid,q.revision).ok;}
  if(o.task&&o.proof&&o.trust>=45&&!isRecruited(o)&&r.campaign!.world!.preparation.funds>=1)return act(`recruit:${id}:${policy==='military'?'b':'a'}`);
 }
 if(q.phase==='reward'){
  const rw=q.reward!,burden=q.cards.find(c=>RAISING_CARDS[c.id].burden);let action='resource';
  if(q.step===1&&burden&&q.cards.length>6)action='remove:'+burden.uid;
  else if(q.step%2===0&&q.schemes.length<2)action='scheme:'+rw.scheme;
  trace?.('raising','reward',action);return chooseRaisingReward(r,action,q.revision).ok;
 }
 if(q.phase==='plan'){
  if(!p.representative){const rep=policy==='military'?p.party.find(id=>OFFICERS[id].family==='military'&&isRecruited(p.officers[id]))??p.protagonistId:p.protagonistId;return act('elect:'+rep+':'+(p.party.find(id=>id!==rep&&isRecruited(p.officers[id]))??''));}
  if(!p.refined){const l=p.library.find(l=>p.loadouts.raising.includes(l.uid)&&!l.upgrade)!;return act('refine:'+l.uid);}
  const plan=policy==='military'?'barracks':policy==='intel'?'inside':'assembly';trace?.('raising','plan',plan);return selectRaisingPlan(r,plan,p.representative,q.revision).ok;
 }
 if(q.phase==='result'&&!p.doctrine)return act('doctrine:'+(policy==='military'?'strategy':'people'));
 const before=structuredClone(q),result=raisingBotStep(r,policy==='military'?'military':policy==='intel'?'intel':'balanced');if(trace){if(before.phase==='node'){if(before.event===null)trace('raising','choice','0');else if(raisingOf(r)!.phase==='reward')trace('raising','finish','');else if(q.played>before.played)trace('raising','play',String(before.hand.find(uid=>!q.hand.includes(uid))));else trace('raising','assist','');}else if(before.phase==='result')trace('raising','found','');else if(before.phase==='escape')trace('raising','recover','');}return result;
}
export function playPrologue(seed=131001,policy:ProloguePolicy='relations',reload=true){let r=newWorldCampaign(seed).activeExpedition!;startPrologue(r,'xingyang',policy==='military'?'zhangliao':policy==='intel'?'guojia':'chengong',policy==='military'?'militia':policy==='intel'?'official':'notable');const kv=memoryKV(),errors:string[]=[];let steps=0,restores=0;
 for(;steps<500&&raisingOf(r)!.phase!=='founded'&&r.campaign!.world!.stage!=='failed';steps++){if(!prologueBotStep(r,policy)){errors.push('stalled '+raisingOf(r)!.phase+'/'+raisingOf(r)!.step);break;}if(reload){saveCampaign(kv,r);const loaded=loadCampaign(kv);if(!loaded.ok){errors.push('restore '+raisingOf(r)!.phase+'/'+raisingOf(r)!.step);break;}r=loaded.data.activeExpedition!;restores++;}}
 return {r,steps,restores,errors,success:raisingOf(r)!.phase==='founded'};
}
