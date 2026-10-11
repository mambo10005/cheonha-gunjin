import {regionalSite} from '../core/geography.ts';
import './expedition-map.css';
import {RegionalAtlas} from './regional-atlas.ts';
import {compatibleGeography,routeFacts} from '../core/geography.ts';
import {place} from '../data/geography.ts';
import {availableMoves,NODE_NAME} from '../core/run.ts';
import {nodeKey,nodeInfo,movePreview,futureLayers,canReach,bossNotes} from '../core/map-intel.ts';
import {activeAgreements,CLAUSES} from '../core/accords.ts';
import {GENERALS} from '../data/generals.ts';
import {LORDS} from '../data/lords.ts';
import {ENEMIES} from '../data/enemies.ts';
import {FACTIONS} from '../data/social.ts';
import {mapLayout,curve,mapIcon,atlasBackdrop} from './map-presentation.ts';
import {esc,activityButton} from './html.ts';
import type {MapNode,RunState} from '../core/types.ts';
import type {KV} from '../core/save.ts';
type Drawer='legend'|'records'|'army'|'accords'|'settings'|null;
type Camera='current'|'all'|'boss';
const UI_KEY='cheonha-gunjin.map-ui';
const btn=(a:string,label:string,extra='')=>`<button class="btn" data-map-action="${a}" ${extra}>${label}</button>`;
const list=(lines:string[])=>`<ul>${lines.map(s=>`<li>${esc(s)}</li>`).join('')}</ul>`;
export class ExpeditionMap {
 selected:string|null=null;drawer:Drawer=null;camera:Camera='current';contrast=false;motion:'normal'|'fast'|'off'='normal';filter='all';
 private scope='';private restored=false;
 private atlas:RegionalAtlas;
 private root:HTMLElement;private kv:KV;private render:()=>void;private confirm:(col:number)=>void;
 constructor(root:HTMLElement,kv:KV,run:()=>RunState|null,render:()=>void,confirm:(col:number)=>void){
  this.root=root;this.kv=kv;this.render=render;this.confirm=confirm;
  this.atlas=new RegionalAtlas(root,kv,run,render);
  root.addEventListener('click',e=>{const el=(e.target as HTMLElement).closest<HTMLElement>('[data-map-action]');if(!el)return;const r=run();if(!r||r.screen!=='map')return;e.preventDefault();e.stopImmediatePropagation();
   const a=el.dataset.mapAction!;
   if(a==='select'){this.selected=el.dataset.key!;this.store(r);this.render();this.root.querySelector<HTMLElement>('[data-map-panel] h2')?.focus();return;}
   if(a==='cancel'){this.selected=null;this.store(r);this.render();this.root.querySelector<HTMLElement>('.atlas-node.reachable')?.focus();return;}
   if(a==='confirm'){
    const n=this.find(r);if(!n||Number(el.dataset.floor)!==r.floor||Number(el.dataset.col)!==n.col||!movePreview(r,n).result.ok)return;
    const before=r.floor,oldFood=r.food,p=this.motion==='off'?null:this.motion;
    const origin=this.root.querySelector<HTMLElement>('.atlas-node.current,.atlas-start')?.getBoundingClientRect();
    const destination=this.root.querySelector<HTMLElement>(`.atlas-node[data-key="${nodeKey(n)}"]`)?.getBoundingClientRect();
    this.confirm(n.col);this.store(r);
    if(r.floor!==before&&p)this.travelFlash(n,oldFood,r.food,p,origin,destination);return;
   }
   if(a==='camera'){this.camera=el.dataset.value as Camera;this.render();return;}
   if(a==='drawer'){this.drawer=el.dataset.value as Drawer;this.render();this.root.querySelector<HTMLElement>('[data-map-drawer] button')?.focus();return;}
   if(a==='close'){this.drawer=null;this.render();this.root.querySelector<HTMLElement>('[data-map-action="drawer"]')?.focus();return;}
   if(a==='contrast')this.contrast=!this.contrast;
   if(a==='motion')this.motion=el.dataset.value as typeof this.motion;
   if(a==='filter')this.filter=el.dataset.value!;
   this.store(r);this.render();
  });
  root.addEventListener('keydown',e=>{
   const r=run();if(!r||r.screen!=='map'||!root.querySelector('.expedition-map'))return;
   if(this.drawer&&e.key==='Tab'){
    const els=[...root.querySelectorAll<HTMLElement>('[data-map-drawer] button,[data-map-drawer] summary')];const index=els.indexOf(e.target as HTMLElement);
    if((e.shiftKey&&index===0)||(!e.shiftKey&&index===els.length-1)){e.preventDefault();els[e.shiftKey?els.length-1:0]?.focus();}return;
   }
   if(e.key==='Escape'){e.preventDefault();e.stopPropagation();if(this.drawer)this.drawer=null;else this.selected=null;this.store(r);this.render();root.querySelector<HTMLElement>('.atlas-node.reachable')?.focus();}
   if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)&&(e.target as HTMLElement).closest('.atlas-node')){
    const els=[...root.querySelectorAll<HTMLElement>('.atlas-node.reachable')];if(!els.length)return;const step=['ArrowLeft','ArrowDown'].includes(e.key)?-1:1;const index=els.indexOf(e.target as HTMLElement);e.preventDefault();els[(index+step+els.length)%els.length].focus();
   }
  });
  root.addEventListener('mouseover',e=>this.highlight(e.target as HTMLElement));
  root.addEventListener('focusin',e=>this.highlight(e.target as HTMLElement));
  root.addEventListener('mouseout',e=>{if(!(e.relatedTarget as HTMLElement|null)?.closest?.('.atlas-node'))this.highlight(null);});
 }
 private highlight(el:HTMLElement|null){const key=el?.closest<HTMLElement>('.atlas-node')?.dataset.key;this.root.querySelectorAll<SVGElement>('.atlas-route').forEach(p=>p.classList.toggle('hover-route',!!key&&(p.dataset.from===key||p.dataset.to===key)));}
 private find(r:RunState){return r.map.flat().find(n=>nodeKey(n)===this.selected);}
 private store(r:RunState){try{this.kv.setItem(UI_KEY,JSON.stringify({scope:`${r.seed}:${r.lordId}:${r.floor}:${r.col}`,selected:this.selected,contrast:this.contrast,motion:this.motion}));}catch{/* Optional preferences do not affect run saving. */}}
 private sync(r:RunState){const scope=`${r.seed}:${r.lordId}:${r.floor}:${r.col}`;if(scope===this.scope)return;this.scope=scope;
  if(!this.restored){this.restored=true;try{const s=JSON.parse(this.kv.getItem(UI_KEY)??'{}');this.contrast=s.contrast===true;if(['normal','fast','off'].includes(s.motion))this.motion=s.motion;if(s.scope===scope&&typeof s.selected==='string')this.selected=s.selected;}catch{}}
  else this.selected=null;
  if(!this.find(r))this.selected=null;
 }
 hud(r:RunState){return `<header class="atlas-hud"><strong>${esc(LORDS[r.lordId].name)}의 원정</strong><span>병력 <b>${r.hp}/${r.maxHp}</b></span><span>군량 <b>${r.food}</b></span><span>${r.floor<0?'출발 전':`${r.floor+1}행군`} / 8행군</span>${r.social.passage?`<span class="atlas-chip">통행 ${r.social.passage.moves}회</span>`:''}${activeAgreements(r).length?`<span class="atlas-chip">의무 ${activeAgreements(r).length}</span>`:''}<span class="grow"></span><button class="btn" data-a="modal" data-m="deck">덱 ${r.deck.length}</button>${btn('drawer','범례','data-value="legend"')}${btn('drawer','설정','data-value="settings"')}<button class="btn" data-a="modal" data-m="help">규칙</button><button class="btn ghost" data-a="modal" data-m="abandon">원정 포기</button></header>`;}
 view(r:RunState){
  if(compatibleGeography(r))return this.regionalView(r);
  this.sync(r);const layout=mapLayout(r),selected=this.find(r),moves=availableMoves(r),reachable=new Set(moves.map(nodeKey));
  const start=this.camera==='all'?0:this.camera==='boss'?5:Math.max(0,r.floor);
  const end=this.camera==='all'?7:this.camera==='boss'?7:Math.min(7,start+2);
  const top=90+(7-end)*145-70,height=(end-start+1)*145;
  const trail=r.mapTrail??(r.floor>=0?[{floor:r.floor,col:r.col}]:[]),visited=new Set(trail.map(nodeKey));
  const descendants=new Set(selected?futureLayers(r,selected,8).flat().map(nodeKey):[]);
  const paths=r.map.flatMap(row=>row.flatMap(n=>n.next.map(c=>{
   const m=r.map[n.floor+1]?.[c];if(!m)return '';const from=nodeKey(n),to=nodeKey(m);const traveled=trail.some((p,i)=>i>0&&nodeKey(trail[i-1])===from&&nodeKey(p)===to);
   const now=n.floor===r.floor&&n.col===r.col;const preview=selected&&(from===nodeKey(selected)||descendants.has(from))&&descendants.has(to);
   const obligation=nodeInfo(r,m).obligations.length>0;
   return `<path class="atlas-route ${traveled?'traveled':now?'active':preview?'preview':'future'} ${obligation?'obligation-route':''}" data-from="${from}" data-to="${to}" d="${curve(layout.points.get(from)!,layout.points.get(to)!)}"/>`;
  }))).join('');
  const nodes=r.map.flat().filter(n=>n.floor>=start&&n.floor<=end).map(n=>{
   const key=nodeKey(n),p=layout.points.get(key)!,i=nodeInfo(r,n),here=n.floor===r.floor&&n.col===r.col,access=reachable.has(key),past=n.floor<r.floor;
   const state=here?'here':visited.has(key)?'visited':access?'reachable':past?'closed':i.known?'known':'partial';
   const stateText=here?'군단 현재 위치':visited.has(key)?'방문 완료':access?'이동 가능':past?'지나간 다른 길':'미래 경로';
   const pv=access?movePreview(r,n):null;
   const costs=pv?pv.growth?'성장 먼저':`군량 ${r.food}→${pv.food}${pv.hp<r.hp?` · 병력 ${r.hp}→${pv.hp}`:''}`:'유형·지형 공개';
   const icon=n.type==='event'&&i.known&&['envoy','checkpoint'].includes(n.eventId??'')?'diplomacy':n.type==='event'&&i.known&&['parley','refugees'].includes(n.eventId??'')?'debate':n.type;
   return `<button class="atlas-node ${state} ${here?'current':''} ${selected&&nodeKey(selected)===key?'selected':''} ${n.type==='boss'?'boss':''}" data-map-action="select" data-key="${key}" data-floor="${n.floor}" style="left:${p.x/9}%;top:${(p.y-top)/height*100}%" aria-pressed="${selected&&nodeKey(selected)===key?'true':'false'}" aria-label="${n.floor+1}층 ${n.col+1}번 ${esc(i.name)} · ${i.type} · ${esc(i.terrain.name)} · ${stateText} · ${esc(costs)} · ${esc(i.benefit)}" title="${esc(i.synergies.join(' / ')||i.benefit)}"><span class="atlas-node-mark">${mapIcon(icon)}${here?'<span class="army-banner">현재</span>':visited.has(key)?'<span class="visit-check">✓</span>':''}</span><strong>${esc(i.name)}</strong><span>${i.type} · ${i.terrain.name}</span><small>${esc(costs)}</small>${i.obligations.length?'<b class="duty-stamp">의무</b>':''}</button>`;
  }).join('');
  const floorLabels=r.map.slice(start,end+1).map(row=>`<span class="atlas-floor" style="top:${(layout.points.get(nodeKey(row[0]))!.y-top)/height*100}%">${row[0].floor+1}층</span>`).join('');
  return `<main class="expedition-map" data-contrast="${this.contrast?'high':'normal'}" data-motion="${this.motion}"><section class="atlas-map-area"><div class="atlas-heading"><div><small>군용 행군도 · 낙양 방면</small><h1>낙양으로 향하는 길</h1></div><div class="atlas-camera">${btn('camera','현재 위치','data-value="current"')}${btn('camera','전체 지도','data-value="all"')}${btn('camera','결전 보기','data-value="boss"')}</div></div><div class="atlas-viewport ${this.camera==='all'?'whole':''}"><div class="atlas-board"><svg class="atlas-canvas" viewBox="0 ${top} 900 ${height}" preserveAspectRatio="none" aria-hidden="true">${atlasBackdrop(r,layout.points)}<g>${paths}</g></svg>${floorLabels}${nodes}${start===0&&r.floor<0?'<span class="atlas-start">⚑ 출발 군영 · 다음 거점을 선택하세요</span>':''}</div></div><div class="atlas-minilegend"><span>⚑ 현재 위치</span><span>◎ 이동 가능</span><span>✓ 방문 완료</span><span>▧ 부분 확인</span><span>◇ 의무</span></div><section class="route-comparison" aria-label="지금 가능한 경로 비교">${moves.map(n=>{const i=nodeInfo(r,n),p=movePreview(r,n);return `<button data-map-action="select" data-key="${nodeKey(n)}"><b>${n.col+1}번 · ${esc(i.type)}</b><span>${p.growth?'원정 성장 선택 후 진군':`군량 ${r.food} → ${p.food}`}</span><span>${esc(i.benefit)}</span><small>${esc(i.risk)}${i.obligations.length?' · 의무 진행':''}${p.hp<r.hp?' · 병력 손실':''}</small></button>`;}).join('')}</section></section><aside class="atlas-context" data-map-panel aria-live="polite">${this.context(r,selected)}<section class="army-strip"><h3>군단 ${r.generals.length}/4</h3>${r.generals.map(g=>`<span><b>${GENERALS[g.id].name}</b> ${g.row==='front'?'전열':'후열'} · ${GENERALS[g.id].role}</span>`).join('')}${btn('drawer','군단·무료 재배치','data-value="army"')}</section><nav class="atlas-drawers">${btn('drawer','협정·세력','data-value="accords"')}${btn('drawer','원정 기록','data-value="records"')}</nav><p class="atlas-recent">${r.history.slice(-2).map(esc).join('<br>')}</p></aside>${this.drawerHtml(r)}</main>`;
 }
 private context(r:RunState,n?:MapNode){
  if(!n)return `<h2 tabindex="-1">다음 진군을 계획하세요</h2><p>거점을 선택해 비교한 뒤 진군을 확정합니다. 선택만으로 군량을 쓰지 않습니다.</p><h3>결전 · 낙양의 동탁</h3>${list(bossNotes(r))}<h3>남은 의무</h3>${list(activeAgreements(r).map(a=>`${CLAUSES[a.clause].name}: ${a.supply&&a.stage==='waiting'?`${a.supply.floor+1}행군 ${a.supply.col+1}번 군량 보급 → `:''}${a.target.floor+1}행군 ${a.target.col+1}번 전투`))}${!activeAgreements(r).length?'<p>활성 의무 없음</p>':''}<p class="atlas-note">미래 거점은 유형·지형을 공개하며, 다음 이동 가능 거점에서 편성을 확인합니다. 별도의 유료 정찰 기능은 없습니다.</p>`;
  const i=nodeInfo(r,n),p=movePreview(r,n),after=futureLayers(r,n);const conflicts=activeAgreements(r).filter(a=>!canReach(r,n,a.supply&&a.stage==='waiting'?a.supply:a.target));
  return `<h2 tabindex="-1">${esc(i.name)}</h2><p>${n.floor+1}행군 ${n.col+1}번 · ${i.type} · ${i.terrain.name}</p>${this.geographicContext(r,n)}<div class="atlas-cost"><b>군량 ${r.food} → ${p.result.ok?p.food:'이동 불가'}</b>${p.result.ok?`<span>병력 ${r.hp} → ${p.hp}</span>`:''}</div>${p.growth?'<p class="atlas-alert">진군 전에 원정 성장 선택이 열립니다. 이번 확정에는 이동 비용이 없으며, 성장 후 다시 진군하세요.</p>':''}<dl><dt>전투 위험</dt><dd>${esc(i.risk)}</dd><dt>성장·보상</dt><dd>${esc(i.benefit)}</dd><dt>정보 수준</dt><dd>${esc(i.info)}</dd></dl>${p.hp<r.hp?'<p class="atlas-alert">군량 부족으로 병력이 감소합니다.</p>':''}${i.obligations.length?`<h3>이 거점의 의무</h3>${list(i.obligations)}`:''}${conflicts.length?`<p class="atlas-alert">이 경로에서는 ${conflicts.map(a=>CLAUSES[a.clause].name).join(' · ')} 의무를 완료할 수 없습니다. 이탈 시 관계 −1·군량 −2·예치금 몰수.</p>`:''}<details><summary>현재 빌드와의 연계 ${i.synergies.length}</summary>${list(i.synergies.length?i.synergies:['이 장소에서 확인된 특별 연계 없음'])}</details><details><summary>정확한 이동 결과·지형 규칙</summary>${p.result.ok?`<p>통행 횟수 ${r.social.passage?.moves??0} → ${p.passage}</p>${list(p.changes)}`:''}${list(i.terrain.rules)}${i.encounter?list(i.encounter.enemies.map(id=>`${ENEMIES[id].name}: 기본 병력 ${ENEMIES[id].hp}${ENEMIES[id].trait?' · '+ENEMIES[id].trait:''}`)):''}</details><details open><summary>이후 ${after.length}개 행군의 분기</summary>${list(after.map(row=>`${row[0].floor+1}행군: ${[...new Set(row.map(n=>nodeInfo(r,n).type))].join(' / ')} · ${row.length}개 거점`))}</details><div class="atlas-confirm">${p.result.ok?`<button class="btn primary" data-map-action="confirm" data-a="move" data-col="${n.col}" data-floor="${r.floor}">${p.growth?'원정 성장 선택':'이 장소로 진군 확정'}</button>`:`<p>${esc(p.result.reason??'이동 불가')}</p>`}${btn('cancel','선택 취소')}</div><p class="atlas-note">진군 후 되돌릴 수 없습니다. 미래 분기는 실제 연결을 표시하며 사건 결과는 예고하지 않습니다.</p>`;
 }
 private geographicContext(r:RunState,n:MapNode){if(!compatibleGeography(r))return '';const f=routeFacts(r,n),p=place(f.site.placeId);return `<p>창작 활동 거점 · ${p.primaryName} 주변 · ${f.site.corridor}</p><p>이동 ${f.units}단위(작전 척도) · ${f.gate?`검문 군량 +${f.gateSurcharge} · 통행 협정으로 검문료 면제`:''}${f.event&&f.scouting>=3?` · ${f.event} 군량 +${f.eventFood}`:f.scouting<3?' · 구간 위험 미확인 (비용에는 반영)':''}</p><details><summary>거점 상세·역사 신뢰도</summary><p>${p.primaryName}: 사료 확인 지명 / 위치 추정. ${esc(f.site.adjustment)}</p><p>${esc(p.notes)}</p><a href="${p.source}" target="_blank" rel="noopener">사료·행정 맥락 확인</a><p>검문은 군량 비용입니다. 잠긴 관문이나 외교로 새 간선을 여는 기능은 구현하지 않았습니다.</p></details>`;}
 private regionalView(r:RunState){this.sync(r);const selected=this.find(r),moves=availableMoves(r);
  return `<main class="expedition-map" data-contrast="${this.contrast?'high':'normal'}" data-motion="${this.motion}"><section class="atlas-map-area">${this.atlas.surface(r,selected)}<section class="route-comparison" aria-label="이번 행군의 2~3개 경로 비교">${moves.map(n=>{const f=routeFacts(r,n),i=nodeInfo(r,n),p=movePreview(r,n);return `<button data-map-action="select" data-key="${nodeKey(n)}"><b>${f.site.corridor}</b><span>${esc(f.site.name)}</span><span>${p.growth?'성장 선택 먼저':`군량 ${r.food} → ${p.food} · ${f.units}단위`}</span><small>${esc(i.risk)} · ${i.info}${i.obligations.length?' · ◇ 의무':''}</small></button>`;}).join('')}</section></section><aside class="atlas-context" data-map-panel aria-live="polite">${selected?this.context(r,selected):`<h2>190년 · ${r.campaign?place(r.campaign.target).primaryName+' 정벌 원정':'낙양 서진 원정'}</h2><p>지도 탐색은 군량을 쓰지 않습니다. 이번 행군 후보를 비교하고 선택한 뒤 진군을 확정하세요. 8행군 뒤 ${r.campaign?'도시 접근·정벌 단계로 이어집니다.':'동탁 결전은 가상 전개입니다.'}</p>`+list(bossNotes(r))}<nav class="atlas-drawers">${btn('drawer','군단','data-value="army"')}${btn('drawer','협정·세력','data-value="accords"')}${btn('drawer','기록','data-value="records"')}</nav><p>현재 ${r.floor<0?'출발 전':regionalSite(r,r.floor,r.col).name} · 이동 누적 ${r.geography!.elapsed}단위</p></aside>${this.drawerHtml(r)}</main>`;
 }
 private drawerHtml(r:RunState){if(!this.drawer)return '';let title='',body='';
  if(this.drawer==='legend'){title='지도 범례';body=`<div class="atlas-icon-legend">${Object.entries(NODE_NAME).map(([id,name])=>`<span>${mapIcon(id)}${name}</span>`).join('')}${['diplomacy','debate'].map(id=>`<span>${mapIcon(id)}${id==='debate'?'설전':'외교'}</span>`).join('')}</div><p>굵은 실선: 방문 경로 / 옥색 실선: 지금 가능한 길 / 밝은 점선: 선택 이후 분기 / 가는 먹선: 먼 미래.</p><p>의무 인장: 지정 전투·보급. 의무 외의 길도 선택할 수 있지만 파기 대가가 발생합니다.</p><p>배경 산수는 임시 벡터 행군도입니다. 지형 효과는 각 거점에 표시된 실제 지형을 따릅니다.</p>`;}
  if(this.drawer==='army'){title='군단과 무료 재배치';body=r.generals.map((g,i)=>{const d=GENERALS[g.id],next=g.row==='front'?'rear':'front',full=r.generals.filter(x=>x.row===next).length>=2;return `<article><h3>${d.name} · ${g.row==='front'?'전열':'후열'}</h3><p>${esc(d.ability)}</p><p>${d.row==='any'||d.row===g.row?'배치 조건 충족':'현재 배치에서 능력 미발동'}</p><p>전환 후: ${d.row==='any'||d.row===next?'배치 조건 충족':'능력 미발동'} · 해당 열 ${r.generals.filter(x=>x.row===next).length}/2명</p><button class="btn" data-a="map-swap" data-i="${i}" ${full?'disabled':''}>${next==='front'?'전열':'후열'}로 무료 전환</button></article>`;}).join('');}
  if(this.drawer==='accords'){title='협정·세력·원정 의무';body=`${list(Object.entries(r.social.relations).map(([id,n])=>`${FACTIONS[id as keyof typeof FACTIONS].name}: ${n<0?'적대':n===0?'중립':'우호'} ${n}`))}${r.social.passage?`<p>통행 협정: ${r.social.passage.moves}회, 이동 비용 −${r.social.passage.discount}</p>`:''}${r.social.support?`<p>다음 전투 지원: 방비 ${r.social.support.block} · 적 피해 ${r.social.support.damage} · 카드 보상 선택지 −${r.social.support.rewardPenalty}</p>`:''}${r.social.accords.agreements.map(a=>`<article><h3>${CLAUSES[a.clause].name} · ${{active:'진행 중',fulfilled:'이행',broken:'파기',expired:'만료'}[a.status]}</h3><p>${esc(CLAUSES[a.clause].text)}</p><p>${a.target.floor+1}행군 ${a.target.col+1}번 목표 · ${a.supply?`${a.supply.floor+1}행군 ${a.supply.col+1}번 보급`:'보급 의무 없음'} · ${a.stage==='armed'?'지원 준비 완료':'의무 진행 중'}</p><p>예치금 ${a.deposit} · ${a.boosted?'강화 조건':'기본 조건'}</p>${a.status==='active'?activityButton('abandon-agreement','협정 포기 · 관계 −1·군량 −2·예치금 몰수',{choice:String(a.uid)}):''}</article>`).join('')}${list(r.debateBuild.obligations.map(o=>`${o.kind==='ration'?'군량 약속':'권한 약속'}: ${o.due+1}행군까지 · ${o.status==='active'?'진행 중':o.status==='fulfilled'?'이행':'파기'}`))}`;}
  if(this.drawer==='settings'){title='지도 설정';body=`${btn('contrast',this.contrast?'기본 대비로 전환':'고대비로 전환')}<p>경로 연출 속도</p>${(['normal','fast','off'] as const).map(v=>btn('motion',`${this.motion===v?'✓ ':''}${{normal:'보통',fast:'빠르게',off:'연출 끄기'}[v]}`,`data-value="${v}"`)).join('')}<p>키보드: Tab으로 탐색, 화살표로 이동 가능 거점 순회, Enter로 선택, Escape로 취소. 운영체제의 연출 감소 설정도 적용합니다.</p>`;}
  if(this.drawer==='records'){title='원정 기록';const filters={all:'전체',battle:'전투',debate:'설전',accord:'외교·협정',resource:'자원',growth:'성장',system:'시스템'};const kind=(s:string)=>/설전|논거|협상/.test(s)?'debate':/협정|호송|후원|관계|의무/.test(s)?'accord':/성장|교리|강화/.test(s)?'growth':/전투|대결|승리|패배/.test(s)?'battle':/군량|병력|보급|회복/.test(s)?'resource':'system';body=`<nav>${Object.entries(filters).map(([id,name])=>btn('filter',name,`data-value="${id}"`)).join('')}</nav>${list(r.history.filter(s=>this.filter==='all'||kind(s)===this.filter))}`;}
  return `<div class="atlas-overlay"><section class="atlas-drawer" data-map-drawer role="dialog" aria-modal="true" aria-label="${title}"><header><h2>${title}</h2>${btn('close','닫기')}</header>${body}</section></div>`;
 }
 private travelFlash(n:MapNode,oldFood:number,newFood:number,speed:'normal'|'fast',origin?:DOMRect,destination?:DOMRect){
  if(this.root.ownerDocument.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
  const flash=this.root.ownerDocument.createElement('div');flash.className='atlas-travel-flash';flash.dataset.speed=speed;flash.innerHTML=`<b>${n.floor+1}행군 진군 · 군량 ${oldFood} → ${newFood}</b><button class="btn">연출 건너뛰기</button>`;
  const journey=this.root.ownerDocument.createElement('div');journey.className='atlas-route-journey';journey.setAttribute('aria-hidden','true');
  if(origin?.width&&destination?.width){const a={x:origin.x+origin.width/2,y:origin.y+origin.height/2},b={x:destination.x+destination.width/2,y:destination.y+destination.height/2},path=curve(a,b);journey.innerHTML=`<svg viewBox="0 0 ${this.root.ownerDocument.defaultView!.innerWidth} ${this.root.ownerDocument.defaultView!.innerHeight}"><path d="${path}"/><g><path d="M0 16V-16h22l-5 7 5 7H0"/><animateMotion dur="${speed==='fast'?'.2s':'.6s'}" fill="freeze" path="${path}"/></g></svg>`;this.root.append(journey);}
  const clear=()=>{flash.remove();journey.remove();};flash.querySelector('button')!.onclick=clear;this.root.append(flash);setTimeout(clear,speed==='fast'?250:700);
 }
}
