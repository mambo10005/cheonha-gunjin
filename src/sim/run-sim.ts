// 사용법: node src/sim/run-sim.ts [원정 수=200] [난이도=0]
import { simulateRun } from './autoplay.ts';
import type { Difficulty } from '../core/types.ts';

const N = Number(process.argv[2] ?? 200);
const diff = Number(process.argv[3] ?? 0) as Difficulty;

for (const lord of ['caocao', 'sunquan']) {
  let wins = 0;
  let floors = 0;
  let turns = 0;
  const deaths: Record<string, number> = {};
  for (let i = 1; i <= N; i++) {
    const r = simulateRun(i * 7919, lord, diff);
    if (r.won) wins++;
    floors += r.floor + 1;
    turns += r.turns;
    if (!r.won && r.killedBy) deaths[r.killedBy] = (deaths[r.killedBy] ?? 0) + 1;
  }
  const top = Object.entries(deaths).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(' ');
  console.log(`${lord} 난이도${diff} | 승률 ${((wins / N) * 100).toFixed(1)}% | 평균 도달 ${(floors / N).toFixed(2)}층 | 평균 전투턴 ${(turns / N).toFixed(1)} | 패배 원인 ${top}`);
}
