import type { Argument, Axis } from '../core/accord-types.ts';
export const AXIS_NAMES: Record<Axis, string> = { profit: '이익', safety: '안전', honor: '명분', authority: '권한' };
export interface ArgumentDef { name: string; cost: number; text: string; scores: Partial<Record<Axis, number>>; trust: number }
export const ARGUMENTS: Record<Argument, ArgumentDef> = {
  evidence: { name: '근거 제시', cost: 1, text: '집중 1 → 명분 +2·이익 +1·신뢰 +1.', scores: { honor: 2, profit: 1 }, trust: 1 },
  rebuttal: { name: '반론 정리', cost: 2, text: '집중 2 → 명분 +3, 신뢰 -1. 반박만으로 안전·권한은 충족하지 못함.', scores: { honor: 3 }, trust: -1 },
  concede: { name: '부담 양보', cost: 0, text: '집중 +2·안전 +1·신뢰 +1. 정보 공개 직후면 신뢰 +2로 개선.', scores: { safety: 1 }, trust: 1 },
  proposal: { name: '운영 제안', cost: 2, text: '집중 2 → 이익 +3·안전 +1·신뢰 +1.', scores: { profit: 3, safety: 1 }, trust: 1 },
  disclose: { name: '작전 정보 공개', cost: 1, text: '집중 1·정보 1 소비 → 안전 +2·신뢰 +1. 다음 양보의 신뢰 +1 추가.', scores: { safety: 2 }, trust: 1 },
  pledge: { name: '실물 군량 제시', cost: 0, text: '원정 군량 2 즉시 지불(실패·중단해도 환급 없음) → 이익 +2·안전 +2·신뢰 +1·상대 부담 +1.', scores: { profit: 2, safety: 2 }, trust: 1 },
  authority: { name: '활동 권한 약속', cost: 1, text: '집중 1 → 명분 +2·권한 +1·신뢰 +1·상대 부담 +2. 최종 제안을 수락하면 다음 카드 보상 1회 선택지 -1.', scores: { honor: 2, authority: 1 }, trust: 1 },
  credential: { name: '협정 신용 활용', cost: 0, text: '신용 1 소비 → 신뢰 +2·안전 +1·이익 +1. 유효 협정 또는 우호 관계가 필요.', scores: { safety: 1, profit: 1 }, trust: 2 },
};
export const DEMANDS = {
  merchant: { needs: { profit: 4, safety: 3 }, trust: 2, burden: 3, counters: ['safety', 'profit'] as Axis[], text: '상단: 이익과 운송 안전을 함께 보장해야 합니다.' },
  elder: { needs: { safety: 3 }, trust: 3, burden: 1, counters: ['safety', 'safety'] as Axis[], text: '향촌: 안전·신뢰와 부담 상한을 지키십시오. 권한 약속의 부담 2는 수용하지 않습니다.' },
  scholar: { needs: { honor: 4, authority: 1 }, trust: 2, burden: 3, counters: ['honor', 'honor'] as Axis[], text: '인재: 명분뿐 아니라 실제 활동 권한이 필요합니다.' },
};
