import {deckHandHtml,deckSummaryHtml,deckPreviewHtml,deckCounterHtml} from './debate-deck-view.ts';
import { characterArt, poseAsset, meetingPlace, meetingSubject, MEETING_PLACES } from '../data/debate-art.ts';
import {DEBATE_CARDS} from '../data/debate-cards.ts';
import { GENERALS } from '../data/generals.ts';
import { ARGUMENTS, AXIS_NAMES } from '../data/arguments.ts';
import { CONCERN_NAME, DEBATE_ACTIONS, DEBATE_OPPONENTS, TRAIT_TEXT } from '../data/social.ts';
import { ARGUMENT_VISUALS, characterPresentation, opponentLine } from '../data/debate-presentation.ts';
import { previewDebateAction } from '../core/debate.ts';
import { debateOutcomeTerms, finishDebate, parleyTerms } from '../core/social-run.ts';
import { missingDemands } from '../core/negotiation.ts';
import { CLAUSES, agreementQuote, describeAgreement } from '../core/accords.ts';
import type { DebateState } from '../core/social-types.ts';
import type { RunState } from '../core/types.ts';
import { activityButton, esc } from './html.ts';

const labels:Record<string,string>={...AXIS_NAMES,trust:'신뢰',burden:'부담',agreement:'합의',focus:'집중',food:'군량',reports:'정보',credentials:'신용'};
const symbols:Record<string,string>={profit:'군량',safety:'안전',honor:'명분',authority:'권한',trust:'양보',burden:'부담',agreement:'협정'};
const results={ongoing:'회담 진행 중',success:'합의 성립',partial:'부분 합의',failure:'결렬'};
export function requirements(s:DebateState):{key:string;value:number;needed:number;met:boolean;limit?:boolean}[]{
  const n=s.negotiation;
  if(!n)return [{key:'agreement',value:s.agreement,needed:10,met:s.agreement>=10},{key:'trust',value:s.trust,needed:2,met:s.trust>=2}];
  return [...Object.entries(n.needs).map(([key,needed])=>({key,value:n.scores[key as keyof typeof n.scores],needed:needed!,met:n.scores[key as keyof typeof n.scores]>=needed!})),{key:'trust',value:s.trust,needed:n.trustNeeded,met:s.trust>=n.trustNeeded}];
}
function portrait(id:string,name:string,side:string):string{
  const p=characterPresentation(id),a=characterArt(id);
  return `<div class="debate-person ${side}" data-person="${esc(id)}" data-pose="idle" data-quality="${a.quality}" style="--person-color:${p.factionPalette}"><div class="portrait-frame" style="--desktop-crop:${a.crop.desktop};--mobile-crop:${a.crop.mobile};--portrait-low:url(${a.placeholder})"><img width="${a.width}" height="${a.height}" src="${esc(poseAsset(id,'neutral'))}" data-portrait data-layer="front" data-fallback="${esc(a.fallback)}" decoding="async" fetchpriority="high" alt="${esc(name)}${a.quality==='silhouette'?' 비식별 실루엣':' 반신 원화'}"><img width="${a.width}" height="${a.height}" data-portrait data-layer="back" data-fallback="${esc(a.fallback)}" alt="" aria-hidden="true" hidden><span class="portrait-fallback" hidden aria-hidden="true">설전</span>${import.meta.env?.DEV&&a.quality==='silhouette'?'<span class="portrait-caption">임시 실루엣</span>':''}</div><div class="person-name"><h2>${esc(name)}</h2><span class="person-seal" aria-hidden="true">${p.textStyle}</span></div></div>`;
}
export function argumentPreview(s:DebateState,id:string):string{
  if(s.deck)return deckPreviewHtml(s,id);
  const pv=previewDebateAction(s,id), t=pv.state, n=s.negotiation, next=t.negotiation;
  if(!pv.check.ok)return `<p>${esc(pv.check.reason ?? '')}</p>`;
  const changes:[string,number,number][]=[['focus',s.resolve,t.resolve],['trust',s.trust,t.trust]];
  if(n&&next){for(const k of Object.keys(n.scores))changes.push([k,n.scores[k as keyof typeof n.scores],next.scores[k as keyof typeof next.scores]]);
    changes.push(['food',n.food,next.food],['reports',n.reports,next.reports],['credentials',n.credentials,next.credentials],['burden',n.burden,next.burden]);
  }else changes.push(['agreement',s.agreement,t.agreement]);
  return `<div class="preview-values">${changes.filter(([,a,b])=>a!==b).map(([key,a,b])=>`<span>${labels[key]} <b>${a} → ${b}</b></span>`).join('')}</div>${next&&n&&!n.counter.applied&&next.counter.applied?`<p class="counter-note">동시에 상대 반론: ${AXIS_NAMES[next.counter.axis]} 요구 ${n.needs[next.counter.axis]??0} → ${next.needs[next.counter.axis]}</p>`:''}${id==='pledge'?'<p class="price-note">군량 2 즉시 지불 · 실패하거나 중단해도 환급하지 않습니다.</p>':''}${id==='authority'?'<p class="price-note">부담 +2 · 최종 수락 시 다음 카드 보상 선택지 −1.</p>':''}${t.result!=='ongoing'?`<p>최종 예상: <b>${results[t.result]}</b> · ${next?esc(missingDemands(t)):'합의·신뢰 기준 적용'}</p>`:''}`;
}
export function debateScene(run:RunState):string{
  if(run.pending.kind!=='debate')return '';
  const s=run.pending.state,n=s.negotiation;
  const resultTitle=s.deck?(s.deck.withdrawn?'철회':s.result==='partial'?'조건부 합의':s.result==='success'?'완전 합의':results[s.result]):results[s.result];
  const cards=n?ARGUMENTS:DEBATE_ACTIONS;
  const goal=n?`${Object.keys(n.needs).map(k=>AXIS_NAMES[k as keyof typeof AXIS_NAMES]).join('·')}과 신뢰를 충족하고 부담 상한을 지키십시오.`:'4회 후 합의 10·신뢰 2 이상이면 성공. 합의 6·신뢰 1 이상이면 부분 합의.';
  const place=meetingPlace(s),location=MEETING_PLACES[place];
  const topic=n?Object.entries(n.needs).find(([k,v])=>n.scores[k as keyof typeof n.scores]<v!)?.[0]??'trust':s.concerns[Math.min(s.round,3)];
  let html=`<section class="debate-scene cinematic" aria-label="간이 교섭" data-result="${s.result}" data-camera="establishing" data-speaker="player" data-place="${place}" data-variation="${(s.rng>>>0)%3}" style="--place-light:${location.light}"><div class="scene-depth background" aria-hidden="true"><img src="${location.image}" width="1535" height="864" alt="" decoding="async" fetchpriority="high" data-scene-background></div><div class="scene-depth midground" aria-hidden="true"><div class="meeting-table"><i class="table-map"></i><i class="table-lamp"></i><span class="table-prop">${location.prop}</span></div><i class="meeting-banner"></i></div><div class="scene-depth foreground" aria-hidden="true"><i class="curtain left"></i><i class="curtain right"></i><i class="scene-dust"></i></div><header class="debate-heading"><div><span class="eyebrow">${location.name} · ${meetingSubject(s)}</span><h1>설전 <span>${resultTitle}</span></h1></div><div class="round-seal">${Math.min(s.round+1,s.maxRounds)} / ${s.maxRounds}<small>논점 · 완료 ${s.round}</small></div></header><div class="debate-stage">${portrait(s.generalId,GENERALS[s.generalId].name,'player')}${portrait(s.opponentId,DEBATE_OPPONENTS[s.opponentId].name,'opponent')}<div class="debate-center"><span class="topic-label">현재 논점 · ${labels[topic]??CONCERN_NAME[topic as keyof typeof CONCERN_NAME]}</span><div class="argument-collision" aria-hidden="true"><span data-effect-symbol>${symbols[topic]??'설전'}</span><i class="ink-stroke"></i><i class="impact-seal"></i></div><p class="goal">${esc(goal)}</p><section class="requirement-front" aria-label="핵심 요구">${requirements(s).map(r=>`<div class="requirement axis-${r.key} ${r.met?'met':''}" data-requirement="${r.key}"><span class="axis-symbol" aria-hidden="true">${symbols[r.key]}</span><b>${labels[r.key]}</b><strong>${r.value}<em> / ${r.needed}</em></strong><small>${r.met?'✓ 현재 충족':'○ 미충족'}</small><span class="requirement-forecast" data-forecast="${r.key}"></span></div>`).join('')}</section>${n?`<p class="burden-line ${n.burden>n.burdenLimit?'over':''}">부담 ${n.burden}/${n.burdenLimit} · ${n.burden>n.burdenLimit?'초과 · 합의 불가':'수용 가능'}${n.concessionReady?' · 양보 연계':''}</p>`:''}<p class="counter-note">${s.deck?esc(deckCounterHtml(s)):n?`반론 ${n.counter.applied?'적용됨':'예고 · 2회 답변 뒤'}: ${AXIS_NAMES[n.counter.axis]} 요구 +1`:`현재 관심사 ${CONCERN_NAME[s.concerns[Math.min(s.round,3)]]}${s.revealed[s.round+1]?' · 다음 '+CONCERN_NAME[s.revealed[s.round+1]]:''}`}</p></div><div class="speech player-speech"><span>${GENERALS[s.generalId].name} · 제안</span><p data-speech-player>“조건을 하나씩 살펴봅시다.”</p></div><div class="speech opponent-speech"><span>${DEBATE_OPPONENTS[s.opponentId].name} · 요구</span><p data-speech-opponent>“${esc(opponentLine(s))}”</p></div></div><div class="scene-feedback" role="status" aria-live="polite" aria-atomic="true" data-scene-feedback>논거 패를 선택하십시오.</div>`;
  if(s.deck)html+=deckSummaryHtml(s);
  if(s.result==='ongoing'&&s.deck){html+=deckHandHtml(s);}
  else if(s.result==='ongoing'){
    html+=`<section class="hand-dock" aria-label="논거 손패"><h2 class="hand-title">간이 교섭 · 고정 행동 <small>가로 탐색 · 선택 후 실행</small></h2><p class="chain-help">${n?.concessionReady?'정보 공개 완료: 바로 부담 양보를 실행하면 집중 +2 · 안전 +1 · 신뢰 +2. 다른 행동을 먼저 하면 양보 연계가 사라집니다.':'기존 설전은 고정 행동을 선택합니다. 추가 카드 뽑기·곽가 계책 연계는 61001 전용 덱 원정에서 체험하세요.'}</p><div class="argument-hand" tabindex="-1" data-hand-focus aria-label="다음 논거 선택">${Object.entries(cards).map(([id,d])=>{
      const pv=previewDebateAction(s,id),v=ARGUMENT_VISUALS[id];
      const short=n?Object.entries(ARGUMENTS[id as keyof typeof ARGUMENTS].scores).slice(0,2).map(([k,a])=>`${AXIS_NAMES[k as keyof typeof AXIS_NAMES]} +${a}`).join(' · '):d.text.split(' 신뢰')[0];
      return `<button class="argument-card argument-${id}" data-family="${v.family}" data-debate-select="${id}" aria-label="${esc(d.name)} · 집중 ${d.cost}${pv.check.reason?' · '+esc(pv.check.reason):''}" aria-disabled="${!pv.check.ok}" aria-pressed="false"><span class="argument-category">${v.family} <b>집중 ${d.cost}</b></span><span class="argument-symbol" aria-hidden="true">${v.symbol}</span><span class="argument-match">${n?Object.keys(ARGUMENTS[id as keyof typeof ARGUMENTS].scores).filter(k=>n.needs[k as keyof typeof n.scores]!==undefined&&n.scores[k as keyof typeof n.scores]<n.needs[k as keyof typeof n.scores]!).map(k=>AXIS_NAMES[k as keyof typeof AXIS_NAMES]).join("·")||"보조 논거":v.family}${id==="concede"&&n?.concessionReady?" · 연계":""}</span><strong>${d.name}</strong><span class="argument-summary">${esc(short)}</span><small>${id==='pledge'?'군량 2 즉시 지급 · 환급 없음':id==='authority'?'부담 +2 · 수락 시 보상 제한':id==='disclose'?'정보 1 → 다음 양보 연계':id==='credential'?'신용 1 소비':id==='concede'?'집중 +2 · 신뢰 회복':id==='rebuttal'?'신뢰 −1':'신뢰 +1'}</small>${!pv.check.ok?`<span class="lock-reason">🔒 ${esc(pv.check.reason ?? '')}</span>`:''}</button>`;
    }).join('')}</div><section class="argument-detail" hidden tabindex="-1" role="dialog" aria-label="논거 상세 미리보기" data-argument-detail></section></section><div class="withdraw-control">${activityButton('debate-action','협상 중단',{choice:'withdraw',round:s.round})}</div>`;
    // Compatibility action selectors stay available; execution is explicit after preview.
  }else{
    const quotedRun=structuredClone(run);finishDebate(quotedRun);if(quotedRun.pending.kind==='debateReward')quotedRun.pending=quotedRun.pending.then;
    let terms='진입 군량 1 지급. '+(quotedRun.pending.kind==='parley'?parleyTerms(quotedRun).text:debateOutcomeTerms(s.context,s.result));
    if(n)terms+=` 이미 지불한 군량 ${n.paid}. ${n.promise&&s.result!=='failure'?'수락 시 다음 카드 보상 1회 선택지 −1.':''} ${missingDemands(s)}`;
    let obligation='조건을 확인한 뒤 수락 또는 포기합니다.';
    if(s.context.kind==='agreement'){
      const quote=agreementQuote(quotedRun,s.context.clause);
      obligation=`${CLAUSES[s.context.clause].name}: ${quote.reason??describeAgreement(quote)}`;
    }
    html+=`<section class="debate-result result-${s.result}" aria-label="교섭 결과"><span class="result-stamp">${s.result==='success'?'합의':s.result==='partial'?'설전':'결렬'}</span><div><h2>${resultTitle}</h2><p>마지막 논거: ${s.negotiation?.lastArgument?ARGUMENTS[s.negotiation.lastArgument].name:s.deck?.lastCard?esc(DEBATE_CARDS[s.deck.lastCard].name):s.lastAction?DEBATE_ACTIONS[s.lastAction].name:'중단'} · 결정 조건: ${esc(n?missingDemands(s):`합의 ${s.agreement} · 신뢰 ${s.trust}`)}</p><p>${esc(terms)}</p><p>${esc(obligation)}</p><p>아직 거래 보상은 지급되지 않았습니다.</p><p>원정 빌드: ${s.deck?(s.result==='success'||s.result==='partial'?'결과 확인 후 설전 카드/인장 성장과 거래 조건을 선택합니다.':'결렬·철회에는 카드 보상이 없습니다.') :!s.deck&&s.result==='success'&&n&&run.build.doctrines.length?'성장 선택 가능. 선택하면 거래는 부분 합의로 전환됩니다.':'현재 원정 성장 변화 없음.'}</p>${!s.deck&&s.result==='success'&&n&&run.build.doctrines.length?activityButton('debate-growth','원정 성장 선택: 거래는 부분 합의로 전환'):''}${activityButton('finish-debate','결과 확인 → 조건 선택')}</div></section>`;
  }
  return html+`<aside class="scene-utilities"><details class="debate-record"><summary>교섭 기록</summary><div class="utility-content">${(s.dialogueLog??[]).map(l=>`<p><b>${l.source===s.generalId?GENERALS[s.generalId].name:DEBATE_OPPONENTS[s.opponentId].name}</b> · ${l.round+1}회 “${esc(l.text)}”</p>`).join('')}${s.log.map(l=>`<p>${esc(l)}</p>`).join('')}</div></details><details class="debate-rules"><summary>인물·세부 규칙</summary><div class="utility-content"><div class="debate-profiles"><p>${GENERALS[s.generalId].name} · 설전 적성 ${s.aptitude} · 집중 ${s.resolve}</p><p>${s.traits.map(t=>esc(TRAIT_TEXT[t])).join(' · ')}</p><p>${DEBATE_OPPONENTS[s.opponentId].text}</p></div><p>${n?esc(missingDemands(s)):'합의 10·신뢰 2 성공 / 합의 6·신뢰 1 부분 합의.'}</p><p>${s.deck?'실제 손패, 집중 3 회복·매 라운드 4장. 카드 사용은 회차를 소비하지 않으며 상대는 라운드 종료에 행동합니다.':n?'같은 논거 연속 사용: 각 충족량 −1 (침착 예외). 4회 후 요구·신뢰·부담 모두 판정.':'같은 답 연속 사용: 합의 −2 (침착 예외).'}</p>${n?`<p>${Object.entries(n.scores).map(([k,v])=>AXIS_NAMES[k as keyof typeof AXIS_NAMES]+' '+v).join(' · ')} · 정보 ${n.reports} · 신용 ${n.credentials} · 군량 ${n.food} · 지급 ${n.paid}</p>`:''}</div></details></aside></section>`;
}
