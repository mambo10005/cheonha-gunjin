/**
 * 무장 대결 덱 카드(대결 2판의 행동 6계열을 카드로 전환) · 상대 원형별 대결 덱 · 인재 지원.
 * 카드마다 produces/consumes/followup/stanceRequirement/distanceRequirement/reaction을 데이터로 둔다.
 */
export type Dist='near'|'mid'|'far';
export type Stance='offense'|'defense'|'lure';
export type DuelFamily='간보기'|'보법'|'공세'|'수세'|'유인'|'승부수'|'지원'|'부담';
export type DuelMark='read'|'opening'|'momentum'|'guard'|'oppOpening'|'distance'|'stance';
export interface DuelCardDef {
 id:string; name:string; family:DuelFamily; cost:number; text:string;
 distanceRequirement?:Dist[]; stanceRequirement?:Stance[]; momentumRequirement?:number;
 /** 즉시 효과 */
 damage?:{near?:number;mid?:number;far?:number}; guardDamage?:number; pierce?:boolean;
 guard?:number; momentum?:number; move?:'in'|'out'; stance?:Stance; reveal?:number; draw?:number; heal?:number; fatigue?:number;
 removeSupport?:number; clean?:'opening'; consumeMomentum?:number|'all'; momentumScale?:number;
 /** 상대 행동에 대한 반응(합 끝에 상대 의도가 실행될 때) */
 reaction?:'parry'|'counter'|'lure'|'second'|'evade'; reactionValue?:number;
 produces:DuelMark[]; consumes:DuelMark[]; followup?:string; exhaust?:boolean; limited?:boolean;
}
const C=(d:DuelCardDef)=>d;
export const DUEL_CARDS:Record<string,DuelCardDef>=Object.fromEntries([
 // 간보기: 다음 상대 행동 공개·숨은 반응 확인·빈틈 조건 준비·카드 탐색
 C({id:'probe',name:'간을 보다',family:'간보기',cost:1,text:'상대 다음 행동 2개 공개, 숨긴 의도 확인. 근·중거리면 피해 2. 상대 지원 카드 1장 제거. 기세 +1.',damage:{near:2,mid:2},reveal:2,momentum:1,removeSupport:1,produces:['read','momentum'],consumes:[],followup:'읽은 공격에 「한 걸음 내주기」·「받아 흘리기」'}),
 C({id:'scan',name:'허실 살피기',family:'간보기',cost:0,text:'카드 1장 뽑기, 숨긴 의도 확인.',draw:1,reveal:1,produces:['read'],consumes:[]}),
 // 보법: 거리 변경·회피·접근 방해·위치 우위
 C({id:'step_in',name:'거리 좁히기',family:'보법',cost:1,text:'거리 한 단계 좁힘. 기세 +1.',move:'in',momentum:1,produces:['distance','momentum'],consumes:[],followup:'근거리 「베기」·「파고들기」'}),
 C({id:'step_out',name:'한 걸음 내주기',family:'보법',cost:1,text:'거리 한 단계 벌림, 방비 +2. 공격을 읽었으면(간보기) 방비 +4 대신 회피 준비.',move:'out',guard:2,reaction:'evade',reactionValue:2,produces:['distance','guard'],consumes:['read'],followup:'「수세 전환」 → 「받아 흘리기」'}),
 // 수세: 방비·피해 경감·반격 준비·자세 고정
 C({id:'stance_def',name:'수세 전환',family:'수세',cost:0,text:'자세를 수세로. 방비 +2.',stance:'defense',guard:2,produces:['stance','guard'],consumes:[]}),
 C({id:'parry',name:'받아 흘리기',family:'수세',cost:1,text:'수세 필요. 방비 +3. 이번 합 상대 공격을 모두 막으면 빈틈과 반격 3.',stanceRequirement:['defense'],guard:3,reaction:'parry',reactionValue:3,produces:['guard','opening'],consumes:['stance'],followup:'다음 합 「거리 좁히기」 → 「파고들기」'}),
 // 공세: 피해·방비 파괴·기세 생성·자세 압박
 C({id:'strike',name:'베기',family:'공세',cost:1,text:'근거리 5·중거리 4(공세 자세 +2). 원거리 불가. 기세 +1.',distanceRequirement:['near','mid'],damage:{near:5,mid:4},momentum:1,produces:['momentum'],consumes:[]}),
 C({id:'stance_off',name:'공세 전환',family:'공세',cost:0,text:'자세를 공세로. 기세 +1. 공세 자세에서 「베기」 +2.',stance:'offense',momentum:1,produces:['stance','momentum'],consumes:[]}),
 C({id:'break',name:'방비 깨기',family:'공세',cost:1,text:'공세 자세·근/중거리. 상대 방비에 6, 방비를 0으로 만들면 상대 자세가 무너짐(상대 빈틈). 기세 +1.',distanceRequirement:['near','mid'],stanceRequirement:['offense'],guardDamage:6,momentum:1,produces:['oppOpening','momentum'],consumes:['stance'],followup:'「파고들기」로 깔끔한 제압'}),
 // 유인: 상대 행동 강제·피해 감수 빈틈·자세 변경·기세 교환
 C({id:'lure',name:'허점 보이기',family:'유인',cost:1,text:'자세를 유인으로. 상대가 공격하면 피해 절반·근거리로 끌어들이고 빈틈, 상대 기세 1을 빼앗음. 상대가 공격하지 않으면 공격을 끌어냄(상대 기세 1 이상).',stance:'lure',reaction:'lure',produces:['opening','distance'],consumes:[]}),
 // 승부수: 기세·빈틈 소비·강한 제압·과잉 무력·피로/부상 위험
 C({id:'finisher',name:'파고들기',family:'승부수',cost:2,text:'근거리·기세 2 소비. 빈틈(내 빈틈 또는 상대 자세 무너짐)이 있으면 12 깔끔한 제압(방비 무시). 없으면 8이고 상대 공격을 맞받아 반격 4. 피로 +1.',distanceRequirement:['near'],momentumRequirement:2,consumeMomentum:2,damage:{near:8},clean:'opening',fatigue:1,produces:[],consumes:['opening','oppOpening','momentum']}),
 // 대결 전술 3장(선제·대응·승부수) → 카드
 C({id:'t_read',name:'수읽기',family:'간보기',cost:0,text:'선제 전술. 상대 행동 3개 공개, 이번 대결 첫 피해 −3.',reveal:3,produces:['read'],consumes:[],exhaust:true}),
 C({id:'t_press',name:'선제 돌격',family:'공세',cost:1,text:'선제 전술. 거리 좁힘, 피해 3, 기세 +2.',move:'in',damage:{near:3,mid:3,far:3},momentum:2,produces:['momentum','distance'],consumes:[],exhaust:true}),
 C({id:'t_shield',name:'방비 진형',family:'수세',cost:1,text:'선제 전술. 방비 +5, 다음 합까지 유지.',guard:5,produces:['guard'],consumes:[],exhaust:true}),
 C({id:'t_second',name:'보좌 개입',family:'수세',cost:0,text:'대응 전술. 이번 대결에서 쓰러질 피해를 한 번 체력 1로 버팀.',reaction:'second',produces:[],consumes:[],exhaust:true}),
 C({id:'t_counter',name:'반격 태세',family:'수세',cost:1,text:'대응 전술. 방비 +2. 이번 합 상대 공격을 모두 막으면 반격 5(+준비한 반격).',guard:2,reaction:'counter',reactionValue:5,produces:['guard'],consumes:[],exhaust:true}),
 C({id:'t_ration',name:'보급 회복',family:'수세',cost:1,text:'대응 전술. 체력 6 회복, 피로 −1.',heal:6,fatigue:-1,produces:[],consumes:[],exhaust:true}),
 C({id:'t_all_in',name:'결사 일격',family:'승부수',cost:2,text:'승부수 전술. 근거리·기세 2. 기세를 모두 써서 4+기세×3(빈틈 +4). 빈틈 없이 쓰면 반격 6, 과잉 무력 위험. 피로 +1.',distanceRequirement:['near'],momentumRequirement:2,consumeMomentum:'all',momentumScale:3,damage:{near:4},clean:'opening',fatigue:1,produces:[],consumes:['momentum','opening'],exhaust:true}),
 C({id:'t_expose',name:'허점 폭로',family:'간보기',cost:1,text:'승부수 전술. 상대 지원 카드 모두 제거, 상대 방비 0(방비가 있었으면 상대 자세 무너짐), 피해 2.',removeSupport:9,guardDamage:99,damage:{near:2,mid:2,far:2},produces:['oppOpening'],consumes:[],exhaust:true}),
 C({id:'t_oath',name:'맹약의 증언',family:'승부수',cost:1,text:'승부수 전술. 체력 5 회복, 기세 +2.',heal:5,momentum:2,produces:['momentum'],consumes:[],exhaust:true}),
 // 인재 지원(대결당 1회, 실제 참여할 때만)
 C({id:'s_dianwei',name:'철위의 결집',family:'지원',cost:0,text:'전위 지원. 방비 +3, 기세 +1, 자세를 수세로.',guard:3,momentum:1,stance:'defense',produces:['guard','momentum'],consumes:[],exhaust:true,limited:true}),
 C({id:'s_xunyu',name:'정식 조건',family:'지원',cost:0,text:'순욱 지원. 이번 대결의 무승부를 한 등급 높게 인정받는 정식 조건을 확정. 공격 보너스 없음.',produces:[],consumes:[],exhaust:true,limited:true}),
 C({id:'s_lusu',name:'계산된 양보',family:'지원',cost:0,text:'노숙 지원. 상대 기세 −2, 방비 +2.',guard:2,produces:['guard'],consumes:[],exhaust:true,limited:true}),
 C({id:'s_guojia',name:'기미',family:'지원',cost:0,text:'곽가 지원. 상대 행동 3개 공개.',reveal:3,produces:['read'],consumes:[],exhaust:true,limited:true}),
 C({id:'counter_strike',name:'맞받아치기',family:'공세',cost:0,text:'전위 원칙으로 생성. 피해 4, 방비 무시. 사용 후 소멸.',damage:{near:4,mid:4},pierce:true,produces:[],consumes:[],exhaust:true}),
 // 부상·피로가 넣는 부담 카드
 C({id:'pain',name:'욱신거리는 상처',family:'부담',cost:1,text:'부상. 쓰면 소멸할 뿐 효과가 없습니다. 손에 남으면 전술력을 묶습니다.',produces:[],consumes:[],exhaust:true}),
].map(c=>[c.id,c]));
/** 기본 대결 덱 8장(누구나). 전술 3장·인재 지원 1장·전환 카드가 더해져 9~12장. */
export const DUEL_BASE_DECK=['probe','step_in','step_out','stance_def','parry','strike','stance_off','finisher'];
/** 활동 덱에서 가장 많은 계열 → 기본 덱에 더해지는 기존 행동의 변형 1장(덱 12장 상한 안에서만). */
export const DUEL_FAMILY_CARD:Record<string,{add:string;text:string}>={
 military:{add:'break',text:'군사 카드가 많음 → 「방비 깨기」'},
 intel:{add:'scan',text:'정보 카드가 많음 → 「허실 살피기」'},
 network:{add:'lure',text:'인맥 카드가 많음 → 「허점 보이기」'},
 cause:{add:'lure',text:'명분 카드가 많음 → 「허점 보이기」'},
 supply:{add:'scan',text:'물자 카드가 많음 → 「허실 살피기」'},
 funds:{add:'scan',text:'자금 카드가 많음 → 「허실 살피기」'},
 promise:{add:'lure',text:'약속 카드가 많음 → 「허점 보이기」'},
};
export const TACTIC_CARD:Record<string,string>={read:'t_read',press:'t_press',shield:'t_shield',second:'t_second',counter:'t_counter',ration:'t_ration',all_in:'t_all_in',expose:'t_expose',oath:'t_oath'};
export const DUEL_SUPPORT:Record<string,{principle:string;card:string}>={
 dianwei:{principle:'철위: 처음 상대 방비를 깨거나 받아 흘리기에 성공하면 「맞받아치기」 카드 생성',card:'s_dianwei'},
 guojia:{principle:'선견: 매 합 상대 첫 카드 유형 공개(숨긴 의도 무효)',card:'s_guojia'},
 xunyu:{principle:'정식 절차: 합 제한 +1',card:'s_xunyu'},
 lusu:{principle:'계산된 계약: 계약·보상 대결에서 패배해도 조건부 인정',card:'s_lusu'},
};

