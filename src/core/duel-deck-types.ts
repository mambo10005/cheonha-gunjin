/**
 * 대결 덱 상태. 대결 2판(v2: 거리·자세·빈틈·지원·통계)을 그대로 쓰고 카드 순환과 상대 의도를 더한다.
 * health=hp, opponentHealth=enemyHp, guard=protection, opponentGuard=enemyShield, distance/playerStance/opening=v2, exchange=round, exchangeLimit=maxRounds, rngState=rng.
 */
import type {OppKind,Stance,DuelFamily} from '../data/duel-cards.ts';
export interface DuelDeckCard {uid:number;id:string;source?:string;temporary?:boolean}
export interface OppIntent {uid:number;card:string;kind:OppKind;amount:number;concealed:boolean;forced?:boolean;dispersed?:boolean}
export interface DuelExchangeLog {exchange:number;cards:string[];intent:string;dealt:number;taken:number;distance:string;stance:string;opening:boolean;oppOpening:boolean;notes:string[]}
export interface DuelDeck {
 version:1; archetype:string;
 cards:DuelDeckCard[]; draw:number[]; hand:number[]; discard:number[]; exhaust:number[]; nextUid:number; revision:number;
 /** 준비 전술 3장: 뽑는 더미에 섞지 않고 언제든 쓸 수 있는 자리(각 1회). 덱을 묽게 만들지 않는다. */ tacticHand:number[];
 points:number; pointsMax:number; handSize:number;
 oppCards:{uid:number;id:string}[]; oppDraw:number[]; oppDiscard:number[];
 intent:OppIntent|null; upcoming:OppIntent[]; revealed:number; conceal:boolean;
 oppMomentum:number; oppStance:Stance|null; oppOpening:boolean; oppOpeningAt:number; openingAt:number; oppNextBonus:number;
 fatigue:number; injuries:string[]; medicine:number; firstHitReduce:number;
 reactions:{kind:string;value:number;card:string}[]; blocked:DuelFamily[]; nextBlocked:DuelFamily[];
 readThisExchange:boolean; blindPenalty:number; secondReady:boolean; holdGuard:boolean;
 formalized:boolean; drawRank:number; officers:string[]; principleUsed:string[]; prepared:string[];
 played:{id:string;family:string}[]; attackExchanges:number; lastAttackCard?:string;
 stats:{cards:Record<string,number>;sequences:string[];guardBreaks:number;parries:number;lures:number;probes:number;supportRemoved:number;cleanHits:number;forcedIntents:number;counterHits:number;log:DuelExchangeLog[];/** 사건 평가용: 상대 의도에 맞춘 대응 합, 의도를 무시한 공격 합, 같은 공격 반복, 결사 일격을 쓴 합, 빈틈 있는 승부수. */readResponses?:number;ignoredIntents?:number;repeatAttacks?:number;gambitExchange?:number;openingGambits?:number};
}
