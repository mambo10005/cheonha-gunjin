import { makeRuntime, nextBuildTurn, triggerBuild, type ExpeditionBuild, type Trigger } from './build.ts';
import { TACTICS, type TacticId } from '../data/tactics.ts';
import { DUEL_OPPONENTS } from '../data/social.ts';
import { GENERALS } from '../data/generals.ts';
import { randInt } from './rng.ts';
import type { Check, DuelAction, DuelState } from './social-types.ts';
import { canDuelDeckAction, resolveDuelDeckAction, duelDeckActions } from './duel-deck.ts';

export function createDuel(rng: number, generalId: string, opponentId: string, build?: ExpeditionBuild, tactics: TacticId[] = []): DuelState {
  const opponent = DUEL_OPPONENTS[opponentId];
  const profile = GENERALS[generalId]?.activities;
  if (!opponent || !profile) throw new Error('무장 대결 참가자가 올바르지 않습니다.');
  const s: DuelState = { rng, generalId, opponentId, round: 0, maxRounds: 4, hp: 18 + profile.duel * 2,
    maxHp: 18 + profile.duel * 2, enemyHp: opponent.hp, enemyMaxHp: opponent.hp,
    momentum: profile.duel - 1, aptitude: profile.duel, traits: [...profile.traits], pattern: [...opponent.pattern],
    patternOffset: 0, lastAction: null, result: 'ongoing', log: ['출전 장수의 대결 체력은 원정 병력과 별개입니다.'] };
  if (build) { s.build = makeRuntime(build, [generalId]); s.tactics = [...tactics]; s.usedTactics = []; s.protection = 0; s.enemyShield = opponentId === 'sentinel' ? 6 : 0; }
  s.patternOffset = randInt(s, s.pattern.length);
  return s;
}
export function duelIntent(s: DuelState): DuelAction { return s.pattern[(s.round + s.patternOffset) % s.pattern.length]; }
export const DUEL_V2_ACTIONS: Record<string, { name: string; family: string; text: string }> = {
  probe: { name: '간보기', family: '간보기', text: '근·중거리 피해 2+적성, 받는 피해 −3. 다음 두 행동 공개. 상대 지원 1 제거. 기세 +1.' },
  'step-in': { name: '보법 · 들어가기', family: '보법', text: '거리 한 단계 좁힘. 기세 +1. 닿지 않게 된 공격은 빗나갑니다.' },
  'step-out': { name: '보법 · 물러서기', family: '보법', text: '거리 한 단계 벌림. 기세 +1. 강공은 원거리에서 닿지 않습니다.' },
  strike: { name: '공세', family: '공세', text: '근거리 7·중거리 5(+적성), 원거리 0. 상대 수비에 −5. 맞받아치면 서로 +2.' },
  guard: { name: '수세', family: '수세', text: '받는 피해 −6. 상대 공격을 완전히 막으면 반격 3과 빈틈. 간보기에는 +2 피해.' },
  lure: { name: '유인', family: '유인', text: '상대가 공격하면 받는 피해 절반·근거리로 끌어들이고 빈틈. 공격이 없으면 기세 −1.' },
  finisher: { name: '승부수', family: '승부수', text: '기세 2·근거리. 빈틈이 있으면 12+적성 피해로 깔끔한 제압, 없으면 8+적성이고 상대 공격에 반격 4.' },
};
const closer = (d: 'near' | 'mid' | 'far') => d === 'far' ? 'mid' : 'near';
const farther = (d: 'near' | 'mid' | 'far') => d === 'near' ? 'mid' : 'far';
export const DISTANCE_NAMES = { near: '근거리', mid: '중거리', far: '원거리' } as const;
export const STANCE_NAMES = { offense: '공세', defense: '수세', lure: '유인' } as const;
/** 기존 대결을 2판 규칙으로 전환한다(옛 전술 장비는 쓰지 않음). */
export function enableDuelV2(s: DuelState, objective: string, opts: { distance?: 'near' | 'mid' | 'far'; support?: number; profile?: string; maxRounds?: number; pattern?: DuelAction[] } = {}): DuelState {
  s.v2 = { objective, distance: opts.distance ?? 'mid', stance: null, opening: false, openingSource: null, support: opts.support ?? 0, revealed: 0, profile: opts.profile ?? 'standard',
    stats: { rounds: 0, taken: 0, dealt: 0, maxHit: 0, counters: 0, openingsUsed: 0, blindFinishers: 0, overkill: 0, repeats: 0, actions: [], distances: [opts.distance ?? 'mid'], stances: [], enemyActions: [] } };
  s.tactics = []; s.usedTactics = []; s.enemyShield = (s.v2.support) * 3; s.protection = s.protection ?? 0;
  if (opts.maxRounds) s.maxRounds = opts.maxRounds; if (opts.pattern) s.pattern = [...opts.pattern];
  return s;
}
export function duelActionList(s: DuelState): string[] { if (s.deck) return duelDeckActions(s); if (s.v2) return [...Object.keys(DUEL_V2_ACTIONS), ...(s.loadout?.gambit ? ['gambit'] : []), 'surrender']; return ['strike', 'probe', 'guard', 'finisher', ...(s.tactics ?? []), ...(s.loadout?.gambit ? ['gambit'] : []), 'surrender']; }
function canDuelV2(s: DuelState, action: string): Check {
  const v = s.v2!;
  if (action === 'surrender') return { ok: true };
  if (action === 'gambit') { if (!s.loadout?.gambit || s.loadout.used.includes('gambit')) return { ok: false, reason: '승부수 전술이 없거나 이미 사용했습니다.' }; if (s.loadout.gambit === 'all_in' && (s.momentum < 2 || v.distance !== 'near')) return { ok: false, reason: '결사 일격: 기세 2 이상·근거리 필요.' }; return { ok: true }; }
  if (!Object.hasOwn(DUEL_V2_ACTIONS, action)) return { ok: false, reason: '없는 대결 행동입니다.' };
  if (action === 'step-in' && v.distance === 'near') return { ok: false, reason: '이미 근거리입니다.' };
  if (action === 'step-out' && v.distance === 'far') return { ok: false, reason: '이미 원거리입니다.' };
  if (action === 'finisher' && (s.momentum < 2 || v.distance !== 'near')) return { ok: false, reason: '승부수: 기세 2·근거리 필요.' };
  return { ok: true };
}
function resolveDuelV2(s: DuelState, action: string): Check {
  const v = s.v2!, enemy = duelIntent(s), P = DUEL_OPPONENTS[s.opponentId].power, apt = s.aptitude, notes: string[] = [];
  if (action === 'surrender') { s.result = 'surrender'; s.log.push('기권.'); return { ok: true }; }
  let dist = v.distance; const before = s.enemyHp;
  if (action === 'step-in') dist = closer(dist); if (action === 'step-out') dist = farther(dist);
  const attack = enemy === 'strike' || enemy === 'finisher'; let hits = false, taken = 0, dealt = 0, clean = false;
  if (enemy === 'strike') { if (dist === 'far') { dist = 'mid'; notes.push('상대 돌진: 중거리로 들어옴'); } else { taken = P + (dist === 'near' ? 1 : 0); hits = true; } }
  if (enemy === 'finisher') { if (dist !== 'near') { dist = closer(dist); notes.push('상대가 거리를 좁힘'); } else { taken = 9 + (v.profile === 'harsh' ? 2 : 0); hits = true; } }
  if (enemy === 'probe') { if (dist !== 'far') { taken = 3; hits = true; } if (v.opening) notes.push('상대 간보기: 빈틈이 닫힘'); v.opening = false; }
  const repeat = v.stats.actions.at(-1) === action && !s.traits.includes('composure'); if (repeat) v.stats.repeats++;
  const loadout = s.loadout, used = (id: string) => loadout?.used.includes(id) ?? true;
  switch (action) {
    case 'probe': dealt = dist === 'far' ? 0 : 2 + apt; taken = Math.max(0, taken - 3); v.revealed = 2; if (v.support > 0) { v.support--; s.enemyShield = Math.max(0, (s.enemyShield ?? 0) - 3); notes.push('상대 지원 하나 제거'); } s.momentum = Math.min(5, s.momentum + 1); break;
    case 'step-in': case 'step-out': s.momentum = Math.min(5, s.momentum + 1); if (attack && !hits) notes.push('보법으로 공격을 흘림'); break;
    case 'strike': dealt = dist === 'near' ? 7 + apt : dist === 'mid' ? 5 + apt : 0; if (enemy === 'guard') dealt = Math.max(0, dealt - 5 - v.support); if (enemy === 'strike' && hits) { taken += 2; dealt += 1; } v.stance = 'offense'; s.momentum = Math.min(5, s.momentum + 1); break;
    case 'guard':
      if (enemy === 'probe') taken += 2;
      else if (attack && hits) { taken = Math.max(0, taken - 6); if (taken === 0 || (s.protection ?? 0) >= taken) { v.opening = true; v.openingSource = '방비'; dealt = 3 + (s.counterBonus ?? 0); v.stats.counters++; notes.push('방비 성공: 반격과 빈틈'); if ((s.counterBonus ?? 0) > 0 && v.support > 0) { v.support--; s.enemyShield = Math.max(0, (s.enemyShield ?? 0) - 3); notes.push('준비된 반격: 지켜보던 병사 지원 하나가 흩어짐'); } if (loadout?.response === 'counter' && !used('counter')) { dealt += 5; loadout.used.push('counter'); notes.push('반격 태세 +5'); } } }
      v.stance = 'defense'; s.momentum = Math.min(5, s.momentum + 1); break;
    case 'lure':
      if (attack) { taken = Math.ceil(taken / 2); v.opening = true; v.openingSource = '유인'; dist = 'near'; notes.push('유인 성공: 근거리 빈틈'); } else { s.momentum = Math.max(0, s.momentum - 1); notes.push('유인 실패: 기세 −1'); }
      v.stance = 'lure'; break;
    case 'finisher':
      s.momentum -= 2; if (v.opening) { dealt = 12 + apt; clean = true; v.opening = false; v.stats.openingsUsed++; notes.push('빈틈 승부수: 깔끔한 제압'); } else { dealt = 8 + apt; if (enemy === 'guard') dealt = Math.max(0, dealt - 4); if (attack && hits) { taken += 4; v.stats.blindFinishers++; notes.push('읽지 않은 승부수: 반격 4'); } }
      break;
    case 'gambit': {
      const g = loadout!.gambit!; loadout!.used.push('gambit');
      if (g === 'all_in') { dealt = 4 + s.momentum * 3 + (v.opening ? 4 : 0); if (v.opening) { clean = true; v.opening = false; v.stats.openingsUsed++; } else if (attack && hits) { taken += 6; v.stats.blindFinishers++; notes.push('읽지 않은 결사 일격: 반격 6'); } s.momentum = 0; }
      if (g === 'expose') { v.support = 0; s.enemyShield = 0; dealt = 6; taken = 0; notes.push('허점 폭로: 지원 모두 제거·이번 피해 무효'); }
      if (g === 'oath') { s.hp = Math.min(s.maxHp, s.hp + 5); s.momentum = Math.min(5, s.momentum + 2); dealt = 4; }
      break; }
  }
  if (repeat) dealt = Math.max(0, dealt - 2);
  if (!clean && (s.enemyShield ?? 0) > 0 && dealt > 0) { const ab = Math.min(s.enemyShield!, dealt); dealt -= ab; s.enemyShield! -= ab; }
  if (s.initiative && s.round === 0) { taken = 0; notes.push('기습: 상대 첫 행동 무효'); }
  if (loadout?.opening === 'read' && !used('read') && taken > 0) { taken = Math.max(0, taken - 3); loadout.used.push('read'); }
  const absorbed = Math.min(taken, s.protection ?? 0); taken -= absorbed; s.protection = Math.max(0, (s.protection ?? 0) - absorbed);
  if (loadout?.response === 'second' && !used('second') && taken >= s.hp) { taken = Math.max(0, s.hp - 1); loadout.used.push('second'); notes.push('보좌 개입'); }
  s.hp = Math.max(0, s.hp - taken); s.enemyHp = Math.max(0, s.enemyHp - dealt);
  if (loadout?.response === 'ration' && !used('ration') && s.hp > 0 && s.hp * 2 <= s.maxHp) { s.hp = Math.min(s.maxHp, s.hp + 6); loadout.used.push('ration'); }
  v.distance = dist; v.stats.rounds++; v.stats.taken += taken; v.stats.dealt += dealt; v.stats.maxHit = Math.max(v.stats.maxHit, dealt); v.stats.actions.push(action); v.stats.distances.push(dist); v.stats.stances.push(v.stance ?? ''); v.stats.enemyActions.push(enemy);
  if (s.enemyHp === 0 && before > 0) v.stats.overkill = Math.max(0, dealt - before);
  if (!clean) { v.stats.forceHit = Math.max(v.stats.forceHit ?? 0, dealt); if (s.enemyHp === 0 && before > 0) v.stats.forceOverkill = Math.max(0, dealt - before); }
  if (v.revealed > 0) v.revealed--;
  s.round++; if (['strike', 'probe', 'guard', 'finisher'].includes(action)) s.lastAction = action as DuelAction;
  s.log.push(`${s.round}합 · ${DUEL_V2_ACTIONS[action]?.name ?? '승부수 전술'} vs 상대 ${({ strike: '강공', probe: '견제', guard: '방어', finisher: '승부수' })[enemy]} · ${DISTANCE_NAMES[dist]} · 준 피해 ${dealt} · 받은 피해 ${taken}${notes.length ? ' · ' + notes.join(' · ') : ''}`);
  if (s.hp === 0 && s.enemyHp === 0) s.result = 'draw'; else if (s.hp === 0) s.result = 'lose'; else if (s.enemyHp === 0) s.result = 'win';
  else if (s.round >= s.maxRounds) { s.result = s.enemyHp * 4 <= s.enemyMaxHp && s.hp * s.enemyMaxHp > s.enemyHp * s.maxHp ? 'win' : s.hp * 2 < s.maxHp && s.enemyHp * 2 > s.enemyMaxHp ? 'lose' : 'draw'; s.log.push(`${s.maxRounds}합 종료: 상대 체력 25% 이하면 판정승, 아니면 무승부(크게 밀리면 패배).`); }
  return { ok: true };
}

