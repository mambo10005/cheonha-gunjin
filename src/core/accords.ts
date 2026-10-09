import { GENERALS } from '../data/generals.ts';
import { offerGrowth } from './build.ts';
import type { Agreement, ClauseId, Coordinate } from './accord-types.ts';
import type { Check, FactionId } from './social-types.ts';
import type { MapNode, RunState } from './types.ts';

export const CLAUSES = {
  sponsorship: { name: '상단 후원', faction: 'caravan', cost: 1, text: '군량 +5(성공 협상 시 +6). 지정 전투의 카드 보상을 군량 +3으로 전환. 이행까지 보급에서 군량 +1. 해당 전투까지 만료. 이행 시 관계 +1, 파기·기한 초과 시 관계 -1·군량 -2.' },
  escort: { name: '향촌 호송', faction: 'villages', cost: 2, text: '병력 +4. 지정 보급에서 군량을 얻은 뒤 지정 전투에 전열 방비 +8 지원(성공 협상 시 +12). 전투 승리까지 의무. 이행 시 관계 +1, 파기·기한 초과 시 관계 -1·군량 -2.' },
  operation: { name: '의용군 공동 작전', faction: 'militia', cost: 2, text: '지정 정예전 시작에 적 전원 피해 4(성공 협상 시 8). 해당 전투 승리 시 지정 장수의 성장 선택(최대 2단계, 회복 대안 가능). 이행 시 관계 +1, 파기·기한 초과 시 관계 -1·군량 -2.' },
} as const;
export interface AgreementQuote { clause: ClauseId; cost: number; deposit: number; target: Coordinate | null; supply: Coordinate | null; boosted: boolean; reason?: string }
const same = (a: Coordinate, b: Coordinate) => a.floor === b.floor && a.col === b.col;
export function activeAgreements(run: RunState): Agreement[] { return run.social.accords.agreements.filter(a => a.status === 'active'); }
/** Enumerate only actual edges, respecting obligations already accepted. Never invent a missing supply/elite. */
export function reachableNodes(run: RunState, from: Coordinate = { floor: run.floor, col: run.col }): MapNode[] {
  let frontier = from.floor < 0 ? run.map[0] : run.map[from.floor][from.col].next.map(c => run.map[from.floor + 1]?.[c]).filter((n): n is MapNode => !!n);
  const found: MapNode[] = [];
  while (frontier.length) {
    const constraints = activeAgreements(run).flatMap(a => [a.target, ...(a.supply && a.stage === 'waiting' ? [a.supply] : [])]);
    const row = frontier.filter(n => constraints.every(c => c.floor !== n.floor || c.col === n.col));
    found.push(...row);
    frontier = [...new Map(row.flatMap(n => n.next.map(c => run.map[n.floor + 1]?.[c]).filter((x): x is MapNode => !!x)).map(n => [`${n.floor}:${n.col}`, n])).values()];
  }
  const obligations = activeAgreements(run).flatMap(a => [a.target, ...(a.supply && a.stage === 'waiting' ? [a.supply] : [])]);
  return found.filter(n => supportsPath(run, from, [...obligations, n])).sort((a, b) => a.floor - b.floor || a.col - b.col);
}
function supportsPath(run: RunState, from: Coordinate, requirements: Coordinate[]): boolean {
  const required=requirements.filter(c => c.floor > from.floor);
  if (!required.length) return true;
  const end=Math.max(...required.map(c=>c.floor));
  let frontier=from.floor<0?run.map[0]:run.map[from.floor][from.col].next.map(c=>run.map[from.floor+1]?.[c]).filter((n):n is MapNode=>!!n);
  for(let f=from.floor+1;f<=end;f++) {
    const row=frontier.filter(n=>required.every(c=>c.floor!==f || c.col===n.col));
    if(!row.length)return false;
    frontier=[...new Map(row.flatMap(n=>n.next.map(c=>run.map[f+1]?.[c]).filter((n):n is MapNode=>!!n)).map(n=>[n.col,n])).values()];
  }
  return true;
}
export function agreementQuote(run: RunState, clause: string): AgreementQuote {
  const q: AgreementQuote = { clause: clause as ClauseId, cost: 0, deposit: 0, target: null, supply: null, boosted: false };
  if (!Object.hasOwn(CLAUSES, clause)) { q.reason = '없는 협정입니다.'; return q; }
  const d = CLAUSES[clause as ClauseId], p = run.pending;
  if (p.kind !== 'council' || p.faction !== d.faction) { q.reason = '이 세력의 협정이 아닙니다.'; return q; }
  const result = p.negotiated?.result;
  q.boosted = result === 'success'; q.deposit = result === 'partial' ? 2 : 0; q.cost = Math.max(1, d.cost - (run.generals.some(g => GENERALS[g.id].activities?.traits.includes('envoy')) ? 1 : 0)) + q.deposit;
  if (p.negotiated && p.negotiated.clause !== clause) q.reason = '협상한 협정만 수락할 수 있습니다.';
  else if (result === 'failure') q.reason = '협상 실패: 기본 조건으로 다시 제안하거나 포기할 수 있습니다.';
  else if (activeAgreements(run).length >= 2) q.reason = '활성 협정 슬롯 2개가 찼습니다. 기존 협정을 포기하거나 이번 제안을 거절하세요.';
  else if (run.social.relations[d.faction] < 0) q.reason = '적대 상태입니다. 이번 원정에는 이 세력의 새 협정을 체결할 수 없습니다.';
  else if (activeAgreements(run).some(a => a.clause === clause)) q.reason = '같은 협정은 중첩할 수 없습니다.';
  if (q.reason) return q;
  const future = reachableNodes(run);
  if (clause === 'escort') {
    for (const supply of future.filter(n => n.type === 'supply')) {
      const target = reachableNodes(run, supply).find(n => ['battle', 'elite', 'boss'].includes(n.type));
      if (target) { q.supply = { floor: supply.floor, col: supply.col }; q.target = { floor: target.floor, col: target.col }; break; }
    }
  } else {
    const n = future.find(n => clause === 'operation' ? n.type === 'elite' : ['battle', 'elite'].includes(n.type));
    if (n) q.target = { floor: n.floor, col: n.col };
  }
  if (!q.target) q.reason = '남은 지도에 의무를 완료할 실제 연결 경로가 없습니다.';
  return q;
}
export function describeAgreement(q: AgreementQuote): string {
  if (!Object.hasOwn(CLAUSES, q.clause)) return q.reason ?? '';
  const place = (c: Coordinate) => `${c.floor + 1}층 ${c.col + 1}번 경로`;
  return `${CLAUSES[q.clause].text} 즉시 군량 -${q.cost}${q.deposit ? ' (부분 합의 예치금 2 포함, 이행 시 반환·파기 시 몰수)' : ''}. 의무: ${q.supply ? place(q.supply) + ' 군량 보급 → ' : ''}${q.target ? place(q.target) : '완료 경로 없음'}${q.boosted ? ' · 성공 협상 강화 조건' : ''}.`;
}
function relation(run: RunState, faction: FactionId, delta: number): void { run.social.relations[faction] = Math.max(-1, Math.min(2, run.social.relations[faction] + delta)); }
function closeAgreement(run: RunState, a: Agreement, status: 'fulfilled' | 'broken' | 'expired', reason: string): void {
  if (a.status !== 'active') return;
  a.status = status; relation(run, a.faction, status === 'fulfilled' ? 1 : -1);
  if (status === 'fulfilled') run.food += a.deposit;
  else run.food = Math.max(0, run.food - 2);
  run.history.push(`${CLAUSES[a.clause].name}: ${reason} → ${status === 'fulfilled' ? '관계 +1' + (a.deposit ? '·예치금 반환 +2' : '') : '관계 -1·군량 -2(최소 0)·예치금 몰수'}. 협정 종료.`);
}
export function signAgreement(run: RunState, clause: string, general: string): Check {
  if (run.screen !== 'node' || run.pending.kind !== 'council') return { ok: false, reason: '협정 제안 화면이 아닙니다.' };
  const q = agreementQuote(run, clause); if (q.reason) return { ok: false, reason: q.reason };
  const token = `${run.floor}:${run.col}:agreement`;
  if (run.social.used.includes(token)) return { ok: false, reason: '이미 이 장소에서 협정을 체결했습니다.' };
  if (run.food < q.cost) return { ok: false, reason: `군량 ${q.cost}가 필요합니다.` };
  if (clause === 'operation' && !run.generals.some(g => g.id === general)) return { ok: false, reason: '성장 대상은 현재 군단 장수여야 합니다.' };
  const p = run.pending;
  const a: Agreement = { uid: run.social.accords.nextUid++, clause: q.clause, faction: p.faction, target: q.target!, supply: q.supply,
    beneficiary: clause === 'operation' ? general : null, stage: 'waiting', status: 'active', deposit: q.deposit, boosted: q.boosted, createdFloor: run.floor };
  run.food -= q.cost; run.flags.rewardPenalty += p.negotiated?.terms.penalty ?? 0;
  if (clause === 'sponsorship') run.food += q.boosted ? 6 : 5;
  if (clause === 'escort') run.hp = Math.min(run.maxHp, run.hp + 4);
  run.social.accords.agreements.push(a); run.social.used.push(token);
  const text = describeAgreement(q); run.history.push(text); run.pending = { kind: 'socialResult', text }; return { ok: true };
}
export function abandonAgreement(run: RunState, uid: number): Check {
  if (run.pending.kind === 'debate' || run.pending.kind === 'growth' || run.screen !== 'map' && run.screen !== 'node') return { ok: false, reason: '전투 중에는 협정을 변경할 수 없습니다.' };
  const a = activeAgreements(run).find(a => a.uid === uid); if (!a) return { ok: false, reason: '유효한 협정이 아닙니다.' };
  closeAgreement(run, a, 'broken', '플레이어가 포기'); return { ok: true };
}
export function accordsOnMove(run: RunState, target: MapNode): void {
  for (const a of activeAgreements(run)) {
    const required = a.supply && a.stage === 'waiting' ? a.supply : a.target;
    if (target.floor > required.floor) closeAgreement(run, a, 'expired', '기한까지 의무를 완료하지 못함');
    else if (target.floor === required.floor && target.col !== required.col) closeAgreement(run, a, 'broken', '지정 경로 이탈');
  }
}
export function accordsOnSupply(run: RunState): void {
  const here = { floor: run.floor, col: run.col };
  for (const a of activeAgreements(run)) {
    if (a.clause === 'sponsorship') { run.food++; run.history.push('상단 후원: 실제 군량 보급 → 군량 +1.'); }
    if (a.clause === 'escort' && a.stage === 'waiting' && a.supply && same(a.supply, here)) { a.stage = 'armed'; run.history.push('향촌 호송: 지정 군량 보급 완료 → 지정 전투의 보호 지원 준비.'); }
  }
}
export function accordsBattleOpening(run: RunState): { block: number; damage: number } {
  let block = 0, damage = 0;
  for (const a of activeAgreements(run).filter(a => same(a.target, run))) {
    if (a.clause === 'escort' && a.stage === 'armed') block += a.boosted ? 12 : 8;
    if (a.clause === 'operation') damage += a.boosted ? 8 : 4;
  }
  return { block, damage };
}
/** Called exactly once by finishBattle after pending reward creation. State transitions prevent duplicate benefits. */
export function accordsAfterBattle(run: RunState, won: boolean): void {
  const growthRewards: Agreement[] = [];
  for (const a of activeAgreements(run).filter(a => same(a.target, run))) {
    if (!won || a.clause === 'escort' && a.stage !== 'armed') { closeAgreement(run, a, 'broken', won ? '미보급 상태로 목표 전투 완료' : '공동 목표 전투 패배'); continue; }
    if (a.clause === 'sponsorship' && run.pending.kind === 'reward') { run.pending.cards = []; run.pending.picked = true; run.food += 3; run.history.push('상단 의무: 카드 보상을 군량 +3으로 전환. 정예 보물 선택은 유지.'); }
    closeAgreement(run, a, 'fulfilled', '의무 이행');
    if (a.clause === 'operation' && a.beneficiary && run.generals.some(g => g.id === a.beneficiary)) growthRewards.push(a);
  }
  for (const a of growthRewards) {
      offerGrowth(run, `agreement:${a.uid}`, run.pending);
      if (run.pending.kind === 'growth') run.pending.general = a.beneficiary!;
      else { run.hp = Math.min(run.maxHp, run.hp + 8); run.food += 2; run.history.push('공동 작전: 교리 미선택 원정은 병력 +8·군량 +2로 성장 보상을 대체.'); }
  }
}
export function accordsOnDismiss(run: RunState, general: string): void {
  for (const a of activeAgreements(run).filter(a => a.beneficiary === general)) closeAgreement(run, a, 'broken', '성장 대상 장수 교체');
}

export function resetCouncil(run: RunState): Check {
  if (run.screen !== 'node' || run.pending.kind !== 'council' || !run.pending.negotiated) return { ok: false, reason: '다시 제안할 조건이 없습니다.' };
  delete run.pending.negotiated; return { ok: true };
}
export function declineCouncil(run: RunState): Check {
  if (run.screen !== 'node' || run.pending.kind !== 'council') return { ok: false, reason: '협정 제안이 없습니다.' };
  run.pending = { kind: 'socialResult', text: '협정을 체결하지 않았습니다. 기존 협정과 관계는 유지. 이미 지불한 설전 비용은 환급하지 않습니다.' }; return { ok: true };
}
