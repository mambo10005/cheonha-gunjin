/**
 * 대결 덱 화면: 양측 체력·방비·기세, 거리·자세·빈틈, 상대 다음 의도, 손패, 준비 전술, 인재 지원, 사건 목표, 현재 예상 결과.
 * 카드 효과 문장은 title(호버·포커스)에, 화면에는 변화량만. 미리보기는 복제 상태에 실제 처리 함수를 적용한다.
 */
import {DUEL_CARDS,DUEL_ARCHETYPES,DUEL_SUPPORT} from '../data/duel-cards.ts';
import {DUEL_OBJECTIVES,evaluateDuel} from '../data/duel-objectives.ts';
import {canDuelDeckAction,previewDuelDeck,intentLabel} from '../core/duel-deck.ts';
import {DISTANCE_NAMES,STANCE_NAMES} from '../core/duel.ts';
import {OFFICERS} from '../data/personnel.ts';
import {esc} from './html.ts';
import type {DuelState} from '../core/social-types.ts';
type Btn=(action:string,label:string,disabled?:boolean)=>string;
export function duelDelta(s:DuelState,action:string):string{const pv=previewDuelDeck(s,action);if(!pv.check.ok)return esc(pv.check.reason??'');const a=s,b=pv.state,v0=a.v2!,v1=b.v2!,d0=a.deck!,d1=b.deck!;const out:string[]=[];
 if(a.enemyHp!==b.enemyHp)out.push(`상대 체력 ${a.enemyHp}→${b.enemyHp}`);if((a.enemyShield??0)!==(b.enemyShield??0))out.push(`상대 방비 ${a.enemyShield??0}→${b.enemyShield??0}`);if(a.hp!==b.hp)out.push(`내 체력 ${a.hp}→${b.hp}`);if((a.protection??0)!==(b.protection??0))out.push(`방비 ${a.protection??0}→${b.protection??0}`);
 if(v0.distance!==v1.distance)out.push(`거리 ${DISTANCE_NAMES[v0.distance]}→${DISTANCE_NAMES[v1.distance]}`);if(v0.stance!==v1.stance)out.push(`자세 ${v1.stance?STANCE_NAMES[v1.stance]:'-'}`);if(a.momentum!==b.momentum)out.push(`기세 ${a.momentum}→${b.momentum}`);
 if(v0.opening!==v1.opening)out.push(v1.opening?'빈틈 생김':'빈틈 사용');if(d0.oppOpening!==d1.oppOpening)out.push(d1.oppOpening?'상대 자세 무너짐':'상대 빈틈 사용');if(v0.support!==v1.support)out.push(`상대 지원 ${v0.support}→${v1.support}`);
 if(d0.intent?.card!==d1.intent?.card||d0.intent?.concealed!==d1.intent?.concealed)out.push((action==='end'?'다음 의도: ':'상대 의도: ')+intentLabel(b,d1.intent));if(d1.blindPenalty>d0.blindPenalty)out.push(`상대 공격에 반격 +${d1.blindPenalty}`);
 if((v1.stats.forceHit??0)>=18&&(v0.stats.forceHit??0)<18)out.push('과잉 무력!');if(d1.reactions.length>d0.reactions.length)out.push('반응 준비: '+d1.reactions.slice(d0.reactions.length).map(r=>DUEL_CARDS[r.card].name).join('·'));
 if(action!=='end'&&d1.hand.length>d0.hand.length-1)out.push(`카드 ${d1.hand.length-(d0.hand.length-1)}장 뽑음`);if(d1.revealed>d0.revealed)out.push(`상대 행동 ${d1.revealed}개 공개`);if(d0.intent?.concealed&&!d1.intent?.concealed)out.push('숨긴 의도 확인');
 if(action==='end'){const ev=evaluateDuel(b);if(b.result!=='ongoing')out.push(`결과 ${b.result} · ${ev.grade}`);}
 return esc(out.join(' · ')||'변화 없음');}
