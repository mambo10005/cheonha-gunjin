import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canPlay, endTurn, incomingPreview, moveGeneral, playCard, previewPlay } from '../src/core/combat.ts';
import { CARDS } from '../src/data/cards.ts';
import { describeCard } from '../src/core/describe.ts';
import { atk, idle, logText, mk } from './helpers.ts';

// ── 카드 비용과 지휘력 ──
test('카드 비용만큼 지휘력이 줄고, 부족하면 사용할 수 없다', () => {
  const b = mk({ hand: ['ironwall', 'ironwall'], terrain: 'river' });
  assert.equal(b.energy, 3);
  assert.ok(playCard(b, 0).ok);
  assert.equal(b.energy, 1);
  const r = playCard(b, 0);
  assert.equal(r.ok, false);
  assert.equal(r.reason, '지휘력 부족');
  assert.equal(b.hand.length, 1, '실패한 카드는 손패에 남는다');
});

test('산길: 매 턴 첫 策 카드만 비용 -1', () => {
  const b = mk({ hand: ['order', 'order'], terrain: 'mountain', drawPile: [] });
  playCard(b, 0);
  assert.equal(b.energy, 3, '첫 군령은 0');
  playCard(b, 0);
  assert.equal(b.energy, 2, '두 번째 군령은 1');
});

test('대상이 필요한 카드는 대상 없이 쓸 수 없다', () => {
  const b = mk({ hand: ['spear', 'formation'] });
  assert.equal(playCard(b, 0, {}).ok, false);
  assert.equal(playCard(b, 1, {}).ok, false);
  assert.ok(playCard(b, 1, { row: 'rear' }).ok);
  assert.equal(b.block.rear, 5);
});

test('군량이 없으면 징발을 쓸 수 없고, 쓰면 군량이 줄고 지휘력이 오른다', () => {
  const b = mk({ hand: ['requisition', 'requisition'], food: 1 });
  assert.ok(playCard(b, 0).ok);
  assert.equal(b.food, 0);
  assert.equal(b.energy, 5);
  assert.equal(canPlay(b, 0).reason, '군량 부족');
});

// ── 덱 소진과 재섞기 ──
test('뽑을 더미가 비면 버림패를 섞어 다시 뽑고, 카드 총수는 보존된다', () => {
  const deck = ['spear', 'spear', 'formation', 'formation', 'order', 'feint', 'volley'].map((id, i) => ({ uid: i + 1, id }));
  const b = mk({ deck, intents: [idle] });
  const total = () => b.draw.length + b.hand.length + b.discard.length + b.exhausted.length;
  assert.equal(b.hand.length, 5);
  assert.equal(b.draw.length, 2);
  endTurn(b);
  assert.equal(b.hand.length, 5);
  assert.equal(total(), 7);
  assert.match(logText(b), /버림패 5장을 섞어/);
  const uids = new Set([...b.draw, ...b.hand, ...b.discard].map((c) => c.uid));
  assert.equal(uids.size, 7, '카드가 복제되거나 사라지지 않는다');
});

test('소멸 카드는 버림패로 가지 않는다', () => {
  const b = mk({ hand: ['confuse'] });
  playCard(b, 0, { enemy: b.enemies[0].uid });
  assert.equal(b.exhausted.length, 1);
  assert.equal(b.discard.length, 0);
});

// ── 피해·방비·회복 ──
test('적 방비가 피해를 먼저 흡수한다', () => {
  const b = mk({ hand: ['spear'], enemyHp: [13] });
  b.enemies[0].block = 4;
  playCard(b, 0, { enemy: b.enemies[0].uid });
  assert.equal(b.enemies[0].block, 0);
  assert.equal(b.enemies[0].hp, 11);
});

test('열 방비가 그 열 공격만 막는다', () => {
  const b = mk({ hand: ['formation'], enemies: ['ytsoldier', 'ytsoldier'], intents: [atk('front', 6), atk('rear', 6)] });
  playCard(b, 0, { row: 'front' });
  endTurn(b);
  assert.equal(b.hp, 60 - 1 - 6, '전열은 5 막고 1, 후열은 6 그대로');
  assert.equal(b.stats.rowTaken.front, 1);
  assert.equal(b.stats.rowTaken.rear, 6);
});

