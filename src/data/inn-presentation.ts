/** Generated portraits use one master pose with lighting/scale states, not invented separate artwork. */
export const INN_PRESENTATION={
 background:'/assets/inn/interior-v1.webp',
 opponents:{
  inn_documents:{src:'/assets/inn/traveler-v1.webp',name:'허림 · 구휼 기록 보증인',line:'기록이 사람을 놓칠 수도 있습니다. 보증의 범위를 함께 확인합시다.'},
  inn_accounts:{src:'/assets/inn/merchant-v1.webp',name:'심운 · 창고 장부 책임자',line:'빠진 수량을 누구의 책임으로 남길지 근거부터 맞춰야 합니다.'},
  inn_escort:{src:'/assets/locations/escort-captain.svg',name:'장굉 · 창작 인물 호위 대표',line:'수레를 지킬 방비와 통행 안전을 실제로 보여 주십시오.'},
  inn_escort_terms:{src:'/assets/locations/warehouse-manager.svg',name:'왕상 · 창작 인물 창고 책임자',line:'보수와 사고 책임을 분명히 하면 수레 통행을 허가하겠습니다.'},
  inn_courtyard:{src:'/assets/battle/dianwei-v1.png',name:'전위 · 호위 대표',line:'부상이 남을 수 있습니다. 준비가 되었을 때 시험에 임하십시오.'}
 },
 people:{
  innkeeper:{src:'/assets/inn/innkeeper-v1.webp',position:'50% 20%',area:'counter',x:12,y:62},
  xunyu:{src:'/assets/inn/xunyu-v1.webp',position:'50% 15%',area:'private',x:78,y:35},
  lusu:{src:'/assets/inn/lusu-v1.webp',position:'50% 15%',area:'hall',x:58,y:29},
  dianwei:{src:'/assets/battle/dianwei-v1.png',position:'50% 18%',area:'yard',x:42,y:29},
  merchant:{src:'/assets/inn/merchant-v1.webp',position:'50% 15%',area:'hall',x:39,y:66},
  traveler:{src:'/assets/inn/traveler-v1.webp',position:'50% 15%',area:'hall',x:66,y:66}
 },
 // 구역마다 같은 객사 원화의 다른 부분을 잘라 만든 장면(주인 자리 계산대·객당 탁자·안쪽 방 휘장·뒤뜰 연무장). 구역 전용 원화가 생기면 src만 바꾼다.
 areas:{counter:{src:'/assets/inn/area-counter-v1.webp',position:'50% 50%',label:'주인 자리'},hall:{src:'/assets/inn/area-hall-v1.webp',position:'50% 55%',label:'객당'},private:{src:'/assets/inn/area-private-v1.webp',position:'50% 50%',label:'안쪽 방'},yard:{src:'/assets/inn/area-yard-v1.webp',position:'50% 60%',label:'뒤뜰'}}
} as const;
