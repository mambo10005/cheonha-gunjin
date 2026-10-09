import { test } from 'node:test';
import assert from 'node:assert/strict';
import { endTurn, playCard } from '../src/core/combat.ts';
import {
  availableMoves,
  BOSS_FLOOR,
  chooseEvent,
  chooseRecruit,
  defaultMeta,
  finishBattle,
  leaveNode,
  moveTo,
  newRun,
  pickRewardCard,
  recordRunEnd,
  replaceGeneral,
  restHeal,
} from '../src/core/run.ts';
import { clearRun, loadMeta, loadRun, memoryKV, saveMeta, saveRun, RUN_KEY } from '../src/core/save.ts';
import { simulateRun } from '../src/sim/autoplay.ts';
import type { RunState } from '../src/core/types.ts';

function toFirstBattle(run: RunState): void {
  const battleCol = run.map[0].find((n) => n.type === 'battle')!.col;
  assert.ok(moveTo(run, battleCol).ok);
  assert.equal(run.screen, 'battle');
}

test('지도: 모든 층이 연결되고 마지막은 보스', () => {
  const run = newRun(123, 'caocao');
  assert.equal(run.map.length, BOSS_FLOOR + 1);
  assert.equal(run.map[BOSS_FLOOR][0].type, 'boss');
  for (let f = 0; f < BOSS_FLOOR; f++) for (const n of run.map[f]) assert.ok(n.next.length > 0);
  assert.equal(availableMoves(run).length, 3);
});

test('이동하면 지형에 따라 군량을 쓰고, 모자라면 병력을 잃는다', () => {
  const run = newRun(7, 'sunquan');
  run.map[0][0].terrain = 'mountain';
  run.food = 1;
  moveTo(run, 0);
  assert.equal(run.food, 0);
  assert.equal(run.hp, 55);
});

test('전투 승리 → 보상(군량·카드) 적용, 건너뛰면 군량 +2', () => {
  const run = newRun(99, 'caocao');
  toFirstBattle(run);
  const b = run.battle!;
  for (const e of b.enemies) e.hp = 1;
  b.hand = [{ uid: 9999, id: 'ironcav' }];
  b.energy = 3;
  playCard(b, 0);
  assert.equal(b.result, 'win');
  const foodBefore = run.food;
  const terrain = run.map[run.floor][run.col].terrain;
  finishBattle(run);
  assert.equal(run.screen, 'node');
  const p = run.pending;
  assert.equal(p.kind, 'reward');
  if (p.kind !== 'reward') return;
  assert.equal(run.food, foodBefore + 3 + (terrain === 'fortress' ? 4 : 0));
  const deckBefore = run.deck.length;
  assert.ok(pickRewardCard(run, p.cards[0]).ok);
  assert.equal(run.deck.length, deckBefore + 1);
  assert.equal(pickRewardCard(run, p.cards[1]).ok, false, '보상은 한 번만');
  assert.ok(leaveNode(run).ok);
  assert.equal(run.screen, 'map');

  const run2 = newRun(99, 'caocao');
  toFirstBattle(run2);
  for (const e of run2.battle!.enemies) e.dead = true;
  run2.battle!.result = 'win';
  finishBattle(run2);
  const f = run2.food;
  pickRewardCard(run2, null);
  assert.equal(run2.food, f + 2);
});

test('전투 패배 → 원정 패배와 원인 분석', () => {
  const run = newRun(5, 'caocao');
  toFirstBattle(run);
  const b = run.battle!;
  b.hp = 1;
  b.hand = [];
  for (const e of b.enemies) e.intent = { kind: 'attack', row: 'rear', dmg: 10, hits: 1 };
  endTurn(b);
  assert.equal(b.result, 'lose');
  finishBattle(run);
  assert.equal(run.screen, 'defeat');
  assert.ok(run.defeatReason.some((l) => l.includes('후열')), run.defeatReason.join('\n'));
});

test('장수 영입: 진형이 가득 차면 교체를 고른다', () => {
  const run = newRun(1, 'caocao');
  run.generals = [
    { id: 'dianwei', row: 'front' },
    { id: 'caoren', row: 'front' },
    { id: 'guojia', row: 'rear' },
    { id: 'luxun', row: 'rear' },
  ];
  run.screen = 'node';
  run.pending = { kind: 'recruit', options: ['lubu', 'zhangliao'] };
  chooseRecruit(run, 'lubu');
  assert.equal(run.pending.kind, 'replaceGeneral');
  replaceGeneral(run, 'guojia');
  assert.deepEqual(run.generals.map((g) => g.id).sort(), ['caoren', 'dianwei', 'lubu', 'luxun']);
  assert.equal(run.generals.find((g) => g.id === 'lubu')!.row, 'rear', '떠난 장수의 자리를 이어받는다');
});

