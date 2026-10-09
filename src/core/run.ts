import { accordsOnMove, accordsOnSupply, accordsBattleOpening, accordsAfterBattle, accordsOnDismiss } from './accords.ts';
// 원정(런) 진행 규칙. 전투 상태(BattleState)와 원정 상태(RunState)를 분리해서 다룬다.
import { defaultBuild, offerGrowth } from './build.ts';
import { CARDS, LORD_DECKS, REWARD_POOL } from '../data/cards.ts';
import { ENCOUNTERS } from '../data/enemies.ts';
import { EVENTS } from '../data/events.ts';
import { GENERALS, MAX_GENERALS, ROW_CAPACITY } from '../data/generals.ts';
import { LORDS } from '../data/lords.ts';
import { RELICS } from '../data/relics.ts';
import { TERRAINS } from '../data/terrain.ts';
import { createBattle } from './combat.ts';
import { defaultSocial } from './diplomacy.ts';
import { enterSocialEvent, offerDuel } from './social-run.ts';
import { SOCIAL_EVENTS } from '../data/social.ts';
import { nextFloat, pick, sample, shuffle } from './rng.ts';
import type {
  Affinity,
  CardInst,
  Difficulty,
  GeneralInst,
  MapNode,
  MetaState,
  NodeType,
  Pending,
  Row,
  RunState,
  Terrain,
} from './types.ts';

export const RUN_VERSION = 4;
export const START_HP = 60;
export const START_FOOD = 10;
export const BOSS_FLOOR = 7;

const FLOOR_PLAN: NodeType[][] = [
  ['battle', 'battle', 'battle'],
  ['battle', 'event', 'recruit'],
  ['battle', 'supply', 'event'],
  ['elite', 'battle', 'market'],
  ['battle', 'recruit', 'event'],
  ['elite', 'battle', 'rest'],
  ['rest', 'market', 'supply'],
];

export const NODE_NAME: Record<NodeType, string> = {
  battle: '전투',
  elite: '정예',
  recruit: '장수 영입',
  market: '시장',
  rest: '휴식',
  supply: '보급',
  event: '사건',
  boss: '결전',
};

export function defaultMeta(): MetaState {
  return { version: 1, runs: 0, wins: 0, unlockedGenerals: [], difficultyUnlocked: 0, seenGenerals: [], bestFloor: -1 };
}

function newCard(run: RunState, id: string): CardInst {
  return { uid: run.nextUid++, id };
}

export function newRun(seed: number, lordId: string, difficulty: Difficulty = 0, unlocked: string[] = []): RunState {
  const lord = LORDS[lordId];
  if (!lord) throw new Error(`알 수 없는 군주: ${lordId}`);
  const run: RunState = {
    build: defaultBuild(),
    social: defaultSocial(),
    version: RUN_VERSION,
    seed,
    rng: seed >>> 0 || 1,
    lordId,
    difficulty,
    unlocked: unlocked.slice(),
    hp: START_HP,
    maxHp: START_HP,
    food: START_FOOD - difficulty * 3,
    deck: [],
    generals: [{ id: lord.startGeneral, row: 'front' }],
    relics: [],
    map: [],
    floor: -1,
    col: -1,
    screen: 'map',
    pending: { kind: 'none' },
    battle: null,
    nextUid: 1,
    flags: { allyBlessing: false, rewardPenalty: 0 },
    history: [`${lord.name}의 원정이 시작되었다.`],
    lastBattleSummary: [],
    defeatReason: [],
  };
  for (const id of LORD_DECKS[lordId]) run.deck.push(newCard(run, id));
  run.map = generateMap(run);
  return run;
}

function rollTerrain(run: RunState): Terrain {
  const r = nextFloat(run);
  if (r < 0.375) return 'plains';
  if (r < 0.625) return 'mountain';
  if (r < 0.875) return 'river';
  return 'fortress';
}

