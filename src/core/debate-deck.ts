import { DEBATE_CARDS,SEALS,archetype,COMMON_START } from '../data/debate-cards.ts';
import { shuffle,sample } from './rng.ts';
import type { DebateState,Check } from './social-types.ts';
import type { RunState,Pending } from './types.ts';
import type { Axis } from './accord-types.ts';
import type { DeckCampaign,DebateCard,Effect,Method,Operation,CounterKind } from './debate-deck-types.ts';
import type { DebateEvent,DebateEventKind } from './debate-events.ts';
import { fieldOperation,fieldScoreBonus,fieldTrustPenalty,onFieldCardPlayed,afterFieldAction,fieldEndRound,fieldPartialOk,fieldCostDelta,placementNeeded,parsePlacement,attackTargets,playerAlive } from './debate-field.ts';
/** 'card:<uid>' 또는 'card:<uid>:replace:<argId>' / 'card:<uid>:instant' */
export const cardUidOf=(action:string)=>Number(action.split(':')[1]);
export const COUNTER_TEXT:Record<CounterKind,string>={profit:'재협상 · 이익 요구 +1',safety:'재검토 · 안전 요구 +1',doubt:'의심 · 신뢰 −1, 버림패에 의심',burden:'책임 · 부담 상한 −1 (최소 1)',delay:'지연 · 손에 장황함 추가',review:'재심 · 최고 충족 요구 수치 −1'};
export function defaultDebateBuild():DeckCampaign{return {enabled:true,representative:null,assistant:null,cards:[],nextUid:1,seals:['forum'],slots:2,claimed:[],obligations:[]};}
export function switchRepresentative(build:DeckCampaign,id:string):{removed:string[];added:string[];size:number}{
 if(build.representative===id)return {removed:[],added:[],size:build.cards.length};
 const removed=build.cards.filter(c=>c.owner).map(c=>c.id);build.cards=build.cards.filter(c=>!c.owner);
 if(!build.representative&&build.cards.length===0)for(const card of COMMON_START)build.cards.push({uid:build.nextUid++,id:card});
 const added=archetype(id).unique;for(const card of added)build.cards.push({uid:build.nextUid++,id:card,owner:id});
 build.representative=id;return {removed,added,size:build.cards.length};
}
export function ensureRepresentative(build:DeckCampaign,id:string){if(build.representative!==id)switchRepresentative(build,id);}
export function activeCard(s:DebateState,uid:number){return s.deck?.cards.find(c=>c.uid===uid);}
export function cardDefinition(s:DebateState,action:string){const c=activeCard(s,cardUidOf(action));return c?DEBATE_CARDS[c.id]:undefined;}
export function cardText(c:DebateCard):string{const d=DEBATE_CARDS[c.id];return (c.upgrade?d.upgrades?.[c.upgrade]?.text:d.text)??d.text;}
function counterPattern(s:DebateState,elite:boolean):CounterKind[]{
 const pool:CounterKind[]=s.opponentId==='merchant'?['profit','doubt','burden','review','delay']:s.opponentId==='elder'?['safety','review','doubt','safety','burden']:['review','delay','doubt','profit','burden'];
 // All demands and the entire rule set are visible; only future ordering is revealed gradually.
 return [pool[0],...shuffle(s,pool.slice(1))].map((c,i)=>elite&&i===2?'delay':c);
}
export function startDeckDebate(s:DebateState,build:DeckCampaign,elite=false,agreement=false,world?:import('./world-types.ts').WorldState):void{
 if(world&&build.representative&&build.representative!==s.generalId){world.personalDebate??={};world.personalDebate[build.representative]=build.cards.filter(card=>card.owner===build.representative);build.cards=build.cards.filter(card=>!card.owner);}
 ensureRepresentative(build,s.generalId);
 if(world?.personalDebate?.[s.generalId]){build.cards=build.cards.filter(card=>card.owner!==s.generalId);build.cards.push(...world.personalDebate[s.generalId]);delete world.personalDebate[s.generalId];}
 const cards=structuredClone(build.cards);let uid=Math.max(build.nextUid,1);
 if(build.assistant){const id=build.assistant==='caoren'?'bond':'supplies';cards.push({uid:uid++,id,temporary:true});}
 if(agreement)cards.push({uid:uid++,id:'petition',temporary:true});
 const n=s.negotiation!;for(const axis of Object.keys(n.needs) as Axis[])n.needs[axis]=Math.min(10,n.needs[axis]!+2+(elite?1:0));
 n.burdenLimit=3;n.trustNeeded=3;s.resolve=3+(s.generalId==='guojia'?1:0);s.maxRounds=5;s.round=0;
 s.deck={cards,draw:shuffle(s,cards.filter(c=>c.mod!=='opening').map(c=>c.uid)),hand:cards.filter(c=>c.mod==='opening').map(c=>c.uid).slice(0,4),discard:[],exhaust:[],nextUid:uid,revision:0,assistant:build.assistant,seals:[...build.seals],counters:counterPattern(s,elite),counterIndex:0,revealed:s.generalId==='guojia'?2:1,guard:0,discount:0,amplify:0,played:0,previous:null,families:[],axisFamilies:{},uses:{},previousBurden:false,promises:[],withdrawn:false,elite,adviceUsed:false,lastCard:null,chain:0,receipt:'settled',stats:{plays:{},reshuffles:0,drawn:0,chains:0}};
 // More than four opening modifications still remain drawable; no cards disappear.
 const unplaced=cards.filter(c=>c.mod==='opening'&&!s.deck!.hand.includes(c.uid));s.deck.draw.push(...unplaced.map(c=>c.uid));
 draw(s,4-s.deck.hand.length);s.log.push('설전 덱: 5라운드, 집중 기본 3, 매 라운드 4장. 필수는 첫 요구와 신뢰 2, 완전 합의는 모든 공개 요구·신뢰 3·부담 상한. 조건부는 추가 의무/불리한 조항.');
 s.log.push('상대 반론 규칙: '+[...new Set(s.deck.counters)].map(c=>COUNTER_TEXT[c]).join(' / ')+(elite?' · 정예: 연속 같은 계열 수치 −1, 매 반론 방해 1장.':''));
}
function draw(s:DebateState,amount:number):void{
 const d=s.deck!;for(let i=0;i<Math.min(s.field?5:4,amount)&&d.hand.length<8;i++){
  if(!d.draw.length){if(!d.discard.length)break;d.draw=shuffle(s,d.discard.splice(0));d.stats.reshuffles++;}
  d.hand.push(d.draw.pop()!);d.stats.drawn++;
 }
}
function createCard(s:DebateState,id:string,to:'hand'|'discard'='hand'){const d=s.deck!;if(d.cards.length>=40||!DEBATE_CARDS[id])return;const c={uid:d.nextUid++,id,temporary:true};d.cards.push(c);if(to==='hand'&&d.hand.length<8)d.hand.push(c.uid);else d.discard.push(c.uid);}
export function deckCost(s:DebateState,c:DebateCard):number{return Math.max(0,DEBATE_CARDS[c.id].cost+(c.personnelCost??0)-(c.mod==='fleeting'?1:0)-(s.deck?.discount??0)+fieldCostDelta(s,c));}
export function deckActions(s:DebateState):string[]{if(!s.deck)return [];const f=s.field;const cards=s.deck.hand.flatMap(uid=>{const c=activeCard(s,uid)!;if(f&&placementNeeded(s,c))return [`card:${uid}:instant`,...playerAlive(f).map(a=>`card:${uid}:replace:${a.argumentId}`)];return ['card:'+uid];});
 return [...cards,...(f?attackTargets(f).filter(a=>a.argumentId!==f.focus).map(a=>'target:'+a.argumentId):[]),'end-round',...(s.deck.assistant&&!s.deck.adviceUsed?['advice']:[]),'settle'];}
