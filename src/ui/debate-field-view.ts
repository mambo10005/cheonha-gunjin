/**
 * 논박진 화면: 핵심 주장·보조 논거·청중·숨은 논거·상대 의도·손패·주요 조항·예상 등급.
 * 세부 규칙 문장은 title(호버·포커스)과 기록에 두고 화면에는 상태와 변화량만 둔다.
 * 미리보기는 복제 상태에 실제 처리 함수를 돌린 결과다(원본과 RNG는 바뀌지 않음).
 */
import {DEBATE_CARDS,FIELD_FAMILY} from '../data/debate-cards.ts';
import {ARGUMENT_DEFS,DEBATE_ARCHETYPES,FIELD_LIMITS} from '../data/debate-field.ts';
import {CLAUSES} from '../data/clauses.ts';
import {deckCost,canDeckAction,deckPreview,cardText,deckGrade} from '../core/debate-deck.ts';
import {intentText,playerAlive,placementNeeded,cardArgDef,fieldSummary} from '../core/debate-field.ts';
import {esc} from './html.ts';
import type {DebateState} from '../core/social-types.ts';
import type {ArgumentState} from '../core/debate-field-types.ts';
import type {DebateEvaluation} from '../core/debate-grade.ts';
type Btn=(action:string,label:string,disabled?:boolean)=>string;
/** 클릭 속성(탐색 화면: data-explore-action / 관문 화면: data-raising). 렌더 동안만 설정한다. */
const ATTR:{fn:(action:string)=>string}={fn:a=>`data-explore-action="${esc(a)}"`};
const AXIS:Record<string,string>={honor:'명분',profit:'이익',safety:'안전',authority:'권한'};
const pips=(a:ArgumentState)=>`<span class="field-pips" aria-label="내구 ${a.durability}/${a.maxDurability}">${Array.from({length:a.maxDurability},(_,i)=>`<i class="${i<a.durability?'on':''}"></i>`).join('')}</span>`;
/** 강조 규칙: 핵심 입장·위험 논거·지킬 증거·노려진 논거만 배지로 띄우고, 내구 수치는 작은 점과 title로 둔다. */
function argCard(a:ArgumentState,opts:{target?:string;focused?:boolean;threat?:boolean}={}){const attr=ATTR.fn;const d=ARGUMENT_DEFS[a.definitionId];const danger=!a.hidden&&!a.core&&d.owner==='opponent'&&!!d.danger,evidence=!a.hidden&&d.owner==='player'&&!a.core&&!!d.evidence;
 const body=`${a.core?`<small class="field-badge core">${d.owner==='player'?'내 핵심 입장':'상대 핵심'}</small>`:''}${danger?'<small class="field-badge danger">위험</small>':''}${evidence?'<small class="field-badge evidence">지킬 증거</small>':''}<b>${esc(a.hidden?'숨은 논거':d.name)}</b>${a.hidden?'':pips(a)}${a.protection?`<small class="field-prot">보호 ${a.protection}</small>`:''}${a.exposed?'<small>공개됨</small>':''}${opts.threat?'<small class="field-threat">노려짐</small>':''}`;
 const title=esc((a.hidden?'정보·장부·계책 카드로 공개할 수 있습니다.':d.text)+(a.hidden?'':` · 내구 ${a.durability}/${a.maxDurability}`));
 const cls=`field-arg ${a.owner} ${a.core?'core':''} ${danger?'danger':''} ${evidence?'evidence':''} ${opts.threat?'threatened':''}`;
 return opts.target?`<button class="${cls} ${opts.focused?'focused':''}" ${attr(opts.target)} title="${title}" aria-pressed="${!!opts.focused}">${body}</button>`:`<div class="${cls}" tabindex="0" title="${title}">${body}</div>`;}
