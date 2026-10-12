/**
 * 공동 호위 전투 패배 원인 분석. 같은 전투 시작 상태를 여러 조건으로 다시 실행해
 * 덱 자체·준비 임시 카드·드로우 편차·자동 정책·목표 선택·방비 순서·계약 보너스의 영향을 분리한다.
 * 자동 정책 결과이며 사람의 전투 판단을 대신하지 않는다.
 */
import {readFileSync} from 'node:fs';
import {botTurn} from './autoplay.ts';
import {playCard,canPlay,cardDef,endTurn,aliveEnemies,incomingEstimate} from '../core/combat.ts';
import {shuffle} from '../core/rng.ts';
import {CARDS} from '../data/cards.ts';
import type {BattleState,PlayTarget,Row} from '../core/types.ts';

export interface TurnLog {turn:number;hpStart:number;hand:string[];plays:string[];blockAfter:Record<Row,number>;incoming:number;taken:number;enemyHp:number[];deadCards:number}
function targets(b:BattleState){const out:{idx:number;target:PlayTarget}[]=[];b.hand.forEach((c,idx)=>{const d=cardDef(c);if(d.target==='enemy')for(const e of aliveEnemies(b))out.push({idx,target:{enemy:e.uid}});else if(d.target==='row')for(const row of ['front','rear'] as Row[])out.push({idx,target:{row}});else out.push({idx,target:{}});});return out.filter(c=>canPlay(b,c.idx,c.target).ok);}
function greedyRecorded(b:BattleState,plays:string[]){botTurn(b,plays);}
/** 더 깊은 정책: 이번 턴의 카드 사용 순서(최대 4장)를 전수 탐색해 턴 종료 후 상태로 평가한다. */
function deepTurn(b:BattleState){const score=(s:BattleState)=>s.result==='win'?1e6:s.result==='lose'?-1e6:s.hp*3-s.enemies.reduce((n,e)=>n+(e.dead?0:e.hp+e.block*.5),0)+s.enemies.filter(e=>e.dead).length*25;
 let best:{seq:{idx:number;target:PlayTarget}[];v:number}={seq:[],v:-Infinity};
 const search=(s:BattleState,seq:{idx:number;target:PlayTarget}[],depth:number)=>{const end=structuredClone(s);if(end.result==='ongoing')endTurn(end);const v=score(end);if(v>best.v)best={seq:[...seq],v};if(depth>=4||s.result!=='ongoing')return;for(const c of targets(s)){const n=structuredClone(s);playCard(n,c.idx,c.target);search(n,[...seq,c],depth+1);}};
 search(b,[],0);for(const c of best.seq){if(b.result!=='ongoing')break;playCard(b,c.idx,c.target);}if(b.result==='ongoing')endTurn(b);}