export function generateMap(run: RunState): MapNode[][] {
  const map: MapNode[][] = [];
  const early = Object.values(ENCOUNTERS).filter((e) => e.tier === 'early').map((e) => e.id);
  const late = Object.values(ENCOUNTERS).filter((e) => e.tier === 'late').map((e) => e.id);
  const elites = Object.values(ENCOUNTERS).filter((e) => e.tier === 'elite').map((e) => e.id);
  // 원정 길이는 유지. 기존 사건 3곳 중 최대 2곳만 신규 활동으로 바꾼다.
  let events = shuffle(run, Object.keys(EVENTS));
  const socialEvents = shuffle(run, Object.keys(SOCIAL_EVENTS));
  let socialCount = 0;
  FLOOR_PLAN.forEach((plan, f) => {
    const types = shuffle(run, plan.slice());
    const row: MapNode[] = types.map((type, col) => {
      const node: MapNode = { floor: f, col, type, terrain: rollTerrain(run), next: [] };
      if (type === 'battle') node.encounterId = pick(run, f <= 2 ? early : late);
      if (type === 'elite') node.encounterId = pick(run, elites);
      if (type === 'event') {
        if (events.length === 0) events = shuffle(run, Object.keys(EVENTS));
        node.eventId = events.pop();
        if (socialCount < 2 && nextFloat(run) < 0.6) { node.eventId = socialEvents.pop(); socialCount++; }
      }
      return node;
    });
    map.push(row);
  });
  map.push([{ floor: BOSS_FLOOR, col: 0, type: 'boss', terrain: 'fortress', next: [], encounterId: 'boss_dongzhuo' }]);
  for (let f = 0; f < BOSS_FLOOR; f++) {
    for (const n of map[f]) {
      n.next = f === BOSS_FLOOR - 1 ? [0] : map[f + 1].filter((m) => Math.abs(m.col - n.col) <= 1).map((m) => m.col);
    }
  }
  return map;
}

export function currentNode(run: RunState): MapNode | null {
  if (run.floor < 0) return null;
  return run.map[run.floor][run.col];
}

export function availableMoves(run: RunState): MapNode[] {
  if (run.screen !== 'map') return [];
  if (run.floor < 0) return run.map[0];
  if (run.floor >= BOSS_FLOOR) return [];
  const cur = currentNode(run)!;
  return cur.next.map((c) => run.map[run.floor + 1][c]);
}

export interface Result {
  ok: boolean;
  reason?: string;
}

export function moveTo(run: RunState, col: number): Result {
  const target = availableMoves(run).find((n) => n.col === col);
  if (!target) return { ok: false, reason: '갈 수 없는 길이다' };
  if ([0, 2, 4].includes(run.floor) && run.build.doctrines.length && !run.build.claimed.includes(`camp:${run.floor}`)) {
    run.screen = 'node'; offerGrowth(run, `camp:${run.floor}`, { kind: 'none' }); return { ok: true };
  }
  accordsOnMove(run, target);
  const passage = run.social.passage;
  const cost = Math.max(0, TERRAINS[target.terrain].moveCost - (passage?.discount ?? 0));
  if (passage) {
    passage.moves--;
    run.history.push(`통행 협정: 이번 이동 군량 비용 -${passage.discount}, 남은 ${passage.moves}회.`);
    if (passage.moves <= 0) run.social.passage = null;
  }
  const paid = Math.min(cost, run.food);
  run.food -= paid;
  const missing = cost - paid;
  run.floor = target.floor;
  run.col = target.col;
  run.history.push(`${target.floor + 1}층 ${NODE_NAME[target.type]}(${TERRAINS[target.terrain].name})로 이동: 군량 -${paid}`);
  if (missing > 0) {
    run.hp -= missing * 5;
    run.history.push(`군량이 모자라 병사들이 이탈했다: 병력 -${missing * 5}`);
    if (run.hp <= 0) {
      run.hp = 0;
      run.screen = 'defeat';
      run.defeatReason = ['군량이 바닥나 굶주린 군대가 흩어졌다.', '이동 비용(산길 2)을 고려해 보급·휴식 노드와 군량 보상을 챙기세요.'];
      return { ok: true };
    }
  }
  enterNode(run, target);
  return { ok: true };
}

