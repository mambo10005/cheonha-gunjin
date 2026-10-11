import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseDoctrine, chooseGrowth, defaultBuild, makeRuntime, nextBuildTurn, offerGrowth, triggerBuild, type Direction, type GrowthId } from '../src/core/build.ts';
import { configureBuildDemo } from '../src/core/build-demo.ts';
import { createDuel, previewDuelAction, resolveDuelAction } from '../src/core/duel.ts';
import { endTurn, playCard, previewPlay } from '../src/core/combat.ts';
import { acceptDuel, finishDuel } from '../src/core/social-run.ts';
import { finishBattle, leaveNode, moveTo, newRun, offerGeneral, pickRewardCard, replaceGeneral } from '../src/core/run.ts';
import { loadRun, memoryKV, RUN_KEY, saveRun } from '../src/core/save.ts';
import { availableTactics } from '../src/data/tactics.ts';
import { runBuildScenario } from '../src/sim/build-scenarios.ts';
import { mk, atk, idle } from './helpers.ts';

function duelState(r: import('../src/core/types.ts').RunState) { if (r.pending.kind !== 'duel') throw Error(); return r.pending.state; }
function pendingKind(r: import('../src/core/types.ts').RunState) { return r.pending.kind; }
function fixture(direction: Direction, branch: GrowthId, level = 1) {
  return { doctrines: [direction], growth: { guojia: { branch, level } }, claimed: [] };
}
for (const [direction, branch] of [['bastion', 'avenger'], ['breakthrough', 'vanguard'], ['scheme', 'saboteur']] as const) {
  test(`시드 41001: ${direction} 일반 전투 핵심 연쇄, 희귀 전법 불필요`, () => {
    const b = mk({ rng: 41001, build: fixture(direction, branch), generals: [{ id: 'guojia', row: 'rear' }], hand: ['formation', 'order', 'feint', 'spear'], enemyHp: [100], intents: [atk('front', 4)] });
    if (direction === 'bastion') {
      playCard(b, 0, { row: 'front' }); endTurn(b);
      assert.equal(b.build!.tokens.riposte, 2);
      b.hand = [{ uid: 999, id: 'spear' }]; b.enemies[0].intent = idle;
    } else if (direction === 'breakthrough') playCard(b, 1);
    else playCard(b, 2, { enemy: 1 });
    const before = b.enemies[0].hp;
    const idx = b.hand.findIndex(c => c.id === 'spear');
    const saved = structuredClone(b); const preview = previewPlay(b, idx, { enemy: 1 });
    assert.deepEqual(b, saved); assert.ok(preview);
    assert.ok(playCard(b, idx, { enemy: 1 }).ok);
    assert.equal(before - b.enemies[0].hp, direction === 'breakthrough' ? 16 : 15);
    assert.ok(b.log.some(l => l.text.includes('소비')));
    if (direction === 'breakthrough') { assert.equal(b.enemies[0].intent?.kind, 'attack'); if (b.enemies[0].intent?.kind === 'attack') assert.equal(b.enemies[0].intent.dmg, 2); }
  });
  test(`시드 41001: ${direction} 장수 성장이 다음 대결에도 적용`, () => {
    const build = fixture(direction, branch);
    const s = createDuel(41001, 'guojia', 'rider', build); s.patternOffset = 2;
    const first = direction === 'bastion' ? 'guard' : 'probe';
    resolveDuelAction(s, first, 0);
    const before = s.enemyHp;
    const saved = structuredClone(s); const preview = previewDuelAction(s, 'strike');
    assert.deepEqual(s, saved); resolveDuelAction(s, 'strike', 1); assert.deepEqual(s, preview.state);
    assert.ok(before - s.enemyHp >= (direction === 'breakthrough' ? 17 : 16));
    assert.ok(s.log.some(l => l.includes('소비')));
    const another = createDuel(41001, 'guojia', 'rider', build);
    assert.deepEqual(another.build!.tokens, { riposte: 0, charge: 0, insight: 0 });
  });
}
test('동일 시드·다른 성장: 응징 공격 증가와 호위 보호의 기회비용', () => {
  const a = makeRuntime(fixture('bastion', 'avenger'), ['guojia']);
  const b = makeRuntime(fixture('bastion', 'guardian'), ['guojia']);
  for (const r of [a, b]) { triggerBuild(r, 'guarded'); nextBuildTurn(r); }
  const offensive = triggerBuild(a, 'attack'), defensive = triggerBuild(b, 'attack');
  assert.equal(offensive.damage, 9); assert.equal(defensive.damage, 5); assert.equal(defensive.block, 3);
  const improved = makeRuntime(fixture('bastion', 'avenger', 2), ['guojia']); triggerBuild(improved, 'guarded'); nextBuildTurn(improved);
  assert.equal(triggerBuild(improved, 'attack').damage, 13);
});
test('성장 단독·혼합 교리·횟수 및 보유 상한, 명시적 경고', () => {
  const build = fixture('bastion', 'avenger'); build.doctrines = [];
  const r = makeRuntime(build, ['guojia']); triggerBuild(r, 'guarded'); assert.equal(triggerBuild(r, 'attack').damage, 4);
  triggerBuild(r, 'guarded'); triggerBuild(r, 'guarded');
  assert.ok(triggerBuild(r, 'guarded').log.some(l => l.includes('한도')));
  nextBuildTurn(r); triggerBuild(r, 'guarded'); triggerBuild(r, 'guarded');
  assert.ok(triggerBuild(r, 'guarded').log.some(l => l.includes('한도')));
  assert.ok(r.tokens.riposte <= 2);
  const mixed = fixture('bastion', 'saboteur'); mixed.doctrines.push('scheme');
  const m = makeRuntime(mixed, ['guojia']); triggerBuild(m, 'guarded'); triggerBuild(m, 'changed');
  assert.equal(triggerBuild(m, 'attack').damage, 14);
});
test('연속 공격은 돌파를 준비하지 않으며 적성보다 성장 구성에 따라 공격 가치가 바뀐다', () => {
  const grown = createDuel(41001, 'guojia', 'rider', fixture('scheme', 'saboteur', 2));
  const expert = createDuel(41001, 'dianwei', 'rider', defaultBuild());
  grown.patternOffset = expert.patternOffset = 0;
  resolveDuelAction(grown, 'probe', 0); resolveDuelAction(expert, 'probe', 0);
  const g = grown.enemyHp, e = expert.enemyHp;
  resolveDuelAction(grown, 'strike', 1); resolveDuelAction(expert, 'strike', 1);
  assert.ok(g - grown.enemyHp > e - expert.enemyHp);
  const repeat = createDuel(41001, 'guojia', 'rider', fixture('breakthrough', 'vanguard'));
  resolveDuelAction(repeat, 'strike', 0); resolveDuelAction(repeat, 'strike', 1);
  assert.equal(repeat.build!.tokens.charge, 0);
});
test('일반 경로의 초반 성장·강화·회복 대안, 중복 보상 및 슬롯 제한', () => {
  const r = newRun(41001, 'caocao'); chooseDoctrine(r, 'bastion');
  assert.equal(chooseDoctrine(r, 'scheme').ok, false);
  moveTo(r, 0); if (r.pending.kind === 'duelOffer') acceptDuel(r, null);
  r.battle!.result = 'win'; finishBattle(r); pickRewardCard(r, null); leaveNode(r);
  assert.equal(pendingKind(r), 'growth'); chooseGrowth(r, 'avenger', 'dianwei');
  assert.equal(chooseGrowth(r, 'avenger', 'dianwei').ok, false);
  r.screen = 'node'; offerGrowth(r, 'fixture:1', { kind: 'none' }); chooseGrowth(r, 'avenger', 'dianwei');
  assert.equal(r.build.growth.dianwei.level, 2);
  r.screen = 'node'; offerGrowth(r, 'fixture:2', { kind: 'none' }); assert.equal(chooseGrowth(r, 'avenger', 'dianwei').ok, false); assert.equal(chooseGrowth(r, 'guardian', 'dianwei').ok, false);
  assert.ok(chooseGrowth(r, 'doctrine:scheme', '').ok);
  r.screen = 'node'; offerGrowth(r, 'fixture:3', { kind: 'none' }); assert.equal(chooseGrowth(r, 'doctrine:breakthrough', '').ok, false); assert.ok(chooseGrowth(r, 'recover', '').ok);
});
test('전투 없는 보급 경로로도 성장 보상에 도달, 이동 비용 중복 없음', () => {
  const r = newRun(41001, 'caocao'); chooseDoctrine(r, 'scheme'); r.floor = 2; r.col = 0; r.screen = 'map';
  const before = r.food, rng = r.rng; assert.ok(moveTo(r, r.map[2][0].next[0]).ok);
  assert.equal(pendingKind(r), 'growth'); assert.equal(r.food, before); assert.equal(r.rng, rng);
  chooseGrowth(r, 'planner', 'dianwei'); assert.equal(r.floor, 2);
});
test('장수 교체 시 성장 소멸·동요/배치 조건과 대결 출전 범위', () => {
  const r = newRun(41001, 'caocao'); r.generals = [{id:'dianwei',row:'front'},{id:'caoren',row:'front'},{id:'guojia',row:'rear'},{id:'luxun',row:'rear'}];
  r.build.growth.dianwei = {branch:'avenger',level:2}; r.screen = 'node'; offerGeneral(r, 'zhangliao', {kind:'none'}); replaceGeneral(r, 'dianwei'); assert.equal(r.build.growth.dianwei, undefined);
  const b = mk({ build: fixture('scheme', 'saboteur'), generals:[{id:'guojia',row:'front'}], hand:['feint','spear'], intents:[atk('front',4)], enemyHp:[100] });
  playCard(b,0,{enemy:1}); playCard(b,0,{enemy:1}); assert.equal(b.enemies[0].hp,89); // doctrine 5 + spear 6; inactive growth does not fire
});
test('대결 전술 보유·최대 2개·1회 사용·비용·미리보기', () => {
  const r = newRun(41001, 'caocao'); configureBuildDemo(r, 'breakthrough');
  r.floor=3; r.col=0; r.screen='node'; r.pending={kind:'duelOffer',opponentId:'champion'};
  const before=structuredClone(r); assert.equal(acceptDuel(r,'guojia',['breathe','brace','sacrifice']).ok,false); assert.deepEqual(r,before);
  assert.ok(availableTactics(r.build,'guojia',r.deck).includes('sacrifice'));
  acceptDuel(r,'guojia',['sacrifice','breathe']); assert.equal(pendingKind(r),'duel');
  const s=duelState(r); const pv=previewDuelAction(s,'sacrifice'); resolveDuelAction(s,'sacrifice',0); assert.deepEqual(s,pv.state); assert.equal(s.build!.tokens.charge,2);
  assert.equal(resolveDuelAction(s,'sacrifice',1).ok,false); assert.equal(resolveDuelAction(s,'brace',1).ok,false);
});
test('대결 승리 성장 대가·전투 연결·중복 수령 불가', () => {
  const r = newRun(41001,'caocao'); configureBuildDemo(r,'bastion'); r.floor=3;r.col=0;r.screen='node';r.pending={kind:'duelOffer',opponentId:'champion'};
  acceptDuel(r,'dianwei',[]);  duelState(r).result='win';
  assert.ok(finishDuel(r,'growth').ok); assert.equal(pendingKind(r),'growth'); chooseGrowth(r,'avenger','dianwei');
  assert.equal(finishDuel(r,'growth').ok,false); assert.ok(finishDuel(r).ok); assert.equal(r.screen,'battle'); assert.equal(r.battle!.block.front,2);
  assert.equal(finishDuel(r).ok,false); assert.equal(r.build.growth.dianwei.level,1);
});
test('성장·대결·일반 전투·보상 진행 중 저장 복원과 버전 2 변환', () => {
  const r=newRun(41001,'caocao'); configureBuildDemo(r,'scheme'); const kv=memoryKV();
  const check=()=>{saveRun(kv,r);const loaded=loadRun(kv);assert.ok(loaded.ok);if(loaded.ok)assert.deepEqual(loaded.data,r);};
  r.screen='node'; offerGrowth(r,'fixture',{kind:'none'}); check(); chooseGrowth(r,'saboteur','guojia');
  r.floor=3;r.col=0;r.screen='node';r.pending={kind:'duelOffer',opponentId:'champion'};acceptDuel(r,'guojia',['feint']);
  resolveDuelAction(duelState(r),'feint',0);check();duelState(r).result='win';finishDuel(r);check();
  const legacy=structuredClone(r) as unknown as Record<string,unknown>;legacy.version=2;delete legacy.build;
  if(legacy.battle && typeof legacy.battle==='object') delete (legacy.battle as Record<string,unknown>).build;
  kv.setItem(RUN_KEY,JSON.stringify({version:2,data:legacy}));const old=loadRun(kv);assert.ok(old.ok);if(old.ok){assert.equal(old.data.version,6);assert.deepEqual(old.data.build,defaultBuild());assert.equal(old.data.rng,r.rng);}
  r.build.doctrines.push('scheme');saveRun(kv,r);assert.equal(loadRun(kv).ok,false);
});
test('검증 지도는 동일 시드 세 방향 비교 및 조기 성장→후반 대결 경로를 보장', () => {
  const a=newRun(41001,'caocao'), b=newRun(41001,'caocao');configureBuildDemo(a,'bastion');configureBuildDemo(b,'scheme');
  assert.deepEqual(a.map,b.map);assert.equal(a.rng,b.rng);assert.notDeepEqual(a.build,b.build);
  assert.equal(a.map[0][0].type,'battle');assert.equal(a.map[3][0].encounterId,'el_huaxiong');assert.equal(a.map[5][0].encounterId,'el_zhangbao');
});
for (const direction of ['bastion','breakthrough','scheme'] as const) test(`검증 원정 자동 진행: ${direction}의 실제 연쇄·1층 성장·종료`, () => {
  const r=runBuildScenario(direction);
  assert.ok(['victory','defeat'].includes(r.result));
  assert.equal(r.firstGrowthFloor,1); assert.ok(r.battleChains>0); assert.ok(r.duelChains>0);
  assert.ok(Object.values(r.build.growth).some(g=>g.level===2));
});
