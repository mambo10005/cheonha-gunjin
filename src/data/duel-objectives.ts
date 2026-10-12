/**
 * 사건별 무장 대결 목표. 같은 승리라도 목적·부상·합 수·제압 방식으로 등급이 달라진다.
 * 등급은 위에서부터 필수 조건을 모두 만족한 첫 등급이며, 조건 충족 여부를 그대로 보여 준다.
 */
import type {DuelState} from '../core/social-types.ts';
export interface DuelCheck {text:string;ok:boolean}
export interface DuelGradeRule {grade:string;rank:number;checks:(s:DuelState)=>DuelCheck[]}
export interface DuelObjectiveDefinition {
 id:string;name:string;objectiveType:'recognition'|'command'|'practice'|'breach';minimumResult:'win'|'draw';
 safeVictoryConditions:string[];excessiveForceConditions:string[];roundLimit:number;injuryTolerance:'none'|'minor'|'major';
 relationshipEffects:Record<string,number>;partialSuccessRules:string;followupRules:string;grades:DuelGradeRule[];
 /** 필수: 이 합 수 이상 대결을 이어야 평가한다(연습 시험). */minimumExchanges?:number;
 /** 자동 정책 가치 가중치(사건 목적 반영). win: 승리 자체, rank: 목표 등급, hp: 내 체력 보존, enemy: 상대 체력 감소, support: 지원 제거, technique: 반격·빈틈, restraint: 절제(과잉·무모 승부수 회피), rounds: 짧게 끝내기, injury: 부상 회피. */
 policy:{win:number;rank:number;hp:number;enemy:number;support:number;technique:number;restraint:number;rounds:number;injury:number};
}
const v=(s:DuelState)=>s.v2!;
const won=(s:DuelState)=>s.result==='win';
export const excessive=(s:DuelState)=>(v(s).stats.forceHit??0)>=18||(v(s).stats.forceOverkill??0)>=8;
export const playerInjury=(s:DuelState)=>s.hp<=s.maxHp*.25?'major':s.hp<=s.maxHp*.5?'minor':'none';
export const enemyGrave=(s:DuelState)=>won(s)&&excessive(s);
const safeTechnique=(s:DuelState)=>v(s).stats.counters>=1||v(s).stats.openingsUsed>=1;
const dk=(s:DuelState)=>s.deck?.stats;
/** 연습 시험의 긍정·부정 평가 항목(대결 덱 통계). */
export function practiceMarks(s:DuelState){const d=dk(s),st=v(s).stats;const rounds=st.rounds;
 const pos={read:(d?.readResponses??0)>=1,guard:(d?.parries??0)>=1||st.counters>=1,counter:st.counters>=1||(d?.cards?.counter_strike??0)>=1,opening:st.openingsUsed>=1,noInjury:playerInjury(s)==='none',noExcess:!excessive(s)};
 const neg={blind:st.blindFinishers>=1,earlyGambit:d?.gambitExchange!==undefined&&d.gambitExchange<=2,grave:enemyGrave(s),repeat:(d?.repeatAttacks??0)>=2,ignored:(d?.ignoredIntents??0)>=1};
 return {rounds,pos,neg,posCount:Object.values(pos).filter(Boolean).length,negCount:Object.values(neg).filter(Boolean).length};}