/** 지금 이긴다고 가정한 사건 평가 등급(진행 중) 또는 실제 등급(종료). */
export function trendGrade(s:DuelState){if(s.result!=='ongoing')return evaluateDuel(s).grade;const sim=structuredClone(s);sim.result='win';return evaluateDuel(sim).grade+'(승리 시)';}
/** 승부수 카드 안내: 현재 빈틈, 예상 피해, 과잉 무력 가능성, 사건 평가 영향, 예상 등급 변화. 확인창 없이 카드·미리보기에 표시. */
export function gambitGuide(s:DuelState,uid:number):string{const def=DUEL_CARDS[s.deck!.cards.find(c=>c.uid===uid)!.id];if(def.family!=='승부수')return '';const v=s.v2!,d=s.deck!;const opening=v.opening||d.oppOpening;const pv=previewDuelDeck(s,'card:'+uid);const objective0=DUEL_OBJECTIVES[v.objective];const early0=objective0.id==='practice'&&def.id==='t_all_in'&&s.round+1<=2;
 if(!pv.check.ok)return [`현재 빈틈 ${opening?'있음 — 깔끔한 제압':'없음'}`,`과잉 무력 ${opening?'없음':'빈틈 없는 강타는 과잉 무력이 될 수 있음'}`,early0?'첫 두 합의 결사 일격은 연습 평가에서 감점':'',`지금은 사용 불가 · ${pv.check.reason??''}`].filter(Boolean).join(' · ');
 const dmg=s.enemyHp-pv.state.enemyHp;const force=(pv.state.v2!.stats.forceHit??0);const over=force>=18||(pv.state.v2!.stats.forceOverkill??0)>=8;const intent=d.intent;const blind=!opening&&!!intent&&['attack','rush','finisher'].includes(intent.kind);
 const objective=DUEL_OBJECTIVES[v.objective];const early=objective.id==='practice'&&def.id==='t_all_in'&&s.round+1<=2;const g0=trendGrade(s),g1=trendGrade(pv.state);
 const items=[`현재 빈틈 ${opening?'있음 — 깔끔한 제압':'없음'}`,`예상 피해 ${dmg}${pv.state.enemyHp===0?' (제압)':''}`,`과잉 무력 ${over?'해당 — 등급 하락':opening?'없음':'빈틈 없는 강타는 과잉 무력이 될 수 있음'}`,blind?'상대 공격을 맞받아 반격을 받음':'',early?'첫 두 합의 결사 일격은 연습 평가에서 감점':'',`사건 평가 ${objective.name} · ${g0} → ${g1}`];
 return items.filter(Boolean).join(' · ');}
