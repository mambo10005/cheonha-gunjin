/**
 * 논박진 규칙 엔진. 설전 덱(debate-deck.ts)의 카드 사용·라운드 종료에 붙어
 * 논거의 배치·보호·논박·파괴·공개, 상대 의도(시드 기반 의도 덱)와 청중 상태를 처리한다.
 * 모든 결정은 상태와 s.rng에서만 나오며 화면은 결과를 읽기만 한다.
 */
import {ARGUMENT_DEFS,INTENT_DEFS,DEBATE_ARCHETYPES,DEBATE_CONTEXTS,DEBATE_SUPPORT,FIELD_LIMITS,type ArgumentDef} from '../data/debate-field.ts';
import {DEBATE_CARDS} from '../data/debate-cards.ts';
import {shuffle} from './rng.ts';
import type {DebateState} from './social-types.ts';
import type {Axis} from './accord-types.ts';
import type {ArgumentState,DebateField,DebateIntent,ArgOwner} from './debate-field-types.ts';
import type {DebateCard,Operation,Method} from './debate-deck-types.ts';

export interface FieldSetup {context:string;officers:string[];evidence:string[];audience?:string[];factions?:string[];profile?:string;archetype?:string;ctx?:DebateField['ctx']}
const clamp=(v:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,v));
export const argDef=(a:ArgumentState):ArgumentDef=>ARGUMENT_DEFS[a.definitionId];
function note(f:DebateField,text:string){f.history.push(text);if(f.history.length>40)f.history.splice(0,f.history.length-40);}
export function fieldArgs(f:DebateField){return {player:[f.playerCore,...f.player],opponent:[f.opponentCore,...f.opponent],all:[f.playerCore,...f.player,f.opponentCore,...f.opponent,...f.audience,...f.hidden]};}
export function findArg(f:DebateField,id:string){return fieldArgs(f).all.find(a=>a.argumentId===id);}
const hasTag=(a:ArgumentState,t:string)=>argDef(a).tags.includes(t);
export const playerAlive=(f:DebateField,tag?:string)=>f.player.filter(a=>a.durability>0&&(!tag||hasTag(a,tag)));
const oppAlive=(f:DebateField,key:keyof ArgumentDef)=>[...f.opponent,...f.audience].filter(a=>a.durability>0&&argDef(a)[key]);

function makeArg(s:DebateState,f:DebateField,defId:string,owner:ArgOwner,source:string,core=false):ArgumentState{
 const d=ARGUMENT_DEFS[defId];let dur=d.durability;if(owner==='player'&&d.tags.includes('guarantee')&&f.officers.includes('dianwei'))dur+=1;
 const a:ArgumentState={argumentId:'arg'+(f.nextArg++),definitionId:defId,owner,source,durability:dur,maxDurability:dur,protection:0,hidden:owner==='hidden',exposed:false,expiresAt:null,core,placedRound:s.round,uses:0};
 applyLinks(s,a,1);return a;
}
/** 연결 요구·부담 한도 적용/해제(실제로 바뀐 만큼만 되돌림). */
function applyLinks(s:DebateState,a:ArgumentState,dir:1|-1){const n=s.negotiation!,d=argDef(a);if(a.hidden&&dir===1)return;
 if(dir===1){a.applied={};for(const [axis,v] of Object.entries(d.need??{}) as [Axis,number][]){if(n.needs[axis]===undefined)continue;const before=n.needs[axis]!;n.needs[axis]=clamp(before+v,1,12);a.applied[axis]=n.needs[axis]!-before;}
  if(d.burdenLimit){const before=n.burdenLimit;n.burdenLimit=clamp(before+d.burdenLimit,1,3);a.appliedLimit=n.burdenLimit-before;}}
 else{for(const [axis,v] of Object.entries(a.applied??{}) as [Axis,number][])if(n.needs[axis]!==undefined)n.needs[axis]=clamp(n.needs[axis]!-v,1,12);a.applied={};if(a.appliedLimit){n.burdenLimit=clamp(n.burdenLimit-a.appliedLimit,1,3);a.appliedLimit=0;}}
}
function addAudience(s:DebateState,f:DebateField,defId:string,source:string){
 const ex=f.audience.find(a=>a.definitionId===defId&&a.durability>0);if(ex){ex.durability=Math.min(3,ex.durability+1);ex.maxDurability=Math.max(ex.maxDurability,ex.durability);note(f,`${argDef(ex).name} 강해짐(${source})`);return;}
 f.audience=f.audience.filter(a=>a.durability>0);if(f.audience.length>=FIELD_LIMITS.audience){note(f,`청중 자리가 가득해 ${ARGUMENT_DEFS[defId].name}은 생기지 않음`);return;}
 f.audience.push(makeArg(s,f,defId,'audience',source));note(f,`청중 · ${ARGUMENT_DEFS[defId].name} 생김(${source})`);
}

