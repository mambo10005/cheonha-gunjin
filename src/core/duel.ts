import { makeRuntime, nextBuildTurn, triggerBuild, type ExpeditionBuild, type Trigger } from './build.ts';
import { TACTICS, type TacticId } from '../data/tactics.ts';
import { DUEL_OPPONENTS } from '../data/social.ts';
import { GENERALS } from '../data/generals.ts';
import { randInt } from './rng.ts';
import type { Check, DuelAction, DuelState } from './social-types.ts';

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
export function canDuelAction(s: DuelState, action: string, round: number): Check {
  if (s.result !== 'ongoing' || round !== s.round) return { ok: false, reason: '이미 처리한 행동이거나 종료된 대결입니다.' };
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
