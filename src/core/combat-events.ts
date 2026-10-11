import type {BattleState, Row, Intent} from './types.ts';
export type CombatEventKind='battleStarted'|'terrainApplied'|'cardCommitted'|'commandSpent'|'formationMoved'|'defenseGained'|'attackStarted'|'damageBlocked'|'damageDealt'|'unitDefeated'|'intentChanged'|'counterPrepared'|'counterTriggered'|'commanderAbilityTriggered'|'doctrineTriggered'|'statusApplied'|'cardDrawn'|'cardDiscarded'|'cardExhausted'|'enemyTurnStarted'|'turnStarted'|'battleResolved'|'phaseChanged'|'chainLimited';
export interface CombatEvent {
 kind:CombatEventKind; sequence:number; source:string; generalId?:string; target?:number|'army'; lane?:Row;
 amount?:number; blocked?:number; remaining?:number; reason:string; intent?:Intent|null;
 visualPriority:1|2|3; simultaneousGroup?:number; state:BattleState;
}
export type CombatFact=Omit<CombatEvent,'state'>;
type EventInput=Omit<CombatEvent,'sequence'|'state'|'visualPriority'> & {visualPriority?:1|2|3};
// Presentation subscriptions are deliberately outside saved state. Headless play incurs no snapshots.
const subscriptions=new WeakMap<BattleState,{sequence:number;receive:(event:CombatFact)=>void}>();
export function combatEvent(b:BattleState,event:EventInput):void {
 const sink=subscriptions.get(b);if(!sink)return;
 sink.receive({...event,visualPriority:event.visualPriority??1,sequence:sink.sequence++});
}
export function captureCombat<T>(b:BattleState,action:()=>T):{result:T;events:CombatEvent[]} {
 if(subscriptions.has(b))throw new Error('Nested combat capture is not supported');
 const events:CombatEvent[]=[];subscriptions.set(b,{sequence:0,receive:event=>events.push({...event,state:structuredClone(b)})});
 try{return {result:action(),events};}finally{subscriptions.delete(b);}
}
/** Numeric previews need facts, not a full saved-state clone per presentation frame. */
export function captureCombatFacts<T>(b:BattleState,action:()=>T):{result:T;events:CombatFact[]} {
 if(subscriptions.has(b))throw new Error('Nested combat capture is not supported');
 const events:CombatFact[]=[];subscriptions.set(b,{sequence:0,receive:event=>events.push(event)});
 try{return {result:action(),events};}finally{subscriptions.delete(b);}
}
