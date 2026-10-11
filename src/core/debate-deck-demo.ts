import {configureAccordDemo} from './accord-demo.ts';
import type {RunState} from './types.ts';
export function configureDeckDemo(run:RunState,representative='guojia'){
 configureAccordDemo(run);run.debateBuild.enabled=true;run.generals=[{id:'dianwei',row:'front'},{id:'caoren',row:'front'},{id:representative,row:'rear'}];run.build.doctrines=[];
 for(const n of run.map[3]){n.type='event';n.eventId='parley';}
 run.history.push('시드 61001: 1층 상단 / 2층 덱 성장 보급 / 3층 향촌 / 4층 재야 인재 정예 선택 / 5층 보급 / 6층 전투 / 8층 기존 결전.');
}
