/**
 * 대결 덱 규칙 엔진. 합마다 손패 4장·전술력 3으로 카드를 쓰고, 「합 마치기」에 상대 의도가 실행된다.
 * 거리·자세·빈틈·지원·과잉 무력·목표 등급은 대결 2판(v2) 상태와 통계를 그대로 쓴다.
 * 상대 행동은 원형별 상대 덱을 시드(s.rng)로 섞어 뽑고, 원형 규칙이 일부를 덮어쓴다. 화면은 결정을 하지 않는다.
 */
import {DUEL_CARDS,OPP_CARDS,DUEL_ARCHETYPES,DUEL_SUPPORT,type DuelCardDef,type Dist,type Stance} from '../data/duel-cards.ts';
import {DUEL_OPPONENTS} from '../data/social.ts';
import {shuffle} from './rng.ts';
import {enableDuelV2,DISTANCE_NAMES,STANCE_NAMES} from './duel.ts';
import type {Check,DuelState} from './social-types.ts';
import type {OppIntent} from './duel-deck-types.ts';

export interface DuelDeckSetup {objective:string;archetype:string;distance?:Dist;support?:number;profile?:string;maxRounds?:number;tactics?:string[];familyCard?:string|null;officers?:string[];
 conversions?:{text:string}[];revealFirst?:boolean;voidFirstWatch?:boolean;firstHitReduce?:number;medicine?:number;startGuard?:number;startMomentum?:number;oppStartMomentum?:number;oppStartGuard?:number;
 removeOpp?:string[];addOpp?:string[];concealFirst?:boolean;formalDraw?:boolean;weakSupport?:boolean;drawRank?:number}
const closer=(d:Dist):Dist=>d==='far'?'mid':'near';const farther=(d:Dist):Dist=>d==='near'?'mid':'far';
const card=(s:DuelState,uid:number)=>s.deck!.cards.find(c=>c.uid===uid);
export const duelCardDef=(s:DuelState,uid:number):DuelCardDef|undefined=>{const c=card(s,uid);return c?DUEL_CARDS[c.id]:undefined;};
const note=(notes:string[],t:string)=>notes.push(t);

