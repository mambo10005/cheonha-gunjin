import {OFFICERS,PERSONAL_CARDS,RELATION_NAMES} from '../data/personnel.ts';
import {RAISING_CARDS} from '../data/raising.ts';
import type {RunState} from './types.ts';
import type {LibraryCard,PersonnelActivity,OfficerRecord} from './personnel-types.ts';
import type {RaisingCard,RaisingOperation} from './raising-types.ts';
export const personnelOf=(r:RunState)=>r.campaign?.personnel;
export const isRecruited=(o:OfficerRecord)=>['recruited','valued','core'].includes(o.relationship);
export function contactCardAllowed(r:RunState,c:RaisingCard){const p=personnelOf(r),q=r.campaign?.world?.raising,l=p?.library.find(l=>l.uid===c.personnelCard);return !!(p&&q&&l?.owners.includes(p.encounters[q.node!])&&l.ownerType==='temporary');}
export function officerLocation(r:RunState,id:string):string {
 const c=r.campaign!,p=c.personnel,o=p?.officers[id];if(o&&o.duty!=='available')return ({rest:'휴식',mission:'임무 수행',moving:'이동 중',injured:'부상',captive:'포로',departed:'이탈',rival:'타 세력'} as const)[o.duty];
 if(c.world?.stage==='preparing')return id===p?.protagonistId||p?.party.includes(id)?'주인공 동행':'현지 협력·대기';
 const city=Object.values(c.cities).find(c=>Object.values(c!.roles).includes(id));if(city)return `${({xingyang:'형양',chenggao:'성고',gong:'공현'})[city.id]} 도시 근무`;
 return r.generals.some(g=>g.id===id)?(c.world?.operation?'원정 군단':'군단 후보'):'대기';
}
export function personnelAvailability(r:RunState,c:LibraryCard,activity:PersonnelActivity,cityId?:string):string|null {
 const p=personnelOf(r);if(!p)return null;const q=r.campaign!.world!.raising!;
 if(c.spent)return '사용 기한이 끝난 카드';if(!c.activities.includes(activity))return '이 활동용 카드가 아닙니다';
 if(c.expires!==null&&(q.converted||q.step>c.expires))return '임시 지원 기한 종료';
 if(c.ownerType==='city'&&activity==='admin'&&cityId!==c.sourceId)return '시작 도시 전용';
 for(const id of c.owners){if(id===p.protagonistId){if(activity==='raising')continue;}else{const o=p.officers[id];if(!o||o.duty!=='available')return '소유 인재가 활동할 수 없습니다';if(!isRecruited(o)&&c.ownerType!=='temporary')return '정식 등용 필요';}
  if(activity==='raising'){if(id!==p.protagonistId&&!p.party.includes(id))return '동행 인재 슬롯에 없음';}
  else if(activity==='admin'){if(!cityId||!Object.values(r.campaign!.cities[cityId as 'xingyang']?.roles??{}).includes(id))return '이 도시에 근무하지 않음';}
  else if(!r.generals.some(g=>g.id===id))return '현재 군단에 참여하지 않음';
 }
 return null;
}
export function personnelCost(r:RunState,c:LibraryCard){const p=personnelOf(r)!;return Math.max(0,...c.owners.map(id=>{const o=p.officers[id];return o?(o.loyalty<40?1:0)+(o.fatigue>=4?1:0):0;}));}
export function personnelCardDetails(r:RunState,c:RaisingCard):string {
 const p=personnelOf(r),l=p?.library.find(l=>l.uid===c.personnelCard);if(!p||!l)return '';
 if(!l.owners.length)return `${l.ownerType==='city'?'도시':'세력 공용'} · ${l.expires===null?'보관함 유지':'거병 종료 시 기한 만료'}`;
 return l.owners.map(id=>{const o=p.officers[id];return o?`${OFFICERS[id].name} · ${RELATION_NAMES[o.relationship]} · 신뢰 ${o.trust} / 충성 ${o.loyalty} · 경험 ${o.xp} · 피로 ${o.fatigue} · ${officerLocation(r,id)}${o.loyalty<40?' · 준비력 +1':''}${o.trust<40?' · 사용 시 자금 1·채무 1':''}`:'주인공 개인 카드';}).join(' / ');
}
export function raisingFateText(r:RunState,c:RaisingCard){const l=personnelOf(r)?.library.find(l=>l.uid===c.personnelCard);return l?.ownerType==='temporary'?'거병 종료 시 만료 · 해금한 정식 카드는 별도 보관':l?.sourceType==='city'?'시작 도시의 내정 카드로 유지':l?.sourceType==='officer'||l?.sourceType==='joint'?'소유 인재 보관함 유지 · 활동별 선택 편성':RAISING_CARDS[c.id].fate.text;}
export function personnelBeforePlay(r:RunState,c:RaisingCard):string|null {const p=personnelOf(r),l=p?.library.find(l=>l.uid===c.personnelCard);if(!p||!l)return null;const reason=personnelAvailability(r,l,'raising');if(reason)return reason;if(l.owners.some(id=>p.officers[id]?.trust<40)&&r.campaign!.world!.preparation.funds<1)return '조건부 협력: 자금 1이 필요합니다';return null;}
export function personnelExtraCost(r:RunState,c:RaisingCard){const p=personnelOf(r),l=p?.library.find(l=>l.uid===c.personnelCard);return p&&l?personnelCost(r,l):0;}
/** Typed operations use the same raising effect resolver as every other source. No recursive triggers. */
export function personnelAfterPlay(r:RunState,c:RaisingCard):RaisingOperation[] {
 const p=personnelOf(r),l=p?.library.find(l=>l.uid===c.personnelCard),q=r.campaign?.world?.raising;if(!p||!q||!l)return [];
 const ops:RaisingOperation[]=[];p.stats.plays[l.id]=(p.stats.plays[l.id]??0)+1;if(l.sourceType==='joint')p.stats.jointPlays++;
 if(l.owners.some(id=>p.officers[id]?.trust<40)){ops.push({kind:'resource',field:'funds',amount:-1},{kind:'resource',field:'debt',amount:1});q.log.push('조건부 지원: 자금 1·채무 1을 지불합니다. 기본 효과는 확정입니다.');}
 for(const id of p.party){const o=p.officers[id];if(OFFICERS[id].opposedCards.includes(c.id)){o.trust=Math.max(0,o.trust-10);o.events.push(RAISING_CARDS[c.id].name+' 반대: 신뢰 −10, 카드 기본 효과는 실행');q.log.push(OFFICERS[id].name+'의 반대: 신뢰 −10');}}
 p.stats.loyaltyCosts+=personnelCost(r,l);
 for(const id of l.owners){const o=p.officers[id],d=OFFICERS[id];if(!o)continue;p.stats.officerPlays??={};p.stats.officerPlays[id]=(p.stats.officerPlays[id]??0)+1;o.proof=true;o.xp=Math.min(99,o.xp+1);o.fatigue=Math.min(6,o.fatigue+1);o.trust=Math.min(100,o.trust+5);if(o.relationship==='cooperating'&&o.trust>=45)o.relationship='trusted';
  if(o.loyalty>=75)ops.push({kind:'resource',field:'support',amount:1});
  const key='person:'+id;if(q.uses[key]||RAISING_CARDS[c.id].family!==d.family)continue;q.uses[key]=1;
  const effects:Record<typeof d.principle,RaisingOperation[]>={refund:[{kind:'power',amount:1}],cycle:[{kind:'draw',amount:1}],reveal:[{kind:'reveal',amount:1}],shelter:[{kind:'resource',field:'exposure',amount:-2}],credit:[{kind:'resource',field:'funds',amount:1},{kind:'resource',field:'debt',amount:1}]};ops.push(...effects[d.principle]);q.log.push(`${d.name} · ${d.principleText} (장소당 1회)`);
 }
 return ops;
}
export function discoverPersonnel(r:RunState){const p=personnelOf(r),q=r.campaign?.world?.raising;if(!p||!q)return;const id=p.encounters[q.node!],o=p.officers[id];if(o&&o.information<2){o.information=2;o.relationship='contact';o.events.push('도시 탐색에서 직접 만남');p.record.push(`${OFFICERS[id].name}와 첫 만남`);}for(const o of Object.values(p.officers))o.fatigue=Math.max(0,o.fatigue-1);}
export function revealPersonnel(r:RunState){const p=personnelOf(r),q=r.campaign?.world?.raising;if(!p||!q)return;for(const n of q.route.slice(q.step,q.step+2).flat())if(n.open){const o=p.officers[p.encounters[n.id]];if(o)o.information=Math.max(1,o.information);}}
export function captureRaisingLibrary(r:RunState){const p=personnelOf(r),q=r.campaign?.world?.raising;if(!p||!q)return;
 for(const c of q.cards){let l=p.library.find(l=>l.uid===c.personnelCard);if(!l){l={uid:p.nextUid++,id:c.id,sourceType:'event',sourceId:q.node??'start',ownerType:RAISING_CARDS[c.id].family==='promise'?'promise':'faction',owners:[],activities:['raising'],expires:null,spent:false};p.library.push(l);c.personnelCard=l.uid;}if(c.upgrade)l.upgrade=c.upgrade;else delete l.upgrade;if(c.mod)l.mod=c.mod;else delete l.mod;l.raisingExhausted=q.exhaust.includes(c.uid);}
 p.loadouts.raising=q.cards.map(c=>c.personnelCard!);p.revision++;
}
export function syncRaisingLoadout(r:RunState){const p=personnelOf(r)!,q=r.campaign!.world!.raising!;if(!['map','plan'].includes(q.phase))return;
 const wanted=p.loadouts.raising.map(uid=>p.library.find(c=>c.uid===uid)!).filter(c=>c&&!personnelAvailability(r,c,'raising'));const wantedIds=new Set(wanted.map(c=>c.uid));
 q.cards=q.cards.filter(c=>wantedIds.has(c.personnelCard!));const ids=new Set(q.cards.map(c=>c.uid));for(const pile of ['draw','hand','discard','exhaust'] as const)q[pile]=q[pile].filter(uid=>ids.has(uid));
 for(const l of wanted){const old=q.cards.find(c=>c.personnelCard===l.uid);if(old){old.id=l.id;if(l.upgrade)old.upgrade=l.upgrade;else delete old.upgrade;if(l.mod)old.mod=l.mod;else delete old.mod;}else{const c={uid:q.nextUid++,id:l.id,personnelCard:l.uid,...(l.upgrade?{upgrade:l.upgrade}:{}),...(l.mod?{mod:l.mod}:{})};q.cards.push(c);(l.raisingExhausted?q.exhaust:q.discard).push(c.uid);}}
}
export function conversionFor(l:LibraryCard,activity:PersonnelActivity):string|undefined {if(l.sourceType==='city')return activity==='admin'?({xingyang:'survey',chenggao:'patrol',gong:'permit'} as Record<string,string>)[l.sourceId]:undefined;const d=PERSONAL_CARDS[l.id];if(d)return activity==='raising'?l.id:activity==='admin'?d.admin:activity==='combat'?d.combat:d.debate;const f=RAISING_CARDS[l.id]?.fate;return f?.kind===activity?f.id:undefined;}
/** Remove only projections; unselected cards and ownership stay in the library. Existing piles are never reset. */
export function syncPersonnelDecks(r:RunState){const p=personnelOf(r),camp=r.campaign;if(!p||!camp?.world?.raising?.converted)return;
 const desired=(a:PersonnelActivity,city?:string)=>p.loadouts[a].map(uid=>p.library.find(c=>c.uid===uid)!).filter(l=>l&&!personnelAvailability(r,l,a,city)&&conversionFor(l,a));
 for(const a of ['combat','debate'] as const){const deck=a==='combat'?r.deck:r.debateBuild.cards;const wanted=desired(a),ids=new Set(wanted.map(c=>c.uid));const removed=deck.filter(c=>c.personnelCard!==undefined&&!ids.has(c.personnelCard));for(const c of removed)deck.splice(deck.indexOf(c),1);
  for(const l of wanted){const old=deck.find(c=>c.personnelCard===l.uid);if(old){old.personnelCost=personnelCost(r,l);continue;}if(deck.length>=(a==='debate'?20:40))continue;deck.push({uid:a==='combat'?r.nextUid++:r.debateBuild.nextUid++,id:conversionFor(l,a)!,personnelCard:l.uid,personnelOwners:[...l.owners],personnelCost:personnelCost(r,l)});}
 }
 for(const city of Object.values(camp.cities)){if(!city)continue;const wanted=desired('admin',city.id),ids=new Set(wanted.map(c=>c.uid));city.cards=city.cards.filter(c=>c.personnelCard===undefined||ids.has(c.personnelCard));const remaining=new Set(city.cards.map(c=>c.uid));for(const pile of ['draw','hand','discard','exhaust'] as const)city[pile]=city[pile].filter(uid=>remaining.has(uid));
  for(const l of wanted){const old=city.cards.find(c=>c.personnelCard===l.uid);if(old){old.personnelCost=personnelCost(r,l);continue;}const uid=city.nextUid++;city.cards.push({uid,id:conversionFor(l,'admin')!,upgrade:!!l.upgrade,mod:'none',...(l.owners[0]?{owner:l.owners[0]}:{}),personnelCard:l.uid,personnelOwners:[...l.owners],personnelCost:personnelCost(r,l)});city.discard.push(uid);}
 }
}
export function personnelDiplomacy(r:RunState){const p=personnelOf(r),w=r.campaign?.world;if(!p||!w)return;
 for(const uid of p.loadouts.diplomacy.slice(0,2)){const l=p.library.find(c=>c.uid===uid)!,key=`diplomacy:${w.turn}:${uid}`;if(!l||personnelAvailability(r,l,'diplomacy')||p.claims.includes(key))continue;p.claims.push(key);w.neutral.trust++;w.history.push(`${w.turn}턴 · ${RAISING_CARDS[l.id].name}: 외교 지원으로 상단 신뢰 +1 (턴당 카드 1회·최대 2장)`);p.stats.plays[l.id]=(p.stats.plays[l.id]??0)+1;for(const id of l.owners){const o=p.officers[id];if(o){p.stats.officerPlays??={};p.stats.officerPlays[id]=(p.stats.officerPlays[id]??0)+1;o.xp=Math.min(99,o.xp+1);o.events.push('외교 지원 참여');}}}p.claims=p.claims.slice(-180);p.revision++;
}
export function recordPersonnelUse(r:RunState,uid:number,count=1){const p=personnelOf(r),l=p?.library.find(l=>l.uid===uid);if(!p||!l)return;p.stats.plays[l.id]=(p.stats.plays[l.id]??0)+count;for(const id of l.owners){const o=p.officers[id];if(o){p.stats.officerPlays??={};p.stats.officerPlays[id]=(p.stats.officerPlays[id]??0)+count;o.xp=Math.min(99,o.xp+count);o.proof=true;}}p.revision++;}
export function personnelPreviewText(before:RunState,after:RunState){const p=personnelOf(before),next=personnelOf(after);if(!p||!next)return '';return Object.keys(p.officers).filter(id=>p.officers[id].trust!==next.officers[id].trust||p.officers[id].fatigue!==next.officers[id].fatigue||p.officers[id].xp!==next.officers[id].xp).map(id=>`${OFFICERS[id].name}: 신뢰 ${p.officers[id].trust} → ${next.officers[id].trust}, 경험 ${p.officers[id].xp} → ${next.officers[id].xp}, 피로 ${p.officers[id].fatigue} → ${next.officers[id].fatigue}`).join(' / ');}