/** 목표 고정 정책: 탐욕 봇과 같되 공격은 가장 체력이 낮은 적에게만 준다. */
function focusTurn(b:BattleState){for(let g=0;g<20&&b.result==='ongoing';g++){const low=aliveEnemies(b).sort((a,c)=>a.hp-c.hp)[0];const opts=targets(b).filter(c=>c.target.enemy===undefined||c.target.enemy===low?.uid);if(!opts.length)break;let best:{c:typeof opts[number];v:number}|null=null;for(const c of opts){const n=structuredClone(b);playCard(n,c.idx,c.target);const inc=incomingEstimate(n);const v=(n.result==='win'?1e6:0)-n.enemies.reduce((s,e)=>s+(e.dead?0:e.hp),0)-(inc.front.net+inc.rear.net)*1.3+n.hp*1.5;if(!best||v>best.v)best={c,v};}const base=(()=>{const inc=incomingEstimate(b);return -b.enemies.reduce((s,e)=>s+(e.dead?0:e.hp),0)-(inc.front.net+inc.rear.net)*1.3+b.hp*1.5;})();if(!best||best.v<=base+0.1)break;playCard(b,best.c.idx,best.c.target);}if(b.result==='ongoing')endTurn(b);}
/** 방비 우선 정책: 방어 카드를 먼저 모두 쓰고 남은 기력으로 공격한다. */
function blockFirstTurn(b:BattleState){const isBlock=(id:string)=>CARDS[id].effects.some(e=>e.k.startsWith('block')||e.k==='counter');for(let g=0;g<20&&b.result==='ongoing';g++){const opts=targets(b);const blockOpt=opts.find(c=>isBlock(b.hand[c.idx].id));const c=blockOpt??opts.find(c=>!['unrest','rabble'].includes(b.hand[c.idx].id));if(!c)break;playCard(b,c.idx,c.target);}if(b.result==='ongoing')endTurn(b);}
export function runBattle(b0:BattleState,policy:'greedy'|'deep'|'focus'|'blockFirst'='greedy',record=false){const b=structuredClone(b0);const turns:TurnLog[]=[];for(let t=0;t<30&&b.result==='ongoing';t++){const hpStart=b.hp,hand=b.hand.map(c=>c.id),inc=incomingEstimate(b),plays:string[]=[];if(policy==='greedy')greedyRecorded(b,plays);else if(policy==='deep')deepTurn(b);else if(policy==='focus')focusTurn(b);else blockFirstTurn(b);if(record)turns.push({turn:t+1,hpStart,hand,plays,blockAfter:{...b.block},incoming:inc.front.net+inc.rear.net,taken:hpStart-b.hp,enemyHp:b.enemies.map(e=>e.dead?0:e.hp),deadCards:hand.filter(id=>['unrest','rabble'].includes(id)).length});}return {result:b.result,hp:b.hp,turns,dealt:b.stats.damageDealt};}
/** 손패·뽑을 더미를 다른 시드로 다시 섞어 드로우 편차를 본다. */
export function redeal(b0:BattleState,seed:number){const b=structuredClone(b0);b.rng=seed;const all=[...b.hand,...b.draw];const mixed=shuffle(b,all);b.hand=mixed.slice(0,b0.hand.length);b.draw=mixed.slice(b0.hand.length);return b;}
export function variant(b0:BattleState,mod:{removeUnrest?:boolean;openingBlock?:number;hpBonus?:number;addCards?:string[];noChain?:boolean;enemyHp?:number}){const b=structuredClone(b0);if(mod.enemyHp)for(const e of b.enemies){e.hp+=mod.enemyHp;e.maxHp+=mod.enemyHp;}if(mod.noChain&&b.flags.escortChain){b.flags.escortChain=0;b.block.front=Math.max(0,b.block.front-3);}if(mod.removeUnrest){b.hand=b.hand.filter(c=>c.id!=='unrest');b.draw=b.draw.filter(c=>c.id!=='unrest');while(b.hand.length<b0.hand.length&&b.draw.length)b.hand.push(b.draw.shift()!);}if(mod.openingBlock){b.block.rear+=mod.openingBlock;b.block.front+=mod.openingBlock;}if(mod.hpBonus){b.hp+=mod.hpBonus;b.maxHp+=mod.hpBonus;}for(const [i,id] of (mod.addCards??[]).entries())b.draw.push({uid:95000+i,id});return b;}
export function winRate(b0:BattleState,policy:'greedy'|'deep'|'focus'|'blockFirst',n:number,mod?:Parameters<typeof variant>[1]){let w=0;for(let i=0;i<n;i++){const b=redeal(mod?variant(b0,mod):b0,1000+i*7919);if(runBattle(b,policy).result==='win')w++;}return w/n;}
export function analyze(b0:BattleState){
 const exact=runBattle(b0,'greedy',true),deep=runBattle(b0,'deep'),focus=runBattle(b0,'focus'),blockFirst=runBattle(b0,'blockFirst');
 const N=60;
 return {start:{hp:b0.hp,energy:b0.energy,block:b0.block,hand:b0.hand.map(c=>c.id),draw:b0.draw.map(c=>c.id),enemies:b0.enemies.map(e=>({id:e.defId,hp:e.hp,intent:e.intent}))},
  exactGreedy:exact,sameSeed:{deep:deep.result,focus:focus.result,blockFirst:blockFirst.result},
  winRates:{greedy:winRate(b0,'greedy',N),deep:winRate(b0,'deep',20),focus:winRate(b0,'focus',N),blockFirst:winRate(b0,'blockFirst',N),greedyNoUnrest:winRate(b0,'greedy',N,{removeUnrest:true}),greedyContractBlock3:winRate(b0,'greedy',N,{openingBlock:3}),greedyHpPlus6:winRate(b0,'greedy',N,{hpBonus:6}),greedyPlusFormation:winRate(b0,'greedy',N,{addCards:['formation']})},
  chainAblation:{note:'deep=4수 탐색(방비→반격 카드 연쇄를 한 턴 안에서 계산), greedy=하한. noChain=호위 편성(시작 방비 3·반격 카드 생성) 제거, hp-6=병력 2 준비',rows:[['편성 연쇄',{}],['편성 없음',{noChain:true}],['편성 연쇄·병력 2',{hpBonus:-6}],['편성 없음·병력 2',{noChain:true,hpBonus:-6}]].map(([label,m])=>({label,greedy:winRate(b0,'greedy',N,m as Parameters<typeof variant>[1]),deep:winRate(b0,'deep',40,m as Parameters<typeof variant>[1])}))}};
}
if(import.meta.main){const path=process.argv[2];const b=path==="current"?await currentEscortBattle():JSON.parse(readFileSync(path,"utf8")).battle;console.log(JSON.stringify(analyze(b),null,1));}
/** 현재 규칙의 전위 빌드 공동 호위 전투 시작 상태(같은 시드). */
export async function currentEscortBattle(){const {runDianwei}=await import('./card-engine-builds.ts');const out=runDianwei(true);return out.battleStart!.battle!;}
