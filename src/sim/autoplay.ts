import { activeAgreements, reachableNodes } from '../core/accords.ts';
import { chooseDoctrine } from '../core/build.ts';
// 헤드리스 자동 플레이. 규칙 엔진만 사용하므로 UI 없이 Node에서 돌아간다.
// 탐욕적(1수 앞) 봇이며 사람의 판단·재미를 대신하지 않는다. 밸런스 이상치를 찾는 용도.
import { CARDS } from '../data/cards.ts';
import { socialBotStep } from './social-policy.ts';
import { EVENTS } from '../data/events.ts';
import { GENERALS } from '../data/generals.ts';
import { aliveEnemies, canPlay, cardDef, endTurn, incomingEstimate as incomingPreview, playCard } from '../core/combat.ts';
import {
  availableMoves,
  buyRelic,
  chooseEvent,
  chooseRecruit,
  deckPick,
  eventOptionAllowed,
  finishBattle,
  generalAffinities,
  leaveNode,
  moveTo,
  newRun,
  pickRewardCard,
  pickRewardExtra,
  replaceGeneral,
  restDrill,
  restHeal,
  supplyChoose,
} from '../core/run.ts';
import type { BattleState, Difficulty, PlayTarget, Row, RunState, MapNode } from '../core/types.ts';

function evalState(b: BattleState): number {
  if (b.result === 'win') return 1e6;
  if (b.result === 'lose') return -1e6;
  const inc = incomingPreview(b);
  let s = 0;
  for (const e of b.enemies) {
    if (e.dead) {
      s += 40;
      continue;
    }
    s -= e.hp + e.block * 0.5;
    s += Math.min(e.burn, e.hp) * 0.8;
    if (e.confused || e.turncoat) s += 4;
  }
  s -= (inc.front.net + inc.rear.net) * 1.3;
  for (const r of ['front', 'rear'] as Row[]) {
    const attackers = aliveEnemies(b).filter((e) => e.intent?.kind === 'attack' && (e.intent.row === r || e.intent.row === 'both')).length;
    s += b.counter[r] * attackers * 0.8;
  }
  s += b.hp * 1.5;
  s += b.energy * 2 + b.hand.length * 0.8;
  return s;
}

function candidates(b: BattleState): { idx: number; target: PlayTarget }[] {
  const out: { idx: number; target: PlayTarget }[] = [];
  b.hand.forEach((c, idx) => {
    const d = cardDef(c);
    if (d.target === 'enemy') for (const e of aliveEnemies(b)) out.push({ idx, target: { enemy: e.uid } });
    else if (d.target === 'row') for (const row of ['front', 'rear'] as Row[]) out.push({ idx, target: { row } });
    else out.push({ idx, target: {} });
  });
  return out.filter((c) => canPlay(b, c.idx, c.target).ok);
}

export function botTurn(b: BattleState): void {
  for (let guard = 0; guard < 30 && b.result === 'ongoing'; guard++) {
    const base = evalState(b);
    let best: { idx: number; target: PlayTarget; score: number } | null = null;
    for (const c of candidates(b)) {
      const sim = structuredClone(b);
      playCard(sim, c.idx, c.target);
      const score = evalState(sim) - base;
      if (!best || score > best.score) best = { ...c, score };
    }
    if (!best || best.score <= 0.1) break;
    playCard(b, best.idx, best.target);
  }
  if (b.result === 'ongoing') endTurn(b);
}

function nodeScore(run: RunState, type: string): number {
  const ratio = run.hp / run.maxHp;
  switch (type) {
    case 'rest':
      return ratio < 0.5 ? 10 : 2;
    case 'supply':
      return ratio < 0.5 ? 8 : run.food < 4 ? 7 : 3;
    case 'elite':
      return ratio > 0.7 ? 6 : -5;
    case 'battle':
      return 5;
    case 'recruit':
      return run.generals.length < 4 ? 7 : 1;
    case 'market':
      return run.food >= 8 ? 6 : 1;
    case 'event':
      return 4;
    default:
      return 0;
  }
}

/** 덱의 공격 비율이 낮으면 공격 카드를, 아니면 장수 성향에 맞는 카드를 고른다. */
function botPickCard(run: RunState, options: string[]): string | null {
  if (options.length === 0) return null;
  const isAttack = (id: string) => CARDS[id].effects.some((e) => e.k.startsWith('dmg') || e.k === 'burn' || e.k === 'burnAll');
  const ratio = run.deck.filter((c) => isAttack(c.id)).length / run.deck.length;
  const aff = new Set(generalAffinities(run));
  const fits = (id: string) => aff.has(CARDS[id].family) || CARDS[id].tags.some((t) => aff.has(t)) || (CARDS[id].synergy ?? []).some((t) => aff.has(t));
  const score = (id: string) => (fits(id) ? 2 : 0) + (isAttack(id) ? (ratio < 0.5 ? 3 : 0) : ratio >= 0.5 ? 1 : 0) + (CARDS[id].rarity === 'rare' ? 1 : 0);
  return options.reduce((a, x) => (score(x) > score(a) ? x : a));
}

