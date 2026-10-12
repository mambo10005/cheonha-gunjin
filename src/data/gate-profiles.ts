/**
 * 관문·대결 난도 프로필(내부 시험용). 수치를 일괄 배율로 올리지 않고 상대 논거·의도·조급함·지원·거리·조항 요구를 바꾼다.
 * 기본 캠페인은 「표준」으로 검토 중이며, 사람 플레이 전 확정하지 않았다.
 */
import type {DuelAction} from '../core/social-types.ts';
export type GateProfileId='lenient'|'standard'|'harsh';
export interface GateProfile {
 id:GateProfileId;name:string;text:string;
 debate:{maxRounds:number;elite:boolean;extraCounter:boolean};
 duel:{patterns:Record<string,DuelAction[]>;support:number;startDistance:'near'|'mid'|'far';maxRounds:number};
}
export const GATE_PROFILES:Record<GateProfileId,GateProfile>={
 lenient:{id:'lenient',name:'관대',text:'1차 엔진에 가까운 난도. 설전 6라운드, 지원 없음, 원래 상대 순서.',debate:{maxRounds:6,elite:false,extraCounter:false},
  duel:{patterns:{},support:0,startDistance:'mid',maxRounds:5}},
 standard:{id:'standard',name:'표준(검토 중)',text:'무빌드는 조건부·근소한 성공, 맞는 빌드는 유리한 결과, 정확한 운용은 최상. 설전 5라운드, 대결 지원 1, 상대가 승부수 전에 견제로 빈틈을 닫음.',debate:{maxRounds:5,elite:false,extraCounter:false},
  duel:{patterns:{champion:['strike','probe','strike','finisher'],inn_guard:['strike','guard','probe','finisher'],sentinel:['guard','strike','probe','finisher']},support:1,startDistance:'mid',maxRounds:5}},
 harsh:{id:'harsh',name:'가혹',text:'핵심 연쇄와 준비 전술이 필요. 설전 4라운드·정예 반론, 대결 지원 2·원거리 시작·견제 잦음. 실패해도 캠페인은 계속.',debate:{maxRounds:4,elite:true,extraCounter:true},
  duel:{patterns:{champion:['probe','strike','finisher','strike'],inn_guard:['probe','strike','finisher','guard'],sentinel:['probe','guard','finisher','strike']},support:2,startDistance:'far',maxRounds:4}},
};