/** 대결 덱을 켠다(대결 2판 위에). 덱 9~12장: 기본 8 + 계열 변형 1 + 전술 3 + 인재 지원. */
export function enableDuelDeck(s:DuelState,o:DuelDeckSetup):DuelState{
 enableDuelV2(s,o.objective,{distance:o.distance,support:o.support,profile:o.profile,maxRounds:o.maxRounds});s.enemyShield=o.oppStartGuard??0;s.loadout=undefined;
 const officers=(o.officers??[]).filter(id=>DUEL_SUPPORT[id]);if(officers.includes('xunyu'))s.maxRounds=Math.min(6,s.maxRounds+1);
 const ids=['probe','step_in','step_out','stance_def','parry','strike','stance_off','finisher'];const tactics=(o.tactics??[]).filter(t=>DUEL_CARDS[t]).slice(0,3);const supports=officers.map(id=>DUEL_SUPPORT[id].card);
 if(o.familyCard&&ids.length+tactics.length+supports.length<12)ids.push(o.familyCard);
 const all=[...ids,...tactics,...supports].slice(0,12);let uid=1;const cards=all.map(id=>({uid:uid++,id,source:ids.includes(id)?'기본':tactics.includes(id)?'전술':'인재 지원'}));
 const archetype=DUEL_ARCHETYPES[o.archetype]??DUEL_ARCHETYPES.assault;let oppIds=[...archetype.deck,...(o.addOpp??[])];for(const r of o.removeOpp??[]){const i=oppIds.indexOf(r);if(i>=0)oppIds.splice(i,1);}
 for(let i=0;i<(o.support??0);i++)oppIds.push('o_support');
 const oppCards=oppIds.map((id,i)=>({uid:900+i,id}));
 s.deck={version:1,archetype:archetype.id,cards,draw:shuffle(s,cards.map(c=>c.uid)),hand:[],discard:[],exhaust:[],nextUid:uid,revision:0,points:3,pointsMax:3,handSize:4,
  oppCards,oppDraw:shuffle(s,oppCards.map(c=>c.uid)),oppDiscard:[],intent:null,upcoming:[],revealed:o.revealFirst?1:0,conceal:!!o.concealFirst&&!officers.includes('guojia'),
  oppMomentum:o.oppStartMomentum??0,oppStance:null,oppOpening:false,oppOpeningAt:-1,openingAt:-1,oppNextBonus:0,fatigue:0,injuries:[],medicine:o.medicine??0,firstHitReduce:o.firstHitReduce??0,
  reactions:[],blocked:[],nextBlocked:[],readThisExchange:false,blindPenalty:0,secondReady:false,holdGuard:false,formalized:!!o.formalDraw,drawRank:o.drawRank??0,officers,principleUsed:[],prepared:(o.conversions??[]).map(c=>c.text),
  played:[],attackExchanges:0,stats:{cards:{},sequences:[],guardBreaks:0,parries:0,lures:0,probes:0,supportRemoved:0,cleanHits:0,forcedIntents:0,counterHits:0,log:[]}};
 if(o.voidFirstWatch)s.deck.prepared.push('첫 감시 카드 무효');if(o.weakSupport)s.deck.prepared.push('병사 지지 · 상대 지원 카드 약화');
 s.protection=(s.protection??0)+(o.startGuard??0);s.momentum=Math.min(5,s.momentum+(o.startMomentum??0));
 nextIntent(s,!!o.voidFirstWatch);drawHand(s);
 s.log.push(`대결 덱 ${cards.length}장(기본 ${ids.length}·전술 ${tactics.length}·인재 ${supports.length}) · 합마다 손패 4장·전술력 3. 상대: ${archetype.name} — ${archetype.text} (${archetype.weak})`);
 if(s.deck.prepared.length)s.log.push('준비 전환: '+s.deck.prepared.join(' · '));
 return s;
}
function drawHand(s:DuelState){const d=s.deck!;while(d.hand.length<d.handSize){if(!d.draw.length){if(!d.discard.length)break;d.draw=shuffle(s,d.discard.splice(0));}d.hand.push(d.draw.pop()!);}}
function oppDrawCard(s:DuelState,prefer?:string):number|undefined{const d=s.deck!;if(prefer){for(const pile of [d.oppDraw,d.oppDiscard]){const i=pile.findIndex(u=>d.oppCards.find(c=>c.uid===u)!.id===prefer);if(i>=0)return pile.splice(i,1)[0];}}
 if(!d.oppDraw.length){d.oppDraw=shuffle(s,d.oppDiscard.splice(0));}return d.oppDraw.pop();}
const POWER=(s:DuelState)=>DUEL_OPPONENTS[s.opponentId]?.power??6;
function intentFor(s:DuelState,uid:number):OppIntent{const d=s.deck!;const id=d.oppCards.find(c=>c.uid===uid)!.id;const k=OPP_CARDS[id].kind;
 const amount=k==='attack'?POWER(s):k==='rush'?4:k==='jab'?3:k==='finisher'?11:k==='feint'?2:k==='watch'?2:k==='guard'?5:k==='recover'?3:k==='build'?2:k==='support'?3:k==='step'?2:k==='counter'?3:1;
 return {uid,card:id,kind:k,amount:amount+(s.v2?.profile==='harsh'&&['attack','rush','finisher'].includes(k)?1:0),concealed:false};}
/** 다음 상대 의도: 원형 규칙(반격형은 연속 공격을 처벌)이 덮어쓴 뒤 상대 덱에서 뽑는다. */
function nextIntent(s:DuelState,voidWatch=false){const d=s.deck!;let prefer:string|undefined;
 if(d.archetype==='counter'&&d.attackExchanges>=2&&d.oppCards.some(c=>c.id==='o_counter'))prefer='o_counter';
 let uid=d.upcoming.length&&!prefer?d.upcoming.shift()!.uid:oppDrawCard(s,prefer);if(uid===undefined){d.intent=null;return;}
 if(voidWatch&&d.oppCards.find(c=>c.uid===uid)!.id==='o_watch'){d.oppDiscard.push(uid);uid=oppDrawCard(s)!;}
 d.intent=intentFor(s,uid);d.intent.concealed=d.conceal;d.conceal=false;fillUpcoming(s);}
