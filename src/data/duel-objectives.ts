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
}
const v=(s:DuelState)=>s.v2!;
const won=(s:DuelState)=>s.result==='win';
export const excessive=(s:DuelState)=>(v(s).stats.forceHit??0)>=18||(v(s).stats.forceOverkill??0)>=8;
export const playerInjury=(s:DuelState)=>s.hp<=s.maxHp*.25?'major':s.hp<=s.maxHp*.5?'minor':'none';
export const enemyGrave=(s:DuelState)=>won(s)&&excessive(s);
const safeTechnique=(s:DuelState)=>v(s).stats.counters>=1||v(s).stats.openingsUsed>=1;
export const DUEL_OBJECTIVES:Record<string,DuelObjectiveDefinition>={
 escort_captain:{id:'escort_captain',name:'호위 대표의 인정',objectiveType:'recognition',minimumResult:'draw',
  safeVictoryConditions:['방비로 막아 반격하거나 빈틈을 만든 뒤 제압','상대 중상 없음','3합 안에 인정'],excessiveForceConditions:['빈틈 없이 한 번에 18 이상 피해','빈틈 없는 마무리가 남은 체력보다 8 이상 넘침'],
  roundLimit:3,injuryTolerance:'minor',relationshipEffects:{'완벽한 인정':6,'인정':3,'조건부 인정':0,'실패':-3},
  partialSuccessRules:'무승부·과잉 무력·합 초과는 조건부 인정: 계약은 맺지만 호위 인원이 줄고 책임이 남습니다.',followupRules:'실패하면 같은 대결은 다시 못 하고 계약·우회로가 남습니다.',
  grades:[
   {grade:'완벽한 인정',rank:3,checks:s=>[{text:'승리',ok:won(s)},{text:`3합 이내 (${v(s).stats.rounds}합)`,ok:v(s).stats.rounds<=3},{text:'과잉 무력 없음',ok:!excessive(s)},{text:'방비 반격 또는 빈틈 제압 1회 이상',ok:safeTechnique(s)},{text:`내 부상 경미 이하 (${playerInjury(s)})`,ok:playerInjury(s)!=='major'}]},
   {grade:'인정',rank:2,checks:s=>[{text:'승리',ok:won(s)},{text:'과잉 무력 없음',ok:!excessive(s)},{text:`4합 이내 (${v(s).stats.rounds}합)`,ok:v(s).stats.rounds<=4}]},
   {grade:'조건부 인정',rank:1,checks:s=>[{text:'승리 또는 무승부',ok:s.result==='win'||s.result==='draw'}]},
  ]},
 practice:{id:'practice',name:'뒤뜰 연습 시험',objectiveType:'practice',minimumResult:'draw',
  safeVictoryConditions:['방비→반격','유인→빈틈','보법으로 거리 조절'],excessiveForceConditions:['빈틈 없이 한 번에 18 이상 피해'],roundLimit:4,injuryTolerance:'major',
  relationshipEffects:{'기술 인정':3,'성실':1,'미숙':0},partialSuccessRules:'승패보다 기술: 진 대결도 기술을 보이면 인정됩니다.',followupRules:'뒤뜰 시험은 거병 전 한 번만 보상합니다.',
  grades:[
   {grade:'기술 인정',rank:3,checks:s=>[{text:'방비 반격 또는 빈틈 제압',ok:safeTechnique(s)},{text:'거리 2가지 이상 사용',ok:new Set(v(s).stats.distances).size>=2},{text:'자세 2가지 이상 사용',ok:new Set(v(s).stats.stances.filter(Boolean)).size>=2},{text:'과잉 무력 없음',ok:!excessive(s)}]},
   {grade:'성실',rank:2,checks:s=>[{text:'4합까지 버팀 또는 승리',ok:s.result!=='surrender'&&(s.result==='win'||v(s).stats.rounds>=4)}]},
   {grade:'미숙',rank:1,checks:()=>[{text:'참여',ok:true}]},
  ]},
 barracks_gate:{id:'barracks_gate',name:'군영 장악',objectiveType:'command',minimumResult:'win',
  safeVictoryConditions:['병사 지원 제거(간보기·폭로·준비된 반격)','방비 반격 또는 빈틈 제압','과잉 무력 없음','4합 이내'],excessiveForceConditions:['빈틈 없이 한 번에 18 이상 피해','빈틈 없는 마무리가 남은 체력보다 8 이상 넘침'],
  roundLimit:4,injuryTolerance:'minor',relationshipEffects:{'완전 장악':0,'장악':0,'명목상 장악':0,'실패':0},
  partialSuccessRules:'이겨도 과잉 무력·지원 미제거·긴 대결은 명목상 장악: 병영 피해와 병사 불만이 남습니다.',followupRules:'패배하면 거병 실패 처리(도피·재기).',
  grades:[
   {grade:'완전 장악',rank:3,checks:s=>[{text:'승리',ok:won(s)},{text:`병사 지원 모두 제거 (남은 ${v(s).support})`,ok:v(s).support===0},{text:'방비 반격 또는 빈틈 제압',ok:safeTechnique(s)},{text:'과잉 무력 없음',ok:!excessive(s)},{text:`4합 이내 (${v(s).stats.rounds}합)`,ok:v(s).stats.rounds<=4},{text:`내 부상 경미 이하 (${playerInjury(s)})`,ok:playerInjury(s)!=='major'}]},
   {grade:'장악',rank:2,checks:s=>[{text:'승리',ok:won(s)},{text:'과잉 무력 없음',ok:!excessive(s)},{text:`병사 지원 1 이하 (${v(s).support})`,ok:v(s).support<=1}]},
   {grade:'명목상 장악',rank:1,checks:s=>[{text:'승리',ok:won(s)}]},
  ]},
 inside_gate:{id:'inside_gate',name:'성문 확보',objectiveType:'breach',minimumResult:'win',
  safeVictoryConditions:['감시 무력화(기습)','병사 지원 제거','짧은 대결'],excessiveForceConditions:['빈틈 없이 한 번에 18 이상 피해'],roundLimit:4,injuryTolerance:'minor',
  relationshipEffects:{},partialSuccessRules:'이겨도 오래 걸리거나 과잉 무력이면 성문 수비대 반발이 남습니다.',followupRules:'패배하면 성문 피해와 채무가 남습니다.',
  grades:[
   {grade:'조용한 개방',rank:3,checks:s=>[{text:'승리',ok:won(s)},{text:`4합 이내 (${v(s).stats.rounds}합)`,ok:v(s).stats.rounds<=4},{text:'과잉 무력 없음',ok:!excessive(s)},{text:`병사 지원 모두 제거 (${v(s).support})`,ok:v(s).support===0}]},
   {grade:'개방',rank:2,checks:s=>[{text:'승리',ok:won(s)},{text:'과잉 무력 없음',ok:!excessive(s)},{text:`지원 제거 또는 4합 이내 (지원 ${v(s).support}·${v(s).stats.rounds}합)`,ok:v(s).support===0||v(s).stats.rounds<=4}]},
   {grade:'강제 개방',rank:1,checks:s=>[{text:'승리',ok:won(s)}]},
  ]},
};
export function evaluateDuel(s:DuelState){const def=DUEL_OBJECTIVES[s.v2!.objective];const checks=def.grades.map(g=>({grade:g.grade,rank:g.rank,items:g.checks(s)}));const hit=checks.find(c=>c.items.every(i=>i.ok));return {objective:def.id,name:def.name,grade:hit?.grade??'실패',rank:hit?.rank??0,checks,injury:{player:playerInjury(s),enemyGrave:enemyGrave(s)},excessive:excessive(s),rounds:s.v2!.stats.rounds};}
