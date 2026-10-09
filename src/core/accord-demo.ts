import { chooseDoctrine } from './build.ts';
import type { RunState } from './types.ts';
/** Same public entrances and generated coordinates; no injected agreements or rewards. */
export function configureAccordDemo(run: RunState): void {
 run.food=20; run.generals=[{id:'dianwei',row:'front'},{id:'guojia',row:'rear'}]; chooseDoctrine(run,'scheme');
 for (let f=0; f<7; f++) for (const n of run.map[f]) {
  n.next=f===6?[0]:[0,1,2]; n.terrain='plains';
  if (f===0 || f===2 || f===3) {n.type='event'; n.eventId=f===0?'envoy':f===2?'refugees':'checkpoint';}
  else if (f===1 || f===4) n.type='supply';
  else if (f===5) {n.type='elite';n.encounterId='el_huaxiong';}
  else n.type='rest';
 }
 run.history.push('협정 검증 원정: 1층 상단 / 2층 보급 / 3층 향촌(보급 대신 외교 선택) / 4층 의용군 / 5층 보급 / 6층 공동 정예전. 협정은 직접 선택합니다.');
}