test('방비는 다음 내 턴 시작에 사라진다(조인은 전열 절반 유지)', () => {
  const b1 = mk({ hand: ['ironwall'], intents: [idle], terrain: 'river' });
  playCard(b1, 0);
  endTurn(b1);
  assert.equal(b1.block.front, 0);
  const b2 = mk({ hand: ['ironwall'], intents: [idle], generals: [{ id: 'caoren', row: 'front' }], terrain: 'river' });
  playCard(b2, 0); // 12 + 하천 2 = 14
  endTurn(b2);
  assert.equal(b2.block.front, 7);
});

test('후열이 실제 피해를 받으면 다음 턴 후열 장수가 동요한다', () => {
  const b = mk({ generals: [{ id: 'guojia', row: 'rear' }], intents: [atk('rear', 6)], hand: [] });
  endTurn(b);
  assert.equal(b.shakenRear, true);
  b.hand = [{ uid: 1, id: 'feint' }];
  b.enemies[0].intent = atk('rear', 6); // 허보로 전열로 돌린다
  const before = b.energy;
  playCard(b, 0, { enemy: b.enemies[0].uid });
  assert.equal(b.energy, before, '동요한 곽가는 지휘력을 주지 않는다');
  endTurn(b);
  assert.equal(b.shakenRear, false, '동요는 한 턴만');
});

// ── 장수 능력 발동 순서 ──
test('카드 효과가 먼저, 그 다음 전열 → 후열 순으로 장수 능력이 발동한다', () => {
  const b = mk({
    hand: ['firearrow'],
    generals: [{ id: 'chengong', row: 'rear' }, { id: 'huanggai', row: 'front' }],
    enemies: ['ytsoldier', 'bandit'],
  });
  playCard(b, 0, { enemy: b.enemies[0].uid });
  const lines = b.log.map((l) => l.text);
  const iCard = lines.findIndex((t) => t.startsWith('화시 →'));
  const iHuang = lines.findIndex((t) => t.startsWith('황개:'));
  const iChen = lines.findIndex((t) => t.startsWith('진궁:'));
  assert.ok(iCard >= 0 && iHuang > iCard && iChen > iHuang, lines.join('\n'));
  assert.equal(b.hp, 58, '황개는 병력 2를 잃게 한다');
  assert.equal(b.enemies[1].burn, 3, '체력이 가장 높은 적(산적)에게 화상 3');
});

test('진궁 보너스는 다음 武 카드 한 장에만 적용된다', () => {
  const b = mk({ hand: ['feint', 'spear', 'spear'], generals: [{ id: 'chengong', row: 'rear' }], intents: [atk('front', 1)], enemyHp: [50] });
  b.enemies[0].maxHp = 50;
  const u = b.enemies[0].uid;
  playCard(b, 0, { enemy: u });
  playCard(b, 0, { enemy: u });
  assert.equal(b.enemies[0].hp, 40);
  playCard(b, 0, { enemy: u });
  assert.equal(b.enemies[0].hp, 34);
});

test('여포: 3번째 武 카드부터 피해 재발동, 기세 3 미만으로 턴을 끝내면 병력 -3', () => {
  const b = mk({ hand: ['spear', 'spear', 'spear'], generals: [{ id: 'lubu', row: 'front' }], intents: [idle], enemyHp: [100] });
  b.enemies[0].maxHp = 100;
  const u = b.enemies[0].uid;
  playCard(b, 0, { enemy: u });
  playCard(b, 0, { enemy: u });
  assert.equal(b.enemies[0].hp, 88);
  playCard(b, 0, { enemy: u });
  assert.equal(b.enemies[0].hp, 76, '세 번째는 6+6');
  const b2 = mk({ hand: ['spear'], generals: [{ id: 'lubu', row: 'front' }], intents: [idle] });
  endTurn(b2);
  assert.equal(b2.hp, 57);
});

test('배치 조건이 맞지 않는 장수는 작동하지 않는다', () => {
  const b = mk({ generals: [{ id: 'dianwei', row: 'rear' }], intents: [atk('front', 5)], hand: [], enemyHp: [13] });
  endTurn(b);
  assert.equal(b.enemies[0].hp, 13, '후열의 전위는 반격하지 않는다');
});

