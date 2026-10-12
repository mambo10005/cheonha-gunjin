/**
 * 카드 엔진 화면 조각: 사건 퍼즐(장애·표식·해결), 활동 덱과 보관함, 책략, 대결 전술 3장,
 * 설전 지속 논거, 군진 전투 임시 카드, 거병 관문 규칙, 사건 보상. 모든 버튼은 data-explore-action 명령이다.
 */
import {CARD_GRAMMAR,MARK_NAMES,MARKS,FAMILY6_NAMES,ACTION_NAMES,markText,grammarText} from '../data/card-grammar.ts';
import {PUZZLES} from '../data/card-puzzles.ts';
import {STRATAGEMS,STRATAGEM_SLOTS} from '../data/stratagems.ts';
import {TALENTS} from '../data/talents.ts';
import {RAISING_CARDS} from '../data/raising.ts';
import {OFFICERS} from '../data/personnel.ts';
import {EXPLORATION_ITEMS} from '../data/city-exploration.ts';
import {CARDS} from '../data/cards.ts';
import {COMMON_CARDS,engineOf,currentPuzzle,puzzleResolutions,alertLimit,duelTacticOptions,DUEL_TACTICS,debateArguments,escortBattleConversions,gateRuleText,deckComposition,deckCategory,DECK_CAPS,DECK_CATEGORY_NAMES,DECK_LIMIT,activeTalents,loadoutComplete} from '../core/card-engine.ts';
import {explorationOf} from '../core/city-exploration.ts';
import {personnelOf,isRecruited,personnelAvailability} from '../core/personnel-rules.ts';
import {esc} from './html.ts';
import type {RunState} from '../core/types.ts';
import type {RaisingCard} from '../core/raising-types.ts';
import type {DuelState} from '../core/social-types.ts';
import type {Mark} from '../core/card-engine-types.ts';

const btn=(id:string,label:string,disabled=false,title='')=>`<button class="btn" data-explore-action="${esc(id)}" ${disabled?'disabled':''} ${title?`title="${esc(title)}"`:''}>${esc(label)}</button>`;
const marksRow=(bag:Partial<Record<Mark,number>>,limit?:number)=>`<ul class="engine-marks">${MARKS.filter(m=>(bag[m]??0)>0||m==='alert').map(m=>`<li class="mark-${m}${m==='alert'&&limit&&(bag.alert??0)>=limit-1?' danger':''}"><span>${MARK_NAMES[m]}</span><strong>${bag[m]??0}${m==='alert'&&limit?`/${limit}`:''}</strong></li>`).join('')}</ul>`;

/** 손패 카드의 공통 문법 한 줄. */
export function cardGrammarLine(c:RaisingCard){const g=CARD_GRAMMAR[c.id];if(!g)return '';const up=c.upgrade?` · ${g.upgradeBranches[c.upgrade].name}: ${g.upgradeBranches[c.upgrade].text}`:'';return `<p class="card-grammar">${esc(grammarText(g)+up)}</p>`;}
export function cardTag(c:RaisingCard){const g=CARD_GRAMMAR[c.id];return g?`${FAMILY6_NAMES[g.family]}·${ACTION_NAMES[g.action]}`:'';}
/** 미리보기(복제 상태)와 현재 상태의 표식·장애 차이. 실제 사용과 같은 함수 경로를 쓴다. */
export function enginePreviewText(before:RunState,after:RunState){const a=engineOf(before),b=engineOf(after);if(!a?.scene||!b?.scene)return '';const diff=MARKS.filter(m=>(a.scene!.marks[m]??0)!==(b.scene!.marks[m]??0)).map(m=>`${MARK_NAMES[m]} ${a.scene!.marks[m]??0}→${b.scene!.marks[m]??0}`);const pa=currentPuzzle(before),pb=engineOf(after)!.puzzles[pa?.def.id??''];const obs=pa&&pb?pa.state.obstacles.filter(o=>pb.obstacles.find(v=>v.id===o.id)!.hp!==o.hp).map(o=>`${pa.def.obstacles.find(d=>d.id===o.id)!.name} ${o.hp}→${pb.obstacles.find(v=>v.id===o.id)!.hp}`):[];const failed=pa&&pb&&pb.status==='failed'?['⚠ 경계 한도 도달: 사건 실패']:[];return [...obs,...diff,...failed].join(' · ');}

