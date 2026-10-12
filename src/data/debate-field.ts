/**
 * 논박진 데이터: 논거 정의, 상대 원형(시작 논거·숨은 논거·의도 덱·반응·부분 성공 조건), 의도 정의, 인재 지원.
 * 기존 설전 카드는 계열별로 논거를 놓고(정론)·때리고(압박)·드러내고 비틀고(계책)·지키고 달랜다(중재).
 */
import type {Axis} from '../core/accord-types.ts';
import type {IntentKind} from '../core/debate-field-types.ts';

export interface ArgumentDef {
 id:string; name:string; owner:'player'|'opponent'|'audience'|'hidden'; durability:number; tags:string[]; text:string;
 /** 연결 요구: 살아 있는 동안 요구 수치 변화(+는 상대가 요구를 올림). */
 need?:Partial<Record<Axis,number>>; burdenLimit?:number;
 /** 지속 효과 */
 trustPenalty?:number; costUp?:number; informal?:number; attackBonus?:number; pressureBonus?:number;
 firstSafety?:number; negateCost?:number; discountFamily?:string; roundImpatience?:number; roundScore?:[Axis,number];
 /** 연결 조항 */
 lockClause?:string[]; unlessTag?:string; openClause?:string[];
 danger?:boolean; evidence?:boolean;
 onPlace?:{trust?:number;reveal?:number};
 instant:{trust?:number;score?:[Axis,number];burden?:number;text:string};
 onDestroy?:{trust?:number;impatience?:number;audience?:string;needDown?:number;text:string};
 hiddenEffect?:{costUp?:number;attackBonus?:number;trustPenalty?:number;text:string};
 onExpose?:{coreDamage?:number;openClause?:string[];impatience?:number;durability?:number;text:string};
 /** 상대가 노릴 때의 우선순위 태그(대상 규칙)와 반응 설명. */
 targetRules?:string; reactions?:string; presentation:string;
}
const P=(id:string,name:string,durability:number,tags:string[],text:string,instant:ArgumentDef['instant'],extra:Partial<ArgumentDef>={}):ArgumentDef=>({id,name,owner:'player',durability,tags,text,instant,presentation:extra.presentation??'문서',...extra});
const O=(id:string,name:string,durability:number,tags:string[],text:string,extra:Partial<ArgumentDef>={}):ArgumentDef=>({id,name,owner:'opponent',durability,tags,text,instant:{text:''},presentation:'상대 주장',...extra});
export const ARGUMENT_DEFS:Record<string,ArgumentDef>=Object.fromEntries(([
 // ── 플레이어 핵심 입장 ──
 P('pc_records','추천서의 정당성',5,['core'],'핵심 입장. 무너지면 신뢰 −2, 완전 합의 불가.',{text:''},{presentation:'핵심 입장'}),
 P('pc_contract','공정한 호위 계약',5,['core'],'핵심 입장. 무너지면 신뢰 −2, 완전 합의 불가.',{text:''},{presentation:'핵심 입장'}),
 P('pc_uprising','백성을 위한 거병',6,['core'],'핵심 입장. 무너지면 신뢰 −2, 완전 합의 불가.',{text:''},{presentation:'핵심 입장'}),
 P('pc_gate','피 흘리지 않는 개방',6,['core'],'핵심 입장. 무너지면 신뢰 −2, 완전 합의 불가. 살아 있으면 후속 대결 시작 기세 +1.',{text:''},{presentation:'핵심 입장'}),
 P('pc_generic','이번 제안의 취지',5,['core'],'핵심 입장. 무너지면 신뢰 −2, 완전 합의 불가.',{text:''},{presentation:'핵심 입장'}),
 // ── 플레이어 보조 논거 (카드·탐색 성과·대결 결과) ──
 P('a_grounds','공적 근거',2,['evidence','doc'],'증거·문서. 살아 있으면 「문서 절차」 잠금을 풉니다.',{score:['honor',1],text:'즉시 명분 +1'},{evidence:true}),
 P('a_doc','정리된 문서',3,['evidence','doc'],'증거·문서. 라운드 첫 정론(명분) 카드 비용 −1. 문서 보존 조항 개방.',{score:['honor',1],trust:1,text:'즉시 명분 +1·신뢰 +1'},{evidence:true,discountFamily:'honor',openClause:['records']}),
 P('a_ledger','출입 장부',3,['evidence','doc','ledger'],'증거·문서. 계약 비용 증가를 한 번 무효화. 문서 보존·출입권 조항 개방.',{score:['profit',1],text:'즉시 이익 +1'},{evidence:true,negateCost:1,openClause:['records','access_pass']}),
 P('a_witness','짐꾼의 증언',2,['evidence','witness'],'증거·증인. 안전을 처음 올릴 때 +2. 상대가 먼저 노리며, 무너지면 청중의 의심이 생깁니다. 살아 있으면 주민 부담 제한에 약속이 필요 없습니다.',{score:['safety',1],text:'즉시 안전 +1'},{evidence:true,firstSafety:2,openClause:['levy_limit'],onDestroy:{audience:'au_doubt',text:'증인이 무너지자 청중이 의심합니다'},targetRules:'상단·관리가 먼저 노림'}),
 P('a_keeper','책임자의 증언',2,['evidence','witness'],'증거·증인. 놓을 때 신뢰 +1, 상대 의도 1개 더 공개.',{trust:1,text:'즉시 신뢰 +1'},{evidence:true,onPlace:{trust:1,reveal:1}}),
 P('a_records','구휼 장부 대조',3,['evidence','doc','ledger'],'증거·문서. 문서 보존 조항 개방.',{score:['honor',1],text:'즉시 명분 +1'},{evidence:true,openClause:['records']}),
 P('a_roster','피난민 명부 동의',2,['evidence','village'],'증거. 살아 있으면 향촌 측이 청중의 의심을 만들지 못합니다.',{score:['safety',1],text:'즉시 안전 +1'},{evidence:true}),
 P('a_letter','추천 서신',2,['evidence'],'증거. 살아 있으면 명분 요구 −1.',{score:['honor',1],text:'즉시 명분 +1'},{evidence:true,need:{honor:-1}}),
 P('a_seal','관인',3,['evidence','doc'],'증거·문서. 살아 있으면 권한 요구 −1.',{score:['authority',1],text:'즉시 권한 +1'},{evidence:true,need:{authority:-1}}),
 P('a_plan','대책 문서',2,['proposal'],'제안. 라운드 끝마다 상대 조급함 −1. 창고 공개 조항 개방.',{score:['profit',1],text:'즉시 이익 +1'},{roundImpatience:-1,openClause:['grain_open']}),
 P('a_route','보급 경로',2,['proposal','safety'],'제안. 살아 있으면 안전 요구 −1, 라운드 끝 안전 +1.',{score:['safety',1],text:'즉시 안전 +1'},{need:{safety:-1},roundScore:['safety',1]}),
 P('a_vouch','전위의 보증',3,['guarantee','pressure'],'군사 보증. 압박 카드 논박 피해 +1, 대신 압박 카드마다 부담 +1. 군사 측 핵심 공격 −1.',{trust:1,text:'즉시 신뢰 +1'},{pressureBonus:1,presentation:'보증'}),
 P('a_prestige','위신',2,['guarantee'],'대결로 얻은 인정. 군사 측 핵심 공격 −1.',{trust:1,text:'즉시 신뢰 +1'},{presentation:'보증'}),
 P('a_draft','조항 초안',2,['clause'],'공론의 조항 초안. 살아 있으면 지킬 약속으로 칩니다(주민 부담 제한).',{trust:1,text:'즉시 신뢰 +1'},{openClause:['levy_limit']}),
 P('a_turned','돌려쓴 조건',1,['scheme'],'상대 논거를 비틀어 얻은 조건. 살아 있으면 이익 요구 −1.',{score:['profit',1],text:'즉시 이익 +1'},{need:{profit:-1}}),
 P('a_generic','준비한 근거',2,['evidence'],'탐색에서 준비한 근거.',{trust:1,text:'즉시 신뢰 +1'},{evidence:true}),
 // ── 상대 핵심 주장 ──
 O('o_core_official','관청의 절차',6,['core','official'],'핵심 주장. 무너지면 요구가 모두 −1, 신뢰 +2.'),
 O('o_core_merchant','상단의 이익',6,['core','merchant'],'핵심 주장. 무너지면 요구가 모두 −1, 신뢰 +2.'),
 O('o_core_village','주민의 생업',6,['core','village'],'핵심 주장. 무너지면 요구가 모두 −1, 신뢰 +2.'),
 O('o_core_military','성문의 지휘권',5,['core','military'],'핵심 주장. 무너지면 요구가 모두 −1, 신뢰 +2. 무너뜨리면 후속 대결에서 상대 지휘 카드 제거.'),
 O('o_core_assembly','민회의 유보',7,['core','assembly'],'핵심 주장(복수 청중). 무너지면 요구가 모두 −1, 신뢰 +2.'),
 // ── 상대 보조 논거 ──
 O('o_authority','공식 권한',3,['official'],'관리형. 권한 요구 +1. 문서가 아닌 논거를 노리는 공격 +1.',{informal:1,danger:true,need:{authority:1},targetRules:'문서 아닌 논거'}),
 O('o_procedure','문서 절차',2,['official'],'관리형. 명분 요구 +1. 플레이어 문서 논거가 없으면 문서 보존·공동 통치 조항 잠금.',{need:{honor:1},lockClause:['records','shared_gov'],unlessTag:'doc'}),
 O('o_contract','기존 상단 계약',3,['merchant'],'상단형. 이익 요구 +1, 라운드 끝마다 이익 요구 +1(계약 비용 증가).',{costUp:1,danger:true,need:{profit:1}}),
 O('o_cost','비용 위험',2,['merchant'],'상단형. 압박 카드를 쓰면 부담 +1.',{reactions:'압박 → 부담 +1'}),
 O('o_safety','주민 안전',3,['village'],'향촌형. 안전 요구 +1.',{need:{safety:1},danger:true}),
 O('o_corvee','부역 우려',2,['village'],'향촌형. 부담 한도 −1.',{burdenLimit:-1,reactions:'압박 → 청중의 의심'}),
 O('o_command','지휘권',3,['military'],'군사형. 상대 공격 +1, 권한 요구 +1.',{attackBonus:1,danger:true,need:{authority:1}}),
 O('o_soldiers','병사 안전',2,['military'],'군사형. 안전 요구 +1. 무너뜨리면 후속 대결에서 병사 지원 1 제거.',{need:{safety:1}}),
 // ── 숨은 논거 ──
 {id:'h_clerk',name:'서리의 책임 회피',owner:'hidden',durability:2,tags:['official'],text:'숨은 이해관계. 숨어 있는 동안 신뢰 증가 −1. 공개되면 모순: 관청의 절차 −3.',instant:{text:''},hiddenEffect:{trustPenalty:1,text:'신뢰 증가 −1'},onExpose:{coreDamage:3,durability:1,text:'모순이 드러남 · 관청의 절차 −3'},presentation:'숨은 이해관계'},
 {id:'h_credit',name:'창고 외상',owner:'hidden',durability:2,tags:['merchant'],text:'숨은 이해관계. 숨어 있는 동안 계약 비용 +1 추가. 공개되면 상단 신용 조항 개방·조급함 −1.',instant:{text:''},hiddenEffect:{costUp:1,text:'라운드 끝 이익 요구 +1 추가'},onExpose:{openClause:['trade_credit'],impatience:-1,text:'외상이 드러남 · 상단 신용 조항 개방'},presentation:'숨은 이해관계'},
 {id:'h_levy',name:'징발의 기억',owner:'hidden',durability:2,tags:['village'],text:'숨은 이해관계. 숨어 있는 동안 신뢰 증가 −1. 공개되면 주민 부담 제한 조항이 약속 없이 열립니다.',instant:{text:''},hiddenEffect:{trustPenalty:1,text:'신뢰 증가 −1'},onExpose:{openClause:['levy_limit'],text:'징발의 기억이 드러남 · 주민 부담 제한 개방'},presentation:'숨은 이해관계'},
 {id:'h_order',name:'숨은 지시',owner:'hidden',durability:2,tags:['military'],text:'숨은 이해관계. 숨어 있는 동안 상대 공격 +1. 공개되면 후속 대결에서 상대 첫 의도 공개.',instant:{text:''},hiddenEffect:{attackBonus:1,text:'상대 공격 +1'},onExpose:{text:'숨은 지시가 드러남 · 후속 대결 첫 의도 공개'},presentation:'숨은 이해관계'},
 // ── 청중 논거 ──
 {id:'au_doubt',name:'청중의 의심',owner:'audience',durability:2,tags:['audience'],text:'청중. 신뢰 증가 −1. 남아 있으면 탁월한 합의 불가.',instant:{text:''},trustPenalty:1,presentation:'청중'},
 {id:'au_watch',name:'청중의 경계',owner:'audience',durability:2,tags:['audience'],text:'청중(대결의 과잉 무력). 압박 카드를 쓰면 청중의 의심이 생깁니다.',instant:{text:''},presentation:'청중'},
 {id:'au_injury',name:'부상 책임',owner:'audience',durability:2,tags:['audience'],text:'청중(대결 부상). 명분 요구 +1.',instant:{text:''},need:{honor:1},presentation:'청중'},
] as ArgumentDef[]).map(a=>[a.id,a]));

