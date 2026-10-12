import {RAISING_CARDS,ORIGINS,REPRESENTATIVES,ALLIES,SCHEMES,NODES,PLANS} from '../data/raising.ts';
import {GENERALS} from '../data/generals.ts';
import {activity} from './save-validation.ts';
import type {RunState} from './types.ts';
import {validEngine} from './card-engine-validation.ts';
const object=(x:unknown):x is Record<string,any>=>!!x&&typeof x==='object'&&!Array.isArray(x);
const int=(x:unknown,min=0,max=100000)=>typeof x==='number'&&Number.isInteger(x)&&x>=min&&x<=max;
const strings=(x:unknown,max=200)=>Array.isArray(x)&&x.length<=max&&x.every(s=>typeof s==='string'&&s.length<=10000);
const unique=(x:any[])=>new Set(x).size===x.length;
export function validRaising(r:RunState):boolean {
 const p=r.campaign?.personnel;const w=r.campaign?.world;if(!w?.raising)return true;const q=w.raising;
 if(!object(q)||q.version!==1||!int(q.seed,0,2147483647)||q.seed!==r.campaign!.seed||!int(q.rng,-2147483648,4294967295)||!Object.hasOwn(ORIGINS,q.origin)||(p?!Object.hasOwn(GENERALS,q.representative):!Object.hasOwn(REPRESENTATIVES,q.representative)||q.representative!==w.founder)||(!p&&(!Object.hasOwn(ALLIES,q.assistant)||ALLIES[q.assistant].regional))||!['map','node','reward','plan','debate','duel','result','escape','founded'].includes(q.phase)||!int(q.step,0,6)||q.length!==6||!int(q.revision)||!int(q.attempt,0,1)||!int(q.nextUid,1)||!int(q.power,0,5)||!int(q.played,0,12)||!int(q.progress,0,20)||!int(q.discount,0,3)||!int(q.revealed,0,6))return false;
 if(!['legitimacy','intel','training','influence'].every(k=>int(q[k as keyof typeof q],0,200))||!object(q.uses)||!Object.values(q.uses).every(n=>int(n,0,12)))return false;
 if(!Array.isArray(q.cards)||q.cards.length<6||q.cards.length>30||!q.cards.every(c=>object(c)&&int(c.uid,1,q.nextUid-1)&&Object.hasOwn(RAISING_CARDS,c.id)&&(!RAISING_CARDS[c.id].owner||RAISING_CARDS[c.id].owner===q.representative)&&(!c.upgrade||['bold','quiet'].includes(c.upgrade))&&(!c.mod||['opening','fleeting','cycle'].includes(c.mod)))||!unique(q.cards.map(c=>c.uid)))return false;
 const piles=[q.draw,q.hand,q.discard,q.exhaust];if(!piles.every(p=>Array.isArray(p)&&p.every(uid=>int(uid,1,q.nextUid-1)))||q.hand.length>8)return false;const all=piles.flat();if(all.length!==q.cards.length||!unique(all)||all.some(uid=>!q.cards.some(c=>c.uid===uid)))return false;
 if(!strings(q.allies,2)||!q.allies.every(id=>Object.hasOwn(ALLIES,id)&&!ALLIES[id].regional)||(!p&&!q.allies.includes(q.assistant))||!unique(q.allies)||!(q.regional===null||Object.hasOwn(ALLIES,q.regional)&&ALLIES[q.regional].regional)||!strings(q.schemes,2)||!q.schemes.every(id=>Object.hasOwn(SCHEMES,id))||!unique(q.schemes))return false;
 if(!Array.isArray(q.route)||q.route.length!==6||!q.route.every((row,i)=>Array.isArray(row)&&row.length===3&&row.every((n,lane)=>object(n)&&typeof n.id==='string'&&Object.hasOwn(NODES,n.kind)&&n.row===i&&n.lane===lane&&typeof n.open==='boolean'))||!unique(q.route.flat().map(n=>n.id))||!strings(q.visited,6)||!unique(q.visited)||!q.visited.every(id=>q.route.flat().some(n=>n.id===id))||!strings(q.completed,6)||!unique(q.completed)||!q.completed.every(id=>q.visited.includes(id)))return false;
 if(!(q.node===null||q.visited.includes(q.node))||!(q.event===null||['0','1'].includes(q.event))||!(q.previous===null||['cause','network','funds','supply','military','intel','promise'].includes(q.previous))||!(q.previousId===null||Object.hasOwn(RAISING_CARDS,q.previousId)))return false;
 if(!strings(q.pledges,3)||!unique(q.pledges)||!q.pledges.every(p=>['autonomy','authority','ration'].includes(p))||!strings(q.log,100)||!strings(q.result,100)||typeof q.converted!=='boolean'||!(q.grade===null||['great','success','conditional','incomplete','escaped','lost'].includes(q.grade)))return false;
 if(q.reward!==null&&(!object(q.reward)||q.phase!=='reward'||q.reward.token!==q.node||!strings(q.reward.cards,3)||q.reward.cards.length!==3||!unique(q.reward.cards)||!q.reward.cards.every(id=>Object.hasOwn(RAISING_CARDS,id)&&!RAISING_CARDS[id].owner&&!RAISING_CARDS[id].burden)||!Object.hasOwn(SCHEMES,q.reward.scheme)||!Object.hasOwn(ALLIES,q.reward.ally)))return false;
 if(q.phase==='reward'&&!q.reward||q.phase==='node'&&!q.node||q.phase==='map'&&q.step>=6||q.phase==='founded'&&!q.converted||q.converted&&q.phase!=='founded'||q.phase==='escape'&&!['escaped','lost'].includes(q.grade??'')||q.phase==='result'&&(!q.grade||['escaped','lost'].includes(q.grade)))return false;
 if(!(q.plan===null||Object.hasOwn(PLANS,q.plan))||q.gate!==null&&(!object(q.gate)||!q.plan||typeof q.gate.representative!=='string'||!int(q.gate.support,0,2)||!int(q.gate.discount,0,3)||typeof q.gate.tacticRefund!=='boolean'||q.gate.debate!==null&&!activity(q.gate.debate,'debate')||q.gate.duel!==null&&!activity(q.gate.duel,'duel')||!(q.gate.debateGrade===null||['success','partial','failure'].includes(q.gate.debateGrade))||!(q.gate.duelGrade===null||['win','draw','lose','surrender'].includes(q.gate.duelGrade))))return false;
 if(q.phase==='debate'&&!q.gate?.debate||q.phase==='duel'&&!q.gate?.duel)return false;
 if(!object(q.stats)||!['plays','picks','allyPicks'].every(k=>object(q.stats[k as keyof typeof q.stats])&&Object.values(q.stats[k as keyof typeof q.stats]).every(n=>int(n,0,1000)))||!['skips','removes','upgrades','mods','chains','reshuffles','recoveries'].every(k=>int(q.stats[k as keyof typeof q.stats],0,1000)))return false;
 if(q.injuries!==undefined&&(!object(q.injuries)||!Object.entries(q.injuries).every(([id,n])=>Object.hasOwn(GENERALS,id)&&int(n,1,2))))return false;
 if(!validEngine(q.engine))return false;
 if(q.phase!=='founded'&&w.stage!=='preparing'&&w.stage!=='failed'||q.phase==='founded'&&w.stage==='preparing')return false;
 return true;
}
