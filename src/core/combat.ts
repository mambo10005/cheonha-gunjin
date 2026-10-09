// 전투 규칙 엔진. DOM을 전혀 모른다. 모든 함수는 BattleState를 직접 갱신한다.
//
// ■ 카드 사용 처리 순서
//   1) 사용 가능 판정 → 2) 지휘력 지불 → 3) 기세 +1 (마초: 기병이면 +1 추가)
//   4) 카드 효과를 적힌 순서대로 처리 (대상이 이미 쓰러졌으면 그 효과는 무효 처리되고 로그에 남는다)
//   5) 장수 '카드 사용 후' 능력: 진형 순서(전열 → 후열, 각 열은 배치 순)로 처리
//   6) 군주 규칙(손권 연계) → 7) 카드는 버림패(소멸 카드는 소멸 더미)로 → 8) 승패 판정
//   재발동(여포)은 피해 효과만 다시 처리하며, 재발동이 장수 능력을 다시 부르지는 않는다.
//
// ■ 턴 종료 처리 순서
//   1) 플레이어 '턴 종료' 능력(여포 불만) → 2) 손패 버림 → 3) 동요 해제
//   4) 적들이 왼쪽부터 한 명씩: 방비 소멸 → 화상 피해(방비 무시) 후 화상 -1 → 혼란이면 행동 취소 → 의도 실행
//   5) 살아있는 적 전원 다음 의도 결정(보스 2단계 전환 포함)
//   6) 플레이어 턴 시작: 방비 소멸(조인: 전열 절반 유지) → 반격 초기화 → 지휘력·기세 초기화 → 카드 뽑기
//
// ■ 피해 계산 (적에게)
//   기본값 + 가산(정보, 연노 기계, 진궁, 평야·서량마 기병 보너스) → 배수(무장 대결, 추격) → 적 방비 → 체력
//
// ■ 무한 연쇄 방지
//   지휘력/카드 획득 능력은 모두 턴당 횟수 제한이 있다. 추가로 한 턴의 처리 예산(budget)을 넘으면 처리를 멈춘다.

import { makeRuntime, nextBuildTurn, triggerBuild, type ExpeditionBuild, type Trigger } from './build.ts';
import { CARDS } from '../data/cards.ts';
import { ENEMIES } from '../data/enemies.ts';
import { GENERALS, ROW_CAPACITY } from '../data/generals.ts';
import { ROW_NAME } from './describe.ts';
import { randInt, shuffle } from './rng.ts';
import type {
  BattleState,
  CardDef,
  CardInst,
  Effect,
  EnemyState,
  GeneralInst,
  LogEntry,
  PlayTarget,
  Row,
  Terrain,
} from './types.ts';

export const HAND_SIZE = 5;
export const BASE_ENERGY = 3;
export const MAX_HAND = 10;
export const TURN_BUDGET = 400;

export interface BattleSetup {
  build?: ExpeditionBuild;
  opening?: { block: number; damage: number; energyPenalty: number };
  rng: number;
  hp: number;
  maxHp: number;
  food: number;
  deck: CardInst[];
  generals: GeneralInst[];
  relics: string[];
  lordId: string;
  terrain: Terrain;
  encounterId: string;
  enemies: string[];
  difficulty: number;
  allyBlessing: boolean;
}

// ───────────── 기본 도구 ─────────────

export function log(b: BattleState, text: string, kind: LogEntry['kind'] = 'info'): void {
  b.log.push({ turn: b.turn, text, kind });
}

export function cardDef(c: CardInst): CardDef {
  const d = CARDS[c.id];
  if (!d) throw new Error(`알 수 없는 카드: ${c.id}`);
  return d;
}

export function hasRelic(b: BattleState, id: string): boolean {
  return b.relics.includes(id);
}

/** 장수가 있고, 배치 조건을 만족하고, 동요 상태가 아니면 능력이 작동한다. */
export function generalActive(b: BattleState, id: string): boolean {
  const g = b.generals.find((x) => x.id === id);
  if (!g) return false;
  const def = GENERALS[id];
  if (def.row !== 'any' && def.row !== g.row) return false;
  if (g.row === 'rear' && b.shakenRear) return false;
  return true;
}

export function generalStatus(b: BattleState, g: GeneralInst): 'active' | 'wrongRow' | 'shaken' {
  const def = GENERALS[g.id];
  if (def.row !== 'any' && def.row !== g.row) return 'wrongRow';
  if (g.row === 'rear' && b.shakenRear) return 'shaken';
  return 'active';
}

function orderedGenerals(b: BattleState): GeneralInst[] {
  return [...b.generals.filter((g) => g.row === 'front'), ...b.generals.filter((g) => g.row === 'rear')];
}

export function aliveEnemies(b: BattleState): EnemyState[] {
  return b.enemies.filter((e) => !e.dead);
}

function spend(b: BattleState): boolean {
  b.budget--;
  if (b.budget === 0) log(b, '연쇄 처리 상한에 도달해 이번 턴의 남은 연쇄를 중단합니다.', 'warn');
  return b.budget > 0;
}

function checkEnd(b: BattleState): void {
  if (b.result !== 'ongoing') return;
  if (b.hp <= 0) {
    b.hp = 0;
    b.result = 'lose';
    log(b, '병력이 모두 무너졌다. 패배.', 'warn');
  } else if (aliveEnemies(b).length === 0) {
    b.result = 'win';
    log(b, '적군을 모두 물리쳤다. 승리!', 'info');
  }
}

