import { GENERALS } from '../data/generals.ts';
import type { RunState } from './types.ts';
import type { Check } from './social-types.ts';

export type Direction = 'bastion' | 'breakthrough' | 'scheme';
export type GrowthId = 'guardian' | 'avenger' | 'vanguard' | 'raider' | 'planner' | 'saboteur';
export type Token = 'riposte' | 'charge' | 'insight';
export type Trigger = 'guarded' | 'setup' | 'changed' | 'attack' | 'spent';
export interface ExpeditionBuild { doctrines: Direction[]; growth: Record<string, { branch: GrowthId; level: number }>; claimed: string[] }
export interface BuildRuntime {
  sources: { id: Direction | GrowthId; level: number; label: string; owner?: string }[];
  tokens: Record<Token, number>; uses: Record<string, number>; epoch: number;
}
type Operation = { kind: 'token'; token: Token; amount: number } | { kind: 'damage' | 'block' | 'weaken' | 'draw'; amount: number };
interface Rule { scope: 'both' | 'battle' | 'duel'; target: 'actingSide' | 'opponent'; expires: 'encounter'; trigger: Trigger; token?: Token; cost?: { token: Token; amount: number }; operations: Operation[]; limit: number }
interface Definition { negotiation?: { reports?: number; focus?: number }; name: string; direction: Direction; text: string; rules: Rule[] }
const generate = (trigger: Trigger, token: Token): Rule => ({ scope: 'both', target: 'actingSide', expires: 'encounter', trigger, limit: 2, operations: [{ kind: 'token', token, amount: 1 }] });
const spend = (token: Token, amount: number, damage: number): Rule => ({ scope: 'both', target: 'opponent', expires: 'encounter', trigger: 'attack', cost: { token, amount }, limit: 2, operations: [{ kind: 'damage', amount: damage }] });
const follow = (token: Token, kind: 'damage' | 'block' | 'weaken' | 'draw', amount: number): Rule => ({ scope: 'both', target: kind === 'damage' || kind === 'weaken' ? 'opponent' : 'actingSide', expires: 'encounter', trigger: 'spent', token, limit: 2, operations: [{ kind, amount }] });
export const DOCTRINES: Record<Direction, Definition> = {
  bastion: { negotiation: { reports: 1 }, name: '수비 반격', direction: 'bastion', text: '완전 방어 → 반격 준비 +1(최대 2). 다음 공격의 첫 피해 / 대결 공격에 준비 1 소비 → 피해 +5. 일반 전투는 다음 턴까지 준비 유지. 대결은 방어로 실제 피해 0일 때 발동.', rules: [generate('guarded', 'riposte'), spend('riposte', 1, 5)] },
  breakthrough: { negotiation: { focus: 1 }, name: '교대 돌파', direction: 'breakthrough', text: '방어·계책 전법 다음 공격 / 대결에서 방어·견제 다음 공격 → 돌파 준비 +1(최대 2). 다음 공격의 첫 피해 / 대결 공격에 준비 2 소비 → 피해 +10. 공격만 반복하면 준비되지 않음.', rules: [generate('setup', 'charge'), spend('charge', 2, 10)] },
  scheme: { negotiation: { reports: 1 }, name: '허점 공략', direction: 'scheme', text: '공격 의도 조작 / 대결 견제 → 정보 +1(최대 2). 다음 공격의 첫 피해 / 대결 공격에 정보 1 소비 → 피해 +5. 계책 뒤 공격할 전법이 필요함.', rules: [generate('changed', 'insight'), spend('insight', 1, 5)] },
};
export const GROWTH: Record<GrowthId, Definition> = {
  guardian: { negotiation: { reports: 1 }, name: '호위', direction: 'bastion', text: '완전 방어 → 반격 준비 +1. 반격 준비 소비 → 양 열 방비 3 / 대결 보호 3. 강화 시 보호 6.', rules: [generate('guarded', 'riposte'), follow('riposte', 'block', 3)] },
  avenger: { name: '응징', direction: 'bastion', text: '완전 방어 → 반격 준비 +1. 반격 준비 소비 → 추가 피해 4. 강화 시 추가 피해 8.', rules: [generate('guarded', 'riposte'), follow('riposte', 'damage', 4)] },
  vanguard: { name: '선봉', direction: 'breakthrough', text: '준비 행동 다음 공격 → 돌파 준비 +1. 돌파 준비 소비 → 대상 공격 의도 피해 -2 / 대결 이번 상대 피해 -2. 강화 시 -4.', rules: [generate('setup', 'charge'), follow('charge', 'weaken', 2)] },
  raider: { name: '귀환', direction: 'breakthrough', text: '준비 행동 다음 공격 → 돌파 준비 +1. 돌파 준비 소비 → 양 열 방비 4 / 대결 보호 4. 강화 시 보호 8.', rules: [generate('setup', 'charge'), follow('charge', 'block', 4)] },
  planner: { negotiation: { focus: 1 }, name: '재계산', direction: 'scheme', text: '공격 의도 조작 / 대결 견제 → 정보 +1. 정보 소비 → 전법 1장 뽑기 / 대결 기세 +1. 강화 시 2. 활동 자원은 서로 이동하지 않음.', rules: [generate('changed', 'insight'), follow('insight', 'draw', 1)] },
  saboteur: { negotiation: { reports: 1 }, name: '급습', direction: 'scheme', text: '공격 의도 조작 / 대결 견제 → 정보 +1. 정보 소비 → 추가 피해 4. 강화 시 추가 피해 8.', rules: [generate('changed', 'insight'), follow('insight', 'damage', 4)] },
};
// 성장 단독도 사용 가능하도록 소비 규칙을 한 곳에서 구성한다.
for (const d of Object.values(GROWTH)) d.rules.splice(1, 0, spend(d.direction === 'bastion' ? 'riposte' : d.direction === 'scheme' ? 'insight' : 'charge', d.direction === 'breakthrough' ? 2 : 1, 0));
export function defaultBuild(): ExpeditionBuild { return { doctrines: [], growth: {}, claimed: [] }; }
export function makeRuntime(build: ExpeditionBuild, generals: string[]): BuildRuntime {
  return { sources: [...build.doctrines.map(id => ({ id, level: 1, label: DOCTRINES[id].name })), ...generals.filter(id => build.growth[id]).map(id => ({ id: build.growth[id].branch, level: build.growth[id].level, owner: id, label: `${GENERALS[id].name} · ${GROWTH[build.growth[id].branch].name}` }))], tokens: { riposte: 0, charge: 0, insight: 0 }, uses: {}, epoch: 0 };
}
export function nextBuildTurn(r: BuildRuntime): void { r.epoch++; r.uses = {}; }
export interface BuildResult { damage: number; block: number; weaken: number; draw: number; log: string[] }
/** Snapshot sources in doctrine→formation order. Consumption emits only spent, never another attack.
 * All rules at most twice per turn/round; tokens persist in this encounter, cap 2; no RNG. */