export function canDeckAction(s:DebateState,action:string,revision:number):Check{
 const d=s.deck;if(!d||s.result!=='ongoing'||revision!==d.revision)return {ok:false,reason:'이미 처리한 입력이거나 종료된 설전입니다.'};
 if(['withdraw','end-round','settle'].includes(action))return {ok:true};
 if(action==='advice')return d.assistant&&!d.adviceUsed?{ok:true}:{ok:false,reason:'보좌 조언은 설전당 1회입니다.'};
 if(action.startsWith('target:')){const f=s.field;return f&&attackTargets(f).some(a=>a.argumentId===action.slice(7))?{ok:true}:{ok:false,reason:'겨눌 수 있는 상대 논거가 아닙니다.'};}
 const c=activeCard(s,cardUidOf(action));if(!action.startsWith('card:')||!c||!d.hand.includes(c.uid))return {ok:false,reason:'현재 손에 없는 카드입니다.'};
 const definition=DEBATE_CARDS[c.id];if(definition.owner&&definition.owner!==s.generalId)return {ok:false,reason:'현재 대표의 고유 카드가 아닙니다.'};
 if(d.played>=12)return {ok:false,reason:'라운드 카드 사용 상한 12회입니다. 라운드를 마치세요.'};
 if(s.resolve<deckCost(s,c))return {ok:false,reason:'집중이 부족합니다. 라운드 종료 후 회복하세요.'};
 if(definition.effects.some(e=>e.operations.some(op=>op.kind==='food'&&s.negotiation!.food+op.amount<0)))return {ok:false,reason:'즉시 담보로 지급할 군량 2가 필요합니다.'};
 if(definition.effects.some(e=>e.operations.some(op=>op.kind==='promise'&&d.promises.includes(op.promise))))return {ok:false,reason:'동일 약속은 이미 체결했습니다. 중복 약속할 수 없습니다.'};
 if(s.field){const pl=parsePlacement(action);if(pl.mode==='replace'&&!playerAlive(s.field).some(a=>a.argumentId===pl.argId))return {ok:false,reason:'교체할 내 논거를 고르세요.'};if(pl.mode==='auto'&&placementNeeded(s,c))return {ok:false,reason:'내 논거 자리 3개가 모두 찼습니다. 교체할 논거를 고르거나, 즉시 효과로 쓰거나, 사용을 취소하세요.'};}
 return {ok:true};
}
export function deckGrade(s:DebateState):'success'|'partial'|'failure'{
 const d=s.deck!,n=s.negotiation!;const all=Object.entries(n.needs).every(([a,v])=>n.scores[a as Axis]>=v!);
 const broken=!!s.field?.stats.coreBroken;
 if(!broken&&s.trust>=n.trustNeeded&&n.burden<=n.burdenLimit&&all&&!d.cards.some(c=>c.id==='unsettled'&&!d.exhaust.includes(c.uid)))return 'success';
 const first=Object.keys(n.needs)[0] as Axis;
 return s.trust>=2&&n.scores[first]>=n.needs[first]!&&n.burden<=n.burdenLimit+1&&fieldPartialOk(s)?'partial':'failure';
}
export function resolveDeckAction(s:DebateState,action:string,revision:number):Check{
 const check=canDeckAction(s,action,revision);if(!check.ok)return check;
 const d=s.deck!,n=s.negotiation!,events:DebateEvent[]=[];let budget=48;d.chain=0;
 const emit=(kind:DebateEventKind,target:string,value:number,resource:string,reason:string,source=s.generalId)=>events.push({kind,target,value,resource,reason,source,visualPriority:kind==='debateResolved'?3:2,sequence:events.length});
 let c:DebateCard|undefined, family:Method|undefined,paid=false,answered=false,burdenGained=false,exhaust=false;
 const scalar=(op:Operation)=>!['copy','generate','draw','focus','exhaustHand','reclaim','amplify','argument','expose','redirect','delay','unlock','convert','exact'].includes(op.kind);
 const placement=parsePlacement(action);
 const operation=(op:Operation,source:string,depth=0):void=>{
  if(--budget<0||depth>6){s.log.push('연쇄 처리 상한: 추가 발동을 생략했습니다.');return;}
  d.chain=Math.max(d.chain,depth);
  if(s.field&&fieldOperation(s,op,c,family,placement))return;
  if(op.kind==='score'){
   const axis=op.axis;let amount=op.amount;amount+=fieldScoreBonus(s,axis,amount);
   if(d.elite&&d.previous===family)amount=Math.max(0,amount-1);
   if(s.opponentId==='elder'&&family==='pressure')amount=Math.max(0,amount-1);
   const before=n.scores[axis];n.scores[axis]=Math.max(0,Math.min(30,before+amount));emit('argumentApplied',axis,n.scores[axis]-before,axis,source);(d.axisFamilies[axis]??=[]).push(family??'scheme');
   if(n.needs[axis]!==undefined&&before<n.needs[axis]!&&n.scores[axis]>=n.needs[axis]!)emit('requirementSatisfied',axis,0,axis,source);
   return;
  }
  switch(op.kind){
   case 'trust':{const before=s.trust;const doubt=(d.hand.some(uid=>activeCard(s,uid)?.id==='doubt')&&family==='trust'&&op.amount>0?1:0)+fieldTrustPenalty(s,op.amount);s.trust=Math.max(0,Math.min(20,s.trust+op.amount-doubt));emit('trustChanged','trust',s.trust-before,'trust',source);break;}
   case 'burden':{const before=n.burden;n.burden=Math.max(0,Math.min(12,n.burden+op.amount));burdenGained||=n.burden>before;emit('burdenChanged','burden',n.burden-before,'burden',source);if(n.burden>before)trigger(archetype(s.generalId).principles,'burden',depth+1);break;}
   case 'focus':s.resolve=Math.min(6,Math.max(0,s.resolve+op.amount));emit('argumentApplied',s.generalId,op.amount,'focus',source);break;
   case 'draw':{const before=d.hand.length;draw(s,op.amount);emit('followupUnlocked','hand',d.hand.length-before,'draw',source);break;}
   case 'food':n.food+=op.amount;if(op.amount<0){n.paid-=op.amount;paid=true;}emit('resourceSpent',s.generalId,op.amount,'food',source+' · 즉시 적용/환급 없음');break;
   case 'reports':n.reports=Math.min(4,Math.max(0,n.reports+op.amount));break;
   case 'guard':d.guard=Math.min(4,d.guard+op.amount);answered=true;emit('followupUnlocked','counter',op.amount,'guard',source+' · 다음 반론 방어');break;
   case 'discount':d.discount=Math.min(1,op.amount);break;
   case 'reveal':d.revealed=Math.min(d.counters.length,d.revealed+op.amount);break;
   case 'amplify':if(c){exhaust=true;for(const e of baseEffects(c))for(const copy of e.operations.filter(scalar))operation(copy,source+' · 추가 수치',depth+1);}break;
   case 'promise':if(!d.promises.includes(op.promise)){d.promises.push(op.promise);if(op.promise==='authority')n.promise=true;emit('followupUnlocked','promise',1,'promise',source+' · 원정 의무 생성');}break;
   case 'generate':createCard(s,op.card);break;
   case 'exhaustHand':{const uid=[...d.hand].sort((a,b)=>Number(!!DEBATE_CARDS[activeCard(s,b)!.id].hindrance)-Number(!!DEBATE_CARDS[activeCard(s,a)!.id].hindrance))[0];if(uid!==undefined){d.hand.splice(d.hand.indexOf(uid),1);d.exhaust.push(uid);emit('argumentApplied','exhaust',1,'exhaust',source+' · '+DEBATE_CARDS[activeCard(s,uid)!.id].name);}break;}
   case 'copy':{const definition=d.lastCard?DEBATE_CARDS[d.lastCard]:null;if(definition)for(const e of definition.effects)for(const copy of e.operations.filter(scalar))operation(copy,source+' · 직전 기본 수치 복사',depth+1);break;}
   case 'reclaim':{const uid=d.discard.pop();if(uid!==undefined&&d.hand.length<8)d.hand.push(uid);else if(uid!==undefined)d.discard.push(uid);break;}
  }
 };
 const trigger=(effects:Effect[],timing:Effect['timing'],depth=1)=>{for(const e of [...effects].sort((a,b)=>a.priority-b.priority)){
  if(e.timing!==timing||depth>6||budget<=0)continue;const condition=e.condition,key=e.source;
  if((d.uses[key]??0)>=e.limit)continue;
  if(condition?.previous&&d.previous!==condition.previous||condition?.family&&family!==condition.family||condition?.paid&&!paid||condition?.answered&&!answered||condition?.burdenBefore&&!d.previousBurden)continue;
  if(condition?.different&&new Set([...d.families.slice(-(condition.different-1)),...(family?[family]:[])]).size<condition.different)continue;
  d.uses[key]=(d.uses[key]??0)+1;emit('traitTriggered','chain',1,'chain',e.source);d.stats.chains++;for(const op of e.operations)operation(op,e.source,depth);
 }};
 const baseEffects=(card:DebateCard)=>card.upgrade?DEBATE_CARDS[card.id].upgrades?.[card.upgrade]?.effects??DEBATE_CARDS[card.id].effects:DEBATE_CARDS[card.id].effects;
 if(action.startsWith('target:')){s.field!.focus=action.slice(7);d.revision++;return {ok:true,events};}
 if(action==='withdraw'){d.withdrawn=true;s.result='failure';s.log.push('철회: 선지급 군량은 환급하지 않으며 기본 제안은 유지됩니다.');}
 else if(action==='settle')s.result=deckGrade(s);
 else if(action==='advice'){
  d.adviceUsed=true;emit('speechStarted',s.opponentId,0,'advice','보좌의 조언을 듣겠습니다.');
  if(d.assistant==='caoren')operation({kind:'trust',amount:2},'조인 · 설전당 1회');else{operation({kind:'guard',amount:2},'전위 · 설전당 1회');operation({kind:'score',axis:'safety',amount:1},'전위 호위');}
 }else if(action==='end-round'){
  if(s.field){const res=fieldEndRound(s,d.guard);d.guard=Math.max(0,d.guard-res.guardUsed);if(res.blocked)d.stats.countersBlocked=(d.stats.countersBlocked??0)+1;else d.stats.countersHit=(d.stats.countersHit??0)+1;emit('opponentCountered','counter',res.blocked?0:1,'counter',(res.blocked?'의도 차단 · ':'')+res.text,s.opponentId);}
  const counter=d.counters[d.counterIndex];const guarded=!s.field&&d.guard>0;if(!s.field){d.guard=Math.max(0,d.guard-1);if(guarded)d.stats.countersBlocked=(d.stats.countersBlocked??0)+1;else d.stats.countersHit=(d.stats.countersHit??0)+1;
  emit('opponentCountered','counter',guarded?0:1,'counter',guarded?'예고 반론에 대응해 차단했습니다.':COUNTER_TEXT[counter],s.opponentId);}
  if(!s.field&&!guarded){if(counter==='profit'||counter==='safety')n.needs[counter]=Math.min(12,(n.needs[counter]??0)+1);else if(counter==='doubt'){s.trust=Math.max(0,s.trust-1);createCard(s,'doubt','discard');}else if(counter==='burden')n.burdenLimit=Math.max(1,n.burdenLimit-1);else if(counter==='delay')createCard(s,'delay');else{const axis=(Object.keys(n.needs) as Axis[]).sort((a,b)=>n.scores[b]-n.scores[a])[0];n.scores[axis]=Math.max(0,n.scores[axis]-1);}}
  if(d.elite)createCard(s,s.round%2?'unsettled':'quibble','discard');
  s.round++;d.counterIndex++;if(s.round>=s.maxRounds)s.result=deckGrade(s);else{
   d.discard.push(...d.hand.splice(0));s.resolve=3;d.played=0;d.uses={};d.families=[];d.axisFamilies={};d.previous=null;d.previousBurden=false;d.discount=0;d.revealed=Math.min(d.counters.length,Math.max(d.revealed,d.counterIndex+(s.generalId==='guojia'?2:1)));draw(s,s.field?5:4);
  }
 }else{
  c=activeCard(s,cardUidOf(action))!;const definition=DEBATE_CARDS[c.id];family=definition.family;
  const cost=deckCost(s,c);s.resolve-=cost;d.discount=0;d.hand.splice(d.hand.indexOf(c.uid),1);d.played++;d.stats.plays[c.id]=(d.stats.plays[c.id]??0)+1;
  emit('actionUsed',c.id,0,'card',definition.name);emit('costSpent',s.generalId,-cost,'focus',definition.name);emit('speechStarted',s.opponentId,0,'card',`${definition.name}。${cardText(c)}`);
  if(d.hand.some(uid=>activeCard(s,uid)?.id==='quibble')&&d.previous===family)operation({kind:'burden',amount:1},'말꼬리 · 같은 계열');
  // Card effects are local to this play; their once-limit never blocks reshuffled card copies.
  for(const e of baseEffects(c)){
   if(e.condition?.previous&&d.previous!==e.condition.previous||e.condition?.burdenBefore&&!d.previousBurden)continue;
   for(const op of e.operations)operation(op,e.source);
  }
  if(c.inherited==='reveal')operation({kind:'reveal',amount:1},'전수된 정보 표식');if(c.inherited==='trust')operation({kind:'trust',amount:1},'전수된 신뢰 표식');
  trigger(archetype(s.generalId).principles,'after');for(const seal of d.seals)trigger(SEALS[seal].effects,'after');
  if(c.mod==='cycle')operation({kind:'draw',amount:1},'순환 개조');if(c.mod==='clean'){const uid=d.discard.find(uid=>DEBATE_CARDS[activeCard(s,uid)!.id].hindrance);if(uid!==undefined){d.discard.splice(d.discard.indexOf(uid),1);d.exhaust.push(uid);}}
  onFieldCardPlayed(s,c,family);afterFieldAction(s);
  d.previous=family;d.families.push(family);d.previousBurden=burdenGained;d.lastCard=c.id;exhaust||=!!definition.exhaust||c.mod==='fleeting';(exhaust?d.exhaust:d.discard).push(c.uid);
  for(const e of events.filter(e=>e.kind==='traitTriggered'||e.kind==='followupUnlocked'))s.log.push(e.reason);
  s.log.push(`${definition.name} → 집중 ${s.resolve} · 신뢰 ${s.trust} · 부담 ${n.burden}/${n.burdenLimit}${exhaust?' · 소멸':''}`);
 }
 d.revision++;s.agreement=Object.values(n.scores).reduce((a,b)=>a+b,0);d.receipt='settled';
 if(s.trust===0&&s.round>0)s.result='failure';
 if(s.result!=='ongoing')emit('debateResolved',s.opponentId,0,s.result,deckFailureReason(s));
 else if(action!=='end-round')emit('opponentResponded',s.generalId,0,'dialogue','다음 반론을 확인하고 논거를 이어보십시오.',s.opponentId);
 s.dialogueLog=[...(s.dialogueLog??[]),...events.filter(e=>e.kind==='speechStarted'||e.kind==='opponentResponded'||e.kind==='opponentCountered').map(e=>({source:e.source,round:Math.min(4,s.round),text:e.reason.slice(0,500)}))].slice(-10);
 return {ok:true,events};
}
export function deckFailureReason(s:DebateState){const n=s.negotiation!,d=s.deck!;return (d.withdrawn?'철회. ':Object.entries(n.needs).filter(([k,v])=>n.scores[k as Axis]<v!).map(([k,v])=>`${k} ${n.scores[k as Axis]}/${v}`).join(' · ')||'요구 충족')+` · 신뢰 ${s.trust}/${n.trustNeeded} · 부담 ${n.burden}/${n.burdenLimit}${d.cards.some(c=>c.id==='unsettled'&&!d.exhaust.includes(c.uid))?' · 미결 조항 처리 필요':''}`;}
export function deckPreview(s:DebateState,action:string){const state=structuredClone(s);return {check:resolveDeckAction(state,action,s.deck!.revision),state};}
export function offerDeckReward(run:RunState,then:Pending,result:'success'|'partial',elite=false):void{
 const build=run.debateBuild!,token=`deck:${run.floor}:${run.col}`;if(build.claimed.includes(token))return;
 const profile=archetype(build.representative??'guojia');const pool=Object.values(DEBATE_CARDS).filter(c=>!c.hindrance&&(!c.owner||c.owner===build.representative));
 const specialist=sample(run,pool.filter(c=>profile.families.includes(c.family)),1);const other=sample(run,pool.filter(c=>!specialist.includes(c)),2);const seals=Object.keys(SEALS).filter(id=>!build.seals.includes(id));
 run.pending={kind:'debateReward',reward:{token,offers:[...specialist,...other].map(c=>c.id),seal:sample(run,seals.length?seals:Object.keys(SEALS),1)[0],result,elite},then};
}
export function chooseDeckReward(run:RunState,choice:string):Check{
 const p=run.pending,b=run.debateBuild;if(!b||p.kind!=='debateReward'||b.claimed.includes(p.reward.token))return {ok:false,reason:'이미 처리한 보상입니다.'};
 const [kind,id,branch]=choice.split(':');const card=b.cards.find(c=>c.uid===Number(id));if(card?.personnelCard!==undefined&&['upgrade','mod','transfer'].includes(kind))return {ok:false,reason:'개인 카드의 성장은 인재 화면에서 선택하세요. 공용 카드에 전수할 수 없습니다.'};
 if(kind==='add'){if(!p.reward.offers.includes(id)||b.cards.length>=20)return {ok:false,reason:'제시된 카드만 선택 가능하며 덱 상한은 20장입니다.'};b.cards.push({uid:b.nextUid++,id,...(DEBATE_CARDS[id].owner?{owner:b.representative!}:{})});}
 else if(kind==='upgrade'){if(!card||card.upgrade||!DEBATE_CARDS[card.id].upgrades||!['stable','linked'].includes(branch))return {ok:false,reason:'강화 가능한 카드와 두 분기를 선택하세요.'};card.upgrade=branch as 'stable'|'linked';}
 else if(kind==='remove'){if(!card||card.owner||b.cards.filter(c=>!c.owner).length<=4)return {ok:false,reason:'고유 카드 제외, 공용 덱 최소 4장을 유지하세요.'};if(card.personnelCard!==undefined&&run.campaign?.personnel)run.campaign.personnel.loadouts.debate=run.campaign.personnel.loadouts.debate.filter(uid=>uid!==card.personnelCard);b.cards=b.cards.filter(c=>c!==card);}
 else if(kind==='mod'){if(!card||card.mod||!DEBATE_CARDS[card.id].mods.includes(branch as never))return {ok:false,reason:'허용된 개조 1개만 적용합니다.'};card.mod=branch as DebateCard['mod'];}
 else if(kind==='transfer'){const target=b.cards.find(c=>c.uid===Number(branch));const family=card?DEBATE_CARDS[card.id].family:null;if(!card||!target||target===card||card.owner||target.inherited||b.cards.filter(c=>!c.owner).length<=4||!['information','trust'].includes(family??''))return {ok:false,reason:'공용 정보/신뢰 표식만 서로 다른 카드에 1회 전수합니다. 공용 최소 4장, 원본은 제거됩니다.'};target.inherited=family==='information'?'reveal':'trust';if(card.personnelCard!==undefined&&run.campaign?.personnel)run.campaign.personnel.loadouts.debate=run.campaign.personnel.loadouts.debate.filter(uid=>uid!==card.personnelCard);b.cards=b.cards.filter(c=>c!==card);}
 else if(kind==='seal'){if(id!==p.reward.seal||b.seals.includes(id))return {ok:false,reason:'제시된 새 인장을 선택하세요.'};if(b.seals.length>=b.slots){if(!b.seals.includes(branch))return {ok:false,reason:'교체할 인장을 선택하세요.'};b.seals[b.seals.indexOf(branch)]=id;}else b.seals.push(id);}
 else if(kind==='recover')run.food+=2;
 else if(kind!=='skip')return {ok:false,reason:'없는 보상입니다.'};
 b.claimed.push(p.reward.token);run.history.push(`설전 성장: ${choice}${p.reward.result==='partial'?' · 조건부 합의의 대가는 거래 조건에 유지':''}`);run.pending=p.then;return {ok:true};
}
export function onDeckMove(run:RunState):void{const b=run.debateBuild;if(!b)return;for(const o of b.obligations.filter(o=>o.status==='active'&&o.due<=run.floor)){if(o.kind==='ration'){if(run.food>=1){run.food--;o.status='fulfilled';run.social.relations.caravan=Math.min(2,run.social.relations.caravan+1);run.history.push('군량 약속 이행: 군량 −1, 상단 관계 +1.');}else{o.status='broken';run.social.relations.caravan=Math.max(-1,run.social.relations.caravan-1);run.history.push('군량 약속 미이행: 상단 관계 −1.');}}else{o.status='fulfilled';run.history.push('활동 권한 약속: 다음 전투 카드 보상 제한 유지.');}}}
