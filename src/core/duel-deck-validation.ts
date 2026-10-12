/** 대결 덱 저장 검증: 정의에 없는 카드·상대 카드, 더미 중복·누락, 범위 밖 수치는 불러오지 않는다. */
import {DUEL_CARDS,OPP_CARDS,DUEL_ARCHETYPES} from '../data/duel-cards.ts';
type Obj=Record<string,unknown>;
const obj=(x:unknown):x is Obj=>!!x&&typeof x==='object'&&!Array.isArray(x);
const int=(x:unknown,min=0,max=10000)=>Number.isInteger(x)&&Number(x)>=min&&Number(x)<=max;
const arr=(x:unknown):x is unknown[]=>Array.isArray(x);
const strings=(x:unknown,max=60):x is string[]=>arr(x)&&x.length<=max&&x.every(v=>typeof v==='string'&&v.length<=400);
const kinds=['attack','rush','jab','guard','counter','feint','step','recover','build','finisher','support','command','watch'];
const intent=(i:unknown)=>obj(i)&&int(i.uid,0,2000)&&typeof i.card==='string'&&Object.hasOwn(OPP_CARDS,i.card)&&kinds.includes(i.kind as string)&&int(i.amount,0,30)&&typeof i.concealed==='boolean';
export function validDuelDeck(d:unknown):boolean{
 if(!obj(d)||d.version!==1||typeof d.archetype!=='string'||!Object.hasOwn(DUEL_ARCHETYPES,d.archetype))return false;
 if(!arr(d.cards)||d.cards.length<1||d.cards.length>30||!d.cards.every(c=>obj(c)&&int(c.uid,1,999)&&typeof c.id==='string'&&Object.hasOwn(DUEL_CARDS,c.id)))return false;
 const piles=['draw','hand','discard','exhaust','tacticHand'].map(k=>d[k]);if(!piles.every(arr)||(d.hand as unknown[]).length>8||(d.tacticHand as unknown[]).length>3)return false;
 const all=piles.flat() as unknown[],ids=d.cards.map(c=>(c as Obj).uid);if(new Set(ids).size!==ids.length||all.length!==ids.length||new Set(all).size!==all.length||!all.every(u=>ids.includes(u)))return false;
 if(!int(d.nextUid,1,1000)||!int(d.revision,0,100000)||!int(d.points,0,3)||!int(d.pointsMax,1,3)||!int(d.handSize,1,6))return false;
 if(!arr(d.oppCards)||d.oppCards.length>20||!d.oppCards.every(c=>obj(c)&&int(c.uid,0,2000)&&typeof c.id==='string'&&Object.hasOwn(OPP_CARDS,c.id)))return false;
 const oppIds=d.oppCards.map(c=>(c as Obj).uid);if(!arr(d.oppDraw)||!arr(d.oppDiscard)||![...d.oppDraw,...d.oppDiscard].every(u=>oppIds.includes(u)))return false;
 if(!(d.intent===null||intent(d.intent))||!arr(d.upcoming)||d.upcoming.length>3||!d.upcoming.every(intent)||!int(d.revealed,0,3)||typeof d.conceal!=='boolean')return false;
 if(!int(d.oppMomentum,0,5)||!(d.oppStance===null||['offense','defense','lure'].includes(d.oppStance as string))||typeof d.oppOpening!=='boolean'||!int(d.oppNextBonus,0,20)||!int(d.fatigue,0,20)||!strings(d.injuries,6)||!d.injuries.every(i=>['minor','major'].includes(i))||!int(d.medicine,0,3)||!int(d.firstHitReduce,0,10))return false;
 if(!arr(d.reactions)||d.reactions.length>8||!strings(d.blocked,6)||!strings(d.nextBlocked,6)||typeof d.readThisExchange!=='boolean'||!int(d.blindPenalty,0,30)||typeof d.secondReady!=='boolean'||typeof d.holdGuard!=='boolean'||typeof d.formalized!=='boolean'||!int(d.drawRank,0,3)||!strings(d.officers,6)||!strings(d.principleUsed,6)||!strings(d.prepared,30)||!arr(d.played)||d.played.length>20||!int(d.attackExchanges,0,20)||!obj(d.stats))return false;
 return true;
}
