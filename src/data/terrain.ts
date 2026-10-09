import type { Terrain } from '../core/types.ts';

export interface TerrainDef {
  id: Terrain;
  name: string;
  moveCost: number;
  rules: string[];
}

// 실제 처리: core/combat.ts (피해·방비·화상·비용), core/run.ts (이동 군량, 성채 보상)
export const TERRAINS: Record<Terrain, TerrainDef> = {
  plains: { id: 'plains', name: '평야', moveCost: 1, rules: ['기병 카드 피해 +3'] },
  mountain: { id: 'mountain', name: '산길', moveCost: 2, rules: ['이동 군량 2', '적의 후열 공격 피해 +2', '매 턴 첫 策 카드 비용 -1'] },
  river: { id: 'river', name: '하천', moveCost: 1, rules: ['화상 부여량 절반', '방비 효과 +2'] },
  fortress: { id: 'fortress', name: '성채', moveCost: 1, rules: ['적이 방비 10으로 시작', '승리 시 군량 +4'] },
};
