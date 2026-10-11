import {INN_AREAS,INN_GUESTS,INN_QUESTS,INN_TOPICS} from '../data/inn.ts';
import type {RunState} from './types.ts';
import type {Result} from './run.ts';
import type {InnState,InnQuestState,InnArea} from './inn-types.ts';
import {ensureLocationScene} from './location-scene.ts';
import type {ExplorationEffect,ExplorationSemanticType} from './city-exploration-types.ts';
const ok:Result={ok:true},no=(reason:string):Result=>({ok:false,reason});
const xof=(r:RunState)=>r.campaign!.cities[r.campaign!.active??r.campaign!.world!.startCity]!.exploration!;
export const innOf=(r:RunState)=>xof(r).inn;
export function createInnState(r:RunState):InnState {
 const quests:Record<string,InnQuestState>={};
 // Completed requests from older saves are receipts, never freshly paid rewards.
 for(const d of Object.values(INN_QUESTS))if(r.campaign!.personnel?.officers[d.giver]?.task)quests[d.id]={id:d.id,giver:d.giver,status:'completed',step:d.steps.length-1,acceptedAt:0,due:42,approaches:['legacy-receipt'],evidence:['legacy-receipt'],result:'complete',conclusion:'기존 저장의 해결 기록',reported:true,escrow:0};
 return {version:1,view:{kind:'overview'},area:'hall',trust:0,reputation:0,dialogue:'객사 주인이나 머무는 손님을 선택하세요.',heard:[],rumors:[],quests,visits:0,privateAccess:false,selectedItem:null,activity:null,claims:[],lodgedDays:[],arrivals:[],postTurn:-1,stats:{topics:0,rumors:0,accepted:0,reported:0,failures:0,lodgings:0,debates:0,duels:0}};
}
export function ensureInn(r:RunState){return xof(r).inn??=createInnState(r);}
export function innTopicAvailable(s:InnState,id:string){return !['officials','trade','soldiers','observe'].includes(id)||s.trust>=1;}
export function innPatrons(r:RunState):string[]{
 const x=xof(r),s=x.inn,p=r.campaign!.personnel!,active=Object.values(s?.quests??{}).filter(q=>['accepted','active','readyToReport'].includes(q.status)).map(q=>q.giver);
 const visit=s?.visits??0,selected=s?.view.kind==='conversation'?s.view.person:null;
 const base=x.location==='inn'&&x.scene!=='map'&&s?.arrivals.length?s.arrivals:['xunyu',visit>1||Math.floor(x.tick/6)%2?'lusu':'dianwei','merchant','traveler'];const ids=[...(selected&&selected!=='innkeeper'?[selected]:[]),...active,...base];
 return [...new Set(ids)].filter(id=>!p.officers[id]||!['departed','mission'].includes(p.officers[id].duty)).slice(0,5);
}
export function innEntered(r:RunState,h:InnHooks){const x=xof(r),s=ensureInn(r),scene=ensureLocationScene(x);scene.phase='overview';s.visits++;s.view={kind:'overview'};s.area='hall';s.selectedItem=null;s.dialogue=s.quests.recommendation?.status==='readyToReport'?'순욱이 안쪽 방에서 보고를 기다립니다.':'한복이 고개를 들어 맞이합니다. 오늘의 손님을 살펴보세요.';s.arrivals=[];s.arrivals=innPatrons(r);h.emit('innEntered','객사 입장 · 손님과 소개, 숙박, 의뢰를 직접 선택합니다.');for(const id of s.arrivals)h.emit('patronArrived',INN_GUESTS[id].name+' · '+INN_AREAS[INN_GUESTS[id].area].name);}
export interface InnHooks {advance:(time:number)=>void;emit:(type:ExplorationSemanticType,text:string)=>void;effects:(effect:ExplorationEffect,source:string)=>void;social:(event:string,kind:'debate'|'duel')=>void;card:(uid:number)=>Result;}
function afford(r:RunState,time:number,funds=0,food=0):Result {const x=xof(r),w=r.campaign!.world!;if(x.converted){if(time&&r.campaign!.cities[x.cityId]!.ap<1)return no('객사 활동에 행정력 1이 필요합니다.');if(w.treasury<funds||r.campaign!.cities[x.cityId]!.food<food)return no('객사 비용이 부족합니다.');}else if(x.tick+time>x.budget)return no('남은 준비 시간이 부족합니다.');else if(w.preparation.funds<funds||w.preparation.food<food)return no('표시된 자금·군량이 부족합니다.');return ok;}
function pay(r:RunState,h:InnHooks,time:number,funds=0,food=0){const x=xof(r),w=r.campaign!.world!;if(x.converted){if(time)r.campaign!.cities[x.cityId]!.ap--;w.treasury-=funds;r.campaign!.cities[x.cityId]!.food-=food;}else{w.preparation.funds-=funds;w.preparation.food-=food;h.advance(time);}}
export function syncInn(r:RunState,h:InnHooks){const x=xof(r),s=x.inn;if(!s||x.converted)return;for(const q of Object.values(s.quests))if(['accepted','active','readyToReport'].includes(q.status)&&x.tick>q.due){q.status='expired';q.result='failure';s.stats.failures++;s.reputation=Math.max(-5,s.reputation-1);h.emit('questExpired',INN_QUESTS[q.id].title+' · 기한 만료, 보상 없음');}}
export function questTarget(r:RunState){const s=innOf(r);return Object.values(s?.quests??{}).find(q=>['accepted','active','readyToReport'].includes(q.status));}
export function innQuestActions(r:RunState,q:InnQuestState){const d=INN_QUESTS[q.id],x=xof(r);if(!['accepted','active','readyToReport'].includes(q.status))return [];const step=d.steps[q.step];if(x.location!==step.location||!['location','result'].includes(x.scene))return [];return step.approaches;}
function advanceQuest(q:InnQuestState,h:InnHooks,approach:string){q.approaches.push(approach);q.step++;q.status=q.step===INN_QUESTS[q.id].steps.length-1?'readyToReport':'active';h.emit(q.status==='readyToReport'?'questReadyToReport':'questStepAdvanced',INN_QUESTS[q.id].title+' · '+INN_QUESTS[q.id].steps[q.step].objective);}
function eligiblePerson(r:RunState,id:string){return id==='innkeeper'||innPatrons(r).includes(id);}
export function handleInnAction(r:RunState,command:string,h:InnHooks):Result {
 const x=xof(r),s=ensureInn(r),w=r.campaign!.world!,q=w.raising!;
 const [kind,id,arg]=command.split(':');
 const atInn=x.location==='inn'&&['location','result'].includes(x.scene);
 if(['area','select','topic','offer','accept','report','lodge','observe','courtyard','overview','introduce','post-info'].includes(kind)&&!atInn)return no('객사에 직접 들어와 사람을 만나세요.');
 if(['debate','duel'].includes(x.scene))return no('진행 중인 설전·대결을 먼저 마치세요.');
 if(kind==='overview'){s.view={kind:'overview'};s.selectedItem=null;return ok;}
 if(kind==='area'){if(!Object.hasOwn(INN_AREAS,id))return no('없는 객사 구역입니다.');if(id==='private'&&!s.privateAccess)return no('주인 소개로 안쪽 방을 먼저 개방하세요.');s.area=id as InnArea;s.view={kind:'overview'};return ok;}
 if(kind==='select'){if(!eligiblePerson(r,id))return no('지금 머무는 인물을 선택하세요.');s.area=INN_GUESTS[id].area==='private'&&!s.privateAccess?'hall':INN_GUESTS[id].area;s.view={kind:'conversation',person:id,topic:'opening'};s.dialogue=INN_GUESTS[id].opening;h.emit(id==='innkeeper'?'innkeeperSelected':'patronSelected',INN_GUESTS[id].name+'과 대화를 시작했습니다.');return ok;}
 if(kind==='topic'){
  if(s.view.kind!=='conversation'||s.view.person!=='innkeeper'||!Object.hasOwn(INN_TOPICS,id))return no('객사 주인을 선택한 뒤 대화 주제를 고르세요.');
  const d=INN_TOPICS[id];s.dialogue=d.text;s.view.topic=id;
  if(!innTopicAvailable(s,id))return no('먼저 주인과 인사를 나누어 신뢰를 쌓으세요.');
  if(id==='jobs'){s.quests.lostletter??=offered('lostletter');s.view={kind:'offer',quest:'lostletter'};return ok;}if(id==='lodging'){s.view={kind:'lodging'};return ok;}if(id==='observe'){s.view={kind:'incident'};return ok;}
  if(id==='rumor'){s.view={kind:'rumors'};return ok;}
  if(s.heard.includes(id))return ok;
  const funds=id==='introduce'&&(s.trust>=2||x.items.some(i=>i.id==='letter'))?0:d.cost,c=afford(r,d.time,funds);if(!c.ok)return c;
  pay(r,h,d.time,funds);s.heard.push(id);s.stats.topics++;s.trust=Math.min(10,s.trust+(d.trust??0));
  if(id==='introduce'){s.privateAccess=true;h.emit('locationUnlocked','한복의 소개로 안쪽 방이 열렸습니다. 소개장은 보유만 확인하며 소비하지 않습니다.');}
  if(id==='today')for(const id of innPatrons(r))if(x.sightings[id])x.sightings[id].known=true;
  if(id==='officials'){x.sightings.local_scribe.known=true;w.raising!.intel=Math.min(200,w.raising!.intel+1);}
  if(id==='mood')s.reputation=Math.min(5,s.reputation+1);
  h.emit('topicSelected','한복 · '+d.label+' · 처음 확인한 대화만 시간·효과 적용');return ok;
 }
 if(kind==='rumor'){
  if(!atInn||s.view.kind!=='rumors')return no('주인과 소문 대화를 시작하세요.');if(s.rumors.length>=2)return no('객사의 구매 소문은 캠페인당 2개입니다.');const price=s.reputation<0?2:1,c=afford(r,1,price);if(!c.ok)return c;
  pay(r,h,1,price);const index=s.rumors.length,loc=index===0?'gate':'store',person=index===0?'local_broker':'lusu';s.rumors.push({id:'inn-rumor-'+index,source:'한복 · 통행객에게 들은 말',reliability:index===0?'uncertain':'likely',location:loc,character:person,expires:Math.min(42,x.tick+12),confirmed:false,verification:loc+' 장소에서 의뢰 조사',text:index===0?'성문 통행 기록에 장부 밖 비축의 단서가 남았다고 합니다.':'노숙이 창고 장부의 책임자를 찾고 있습니다.'});s.stats.rumors++;x.sightings[person].known=true;x.locations[loc].discovered=true;x.rumors.push(s.rumors.at(-1)!.text);x.rumors=x.rumors.slice(-30);
  if(!s.quests.cache)s.quests.cache=offered('cache');s.trust=Math.min(10,s.trust+1);h.emit('rumorRevealed',s.rumors.at(-1)!.text+' · 지도 단서와 소문 의뢰 생성');return ok;
 }
 if(kind==='offer'){const d=INN_QUESTS[id];if(!d||!eligiblePerson(r,d.giver))return no('객사에 있는 의뢰인에게 부탁을 들으세요.');if(x.converted)return no('거병 전 의뢰는 새로 수락하지 않습니다. 기록은 유지됩니다.');s.quests[id]??=offered(id);s.view={kind:s.quests[id].status==='readyToReport'?'report':'offer',quest:id};s.dialogue=d.summary;h.emit('questOffered',d.title+' · 목표·비용·위험을 확인한 뒤 수락하세요.');return ok;}
 if(kind==='accept'){
  const d=INN_QUESTS[id],quest=s.quests[id];if(x.converted||!d||!quest||quest.status!=='offered'||!eligiblePerson(r,d.giver))return no('의뢰인에게 제안받은 미수락 부탁을 선택하세요.');const c=afford(r,1,d.resource==='funds'?d.escrow:0,d.resource==='food'?d.escrow:0);if(!c.ok)return c;
  pay(r,h,1,d.resource==='funds'?d.escrow:0,d.resource==='food'?d.escrow:0);quest.acceptedAt=x.tick;quest.due=Math.min(x.budget,x.tick+d.timeLimit);quest.escrow=d.escrow;quest.status='accepted';s.stats.accepted++;s.view={kind:'conversation',person:d.giver,topic:'accepted'};s.dialogue=d.steps[0].objective+'부터 시작하세요. 수락만으로 보상을 받지는 않습니다.';h.emit('questAccepted',d.title+' · '+d.steps[0].objective);return ok;
 }
 if(kind==='abandon'){const quest=s.quests[id];if(!quest||!['accepted','active','readyToReport'].includes(quest.status))return no('진행 중 의뢰만 포기할 수 있습니다.');quest.status='abandoned';quest.result='failure';s.reputation=Math.max(-5,s.reputation-1);h.emit('questExpired','의뢰 포기 · 사용한 비용·시간은 반환되지 않습니다.');return ok;}
 if(kind==='quest'){
  const quest=s.quests[id],d=INN_QUESTS[id];if(!quest||!d||!innQuestActions(r,quest).includes(arg)||x.converted)return no('현재 의뢰의 목표 장소와 단계를 확인하세요.');if(x.tick+1>quest.due)return no('이 활동에 필요한 의뢰 기한이 부족합니다.');
  if(arg==='report')return report(r,id,h);
  if(id==='escort'&&quest.step===1){
   const checked=['cart','passage','guards'].every(clue=>quest.evidence.includes(clue));
   if(!checked)return no('먼저 창고에서 수레, 통로, 호위 인력을 각각 조사하세요.');
   if(arg==='contract'){
    const c=afford(r,1,3);if(!c.ok)return c;pay(r,h,1,3);quest.conclusion='유료 호위 계약 · 자금 3 · 왕복 1회';quest.evidence.push('contract:3','period:one-trip','risk:escort');quest.result='partial';h.effects({debt:1,promise:'ration'},d.title+' · 단기 호위 계약');ensureLocationScene(x).usedInteractions.push('escort:contract');ensureLocationScene(x).phase='resolution';advanceQuest(quest,h,arg);return ok;
   }
   if(arg==='alternate'){
    const hasIntel=r.campaign!.world!.raising!.intel>=1||x.items.some(i=>i.id==='map')||x.companions.includes('lusu');
    if(!quest.evidence.includes('workers')||!quest.evidence.includes('passage')||!hasIntel)return no('짐꾼 증언·통로 조사와 정보 1, 지도 또는 노숙 동행이 필요합니다.');
    const c=afford(r,2);if(!c.ok)return c;pay(r,h,2);quest.conclusion='짐꾼과 노숙이 찾은 좁은 우회로';quest.evidence.push('alternate-route');quest.result='partial';const lusu=r.campaign!.personnel!.officers.lusu;if(lusu){lusu.trust=Math.min(100,lusu.trust+5);lusu.proof=true;lusu.events.push(d.title+' · 짐꾼 증언으로 대체 통로 확보');r.campaign!.personnel!.revision++;h.emit('relationshipChanged','노숙 · 우회로 공동 조사 · 신뢰 +5·협력 실적');}h.effects({exposure:1},d.title+' · 비공개 우회로');ensureLocationScene(x).usedInteractions.push('escort:alternate');ensureLocationScene(x).phase='resolution';advanceQuest(quest,h,arg);return ok;
   }
  }
  if(id==='escort'&&quest.step===2&&arg==='transport'){
   const secured=quest.evidence.some(v=>['verified','contract:3','alternate-route','legacy-approved'].includes(v));if(!secured)return no('통행 허가나 합의가 먼저 필요합니다.');
   const c=afford(r,1);if(!c.ok)return c;pay(r,h,1);quest.evidence.push('cart-delivered');quest.result=quest.evidence.includes('verified')?'complete':'partial';quest.conclusion+=' · 성문까지 수레와 군량 실제 호송';ensureLocationScene(x).usedInteractions.push('escort:transport');ensureLocationScene(x).phase='report';
   x.locations.store.secured=true;x.locations.gate.secured=true;h.effects({food:quest.result==='complete'?3:2,training:1},d.title+' · 성문 도착 및 하역');advanceQuest(quest,h,arg);return ok;
  }
  if(arg==='retry-investigate'&&quest.result!=='failure')return no('실제 설전이 결렬된 뒤에만 추가 조사를 선택할 수 있습니다.');
  const card=x.event?.committedFamilies.some(f=>['intel','network','supply','military'].includes(f)),itemId=arg==='letter'?'letter':arg==='ledger-investigate'?'ledger':null,item=itemId?x.items.find(i=>i.id===itemId):undefined;
  if(arg.startsWith('card-')&&!card)return no('이 장소에서 정보·인맥·물자·군사 카드 중 관련 카드를 먼저 실제 사용하세요.');
  if(itemId&&!item)return no('지정된 증거 물품을 가지고 있어야 합니다.');if(itemId&&s.selectedItem!==item!.uid){s.selectedItem=item!.uid;s.dialogue=`${d.title}의 ${d.steps[quest.step].objective}에 ${itemId==='letter'?'소개장':'장부'}을 제출합니다. 다음 확인에서 소비합니다.`;return ok;}
  const cost=arg==='pay'||arg==='pay-guards'?2:0,c=afford(r,1,cost);if(!c.ok)return c;
  if(arg==='private-records'&&!s.privateAccess&&s.trust<2)return no('주인 신뢰 2 또는 안쪽 방 소개가 필요합니다.');
  if(arg==='card-records'&&!card)return no('객사에서 관련 계열 카드를 먼저 사용하세요.');
  if(arg==='truth'&&quest.result!=='complete')return no('완전 검증되지 않았습니다. 조건부 보증 또는 추가 검증을 선택하세요.');
  if((arg==='debate'||arg==='duel')&&quest.evidence.includes('blocked'))return no('첫 대결의 결과는 되돌릴 수 없습니다. 추가 조사 또는 비용을 낸 우회로 해결하세요.');
  if(arg==='expose'&&!quest.evidence.includes('verified'))return no('확인한 증거 없이 공개 고발할 수 없습니다.');
  pay(r,h,1,cost);if(item){x.items=x.items.filter(i=>i.uid!==item.uid);x.stats.items[item.id]=(x.stats.items[item.id]??0)+1;s.selectedItem=null;quest.evidence.push(item.id);h.emit('itemUsed',d.title+' · '+item.id+'을 의뢰 상대에게 제출');}
  if(arg==='debate'||arg==='duel'){const event=id==='escort'?(arg==='duel'?'inn_escort':'inn_escort_terms'):arg==='duel'?'inn_escort':x.location==='archive'?'inn_documents':'inn_accounts';s.activity={event,quest:id,resume:x.event?.id??null,kind:arg};h.social(event,arg);s.stats[arg==='debate'?'debates':'duels']++;return ok;}
  if(arg==='retry-investigate'){quest.evidence.push('additional-records');quest.result='partial';h.effects({intel:1,exposure:1},d.title+' · 추가 조사');advanceQuest(quest,h,arg);return ok;}
  if(['truth','conditional','expose'].includes(arg)){quest.conclusion=arg;quest.result=arg==='conditional'?'partial':'complete';if(arg==='conditional')h.effects({debt:1,promise:'ration'},d.title+' · 조건부 보증');if(arg==='expose'){s.reputation=Math.max(-5,s.reputation-1);h.effects({exposure:2},d.title+' · 공개 기록');}advanceQuest(quest,h,arg);return ok;}
  quest.evidence.push(d.steps[quest.step].id);if(arg==='pay'||arg==='pay-guards'){quest.result='partial';h.effects({debt:1},d.title+' · 비용을 감수한 우회');}else if(item)quest.result='complete';
  if(id==='cache'&&quest.step===0)h.effects({exposure:1},d.title+' · 공개 통행 조사');
  for(const rumor of s.rumors)if(rumor.location===x.location){rumor.confirmed=true;rumor.reliability='verified';}
  advanceQuest(quest,h,arg);return ok;
 }
 if(kind==='report')return report(r,id,h);
 if(kind==='lodge'){
  const day=x.converted?8+w.turn:Math.floor(x.tick/6);if(s.lodgedDays.includes(day))return no('회복 숙박은 하루에 한 번입니다.');const time=id==='wait'?2-x.tick%2:id==='room'?3:1,funds=id==='room'?1:0,food=id==='meal'?1:0;if(!['rest','meal','room','wait','safe'].includes(id))return no('표시된 숙박 서비스를 선택하세요.');if(id==='safe'&&!s.privateAccess)return no('안쪽 방 소개가 필요합니다.');const c=afford(r,time,funds,food);if(!c.ok)return c;pay(r,h,time,funds,food);s.arrivals=[];s.arrivals=innPatrons(r);s.lodgedDays.push(day);s.lodgedDays=s.lodgedDays.slice(-8);s.stats.lodgings++;x.fatigue=Math.max(0,x.fatigue-(id==='room'?5:3));q.power=Math.min(4,q.power+1);if(id==='safe')w.preparation.exposure=Math.max(0,w.preparation.exposure-1);s.dialogue=`${time}시간 동안 ${id==='meal'?'식사':'휴식'}했습니다. 손님의 다음 행선지를 확인하세요.`;h.emit('lodgingStarted',s.dialogue+' · 비용·시간 반환 없음');return ok;
 }
 if(kind==='observe'){
  if(s.claims.includes('observation'))return no('이 객당 대화는 이미 확인했습니다.');const c=afford(r,1);if(!c.ok)return c;pay(r,h,1);s.claims.push('observation');if(id==='listen'){s.trust=Math.max(0,s.trust-1);s.reputation=Math.max(-5,s.reputation-1);h.effects({exposure:1},'몰래 들은 객당 대화');s.dialogue='허림이 당신을 발견했습니다. 신뢰가 낮아졌지만 문서고의 단서는 기억했습니다.';}else{s.trust=Math.min(10,s.trust+1);s.dialogue='두 손님은 문서고 기록을 대조하라고 권합니다. 공개적으로 묻는 태도를 한복이 기억합니다.';}x.sightings.local_scribe.known=true;h.emit('relationshipChanged',s.dialogue);return ok;
 }
 if(kind==='courtyard'){
  if(s.claims.includes('courtyard')||x.converted)return no('뒤뜰 호위 시험은 거병 전 한 번입니다.');const c=afford(r,1,1);if(!c.ok)return c;pay(r,h,1,1);s.claims.push('courtyard');s.activity={event:'inn_courtyard',quest:null,resume:x.event?.id??null,kind:'duel'};h.social('inn_courtyard','duel');s.stats.duels++;return ok;
 }
 if(kind==='post-info'){if(!x.converted||s.trust<2||s.postTurn===w.turn)return no('주인 신뢰 2의 정보망은 캠페인 턴마다 한 번입니다.');const c=afford(r,1,1);if(!c.ok)return c;pay(r,h,1,1);s.postTurn=w.turn;w.prestige=Math.min(200,w.prestige+1);s.dialogue='한복의 추천망이 외지 인재의 소식과 세력 평판을 모았습니다.';h.emit('cityStateChanged',s.dialogue+' · 명망 +1');return ok;}
 return no('없는 객사 명령입니다.');
}
function offered(id:string):InnQuestState {return {id,giver:INN_QUESTS[id].giver,status:'offered',step:0,acceptedAt:0,due:42,approaches:[],evidence:[],result:null,conclusion:'',reported:false,escrow:0};}
function report(r:RunState,id:string,h:InnHooks):Result {
 const x=xof(r),s=ensureInn(r),q=s.quests[id],d=INN_QUESTS[id];if(!q||!d||q.status!=='readyToReport'||q.reported||q.step!==d.steps.length-1||x.location!=='inn'||!['location','result'].includes(x.scene)||!eligiblePerson(r,d.giver)||x.converted||x.tick+1>q.due)return no('기한 안에 객사에서 의뢰인을 만나 완료한 활동을 보고하세요.');if(x.pendingItem)return no('먼저 보관함의 대기 물품을 정리한 뒤 보고하세요.');const c=afford(r,1);if(!c.ok)return c;pay(r,h,1);ensureLocationScene(x).phase='report';q.reported=true;q.status='completed';q.result??='complete';s.stats.reported++;s.trust=Math.min(10,s.trust+(d.giver==='innkeeper'?2:1));s.reputation=Math.min(5,s.reputation+1);
 const p=r.campaign!.personnel!,o=p.officers[d.giver];if(o){o.task=true;o.information=Math.max(3,o.information);o.trust=Math.min(100,o.trust+15);o.xp=Math.min(99,o.xp+1);o.proof=true;o.events.push(d.title+' · '+q.result+' · 객사 보고');p.revision++;}
 if(d.plan)h.effects({plan:d.plan,intel:id==='recommendation'?1:0,legitimacy:1,promise:id==='recommendation'?'authority':undefined,training:id==='escort'?1:0},d.title+' 보고');
 if(id==='lostletter'){s.privateAccess=true;h.effects({item:'letter'},d.title+' 보고');}if(id==='cache')h.effects({item:'map',intel:1},d.title+' 보고');if(id==='accounts')h.effects({group:'traders',groupChange:1},d.title+' 보고');
 x.locations.inn.secured=true;x.growth.xp=Math.min(12,x.growth.xp+1);if(x.growth.xp>=2&&!x.growth.branch&&!x.growth.offered){x.growth.offered=true;h.emit('protagonistGrowthOffered','의뢰 보고의 경험이 주인공 성장으로 이어졌습니다.');}r.campaign!.world!.raising!.step=Math.min(5,r.campaign!.world!.raising!.step+1);s.view={kind:'conversation',person:d.giver,topic:'reported'};s.dialogue=id==='escort'?(q.conclusion.includes('무장 대결')?'전위는 실력을 보인 선택을 인정합니다. 호위 대표와 통행권을 다퉜고, 수레를 성문까지 옮긴 기록을 남겼습니다.':q.conclusion.includes('유료 호위 계약')?'전위는 안전한 유료 호위 계약을 인정하지만, 한 차례 호위 비용과 군량 약속도 함께 기억합니다.':q.conclusion.includes('우회로')?'전위는 짐꾼과 노숙이 찾은 우회로로 주민 부담을 줄인 점을 높이 평가합니다. 협력 실적과 노출 위험도 기록합니다.':'전위는 창고와 호위 대표가 합의한 책임 범위를 확인합니다.'):q.result==='partial'?'모든 사실을 단정하지 않고 조건을 남긴 보고를 받았습니다. 그 책임도 함께 기억하겠습니다.':'사람과 기록을 함께 확인한 보고를 받았습니다. 이제 협력의 뜻을 논의할 수 있겠습니다.';h.emit('questReported',d.title+' · '+q.result+' · 보고 보상은 한 번만 지급');h.emit('innkeeperRelationChanged','한복이 보고의 신뢰와 객사 평판 변화를 기록했습니다.');return ok;
}
export function finishInnSocial(r:RunState,h:InnHooks):boolean {
 const x=xof(r),s=x.inn,a=s?.activity,current=x.scene==='debate'?x.debate:x.duel;if(!s||!a||!current||current.result==='ongoing')return false;ensureLocationScene(x).phase='resolution';
 const success=['success','partial','win','draw'].includes(current.result),partial=['partial','draw'].includes(current.result);x.events[a.event].status=success?'success':'failure';x.events[a.event].claimed=true;x.events[a.event].outcome=current.result;
 if(a.quest){const quest=s.quests[a.quest];quest.result=success?(partial?'partial':'complete'):'failure';if(success){quest.evidence.push('verified');if(quest.id==='escort')quest.conclusion=(a.kind==='duel'?'호위 대표와 무장 대결':'창고 책임자·호위 대표와 설전')+' · '+current.result;advanceQuest(quest,h,current.result);}else{quest.evidence.push('blocked');s.stats.failures++;x.fatigue=Math.min(8,x.fatigue+2);h.effects({exposure:1},INN_QUESTS[quest.id].title+' · 결렬/패배, 비용을 낸 우회 또는 추가 조사 가능');h.emit('questStepAdvanced','결렬·패배 · 의뢰는 계속됩니다. 계약·추가 조사·우회로를 선택할 수 있습니다.');}}
 else{if(success){h.effects({training:1},'뒤뜰 시험');s.trust=Math.min(10,s.trust+1);}else{x.fatigue=Math.min(8,x.fatigue+2);s.dialogue='대결은 끝났습니다. 부상과 상대의 경고를 기록하며 같은 시험 보상은 반복되지 않습니다.';}}
 x.event=a.resume?x.events[a.resume]:null;x.scene=x.event?.claimed?'result':'location';x.debate=null;x.duel=null;x.socialApproach=null;s.activity=null;h.emit('eventResolved','객사 활동 결과 · '+current.result+' · 의뢰 기록에 반영');return true;
}
