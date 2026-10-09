import { ARGUMENTS, AXIS_NAMES, DEMANDS } from '../data/arguments.ts';
import { debateReceipt, finalizeDebateEvents } from './debate-events.ts';
import { randInt } from './rng.ts';
import type { Argument, NegotiatedTerms } from './accord-types.ts';
import type { DebateState, Check } from './social-types.ts';

export function prepareNegotiation(s: DebateState, food: number, reports: number, credentials: number, focus = 0): void {
  const d = DEMANDS[s.opponentId as keyof typeof DEMANDS];
  s.negotiation = { scores: { profit: 0, safety: 0, honor: 0, authority: 0 }, needs: { ...d.needs }, trustNeeded: d.trust, burdenLimit: d.burden, burden: 0, food, paid: 0,
    reports: Math.min(2, reports), credentials: Math.min(2, credentials), concessionReady: false, promise: false,
    counter: { axis: d.counters[randInt(s, d.counters.length)], amount: 1, applied: false }, lastArgument: null };
  s.resolve += focus;
  s.log.push(`원정 준비: 정보 ${s.negotiation.reports}/2 · 신용 ${s.negotiation.credentials}/2 · 교리/성장 집중 +${focus}. 정보·신용 상한 2.`, d.text, `2회 답변 뒤 반론: ${AXIS_NAMES[s.negotiation.counter.axis]} 요구 +1. 처음부터 예고하며 확률 판정은 없습니다.`);
}
export function canArgument(s: DebateState, action: string, round: number): Check {
  const n = s.negotiation;
  if (!n || s.result !== 'ongoing' || s.round !== round) return { ok: false, reason: '이미 처리했거나 종료된 설전입니다.' };
  if (action === 'withdraw') return { ok: true };
  if (!Object.hasOwn(ARGUMENTS, action)) return { ok: false, reason: '없는 논거입니다.' };
  const a = action as Argument;
  if (s.resolve < ARGUMENTS[a].cost) return { ok: false, reason: '집중이 부족합니다.' };
  if (a === 'disclose' && n.reports < 1) return { ok: false, reason: '교리·장수 성장·작전 전법에서 얻은 정보가 필요합니다.' };
  if (a === 'credential' && n.credentials < 1) return { ok: false, reason: '유효 협정 또는 우호 관계의 신용이 필요합니다.' };
  if (a === 'pledge' && n.food < 2) return { ok: false, reason: '즉시 지불할 원정 군량 2가 필요합니다.' };
  if (a === 'authority' && n.promise) return { ok: false, reason: '활동 권한은 이미 약속했습니다.' };
  return { ok: true };
}
export function negotiationGrade(s: DebateState): 'success' | 'partial' | 'failure' {
  const n = s.negotiation!;
  const demands = Object.entries(n.needs).every(([axis, required]) => n.scores[axis as keyof typeof n.scores] >= required!);
  if (demands && s.trust >= n.trustNeeded && n.burden <= n.burdenLimit) return 'success';
  const partial = s.opponentId === 'merchant' ? n.scores.profit >= 3 || n.scores.safety >= 3 : s.opponentId === 'elder' ? n.scores.safety >= 3 : n.scores.honor >= 3;
  return partial && s.trust >= 1 && n.burden <= n.burdenLimit ? 'partial' : 'failure';
}
export function resolveArgument(s: DebateState, action: string, round: number): Check {
  const check = canArgument(s, action, round); if (!check.ok) return check;
  const {events, emit} = debateReceipt(s, action);
  if (action === 'withdraw') { s.result = 'failure'; s.log.push('중단: 이미 제시한 군량은 환급하지 않습니다. 기본 조건 또는 포기로 계속 진행.'); emit('debateResolved', s.opponentId, 0, 'failure', '중단 · 지불 군량 환급 없음', 3); return {ok:true, events:finalizeDebateEvents(events,s)}; }
  const n = s.negotiation!, a = action as Argument, rule = ARGUMENTS[a];
  const concessionReady = n.concessionReady; n.concessionReady = false;
  const repeat = n.lastArgument === a && !s.traits.includes('composure');
  s.resolve -= rule.cost;
  emit('costSpent', s.generalId, -rule.cost, 'focus', '집중 비용');
  emit('speechStarted', s.opponentId, 0, a, rule.name);
  const newlyMet: string[] = [];
  for (const [axis, amount] of Object.entries(rule.scores)) {
    const k = axis as keyof typeof n.scores, gain = Math.max(0, amount! - (repeat ? 1 : 0)), before = n.scores[k];
    n.scores[k] += gain;
    emit('argumentApplied', axis, gain, axis, repeat ? '연속 사용 감소 적용' : rule.name);
    if (n.needs[k] !== undefined && before < n.needs[k]! && n.scores[k] >= n.needs[k]!) newlyMet.push(k);
  }
  let trust = rule.trust;
  if (a === 'concede') { s.resolve += 2; emit('argumentApplied', s.generalId, 2, 'focus', '양보 집중 회복'); if (concessionReady) { trust++; s.log.push('정보 공개 → 우려 해소 → 양보 신뢰 +1 추가.'); emit('traitTriggered', 'trust', 0, 'trust', '정보 공개 → 양보: 신뢰 +1 (신뢰 변화에 포함)', 2); } n.concessionReady = false; if (s.traits.includes('mediator')) {trust++; emit('traitTriggered','trust',0,'trust','중재: 신뢰 +1 (신뢰 변화에 포함)',2);} }
  if (a === 'disclose') { n.reports--; n.concessionReady = true; emit('resourceSpent', s.generalId, -1, 'reports', '작전 정보 공개'); emit('followupUnlocked', 'concede', 1, 'trust', '다음 양보 신뢰 +1', 2); }
  if (a === 'credential') {n.credentials--; emit('resourceSpent',s.generalId,-1,'credentials','협정 신용 소비');}
  if (a === 'pledge') { n.food -= 2; n.paid += 2; n.burden++; emit('resourceSpent',s.generalId,-2,'food','즉시 지불 · 환급 없음'); emit('burdenChanged',s.opponentId,1,'burden','실물 군량 부담'); if (s.traits.includes('quartermaster')) {const before=n.scores.safety; n.scores.safety++; emit('traitTriggered','safety',1,'safety','보급 운영',2); if(n.needs.safety!==undefined&&before<n.needs.safety&&n.scores.safety>=n.needs.safety&&!newlyMet.includes('safety'))newlyMet.push('safety');} }
  if (a === 'authority') { n.promise = true; n.burden += 2; emit('burdenChanged',s.opponentId,2,'burden','권한 약속 · 수락 시 카드 보상 제한',2); }
  const priorTrust = s.trust;
  s.trust = Math.max(0, s.trust + trust); emit('trustChanged','trust',s.trust-priorTrust,'trust',rule.name);
  if(priorTrust<n.trustNeeded && s.trust>=n.trustNeeded)emit('requirementSatisfied','trust',0,'trust','신뢰 요구 충족',2);
  s.round++; n.lastArgument = a;
  s.agreement = Object.values(n.scores).reduce((sum, v) => sum + v, 0); // compatibility summary only; never the success threshold
  if (s.round === 2 && !n.counter.applied) { const axis = n.counter.axis; n.needs[axis] = (n.needs[axis] ?? 0) + n.counter.amount; n.counter.applied = true; s.log.push(`상대 반론: ${AXIS_NAMES[axis]} 요구 +1. 남은 두 선택에서 대응하세요.`); emit('opponentCountered',axis,n.counter.amount,axis,`${AXIS_NAMES[axis]} 보장을 더 요구합니다.`,2,s.opponentId); }
  for (const k of newlyMet) if (n.scores[k as keyof typeof n.scores] >= n.needs[k as keyof typeof n.scores]!) emit('requirementSatisfied',k,0,k,`${AXIS_NAMES[k as keyof typeof AXIS_NAMES]} ${n.scores[k as keyof typeof n.scores]}/${n.needs[k as keyof typeof n.scores]} 요구 충족`,2);
  s.log.push(`${rule.name}: 신뢰 ${s.trust}, 군량 ${n.food}, 부담 ${n.burden}/${n.burdenLimit}${repeat ? ' (같은 논거 연속 사용: 각 요구 충족량 -1)' : ''}.`);
  if (s.round >= s.maxRounds) { s.result = negotiationGrade(s); s.log.push(missingDemands(s)); emit('debateResolved',s.opponentId,0,s.result,missingDemands(s),3); }
  return { ok: true, events:finalizeDebateEvents(events,s) };
}
export function missingDemands(s: DebateState): string {
  const n = s.negotiation!; const missing = Object.entries(n.needs).filter(([k, v]) => n.scores[k as keyof typeof n.scores] < v!).map(([k, v]) => `${AXIS_NAMES[k as keyof typeof AXIS_NAMES]} ${n.scores[k as keyof typeof n.scores]}/${v}`);
  if (s.trust < n.trustNeeded) missing.push(`신뢰 ${s.trust}/${n.trustNeeded}`);
  if (n.burden > n.burdenLimit) missing.push(`부담 초과 ${n.burden}/${n.burdenLimit}`);
  return missing.length ? '미충족: ' + missing.join(' · ') : '모든 합의 조건을 충족했습니다.';
}
export function negotiatedTerms(s: DebateState): NegotiatedTerms {
  const n = s.negotiation!;
  const penalty = n.promise && s.result !== 'failure' ? 1 : 0;
  return { penalty, paid: n.paid, description: `이미 지불한 군량 ${n.paid}${penalty ? ' · 수락 시 다음 카드 보상 1회 선택지 -1' : ''}. ${missingDemands(s)}` };
}
