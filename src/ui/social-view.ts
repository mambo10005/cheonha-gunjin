import {deckRewardHtml,deckPreparationHtml} from './debate-deck-view.ts';
import {chooseDeckReward,offerDeckReward,ensureRepresentative} from '../core/debate-deck.ts';
import { debateScene } from './debate-scene.ts';
import { CLAUSES, activeAgreements, agreementQuote, describeAgreement, signAgreement, abandonAgreement, resetCouncil, declineCouncil } from '../core/accords.ts';
import { DOCTRINES, GROWTH, chooseGrowth } from '../core/build.ts';
import { availableTactics, TACTICS, type TacticId } from '../data/tactics.ts';
import { GENERALS } from '../data/generals.ts';
import { DUEL_ACTIONS, DUEL_OPPONENTS, FACTIONS, TRADE_NAMES, TRAIT_TEXT } from '../data/social.ts';
import { duelIntent, duelResultText, previewDuelAction } from '../core/duel.ts';
import { describeTrade } from '../core/diplomacy.ts';
import { acceptDiplomacy, acceptDuel, acceptParley, actDebate, actDuel, beginDebate, finishDebate, finishDuel, parleyTerms, quoteForRun, supplyParley, villageDiplomacy } from '../core/social-run.ts';
import type { Check, DuelAction, TradeId } from '../core/social-types.ts';
import type { RunState } from '../core/types.ts';
import { activityButton as button, esc } from './html.ts';

