import type { DebateCardDef,Effect,Method,Operation } from '../core/debate-deck-types.ts';
export const METHOD_NAMES:Record<Method,string>={honor:'명분',profit:'실리',trust:'신뢰',pressure:'압박',information:'정보',scheme:'계책'};
const effect=(source:string,operations:Operation[],condition?:Effect['condition']):Effect=>({source,timing:'play',operations,condition,limit:1,priority:1});
const score=(axis:'profit'|'safety'|'honor'|'authority',amount:number):Operation=>({kind:'score',axis,amount});
function card(id:string,name:string,family:Method,cost:number,text:string,ops:Operation[],extra:Partial<DebateCardDef>={}):DebateCardDef{
 return {id,name,family,cost,text,effects:[effect(name,ops)],mods:['fleeting','opening','cycle','clean'],...extra};
}
export const DEBATE_CARDS:Record<string,DebateCardDef>=Object.fromEntries([
 card('grounds','공적 근거','honor',1,'명분 +2.',[score('honor',2)],{upgrades:{stable:{text:'명분 +3, 반론 방어 +1.',effects:[effect('정론',[score('honor',3),{kind:'guard',amount:1}])]},linked:{text:'명분 +2. 직전 정보면 신뢰 +2.',effects:[effect('연계',[score('honor',2)]),effect('정보 연계',[{kind:'trust',amount:2}],{previous:'information'})]}}}),
 card('plan','대책 문서','profit',1,'이익 +2, 안전 +1.',[score('profit',2),score('safety',1)]),
 card('assurance','작은 보증','trust',1,'신뢰 +1, 안전 +1.',[{kind:'trust',amount:1},score('safety',1)]),
 card('yield','비용 떠안기','trust',0,'부담 +1, 신뢰 +1. 이후 신뢰 연계.',[{kind:'burden',amount:1},{kind:'trust',amount:1}],{upgrades:{stable:{text:'부담 없이 신뢰 +2.',effects:[effect('절제',[{kind:'trust',amount:2}])]},linked:{text:'부담 +1, 신뢰 +1, 카드 1장.',effects:[effect('후일',[{kind:'burden',amount:1},{kind:'trust',amount:1},{kind:'draw',amount:1}])]}}}),
 card('inspect','상황 조사','information',1,'정보 +1, 카드 1장. 추가 반론 공개.',[{kind:'reports',amount:1},{kind:'draw',amount:1},{kind:'reveal',amount:1}]),
 card('challenge','단호한 질문','pressure',1,'이익 +3, 신뢰 −1, 반론 방어 +1.',[score('profit',3),{kind:'trust',amount:-1},{kind:'guard',amount:1}]),
 card('bridge','논점 잇기','scheme',1,'안전 +1. 직전 정보면 안전 +2.',[score('safety',1)],{effects:[effect('논점 잇기',[score('safety',1)]),effect('정보 → 계책',[score('safety',2)],{previous:'information'})]}),
 card('petition','권한 문서','honor',1,'권한 +2, 명분 +1.',[score('authority',2),score('honor',1)]),
 card('ration','군량 담보','profit',1,'군량 2 즉시 지급(환급 없음), 이익 +3. 다음 이동 의무.',[{kind:'food',amount:-2},score('profit',3),{kind:'promise',promise:'ration'}]),
 card('authority','위임 약정','honor',1,'권한 +3, 부담 +1. 다음 전투 카드 보상 제한.',[score('authority',3),{kind:'burden',amount:1},{kind:'promise',promise:'authority'}]),
 card('bond','신뢰 장부','trust',1,'신뢰 +2. 부담 직후 안전 +2.',[{kind:'trust',amount:2}],{effects:[effect('신뢰 장부',[{kind:'trust',amount:2}]),effect('양보 연계',[score('safety',2)],{burdenBefore:true})]}),
 card('answer','예고에 답하다','information',1,'반론 방어 +2, 다음 카드 집중 비용 −1.',[{kind:'guard',amount:2},{kind:'discount',amount:1}]),
 card('refine','군더더기 덜기','scheme',1,'다른 손패 1장 소멸 후 2장 뽑기. 방해도 정제 가능.',[{kind:'exhaustHand'},{kind:'draw',amount:2}]),
 card('echo','논거 필사','scheme',1,'직전 카드의 기본 효과 1회 복사. 복사/생성/드로우는 복사하지 않음.',[{kind:'copy'}],{exhaust:true,mods:['opening','clean']}),
 card('supplies','보급 경로','profit',1,'안전 +3, 이익 +1.',[score('safety',3),score('profit',1)]),
 card('redress','조항 정리','trust',1,'부담 −1, 신뢰 +1.',[{kind:'burden',amount:-1},{kind:'trust',amount:1}]),
 card('draft','임시 논거 작성','information',1,'임시 논점 잇기 1장을 손에 생성. 이 카드는 소멸.',[{kind:'generate',card:'bridge'}],{exhaust:true,mods:['opening','clean']}),
 card('g_read','기미를 읽다','information',0,'반론 추가 공개, 정보 +1. 설전당 소멸.',[{kind:'reveal',amount:1},{kind:'reports',amount:1}],{owner:'guojia',exhaust:true}),
 card('g_trap','예고된 허점','scheme',1,'반론 방어 +2. 직전 정보면 안전 +3.',[{kind:'guard',amount:2}],{owner:'guojia',effects:[effect('예고된 허점',[{kind:'guard',amount:2}]),effect('선견의 답',[score('safety',3)],{previous:'information'})]}),
 card('g_dispatch','살아 있는 첩보','information',1,'카드 2장, 안전 +1.',[{kind:'draw',amount:2},score('safety',1)],{owner:'guojia'}),
 card('c_accept','불리함을 받다','profit',0,'부담 +1, 이익 +1.',[{kind:'burden',amount:1},score('profit',1)],{owner:'chengong'}),
 card('c_turn','조건 돌려쓰기','scheme',1,'안전 +2. 직전 실리면 명분 +2.',[score('safety',2)],{owner:'chengong',effects:[effect('조건 돌려쓰기',[score('safety',2)]),effect('실리 전환',[score('honor',2)],{previous:'profit'})]}),
 card('c_cut','조항을 추리다','scheme',1,'다른 손패 1장 소멸, 부담 −1, 카드 1장.',[{kind:'exhaustHand'},{kind:'burden',amount:-1},{kind:'draw',amount:1}],{owner:'chengong'}),
 card('doubt','의심','trust',1,'손에 있으면 신뢰 카드의 신뢰 증가 −1. 처리: 신뢰 +1 후 소멸.',[{kind:'trust',amount:1}],{hindrance:true,exhaust:true,mods:[]}),
 card('delay','장황함','information',1,'처리 시 카드 1장, 소멸.',[{kind:'draw',amount:1}],{hindrance:true,exhaust:true,mods:[]}),
 card('quibble','말꼬리','pressure',1,'손에 있으면 같은 계열 반복에 부담 +1. 처리 시 소멸.',[],{hindrance:true,exhaust:true,mods:[]}),
 card('unsettled','미결 조항','honor',1,'소멸하지 않으면 완전 합의를 조건부로 제한.',[],{hindrance:true,exhaust:true,mods:[]}),
].map(c=>[c.id,c]));
export const COMMON_START=['grounds','plan','assurance','yield','petition','supplies'];
export const DEBATE_ARCHETYPES={
 guojia:{name:'선견',text:'매 라운드 추가 반론 공개. 라운드 첫 정보→계책에 카드 1장.',families:['information','scheme'] as Method[],unique:['g_read','g_trap','g_dispatch'],principles:[{...effect('선견',[{kind:'draw',amount:1}],{previous:'information',family:'scheme'}),timing:'after' as const}]},
 chengong:{name:'변통',text:'라운드 첫 부담 증가: 카드 1장·집중 +1.',families:['profit','scheme'] as Method[],unique:['c_accept','c_turn','c_cut'],principles:[{...effect('변통',[{kind:'draw',amount:1},{kind:'focus',amount:1}]),timing:'burden' as const}]},
};
export function archetype(id:string){return DEBATE_ARCHETYPES[id as keyof typeof DEBATE_ARCHETYPES]??{name:'공론',text:'고유 카드 없는 공용 시작 덱. 특화 원형 제작 대기.',families:['honor','trust'] as Method[],unique:['inspect','bond','redress'],principles:[] as Effect[]};}
export const SEALS:Record<string,{name:string;text:string;effects:Effect[]}>= {
 chain:{name:'연환의 인',text:'서로 다른 3계열 연속: 이익 +2. 라운드 1회.',effects:[{...effect('연환의 인',[score('profit',2)],{different:3}),timing:'after'}]},
 forum:{name:'공론의 인',text:'직전과 다른 계열: 신뢰 +1. 라운드 1회.',effects:[{...effect('공론의 인',[{kind:'trust',amount:1}],{different:2}),timing:'after'}]},
 ledger:{name:'장부의 인',text:'군량을 지불한 카드: 이익 +1. 라운드 1회.',effects:[{...effect('장부의 인',[score('profit',1)],{paid:true}),timing:'after'}]},
 reply:{name:'반박의 인',text:'반론 방어를 만든 카드: 다음 비용 −1. 라운드 1회.',effects:[{...effect('반박의 인',[{kind:'discount',amount:1}],{answered:true}),timing:'after'}]},
 yield:{name:'양보의 인',text:'부담 직후 신뢰 카드: 안전 +2. 라운드 1회.',effects:[{...effect('양보의 인',[score('safety',2)],{family:'trust',burdenBefore:true}),timing:'after'}]},
 illusion:{name:'허실의 인',text:'정보→계책: 기본 수치 효과 1회 추가, 그 카드는 소멸. 라운드 1회.',effects:[{...effect('허실의 인',[{kind:'amplify',amount:1}],{previous:'information',family:'scheme'}),timing:'after'}]},
};
