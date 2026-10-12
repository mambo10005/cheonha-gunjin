import type { AccordState, ClauseId, Negotiation, NegotiatedTerms } from './accord-types.ts';
import type { BuildRuntime } from './build.ts';
import type { TacticId } from '../data/tactics.ts';
export type Check = { ok: boolean; reason?: string; events?: import('./debate-events.ts').DebateEvent[] };
export type ActivityTrait = 'parry' | 'surge' | 'composure' | 'insight' | 'mediator' | 'quartermaster' | 'envoy';
export interface ActivityProfile { duel: number; debate: number; traits: ActivityTrait[] }
export type DuelAction = 'strike' | 'probe' | 'guard' | 'finisher';
export type DuelResult = 'ongoing' | 'win' | 'lose' | 'draw' | 'surrender';
export interface DuelState {
  rewardClaimed?: boolean;
  build?: BuildRuntime;
  tactics?: TacticId[]; usedTactics?: TacticId[];
  protection?: number; enemyShield?: number;
  /** 거병 카드 엔진의 대결 전술 3장(선제·대응·승부수). */
  loadout?: { opening: string | null; response: string | null; gambit: string | null; used: string[]; revealed?: boolean };
  /** 성문 내응 전환: 기습(첫 합 무효)·호위 지원 제거·반격 추가 피해. */
  initiative?: boolean; noSupport?: boolean; counterBonus?: number;
  /** 대결 2판(거리·자세·빈틈·지원). 전위 뒤뜰 시험·창고 호위 대표·군영 장악·성문 내응 후속 대결에만 적용. */
  v2?: { objective: string; distance: 'near' | 'mid' | 'far'; stance: 'offense' | 'defense' | 'lure' | null; opening: boolean; openingSource: string | null; support: number; revealed: number; profile: string;
    stats: { rounds: number; taken: number; dealt: number; maxHit: number; forceHit?: number; forceOverkill?: number; counters: number; openingsUsed: number; blindFinishers: number; overkill: number; repeats: number; actions: string[]; distances: string[]; stances: string[]; enemyActions: string[] } };
  lastMode?: DuelAction;
  rng: number; opponentId: string; generalId: string; round: number; maxRounds: number;
  hp: number; maxHp: number; enemyHp: number; enemyMaxHp: number; momentum: number;
  aptitude: number; traits: ActivityTrait[]; pattern: DuelAction[]; patternOffset: number;
  lastAction: DuelAction | null; result: DuelResult; log: string[];
}
export type Concern = 'profit' | 'honor' | 'trust' | 'safety';
export type DebateAction = 'evidence' | 'rebuttal' | 'concede' | 'proposal';
export type DebateResult = 'ongoing' | 'success' | 'partial' | 'failure';
export type FactionId = 'caravan' | 'militia' | 'villages';
export type TradeId = 'supply' | 'passage' | 'support';
export type DebateContext = { kind: 'recruit'; candidate: string } | { kind: 'supply' } | { kind: 'diplomacy'; faction: FactionId; trade: TradeId } | { kind: 'agreement'; faction: FactionId; clause: ClauseId };
export interface DebateState {
  deck?: import('./debate-deck-types.ts').DeckRuntime;
  dialogueLog?: {source:string;round:number;text:string}[];
  /** 카드 엔진: 설전 시작 때 적용한 지속 논거 수(보존 판정용)와 평가 맥락. */
  engineArgs?: { initial: number; record: number; context: string };
  negotiation?: Negotiation;
  rng: number; opponentId: string; generalId: string; round: number; maxRounds: number;
  resolve: number; agreement: number; trust: number; aptitude: number; traits: ActivityTrait[];
  concerns: Concern[]; revealed: Concern[]; lastAction: DebateAction | null;
  result: DebateResult; context: DebateContext; log: string[];
}
export interface TradeQuote {
  trade: TradeId; faction: FactionId; cost: number; food: number; moves: number;
  block: number; damage: number; rewardPenalty: number; relationDelta: number; reason?: string;
}
export interface SocialState {
  protocol: 'legacy' | 'clauses';
  accords: AccordState;
  relations: Record<FactionId, number>; used: string[]; duels: number;
  passage: { moves: number; discount: number } | null;
  support: { block: number; damage: number; rewardPenalty: number } | null;
}
export type SocialPending = { kind: 'council'; faction: FactionId; negotiated?: { clause: ClauseId; result: DebateResult; terms: NegotiatedTerms } }
  | { kind: 'duelOffer'; opponentId: string }
  | { kind: 'duel'; state: DuelState }
  | { kind: 'parley'; mode: 'recruit'; candidate: string; negotiated?: DebateResult; terms?: NegotiatedTerms }
  | { kind: 'parley'; mode: 'supply'; negotiated?: DebateResult; terms?: NegotiatedTerms }
  | { kind: 'debate'; state: DebateState }
  | { kind: 'diplomacy'; faction: FactionId; negotiated?: { trade: TradeId; result: DebateResult } }
  | { kind: 'socialResult'; text: string };