/** 첫 주요 인재와의 협력: 공통 카드 교체(최대 2)와 조기 책략(3개 중 1). */
export function pactPanel(r:RunState):string {const e=engineOf(r),p=personnelOf(r);if(!e?.pact?.open||!p)return '';const pact=e.pact,commons=p.loadouts.raising.map(uid=>p.library.find(l=>l.uid===uid)!).filter(l=>l&&COMMON_CARDS.includes(l.id)&&l.sourceType==='protagonist');
 return `<section class="engine-pact"><header><span class="exploration-eyebrow">첫 협력 · ${OFFICERS[pact.talent].name}</span><h3>공통 카드를 ${OFFICERS[pact.talent].name}의 방식으로 바꾸기 (${pact.swaps.length}/2)</h3><p>카드를 더하지 않고 바꿉니다. 빠진 공통 카드는 보관함에 남아 나중에 다시 편성할 수 있습니다. 바꾼 카드는 다음 장소 첫 손패에 들어옵니다.</p></header>
 <div class="engine-pact-cards">${pact.cards.map(id=>{const done=pact.swaps.some(s=>s.added===id);return `<article class="${done?'chosen':''}"><h4>${esc(RAISING_CARDS[id].name)}</h4><p class="card-grammar">${esc(grammarText(CARD_GRAMMAR[id]))}</p>${done?'<small>교체 완료</small>':commons.map(l=>btn(`engine:pact-swap:${id}:${l.uid}`,`「${RAISING_CARDS[l.id].name}」 대신`,pact.swaps.length>=2)).join('')}</article>`;}).join('')}</div>
 <h4>거병 책략 · 첫 사건 전에 1개 (${pact.stratagem?'선택 완료':'미선택'})</h4><div class="engine-pact-stratagems">${pact.stratagems.map(id=>`<article class="${pact.stratagem===id?'chosen':''}"><b>${STRATAGEMS[id].name}</b><p>${esc(STRATAGEMS[id].text)}</p>${btn('engine:pact-stratagem:'+id,pact.stratagem===id?'장착됨':'이 책략 장착',!!pact.stratagem)}</article>`).join('')}</div>
 ${btn('engine:pact-close',pact.swaps.length||pact.stratagem?'협력 확정':'지금은 바꾸지 않기(다음 인재 의뢰로 미룸)')}</section>`;}
export function puzzlePanel(r:RunState):string {
 const pz=currentPuzzle(r),e=engineOf(r),x=explorationOf(r);if(!e||!x)return '';return pactPanel(r)+puzzleBody(r,pz,e,x);}
