import {STRATAGEMS} from '../data/stratagems.ts';
import {PUZZLES} from '../data/card-puzzles.ts';
import {MARKS,MARK_CAP,ALERT_CAP} from '../data/card-grammar.ts';
import {TALENTS} from '../data/talents.ts';
import {DUEL_TACTICS} from './card-engine.ts';
const object=(x:unknown):x is Record<string,any>=>!!x&&typeof x==='object'&&!Array.isArray(x);
const int=(x:unknown,min=0,max=100000)=>typeof x==='number'&&Number.isInteger(x)&&x>=min&&x<=max;
const bag=(x:unknown)=>object(x)&&Object.entries(x).every(([m,n])=>MARKS.includes(m as never)&&int(n,0,m==='alert'?ALERT_CAP:MARK_CAP));
const strings=(x:unknown,max:number)=>Array.isArray(x)&&x.length<=max&&x.every(v=>typeof v==='string'&&v.length<=400);
/** 카드 엔진 저장 상태 검증. 손상·변조된 표식·장애·책략은 불러오지 않는다. */
export function validEngine(e:unknown):boolean {
 if(e===undefined)return true;if(!object(e)||e.version!==1)return false;
 if(!strings(e.stratagems,2)||new Set(e.stratagems).size!==e.stratagems.length||!e.stratagems.every((id:string)=>STRATAGEMS[id])||!int(e.stratagemSwaps,0,1000))return false;
 if(e.scene!==null&&(!object(e.scene)||typeof e.scene.location!=='string'||!bag(e.scene.marks)||!Array.isArray(e.scene.chain)||e.scene.chain.length>12||!object(e.scene.uses)||!Object.values(e.scene.uses).every(n=>int(n,0,20))||!int(e.scene.draws,0,3)||!int(e.scene.powerGain,0,2)))return false;
 if(!object(e.puzzles)||!Object.entries(e.puzzles).every(([id,p])=>PUZZLES[id]&&object(p)&&p.id===id&&['active','resolved','partial','failed'].includes(p.status)&&bag(p.marks)&&Array.isArray(p.obstacles)&&p.obstacles.length===PUZZLES[id].obstacles.length&&p.obstacles.every((o:any,i:number)=>object(o)&&o.id===PUZZLES[id].obstacles[i].id&&int(o.max)&&o.max===PUZZLES[id].obstacles[i].hp&&int(o.hp,0,o.max))&&(p.focus===null||PUZZLES[id].obstacles.some(o=>o.id===p.focus))&&(p.resolution===null||PUZZLES[id].resolutions.some(r=>r.id===p.resolution))))return false;
 if(!object(e.loadout)||!['opening','response','gambit'].every(s=>e.loadout[s]===null||DUEL_TACTICS[e.loadout[s]]?.slot===s))return false;
 if(!Array.isArray(e.arguments)||e.arguments.length>12||!Array.isArray(e.legacy)||e.legacy.length>40||!Array.isArray(e.battleCards))return false;
 if(!object(e.principles)||!Object.entries(e.principles).every(([id,v])=>TALENTS[id]&&['base','alt'].includes(v as string))||!object(e.growth)||!Object.entries(e.growth).every(([id,v])=>TALENTS[id]&&['add','upgrade','replace','principle'].includes(v as string)))return false;
 if(e.reward!==null&&(!object(e.reward)||!strings(e.reward.cards,3)||!strings(e.reward.stratagems,2)||!e.reward.stratagems.every((id:string)=>STRATAGEMS[id])))return false;
 if(!strings(e.rewardsTaken,10)||!Array.isArray(e.rests)||!object(e.stats)||!strings(e.log,60))return false;
 if(e.pact!==undefined&&e.pact!==null&&(!object(e.pact)||!TALENTS[e.pact.talent]||typeof e.pact.open!=='boolean'||!strings(e.pact.cards,4)||!strings(e.pact.stratagems,3)||!Array.isArray(e.pact.swaps)||e.pact.swaps.length>2||!(e.pact.stratagem===null||STRATAGEMS[e.pact.stratagem])))return false;
 if(e.telemetry!==undefined&&(!object(e.telemetry)||!object(e.telemetry.plays)||!Array.isArray(e.telemetry.sequences)||e.telemetry.sequences.length>20))return false;
 return true;
}
