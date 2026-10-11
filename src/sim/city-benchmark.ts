import {mkdirSync,writeFileSync} from 'node:fs';
import {activeCity,appointGeneral,cityApproach,chooseConquest,constructCity,delegateCity,departCity,equipCityPolicy,equipCitySeal,newCityCampaign,occupyCity,previewCityAction,setCityBuild,supplyQuote} from '../core/city.ts';
import {FACILITY_DEFS} from '../data/cities.ts';
import {botTurn} from './autoplay.ts';
import {createBattle} from '../core/combat.ts';
import {memoryKV,saveRun,loadRun} from '../core/save.ts';
import type {AdminPlan,CityBuild,CityId} from '../core/city-types.ts';
const plans:AdminPlan[]=['life','military','production','issues','combo','support','random'];
const builds:CityBuild[]=['settlement','trade','military'];
type BalanceRow={target:CityId;build:CityBuild;plan:AdminPlan;seed:number;outcome:string;food:number;life:number;order:number;production:number;readiness:number;resolved:number;issues:number;depleted:number;chains:number;plays:Record<string,number>;facilities:string[];generals:string[];repeats:number;supportFood:number;nextBattle:'ongoing'|'win'|'lose';nextHP:number};
const rows:BalanceRow[]=[];let previewMismatch=0,saveFailures=0;
const count=(map:Record<string,number>,ids:string[])=>{for(const id of ids)map[id]=(map[id]??0)+1;};
for(const target of ['xingyang','chenggao','gong'] as CityId[])for(const build of builds)for(const plan of plans)for(let seed=101001;seed<101013;seed++){
 const r=newCityCampaign(seed);r.campaign!.target=target;cityApproach(r,'scout');cityApproach(r,'protect');chooseConquest(r,target==='chenggao'?'siege':'inside');occupyCity(r,build==='settlement'?'shared':build==='trade'?'merchant':'military');setCityBuild(r,build);
 const c=activeCity(r)!;const general=build==='settlement'?(plan==='production'?'chengong':'chengpu'):build==='trade'?'guojia':'zhangliao';const role=build==='settlement'?'civil':build==='trade'?'logistics':'guard';
 const policies=build==='settlement'?['settlement','granary']:build==='trade'?['merchants','relay']:['curfew','training'];const seal=build==='settlement'?'harmony':build==='trade'?'audit':'army';
 for(let phase=1;phase<=5;phase++){
  if(!c.roles[role])appointGeneral(r,role,general);
  const facility=c.blueprints.find(id=>FACILITY_DEFS[id].build===build&&!c.districts.find(d=>d.id===FACILITY_DEFS[id].district)!.facility);if(facility)constructCity(r,facility);
  for(const id of policies)if(!c.policies.some(p=>p.id===id))equipCityPolicy(r,id);if(!c.seals.includes(seal))equipCitySeal(r,seal);
  const preview=previewCityAction(r,{kind:'delegate',plan});delegateCity(r,plan);if(JSON.stringify(preview.state)!==JSON.stringify(r))previewMismatch++;
  const kv=memoryKV();saveRun(kv,r);const saved=loadRun(kv);if(!saved.ok||JSON.stringify(saved.data)!==JSON.stringify(r))saveFailures++;
 }
 const next=target==='chenggao'?'gong':'chenggao';const quote=supplyQuote(r,next,'food');departCity(r,next,'food');
 const battle=createBattle({rng:seed,hp:r.hp,maxHp:r.maxHp,food:r.food,deck:r.deck,generals:r.generals,relics:r.relics,lordId:r.lordId,terrain:'plains',encounterId:'e_bandit',enemies:['bandit','bandit'],difficulty:0,allyBlessing:false});
 for(let turn=0;turn<30&&battle.result==='ongoing';turn++)botTurn(battle);
 rows.push({target,build,plan,seed,outcome:c.outcome,food:c.food,life:c.metrics.life,order:c.metrics.order,production:c.metrics.production,readiness:c.readiness,resolved:c.stats.resolved,issues:c.issues.length,depleted:c.stats.depleted,chains:c.stats.chains,plays:c.stats.plays,facilities:c.stats.facilities,generals:c.stats.appointments,repeats:c.stats.repeats,supportFood:quote.food,nextBattle:battle.result,nextHP:battle.hp});
}
const cards:Record<string,number>={},facilities:Record<string,number>={},generals:Record<string,number>={};for(const row of rows){count(cards,Object.entries(row.plays).flatMap(([id,n])=>Array.from({length:n},()=>id)));count(facilities,row.facilities);count(generals,row.generals);}
const byBuild=builds.map(build=>{const group=rows.filter(r=>r.build===build),avg=(key:'food'|'life'|'order'|'production'|'readiness'|'supportFood'|'chains')=>Math.round(group.reduce((n,r)=>n+r[key],0)/group.length*100)/100;return {build,samples:group.length,stable:group.filter(r=>r.outcome==='안정 도시').length,resourceDepletions:group.reduce((n,r)=>n+r.depleted,0),issueResolutionRate:group.reduce((n,r)=>n+r.resolved,0)/group.reduce((n,r)=>n+r.issues,0),food:avg('food'),life:avg('life'),order:avg('order'),production:avg('production'),readiness:avg('readiness'),supportFood:avg('supportFood'),chains:avg('chains'),nextBattleWinRate:group.filter(r=>r.nextBattle==='win').length/group.length};});
const report={samples:rows.length,seedRange:[101001,101012],previewMismatch,saveFailures,byBuild,cardSelections:cards,facilityAdoptions:facilities,generalAppointments:generals,limitations:['12 seeds × 3 cities × 3 builds × 7 policies. Fixed build setup, not optimal human play.','The follow-up measure is one original bandit encounter, not campaign completion or fun.','No real browser, frame rate or human play verification.','Some facilities/cards may have zero selection in these preset builds; investigate before expanding content.'],rows};
mkdirSync('docs/verification',{recursive:true});writeFileSync('docs/verification/city-balance.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,rows:undefined},null,2));if(previewMismatch||saveFailures)process.exitCode=1;