const resultName = { ongoing: '진행 중', win: '승리', lose: '패배', draw: '무승부', surrender: '기권', success: '성공', partial: '부분 성공', failure: '실패' };
function representatives(run: RunState): string {
  return deckPreparationHtml(run)+`<label>출전 장수·대표 선택 <select id="social-general">${run.generals.map(g => {
    const p = GENERALS[g.id].activities!;
    return `<option value="${g.id}">${esc(GENERALS[g.id].name)} — 대결 ${p.duel}, 설전 ${p.debate}</option>`;
  }).join('')}</select></label><div class="representatives">${run.generals.map(g => `<div class="tiny"><b>${esc(GENERALS[g.id].name)}</b>: ${GENERALS[g.id].activities!.traits.map(t => esc(TRAIT_TEXT[t])).join(' · ')}</div>`).join('')}</div>`;
}
function logs(lines: string[]): string { return `<div class="panel activity-log">${lines.map(l => `<div>${esc(l)}</div>`).join('')}</div>`; }
export function relationsHtml(run: RunState): string {
  const s = run.social;
  return `${buildStatus(run)}${accordStatus(run)}<div class="panel small social-status">${Object.entries(s.relations).map(([id, n]) => `${FACTIONS[id as keyof typeof FACTIONS].name}: ${n < 0 ? '적대' : n === 0 ? '중립' : '우호'}(${n})`).join(' · ')}
    ${s.passage ? `<div>통행 협정: 다음 이동 ${s.passage.moves}회 군량 비용 -1.</div>` : ''}${s.support ? `<div>군사 지원: 다음 전투 1회, 전열 방비 +${s.support.block}·적 전원 피해 ${s.support.damage}·카드 보상 선택지 -${s.support.rewardPenalty}.</div>` : ''}${run.flags.rewardPenalty ? `<div>보급·동맹의 대가: 다음 카드 보상 ${run.flags.rewardPenalty}회 선택지 -1.</div>` : ''}</div>`;
}
export function socialView(run: RunState): string | null {
  const p = run.pending; let body = '';
  if(p.kind==='debateReward')return '<div class="node-screen">'+deckRewardHtml(run)+'</div>';
  switch (p.kind) {
    case 'growth':
      body = (p.general ? '<p>공동 작전 성장 대상: ' + GENERALS[p.general].name + '</p>' : '') + '<h1>원정 성장 선택</h1><p>교리 최대 2개. 장수당 한 분기, 최대 2단계. 일반 전투에서는 장수 배치 조건과 동요를 따릅니다. 성장은 이번 원정에 유지하며 장수를 내보내면 잃습니다. 일반 전투와 무장 대결 모두 적용합니다.</p>' + representatives(run);
      body += '<div class="activity-grid">' + Object.entries(GROWTH).map(([id, d]) => '<div class="panel"><h3>' + d.name + '</h3><p>' + d.text + '</p><p class="tiny">연결: ' + DOCTRINES[d.direction].name + '. 교리 없이도 준비와 소비 가능. 기존 분기 전환 불가.</p>' + button('growth', '선택 장수 성장 / 강화', { choice: id }) + '</div>').join('') + '</div>';
      body += '<div class="activity-grid">' + Object.entries(DOCTRINES).filter(([id]) => !run.build.doctrines.includes(id as keyof typeof DOCTRINES)).map(([id, d]) => '<div class="panel"><h3>' + d.name + '</h3><p>' + d.text + '</p>' + button('growth', '교리 추가', { choice: 'doctrine:' + id, reason: p.general ? '공동 작전은 지정 장수 성장 또는 회복만 선택합니다.' : run.build.doctrines.length >= 2 ? '교리 슬롯 2개가 찼습니다.' : undefined }) + '</div>').join('') + '</div>' + button('growth', '성장 대신 병력 +8 · 군량 +2', { choice: 'recover' }); break;
    case 'duelOffer':
      body = `<h1>무장 대결 — 대결 신청</h1><p>상대 장수: ${esc(DUEL_OPPONENTS[p.opponentId].name)}</p><p>${esc(DUEL_OPPONENTS[p.opponentId].tendency)}</p>
      <p class="small">최대 4회. 승리: 시작 방비 +6 또는 원정 성장 또는 병력 +8·군량 +2 / 무승부: +2 / 패배·기권: 첫 턴 지휘력 -1. 원정 병력과 별도 체력, 영구 사망 없음. 거절은 불이익 없음.</p>
      ${representatives(run)}${tacticsView(run)}<div class="row">${button('accept-duel', '도전 수락')}${button('decline-duel', '도전 거절')}</div>`; break;
    case 'duel': {
      const s = p.state;
      body = `<h1>무장 대결 · ${resultName[s.result]}</h1><p>${esc(GENERALS[s.generalId].name)} 체력 ${s.hp}/${s.maxHp} · 기세 ${s.momentum} / 상대 ${esc(DUEL_OPPONENTS[s.opponentId].name)} 체력 ${s.enemyHp}/${s.enemyMaxHp}</p>
      <p>선택 ${s.round}/4. 최대 회차: 남은 체력 비율이 높은 쪽 승리, 체력 2에 해당하는 차이 이내 무승부. 같은 행동 연속 사용 시 피해 -2·방어 감소 6→3 (침착 예외).</p>`;
      if (s.build) body += `<p class="chip">준비: 반격 ${s.build.tokens.riposte} / 돌파 ${s.build.tokens.charge} / 정보 ${s.build.tokens.insight} · 보호 ${s.protection ?? 0} · 적 방비 ${s.enemyShield ?? 0}</p>`;
      if (s.result === 'ongoing') {
        body += `<p class="chip">상대 다음 행동: ${DUEL_ACTIONS[duelIntent(s)].name}</p><div class="activity-grid">${([...Object.keys(DUEL_ACTIONS), ...(s.tactics ?? [])] as (DuelAction | TacticId)[]).map(a => {
          const pv = previewDuelAction(s, a); const d = Object.hasOwn(DUEL_ACTIONS, a) ? DUEL_ACTIONS[a as DuelAction] : TACTICS[a as TacticId];
          return `<div class="panel"><h3>${d.name}</h3><p class="small">${d.text}</p><p class="tiny">예상: 내 체력 ${s.hp}→${pv.state.hp}, 상대 ${s.enemyHp}→${pv.state.enemyHp}, 기세 ${s.momentum}→${pv.state.momentum}${pv.state.result !== 'ongoing' ? ` · ${resultName[pv.state.result]}` : ''}</p>${button('duel-action', d.name, { choice: a, round: s.round, reason: pv.check.reason })}</div>`;
        }).join('')}</div>${button('duel-action', '기권', { choice: 'surrender', round: s.round })}`;
      } else body += `<p>${s.rewardClaimed ? '성장·회복 선택 완료: 이번 전투 시작 방비 +2.' : esc(duelResultText(s))}</p>${s.result === 'win' && !s.rewardClaimed && run.build.doctrines.length ? button('duel-reward', '시작 방비 +6 대신 원정 성장', { choice: 'growth' }) + button('duel-reward', '시작 방비 +6 대신 병력 +8·군량 +2', { choice: 'recover' }) : ''}${button('finish-duel', '결과 확인 → 전투 시작')}`;
      body += logs(s.log); break;
    }
    case 'parley': {
      const terms = parleyTerms(run);
      body = `<h1>${p.mode === 'recruit' ? '재야 인재 영입' : '보급 협상'}</h1>${p.mode === 'recruit' ? `<p>영입 후보: ${esc(GENERALS[p.candidate].name)} — ${esc(GENERALS[p.candidate].ability)}</p>` : ''}
      <p>${esc(terms.text)}</p>${p.negotiated ? `<p>설전 결과: ${resultName[p.negotiated]}</p>` : `${representatives(run)}<p class="small">설전 도전 군량 1. 성공·부분 성공·실패 후 조건을 확인하고 수락 또는 포기. 실패해도 진행 가능합니다.</p>${p.mode==='recruit'&&run.debateBuild.enabled?button('begin-debate-elite','정예 공개 변론 · 반복 약화·매 반론 방해'):''}${button('begin-debate', '설전으로 조건 개선', { reason: run.food < 1 ? '군량 1 필요' : undefined })}`}
      <div class="row">${button('accept-parley', p.negotiated ? '합의 조건 수락' : '기본 조건 수락', { reason: run.food < terms.cost ? `군량 ${terms.cost} 필요` : undefined })}${button('decline-parley', '포기하고 진행')}${p.mode === 'supply' && !p.negotiated ? button('village-diplomacy', '보급 대신 향촌과 외교') : ''}</div>`; break;
    }
    case 'debate': return debateScene(run);
    case 'council': {
      body = '<h1>지속 협정 — ' + FACTIONS[p.faction].name + '</h1><p>활성 협정 최대 2개. 관계는 의무 이행 시 상승합니다. 경로 이탈·미이행·포기는 관계 -1·군량 -2, 예치금 몰수입니다.</p>' + representatives(run);
      if (p.negotiated) body += '<p>설전: ' + resultName[p.negotiated.result] + ' · ' + esc(p.negotiated.terms.description) + '</p>';
      body += Object.entries(CLAUSES).filter(([, d]) => d.faction === p.faction).map(([id,d]) => {
        const q = agreementQuote(run,id);
        return '<div class="panel"><h3>' + d.name + '</h3><p>' + esc(describeAgreement(q)) + '</p>' + button('sign-agreement','협정 체결',{choice:id, reason:q.reason ?? (run.food < q.cost ? '군량 ' + q.cost + ' 필요' : undefined)}) + (!p.negotiated ? button('begin-debate','설전으로 조건 개선',{choice:id,reason:q.reason ?? (run.food < 1 ? '군량 1 필요' : run.social.used.includes(run.floor + ':' + run.col + ':debate') ? '이 장소 설전은 이미 사용했습니다.' : undefined)}) : '') + '</div>';
      }).join('') + (p.negotiated ? button('reset-council','기본 조건으로 재제안') : '') + button('decline-council','이번 제안 거절'); break;
    }
    case 'diplomacy': {
      body = `<h1>외교 — ${FACTIONS[p.faction].name}</h1><p>군량 ${run.food}. 기본 조건 거래 또는 군량 1을 지불하고 설전으로 조건 개선. 장소당 거래 1회·설전 1회.</p>${p.negotiated ? `<p>설전 결과: ${resultName[p.negotiated.result]} · ${TRADE_NAMES[p.negotiated.trade]}</p>` : representatives(run)}
      <div class="activity-grid">${(Object.keys(TRADE_NAMES) as TradeId[]).map(t => {
        const q = quoteForRun(run, t)!;
        return `<div class="panel"><h3>${TRADE_NAMES[t]}</h3><p class="small">${esc(describeTrade(q))}</p>${button('trade', '조건 수락', { choice: t, reason: q.reason ?? (run.food < q.cost ? `군량 ${q.cost} 필요` : undefined) })}
        ${!p.negotiated ? button('begin-debate', '설전으로 협상', { choice: t, reason: q.reason ?? (run.food < 1 ? '군량 1 필요' : undefined) }) : ''}</div>`;
      }).join('')}</div>${button('decline-trade', '거래 거절')}`; break;
    }
    case 'socialResult': body = `<h1>활동 결과</h1><p>${esc(p.text)}</p><button class="btn primary" data-a="leave">지도로</button>`; break;
    default: return null;
  }
  return `<div class="node-screen social-screen">${relationsHtml(run)}${body}</div>`;
}
export function handleSocialAction(run: RunState, kind: string, general: string, choice: string, round: number, tactics?: string[]): Check {
  switch (kind) {
    case 'deck-workshop':{if(!['rest','supply'].includes(run.pending.kind)||!run.debateBuild.enabled||run.food<2||run.debateBuild.claimed.includes(`deck:${run.floor}:${run.col}`))return {ok:false,reason:'휴식/보급 장소당 1회, 군량 2가 필요합니다.'};if(!run.generals.some(g=>g.id===general))return {ok:false,reason:'군단 대표를 선택하세요.'};ensureRepresentative(run.debateBuild,general);const then=run.pending;run.food-=2;offerDeckReward(run,then,'success');return {ok:true};}
    case 'begin-debate-elite':return beginDebate(run,general,choice||undefined,true);
    case 'deck-reward':return chooseDeckReward(run,choice);
    case 'deck-assistant':{if(!['','caoren','dianwei'].includes(choice)||choice&&!run.generals.some(g=>g.id===choice))return {ok:false,reason:'군단의 조인/전위 중 보좌를 선택하세요.'};run.debateBuild.assistant=choice||null;return {ok:true};}
    case 'growth': return chooseGrowth(run, choice, run.pending.kind === 'growth' ? run.pending.general ?? general : general);
    case 'sign-agreement': return signAgreement(run, choice, general);
    case 'abandon-agreement': return abandonAgreement(run, Number(choice));
    case 'reset-council': return resetCouncil(run);
    case 'decline-council': return declineCouncil(run);
    case 'debate-growth': return finishDebate(run, 'growth');
    case 'duel-reward': return finishDuel(run, choice);
    case 'accept-duel': return acceptDuel(run, general, tactics);
    case 'decline-duel': return acceptDuel(run, null);
    case 'duel-action': return actDuel(run, choice, round);
    case 'finish-duel': return finishDuel(run);
    case 'begin-debate': return beginDebate(run, general, choice || undefined);
    case 'debate-action': return actDebate(run, choice, round);
    case 'finish-debate': return finishDebate(run);
    case 'accept-parley': return acceptParley(run, true);
    case 'decline-parley': return acceptParley(run, false);
    case 'trade': return acceptDiplomacy(run, choice);
    case 'decline-trade': return acceptDiplomacy(run, null);
    case 'supply-parley': return supplyParley(run);
    case 'village-diplomacy': return villageDiplomacy(run);
    default: return { ok: false, reason: '없는 활동 입력입니다.' };
  }
}

