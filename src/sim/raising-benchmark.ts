import {mkdirSync,writeFileSync} from 'node:fs';
import {newWorldCampaign,configureStart} from '../core/world.ts';
import {startRaising,raisingOf} from '../core/raising.ts';
import {raisingBotStep,RAISING_POLICIES,type RaisingPolicy} from './raising-policy.ts';
import {saveCampaign,loadCampaign} from '../core/campaign-save.ts';
import {memoryKV} from '../core/save.ts';
import type {CityId} from '../core/city-types.ts';
import type {RaisingOrigin} from '../core/raising-types.ts';
const rows:any[]=[];
function play(seed:number,city:CityId,origin:RaisingOrigin,representative:'chengong'|'zhangliao'|'guojia',assistant:string,policy:RaisingPolicy){
 let r=newWorldCampaign(seed).activeExpedition!;configureStart(r,city,'wanderer',representative,'people','granary');startRaising(r,origin,assistant);const kv=memoryKV();let restoreFailures=0,steps=0;const errors:string[]=[];
 for(;steps<500;steps++){if(raisingOf(r)!.phase==='founded'||r.campaign!.world!.stage==='failed')break;try{if(!raisingBotStep(r,policy)){errors.push(`stalled ${raisingOf(r)!.phase}/${raisingOf(r)!.step}`);break;}}catch(e){errors.push(String(e));break;}saveCampaign(kv,r);const restored=loadCampaign(kv);if(!restored.ok){restoreFailures++;errors.push(`restore ${raisingOf(r)!.phase}: ${restored.reason}`);break;}r=restored.data.activeExpedition!;}
 const q=raisingOf(r)!,w=r.campaign!.world!;rows.push({seed,city,origin,representative,assistant,policy,steps,success:q.phase==='founded',grade:q.grade,plan:q.plan,visited:q.visited.length,debate:q.gate?.debateGrade,duel:q.gate?.duelGrade,exposure:w.preparation.exposure,debt:w.diplomacy.obligation,restoreFailures,errors,...q.stats});
}
const cities:CityId[]=['xingyang','chenggao','gong'],origins:RaisingOrigin[]=['notable','militia','official'],reps=['chengong','zhangliao','guojia'] as const,assistants=['guard','scholar','logistics'];
for(let seed=121001;seed<=121002;seed++)for(const [ci,city] of cities.entries())for(const origin of origins)for(const [pi,policy] of RAISING_POLICIES.entries())play(seed,city,origin,reps[pi%3],assistants[ci],policy);
for(const origin of origins)for(const representative of reps)for(const assistant of assistants)play(121003,'xingyang',origin,representative,assistant,'balanced');
const grouped=(key:string)=>[...new Set(rows.map(r=>r[key]))].map(id=>{const group=rows.filter(r=>r[key]===id);return {id,samples:group.length,success:group.filter(r=>r.success).length,conditional:group.filter(r=>r.grade==='conditional'||r.grade==='incomplete').length,restoreFailures:group.reduce((n,r)=>n+r.restoreFailures,0),exposure:group.reduce((n,r)=>n+r.exposure,0)/group.length,debt:group.reduce((n,r)=>n+r.debt,0)/group.length};});
const counts=(key:string)=>Object.assign({},...rows.flatMap(r=>Object.keys(r[key])).map(id=>({[id]:rows.reduce((n,r)=>n+(r[key][id]??0),0)})));
const report={samples:rows.length,success:rows.filter(r=>r.success).length,restoreFailures:rows.reduce((n,r)=>n+r.restoreFailures,0),errors:rows.filter(r=>r.errors.length).length,byPolicy:grouped('policy'),byOrigin:grouped('origin'),byCity:grouped('city'),byRepresentative:grouped('representative'),byAssistant:grouped('assistant'),byPlan:grouped('plan'),byGrade:grouped('grade'),picks:counts('picks'),plays:counts('plays'),allyPicks:counts('allyPicks'),removes:rows.reduce((n,r)=>n+r.removes,0),skips:rows.reduce((n,r)=>n+r.skips,0),recoveries:rows.reduce((n,r)=>n+r.recoveries,0),limitations:['Rules-only finite policies, no browser or human play.','126 city/origin/policy cases with cycled representatives and assistants plus 27 explicit representative/assistant/origin pairs in Xingyang. Not every full Cartesian combination.','Automated policies use limited reward choices, fixed cautious events, and do not prove fun or balance.','Every action saves and continues from the loaded campaign to test real restore; policy randomness consumes the persisted run RNG.'],rows};
mkdirSync('docs/verification',{recursive:true});writeFileSync('docs/verification/raising.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,rows:undefined},null,2));