/** 설전 시작: 원형·핵심 입장·상대 보조/숨은 논거·청중·증거 카드·인재 지원 카드·의도 덱. */
export function setupField(s:DebateState,setup:FieldSetup):DebateField|null{
 const c=DEBATE_CONTEXTS[setup.context]??(setup.context.startsWith('gate:')?null:{archetype:setup.archetype??'village',core:'pc_generic',title:'도시 설전'});if(!c||!s.negotiation||!s.deck)return null;
 const at=DEBATE_ARCHETYPES[c.archetype];const f:DebateField={version:1,archetype:at.id,context:setup.context,factions:setup.factions??[],profile:setup.profile??'standard',playerCore:null as unknown as ArgumentState,opponentCore:null as unknown as ArgumentState,player:[],opponent:[],audience:[],hidden:[],intents:[],pattern:[at.first,...shuffle(s,[...at.intents])],patternIndex:0,revealedIntents:setup.officers.includes('lusu')?1:0,focus:null,pressure:0,impatience:0,impatienceLimit:at.impatienceLimit,finalDemanded:false,locked:[],exposedDefs:[],nextArg:1,officers:[...setup.officers],supportUsed:[],preparedEvidence:[],lastOwner:null,opinion:0,privateInterest:0,roundFamilies:[],roundFirstArg:false,discountUsed:false,stats:{placed:0,instant:0,replaced:0,destroyedOpp:0,lost:0,protectedHits:0,exposed:0,blocked:0,intentsHit:0,coreBroken:false,oppCoreBroken:false,converted:0,attacks:0},history:[]};
 if(setup.ctx)f.ctx={...setup.ctx};
 s.field=f;
 // 요구의 일부를 상대 논거로 옮긴다: 기본 요구 −1, 상대 보조 논거가 살아 있는 동안 연결된 요구가 다시 오른다
 for(const k of Object.keys(s.negotiation.needs) as Axis[])s.negotiation.needs[k]=Math.max(2,s.negotiation.needs[k]!-1);
 f.playerCore=makeArg(s,f,c.core,'player','핵심 입장',true);f.opponentCore=makeArg(s,f,at.core,'opponent','핵심 주장',true);
 const supports=[...at.supports];if(at.id==='assembly'&&f.factions.includes('merchant'))supports.push('o_contract');
 for(const id of supports.slice(0,FIELD_LIMITS.opponent))f.opponent.push(makeArg(s,f,id,'opponent','상대 시작 논거'));
 f.hidden.push(makeArg(s,f,at.hidden[0],'hidden','숨은 이해관계'));
 for(const id of setup.audience??[])addAudience(s,f,id,'이전 사건');
 s.maxRounds=clamp(s.maxRounds+at.roundsDelta,3,6);
 // 탐색 성과 → 증거 제시 카드(제한 사용·소멸). 준비가 끝난 증거 2장은 첫 손에 들어온다.
 const d=s.deck;const ev=[...new Set(setup.evidence)].filter(id=>ARGUMENT_DEFS[id]?.owner==='player').slice(0,3);f.preparedEvidence=ev;
 ev.forEach((id,i)=>{const card={uid:d.nextUid++,id:'evidence',temporary:true as const,argDef:id};d.cards.push(card);if(i<2&&d.hand.length<8)d.hand.push(card.uid);else d.draw.push(card.uid);});
 // 실제 참여한 인재의 지원 카드(설전당 1회)
 for(const o of f.officers){const sup=DEBATE_SUPPORT[o];if(!sup||d.cards.some(x=>x.id===sup.card&&x.temporary))continue;const card={uid:d.nextUid++,id:sup.card,temporary:true as const};d.cards.push(card);d.draw.push(card.uid);}
 // 덱 10~12장: 증거·인재 지원은 반드시, 요구 축마다 점수 카드 2장·신뢰 카드 1장을 보장한 뒤 인재 카드 > 준비 카드 > 대표 고유 > 공용 순(같은 카드 최대 2장). 나머지는 이번 설전에서 뺀다.
 if(d.cards.length>12){const n=s.negotiation;const scores=(c:DebateCard,axis:string)=>DEBATE_CARDS[c.id].effects.some(e=>e.operations.some(op=>op.kind==='score'&&op.axis===axis&&op.amount>0));const trusts=(c:DebateCard)=>DEBATE_CARDS[c.id].effects.some(e=>e.operations.some(op=>op.kind==='trust'&&op.amount>0));
  const rank=(c:DebateCard)=>c.id==='evidence'||DEBATE_CARDS[c.id].support?0:c.personnelCard!==undefined?1:c.temporary?2:c.owner?3:4;const pool=[...d.cards].sort((a,b)=>rank(a)-rank(b)||a.uid-b.uid);const chosen:DebateCard[]=pool.filter(c=>rank(c)===0);
  const count=(id:string)=>chosen.filter(c=>c.id===id).length;const add=(c:DebateCard)=>{if(chosen.length<12&&!chosen.includes(c)&&count(c.id)<2)chosen.push(c);};
  const amount=(c:DebateCard,axis:string)=>DEBATE_CARDS[c.id].effects.reduce((v,e)=>v+e.operations.reduce((w,op)=>w+(op.kind==='score'&&op.axis===axis?op.amount:0),0),0);
  for(const [axis,need] of Object.entries(n.needs)){const src=pool.filter(c=>scores(c,axis)).sort((a,b)=>amount(b,axis)-amount(a,axis)||rank(a)-rank(b));let sum=chosen.reduce((v,c)=>v+Math.max(0,amount(c,axis)),0);for(const c of src){if(sum>=Math.min(need!,6)||chosen.filter(x=>scores(x,axis)).length>=3)break;if(!chosen.includes(c)&&count(c.id)<2){add(c);sum+=amount(c,axis);}}}
  if(!chosen.some(trusts))for(const c of pool)if(trusts(c)){add(c);break;}
  for(const c of pool)add(c);
  const keep=new Set(chosen.map(c=>c.uid));const extra=d.cards.filter(c=>!keep.has(c.uid)).map(c=>c.uid);d.cards=d.cards.filter(c=>keep.has(c.uid));for(const k of ['draw','hand','discard','exhaust'] as const)d[k]=d[k].filter(u=>!extra.includes(u));}
 // 시작 손패 5장(준비한 증거 2장 포함)
 while(d.hand.length>5){const u=d.hand.find(u=>d.cards.find(c=>c.uid===u)!.id!=='evidence');if(u===undefined)break;d.hand.splice(d.hand.indexOf(u),1);d.draw.push(u);}
 while(d.hand.length<5&&(d.draw.length||d.discard.length)){if(!d.draw.length){d.draw=shuffle(s,d.discard.splice(0));}d.hand.push(d.draw.pop()!);}
 s.log=s.log.filter(t=>!t.startsWith('상대 반론 규칙')&&!t.startsWith('설전 덱:'));s.log.push(`설전 덱 ${d.cards.length}장 · 손패 5장 · 집중 ${s.resolve} · ${s.maxRounds}라운드. 라운드 끝에 상대 의도가 실행됩니다.`);
 fillIntents(s,f);
 note(f,`${at.name} · ${ARGUMENT_DEFS[at.core].name} vs ${ARGUMENT_DEFS[c.core].name}`);
 s.log.push(`논박진: ${at.name}. ${at.text} 부분 성공 조건: ${at.partial}.`);
 return f;
}