// ───────────── 전투 생성 ─────────────

function spawnEnemy(b: BattleState, defId: string): EnemyState {
  const def = ENEMIES[defId];
  if (!def) throw new Error(`알 수 없는 적: ${defId}`);
  const hp = Math.round(def.hp * (1 + 0.2 * b.difficulty));
  const e: EnemyState = {
    uid: b.nextEnemyUid++,
    defId,
    name: def.name,
    hp,
    maxHp: hp,
    block: 0,
    str: 0,
    burn: 0,
    confused: false,
    turncoat: false,
    patternIdx: def.boss ? 0 : randInt(b, def.pattern.length),
    phase: 1,
    intent: null,
    dead: false,
  };
  b.enemies.push(e);
  chooseIntent(b, e);
  return e;
}

function chooseIntent(b: BattleState, e: EnemyState): void {
  const def = ENEMIES[e.defId];
  const pattern = e.phase === 2 && def.phase2 ? def.phase2.pattern : def.pattern;
  e.intent = pattern[e.patternIdx % pattern.length];
  e.patternIdx++;
}

export function createBattle(s: BattleSetup): BattleState {
  const b: BattleState = {
    build: s.build ? makeRuntime(s.build, [...s.generals.filter(g => g.row === 'front'), ...s.generals.filter(g => g.row === 'rear')].map(g => g.id)) : undefined,
    rng: s.rng,
    turn: 0,
    energy: 0,
    baseEnergy: BASE_ENERGY,
    momentum: 0,
    hp: s.hp,
    maxHp: s.maxHp,
    food: s.food,
    block: { front: 0, rear: 0 },
    counter: { front: 0, rear: 0 },
    shakenRear: false,
    generals: s.generals.map((g) => ({ ...g })),
    enemies: [],
    draw: [],
    hand: [],
    discard: [],
    exhausted: [],
    log: [],
    terrain: s.terrain,
    relics: s.relics.slice(),
    lordId: s.lordId,
    flags: freshFlags(),
    result: 'ongoing',
    nextEnemyUid: 1,
    budget: TURN_BUDGET,
    stats: { damageTaken: {}, damageDealt: 0, cardsPlayed: 0, rowTaken: { front: 0, rear: 0 } },
    encounterId: s.encounterId,
    difficulty: s.difficulty,
  };
  b.draw = shuffle(b, s.deck.map((c) => ({ ...c })));
  for (const id of s.enemies) spawnEnemy(b, id);

  log(b, '전투 개시.', 'info');
  if (b.terrain === 'fortress') {
    for (const e of b.enemies) e.block += 10;
    log(b, '성채: 적이 방비 10을 갖고 시작한다.', 'info');
  }
  startPlayerTurn(b);
  if (generalActive(b, 'haozhao')) {
    const n = b.terrain === 'fortress' ? 12 : 6;
    gainBlock(b, 'front', n, '학소');
  }
  if (hasRelic(b, 'armor')) gainBlock(b, 'front', 8, '철갑');
  if (s.allyBlessing) {
    log(b, '동맹 원군이 먼저 들이친다!', 'general');
    for (const e of aliveEnemies(b)) applyDamageToEnemy(b, e, 12, '원군', '12', null);
  }
  if (s.opening) {
    if (s.opening.block) gainBlock(b, 'front', s.opening.block, '대결·외교 시작 효과');
    b.energy = Math.max(0, b.energy - s.opening.energyPenalty);
    if (s.opening.energyPenalty) log(b, '대결 피로: 첫 턴 지휘력 -1. 다음 턴 해제.', 'warn');
    if (s.opening.damage) for (const e of aliveEnemies(b)) applyDamageToEnemy(b, e, s.opening.damage, '외교 지원', String(s.opening.damage), null);
  }
  return b;
}

function freshFlags(): BattleState['flags'] {
  return {
    firstMuUsed: false,
    firstChaekDiscountUsed: false,
    freeSwapUsed: false,
    sunQuanUsed: false,
    drumUsed: false,
    zhangliaoUses: 0,
    guojiaUsed: false,
    chengongBonus: 0,
    familiesPlayed: [],
  };
}

// ───────────── 카드 더미 ─────────────

export function drawCards(b: BattleState, n: number): void {
  for (let i = 0; i < n; i++) {
    if (b.draw.length === 0) {
      if (b.discard.length === 0) {
        log(b, '더 뽑을 카드가 없다.', 'info');
        return;
      }
      b.draw = shuffle(b, b.discard);
      b.discard = [];
      log(b, `버림패 ${b.draw.length}장을 섞어 뽑을 더미를 만들었다.`, 'info');
    }
    const c = b.draw.pop()!;
    if (b.hand.length >= MAX_HAND) {
      b.discard.push(c);
      log(b, `손패가 가득 차 ${cardDef(c).name}을(를) 버렸다.`, 'warn');
    } else {
      b.hand.push(c);
    }
  }
}

// ───────────── 플레이어 턴 ─────────────