export interface IntentDef {id:string;kind:IntentKind;amount:number;target?:'informal'|'evidence'|'pressure'|'weakest'|'protected'|'newest';clause?:string;react?:string;hide?:string;concealed?:boolean;text:string}
export const INTENT_DEFS:Record<string,IntentDef>=Object.fromEntries(([
 {id:'off_lock',kind:'lock',amount:1,clause:'records',text:'조항 잠금 · 문서 보존'},
 {id:'off_informal',kind:'attack',amount:2,target:'informal',text:'비공식 논거 공격'},
 {id:'off_doubt',kind:'doubt',amount:1,text:'청중의 의심 생성'},
 {id:'off_weak',kind:'attack',amount:2,target:'weakest',text:'가장 약한 논거 공격'},
 {id:'off_hide',kind:'hide',amount:0,hide:'h_clerk',concealed:true,text:'숨은 주장 생성'},
 {id:'off_core',kind:'attackCore',amount:2,text:'핵심 입장 공격'},
 {id:'mer_cost',kind:'cost',amount:1,concealed:true,text:'계약 비용 증가'},
 {id:'mer_evidence',kind:'attack',amount:2,target:'evidence',text:'증인·증거 공격'},
 {id:'mer_burden',kind:'burden',amount:1,text:'부담 추가'},
 {id:'mer_react',kind:'react',amount:1,react:'pressure',text:'압박에 반응 · 부담 +1·조급함 +1'},
 {id:'mer_weak',kind:'attack',amount:3,target:'weakest',text:'가장 약한 논거 공격'},
 {id:'mer_hide',kind:'hide',amount:0,hide:'h_credit',concealed:true,text:'숨은 주장 생성'},
 {id:'vil_pressure',kind:'attack',amount:2,target:'pressure',text:'보증·압박 논거 공격'},
 {id:'vil_doubt',kind:'doubt',amount:1,text:'청중의 의심 생성'},
 {id:'vil_react',kind:'react',amount:1,react:'pressure',text:'압박에 반응 · 청중의 의심'},
 {id:'vil_shift',kind:'shift',amount:1,text:'논점 이동 · 안전'},
 {id:'vil_burden',kind:'burden',amount:1,text:'부담 추가'},
 {id:'vil_hide',kind:'hide',amount:0,hide:'h_levy',concealed:true,text:'숨은 주장 생성'},
 {id:'mil_core',kind:'attackCore',amount:1,text:'핵심 입장 공격'},
 {id:'mil_prep',kind:'attack',amount:3,target:'protected',text:'준비한 논거 공격(장기 준비 방해)'},
 {id:'mil_demand',kind:'demand',amount:2,text:'최종 답변 요구'},
 {id:'mil_react',kind:'react',amount:1,react:'scheme',text:'계책에 반응 · 핵심 입장 +1 피해'},
 {id:'mil_hide',kind:'hide',amount:0,hide:'h_order',concealed:true,text:'숨은 주장 생성'},
] as IntentDef[]).map(d=>[d.id,d]));