// ── 의도 ──
function targetFor(f:DebateField,rule:string|undefined):string{
 const own=playerAlive(f);if(!own.length)return 'core';
 const weakest=[...own].sort((a,b)=>a.durability+a.protection-(b.durability+b.protection)||a.placedRound-b.placedRound)[0];
 const pick=(list:ArgumentState[])=>list.length?[...list].sort((a,b)=>a.durability+a.protection-(b.durability+b.protection))[0]:weakest;
 if(rule==='informal')return pick(own.filter(a=>!hasTag(a,'doc'))).argumentId;
 if(rule==='evidence'){const w=own.filter(a=>hasTag(a,'witness'));return pick(w.length?w:own.filter(a=>argDef(a).evidence)).argumentId;}
 if(rule==='pressure')return (own.find(a=>hasTag(a,'guarantee')||hasTag(a,'pressure'))??[...own].sort((a,b)=>b.placedRound-a.placedRound||Number(b.argumentId.slice(3))-Number(a.argumentId.slice(3)))[0]).argumentId;
 if(rule==='protected')return [...own].sort((a,b)=>b.protection-a.protection||b.durability-a.durability)[0].argumentId;
 if(rule==='newest')return [...own].sort((a,b)=>Number(b.argumentId.slice(3))-Number(a.argumentId.slice(3)))[0].argumentId;
 return weakest.argumentId;
}
function makeIntent(f:DebateField,id:string):DebateIntent{const d=INTENT_DEFS[id];const harsh=f.profile==='harsh'&&(d.kind==='attack'||d.kind==='attackCore')?1:0;
 const it:DebateIntent={id,kind:d.kind,target:d.kind==='attack'?targetFor(f,d.target):d.kind==='attackCore'?'core':null,amount:d.amount+harsh,concealed:!!d.concealed,source:d.text};if(d.clause)it.clause=d.clause;if(d.react)it.react=d.react;return it;}