export function duelDeckView(s:DuelState,btn:Btn,opts:{selected?:string|null;selectAttr?:string;actionPrefix?:string}={}):string{
 const d=s.deck!,v=s.v2!,obj=DUEL_OBJECTIVES[v.objective],at=DUEL_ARCHETYPES[d.archetype],ev=evaluateDuel(s);const P=opts.actionPrefix??'';
 const hand=[...d.hand,...d.tacticHand].map(uid=>{const prepared=d.tacticHand.includes(uid);const c=d.cards.find(x=>x.uid===uid)!,def=DUEL_CARDS[c.id];const chk=canDuelDeckAction(s,'card:'+uid);const tip=esc(def.text+(def.followup?` → ${def.followup}`:''));
  if(opts.selectAttr){const guide=gambitGuide(s,uid);return `<button class="duel-card fam-${def.family} ${opts.selected==='card:'+uid?'selected':''}" ${opts.selectAttr}="card:${uid}" aria-disabled="${!chk.ok}" title="${tip}"><span>${prepared?'준비 전술 · ':''}${def.family} · ${def.cost}</span><h4>${esc(def.name)}</h4>${chk.ok?`<p class="duel-delta">${duelDelta(s,'card:'+uid)}</p>`:`<small>${esc(chk.reason??'')}</small>`}${guide?`<p class="duel-guide">${esc(guide)}</p>`:''}</button>`;}
  const guide=gambitGuide(s,uid);return `<article class="duel-card fam-${def.family}" title="${tip}"><span>${prepared?'준비 전술 · ':''}${def.family} · ${def.cost}</span><h4>${esc(def.name)}</h4><p class="duel-delta">${chk.ok?duelDelta(s,'card:'+uid):esc(chk.reason??'')}</p>${guide?`<p class="duel-guide">${esc(guide)}</p>`:''}${btn(P+'card:'+uid,'사용',!chk.ok)}</article>`;}).join('');
 let selected='';if(opts.selectAttr&&opts.selected?.startsWith('card:')){const uid=Number(opts.selected.slice(5));if(d.hand.includes(uid)||d.tacticHand.includes(uid)){const def=DUEL_CARDS[d.cards.find(x=>x.uid===uid)!.id];const guide=gambitGuide(s,uid);selected=`<div class="duel-preview"><h4>${esc(def.name)}</h4><p>${esc(def.text)}</p><p class="duel-delta">${duelDelta(s,'card:'+uid)}</p>${guide?`<p class="duel-guide">${esc(guide)}</p>`:''}${btn(P+'card:'+uid,'카드 사용 확정',!canDuelDeckAction(s,'card:'+uid).ok)}</div>`;}}
 const next=d.upcoming.slice(0,Math.max(0,d.revealed-1)).map(i=>intentLabel(s,i));
 return `<section class="duel-deck" aria-label="대결 덱">
 <div class="duel-sides"><div class="duel-side me"><h4>나</h4><p>체력 <b>${s.hp}/${s.maxHp}</b> · 방비 <b>${s.protection??0}</b> · 기세 <b>${s.momentum}</b></p><p>자세 <b>${v.stance?STANCE_NAMES[v.stance]:'없음'}</b> · 빈틈 <b>${v.opening?'열림('+esc(v.openingSource??'')+')':'닫힘'}</b></p><p>전술력 <b>${d.points}/${d.pointsMax}</b> · 피로 ${d.fatigue}${d.injuries.length?` · 부상 ${d.injuries.length}`:''}</p></div>
  <div class="duel-mid"><p class="duel-distance">${DISTANCE_NAMES[v.distance]}</p><p>${s.round+1}합 / ${s.maxRounds}</p></div>
  <div class="duel-side them"><h4>${esc(at.name)}</h4><p>체력 <b>${s.enemyHp}/${s.enemyMaxHp}</b> · 방비 <b>${s.enemyShield??0}</b> · 기세 <b>${d.oppMomentum}</b></p><p>자세 <b>${d.oppStance?STANCE_NAMES[d.oppStance]:'-'}</b> · ${d.oppOpening?'<b>자세 무너짐(빈틈)</b>':'빈틈 없음'}</p><p>병사 지원 카드 <b>${v.support}</b></p></div></div>
 <p class="duel-intent">상대 다음 의도 · <b>${esc(intentLabel(s,d.intent))}</b>${next.length?` → ${esc(next.join(' → '))}`:''}</p>
 ${s.result==='ongoing'?`<div class="duel-hand">${hand}</div>${selected}<div class="duel-controls">${btn(P+'end','합 마치기 · 상대 의도 실행')}<p class="duel-delta">${duelDelta(s,'end')}</p>${btn(P+'surrender','기권')}</div>`:''}
 <div class="duel-meta"><details><summary>사건 목표 · ${esc(obj.name)} · 현재 예상 ${esc(trendGrade(s))}</summary><p>${esc(obj.partialSuccessRules)}</p>${ev.checks.map(c=>`<h5>${esc(c.grade)}</h5><ul>${c.items.map(i=>`<li>${i.ok?'충족':'미충족'} · ${esc(i.text)}</li>`).join('')}</ul>`).join('')}${ev.adjust?.length?`<p>${esc(ev.adjust.join(' · '))}</p>`:''}</details>
 <details><summary>준비 전술·인재 지원 (${d.prepared.length})</summary>${d.prepared.map(p=>`<p>${esc(p)}</p>`).join('')}${d.officers.map(o=>`<p>${esc(OFFICERS[o]?.name??o)} · ${esc(DUEL_SUPPORT[o]?.principle??'')}</p>`).join('')}<p>상대: ${esc(at.text)} (${esc(at.weak)})</p></details>
 <details><summary>합 기록</summary>${d.stats.log.map(l=>`<p>${l.exchange}합 · ${esc(l.cards.join('→')||'카드 없음')} / 상대 ${esc(l.intent)} · 준 피해 ${l.dealt} · 받은 피해 ${l.taken} · ${esc(l.distance)}${l.notes.length?' · '+esc(l.notes.join(' · ')):''}</p>`).join('')}${s.log.slice(-6).map(t=>`<p>${esc(t)}</p>`).join('')}</details></div>
 </section>`;}
