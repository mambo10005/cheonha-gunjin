import type {MapNode,RunState} from '../core/types.ts';
import {nodeKey} from '../core/map-intel.ts';
const orders=[[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];
export function crossingCount(a:MapNode[],orderA:number[],orderB:number[]){
 const edges=a.flatMap(n=>n.next.map(c=>[orderA.indexOf(n.col),orderB.indexOf(c)]));let count=0;
 for(let i=0;i<edges.length;i++)for(let j=i+1;j<edges.length;j++)if((edges[i][0]-edges[j][0])*(edges[i][1]-edges[j][1])<0)count++;
 return count;
}
/** Dynamic programming minimizes crossings without changing columns, edges, seed or RNG. */
export function mapLayout(run:RunState){
 let states=orders.map((order,i)=>({order,path:[order],score:0,tie:i}));
 for(let f=1;f<7;f++)states=orders.map((order,i)=>{
  const best=states.map(s=>({...s,score:s.score+crossingCount(run.map[f-1],s.order,order)})).sort((a,b)=>a.score-b.score||a.tie-b.tie)[0];
  return {order,path:[...best.path,order],score:best.score,tie:best.tie*6+i};
 });
 const best=states.sort((a,b)=>a.score-b.score||a.tie-b.tie)[0];
 const points=new Map<string,{x:number;y:number}>();
 for(const row of run.map)for(const n of row)points.set(nodeKey(n),{x:n.type==='boss'?450:150+best.path[n.floor].indexOf(n.col)*300,y:90+(7-n.floor)*145});
 return {points,crossings:best.score,baseline:run.map.slice(0,6).reduce((sum,row)=>sum+crossingCount(row,orders[0],orders[0]),0)};
}
export function curve(a:{x:number;y:number},b:{x:number;y:number}){const mid=(a.y+b.y)/2;return `M${a.x},${a.y} C${a.x},${mid} ${b.x},${mid} ${b.x},${b.y}`;}
const icons:Record<string,string>={
 battle:'<path d="M7 25L25 7M7 7L25 25M5 20l7 7M20 5l7 7"/>',
 elite:'<path d="M8 28V4h16l-4 6 4 6H8M4 28h18M17 28v-8h9v8"/>',
 boss:'<path d="M3 28V10h26v18H3M12 28V17h8v11M3 10V5h5v5m5 0V5h6v5m5 0V5h5v5"/>',
 supply:'<path d="M7 10h18l3 14H4l3-14M10 10V5h12v5M10 28a2 2 0 1 0 0-4m12 4a2 2 0 1 0 0-4M16 10v14"/>',
 rest:'<path d="M3 27L16 6l13 21H3M16 6v21M12 27l4-9 4 9M10 3l6 3 6-3"/>',
 event:'<path d="M6 5h20v22H6V5M3 5h3v22H3m23-22h3v22h-3M11 10h10m-10 6h10m-10 6h6"/>',
 market:'<path d="M3 12l4-7h18l4 7M5 13v15h22V13M12 28V17h8v11M3 12h26"/>',
 recruit:'<circle cx="16" cy="10" r="5"/><path d="M6 28v-7c0-7 20-7 20 0v7M4 28h24"/>',
 diplomacy:'<path d="M4 9h10v12H4zM18 9h10v12H18zM14 15h4M7 5h4m10 0h4"/>',
 debate:'<path d="M4 6h10v20H4zM18 6h10v20H18zM8 10v12m14-12v12"/>',
 unknown:'<path d="M7 4h18v24H7zM11 12c0-7 10-7 10-1 0 3-5 3-5 7m0 4v1"/>',
};
export function mapIcon(type:string){return `<svg viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icons[type]??icons.unknown}</svg>`;}
/** Repo-native provisional ink atlas. Terrain marks are local to actual node terrain. */
export function atlasBackdrop(run:RunState,points:Map<string,{x:number;y:number}>){
 const terrain=run.map.flat().map(n=>{const p=points.get(nodeKey(n))!;
  const marks=n.terrain==='mountain'?'<path d="M-110 15l40-65 30 32 35-50 60 84m-125-32l10 20 15-13"/>':n.terrain==='river'?'<path d="M-130 3q60-55 130-10t140-18m-270 40q80-50 135-10t140-12"/>':n.terrain==='fortress'?'<path d="M-110 24V-35h220v59M-110-35v-15h25v15m15 0v-15h25v15m100 0v-15h25v15M-110 2h220"/>':'<path d="M-130-30h55m-55 12h55m95 55h55m-55-12h55M-112 33l8-20 8 20m-8-20v26"/>';
  return `<g transform="translate(${p.x} ${p.y})" class="atlas-terrain terrain-${n.terrain}">${marks}</g>`;
 }).join('');
 return `<defs><pattern id="atlas-paper" width="19" height="23" patternUnits="userSpaceOnUse"><path d="M0 2h11M8 13h11M1 21h6" stroke="#745b40" stroke-opacity=".08"/></pattern></defs><rect width="900" height="1250" fill="#d5c6a2"/><rect width="900" height="1250" fill="url(#atlas-paper)"/><path d="M27 0v1250M873 0v1250" stroke="#9e805b" stroke-width="4"/>${terrain}`;
}