function puzzleBody(r:RunState,pz:ReturnType<typeof currentPuzzle>,e:NonNullable<ReturnType<typeof engineOf>>,x:NonNullable<ReturnType<typeof explorationOf>>):string {
 const failed=Object.values(e.puzzles).find(p=>p.status==='failed'&&PUZZLES[p.id].location===x.location);
 if(!pz)return (failed?`<section class="engine-puzzle failed"><h3>${PUZZLES[failed.id].title} · 실패</h3><p>${esc(PUZZLES[failed.id].failure.text)}</p></section>`:'')+rewardPanel(r);
 const {def,state}=pz,limit=alertLimit(r,def),marks=e.scene?.marks??{};
 const obstacles=state.obstacles.map(o=>{const d=def.obstacles.find(v=>v.id===o.id)!;return `<article class="engine-obstacle ${o.hp?'':'cleared'} ${state.focus===o.id?'focus':''}"><header><h4>${d.name}</h4><span>${o.hp?`남은 ${o.hp}/${o.max}`:'해소'}</span></header><div class="engine-hp" aria-hidden="true">${Array.from({length:o.max},(_,i)=>`<i class="${i<o.hp?'on':''}"></i>`).join('')}</div><p>${esc(d.text)}</p><small>줄이는 행동: ${d.accepts.map(a=>ACTION_NAMES[a]).join('·')} · 열쇠 표식 ${MARK_NAMES[d.key]}(보유 시 1 소비, 장애 +1)</small>${o.hp?btn('engine:focus:'+o.id,state.focus===o.id?'지정한 대상':'이 장애를 대상으로',state.focus===o.id):''}</article>`;}).join('');
 const res=puzzleResolutions(r).map(v=>`<article class="engine-resolution ${v.reason?'locked':''}"><span class="engine-quality q-${v.quality}">${({complete:'완전 해결',partial:'부분 성공',debate:'설전 전환',duel:'대결 전환'} as const)[v.quality]}</span><h4>${esc(v.label)}</h4><p>${esc(v.text)}</p><small>거병 후 · ${esc(v.legacy.text)}${v.cost?.funds?` · 자금 −${v.cost.funds}`:''}${v.cost?.food?` · 군량 −${v.cost.food}`:''}</small>${btn('engine:resolve:'+v.id,'이 방식으로 해결',!!v.reason)}${v.reason?`<small class="exploration-approach-reason">${esc(v.reason)}</small>`:''}</article>`).join('');
 const items=x.items.filter(i=>def.items[i.id as keyof typeof def.items]).map(i=>btn('engine:item:'+i.uid,`${EXPLORATION_ITEMS[i.id].name} 제출 · ${markText(def.items[i.id as keyof typeof def.items])}`)).join('');
 const chain=e.scene?.chain.map(c=>`<li>${esc(RAISING_CARDS[c.card]?.name??c.card)} <small>${FAMILY6_NAMES[c.family]}·${ACTION_NAMES[c.action]}${c.consumed.length?' · 소비 '+c.consumed.map(m=>MARK_NAMES[m]).join('·'):''}${c.produced.length?' · 생산 '+c.produced.map(m=>MARK_NAMES[m]).join('·'):''}</small></li>`).join('')??'';
 const needsDuel=def.resolutions.some(v=>v.quality==='duel');
 return `<section class="engine-puzzle" data-engine-puzzle="${def.id}"><header><span class="exploration-eyebrow">사건 카드 퍼즐</span><h3>${def.title}</h3><p>${esc(def.intro)}</p></header>
 <div class="engine-puzzle-state"><div><h4>장면 표식</h4>${marksRow(marks,limit)}<small>경계가 ${limit}에 닿으면 사건이 실패합니다. 조사 대상과 증거 아이템도 표식을 남깁니다.</small></div><div><h4>이번 방문의 연쇄</h4><ol class="engine-chain">${chain||'<li>아직 사용한 카드가 없습니다. 앞 카드가 만든 표식을 다음 카드가 소비합니다.</li>'}</ol>${btn('engine:mulligan','손패 정리 · 시간 1',!!e.scene?.uses.mulligan)}</div></div>
 <div class="engine-obstacles">${obstacles}</div>${items?`<div class="engine-items"><h4>증거·물자 제출</h4>${items}</div>`:''}
 ${needsDuel?loadoutPanel(r,true):''}
 <div class="engine-resolutions"><h4>해결 방식 · 장애와 표식 상태로 열립니다</h4>${res}</div>
 <details class="engine-arguments"><summary>설전에 가져갈 지속 논거 ${debateArguments(r).length}개</summary>${argumentsList(r)}</details>
 <details><summary>사건 기록</summary>${e.log.slice(-8).map(t=>`<p>${esc(t)}</p>`).join('')}</details></section>`;
}
export function rewardPanel(r:RunState){const e=engineOf(r),p=personnelOf(r);if(!e?.reward||!p)return '';const rw=e.reward;const upg=p.library.filter(l=>!l.upgrade&&!l.spent&&CARD_GRAMMAR[l.id]).slice(0,14),rem=p.library.filter(l=>!l.owners.some(o=>o!==p.protagonistId)).slice(0,14);
 return `<section class="engine-reward"><header><span class="exploration-eyebrow">주요 사건 보상 · 하나만 선택</span><h3>${esc(PUZZLES[rw.event]?.title??rw.event)}</h3></header>
 <div class="engine-reward-cards">${rw.cards.map(id=>`<article><h4>${esc(RAISING_CARDS[id].name)}</h4><p class="card-grammar">${esc(grammarText(CARD_GRAMMAR[id]))}</p>${btn('engine:reward:card:'+id,'보관함에 추가')}</article>`).join('')}</div>
 <div class="engine-reward-other">${btn('engine:reward:skip','카드 받지 않기')}
 <details><summary>카드 강화</summary>${upg.map(l=>btn(`engine:reward:upgrade:${l.uid}:bold`,`${RAISING_CARDS[l.id].name} · 강행`)+btn(`engine:reward:upgrade:${l.uid}:quiet`,`${RAISING_CARDS[l.id].name} · 정밀`)).join('')}</details>
 <details><summary>카드 제거</summary>${rem.map(l=>btn('engine:reward:remove:'+l.uid,`제거 · ${RAISING_CARDS[l.id].name}`)).join('')}</details>
 ${rw.officer&&p.officers[rw.officer]?.information>=2?btn('engine:reward:relation:'+rw.officer,`${OFFICERS[rw.officer].name} 관계 · 신뢰 +10`):''}
 ${rw.stratagems.map(id=>`<article class="engine-reward-stratagem"><b>책략 「${STRATAGEMS[id].name}」</b><p>${esc(STRATAGEMS[id].text)}</p>${e.stratagems.length>=STRATAGEM_SLOTS?e.stratagems.map(old=>btn(`engine:reward:stratagem:${id}:${old}`,`「${STRATAGEMS[old].name}」 대신 장착`)).join(''):btn(`engine:reward:stratagem:${id}`,'이 책략 장착')}</article>`).join('')}
 ${rw.item?btn('engine:reward:item',`아이템 · ${EXPLORATION_ITEMS[rw.item as 'ration'].name}`):''}${btn('engine:reward:resource:funds','자원 · 자금 +2')}${btn('engine:reward:resource:food','자원 · 군량 +2')}</div></section>`;}