function fillUpcoming(s:DuelState){const d=s.deck!;while(d.upcoming.length<Math.max(0,d.revealed-1)){const u=oppDrawCard(s);if(u===undefined)break;d.upcoming.push(intentFor(s,u));}}
export function intentLabel(s:DuelState,it:OppIntent|null):string{if(!it)return '없음';if(it.concealed)return '숨겨진 의도(감시)';if(it.dispersed)return '병사 해산 · 행동 없음';const c=OPP_CARDS[it.card];const reach=s.v2!.distance!=='far'?'':it.kind==='attack'?' · 원거리: 뛰어들며 −2':['jab','finisher','feint','watch'].includes(it.kind)?' · 원거리라 닿지 않음':'';
 const amt=it.kind==='attack'||it.kind==='rush'||it.kind==='jab'||it.kind==='feint'||it.kind==='watch'?` 피해 ${it.amount+s.deck!.oppNextBonus}`:it.kind==='finisher'?(s.deck!.oppMomentum>=2?` 피해 ${it.amount+s.deck!.oppNextBonus}`:' (기세 부족 → 기세 모으기)'):it.kind==='guard'||it.kind==='recover'||it.kind==='support'?` +${it.amount}`:'';
 return `${c.name}${amt}${reach}${it.forced?' (유인됨)':''}`;}
export function duelDeckActions(s:DuelState):string[]{const d=s.deck;if(!d||s.result!=='ongoing')return [];return [...d.hand.map(u=>'card:'+u),'end','surrender'];}

export function canDuelDeckAction(s:DuelState,action:string):Check{const d=s.deck!;
 if(s.result!=='ongoing')return {ok:false,reason:'끝난 대결입니다.'};if(action==='end'||action==='surrender')return {ok:true};
 if(!action.startsWith('card:'))return {ok:false,reason:'없는 대결 행동입니다.'};const uid=Number(action.slice(5));if(!d.hand.includes(uid))return {ok:false,reason:'손에 없는 카드입니다.'};
 const c=duelCardDef(s,uid)!;const v=s.v2!;
 if(d.blocked.includes(c.family))return {ok:false,reason:`상대 속임수로 이번 합 ${c.family} 카드가 봉쇄됨.`};
 if(d.points<c.cost)return {ok:false,reason:`전술력 ${c.cost} 필요(남은 ${d.points}).`};
 if(c.distanceRequirement&&!c.distanceRequirement.includes(v.distance))return {ok:false,reason:`거리 ${c.distanceRequirement.map(x=>DISTANCE_NAMES[x]).join('·')} 필요(지금 ${DISTANCE_NAMES[v.distance]}).`};
 if(c.stanceRequirement&&!c.stanceRequirement.includes(v.stance as Stance))return {ok:false,reason:`${c.stanceRequirement.map(x=>STANCE_NAMES[x]).join('·')} 자세 필요(지금 ${v.stance?STANCE_NAMES[v.stance]:'없음'}).`};
 if(c.momentumRequirement&&s.momentum<c.momentumRequirement)return {ok:false,reason:`기세 ${c.momentumRequirement} 필요(지금 ${s.momentum}).`};
 if(c.move==='in'&&v.distance==='near'&&!c.damage)return {ok:false,reason:'이미 근거리입니다.'};if(c.move==='out'&&v.distance==='far'&&!c.guard)return {ok:false,reason:'이미 원거리입니다.'};
 return {ok:true};
}
/** 내가 상대에게 주는 피해: 상대 방비가 먼저 받고(관통·깔끔한 제압 제외), 방비를 0으로 만들면 상대 자세가 무너진다. */
function deal(s:DuelState,amount:number,opts:{pierce?:boolean;clean?:boolean;guardOnly?:boolean;source:string},notes:string[]):number{
 const d=s.deck!,v=s.v2!;if(amount<=0)return 0;let rest=amount;const shield=s.enemyShield??0;
 if(!opts.pierce&&!opts.clean&&shield>0){const ab=Math.min(shield,opts.guardOnly?amount:rest);s.enemyShield=shield-ab;rest=opts.guardOnly?0:rest-ab;if(s.enemyShield===0){d.oppOpening=true;d.oppOpeningAt=s.round;d.stats.guardBreaks++;note(notes,'상대 방비가 깨져 자세가 무너짐(상대 빈틈)');principle(s,'dianwei',notes);}}
 else if(opts.guardOnly)rest=0;
 if(rest<=0)return 0;const before=s.enemyHp;s.enemyHp=Math.max(0,s.enemyHp-rest);const dealt=before-s.enemyHp;
 v.stats.dealt+=dealt;v.stats.maxHit=Math.max(v.stats.maxHit,rest);if(!opts.clean){v.stats.forceHit=Math.max(v.stats.forceHit??0,rest);if(s.enemyHp===0)v.stats.forceOverkill=Math.max(v.stats.forceOverkill??0,rest-before);}else d.stats.cleanHits++;
 if(s.enemyHp===0)v.stats.overkill=Math.max(0,rest-before);return dealt;}
