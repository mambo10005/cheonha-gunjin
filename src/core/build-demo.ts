import { chooseDoctrine, type Direction } from './build.ts';
import type { RunState } from './types.ts';
/** Same seed/map/deck/general roster for comparing three opening decisions. No free growth. */
export function configureBuildDemo(run: RunState, direction: Direction): void {
  run.food = 20;
  run.generals = [{ id: 'dianwei', row: 'front' }, { id: 'guojia', row: 'rear' }];
  for (let f = 0; f < 7; f++) for (const n of run.map[f]) {
    n.next = f === 6 ? [0] : [0, 1, 2]; n.terrain = 'plains';
    n.type = f === 3 || f === 5 ? 'elite' : f === 6 ? 'rest' : 'battle';
    n.encounterId = f === 3 ? 'el_huaxiong' : f === 5 ? 'el_zhangbao' : 'e_bandit';
    delete n.eventId;
  }
  chooseDoctrine(run, direction);
  run.history.push('빌드 검증: 시드 41001 · 동일 지도 · 성장 1/3/5층 · 대결 4/6층 · 보스 8층. 무료 성장 없음.');
}