test('전위: 반격 3 + 공격을 막고 남은 전열 방비의 절반', () => {
  const b = mk({ hand: ['ironwall'], generals: [{ id: 'dianwei', row: 'front' }], intents: [atk('front', 4)], enemyHp: [30], terrain: 'plains' });
  b.enemies[0].maxHp = 30;
  playCard(b, 0); // 방비 12
  endTurn(b); // 4 흡수, 남은 8 → 반격 3 + 4 = 7
  assert.equal(b.enemies[0].hp, 23);
  assert.equal(b.hp, 60);
});

test('조조: 매 턴 첫 위치 교대는 무료, 두 번째는 지휘력 1', () => {
  const b = mk({ lordId: 'caocao', generals: [{ id: 'dianwei', row: 'front' }] });
  const e = b.energy;
  assert.ok(moveGeneral(b, 0).ok);
  assert.equal(b.generals[0].row, 'rear');
  assert.equal(b.energy, e);
  assert.ok(moveGeneral(b, 0).ok);
  assert.equal(b.energy, e - 1);
});

// ── 연쇄 효과의 종료 ──
test('곽가의 지휘력 획득은 턴당 1회라 계책 연쇄가 끝난다', () => {
  const b = mk({ hand: ['feint', 'feint', 'feint'], generals: [{ id: 'guojia', row: 'rear' }], intents: [atk('front', 5)], drawPile: [] });
  const u = b.enemies[0].uid;
  playCard(b, 0, { enemy: u });
  playCard(b, 0, { enemy: u });
  playCard(b, 0, { enemy: u });
  assert.equal(b.energy, 4);
});

test('육손: 쓰러진 적의 화상이 남은 적에게 번지고 처리가 끝난다', () => {
  const b = mk({ hand: ['spear'], generals: [{ id: 'luxun', row: 'rear' }], enemies: ['ytsoldier', 'ytsoldier', 'ytsoldier'], enemyHp: [5, 13, 13] });
  b.enemies[0].burn = 4;
  b.enemies[1].burn = 1;
  playCard(b, 0, { enemy: b.enemies[0].uid });
  assert.equal(b.enemies[0].dead, true);
  assert.equal(b.enemies[1].burn, 5);
  assert.equal(b.enemies[2].burn, 4);
  assert.equal(b.result, 'ongoing');
});

test('처리 예산을 넘으면 연쇄를 멈추고 경고를 남긴다', () => {
  const b = mk({ hand: ['volley'], enemyHp: [50] });
  b.budget = 1;
  playCard(b, 0, { enemy: b.enemies[0].uid });
  assert.match(logText(b), /연쇄 처리 상한/);
  assert.equal(b.enemies[0].hp, 50, '상한 이후 효과는 처리되지 않는다');
});

// ── 사망한 대상의 후속 효과 ──
test('연노 첫 타에 대상이 쓰러지면 두 번째 타는 무효', () => {
  const b = mk({ hand: ['volley'], enemies: ['ytsoldier', 'ytsoldier'], enemyHp: [2, 13] });
  playCard(b, 0, { enemy: b.enemies[0].uid });
  assert.equal(b.enemies[0].dead, true);
  assert.equal(b.enemies[1].hp, 13, '다른 적에게 넘어가지 않는다');
  assert.match(logText(b), /이미 쓰러져 연노의 효과가 무효/);
});

test('여포 재발동 시 대상이 이미 쓰러졌으면 무효 처리된다', () => {
  const b = mk({ hand: ['order', 'order', 'spear'], drawPile: [], generals: [{ id: 'lubu', row: 'front' }], enemies: ['ytsoldier', 'ytsoldier'], enemyHp: [5, 13] });
  playCard(b, 0);
  playCard(b, 0);
  playCard(b, 0, { enemy: b.enemies[0].uid });
  assert.match(logText(b), /여포: 기세 \d+!/);
  assert.match(logText(b), /이미 쓰러져 창격의 효과가 무효/);
});

test('반격으로 쓰러진 적은 남은 연타를 하지 못한다', () => {
  const b = mk({ hand: [], generals: [{ id: 'dianwei', row: 'front' }], enemies: ['xbow'], intents: [atk('both', 4, 2)], enemyHp: [3] });
  endTurn(b);
  assert.equal(b.enemies[0].dead, true);
  assert.equal(b.hp, 60 - 8, '전열 2타 후 반격으로 쓰러져 후열 공격은 없다');
  assert.equal(b.result, 'win');
});