function enterNode(run: RunState, node: MapNode): void {
  switch (node.type) {
    case 'battle':
    case 'elite':
    case 'boss':
      if (!offerDuel(run, node)) beginBattle(run, node);
      return;
    case 'recruit':
      run.pending = { kind: 'recruit', options: recruitOptions(run, run.lordId === 'caocao' ? 3 : 2) };
      break;
    case 'market':
      run.pending = makeMarket(run);
      break;
    case 'rest':
      run.pending = { kind: 'rest' };
      break;
    case 'supply':
      run.pending = { kind: 'supply' };
      break;
    case 'event':
      if (enterSocialEvent(run, node.eventId!)) return;
      run.pending = { kind: 'event', eventId: node.eventId! };
      break;
  }
  run.screen = 'node';
}

export function beginBattle(run: RunState, node: MapNode, duelOpening = { block: 0, energyPenalty: 0 }): void {
  const accord = accordsBattleOpening(run);
  const support = run.social.support;
  const enc = ENCOUNTERS[node.encounterId!];
  const battleSeed = Math.floor(nextFloat(run) * 2 ** 31) + 1;
  run.battle = createBattle({
    build: run.build,
    rng: battleSeed,
    hp: run.hp,
    maxHp: run.maxHp,
    food: run.food,
    deck: run.deck,
    generals: run.generals,
    relics: run.relics,
    lordId: run.lordId,
    terrain: node.terrain,
    encounterId: enc.id,
    enemies: enc.enemies,
    difficulty: run.difficulty,
    allyBlessing: run.flags.allyBlessing,
    opening: { block: duelOpening.block + (support?.block ?? 0) + accord.block, damage: (support?.damage ?? 0) + accord.damage, energyPenalty: duelOpening.energyPenalty },
  });
  run.battle.rewardReduction = support?.rewardPenalty ?? 0;
  if (support) { run.social.support = null; run.history.push('군사 지원을 이번 전투에 1회 적용했다.'); }
  run.pending = { kind: 'none' };
  run.flags.allyBlessing = false;
  run.screen = 'battle';
}

/** 전투가 끝난 뒤 원정 상태에 결과를 반영한다. */
export function finishBattle(run: RunState): Result {
  const b = run.battle;
  if (!b || b.result === 'ongoing') return { ok: false, reason: '전투가 끝나지 않았다' };
  const node = currentNode(run)!;
  run.hp = b.hp;
  run.food = b.food;
  run.generals = b.generals.map((g) => ({ ...g }));
  const enc = ENCOUNTERS[b.encounterId];
  run.lastBattleSummary = summarizeBattle(run);
  run.battle = null;
  if (b.result === 'lose') {
    accordsAfterBattle(run, false);
    run.screen = 'defeat';
    run.defeatReason = analyzeDefeat(b.stats, enc.name);
    run.history.push(`${enc.name}에게 패배했다.`);
    return { ok: true };
  }
  run.history.push(`${enc.name} 격파 (병력 ${run.hp}/${run.maxHp})`);
  if (node.type === 'boss') {
    accordsAfterBattle(run, true);
    run.screen = 'victory';
    return { ok: true };
  }
  let food = node.type === 'elite' ? 5 : 3;
  if (node.terrain === 'fortress') food += 4;
  if (run.relics.includes('tuntian')) food += 2;
  run.food += food;
  if (run.relics.includes('medic')) run.hp = Math.min(run.maxHp, run.hp + 4);
  let n = 3;
  if (run.flags.rewardPenalty > 0) {
    n -= 1;
    run.flags.rewardPenalty--;
  }
  n = Math.max(1, n - (b.rewardReduction ?? 0));
  const pending: Pending = { kind: 'reward', food, cards: rewardCards(run, n), picked: false };
  if (node.type === 'elite') {
    const owned = new Set(run.relics);
    const opts = sample(run, Object.keys(RELICS).filter((r) => !owned.has(r)), 2);
    if (opts.length > 0) pending.extra = { type: 'relic', options: opts, picked: false };
  }
  run.pending = pending;
  accordsAfterBattle(run, true);
  run.screen = 'node';
  return { ok: true };
}

