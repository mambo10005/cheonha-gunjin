import type { ExpeditionBuild } from '../core/build.ts';
import type { CardInst } from '../core/types.ts';
export const TACTICS = {
  brace: { name: '반격 준비', text: '기세 1 소비. 이번 피해 8 감소. 완전 방어 시 반격 준비. 대결당 1회.', mode: 'guard' },
  feint: { name: '허점 유도', text: '피해 2, 이번 피해 4 감소. 정보 +1. 적 방비 제거. 대결당 1회.', mode: 'probe' },
  sacrifice: { name: '결사 돌파', text: '내 체력 4 소비 → 돌파 준비 +2, 기세 +1. 이번에는 공격하지 않음. 대결당 1회.', mode: 'guard' },
  breathe: { name: '호흡 조절', text: '이번 피해 4 감소, 기세 +2. 공격하지 않음. 대결당 1회.', mode: 'guard' },
} as const;
export type TacticId = keyof typeof TACTICS;
/** No new collection: starting breath, doctrines/growth/card commands unlock options. */
export function availableTactics(build: ExpeditionBuild, general: string, deck: CardInst[]): TacticId[] {
  const dirs = new Set(build.doctrines);
  const branch = build.growth[general]?.branch;
  if (branch === 'guardian' || branch === 'avenger') dirs.add('bastion');
  if (branch === 'vanguard' || branch === 'raider') dirs.add('breakthrough');
  if (branch === 'planner' || branch === 'saboteur') dirs.add('scheme');
  const out: TacticId[] = ['breathe'];
  if (dirs.has('bastion') || deck.some(c => ['wall', 'readied', 'ambush'].includes(c.id))) out.push('brace');
  if (dirs.has('breakthrough') || deck.some(c => ['charge', 'flank'].includes(c.id))) out.push('sacrifice');
  if (dirs.has('scheme') || deck.some(c => ['sow', 'confuse'].includes(c.id))) out.push('feint');
  return out;
}
