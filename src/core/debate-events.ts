import type { DebateState } from './social-types.ts';
import {speechLine,opponentLine} from '../data/debate-dialogue.ts';

export type DebateEventKind = 'actionUsed' | 'costSpent' | 'resourceSpent' | 'speechStarted' | 'argumentApplied' | 'trustChanged' | 'burdenChanged' | 'traitTriggered' | 'followupUnlocked' | 'opponentResponded' | 'opponentCountered' | 'requirementSatisfied' | 'debateResolved';
export interface DebateEvent {
  kind: DebateEventKind; source: string; target: string; value: number; resource: string;
  reason: string; visualPriority: 1 | 2 | 3; sequence: number;
}
export function finalizeDebateEvents(events:DebateEvent[],state?:DebateState):DebateEvent[]{
  if(state){
    if(!events.some(e=>e.kind==='opponentCountered'))events.push({kind:'opponentResponded',source:state.opponentId,target:state.generalId,value:0,resource:'dialogue',reason:opponentLine(state),visualPriority:1,sequence:events.length});
    const lines=events.filter(e=>['speechStarted','opponentCountered','opponentResponded'].includes(e.kind));
    state.dialogueLog=[...(state.dialogueLog??[]),...lines.map(e=>({source:e.source,round:Math.max(0,state.round-1),text:e.reason}))].slice(-10);
  }
  const rank:Record<DebateEventKind,number>={actionUsed:0,costSpent:1,resourceSpent:1,speechStarted:2,argumentApplied:3,trustChanged:3,burdenChanged:3,traitTriggered:4,followupUnlocked:4,opponentResponded:5,opponentCountered:5,requirementSatisfied:6,debateResolved:8};
  return [...events].sort((a,b)=>(rank[a.kind]-rank[b.kind])||a.sequence-b.sequence).map((event,sequence)=>({...event,sequence}));
}
// This short-lived receipt is returned by the core, never saved or replayed on load.
export function debateReceipt(s: DebateState, action: string) {
  const events: DebateEvent[] = [];
  const emit = (kind: DebateEventKind, target: string, value: number, resource: string, reason: string, visualPriority: 1 | 2 | 3 = 1, source = s.generalId) => {
    if(kind==='speechStarted')reason=speechLine(s,action);
    events.push({kind, source, target, value, resource, reason, visualPriority, sequence: events.length});
  };
  emit('actionUsed', action, 0, 'action', action);
  return { events, emit };
}
