import type { FactionId } from './social-types.ts';
export type ClauseId = 'sponsorship' | 'escort' | 'operation';
export type Argument = 'evidence' | 'rebuttal' | 'concede' | 'proposal' | 'disclose' | 'pledge' | 'authority' | 'credential';
export type Axis = 'profit' | 'safety' | 'honor' | 'authority';
export interface Negotiation {
  scores: Record<Axis, number>; needs: Partial<Record<Axis, number>>;
  trustNeeded: number; burden: number; burdenLimit: number;
  food: number; paid: number; reports: number; credentials: number;
  concessionReady: boolean; promise: boolean;
  counter: { axis: Axis; amount: number; applied: boolean };
  lastArgument: Argument | null;
}
export interface NegotiatedTerms { deck?:boolean; penalty: number; paid: number; description: string }
export interface Coordinate { floor: number; col: number }
export interface Agreement {
  uid: number; clause: ClauseId; faction: FactionId;
  target: Coordinate; supply: Coordinate | null; beneficiary: string | null;
  stage: 'waiting' | 'armed'; status: 'active' | 'fulfilled' | 'broken' | 'expired';
  deposit: number; boosted: boolean; createdFloor: number;
}
export interface AccordState { nextUid: number; agreements: Agreement[] }
