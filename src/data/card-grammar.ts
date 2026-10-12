import {RAISING_CARDS} from './raising.ts';
import {PERSONAL_CARDS} from './personnel.ts';
import type {CardAction,CardFamily,CardGain,CardGrammar,DuelTacticSlot,Mark,MarkBag} from '../core/card-engine-types.ts';

export const FAMILY6_NAMES:Record<CardFamily,string>={cause:'명분',intel:'정보',network:'인맥',military:'군사',supply:'물자',scheme:'계책'};
export const ACTION_NAMES:Record<CardAction,string>={investigate:'조사',persuade:'설득',prepare:'준비',mobilize:'동원',trade:'거래',resolve:'결단'};
export const MARK_NAMES:Record<Mark,string>={clue:'단서',ledger:'장부',support:'지지',inside:'내부 협력',alert:'경계',supply:'보급',momentum:'기세',promise:'약속',burden:'부담',opinion:'공론',guard:'방비'};
export const MARKS=Object.keys(MARK_NAMES) as Mark[];
export const MARK_CAP=6,ALERT_CAP=8;
export const markText=(b:MarkBag|undefined)=>Object.entries(b??{}).filter(([,n])=>n).map(([m,n])=>`${MARK_NAMES[m as Mark]} ${n!>0?'+':''}${n}`).join('·');
export function gainText(g:CardGain){return [g.force?`장애 ${g.force>0?'+':''}${g.force}`:'',markText(g.marks),g.draw?`카드 ${g.draw}장`:'',g.power?`준비력 +${g.power}`:''].filter(Boolean).join('·');}

interface Spec {f:CardFamily;a:CardAction;force?:number;p?:MarkBag;c?:[Mark,number,CardGain];u?:[NonNullable<CardGrammar['followup']>['after'],CardGain];bold?:[string,CardGain];quiet?:[string,CardGain];burden?:boolean}
const S=(f:CardFamily,a:CardAction,p:MarkBag={},extra:Omit<Spec,'f'|'a'|'p'>={}):Spec=>({f,a,p,...extra});