/** 카드 하나를 썼을 때의 변화(복제 상태에 실제 처리). */
/** 카드 하나를 썼을 때의 변화. 순서: 공격·보호 대상 → 생성 논거 → 사라지는 논거 → 조항 변화 → 예상 등급 변화 → 그 밖의 수치. */
export function fieldDelta(s:DebateState,action:string,gradeOf?:(st:DebateState)=>string,clausesOf?:(st:DebateState)=>string[]):string{const pv=deckPreview(s,action);if(!pv.check.ok)return esc(pv.check.reason??'');const a=s.field!,b=pv.state.field!,n0=s.negotiation!,n1=pv.state.negotiation!;
 const target:string[]=[],made:string[]=[],gone:string[]=[],clause:string[]=[],rest:string[]=[];
 const all=(f:typeof a)=>[f.playerCore,...f.player,f.opponentCore,...f.opponent,...f.audience,...f.hidden];const before=new Map(all(a).map(x=>[x.argumentId,x]));
 for(const x of all(b)){const o=before.get(x.argumentId);const nm=ARGUMENT_DEFS[x.definitionId].name;if(!o){made.push(`「${nm}」${x.owner==='audience'?'(청중)':''}`);continue;}if(o.durability>x.durability)target.push(`${x.owner==='player'?'내':'공격'} 「${nm}」 ${o.durability}→${x.durability}`);else if(o.durability<x.durability)target.push(`회복 「${nm}」 ${o.durability}→${x.durability}`);if(o.protection<x.protection)target.push(`보호 「${nm}」 +${x.protection-o.protection}`);else if(o.protection>x.protection)rest.push(`「${nm}」 보호 ${o.protection}→${x.protection}`);if(o.hidden&&!x.hidden)made.push(`「${nm}」 공개`);}
 for(const x of all(a))if(!all(b).some(y=>y.argumentId===x.argumentId))gone.push(`「${ARGUMENT_DEFS[x.definitionId].name}」${x.owner==='player'?'(내 논거)':x.owner==='opponent'?'(상대 논거 제거)':''}`);
 if(clausesOf){const c0=clausesOf(s),c1=clausesOf(pv.state);for(const id of c1)if(!c0.includes(id))clause.push(`${CLAUSES[id]?.name??id} 성립`);for(const id of c0)if(!c1.includes(id))clause.push(`${CLAUSES[id]?.name??id} 불성립`);}
 if(a.locked.join()!==b.locked.join())clause.push(b.locked.length<a.locked.length?'조항 잠금 해제':'조항 잠김');
 for(const k of Object.keys(n0.scores) as (keyof typeof n0.scores)[])if(n0.scores[k]!==n1.scores[k])rest.push(`${AXIS[k]} ${n0.scores[k]}→${n1.scores[k]}`);
 for(const k of Object.keys(n1.needs))if(n0.needs[k as 'honor']!==n1.needs[k as 'honor'])rest.push(`${AXIS[k]} 요구 ${n0.needs[k as 'honor']}→${n1.needs[k as 'honor']}`);
 if(s.trust!==pv.state.trust)rest.push(`신뢰 ${s.trust}→${pv.state.trust}`);if(n0.burden!==n1.burden)rest.push(`부담 ${n0.burden}→${n1.burden}`);if(a.pressure!==b.pressure)rest.push(`압박 ${a.pressure}→${b.pressure}`);if(a.impatience!==b.impatience)rest.push(`조급함 ${a.impatience}→${b.impatience}`);
 if(JSON.stringify(a.intents.map(i=>[i.kind,i.target]))!==JSON.stringify(b.intents.map(i=>[i.kind,i.target])))rest.push('상대 의도 변화: '+(b.intents[0]?intentText(pv.state,b,b.intents[0]):'없음'));
 if(s.deck!.guard!==pv.state.deck!.guard)rest.push(`의도 경감 ${s.deck!.guard}→${pv.state.deck!.guard}`);
 let grade='';if(gradeOf){const g0=gradeOf(s),g1=gradeOf(pv.state);grade=g0!==g1?`${g0}→${g1}`:`${g1}(유지)`;}
 const parts=[target.length?'대상 '+target.join(' · '):'',made.length?'생성 '+made.join(' · '):'',gone.length?'소멸 '+gone.join(' · '):'',clause.length?'조항 '+clause.join(' · '):'',grade?'예상 등급 '+grade:'',rest.length?rest.join(' · '):''].filter(Boolean);
 return esc(parts.join(' / ')||'변화 없음');}
/** 결과 화면: 상대 논거를 하나도 무너뜨리지 않고 핵심 주장만 쳤을 때, 남은 위험 논거가 결과에 미친 영향을 설명한다. */
export function remainingRiskNote(s:DebateState):string{const f=s.field;if(!f)return '';const left=f.opponent.filter(a=>a.durability>0);const attackedOnlyCore=f.stats.attacks>0&&f.stats.destroyedOpp===0&&left.length>0;if(!attackedOnlyCore&&!left.some(a=>ARGUMENT_DEFS[a.definitionId].danger))return '';
 const effect=(id:string)=>{const d=ARGUMENT_DEFS[id];const out:string[]=[];if(d.need)out.push('요구 '+Object.entries(d.need).map(([k,v])=>`${AXIS[k]} ${v!>0?'+':''}${v}`).join('·'));if(d.trustPenalty)out.push(`신뢰 벌점 ${d.trustPenalty}`);if(d.costUp)out.push(`집중 비용 +${d.costUp}`);if(d.lockClause?.length)out.push('조항 잠금 '+d.lockClause.map(c=>CLAUSES[c]?.name??c).join('·'));if(d.burdenLimit)out.push(`부담 상한 ${d.burdenLimit}`);if(d.danger)out.push('위험 논거: 남아 있으면 최상 등급 불가');return out.join(' · ')||d.text;};
 return `<section class="field-risk-note"><h4>${attackedOnlyCore?'상대 핵심 주장만 공격했습니다':'남은 위험 논거'}</h4><p>${attackedOnlyCore?'상대 보조 논거를 하나도 무너뜨리지 않아 아래 논거가 끝까지 남았습니다. 남은 논거는 요구·신뢰·조항에 계속 작용합니다.':'아래 논거가 끝까지 남아 결과에 작용했습니다.'}</p><ul>${left.map(a=>`<li><b>${esc(ARGUMENT_DEFS[a.definitionId].name)}</b> — ${esc(effect(a.definitionId))}</li>`).join('')}</ul></section>`;}
