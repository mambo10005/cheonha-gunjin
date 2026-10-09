import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createDuel, duelIntent, previewDuelAction, resolveDuelAction } from '../src/core/duel.ts';
import { createDebate, previewDebateAction, resolveDebateAction } from '../src/core/debate.ts';
import { defaultSocial, tradeQuote } from '../src/core/diplomacy.ts';
import { acceptDiplomacy, acceptDuel, acceptParley, actDebate, actDuel, beginDebate, configureSocialDemo, enterSocialEvent, finishDebate, finishDuel, parleyTerms, quoteForRun, supplyParley, villageDiplomacy } from '../src/core/social-run.ts';
import { beginBattle, finishBattle, leaveNode, moveTo, newRun, pickRewardCard, pickRewardExtra, replaceGeneral } from '../src/core/run.ts';
import { endTurn } from '../src/core/combat.ts';
import { loadMeta, loadRun, memoryKV, META_KEY, RUN_KEY, saveMeta, saveRun } from '../src/core/save.ts';
import { socialBotStep } from '../src/sim/social-policy.ts';
import { simulateRun } from '../src/sim/autoplay.ts';
import { socialView } from '../src/ui/social-view.ts';
import type { DebateState, DuelState } from '../src/core/social-types.ts';
import type { RunState } from '../src/core/types.ts';

function demo(): RunState { const r = newRun(31001, 'caocao'); configureSocialDemo(r); return r; }
function atEvent(event: string): RunState {
  const r = demo(); r.floor = 1; r.col = 0; r.map[1][0].eventId = event; enterSocialEvent(r, event); return r;
}
function duelRun(): RunState { const r = demo(); moveTo(r, 0); acceptDuel(r, 'dianwei'); return r; }
function ds(r: RunState): DuelState { assert.equal(r.pending.kind, 'duel'); if (r.pending.kind !== 'duel') throw Error(); return r.pending.state; }
function bs(r: RunState): DebateState { assert.equal(r.pending.kind, 'debate'); if (r.pending.kind !== 'debate') throw Error(); return r.pending.state; }
function endActivity(r: RunState): void { for (let i = 0; i < 12 && ['duel', 'debate'].includes(r.pending.kind); i++) socialBotStep(r); }
function winBattle(r: RunState): void {
  assert.ok(r.battle); r.battle.result = 'win'; finishBattle(r);
  if (r.pending.kind === 'reward') { pickRewardCard(r, null); if (r.pending.kind === 'reward' && r.pending.extra) pickRewardExtra(r, null); leaveNode(r); }
}

