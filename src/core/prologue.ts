import {OFFICERS,PROTAGONISTS,JOINT_CARDS,PERSONAL_CARDS} from '../data/personnel.ts';
import {RAISING_CARDS,ORIGINS} from '../data/raising.ts';
import {GENERALS} from '../data/generals.ts';
import {shuffle} from './rng.ts';
import {configureStart} from './world.ts';
import {startRaising,raisingOf} from './raising.ts';
import {personnelOf,isRecruited,syncRaisingLoadout,syncPersonnelDecks,personnelAvailability,conversionFor,captureRaisingLibrary} from './personnel-rules.ts';
import {explorationOf,exploreAction} from './city-exploration.ts';
import {deckAddReason,talentGrowth} from './card-engine.ts';
import {TALENTS} from '../data/talents.ts';
import type {RunState} from './types.ts';
import type {Result} from './run.ts';
import type {CityId} from './city-types.ts';
import type {RaisingOrigin} from './raising-types.ts';
import type {LibraryCard,PersonnelActivity,PersonnelState} from './personnel-types.ts';
const ok:Result={ok:true},no=(reason:string):Result=>({ok:false,reason});
const add=(p:PersonnelState,card:Omit<LibraryCard,'uid'|'spent'>)=>{const l={...card,uid:p.nextUid++,spent:false};p.library.push(l);return l;};
function grant(r:RunState,id:string,owner:string,temporary=false){const p=personnelOf(r)!,q=raisingOf(r)!;const exists=p.library.find(c=>c.id===id&&c.owners.includes(owner));if(exists)return exists;return add(p,{id,sourceType:'officer',sourceId:owner,ownerType:temporary?'temporary':'personal',owners:[owner],activities:[...PERSONAL_CARDS[id].activities],expires:temporary?q.length:null});}
export function startPrologue(r:RunState,city:CityId,protagonist:string,origin:RaisingOrigin):Result {
 if(!Object.hasOwn(PROTAGONISTS,protagonist)||!ORIGINS[origin]||r.campaign?.personnel)return no('주인공과 출신을 확인하세요.');
 const c=configureStart(r,city,'wanderer',protagonist as 'chengong','people','network');if(!c.ok)return c;const started=startRaising(r,origin,'guard');if(!started.ok)return started;
 const q=raisingOf(r)!,w=r.campaign!.world!,p:PersonnelState={version:1,protagonistId:protagonist,background:origin,goal:PROTAGONISTS[protagonist as keyof typeof PROTAGONISTS].goal,record:['주인공 홀로 도시 탐색 시작'],officers:{},encounters:{},party:[],library:[],nextUid:1,loadouts:{raising:[],combat:[],debate:[],admin:[],diplomacy:[]},representative:null,assistant:null,refined:false,doctrine:null,jointEvents:[],claims:[],revision:0,turn:0,stats:{recruits:0,equips:{},plays:{},excluded:0,growth:{},jointPlays:0,loyaltyCosts:0}};
 r.campaign!.personnel=p;q.allies=[];q.assistant='';q.schemes=[];q.influence=0;q.log=['도시 탐색: 아직 거병 대표·보좌·교리를 정하지 않았습니다.'];q.cards=[];q.draw=[];q.discard=[];q.nextUid=1;
 w.preparation.funds=4;w.preparation.food=city==='xingyang'?12:10;w.preparation.troops=origin==='militia'?6:2;w.preparation.exposure=0;w.diplomacy.obligation=0;
 const cityCard=city==='xingyang'?'cache':city==='chenggao'?'gate':'wagon';
 const basics=['manifesto','coin','clues','food',ORIGINS[origin].cards[0],cityCard,ORIGINS[origin].burden];
 for(const [i,id] of basics.entries()){const l=add(p,{id,sourceType:i===5?'city':'protagonist',sourceId:i===5?city:protagonist,ownerType:i===5?'city':'personal',owners:i===5?[]:[protagonist],activities:['raising'],expires:null});p.loadouts.raising.push(l.uid);}
 for(const o of Object.values(OFFICERS))p.officers[o.id]={id:o.id,information:0,relationship:'unknown',trust:protagonist==='chengong'?30:25,loyalty:50,xp:0,fatigue:0,task:false,proof:false,cooperation:null,growth:null,duty:'available',until:0,events:[]};
 // Every run has all eight people distributed across eighteen seeded places. Names stay sealed until contact.
 const order=shuffle(q,Object.keys(OFFICERS));for(const [i,n] of q.route.flat().entries()){const id=order[i%order.length],d=OFFICERS[id];n.kind=d.places[Math.floor(i/8)%d.places.length];p.encounters[n.id]=id;}
 syncRaisingLoadout(r);q.draw=shuffle(q,q.discard.splice(0));q.revision++;return ok;
}
export function prologueAction(r:RunState,action:string,revision:number,cityCommand=false):Result {
 const p=personnelOf(r),q=raisingOf(r),w=r.campaign?.world;if(!p||!q||!w||p.revision!==revision)return no('이미 처리한 인재 입력입니다.');
 const cityExploration=explorationOf(r);if(cityExploration&&!cityExploration.converted&&!cityCommand)return exploreAction(r,'officer:'+action,cityExploration.revision);
 const [kind,id,arg]=action.split(':'),o=p.officers[id],d=OFFICERS[id],nodePerson=p.encounters[q.node!];
 const exploration=r.campaign!.cities[w.startCity]?.exploration;
 if(exploration&&!exploration.converted){
  if(kind==='task'&&['xunyu','dianwei','lusu'].includes(id))return no('객사 의뢰의 수락·조사·해결·귀환 보고가 필요합니다.');
  if(kind==='party')return no('도시 지도에서 동행 슬롯을 편성하세요.');
  if(['task','cooperate','recruit'].includes(kind)&&(!['location','result'].includes(exploration.scene)||exploration.sightings[id]?.location!==exploration.location||o?.duty!=='available'))return no('같은 도시 장소에서 활동 가능한 인재와 만나세요.');
  if(kind==='cooperate'&&arg==='card'&&!exploration.companions.includes(id)&&exploration.companions.length>=exploration.companionSlots)return no(`도시 동행 슬롯 ${exploration.companionSlots}명입니다. 관계 협력 또는 동행 변경을 선택하세요.`);
 }
 const stage=w.stage==='preparing',safe=stage?['map','plan'].includes(q.phase):w.stage==='strategy'&&!w.operation;
 if(['task','cooperate','recruit'].includes(kind)){
  if(!stage||q.phase!=='node'||!o||id!==nodePerson||o.information<2||isRecruited(o))return no('탐색 장소에서 만난 인재와만 협력할 수 있습니다.');
  if(kind==='task'){if(o.task||q.power<1||w.preparation[d.task.resource]<d.task.cost)return no('부탁은 한 번만 수행합니다. 준비력 1과 표시된 자원이 필요합니다.');q.power--;w.preparation[d.task.resource]-=d.task.cost;o.task=true;o.information=3;o.trust=Math.min(100,o.trust+15);o.events.push('부탁 수행: '+d.task.text);q.progress++;}
  if(kind==='cooperate'){if(!o.task||o.cooperation||!['card','relation','decline'].includes(arg))return no('부탁을 해결한 뒤 협력 방식을 한 번 선택하세요.');if(arg==='card'&&!q.engine&&q.cards.length>=14)return no('거병 덱 14장 한도입니다. 카드 대신 관계를 선택하거나 다음 장소 전에 편성을 줄이세요.');if(arg==='card'&&p.party.length>=3)return no('동행 슬롯 3명입니다. 다음 경로에서 편성을 조정하세요.');o.cooperation=arg as 'card';o.relationship=arg==='decline'?'contact':arg==='relation'?'trusted':'cooperating';if(arg==='relation'){o.trust=Math.min(100,o.trust+15);o.proof=true;}if(arg==='card'){if(!p.party.includes(id))p.party.push(id);const l=grant(r,d.support,id,true);if(!q.engine||!deckAddReason(r,l)){p.loadouts.raising.push(l.uid);const c={uid:q.nextUid++,id:l.id,personnelCard:l.uid};q.cards.push(c);(q.hand.length<8?q.hand:q.discard).push(c.uid);}}}
  if(kind==='recruit'){if(!o.task||!o.proof||o.trust<45||!['a','b'].includes(arg)||w.preparation.funds<1)return no('등용: 부탁 수행 + 실제 지원 사용 또는 관계 선택 + 신뢰 45 + 자금 1. 고유 카드 한 장을 선택하세요.');w.preparation.funds--;o.relationship='recruited';o.information=4;o.loyalty=60;p.stats.recruits++;grant(r,d.roles[0],id);grant(r,d.unique[arg==='a'?0:1],id);if(!r.campaign!.roster.includes(id)){r.campaign!.roster.push(id);w.reserveOfficers.push(id);}const candidate=w.candidates.find(c=>c.id===id);if(candidate)candidate.recruited=true;o.events.push('등용: 개인 카드 두 장을 보관함에 해금, 덱 편성은 별도');}
 }else if(kind==='equip'){
  const activity=arg as PersonnelActivity,l=p.library.find(c=>c.uid===Number(id));if(!safe||!l||!Object.hasOwn(p.loadouts,activity)||!l.activities.includes(activity)||l.spent)return no('활동 사이에 해금 카드를 편성하세요.');
  const deck=p.loadouts[activity],index=deck.indexOf(l.uid);if(index>=0){if(activity==='raising'&&deck.length<=6)return no('거병 덱은 최소 6장입니다.');deck.splice(index,1);p.stats.excluded++;}
  else{if(activity==='raising'&&personnelAvailability(r,l,activity))return no(personnelAvailability(r,l,activity)!);if(activity==='raising'&&q.engine){const reason=deckAddReason(r,l);if(reason)return no(reason);}else if(deck.length>=(activity==='raising'?14:6))return no('거병 14장·기타 활동 개인 슬롯 6장입니다.');if(l.owners.some(owner=>owner!==p.protagonistId&&deck.filter(uid=>p.library.find(c=>c.uid===uid)?.owners.includes(owner)).length>=2))return no('인재별 활동 카드 한도는 2장입니다.');deck.push(l.uid);p.stats.equips[l.id]=(p.stats.equips[l.id]??0)+1;p.stats.officerEquips??={};for(const owner of l.owners)p.stats.officerEquips[owner]=(p.stats.officerEquips[owner]??0)+1;}
 }else if(kind==='party'){
  if(!safe||!stage||!o||!isRecruited(o))return no('탐색 사이에 등용 인재를 편성하세요.');if(p.party.includes(id)){const removed=p.loadouts.raising.filter(uid=>p.library.find(c=>c.uid===uid)?.owners.includes(id));if(p.loadouts.raising.length-removed.length<6)return no('최소 거병 덱 6장을 유지하세요.');p.party=p.party.filter(v=>v!==id);p.loadouts.raising=p.loadouts.raising.filter(uid=>!removed.includes(uid));}else{if(p.party.length>=3)return no('동행 인재는 최대 3명입니다.');p.party.push(id);}
 }else if(kind==='growth'&&TALENTS[id]&&q.engine&&['add','upgrade','replace','principle'].includes(arg)){
  if(!safe&&!(exploration&&!exploration.converted)||!o||!isRecruited(o)||o.xp<2||o.growth)return no('경험 2 이상 등용 인재의 성장은 한 번 선택합니다.');const grown=talentGrowth(r,id,arg);if(!grown.ok)return grown;
 }else if(kind==='growth'){
  if(!safe||!o||!isRecruited(o)||o.xp<2||o.growth||!['expert','authority'].includes(arg))return no('경험 2 이상 인재의 성장 분기를 한 번 선택하세요.');o.growth=arg as 'expert';o.relationship=arg==='authority'?'core':'valued';o.loyalty=Math.min(100,o.loyalty+10);p.stats.growth[arg]=(p.stats.growth[arg]??0)+1;
  const l=p.library.find(c=>c.id===d.roles[0]&&c.owners.includes(id));if(l){l.id=d.roles[1];l.upgrade=arg==='expert'?'quiet':'bold';}if(arg==='authority'){if(!q.pledges.includes('authority'))q.pledges.push('authority');const city=r.campaign!.cities[r.campaign!.active!];if(city&&!city.promises.some(x=>x.id==='authority'))city.promises.push({id:'authority',due:city.phase+2,status:'active'});}else o.fatigue=Math.max(0,o.fatigue-2);o.events.push(arg==='expert'?'숙련: 역할 카드 교체·정론 강화·피로 2 감소':'권한: 역할 카드 교체·광포 강화·권한 의무');
 }else if(kind==='joint'){
  const j=JOINT_CARDS.find(j=>j.id===id);if(!safe||!stage||!j||p.jointEvents.includes(id)||w.preparation.food<2||!j.owners.every(owner=>p.party.includes(owner)&&isRecruited(p.officers[owner])&&p.officers[owner].trust>=45&&p.officers[owner].proof))return no('합동 사건: 두 등용 인재 동행·각 신뢰 45·협력 실적·군량 2가 필요합니다.');
  w.preparation.food-=2;p.jointEvents.push(id);for(const owner of j.owners){p.officers[owner].events.push(j.name+' 공동 사건 해결');p.officers[owner].xp=Math.min(99,p.officers[owner].xp+1);}add(p,{id:j.id,sourceType:'joint',sourceId:j.id,ownerType:'personal',owners:[...j.owners],activities:[...PERSONAL_CARDS[id].activities],expires:null});
 }else if(kind==='refine'){
  const l=p.library.find(c=>c.uid===Number(id));if(!stage||q.phase!=='plan'||p.refined||!l||l.upgrade)return no('최종 정제에서 아직 강화하지 않은 카드 한 장을 한 번 강화합니다.');l.upgrade='quiet';p.refined=true;
 }else if(kind==='elect'){
  const eligible=[p.protagonistId,...p.party.filter(id=>isRecruited(p.officers[id])||p.officers[id].relationship==='trusted')];if(!stage||q.phase!=='plan'||!eligible.includes(id)||arg!==''&&(!eligible.includes(arg)||arg===id))return no('최종 계획에서 참가 인물 중 서로 다른 대표·보좌를 고르세요.');p.representative=id;p.assistant=arg||null;q.representative=id;
 }else if(kind==='doctrine'){
  if(q.phase!=='result'||p.doctrine||!['people','law','strategy'].includes(id))return no('거병 성공 후 정식 교리를 한 번 정하세요.');p.doctrine=id as 'people';w.doctrine=p.doctrine;for(const officer of Object.values(p.officers).filter(isRecruited)){const agreement=(id==='strategy')===(OFFICERS[officer.id].family==='military');officer.loyalty=Math.max(0,Math.min(100,officer.loyalty+(agreement?10:-10)));officer.events.push('세력 교리에 대한 충성 '+(agreement?'+10':'−10'));}
 }else if(kind==='release'){
  if(stage||!safe||!o||!isRecruited(o)||!w.reserveOfficers.includes(id))return no('대기 중인 등용 인재만 협력을 끝낼 수 있습니다.');o.relationship='departed';o.duty='departed';if(w.personalDebate)delete w.personalDebate[id];if(w.officerBranches)delete w.officerBranches[id];r.campaign!.roster=r.campaign!.roster.filter(v=>v!==id);w.reserveOfficers=w.reserveOfficers.filter(v=>v!==id);p.party=p.party.filter(v=>v!==id);p.record.push(d.name+' 협력 종료: 개인 카드는 기록으로 보존, 모든 활동에서 비활성');
 }else if(kind==='duty'){
  if(stage||!safe||!o||!isRecruited(o)||!w.reserveOfficers.includes(id)||!['rest','mission','available'].includes(arg)||o.duty!=='available'&&arg!=='available')return no('대기 인재만 휴식·탐문 임무에 보낼 수 있습니다.');if(arg==='available'){if(w.turn<o.until)return no('진행 중인 임무·휴식은 이번 턴을 마쳐야 합니다.');o.duty='available';}else{if(w.ap<1)return no('전략 행동력 1이 필요합니다.');w.ap--;o.duty=arg as 'rest';o.until=w.turn+1;}
 }else return no('없는 인재 명령입니다.');
 p.revision++;q.revision++;if(safe&&stage)syncRaisingLoadout(r);if(!stage)syncPersonnelDecks(r);return ok;
}
export function finalizePersonnel(r:RunState){const p=personnelOf(r),q=raisingOf(r),c=r.campaign;if(!p||!q||!c)return;captureRaisingLibrary(r);
 for(const l of p.library){if(l.ownerType==='temporary'){l.spent=true;continue;}const d=PERSONAL_CARDS[l.id];if(l.sourceType==='city')l.activities=['admin'];else if(d)l.activities=[...d.activities];else{const f=RAISING_CARDS[l.id].fate;if(['admin','combat','debate'].includes(f.kind)){l.activities=[f.kind as PersonnelActivity];if(l.sourceType==='protagonist')l.ownerType='personal';}else l.activities=[];}
  // Keep loadout decisions per activity explicit. No automatic officer card conversion.
  if(!d)for(const a of l.activities)if(a!=='raising'&&conversionFor(l,a)&&p.loadouts[a].length<6)p.loadouts[a].push(l.uid);
 }
 const policyMap:Record<string,string>={people:'granary',shadow:'merchants',oath:'training',door:'relay',letters:'settlement',camp:'curfew',relay:'relay',unity:'settlement'};const city=c.cities[c.active!];if(city)for(const scheme of q.schemes){const id=policyMap[scheme];if(id&&city.policies.length<2&&!city.policies.some(p=>p.id===id)){city.policies.push({id,remaining:3});q.result.push('거병 책략 → 첫 도시의 3턴 정책 (담당 근무 필요)');}}
 const w=c.world!;for(const id of p.party){if(!isRecruited(p.officers[id]))continue;const row=GENERALS[id].row==='rear'?'rear':'front';if(!r.generals.some(g=>g.id===id)&&r.generals.length<4&&r.generals.filter(g=>g.row===row).length<2){r.generals.push({id,row});w.reserveOfficers=w.reserveOfficers.filter(v=>v!==id);}}
 p.record.push(`거병 ${q.grade}: 인재 ${p.stats.recruits}명·합동 사건 ${p.jointEvents.length}·의무 ${q.pledges.length}`);p.turn=w.turn;p.revision++;syncPersonnelDecks(r);
}
export function personnelTurn(r:RunState){const p=personnelOf(r),w=r.campaign?.world;if(!p||!w||p.turn>=w.turn)return;p.turn=w.turn;for(const o of Object.values(p.officers)){if(o.until<=w.turn){if(o.duty==='rest'){o.fatigue=0;o.loyalty=Math.min(100,o.loyalty+5);o.duty='available';}else if(o.duty==='mission'){w.prestige+=1;o.xp=Math.min(99,o.xp+1);o.duty='available';o.events.push('탐문 임무 완료: 명망 +1·경험 +1');}}}p.revision++;syncPersonnelDecks(r);}
export function resetPersonnelRoute(r:RunState){const p=personnelOf(r),q=raisingOf(r);if(!p||!q)return;const next:Record<string,string>={};for(const [i,n] of q.route.flat().entries()){const suffix=n.id.split(':').slice(1).join(':'),old=Object.entries(p.encounters).find(([key])=>key.split(':').slice(1).join(':')===suffix),id=old?.[1]??Object.keys(OFFICERS)[i%8];next[n.id]=id;n.kind=OFFICERS[id].places[Math.floor(i/8)%OFFICERS[id].places.length];}p.encounters=next;p.revision++;}