const P=(s:DuelState)=>practiceMarks(s);
const POL=(win:number,rank:number,hp:number,enemy:number,support:number,technique:number,restraint:number,rounds:number,injury:number)=>({win,rank,hp,enemy,support,technique,restraint,rounds,injury});
export const DUEL_OBJECTIVES:Record<string,DuelObjectiveDefinition>={
 escort_captain:{id:'escort_captain',name:'호위 대표의 인정',objectiveType:'recognition',minimumResult:'draw',
  safeVictoryConditions:['방비로 막아 반격하거나 빈틈을 만든 뒤 제압','상대 중상 없음','3합 안에 인정'],excessiveForceConditions:['빈틈 없이 한 번에 18 이상 피해','빈틈 없는 마무리가 남은 체력보다 8 이상 넘침'],
  roundLimit:3,injuryTolerance:'minor',relationshipEffects:{'완벽한 인정':6,'인정':3,'조건부 인정':0,'실패':-3},
  partialSuccessRules:'무승부·과잉 무력·합 초과는 조건부 인정: 계약은 맺지만 호위 인원이 줄고 책임이 남습니다.',followupRules:'실패하면 같은 대결은 다시 못 하고 계약·우회로가 남습니다.',
  policy:POL(1,1.2,1,0.8,0.5,1,1,0.8,1),
  grades:[
   {grade:'완벽한 인정',rank:3,checks:s=>[{text:'승리',ok:won(s)},{text:`3합 이내 (${v(s).stats.rounds}합)`,ok:v(s).stats.rounds<=3},{text:'과잉 무력 없음',ok:!excessive(s)},{text:'방비 반격 또는 빈틈 제압 1회 이상',ok:safeTechnique(s)},{text:`내 부상 경미 이하 (${playerInjury(s)})`,ok:playerInjury(s)!=='major'}]},
   {grade:'인정',rank:2,checks:s=>[{text:'승리',ok:won(s)},{text:'과잉 무력 없음',ok:!excessive(s)},{text:`4합 이내 (${v(s).stats.rounds}합)`,ok:v(s).stats.rounds<=4}]},
   {grade:'조건부 인정',rank:1,checks:s=>[{text:'승리 또는 무승부',ok:s.result==='win'||s.result==='draw'}]},
  ]},
 practice:{id:'practice',name:'뒤뜰 연습 시험',objectiveType:'practice',minimumResult:'draw',minimumExchanges:2,
  safeVictoryConditions:['상대 의도를 읽고 맞춰 대응','수세·받아 흘리기 성공','반격 성공','빈틈을 만든 뒤 공격','부상·과잉 무력 없음'],excessiveForceConditions:['빈틈 없는 승부수','첫 두 합 안의 빈틈 없는 결사 일격','상대 중상','같은 공격 반복','상대 의도를 무시한 공격'],roundLimit:4,injuryTolerance:'major',
  relationshipEffects:{'기술 인정':3,'담력 인정':3,'성실':1,'힘은 있으나 거침':0,'조건부 인정':0,'재대결 필요':-1},
  partialSuccessRules:'상대를 빨리 쓰러뜨리는 대결이 아닙니다. 두 합 이상 겨루며 읽기·방비·반격·절제를 보여야 하고, 승패만으로 평가하지 않습니다. 빈틈·상대 상태에 맞춰 쓴 승부수는 높은 평가를 받을 수 있습니다.',followupRules:'뒤뜰 시험은 거병 전 한 번만 보상합니다. 재대결 필요면 보상 없이 끝납니다.',
  policy:POL(0.25,1.6,0.9,0.3,0,1.4,1.6,0.4,1),
  grades:[
   {grade:'기술 인정',rank:3,checks:s=>{const m=P(s);return [{text:`2합 이상 겨룸 (${m.rounds}합)`,ok:m.rounds>=2},{text:'상대 의도에 맞춘 대응 1회 이상',ok:m.pos.read},{text:`기술 2가지 이상 — 수세·받아 흘리기 / 반격 / 빈틈을 만든 뒤 공격 (${[m.pos.guard&&'수세',m.pos.counter&&'반격',m.pos.opening&&'빈틈'].filter(Boolean).join('·')||'없음'})`,ok:[m.pos.guard,m.pos.counter,m.pos.opening].filter(Boolean).length>=2},{text:'과잉 무력 없음',ok:m.pos.noExcess},{text:'부정 항목 없음(빈틈 없는 승부수·초반 결사 일격·상대 중상·같은 공격 반복·의도 무시)',ok:m.negCount===0},{text:'기권·패배 아님',ok:s.result==='win'||s.result==='draw'}];}},
   {grade:'담력 인정',rank:3,checks:s=>{const m=P(s);return [{text:`3합 이상 겨룸 (${m.rounds}합)`,ok:m.rounds>=3},{text:'승리 또는 무승부',ok:s.result==='win'||s.result==='draw'},{text:'상대 의도에 맞춘 대응 1회 이상',ok:m.pos.read},{text:'상대 공격을 받아 내고 반격 또는 유인 성공',ok:(s.deck?.stats.lures??0)>=1||v(s).stats.taken>=6&&m.pos.counter},{text:'과잉 무력·상대 중상 없음',ok:m.pos.noExcess&&!m.neg.grave},{text:`내 부상 경미 이하 (${playerInjury(s)})`,ok:playerInjury(s)!=='major'}];}},
   {grade:'성실',rank:2,checks:s=>{const m=P(s);return [{text:`2합 이상 겨룸 (${m.rounds}합)`,ok:m.rounds>=2},{text:'기권·패배 아님 또는 3합 이상 버팀',ok:s.result==='win'||s.result==='draw'||m.rounds>=3},{text:`긍정 항목 2개 이상 (${m.posCount})`,ok:m.posCount>=2},{text:`부정 항목 1개 이하 (${m.negCount})`,ok:m.negCount<=1}];}},
   {grade:'힘은 있으나 거침',rank:1,checks:s=>{const m=P(s);return [{text:'승리',ok:won(s)},{text:`부정 항목 있음 (${m.negCount}) — 빈틈 없는 승부수·초반 결사 일격·상대 중상·반복·의도 무시`,ok:m.negCount>=1}];}},
   {grade:'조건부 인정',rank:1,checks:s=>{const m=P(s);return [{text:`2합 이상 겨룸 (${m.rounds}합)`,ok:m.rounds>=2},{text:'기권 아님',ok:s.result!=='surrender'},{text:`긍정 항목 1개 이상 (${m.posCount})`,ok:m.posCount>=1}];}},
   {grade:'재대결 필요',rank:0,checks:s=>{const m=P(s);return [{text:`2합을 채우지 못했거나 기권 (${m.rounds}합)`,ok:m.rounds<2||s.result==='surrender'||m.posCount===0}];}},
  ]},
 trainer:{id:'trainer',name:'훈련 대표의 인정',objectiveType:'command',minimumResult:'draw',
  safeVictoryConditions:['상대의 준비된 공격을 읽고 받아 흘리기','반격 또는 빈틈 제압','과잉 무력 없음'],excessiveForceConditions:['빈틈 없이 한 번에 18 이상 피해','빈틈 없는 마무리가 남은 체력보다 8 이상 넘침'],roundLimit:4,injuryTolerance:'minor',
  relationshipEffects:{'지휘 인정':0,'인정':0,'조건부 인정':0,'실패':0},
  partialSuccessRules:'무승부는 조건부 인정: 지휘권 불신은 풀리지만 수비대가 지켜봅니다. 지휘 인정이면 군영 관문 대결의 시작 기세가 오릅니다.',followupRules:'패배하면 부상과 수비대 불신이 남고 병영 퍼즐은 다른 해결로 이어갑니다.',
  policy:POL(1,1.2,1,0.7,0.3,1,1,0.6,1),
  grades:[
   {grade:'지휘 인정',rank:3,checks:s=>[{text:'승리',ok:won(s)},{text:'방비 반격 또는 빈틈 제압',ok:safeTechnique(s)},{text:'과잉 무력 없음',ok:!excessive(s)},{text:`4합 이내 (${v(s).stats.rounds}합)`,ok:v(s).stats.rounds<=4},{text:`내 부상 경미 이하 (${playerInjury(s)})`,ok:playerInjury(s)!=='major'}]},
   {grade:'인정',rank:2,checks:s=>[{text:'승리',ok:won(s)},{text:'과잉 무력 없음',ok:!excessive(s)}]},
   {grade:'조건부 인정',rank:1,checks:s=>[{text:'승리 또는 무승부',ok:s.result==='win'||s.result==='draw'}]},
  ]},
 barracks_gate:{id:'barracks_gate',name:'군영 장악',objectiveType:'command',minimumResult:'win',
  safeVictoryConditions:['병사 지원 제거(간보기·폭로·준비된 반격)','방비 반격 또는 빈틈 제압','과잉 무력 없음','3합 이내'],excessiveForceConditions:['빈틈 없이 한 번에 18 이상 피해','빈틈 없는 마무리가 남은 체력보다 8 이상 넘침'],
  roundLimit:4,injuryTolerance:'minor',relationshipEffects:{'완전 장악':0,'장악':0,'명목상 장악':0,'실패':0},
  partialSuccessRules:'이겨도 과잉 무력·지원 미제거·긴 대결은 명목상 장악: 병영 피해와 병사 불만이 남습니다.',followupRules:'패배하면 거병 실패 처리(도피·재기).',
  policy:POL(1.2,1.3,0.8,0.8,1.4,1,0.9,0.9,0.8),
  grades:[
   {grade:'완전 장악',rank:3,checks:s=>[{text:'승리',ok:won(s)},{text:`병사 지원 모두 제거 (남은 ${v(s).support})`,ok:v(s).support===0},{text:'방비 반격 또는 빈틈 제압',ok:safeTechnique(s)},{text:'과잉 무력 없음',ok:!excessive(s)},{text:`3합 이내 (${v(s).stats.rounds}합)`,ok:v(s).stats.rounds<=3},{text:`내 부상 경미 이하 (${playerInjury(s)})`,ok:playerInjury(s)!=='major'}]},
   {grade:'장악',rank:2,checks:s=>[{text:'승리',ok:won(s)},{text:'과잉 무력 없음',ok:!excessive(s)},{text:`병사 지원 1 이하 (${v(s).support})`,ok:v(s).support<=1}]},
   {grade:'명목상 장악',rank:1,checks:s=>[{text:'승리',ok:won(s)}]},
  ]},
 inside_gate:{id:'inside_gate',name:'성문 확보',objectiveType:'breach',minimumResult:'win',
  safeVictoryConditions:['감시 무력화(기습)','병사 지원 제거','짧은 대결'],excessiveForceConditions:['빈틈 없이 한 번에 18 이상 피해'],roundLimit:4,injuryTolerance:'minor',
  relationshipEffects:{},partialSuccessRules:'이겨도 오래 걸리거나 과잉 무력이면 성문 수비대 반발이 남습니다.',followupRules:'패배하면 성문 피해와 채무가 남습니다.',
  policy:POL(1.1,1.3,1,0.7,1.2,0.7,1.1,0.8,1.3),
  grades:[
   {grade:'조용한 개방',rank:3,checks:s=>[{text:'승리',ok:won(s)},{text:`4합 이내 (${v(s).stats.rounds}합)`,ok:v(s).stats.rounds<=4},{text:'과잉 무력 없음',ok:!excessive(s)},{text:`병사 지원 모두 제거 (${v(s).support})`,ok:v(s).support===0}]},
   {grade:'개방',rank:2,checks:s=>[{text:'승리',ok:won(s)},{text:'과잉 무력 없음',ok:!excessive(s)},{text:`지원 제거 또는 4합 이내 (지원 ${v(s).support}·${v(s).stats.rounds}합)`,ok:v(s).support===0||v(s).stats.rounds<=4}]},
   {grade:'강제 개방',rank:1,checks:s=>[{text:'승리',ok:won(s)}]},
  ]},
};
/** 목표가 없는 적대 결투(원정 등)의 정책 가중치: 생존과 승리 우선. */
export const HOSTILE_POLICY=POL(1.5,0,1.3,1.2,0.5,0.3,0.2,0.5,0.8);
export function evaluateDuel(s:DuelState){const def=DUEL_OBJECTIVES[s.v2!.objective];const checks=def.grades.map(g=>({grade:g.grade,rank:g.rank,items:g.checks(s)}));let hit=checks.find(c=>c.items.every(i=>i.ok));const adjust:string[]=[];
 if(def.minimumExchanges&&s.v2!.stats.rounds<def.minimumExchanges&&s.result!=='ongoing'){hit=checks.find(c=>c.rank===0)??hit;adjust.push(`${def.minimumExchanges}합을 채우지 못함 · 재대결 필요`);}
 // 순욱 「정식 조건」: 무승부를 한 등급 높게. 노숙 원칙: 계약 대결 패배를 조건부로.
 if(s.result==='draw'&&s.deck){let rank=hit?.rank??0;if(s.deck.formalized){rank+=1;adjust.push('정식 조건 · 무승부를 한 등급 높게 인정');}if(s.deck.drawRank>rank){rank=s.deck.drawRank;adjust.push('명분·신뢰 · 무승부를 조용한 개방으로 인정');}const up=checks.find(c=>c.rank===Math.min(3,rank));if(up&&rank>(hit?.rank??0))hit=up;}
 if(!hit&&s.result==='lose'&&def.id==='escort_captain'&&(s.deck?.officers.includes('lusu')||s.generalId==='lusu')){hit=checks.find(c=>c.rank===1);adjust.push('노숙의 계산 · 패배를 조건부 인정으로');}
 return {adjust,objective:def.id,name:def.name,grade:hit?.grade??'실패',rank:hit?.rank??0,checks,injury:{player:playerInjury(s),enemyGrave:enemyGrave(s)},excessive:excessive(s),rounds:s.v2!.stats.rounds};}
