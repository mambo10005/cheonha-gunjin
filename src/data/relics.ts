export interface RelicDef {
  id: string;
  name: string;
  text: string;
}

// 처리 위치: core/combat.ts(전투 중), core/run.ts(전투 보상).
export const RELICS: Record<string, RelicDef> = {
  tuntian: { id: 'tuntian', name: '둔전책', text: '전투 승리 시 군량 +2.' },
  crossbow: { id: 'crossbow', name: '연노 기계', text: '매 턴 처음 사용하는 공격 카드의 피해 +3.' },
  armor: { id: 'armor', name: '철갑', text: '전투 시작 시 전열 방비 8.' },
  oil: { id: 'oil', name: '기름 항아리', text: '화상을 부여할 때마다 +1.' },
  horse: { id: 'horse', name: '서량마', text: '기병 카드 피해 +2.' },
  book: { id: 'book', name: '병법서', text: '매 턴 카드를 1장 더 뽑는다.' },
  beacon: { id: 'beacon', name: '봉화대', text: '후열이 피해를 받아도 동요하지 않는다.' },
  seal: { id: 'seal', name: '인수', text: '전투 첫 턴 지휘력 +1.' },
  drum: { id: 'drum', name: '전고', text: '한 턴에 기세가 4에 도달하면 카드 1장 뽑기.' },
  medic: { id: 'medic', name: '군의', text: '전투 승리 시 병력 4 회복.' },
};
