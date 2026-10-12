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
 // ── 인재 개인 카드의 설전 변환(논박진 문법) ──
 card('x_doc','문서 정리','honor',1,'명분 +2.',[score('honor',2)]),
 card('x_orth','정론 제기','honor',1,'명분 +1, 권한 +1.',[score('honor',1),score('authority',1)]),
 card('x_guard','논거 보호','honor',1,'반론 방어 +1, 신뢰 +1.',[{kind:'guard',amount:1},{kind:'trust',amount:1}]),
 card('d_vouch','전위의 보증','pressure',1,'안전 +1, 신뢰 +1.',[score('safety',1),{kind:'trust',amount:1}]),
 card('l_med','중재','trust',1,'부담 −1, 신뢰 +1.',[{kind:'burden',amount:-1},{kind:'trust',amount:1}]),
 card('l_audit','장부 대조','information',1,'정보 +1, 반론 추가 공개.',[{kind:'reports',amount:1},{kind:'reveal',amount:1}]),
 // ── 인재 지원 카드(설전당 1회, 실제 참여할 때만) ──
 card('s_xunyu','추천의 보증','trust',0,'신뢰 +1.',[{kind:'trust',amount:1}],{exhaust:true,support:true,mods:[]}),
 card('s_lusu','양측의 계산','scheme',0,'부담 −1, 반론 2개 공개.',[{kind:'burden',amount:-1},{kind:'reveal',amount:2}],{exhaust:true,support:true,mods:[]}),
 // ── 탐색 성과의 변환: 증거 제시(카드마다 놓을 논거가 정해짐) ──
 card('evidence','증거 제시','honor',1,'준비한 증거 논거를 놓습니다.',[],{exhaust:true,mods:[]}),
].map(c=>[c.id,c]));
/** 논박진 효과: 같은 카드가 전장이 있는 설전에서 추가로 하는 일. 계열마다 다르게 작동한다. */
const FIELD:Record<string,{ops:Operation[];text:string}>={
 // 정론: 증거 배치·보호·모순 제거·신뢰·조항 개방
 grounds:{ops:[{kind:'argument',def:'a_grounds'}],text:'정론 · 「공적 근거」 배치(증거·문서 2)'},
 petition:{ops:[{kind:'unlock'},{kind:'protect',amount:1,scope:'one'}],text:'정론 · 조항 잠금 해제, 노려진 내 논거 보호 +1'},
 x_doc:{ops:[{kind:'argument',def:'a_doc'}],text:'정론 · 「정리된 문서」 배치(증거·문서 3, 정론 비용 −1)'},
 x_orth:{ops:[{kind:'attack',amount:2},{kind:'unlock'}],text:'정론 · 겨눈 상대 논거 논박 2, 조항 잠금 해제'},
 x_guard:{ops:[{kind:'protect',amount:1,scope:'all'}],text:'정론 · 내 모든 논거 보호 +1, 다음 의도 1 경감'},
 answer:{ops:[{kind:'exact'}],text:'정론 · 다음 의도 2 경감, 숨긴 의도·수치 공개'},
 evidence:{ops:[{kind:'argument',def:'$card'}],text:'정론 · 준비한 증거 논거 배치'},
 // 압박: 높은 논박 피해·의도 지연·강제 조항·압박 증가·부담/경계
 challenge:{ops:[{kind:'attack',amount:3},{kind:'pressure',amount:1}],text:'압박 · 겨눈 상대 논거 논박 3(무너뜨리면 이번 의도 지연), 압박 +1'},
 authority:{ops:[{kind:'attack',amount:2,core:true},{kind:'pressure',amount:1}],text:'압박 · 상대 핵심 주장 논박 2(강제 조항), 압박 +1'},
 d_vouch:{ops:[{kind:'argument',def:'a_vouch'},{kind:'pressure',amount:1}],text:'압박 · 「전위의 보증」 배치(압박 피해 +1·부담 증가), 압박 +1'},
 // 계책: 숨은 논거 공개·공격 대상 변경·효과 전환·의도 조작
 inspect:{ops:[{kind:'expose'}],text:'계책 · 숨은 논거 1개 공개'},
 g_read:{ops:[{kind:'expose'}],text:'계책 · 숨은 논거 1개 공개'},
 l_audit:{ops:[{kind:'expose'},{kind:'attack',amount:2}],text:'계책 · 숨은 논거 공개 후 겨눈 논거 논박 2'},
 bridge:{ops:[{kind:'redirect'}],text:'계책 · 이번 공격을 가장 단단한 내 논거로 돌리거나 다음 의도와 순서를 바꿈'},
 c_turn:{ops:[{kind:'convert'}],text:'계책 · 내구 2 이하 상대 논거를 비틀어 「돌려쓴 조건」으로 전환'},
 c_cut:{ops:[{kind:'unlock'}],text:'계책 · 조항 잠금 해제'},
 // 중재: 양측 보호·부담 감소·청중 상태·조급함
 assurance:{ops:[{kind:'protect',amount:1,scope:'one'}],text:'중재 · 노려진 내 논거 보호 +1'},
 bond:{ops:[{kind:'audience',amount:-1}],text:'중재 · 청중의 의심 −1'},
 redress:{ops:[{kind:'protect',amount:1,scope:'all'}],text:'중재 · 내 모든 논거 보호 +1'},
 yield:{ops:[{kind:'impatience',amount:-1}],text:'중재 · 상대 조급함 −1'},
 l_med:{ops:[{kind:'protect',amount:1,scope:'both'},{kind:'impatience',amount:-1},{kind:'audience',amount:-1}],text:'중재 · 양측 논거 보호, 조급함 −1, 청중의 의심 −1'},
 plan:{ops:[{kind:'argument',def:'a_plan'}],text:'중재 · 「대책 문서」 배치(조급함 억제, 창고 공개 조항)'},
 supplies:{ops:[{kind:'argument',def:'a_route'}],text:'중재 · 「보급 경로」 배치(안전 요구 −1)'},
 ration:{ops:[{kind:'impatience',amount:-2}],text:'중재 · 상대 조급함 −2'},
 s_xunyu:{ops:[{kind:'protect',amount:1,scope:'all'},{kind:'expose'}],text:'순욱 지원 · 내 모든 논거 보호 +1, 숨은 논거 공개'},
 s_lusu:{ops:[{kind:'exact'},{kind:'impatience',amount:-1}],text:'노숙 지원 · 의도 수치 공개, 조급함 −1'},
};
for(const [id,f] of Object.entries(FIELD)){const c=DEBATE_CARDS[id];if(!c)continue;c.effects=[...c.effects,effect('논박진',f.ops)];c.fieldText=f.text;for(const u of Object.values(c.upgrades??{}))u.effects=[...u.effects,effect('논박진',f.ops)];}
export const FIELD_FAMILY:Record<string,'정론'|'압박'|'계책'|'중재'>={honor:'정론',information:'정론',pressure:'압박',scheme:'계책',trust:'중재',profit:'중재'};
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
