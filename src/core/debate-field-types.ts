/**
 * 논박진(설전 전장) 상태. 논거는 전장에 놓인 대상이며 내구·보호·숨김·공개 상태를 갖는다.
 * 정의에 속한 고정 성질(태그·지속 효과·반응·대상 규칙·연결 요구·연결 조항·표현)은 ARGUMENT_DEFS에 두고 저장하지 않는다.
 */
import type {Axis} from './accord-types.ts';
export type ArgOwner='player'|'opponent'|'audience'|'hidden';
export interface ArgumentState {
 argumentId:string; definitionId:string; owner:ArgOwner; source:string;
 durability:number; maxDurability:number; protection:number;
 hidden:boolean; exposed:boolean; expiresAt:number|null; core:boolean;
 placedRound:number; uses:number;
 /** 놓일 때 실제로 바꾼 요구·부담 한도(파괴 시 정확히 되돌린다). */
 applied?:Partial<Record<Axis,number>>; appliedLimit?:number;
}
export type IntentKind='attack'|'attackCore'|'doubt'|'cost'|'burden'|'lock'|'hide'|'shift'|'demand'|'react';
export interface DebateIntent {id:string;kind:IntentKind;target:string|null;amount:number;clause?:string;react?:string;concealed:boolean;redirected?:boolean;source:string}
export interface DebateFieldStats {placed:number;instant:number;replaced:number;destroyedOpp:number;lost:number;protectedHits:number;exposed:number;blocked:number;intentsHit:number;coreBroken:boolean;oppCoreBroken:boolean;converted:number;attacks:number}
export interface DebateField {
 version:1; archetype:string; context:string; factions:string[]; profile:string;
 playerCore:ArgumentState; opponentCore:ArgumentState;
 player:ArgumentState[]; opponent:ArgumentState[]; audience:ArgumentState[]; hidden:ArgumentState[];
 /** 이번 라운드 의도(0번)와 공개된 후속 의도. */
 intents:DebateIntent[]; pattern:string[]; patternIndex:number; revealedIntents:number;
 focus:string|null; pressure:number; impatience:number; impatienceLimit:number; finalDemanded:boolean;
 locked:string[]; exposedDefs:string[]; nextArg:number; officers:string[]; supportUsed:string[]; preparedEvidence:string[];
 lastOwner:string|null; opinion:number; privateInterest:number; roundFamilies:string[]; roundFirstArg:boolean; discountUsed:boolean;
 stats:DebateFieldStats; history:string[];
 /** 설전 시작 때의 캠페인 맥락(공론·인재 수·서약·난도) — 화면·정책의 예상 등급 계산용. */
 ctx?:{opinion:number;privateInterest:number;talents:number;pledges:number;promiseMarks:number;profile:string};
}