function startPlayerTurn(b: BattleState): void {
  b.turn++;
  if (b.build) nextBuildTurn(b.build);
  delete b.buildLastFamily;
  b.budget = TURN_BUDGET;
  const keepFront = generalActive(b, 'caoren') ? Math.floor(b.block.front / 2) : 0;
  if (keepFront > 0) log(b, `조인: 전열 방비 ${keepFront} 유지.`, 'general');
  b.block = { front: keepFront, rear: 0 };
  b.counter = { front: 0, rear: 0 };
  b.flags = freshFlags();
  b.momentum = 0;
  b.energy = b.baseEnergy;
  log(b, `— 제 ${b.turn}턴 —`, 'info');
  if (b.lordId === 'caocao' && b.generals.length >= 2) {
    b.energy += 1;
    if (b.turn === 1) log(b, '조조 · 유재시거: 장수 2명 이상, 매 턴 지휘력 +1.', 'general');
  }
  if (b.turn === 1) {
    if (hasRelic(b, 'seal')) {
      b.energy += 1;
      log(b, '인수: 첫 턴 지휘력 +1.', 'general');
    }
    if (generalActive(b, 'machao')) {
      b.energy += 1;
      log(b, '마초: 선봉의 기세로 첫 턴 지휘력 +1.', 'general');
    }
  }
  drawCards(b, HAND_SIZE + (hasRelic(b, 'book') ? 1 : 0));
}

export function effectiveCost(b: BattleState, c: CardInst): number {
  const d = cardDef(c);
  let cost = d.cost;
  if (b.terrain === 'mountain' && d.family === 'chaek' && !b.flags.firstChaekDiscountUsed) cost = Math.max(0, cost - 1);
  return cost;
}

export interface Check {
  ok: boolean;
  reason?: string;
}

export function needsTarget(d: CardDef): 'enemy' | 'row' | null {
  if (d.target === 'enemy') return 'enemy';
  if (d.target === 'row') return 'row';
  return null;
}

export function canPlay(b: BattleState, handIdx: number, target?: PlayTarget): Check {
  if (b.result !== 'ongoing') return { ok: false, reason: '전투가 끝났다' };
  const c = b.hand[handIdx];
  if (!c) return { ok: false, reason: '카드가 없다' };
  const d = cardDef(c);
  if (d.unplayable) return { ok: false, reason: '사용할 수 없는 카드' };
  if (effectiveCost(b, c) > b.energy) return { ok: false, reason: '지휘력 부족' };
  for (const e of d.effects) {
    if (e.k === 'payFood' && b.food < e.n) return { ok: false, reason: '군량 부족' };
    if (e.k === 'loseHp' && b.hp <= e.n) return { ok: false, reason: '병력이 너무 적다' };
  }
  if (target === undefined) return { ok: true };
  if (d.target === 'enemy') {
    const en = b.enemies.find((x) => x.uid === target.enemy);
    if (!en || en.dead) return { ok: false, reason: '대상 적을 고르세요' };
    if (d.needsAttackIntent && en.intent?.kind !== 'attack') return { ok: false, reason: '공격 의도의 적만 대상' };
    if (d.effects.some((e) => e.k === 'swapIntentRow') && en.intent?.kind === 'attack' && en.intent.row === 'both')
      return { ok: false, reason: '양 열 공격은 바꿀 수 없다' };
  }
  if (d.target === 'row' && !target.row) return { ok: false, reason: '열을 고르세요' };
  return { ok: true };
}

interface PlayCtx {
  def: CardDef;
  target: PlayTarget;
  bonus: number;
  bonusText: string;
  retrigger: boolean;
}

export function playCard(b: BattleState, handIdx: number, target: PlayTarget = {}): Check {
  const chk = canPlay(b, handIdx, target);
  if (!chk.ok) return chk;
  const c = b.hand[handIdx];
  const d = cardDef(c);
  const cost = effectiveCost(b, c);
  b.hand.splice(handIdx, 1);
  b.energy -= cost;
  if (d.family === 'chaek' && b.terrain === 'mountain') b.flags.firstChaekDiscountUsed = true;
  b.momentum += 1;
  log(b, `${d.name} 사용 (지휘력 ${cost}, 기세 ${b.momentum})`, 'player');
  if (d.tags.includes('cavalry') && generalActive(b, 'machao')) {
    b.momentum += 1;
    log(b, `마초: 기병 돌격으로 기세 +1 (${b.momentum})`, 'general');
  }
  if (!b.flags.familiesPlayed.includes(d.family)) b.flags.familiesPlayed.push(d.family);

  // 카드 단위 가산 피해(武 카드에만)
  let bonus = 0;
  const bonusParts: string[] = [];
  if (d.family === 'mu') {
    if (!b.flags.firstMuUsed && hasRelic(b, 'crossbow')) {
      bonus += 3;
      bonusParts.push('+3 연노 기계');
    }
    b.flags.firstMuUsed = true;
    if (b.flags.chengongBonus > 0) {
      bonus += b.flags.chengongBonus;
      bonusParts.push(`+${b.flags.chengongBonus} 진궁`);
      b.flags.chengongBonus = 0;
    }
  }
  const ctx: PlayCtx = { def: d, target, bonus, bonusText: bonusParts.join(' '), retrigger: false };

  if (b.build && d.family === 'mu') {
    if (b.buildLastFamily && b.buildLastFamily !== 'mu') applyBuild(b, 'setup', target.enemy);
    b.buildBonus = applyBuild(b, 'attack', target.enemy);
  }
  resolveEffects(b, ctx);
  b.buildBonus = 0;
  b.buildLastFamily = d.family;
  if (b.result === 'ongoing') afterCardHooks(b, ctx);
  if (b.result === 'ongoing' && hasRelic(b, 'drum') && !b.flags.drumUsed && b.momentum >= 4) {
    b.flags.drumUsed = true;
    log(b, '전고: 기세 4! 카드 1장 뽑기.', 'general');
    drawCards(b, 1);
  }
  if (d.exhaust) b.exhausted.push(c);
  else b.discard.push(c);
  b.stats.cardsPlayed++;
  checkEnd(b);
  return { ok: true };
}