export function argumentsList(r:RunState){const args=debateArguments(r);return args.length?`<ul class="engine-argument-list">${args.map(a=>`<li><b>${esc(a.label)}</b> <small>${esc(a.source)}</small> · ${esc(a.text)}</li>`).join('')}</ul>`:'<p>아직 설전에 가져갈 논거가 없습니다. 사건 장애를 풀거나 증거 아이템·인재 동행으로 논거를 만드세요.</p>';}
export function loadoutPanel(r:RunState,compact=false){const e=engineOf(r);if(!e)return '';const opts=duelTacticOptions(r),l=e.loadout;
 const slot=(s:'opening'|'response'|'gambit',label:string)=>`<div class="engine-loadout-slot"><h5>${label}</h5>${opts.filter(o=>o.slot===s).map(o=>`<button class="engine-tactic ${l[s]===o.id?'selected':''}" data-explore-action="engine:tactic:${s}:${o.id}" ${o.ok&&l[s]!==o.id?'':'disabled'} aria-pressed="${l[s]===o.id}"><b>${o.name}</b><small>${esc(o.text)}</small><small>${esc(o.source)}</small></button>`).join('')}</div>`;
 return `<section class="engine-loadout${compact?' compact':''}"><h4>대결 전술 3장 ${loadoutComplete(l)?`· ${[l.opening,l.response,l.gambit].map(id=>DUEL_TACTICS[id!].name).join(' / ')}`:'· 미편성'}</h4><p>조사·정보는 상대 행동 공개, 군사는 공격과 기세, 인맥·관계는 실패 완화, 물자는 방비와 회복으로 이어집니다.</p><div class="engine-loadout-grid">${slot('opening','선제')}${slot('response','대응')}${slot('gambit','승부수')}</div></section>`;}
