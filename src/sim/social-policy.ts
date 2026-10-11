import {deckPolicyAction,deckRewardPolicy} from './debate-deck-policy.ts';
import { ARGUMENTS } from '../data/arguments.ts';
import { CLAUSES, agreementQuote, signAgreement, resetCouncil, declineCouncil } from '../core/accords.ts';
import type { DebateState } from '../core/social-types.ts';
import { availableTactics } from '../data/tactics.ts';
import { chooseGrowth, GROWTH } from '../core/build.ts';
import { DEBATE_ACTIONS, DUEL_ACTIONS } from '../data/social.ts';
import { GENERALS } from '../data/generals.ts';
import { previewDuelAction } from '../core/duel.ts';
import { previewDebateAction } from '../core/debate.ts';
import { acceptDiplomacy, acceptDuel, acceptParley, actDebate, actDuel, beginDebate, finishDebate, finishDuel, parleyTerms, quoteForRun } from '../core/social-run.ts';
import { leaveNode } from '../core/run.ts';
import type { RunState } from '../core/types.ts';
import type { DebateAction } from '../core/social-types.ts';

/** 한 수 미리보기 기반. 장기 협정 가치나 최적 대표 조합을 탐색하지 않는다. */
export function socialBotStep(run: RunState): boolean {
  const p = run.pending;
  switch (p.kind) {
    case 'debateReward':deckRewardPolicy(run);return true;
    case 'growth': {
      const dir = run.build.doctrines[0];
      const candidates = Object.entries(GROWTH).filter(([, d]) => d.direction === dir);
      // This bot favors the damage branch; it cannot yet plan the value of extra draws.
      let branch = (candidates.find(([, d]) => d.rules.some(rule => rule.trigger === 'spent' && rule.operations.some(op => op.kind === 'damage'))) ?? candidates[0])[0];
      if (p.general && run.build.growth[p.general]) branch = run.build.growth[p.general].branch;
      const general = run.generals.find(g => (!p.general || p.general === g.id) && (!run.build.growth[g.id] || run.build.growth[g.id].branch === branch && run.build.growth[g.id].level < 2));
      chooseGrowth(run, general ? branch : 'recover', general?.id ?? ''); return true;
    }
    case 'duelOffer': {
      const value = (id: string) => GENERALS[id].activities!.duel + (run.build.growth[id]?.level ?? 0) * 3;
      const general = run.generals.reduce((a, b) => value(a.id) >= value(b.id) ? a : b);
      const tactics = availableTactics(run.build, general.id, run.deck);
      const preferred = run.build.doctrines[0] === 'bastion' ? 'brace' : run.build.doctrines[0] === 'scheme' ? 'feint' : 'sacrifice';
      acceptDuel(run, general.id, [preferred, 'breathe'].filter(t => tactics.includes(t as typeof tactics[number]))); return true;
    }
    case 'duel': {
      if (p.state.result !== 'ongoing') finishDuel(run, p.state.result === 'win' && !p.state.rewardClaimed && run.build.doctrines.length ? 'growth' : 'opening');
      else {
        const options = ([...Object.keys(DUEL_ACTIONS), ...(p.state.tactics ?? [])]).map(action => ({ action, ...previewDuelAction(p.state, action) })).filter(o => o.check.ok);
        const score = (o: typeof options[number]) => o.state.result === 'win' ? 1000 : o.state.result === 'lose' ? -1000 : o.state.hp - o.state.enemyHp + o.state.momentum;
        const best = options.reduce((a, b) => score(a) >= score(b) ? a : b);
        actDuel(run, best.action, p.state.round);
      }
      return true;
    }
    case 'parley':
      if (!p.negotiated && run.food >= 1) {
        const specialized=run.generals.filter(g=>['guojia','chengong'].includes(g.id));
        const representative=run.debateBuild.enabled&&specialized.length?specialized[(run.seed+run.floor)%specialized.length]:run.generals.reduce((a,b)=>GENERALS[a.id].activities!.debate>=GENERALS[b.id].activities!.debate?a:b);
        if (beginDebate(run, representative.id).ok) return true;
      }
      acceptParley(run, run.food >= parleyTerms(run).cost); return true;
    case 'debate': {
      if (p.state.result !== 'ongoing') finishDebate(run);
      else if(p.state.deck){actDebate(run,deckPolicyAction(p.state),p.state.deck.revision);}
      else {
        const options = (Object.keys(p.state.negotiation ? ARGUMENTS : DEBATE_ACTIONS) as DebateAction[]).map(action => ({ action, ...previewDebateAction(p.state, action) })).filter(o => o.check.ok);
        const score = (o: typeof options[number]) => p.state.negotiation ? negotiationPlanScore(o.state) : o.state.agreement + Math.min(2, o.state.trust) + o.state.resolve * 0.3;
        const best = options.reduce((a, b) => score(a) >= score(b) ? a : b);
        actDebate(run, best.action, p.state.round);
      }
      return true;
    }
    case 'council': {
      if (p.negotiated?.result === 'failure') {resetCouncil(run);return true;}
      const clause=Object.keys(CLAUSES).find(id => { const q=agreementQuote(run,id); return !q.reason && run.food >= q.cost; });
      if (!clause) {declineCouncil(run);return true;}
      const specialists=run.generals.filter(g=>['guojia','chengong'].includes(g.id));
      const general=run.debateBuild.enabled&&specialists.length?specialists[(run.seed+run.floor)%specialists.length]:run.generals.reduce((a,b)=>GENERALS[a.id].activities!.debate>=GENERALS[b.id].activities!.debate?a:b);
      if (!p.negotiated && !run.social.used.includes(run.floor+':'+run.col+':debate') && run.food>=agreementQuote(run,clause).cost+3) beginDebate(run,general.id,clause);
      else signAgreement(run,clause,general.id); return true;
    }
    case 'diplomacy': {
      const choices = p.negotiated ? [p.negotiated.trade] : ['support', 'passage', 'supply'] as const;
      const trade = choices.find(t => { const q = quoteForRun(run, t)!; return !q.reason && run.food >= q.cost + 1; });
      acceptDiplomacy(run, trade ?? null); return true;
    }
    case 'socialResult': leaveNode(run); return true;
    default: return false;
  }
}

/** Four remaining choices exhaustively evaluated on cloned states, including real resource costs. */
export function negotiationPlanScore(s: DebateState): number {
 if (s.result !== 'ongoing') return (s.result==='success'?100:s.result==='partial'?20:-50) + s.negotiation!.food * 0.15 - (s.negotiation!.promise?1:0);
 return Math.max(...Object.keys(ARGUMENTS).map(a=>previewDebateAction(s,a)).filter(p=>p.check.ok).map(p=>negotiationPlanScore(p.state)));
}