test('휴식 회복은 최대 병력을 넘지 않는다', () => {
  const run = newRun(1, 'caocao');
  run.screen = 'node';
  run.pending = { kind: 'rest' };
  run.hp = 55;
  restHeal(run);
  assert.equal(run.hp, 60);
  assert.equal(run.food, 8);
});

test('사건: 기회비용 선택이 원정 상태를 바꾼다', () => {
  const run = newRun(1, 'caocao');
  run.screen = 'node';
  run.pending = { kind: 'event', eventId: 'village' };
  chooseEvent(run, 1);
  assert.equal(run.food, 17);
  assert.ok(run.deck.some((c) => c.id === 'unrest'));
  assert.ok(leaveNode(run).ok);

  run.screen = 'node';
  run.pending = { kind: 'event', eventId: 'alliance' };
  chooseEvent(run, 0);
  assert.equal(run.flags.allyBlessing, true);
  assert.equal(run.flags.rewardPenalty, 2);
});

test('동일 시드는 같은 원정을 재현한다', () => {
  const a = newRun(2024, 'sunquan');
  const b = newRun(2024, 'sunquan');
  assert.deepEqual(a, b);
  const r1 = simulateRun(31337, 'caocao');
  const r2 = simulateRun(31337, 'caocao');
  assert.deepEqual(r1, r2);
  const r3 = simulateRun(31338, 'caocao');
  assert.notDeepEqual(newRun(31337, 'caocao').map, newRun(31338, 'caocao').map);
  assert.ok(r3);
});

test('저장과 불러오기: 전투 도중 저장해도 같은 결과로 이어진다', () => {
  const kv = memoryKV();
  const run = newRun(4242, 'sunquan');
  toFirstBattle(run);
  saveRun(kv, run);
  const loaded = loadRun(kv);
  assert.ok(loaded.ok);
  if (!loaded.ok) return;
  assert.deepEqual(loaded.data, run);
  // 같은 행동을 양쪽에 적용하면 같은 상태
  for (const r of [run, loaded.data]) {
    const b = r.battle!;
    playCard(b, b.hand.findIndex((c) => c.id === 'spear'), { enemy: b.enemies[0].uid });
    endTurn(b);
  }
  assert.deepEqual(loaded.data, run);
  clearRun(kv);
  assert.deepEqual(loadRun(kv), { ok: false, reason: 'none' });
});

test('버전이 다르거나 손상된 저장은 불러오지 않는다', () => {
  const kv = memoryKV();
  kv.setItem(RUN_KEY, JSON.stringify({ version: 999, data: {} }));
  assert.deepEqual(loadRun(kv), { ok: false, reason: 'version' });
  kv.setItem(RUN_KEY, '{망가진');
  assert.deepEqual(loadRun(kv), { ok: false, reason: 'corrupt' });
});

test('메타: 첫 승리로 장수·난이도가 해금되고 저장된다', () => {
  const kv = memoryKV();
  const meta = defaultMeta();
  const run = newRun(1, 'caocao');
  const msgs = recordRunEnd(meta, run, true);
  assert.equal(msgs.length, 3);
  assert.deepEqual(meta.unlockedGenerals, ['chengong', 'machao']);
  saveMeta(kv, meta);
  assert.deepEqual(loadMeta(kv), meta);
  assert.equal(recordRunEnd(meta, run, true).length, 0, '중복 해금 없음');
  const unlockedRun = newRun(1, 'caocao', 1, meta.unlockedGenerals);
  assert.equal(unlockedRun.food, 7, '험로는 시작 군량 -3');
});

test('자동 플레이: 여러 시드에서 오류 없이 끝까지 진행된다', () => {
  for (let s = 1; s <= 30; s++) {
    for (const lord of ['caocao', 'sunquan']) {
      const r = simulateRun(s * 101, lord);
      assert.ok(r.won || r.killedBy !== null || r.floor >= 0, `seed ${s} ${lord}`);
    }
  }
});
