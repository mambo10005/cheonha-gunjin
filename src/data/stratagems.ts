/**
 * 거병 책략 8종. 자원 +1류 효과는 없고, 카드 순서와 표식을 바꾸는 규칙만 둔다.
 * 2칸 제한, 교체에는 준비 시간 1과 자금 1이 든다.
 */
export interface StratagemDefinition {id:string;name:string;text:string;tags:string[]}
export const STRATAGEM_SLOTS=2;
export const STRATAGEM_SWAP={time:1,funds:1};
export const STRATAGEMS:Record<string,StratagemDefinition>={
 relay_trust:{id:'relay_trust',name:'밀서와 인맥',text:'정보 카드 바로 다음 인맥·계책 카드: 장애 +1·내부 협력 +1 (장소당 2회).',tags:['정보→인맥']},
 banner_march:{id:'banner_march',name:'민심의 진군',text:'지지가 있을 때 군사 카드: 지지 1을 소비해 기세 +2 (장소당 2회).',tags:['지지→군사']},
 heavy_burden:{id:'heavy_burden',name:'짐을 진 맹세',text:'부담을 만드는 카드를 쓰면 그 부담 1 대신 보급 +1·약속 +1. 부담 카드였다면 이번 거병 동안 소멸합니다(장소당 2회). 부담 카드가 없으면 아무 일도 없습니다.',tags:['부담 사용']},
 many_hands:{id:'many_hands',name:'공론의 조항',text:'설득 카드가 표식을 소비하거나 후속 효과를 얻으면 장애 +1, 그 문장을 조항 초안 논거로 기록(장소당 2회·초안 최대 3). 조항 초안마다 설전 덱에 「조항 정리」가 들어갑니다.',tags:['논거·조항']},
 oath_policy:{id:'oath_policy',name:'약속의 제도화',text:'카드가 약속을 소비할 때마다 지지 +1(장소당 3회), 처음 2회는 거병 후 정책으로 기록.',tags:['약속→정책']},
 burn_bridge:{id:'burn_bridge',name:'소진의 결단',text:'소멸 카드나 부담 카드를 쓰면 카드 1장을 뽑습니다 (장소당 2회).',tags:['소멸→드로우']},
 open_flag:{id:'open_flag',name:'반격의 진형',text:'방비를 소비한 카드(열쇠 소비 포함): 장애 +1·기세 +1 (장소당 2회). 방비 → 반격 연쇄의 중심.',tags:['방비→반격']},
 ledger_net:{id:'ledger_net',name:'장부의 그물',text:'조사·거래 카드가 장부를 소비하면(카드 자체 소비 포함) 단서 +1·내부 협력 +1 (장소당 2회).',tags:['장부→단서']},
};