test('화상으로 쓰러진 적은 행동하지 않는다', () => {
  const b = mk({ hand: [], intents: [atk('front', 50)], enemyHp: [3] });
  b.enemies[0].burn = 3;
  endTurn(b);
  assert.equal(b.hp, 60);
  assert.equal(b.result, 'win');
});

// ── 승리·패배 ──
test('적 전원 격파 시 승리, 병력 0이면 패배', () => {
  const w = mk({ hand: ['spear'], enemyHp: [6] });
  playCard(w, 0, { enemy: w.enemies[0].uid });
  assert.equal(w.result, 'win');
  assert.equal(playCard(w, 0, { enemy: w.enemies[0].uid }).ok, false, '끝난 전투에서는 행동 불가');
  const l = mk({ hand: [], hp: 5, intents: [atk('front', 9)] });
  endTurn(l);
  assert.equal(l.result, 'lose');
  assert.equal(l.hp, 0);
});

test('보스가 쓰러지면 남은 적은 도주하고 승리', () => {
  const b = mk({ hand: ['spear'], enemies: ['dongzhuo', 'guard'], enemyHp: [3] });
  playCard(b, 0, { enemy: b.enemies[0].uid });
  assert.equal(b.result, 'win');
  assert.ok(b.enemies.every((e) => e.dead));
});

test('이간계: 적의 공격이 다른 적을 향하고, 다른 적이 없으면 원래대로', () => {
  const b = mk({ hand: ['sow'], enemies: ['ytsoldier', 'bandit'], intents: [atk('front', 6), idle], enemyHp: [13, 18] });
  playCard(b, 0, { enemy: b.enemies[0].uid });
  endTurn(b);
  assert.equal(b.hp, 60);
  assert.equal(b.enemies[1].hp, 12);
  const s = mk({ hand: ['sow'], intents: [atk('front', 6)] });
  playCard(s, 0, { enemy: s.enemies[0].uid });
  endTurn(s);
  assert.equal(s.hp, 54);
});

test('보스 2단계: 체력 절반 이하에서 화상 제거·힘 증가', () => {
  const b = mk({ hand: [], enemies: ['dongzhuo'], intents: [idle], enemyHp: [40] });
  b.enemies[0].burn = 5;
  endTurn(b);
  assert.equal(b.enemies[0].phase, 2);
  assert.equal(b.enemies[0].burn, 0);
  assert.equal(b.enemies[0].str, 2);
});

// ── 미리보기와 설명 ──
test('미리보기는 실제 처리와 같은 결과를 내고 원본을 바꾸지 않는다', () => {
  const b = mk({ hand: ['charge', 'spear'], generals: [{ id: 'chengpu', row: 'front' }], terrain: 'plains', enemyHp: [30] });
  b.enemies[0].burn = 2;
  const u = b.enemies[0].uid;
  const pv = previewPlay(b, 0, { enemy: u });
  assert.equal(b.hand.length, 2);
  assert.equal(b.enemies[0].hp, 30);
  playCard(b, 0, { enemy: u });
  assert.equal(pv.enemies[0].hp[1], b.enemies[0].hp);
  assert.equal(b.enemies[0].hp, 30 - (4 + 2 + 2 + 3), '돌격 4+기세1×2 +정보2 +평야3');
});

test('적 의도 예상 피해는 열 방비를 반영한다', () => {
  const b = mk({ hand: ['formation'], enemies: ['ytsoldier', 'ytsoldier'], intents: [atk('front', 6), atk('both', 3)] });
  playCard(b, 0, { row: 'front' });
  const inc = incomingPreview(b);
  assert.deepEqual(inc.front, { raw: 9, blocked: 5, net: 4 });
  assert.deepEqual(inc.rear, { raw: 3, blocked: 0, net: 3 });
});

test('모든 카드 설명이 효과 데이터에서 생성된다', () => {
  for (const c of Object.values(CARDS)) {
    const text = describeCard(c);
    assert.ok(text.length > 0 && !text.includes('undefined'), `${c.id}: ${text}`);
  }
});