const DAMAGE_EFFECTS = new Set<Effect['k']>(['dmg', 'dmgMomentum', 'dmgAll', 'dmgBlock', 'dmgLowHpDouble', 'dmgMomentumDouble']);

function resolveEffects(b: BattleState, ctx: PlayCtx): void {
  for (const eff of ctx.def.effects) {
    if (b.result !== 'ongoing') return;
    if (ctx.retrigger && !DAMAGE_EFFECTS.has(eff.k)) continue;
    if (!spend(b)) return;
    resolveEffect(b, eff, ctx);
  }
}

function targetEnemy(b: BattleState, ctx: PlayCtx): EnemyState | null {
  const e = b.enemies.find((x) => x.uid === ctx.target.enemy);
  if (!e) return null;
  if (e.dead) {
    log(b, `${e.name}은(는) 이미 쓰러져 ${ctx.def.name}의 효과가 무효가 되었다.`, 'warn');
    return null;
  }
  return e;
}

function resolveEffect(b: BattleState, eff: Effect, ctx: PlayCtx): void {
  switch (eff.k) {
    case 'dmg': {
      const hits = eff.hits ?? 1;
      for (let i = 0; i < hits; i++) {
        const e = targetEnemy(b, ctx);
        if (!e) return;
        cardDamage(b, e, eff.n, ctx, 1, '');
      }
      return;
    }
    case 'dmgMomentum': {
      const e = targetEnemy(b, ctx);
      if (!e) return;
      cardDamage(b, e, eff.base + b.momentum * eff.per, ctx, 1, `(기본 ${eff.base} + 기세 ${b.momentum}×${eff.per})`);
      return;
    }
    case 'dmgAll': {
      for (const e of aliveEnemies(b)) {
        if (b.result !== 'ongoing') return;
        if (!e.dead) cardDamage(b, e, eff.n, ctx, 1, '');
      }
      return;
    }
    case 'dmgBlock': {
      const e = targetEnemy(b, ctx);
      if (!e) return;
      cardDamage(b, e, b.block.front, ctx, 1, '(전열 방비)');
      return;
    }
    case 'dmgLowHpDouble': {
      const e = targetEnemy(b, ctx);
      if (!e) return;
      const mult = e.hp * 2 <= e.maxHp ? 2 : 1;
      cardDamage(b, e, eff.n, ctx, mult, mult === 2 ? '×2 추격(체력 절반 이하)' : '');
      return;
    }
    case 'dmgMomentumDouble': {
      const e = targetEnemy(b, ctx);
      if (!e) return;
      const mult = b.momentum >= eff.threshold ? 2 : 1;
      cardDamage(b, e, eff.n, ctx, mult, mult === 2 ? `×2 무장 대결(기세 ${b.momentum})` : '');
      return;
    }
    case 'breakBlock': {
      const e = targetEnemy(b, ctx);
      if (!e) return;
      if (e.block > 0) log(b, `${e.name}의 방비 ${e.block} 제거.`, 'player');
      e.block = 0;
      return;
    }
    case 'block': {
      if (eff.row === 'both') {
        gainBlock(b, 'front', eff.n, ctx.def.name);
        gainBlock(b, 'rear', eff.n, ctx.def.name);
      } else {
        const row: Row = eff.row === 'choose' ? (ctx.target.row ?? 'front') : eff.row;
        gainBlock(b, row, eff.n, ctx.def.name);
      }
      return;
    }
    case 'blockDouble': {
      const add = Math.min(eff.cap, b.block.front);
      gainBlock(b, 'front', add, `${ctx.def.name}(2배)`);
      return;
    }
    case 'counter':
      b.counter[eff.row] += eff.n;
      log(b, `${ROW_NAME[eff.row]} 반격 +${eff.n} (이번 적 턴)`, 'player');
      return;
    case 'burn': {
      const e = targetEnemy(b, ctx);
      if (!e) return;
      applyBurn(b, e, eff.n, ctx.def.name);
      return;
    }
    case 'burnAll':
      for (const e of aliveEnemies(b)) applyBurn(b, e, eff.n, ctx.def.name);
      return;
    case 'burnMultiply':
      for (const e of aliveEnemies(b)) {
        const add = Math.min(eff.cap, e.burn);
        if (add > 0) {
          e.burn += add;
          log(b, `${ctx.def.name}: ${e.name}의 화상 +${add} (${e.burn})`, 'player');
        }
      }
      return;
    case 'draw':
      drawCards(b, eff.n);
      return;
    case 'energy':
      b.energy += eff.n;
      log(b, `지휘력 +${eff.n} (${b.energy})`, 'player');
      return;
    case 'momentum':
      b.momentum += eff.n;
      log(b, `기세 +${eff.n} (${b.momentum})`, 'player');
      return;
    case 'payFood':
      b.food -= eff.n;
      log(b, `군량 ${eff.n} 소비 (남은 군량 ${b.food})`, 'player');
      return;
    case 'loseHp':
      playerLoseHp(b, eff.n, ctx.def.name);
      return;
    case 'swapIntentRow': {
      const e = targetEnemy(b, ctx);
      if (!e || e.intent?.kind !== 'attack' || e.intent.row === 'both') return;
      const to: Row = e.intent.row === 'front' ? 'rear' : 'front';
      e.intent = { ...e.intent, row: to };
      applyBuild(b, 'changed', e.uid);
      log(b, `${e.name}의 공격 대상이 ${ROW_NAME[to]}으로 바뀌었다.`, 'player');
      return;
    }
    case 'turncoat': {
      const e = targetEnemy(b, ctx);
      if (!e) return;
      e.turncoat = true;
      if (e.intent?.kind === 'attack') applyBuild(b, 'changed', e.uid);
      log(b, `${e.name}에게 이간계: 다음 공격이 아군을 향한다.`, 'player');
      return;
    }
    case 'confuse': {
      const e = targetEnemy(b, ctx);
      if (!e) return;
      e.confused = true;
      if (e.intent?.kind === 'attack') applyBuild(b, 'changed', e.uid);
      log(b, `${e.name}이(가) 혼란에 빠졌다: 다음 행동 취소.`, 'player');
      return;
    }
    case 'nothing':
      return;
  }
}