export function buildStatus(run: RunState): string {
  return `<div class="panel small build-status"><b>원정 교리 ${run.build.doctrines.length}/2</b>: ${run.build.doctrines.map(d => DOCTRINES[d].name).join(' + ') || '미선택'}${run.generals.map(g => { const v = run.build.growth[g.id]; return v ? `<div>${GENERALS[g.id].name} · ${GROWTH[v.branch].name} ${v.level}단계: ${GROWTH[v.branch].text}${GROWTH[v.branch].negotiation ? ' · 설전 준비: 정보 +' + (GROWTH[v.branch].negotiation?.reports ?? 0) * v.level + ' / 집중 +' + (GROWTH[v.branch].negotiation?.focus ?? 0) * v.level : ''}</div>` : ''; }).join('')}</div>`;
}
export function doctrineView(): string {
  return '<div class="node-screen"><h1>원정 교리를 선택하십시오</h1><p>한 방향으로 시작합니다. 1·3·5층 완료 후 성장·혼합 교리·회복 선택. 희귀 전법이나 대결 없이도 성장 가능합니다.</p><div class="activity-grid">' + Object.entries(DOCTRINES).map(([id,d]) => '<div class="panel"><h3>' + d.name + '</h3><p>' + d.text + '</p><button class="btn" data-a="doctrine" data-id="' + id + '">이 방향으로 출발</button></div>').join('') + '</div></div>';
}
function tacticsView(run: RunState): string {
  if (!run.build.doctrines.length) return '';
  const available = [...new Set(run.generals.flatMap(g => availableTactics(run.build, g.id, run.deck)))];
  const options = '<option value="">장착 안 함</option>' + available.map(t => '<option value="' + t + '">' + TACTICS[t].name + '</option>').join('');
  return '<div class="panel"><h3>출전 전술 · 최대 2개</h3><select id="tactic-one">' + options + '</select><select id="tactic-two">' + options + '</select><p class="tiny">출전 장수 성장·교리·보유 전법이 전술을 엽니다. 각 전술 대결당 1회.</p>' + available.map(t => '<p class="small">' + TACTICS[t].name + ': ' + TACTICS[t].text + '</p>').join('') + '<p class="small">상대 규칙: 관문 수비는 방비 축적(견제로 제거), 맹장은 방어 후 승부수 +3·그 외 -3, 유격장은 견제 다음 공격 외 반격 2. 지형은 대결에 적용하지 않습니다.</p></div>';
}

export function accordStatus(run: RunState): string {
  const list = activeAgreements(run);
  return '<div class="panel small"><b>활성 협정 ' + list.length + '/2</b>' + list.map(a => '<p>' + CLAUSES[a.clause].name + ' · ' + (a.supply && a.stage === 'waiting' ? (a.supply.floor+1) + '층 ' + (a.supply.col+1) + '번 군량 보급 → ' : '') + (a.target.floor+1) + '층 ' + (a.target.col+1) + '번 전투 승리까지 · ' + (a.stage === 'armed' ? '보호 지원 준비' : '의무 대기') + (a.beneficiary ? ' · 성장 대상 ' + GENERALS[a.beneficiary].name : '') + (a.deposit ? ' · 반환 예치금 2' : '') + ((run.screen === 'map' || run.screen === 'node') ? button('abandon-agreement','협정 포기: 관계 -1·군량 -2',{choice:String(a.uid),reason:run.pending.kind === 'debate' || run.pending.kind === 'growth' ? '현재 활동 선택을 먼저 마치세요.' : undefined}) : '') + '</p>').join('') + '</div>';
}
