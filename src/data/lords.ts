export interface LordDef {
  id: string;
  name: string;
  title: string;
  rule: string;
  startGeneral: string;
  deckNote: string;
}

export const LORDS: Record<string, LordDef> = {
  caocao: {
    id: 'caocao',
    name: '조조',
    title: '유재시거(唯才是擧)',
    rule: '장수 영입 후보가 1명 더 나온다. 진형에 장수가 2명 이상이면 매 턴 지휘력 +1. 전투 중 매 턴 첫 장수 위치 교대는 무료(기본 지휘력 1).',
    startGeneral: 'dianwei',
    deckNote: '창격 4 · 방진 3 · 반격 태세 · 군령 · 허보 — 반격으로 버티며 인재를 모은다',
  },
  sunquan: {
    id: 'sunquan',
    name: '손권',
    title: '강동 연계(江東連繫)',
    rule: '한 턴에 武·防·策 카드를 모두 사용하면 지휘력 +1(턴당 1회).',
    startGeneral: 'chengpu',
    deckNote: '창격 4 · 방진 3 · 화시 2 · 허보 — 화공으로 시작',
  },
};