/** 카드에서 나오는 피해. 가산 → 배수 → 방비 → 체력 순. */
function cardDamage(b: BattleState, e: EnemyState, base: number, ctx: PlayCtx, mult: number, note: string): void {
  const buildBonus = ctx.retrigger ? 0 : (b.buildBonus ?? 0);
  let amount = base + buildBonus;
  b.buildBonus = 0;
  const parts = [`${base}${note && note.startsWith('(') ? note : ''}`];
  if (buildBonus) parts.push(`+${buildBonus} 원정 연쇄`);
  if (ctx.bonus > 0) {
    amount += ctx.bonus;
    parts.push(ctx.bonusText);
  }
  if (e.burn > 0 && generalActive(b, 'chengpu')) {
    amount += 2;
    parts.push('+2 정보(화상)');
  }
  if (ctx.def.tags.includes('cavalry')) {
    if (b.terrain === 'plains') {
      amount += 3;
      parts.push('+3 평야');
    }
    if (hasRelic(b, 'horse')) {
      amount += 2;
      parts.push('+2 서량마');
    }
  }
  if (mult !== 1) {
    amount *= mult;
    parts.push(note.startsWith('×') ? note : `×${mult}`);
  }
  const label = ctx.retrigger ? `${ctx.def.name}(여포 재발동)` : ctx.def.name;
  applyDamageToEnemy(b, e, Math.max(0, amount), label, parts.join(' '), ctx.def);
}

export function applyDamageToEnemy(
  b: BattleState,
  e: EnemyState,
  amount: number,
  label: string,
  breakdown: string,
  source: CardDef | null,
): number {
  if (e.dead) return 0;
  const blocked = Math.min(e.block, amount);
  e.block -= blocked;
  const loss = amount - blocked;
  e.hp -= loss;
  b.stats.damageDealt += loss;
  const calc = breakdown && breakdown !== String(amount) ? `${breakdown} = ${amount}` : `${amount}`;
  log(b, `${label} → ${e.name}: ${calc}${blocked ? `, 방비 ${blocked} 흡수` : ''} → 체력 -${loss} (${Math.max(0, e.hp)}/${e.maxHp})`, 'damage');
  if (e.hp <= 0) killEnemy(b, e, source);
  return loss;
}

function killEnemy(b: BattleState, e: EnemyState, source: CardDef | null): void {
  if (e.dead) return;
  e.dead = true;
  e.hp = 0;
  const burnLeft = e.burn;
  e.burn = 0;
  e.intent = null;
  log(b, `${e.name} 격파!`, 'info');
  if (ENEMIES[e.defId].boss) {
    for (const o of aliveEnemies(b)) {
      o.dead = true;
      o.intent = null;
      log(b, `${o.name}은(는) 주군을 잃고 도주했다.`, 'info');
    }
    checkEnd(b);
    return;
  }
  if (burnLeft > 0 && generalActive(b, 'luxun')) {
    const others = aliveEnemies(b);
    if (others.length > 0) {
      log(b, `육손: ${e.name}의 불길(화상 ${burnLeft})이 번진다.`, 'general');
      for (const o of others) {
        o.burn += burnLeft;
        log(b, `  ${o.name} 화상 +${burnLeft} (${o.burn})`, 'general');
      }
    }
  }
  if (source && source.tags.includes('cavalry') && generalActive(b, 'zhangliao') && b.flags.zhangliaoUses < 2) {
    b.flags.zhangliaoUses++;
    b.energy += 1;
    log(b, `장료: 기병으로 격파! 지휘력 +1, 카드 1장 (${b.flags.zhangliaoUses}/2)`, 'general');
    drawCards(b, 1);
  }
  checkEnd(b);
}