export function debateFieldView(s:DebateState,ev:DebateEvaluation|null,btn:Btn,opts:{selected?:string|null;selectAttr?:string;actionPrefix?:string;gradeOf?:(st:DebateState)=>string;clausesOf?:(st:DebateState)=>string[];attr?:(action:string)=>string}={}):string{
 ATTR.fn=opts.attr??(a=>`data-explore-action="${esc(a)}"`);
 const f=s.field!,n=s.negotiation!,d=s.deck!,at=DEBATE_ARCHETYPES[f.archetype];const P=opts.actionPrefix??'';const fs=fieldSummary(f);
 const threat=f.intents[0]?.kind==='attack'?f.intents[0].target:f.intents[0]?.kind==='attackCore'?'core':null;
 const slots=(list:ArgumentState[],max:number,render:(a:ArgumentState)=>string)=>[...list.map(render),...Array.from({length:Math.max(0,max-list.length)},()=>'<div class="field-arg empty" aria-hidden="true"></div>')].join('');
 const tgt=(a:ArgumentState)=>argCard(a,{target:P+'target:'+a.argumentId,focused:f.focus===a.argumentId});
 const intents=f.intents.map((it,i)=>`<li class="${i?'next':'now'}">${i?'다음':'이번 라운드 끝'} · ${esc(intentText(s,f,it))}</li>`).join('');
 const clauseIds=[...new Set(at.clauses)];
 const clauses=clauseIds.map(id=>{const got=ev?.clauses.includes(id),miss=ev?.missing.find(m=>m.id===id);return `<li class="${got?'ok':'no'}" title="${esc(miss?.reason??CLAUSES[id]?.text??'')}">${esc(CLAUSES[id]?.name??id)} · ${got?'지금 성립':f.locked.includes(id)||fs.locked.includes(id)?'잠김':'조건 부족'}</li>`;}).join('');
 const hand=d.hand.map(uid=>{const c=d.cards.find(x=>x.uid===uid)!,def=DEBATE_CARDS[c.id];const argId=cardArgDef(c);const nm=def.name+(c.argDef?' · '+ARGUMENT_DEFS[c.argDef].name:'');const fam=FIELD_FAMILY[def.family]??def.family;const need=placementNeeded(s,c);const chk=canDeckAction(s,need?`card:${uid}:instant`:'card:'+uid,d.revision);
  const tip=esc(`${def.fieldText??''} ${cardText(c)}${argId?` · 논거: ${ARGUMENT_DEFS[argId].text}`:''}`);
  if(opts.selectAttr)return `<button class="field-card fam-${fam} ${opts.selected==='card:'+uid?'selected':''}" ${opts.selectAttr}="card:${uid}" aria-disabled="${!chk.ok}" title="${tip}"><span>${fam} · 집중 ${deckCost(s,c)}</span><h4>${esc(nm)}</h4><p>${esc(def.fieldText??cardText(c))}</p>${chk.ok?'':`<small>${esc(chk.reason??'')}</small>`}</button>`;
  const actions=need?[`${P}card:${uid}:instant`,...playerAlive(f).map(a=>`${P}card:${uid}:replace:${a.argumentId}`)]:[P+'card:'+uid];
  return `<article class="field-card fam-${fam}" title="${tip}"><span>${fam} · 집중 ${deckCost(s,c)}</span><h4>${esc(nm)}</h4><p class="field-delta">${fieldDelta(s,need?`card:${uid}:instant`:'card:'+uid,opts.gradeOf,opts.clausesOf)}</p>${actions.map(a=>btn(a,a.endsWith(':instant')?'즉시 효과로 쓰기':a.includes(':replace:')?'교체: '+ARGUMENT_DEFS[f.player.find(x=>x.argumentId===a.split(':').pop())!.definitionId].name:'사용',!canDeckAction(s,a.slice(P.length),d.revision).ok)).join('')}</article>`;}).join('');
 let selected='';if(opts.selectAttr&&opts.selected?.startsWith('card:')){const uid=Number(opts.selected.slice(5));const c=d.cards.find(x=>x.uid===uid);if(c&&d.hand.includes(uid)){const need=placementNeeded(s,c);const acts=need?[`card:${uid}:instant`,...playerAlive(f).map(a=>`card:${uid}:replace:${a.argumentId}`)]:['card:'+uid];
  selected=`<div class="field-preview"><h4>${esc(DEBATE_CARDS[c.id].name)} 미리보기</h4>${need?'<p>내 논거 자리 3개가 모두 찼습니다. 교체할 논거를 고르거나, 즉시 효과로 쓰거나, 다른 카드를 고르세요(취소).</p>':''}${acts.map(a=>`<p class="field-delta">${a.endsWith(':instant')?'즉시 효과: ':a.includes(':replace:')?`교체(${esc(ARGUMENT_DEFS[f.player.find(x=>x.argumentId===a.split(':').pop())!.definitionId].name)}): `:''}${fieldDelta(s,a,opts.gradeOf,opts.clausesOf)}</p>${btn(P+a,a.endsWith(':instant')?'즉시 효과로 확정':a.includes(':replace:')?'교체 확정':'사용 확정',!canDeckAction(s,a,d.revision).ok)}`).join('')}</div>`;}}
 return `<section class="debate-field" aria-label="논박진">
 <div class="field-status primary"><span>집중 <b>${s.resolve}</b></span><span>손패 <b>${d.hand.length}</b></span><span class="field-intent-now">상대 다음 의도 <b>${f.intents[0]?esc(intentText(s,f,f.intents[0])):'없음'}</b></span><span class="field-grade">현재 예상 <b>${esc(ev?.grade??(s.result==='ongoing'?deckGrade(s):s.result))}</b></span></div>
 <details class="field-status-detail" data-log="세부 수치 열람"><summary>세부 수치 · 라운드 ${s.round+1}/${s.maxRounds} · 신뢰 ${s.trust}/${n.trustNeeded}</summary><div class="field-status secondary"><span>라운드 <b>${s.round+1}/${s.maxRounds}</b></span><span>신뢰 <b>${s.trust}/${n.trustNeeded}</b></span><span>부담 <b>${n.burden}/${n.burdenLimit}</b></span><span>압박 <b>${f.pressure}</b></span><span>조급함 <b>${f.impatience}/${f.impatienceLimit}</b></span>${Object.entries(n.needs).map(([k,v])=>`<span>${AXIS[k]} <b>${n.scores[k as 'honor']}/${v}</b></span>`).join('')}</div></details>
 <div class="field-board">
  <div class="field-side mine"><h4>내 진영</h4>${argCard(f.playerCore,{threat:threat==='core'})}<div class="field-slots">${slots(f.player,FIELD_LIMITS.player,a=>argCard(a,{threat:threat===a.argumentId}))}</div></div>
  <div class="field-side audience"><h4>청중</h4><div class="field-slots">${slots(f.audience,FIELD_LIMITS.audience,a=>argCard(a))}</div><h4>상대 의도</h4><ul class="field-intents">${intents}</ul></div>
  <div class="field-side theirs"><h4>${esc(at.name)} · 상대 진영</h4>${f.opponentCore.durability>0?tgt(f.opponentCore):argCard(f.opponentCore)}<div class="field-slots">${slots(f.opponent,FIELD_LIMITS.opponent,tgt)}</div><h4>숨은 논거</h4><div class="field-slots">${slots(f.hidden,FIELD_LIMITS.hidden,a=>a.exposed?tgt(a):argCard(a))}</div></div>
 </div>
 <p class="field-hint">상대 논거를 눌러 논박할 대상을 겨눕니다(지금 ${f.focus?esc(ARGUMENT_DEFS[[f.opponentCore,...f.opponent,...f.hidden].find(a=>a.argumentId===f.focus)?.definitionId??'']?.name??''):'자동: 위험 논거 우선'}).</p>
 ${s.result==='ongoing'?`<div class="field-hand">${hand}</div>${selected}`:''}
 ${s.result!=='ongoing'?remainingRiskNote(s):''}
 <details class="field-clauses" open data-log="조항 열람"><summary>주요 조항</summary><ul>${clauses}</ul></details>
 <details class="field-log" data-log="논박 기록 열람"><summary>논박 기록·발동 순서</summary>${f.history.slice(-14).map(t=>`<p>${esc(t)}</p>`).join('')}</details>
 </section>`;}
