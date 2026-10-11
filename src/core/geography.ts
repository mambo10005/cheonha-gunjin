import {GEOGRAPHY_VERSION,REGION_VERSION,SCENARIO_YEAR,SITES,site,place} from '../data/geography.ts';
import type {CityId} from './city-types.ts';
import type {MapNode,RunState} from './types.ts';
export interface GeographyState {
 corridor?:{from:CityId;to:CityId;steps?:number[]};
 region:'henan';dataVersion:string;regionVersion:number;year:190;seed:number;
 currentSite:string|null;position:{mapX:number;mapY:number}|null;stage:number;
 scout:Record<string,number>;discoveredRoutes:string[];visited:string[];consumedEvents:string[];
 travel:{from:string|null;to:string;status:'arrived';units:number}|null;elapsed:number;
}
export const geoKey=(n:{floor:number;col:number})=>`${n.floor}:${n.col}`;
export function regionalSite(run:RunState,floor:number,col:number){
 const original=site(floor,col),route=run.geography?.corridor;if(!route)return original;
 const a=place(route.from),b=place(route.to),steps=route.steps,t=steps?(Math.max(0,steps.indexOf(floor))+1)/steps.length:(floor+1)/8,lane=col===0?-110:col===2?110:0;
 return {...original,...(run.campaign?.world?{terrain:run.map[floor][col].terrain}:{}),placeId:route.to,mapX:a.mapX+(b.mapX-a.mapX)*t,mapY:a.mapY+(b.mapY-a.mapY)*t+(floor===7?0:lane),
  name:floor===7?`${b.primaryName} 성외 정벌`:`${a.primaryName}–${b.primaryName} ${floor+1}행군 ${col===0?'북쪽 우회':col===2?'남쪽 우회':'관도 거점'}`,adjustment:'도시 사이 위치만 유지한 창작 행군 구간. 실제 도로·거리·도하 위치는 아님.'};
}
export function initializeCityCorridor(run:RunState,from:CityId,to:CityId){
 initializeGeography(run);run.geography!.corridor={from,to};run.geography!.scout={};run.geography!.discoveredRoutes=[];refreshScout(run);
}
export function configureRegionalDemo(run:RunState){
 run.food=18;run.generals=[{id:'dianwei',row:'front'},{id:'caoren',row:'front'},{id:'guojia',row:'rear'}];
 run.map[0][0].type='event';run.map[0][0].eventId='envoy';
 run.map[0][1].type='event';run.map[0][1].eventId='parley';
 run.map[0][2].type='elite';run.map[0][2].encounterId='el_huaxiong';
 run.map[2][1].type='supply';run.map[3][1].type='event';run.map[3][1].eventId='checkpoint';
 run.map[4][1].type='supply';
 run.history.push('역사 지리 검증 원정 81001 · 준비 군량 18 / 전위·조인·곽가. 1행군 북쪽 외교·관도 설전·산길 대결 중 선택. 역사 전쟁의 재현이 아닌 가상 전개.');
}
export function initializeGeography(run:RunState){
 run.geography={region:'henan',dataVersion:GEOGRAPHY_VERSION,regionVersion:REGION_VERSION,year:SCENARIO_YEAR,seed:run.seed,
 currentSite:null,position:null,stage:-1,scout:{},discoveredRoutes:[],visited:[],consumedEvents:[],travel:null,elapsed:0};
 for(const n of run.map.flat())n.terrain=site(n.floor,n.col).terrain;
 refreshScout(run);
}
export function compatibleGeography(run:RunState){const g=run.geography;return !!g&&g.dataVersion===GEOGRAPHY_VERSION&&g.regionVersion===REGION_VERSION;}
export function refreshScout(run:RunState){const g=run.geography;if(!g)return;
 for(const n of run.map.flat()){
  const s=regionalSite(run,n.floor,n.col),d=g.position?Math.hypot(s.mapX-g.position.mapX,s.mapY-g.position.mapY):Infinity;
  const visited=g.visited.includes(s.id);
  const connected=n.floor===run.floor+1&&(run.floor<0||run.map[run.floor][run.col].next.includes(n.col));
  const level=visited?4:connected?(n.terrain==='mountain'?2:3):d<380?2:d<600?1:0;
  g.scout[s.id]=Math.max(g.scout[s.id]??0,level);
 }
 for(const n of run.map.flat())for(const col of n.next){const m=run.map[n.floor+1]?.[col];if(m&&(g.scout[site(n.floor,n.col).id]>=2||g.scout[site(m.floor,m.col).id]>=2)){const id=`${geoKey(n)}>${geoKey(m)}`;if(!g.discoveredRoutes.includes(id))g.discoveredRoutes.push(id);}}
}
/** No real kilometres or days: units are scenario pacing, resolved atomically before site entry. */
export function routeFacts(run:RunState,n:MapNode){
 const s=regionalSite(run,n.floor,n.col),gate=n.floor===1&&n.col===1;
 const units=n.terrain==='mountain'?2:1;
 const gateSurcharge=compatibleGeography(run)&&gate&&!run.social.passage?1:0;
 const hash=(Math.imul(run.seed^((n.floor+1)*101+n.col),1664525)>>>0);
 const event=compatibleGeography(run)&&n.terrain==='mountain'&&hash%4===0?'낙석 우회':null;
 return {site:s,units,gate,gateSurcharge,event:event?'낙석 우회':null,eventFood:event?1:0,
  scouting:run.geography?.scout[s.id]??0,control:hash%3===0?'검문군':hash%3===1?'향촌 연합':'상단 교역권'};
}
export function extraTravelFood(run:RunState,n:MapNode){const f=routeFacts(run,n);return f.gateSurcharge+f.eventFood;}
export function arriveGeography(run:RunState,n:MapNode){if(!compatibleGeography(run))return;const g=run.geography!,f=routeFacts(run,n),s=f.site;
 const from=g.currentSite;g.currentSite=s.id;g.position={mapX:s.mapX,mapY:s.mapY};g.stage=n.floor;
 if(!g.visited.includes(s.id))g.visited.push(s.id);
 const eventId=`route:${s.id}`;
 if(f.event&&!g.consumedEvents.includes(eventId)){g.consumedEvents.push(eventId);run.history.push(`행군 구간 사건: ${f.event} · 군량 1 추가 소비. 창작 사건, 우회 군량을 이동 비용에 포함.`);}
 g.elapsed+=f.units;g.travel={from,to:s.id,status:'arrived',units:f.units};
 refreshScout(run);run.history.push(`${s.name} 도착 · 누적 이동 단위 ${g.elapsed} · 창작 거점.`);
}
export function validGeography(run:RunState):boolean{
 const g=run.geography;if(!g)return true;
 if(typeof g!=='object'||Array.isArray(g)||g.region!=='henan'||typeof g.dataVersion!=='string'||!Number.isInteger(g.regionVersion))return false;
 // Unsupported geographical schemas are discarded by loadRun; the independently validated legacy rule map survives.
 if(!compatibleGeography(run))return true;
 if(g.corridor&&(!['xingyang','chenggao','gong'].includes(g.corridor.from)||!['xingyang','chenggao','gong'].includes(g.corridor.to)||g.corridor.from===g.corridor.to||run.campaign?.target!==g.corridor.to))return false;
 if(g.region!=='henan'||typeof g.dataVersion!=='string'||!Number.isInteger(g.regionVersion)||g.year!==190||g.seed!==run.seed||g.stage!==run.floor||!Number.isInteger(g.elapsed)||g.elapsed<0)return false;
 if(!g.scout||typeof g.scout!=='object'||Array.isArray(g.scout)||!Object.entries(g.scout).every(([k,v])=>SITES.some(s=>s.id===k)&&Number.isInteger(v)&&v>=0&&v<=4))return false;
 for(const key of ['visited','consumedEvents','discoveredRoutes'] as const)if(!Array.isArray(g[key])||g[key].some(v=>typeof v!=='string')||new Set(g[key]).size!==g[key].length)return false;
 if(!g.visited.every(id=>SITES.some(s=>s.id===id&&s.floor<=run.floor))||!g.consumedEvents.every(id=>g.visited.includes(id.replace('route:',''))))return false;
 if(!g.discoveredRoutes.every(id=>run.map.flat().some(n=>n.next.some(c=>id===`${geoKey(n)}>${n.floor+1}:${c}`))))return false;
 if(run.floor<0)return g.currentSite===null&&g.position===null&&g.travel===null&&g.visited.length===0&&g.elapsed===0;
 const s=regionalSite(run,run.floor,run.col);
 return g.currentSite===s.id&&!!g.position&&g.position.mapX===s.mapX&&g.position.mapY===s.mapY&&g.visited.at(-1)===s.id&&
  !!g.travel&&g.travel.status==='arrived'&&g.travel.to===s.id&&[1,2].includes(g.travel.units)&&(g.travel.from===null||g.visited.includes(g.travel.from));
}
