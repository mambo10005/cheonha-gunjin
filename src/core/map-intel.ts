import {regionalSite} from './geography.ts';
import {availableMoves,moveTo,NODE_NAME} from './run.ts';
import {compatibleGeography} from './geography.ts';
import {SCOUT_NAMES} from '../data/geography.ts';
import {activeAgreements,CLAUSES} from './accords.ts';
import {TERRAINS} from '../data/terrain.ts';
import {ENCOUNTERS,ENEMIES} from '../data/enemies.ts';
import {CARDS} from '../data/cards.ts';
import {DEBATE_CARDS} from '../data/debate-cards.ts';
import {DOCTRINES} from './build.ts';
import type {MapNode,RunState} from './types.ts';
export const nodeKey=(n:{floor:number;col:number})=>`${n.floor}:${n.col}`;
export function movePreview(run:RunState,node:MapNode){
 const state=structuredClone(run),before=state.history.length;
 const allowed=availableMoves(run).some(n=>nodeKey(n)===nodeKey(node));
 const result=allowed?moveTo(state,node.col):{ok:false,reason:'현재 위치에서 연결되지 않은 장소입니다.'};
 const hideRouteEvent=compatibleGeography(run)&&(run.geography!.scout[regionalSite(run,node.floor,node.col).id]??0)<3;
 return {result,state,moved:state.floor!==run.floor,food:state.food,hp:state.hp,passage:state.social.passage?.moves??0,
  growth:result.ok&&state.pending.kind==='growth',changes:state.history.slice(before).filter(s=>/협정|의무|호송|후원|군량|병력|약속/.test(s)&&!(hideRouteEvent&&s.startsWith('행군 구간 사건')))};
}
export function obligationLabels(run:RunState,node:MapNode):string[]{
 return [...activeAgreements(run).flatMap(a=>[
  ...(nodeKey(a.target)===nodeKey(node)?[CLAUSES[a.clause].name+' · 전투 의무']:[]),
  ...(a.supply&&a.stage==='waiting'&&nodeKey(a.supply)===nodeKey(node)?['향촌 호송 · 군량 보급 의무']:[]),
 ]),...run.debateBuild.obligations.filter(o=>o.status==='active'&&o.kind==='ration'&&o.due===node.floor).map(()=> '군량 약속 · 이동 시 지불')];
}
export function nodeInfo(run:RunState,node:MapNode){
 const regional=compatibleGeography(run),level=regional?(run.geography!.scout[regionalSite(run,node.floor,node.col).id]??0):0;
 const near=node.floor<=run.floor+1,known=(regional?level>=3:near)||node.type==='boss';
 const places={battle:'적군 진지',elite:'정예 주둔지',boss:'낙양 성문',rest:'성외 군막',market:'행군 시장',supply:'군량 보급지',recruit:'인재 객사',event:'길목 역참'};
 const terrain=TERRAINS[node.terrain];
 const encounter=known&&node.encounterId?ENCOUNTERS[node.encounterId]:null;
 const name=regional?regionalSite(run,node.floor,node.col).name:node.type==='boss'?places.boss:`${terrain.name} ${places[node.type]}`;
 const benefits={battle:'승리 보상 · 전투 카드',elite:'승리 보상 · 전투 카드·보물',boss:'원정 승리',rest:'군량을 써 회복 / 카드 복제',market:'군량을 써 전법·보물 / 카드 제거',supply:'군량 +6 / 병력 +12 중 선택',recruit:'장수 영입 선택',event:'사건 또는 협상 · 결과 미확정'};
 const battle=['battle','elite','boss'].includes(node.type);
 const synergies:string[]=[];
 if(battle){
  synergies.push(...run.build.doctrines.map(id=>`${DOCTRINES[id].name}: ${DOCTRINES[id].text}`));
  if(node.terrain==='plains'){const count=run.deck.filter(c=>CARDS[c.id].tags.includes('cavalry')).length;if(count)synergies.push(`기병 전법 ${count}장: 평야에서 피해 +3`);}
  if(node.terrain==='river'){const count=run.deck.filter(c=>CARDS[c.id].tags.includes('fire')).length;if(count)synergies.push(`화공 전법 ${count}장: 하천에서 화상 부여량 절반`);}
  if(run.social.support)synergies.push('다음 전투 군사 지원: 방비·피해 효과, 카드 보상 대가 확인');
 }
 if(['supply','rest'].includes(node.type)&&run.debateBuild.enabled){
  const count=run.debateBuild.cards.filter(c=>!c.upgrade&&DEBATE_CARDS[c.id].upgrades).length;
  synergies.push(`서원 학습: 군량 2 · 설전 덱 성장${count?` / 강화 가능한 카드 ${count}장`:''}`);
 }
 if(run.social.passage)synergies.push(`통행 협정 적용: 다음 ${run.social.passage.moves}회 이동 군량 비용 −${run.social.passage.discount}`);
 const info=regional?SCOUT_NAMES[level]:known?(battle?'편성 확인':'시설 확인 · 선택 결과 미확정'):'부분 확인 · 유형·지형 공개';
 const risk=encounter?`${encounter.tier==='boss'?'결전':encounter.tier==='elite'?'정예':encounter.tier==='late'?'후반':'초반'} 편성 · ${encounter.enemies.length}명`:battle?'전투 · 세부 편성 미확인':node.type==='event'?'사건 대가 미확정':'전투 없음';
 const facilityKnown=!regional||level>=2||node.type==='boss';
 return {name,type:facilityKnown?NODE_NAME[node.type]:'거점 미확인',terrain,benefit:facilityKnown?benefits[node.type]:'정찰 후 보상 계열 확인',info,risk:!facilityKnown?'군사 상황 미확인':risk,encounter,synergies:facilityKnown?synergies:[],obligations:obligationLabels(run,node),known};
}
export function futureLayers(run:RunState,from:MapNode,depth=3){
 let row=[from];const layers:MapNode[][]=[];
 for(let i=0;i<depth;i++){row=[...new Map(row.flatMap(n=>n.next.map(c=>run.map[n.floor+1]?.[c]).filter((n):n is MapNode=>!!n)).map(n=>[nodeKey(n),n])).values()];if(!row.length)break;layers.push(row);}
 return layers;
}
export function canReach(run:RunState,from:MapNode,to:{floor:number;col:number}):boolean{
 return nodeKey(from)===nodeKey(to)||futureLayers(run,from,8).some(row=>row.some(n=>nodeKey(n)===nodeKey(to)));
}
export function bossNotes(run:RunState){
 if(run.campaign)return ['도시 성외 도착 후 접근 준비 두 가지와 정벌 방식을 선택합니다.','돌파·설전·포위·내응은 장수·정보·자원에 따라 이용 조건이 다릅니다.',`현재 출전 병력 ${run.hp}/${run.maxHp} · 원정 군량 ${run.food}`,'도시 정벌 피해와 약속은 다음 내정 단계에 남습니다.'];
 const boss=ENEMIES.dongzhuo;
 return [boss.trait!,`현재 병력 ${run.hp}/${run.maxHp} · 군량 ${run.food}`,
  `방어 전법 ${run.deck.filter(c=>CARDS[c.id].effects.some(e=>e.k==='block'||e.k==='blockDouble')).length}장 · 적 방비 해제 전법 ${run.deck.filter(c=>CARDS[c.id].effects.some(e=>e.k==='breakBlock')).length}장`,
  '특정 덱을 권장하는 점수가 아닙니다. 성채는 적 방비 10으로 시작합니다.'];
}