export interface SimResult {
  won: boolean;
  floor: number;
  hp: number;
  killedBy: string | null;
  generals: string[];
  turns: number;
}

export function simulateRun(
  seed: number,
  lordId: string,
  difficulty: Difficulty = 0,
  unlocked: string[] = [],
  onBattleEnd?: (b: BattleState, run: RunState) => void,
  configure?: (run:RunState)=>void,
  chooseMove?: (run:RunState,options:MapNode[])=>MapNode,
): SimResult {
  const run = newRun(seed, lordId, difficulty, unlocked);
  configure?.(run);
  chooseDoctrine(run, ['bastion', 'breakthrough', 'scheme'][seed % 3]);
  let turns = 0;
  let killedBy: string | null = null;
  for (let step = 0; step < 2000; step++) {
    if (run.screen === 'victory' || run.screen === 'defeat') break;
    if (run.screen === 'map') {
      const moves = availableMoves(run);
      const obligations=activeAgreements(run).flatMap(a=>[a.target,...(a.supply && a.stage==='waiting'?[a.supply]:[])]);
      const compliant=moves.filter(n=>obligations.every(c=>c.floor<n.floor || c.floor===n.floor && c.col===n.col || c.floor>n.floor && reachableNodes(run,n).some(r=>r.floor===c.floor && r.col===c.col)));
      const options=compliant.length?compliant:moves;
      const chosen = chooseMove?.(run,options);
      const best = chosen&&options.includes(chosen)?chosen:options.reduce((a, n) => (nodeScore(run, n.type) > nodeScore(run, a.type) ? n : a));
      moveTo(run, best.col);
      continue;
    }
    if (run.screen === 'battle' && run.battle) {
      const b = run.battle;
      while (b.result === 'ongoing' && b.turn < 60) {
        botTurn(b);
        turns++;
      }
      if (b.result === 'ongoing') b.result = 'lose';
      if (b.result === 'lose') killedBy = b.encounterId;
      onBattleEnd?.(b, run);
      finishBattle(run);
      continue;
    }
    if (socialBotStep(run)) continue;
    const p = run.pending;
    switch (p.kind) {
      case 'reward': {
        if (!p.picked) {
          pickRewardCard(run, botPickCard(run, p.cards));
        }
        if (p.extra && !p.extra.picked) pickRewardExtra(run, p.extra.options[0]);
        leaveNode(run);
        break;
      }
      case 'recruit':
        chooseRecruit(run, p.options[0] ?? null);
        break;
      case 'replaceGeneral':
        replaceGeneral(run, null);
        break;
      case 'market':
        if (p.relic && !p.relic.sold && run.food >= p.relic.price + 3) buyRelic(run);
        leaveNode(run);
        break;
      case 'rest':
        if (run.hp / run.maxHp < 0.75 && run.food >= 2) restHeal(run);
        else restDrill(run);
        break;
      case 'supply':
        supplyChoose(run, activeAgreements(run).some(a=>a.clause==='escort' && a.stage==='waiting' && a.supply?.floor===run.floor && a.supply.col===run.col) ? 'food' : run.hp / run.maxHp < 0.5 ? 'hp' : 'food');
        break;
      case 'event': {
        if (p.resultText) {
          leaveNode(run);
          break;
        }
        const n = EVENTS[p.eventId].options.length;
        let chosen = n - 1;
        for (let i = 0; i < n; i++) if (eventOptionAllowed(run, p.eventId, i)) { chosen = i; break; }
        chooseEvent(run, chosen);
        break;
      }
      case 'deckPick': {
        const junk = run.deck.find((c) => CARDS[c.id].rarity === 'curse') ?? run.deck.find((c) => c.id === 'spear' || c.id === 'formation');
        if (p.mode === 'remove') deckPick(run, junk?.uid ?? null);
        else deckPick(run, run.deck.find((c) => CARDS[c.id].rarity === 'rare')?.uid ?? run.deck[0].uid);
        break;
      }
      case 'none':
        leaveNode(run);
        break;
    }
  }
  return {
    won: run.screen === 'victory',
    floor: run.floor,
    hp: run.hp,
    killedBy: killedBy ?? (run.screen === 'defeat' ? '군량 고갈' : null),
    generals: run.generals.map((g) => GENERALS[g.id].name),
    turns,
  };
}
