import type {InnArea,InnQuestDefinition} from '../core/inn-types.ts';
export const INNKEEPER={id:'innkeeper',name:'한복',role:'형양 객사 주인',fictional:true,concern:'손님과 피난민의 안전, 객사의 신용',secret:'추천인을 지켜 주는 안쪽 방과 비공개 출입 기록',preRole:'소개·의뢰 보증인',postRole:'인재 추천·사절 접견·정보망 책임자'};
export const INN_AREAS:Record<InnArea,{name:string;description:string}>={counter:{name:'주인 자리',description:'소개, 출입 기록, 소문과 숙박을 맡는 곳'},hall:{name:'객당',description:'손님들이 함께 머물며 공개적인 이야기를 나누는 곳'},private:{name:'안쪽 방',description:'주인의 소개와 방값 또는 신뢰가 필요한 비공개 접견실'},yard:{name:'뒤뜰',description:'호위 시험과 제한된 연습 대결을 하는 공간'}};
export const INN_GUESTS:Record<string,{name:string;role:string;area:InnArea;opening:string;}>={
 innkeeper:{name:'한복',role:'객사 주인 · 창작 인물',area:'counter',opening:'이곳에서는 이름보다 지킨 약속이 오래 남습니다. 누구를 만나러 오셨습니까?'},
 xunyu:{name:'순욱',role:'추천과 공론을 살피는 책사',area:'private',opening:'피난민 추천서에 적힌 사람이 정말 구휼을 받았는지 확인해 주십시오. 기록과 사람의 말을 함께 들어야 합니다.'},
 lusu:{name:'노숙',role:'상단과 주민의 중재자',area:'hall',opening:'시장 장부와 창고 장부의 수량이 다릅니다. 어느 한쪽을 몰아세우기 전에 두 기록을 맞춰 보시겠습니까?'},
 dianwei:{name:'전위',role:'호위 일을 찾는 무장',area:'yard',opening:'수레는 창고에서 출발해 성문을 지납니다. 그 길을 직접 살핀 사람에게만 호위를 맡기겠습니다.'},
 merchant:{name:'심운',role:'행상 · 창작 인물',area:'hall',opening:'장부에 없는 창고 이야기가 돌더군요. 믿기 전에 통행소에서 확인해 보세요.'},
 traveler:{name:'허림',role:'여행 서생 · 창작 인물',area:'hall',opening:'두 사람이 같은 추천서를 두고 다투고 있습니다. 이름을 공개하기 전에 출입 기록부터 확인하는 편이 좋겠습니다.'}
};
const step=(id:string,location:string,objective:string,approaches:string[])=>({id,location,objective,approaches});
export const INN_QUESTS:Record<string,InnQuestDefinition>={
 recommendation:{id:'recommendation',giver:'xunyu',title:'피난민 추천서의 구휼 보증',summary:'추천서의 이름과 실제 구휼 기록을 대조하고 성급한 고발을 막는다.',motive:'기존 순욱 부탁의 실제 문구를 단계형 임무로 확장한 게임용 창작 사건.',risk:'기한 24시간. 설전 결렬 시 추가 조사와 노출이 필요하며 보증금은 돌려받지 못한다.',timeLimit:24,escrow:2,resource:'food',steps:[step('records','inn','한복에게 출입 기록과 추천인의 행선을 묻기',['public-records','private-records','card-records']),step('investigate','archive','문서고에서 구휼 대상과 기록의 불일치를 조사',['investigate','card-investigate','ledger-investigate']),step('verify','archive','기록 보증인의 설명을 설전 또는 증거로 검증',['debate','letter','pay','retry-investigate']),step('conclude','archive','확인한 증거를 바탕으로 보증 범위를 선택',['truth','conditional','expose']),step('report','inn','객사로 돌아와 순욱에게 직접 보고',['report'])],reward:'부탁 완료·신뢰 +15·실적·경험 +1. 협력 카드와 등용은 이후 직접 선택.',postImpact:'주민 기록 보존 약속·관청 내응 단서·인재 추천망',plan:'inside'},
 escort:{id:'escort',giver:'dianwei',title:'수레가 지나갈 길',summary:'곡물 창고에서 수레·통로·호위 인력을 조사하고, 계약·설전·무장 대결·우회로 중 하나로 해결한 뒤 수레를 성문까지 실제로 옮겨 전위에게 보고한다.',motive:'주민과 군량을 함께 지킬 수 있는 호위자를 찾는다.',risk:'기한 24시간. 대결 패배도 의뢰를 끝내지 않으며 추가 비용이나 대체 통로를 찾아야 한다.',timeLimit:24,escrow:2,resource:'food',steps:[step('inspect','store','앞마당에서 수레와 통로, 호위 인원을 조사한다',['investigate','card-investigate']),step('resolve','store','확인한 단서를 가지고 호위 계약·설전·대결·우회로를 선택한다',['duel','debate','contract','contract-shared','contract-bond','alternate']),step('transport','gate','해결한 조건에 따라 수레와 군량을 성문까지 호송한다',['transport']),step('report','inn','객사로 돌아가 전위에게 실제 비용과 호송 결과를 보고한다',['report'])],reward:'전위 신뢰 +15·협력 실적·경험 +1·훈련 +1·호송 결과에 따른 군량',postImpact:'선택한 호위 방식과 물류 약속이 도시의 보급 기록에 남습니다.',plan:'barracks'},
 accounts:{id:'accounts',giver:'lusu',title:'두 장부의 간격',summary:'시장 거래 기록과 창고 입고 기록을 비교해 손실의 책임을 정한다.',motive:'주민과 상단이 함께 감당할 계약을 만든다.',risk:'기한 24시간. 조건부 합의는 채무 1을 남긴다.',timeLimit:24,escrow:1,resource:'funds',steps:[step('market','market','시장 장부에서 빠진 수량 확인',['investigate','card-investigate']),step('store','store','창고 책임자와 설전 또는 손실 분담',['debate','pay']),step('conclude','store','공개 기록 또는 공동 부담 선택',['truth','conditional']),step('report','inn','노숙에게 두 장부와 결론 보고',['report'])],reward:'노숙 신뢰 +15·실적·경험 +1·상단 관계',postImpact:'공동 교역 기록과 상단 계약'},
 lostletter:{id:'lostletter',giver:'innkeeper',title:'객사의 잃어버린 소개장',summary:'시장에서 소개장의 행방을 조사하고 민가의 전달인을 확인한다.',motive:'손님의 신원을 섣불리 공개하지 않고 객사의 신용을 지킨다.',risk:'기한 20시간. 성급한 공개는 노출과 불신을 남긴다.',timeLimit:20,escrow:0,resource:'funds',steps:[step('market','market','시장 전달 경로 조사',['investigate','card-investigate']),step('homes','homes','전달인의 사정을 듣고 소개장 회수',['investigate','letter']),step('report','inn','한복에게 소개장 회수 보고',['report'])],reward:'주인 신뢰 +2·안쪽 방 개방·소개장 1개',postImpact:'객사 추천망과 비공개 접견실'},
 cache:{id:'cache',giver:'innkeeper',title:'소문 속 비축 창고',summary:'성문에서 통행 소문을 확인하고 창고에서 실제 비축을 조사한다.',motive:'확인한 정보만 손님에게 전한다.',risk:'불확실한 소문이다. 기한 20시간, 공개 조사에 노출 1.',timeLimit:20,escrow:0,resource:'funds',steps:[step('gate','gate','통행 기록으로 소문 확인',['investigate','card-investigate']),step('store','store','숨은 비축의 실제 수량 확인',['investigate']),step('report','inn','한복에게 확인한 소문 보고',['report'])],reward:'지도 물품·정보 +1·주인 신뢰 +2',postImpact:'객사 정보망과 창고 협력'}
};
export const INN_TOPICS:Record<string,{label:string;time:number;cost:number;text:string;trust?:number}>={
 greet:{label:'인사와 객사의 규칙',time:0,cost:0,text:'손님의 비밀을 팔지 않고, 약속한 품삯은 미루지 않는 것이 이 집의 규칙입니다.',trust:1},
 today:{label:'오늘 머무는 사람',time:1,cost:0,text:'객당에는 장부를 아는 손님들이, 뒤뜰에는 호위를 찾는 무장이 있습니다. 중요한 의뢰인은 보고를 받을 때까지 기다립니다.'},
 mood:{label:'도시 분위기',time:1,cost:0,text:'피난민은 구휼 기록을, 상단은 안전한 거래를 원합니다. 노출이 높아지면 이 객사도 감시를 받습니다.'},
 officials:{label:'관청의 움직임',time:1,cost:0,text:'추천서와 구휼 기록의 사본이 문서고에 있습니다. 문서를 보존하는 선택은 거병 후에도 의무가 됩니다.'},
 trade:{label:'상단 소식',time:1,cost:0,text:'시장과 창고는 같은 거래를 다르게 기록합니다. 노숙에게 두 장부를 묻는 편이 좋겠습니다.'},
 soldiers:{label:'병영 소식',time:1,cost:0,text:'전위는 호송길을 먼저 확인하길 원합니다. 뒤뜰의 대결은 연습이지만 부상은 실제입니다.'},
 rumor:{label:'소문 한 가지 · 최대 2회',time:1,cost:1,text:'소문은 증거가 아닙니다. 성문과 창고에서 사실을 확인하십시오.'},
 introduce:{label:'안쪽 방 소개',time:1,cost:1,text:'비공개 대화를 보증하겠습니다. 주인 신뢰 2 또는 소개장이 있으면 방값 없이 소개합니다.'},
 jobs:{label:'주인의 개인 부탁',time:0,cost:0,text:'손님의 소개장이 시장에서 사라졌습니다. 민가까지 전달 경로를 확인해 주시겠습니까?'},
 lodging:{label:'숙박과 식사',time:0,cost:0,text:'짧은 휴식, 식사, 객실 숙박과 다음 시간대까지 기다리기 중 고르십시오. 시간과 방값은 돌려드리지 않습니다.'},
 observe:{label:'객당의 두 사람 대화 관찰',time:1,cost:0,text:'심운과 허림은 문서의 이름을 공개할지 논쟁합니다. 함께 질문하면 거래 단서를, 몰래 들으면 경계와 불신을 얻습니다.'}
};