function fillIntents(s:DebateState,f:DebateField){while(f.intents.length<1+Math.min(2,f.revealedIntents)){const id=f.pattern[f.patternIndex%f.pattern.length];f.patternIndex++;f.intents.push(makeIntent(f,id));}}
/** 대상이 사라진 의도는 같은 규칙으로 다시 겨눈다(돌려 놓은 의도는 유지). */
export function retarget(f:DebateField){for(const it of f.intents){if(it.kind!=='attack'||it.target==='core')continue;const t=findArg(f,it.target??'');if(t&&t.durability>0&&t.owner==='player')continue;it.target=it.redirected?targetFor(f,'protected'):targetFor(f,INTENT_DEFS[it.id]?.target);}}
export function intentAmount(s:DebateState,f:DebateField,it:DebateIntent):number{
 let n=it.amount;if(it.kind==='attack'||it.kind==='attackCore'){n+=oppAlive(f,'attackBonus').reduce((v,a)=>v+(argDef(a).attackBonus??0),0)+f.hidden.filter(h=>h.hidden&&h.durability>0).reduce((v,h)=>v+(argDef(h).hiddenEffect?.attackBonus??0),0);
  const t=it.target&&it.target!=='core'?findArg(f,it.target):null;if(t&&!hasTag(t,'doc')&&oppAlive(f,'informal').length)n+=1;
  if((it.target==='core'||it.kind==='attackCore')&&f.archetype==='military'&&playerAlive(f,'guarantee').length)n-=1;}
 if(f.stats.oppCoreBroken)n-=1;return Math.max(0,n);
}
export function intentText(s:DebateState,f:DebateField,it:DebateIntent):string{
 const t=it.target==='core'?f.playerCore:it.target?findArg(f,it.target):null;const amt=it.concealed?'?':String(intentAmount(s,f,it));
 switch(it.kind){case 'attack':return `논거 공격 → ${t?argDef(t).name:'?'} ${amt}`;case 'attackCore':return `핵심 입장 공격 → ${argDef(f.playerCore).name} ${amt}`;case 'doubt':return '청중의 의심 생성';case 'cost':return `계약 비용 증가 · 이익 요구 +${amt}`;case 'burden':return `부담 +${amt}`;case 'lock':return `조항 잠금 · ${it.clause==='records'?'문서 보존':it.clause}`;case 'hide':return it.concealed?'숨은 주장 생성(?)':'숨은 주장 생성';case 'shift':return '논점 이동 · 안전 요구 +1, 내 보호 −1';case 'demand':return `최종 답변 요구 · 조급함 +${amt}`;case 'react':return it.react?`${({pressure:'압박',scheme:'계책'} as Record<string,string>)[it.react]??it.react}에 반응 · ${it.source.split('·')[1]?.trim()??''}`:'지연됨 · 이번 라운드 행동 없음';}
 return it.source;
}

// ── 파괴·피해 ──
function destroy(s:DebateState,f:DebateField,a:ArgumentState,why:string){
 if(a.durability>0)a.durability=0;applyLinks(s,a,-1);const d=argDef(a),n=s.negotiation!;
 if(a===f.playerCore){f.stats.coreBroken=true;s.trust=Math.max(0,s.trust-2);note(f,`핵심 입장 「${d.name}」 붕괴(${why}) · 신뢰 −2, 완전 합의 불가`);return;}
 if(a===f.opponentCore){f.stats.oppCoreBroken=true;for(const k of Object.keys(n.needs) as Axis[])n.needs[k]=Math.max(1,n.needs[k]!-1);s.trust=Math.min(20,s.trust+2);f.impatience=0;note(f,`상대 핵심 주장 「${d.name}」 논파(${why}) · 요구 모두 −1, 신뢰 +2`);return;}
 if(a.owner==='player'){f.stats.lost++;note(f,`내 논거 「${d.name}」 파괴(${why})`);if(d.onDestroy?.audience)addAudience(s,f,d.onDestroy.audience,d.name+' 파괴');}
 else{f.stats.destroyedOpp++;note(f,`${a.owner==='audience'?'청중':'상대'} 논거 「${d.name}」 제거(${why})`);}
}
function hit(s:DebateState,f:DebateField,a:ArgumentState,amount:number,why:string):boolean{
 const ab=Math.min(a.protection,amount);a.protection-=ab;const dmg=amount-ab;if(ab>0&&a.owner==='player')f.stats.protectedHits++;
 a.durability=Math.max(0,a.durability-dmg);note(f,`「${argDef(a).name}」 ${why} ${amount}${ab?` (보호 ${ab})`:''} → 내구 ${a.durability}`);
 if(a.durability<=0){destroy(s,f,a,why);return true;}return false;
}
export function attackTargets(f:DebateField):ArgumentState[]{return [...f.opponent.filter(a=>a.durability>0),...f.hidden.filter(h=>h.exposed&&h.durability>0),...(f.opponentCore.durability>0?[f.opponentCore]:[])];}
export function defaultAttackTarget(f:DebateField):ArgumentState|null{
 const focus=f.focus?attackTargets(f).find(a=>a.argumentId===f.focus):null;if(focus)return focus;
 const opp=f.opponent.filter(a=>a.durability>0);const danger=opp.filter(a=>argDef(a).danger).sort((a,b)=>a.durability-b.durability);
 return danger[0]??[...opp].sort((a,b)=>a.durability-b.durability)[0]??f.hidden.find(h=>h.exposed&&h.durability>0)??(f.opponentCore.durability>0?f.opponentCore:null);
}
/** 내 논거 중 지금 노려진 것(보호 대상). */
function threatened(f:DebateField):ArgumentState{const it=f.intents[0];if(it?.kind==='attack'&&it.target&&it.target!=='core'){const t=findArg(f,it.target);if(t&&t.durability>0)return t;}if(it?.kind==='attackCore'||it?.target==='core')return f.playerCore;return playerAlive(f).sort((a,b)=>a.durability+a.protection-(b.durability+b.protection))[0]??f.playerCore;}

