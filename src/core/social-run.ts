import { agreementQuote, accordsOnSupply } from './accords.ts';
import { prepareNegotiation, negotiatedTerms } from './negotiation.ts';
import { negotiationBuildTools } from './build.ts';
import { CARDS } from '../data/cards.ts';
import { offerGrowth } from './build.ts';
import { availableTactics, type TacticId } from '../data/tactics.ts';
import { GENERALS } from '../data/generals.ts';
import { DUEL_ENCOUNTERS, FACTIONS, SOCIAL_EVENTS } from '../data/social.ts';
import { beginBattle, currentNode, offerGeneral, recruitPool } from './run.ts';
import { createDuel, resolveDuelAction } from './duel.ts';
import { createDebate, resolveDebateAction } from './debate.ts';
import { applyTrade, describeTrade, tradeQuote } from './diplomacy.ts';
import { nextFloat, pick } from './rng.ts';
import type { MapNode, RunState } from './types.ts';
import type { Check, DebateContext, DebateResult, TradeId } from './social-types.ts';

function key(run: RunState, kind: string): string { return `${run.floor}:${run.col}:${kind}`; }
function seed(run: RunState): number { return Math.floor(nextFloat(run) * 2 ** 31) + 1; }
function owns(run: RunState, id: string): boolean { return run.generals.some(g => g.id === id); }
function nodeCheck(run: RunState): Check { return run.screen === 'node' && !run.battle ? { ok: true } : { ok: false, reason: '현재 활동 화면이 아닙니다.' }; }