/** 내가 받는 피해: 방비가 먼저 받는다. 체력 문턱을 넘으면 부상과 부담 카드. */
function take(s:DuelState,amount:number,why:string,notes:string[]):{taken:number;absorbed:number}{
 const d=s.deck!;if(amount<=0)return {taken:0,absorbed:0};let dmg=amount;if(d.firstHitReduce>0){const r=Math.min(dmg,d.firstHitReduce);dmg-=r;d.firstHitReduce=0;note(notes,`준비 전환으로 첫 피해 −${r}`);}
 const absorbed=Math.min(s.protection??0,dmg);s.protection=(s.protection??0)-absorbed;dmg-=absorbed;
 if(dmg>=s.hp&&d.secondReady){dmg=s.hp-1;d.secondReady=false;note(notes,'보좌 개입 · 체력 1로 버팀');}
 const before=s.hp;s.hp=Math.max(0,s.hp-dmg);s.v2!.stats.taken+=dmg;
 for(const [ratio,kind] of [[.5,'minor'],[.25,'major']] as const)if(before>s.maxHp*ratio&&s.hp<=s.maxHp*ratio&&s.hp>0){if(d.medicine>0){d.medicine--;note(notes,'치료 물자로 부상을 막음');continue;}d.injuries.push(kind);const c={uid:d.nextUid++,id:'pain',temporary:true,source:'부상'};d.cards.push(c);d.discard.push(c.uid);note(notes,`${kind==='major'?'중상':'부상'} · 「욱신거리는 상처」가 덱에 들어감`);}
 if(dmg||absorbed)note(notes,`${why} ${amount}${absorbed?` (방비 ${absorbed})`:''}`);return {taken:dmg,absorbed};}
function principle(s:DuelState,id:string,notes:string[]){const d=s.deck!;if(!d.officers.includes(id)||d.principleUsed.includes(id))return;
 if(id==='dianwei'){d.principleUsed.push(id);const c={uid:d.nextUid++,id:'counter_strike',temporary:true,source:'전위 원칙'};d.cards.push(c);if(d.hand.length<6)d.hand.push(c.uid);else d.draw.push(c.uid);note(notes,'전위 원칙 · 「맞받아치기」 카드 생성');}}
function removeSupport(s:DuelState,n:number,notes:string[]){const d=s.deck!;let left=n;for(const pile of [d.oppDraw,d.oppDiscard,d.upcoming.map(i=>i.uid)]){for(const u of [...pile]){if(left<=0)break;if(d.oppCards.find(c=>c.uid===u)?.id!=='o_support')continue;const i=pile.indexOf(u);pile.splice(i,1);d.upcoming=d.upcoming.filter(x=>x.uid!==u);d.oppCards=d.oppCards.filter(c=>c.uid!==u);left--;}}
 if(left>0&&d.intent?.card==='o_support'){d.oppCards=d.oppCards.filter(c=>c.uid!==d.intent!.uid);d.intent={...d.intent,card:'o_guard',kind:'guard',amount:0,dispersed:true};left--;note(notes,'이번 병사 지원이 흩어짐');}
 const removed=n-left;if(removed>0){s.v2!.support=Math.max(0,s.v2!.support-removed);d.stats.supportRemoved+=removed;note(notes,`상대 지원 카드 ${removed}장 제거`);}}

