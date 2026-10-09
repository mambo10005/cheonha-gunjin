import { configureBuildDemo } from '../core/build-demo.ts';
import type { Direction } from '../core/build.ts';
import { newRun, moveTo, finishBattle, pickRewardCard, pickRewardExtra, leaveNode, restHeal } from '../core/run.ts';
import { botTurn } from './autoplay.ts';
import { socialBotStep } from './social-policy.ts';

/** Executes the actual 8-floor demo route. A loss is reported, never replaced by a forced win. */
export function runBuildScenario(direction: Direction) {
  const run = newRun(41001, 'caocao'); configureBuildDemo(run, direction);
  const finishedDuels = new Set<string>();
  let battleChains = 0, duelChains = 0, firstGrowthFloor = -1;
  for (let step = 0; step < 500; step++) {
    if (run.screen === 'victory' || run.screen === 'defeat') return { direction, result: run.screen, floor: run.floor + 1, battleChains, duelChains, firstGrowthFloor, build: run.build };
    if (run.screen === 'map') { moveTo(run, 0); continue; }
    if (run.battle) {
      const b = run.battle;
      for (let turn = 0; turn < 60 && b.result === 'ongoing'; turn++) botTurn(b);
      if (b.result === 'ongoing') throw new Error('전투 60턴 종료 한도.');
      battleChains += b.log.filter(l => l.text.includes('소비')).length;
      finishBattle(run); continue;
    }
    const p = run.pending;
    if (p.kind === 'duel' && p.state.result !== 'ongoing' && !finishedDuels.has(`${run.floor}:${run.col}`)) { finishedDuels.add(`${run.floor}:${run.col}`); duelChains += p.state.log.filter(l => l.includes('소비')).length; }
    if (socialBotStep(run)) {
      if (firstGrowthFloor === -1 && Object.keys(run.build.growth).length) firstGrowthFloor = run.floor + 1;
      continue;
    }
    if (p.kind === 'reward') {
      if (!p.picked) pickRewardCard(run, p.cards[0] ?? null);
      if (p.extra && !p.extra.picked) pickRewardExtra(run, p.extra.options[0] ?? null);
      leaveNode(run);
    } else if (p.kind === 'rest') { restHeal(run); if (run.pending.kind === 'rest') leaveNode(run); }
    else throw new Error(`처리하지 않은 검증 상태: ${p.kind}`);
  }
  throw new Error('검증 원정 진행 500회 한도.');
}
