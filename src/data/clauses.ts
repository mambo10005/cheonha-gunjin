/**
 * 설전 조항: 설전 끝의 상태(점수·신뢰·부담·사용 카드·보존 논거·공론)로 얻고, 거병 후 도시·관계·인재에 남는다.
 * 비용 조항은 상대에게 내준 조건이다. 충돌하는 조항은 함께 성립하지 않는다.
 */
import type {Metric} from '../core/city-types.ts';
export interface ClauseContext {context:string;result:string;scores:Record<string,number>;needs:Record<string,number>;trust:number;trustNeeded:number;burden:number;burdenLimit:number;rounds:number;maxRounds:number;plays:Record<string,number>;promises:string[];argsInitial:number;argsPreserved:number;recordArgs:number;countersBlocked:number;countersHit:number;opinion:number;privateInterest:number;pledges:number;promiseMarks:number;talents:number;profile:string}
export interface ClauseEffects {immediate?:{support?:number;funds?:number;food?:number;exposure?:number;legitimacy?:number};policy?:string;obligation?:'ration'|'authority'|'shared'|'escort'|'safety';groups?:Partial<Record<'locals'|'traders'|'refugees',number>>;facility?:{district:string;text:string};officer?:string;followup?:string;metrics?:Partial<Record<Metric,number>>}
export interface ClauseDef {id:string;name:string;tier:'advanced'|'basic'|'cost';text:string;contexts:string[];requires:(c:ClauseContext)=>string|null;effects:ClauseEffects;conflicts:string[]}
const harsh=(c:ClauseContext,n:number)=>c.profile==='harsh'?n+1:c.profile==='lenient'?Math.max(0,n-1):n;
const plays=(c:ClauseContext,ids:string[])=>ids.reduce((n,id)=>n+(c.plays[id]??0),0);
const ALL=['gate:assembly','gate:inside','inn_documents','inn_accounts','inn_escort_terms','shrine','store','market'];
export const CLAUSES:Record<string,ClauseDef>={
 shared_gov:{id:'shared_gov',name:'공동 통치',tier:'advanced',text:'주민 대표가 새 관청 회의에 참여합니다.',contexts:['gate:assembly','gate:inside','shrine'],
  requires:c=>c.result!=='success'?'완전 합의가 필요':(c.scores.honor??0)<(c.needs.honor??0)+1?`명예 점수가 요구보다 1 더 필요(${c.scores.honor??0}/${(c.needs.honor??0)+1})`:c.opinion<harsh(c,4)?`쌓은 공론 ${harsh(c,4)} 필요(${c.opinion})`:c.privateInterest>1?`사적 이해 ${c.privateInterest} — 같은 인재 카드 연속 사용이 많음`:null,
  effects:{immediate:{support:2},policy:'settlement',obligation:'shared',groups:{locals:1,refugees:1},metrics:{order:5},followup:'공동 회의: 첫 내정 턴에 주민 대표 회의'},conflicts:['authority_grant']},
 records:{id:'records',name:'문서 보존',tier:'advanced',text:'호적·구휼 장부를 그대로 보존하고 서리의 책임을 묻지 않습니다.',contexts:['gate:assembly','gate:inside','inn_documents'],
  requires:c=>c.result!=='success'?'완전 합의가 필요':plays(c,['grounds','petition','inspect','redress'])<harsh(c,2)?`문서 계열 논거(공적 근거·권한 문서·상황 조사·조항 정리) ${harsh(c,2)}회 필요(${plays(c,['grounds','petition','inspect','redress'])})`:c.recordArgs<1?'장부·기록 논거를 설전 끝까지 지켜야 함':null,
  effects:{immediate:{legitimacy:1},facility:{district:'hall',text:'관청 기록 보존 · 관청 손상 복구'},officer:'local_scribe',followup:'문서고 인재 추천'},conflicts:[]},
 levy_limit:{id:'levy_limit',name:'주민 부담 제한',tier:'basic',text:'징발과 노역의 상한을 문서로 정합니다.',contexts:ALL,
  requires:c=>c.result==='failure'?'합의가 필요':c.burden>1?`최종 부담 1 이하 필요(${c.burden})`:c.needs.safety!==undefined&&(c.scores.safety??0)<c.needs.safety?'안전 요구를 채워야 함':c.pledges+c.promiseMarks<1?'지킬 약속(서약·약속 표식)이 하나는 있어야 함 — 약속을 줄이면 주민 부담이 늘어납니다':null,
  effects:{obligation:'safety',groups:{locals:1},metrics:{life:5}},conflicts:['ration_levy']},
 trade_credit:{id:'trade_credit',name:'상단 신용',tier:'basic',text:'상단이 외상 거래를 이어 갑니다.',contexts:['inn_accounts','market','gate:inside'],
  requires:c=>c.result!=='success'?'완전 합의가 필요':(c.scores.profit??0)<(c.needs.profit??0)+1?`이익 점수가 요구보다 1 더 필요(${c.scores.profit??0})`:null,
  effects:{immediate:{funds:2},policy:'merchants',groups:{traders:1}},conflicts:[]},
 grain_open:{id:'grain_open',name:'창고 공개',tier:'basic',text:'창고 장부를 공개하고 구휼 몫을 따로 둡니다.',contexts:['inn_escort_terms','inn_accounts','store','gate:assembly'],
  requires:c=>c.result!=='success'?'완전 합의가 필요':plays(c,['grounds','inspect','plan','supplies'])<1?'장부·물자 근거 카드를 1번 이상 써야 함':null,
  effects:{policy:'granary',facility:{district:'store',text:'창고 보존'},groups:{refugees:1}},conflicts:[]},
 ration_levy:{id:'ration_levy',name:'군량 징발 조항',tier:'cost',text:'상대에게 군량 지급을 약속했습니다.',contexts:ALL,
  requires:c=>c.promises.includes('ration')||c.burden>=c.burdenLimit?null:'군량 담보 약속 또는 부담 한도 도달 시 생김',
  effects:{immediate:{food:2},obligation:'ration',groups:{locals:-1}},conflicts:['levy_limit']},
 authority_grant:{id:'authority_grant',name:'권한 위임',tier:'cost',text:'기존 관리에게 권한을 나눠 주었습니다.',contexts:ALL,
  requires:c=>c.promises.includes('authority')?null:'위임 약정 카드를 썼을 때만 생김',
  effects:{obligation:'authority',groups:{traders:1,locals:-1}},conflicts:['shared_gov']},
};
export const DEBATE_GRADES=['탁월한 합의','유리한 합의','일반 합의','조건부 합의','결렬'] as const;
export type DebateGrade=typeof DEBATE_GRADES[number];
/** 맥락별 특별 목표: 등급표의 최상 조건 중 하나. */
export const SPECIAL_OBJECTIVES:Record<string,{text:string;check:(c:ClauseContext,clauses:string[])=>boolean}>={
 'gate:assembly':{text:'공론이 사적 이해의 두 배 이상, 서로 다른 인재 1명 이상',check:c=>c.opinion>=c.privateInterest*2+2&&c.talents>=1},
 'gate:inside':{text:'상대 반론을 한 번도 맞지 않음',check:c=>c.countersHit===0},
 inn_documents:{text:'문서 보존 조항 확보',check:(_c,cl)=>cl.includes('records')},
 inn_accounts:{text:'상단 신용 조항 확보',check:(_c,cl)=>cl.includes('trade_credit')},
 inn_escort_terms:{text:'창고 공개 조항 확보',check:(_c,cl)=>cl.includes('grain_open')},
};