export function canDuelAction(s: DuelState, action: string, round: number): Check {
  if (s.result !== 'ongoing' || round !== s.round) return { ok: false, reason: '이미 처리한 행동이거나 종료된 대결입니다.' };
  if (s.deck) return canDuelDeckAction(s, action);
  if (s.v2) return canDuelV2(s, action);
  if (Object.hasOwn(TACTICS, action)) {
    if (!s.tactics?.includes(action as TacticId) || s.usedTactics?.includes(action as TacticId)) return { ok: false, reason: '장착하지 않았거나 이미 사용한 전술입니다.' };
    if (action === 'brace' && s.momentum < 1) return { ok: false, reason: '기세 1 필요.' };
    if (action === 'sacrifice' && s.hp <= 4) return { ok: false, reason: '체력 5 이상 필요.' };
    return { ok: true };
  }
  if (action === 'gambit') return s.loadout?.gambit && !s.loadout.used.includes('gambit') ? { ok: true } : { ok: false, reason: '승부수 전술이 없거나 이미 사용했습니다.' };
  if (!['strike', 'probe', 'guard', 'finisher', 'surrender'].includes(action)) return { ok: false, reason: '없는 대결 행동입니다.' };
  if (action === 'finisher' && s.momentum < 2) return { ok: false, reason: '승부수에는 기세 2가 필요합니다.' };
  return { ok: true };
}
export function resolveDuelAction(s: DuelState, action: string, round: number): Check {
  const check = canDuelAction(s, action, round);
  if (!check.ok) return check;
  if (s.deck) return resolveDuelDeckAction(s, action);
  if (s.v2) return resolveDuelV2(s, action);
  if (action === 'surrender') { s.result = 'surrender'; s.log.push('기권: 이번 전투 첫 턴 지휘력 -1.'); return check; }
  const tactic = Object.hasOwn(TACTICS, action) ? action as TacticId : null;
  const gambit = action === 'gambit' ? s.loadout!.gambit : null;
  const a = tactic ? TACTICS[tactic].mode : gambit ? 'strike' : action as DuelAction;
  if (s.build) nextBuildTurn(s.build);
  if (tactic) s.usedTactics!.push(tactic);
  const momentumBefore = s.momentum;
  const priorMode = s.lastMode ?? s.lastAction;
  const enemy = duelIntent(s);
  const repeat = !tactic && s.lastAction === a && !s.traits.includes('composure');
  let dealt = a === 'strike' ? 6 + s.aptitude : a === 'probe' ? 3 + s.aptitude : a === 'finisher' ? 9 + s.aptitude : 0;
  let taken = enemy === 'strike' ? DUEL_OPPONENTS[s.opponentId].power : enemy === 'finisher' ? 9 : enemy === 'probe' ? 3 : 0;
  if (a === 'finisher') { s.momentum -= 2; if (s.traits.includes('surge')) dealt += 2; }
  else s.momentum = Math.min(5, s.momentum + 1);
  if (repeat) dealt = Math.max(0, dealt - 2);
  if (enemy === 'guard' && a !== 'finisher') dealt = Math.max(0, dealt - 5);
  if (a === 'strike' && enemy === 'strike') taken += 3;
  if (a === 'probe') taken = Math.max(0, taken - 3);
  if (a === 'guard') {
    taken = Math.max(0, taken - (repeat ? 3 : 6));
    if (enemy === 'strike' || enemy === 'finisher') dealt += 4 + (s.traits.includes('parry') ? 2 : 0);
    if (repeat) dealt = Math.max(0, dealt - 2);
    if (enemy === 'probe') taken += 4;
  }
  if (s.build) {
    const emit = (trigger: Trigger) => {
      const out = triggerBuild(s.build!, trigger, undefined, undefined, 'duel');
      dealt += out.damage; taken = Math.max(0, taken - out.weaken);
      s.protection = (s.protection ?? 0) + out.block;
      s.momentum = Math.min(5, s.momentum + out.draw);
      s.log.push(...out.log);
    };
    if (tactic) { taken = enemy === 'strike' ? DUEL_OPPONENTS[s.opponentId].power : enemy === 'finisher' ? 9 : enemy === 'probe' ? 3 : 0; }
    if (s.opponentId === 'champion' && enemy === 'finisher') taken = Math.max(0, taken + (s.round > 0 && s.pattern[(s.round - 1 + s.patternOffset) % 4] === 'guard' ? 3 : -3));
    if (tactic === 'brace') { dealt = 0; taken = Math.max(0, taken - 8); s.momentum = Math.max(0, momentumBefore - 1); }
    if (tactic === 'feint') { dealt = 2; taken = Math.max(0, taken - 4); }
    if (tactic === 'sacrifice') { s.hp -= 4; dealt = 0; s.build.tokens.charge = Math.min(2, s.build.tokens.charge + 2); s.log.push('결사 돌파: 체력 -4 → 돌파 준비 +2 (최대 2).'); }
    if (tactic === 'breathe') { dealt = 0; taken = Math.max(0, taken - 4); s.momentum = Math.min(5, s.momentum + 1); }
    if (a === 'probe') { s.enemyShield = 0; emit('changed'); }
    if ((a === 'strike' || a === 'finisher') && (priorMode === 'guard' || priorMode === 'probe')) emit('setup');
    if (a === 'strike' || a === 'finisher') emit('attack');
    const shield = s.enemyShield ?? 0;
    if (shield && a !== 'probe') { const absorbed = Math.min(shield, dealt); dealt -= absorbed; s.enemyShield = shield - absorbed; }
    if (s.opponentId === 'sentinel' && enemy === 'guard' && !s.noSupport) { s.enemyShield = Math.min(8, (s.enemyShield ?? 0) + 4); s.log.push('관문 수비: 방비 +4, 견제로 제거 가능.'); }
    if (s.opponentId === 'rider' && (a === 'strike' || a === 'finisher') && dealt > 0 && priorMode !== 'probe') { taken += 2; s.log.push('유격 반격: 견제로 유도하지 않은 공격에 피해 2.'); }
    taken = Math.max(0, taken);
    const absorbed = Math.min(taken, s.protection ?? 0); taken -= absorbed; s.protection = Math.max(0, (s.protection ?? 0) - absorbed);
    if (a === 'guard' && !tactic && taken === 0 && ['strike', 'finisher', 'probe'].includes(enemy)) emit('guarded');
    if (tactic === 'brace' && taken === 0 && enemy !== 'guard') emit('guarded');
    s.lastMode = a;
  }
  if (s.loadout) {
    const l = s.loadout, used = (id: string) => l.used.includes(id), use = (id: string) => l.used.push(id);
    if (gambit) {
      use('gambit');
      if (gambit === 'all_in') { dealt = 8 + momentumBefore * 3; s.momentum = 0; s.log.push(`결사 일격: 기세 ${momentumBefore} 소진.`); }
      if (gambit === 'expose') { s.enemyShield = 0; dealt = 6; taken = 0; s.log.push('허점 폭로: 상대 방비 제거·이번 피해 무효.'); }
      if (gambit === 'oath') { s.hp = Math.min(s.maxHp, s.hp + 5); s.momentum = Math.min(5, momentumBefore + 2); dealt = 4; s.log.push('맹약의 증언: 체력 5 회복·기세 +2.'); }
    }
    if (l.opening === 'read' && !used('read') && taken > 0) { taken = Math.max(0, taken - 3); use('read'); }
    if (l.response === 'counter' && !used('counter') && a === 'guard' && taken === 0 && enemy !== 'guard') { const extra = 5 + (s.counterBonus ?? 0); dealt += extra; use('counter'); s.log.push(`반격 태세: 반격 피해 ${extra}.`); }
    if (l.response === 'second' && !used('second') && taken >= s.hp) { taken = Math.max(0, s.hp - 1); use('second'); s.log.push('보좌 개입: 쓰러질 피해를 체력 1로 버팀.'); }
  }
  if (s.initiative && s.round === 0) { taken = 0; s.log.push('기습: 상대의 첫 행동이 무효가 되었습니다.'); }
  s.hp = Math.max(0, s.hp - taken); s.enemyHp = Math.max(0, s.enemyHp - dealt);
  if (s.loadout?.response === 'ration' && !s.loadout.used.includes('ration') && s.hp > 0 && s.hp * 2 <= s.maxHp) { s.hp = Math.min(s.maxHp, s.hp + 6); s.loadout.used.push('ration'); s.log.push('보급 회복: 체력 6 회복.'); }
  s.round++; s.lastAction = a;
  s.log.push(`${s.round}회: 상대 체력 -${dealt}, 내 체력 -${taken}${repeat ? ' (연속 행동 효율 감소)' : ''}.`);
  if (s.hp === 0 && s.enemyHp === 0) s.result = 'draw';
  else if (s.hp === 0) s.result = 'lose';
  else if (s.enemyHp === 0) s.result = 'win';
  else if (s.round >= s.maxRounds) {
    const score = s.hp * s.enemyMaxHp - s.enemyHp * s.maxHp;
    s.result = Math.abs(score) <= 2 * s.enemyMaxHp ? 'draw' : score > 0 ? 'win' : 'lose';
    s.log.push('4회 종료: 남은 체력 비율 비교. 체력 2에 해당하는 차이 이내는 무승부.');
  }
  return { ok: true };
}
export function previewDuelAction(s: DuelState, action: string): { check: Check; state: DuelState } {
  const state = structuredClone(s);
  return { check: resolveDuelAction(state, action, s.round), state };
}
export function duelResultText(s: DuelState): string {
  return s.result === 'win' ? '승리: 이번 전투 첫 턴 전열 방비 +6.' : s.result === 'draw' ? '무승부: 이번 전투 첫 턴 전열 방비 +2.' : '패배·기권: 이번 전투 첫 턴 지휘력 -1. 다음 턴에 해제됩니다.';
}
