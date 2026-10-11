import {canDeckAction,resolveDeckAction} from './debate-deck.ts';
import { canArgument, resolveArgument } from './negotiation.ts';
import { debateReceipt, finalizeDebateEvents } from './debate-events.ts';
import { GENERALS } from '../data/generals.ts';
import { CONCERN_NAME, DEBATE_ACTIONS, DEBATE_OPPONENTS } from '../data/social.ts';
import { randInt } from './rng.ts';
import type { Check, DebateAction, DebateContext, DebateState } from './social-types.ts';

export function createDebate(rng: number, generalId: string, opponentId: string, context: DebateContext): DebateState {
  const p = GENERALS[generalId]?.activities; const o = DEBATE_OPPONENTS[opponentId];
  if (!p || !o) throw new Error('설전 참가자가 올바르지 않습니다.');
  const s: DebateState = { rng, generalId, opponentId, round: 0, maxRounds: 4, resolve: 4 + p.debate,
    agreement: 0, trust: 1, aptitude: p.debate, traits: [...p.traits], concerns: [...o.concerns],
    revealed: [], lastAction: null, result: 'ongoing', context: structuredClone(context), log: [] };
  const offset = randInt(s, 4); s.concerns = [...s.concerns.slice(offset), ...s.concerns.slice(0, offset)];
  reveal(s); return s;
}
function reveal(s: DebateState): void {
  s.revealed = s.concerns.slice(0, Math.min(s.maxRounds, s.round + (s.traits.includes('insight') ? 2 : 1)));
}
export function canDebateAction(s: DebateState, action: string, round: number): Check {
  if(s.deck)return canDeckAction(s,action,round);
  if (s.negotiation) return canArgument(s, action, round);
  if (s.result !== 'ongoing' || s.round !== round) return { ok: false, reason: '이미 처리한 행동이거나 종료된 설전입니다.' };
  if (action === 'withdraw') return { ok: true };
  if (!Object.hasOwn(DEBATE_ACTIONS, action)) return { ok: false, reason: '없는 설전 행동입니다.' };
  if (s.resolve < DEBATE_ACTIONS[action as DebateAction].cost) return { ok: false, reason: '집중이 부족합니다. 양보로 집중을 회복할 수 있습니다.' };
  return { ok: true };
}
export function resolveDebateAction(s: DebateState, action: string, round: number): Check {
  if(s.deck)return resolveDeckAction(s,action,round);
  if (s.negotiation) return resolveArgument(s, action, round);
  const c = canDebateAction(s, action, round); if (!c.ok) return c;
  const {events, emit} = debateReceipt(s, action);
  if (action === 'withdraw') { s.result = 'failure'; s.log.push('협상을 중단했습니다. 기본 조건이나 포기를 선택할 수 있습니다.'); emit('debateResolved',s.opponentId,0,'failure','협상 중단',3); return {ok:true,events:finalizeDebateEvents(events,s)}; }
  const a = action as DebateAction; const rule = DEBATE_ACTIONS[a]; const concern = s.concerns[s.round];
  const fits = rule.fits.includes(concern);
  let gain = fits ? a === 'rebuttal' ? 5 : a === 'proposal' ? 4 : a === 'evidence' ? 3 : 2 : a === 'concede' ? 0 : 1;
  if (s.traits.includes('quartermaster') && (concern === 'profit' || concern === 'safety')) gain++;
  if (s.lastAction === a && !s.traits.includes('composure')) gain = Math.max(0, gain - 2);
  s.resolve -= rule.cost;
  emit('costSpent',s.generalId,-rule.cost,'focus','집중 비용');
  emit('speechStarted',s.opponentId,0,a,rule.name);
  emit('argumentApplied','agreement',gain,'agreement',fits ? '현재 논점에 답함' : '핵심 요구와 다름');
  if (s.traits.includes('quartermaster') && (concern === 'profit' || concern === 'safety') && gain>0) emit('traitTriggered','agreement',0,'agreement','보급 운영 (합의 변화에 포함)',2);
  if (a === 'concede') {s.resolve += 2; emit('argumentApplied',s.generalId,2,'focus','양보 집중 회복');}
  const priorTrust = s.trust;
  s.trust = Math.max(0, s.trust + (a === 'rebuttal' ? -1 : 1) + (a === 'concede' && s.traits.includes('mediator') ? 1 : 0));
  s.agreement += gain; s.round++; s.lastAction = a;
  emit('trustChanged','trust',s.trust-priorTrust,'trust',rule.name);
  s.log.push(`${CONCERN_NAME[concern]}: ${fits ? '요구에 맞는 답입니다.' : '핵심 요구에 답하지 못했습니다.'} 합의 +${gain}, 신뢰 ${s.trust}.`);
  if (s.round >= s.maxRounds) s.result = s.agreement >= 10 && s.trust >= 2 ? 'success' : s.agreement >= 6 && s.trust >= 1 ? 'partial' : 'failure';
  reveal(s);
  if (s.result !== 'ongoing') emit('debateResolved',s.opponentId,0,s.result,'합의와 신뢰 최종 판정',3);
  else emit('followupUnlocked',s.concerns[s.round],0,'concern',CONCERN_NAME[s.concerns[s.round]],2,s.opponentId);
  return { ok: true, events:finalizeDebateEvents(events,s) };
}
export function previewDebateAction(s: DebateState, action: string): { check: Check; state: DebateState } {
  const state = structuredClone(s); return { check: resolveDebateAction(state, action, s.deck?.revision ?? s.round), state };
}