export function battleConversionPanel(r:RunState){const list=escortBattleConversions(r);return `<section class="engine-conversion"><h4>군진 전투 전 변환 · 의뢰 준비 → 임시 카드</h4>${list.length?`<ul>${list.map(c=>`<li><b>${esc(c.label)}</b> → ${esc(CARDS[c.card]?.name??c.card)} <small>${esc(c.source)}</small></li>`).join('')}</ul>`:'<p>변환될 준비가 없습니다.</p>'}<small>임시 카드는 이번 전투에만 덱에 들어가고 끝나면 사라집니다.</small></section>`;}
export function duelLoadoutView(s:DuelState){if(!s.loadout)return '';const l=s.loadout;return `<div class="engine-duel-loadout"><p>전술 · 선제 ${l.opening?DUEL_TACTICS[l.opening]?.name:'없음'} · 대응 ${l.response?DUEL_TACTICS[l.response]?.name+(l.used.includes(l.response)?'(사용)':''):'없음'} · 승부수 ${l.gambit?DUEL_TACTICS[l.gambit]?.name+(l.used.includes('gambit')?'(사용)':''):'없음'}</p>${l.revealed?`<p>수읽기 · 상대 순서: ${Array.from({length:Math.max(0,s.maxRounds-s.round)},(_,i)=>({strike:'강타',probe:'견제',guard:'방어',finisher:'필살'} as Record<string,string>)[s.pattern[(s.round+i+s.patternOffset)%s.pattern.length]]).join(' → ')}</p>`:''}</div>`;}
export const gambitName=(s:DuelState)=>s.loadout?.gambit?`승부수 · ${DUEL_TACTICS[s.loadout.gambit].name}`:'승부수';

