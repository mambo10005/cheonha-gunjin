import { createBattle, type BattleSetup } from '../src/core/combat.ts';
import type { BattleState, Intent } from '../src/core/types.ts';

export interface MkOpts extends Partial<BattleSetup> {
  hand?: string[];
  drawPile?: string[];
  intents?: (Intent | null)[];
  enemyHp?: number[];
}

/** 시험용 전투. 손패·더미·적 의도를 직접 지정해 우연을 없앤다. */
export function mk(o: MkOpts = {}): BattleState {
  const b = createBattle({
    rng: 42,
    hp: 60,
    maxHp: 60,
    food: 5,
    deck: [],
    generals: [],
    relics: [],
    lordId: 'none',
    terrain: 'plains',
    encounterId: 'test',
    enemies: ['ytsoldier'],
    difficulty: 0,
    allyBlessing: false,
    ...o,
  });
  let uid = 1000;
  if (o.hand) b.hand = o.hand.map((id) => ({ uid: uid++, id }));
  if (o.drawPile) b.draw = o.drawPile.map((id) => ({ uid: uid++, id }));
  if (o.intents) o.intents.forEach((it, i) => (b.enemies[i].intent = it));
  if (o.enemyHp) o.enemyHp.forEach((hp, i) => (b.enemies[i].hp = hp));
  for (const e of b.enemies) e.block = 0;
  b.log = [];
  return b;
}

export const atk = (row: 'front' | 'rear' | 'both', dmg: number, hits = 1): Intent => ({ kind: 'attack', row, dmg, hits });
export const idle: Intent = { kind: 'block', n: 0 };

export function logText(b: BattleState): string {
  return b.log.map((l) => l.text).join('\n');
}