// ── 카드 → 전장 ──
export type Placement={mode:'auto'}|{mode:'replace';argId:string}|{mode:'instant'};
export function parsePlacement(action:string):Placement{const parts=action.split(':');if(parts[2]==='replace'&&parts[3])return {mode:'replace',argId:parts[3]};if(parts[2]==='instant')return {mode:'instant'};return {mode:'auto'};}
export function cardArgDef(card:DebateCard):string|null{const def=DEBATE_CARDS[card.id];for(const e of def.effects)for(const op of e.operations)if(op.kind==='argument')return op.def==='$card'?card.argDef??null:op.def;return null;}
/** 카드가 논거를 놓는데 자리가 없으면 교체/즉시 효과/취소 중 선택이 필요하다. */
export function placementNeeded(s:DebateState,card:DebateCard):boolean{const f=s.field;if(!f)return false;return !!cardArgDef(card)&&playerAlive(f).length>=FIELD_LIMITS.player;}
export function fieldCostDelta(s:DebateState,card:DebateCard):number{const f=s.field;if(!f||f.discountUsed)return 0;const fam=DEBATE_CARDS[card.id].family;return playerAlive(f).some(a=>argDef(a).discountFamily===fam)?-1:0;}
export function fieldScoreBonus(s:DebateState,axis:Axis,amount:number):number{const f=s.field;if(!f||amount<=0||axis!=='safety')return 0;const w=playerAlive(f).find(a=>argDef(a).firstSafety&&a.uses===0);if(!w)return 0;w.uses++;note(f,`「${argDef(w).name}」 · 안전 첫 상승 +${argDef(w).firstSafety}`);return argDef(w).firstSafety!;}
export function fieldTrustPenalty(s:DebateState,amount:number):number{const f=s.field;if(!f||amount<=0)return 0;const p=f.audience.filter(a=>a.durability>0).reduce((v,a)=>v+(argDef(a).trustPenalty??0),0)+f.hidden.filter(h=>h.hidden&&h.durability>0).reduce((v,h)=>v+(argDef(h).hiddenEffect?.trustPenalty??0),0);return Math.min(amount,Math.min(2,p));}
export function onFieldCardPlayed(s:DebateState,card:DebateCard,family:Method){const f=s.field;if(!f)return;f.roundFamilies.push(family);if(fieldCostDelta(s,card)<0)f.discountUsed=true;
 const owners=card.personnelOwners?.filter(o=>o!==s.generalId).join('+');if(owners){if(f.lastOwner===owners){f.privateInterest++;note(f,'같은 인재 카드 연속 · 사적 이해 +1');}else if(f.lastOwner){f.opinion++;note(f,'다른 인재 카드 연계 · 공론 +1');}f.lastOwner=owners;}
 if(family==='pressure'){const n=s.negotiation!;if(oppAlive(f,'reactions').some(a=>a.definitionId==='o_cost')){n.burden=Math.min(12,n.burden+1);note(f,'「비용 위험」 반응 · 압박에 부담 +1');}
  if(f.opponent.some(a=>a.definitionId==='o_corvee'&&a.durability>0)||f.audience.some(a=>a.definitionId==='au_watch'&&a.durability>0))addAudience(s,f,'au_doubt','강압 반응');
  if(playerAlive(f).some(a=>argDef(a).pressureBonus)){n.burden=Math.min(12,n.burden+1);note(f,'「전위의 보증」 · 압박에 부담 +1');}}
}
export function fieldOperation(s:DebateState,op:Operation,card:DebateCard|undefined,family:Method|undefined,placement:Placement):boolean{
 const f=s.field;if(!f)return false;const n=s.negotiation!;
 switch(op.kind){
  case 'argument':{const id=op.def==='$card'?card?.argDef:op.def;if(!id||!ARGUMENT_DEFS[id])return true;const d=ARGUMENT_DEFS[id];
   if(placement.mode==='instant'||playerAlive(f).length>=FIELD_LIMITS.player&&placement.mode!=='replace'){if(d.instant.trust)s.trust=Math.min(20,s.trust+d.instant.trust-fieldTrustPenalty(s,d.instant.trust));if(d.instant.score){const [axis,v]=d.instant.score;n.scores[axis]=clamp(n.scores[axis]+v+fieldScoreBonus(s,axis,v),0,30);}if(d.instant.burden)n.burden=clamp(n.burden+d.instant.burden,0,12);f.stats.instant++;note(f,`「${d.name}」 즉시 효과 · ${d.instant.text}`);return true;}
   if(placement.mode==='replace'){const old=f.player.find(a=>a.argumentId===placement.argId&&a.durability>0);if(old){applyLinks(s,old,-1);old.durability=0;f.stats.replaced++;note(f,`「${argDef(old).name}」을 내리고 교체`);}}
   f.player=f.player.filter(a=>a.durability>0);const a=makeArg(s,f,id,'player',card?.argDef?'준비한 증거':DEBATE_CARDS[card?.id??'']?.name??'카드');
   if(f.officers.includes('xunyu')&&!f.roundFirstArg){a.protection+=1;f.roundFirstArg=true;note(f,'순욱 원칙 · 라운드 첫 논거 보호 +1');}
   f.player.push(a);f.stats.placed++;if(d.onPlace?.trust)s.trust=Math.min(20,s.trust+d.onPlace.trust);if(d.onPlace?.reveal)f.revealedIntents=Math.min(2,f.revealedIntents+d.onPlace.reveal);note(f,`내 논거 「${d.name}」 배치(내구 ${a.durability})`);return true;}
  case 'attack':{const t=op.core?(f.opponentCore.durability>0?f.opponentCore:null):defaultAttackTarget(f);if(!t)return true;let amt=op.amount+(family==='pressure'?playerAlive(f).reduce((v,a)=>v+(argDef(a).pressureBonus??0),0):0);
   if(t===f.opponentCore&&f.opponent.some(a=>a.durability>0&&argDef(a).danger))amt=Math.ceil(amt/2);f.stats.attacks++;const broke=hit(s,f,t,amt,'논박');
   if(broke&&family==='pressure'&&f.intents[0]&&f.intents[0].kind!=='react'){const it=f.intents[0];f.intents[0]={id:'delay',kind:'react',target:null,amount:0,react:'',concealed:false,source:'지연'};f.intents.splice(1,0,it);note(f,'압박으로 상대 의도 지연');}
   if(f.focus&&!attackTargets(f).some(a=>a.argumentId===f.focus))f.focus=null;return true;}
  case 'protect':{const add=(a:ArgumentState)=>{a.protection=Math.min(4,a.protection+op.amount);};if(op.scope==='all'){for(const a of [f.playerCore,...playerAlive(f)])add(a);note(f,`내 논거 모두 보호 +${op.amount}`);}else{const t=threatened(f);add(t);note(f,`「${argDef(t).name}」 보호 +${op.amount}`);if(op.scope==='both'){f.opponentCore.protection=Math.min(4,f.opponentCore.protection+1);note(f,'상대 핵심 주장도 존중(보호 +1)');}}return true;}
  case 'expose':{const h=f.hidden.find(x=>x.hidden&&x.durability>0);if(!h){note(f,'공개할 숨은 논거가 없음');return true;}const d=argDef(h);h.hidden=false;h.exposed=true;f.exposedDefs.push(h.definitionId);if(d.onExpose?.durability)h.durability=h.maxDurability=d.onExpose.durability;f.stats.exposed++;note(f,`숨은 논거 「${d.name}」 공개 · ${d.onExpose?.text??''}`);
   if(d.onExpose?.coreDamage&&f.opponentCore.durability>0){f.opponentCore.durability=Math.max(0,f.opponentCore.durability-d.onExpose.coreDamage);if(f.opponentCore.durability===0)destroy(s,f,f.opponentCore,'모순');}
   if(d.onExpose?.impatience)f.impatience=Math.max(0,f.impatience+d.onExpose.impatience);if(f.officers.includes('lusu')){f.impatience=Math.max(0,f.impatience-1);f.revealedIntents=Math.min(2,f.revealedIntents+1);note(f,'노숙 원칙 · 조급함 −1, 의도 1개 더 공개');}return true;}
  case 'redirect':{const it=f.intents[0];const own=playerAlive(f);const curTarget=it?.target==='core'||it?.kind==='attackCore'?null:it?.target;const strong=[...own].filter(a=>a.argumentId!==curTarget).sort((a,b)=>b.durability+b.protection-(a.durability+a.protection))[0];if(it&&(it.kind==='attack'||it.kind==='attackCore')&&strong){it.kind='attack';it.target=strong.argumentId;it.redirected=true;note(f,`상대 공격을 「${argDef(strong).name}」로 돌림`);}else if(it){if(f.intents.length<2){const id=f.pattern[f.patternIndex%f.pattern.length];f.patternIndex++;f.intents.push(makeIntent(f,id));}[f.intents[0],f.intents[1]]=[f.intents[1],f.intents[0]];note(f,'상대 의도 순서를 바꿈');}return true;}
  case 'delay':{const it=f.intents[0];if(it&&it.kind!=='react'){f.intents[0]={id:'delay',kind:'react',target:null,amount:0,react:'',concealed:false,source:'지연'};f.intents.splice(1,0,it);}return true;}
  case 'unlock':if(f.locked.length)note(f,`조항 잠금 해제 · ${f.locked.join(', ')}`);f.locked=[];return true;
  case 'convert':{const t=[...f.opponent.filter(a=>a.durability>0&&a.durability<=2),...f.hidden.filter(h=>h.exposed&&h.durability>0&&h.durability<=2)].sort((a,b)=>(f.focus===b.argumentId?1:0)-(f.focus===a.argumentId?1:0)||a.durability-b.durability)[0];if(!t){note(f,'비틀 만한 약한 상대 논거가 없음(내구 2 이하)');return true;}destroy(s,f,t,'전환');f.stats.converted++;f.player=f.player.filter(a=>a.durability>0);if(f.player.length<FIELD_LIMITS.player){f.player.push(makeArg(s,f,'a_turned','player','전환'));note(f,'「돌려쓴 조건」 획득');}else{n.scores.profit=clamp(n.scores.profit+1,0,30);}return true;}
  case 'exact':for(const it of f.intents)it.concealed=false;f.revealedIntents=Math.min(2,f.revealedIntents+1);fillIntents(s,f);return true;
  case 'audience':{if(op.amount<0){let left=-op.amount;for(const a of f.audience.filter(a=>a.durability>0)){if(left<=0)break;const dmg=Math.min(left,a.durability);left-=dmg;a.durability-=dmg;note(f,`청중 「${argDef(a).name}」 −${dmg}`);if(a.durability<=0)destroy(s,f,a,'중재');}}else for(let i=0;i<op.amount;i++)addAudience(s,f,'au_doubt','카드');return true;}
  case 'pressure':f.pressure=clamp(f.pressure+op.amount,0,9);return true;
  case 'impatience':f.impatience=clamp(f.impatience+op.amount,0,12);return true;
  case 'reveal':f.revealedIntents=Math.min(2,f.revealedIntents+op.amount);fillIntents(s,f);return false;
 }
 return false;
}
export function afterFieldAction(s:DebateState){const f=s.field;if(!f)return;f.player=f.player.filter(a=>a.durability>0);f.opponent=f.opponent.filter(a=>a.durability>0);f.audience=f.audience.filter(a=>a.durability>0);f.hidden=f.hidden.filter(a=>a.durability>0);retarget(f);fillIntents(s,f);}