export function gainBlock(b: BattleState, row: Row, n: number, label: string): void {
  let amt = n;
  let note = '';
  if (b.terrain === 'river' && amt > 0) {
    amt += 2;
    note = ' (+2 하천)';
  }
  b.block[row] += amt;
  log(b, `${label}: ${ROW_NAME[row]} 방비 +${amt}${note} → ${b.block[row]}`, 'player');
}

export function applyBurn(b: BattleState, e: EnemyState, n: number, label: string): void {
  if (e.dead) return;
  let amt = n;
  const notes: string[] = [];
  if (hasRelic(b, 'oil')) {
    amt += 1;
    notes.push('+1 기름');
  }
  if (b.terrain === 'river') {
    amt = Math.floor(amt / 2);
    notes.push('하천 절반');
  }
  e.burn += amt;
  log(b, `${label}: ${e.name} 화상 +${amt}${notes.length ? ` (${notes.join(', ')})` : ''} → ${e.burn}`, 'player');
}

function playerLoseHp(b: BattleState, n: number, source: string): void {
  b.hp -= n;
  b.stats.damageTaken[source] = (b.stats.damageTaken[source] ?? 0) + n;
  checkEnd(b);
}

function afterCardHooks(b: BattleState, ctx: PlayCtx): void {
  const d = ctx.def;
  for (const g of orderedGenerals(b)) {
    if (b.result !== 'ongoing') return;
    if (!generalActive(b, g.id)) continue;
    if (!spend(b)) return;
    switch (g.id) {
      case 'huanggai':
        if (d.tags.includes('fire')) {
          log(b, '황개: 고육계! 병력 2를 잃고 불길을 키운다.', 'general');
          playerLoseHp(b, 2, '황개(고육계)');
          if (b.result !== 'ongoing') return;
          const alive = aliveEnemies(b);
          if (alive.length > 0) {
            const top = alive.reduce((a, x) => (x.hp > a.hp ? x : a));
            applyBurn(b, top, 3, '황개');
          }
        }
        break;
      case 'guojia':
        if (d.tags.includes('scheme') && !b.flags.guojiaUsed) {
          b.flags.guojiaUsed = true;
          b.energy += 1;
          log(b, '곽가: 계책이 맞아떨어졌다. 지휘력 +1, 카드 1장.', 'general');
          drawCards(b, 1);
        }
        break;
      case 'chengong':
        if (d.family === 'chaek') {
          const before = b.flags.chengongBonus;
          b.flags.chengongBonus = Math.min(12, before + 4);
          if (b.flags.chengongBonus > before) log(b, `진궁: 다음 武 카드 피해 +${b.flags.chengongBonus}`, 'general');
        }
        break;
      case 'lubu':
        if (d.family === 'mu' && b.momentum >= 3 && d.effects.some((e) => DAMAGE_EFFECTS.has(e.k))) {
          log(b, `여포: 기세 ${b.momentum}! ${d.name}의 피해를 한 번 더.`, 'general');
          resolveEffects(b, { ...ctx, retrigger: true });
        }
        break;
      default:
        break;
    }
  }
  if (b.result !== 'ongoing') return;
  if (b.lordId === 'sunquan' && !b.flags.sunQuanUsed && b.flags.familiesPlayed.length === 3) {
    b.flags.sunQuanUsed = true;
    b.energy += 1;
    log(b, '손권 · 강동 연계: 武·防·策을 모두 썼다. 지휘력 +1.', 'general');
  }
}

// ───────────── 장수 위치 교대 ─────────────

/** 다른 열로 옮긴다. 그 열이 가득 차 있으면 그 열 첫 장수와 자리를 바꾼다. (원정 지도와 전투 공용) */
export function toggleGeneralRow(generals: GeneralInst[], idx: number): void {
  const g = generals[idx];
  if (!g) return;
  const to: Row = g.row === 'front' ? 'rear' : 'front';
  const occupant = generals.findIndex((x, i) => i !== idx && x.row === to);
  const count = generals.filter((x) => x.row === to).length;
  if (count >= ROW_CAPACITY && occupant >= 0) generals[occupant].row = g.row;
  g.row = to;
}

export function swapCost(b: BattleState): number {
  return b.lordId === 'caocao' && !b.flags.freeSwapUsed ? 0 : 1;
}

export function moveGeneral(b: BattleState, idx: number): Check {
  if (b.result !== 'ongoing') return { ok: false, reason: '전투가 끝났다' };
  if (!b.generals[idx]) return { ok: false, reason: '장수가 없다' };
  const cost = swapCost(b);
  if (b.energy < cost) return { ok: false, reason: '지휘력 부족' };
  b.energy -= cost;
  if (cost === 0) b.flags.freeSwapUsed = true;
  toggleGeneralRow(b.generals, idx);
  const g = b.generals[idx];
  log(b, `${GENERALS[g.id].name}이(가) ${ROW_NAME[g.row]}으로 이동 (지휘력 ${cost}).`, 'player');
  return { ok: true };
}

// ───────────── 턴 종료와 적 턴 ─────────────

