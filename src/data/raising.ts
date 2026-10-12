import {PERSONAL_CARDS} from './personnel.ts';
import type {RaisingFamily,RaisingOperation,RaisingEffect,RaisingOrigin} from '../core/raising-types.ts';
export const FAMILY_NAMES:Record<RaisingFamily,string>={cause:'명분',network:'인맥',funds:'군자금',supply:'군량·물자',military:'군사',intel:'정보·계책',promise:'약속'};
export const resource=(field:Extract<RaisingOperation,{kind:'resource'}>['field'],amount:number):RaisingOperation=>({kind:'resource',field,amount});
export const effect=(source:string,operations:RaisingOperation[],condition?:RaisingEffect['condition'],timing:RaisingEffect['timing']='play'):RaisingEffect=>({source,operations,condition,timing,limit:1,priority:10});
interface Fate {kind:'consume'|'admin'|'combat'|'debate'|'policy'|'obligation';id?:string;text:string}
export interface RaisingCardDef {discovery?:boolean;id:string;name:string;family:RaisingFamily;cost:number;text:string;effects:RaisingEffect[];exhaust?:boolean;burden?:boolean;owner?:string;fate:Fate;debate?:string;tactic?:'brace'|'feint'|'breathe'|'sacrifice';upgrades:Record<'bold'|'quiet',{text:string;effects:RaisingEffect[];exhaust?:boolean}>}
const consume:Fate={kind:'consume',text:'준비 기록으로 남고 추가 자원 지급 없이 소모'};
const fate=(kind:Fate['kind'],id:string,text:string):Fate=>({kind,id,text});
function card(id:string,name:string,family:RaisingFamily,cost:number,text:string,ops:RaisingOperation[],extra:Partial<RaisingCardDef>={}):RaisingCardDef {
 const es=extra.effects??[effect(name,ops)];return {id,name,family,cost,text,effects:es,fate:consume,
 upgrades:{bold:{text:'광포: 기본 효과 후 지지 +2·노출 +2',effects:[...es,effect('광포', [resource('support',2),resource('exposure',2)])]},quiet:{text:'정론: 기본 효과 후 명분 +1·정보 +1, 노출 −1',effects:[...es,effect('정론',[resource('legitimacy',1),resource('intel',1),resource('exposure',-1)])]}},...extra};
}
const defs:RaisingCardDef[]=[
 // 공용 12
 card('manifesto','격문 배포','cause',1,'명분 +2·지지 +1·노출 +1',[resource('legitimacy',2),resource('support',1),resource('exposure',1)],{debate:'petition',fate:fate('debate','petition','설전 권한 문서 1장')}),
 card('food','곡물 매입','supply',1,'자금 1 → 군량 4·노출 +1',[resource('funds',-1),resource('food',4),resource('exposure',1)],{exhaust:true,upgrades:{bold:{text:'대량: 자금 2 → 군량 7·노출 +2',effects:[effect('대량',[resource('funds',-2),resource('food',7),resource('exposure',2)])]},quiet:{exhaust:false,text:'분산: 자금 1 → 군량 3·노출 증가 없음·소멸하지 않음',effects:[effect('분산',[resource('funds',-1),resource('food',3)])]}},fate:fate('admin','survey','내정 창고 감찰 1장')}),
 card('help','향촌 대표','network',1,'지지 +2·인맥 +1',[resource('support',2),resource('influence',1)],{debate:'bond',fate:fate('admin','mediation','내정 향촌 중재 1장')}),
 card('coin','사재 출연','funds',1,'자금 +3',[resource('funds',3)]),
 card('clues','수비 교대 조사','intel',1,'정보 +2·다음 경로 공개',[resource('intel',2),{kind:'reveal',amount:1}],{debate:'inspect',tactic:'feint'}),
 card('raise','의용군 모집','military',1,'군량 1 → 병력 7·노출 +1',[resource('food',-1),resource('troops',7),resource('exposure',1)],{fate:fate('combat','readied','전투 반격 태세 1장'),tactic:'brace'}),
 card('train','빈 군영 훈련','military',1,'병력 +2·훈련 +1',[resource('troops',2),resource('training',1)],{tactic:'breathe',fate:fate('admin','militia','내정 향병 조직 1장')}),
 card('hide','비밀 연락','intel',1,'노출 −2·정보 +1',[resource('exposure',-2),resource('intel',1)],{exhaust:true,debate:'inspect'}),
 card('pledge','주민 보호 서약','promise',1,'지지 +2·명분 +2, 향촌 자치 의무',[resource('support',2),resource('legitimacy',2),{kind:'pledge',id:'autonomy'}],{exhaust:true,debate:'bond',fate:fate('obligation','autonomy','도시 향촌 자치 약속·정산 의무')}),
 card('wagon','곡물 수레','supply',1,'군량 +3·정보 +1',[resource('food',3),resource('intel',1)],{fate:fate('combat','order','전투 군령 1장'),debate:'supplies'}),
 card('register','유민 명부','cause',1,'지지 +1·명분 +1, 카드 1장',[resource('support',1),resource('legitimacy',1),{kind:'draw',amount:1}],{fate:fate('admin','register','내정 유민 등록 1장')}),
 card('patrol','야간 순찰','military',1,'병력 +3·노출 −1',[resource('troops',3),resource('exposure',-1)],{fate:fate('admin','patrol','내정 야간 순찰 1장'),tactic:'brace'}),
 // 계열 18
 card('recommend','인망의 추천','cause',1,'명분 +3·인맥 +1',[resource('legitimacy',3),resource('influence',1)],{debate:'grounds'}),
 card('redress','실정 공개','cause',1,'명분 +4·노출 +2',[resource('legitimacy',4),resource('exposure',2)],{debate:'petition'}),
 card('order','질서 회복','cause',1,'명분 +2·지지 +2',[resource('legitimacy',2),resource('support',2)],{fate:fate('policy','granary','시작 도시 구휼 창고 정책'),debate:'redress'}),
 card('contact','역참 관리','network',1,'인맥 +2·정보 +1',[resource('influence',2),resource('intel',1)],{effects:[effect('역참 관리',[resource('influence',2),resource('intel',1)]),effect('서신 중계',[{kind:'generate',card:'hide'}],{previous:'intel'})],fate:fate('admin','road','내정 역참망 복구 1장')}),
 card('clerk','구관료 소개','network',1,'인맥 +2·명분 +1',[resource('influence',2),resource('legitimacy',1)],{debate:'petition',fate:fate('policy','relay','관청 기록 정책 후보')}),
 card('captain','향병 지도자','network',1,'인맥 +1·병력 +4',[resource('influence',1),resource('troops',4)],{tactic:'breathe'}),
 card('loan','상단 차입','funds',0,'자금 +4·부채 +2·노출 +1',[resource('funds',4),resource('debt',2),resource('exposure',1)],{exhaust:true,fate:fate('obligation','debt','세력 상단 채무로 이미 기록됨'),debate:'plan'}),
 card('fund','공동 기금','funds',1,'자금 +2·지지 +1',[resource('funds',2),resource('support',1)],{debate:'bond'}),
 card('loot','전리품 처분','funds',1,'자금 +4·지지 −1·노출 +2',[resource('funds',4),resource('support',-1),resource('exposure',2)],{exhaust:true}),
 card('cache','공동 창고','supply',1,'군량 +4·지지 +1',[resource('food',4),resource('support',1)],{fate:fate('admin','survey','내정 창고 감찰 1장')}),
 card('weapons','병기 배분','supply',1,'자금 1 → 훈련 +2·병력 +3',[resource('funds',-1),resource('training',2),resource('troops',3)],{tactic:'sacrifice',fate:fate('combat','spear','전투 창격 1장')}),
 card('medicine','치료 물자','supply',1,'군량 +2·노출 −1, 준비력 +1',[resource('food',2),resource('exposure',-1),{kind:'power',amount:1}],{exhaust:true,tactic:'breathe'}),
 card('gate','성문 확보','military',1,'병력 +4·정보 +1·노출 +2',[resource('troops',4),resource('intel',1),resource('exposure',2)],{fate:fate('combat','ambush','전투 매복 1장'),tactic:'feint'}),
 card('drill','군영 구령','military',1,'훈련 +2·병력 +2',[resource('training',2),resource('troops',2)],{tactic:'brace',fate:fate('combat','readied','전투 반격 태세 1장')}),
 card('defection','수비대 포섭','military',1,'인맥 +1·병력 +5·노출 +1',[resource('influence',1),resource('troops',5),resource('exposure',1)],{debate:'bridge'}),
 card('tunnel','비밀 통로','intel',1,'정보 +3·노출 −1',[resource('intel',3),resource('exposure',-1)],{tactic:'feint',debate:'bridge'}),
 card('split','반대 세력 분리','intel',1,'정보 +1·인맥 +2',[resource('intel',1),resource('influence',2)],{debate:'answer'}),
 card('authority','관리 유임 약정','promise',0,'명분 +3·인맥 +2, 권한 의무',[resource('legitimacy',3),resource('influence',2),{kind:'pledge',id:'authority'}],{exhaust:true,debate:'authority',fate:fate('obligation','authority','도시 권한 공유 약속')}),
 // 대표 고유 6
 card('c_ledger','진궁의 조건 장부','promise',1,'명분 +2·지지 +1, 서약 논거',[resource('legitimacy',2),resource('support',1)],{owner:'chengong',debate:'redress'}),
 card('c_turn','진궁의 불리함 전환','intel',1,'정보 +2. 직전 약속이면 준비력 +1',[resource('intel',2)],{owner:'chengong',effects:[effect('불리함 전환',[resource('intel',2)]),effect('약속 → 계책',[{kind:'power',amount:1}],{previous:'promise'})],debate:'bridge'}),
 card('z_command','장료의 군영 명령','military',1,'병력 +6·훈련 +1·노출 +1',[resource('troops',6),resource('training',1),resource('exposure',1)],{owner:'zhangliao',tactic:'brace',fate:fate('combat','order','전투 군령 1장')}),
 card('z_rally','장료의 결집','supply',1,'군량 +3. 직전 군사면 지지 +2',[resource('food',3)],{owner:'zhangliao',effects:[effect('결집',[resource('food',3)]),effect('군사 → 물자',[resource('support',2)],{previous:'military'})],tactic:'sacrifice'}),
 card('g_read','곽가의 서신망','intel',0,'정보 +2·다음 노드 공개, 사용 후 소멸',[resource('intel',2),{kind:'reveal',amount:1}],{owner:'guojia',exhaust:true,debate:'inspect'}),
 card('g_door','곽가의 내응 설계','network',1,'인맥 +2. 직전 정보면 명분 +2',[resource('influence',2)],{owner:'guojia',effects:[effect('내응 설계',[resource('influence',2)]),effect('정보 → 인맥',[resource('legitimacy',2)],{previous:'intel'})],tactic:'feint',debate:'bridge'}),
 // 첫 협력 인재의 전용 카드 12 (공통 카드와 교체해 덱 성격을 바꾼다)
 card('x_document','문서 정리','cause',1,'장부 표식 2',[resource('legitimacy',1)],{discovery:true,debate:'x_doc'}),
 card('x_orthodox','정론 제기','cause',1,'장부 1 소비 시 장애 +1·공론 +1',[resource('legitimacy',1)],{discovery:true,debate:'x_orth'}),
 card('x_guard_args','논거 보호','network',1,'공론 1·경계 −1',[resource('exposure',-1)],{discovery:true,debate:'x_guard'}),
 card('x_refine','부담 정제','cause',1,'부담 1 소비 시 공론 2·장애 +1, 사용 후 소멸',[resource('legitimacy',1)],{discovery:true,exhaust:true,debate:'redress'}),
 card('d_guard','방비 태세','military',1,'방비 2·경계 −1',[resource('troops',1)],{discovery:true,tactic:'brace',debate:'assurance',fate:{kind:'combat',id:'wall',text:'전투 방벽 1장'}}),
 card('d_momentum','기세 돋우기','military',1,'기세 2, 직전 준비면 기세 +1',[resource('training',1)],{discovery:true,tactic:'breathe'}),
 card('d_counter','반격','military',1,'방비 1 소비 시 장애 +2·기세 +1',[resource('troops',1)],{discovery:true,tactic:'brace',fate:{kind:'combat',id:'counterstrike',text:'전투 반격 1장'}}),
 card('d_direct','직접 해결','military',1,'장애 2·경계 +1, 기세 2 소비 시 장애 +2',[resource('troops',1),resource('exposure',1)],{discovery:true,tactic:'sacrifice'}),
 card('l_trade','거래 주선','funds',1,'장부 1·약속 1',[resource('funds',1)],{discovery:true,debate:'plan'}),
 card('l_ledger','장부 대조','intel',1,'장부 1·단서 1, 장부 1 소비 시 단서 2·내부 협력 1',[resource('intel',1)],{discovery:true,debate:'l_audit'}),
 card('l_convert','비용 전환','funds',1,'경계 1 소비 시 내부 협력 1·장애 +1',[resource('exposure',-1)],{discovery:true,debate:'yield'}),
 card('l_mediate','중재','network',1,'내부 협력 1 소비 시 장애 +2·지지 1',[resource('influence',1)],{discovery:true,debate:'l_med'}),
 // 부담 4
 card('poverty','빈 장부','funds',1,'자금 +1, 준비력 대비 낮은 효과',[resource('funds',1)],{burden:true}),
 card('rumor','근거 없는 소문','intel',1,'정보 +1·노출 +2',[resource('intel',1),resource('exposure',2)],{burden:true}),
 card('debt_note','후원 청구서','promise',1,'노출 −1·부채 +1',[resource('exposure',-1),resource('debt',1)],{burden:true}),
 card('fatigue','흩어진 향병','military',1,'병력 +1·지지 −1',[resource('troops',1),resource('support',-1)],{burden:true}),
];
export const RAISING_CARDS=Object.fromEntries([...defs,...Object.values(PERSONAL_CARDS).map(d=>card(d.id,d.name,d.family,d.cost,d.text,d.ops,{discovery:true,debate:d.debate,tactic:d.family==='military'?'brace':'feint',fate:{kind:'consume',text:'개인 보관함 유지 · 활동별 편성과 소유 인재의 배치 필요'}}))].map(d=>[d.id,d]));
export const ORIGINS:Record<RaisingOrigin,{name:string;cards:string[];burden:string;family:RaisingFamily}>={notable:{name:'재야 명사',cards:['recommend','pledge'],burden:'poverty',family:'cause'},militia:{name:'향촌 의용군 지도자',cards:['raise','train'],burden:'fatigue',family:'military'},official:{name:'지방 관리',cards:['clerk','authority'],burden:'rumor',family:'intel'}};
export const REPRESENTATIVES:Record<string,{name:string;cards:string[];principle:RaisingEffect}>={chengong:{name:'진궁 · 신망과 조건',cards:['c_ledger','c_turn'],principle:effect('조건의 책임',[resource('legitimacy',1)],{family:'promise'},'after')},zhangliao:{name:'장료 · 결단과 군사',cards:['z_command','z_rally'],principle:effect('장료의 결단',[resource('training',1),resource('exposure',1)],{family:'military'},'after')},guojia:{name:'곽가 · 정보와 내응',cards:['g_read','g_door'],principle:effect('선견의 연결',[{kind:'reveal',amount:1}],{family:'intel'},'after')}};
export const SCHEMES:Record<string,{name:string;text:string;rare?:boolean;rule:RaisingEffect}>={
 people:{name:'민심 규합',text:'서로 다른 명분→인맥 순서: 지지 +2, 단계 1회',rule:effect('민심 규합',[resource('support',2)],{previous:'cause',family:'network'},'after')},
 shadow:{name:'장부 외 자금',text:'첫 군자금: 자금 +2·부채 +1',rule:effect('장부 외 자금',[resource('funds',2),resource('debt',1)],{family:'funds'},'after')},
 oath:{name:'의용군 맹약',text:'군량→군사: 병력 +4·훈련 +1, 단계 1회',rule:effect('의용군 맹약',[resource('troops',4),resource('training',1)],{previous:'supply',family:'military'},'after')},
 door:{name:'내응의 문',text:'정보→인맥: 다음 관청 경로 공개·정보 +2',rule:effect('내응의 문',[{kind:'reveal',amount:2},resource('intel',2)],{previous:'intel',family:'network'},'after')},
 letters:{name:'격문의 연환',text:'서로 다른 명분 카드 연속: 최종 설전 집중 +1, 단계 1회',rule:effect('격문의 연환',[{kind:'discount',amount:1}],{previous:'cause',family:'cause',different:true},'after')},
 camp:{name:'빈 군영 장악',text:'대결에서 처음 기세를 소비하면 기세 1 회복, 대결 1회',rule:effect('빈 군영 장악',[{kind:'refundMomentum',amount:1}],undefined,'duel')},
 relay:{name:'비밀 역참망',rare:true,text:'정보→물자: 카드 2장·노출 −2',rule:effect('비밀 역참망',[{kind:'draw',amount:2},resource('exposure',-2)],{previous:'intel',family:'supply'},'after')},
 unity:{name:'공동 기치',rare:true,text:'약속→인맥: 준비력 +1·지지 +2, 단계 1회',rule:effect('공동 기치',[{kind:'power',amount:1},resource('support',2)],{previous:'promise',family:'network'},'after')},
};
export const ALLIES:Record<string,{name:string;role:string;card:string;officer?:string;regional?:boolean;rule:RaisingEffect;debt?:number}>={
 scholar:{name:'곽가의 문객',role:'설전 보좌·정보',card:'clues',officer:'guojia',rule:effect('문객 조언',[resource('legitimacy',1)],{family:'intel'},'after')},
 guard:{name:'전위의 호위대',role:'대결 대리·군사',card:'drill',officer:'dianwei',rule:effect('호위 지원',[resource('training',1)],{family:'supply'},'after')},
 envoy:{name:'정보의 문객',role:'인맥·내응',card:'split',officer:'local_scribe',rule:effect('밀서 전달',[resource('intel',1)],{family:'network'},'after')},
 logistics:{name:'정포의 물류 연락',role:'보급·행정',card:'wagon',officer:'chengpu',rule:effect('물류 지원',[resource('food',1)],{family:'funds'},'after')},
 elder:{name:'향촌 대표단',role:'지역 지원·주민 관계',card:'help',regional:true,rule:effect('향촌 협력',[resource('support',1)],{family:'cause'},'after')},
 sponsor:{name:'상단 출자자',role:'후원·채무',card:'loan',regional:true,debt:2,rule:effect('계약 후원',[resource('funds',1)],{family:'supply'},'after')},
};
export interface RaisingNodeDef {name:string;story:string;families:RaisingFamily[];risk:number;need:number;rewardFamily:RaisingFamily;ally:string;elite?:boolean;rest?:boolean;choices:{name:string;text:string;effects:RaisingOperation[];progress:number}[]}
function node(name:string,story:string,families:RaisingFamily[],risk:number,rewardFamily:RaisingFamily,ally:string,extra:Partial<RaisingNodeDef>={}):RaisingNodeDef{return {name,story,families,risk,need:2,rewardFamily,ally,choices:[{name:'신중한 접촉',text:'노출 −1, 진행 +2',effects:[resource('exposure',-1)],progress:2},{name:'공개 협력',text:'자금 1·노출 +1, 진행 +2',effects:[resource('funds',-1),resource('exposure',1)],progress:2}],...extra};}
export const NODES:Record<string,RaisingNodeDef>={
 village:node('향촌 회합','주민은 보호 약속과 곡물 분배를 요구합니다.',['cause','promise','supply','network'],0,'cause','elder'),
 market:node('시장','출자자는 실제 곡물과 신용을 비교합니다.',['funds','supply','intel'],1,'funds','sponsor'),
 inn:node('객사','문객은 추천서와 서신을 기다립니다.',['network','cause','intel'],0,'network','scholar'),
 barracks:node('병영','훈련 없이 지휘권을 주장하면 반발합니다.',['military','supply','intel'],2,'military','guard'),
 manor:node('장원','향촌과 군역 제한 조건을 조율합니다.',['promise','network','funds'],1,'promise','elder'),
 office:node('관청','문서 보존과 관리의 권한을 보장해야 합니다.',['cause','promise','intel','network'],2,'cause','envoy'),
 store:node('창고','곡물 재고를 장부와 호위로 확보합니다.',['supply','funds','military'],1,'supply','logistics'),
 letters:node('비밀 서신망','정보 뒤 연락책을 연결하면 다음 길이 보입니다.',['intel','network','funds'],1,'intel','envoy'),
 bandits:node('도적 소굴 · 정예','무기와 전리품이 있으나 수비대가 추적합니다.',['military','intel','supply'],3,'military','guard',{elite:true,need:3}),
 council:node('호족 회합 · 정예','세 집단의 권한을 나누는 어려운 회합입니다.',['cause','network','promise'],3,'promise','scholar',{elite:true,need:3}),
 camp:node('빈 군영 · 정제','약한 카드를 버리거나 장비를 개조합니다.',['military','supply','funds'],0,'military','guard',{rest:true}),
 ferry:node('나루·역참 · 휴식','출진 전 군량과 서신을 분산합니다.',['supply','intel','network'],0,'supply','logistics',{rest:true}),
};
// Each place has a distinct paid decision in addition to its cautious contact.
const decisions:Record<string,{name:string;text:string;effects:RaisingOperation[]}>= {
 village:{name:'보호 협약',text:'군량 1 지급 → 지지 +2, 향촌 자치 의무',effects:[resource('food',-1),resource('support',2),{kind:'pledge',id:'autonomy'}]},
 market:{name:'상단 출자 수락',text:'자금 +3·채무 +2·노출 +1',effects:[resource('funds',3),resource('debt',2),resource('exposure',1)]},
 inn:{name:'추천서 교환',text:'자금 1 → 인맥 +2·명분 +1',effects:[resource('funds',-1),resource('influence',2),resource('legitimacy',1)]},
 barracks:{name:'공개 군영 훈련',text:'군량 2 → 병력 +4·훈련 +1·노출 +2',effects:[resource('food',-2),resource('troops',4),resource('training',1),resource('exposure',2)]},
 manor:{name:'향촌 자치 보장',text:'지지 +2·명분 +1, 자치 의무',effects:[resource('support',2),resource('legitimacy',1),{kind:'pledge',id:'autonomy'}]},
 office:{name:'관리 유임 합의',text:'인맥 +2·명분 +2, 권한 공유 의무',effects:[resource('influence',2),resource('legitimacy',2),{kind:'pledge',id:'authority'}]},
 store:{name:'분산 곡물 계약',text:'자금 2 → 군량 +5·정보 +1',effects:[resource('funds',-2),resource('food',5),resource('intel',1)]},
 letters:{name:'밀서 확보',text:'자금 1 → 정보 +3·노출 +1',effects:[resource('funds',-1),resource('intel',3),resource('exposure',1)]},
 bandits:{name:'도적 무기 접수',text:'병력 2 희생 → 자금 +3·훈련 +2·노출 +2',effects:[resource('troops',-2),resource('funds',3),resource('training',2),resource('exposure',2)]},
 council:{name:'권한 분담 조약',text:'명분 +3·인맥 +1, 권한 의무·노출 +1',effects:[resource('legitimacy',3),resource('influence',1),{kind:'pledge',id:'authority'},resource('exposure',1)]},
 camp:{name:'군영 정비',text:'자금 1 → 훈련 +2·노출 −1',effects:[resource('funds',-1),resource('training',2),resource('exposure',-1)]},
 ferry:{name:'호송 물자 보충',text:'자금 1 → 군량 +3·노출 −2',effects:[resource('funds',-1),resource('food',3),resource('exposure',-2)]},
};
for(const [id,decision] of Object.entries(decisions))NODES[id].choices[1]={...decision,text:decision.text+' · 진행 +3',progress:3};
export const PLANS={assembly:{name:'민회와 격문',text:'향촌/관리와 설전. 명분·지지가 요구 난도를 낮춥니다.',opponent:'elder',mode:'debate',training:false},barracks:{name:'군영 장악',text:'군영 대표와 대결. 훈련·병기·호위가 기세와 전술을 바꿉니다.',opponent:'champion',mode:'duel',training:true},inside:{name:'성문 내응',text:'관청 설전 후 필요하면 관문 대결. 정보·인맥으로 지원을 분리합니다.',opponent:'scholar',mode:'both',training:true}} as const;
