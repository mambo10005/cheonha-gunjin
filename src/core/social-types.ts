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
  dialogueLog?: {source:string;round:number;text:string}[];
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