export function endTurn(b: BattleState): void {
  if (b.result !== 'ongoing') return;
  if (generalActive(b, 'lubu') && b.momentum < 3) {
    log(b, `여포의 불만: 기세 ${b.momentum} < 3. 병력 3 손실.`, 'warn');
    playerLoseHp(b, 3, '여포(불만)');
  }
  b.discard.push(...b.hand);
  b.hand = [];
  b.shakenRear = false;
  if (b.result !== 'ongoing') return;
  enemyPhase(b);
  if (b.result === 'ongoing') startPlayerTurn(b);
}

function enemyPhase(b: BattleState): void {
  log(b, '— 적의 차례 —', 'enemy');
  const actors = aliveEnemies(b).map((e) => e.uid);
  for (const uid of actors) {
    const e = b.enemies.find((x) => x.uid === uid)!;
    if (e.dead) continue;
    e.block = 0;
    if (e.burn > 0) {
      const alive = aliveEnemies(b);
      const chained = generalActive(b, 'pangtong') && alive.every((x) => x.burn > 0);
      const dmg = e.burn * (chained ? 2 : 1);
      e.hp -= dmg;
      b.stats.damageDealt += dmg;
      log(b, `${e.name} 화상 피해 ${e.burn}${chained ? '×2 방통(연환)' : ''} = ${dmg} → 체력 ${Math.max(0, e.hp)}`, 'damage');
      e.burn -= 1;
      if (e.hp <= 0) killEnemy(b, e, null);
      if (b.result !== 'ongoing') return;
      if (e.dead) continue;
    }
    if (e.confused) {
      e.confused = false;
      log(b, `${e.name}은(는) 혼란으로 행동하지 못했다.`, 'enemy');
      continue;
    }
    executeIntent(b, e);
    if (b.result !== 'ongoing') return;
  }
  for (const e of aliveEnemies(b)) {
    const def = ENEMIES[e.defId];
    if (def.phase2 && e.phase === 1 && e.hp <= e.maxHp * def.phase2.at) {
      e.phase = 2;
      e.patternIdx = 0;
      e.str += def.phase2.str;
      e.burn = 0;
      log(b, def.phase2.text, 'warn');
    }
    chooseIntent(b, e);
  }
}

function executeIntent(b: BattleState, e: EnemyState): void {
  const it = e.intent;
  if (!it) return;
  switch (it.kind) {
    case 'attack': {
      if (e.turncoat) {
        const others = aliveEnemies(b).filter((x) => x.uid !== e.uid);
        if (others.length > 0) {
          e.turncoat = false;
          const victim = others.reduce((a, x) => (x.hp > a.hp ? x : a));
          log(b, `${e.name}이(가) 이간계에 넘어가 ${victim.name}을(를) 공격한다!`, 'enemy');
          const total = it.hits * (it.row === 'both' ? 2 : 1);
          for (let i = 0; i < total; i++) {
            if (victim.dead || b.result !== 'ongoing') break;
            applyDamageToEnemy(b, victim, it.dmg + e.str, `${e.name}(이간계)`, `${it.dmg}${e.str ? ` +${e.str} 힘` : ''}`, null);
          }
          return;
        }
        log(b, `${e.name}: 이간계를 쓸 상대가 없어 원래대로 공격한다.`, 'enemy');
        e.turncoat = false;
      }
      const rows: Row[] = it.row === 'both' ? ['front', 'rear'] : [it.row];
      for (const r of rows) {
        for (let h = 0; h < it.hits; h++) {
          if (e.dead || b.result !== 'ongoing') return;
          const terrainBonus = b.terrain === 'mountain' && r === 'rear' ? 2 : 0;
          hitPlayerRow(b, e, r, it.dmg + e.str + terrainBonus, terrainBonus);
        }
        if (e.dead || b.result !== 'ongoing') return;
        const dianBase = r === 'front' && generalActive(b, 'dianwei') ? 3 : 0;
        const dianBlock = dianBase ? Math.floor(b.block.front / 2) : 0;
        const dian = dianBase + dianBlock;
        const total = b.counter[r] + dian;
        if (total > 0) {
          const src = [
            dian ? `전위 3${dianBlock ? ` + 남은 방비 절반 ${dianBlock}` : ''}` : '',
            b.counter[r] ? `반격 태세 ${b.counter[r]}` : '',
          ]
            .filter(Boolean)
            .join(' + ');
          applyDamageToEnemy(b, e, total, `${ROW_NAME[r]} 반격`, src, null);
          if (generalActive(b, 'haozhao') && b.result === 'ongoing') gainBlock(b, 'front', 2, '학소(반격)');
        }
      }
      return;
    }
    case 'block':
      e.block += it.n;
      log(b, `${e.name} 방비 +${it.n}`, 'enemy');
      return;
    case 'buff': {
      const targets = it.allies ? aliveEnemies(b) : [e];
      for (const t of targets) t.str += it.str;
      if (it.block) e.block += it.block;
      log(b, `${e.name}: ${it.allies ? '아군 전원 ' : ''}힘 +${it.str}${it.block ? `, 방비 +${it.block}` : ''}`, 'enemy');
      return;
    }
    case 'cleanse':
      for (const t of aliveEnemies(b)) {
        t.burn = 0;
        t.block += it.block;
      }
      log(b, `${e.name}의 요술: 아군 화상 제거, 방비 +${it.block}`, 'enemy');
      return;
    case 'summon': {
      const others = aliveEnemies(b).filter((x) => x.uid !== e.uid).length;
      if (others >= 2) {
        e.block += it.fallbackBlock;
        log(b, `${e.name}: 증원이 충분해 방비 +${it.fallbackBlock}`, 'enemy');
      } else {
        const n = spawnEnemy(b, it.defId);
        log(b, `${e.name}이(가) ${n.name}을(를) 불러냈다.`, 'enemy');
      }
      return;
    }
  }
}