// ── 라운드 종료: 의도 실행 → 지속 효과 → 다음 의도 ──
function costUp(s:DebateState,f:DebateField,amount:number,why:string){const n=s.negotiation!;const ledger=playerAlive(f).find(a=>argDef(a).negateCost&&a.uses<argDef(a).negateCost!);if(ledger){ledger.uses++;note(f,`「${argDef(ledger).name}」이 ${why}을 무효화`);return;}n.needs.profit=clamp((n.needs.profit??Math.max(1,n.scores.profit))+amount,1,12);note(f,`${why} · 이익 요구 +${amount}`);}
export function fieldEndRound(s:DebateState,guard:number):{blocked:boolean;text:string;guardUsed:number}{
 const f=s.field!,n=s.negotiation!,at=DEBATE_ARCHETYPES[f.archetype];retarget(f);const it=f.intents.shift();let blocked=false,text='',guardUsed=0;
 if(it){let amt=intentAmount(s,f,it);text=intentText(s,f,it);if(guard>0&&!(it.kind==='react'&&(!it.react||!f.roundFamilies.includes(it.react)))){guardUsed=Math.min(guard,Math.max(1,amt));amt=Math.max(0,amt-guard);if(amt===0||['doubt','lock','hide','shift'].includes(it.kind)){blocked=true;f.stats.blocked++;}}
  if(blocked)note(f,`상대 의도 「${text}」 차단`);else{f.stats.intentsHit++;switch(it.kind){
   case 'attack':{const t=it.target==='core'?f.playerCore:findArg(f,it.target??'');if(t&&t.durability>0)hit(s,f,t,amt,'공격');break;}
   case 'attackCore':if(f.playerCore.durability>0)hit(s,f,f.playerCore,amt,'공격');break;
   case 'doubt':if((f.archetype==='village'||f.archetype==='assembly')&&playerAlive(f).some(a=>a.definitionId==='a_roster'))note(f,'「피난민 명부 동의」로 의심 생성 실패');else addAudience(s,f,'au_doubt','상대 의도');break;
   case 'cost':costUp(s,f,amt,'계약 비용 증가');break;
   case 'burden':n.burden=clamp(n.burden+amt,0,12);note(f,`부담 +${amt}`);break;
   case 'lock':if(it.clause&&!f.locked.includes(it.clause))f.locked.push(it.clause);note(f,`조항 잠금 · ${it.clause}`);break;
   case 'hide':{const id=INTENT_DEFS[it.id]?.hide;if(id&&!f.hidden.some(h=>h.definitionId===id&&h.durability>0)&&f.hidden.length<FIELD_LIMITS.hidden){f.hidden.push(makeArg(s,f,id,'hidden','상대 의도'));note(f,'숨은 주장이 생김');}else if(f.playerCore.durability>0)hit(s,f,f.playerCore,1,'공격');break;}
   case 'shift':{const axis=(n.needs.safety!==undefined?'safety':Object.keys(n.needs)[0]) as Axis;n.needs[axis]=clamp(n.needs[axis]!+1,1,12);for(const a of [f.playerCore,...f.player])a.protection=Math.max(0,a.protection-1);note(f,`논점 이동 · ${axis} 요구 +1, 내 보호 −1`);break;}
   case 'demand':f.impatience=clamp(f.impatience+amt,0,12);note(f,`최종 답변 요구 · 조급함 ${f.impatience}`);break;
   case 'react':if(!it.react){note(f,'지연된 의도 · 이번 라운드 행동 없음');break;}if(!f.roundFamilies.includes(it.react)){note(f,'반응할 카드가 없어 의도가 빗나감');break;}
    if(f.archetype==='merchant'){n.burden=clamp(n.burden+1,0,12);f.impatience++;note(f,'상단 반응 · 부담 +1, 조급함 +1');}
    else if(f.archetype==='military'){if(f.playerCore.durability>0)hit(s,f,f.playerCore,2,'반응');}
    else addAudience(s,f,'au_doubt','강압 반응');break;
  }}
 }
 // 지속 효과
 for(const a of oppAlive(f,'costUp'))costUp(s,f,argDef(a).costUp!,`「${argDef(a).name}」`);
 for(const h of f.hidden.filter(h=>h.hidden&&h.durability>0&&argDef(h).hiddenEffect?.costUp))costUp(s,f,argDef(h).hiddenEffect!.costUp!,'숨은 외상');
 for(const a of playerAlive(f)){const d=argDef(a);if(d.roundImpatience)f.impatience=Math.max(0,f.impatience+d.roundImpatience);if(d.roundScore&&a.uses<2){const [axis,v]=d.roundScore;n.scores[axis]=clamp(n.scores[axis]+v,0,30);a.uses++;note(f,`「${d.name}」 · ${axis} +${v}`);}}
 if(s.round>=1)f.impatience=clamp(f.impatience+at.impatienceRound,0,12);
 if(f.impatience>=f.impatienceLimit&&!f.finalDemanded){f.finalDemanded=true;s.maxRounds=clamp(Math.min(s.maxRounds,s.round+2),3,6);note(f,`상대가 최종 답변을 요구 · 설전은 ${s.maxRounds}라운드에 끝납니다`);}
 f.roundFamilies=[];f.roundFirstArg=false;f.discountUsed=false;afterFieldAction(s);
 return {blocked,text,guardUsed};
}
/** 원형별 부분 성공 조건. */
export function fieldPartialOk(s:DebateState):boolean{const f=s.field;if(!f)return true;const n=s.negotiation!;
 switch(f.archetype){case 'official':return playerAlive(f,'doc').length>0||!f.opponent.some(a=>a.definitionId==='o_procedure');case 'merchant':return n.needs.profit===undefined||n.scores.profit>=n.needs.profit||!f.opponent.some(a=>a.definitionId==='o_contract');case 'village':return f.pressure<3&&(n.needs.safety===undefined||n.scores.safety>=n.needs.safety);case 'military':return f.playerCore.durability>0;case 'assembly':return f.audience.filter(a=>a.definitionId==='au_doubt').reduce((v,a)=>v+a.durability,0)<=1;}return true;}
