import {regionalSite} from '../core/geography.ts';
import './regional-atlas.css';
import {PLACES,SOURCES,GEOGRAPHY_VERSION,SCOUT_NAMES,place} from '../data/geography.ts';
import {routeFacts} from '../core/geography.ts';
import {availableMoves} from '../core/run.ts';
import {nodeInfo,nodeKey,movePreview,obligationLabels} from '../core/map-intel.ts';
import type {MapNode,RunState} from '../core/types.ts';
import type {KV} from '../core/save.ts';
import {mapIcon} from './map-presentation.ts';
import {esc} from './html.ts';
type Layer='terrain'|'names'|'roads'|'army'|'sites'|'scout'|'accords'|'influence';
const layerNames:Record<Layer,string>={terrain:'지형',names:'지명',roads:'경로',army:'군단',sites:'거점',scout:'정찰',accords:'의무',influence:'세력 영향'};
export interface CameraBox {x:number;y:number;width:number;height:number;}
export function boundCamera(box:CameraBox):CameraBox{
 const width=Math.max(420,Math.min(2000,box.width)),height=width/2;
 return {x:Math.max(0,Math.min(2000-width,box.x)),y:Math.max(0,Math.min(1000-height,box.y)),width,height};
}
const gb=(a:string,label:string,extra='')=>`<button class="btn" data-geo-action="${a}" ${extra}>${label}</button>`;
export class RegionalAtlas {
 box:CameraBox={x:0,y:0,width:2000,height:1000};layers=new Set<Layer>(['terrain','names','roads','army','sites','scout','accords']);
 mode:'region'|'overview'|'list'='region';detail:string|null=null;restoreCamera=false;textScale=1;
 private pointers=new Map<number,{x:number;y:number}>();private lastDistance=0;private dragged=false;private scope='';private initialized=false;private routeSelection?:MapNode;
 constructor(privateRoot:HTMLElement,kv:KV,run:()=>RunState|null,render:()=>void){
  this.root=privateRoot;this.kv=kv;this.run=run;
  privateRoot.addEventListener('click',e=>{
   if(this.dragged&&(e.target as Element).closest('.geo-surface')){this.dragged=false;e.preventDefault();e.stopImmediatePropagation();return;}
   this.dragged=false;
   const el=(e.target as Element).closest<HTMLElement>('[data-geo-action]');if(!el||!run()?.geography)return;
   e.preventDefault();e.stopImmediatePropagation();const a=el.dataset.geoAction!,r=run()!;
   if(a==='zoom'){this.zoom(Number(el.dataset.factor));return;}
   if(a==='focus'){this.focus(r,el.dataset.value!,this.routeSelection);return;}
   if(a==='mode'){this.mode=el.dataset.value as typeof this.mode;this.detail=null;}
   if(a==='layer'){const l=el.dataset.value as Layer;if(this.layers.has(l))this.layers.delete(l);else this.layers.add(l);}
   if(a==='source'){this.detail=this.detail==='sources'?null:'sources';}
   if(a==='place'){this.detail=el.dataset.id!;const p=place(this.detail);this.box=boundCamera({x:p.mapX-350,y:p.mapY-175,width:700,height:350});}
   if(a==='restore')this.restoreCamera=!this.restoreCamera;
   if(a==='text')this.textScale=this.textScale===1?1.2:1;
   this.store();render();
  });
  privateRoot.addEventListener('input',e=>{const input=e.target as HTMLInputElement;if(!input.matches('[data-geo-search]'))return;
   const q=input.value.trim();const result=privateRoot.querySelector<HTMLElement>('.geo-search-results');if(result)result.innerHTML=q?PLACES.filter(p=>p.featureType!=='administration'&&p.primaryName.includes(q)).map(p=>gb('place',p.primaryName,`data-id="${p.id}"`)).join('')||'<span>일치하는 역사 지명 없음</span>':'';
  });
  privateRoot.addEventListener('input',e=>{const input=e.target as HTMLInputElement;
   if(!input.matches('[data-geo-scroll]'))return;
   const axis=input.dataset.geoScroll as 'x'|'y';this.box=boundCamera({...this.box,[axis]:Number(input.value)});this.update();
  });
  privateRoot.addEventListener('wheel',e=>{
   if(!(e.target as Element).closest('.geo-surface'))return;e.preventDefault();
   if(e.ctrlKey){if(e.deltaY)this.zoom(e.deltaY<0?.85:1.18,e.clientX,e.clientY);return;}
   const rect=this.rect(),unit=e.deltaMode===1?16:e.deltaMode===2?rect.height:1;
   const dx=e.shiftKey?e.deltaY+e.deltaX:e.deltaX,dy=e.shiftKey?0:e.deltaY;
   this.box=boundCamera({...this.box,x:this.box.x+dx*unit*this.box.width/rect.width,y:this.box.y+dy*unit*this.box.height/rect.height});this.update();
  },{passive:false});
  privateRoot.addEventListener('pointerdown',e=>{
   const surface=(e.target as Element).closest<SVGSVGElement>('.geo-surface');if(!surface)return;
   this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});this.lastDistance=0;this.dragged=false;
   try{(e.target as Element).setPointerCapture(e.pointerId);}catch{/* DOM simulation has no pointer capture. */}
  });
  privateRoot.addEventListener('pointermove',e=>{
   const old=this.pointers.get(e.pointerId);if(!old)return;
   const dx=e.clientX-old.x,dy=e.clientY-old.y;this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
   if(this.pointers.size===2){const [a,b]=[...this.pointers.values()],distance=Math.hypot(a.x-b.x,a.y-b.y);if(this.lastDistance>0&&distance>0)this.zoom(this.lastDistance/distance,(a.x+b.x)/2,(a.y+b.y)/2);this.lastDistance=distance;this.dragged=true;}
   else {const rect=this.rect();if(Math.abs(dx)+Math.abs(dy)>2)this.dragged=true;this.box=boundCamera({...this.box,x:this.box.x-dx*this.box.width/rect.width,y:this.box.y-dy*this.box.height/rect.height});this.update();}
  });
  const release=(e:PointerEvent)=>{this.pointers.delete(e.pointerId);this.lastDistance=0;this.store();};
  privateRoot.addEventListener('pointerup',release);privateRoot.addEventListener('pointercancel',release);
  privateRoot.addEventListener('keydown',e=>{
   const target=e.target as Element;if(!target.closest('.geo-surface'))return;
   if(['Enter',' '].includes(e.key)&&target.closest('[data-geo-action]')){e.preventDefault();target.closest('[data-geo-action]')!.dispatchEvent(new MouseEvent('click',{bubbles:true}));return;}
   if(['Enter',' '].includes(e.key)&&target.closest('[data-map-action]')){e.preventDefault();(target.closest('[data-map-action]') as HTMLElement).click();return;}
   if(['+','=','-'].includes(e.key)){e.preventDefault();this.zoom(e.key==='-'?1.2:.8);return;}
   if(target.matches('.geo-surface')&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){
    e.preventDefault();e.stopImmediatePropagation();const step=this.box.width*.12;this.box=boundCamera({...this.box,x:this.box.x+(e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0),y:this.box.y+(e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0)});this.update();this.store();
   }
  });
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(()=>this.update()).observe(privateRoot);
 }
 private root:HTMLElement;private kv:KV;private run:()=>RunState|null;
 private rect(){const r=this.root.querySelector('.geo-surface')?.getBoundingClientRect(),w=r?.width||800,h=r?.height||400,scale=Math.min(w/this.box.width,h/this.box.height),width=this.box.width*scale,height=this.box.height*scale;
  return {left:(r?.left??0)+(w-width)/2,top:(r?.top??0)+(h-height)/2,width,height};}
 private store(){try{this.kv.setItem('cheonha-gunjin.regional-ui',JSON.stringify({seed:this.run()?.seed,box:this.box,layers:[...this.layers],restoreCamera:this.restoreCamera,textScale:this.textScale}));}catch{}}
 private update(){const svg=this.root.querySelector('.geo-surface');svg?.setAttribute('viewBox',`${this.box.x} ${this.box.y} ${this.box.width} ${this.box.height}`);svg?.setAttribute('data-zoom',this.box.width<=850?'near':this.box.width<=1400?'middle':'wide');
  this.root.querySelectorAll<HTMLInputElement>('[data-geo-scroll]').forEach(input=>{const axis=input.dataset.geoScroll as 'x'|'y',max=axis==='x'?2000-this.box.width:1000-this.box.height;input.max=String(max);input.value=String(this.box[axis]);input.disabled=max===0;input.setAttribute('aria-valuetext',max===0?'전체 지도 표시 중':`${Math.round(this.box[axis]/max*100)}%`);});
  const inverse=this.box.width/this.rect().width,wide=this.box.width>1400,compact=wide||!!this.run()?.geography?.corridor,width=(compact?54:96)*inverse,height=(compact?64:86)*inverse;
  this.root.querySelectorAll<SVGForeignObjectElement>('.geo-surface foreignObject').forEach(el=>{el.setAttribute('x',String(Number(el.dataset.x)-width/2));el.setAttribute('y',String(Number(el.dataset.y)-height/2));el.setAttribute('width',String(width));el.setAttribute('height',String(height));el.style.setProperty('--marker-scale',String(inverse));});
  this.root.querySelectorAll<SVGTextElement>('.geo-place text').forEach(el=>el.style.fontSize=`${18*inverse*this.textScale}px`);this.store();}
 private zoom(factor:number,cx?:number,cy?:number){const r=this.rect();
  const fx=cx===undefined?.5:Math.max(0,Math.min(1,(cx-r.left)/r.width)),fy=cy===undefined?.5:Math.max(0,Math.min(1,(cy-r.top)/r.height));
  const width=this.box.width*factor;this.box=boundCamera({x:this.box.x+fx*(this.box.width-width),y:this.box.y+fy*(this.box.height-width/2),width,height:width/2});this.update();
 }
 focus(r:RunState,what:string,selected?:MapNode){
  let points=what==='boss'?[regionalSite(r,7,0)]:what==='route'&&selected?[regionalSite(r,selected.floor,selected.col),...(r.floor>=0?[regionalSite(r,r.floor,r.col)]:[])]:[
   ...(r.floor>=0?[regionalSite(r,r.floor,r.col)]:[]),...availableMoves(r).map(n=>regionalSite(r,n.floor,n.col))];
  if(what==='all'||!points.length){this.box={x:0,y:0,width:2000,height:1000};}
  else {const xs=points.map(p=>p.mapX),ys=points.map(p=>p.mapY),width=Math.max(700,Math.max(...xs)-Math.min(...xs)+250,(Math.max(...ys)-Math.min(...ys)+180)*2);
   this.box=boundCamera({x:(Math.max(...xs)+Math.min(...xs)-width)/2,y:(Math.max(...ys)+Math.min(...ys)-width/2)/2,width,height:width/2});}
  this.update();
 }
 private sync(r:RunState){
  const scope=`${r.seed}:${r.floor}:${r.col}`;if(scope===this.scope)return;this.scope=scope;this.pointers.clear();
  if(!this.initialized){this.initialized=true;try{const s=JSON.parse(this.kv.getItem('cheonha-gunjin.regional-ui')??'{}');this.restoreCamera=s.restoreCamera===true;this.textScale=s.textScale===1.2?1.2:1;
   if(Array.isArray(s.layers))this.layers=new Set(s.layers.filter((x:Layer)=>Object.hasOwn(layerNames,x)));
   if(this.restoreCamera&&s.seed===r.seed&&s.box&&['x','y','width','height'].every(k=>Number.isFinite(s.box[k]))){this.box=boundCamera(s.box);return;}
  }catch{}}
  this.focus(r,'current');
 }
 surface(r:RunState,selected?:MapNode){this.sync(r);this.routeSelection=selected;
  const controls=`<div class="geo-tools"><label>지명 찾기 <input data-geo-search placeholder="낙양 · 성고 · 구씨" aria-label="알려진 역사 지명 검색"></label><div class="geo-search-results" role="status"></div><nav>${gb('zoom','확대 +','data-factor="0.8"')}${gb('zoom','축소 −','data-factor="1.25"')}${gb('focus','현재 군단','data-value="current"')}${gb('focus','전체 지역','data-value="all"')}${gb('focus','결전','data-value="boss"')}${gb('focus','선택 경로','data-value="route"')}${gb('mode','개관','data-value="overview"')}${gb('mode','지역','data-value="region"')}${gb('mode','목록','data-value="list"')}${gb('source','지도 출처')}</nav></div>`;
  const layers=`<details class="geo-layers"><summary>지도 레이어·읽기 설정</summary>${Object.entries(layerNames).map(([id,name])=>gb('layer',`${this.layers.has(id as Layer)?'✓ ':''}${name}`,`data-value="${id}" aria-pressed="${this.layers.has(id as Layer)}"`)).join('')}${gb('restore',`${this.restoreCamera?'✓ ':''}마지막 카메라 복원`)}${gb('text',this.textScale===1?'지도 글자 크게':'지도 기본 글자')}</details>`;
  let body=this.mode==='overview'?this.overview():this.mode==='list'?this.list(r):this.map(r,selected);
  const detail=this.detail==='sources'?`<section class="geo-detail"><h2>지도 출처 · ${GEOGRAPHY_VERSION}</h2><p>190년 배경의 가상 원정. 고대 치소 측량·정밀 경계·실제 유로·실제 거리를 재현하지 않습니다. 원본 GIS와 상용 지도 에셋을 포함하지 않습니다.</p>${Object.values(SOURCES).map(s=>`<p><a href="${s.url}" target="_blank" rel="noopener">${esc(s.citation)}</a><br>${esc(s.license)}</p>`).join('')}</section>`:this.detail?this.placeDetail(place(this.detail)):'';
  queueMicrotask(()=>this.update());
  return `<div class="geo-container" style="--geo-text:${this.textScale}">${controls}${layers}${body}${detail}<p class="geo-caption">북 ↑ · ${r.geography?.corridor?`${place(r.geography.corridor.from).primaryName} → ${place(r.geography.corridor.to).primaryName}`:'형양에서 낙양으로 서진'} · 군용 약도, 실제 거리 아님 · 도시·하천은 공개 / 군사 상황은 정찰 · 휠: 상하 이동 · Shift+휠: 좌우 이동 · Ctrl+휠: 확대/축소 · 드래그·두 손가락·화살표도 사용 가능</p></div>`;
 }
 private map(r:RunState,selected?:MapNode){const g=r.geography!,moves=new Set(availableMoves(r).map(nodeKey)),visible=this.layers;
  const paths=visible.has('roads')?r.map.flat().flatMap(n=>n.next.map(c=>{const m=r.map[n.floor+1]?.[c];if(!m)return '';const a=regionalSite(r,n.floor,n.col),b=regionalSite(r,m.floor,m.col),active=n.floor===r.floor&&n.col===r.col;
   const seen=g.discoveredRoutes.includes(`${nodeKey(n)}>${nodeKey(m)}`),traveled=g.travel?.from===a.id&&g.travel.to===b.id;
   return `<path class="geo-road ${active?'active':''} ${traveled?'traveled':''} ${seen?'':'unconfirmed'}" d="M${a.mapX} ${a.mapY} Q${(a.mapX+b.mapX)/2} ${(a.mapY+b.mapY)/2-30} ${b.mapX} ${b.mapY}"/><text class="geo-crossing" x="${(a.mapX+b.mapX)/2}" y="${(a.mapY+b.mapY)/2}">${a.terrain==='river'||b.terrain==='river'?'도하':''}</text>`;
  })).join(''):'';
  const labels=visible.has('names')?PLACES.filter(p=>p.featureType!=='administration').map(p=>`<g class="geo-place" data-geo-action="place" data-id="${p.id}" tabindex="0" role="button" aria-label="${p.primaryName} 역사 지명, 위치 추정"><circle cx="${p.mapX}" cy="${p.mapY}" r="8"/><text x="${p.mapX}" y="${p.mapY-70}">${p.primaryName}</text></g>`).join(''):'';
  const nodes=visible.has('sites')?r.map.flat().map(n=>{const s=regionalSite(r,n.floor,n.col),i=nodeInfo(r,n),known=g.scout[s.id]??0,here=n.floor===r.floor&&n.col===r.col,reachable=moves.has(nodeKey(n)),visited=g.visited.includes(s.id),facts=routeFacts(r,n);
   const state=here?'current':reachable?'reachable':visited?'visited':'partial',duty=visible.has('accords')&&obligationLabels(r,n).length;
   const title=`${s.name} · 창작 거점 · ${n.floor+1}행군 · ${i.type} · ${i.terrain.name} · ${SCOUT_NAMES[known]} · ${reachable?`군량 ${r.food} → ${movePreview(r,n).food}`:'지금 이동 불가'} · ${i.risk}`;
   return `${visible.has('influence')?`<g class="geo-influence"><circle cx="${s.mapX}" cy="${s.mapY}" r="80"/><text x="${s.mapX}" y="${s.mapY+90}">${facts.control} · 게임 설정</text></g>`:''}<foreignObject data-x="${s.mapX}" data-y="${s.mapY}" x="${s.mapX-62}" y="${s.mapY-40}" width="124" height="100"><button xmlns="http://www.w3.org/1999/xhtml" class="atlas-node geo-node ${state} ${selected&&nodeKey(selected)===nodeKey(n)?'selected':''}" data-map-action="select" data-key="${nodeKey(n)}" aria-label="${esc(title)}" aria-pressed="${selected&&nodeKey(selected)===nodeKey(n)}" title="${esc(title)}"><span class="atlas-node-mark">${mapIcon(known>=2||n.type==='boss'?n.type:'unknown')}</span><strong class="geo-site-label">${n.floor+1} · ${known>=2?esc(i.type):'미확인'}</strong><small class="geo-near-label">${SCOUT_NAMES[known]}</small>${duty?'<b>◇ 의무</b>':''}${here&&visible.has('army')?'<b class="geo-army">⚑ 현재</b>':visited?'<b>✓ 방문</b>':''}</button></foreignObject>${visible.has('scout')&&known<2?`<circle class="geo-fog" cx="${s.mapX}" cy="${s.mapY}" r="57"/>`:''}`;
  }).join(''):'';
  return `<svg class="geo-surface" viewBox="${this.box.x} ${this.box.y} ${this.box.width} ${this.box.height}" data-zoom="${this.box.width<=850?'near':this.box.width<=1400?'middle':'wide'}" tabindex="0" role="group" aria-label="${r.campaign?place(r.campaign.target).primaryName:'낙양'} 지역 원정 지도. 화살표로 카메라 이동, 더하기 빼기로 확대, Tab으로 거점 탐색.">
   <defs><linearGradient id="geo-paper" x2="0" y2="1"><stop stop-color="#ded3b7"/><stop offset="1" stop-color="#b8b394"/></linearGradient><linearGradient id="geo-relief" x2="0" y2="1"><stop stop-color="#6a725b"/><stop offset="1" stop-color="#b2ac83"/></linearGradient><pattern id="geo-hatch" width="18" height="18" patternUnits="userSpaceOnUse"><path d="M0 18L18 0" stroke="#665c43" opacity=".07"/></pattern></defs>
   <rect width="2000" height="1000" fill="url(#geo-paper)"/><rect width="2000" height="1000" fill="url(#geo-hatch)"/>
   ${visible.has('terrain')?`<g class="geo-relief"><path d="M0 80Q300 90 420 180T1000 150L1100 260 0 260Z" fill="url(#geo-relief)"/><path d="M850 1000L900 850 980 730 1100 810 1220 690 1390 780 1500 680 1790 750 2000 660V1000Z" fill="url(#geo-relief)"/><path d="M920 910L990 790 1040 830 1110 860 1210 760 1300 830 1480 750 1600 840 1740 800 1910 750" fill="none" stroke="#55604b" stroke-width="4"/><path d="M0 130Q450 45 830 140T1350 185T2000 120" class="geo-river yellow"/><path d="M0 580Q330 570 650 580T1000 540Q1200 530 1330 455T1450 160" class="geo-river"/><text x="1100" y="110">황하 · 유로 재구성</text><text x="500" y="590">낙수 · 유로 재구성</text><text x="1490" y="910">남쪽 산지 · 고도색은 예술 표현</text></g>`:''}
   ${paths}${labels}${nodes}${r.floor<0&&visible.has('army')?'<text class="geo-start" x="1900" y="600">⚑ 출발 군영</text>':''}
  </svg><div class="geo-scroll-controls" aria-label="지도 스크롤"><label>좌우 이동 <input type="range" min="0" max="${2000-this.box.width}" step="any" value="${this.box.x}" data-geo-scroll="x" aria-label="지도 좌우 스크롤" ${this.box.width===2000?'disabled':''}></label><label>상하 이동 <input type="range" min="0" max="${1000-this.box.height}" step="any" value="${this.box.y}" data-geo-scroll="y" aria-label="지도 상하 스크롤" ${this.box.height===1000?'disabled':''}></label><span>전체 지역에서는 확대 후 이동</span></div>`;
 }
 private list(r:RunState){return `<section class="geo-list" aria-label="지도 대신 사용하는 전체 거점 목록">${r.map.flat().map(n=>{const s=regionalSite(r,n.floor,n.col),i=nodeInfo(r,n),p=movePreview(r,n);return `<button data-map-action="select" data-key="${nodeKey(n)}"><b>${n.floor+1}행군 · ${s.name}</b><span>${i.type} · ${i.terrain.name} · ${i.info}</span><span>${p.result.ok?`군량 ${r.food} → ${p.food} · 병력 ${r.hp} → ${p.hp}`:'현재 이동 불가'} · ${esc(i.risk)}</span></button>`;}).join('')}</section>`;}
 private overview(){return `<section class="geo-overview"><h2>190년 · 낙양 주변 원정권</h2><svg viewBox="0 0 1000 500" role="img" aria-label="낙양의 동서 지역 맥락만 표시한 개관 약도. 행정 경계 없음"><path d="M80 170Q400 20 900 140"/><path d="M70 350Q440 400 850 300"/><text x="140" y="220">장안 방면 · 맥락만</text><circle cx="460" cy="200" r="50"/><text x="460" y="200">낙양</text><text x="740" y="210">형양 방면</text><text x="520" y="80">황하 북쪽 · 맥락만</text><text x="550" y="430">남쪽 산지 · 맥락만</text></svg><p>플레이 가능: 하남윤의 낙양 동쪽 회랑. 나머지는 방향 맥락만 제공합니다. 미검증 주·군 경계를 확정선으로 표시하지 않습니다.</p>${gb('mode','지역 원정으로 돌아가기','data-value="region"')}</section>`;}
 private placeDetail(p:ReturnType<typeof place>){return `<section class="geo-detail"><h2>${p.primaryName} · 사료 확인 지명</h2><p>위치 추정 · 190년 시나리오용 자료 검토</p><p>${esc(p.notes)}</p><p>${esc(p.adjustment)}</p><details><summary>현대 위치 참고·좌표·출처</summary><p>${esc(p.modernReference)} · 참고 중심점 ${p.coordinate.longitude}, ${p.coordinate.latitude}. 고대 치소 확정 좌표 아님.</p><p>행정 맥락: ${p.administrativeParent?place(p.administrativeParent).primaryName:'사예 권역'} · 지원 연도 ${p.validFrom}</p><a href="${p.source}" target="_blank" rel="noopener">${esc(p.sourceCitation)}</a><p>${esc(p.sourceLicense)}</p></details></section>`;}
}
