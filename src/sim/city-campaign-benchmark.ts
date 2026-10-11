import {writeFileSync,mkdirSync} from 'node:fs';
import {playCityCampaign} from './city-campaign.ts';
import {saveRun,loadRun,memoryKV} from '../core/save.ts';
import type {AdminPlan} from '../core/city-types.ts';
const rows:{seed:number;plan:AdminPlan;completed:boolean;steps:number;retreats:number;failures:string[];cities:string[];results:ReturnType<typeof playCityCampaign>['results']}[]=[];let saveFailures=0;
for(const plan of ['life','military','issues'] as AdminPlan[])for(let seed=101001;seed<101013;seed++){
 const result=playCityCampaign(seed,plan),kv=memoryKV();saveRun(kv,result.run);const loaded=loadRun(kv);if(!loaded.ok||JSON.stringify(loaded.data)!==JSON.stringify(result.run))saveFailures++;
 rows.push({seed,plan,completed:result.completed,steps:result.steps,retreats:result.retreats,failures:result.failures,cities:result.cities,results:result.results});
}
const report={samples:rows.length,completed:rows.filter(r=>r.completed).length,saveFailures,byPlan:['life','military','issues'].map(plan=>({plan,samples:rows.filter(r=>r.plan===plan).length,completed:rows.filter(r=>r.plan===plan&&r.completed).length,retreats:rows.filter(r=>r.plan===plan).reduce((n,r)=>n+r.retreats,0)})),limits:['One conservative route selector and fixed three-city order. No proof of optimal play or fun.','No administrative appointments/policies/facilities in this route survival baseline; see city-balance for build comparison.','Conquest uses inner cooperation where available, siege at Chenggao, real card combat as fallback.'],rows};
mkdirSync('docs/verification',{recursive:true});writeFileSync('docs/verification/city-campaign.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,rows:undefined},null,2));if(saveFailures)process.exitCode=1;
