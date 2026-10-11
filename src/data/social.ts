import type { ActivityProfile, ActivityTrait, Concern, DebateAction, DuelAction, FactionId } from '../core/social-types.ts';

export const TRAIT_TEXT: Record<ActivityTrait, string> = {
  parry: '수세: 방어 반격 +2', surge: '돌파: 승부수 피해 +2', composure: '침착: 연속 행동의 효율 감소 없음',
  insight: '통찰: 설전 정보 +1 / 구형 설전 다음 논점 공개', mediator: '중재: 양보 시 신뢰 +1 추가',
  quartermaster: '보급 운영: 실물 군량의 안전 +1 / 구형 설전 실리·안전 합의 +1', envoy: '사절: 외교 비용 -1 (최소 1)',
};
export const GENERAL_PROFILES: Record<string, ActivityProfile> = {
  xunyu:{duel:1,debate:3,traits:['envoy']},lusu:{duel:1,debate:3,traits:['insight']},local_broker:{duel:1,debate:2,traits:['quartermaster']},
  rival_guard:{duel:1,debate:1,traits:['parry']},
  local_captain:{duel:1,debate:1,traits:['quartermaster']},local_scribe:{duel:1,debate:2,traits:['envoy']},
  dianwei: { duel: 2, debate: 1, traits: ['parry'] }, chengpu: { duel: 2, debate: 2, traits: ['composure'] },
  caoren: { duel: 1, debate: 2, traits: ['parry', 'quartermaster'] }, haozhao: { duel: 1, debate: 2, traits: ['parry', 'quartermaster'] },
  huanggai: { duel: 2, debate: 1, traits: ['surge'] }, luxun: { duel: 1, debate: 3, traits: ['insight'] },
  pangtong: { duel: 1, debate: 3, traits: ['insight'] }, lubu: { duel: 3, debate: 1, traits: ['surge'] },
  zhangliao: { duel: 2, debate: 2, traits: ['envoy'] }, guojia: { duel: 1, debate: 3, traits: ['insight'] },
  chengong: { duel: 1, debate: 3, traits: ['mediator'] }, machao: { duel: 3, debate: 1, traits: ['surge'] },
};
export const DUEL_ACTIONS: Record<DuelAction, { name: string; text: string }> = {
  strike: { name: '강공', text: '피해 6+적성. 상대 강공에 받는 피해 +3. 기세 +1.' },
  probe: { name: '견제', text: '피해 3+적성. 상대 피해 -3. 기세 +1.' },
  guard: { name: '방어', text: '피해 6 감소. 상대 강공·승부수에 반격 4. 상대 견제에 피해 4 추가. 기세 +1.' },
  finisher: { name: '승부수', text: '기세 2 소비. 피해 9+적성. 상대 방어를 관통한다.' },
};
export const DUEL_OPPONENTS: Record<string, { name: string; hp: number; power: number; pattern: DuelAction[]; tendency: string }> = {
  inn_guard: {name:'객사 호위 대표',hp:24,power:7,pattern:['strike','strike','guard','finisher'],tendency:'강공으로 시험하고 방어 뒤 승부수를 씁니다. 패배해도 의뢰의 유료 우회가 남습니다.'},
  champion: { name: '화웅의 선봉 무장', hp: 24, power: 7, pattern: ['strike', 'strike', 'guard', 'finisher'], tendency: '강공이 잦다. 방어 반격으로 틈을 노려라.' },
  rider: { name: '서량 기병 대장', hp: 22, power: 6, pattern: ['probe', 'guard', 'strike', 'finisher'], tendency: '견제와 방어 뒤에 돌파한다.' },
  sentinel: { name: '장보의 호위 무장', hp: 26, power: 5, pattern: ['guard', 'probe', 'strike', 'guard'], tendency: '수비가 단단하다. 기세를 모아 관통하라.' },
};
export const DUEL_ENCOUNTERS: Record<string, string> = { el_huaxiong: 'champion', e_cav: 'rider', el_zhangbao: 'sentinel' };
export const CONCERN_NAME: Record<Concern, string> = { profit: '실리', honor: '명분', trust: '신뢰', safety: '안전' };
export const DEBATE_ACTIONS: Record<DebateAction, { name: string; cost: number; fits: Concern[]; text: string }> = {
  evidence: { name: '근거 제시', cost: 1, fits: ['profit', 'trust'], text: '집중 1. 실리·신뢰에 합의 +3, 다른 논점 +1. 신뢰 +1.' },
  rebuttal: { name: '반박', cost: 2, fits: ['honor'], text: '집중 2. 명분에 합의 +5, 다른 논점 +1. 신뢰 -1.' },
  concede: { name: '양보', cost: 0, fits: ['safety', 'trust'], text: '집중 +2. 안전·신뢰에 합의 +2, 다른 논점 +0. 신뢰 +1.' },
  proposal: { name: '조건 제안', cost: 2, fits: ['profit', 'safety'], text: '집중 2. 실리·안전에 합의 +4, 다른 논점 +1. 신뢰 +1.' },
};
export const DEBATE_OPPONENTS: Record<string, { name: string; concerns: Concern[]; text: string }> = {
  merchant: { name: '상단 교섭관', concerns: ['profit', 'trust', 'profit', 'safety'], text: '수레의 대가와 약속의 근거를 따진다.' },
  scholar: { name: '재야의 선비', concerns: ['honor', 'trust', 'honor', 'safety'], text: '명분을 따지지만 마지막에는 안전을 요구한다.' },
  elder: { name: '향촌 대표', concerns: ['safety', 'trust', 'safety', 'profit'], text: '주민의 안전과 약속 이행을 중시한다.' },
};
export const FACTIONS: Record<FactionId, { name: string; opponent: string }> = {
  caravan: { name: '낙양 상단', opponent: 'merchant' }, militia: { name: '관문 의용군', opponent: 'elder' }, villages: { name: '향촌 연합', opponent: 'elder' },
};
export const TRADE_NAMES = { supply: '보급 요청', passage: '통행 협정', support: '군사 지원' } as const;
export const SOCIAL_EVENTS: Record<string, { title: string; body: string; faction?: FactionId; mode?: 'recruit' | 'supply' }> = {
  envoy: { title: '상단의 사절', body: '낙양 상단이 거래를 제안한다. 기본 조건으로 거래하거나 설전으로 개선할 수 있다.', faction: 'caravan' },
  checkpoint: { title: '관문의 협정', body: '의용군이 통행과 공동 작전의 대가를 요구한다.', faction: 'militia' },
  refugees: { title: '피난민 보급 협상', body: '향촌 대표가 여분의 수레를 맡길 조건을 논의한다.', mode: 'supply' },
  parley: { title: '재야 인재의 요구', body: '선비가 합류의 대가로 군량 5를 요구한다. 설전으로 조건을 바꿀 수 있다.', mode: 'recruit' },
};
