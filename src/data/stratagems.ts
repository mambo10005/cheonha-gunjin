/**
 * 거병 책략 8종. 자원 +1류 효과는 없고, 카드 순서와 표식을 바꾸는 규칙만 둔다.
 * 2칸 제한, 교체에는 준비 시간 1과 자금 1이 든다.
 */
export interface StratagemDefinition {id:string;name:string;text:string;tags:string[]}
export const STRATAGEM_SLOTS=2;
export const STRATAGEM_SWAP={time:1,funds:1};
export const STRATAGEMS:Record<string,StratagemDefinition>={
 relay_trust:{id:'relay_trust',name:'밀서와 인맥',text:'정보 카드 바로 다음 인맥 카드: 장애 +1·내부 협력 +1 (장소당 2회).',tags:['정보→인맥']},
 banner_march:{id:'banner_march',name:'민심의 진군',text:'지지가 있을 때 군사 카드: 지지 1을 소비해 기세 +2 (장소당 2회).',tags:['지지→군사']},
 heavy_burden:{id:'heavy_burden',name:'짐을 진 맹세',text:'부담 카드 사용 시 부담 1을 소비해 보급 +1·약속 +1 (장소당 2회). 부담 카드가 없으면 아무 일도 없습니다.',tags:['부담 사용']},
 many_hands:{id:'many_hands',name:'여러 손의 일',text:'소유 인재가 다른 카드를 연달아 쓰면 장애 +1 (장소당 2회).',tags:['서로 다른 인재']},
 oath_policy:{id:'oath_policy',name:'약속의 제도화',text:'약속 2를 보유한 채 명분 카드를 쓰면 약속 2를 소비해 거병 후 정책 1건으로 기록하고 지지 +1 (전체 2회).',tags:['약속→정책']},
 burn_bridge:{id:'burn_bridge',name:'소진의 결단',text:'소멸 카드를 쓰면 카드 1장을 뽑습니다 (장소당 2회).',tags:['소멸→드로우']},
 open_flag:{id:'open_flag',name:'공개 기치',text:'결단 카드: 경계 +1을 감수하고 장애 +2 (장소당 2회). 노출을 비용으로 강한 효과.',tags:['노출 비용']},
 ledger_net:{id:'ledger_net',name:'장부의 그물',text:'조사 카드가 장부를 1 소비해 단서 +2·내부 협력 +1 (장소당 2회).',tags:['장부→단서']},
};