export function offerDuel(run: RunState, node: MapNode): boolean {
  const opponentId = DUEL_ENCOUNTERS[node.encounterId ?? '']; const token = key(run, 'duel');
  if (!opponentId || run.social.duels >= 2 || run.social.used.includes(token)) return false;
  run.social.used.push(token); run.social.duels++; run.pending = { kind: 'duelOffer', opponentId }; run.screen = 'node';
  return true;
}
export function acceptDuel(run: RunState, generalId: string | null, tactics?: string[]): Check {
  if (!nodeCheck(run).ok || run.pending.kind !== 'duelOffer') return { ok: false, reason: '대결 신청이 없습니다.' };
  if (generalId === null) { run.history.push('도전 거절: 불이익 없이 전투로 진입.'); beginBattle(run, currentNode(run)!); return { ok: true }; }
  if (!owns(run, generalId)) return { ok: false, reason: '군단에 있는 출전 장수를 고르세요.' };
  const available = availableTactics(run.build, generalId, run.deck);
  const equipped = tactics ?? available.slice(0, 2);
  if (equipped.length > 2 || new Set(equipped).size !== equipped.length || equipped.some(t => !available.includes(t as TacticId))) return { ok: false, reason: '보유 전술에서 서로 다른 2개까지 장착하세요.' };
  const state = createDuel(seed(run), generalId, run.pending.opponentId, run.build.doctrines.length ? run.build : undefined, equipped as TacticId[]);
  run.pending = { kind: 'duel', state }; return { ok: true };
}
export function actDuel(run: RunState, action: string, round: number): Check {
  if (!nodeCheck(run).ok || run.pending.kind !== 'duel') return { ok: false, reason: '무장 대결 중이 아닙니다.' };
  return resolveDuelAction(run.pending.state, action, round);
}
export function finishDuel(run: RunState, reward: string = 'opening'): Check {
  if (!nodeCheck(run).ok || run.pending.kind !== 'duel' || run.pending.state.result === 'ongoing') return { ok: false, reason: '확인할 대결 결과가 없습니다.' };
  const s = run.pending.state;
  if (!['opening', 'growth', 'recover'].includes(reward) || (s.result !== 'win' || s.rewardClaimed) && reward !== 'opening') return { ok: false, reason: '승리 보상을 선택하세요.' };
  if (s.result === 'win' && reward === 'growth' && run.build.doctrines.length) {
    offerGrowth(run, 'duel:' + run.floor + ':' + run.col, { kind: 'duel', state: { ...structuredClone(s), rewardClaimed: true } });
    run.history.push('대결 승리: 시작 방비 대신 원정 성장 선택. 성장 후 전투 시작(무승부 방비 +2).');
    return { ok: true };
  }
  if (s.result === 'win' && reward === 'recover') { run.hp = Math.min(run.maxHp, run.hp + 8); run.food += 2; s.rewardClaimed = true; }
  run.history.push(`무장 대결 · ${GENERALS[s.generalId].name}: ${s.result === 'win' ? '승리' : s.result === 'draw' ? '무승부' : s.result === 'lose' ? '패배' : '기권'}.`);
  beginBattle(run, currentNode(run)!, { block: s.rewardClaimed ? 2 : s.result === 'win' ? 6 : s.result === 'draw' ? 2 : 0, energyPenalty: s.result === 'lose' || s.result === 'surrender' ? 1 : 0 });
  return { ok: true };
}
export function enterSocialEvent(run: RunState, eventId: string): boolean {
  const event = SOCIAL_EVENTS[eventId]; if (!event) return false;
  run.screen = 'node';
  if (event.faction) run.pending = run.social.protocol === 'clauses' ? { kind: 'council', faction: event.faction } : { kind: 'diplomacy', faction: event.faction };
  else if (event.mode === 'supply') run.pending = { kind: 'parley', mode: 'supply' };
  else {
    const pool = recruitPool(run, run.unlocked).filter(id => GENERALS[id].scholar);
    run.pending = pool.length ? { kind: 'parley', mode: 'recruit', candidate: pick(run, pool) } : { kind: 'socialResult', text: '영입할 책사가 없습니다. 비용 없이 지나갑니다.' };
  }
  return true;
}
export function supplyParley(run: RunState): Check {
  if (!nodeCheck(run).ok || run.pending.kind !== 'supply') return { ok: false, reason: '보급 거점이 아닙니다.' };
  run.pending = { kind: 'parley', mode: 'supply' }; return { ok: true };
}
export function villageDiplomacy(run: RunState): Check {
  if (!nodeCheck(run).ok || run.pending.kind !== 'parley' || run.pending.mode !== 'supply' || run.pending.negotiated) return { ok: false, reason: '협상 전 보급 제안에서만 향촌 외교를 선택할 수 있습니다.' };
  run.pending = run.social.protocol === 'clauses' ? { kind: 'council', faction: 'villages' } : { kind: 'diplomacy', faction: 'villages' }; return { ok: true };
}
export function parleyTerms(run: RunState): { cost: number; food: number; text: string } {
  const p = run.pending;
  if (p.kind !== 'parley') return { cost: 0, food: 0, text: '' };
  const grade = p.negotiated;
  if (p.mode === 'recruit') {
    const cost = grade === 'success' ? 2 : grade === 'partial' ? p.terms ? 3 : 4 : 5;
    return { cost, food: 0, text: `군량 ${cost} 소비 → ${GENERALS[p.candidate].name} 영입. 진형이 가득 차면 교체 선택.${p.terms && grade === 'partial' ? ' 부분 합의: 임시 활동 권한의 대가로 다음 카드 보상 1회 선택지 -1.' : ''}${p.terms?.penalty && grade !== 'partial' ? ' 권한 약속: 다음 카드 보상 1회 선택지 -1.' : ''} 포기 시 추가 변화 없음.` };
  }
  const food = grade === 'success' ? 9 : grade === 'partial' ? p.terms ? 5 : 7 : grade === 'failure' ? 4 : 6;
  return { cost: 0, food, text: `추가 비용 없이 군량 +${food}. ${p.terms && grade === 'partial' ? '부분 합의의 대안: 군량 +5와 병력 +6.' : ''}${p.terms?.penalty ? '권한 약속 수락: 다음 카드 보상 1회 선택지 -1.' : ''} 설전 도전 비용은 군량 1이며 환급되지 않습니다. 기본 조건은 군량 +6. 포기 시 변화 없음.` };
}
export function acceptParley(run: RunState, accept: boolean): Check {
  if (typeof accept !== 'boolean') return { ok: false, reason: '수락 또는 포기를 선택하세요.' };
  if (!nodeCheck(run).ok || run.pending.kind !== 'parley') return { ok: false, reason: '협상 제안이 없습니다.' };
  const p = run.pending; const terms = parleyTerms(run);
  if (accept && run.food < terms.cost) return { ok: false, reason: `군량 ${terms.cost}가 필요합니다.` };
  const text = accept ? terms.text : '제안을 포기했다. 추가 변화 없음.';
  if (accept) {
    run.food -= terms.cost;
    if (p.mode === 'recruit') {
      if (!recruitPool(run, run.unlocked).includes(p.candidate)) { run.food += terms.cost; return { ok: false, reason: '이미 영입했거나 영입할 수 없는 장수입니다.' }; }
      if (p.terms) run.flags.rewardPenalty += Math.max(p.terms.penalty, p.negotiated === 'partial' ? 1 : 0);
      offerGeneral(run, p.candidate, { kind: 'socialResult', text });
    } else { run.food += terms.food; accordsOnSupply(run); if (p.terms) { run.flags.rewardPenalty += p.terms.penalty; if (p.negotiated === 'partial') run.hp = Math.min(run.maxHp, run.hp + 6); } run.pending = { kind: 'socialResult', text }; }
  } else run.pending = { kind: 'socialResult', text };
  run.history.push(text); return { ok: true };
}
export function beginDebate(run: RunState, generalId: string, trade?: string): Check {
  if (!nodeCheck(run).ok || !owns(run, generalId)) return { ok: false, reason: '군단의 대표 장수를 고르세요.' };
  const p = run.pending; const token = key(run, 'debate');
  if (run.social.used.includes(token)) return { ok: false, reason: '이 장소에서는 이미 설전에 도전했습니다.' };
  if (run.food < 1) return { ok: false, reason: '설전 도전에는 군량 1이 필요합니다. 기본 조건이나 포기를 선택하세요.' };
  let context: DebateContext; let opponentId: string;
  if (p.kind === 'parley') {
    if (p.negotiated) return { ok: false, reason: '이미 협상한 제안입니다.' };
    context = p.mode === 'recruit' ? { kind: 'recruit', candidate: p.candidate } : { kind: 'supply' };
    opponentId = p.mode === 'recruit' ? 'scholar' : 'elder';
  } else if (p.kind === 'council') {
    if (p.negotiated) return { ok: false, reason: '이미 협상했습니다.' };
    const q = agreementQuote(run, trade ?? ''); if (q.reason) return { ok: false, reason: q.reason };
    context = { kind: 'agreement', faction: p.faction, clause: q.clause }; opponentId = FACTIONS[p.faction].opponent;
  } else if (p.kind === 'diplomacy') {
    if (p.negotiated || !Object.hasOwn({ supply: 1, passage: 1, support: 1 }, trade ?? '')) return { ok: false, reason: '협상할 거래를 고르세요.' };
    const quote = tradeQuote(run.social, p.faction, trade as TradeId);
    if (quote.reason) return { ok: false, reason: quote.reason };
    context = { kind: 'diplomacy', faction: p.faction, trade: trade as TradeId }; opponentId = FACTIONS[p.faction].opponent;
  } else return { ok: false, reason: '설전으로 바꿀 수 있는 제안이 아닙니다.' };
  run.food--; run.social.used.push(token);
  const state = createDebate(seed(run), generalId, opponentId, context);
  if (run.social.protocol === 'clauses') {
    const tools = negotiationBuildTools(run.build, generalId);
    const report = run.deck.some(c => CARDS[c.id].tags.includes('scheme')) ? 1 : 0;
    const credentials = Object.values(run.social.relations).filter(n => n > 0).length + run.social.accords.agreements.filter(a => a.status === 'active').length;
    prepareNegotiation(state, run.food, tools.reports + report + (state.traits.includes('insight') ? 1 : 0), credentials, tools.focus);
  }
  run.pending = { kind: 'debate', state };
  return { ok: true };
}
export function actDebate(run: RunState, action: string, round: number): Check {
  if (!nodeCheck(run).ok || run.pending.kind !== 'debate') return { ok: false, reason: '설전 중이 아닙니다.' };
  const result = resolveDebateAction(run.pending.state, action, round);
  if (result.ok && run.pending.state.negotiation) run.food = run.pending.state.negotiation.food;
  return result;
}
export function finishDebate(run: RunState, reward: string = 'terms'): Check {
  if (!nodeCheck(run).ok || run.pending.kind !== 'debate' || run.pending.state.result === 'ongoing') return { ok: false, reason: '확인할 설전 결과가 없습니다.' };
  const s = run.pending.state; const c = s.context;
  if (!['terms', 'growth'].includes(reward) || reward === 'growth' && (!s.negotiation || s.result !== 'success' || !run.build.doctrines.length)) return { ok: false, reason: '선택할 설전 보상이 없습니다.' };
  const terms = s.negotiation ? negotiatedTerms(s) : undefined;
  const grade = reward === 'growth' ? 'partial' as const : s.result;
  run.history.push(`설전 · ${GENERALS[s.generalId].name}: ${s.result === 'success' ? '성공' : s.result === 'partial' ? '부분 성공' : '실패'}. 조건을 확인하고 수락·포기하세요.`);
  if (c.kind === 'agreement') run.pending = { kind: 'council', faction: c.faction, negotiated: { clause: c.clause, result: grade, terms: terms! } };
  else if (c.kind === 'diplomacy') run.pending = { kind: 'diplomacy', faction: c.faction, negotiated: { trade: c.trade, result: s.result } };
  else run.pending = c.kind === 'recruit' ? { kind: 'parley', mode: 'recruit', candidate: c.candidate, negotiated: grade, ...(terms ? { terms } : {}) } : { kind: 'parley', mode: 'supply', negotiated: grade, ...(terms ? { terms } : {}) };
  if (reward === 'growth') { offerGrowth(run, `debate:${run.floor}:${run.col}`, run.pending); run.history.push(' 설전 성장 보상을 선택: 거래는 부분 합의 조건으로 전환.'); }
  return { ok: true };
}
export function quoteForRun(run: RunState, trade: TradeId) {
  const p = run.pending;
  if (p.kind !== 'diplomacy') return null;
  const envoy = run.generals.some(g => GENERALS[g.id].activities?.traits.includes('envoy'));
  const q = tradeQuote(run.social, p.faction, trade, p.negotiated?.result, envoy);
  if (p.negotiated && p.negotiated.trade !== trade) q.reason = '설전에서 합의한 거래만 선택할 수 있습니다.';
  return q;
}
export function acceptDiplomacy(run: RunState, trade: string | null): Check {
  if (!nodeCheck(run).ok || run.pending.kind !== 'diplomacy') return { ok: false, reason: '외교 제안이 없습니다.' };
  if (trade === null) { run.pending = { kind: 'socialResult', text: '거래를 거절했다. 추가 비용·보상·관계 변화 없음.' }; return { ok: true }; }
  if (!['supply', 'passage', 'support'].includes(trade)) return { ok: false, reason: '없는 외교 거래입니다.' };
  const q = quoteForRun(run, trade as TradeId)!;
  const result = applyTrade(run.social, run.food, q, key(run, 'trade')); if (!result.ok) return result;
  run.food = result.food!;
  if (q.trade === 'supply') run.flags.rewardPenalty += q.rewardPenalty;
  const text = describeTrade(q); run.history.push(text);
  run.pending = { kind: 'socialResult', text }; return { ok: true };
}
export function debateOutcomeTerms(context: DebateContext, result: DebateResult): string {
  if (context.kind === 'agreement') return result === 'success' ? '협정 지원 강화. 조건 확인 후 체결하며 의무 이행으로 관계를 얻습니다.' : result === 'partial' ? '추가 예치금 2 필요. 이행하면 반환, 파기하면 몰수. 기본 조건 재제안도 가능.' : '기본 조건 재제안 또는 거절. 원정은 계속 가능합니다.';
  if (context.kind === 'recruit') return `영입 비용 ${result === 'success' ? 2 : result === 'partial' ? 4 : 5}. 수락 시에만 지불합니다.`;
  if (context.kind === 'supply') return `수락 시 군량 +${result === 'success' ? 9 : result === 'partial' ? 7 : 4}.`;
  return result === 'success' ? '거래 비용 -1, 보급·협정·지원 개선, 보급·지원의 카드 보상 감소 없음. 조건 확인 후 수락합니다.' : result === 'partial' ? '보급 요청 보상 +1. 나머지는 기본 조건.' : '거래 비용 +1, 수락 시 관계 -1. 추가 비용 없이 거절할 수 있습니다.';
}

/** 실제 원정과 같은 입구를 쓰는 개발용 시나리오. 군주 선택 화면에서만 사용한다. */
export function configureSocialDemo(run: RunState): void {
  run.social.protocol = 'legacy';
  run.food = 20; run.generals = [{ id: 'dianwei', row: 'front' }, { id: 'guojia', row: 'rear' }, { id: 'zhangliao', row: 'front' }];
  for (let f = 0; f < run.map.length - 1; f++) for (const n of run.map[f]) {
    n.next = [0, 1, 2];
    if (f === 0) { n.encounterId = 'el_huaxiong'; n.type = 'elite'; n.terrain = 'plains'; }
    if (f === 1) { n.type = 'event'; n.eventId = 'parley'; }
    if (f === 2) { n.type = 'event'; n.eventId = 'envoy'; }
    if (f === 3) { n.type = 'event'; n.eventId = 'envoy'; }
    if (f === 4) { n.type = 'supply'; n.terrain = 'mountain'; }
  }
  for (const n of run.map[6]) n.next = [0];
  run.history.push('검증 원정: 군량 20·대표 3명, 1층 대결 / 2층 영입 설전 / 3~4층 외교 / 5층 보급.');
}