function summarizeBattle(run: RunState): string[] {
  const b = run.battle!;
  const taken = Object.values(b.stats.damageTaken).reduce((a, x) => a + x, 0);
  return [
    `전투 시작 병력 ${b.hp + taken} → ${b.hp}`,
    `${b.turn}턴 · 카드 ${b.stats.cardsPlayed}장 사용 · 준 피해 ${b.stats.damageDealt}`,
    `받은 피해: 전열 ${b.stats.rowTaken.front} · 후열 ${b.stats.rowTaken.rear}`,
  ];
}

export function analyzeDefeat(stats: { damageTaken: Record<string, number>; rowTaken: Record<Row, number> }, encName: string): string[] {
  const lines = [`${encName}과의 전투에서 병력이 무너졌다.`];
  const sources = Object.entries(stats.damageTaken).sort((a, b) => b[1] - a[1]);
  if (sources.length > 0) {
    lines.push('받은 피해 출처: ' + sources.slice(0, 4).map(([k, v]) => `${k} ${v}`).join(', '));
  }
  const { front, rear } = stats.rowTaken;
  if (rear > front && rear > 0) lines.push(`후열 피해(${rear})가 전열(${front})보다 컸다. 방진을 후열에 두거나 허보로 공격 열을 바꿔 보세요.`);
  else if (front > 0) lines.push(`전열 피해 ${front}. 적 의도에 맞춰 방비를 미리 쌓거나 반격 장수를 쓰면 줄일 수 있다.`);
  const self = sources.filter(([k]) => k.includes('여포') || k.includes('황개') || k.includes('고육계'));
  if (self.length > 0) lines.push('자기 능력으로 잃은 병력: ' + self.map(([k, v]) => `${k} ${v}`).join(', '));
  return lines;
}

// ───────────── 보상 ─────────────

export function generalAffinities(run: RunState): Affinity[] {
  return run.generals.map((g) => GENERALS[g.id].affinity);
}

/**
 * 카드 보상: 1장은 현재 장수들의 성향(계열/태그)에 맞는 카드에서, 나머지는 전체 풀에서 뽑는다.
 * 해금으로 풀이 넓어져도 원하는 빌드를 만들 수 있게 하는 장치.
 */
export function rewardCards(run: RunState, n: number): string[] {
  const aff = new Set(generalAffinities(run));
  const synergy = REWARD_POOL.filter((c) => aff.has(c.family) || c.tags.some((t) => aff.has(t)) || (c.synergy ?? []).some((t) => aff.has(t)));
  const out: string[] = [];
  const take = (pool: typeof REWARD_POOL) => {
    const avail = pool.filter((c) => !out.includes(c.id));
    if (avail.length === 0) return;
    const rare = avail.filter((c) => c.rarity === 'rare');
    const common = avail.filter((c) => c.rarity !== 'rare');
    const useRare = rare.length > 0 && (common.length === 0 || nextFloat(run) < 0.3);
    out.push(pick(run, useRare ? rare : common).id);
  };
  if (synergy.length > 0) take(synergy);
  while (out.length < n) {
    const before = out.length;
    take(REWARD_POOL);
    if (out.length === before) break;
  }
  return shuffle(run, out);
}

export function addCard(run: RunState, id: string): void {
  run.deck.push(newCard(run, id));
}

export function pickRewardCard(run: RunState, cardId: string | null): Result {
  const p = run.pending;
  if (p.kind !== 'reward' || p.picked) return { ok: false, reason: '고를 보상이 없다' };
  if (cardId === null) {
    run.food += 2;
    run.history.push('카드 보상을 넘기고 군량 2를 챙겼다.');
  } else {
    if (!p.cards.includes(cardId)) return { ok: false, reason: '없는 선택지' };
    addCard(run, cardId);
    run.history.push(`전법 「${CARDS[cardId].name}」 획득`);
  }
  p.picked = true;
  return { ok: true };
}

