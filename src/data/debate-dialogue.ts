import type { DebateState } from '../core/social-types.ts';
const ARGUMENT_VISUALS:Record<string,{symbol:string;family:string;effect:string;line:string[]}>= {
  evidence:{symbol:'簡',family:'근거',effect:'document',line:['장부의 근거를 살펴보십시오.','말 대신 기록으로 답하겠습니다.']},
  rebuttal:{symbol:'破',family:'반론',effect:'break',line:['그 주장은 앞뒤가 맞지 않습니다.','논점부터 바로잡겠습니다.']},
  concede:{symbol:'結',family:'양보',effect:'bind',line:['염려하신 부분은 제가 맡겠습니다.','이만큼은 양보하겠습니다.']},
  proposal:{symbol:'圖',family:'운영',effect:'map',line:['길과 수레를 함께 정합시다.','실행할 방도를 제안하겠습니다.']},
  disclose:{symbol:'信',family:'정보',effect:'letter',line:['봉인한 작전서를 공개하겠습니다.','다음 길의 위험은 이미 살폈습니다.']},
  pledge:{symbol:'糧',family:'실물',effect:'supply',line:['군량을 먼저 내놓겠습니다.','말뿐인 약속이 되지 않게 하겠습니다.']},
  authority:{symbol:'印',family:'권한',effect:'seal',line:['권한과 책임을 문서에 남깁시다.','맡기되 그 대가도 분명히 합시다.']},
  credential:{symbol:'契',family:'신용',effect:'accord',line:['지켜 온 협정을 증거로 삼겠습니다.','우리의 약속은 이미 증명되었습니다.']},
};
const personal: Record<string,Partial<Record<string,string[]>>> = {
  guojia:{disclose:['이 서신에 다음 길의 답이 있습니다.','미리 살핀 위험부터 말씀드리겠습니다.'],evidence:['흩어진 기록이 같은 결론을 가리킵니다.']},
  chengong:{concede:['서로의 염려를 하나씩 풀어봅시다.','당신의 부담도 함께 헤아리겠습니다.'],proposal:['지킬 수 있는 약속부터 세웁시다.']},
};
// No RNG consumption: cosmetic variation cannot change the expedition.
export function speechLine(s:DebateState, action:string):string {
  const lines = personal[s.generalId]?.[action] ?? ARGUMENT_VISUALS[action]?.line ?? ['오늘의 논의를 마치겠습니다.'];
  let hash=s.rng >>> 0; for (const c of `${s.generalId}:${action}:${s.round}`) hash=(Math.imul(hash,31)+c.charCodeAt(0))>>>0;
  return lines[hash%lines.length];
}
export function opponentLine(s:DebateState):string {
  const n=s.negotiation;
  if(s.result!=='ongoing') return s.result==='success'?'좋습니다. 조건을 문서로 확인합시다.':s.result==='partial'?'일부 조건이라면 받아들일 수 있겠습니다.':'이 조건으로는 함께할 수 없습니다.';
  if(n){const names={profit:'이익',safety:'안전',honor:'명분',authority:'권한'}; const unmet=Object.entries(n.needs).find(([k,v])=>n.scores[k as keyof typeof n.scores]<v!);
    if(unmet) return `${names[unmet[0] as keyof typeof names]} 보장을 더 보여주십시오.`;
    if(s.trust<n.trustNeeded)return '조건은 보았습니다. 약속을 믿을 근거가 필요합니다.';
    if(n.burden>n.burdenLimit)return '우리에게 지워진 부담이 너무 큽니다.';
    return '요구를 충족했습니다. 남은 논의를 마무리합시다.';}
  return '다음 논점에 대한 답을 듣겠습니다.';
}
