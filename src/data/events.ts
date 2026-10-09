export interface EventOption {
  text: string;
  detail: string;
  req?: { food?: number; hp?: number };
}

export interface EventDef {
  id: string;
  title: string;
  body: string;
  note: string; // 역사 재현인지 가상 전개인지 표시
  options: EventOption[];
}

// 결과 처리는 core/run.ts 의 resolveEvent 에 있다. 문구(detail)와 처리를 함께 수정할 것.
export const EVENTS: Record<string, EventDef> = {
  wanderer: {
    id: 'wanderer',
    title: '떠도는 책사',
    body: '낡은 도포를 걸친 선비가 진영 앞에서 군량 한 수레면 계책을 팔겠다고 한다.',
    note: '가상 전개',
    options: [
      { text: '군량을 주고 맞아들인다', detail: '군량 -5, 아직 없는 책사 장수 1명 영입', req: { food: 5 } },
      { text: '계책 한 수만 청한다', detail: '전법 「이간계」 획득' },
      { text: '그냥 보낸다', detail: '아무 일도 없다' },
    ],
  },
  village: {
    id: 'village',
    title: '굶주린 마을',
    body: '흉년 든 마을이다. 곳간은 비었고 사람들의 눈길이 수레에 꽂힌다.',
    note: '가상 전개',
    options: [
      { text: '창고를 연다', detail: '군량 -4, 최대 병력 +6, 병력 +6 (민심을 얻어 자원병이 합류)', req: { food: 4 } },
      { text: '징발한다', detail: '군량 +7, 덱에 「민심 이반」(사용 불가) 추가' },
      { text: '지나친다', detail: '아무 일도 없다' },
    ],
  },
  alliance: {
    id: 'alliance',
    title: '동맹의 제안',
    body: '인근 군벌의 사자가 원군을 보내겠다고 한다. 대가로 전리품 일부를 요구한다.',
    note: '가상 전개',
    options: [
      { text: '원군을 받는다', detail: '다음 전투 시작 시 적 전원 피해 12. 대신 다음 카드 보상 2회는 선택지가 2장' },
      { text: '예물만 주고받는다', detail: '군량 -3, 무작위 보물 1개', req: { food: 3 } },
      { text: '거절한다', detail: '아무 일도 없다' },
    ],
  },
  shortcut: {
    id: 'shortcut',
    title: '험한 지름길',
    body: '절벽길로 가면 버려진 관문 창고를 지나간다. 낙석이 잦다.',
    note: '가상 전개',
    options: [
      { text: '강행군한다', detail: '병력 -8, 무작위 보물 1개', req: { hp: 9 } },
      { text: '우회한다', detail: '군량 -2 (부족하면 그만큼 병력 손실)' },
    ],
  },
  surrender: {
    id: 'surrender',
    title: '투항병',
    body: '황건 잔당 수천이 무기를 내려놓고 항복했다. 훈련은 엉망이지만 머릿수는 많다.',
    note: '역사 모티프(조조의 청주병 편입)를 빌린 가상 사건',
    options: [
      { text: '모두 편입한다', detail: '최대 병력 +5, 병력 +10, 덱에 「오합지졸」 2장 추가' },
      { text: '정예만 추린다', detail: '덱에서 카드 1장 제거' },
      { text: '포로를 교환한다', detail: '군량 +3' },
    ],
  },
  manual: {
    id: 'manual',
    title: '병법 고서',
    body: '불탄 서고에서 반쯤 남은 병법서를 찾았다.',
    note: '가상 전개',
    options: [
      { text: '필사한다', detail: '군량 -3, 덱의 카드 1장 복제', req: { food: 3 } },
      { text: '밤새 연구한다', detail: '병력 -5, 무작위 희귀 전법 1장', req: { hp: 6 } },
      { text: '팔아버린다', detail: '군량 +4' },
    ],
  },
};