export interface DebateArchetype {id:string;name:string;text:string;core:string;supports:string[];hidden:string[];intents:string[];first:string;impatienceRound:number;impatienceLimit:number;roundsDelta:number;reacts:{family:string;effect:'burden'|'doubt'|'core';text:string}[];partial:string;clauses:string[]}
export const DEBATE_ARCHETYPES:Record<string,DebateArchetype>={
 official:{id:'official',name:'관리형',text:'공식 권한과 문서 절차로 비공식 주장을 깎고, 문서가 없으면 조항을 잠급니다. 모순이 드러나면 빠르게 무너집니다.',core:'o_core_official',supports:['o_authority','o_procedure'],hidden:['h_clerk'],intents:['off_informal','off_doubt','off_weak','off_hide','off_core'],first:'off_lock',impatienceRound:0,impatienceLimit:6,roundsDelta:0,reacts:[],partial:'문서 논거가 하나라도 살아 있거나 「문서 절차」를 무너뜨려야 조건부 합의',clauses:['records','levy_limit']},
 merchant:{id:'merchant',name:'상단형',text:'기존 계약으로 라운드마다 비용을 올리고, 증인을 먼저 노립니다. 거래·장부·신뢰에 반응하고 강한 압박에는 부담을 얹습니다.',core:'o_core_merchant',supports:['o_contract','o_cost'],hidden:['h_credit'],intents:['mer_evidence','mer_burden','mer_react','mer_weak','mer_hide'],first:'mer_cost',impatienceRound:1,impatienceLimit:6,roundsDelta:0,reacts:[{family:'pressure',effect:'burden',text:'압박 → 부담 +1'}],partial:'이익 요구를 채웠거나 「기존 상단 계약」을 무너뜨려야 조건부 합의',clauses:['trade_credit','grain_open','access_pass','levy_limit']},
 village:{id:'village',name:'향촌형',text:'주민 안전과 부역 우려를 앞세웁니다. 약속·신뢰·중재에 반응하고, 강압하면 청중의 의심이 커집니다.',core:'o_core_village',supports:['o_safety','o_corvee'],hidden:['h_levy'],intents:['vil_doubt','vil_pressure','vil_react','vil_burden','vil_hide'],first:'vil_shift',impatienceRound:0,impatienceLimit:7,roundsDelta:0,reacts:[{family:'pressure',effect:'doubt',text:'압박 → 청중의 의심'}],partial:'안전 요구를 채우고 압박 3 미만이어야 조건부 합의',clauses:['levy_limit','shared_gov']},
 military:{id:'military',name:'군사형',text:'지휘권과 병사 안전을 내세우고 짧게 끝내려 합니다. 위신·보증에 반응하고 오래 준비한 논거를 노립니다. 결과는 후속 대결로 바로 이어집니다.',core:'o_core_military',supports:['o_command','o_soldiers'],hidden:['h_order'],intents:['mil_prep','mil_demand','mil_react','mil_core','mil_hide'],first:'mil_core',impatienceRound:1,impatienceLimit:5,roundsDelta:-1,reacts:[{family:'scheme',effect:'core',text:'계책 → 핵심 입장 피해 +1'}],partial:'핵심 입장이 살아 있어야 조건부 합의',clauses:['access_pass','levy_limit']},
 assembly:{id:'assembly',name:'민회(복수 청중)',text:'향촌 대표와 관리 대표(상단 측이 남아 있으면 상단도)가 함께 앉습니다. 같은 인재 카드를 이으면 사적 이해, 다른 인재를 이으면 공론이 쌓입니다.',core:'o_core_assembly',supports:['o_safety','o_procedure'],hidden:['h_levy'],intents:['vil_doubt','off_informal','vil_react','off_lock','vil_pressure','off_hide'],first:'vil_shift',impatienceRound:0,impatienceLimit:7,roundsDelta:0,reacts:[{family:'pressure',effect:'doubt',text:'압박 → 청중의 의심'}],partial:'청중의 의심이 1개 이하여야 조건부 합의',clauses:['shared_gov','records','levy_limit','grain_open']},
};
/** 설전 맥락 → 원형·핵심 입장. */
export const DEBATE_CONTEXTS:Record<string,{archetype:string;core:string;title:string}>={
 inn_documents:{archetype:'official',core:'pc_records',title:'추천서 기록 설전'},
 inn_accounts:{archetype:'merchant',core:'pc_contract',title:'두 장부 설전'},
 inn_escort_terms:{archetype:'merchant',core:'pc_contract',title:'곡물 창고 호위 계약'},
 'gate:assembly':{archetype:'assembly',core:'pc_uprising',title:'민회와 격문'},
 'gate:inside':{archetype:'military',core:'pc_gate',title:'성문 내응'},
};
/** 탐색 성과(지속 논거 id) → 증거 논거. */
export function evidenceFor(argumentId:string):string|null{
 const m:Record<string,string>={'clue:escort:ledger_gap':'a_ledger','clue:escort:blocked':'a_witness','clue:escort:keeper_alert':'a_keeper','clue:escort:escort_gap':'a_generic','clue:recommendation:record_gap':'a_records','clue:recommendation:clerk_guard':'a_keeper','clue:recommendation:refugee_distrust':'a_roster','item:ledger':'a_ledger','item:letter':'a_letter','item:seal':'a_seal','duel:dianwei-vouch':'a_vouch','duel:prestige':'a_prestige'};
 if(m[argumentId])return m[argumentId];if(argumentId.startsWith('clause:'))return 'a_draft';if(argumentId.startsWith('clue:'))return 'a_generic';return null;
}
/** 인재가 설전에 실제로 참여할 때만: 지속 원칙 1개와 설전당 1회 지원 카드. */
export const DEBATE_SUPPORT:Record<string,{principle:string;card:string}>={
 xunyu:{principle:'정식 절차: 라운드 첫 논거 배치에 보호 +1',card:'s_xunyu'},
 lusu:{principle:'양측의 계산: 숨은 논거를 공개하면 조급함 −1·의도 1개 더 공개',card:'s_lusu'},
 dianwei:{principle:'철위: 보증 논거 내구 +1',card:'d_vouch'},
};
export const FIELD_LIMITS={player:3,opponent:3,audience:2,hidden:2} as const;
