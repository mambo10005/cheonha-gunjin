/**
 * 카드 엔진 플레이 도우미: 실제 명령(exploreAction·prologueAction·raising 관문)만 사용한다.
 * 빌드 검증 스크립트와 테스트가 공유한다. 실패한 명령은 이유와 함께 예외로 멈춘다.
 */
import {CITY_EXPLORATION_DEFS} from '../data/city-exploration.ts';
import {RAISING_CARDS} from '../data/raising.ts';
import {explorationOf,exploreAction,syncExploration} from '../core/city-exploration.ts';
import {startCityExploration} from '../core/city-exploration-start.ts';
import {newWorldCampaign} from '../core/world.ts';
import {personnelOf} from '../core/personnel-rules.ts';
import {raisingOf,selectRaisingPlan,actRaisingGate,finishRaisingGate,foundRaisingFaction} from '../core/raising.ts';
import {prologueAction} from '../core/prologue.ts';
import {engineOf,currentPuzzle} from '../core/card-engine.ts';
import {deckPolicyAction} from './debate-deck-policy.ts';
import {canDuelAction,previewDuelAction} from '../core/duel.ts';
import type {RunState} from '../core/types.ts';
import type {DuelState} from '../core/social-types.ts';

export const BUILD_SEED=141001;
export function freshRun(seed=BUILD_SEED,protagonist='chengong',origin:'notable'|'militia'|'official'='notable'):RunState {const r=newWorldCampaign(seed).activeExpedition!;const s=startCityExploration(r,'xingyang',protagonist,origin);if(!s.ok)throw new Error(s.reason);return r;}
export class Player {
 trail:string[]=[];r:RunState;
 constructor(r:RunState){this.r=r;}
 get x(){return explorationOf(this.r)!;}
 get q(){return raisingOf(this.r)!;}
 get p(){return personnelOf(this.r)!;}
 get e(){return engineOf(this.r)!;}
 act(a:string){const res=exploreAction(this.r,a,this.x.revision);if(!res.ok)throw new Error(`${a}: ${res.reason}`);syncExploration(this.r);this.trail.push(a);return this;}
 try(a:string){const res=exploreAction(this.r,a,this.x.revision);if(res.ok){syncExploration(this.r);this.trail.push(a);}return res;}
 officer(a:string){const res=prologueAction(this.r,a,this.p.revision);if(!res.ok)throw new Error(`officer ${a}: ${res.reason}`);this.trail.push('officer:'+a);return this;}
 visit(to:string){if(this.x.scene!=='map')this.act('leave');if(this.x.location!==to){const d=CITY_EXPLORATION_DEFS[this.x.cityId],queue=[[this.x.location]],seen=new Set<string>();let route:string[]=[];while(queue.length){const path=queue.shift()!,at=path.at(-1)!;if(at===to){route=path;break;}if(seen.has(at))continue;seen.add(at);for(const edge of d.links){const n=edge.a===at?edge.b:edge.b===at?edge.a:null;if(n&&!seen.has(n))queue.push([...path,n]);}}if(!route.length)throw new Error('no route '+to);for(const id of route.slice(1))this.act('move:'+id);}this.act('enter');return this;}
 /** 손패에서 카드 id로 사용. 없으면 false. */
 play(id:string){const c=this.q.cards.find(c=>c.id===id&&this.q.hand.includes(c.uid));if(!c)return false;this.act('card:'+c.uid);return true;}
 hand(){return this.q.hand.map(uid=>this.q.cards.find(c=>c.uid===uid)!.id);}
 /** 원하는 순서대로 손패에 있는 카드를 가능한 만큼 사용한다. */
 playAll(order:string[]){const used:string[]=[];for(const id of order){const c=this.q.cards.find(c=>c.id===id&&this.q.hand.includes(c.uid));if(!c)continue;const res=this.try('card:'+c.uid);if(res.ok)used.push(id);}return used;}
 puzzle(){return currentPuzzle(this.r);}
 cardName(id:string){return RAISING_CARDS[id]?.name??id;}
 debate(style:'stable'|'chain'='stable',gate=false){for(let i=0;i<200;i++){const s=gate?this.q.gate?.debate:this.x.debate;if(!s||s.result!=='ongoing')break;const a=deckPolicyAction(s,style);if(gate){const res=actRaisingGate(this.r,a,this.q.revision);if(!res.ok)throw new Error('gate debate '+res.reason);}else this.act('social:'+a);}return (gate?this.q.gate!.debate!:this.x.debate!).result;}
 duel(gate=false){for(let i=0;i<20;i++){const s=gate?this.q.gate?.duel:this.x.duel;if(!s||s.result!=='ongoing')break;const a=bestDuel(s);if(gate){const res=actRaisingGate(this.r,a,this.q.revision);if(!res.ok)throw new Error('gate duel '+res.reason);}else this.act('social:'+a);}return (gate?this.q.gate!.duel!:this.x.duel!).result;}
 plan(plan:string){const res=selectRaisingPlan(this.r,plan,this.p.representative!,this.q.revision);if(!res.ok)throw new Error('plan '+res.reason);this.trail.push('plan:'+plan);return this;}
 finishGate(){const res=finishRaisingGate(this.r,this.q.revision);if(!res.ok)throw new Error('finish '+res.reason);return this;}
 found(){const w=this.r.campaign!.world!;const res=foundRaisingFaction(this.r,w.factionName,w.flagColor,this.q.revision);if(!res.ok)throw new Error('found '+res.reason);return this;}
}
export function bestDuel(s:DuelState){const options=['gambit','strike','probe','guard','finisher',...(s.tactics??[])].filter(a=>canDuelAction(s,a,s.round).ok);return options.map(a=>{const n=previewDuelAction(s,a).state;return {a,v:n.result==='win'?1000:n.result==='lose'?-1000:n.hp/n.maxHp-n.enemyHp/n.enemyMaxHp+n.momentum*.03};}).sort((a,b)=>b.v-a.v)[0]?.a??'guard';}