function playCard(s:DuelState,uid:number,notes:string[]){const d=s.deck!,v=s.v2!,c=duelCardDef(s,uid)!;const it=d.intent;
 d.points-=c.cost;d.hand.splice(d.hand.indexOf(uid),1);(c.exhaust?d.exhaust:d.discard).push(uid);d.played.push({id:c.id,family:c.family});d.stats.cards[c.id]=(d.stats.cards[c.id]??0)+1;v.stats.actions.push(c.id);
 if(c.id==='s_xunyu'){d.formalized=true;note(notes,'정식 조건 확정 · 무승부를 한 등급 높게 인정');}
 if(c.id==='s_lusu'){d.oppMomentum=Math.max(0,d.oppMomentum-2);}
 if(c.family==='간보기'){d.readThisExchange=true;d.stats.probes++;if(it?.concealed){it.concealed=false;note(notes,'숨긴 의도를 확인');}}
 if(c.move==='in')v.distance=closer(v.distance);if(c.move==='out')v.distance=farther(v.distance);
 if(c.stance){v.stance=c.stance;}
 let guard=c.guard??0;if(c.id==='step_out'&&(d.readThisExchange||d.revealed>0)&&it&&['attack','rush','finisher','jab'].includes(it.kind)){guard+=2;note(notes,'읽은 공격을 한 걸음 내주며 흘림(방비 +2)');}
 if(guard)s.protection=Math.min(20,(s.protection??0)+guard);if(c.id==='t_shield')d.holdGuard=true;
 if(c.reveal){d.revealed=Math.max(d.revealed,c.reveal);fillUpcoming(s);}
 if(c.draw)for(let i=0;i<c.draw;i++){if(!d.draw.length){if(!d.discard.length)break;d.draw=shuffle(s,d.discard.splice(0));}d.hand.push(d.draw.pop()!);}
 if(c.heal)s.hp=Math.min(s.maxHp,s.hp+c.heal);if(c.fatigue)d.fatigue=Math.max(0,d.fatigue+c.fatigue);
 // 피해
 let dealt=0;const dist=v.distance;
 if(c.guardDamage){const g=s.enemyShield??0;if(g>0)dealt+=deal(s,Math.min(g,c.guardDamage),{guardOnly:true,source:c.name},notes);}
 if(c.damage){let dmg=c.damage[dist]??0;if(c.id==='strike'&&v.stance==='offense')dmg+=2;
  if(c.momentumScale){dmg+=s.momentum*c.momentumScale;}
  if(c.clean==='opening'&&(v.opening||d.oppOpening)){dmg+=c.id==='finisher'?4:4;const src=v.opening?(v.openingSource??'빈틈'):'상대 자세 무너짐';v.opening=false;d.oppOpening=false;v.stats.openingsUsed++;note(notes,`${src}을 파고든 깔끔한 제압`);dealt+=deal(s,dmg+s.aptitude-1,{clean:true,source:c.name},notes);}
  else if(dmg>0){if(c.family==='승부수'&&it&&['attack','rush','finisher'].includes(it.kind)){d.blindPenalty+=c.id==='t_all_in'?6:4;v.stats.blindFinishers++;note(notes,'빈틈 없는 승부수 · 상대 공격을 맞받게 됨');}dealt+=deal(s,dmg+(c.family==='공세'||c.family==='승부수'?s.aptitude-1:0),{pierce:c.pierce,source:c.name},notes);}}
 if(c.consumeMomentum)s.momentum=c.consumeMomentum==='all'?0:Math.max(0,s.momentum-c.consumeMomentum);
 if(c.momentum)s.momentum=Math.min(5,s.momentum+c.momentum);
 if(c.removeSupport)removeSupport(s,c.removeSupport,notes);
 if(c.reaction==='second')d.secondReady=true;else if(c.reaction&&c.reaction!=='evade')d.reactions.push({kind:c.reaction,value:c.reactionValue??0,card:c.id});
 // 유인: 공격하지 않으려던 상대를 끌어냄
 if(c.reaction==='lure'&&it&&!['attack','rush','finisher','jab','feint','watch'].includes(it.kind)&&d.oppMomentum>=1){d.oppMomentum--;d.oppDiscard.push(it.uid);d.intent={uid:it.uid,card:'o_strike',kind:'attack',amount:POWER(s),concealed:false,forced:true};d.stats.forcedIntents++;note(notes,'허점에 끌려 상대가 공격으로 바꿈(기세 −1)');}
 // 반격형의 반격 태세: 공세·승부수 카드마다 반격
 if(it?.kind==='counter'&&(c.family==='공세'||c.family==='승부수')&&dealt>0){const r=take(s,3,'상대 반격 태세',notes);void r;d.stats.counterHits++;}
 if(dealt)note(notes,`${c.name} · 피해 ${dealt}`);
}
function resolveIntent(s:DuelState,notes:string[]):{dealt:number;taken:number;label:string}{
 const d=s.deck!,v=s.v2!;const it=d.intent;if(!it)return {dealt:0,taken:0,label:'없음'};it.concealed=false;const label=intentLabel(s,it);let taken=0,dealt=0;const hpBefore=s.enemyHp;
 const attackKinds=['attack','rush','jab','finisher','feint','watch'];let kind=it.kind;let amount=it.amount;
 if(kind==='finisher'&&!(d.oppMomentum>=2&&v.distance!=='far')){kind='build';amount=2;note(notes,'상대 필살 조건 부족 → 기세 모으기');}
 if(kind==='rush'){v.distance=closer(v.distance);note(notes,`상대 돌진 · ${DISTANCE_NAMES[v.distance]}`);}
 if(kind==='feint'&&d.readThisExchange){note(notes,'속임수를 읽어 무력화');kind='none' as never;}
 if(attackKinds.includes(kind)){
  if(v.distance==='far'&&kind==='attack'){v.distance='mid';amount=Math.max(0,amount-2);note(notes,'원거리 · 상대가 뛰어들며 약해진 강공(−2)');}
  if(v.distance==='far'){note(notes,'원거리 · 공격이 닿지 않음');}
  else{if(kind==='finisher')d.oppMomentum-=2;let dmg=amount+d.oppNextBonus+(v.distance==='near'&&kind==='attack'?1:0);d.oppNextBonus=0;
   const lure=d.reactions.find(r=>r.kind==='lure');if(lure){dmg=Math.ceil(dmg/2);v.distance='near';v.opening=true;v.openingSource='유인';d.openingAt=s.round;if(d.oppMomentum>0){d.oppMomentum--;s.momentum=Math.min(5,s.momentum+1);}d.stats.lures++;note(notes,'유인 성공 · 근거리 빈틈, 상대 기세를 빼앗음');}
   dmg+=d.blindPenalty;d.blindPenalty=0;
   const r=take(s,dmg,`상대 ${OPP_CARDS[it.card].name}`,notes);taken=r.taken;
   if(dmg>0&&r.taken===0){const react=d.reactions.filter(x=>x.kind==='parry'||x.kind==='counter');for(const x of react){const val=x.value+(s.counterBonus??0);v.opening=true;v.openingSource='방비';d.openingAt=s.round;v.stats.counters++;d.stats.parries++;dealt+=deal(s,val,{pierce:true,source:'반격'},notes);note(notes,`${DUEL_CARDS[x.card].name} 성공 · 반격 ${val}·빈틈`);
     if((s.counterBonus??0)>0&&v.support>0){removeSupport(s,1,notes);note(notes,'준비된 반격에 지켜보던 병사 지원이 흩어짐');}principle(s,'dianwei',notes);}}
   if(kind==='jab'&&v.opening&&d.openingAt<s.round){v.opening=false;note(notes,'상대 견제 · 내 빈틈이 닫힘');}
   if(kind==='jab')d.oppMomentum=Math.min(5,d.oppMomentum+1);if(kind==='feint'){d.nextBlocked=['수세'];note(notes,'속임수 · 다음 합 수세 카드 봉쇄');}if(kind==='watch'&&!d.officers.includes('guojia'))d.conceal=true;}
  d.oppStance='offense';
 }else switch(kind){
  case 'guard':if(amount)s.enemyShield=(s.enemyShield??0)+amount;d.oppStance='defense';break;
  case 'counter':s.enemyShield=(s.enemyShield??0)+2;d.oppStance='defense';break;
  case 'step':v.distance=farther(v.distance);s.enemyShield=(s.enemyShield??0)+2;d.oppStance='lure';break;
  case 'recover':s.enemyHp=Math.min(s.enemyMaxHp,s.enemyHp+3);s.enemyShield=(s.enemyShield??0)+3;d.oppStance='defense';break;
  case 'build':d.oppMomentum=Math.min(5,d.oppMomentum+2);d.oppNextBonus+=2;break;
  case 'support':s.enemyShield=(s.enemyShield??0)+(d.prepared.some(p=>p.startsWith('병사 지지'))?1:3);s.momentum=Math.max(0,s.momentum-1);note(notes,'병사들이 거듦 · 상대 방비 +, 내 기세 −1');break;
  case 'command':{d.oppMomentum=Math.min(5,d.oppMomentum+1);const sup=d.oppDiscard.findIndex(u=>d.oppCards.find(c=>c.uid===u)?.id==='o_support');if(sup>=0){d.oppDraw.push(d.oppDiscard.splice(sup,1)[0]);note(notes,'지휘 · 병사 지원을 다시 불러옴');}break;}
 }
 d.oppDiscard.push(it.uid);dealt+=Math.max(0,hpBefore-s.enemyHp-dealt);return {dealt,taken,label};
}
function endExchange(s:DuelState,notes:string[]){const d=s.deck!,v=s.v2!;const before={hp:s.hp,enemy:s.enemyHp};const cards=d.played.map(p=>DUEL_CARDS[p.id].name);
 const r=resolveIntent(s,notes);
 const attacked=d.played.some(p=>p.family==='공세'||p.family==='승부수');d.attackExchanges=attacked?d.attackExchanges+1:0;
 if(d.played.length)d.stats.sequences.push(d.played.map(p=>p.family).join('→'));
 d.stats.log.push({exchange:s.round+1,cards,intent:r.label,dealt:Math.max(0,before.enemy-s.enemyHp),taken:Math.max(0,before.hp-s.hp),distance:DISTANCE_NAMES[v.distance],stance:v.stance?STANCE_NAMES[v.stance]:'-',opening:v.opening,oppOpening:d.oppOpening,notes:[...notes]});if(d.stats.log.length>8)d.stats.log.shift();
 // 빈틈 만료: 만든 다음 합 끝까지
 if(v.opening&&d.openingAt<s.round){v.opening=false;note(notes,'쓰지 않은 빈틈이 닫힘');}if(d.oppOpening&&d.oppOpeningAt<s.round){d.oppOpening=false;}
 s.protection=d.holdGuard?(s.protection??0):v.stance==='defense'?Math.floor((s.protection??0)/2):0;d.holdGuard=false;
 if(DUEL_ARCHETYPES[d.archetype]?.growGuard)s.enemyShield=(s.enemyShield??0)+DUEL_ARCHETYPES[d.archetype].growGuard!;
 s.round++;v.stats.rounds++;v.stats.distances.push(v.distance);v.stats.stances.push(v.stance??'');v.stats.enemyActions.push(d.intent?.kind??'');if(v.revealed>0)v.revealed--;
 if(s.round>=3)d.fatigue++;
 d.discard.push(...d.hand.splice(0));d.reactions=[];d.played=[];d.readThisExchange=false;d.blindPenalty=0;d.blocked=d.nextBlocked;d.nextBlocked=[];
 d.points=d.pointsMax-(d.fatigue>=3?1:0);d.revealed=Math.max(0,d.revealed-1);
 if(s.hp===0&&s.enemyHp===0)s.result='draw';else if(s.hp===0)s.result='lose';else if(s.enemyHp===0)s.result='win';
 else if(s.round>=s.maxRounds){s.result=s.enemyHp*4<=s.enemyMaxHp&&s.hp*s.enemyMaxHp>s.enemyHp*s.maxHp?'win':s.hp*2<s.maxHp&&s.enemyHp*2>s.enemyMaxHp?'lose':'draw';note(notes,`${s.maxRounds}합 종료 · 상대 체력 25% 이하면 판정승, 아니면 무승부`);}
 if(s.result==='ongoing'){nextIntent(s);drawHand(s);}
}
export function resolveDuelDeckAction(s:DuelState,action:string):Check{const check=canDuelDeckAction(s,action);if(!check.ok)return check;const d=s.deck!,notes:string[]=[];
 if(action==='surrender'){s.result='surrender';s.log.push('기권.');d.revision++;return {ok:true};}
 if(action==='end'){endExchange(s,notes);s.log.push(`${s.round}합 · ${notes.join(' · ')||'조용한 합'}`);}
 else{const uid=Number(action.slice(5));const c=duelCardDef(s,uid)!;playCard(s,uid,notes);s.log.push(`${c.name} · ${notes.join(' · ')||c.text}`);
  if(s.enemyHp===0&&s.result==='ongoing'){s.result=s.hp>0?'win':'draw';s.round++;s.v2!.stats.rounds++;}else if(s.hp===0&&s.result==='ongoing'){s.result='lose';}}
 if(s.log.length>60)s.log.splice(0,s.log.length-60);d.revision++;return {ok:true};
}
export function previewDuelDeck(s:DuelState,action:string){const state=structuredClone(s);return {check:resolveDuelDeckAction(state,action),state};}