export function triggerBuild(r: BuildRuntime, trigger: Trigger, token?: Token, active?: string[], scope: 'battle' | 'duel' = 'battle'): BuildResult {
  const out: BuildResult = { damage: 0, block: 0, weaken: 0, draw: 0, log: [] };
  const queue: { trigger: Trigger; token?: Token }[] = [{ trigger, token }];
  let budget = 24;
  while (queue.length) {
    if (--budget < 0) { out.log.push('연쇄 상한 24: 남은 발동을 중단합니다.'); break; }
    const event = queue.shift()!;
    const consumed = new Set<Token>();
    r.sources.forEach((source) => {
      if (source.owner && active && !active.includes(source.owner)) return;
      const d = Object.hasOwn(DOCTRINES, source.id) ? DOCTRINES[source.id as Direction] : GROWTH[source.id as GrowthId];
      d.rules.forEach((rule, ri) => {
        if (rule.scope !== 'both' && rule.scope !== scope) return;
        if (rule.trigger !== event.trigger || rule.token && rule.token !== event.token) return;
        if (rule.cost && Object.hasOwn(GROWTH, source.id) && r.sources.some(x => Object.hasOwn(DOCTRINES, x.id) && DOCTRINES[x.id as Direction].direction === d.direction)) return;
        if (rule.cost && consumed.has(rule.cost.token)) return;
        if (rule.cost && r.tokens[rule.cost.token] < rule.cost.amount) return;
        const key = `${source.owner ?? 'doctrine'}:${source.id}:${ri}`;
        if ((r.uses[key] ?? 0) >= rule.limit) { out.log.push(`${source.label}: 이번 턴 발동 ${rule.limit}회 한도.`); return; }
        r.uses[key] = (r.uses[key] ?? 0) + 1;
        if (rule.cost) { consumed.add(rule.cost.token); r.tokens[rule.cost.token] -= rule.cost.amount; queue.push({ trigger: 'spent', token: rule.cost.token }); }
        for (const op of rule.operations) {
          const n = op.kind === 'token' || rule.trigger !== 'spent' ? op.amount : op.amount * source.level;
          if (op.kind === 'token') {
            const before = r.tokens[op.token]; r.tokens[op.token] = Math.min(2, before + n);
            out.log.push(`${source.label} → ${{ riposte: '반격 준비', charge: '돌파 준비', insight: '정보' }[op.token]} +${r.tokens[op.token] - before}${before + n > 2 ? ' (보유 한도 2)' : ''}`);
          } else { out[op.kind] += n; out.log.push(`${source.label} → ${{ damage: '피해', block: '보호', weaken: '의도 약화', draw: '재계산' }[op.kind]} ${n}${rule.cost ? ` (${{ riposte: '반격 준비', charge: '돌파 준비', insight: '정보' }[rule.cost.token]} ${rule.cost.amount} 소비)` : ''}`); }
        }
      });
    });
  }
  return out;
}
export function chooseDoctrine(run: RunState, id: string): Check {
  if (run.screen !== 'map' || run.floor !== -1 || run.build.doctrines.length || !Object.hasOwn(DOCTRINES, id)) return { ok: false, reason: '출발 전 교리 1개를 선택합니다.' };
  run.build.doctrines.push(id as Direction); run.history.push(`교리 선택: ${DOCTRINES[id as Direction].name}`);
  // 모든 출발 방향에 보통 전법으로 발동 수단을 보장한다. 희귀 보상은 불필요.
  const card = id === 'scheme' ? 'feint' : id === 'breakthrough' ? 'order' : 'formation';
  run.deck.push({ uid: run.nextUid++, id: card });
  return { ok: true };
}
export function offerGrowth(run: RunState, token: string, then: RunState['pending']): void {
  if (!run.build.doctrines.length || run.build.claimed.includes(token)) { run.pending = then; return; }
  run.pending = { kind: 'growth', token, then };
}
export function chooseGrowth(run: RunState, choice: string, generalId: string): Check {
  const p = run.pending;
  if (run.screen !== 'node' || p.kind !== 'growth' || run.build.claimed.includes(p.token)) return { ok: false, reason: '성장 보상이 없습니다.' };
  if (choice === 'recover') { run.hp = Math.min(run.maxHp, run.hp + 8); run.food += 2; }
  else if (choice.startsWith('doctrine:')) {
    if (p.general) return { ok: false, reason: '공동 작전 보상은 지정 장수 성장 또는 회복 중 선택합니다.' };
    const id = choice.slice(9) as Direction;
    if (!Object.hasOwn(DOCTRINES, id) || run.build.doctrines.includes(id) || run.build.doctrines.length >= 2) return { ok: false, reason: '교리는 서로 다른 2개까지.' };
    run.build.doctrines.push(id);
  } else {
    if (p.general && p.general !== generalId) return { ok: false, reason: '이 협정의 성장 대상 장수를 선택하세요.' };
    if (!run.generals.some(g => g.id === generalId) || !Object.hasOwn(GROWTH, choice)) return { ok: false, reason: '군단 장수와 성장 분기를 선택하세요.' };
    const old = run.build.growth[generalId];
    if (old && (old.branch !== choice || old.level >= 2)) return { ok: false, reason: '장수당 한 분기, 최대 2단계. 다른 장수 또는 자원 보상을 선택하세요.' };
    run.build.growth[generalId] = { branch: choice as GrowthId, level: (old?.level ?? 0) + 1 };
  }
  const name = choice === 'recover' ? '병력 +8·군량 +2' : choice.startsWith('doctrine:') ? DOCTRINES[choice.slice(9) as Direction].name : `${GENERALS[generalId].name} · ${GROWTH[choice as GrowthId].name} ${run.build.growth[generalId].level}단계`;
  run.build.claimed.push(p.token); run.history.push(`원정 성장: ${name}. 이번 원정에 유지.`);
  run.pending = p.then;
  if (p.then.kind === 'none') run.screen = 'map';
  return { ok: true };
}

export function negotiationBuildTools(build: ExpeditionBuild, general: string) {
  let reports = 0, focus = 0;
  for (const id of build.doctrines) { reports += DOCTRINES[id].negotiation?.reports ?? 0; focus += DOCTRINES[id].negotiation?.focus ?? 0; }
  const growth = build.growth[general];
  if (growth) { reports += (GROWTH[growth.branch].negotiation?.reports ?? 0) * growth.level; focus += (GROWTH[growth.branch].negotiation?.focus ?? 0) * growth.level; }
  return { reports: Math.min(2, reports), focus: Math.min(2, focus) };
}