// ── 상대 대결 덱 ──
export type OppKind='attack'|'rush'|'jab'|'guard'|'counter'|'feint'|'step'|'recover'|'build'|'finisher'|'support'|'command'|'watch';
export interface OppCardDef {id:string;name:string;kind:OppKind;text:string}
export const OPP_CARDS:Record<string,OppCardDef>=Object.fromEntries(([
 {id:'o_strike',name:'강공',kind:'attack',text:'근·중거리 공격(위력). 원거리면 중거리로 뛰어들며 −2.'},
 {id:'o_rush',name:'돌진',kind:'rush',text:'거리를 한 단계 좁힌 뒤 공격 4.'},
 {id:'o_jab',name:'견제',kind:'jab',text:'근·중거리 공격 3. 내 빈틈을 닫음. 상대 기세 +1.'},
 {id:'o_guard',name:'방비',kind:'guard',text:'상대 방비 +5.'},
 {id:'o_counter',name:'반격 태세',kind:'counter',text:'이번 합에 내가 공세·승부수 카드를 쓸 때마다 반격 3. 합 끝에 상대 방비 +2.'},
 {id:'o_feint',name:'속임수',kind:'feint',text:'공격 2, 다음 합에 내 수세 카드를 봉쇄. 간보기로 읽었으면 실패.'},
 {id:'o_step',name:'거리 벌리기',kind:'step',text:'거리를 벌리고 상대 방비 +2.'},
 {id:'o_recover',name:'숨 고르기',kind:'recover',text:'상대 체력 3 회복, 방비 +3.'},
 {id:'o_build',name:'기세 모으기',kind:'build',text:'상대 기세 +2. 다음 공격 +2.'},
 {id:'o_finisher',name:'필살',kind:'finisher',text:'상대 기세 2·근/중거리: 공격 11. 조건이 안 되면 기세 모으기.'},
 {id:'o_support',name:'병사 지원',kind:'support',text:'둘러선 병사가 거든다: 상대 방비 +3, 내 기세 −1.'},
 {id:'o_command',name:'지휘',kind:'command',text:'상대 기세 +1, 버린 병사 지원을 다시 불러옴.'},
 {id:'o_watch',name:'감시',kind:'watch',text:'공격 2, 다음 상대 의도를 숨김.'},
] as OppCardDef[]).map(c=>[c.id,c]));
export interface DuelArchetype {id:string;name:string;text:string;weak:string;deck:string[];growGuard?:number}
export const DUEL_ARCHETYPES:Record<string,DuelArchetype>={
 assault:{id:'assault',name:'맹공형',text:'접근해 강공을 거듭하고 기세가 높습니다.',weak:'수세·유인에 취약',deck:['o_strike','o_strike','o_strike','o_rush','o_build','o_finisher','o_jab']},
 counter:{id:'counter',name:'반격형',text:'방비와 반격 태세로 무리한 연속 공격을 처벌합니다.',weak:'간보기와 보법에 취약',deck:['o_guard','o_guard','o_counter','o_counter','o_strike','o_jab','o_finisher']},
 trick:{id:'trick',name:'기교형',text:'거리를 바꾸고 속임수로 카드를 봉쇄합니다.',weak:'정보와 예측에 취약',deck:['o_feint','o_feint','o_step','o_jab','o_jab','o_strike','o_watch']},
 endure:{id:'endure',name:'지구형',text:'수세와 회복으로 버티며 합이 지날수록 방비가 쌓입니다.',weak:'빠른 방비 파괴 필요',deck:['o_guard','o_guard','o_recover','o_recover','o_strike','o_build','o_finisher'],growGuard:1},
 command:{id:'command',name:'지휘형',text:'둘러선 병사의 지원과 지휘권으로 싸웁니다. 설전·내부 협력으로 지원 카드를 걷어낼 수 있습니다.',weak:'지원 제거·방비 반격',deck:['o_strike','o_strike','o_command','o_guard','o_finisher']},
};
/** 사건 목표 → 상대 원형. */
export const OBJECTIVE_ARCHETYPE:Record<string,string>={practice:'counter',escort_captain:'assault',barracks_gate:'command',inside_gate:'endure'};