function hitPlayerRow(b: BattleState, e: EnemyState, r: Row, amount: number, terrainBonus: number): void {
  const blocked = Math.min(b.block[r], amount);
  b.block[r] -= blocked;
  const loss = amount - blocked;
  if (blocked > 0 && loss === 0) applyBuild(b, 'guarded', e.uid);
  const tb = terrainBonus ? ` (산길 +${terrainBonus})` : '';
  log(b, `${e.name} → ${ROW_NAME[r]}: ${amount}${tb}${blocked ? `, 방비 ${blocked} 흡수` : ''} → 병력 -${loss}`, 'enemy');
  if (loss > 0) {
    b.stats.rowTaken[r] += loss;
    playerLoseHp(b, loss, e.name);
    if (r === 'rear' && b.generals.some((g) => g.row === 'rear')) {
      if (hasRelic(b, 'beacon')) log(b, '봉화대: 후열이 동요하지 않는다.', 'general');
      else if (!b.shakenRear) {
        b.shakenRear = true;
        log(b, '후열이 피해를 입어 동요했다: 다음 턴 후열 장수 능력 정지.', 'warn');
      }
    }
  }
}

// ───────────── 미리보기 ─────────────

export interface Preview {
  ok: boolean;
  reason?: string;
  enemies: { uid: number; name: string; hp: [number, number]; block: [number, number]; burn: [number, number]; dead: boolean }[];
  player: { hp: [number, number]; front: [number, number]; rear: [number, number]; energy: [number, number] };
  logs: string[];
}

/** 복제한 상태에서 실제 규칙으로 카드를 처리해 결과를 보여준다. 설명과 결과가 어긋날 수 없다. */
export function previewPlay(b: BattleState, handIdx: number, target: PlayTarget): Preview {
  const c = structuredClone(b);
  const before = b.log.length;
  const res = playCard(c, handIdx, target);
  return {
    ok: res.ok,
    reason: res.reason,
    enemies: b.enemies.map((e) => {
      const a = c.enemies.find((x) => x.uid === e.uid)!;
      return { uid: e.uid, name: e.name, hp: [e.hp, a.hp], block: [e.block, a.block], burn: [e.burn, a.burn], dead: a.dead && !e.dead };
    }),
    player: { hp: [b.hp, c.hp], front: [b.block.front, c.block.front], rear: [b.block.rear, c.block.rear], energy: [b.energy, c.energy] },
    logs: c.log.slice(before).map((l) => l.text),
  };
}

export interface IncomingRow {
  raw: number;
  blocked: number;
  net: number;
}

/** 현재 의도대로 적이 행동하면 각 열이 받을 피해 추정(화상으로 먼저 쓰러질 적 제외). */
export function incomingPreview(b: BattleState): Record<Row, IncomingRow> {
  const raw = { front: 0, rear: 0 };
  for (const e of aliveEnemies(b)) {
    if (e.burn >= e.hp || e.confused || e.turncoat) continue;
    const it = e.intent;
    if (it?.kind !== 'attack') continue;
    const rows: Row[] = it.row === 'both' ? ['front', 'rear'] : [it.row];
    for (const r of rows) raw[r] += (it.dmg + e.str + (b.terrain === 'mountain' && r === 'rear' ? 2 : 0)) * it.hits;
  }
  const out = {} as Record<Row, IncomingRow>;
  for (const r of ['front', 'rear'] as Row[]) {
    const blocked = Math.min(b.block[r], raw[r]);
    out[r] = { raw: raw[r], blocked, net: raw[r] - blocked };
  }
  return out;
}

export function enemyIntentNote(e: EnemyState): string {
  const notes: string[] = [];
  if (e.confused) notes.push('혼란: 행동 취소');
  if (e.turncoat) notes.push('이간계: 아군 공격');
  if (e.burn > 0) notes.push(e.burn >= e.hp ? `화상 ${e.burn}: 행동 전 쓰러짐` : `화상 ${e.burn}: 행동 전 피해`);
  return notes.join(' · ');
}

function applyBuild(b: BattleState, trigger: Trigger, target?: number): number {
  if (!b.build) return 0;
  const out = triggerBuild(b.build, trigger, undefined, b.generals.filter(g => generalActive(b, g.id)).map(g => g.id));
  for (const text of out.log) log(b, text, 'general');
  if (out.block) { gainBlock(b, 'front', out.block, '원정 성장'); gainBlock(b, 'rear', out.block, '원정 성장'); }
  if (out.draw) drawCards(b, out.draw);
  const enemy = b.enemies.find(e => e.uid === target && !e.dead);
  if (out.weaken && enemy?.intent?.kind === 'attack') { enemy.intent = { ...enemy.intent, dmg: Math.max(0, enemy.intent.dmg - out.weaken) }; log(b, enemy.name + ': 돌파 후 이번 의도 피해 -' + out.weaken, 'general'); }
  return out.damage;
}