/** 등급·조항 판정에 넘길 전장 요약. */
export type FieldSummary=ReturnType<typeof fieldSummary>;
export function fieldSummary(f:DebateField){const alivePlayer=playerAlive(f);const opp=f.opponent.filter(a=>a.durability>0);
 const lockedByArgs=opp.flatMap(a=>{const d=argDef(a);return d.lockClause&&!(d.unlessTag&&alivePlayer.some(p=>hasTag(p,d.unlessTag!)))?d.lockClause:[];});
 return {field:true,archetype:f.archetype,aliveDefs:alivePlayer.map(a=>a.definitionId),aliveTags:[...new Set(alivePlayer.flatMap(a=>argDef(a).tags))],evidenceAlive:alivePlayer.filter(a=>argDef(a).evidence).length,dangerAlive:opp.filter(a=>argDef(a).danger).map(a=>argDef(a).name),audienceDoubt:f.audience.filter(a=>a.durability>0&&argDef(a).trustPenalty).length,exposed:[...f.exposedDefs],openedByArgs:[...new Set([...alivePlayer.flatMap(a=>argDef(a).openClause??[]),...f.exposedDefs.flatMap(id=>ARGUMENT_DEFS[id].onExpose?.openClause??[])])],locked:[...new Set([...f.locked,...lockedByArgs])],coreAlive:f.playerCore.durability>0,oppCoreBroken:f.stats.oppCoreBroken,placed:f.stats.placed,alive:alivePlayer.length,pressure:f.pressure,opinion:f.opinion,privateInterest:f.privateInterest,hiddenLeft:f.hidden.filter(h=>h.hidden&&h.durability>0).map(h=>argDef(h).name)};}