export function pickRewardExtra(run: RunState, id: string | null): Result {
  const p = run.pending;
  if (p.kind !== 'reward' || !p.extra || p.extra.picked) return { ok: false, reason: '고를 보상이 없다' };
  if (id !== null) {
    if (!p.extra.options.includes(id)) return { ok: false, reason: '없는 선택지' };
    run.relics.push(id);
    run.history.push(`보물 「${RELICS[id].name}」 획득`);
  }
  p.extra.picked = true;
  return { ok: true };
}

// ───────────── 장수 ─────────────

export function recruitPool(run: RunState, unlocked: string[] = []): string[] {
  const owned = new Set(run.generals.map((g) => g.id));
  return Object.values(GENERALS)
    .filter((g) => !owned.has(g.id) && !g.starterOnly && (!g.unlock || unlocked.includes(g.id)))
    .map((g) => g.id);
}

function recruitOptions(run: RunState, n: number): string[] {
  return sample(run, recruitPool(run, run.unlocked), n);
}

function defaultRow(generals: GeneralInst[], pref: 'front' | 'rear' | 'any'): Row {
  const count = (r: Row) => generals.filter((g) => g.row === r).length;
  const first: Row = pref === 'rear' ? 'rear' : 'front';
  const second: Row = first === 'front' ? 'rear' : 'front';
  return count(first) < ROW_CAPACITY ? first : second;
}

export function addGeneral(run: RunState, id: string): Result {
  if (run.generals.length >= MAX_GENERALS) return { ok: false, reason: '진형이 가득 찼다' };
  run.generals.push({ id, row: defaultRow(run.generals, GENERALS[id].row) });
  run.history.push(`장수 ${GENERALS[id].name} 합류`);
  return { ok: true };
}

/** 영입 시도. 진형이 가득 차면 교체 화면으로 넘긴다. */
export function offerGeneral(run: RunState, id: string, then: Pending): void {
  if (run.generals.length >= MAX_GENERALS) {
    run.pending = { kind: 'replaceGeneral', incoming: id, then };
  } else {
    addGeneral(run, id);
    run.pending = then;
  }
}

export function chooseRecruit(run: RunState, id: string | null): Result {
  const p = run.pending;
  if (p.kind !== 'recruit') return { ok: false, reason: '영입 중이 아니다' };
  if (id === null) {
    run.food += 3;
    run.history.push('영입을 사양하고 군량 3을 받았다.');
    run.pending = { kind: 'none' };
    settle(run);
    return { ok: true };
  }
  if (!p.options.includes(id)) return { ok: false, reason: '없는 후보' };
  offerGeneral(run, id, { kind: 'none' });
  settle(run);
  return { ok: true };
}

export function replaceGeneral(run: RunState, dismissId: string | null): Result {
  const p = run.pending;
  if (p.kind !== 'replaceGeneral') return { ok: false, reason: '교체 중이 아니다' };
  if (dismissId !== null) {
    const idx = run.generals.findIndex((g) => g.id === dismissId);
    if (idx < 0) return { ok: false, reason: '없는 장수' };
    const row = run.generals[idx].row;
    run.history.push(`${GENERALS[dismissId].name}이(가) 군을 떠났다.`);
    accordsOnDismiss(run, dismissId);
    delete run.build.growth[dismissId];
    run.generals.splice(idx, 1);
    run.generals.push({ id: p.incoming, row });
    run.history.push(`장수 ${GENERALS[p.incoming].name} 합류`);
  } else {
    run.history.push(`${GENERALS[p.incoming].name}의 합류를 포기했다.`);
  }
  run.pending = p.then;
  settle(run);
  return { ok: true };
}

export { toggleGeneralRow } from './combat.ts';

// ───────────── 시장·휴식·보급 ─────────────

