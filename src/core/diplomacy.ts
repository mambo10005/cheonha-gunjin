import { FACTIONS, TRADE_NAMES } from '../data/social.ts';
import type { Check, DebateResult, FactionId, SocialState, TradeId, TradeQuote } from './social-types.ts';

export function defaultSocial(): SocialState {
  return { protocol: 'clauses', accords: { nextUid: 1, agreements: [] }, relations: { caravan: 0, militia: 0, villages: 0 }, used: [], duels: 0, passage: null, support: null };
}
export function tradeQuote(s: SocialState, faction: FactionId, trade: TradeId, result?: DebateResult, envoy = false): TradeQuote {
  const good = result === 'success'; const partial = result === 'partial'; const failed = result === 'failure';
  const q: TradeQuote = { faction, trade, cost: Math.max(1, (trade === 'supply' ? 2 : 3) - (good ? 1 : 0) + (failed ? 1 : 0) - (envoy ? 1 : 0)),
    food: trade === 'supply' ? good ? 7 : partial ? 6 : 5 : 0,
    moves: trade === 'passage' ? good ? 4 : 3 : 0,
    block: trade === 'support' ? good ? 8 : 4 : 0, damage: trade === 'support' ? good ? 8 : 6 : 0,
    rewardPenalty: (trade === 'support' || trade === 'supply') && !good ? 1 : 0, relationDelta: failed ? -1 : 1 };
  if (!Object.hasOwn(FACTIONS, faction) || !Object.hasOwn(TRADE_NAMES, trade)) q.reason = '없는 외교 제안입니다.';
  else if (s.relations[faction] < (trade === 'support' ? 1 : 0)) q.reason = trade === 'support' ? '군사 지원은 우호 관계(1 이상)가 필요합니다.' : '적대 관계에서는 거래할 수 없습니다.';
  else if (trade === 'passage' && s.passage) q.reason = '이미 유효한 통행 협정이 있습니다.';
  else if (trade === 'support' && s.support) q.reason = '이미 대기 중인 군사 지원이 있습니다.';
  return q;
}
export function describeTrade(q: TradeQuote): string {
  const effect = q.trade === 'supply' ? `즉시 군량 +${q.food}, 다음 카드 보상 ${q.rewardPenalty ? '1회 선택지 -1' : '감소 없음'}` : q.trade === 'passage' ? `다음 이동 ${q.moves}회 각각 군량 비용 -1 (최소 0), 이동마다 1회 소모 후 만료` :
    `다음 전투 첫 턴 전열 방비 +${q.block}, 시작 시 적 전원 피해 ${q.damage}, 해당 전투 카드 보상 선택지 -${q.rewardPenalty}; 전투 시작 시 1회 소모`;
  return `즉시 군량 -${q.cost} / ${effect} / 관계 ${q.relationDelta > 0 ? '+' : ''}${q.relationDelta} (범위 -1~2). 거절 시 변화 없음.`;
}
export function applyTrade(s: SocialState, food: number, q: TradeQuote, key: string): Check & { food?: number } {
  if (q.reason) return { ok: false, reason: q.reason };
  if (s.used.includes(key)) return { ok: false, reason: '이 장소에서는 이미 거래했습니다.' };
  if (food < q.cost) return { ok: false, reason: `군량 ${q.cost}가 필요합니다.` };
  s.used.push(key); s.relations[q.faction] = Math.max(-1, Math.min(2, s.relations[q.faction] + q.relationDelta));
  if (q.moves) s.passage = { moves: q.moves, discount: 1 };
  if (q.block) s.support = { block: q.block, damage: q.damage, rewardPenalty: q.rewardPenalty };
  return { ok: true, food: food - q.cost + q.food };
}