/** 직접 설계한 카드 문법. 나머지 카드는 계열 기본 문법을 따른다(아래 fallback). */
const SPECS:Record<string,Spec>={
 // 주인공 기본
 manifesto:S('cause','persuade',{opinion:1,alert:1},{c:['support',1,{force:1,marks:{opinion:1}}],u:[{action:'investigate'},{marks:{opinion:1}}]}),
 coin:S('supply','trade',{supply:1},{c:['ledger',1,{force:1}]}),
 clues:S('intel','investigate',{clue:2},{u:[{action:'prepare'},{marks:{clue:1}}]}),
 food:S('supply','trade',{supply:2,alert:1},{c:['ledger',1,{marks:{alert:-1}}]}),
 // 출신·도시
 recommend:S('network','persuade',{support:1,opinion:1},{u:[{family:'cause'},{marks:{support:1}}]}),
 raise:S('military','mobilize',{momentum:1,alert:1},{c:['supply',1,{marks:{momentum:2}}]}),
 train:S('military','prepare',{momentum:1},{u:[{action:'mobilize'},{marks:{momentum:1}}]}),
 clerk:S('network','persuade',{inside:1,ledger:1}),
 authority:S('cause','trade',{promise:2,inside:1}),
 cache:S('supply','prepare',{supply:2},{c:['clue',1,{marks:{ledger:1}}]}),
 gate:S('military','resolve',{momentum:1,inside:1,alert:1}),
 wagon:S('supply','prepare',{supply:1,clue:1}),
 // 공용
 help:S('network','persuade',{support:2}),
 pledge:S('cause','resolve',{promise:1,support:1},{c:['opinion',1,{force:1}]}),
 register:S('cause','investigate',{ledger:1,support:1}),
 patrol:S('military','prepare',{momentum:1,alert:-1}),
 hide:S('scheme','investigate',{inside:1,alert:-1}),
 redress:S('cause','resolve',{opinion:2,alert:2},{c:['ledger',1,{force:2}]}),
 order:S('cause','persuade',{support:1},{c:['opinion',1,{marks:{support:2}}]}),
 contact:S('network','investigate',{clue:1,inside:1},{u:[{family:'intel'},{marks:{inside:1}}]}),
 captain:S('military','mobilize',{momentum:1},{u:[{action:'persuade'},{marks:{momentum:1}}]}),
 loan:S('supply','trade',{supply:2,burden:1}),
 fund:S('supply','trade',{supply:1,support:1}),
 loot:S('supply','resolve',{supply:2,alert:2,burden:1}),
 weapons:S('military','prepare',{},{c:['supply',1,{marks:{momentum:2}}]}),
 medicine:S('supply','prepare',{supply:1,alert:-1},{c:['burden',1,{power:1}]}),
 drill:S('military','prepare',{momentum:1},{c:['momentum',1,{force:2}]}),
 defection:S('military','trade',{inside:2,alert:1}),
 tunnel:S('scheme','investigate',{clue:1,inside:1}),
 split:S('scheme','persuade',{},{c:['clue',2,{force:1,marks:{inside:2}}]}),
 // 대표 고유
 c_ledger:S('cause','trade',{promise:1,ledger:1}),
 c_turn:S('scheme','investigate',{},{c:['burden',1,{marks:{clue:2}}],u:[{family:'cause'},{power:1}]}),
 z_command:S('military','mobilize',{momentum:2,alert:1}),
 z_rally:S('supply','prepare',{supply:1},{u:[{family:'military'},{marks:{support:1}}]}),
 g_read:S('intel','investigate',{clue:2,inside:1}),
 g_door:S('scheme','persuade',{inside:1},{u:[{family:'intel'},{marks:{inside:1},force:1}]}),
 // 부담: 사용할 수는 있으나 장애를 줄이지 못하고 부담 표식을 남긴다
 poverty:S('supply','trade',{burden:1,ledger:1},{force:0,burden:true}),
 rumor:S('intel','investigate',{burden:1,clue:1,alert:1},{force:0,burden:true}),
 debt_note:S('cause','trade',{burden:1,promise:1},{force:0,burden:true}),
 fatigue:S('military','mobilize',{burden:1},{force:0,burden:true}),
 // 순욱
 role_network_a:S('network','persuade',{opinion:1,support:1}),
 role_network_b:S('network','persuade',{opinion:2},{c:['ledger',1,{force:1}]}),
 person_xunyu_a:S('cause','persuade',{opinion:1},{c:['opinion',2,{force:2,marks:{support:1}}]}),
 person_xunyu_b:S('cause','investigate',{ledger:2},{u:[{action:'persuade'},{marks:{opinion:1}}]}),
 support_xunyu:S('network','persuade',{opinion:1}),
 // 전위
 role_military_a:S('military','mobilize',{momentum:1,alert:1}),
 role_military_b:S('military','prepare',{momentum:2}),
 person_dianwei_a:S('military','resolve',{alert:1},{c:['momentum',2,{force:3}]}),
 person_dianwei_b:S('military','prepare',{supply:1,momentum:1,alert:-1}),
 support_dianwei:S('military','prepare',{momentum:1}),
 // 노숙
 role_intel_a:S('intel','investigate',{clue:2}),
 role_intel_b:S('scheme','trade',{},{c:['clue',1,{marks:{inside:1},force:1}]}),
 person_lusu_a:S('scheme','trade',{promise:1},{c:['clue',2,{force:1,marks:{inside:2}}]}),
 person_lusu_b:S('network','trade',{promise:1,inside:1},{c:['promise',2,{force:2}]}),
 support_lusu:S('intel','investigate',{clue:1}),
 // 정보(程普)
 role_supply_a:S('supply','prepare',{supply:2}),
 role_supply_b:S('supply','trade',{supply:1,ledger:1}),
 person_chengpu_a:S('supply','mobilize',{},{c:['supply',2,{force:1,marks:{momentum:2}}]}),
 person_chengpu_b:S('supply','prepare',{supply:1},{c:['burden',1,{marks:{supply:2}}]}),
 support_chengpu:S('supply','prepare',{supply:1}),
 // 첫 협력 인재 전용: 순욱(문서·정론·논거 보호·부담 정제) / 전위(방비·기세·반격·직접 해결) / 노숙(거래·장부·비용 전환·중재)
 x_document:S('cause','investigate',{ledger:2},{u:[{action:'persuade'},{marks:{opinion:1}}]}),
 x_orthodox:S('cause','persuade',{opinion:1},{c:['ledger',1,{force:1,marks:{opinion:1}}]}),
 x_guard_args:S('network','prepare',{opinion:1,alert:-1}),
 x_refine:S('cause','resolve',{},{c:['burden',1,{force:1,marks:{opinion:2}}]}),
 d_guard:S('military','prepare',{guard:2,alert:-1}),
 d_momentum:S('military','mobilize',{momentum:2},{u:[{action:'prepare'},{marks:{momentum:1}}]}),
 d_counter:S('military','resolve',{momentum:1},{c:['guard',1,{force:2}]}),
 d_direct:S('military','resolve',{alert:1},{force:2,c:['momentum',2,{force:2}]}),
 l_trade:S('scheme','trade',{ledger:1,promise:1}),
 l_ledger:S('intel','investigate',{ledger:1,clue:1},{c:['ledger',1,{marks:{clue:2,inside:1}}]}),
 l_convert:S('scheme','trade',{},{c:['alert',1,{force:1,marks:{inside:1}}]}),
 l_mediate:S('network','persuade',{support:1},{c:['inside',1,{force:2}]}),
 // 합동 4
 joint_feint:S('scheme','resolve',{momentum:1},{c:['clue',1,{force:2,marks:{momentum:1}}]}),
 joint_records:S('cause','investigate',{ledger:2,opinion:1}),
 joint_supply:S('supply','mobilize',{supply:2,momentum:1,burden:1}),
 joint_terms:S('network','trade',{promise:1,inside:2}),
};
const FAMILY_MAP:Record<string,CardFamily>={cause:'cause',network:'network',funds:'supply',supply:'supply',military:'military',intel:'intel',promise:'cause'};
const DEFAULT:Record<CardFamily,[CardAction,MarkBag]>={cause:['persuade',{support:1}],network:['persuade',{inside:1}],supply:['prepare',{supply:1}],military:['mobilize',{momentum:1}],intel:['investigate',{clue:1}],scheme:['trade',{inside:1}]};
const DUEL_SLOT:Record<CardFamily,DuelTacticSlot>={intel:'opening',scheme:'gambit',military:'gambit',network:'response',cause:'response',supply:'response'};
const VARIANT:Record<CardFamily,[string,string,string]>={
 cause:['공론과 지지를 모아 사람들을 설득','명분 논거로 상대의 요구를 낮춤','보좌 개입: 실패를 한 번 완화'],
 intel:['단서를 모아 숨은 길과 사정을 드러냄','근거를 제시해 상대의 반론을 끊음','수읽기: 상대 행동을 미리 공개'],
 network:['내부 협력자를 연결','관계를 내세워 신뢰를 얻음','보좌 개입: 실패를 한 번 완화'],
 military:['기세를 모아 무력과 규율을 증명','군사적 안전 보장을 약속','결사 일격: 모은 기세로 큰 피해'],
 supply:['보급을 마련해 비용을 감당','물자로 이익 요구를 충족','보급 회복: 위기에서 체력 회복'],
 scheme:['표식을 바꿔 협력과 우회를 설계','이면 조건으로 부담을 흡수','허점 폭로: 상대 방비를 무너뜨림'],
};
function fateBattle(id:string){const d=RAISING_CARDS[id];if(!d)return undefined;if(d.fate.kind==='combat')return d.fate.id;return PERSONAL_CARDS[id]?.combat;}
function fateAdmin(id:string){const d=RAISING_CARDS[id];if(!d)return undefined;if(d.fate.kind==='admin')return d.fate.id;return PERSONAL_CARDS[id]?.admin;}
function primary(p:MarkBag,family:CardFamily):Mark{return (Object.keys(p) as Mark[]).find(m=>m!=='alert'&&m!=='burden'&&(p[m]??0)>0)??(Object.keys(DEFAULT[family][1])[0] as Mark);}
function build(id:string):CardGrammar {
 const d=RAISING_CARDS[id],s=SPECS[id],family=s?.f??(id.startsWith('joint_')?'scheme':FAMILY_MAP[d.family]),[defAction,defMarks]=DEFAULT[family];
 const action=s?.a??defAction,produces=s?.p??defMarks,force=s?.force??(d.burden?0:1),owner=d.owner??(PERSONAL_CARDS[id]?.owners.length?PERSONAL_CARDS[id].owners.join('+'):null);
 const [explore,debate,duel]=VARIANT[family];const battle=fateBattle(id);
 const g:CardGrammar={id,family,action,force,produces,activityVariants:{explore:`${ACTION_NAMES[action]} · ${explore}`,debate:d.debate?`설전 논거 카드로 전환 · ${debate}`:'설전에서는 탐색 결과(표식)로만 반영',duel:`대결 전술 후보(${({opening:'선제',response:'대응',gambit:'승부수'} as const)[DUEL_SLOT[family]]}) · ${duel}`,battle:battle?`군진 전투 카드로 전환`:'군진 전투에서는 사건 결과로만 반영',admin:fateAdmin(id)?'거병 후 내정 카드로 전환':'거병 후 기록으로 남음'},owner,
  upgradeBranches:{bold:{name:s?.bold?.[0]??'강행',text:'장애 +1, 경계 +1',gain:s?.bold?.[1]??{force:1,marks:{alert:1}}},quiet:{name:s?.quiet?.[0]??'정밀',text:`${MARK_NAMES[primary(produces,family)]} 생산 +1`,gain:s?.quiet?.[1]??{marks:{[primary(produces,family)]:1}}}},
  conversionRules:{...(d.debate?{debate:d.debate}:{}),duel:DUEL_SLOT[family],...(battle?{battle}:{}),...(fateAdmin(id)?{admin:fateAdmin(id)}:{})},...(d.burden||s?.burden?{burden:true}:{})};
 if(s?.c){const [mark,amount,gain]=s.c;g.consumes={mark,amount,gain,text:`${MARK_NAMES[mark]} ${amount} 소비 → ${gainText(gain)}`};}
 if(s?.u){const [after,gain]=s.u;g.followup={after,gain,text:`직전 ${after.action?ACTION_NAMES[after.action]:after.family?FAMILY6_NAMES[after.family]:after.mark?MARK_NAMES[after.mark]:'다른 인재'} 카드 → ${gainText(gain)}`};}
 return g;
}
export const CARD_GRAMMAR:Record<string,CardGrammar>=Object.fromEntries(Object.keys(RAISING_CARDS).map(id=>[id,build(id)]));
export const AUTHORED_GRAMMAR=Object.keys(SPECS);
export function grammarText(g:CardGrammar){return [`${FAMILY6_NAMES[g.family]}·${ACTION_NAMES[g.action]}`,g.force?`장애 ${g.force}`:'장애 0',markText(g.produces)&&`생산 ${markText(g.produces)}`,g.consumes?.text,g.followup?.text].filter(Boolean).join(' · ');}