function makeMarket(run: RunState): Pending {
  const cards = sample(run, REWARD_POOL, 3).map((c) => ({ id: c.id, price: c.rarity === 'rare' ? 5 : 3, sold: false }));
  const owned = new Set(run.relics);
  const relicIds = Object.keys(RELICS).filter((r) => !owned.has(r));
  const relic = relicIds.length > 0 ? { id: pick(run, relicIds), price: 8, sold: false } : null;
  return { kind: 'market', cards, relic, removePrice: 4, removed: false };
}

export function buyCard(run: RunState, idx: number): Result {
  const p = run.pending;
  if (p.kind !== 'market') return { ok: false, reason: '시장이 아니다' };
  const item = p.cards[idx];
  if (!item || item.sold) return { ok: false, reason: '살 수 없다' };
  if (run.food < item.price) return { ok: false, reason: '군량 부족' };
  run.food -= item.price;
  item.sold = true;
  addCard(run, item.id);
  run.history.push(`시장에서 「${CARDS[item.id].name}」 구입 (군량 -${item.price})`);
  return { ok: true };
}

export function buyRelic(run: RunState): Result {
  const p = run.pending;
  if (p.kind !== 'market' || !p.relic || p.relic.sold) return { ok: false, reason: '살 수 없다' };
  if (run.food < p.relic.price) return { ok: false, reason: '군량 부족' };
  run.food -= p.relic.price;
  p.relic.sold = true;
  run.relics.push(p.relic.id);
  run.history.push(`보물 「${RELICS[p.relic.id].name}」 구입`);
  return { ok: true };
}

export function startMarketRemove(run: RunState): Result {
  const p = run.pending;
  if (p.kind !== 'market' || p.removed) return { ok: false, reason: '불가' };
  if (run.food < p.removePrice) return { ok: false, reason: '군량 부족' };
  run.pending = { kind: 'deckPick', mode: 'remove', then: p, cost: p.removePrice };
  return { ok: true };
}

export const REST_FOOD = 2;
export function restHeal(run: RunState): Result {
  if (run.pending.kind !== 'rest') return { ok: false, reason: '휴식 중이 아니다' };
  if (run.food < REST_FOOD) return { ok: false, reason: '군량 부족' };
  run.food -= REST_FOOD;
  const heal = Math.ceil(run.maxHp * 0.3);
  const before = run.hp;
  run.hp = Math.min(run.maxHp, run.hp + heal);
  run.history.push(`휴식: 군량 -${REST_FOOD}, 병력 +${run.hp - before}`);
  run.pending = { kind: 'none' };
  settle(run);
  return { ok: true };
}

export function restDrill(run: RunState): Result {
  if (run.pending.kind !== 'rest') return { ok: false, reason: '휴식 중이 아니다' };
  run.pending = { kind: 'deckPick', mode: 'remove', then: { kind: 'none' }, cost: 0 };
  return { ok: true };
}

export function supplyChoose(run: RunState, choice: 'food' | 'hp'): Result {
  if (run.pending.kind !== 'supply') return { ok: false, reason: '보급 중이 아니다' };
  if (choice === 'food') {
    run.food += 6;
    accordsOnSupply(run);
    run.history.push('보급: 군량 +6');
  } else {
    const before = run.hp;
    run.hp = Math.min(run.maxHp, run.hp + 12);
    run.history.push(`보급: 병력 +${run.hp - before}`);
  }
  run.pending = { kind: 'none' };
  settle(run);
  return { ok: true };
}

export function deckPick(run: RunState, uid: number | null): Result {
  const p = run.pending;
  if (p.kind !== 'deckPick') return { ok: false, reason: '선택 중이 아니다' };
  if (uid === null) {
    run.pending = p.then;
    settle(run);
    return { ok: true };
  }
  const card = run.deck.find((c) => c.uid === uid);
  if (!card) return { ok: false, reason: '없는 카드' };
  if (run.food < p.cost) return { ok: false, reason: '군량 부족' };
  run.food -= p.cost;
  if (p.mode === 'remove') {
    run.deck = run.deck.filter((c) => c.uid !== uid);
    run.history.push(`「${CARDS[card.id].name}」 제거${p.cost ? ` (군량 -${p.cost})` : ''}`);
    if (p.then.kind === 'market') p.then.removed = true;
  } else {
    addCard(run, card.id);
    run.history.push(`「${CARDS[card.id].name}」 복제${p.cost ? ` (군량 -${p.cost})` : ''}`);
  }
  run.pending = p.then;
  settle(run);
  return { ok: true };
}

