/**
 * 주요 인재 4명의 덱 운용 원칙과 성장 분기.
 * 원칙은 인재가 동행(참여)할 때만 작동하며, 성장은 카드 추가·강화·교체·원칙 변화 중 하나를 고른다.
 */
export interface TalentDefinition {
 id:string;name:string;theme:string;role:string;unique:[string,string];support:string;joint:string[];
 principle:{name:string;text:string};alt:{name:string;text:string};
 growth:{add:{card:string;text:string};upgrade:{card:string;branch:'bold'|'quiet';text:string};replace:{from:string;to:string;text:string};principle:{text:string}};
 branches:{expert:string;authority:string};
}
export const TALENTS:Record<string,TalentDefinition>={
 xunyu:{id:'xunyu',name:'순욱',theme:'명분·문서·설전',role:'role_network_a',unique:['person_xunyu_a','person_xunyu_b'],support:'support_xunyu',joint:['joint_records'],
  principle:{name:'공론의 인선',text:'소유자가 다른 카드를 연달아 쓰면 공론 +1 (장소당 3회). 서로 다른 인재가 함께 일할수록 공론이 쌓입니다.'},
  alt:{name:'인선의 저울',text:'공론을 소비할 때마다 지지 +1 (장소당 3회). 공론을 지지로 바꾸는 운용으로 전환됩니다.'},
  growth:{add:{card:'person_xunyu_b',text:'다른 고유 카드 「공론의 장부」를 보관함에 추가'},upgrade:{card:'person_xunyu_a',branch:'quiet',text:'「왕좌의 인선」 정밀 강화'},replace:{from:'role_network_a',to:'role_network_b',text:'역할 카드를 「명망의 협력」(공론 2, 장부 소비 시 장애 +1)으로 교체'},principle:{text:'원칙을 「인선의 저울」로 변경'}},
  branches:{expert:'문서 검증',authority:'공론 주도'}},
 dianwei:{id:'dianwei',name:'전위',theme:'군사·방비·대결',role:'role_military_a',unique:['person_dianwei_a','person_dianwei_b'],support:'support_dianwei',joint:['joint_feint'],
  principle:{name:'선봉 호위',text:'군사 카드가 기세를 만들면 기세 +1 (장소당 3회). 전위가 동행하면 사건 경계 한도 +1.'},
  alt:{name:'호위의 철칙',text:'기세를 소비할 때마다 경계 −1 (장소당 3회). 공격보다 노출 관리에 집중합니다.'},
  growth:{add:{card:'person_dianwei_b',text:'다른 고유 카드 「퇴로의 호위」를 보관함에 추가'},upgrade:{card:'person_dianwei_a',branch:'bold',text:'「철위의 결집」 강행 강화'},replace:{from:'role_military_a',to:'role_military_b',text:'역할 카드를 경계 없는 「훈련된 협력」(기세 2)으로 교체'},principle:{text:'원칙을 「호위의 철칙」으로 변경'}},
  branches:{expert:'호위 숙련',authority:'군영 장악'}},
 lusu:{id:'lusu',name:'노숙',theme:'정보·인맥·계책',role:'role_intel_a',unique:['person_lusu_a','person_lusu_b'],support:'support_lusu',joint:['joint_feint','joint_terms'],
  principle:{name:'양측의 계산',text:'정보 카드 바로 다음 인맥·계책 카드는 내부 협력 +1 (장소당 2회). 거래 카드는 경계를 만들지 않습니다.'},
  alt:{name:'중재의 장부',text:'약속을 소비할 때마다 장부 +1 (장소당 2회). 약속을 근거 문서로 바꿉니다.'},
  growth:{add:{card:'person_lusu_b',text:'다른 고유 카드 「이면의 약정」을 보관함에 추가'},upgrade:{card:'person_lusu_a',branch:'quiet',text:'「양측의 계산」 정밀 강화'},replace:{from:'role_intel_a',to:'role_intel_b',text:'역할 카드를 「정보의 협력」(단서 1 → 내부 협력 1·장애 +1)으로 교체'},principle:{text:'원칙을 「중재의 장부」로 변경'}},
  branches:{expert:'정보망',authority:'협정 주도'}},
 chengpu:{id:'chengpu',name:'정보',theme:'물자·부담 활용',role:'role_supply_a',unique:['person_chengpu_a','person_chengpu_b'],support:'support_chengpu',joint:['joint_supply'],
  principle:{name:'분산 보급',text:'부담 카드를 쓰면 보급 +1·준비력 +1 (장소당 1회). 보급이 3 이상이면 카드가 만드는 경계를 막습니다.'},
  alt:{name:'노장의 셈',text:'보급을 2 이상 소비할 때 카드 1장 (장소당 2회).'},
  growth:{add:{card:'person_chengpu_b',text:'다른 고유 카드 「분산 군량망」을 보관함에 추가'},upgrade:{card:'person_chengpu_a',branch:'quiet',text:'「노장의 호송」 정밀 강화'},replace:{from:'role_supply_a',to:'role_supply_b',text:'역할 카드를 「물류의 협력」(보급 1·장부 1)으로 교체'},principle:{text:'원칙을 「노장의 셈」으로 변경'}},
  branches:{expert:'호송 숙련',authority:'보급 주도'}},
};
