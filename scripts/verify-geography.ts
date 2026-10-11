import {performance} from 'node:perf_hooks';
import {statSync,readFileSync,writeFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {newRegionalRun} from '../src/core/run.ts';
import {initializeGeography} from '../src/core/geography.ts';
import {movePreview,nodeInfo} from '../src/core/map-intel.ts';
import {simulateRun} from '../src/sim/autoplay.ts';
import {PLACES,SITES,site} from '../src/data/geography.ts';
import type {MapNode,RunState} from '../src/core/types.ts';
const times:number[]=[];const initial=performance.now();for(let i=1;i<=300;i++)newRegionalRun(i,'caocao');const generationMs=(performance.now()-initial)/300;
const r=newRegionalRun(81001,'caocao');for(let i=0;i<300;i++){const start=performance.now();movePreview(r,r.map[0][i%3]);times.push(performance.now()-start);}times.sort((a,b)=>a-b);
const policies={
 food:(r:RunState,ns:MapNode[])=>ns.slice().sort((a,b)=>movePreview(r,b).food-movePreview(r,a).food||a.col-b.col)[0],
 scout:(r:RunState,ns:MapNode[])=>ns.slice().sort((a,b)=>(r.geography!.scout[site(b.floor,b.col).id]??0)-(r.geography!.scout[site(a.floor,a.col).id]??0)||a.col-b.col)[0],
 growth:(r:RunState,ns:MapNode[])=>ns.slice().sort((a,b)=>({rest:5,supply:r.food<5?10:3,recruit:6,event:4,elite:2,market:1,battle:0,boss:0}[b.type])-({rest:5,supply:r.food<5?10:3,recruit:6,event:4,elite:2,market:1,battle:0,boss:0}[a.type])||a.col-b.col)[0],
};
const simulations=[];
for(const [policy,choose] of Object.entries(policies)){
 let wins=0,bossReached=0,famine=0;const selections:Record<string,number>={},terrains:Record<string,number>={},depletionStages:Record<number,number>={};let units=0,scout=0,obligations=0,fulfilled=0;
 for(let i=1;i<=30;i++){
  const result=simulateRun(i*7919,'caocao',0,[],undefined,run=>initializeGeography(run),(run,options)=>{
   const choice=choose(run,options);if(!movePreview(run,choice).growth){selections[String(choice.col)]=(selections[String(choice.col)]??0)+1;terrains[choice.terrain]=(terrains[choice.terrain]??0)+1;units+=choice.terrain==='mountain'?2:1;scout+=run.geography!.scout[site(choice.floor,choice.col).id]??0;}
   const agreements=run.social.accords.agreements;obligations=Math.max(obligations,agreements.length);fulfilled+=agreements.filter(a=>a.status==='fulfilled').length;return choice;
  });
  wins+=Number(result.won);bossReached+=Number(result.floor===7);if(result.killedBy==='군량 고갈'){famine++;depletionStages[result.floor]=(depletionStages[result.floor]??0)+1;}
 }
 simulations.push({policy,runs:30,wins,bossReached,famine,selections,terrains,units,meanScoutingAtSelection:scout/Math.max(1,Object.values(selections).reduce((a,b)=>a+b,0)),depletionStages,obligationsObservedMax:obligations,fulfilledObservations:fulfilled});
}
const sourceBytes=statSync('src/data/geography.ts').size,staticJSONBytes=Buffer.byteLength(JSON.stringify({PLACES,SITES}));
const output={environment:'Node headless; CPU timers, not browser rendering or mobile FPS',generationMeanMs:generationMs,movePreviewMedianMs:times[150],movePreviewP95Ms:times[285],sourceBytes,staticJSONBytes,gzipStaticBytes:gzipSync(JSON.stringify({PLACES,SITES})).length,markers:SITES.length,historyNames:PLACES.length,simulations,sample:r.map.map(row=>row.map(n=>({stage:n.floor+1,col:n.col,type:n.type,terrain:n.terrain,event:n.eventId,intel:nodeInfo(r,n).info}))),sourceSHAInputBytes:readFileSync('src/data/geography.ts').length};
writeFileSync('geography-measurements.json',JSON.stringify(output,null,2));console.log(JSON.stringify(output,null,2));