/** 노드에서 더 고를 것이 없으면 지도로 돌아간다. */
function settle(run: RunState): void {
  if (run.screen === 'node' && run.pending.kind === 'none') run.screen = 'map';
}

export function leaveNode(run: RunState): Result {
  if (run.screen !== 'node') return { ok: false, reason: '노드에 있지 않다' };
  const p = run.pending;
  if (['growth', 'duelOffer', 'duel', 'debate', 'parley', 'diplomacy', 'council'].includes(p.kind)) return { ok: false, reason: '활동의 선택이나 결과 확인을 먼저 끝내세요.' };
  if (p.kind === 'replaceGeneral' || p.kind === 'deckPick') return { ok: false, reason: '먼저 선택을 끝내세요' };
  if (p.kind === 'event' && !p.resultText) return { ok: false, reason: '선택지를 고르세요' };
  if ([0, 2, 4].includes(run.floor) && run.build.doctrines.length && !run.build.claimed.includes(`camp:${run.floor}`)) {
    offerGrowth(run, `camp:${run.floor}`, { kind: 'none' }); return { ok: true };
  }
  run.pending = { kind: 'none' };
  run.screen = 'map';
  return { ok: true };
}

// ───────────── 사건 ─────────────

export function eventOptionAllowed(run: RunState, eventId: string, idx: number): boolean {
  const opt = EVENTS[eventId]?.options[idx];
  if (!opt) return false;
  if (opt.req?.food !== undefined && run.food < opt.req.food) return false;
  if (opt.req?.hp !== undefined && run.hp < opt.req.hp) return false;
  if (eventId === 'wanderer' && idx === 0 && scholarCandidates(run).length === 0) return false;
  if (eventId === 'surrender' && idx === 1 && run.deck.length <= 1) return false;
  return true;
}

function scholarCandidates(run: RunState): string[] {
  return recruitPool(run, run.unlocked).filter((id) => GENERALS[id].scholar);
}

function randomRelic(run: RunState): string | null {
  const owned = new Set(run.relics);
  const ids = Object.keys(RELICS).filter((r) => !owned.has(r));
  if (ids.length === 0) return null;
  const id = pick(run, ids);
  run.relics.push(id);
  return id;
}

