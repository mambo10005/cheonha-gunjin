import type {BattleState} from '../core/types.ts';
// Arrows use DOM unit/lane anchors after layout. Their position cannot influence rules.
export function connectIntentArrows(root:HTMLElement,b:BattleState):void {
 const stage=root.querySelector<HTMLElement>('.battlefield');if(!stage)return;
 stage.querySelector('[data-intent-routes]')?.remove();
 const rect=stage.getBoundingClientRect();if(!rect.width||!rect.height)return;
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
 svg.setAttribute('class','intent-routes');svg.setAttribute('viewBox',`0 0 ${rect.width} ${rect.height}`);svg.setAttribute('aria-hidden','true');svg.setAttribute('data-intent-routes','');
 for(const e of b.enemies){const intent=e.intent;if(e.dead||e.confused||intent?.kind!=='attack')continue;
  const source=stage.querySelector<HTMLElement>(`[data-unit="${e.uid}"] .cohort`)?.getBoundingClientRect();if(!source)continue;
  const rows=intent.row==='both'?['front','rear'] as const:[intent.row];
  for(const row of rows){
   const destination=stage.querySelector<HTMLElement>(`[data-lane="${row}"] .shield-line,[data-lane="${row}"] .lane-label`)?.getBoundingClientRect();if(!destination)continue;
   // Turncoat has a rule-defined highest-HP ally; lone turncoat falls back to the original lane.
   const others=b.enemies.filter(x=>!x.dead&&x.uid!==e.uid),victim=e.turncoat&&others.length?others.reduce((a,x)=>x.hp>a.hp?x:a):null;
   const ally=victim?stage.querySelector<HTMLElement>(`[data-unit="${victim.uid}"] .cohort`)?.getBoundingClientRect():null;
   const target=ally??destination,x1=source.x+source.width/2-rect.x,y1=source.y+source.height-rect.y,x2=target.x+target.width/2-rect.x,y2=target.y+target.height/2-rect.y;
   const path=document.createElementNS(ns,'path');path.setAttribute('d',`M${x1} ${y1} Q${(x1+x2)/2} ${Math.min(y1,y2)-20} ${x2} ${y2}`);path.setAttribute('class',victim?'route-turncoat':'');svg.appendChild(path);
   const head=document.createElementNS(ns,'circle');head.setAttribute('cx',String(x2));head.setAttribute('cy',String(y2));head.setAttribute('r','4');svg.appendChild(head);
   const label=document.createElementNS(ns,'text');label.setAttribute('x',String((x1+x2)/2));label.setAttribute('y',String((y1+y2)/2-8));label.textContent=`${intent.dmg+e.str+(!victim&&b.terrain==='mountain'&&row==='rear'?2:0)}${intent.hits>1?'×'+intent.hits:''}`;svg.appendChild(label);
   if(victim)break;
  }
 }
 stage.appendChild(svg);
}