test('무장 대결: 지정 편성 제안·무료 거절·원정당 최대 2회', () => {
  const r = demo(); const hp = r.hp; moveTo(r, 0); assert.equal(r.pending.kind, 'duelOffer');
  const food = r.food; assert.ok(acceptDuel(r, null).ok); assert.equal(r.screen, 'battle'); assert.equal(r.hp, hp); assert.equal(r.food, food);
  assert.equal(acceptDuel(r, null).ok, false); winBattle(r);
  for (let f = 1; f <= 2; f++) { r.map[f][0].type = 'elite'; r.map[f][0].encounterId = 'el_huaxiong'; moveTo(r, 0); if (f === 1) { assert.equal(r.pending.kind, 'duelOffer'); acceptDuel(r, null); winBattle(r); } else assert.equal(r.screen, 'battle'); }
});
test('무장 대결: 잘못된 출전 장수·라운드·행동·기세 부족은 무변경', () => {
  const r = demo(); moveTo(r, 0); const before = structuredClone(r);
  assert.equal(acceptDuel(r, 'lubu').ok, false); assert.deepEqual(r, before);
  acceptDuel(r, 'dianwei'); const s = ds(r); s.momentum = 0; const a = structuredClone(s);
  assert.equal(actDuel(r, 'finisher', 0).ok, false); assert.equal(actDuel(r, 'bad', 0).ok, false); assert.equal(actDuel(r, 'probe', NaN).ok, false); assert.deepEqual(s, a);
  assert.ok(actDuel(r, 'probe', 0).ok); const b = structuredClone(s); assert.equal(actDuel(r, 'probe', 0).ok, false); assert.deepEqual(s, b);
});
test('무장 대결: 승리·패배·무승부·기권을 실제 처리한다', () => {
  for (const result of ['win', 'lose', 'draw', 'surrender']) {
    const s = createDuel(5, 'dianwei', 'champion'); s.pattern = ['strike', 'strike', 'strike', 'strike'];
    if (result === 'win') s.enemyHp = 1;
    if (result === 'lose') s.hp = 1;
    if (result === 'draw') { s.enemyHp = 1; s.hp = 1; }
    resolveDuelAction(s, result === 'surrender' ? 'surrender' : 'strike', 0); assert.equal(s.result, result);
    assert.equal(resolveDuelAction(s, 'guard', s.round).ok, false);
  }
});
test('무장 대결: 최대 4회 후 남은 체력 비율과 무승부 범위', () => {
  for (const [hp, ehp, result] of [[22, 6, 'win'], [3, 24, 'lose'], [22, 24, 'draw']] as const) {
    const s = createDuel(7, 'dianwei', 'champion'); s.round = 3; s.hp = hp; s.enemyHp = ehp; s.pattern = ['guard', 'guard', 'guard', 'guard'];
    resolveDuelAction(s, 'guard', 3); assert.equal(s.round, 4); assert.equal(s.result, result);
  }
});
test('무장 대결: 공개 의도·연속 행동 감쇠·상황별 특성', () => {
  const s = createDuel(42, 'dianwei', 'champion'); s.pattern = ['strike', 'strike', 'strike', 'strike']; assert.equal(duelIntent(s), 'strike');
  const first = previewDuelAction(s, 'guard'); assert.equal(s.enemyHp - first.state.enemyHp, 6);
  resolveDuelAction(s, 'guard', 0); const second = previewDuelAction(s, 'guard'); assert.ok(second.state.hp < s.hp, '연속 방어는 받는 피해 증가');
  const low = createDuel(42, 'caoren', 'champion'); low.pattern = s.pattern; assert.equal(low.enemyHp - previewDuelAction(low, 'guard').state.enemyHp, 6, '낮은 적성의 반격 장수도 활약');
});
test('무장 대결: 미리보기는 실제 결과와 같고 원본·RNG 불변', () => {
  const s = createDuel(42, 'dianwei', 'rider'); const before = structuredClone(s); const pv = previewDuelAction(s, 'probe');
  assert.deepEqual(s, before); resolveDuelAction(s, 'probe', s.round); assert.deepEqual(s, pv.state);
});
test('무장 대결: 한 행동 반복으로 모든 상대에게 승리할 수 없다', () => {
  for (const action of ['strike', 'probe', 'guard', 'finisher']) {
    let blocked = 0;
    for (const opponent of ['champion', 'rider', 'sentinel']) for (let seed = 1; seed <= 8; seed++) {
      const s = createDuel(seed, 'dianwei', opponent);
      while (s.result === 'ongoing') { if (!resolveDuelAction(s, action, s.round).ok) { blocked++; break; } }
      if (s.result !== 'win') blocked++;
    }
    assert.ok(blocked > 0, action);
  }
});
test('무장 대결: 승리 방비는 첫 턴 유지·중복 결과 적용 방지', () => {
  const r = duelRun(); const s = ds(r); s.enemyHp = 1; s.pattern = ['probe', 'probe', 'probe', 'probe']; actDuel(r, 'strike', 0);
  assert.equal(s.result, 'win'); const food = r.food; finishDuel(r); assert.equal(r.battle!.block.front, 6); assert.equal(r.food, food);
  const before = structuredClone(r); assert.equal(finishDuel(r).ok, false); assert.deepEqual(r, before);
  endTurn(r.battle!); assert.equal(r.battle!.block.front, 0); winBattle(r); assert.equal(r.screen, 'map');
});
test('무장 대결: 기권 피로는 첫 턴 지휘력에만 적용', () => {
  const r = duelRun(); actDuel(r, 'surrender', 0); finishDuel(r); assert.equal(r.battle!.energy, 3);
  for (const e of r.battle!.enemies) e.intent = { kind: 'block', n: 0 }; endTurn(r.battle!); assert.equal(r.battle!.energy, 4);
});
test('기존 시작 방비 회귀: 철갑·학소 효과가 첫 턴에 보존된다', () => {
  const r = newRun(7, 'caocao'); r.relics = ['armor']; r.generals.push({ id: 'haozhao', row: 'rear' });
  beginBattle(r, r.map[0][0]); assert.equal(r.battle!.block.front, r.battle!.terrain === 'river' ? 18 : r.battle!.terrain === 'fortress' ? 20 : 14);
});
test('설전: 관심사 대응과 반복 답변에 따른 합의 차이', () => {
  const s = createDebate(10, 'guojia', 'merchant', { kind: 'supply' }); s.concerns = ['profit', 'honor', 'profit', 'honor'];
  const good = previewDebateAction(s, 'evidence'); const bad = previewDebateAction(s, 'rebuttal'); assert.ok(good.state.agreement > bad.state.agreement);
  s.concerns = ['profit', 'profit', 'profit', 'profit']; resolveDebateAction(s, 'evidence', 0); const n = s.agreement; resolveDebateAction(s, 'evidence', 1); assert.equal(s.agreement - n, 1);
});
test('설전: 성공·부분 성공·실패·중단', () => {
  const s = createDebate(11, 'dianwei', 'scholar', { kind: 'supply' }); s.concerns = ['honor', 'trust', 'profit', 'safety'];
  ['rebuttal', 'evidence', 'proposal', 'concede'].forEach((a, i) => assert.ok(resolveDebateAction(s, a, i).ok)); assert.equal(s.result, 'success', '적성1도 대응하면 성공');
  const partial = createDebate(11, 'guojia', 'merchant', { kind: 'supply' }); partial.round = 3; partial.agreement = 5; partial.concerns[3] = 'profit'; resolveDebateAction(partial, 'evidence', 3); assert.equal(partial.result, 'partial');
  const fail = createDebate(11, 'guojia', 'merchant', { kind: 'supply' }); fail.concerns = ['profit', 'profit', 'profit', 'profit']; for (let i = 0; i < 4; i++) resolveDebateAction(fail, 'concede', i); assert.equal(fail.result, 'failure');
  const withdraw = createDebate(11, 'guojia', 'merchant', { kind: 'supply' }); resolveDebateAction(withdraw, 'withdraw', 0); assert.equal(withdraw.result, 'failure');
});
test('설전: 집중 부족·잘못된 입력·중복 입력·정보 공개', () => {
  const s = createDebate(13, 'guojia', 'merchant', { kind: 'supply' }); assert.equal(s.revealed.length, 2);
  const low = createDebate(13, 'dianwei', 'merchant', { kind: 'supply' }); assert.equal(low.revealed.length, 1);
  s.resolve = 0; const before = structuredClone(s); assert.equal(resolveDebateAction(s, 'proposal', 0).ok, false); assert.equal(resolveDebateAction(s, 'bad', 0).ok, false); assert.deepEqual(s, before);
  resolveDebateAction(s, 'concede', 0); assert.equal(s.resolve, 2); assert.equal(resolveDebateAction(s, 'concede', 0).ok, false);
});
test('설전: 미리보기 원본·RNG 불변과 실제 결과 일치', () => {
  const r = atEvent('refugees'); beginDebate(r, 'guojia'); const s = bs(r); const before = structuredClone(r); const p = previewDebateAction(s, 'evidence'); assert.deepEqual(r, before);
  actDebate(r, 'evidence', 0); assert.deepEqual(bs(r), p.state);
});
test('설전: 영입 할인·대표 소유·1회 도전·조건 수락·중복 방지', () => {
  const r = atEvent('parley'); const before = structuredClone(r); assert.equal(beginDebate(r, 'lubu').ok, false); assert.deepEqual(r, before);
  beginDebate(r, 'guojia'); const s = bs(r); s.concerns = ['honor', 'trust', 'profit', 'safety']; ['rebuttal', 'evidence', 'proposal', 'concede'].forEach((a, i) => actDebate(r, a, i));
  const context = s.context; assert.equal(s.result, 'success'); finishDebate(r); assert.equal(parleyTerms(r).cost, 2); assert.equal(beginDebate(r, 'guojia').ok, false);
  const food = r.food; assert.ok(acceptParley(r, true).ok); assert.equal(r.food, food - 2); assert.equal(context.kind, 'recruit'); if (context.kind === 'recruit') assert.ok(r.generals.some(g => g.id === context.candidate));
  assert.equal(acceptParley(r, true).ok, false); leaveNode(r); assert.equal(r.screen, 'map');
});
test('설전: 영입 실패 뒤 기본 조건 또는 포기, 진형 교체', () => {
  const r = atEvent('parley'); r.generals.push({ id: 'caoren', row: 'rear' }); beginDebate(r, 'guojia'); actDebate(r, 'withdraw', 0); finishDebate(r); assert.equal(parleyTerms(r).cost, 5);
  acceptParley(r, true); assert.equal(r.pending.kind, 'replaceGeneral'); replaceGeneral(r, 'guojia'); assert.equal(r.pending.kind, 'socialResult'); leaveNode(r); assert.equal(r.screen, 'map');
  const skip = atEvent('parley'); skip.food = 0; assert.equal(beginDebate(skip, 'dianwei').ok, false); assert.equal(acceptParley(skip, true).ok, false); acceptParley(skip, false); leaveNode(skip); assert.equal(skip.screen, 'map');
});
test('설전: 보급의 성공·부분 성공·실패는 표시한 조건대로 적용', () => {
  for (const [result, reward] of [['success', 9], ['partial', 7], ['failure', 4]] as const) {
    const r = atEvent('refugees'); beginDebate(r, 'guojia'); const s = bs(r); s.result = result; s.round = 4; finishDebate(r);
    const food = r.food; assert.equal(parleyTerms(r).food, reward); acceptParley(r, true); assert.equal(r.food, food + reward); assert.equal(acceptParley(r, true).ok, false);
  }
  const normal = demo(); normal.floor = 4; normal.col = 0; normal.screen = 'node'; normal.pending = { kind: 'supply' }; assert.ok(supplyParley(normal).ok); acceptParley(normal, true); assert.equal(normal.food, 26);
});
test('외교: 자원·관계 조건·알 수 없는 거래는 상태를 바꾸지 않는다', () => {
  const r = atEvent('envoy'); r.food = 0; const before = structuredClone(r);
  assert.equal(acceptDiplomacy(r, 'supply').ok, false); assert.equal(acceptDiplomacy(r, 'bad').ok, false); assert.equal(acceptDiplomacy(r, 'support').ok, false); assert.deepEqual(r, before);
  r.food = 20; r.social.relations.caravan = -1; assert.equal(acceptDiplomacy(r, 'passage').ok, false); assert.equal(beginDebate(r, 'guojia', 'support').ok, false);
});
test('외교: 비용·즉시 보상·관계 변화와 중복 거래 방지', () => {
  const r = atEvent('envoy'); const q = quoteForRun(r, 'supply')!; const f = r.food; assert.equal(q.cost, 1, '사절 비용 감소');
  acceptDiplomacy(r, 'supply'); assert.equal(r.food, f - q.cost + q.food); assert.equal(r.social.relations.caravan, 1); assert.equal(acceptDiplomacy(r, 'supply').ok, false);
  assert.equal(r.flags.rewardPenalty, 1, '즉시 보급의 대가로 다음 카드 보상 선택지를 포기');
  enterSocialEvent(r, 'envoy'); assert.equal(acceptDiplomacy(r, 'supply').ok, false, '같은 장소 재진입해도 거래 반복 불가');
  const decline = atEvent('checkpoint'); const old = structuredClone(decline.social); acceptDiplomacy(decline, null); assert.deepEqual(decline.social, old);
});
test('외교: 통행 협정은 실제 이동 비용을 줄이고 지정 회수 후 만료', () => {
  const r = newRun(100, 'caocao'); r.social.passage = { moves: 2, discount: 1 }; r.map[0][0].terrain = 'mountain'; const food = r.food;
  moveTo(r, 0); assert.equal(r.food, food - 1); assert.equal(r.social.passage?.moves, 1); winBattle(r);
  r.map[1][0].type = 'supply'; r.map[1][0].terrain = 'plains'; const remaining = r.food; moveTo(r, 0); assert.equal(r.food, remaining); assert.equal(r.social.passage, null);
  const s = defaultSocial(); s.passage = { moves: 2, discount: 1 }; assert.ok(tradeQuote(s, 'caravan', 'passage').reason);
});
test('외교: 지원은 다음 전투에 정확히 1회, 보상 포기도 해당 전투만', () => {
  const r = atEvent('envoy'); r.social.relations.caravan = 1; const q = quoteForRun(r, 'support')!; acceptDiplomacy(r, 'support'); leaveNode(r);
  r.map[2][0].type = 'battle'; r.map[2][0].encounterId = 'e_bandit'; r.map[2][0].terrain = 'plains';
  r.flags.rewardPenalty = 1; moveTo(r, 0); assert.equal(r.social.support, null); assert.equal(r.battle!.block.front, q.block); assert.equal(r.battle!.enemies[0].hp, r.battle!.enemies[0].maxHp - q.damage);
  r.battle!.result = 'win'; finishBattle(r); assert.equal(r.flags.rewardPenalty, 0); if (r.pending.kind === 'reward') assert.equal(r.pending.cards.length, 1, '기존 패널티와 이번 전투 패널티 각각 적용');
  pickRewardCard(r, null); leaveNode(r); r.map[3][0].type = 'battle'; r.map[3][0].encounterId = 'e_bandit'; r.map[3][0].terrain = 'plains'; moveTo(r, 0); assert.equal(r.battle!.block.front, 0); assert.equal(r.battle!.enemies[0].hp, r.battle!.enemies[0].maxHp);
  r.battle!.result = 'win'; finishBattle(r); if (r.pending.kind === 'reward') assert.equal(r.pending.cards.length, 3);
});
test('외교: 설전 결과 조건과 실제 비용·보상·관계는 일치', () => {
  for (const grade of ['success', 'partial', 'failure'] as const) {
    const r = atEvent('envoy'); beginDebate(r, 'guojia', 'supply'); bs(r).result = grade; bs(r).round = 4; finishDebate(r); const q = quoteForRun(r, 'supply')!;
    assert.equal(acceptDiplomacy(r, 'passage').ok, false); const f = r.food; acceptDiplomacy(r, 'supply'); assert.equal(r.food, f - q.cost + q.food); assert.equal(r.social.relations.caravan, q.relationDelta); assert.equal(r.flags.rewardPenalty, grade === 'success' ? 0 : 1);
  }
});
test('외교: 협정 중첩·관계 범위·새 원정 초기화', () => {
  const r = atEvent('envoy'); r.social.support = { block: 4, damage: 6, rewardPenalty: 1 }; r.social.relations.caravan = 2; assert.equal(acceptDiplomacy(r, 'support').ok, false);
  acceptDiplomacy(r, 'supply'); assert.equal(r.social.relations.caravan, 2); assert.deepEqual(newRun(31001, 'caocao').social, defaultSocial());
});
test('향촌 외교는 보급 대안으로 진입하며 모든 세력 관계를 실제 사용', () => {
  const r = atEvent('refugees'); assert.ok(villageDiplomacy(r).ok); assert.equal(r.pending.kind, 'diplomacy');
  acceptDiplomacy(r, 'supply'); assert.equal(r.social.relations.villages, 1); assert.equal(villageDiplomacy(r).ok, false);
});
test('신규 활동의 상태 이탈·결과 중복 확인을 막는다', () => {
  const r = duelRun(); assert.equal(leaveNode(r).ok, false); assert.equal(finishDuel(r).ok, false);
  const d = atEvent('refugees'); beginDebate(d, 'guojia'); assert.equal(leaveNode(d).ok, false); assert.equal(finishDebate(d).ok, false); actDebate(d, 'withdraw', 0); finishDebate(d); const before = structuredClone(d); assert.equal(finishDebate(d).ok, false); assert.deepEqual(d, before);
});
test('저장: 무장 대결·설전 진행 중 동일 행동·결과·RNG 재현', () => {
  for (const kind of ['duel', 'debate']) {
    const r = kind === 'duel' ? duelRun() : atEvent('refugees'); if (kind === 'debate') beginDebate(r, 'guojia');
    if (kind === 'duel') actDuel(r, 'probe', 0); else actDebate(r, 'concede', 0);
    const kv = memoryKV(); assert.ok(saveRun(kv, r)); const loaded = loadRun(kv); assert.ok(loaded.ok); if (!loaded.ok) return; assert.deepEqual(loaded.data, r);
    endActivity(r); endActivity(loaded.data); assert.deepEqual(loaded.data, r);
  }
});
test('저장: 관계·협정·결과 적용 이력과 외교 조건 보존', () => {
  const r = atEvent('envoy'); beginDebate(r, 'guojia', 'passage'); actDebate(r, 'withdraw', 0); finishDebate(r); r.social.relations.militia = 2;
  r.social.support = { block: 4, damage: 6, rewardPenalty: 1 }; const kv = memoryKV(); saveRun(kv, r); const loaded = loadRun(kv); assert.ok(loaded.ok); if (loaded.ok) assert.deepEqual(loaded.data, r);
});
test('저장: 버전1 지도·전투 마이그레이션, 기존 카드 ID 유지', () => {
  for (const combat of [false, true]) {
    const r = newRun(55, 'caocao'); r.deck.push({ uid: r.nextUid++, id: 'duel' }); if (combat) moveTo(r, 0);
    const old = structuredClone(r) as unknown as Record<string, unknown>; old.version = 1; delete old.social;
    const kv = memoryKV(); kv.setItem(RUN_KEY, JSON.stringify({ version: 1, data: old })); const loaded = loadRun(kv); assert.ok(loaded.ok); if (loaded.ok) { assert.equal(loaded.data.version, 4); assert.deepEqual(loaded.data.social, {...defaultSocial(),protocol:'legacy'}); assert.ok(loaded.data.deck.some(c => c.id === 'duel')); }
  }
});
test('저장: 불완전 상태·알 수 없는 ID·모순 상태·저장소 오류에 안전', () => {
  const kv = memoryKV(); kv.setItem(RUN_KEY, JSON.stringify({ version: 2, data: { version: 2 } })); assert.equal(loadRun(kv).ok, false);
  const r = demo(); r.deck[0].id = 'unknown'; saveRun(kv, r); assert.equal(loadRun(kv).ok, false);
  const bad = duelRun(); bad.screen = 'map'; saveRun(kv, bad); assert.equal(loadRun(kv).ok, false);
  const broken = { getItem: () => { throw Error('denied'); }, setItem: () => { throw Error('full'); }, removeItem: () => { throw Error('denied'); } };
  assert.equal(saveRun(broken, demo()), false); assert.equal(loadRun(broken).ok, false); assert.equal(loadMeta(broken).runs, 0); assert.equal(saveMeta(broken, loadMeta(kv)), false);
  kv.setItem(META_KEY, JSON.stringify({ version: 1, data: { unlockedGenerals: 'bad' } })); assert.equal(loadMeta(kv).runs, 0);
});
test('검증 시나리오: 지도→대결→전투→보상→설전→외교→후속 이동', () => {
  const r = demo(); moveTo(r, 0); socialBotStep(r); endActivity(r); assert.equal(r.screen, 'battle'); winBattle(r);
  moveTo(r, 0); assert.equal(r.pending.kind, 'parley'); beginDebate(r, 'guojia'); endActivity(r); acceptParley(r, false); leaveNode(r);
  moveTo(r, 0); assert.equal(r.pending.kind, 'diplomacy'); acceptDiplomacy(r, 'supply'); leaveNode(r);
  moveTo(r, 0); assert.equal(r.social.relations.caravan, 1); acceptDiplomacy(r, 'passage'); leaveNode(r);
  const q = r.social.passage!; const moves = q.moves; moveTo(r, 0); assert.equal(r.social.passage!.moves, moves - 1); assert.equal(r.map.length, 8);
});
test('같은 시드와 활동 선택은 원정·상대·RNG까지 같다', () => {
  const a = duelRun(); const b = duelRun(); for (let i = 0; i < 4 && ds(a).result === 'ongoing'; i++) { const round = ds(a).round; actDuel(a, 'probe', round); actDuel(b, 'probe', round); } assert.deepEqual(a, b);
  const c = atEvent('refugees'); const d = atEvent('refugees'); beginDebate(c, 'guojia'); beginDebate(d, 'guojia'); endActivity(c); endActivity(d); assert.deepEqual(c, d);
});
test('자동 플레이: 신규 상태를 처리하고 실제 원정 종료', () => {
  for (let i = 1; i <= 40; i++) for (const lord of ['caocao', 'sunquan']) { const r = simulateRun(i * 7919, lord); assert.ok(r.won || r.killedBy !== null, `끝나지 않은 원정 ${i}/${lord}`); }
});
test('화면은 실제 미리보기·비용·실패 이유와 신규 용어를 표시', () => {
  const r = duelRun(); const before = structuredClone(r); const html = socialView(r)!; assert.ok(html.includes('상대 다음 행동')); assert.ok(html.includes('예상:')); assert.deepEqual(r, before);
  const e = atEvent('envoy'); e.food = 0; assert.ok(socialView(e)!.includes('군량 1 필요')); assert.ok(socialView(e)!.includes('우호 관계'));
  const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]);
  const forbidden = ['일', '기', '토'].join(''); for (const file of [...walk('src'), ...walk('docs'), 'README.md']) assert.ok(!readFileSync(file, 'utf8').includes(forbidden), file);
});