export function chooseEvent(run: RunState, idx: number): Result {
  const p = run.pending;
  if (p.kind !== 'event' || p.resultText) return { ok: false, reason: '사건 중이 아니다' };
  if (!eventOptionAllowed(run, p.eventId, idx)) return { ok: false, reason: '조건을 만족하지 않는다' };
  const done = (text: string): Pending => ({ kind: 'event', eventId: p.eventId, resultText: text });
  let next: Pending = done('');
  const key = `${p.eventId}:${idx}`;
  switch (key) {
    case 'wanderer:0': {
      run.food -= 5;
      const id = pick(run, scholarCandidates(run));
      next = done(`${GENERALS[id].name}이(가) 군막에 들었다.`);
      run.history.push(`사건 · 떠도는 책사: ${GENERALS[id].name} 영입 시도`);
      offerGeneral(run, id, next);
      return { ok: true };
    }
    case 'wanderer:1':
      addCard(run, 'sow');
      next = done('선비가 이간계 한 수를 적어 주고 떠났다.');
      break;
    case 'wanderer:2':
    case 'village:2':
    case 'alliance:2':
      next = done('아무 일도 없었다.');
      break;
    case 'village:0':
      run.food -= 4;
      run.maxHp += 6;
      run.hp += 6;
      next = done('마을 장정들이 자원해 합류했다. 최대 병력 +6.');
      break;
    case 'village:1':
      run.food += 7;
      addCard(run, 'unrest');
      next = done('곳간을 털었다. 군량 +7. 등 뒤의 눈길이 차갑다(「민심 이반」 추가).');
      break;
    case 'alliance:0':
      run.flags.allyBlessing = true;
      run.flags.rewardPenalty += 2;
      next = done('다음 전투에 원군이 합류한다. 대신 전리품 몫이 줄어든다(다음 카드 보상 2회 선택지 2장).');
      break;
    case 'alliance:1': {
      run.food -= 3;
      const r = randomRelic(run);
      next = done(r ? `예물로 「${RELICS[r].name}」을(를) 받았다.` : '받을 만한 예물이 없었다.');
      break;
    }
    case 'shortcut:0': {
      run.hp -= 8;
      const r = randomRelic(run);
      next = done(`낙석으로 병력 8을 잃었지만 관문 창고에서 ${r ? `「${RELICS[r].name}」` : '아무것도 못'}을(를) 찾았다.`);
      break;
    }
    case 'shortcut:1': {
      const paid = Math.min(2, run.food);
      run.food -= paid;
      const lost = (2 - paid) * 5;
      run.hp = Math.max(1, run.hp - lost);
      next = done(`돌아서 갔다. 군량 -${paid}${lost ? `, 병력 -${lost}` : ''}.`);
      break;
    }
    case 'surrender:0':
      run.maxHp += 5;
      run.hp = Math.min(run.maxHp, run.hp + 10);
      addCard(run, 'rabble');
      addCard(run, 'rabble');
      next = done('투항병을 받아들였다. 머릿수는 늘었지만 오합지졸이다.');
      break;
    case 'surrender:1':
      run.history.push('사건 · 투항병: 정예 선발');
      run.pending = { kind: 'deckPick', mode: 'remove', then: done('쓸 만한 자들만 남겼다.'), cost: 0 };
      return { ok: true };
    case 'surrender:2':
      run.food += 3;
      next = done('포로를 군량 3과 바꿨다.');
      break;
    case 'manual:0':
      run.history.push('사건 · 병법 고서: 필사');
      run.pending = { kind: 'deckPick', mode: 'duplicate', then: done('병법을 옮겨 적었다.'), cost: 3 };
      return { ok: true };
    case 'manual:1': {
      run.hp -= 5;
      const rares = REWARD_POOL.filter((c) => c.rarity === 'rare');
      const c = pick(run, rares);
      addCard(run, c.id);
      next = done(`밤샘 끝에 「${c.name}」을(를) 깨우쳤다. 병력 -5.`);
      break;
    }
    case 'manual:2':
      run.food += 4;
      next = done('고서를 팔아 군량 4를 얻었다.');
      break;
    default:
      return { ok: false, reason: '알 수 없는 선택' };
  }
  run.history.push(`사건 · ${EVENTS[p.eventId].title}: ${EVENTS[p.eventId].options[idx].text}`);
  run.pending = next;
  return { ok: true };
}

// ───────────── 메타(영구 해금) ─────────────

export const UNLOCK_ON_FIRST_WIN = ['chengong', 'machao'];

export function recordRunEnd(meta: MetaState, run: RunState, won: boolean): string[] {
  const unlocked: string[] = [];
  meta.runs++;
  meta.bestFloor = Math.max(meta.bestFloor, run.floor);
  for (const g of run.generals) if (!meta.seenGenerals.includes(g.id)) meta.seenGenerals.push(g.id);
  if (won) {
    meta.wins++;
    for (const id of UNLOCK_ON_FIRST_WIN) {
      if (!meta.unlockedGenerals.includes(id)) {
        meta.unlockedGenerals.push(id);
        unlocked.push(`새 장수 해금: ${GENERALS[id].name}`);
      }
    }
    if (meta.difficultyUnlocked < 1) {
      meta.difficultyUnlocked = 1;
      unlocked.push('새 난이도 해금: 험로 (적 체력 +20%, 시작 군량 -3)');
    }
  }
  return unlocked;
}

export function randomSeed(): number {
  return (Math.floor(Math.random() * 2 ** 31) ^ Date.now()) >>> 0 || 1;
}