/** 지도 서랍: 활동 덱 12장, 책략 2칸, 대결 전술, 논거, 성장, 관문 규칙. */
export function engineDrawer(r:RunState):string {
 const e=engineOf(r),p=personnelOf(r),x=explorationOf(r);if(!e||!p||!x)return '<p>이 저장 기록은 카드 엔진 이전 규칙을 사용합니다.</p>';
 const comp=deckComposition(r),active=p.loadouts.raising.map(uid=>p.library.find(c=>c.uid===uid)!).filter(Boolean),storage=p.library.filter(l=>!p.loadouts.raising.includes(l.uid)&&l.activities.includes('raising')&&!l.spent);
 const onMap=x.scene==='map';
 const card=(l:typeof active[number],inDeck:boolean)=>{const g=CARD_GRAMMAR[l.id],why=inDeck?null:personnelAvailability(r,l,'raising');return `<article class="engine-deck-card ${why?'locked':''}"><span>${DECK_CATEGORY_NAMES[deckCategory(r,l)]}${l.owners.length&&l.owners[0]!==p.protagonistId?` · ${l.owners.map(o=>OFFICERS[o]?.name??o).join('·')}`:''}</span><h5>${esc(RAISING_CARDS[l.id].name)}${l.upgrade?` <small>${l.upgrade==='bold'?'강행':'정밀'}</small>`:''}</h5><p class="card-grammar">${esc(g?grammarText(g):'')}</p>${why?`<small>${esc(why)}</small>`:''}${btn(`officer:equip:${l.uid}:raising`,inDeck?'보관함으로':'활동 덱에 편성',!onMap||!inDeck&&!!why)}</article>`;};
 const talents=Object.values(TALENTS).filter(t=>p.officers[t.id]&&p.officers[t.id].information>=2);
 return `<div class="engine-drawer">
 <section><h3>활동 덱 ${active.length}/${DECK_LIMIT}</h3><p>${(Object.keys(DECK_CAPS) as (keyof typeof DECK_CAPS)[]).map(k=>`${DECK_CATEGORY_NAMES[k]} ${comp[k]}/${DECK_CAPS[k]}`).join(' · ')}</p><p>등용한 인재의 카드는 보관함에 들어가며, 그 인재가 동행할 때만 편성·사용할 수 있습니다.${onMap?'':' 편성은 도시 지도에서 바꿀 수 있습니다.'}</p><div class="engine-deck-grid">${active.map(l=>card(l,true)).join('')}</div><h4>보관함</h4><div class="engine-deck-grid">${storage.map(l=>card(l,false)).join('')||'<p>보관 중인 카드가 없습니다.</p>'}</div></section>
 <section><h3>거병 책략 ${e.stratagems.length}/${STRATAGEM_SLOTS}</h3>${e.stratagems.map(id=>`<article><b>${STRATAGEMS[id].name}</b><p>${esc(STRATAGEMS[id].text)}</p></article>`).join('')||'<p>아직 책략이 없습니다. 주요 사건 보상에서 고를 수 있습니다. 칸이 찬 뒤 교체는 자금 1·준비 시간 1.</p>'}<details><summary>책략 8종 보기</summary>${Object.values(STRATAGEMS).map(s=>`<p><b>${s.name}</b> · ${esc(s.text)}</p>`).join('')}</details></section>
 <section><h3>인재 원칙과 성장</h3>${talents.map(t=>{const o=p.officers[t.id],on=activeTalents(r).includes(t.id),mode=e.principles[t.id]??'base',grow=isRecruited(o)&&o.xp>=2&&!o.growth;return `<article class="engine-talent"><h4>${t.name} <small>${t.theme} · ${on?'동행·원칙 작동':isRecruited(o)?'등용·비동행(원칙 꺼짐)':'미등용'}</small></h4><p><b>${mode==='base'?t.principle.name:t.alt.name}</b> · ${esc(mode==='base'?t.principle.text:t.alt.text)}</p><p>역할 ${esc(RAISING_CARDS[t.role].name)} · 고유 ${t.unique.map(id=>esc(RAISING_CARDS[id].name)).join('·')} · 보좌 ${esc(RAISING_CARDS[t.support].name)} · 합동 ${t.joint.map(id=>esc(RAISING_CARDS[id].name)).join('·')}</p>${o.growth?`<p>성장 완료 · ${({add:'카드 추가',upgrade:'카드 강화',replace:'카드 교체',principle:'원칙 변화'} as Record<string,string>)[e.growth[t.id]??'']??o.growth}</p>`:`<div class="engine-growth">${(['add','upgrade','replace','principle'] as const).map(m=>btn(`engine:growth:${t.id}:${m}`,({add:'추가',upgrade:'강화',replace:'교체',principle:'원칙'})[m]+' · '+t.growth[m].text,!grow)).join('')}</div>${grow?'':'<small>성장: 정식 등용·경험 2 이상</small>'}`}</article>`;}).join('')||'<p>만난 주요 인재가 없습니다.</p>'}</section>
 ${loadoutPanel(r)}
 <section><h3>설전 지속 논거</h3>${argumentsList(r)}</section>
 <section><h3>거병 관문의 빌드 시험</h3>${x.unlockedPlans.map(id=>`<p><b>${({assembly:'민회와 격문',barracks:'군영 장악',inside:'성문 내응'})[id]}</b> · ${esc(gateRuleText(id))}</p>`).join('')||'<p>아직 발견한 거병 계획이 없습니다.</p>'}</section>
 <section><h3>휴식 정제 (하루 1회 · 시간 2)</h3><div class="engine-rest">${btn('rest:fatigue','피로 회복')}${active.filter(l=>!l.upgrade).slice(0,3).map(l=>btn(`rest:upgrade:${l.uid}:quiet`,`정밀 강화 · ${RAISING_CARDS[l.id].name}`)).join('')}${active.filter(l=>!l.owners.some(o=>o!==p.protagonistId)).slice(0,3).map(l=>btn(`rest:remove:${l.uid}`,`제거 · ${RAISING_CARDS[l.id].name}`)).join('')}${x.companions.map(id=>btn(`rest:talk:${id}`,`${OFFICERS[id].name}와 대화`)).join('')}</div></section>
 <section><h3>플레이 계측(로컬)</h3><p>카드 사용·미사용, 표식, 책략 발동, 보상 선택, 덱 교체, 사건별 카드 수, 설전·대결 순서, 철회·결과를 이 브라우저에만 저장합니다. 외부로 보내지 않습니다.</p><button class="btn" data-engine-report>디버그 리포트 저장(로컬)</button></section>
 <section><h3>거병 후로 이어질 결과</h3>${e.legacy.map(l=>`<p>${({policy:'정책',obligation:'의무',gate:'관문'} as const)[l.kind]} · ${esc(l.text)}</p>`).join('')||'<p>아직 없습니다.</p>'}</section>
 </div>`;
}
