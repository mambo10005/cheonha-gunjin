import type {AdminFamily,AdminRole,CityBuild,CityId,DistrictId,Metric} from '../core/city-types.ts';
import {CITY_EXPLORATION_DEFS} from './city-exploration.ts';
import type {CityExplorationDefinition} from '../core/city-exploration-types.ts';
export const METRICS:Record<Metric,string>={life:'민생',order:'안정',security:'치안',production:'생산'};
export const DISTRICTS:Record<DistrictId,string>={hall:'관청',market:'시장',farms:'농지',store:'창고',barracks:'병영',gate:'성문'};
export const ROLES:Record<AdminRole,string>={civil:'민생·기록',logistics:'교역·보급',guard:'치안·군사'};
export const BUILDS:Record<CityBuild,string>={settlement:'정착·구휼',trade:'교역·물류',military:'군사 거점'};
export interface CityDefinition {name:string;type:string;terrain:string;metrics:Record<Metric,number>;food:number;materials:number;people:number;readiness:number;build:CityBuild;card:string;encounter:string;exploration:CityExplorationDefinition;}
export const CITY_DEFS:Record<CityId,CityDefinition>={
 xingyang:{exploration:CITY_EXPLORATION_DEFS.xingyang,name:'형양',type:'평야·농업 회랑',terrain:'평야',metrics:{life:42,order:38,security:40,production:44},food:14,materials:8,people:9,readiness:15,build:'settlement',card:'settle',encounter:'city_xingyang'},
 chenggao:{exploration:CITY_EXPLORATION_DEFS.chenggao,name:'성고',type:'관문·군사 물류',terrain:'관문',metrics:{life:33,order:42,security:48,production:32},food:11,materials:10,people:8,readiness:30,build:'military',card:'militia',encounter:'city_chenggao'},
 gong:{exploration:CITY_EXPLORATION_DEFS.gong,name:'공현',type:'하천·교역 회랑',terrain:'하천',metrics:{life:38,order:40,security:32,production:48},food:12,materials:12,people:8,readiness:12,build:'trade',card:'permit',encounter:'city_gong'},
};
export const ADMIN_GENERALS:Record<string,{identity:string;role:AdminRole;card:string;strength:string;weakness:string}>={
 xunyu:{identity:'인선·공론',role:'civil',card:'register',strength:'개인 카드의 주민·기록 효과.',weakness:'군단 카드와 동시 사용 불가.'},
 lusu:{identity:'중재·통상',role:'logistics',card:'mediation',strength:'개인 카드의 중재 효과.',weakness:'군단 카드와 동시 사용 불가.'},
 local_broker:{identity:'나루·교역',role:'logistics',card:'permit',strength:'개인 카드의 교역 효과.',weakness:'직접 군사 효과 없음.'},
 local_captain:{identity:'향병·훈련 (창작)',role:'guard',card:'militia',strength:'군사 명령 군량 1 → 군사 준비 +3. 전열 시작 방비 +4.',weakness:'군사 업무에 식량 소비.'},
 local_scribe:{identity:'서신·장부 (창작)',role:'civil',card:'archives',strength:'기록 뒤 다음 명령 비용 −1. 후열 시작 카드 +1.',weakness:'군사·직접 생산 효과 없음.'},
 dianwei:{identity:'호위·수성',role:'guard',card:'wall',strength:'성문 보수와 전열 반격에 특화.',weakness:'도시에서 군사 외 고유 추가 효과 없음.'},
 caoren:{identity:'치안·수성',role:'guard',card:'patrol',strength:'순찰과 방비 유지 역할.',weakness:'민생·생산 추가 효과 없음.'},
 chengong:{identity:'제도·정제',role:'civil',card:'reform',strength:'기록 명령 뒤 다음 명령 비용 −1. 제도·덱 정제에 강함.',weakness:'즉각 구휼과 생산 보너스 없음.'},
 chengpu:{identity:'구휼·신뢰',role:'civil',card:'mediation',strength:'구휼·외교 명령에 민생 +3, 주민 관계 +1.',weakness:'위기 회복에 도시 식량을 사용. 군사 준비가 느림.'},
 zhangliao:{identity:'실리·동원',role:'guard',card:'mobilize',strength:'군사·토목 명령에 준비 +5, 자재 +1.',weakness:'동원마다 민생 −2, 피로가 쌓임.'},
 guojia:{identity:'정보·예측',role:'logistics',card:'forecast',strength:'정보 명령 후 카드 +1. 미래 현안과 위협을 상세 공개.',weakness:'생산량을 직접 올리지 않음.'},
};
export type CityField=Metric|'food'|'materials'|'people'|'readiness';
export interface CityEffect {field:CityField;amount:number;}
export interface AdminDef {name:string;family:AdminFamily;district:DistrictId;role:AdminRole;cost:number;food?:number;materials?:number;people?:number;text:string;effects:CityEffect[];draw?:number;project?:string;resolve?:string[];exhaust?:boolean;}
export const ADMIN_CARDS:Record<string,AdminDef>={
 relief:{name:'창고 개방',family:'relief',district:'store',role:'civil',cost:1,food:3,text:'식량 3 → 민생 +8·안정 +3. 기근·유민 현안 진전.',effects:[{field:'life',amount:8},{field:'order',amount:3}],resolve:['famine','refugees']},
 register:{name:'유민 등록',family:'records',district:'hall',role:'civil',cost:1,text:'인력 +3, 민생 −3. 정착 시설이 있으면 부담 면제.',effects:[{field:'people',amount:3},{field:'life',amount:-3}],resolve:['refugees']},
 sow:{name:'농지 개간',family:'farm',district:'farms',role:'civil',cost:1,people:1,text:'인력 1 → 생산 +7, 식량 +2. 토목 뒤 공역 장부 연계.',effects:[{field:'production',amount:7},{field:'food',amount:2}]},
 patrol:{name:'야간 순찰',family:'security',district:'gate',role:'guard',cost:1,text:'치안 +8. 잔당·부패 현안 진전.',effects:[{field:'security',amount:8}],resolve:['remnants','corruption']},
 permit:{name:'상단 통행 허가',family:'trade',district:'market',role:'logistics',cost:1,text:'자재 +3, 상단 관계 +1. 독점 현안 진전.',effects:[{field:'materials',amount:3}],resolve:['monopoly']},
 militia:{name:'향병 조직',family:'military',district:'barracks',role:'guard',cost:1,people:2,text:'인력 2 → 군사 준비 +10, 민생 −4. 주민 신뢰 2 이상이면 부담 −1.',effects:[{field:'readiness',amount:10},{field:'life',amount:-4}],resolve:['remnants']},
 canal:{name:'수로 복구',family:'works',district:'farms',role:'civil',cost:2,materials:2,text:'자재 2 → 수로 사업 +1/3. 완공 시 생산 +10·홍수 해결.',effects:[],project:'canal'},
 wall:{name:'성문 보수',family:'works',district:'gate',role:'guard',cost:2,materials:2,text:'자재 2 → 성문 사업 +1/3. 완공 시 준비 +12·성문 피해 복구.',effects:[],project:'wall'},
 road:{name:'역참망 복구',family:'works',district:'market',role:'logistics',cost:2,materials:2,text:'자재 2 → 역참 사업 +1/3. 완공 시 보급로 상태 +1·상단 관계 +1.',effects:[],project:'road'},
 survey:{name:'창고 감찰',family:'intel',district:'store',role:'logistics',cost:1,text:'치안 +4, 카드 1장. 기근·부패 진전.',effects:[{field:'security',amount:4}],draw:1,resolve:['famine','corruption']},
 settle:{name:'주거 정비',family:'relief',district:'hall',role:'civil',cost:1,materials:1,text:'자재 1 → 민생 +6·안정 +5. 유민 현안 진전.',effects:[{field:'life',amount:6},{field:'order',amount:5}],resolve:['refugees']},
 accord:{name:'향촌 조정',family:'diplomacy',district:'hall',role:'logistics',cost:1,text:'안정 +6, 주민 관계 +1. 잔당·독점 현안 진전.',effects:[{field:'order',amount:6}],resolve:['remnants','monopoly']},
 reform:{name:'행정 정제',family:'records',district:'hall',role:'civil',cost:1,text:'진궁 고유. 안정 +4, 카드 +1, 다음 명령 비용 −1.',effects:[{field:'order',amount:4}],draw:1},
 mediation:{name:'향촌 중재',family:'relief',district:'hall',role:'civil',cost:1,food:1,text:'정보 장수 고유. 민생 +7·안정 +5. 현안 진전.',effects:[{field:'life',amount:7},{field:'order',amount:5}],resolve:['refugees','famine']},
 mobilize:{name:'긴급 동원',family:'military',district:'barracks',role:'guard',cost:1,text:'장료 고유. 준비 +8·자재 +3, 민생 −5.',effects:[{field:'readiness',amount:8},{field:'materials',amount:3},{field:'life',amount:-5}],resolve:['remnants']},
 forecast:{name:'현안 예측',family:'intel',district:'hall',role:'logistics',cost:0,text:'곽가 고유. 카드 2장, 진행 중 현안 하나 진전. 단계당 장수 임무 1회.',effects:[],draw:2},
 cargo:{name:'호송 수레',family:'trade',district:'store',role:'logistics',cost:1,materials:1,text:'식량 +3. 상단 협정이 있으면 +2 추가. 사용 후 소멸.',effects:[{field:'food',amount:3}],exhaust:true},
 charter:{name:'공동 운영 문서',family:'records',district:'hall',role:'civil',cost:1,text:'안정 +5. 공동 운영 점령 방식 카드, 주민 관계 +1.',effects:[{field:'order',amount:5}]},
 levy:{name:'군창 징발',family:'military',district:'store',role:'guard',cost:1,text:'식량 +4·준비 +3, 안정 −4. 군사 접수의 대가.',effects:[{field:'food',amount:4},{field:'readiness',amount:3},{field:'order',amount:-4}]},
 archives:{name:'정리된 장부',family:'records',district:'hall',role:'civil',cost:1,text:'문서고 생성 카드. 카드 +1·치안 +3. 사용 후 소멸.',effects:[{field:'security',amount:3}],draw:1,exhaust:true},
 medicine:{name:'진료 지원',family:'relief',district:'hall',role:'civil',cost:1,text:'의원 생성 카드. 민생 +6. 사용 후 소멸.',effects:[{field:'life',amount:6}],resolve:['famine','refugees'],exhaust:true},
};
export const POLICY_DEFS:Record<string,{name:string;role:AdminRole;cost:number;effects:CityEffect[];text:string;build:CityBuild}>={
 settlement:{name:'유민 정착',role:'civil',cost:1,effects:[{field:'life',amount:3},{field:'people',amount:1},{field:'food',amount:-1}],text:'정산: 민생 +3·인력 +1, 식량 −1. 주거 정비와 연계.',build:'settlement'},
 granary:{name:'구휼 창고',role:'civil',cost:1,effects:[{field:'order',amount:3},{field:'food',amount:-1}],text:'정산: 안정 +3, 식량 −1. 구휼 명령의 현안 진전 +1.',build:'settlement'},
 merchants:{name:'상단 보호',role:'logistics',cost:1,effects:[{field:'materials',amount:2},{field:'security',amount:-1}],text:'정산: 자재 +2, 치안 −1. 호송 수레 카드 강화.',build:'trade'},
 relay:{name:'역참 정비',role:'logistics',cost:1,effects:[{field:'food',amount:2},{field:'materials',amount:-1}],text:'정산: 식량 +2, 자재 −1. 물류 시설 연계, 도로 운송량 +2.',build:'trade'},
 curfew:{name:'야간 통금',role:'guard',cost:1,effects:[{field:'security',amount:4},{field:'production',amount:-1}],text:'정산: 치안 +4, 생산 −1. 순찰 명령 준비 +3.',build:'military'},
 training:{name:'향병 훈련',role:'guard',cost:1,effects:[{field:'readiness',amount:4},{field:'people',amount:-1}],text:'정산: 준비 +4, 인력 −1. 훈련장과 방어 연계.',build:'military'},
};
export const SEAL_DEFS:Record<string,{name:string;text:string}>={
 works:{name:'공역 장부',text:'토목 → 농정: 생산 +4·공사 +1, 민생 −1. 단계당 1회.'},
 harmony:{name:'향약',text:'서로 다른 구휼·외교 계열을 잇기: 안정 +5. 단계당 1회.'},
 army:{name:'군창 연계',text:'식량 8 이상에서 군사: 식량 +1·준비 +3, 생산 −1. 단계당 1회.'},
 audit:{name:'청렴 감찰',text:'비용 절감 발동 시 치안 +3, 상단 관계 −1. 단계당 1회.'},
};
export const FACILITY_DEFS:Record<string,{name:string;district:DistrictId;cost:number;build:CityBuild;effects:CityEffect[];card?:string;text:string}>={
 housing:{name:'유민 거처',district:'hall',cost:3,build:'settlement',effects:[{field:'life',amount:2}],text:'정산 민생 +2, 유민 등록 부담 면제.'},
 clinic:{name:'의원',district:'hall',cost:3,build:'settlement',effects:[],card:'medicine',text:'매 단계 임시 진료 지원 카드 생성.'},
 granary:{name:'공동 창고',district:'store',cost:3,build:'settlement',effects:[{field:'food',amount:2}],text:'정산 식량 +2. 구휼 정책과 함께 안정 +2.'},
 farm:{name:'둔전소',district:'farms',cost:3,build:'settlement',effects:[{field:'food',amount:3}],text:'정산 식량 +3. 개간 뒤 식량 +2.'},
 inn:{name:'상단 객사',district:'market',cost:3,build:'trade',effects:[{field:'materials',amount:2}],card:'cargo',text:'정산 자재 +2, 호송 수레 생성. 상단 보호와 생산 +3.'},
 relay:{name:'역참',district:'gate',cost:3,build:'trade',effects:[{field:'food',amount:1}],text:'정산 식량 +1. 역참 정책과 운송량 +2.'},
 training:{name:'향병 훈련장',district:'barracks',cost:3,build:'military',effects:[{field:'readiness',amount:3}],text:'정산 준비 +3. 향병 정책과 치안 +2.'},
 archives:{name:'문서고',district:'hall',cost:3,build:'trade',effects:[],card:'archives',text:'정리된 장부 생성. 다음 현안과 위협의 수치 공개.'},
};
export const ISSUE_DEFS:Record<string,{name:string;families:AdminFamily[];effects:CityEffect[];reward:CityEffect[];group:'locals'|'traders'|'refugees';text:string}>={
 famine:{name:'군량 부족',families:['relief','intel'],effects:[{field:'life',amount:-10},{field:'people',amount:-2}],reward:[{field:'order',amount:4}],group:'locals',text:'구휼·감찰로 2회 진전. 실패 시 민생 −10·인력 −2.'},
 refugees:{name:'유민 유입',families:['records','relief'],effects:[{field:'life',amount:-8},{field:'order',amount:-5}],reward:[{field:'people',amount:2}],group:'refugees',text:'등록·주거·중재로 2회 진전. 실패 시 민생 −8·안정 −5.'},
 remnants:{name:'잔당 잠복',families:['security','military','diplomacy','intel'],effects:[{field:'security',amount:-10},{field:'materials',amount:-3}],reward:[{field:'readiness',amount:4}],group:'locals',text:'순찰·동원·향촌 조정 또는 설전. 실패 시 치안 −10·자재 −3, 위협 +5.'},
 monopoly:{name:'시장 독점',families:['trade','diplomacy'],effects:[{field:'production',amount:-8},{field:'order',amount:-4}],reward:[{field:'materials',amount:3}],group:'traders',text:'통행 허가·조정 또는 설전. 실패 시 생산 −8·안정 −4.'},
 corruption:{name:'관리 부패',families:['intel','security','records'],effects:[{field:'food',amount:-4},{field:'order',amount:-6}],reward:[{field:'security',amount:4}],group:'locals',text:'정보·치안·기록으로 2회 진전. 실패 시 식량 −4·안정 −6.'},
 ledger_carry:{name:'장부 이월',families:['records','trade','intel'],effects:[{field:'order',amount:-6},{field:'production',amount:-4}],reward:[{field:'materials',amount:3},{field:'order',amount:3}],group:'traders',text:'거병 전 부담 장부를 도시 현안으로 넘김. 기록·거래·정보로 2회 진전하면 자재 +3·안정 +3. 실패 시 안정 −6·생산 −4.'},
 flood:{name:'농지 침수',families:['works','farm'],effects:[{field:'production',amount:-10},{field:'food',amount:-4}],reward:[{field:'food',amount:3}],group:'refugees',text:'농정·토목 또는 수로 완공. 실패 시 생산 −10·식량 −4.'},
};
export const PROJECT_DEFS:Record<string,{name:string;district:DistrictId;effects:CityEffect[];text:string}>={
 canal:{name:'수로 복구',district:'farms',effects:[{field:'production',amount:10}],text:'3회 진행. 완공: 생산 +10·홍수 현안 해결. 각 정산에 인력 1로 진행, 방치 2회면 민생 −2.'},
 wall:{name:'성문 복구',district:'gate',effects:[{field:'readiness',amount:12}],text:'3회 진행. 완공: 준비 +12·성문 피해 복구.'},
 road:{name:'역참망 복구',district:'market',effects:[{field:'production',amount:4}],text:'3회 진행. 완공: 도로 상태 +1·상단 관계 +1.'},
};

