import {syncPersonnelDecks,recordPersonnelUse} from './personnel-rules.ts';
import {syncExploration} from './city-exploration.ts';
import {ADMIN_CARDS,ADMIN_GENERALS,BUILDS,CITY_DEFS,DISTRICTS,FACILITY_DEFS,ISSUE_DEFS,METRICS,POLICY_DEFS,PROJECT_DEFS,SEAL_DEFS} from '../data/cities.ts';
import {configureOwnedCity,retreatWorld,settleCityWorld,endWorldTurn,archiveOfficerAssets,restoreOfficerAssets} from './world.ts';
import {GENERALS} from '../data/generals.ts';
import {newRegionalRun,beginBattle} from './run.ts';
import {createDebate} from './debate.ts';
import {prepareNegotiation} from './negotiation.ts';
import {startDeckDebate} from './debate-deck.ts';
import {initializeCityCorridor} from './geography.ts';
import {nextFloat,sample,shuffle} from './rng.ts';
import type {RunState,GeneralInst} from './types.ts';
import type {Result} from './run.ts';
import type {DebateState} from './social-types.ts';
import type {AdminCard,AdminFamily,AdminPlan,AdminRole,CampaignState,CityBuild,CityDelta,CityId,CityState,Conquest,DistrictId,Metric,Occupation} from './city-types.ts';
import type {CityEffect,CityField} from '../data/cities.ts';
export const CITY_SEED=101001;
const ok:Result={ok:true};const no=(reason:string):Result=>({ok:false,reason});
const clamp=(v:number,min=0,max=100)=>Math.max(min,Math.min(max,v));
export const activeCity=(r:RunState)=>r.campaign?.active?r.campaign.cities[r.campaign.active]:undefined;
/** The unowned city is a real persisted city; founding changes its owner, not its identity. */
export function createLocalExplorationCity(r:RunState,id:CityId):CityState {
 const camp=r.campaign!,existing=camp.cities[id];if(existing)return existing;const d=CITY_DEFS[id];
 const city:CityState={id,owner:'local',metrics:structuredClone(d.metrics),food:d.food,materials:d.materials,people:d.people,readiness:d.readiness,
  districts:(Object.keys(DISTRICTS) as DistrictId[]).map(id=>({id,damage:0,facility:null,level:0})),roles:{civil:null,logistics:null,guard:null},policies:[],seals:[],cards:[],draw:[],hand:[],discard:[],exhaust:[],nextUid:1,
  phase:1,limit:100000,ap:0,used:[],lastFamily:null,lastDistrict:null,uses:{},issues:[],projects:[],groups:{locals:0,traders:0,refugees:0},promises:[],blueprints:[],threat:{due:3,power:38,resolved:false},pact:null,occupation:'shared',conquest:'inside',build:d.build,outcome:'거병 전 도시',plan:'issues',report:[],log:[],stats:{plays:{},chains:0,facilities:[],appointments:[],resolved:0,depleted:0,repeats:0}};
 camp.cities[id]=city;camp.active=id;return city;
}
const has=(c:CityState,id:string)=>c.districts.some(d=>d.facility===id&&d.damage<3);
const policy=(c:CityState,id:string)=>c.policies.some(p=>p.id===id);
const cityRecord=(c:CityState,text:string)=>{c.log.push(text);if(c.log.length>100)c.log.shift();};
function amount(c:CityState,f:CityField){return f in c.metrics?c.metrics[f as keyof typeof c.metrics]:c[f as 'food'|'materials'|'people'|'readiness'];}
function change(c:CityState,f:CityField,n:number,source:string){
 const before=amount(c,f),after=clamp(before+n,0,f in c.metrics||f==='readiness'?100:200);
 if(f in c.metrics)c.metrics[f as keyof typeof c.metrics]=after;else c[f as 'food'|'materials'|'people'|'readiness']=after;
 if(after!==before)c.report.push(`${source}: ${f in METRICS?METRICS[f as keyof typeof METRICS]:({food:'도시 식량',materials:'자재',people:'인력',readiness:'군사 준비'} as Record<string,string>)[f]} ${before} → ${after}`);
}
function effects(c:CityState,es:CityEffect[],source:string,mult=1){for(const e of es)change(c,e.field,e.amount*mult,source);}
function addCard(c:CityState,id:string,owner?:string,temporary=false){const card:AdminCard={uid:c.nextUid++,id,upgrade:false,mod:'none',...(owner?{owner}:{}),...(temporary?{temporary}: {})};c.cards.push(card);return card.uid;}
function draw(c:CityState,camp:CampaignState,n:number){for(let i=0;i<n&&c.hand.length<8;i++){if(!c.draw.length)c.draw=shuffle(camp,c.discard.splice(0));const uid=c.draw.pop();if(uid===undefined)break;c.hand.push(uid);}}
function issue(c:CityState,id:string,due:number){if(!c.issues.some(i=>i.id===id))c.issues.push({id,due,progress:0,status:'active'});}
function progressIssue(c:CityState,id:string,n:number,source:string){const i=c.issues.find(i=>i.id===id&&i.status==='active');if(!i)return;i.progress=Math.min(2,i.progress+n);c.report.push(`${source}: ${ISSUE_DEFS[id].name} ${i.progress}/2`);if(i.progress===2){i.status='resolved';c.stats.resolved++;effects(c,ISSUE_DEFS[id].reward,'현안 해결');c.groups[ISSUE_DEFS[id].group]=clamp(c.groups[ISSUE_DEFS[id].group]+1,-3,3);}}
function project(c:CityState,camp:CampaignState,id:string,n:number,owner:string|null){let p=c.projects.find(p=>p.id===id);if(!p){if(c.projects.filter(p=>!p.complete).length>=2)return false;p={id,progress:0,need:3,owner,idle:0,complete:false};c.projects.push(p);}if(p.complete)return true;p.progress=Math.min(p.need,p.progress+n);p.idle=0;c.report.push(`${PROJECT_DEFS[id].name}: ${p.progress}/${p.need}`);if(p.progress===p.need){p.complete=true;effects(c,PROJECT_DEFS[id].effects,'사업 완공');c.districts.find(d=>d.id===PROJECT_DEFS[id].district)!.damage=0;if(id==='canal')progressIssue(c,'flood',2,'수로 완공');if(id==='road'){for(const road of camp.roads)if(road.a===c.id||road.b===c.id)road.condition=Math.min(3,road.condition+1);c.groups.traders=clamp(c.groups.traders+1,-3,3);}}return true;}
export function newCityCampaign(seed=CITY_SEED,lord='caocao'):RunState {
 const r=newRegionalRun(seed,lord);r.generals=[{id:'chengpu',row:'front'},{id:'zhangliao',row:'front'},{id:'chengong',row:'rear'},{id:'guojia',row:'rear'}];r.unlocked=['chengong','machao'];r.food=18;r.social.protocol='clauses';
 r.campaign={version:1,dataVersion:'henan-cities-1',seed,rng:(seed^0x51a713)>>>0,faction:lord,stage:'approach',target:'xingyang',active:null,cities:{},roster:r.generals.map(g=>g.id),fatigue:{},captured:[],roads:[{a:'xingyang',b:'chenggao',condition:2,distance:1},{a:'chenggao',b:'gong',condition:2,distance:1},{a:'xingyang',b:'gong',condition:1,distance:2}],approach:{choices:[],intel:0,supply:0,trust:0,cut:0,damage:0},method:null,activity:null,deferredPromises:[],departures:0,unlocks:[],log:['190년 하남윤 가상 도시 캠페인. 역사 지명·지세 맥락만 공유, 소유권·통로·정벌은 창작.']};
 return r;
}
export function cityApproach(r:RunState,id:string):Result {
 const c=r.campaign;if(!c||c.stage!=='approach'||c.approach.choices.length>=2||c.approach.choices.includes(id))return no('서로 다른 접근 준비를 두 가지 선택하세요.');
 if(!['scout','supply','protect','cut','raid'].includes(id))return no('알 수 없는 접근 준비입니다.');
 const cost=id==='raid'?0:2;if(r.food<cost)return no('원정 군량 2가 필요합니다.');r.food-=cost;c.approach.choices.push(id);
 if(id==='scout')c.approach.intel+=2;if(id==='supply'){c.approach.supply+=3;r.food+=4;}if(id==='protect')c.approach.trust+=2;if(id==='cut')c.approach.cut+=5;if(id==='raid'){r.food+=5;c.approach.trust-=2;c.approach.damage+=2;}
 c.log.push(`도시 접근: ${id} · 군량 ${r.food}.`);if(c.approach.choices.length===2)c.stage='conquest';return ok;
}
export function conquestAllowed(r:RunState,method:string):Result {
 const c=r.campaign;if(!c||c.stage!=='conquest'||c.cities[c.target]?.owner==='player')return no('현재 도시 정벌 단계가 아닙니다.');
 if(!['assault','persuade','siege','inside'].includes(method))return no('알 수 없는 정벌 방식입니다.');
 if(method==='persuade'&&(c.approach.intel<2||!r.generals.some(g=>GENERALS[g.id].scholar)))return no('정찰 정보 2와 군단 책사가 필요합니다.');
 if(method==='siege'&&r.food<8)return no('포위에 원정 군량 8이 필요합니다.');
 if(method==='inside'&&(c.target==='chenggao'||c.approach.intel<2||c.approach.trust<2))return no('성고에서는 내응 불가. 다른 도시에서 정보 2·주민 신뢰 2 필요.');
 return ok;
}
export function chooseConquest(r:RunState,method:Conquest):Result {
 const check=conquestAllowed(r,method);if(!check.ok)return check;const c=r.campaign!;c.method=method;
 if(method==='siege'){r.food-=8;r.hp=Math.max(1,r.hp-4);c.approach.damage++;c.stage='occupation';return ok;}
 if(method==='inside'){r.food=Math.max(0,r.food-2);c.stage='occupation';return ok;}
 if(method==='persuade')return beginCityDebate(r,'conquest');
 // Existing formation/card battle resolves the gate. Defenders and damage are persistent campaign facts.
 if(r.floor!==7){r.mapTrail=[];delete r.geography;}r.floor=7;r.col=0;r.map[7][0].encounterId=CITY_DEFS[c.target].encounter;r.map[7][0].terrain='fortress';
 beginBattle(r,r.map[7][0]);for(const e of r.battle!.enemies){e.block=Math.max(0,6-c.approach.cut);e.hp=Math.max(1,e.hp-c.approach.cut);e.name=`${CITY_DEFS[c.target].name} 수비대 · ${e.name}`;}
 r.battle!.log.push({turn:1,text:`${CITY_DEFS[c.target].name} 성문 방비 ${Math.max(0,6-c.approach.cut)} · 보급 차단 ${c.approach.cut}. 돌파 후 성문 피해가 남습니다.`,kind:'info'});
 c.stage='expedition';return ok;
}
export function campaignBattleOutcome(r:RunState,won:boolean,damage:number):boolean {
 const c=r.campaign;if(!c||c.stage!=='expedition')return false;
 if(won&&r.floor!==7)return false;
 r.battle=null;r.pending={kind:'none'};r.screen='map';
 if(won){c.method??='assault';c.approach.damage+=1+(damage>=15?1:0);c.stage='occupation';c.log.push(`정벌 승리: 피해 단계 ${c.approach.damage}.`);}
 else {if(c.world){retreatWorld(r);return true;}r.hp=Math.max(12,r.hp);r.food=Math.max(4,r.food);c.stage=c.captured.length?'ready':'approach';c.method=null;c.approach={choices:[],intel:0,supply:0,trust:0,cut:0,damage:0};c.log.push('군단 후퇴. 도시 운영과 캠페인은 유지하며 재정비한다.');}
 return true;
}
export function beginCityDebate(r:RunState,kind:'conquest'|'issue'):Result {
 const c=r.campaign,city=activeCity(r);if(!c||c.activity||kind==='conquest'&&c.stage!=='conquest'||kind==='issue'&&(!city||c.stage!=='admin'||city.ap<1||!city.issues.some(i=>i.status==='active')))return no('현재 설전을 시작할 수 없습니다.');
 if(c.world&&kind==='issue'&&city&&city.food>=1&&r.generals.length){city.food--;r.food++;}
 const general=r.generals.find(g=>g.id==='guojia')??r.generals.find(g=>GENERALS[g.id].scholar)??r.generals[0];if(!general||r.food<1)return no('출전 가능한 장수와 원정 군량 1이 필요합니다.');
 if(kind==='issue')city!.ap--;r.food--;c.activity=kind;
 const s=createDebate(Math.floor(nextFloat(c)*2147483647)+1,general.id,'elder',{kind:'supply'});prepareNegotiation(s,r.food,c.approach.intel+1,c.approach.trust>0?1:0,0);startDeckDebate(s,r.debateBuild,false,false,c.world);
 r.pending={kind:'debate',state:s};r.screen='node';return ok;
}
export function campaignDebateOutcome(r:RunState,s:DebateState):boolean {
 const c=r.campaign;if(!c?.activity)return false;
 const promises=s.deck?.promises??[];c.deferredPromises.push(...promises);r.pending={kind:'none'};r.screen='map';
 if(c.activity==='conquest'){if(s.result==='failure'){c.stage='conquest';c.method=null;c.log.push('수비대 설득 실패: 돌파·포위로 전환할 수 있다.');}else{c.stage='occupation';c.approach.trust+=s.result==='success'?2:1;if(s.result==='partial')c.deferredPromises.push('shared');}}
 else {const city=activeCity(r)!;city.report=[];if(s.result!=='failure'){const issue=city.issues.find(i=>i.status==='active');if(issue)progressIssue(city,issue.id,s.result==='success'?2:1,'설전 합의');city.groups.locals=clamp(city.groups.locals+1,-3,3);}
  for(const id of c.deferredPromises)city.promises.push({id,due:Math.min(city.limit,city.phase+2),status:'active'});c.deferredPromises=[];cityRecord(city,`도시 설전: ${s.result}. 약속은 도시 정산에 이행 여부를 확인.`);}
 c.activity=null;return true;
}
export function occupyCity(r:RunState,mode:Occupation):Result {
 const camp=r.campaign;if(!camp||camp.stage!=='occupation'||camp.cities[camp.target]?.owner==='player'||!['strict','shared','military','merchant'].includes(mode))return no('점령 방식을 선택할 수 없습니다.');
 const d=CITY_DEFS[camp.target],a=camp.approach;const m=structuredClone(d.metrics);
 for(const k of Object.keys(m) as (keyof typeof m)[])m[k]=clamp(m[k]+Math.floor(nextFloat(camp)*9)-4);
 m.life=clamp(m.life-a.damage*4);m.order=clamp(m.order+a.trust*4+(mode==='shared'?10:mode==='strict'?5:mode==='military'?-8:0));m.security=clamp(m.security+(mode==='military'?12:mode==='strict'?8:0));
 const fresh:CityState={id:camp.target,owner:'player',metrics:m,food:d.food+a.supply+(mode==='merchant'?4:mode==='military'?3:0),materials:d.materials+(mode==='merchant'?4:0),people:d.people,readiness:d.readiness+(mode==='military'?10:0),
  districts:(Object.keys(DISTRICTS) as DistrictId[]).map(id=>({id,damage:id==='gate'?a.damage:id==='farms'?Math.max(0,a.damage-1):0,facility:null,level:0})),roles:{civil:null,logistics:null,guard:null},policies:[],seals:[],cards:[],draw:[],hand:[],discard:[],exhaust:[],nextUid:1,
  phase:1,limit:5,ap:4,used:[],lastFamily:null,lastDistrict:null,uses:{},issues:[],projects:[],groups:{locals:clamp(a.trust+(mode==='shared'?1:0),-3,3),traders:mode==='merchant'?2:0,refugees:mode==='military'?-1:0},promises:[],blueprints:[],threat:{due:3,power:38+Math.floor(nextFloat(camp)*12)+(mode==='military'?5:0),resolved:false},pact:null,occupation:mode,conquest:camp.method??'assault',build:d.build,outcome:'운영 중',plan:'issues',report:[],log:[],stats:{plays:{},chains:0,facilities:[],appointments:[],resolved:0,depleted:0,repeats:0}};
 const c=camp.cities[camp.target]??fresh;
 if(c!==fresh){
  c.owner='player';c.occupation=mode;c.conquest=camp.method??'inside';c.ap=4;c.outcome='운영 중';
  for(const k of Object.keys(m) as Metric[])c.metrics[k]=clamp(c.metrics[k]+m[k]-d.metrics[k]);
  c.food+=a.supply+(mode==='merchant'?4:mode==='military'?3:0);c.materials+=mode==='merchant'?4:0;c.readiness=clamp(c.readiness+(mode==='military'?10:0));
  for(const district of c.districts)district.damage=clamp(district.damage+(fresh.districts.find(v=>v.id===district.id)?.damage??0),0,4);
  for(const group of ['locals','traders','refugees'] as const)c.groups[group]=clamp(c.groups[group]+fresh.groups[group],-3,3);
 }
 for(const id of ['relief','register','sow','patrol','permit','militia','survey','accord',d.card,mode==='shared'?'charter':mode==='military'?'levy':mode==='merchant'?'cargo':'settle'])c.draw.push(addCard(c,id));
 const pool=Object.keys(FACILITY_DEFS),fav=pool.filter(id=>FACILITY_DEFS[id].build===d.build);c.blueprints=[sample(camp,fav,1)[0],...sample(camp,pool.filter(id=>!fav.includes(id)),2)];
 const issuePool=Object.keys(ISSUE_DEFS);for(const id of sample(camp,issuePool,2))issue(c,id,2+Math.floor(nextFloat(camp)*2));
 for(const id of camp.deferredPromises)c.promises.push({id,due:3,status:'active'});camp.deferredPromises=[];
 c.draw=shuffle(camp,c.draw);draw(c,camp,5);camp.cities[c.id]=c;camp.active=c.id;camp.captured.push(c.id);camp.stage='admin';camp.log.push(`${d.name} 점령: ${mode} · ${c.conquest}.`);cityRecord(c,'내정 5단계. 한 단계 행정력 4, 장수마다 한 임무, 정책 2·인장 2·시설 3·동시 사업 2 제한.');r.screen='map';if(camp.world)configureOwnedCity(r,c.id);return ok;
}
function adminCheck(r:RunState):Result {return r.campaign?.stage==='admin'&&!r.campaign.activity&&activeCity(r)?.owner==='player'&&(!r.campaign.world||r.campaign.world.stage==='strategy')?ok:no('도시 내정 단계가 아닙니다.');}
export function appointGeneral(r:RunState,role:AdminRole,general:string|null):Result {
 const check=adminCheck(r);if(!check.ok)return check;const camp=r.campaign!,c=activeCity(r)!;
 if(!Object.hasOwn(c.roles,role)||general!==null&&(!camp.roster.includes(general)||!ADMIN_GENERALS[general]))return no('임명 가능한 장수를 선택하세요.');
 if(general&&camp.personnel?.officers[general]&&camp.personnel.officers[general].duty!=='available')return no('임무·휴식 중 인재입니다.');if(c.ap<1)return no('임명·해임에 행정력 1이 필요합니다.');if(c.used.length)return no('장수 업무를 시작한 단계에서는 임명 변경 불가. 다음 단계에 변경하세요.');
 for(const city of Object.values(camp.cities))if(city!==c&&general&&Object.values(city!.roles).includes(general))return no('다른 도시에 주둔 중입니다. 도시를 선택하여 먼저 해임하세요.');
 if(general&&Object.values(c.roles).includes(general))return no('한 장수는 한 역할에만 임명할 수 있습니다.');
 const army=r.generals.filter(g=>g.id!==general);if(general&&army.length<1)return no('군단에 최소 한 장수를 남겨야 합니다.');
 const old=c.roles[role];if(old)army.push({id:old,row:GENERALS[old].row==='rear'?'rear':'front'});
 if(army.length>4||['front','rear'].some(row=>army.filter(g=>g.row===row).length>2))return no('복귀할 장수의 진형 자리를 먼저 비워 주세요.');
 if(old){const removed=new Set(c.cards.filter(card=>card.owner===old).map(card=>card.uid));c.cards=c.cards.filter(card=>!removed.has(card.uid));for(const pile of ['hand','draw','discard','exhaust'] as const)c[pile]=c[pile].filter(uid=>!removed.has(uid));}
 c.roles[role]=general;r.generals=army;if(camp.world&&general){camp.world.reserveOfficers=camp.world.reserveOfficers.filter(id=>id!==general);archiveOfficerAssets(r,general);}if(general&&!camp.personnel?.officers[general]){const uid=addCard(c,ADMIN_GENERALS[general].card,general);(c.hand.length<8?c.hand:c.draw).push(uid);c.stats.appointments.push(general);}
 if(camp.world&&old)restoreOfficerAssets(r,old);syncPersonnelDecks(r);c.ap--;cityRecord(c,`${role}: ${general?GENERALS[general].name:'공석'}. 군단과 도시의 장수는 중복 배치하지 않습니다.`);return ok;
}
export function cardCost(c:CityState,card:AdminCard){const d=ADMIN_CARDS[card.id];return Math.max(0,d.cost+(card.personnelCost??0)-(card.upgrade?1:0)-(card.mod==='cheap'?1:0)-(c.uses.discount??0)-(c.metrics.order<25?-1:0));}
export function canAdminCard(r:RunState,uid:number):Result {
 const check=adminCheck(r);if(!check.ok)return check;const c=activeCity(r)!,card=c.cards.find(card=>card.uid===uid),d=card&&ADMIN_CARDS[card.id];if(!card||!d||!c.hand.includes(uid))return no('손패에 없는 명령입니다.');
 const worker=card.owner??c.roles[d.role];if(card.owner&&!Object.values(c.roles).includes(card.owner))return no('고유 카드의 장수를 도시로 임명하세요.');
 if(worker&&c.used.includes(worker))return no('이 장수는 이번 단계의 업무를 이미 수행했습니다.');
 if((c.uses.actions??0)>=8)return no('단계당 행정 명령은 최대 8회입니다.');
 if(c.ap<cardCost(c,card)||c.food<(d.food??0)||c.materials<(d.materials??0)||c.people<(d.people??0))return no('행정력 또는 도시 자원이 부족합니다.');
 if(d.project&&!c.projects.some(p=>p.id===d.project)&&c.projects.filter(p=>!p.complete).length>=2)return no('동시 장기 사업은 2개까지입니다.');return ok;
}
export function playAdminCard(r:RunState,uid:number):Result {
 const check=canAdminCard(r,uid);if(!check.ok)return check;const camp=r.campaign!,c=activeCity(r)!,card=c.cards.find(card=>card.uid===uid)!,d=ADMIN_CARDS[card.id],worker=card.owner??c.roles[d.role],cost=cardCost(c,card);
 c.report=[];c.ap-=cost;c.uses.actions=(c.uses.actions??0)+1;c.uses.discount=0;change(c,'food',-(d.food??0),d.name);change(c,'materials',-(d.materials??0),d.name);change(c,'people',-(d.people??0),d.name);
 const es=d.effects.filter(e=>!(card.id==='register'&&e.field==='life'&&has(c,'housing'))).map(e=>({...e,amount:e.amount+(e.amount>0&&card.upgrade?2:0)+(card.id==='militia'&&e.field==='life'&&c.groups.locals>=2?3:0)}));effects(c,es,d.name);
 if(d.project)project(c,camp,d.project,1,worker);if(d.draw)draw(c,camp,d.draw);
 if(d.resolve)for(const id of d.resolve)progressIssue(c,id,1+(d.family==='relief'&&policy(c,'granary')?1:0),d.name);
 if(card.id==='forecast'){const i=c.issues.find(i=>i.status==='active');if(i)progressIssue(c,i.id,1,d.name);}
 if(d.family==='trade')c.groups.traders=clamp(c.groups.traders+1,-3,3);if(d.family==='diplomacy'||card.id==='charter')c.groups.locals=clamp(c.groups.locals+1,-3,3);
 if(worker){c.used.push(worker);camp.fatigue[worker]=clamp((camp.fatigue[worker]??0)+1,0,6);
  if(worker==='chengong'&&d.family==='records'){c.uses.discount=1;c.report.push('진궁: 다음 명령 행정력 −1.');}
  if(worker==='chengpu'&&['relief','diplomacy'].includes(d.family)){change(c,'life',3,'정보의 중재');c.groups.locals=clamp(c.groups.locals+1,-3,3);}
  if(worker==='zhangliao'&&['military','works'].includes(d.family)){effects(c,[{field:'readiness',amount:5},{field:'materials',amount:1},{field:'life',amount:-2}],'장료의 동원');}
  if(worker==='guojia'&&d.family==='intel'){draw(c,camp,1);c.report.push('곽가: 정보 연계 카드 +1.');}
  if(worker==='local_scribe'&&d.family==='records'){c.uses.discount=1;c.report.push('하남 서리: 다음 기록 연계 명령 비용 −1.');}
  if(worker==='local_captain'&&d.family==='military'&&c.food>=1){effects(c,[{field:'food',amount:-1},{field:'readiness',amount:3}],'향촌 훈련관');}
  if(camp.fatigue[worker]>=5)change(c,'order',-2,'담당 장수 피로');
 }
 // Declarative family triggers have a per-stage receipt and fixed, non-recursive effects.
 const chains:[string,boolean,CityEffect[]][]=[
  ['works',c.lastFamily==='works'&&d.family==='farm',[{field:'production',amount:4},{field:'life',amount:-1}]],
  ['harmony',!!c.lastFamily&&c.lastFamily!==d.family&&['relief','diplomacy'].includes(c.lastFamily)&&['relief','diplomacy'].includes(d.family),[{field:'order',amount:5}]],
  ['army',d.family==='military'&&c.food>=8,[{field:'food',amount:1},{field:'readiness',amount:3},{field:'production',amount:-1}]],
  ['audit',cost<d.cost,[{field:'security',amount:3}]],
 ];
 for(const [id,condition,es] of chains)if(c.seals.includes(id)&&condition&&!c.uses[id]){c.uses[id]=1;c.stats.chains++;effects(c,es,SEAL_DEFS[id].name);if(id==='audit')c.groups.traders=clamp(c.groups.traders-1,-3,3);if(id==='works'){const p=c.projects.find(p=>!p.complete);if(p)project(c,camp,p.id,1,p.owner);}}
 if(d.family==='farm'&&has(c,'farm'))change(c,'food',2,'둔전소 연계');if(d.family==='security'&&policy(c,'curfew'))change(c,'readiness',3,'통금·순찰');if(card.id==='cargo'&&(c.pact?.kind==='trade'||policy(c,'merchants')))change(c,'food',2,'교역 호송');
 if(card.personnelCard!==undefined)recordPersonnelUse(r,card.personnelCard);c.stats.plays[card.id]=(c.stats.plays[card.id]??0)+1;if(c.lastFamily===d.family)c.stats.repeats++;c.lastFamily=d.family;c.lastDistrict=d.district;
 c.hand=c.hand.filter(n=>n!==uid);(d.exhaust?c.exhaust:c.discard).push(uid);cityRecord(c,`${d.name}: 행정력 −${cost}. ${c.report.join(' / ')}`);return ok;
}
export function equipCityPolicy(r:RunState,id:string):Result {
 const check=adminCheck(r);if(!check.ok)return check;const c=activeCity(r)!,d=POLICY_DEFS[id];if(!d)return no('알 수 없는 정책.');const old=c.policies.find(p=>p.id===id);
 if(c.ap<1)return no('정책 시행·해제는 행정력 1.');if(old){c.policies=c.policies.filter(p=>p!==old);c.ap--;return ok;}
 if(c.policies.length>=2||!c.roles[d.role])return no('정책 2개 제한. 해당 담당 장수 임명이 필요합니다.');c.ap-=d.cost;c.policies.push({id,remaining:5});return ok;
}
export function equipCitySeal(r:RunState,id:string):Result {const check=adminCheck(r);if(!check.ok)return check;const c=activeCity(r)!;if(!SEAL_DEFS[id]||c.ap<1)return no('인장 변경에 행정력 1이 필요합니다.');if(c.seals.includes(id))c.seals=c.seals.filter(x=>x!==id);else if(c.seals.length<2)c.seals.push(id);else return no('인장 슬롯은 2개입니다.');c.ap--;return ok;}
export function constructCity(r:RunState,id:string):Result {
 const check=adminCheck(r);if(!check.ok)return check;const c=activeCity(r)!,d=FACILITY_DEFS[id];if(!d||!c.blueprints.includes(id))return no('제시된 청사진에서 선택하세요.');const slot=c.districts.find(x=>x.id===d.district)!;
 if(c.ap<1||c.materials<d.cost)return no('행정력 1·자재 3 필요.');if(slot.facility||c.districts.filter(d=>d.facility).length>=3)return no('구역당 시설 1개·도시 전체 3개 제한.');c.ap--;c.materials-=d.cost;slot.facility=id;slot.level=1;slot.damage=Math.max(0,slot.damage-1);c.stats.facilities.push(id);c.blueprints=[];cityRecord(c,`${d.name} 건설. 다른 청사진은 이번 제안에서 포기.`);return ok;
}
export function repairDistrict(r:RunState,id:DistrictId):Result {const check=adminCheck(r);if(!check.ok)return check;const c=activeCity(r)!,d=c.districts.find(d=>d.id===id);if(!d||c.ap<1||c.materials<2)return no('행정력 1·자재 2 필요.');if(d.damage>0)d.damage--;else if(d.facility&&d.level<2)d.level++;else return no('복구할 피해나 강화 가능한 시설이 없습니다.');c.ap--;c.materials-=2;syncExploration(r);return ok;}
export function editAdminDeck(r:RunState,uid:number,mode:string):Result {
 const check=adminCheck(r);if(!check.ok)return check;const c=activeCity(r)!,card=c.cards.find(card=>card.uid===uid);if(!card||card.personnelCard!==undefined||card.owner||card.temporary||!['upgrade','cheap','retain','remove'].includes(mode))return no('공용 영구 카드만 정제할 수 있습니다.');
 if(c.ap<1||c.materials<2||mode==='remove'&&c.cards.filter(card=>!card.temporary).length<=8||mode==='upgrade'&&card.upgrade||['cheap','retain'].includes(mode)&&card.mod!=='none')return no('정제 비용 부족, 최소 덱 8장 또는 이미 강화·개조한 카드.');
 c.ap--;c.materials-=2;if(mode==='remove'){c.cards=c.cards.filter(x=>x!==card);for(const pile of ['hand','draw','discard','exhaust'] as const)c[pile]=c[pile].filter(n=>n!==uid);}else if(mode==='upgrade')card.upgrade=true;else card.mod=mode as 'cheap'|'retain';return ok;
}
export function acquireAdminCard(r:RunState,id:string):Result {const check=adminCheck(r);if(!check.ok)return check;const c=activeCity(r)!;if(!['canal','wall','road',CITY_DEFS[c.id].card].includes(id)||c.ap<1||c.materials<1||(c.uses.acquire??0)>=1||c.cards.filter(card=>!card.temporary).length>=16)return no('단계당 카드 1장, 행정력 1·자재 1, 덱 최대 16장.');c.ap--;c.materials--;c.uses.acquire=1;(c.hand.length<8?c.hand:c.draw).push(addCard(c,id));return ok;}
export function cityPact(r:RunState,kind:'trade'|'guard'):Result {
 const check=adminCheck(r);if(!check.ok)return check;const c=activeCity(r)!;if(!['trade','guard'].includes(kind)||c.pact||c.ap<1||c.food<2||kind==='trade'&&c.groups.traders<1||kind==='guard'&&c.groups.locals<1)return no('도시 협정 1개 제한. 행정력 1·식량 2와 해당 집단 관계 1 필요.');c.ap--;c.food-=2;c.pact={kind,remaining:3};c.promises.push({id:kind==='trade'?'escort':'safety',due:c.phase+2,status:'active'});return ok;
}
function phaseProduction(c:CityState,camp:CampaignState){
 for(const p of c.policies){const d=POLICY_DEFS[p.id];if(c.roles[d.role])effects(c,d.effects,d.name);else c.report.push(`${d.name}: 담당 공석으로 정산 효과 정지.`);p.remaining--;}
 c.policies=c.policies.filter(p=>p.remaining>0);
 for(const district of c.districts){if(!district.facility)continue;const d=FACILITY_DEFS[district.facility];if(district.damage>=3){c.report.push(`${DISTRICTS[district.id]}: 피해로 시설 정지.`);continue;}effects(c,d.effects,d.name,district.level);}
 change(c,'food',Math.floor(c.metrics.production/18),'농업·시장 생산');change(c,'food',-(2+Math.floor(c.people/8)),'주민·주둔 소비');
 if(c.metrics.security<30){change(c,'food',-2,'창고 도난');change(c,'materials',-1,'도로 불안');}if(c.food===0){c.stats.depleted++;change(c,'life',-6,'식량 고갈');}if(c.metrics.life<25)change(c,'people',-1,'민생 위기');
 if(has(c,'granary')&&policy(c,'granary')){change(c,'order',2,'공동 창고·구휼');c.stats.chains++;}if(has(c,'inn')&&policy(c,'merchants')){change(c,'production',3,'객사·상단 보호');c.stats.chains++;}if(has(c,'training')&&policy(c,'training')){change(c,'security',2,'훈련장·향병');c.stats.chains++;}
 if(c.pact){effects(c,c.pact.kind==='trade'?[{field:'food',amount:2},{field:'materials',amount:1}]:[{field:'readiness',amount:3},{field:'food',amount:-1}],'도시 협정');if(--c.pact.remaining<=0)c.pact=null;}
 for(const g of (camp.world?Object.values(c.roles).filter((g):g is string=>!!g):camp.roster))if(!c.used.includes(g))camp.fatigue[g]=Math.max(0,(camp.fatigue[g]??0)-1);
}
export function endAdminPhase(r:RunState):Result {
 if(r.campaign?.world&&!activeCity(r)?.uses.worldInternal)return settleCityWorld(r);
 const check=adminCheck(r);if(!check.ok)return check;const camp=r.campaign!,c=activeCity(r)!;c.report=[];
 for(const p of c.projects.filter(p=>!p.complete)){if(c.people>0&&(!p.owner||Object.values(c.roles).includes(p.owner))){c.people--;project(c,camp,p.id,1,p.owner);}else if(++p.idle>=2)change(c,'life',-2,'사업 방치');}
 for(const i of c.issues.filter(i=>i.status==='active'))if(--i.due<=0){i.status='failed';effects(c,ISSUE_DEFS[i.id].effects,`${ISSUE_DEFS[i.id].name} 악화`);c.groups[ISSUE_DEFS[i.id].group]=clamp(c.groups[ISSUE_DEFS[i.id].group]-1,-3,3);if(i.id==='remnants')c.threat.power+=5;}
 for(const p of c.promises.filter(p=>p.status==='active'))if(p.due<=c.phase){const met=p.id==='authority'||p.id==='shared'?c.occupation==='shared'||c.groups.locals>=2:p.id==='escort'?c.metrics.security>=40:c.metrics.life>=40&&c.metrics.order>=40;p.status=met?'fulfilled':'broken';change(c,'order',met?4:-8,`약속 ${met?'이행':'파기'}: ${p.id}`);}
 phaseProduction(c,camp);
 if(c.phase===2){const next=Object.keys(ISSUE_DEFS).find(id=>!c.issues.some(i=>i.id===id));if(next){issue(c,next,2);c.report.push(`예고된 현안 도착: ${ISSUE_DEFS[next].name}, 2단계 내 대응.`);}}
 if(c.phase>=c.threat.due&&!c.threat.resolved){c.threat.resolved=true;const defense=c.readiness+Math.floor(c.metrics.security/2)+(c.pact?.kind==='guard'?10:0),loss=Math.max(0,c.threat.power-defense);if(loss){change(c,'food',-Math.ceil(loss/4),'잔당 재공격');change(c,'order',-Math.ceil(loss/2),'방어 부족');c.districts.find(d=>d.id==='gate')!.damage=Math.min(3,c.districts.find(d=>d.id==='gate')!.damage+1);}c.report.push(`예고된 재공격: 위협 ${c.threat.power}, 방어 ${defense}, 부족 ${loss}. 도시를 잃지 않고 피해로 계속.`);}
 cityRecord(c,`${c.phase}단계 정산: ${c.report.join(' / ')}`);
 const expired=new Set(c.cards.filter(card=>card.temporary).map(card=>card.uid));const retain=c.hand.filter(uid=>c.cards.find(card=>card.uid===uid)?.mod==='retain'&&!expired.has(uid));c.discard.push(...c.hand.filter(uid=>!retain.includes(uid)&&!expired.has(uid)));c.hand=retain;c.cards=c.cards.filter(card=>!expired.has(card.uid));for(const pile of ['draw','discard','exhaust'] as const)c[pile]=c[pile].filter(uid=>!expired.has(uid));
 if(c.phase===c.limit){c.ap=0;c.outcome=c.metrics.life>=40&&c.metrics.order>=40&&c.metrics.security>=35?'안정 도시':c.readiness>=40?'군사 주둔지':c.metrics.order>=25?'기능 도시':'불안정 도시';camp.stage='ready';if(!camp.unlocks.includes(c.build))camp.unlocks.push(c.build);return ok;}
 c.phase++;c.ap=c.metrics.order<25?3:4;c.used=[];c.uses={};c.lastFamily=null;c.lastDistrict=null;
 for(const district of c.districts){const d=district.facility&&FACILITY_DEFS[district.facility];if(d&&d.card&&district.damage<3)(c.hand.length<8?c.hand:c.draw).push(addCard(c,d.card,undefined,true));}
 draw(c,camp,5-c.hand.length);if(c.phase===3||c.phase===5||camp.world&&c.phase%3===0){const candidates=Object.keys(FACILITY_DEFS).filter(id=>!has(c,id)&&!c.districts.find(x=>x.id===FACILITY_DEFS[id].district)?.facility);c.blueprints=sample(camp,candidates,3);}
 return ok;
}
export type CityCommand={kind:'card';uid:number}|{kind:'end'}|{kind:'delegate';plan:AdminPlan};
export function previewCityAction(r:RunState,command:CityCommand):{ok:boolean;reason?:string;state:RunState;deltas:CityDelta[];report:string[]} {
 const clone=structuredClone(r),before=activeCity(r);const result=command.kind==='card'?playAdminCard(clone,command.uid):command.kind==='end'?(r.campaign?.world?endWorldTurn(clone):endAdminPhase(clone)):delegateCity(clone,command.plan);const after=activeCity(clone),fields:CityField[]=['life','order','security','production','food','materials','people','readiness'];
 return {...result,state:clone,deltas:before&&after?fields.map(field=>({field,before:amount(before,field),after:amount(after,field)})).filter(d=>d.before!==d.after):[],report:after?.report??[]};
}
function cardScore(r:RunState,card:AdminCard,plan:AdminPlan){const c=activeCity(r)!,p=previewCityAction(r,{kind:'card',uid:card.uid});if(!p.ok)return -Infinity;const after=activeCity(p.state)!,buildFamilies:Record<CityBuild,AdminFamily[]>={settlement:['relief','farm','records'],trade:['trade','intel','works'],military:['military','security','works']};
 let value=1;for(const d of p.deltas){const weight=plan==='life'&&['life','order'].includes(d.field)?3:plan==='military'&&['readiness','security'].includes(d.field)?3:plan==='production'&&['production','materials'].includes(d.field)?3:plan==='support'&&['food','people'].includes(d.field)?3:1;value+=(d.after-d.before)*weight;}
 value+=(after.stats.resolved-c.stats.resolved)*20+after.issues.reduce((n,i)=>n+i.progress,0)-c.issues.reduce((n,i)=>n+i.progress,0);
 if(plan==='issues')value+=(after.issues.filter(i=>i.status==='resolved').length-c.issues.filter(i=>i.status==='resolved').length)*30;
 if(plan==='combo'&&buildFamilies[c.build].includes(ADMIN_CARDS[card.id].family))value+=15;if(plan==='conserve'&&(ADMIN_CARDS[card.id].food??0)>0)value-=20;return value;
}
export function delegateCity(r:RunState,plan:AdminPlan):Result {
 const check=adminCheck(r);if(!check.ok)return check;const c=activeCity(r)!;if(!['life','military','production','issues','combo','support','random','conserve'].includes(plan))return no('없는 운영 방침입니다.');c.plan=plan;
 // Finite same-engine choices, no free resources, buildings or appointments.
 for(let step=0;step<8;step++){const cards=c.hand.map(uid=>c.cards.find(card=>card.uid===uid)!).filter(card=>canAdminCard(r,card.uid).ok);if(!cards.length)break;const chosen=plan==='random'?sample(r.campaign!,cards,1)[0]:cards.sort((a,b)=>cardScore(r,b,plan)-cardScore(r,a,plan)||a.uid-b.uid)[0];if(plan==='conserve'&&cardScore(r,chosen,plan)<0)break;playAdminCard(r,chosen.uid);}
 if(r.campaign!.world&&!c.uses.worldInternal)return ok;return endAdminPhase(r);
}
export function setCityBuild(r:RunState,build:CityBuild):Result {if(!adminCheck(r).ok||!Object.hasOwn(BUILDS,build))return no('내정 중 운영 방침을 선택하세요.');activeCity(r)!.build=build;return ok;}
export function selectOwnedCity(r:RunState,id:CityId):Result {const c=r.campaign;if(!c||!['admin','ready'].includes(c.stage)||c.activity||c.cities[id]?.owner!=='player')return no('운영할 점령 도시를 선택하세요.');c.active=id;c.stage=c.cities[id]!.phase>=c.cities[id]!.limit&&c.cities[id]!.ap===0?'ready':'admin';return ok;}
export function recallCityGeneral(r:RunState,id:string):Result {
 const camp=r.campaign,c=activeCity(r);if(!camp||!(camp.stage==='ready'||camp.world?.stage==='strategy')||!c||!Object.values(c.roles).includes(id)||c.food<2)return no('내정 종료 도시에서 식량 2로 주둔 장수를 복귀시킬 수 있습니다.');
 const row=GENERALS[id].row==='rear'?'rear':'front';if(r.generals.length>=4||r.generals.filter(g=>g.row===row).length>=2)return no('군단 진형에 빈자리가 필요합니다.');
 for(const role of Object.keys(c.roles) as AdminRole[])if(c.roles[role]===id)c.roles[role]=null;c.food-=2;c.readiness=Math.max(0,c.readiness-5);r.generals.push({id,row});restoreOfficerAssets(r,id);
 syncPersonnelDecks(r);const removed=new Set(c.cards.filter(card=>card.owner===id).map(card=>card.uid));c.cards=c.cards.filter(card=>!removed.has(card.uid));for(const pile of ['hand','draw','discard','exhaust'] as const)c[pile]=c[pile].filter(uid=>!removed.has(uid));cityRecord(c,`${GENERALS[id].name} 군단 복귀. 식량 −2·주둔 준비 −5. 담당 공석 정책의 생산은 정지.`);return ok;
}
export function supplyQuote(r:RunState,target:CityId,focus:'food'|'troops'|'intel') {
 const camp=r.campaign!,city=activeCity(r)!;const road=camp.roads.find(road=>(road.a===city.id&&road.b===target)||(road.b===city.id&&road.a===target));const safe=city.metrics.security>=40,network=camp.captured.length-1;
 const capacity=Math.max(2,(road?.condition??1)*2-(road?.distance??1)+(safe?2:0)+(has(city,'relay')&&policy(city,'relay')?2:0)+network),reserve=focus==='food'?Math.min(city.food,capacity):Math.min(city.food,3);
 const loss=road?.condition===1||!safe?1:0;const food=Math.max(0,reserve-loss),troops=focus==='troops'?Math.min(city.people,Math.floor(city.readiness/5),capacity):0,intel=focus==='intel'?Math.min(3,1+Number(has(city,'archives'))+Number(city.groups.locals>=2)):0;
 return {capacity,cost:reserve,loss,food,troops,intel,network,orderLoss:city.food-reserve<4?5:0,road};
}
export function departCity(r:RunState,target:CityId,focus:'food'|'troops'|'intel'):Result {
 if(r.campaign?.world)return no('본편은 전도의 군단 편성으로 출진하세요.');
 const camp=r.campaign,city=activeCity(r);if(!camp||!(camp.stage==='ready'||camp.world?.stage==='strategy')||!city||!Object.hasOwn(CITY_DEFS,target)||!['food','troops','intel'].includes(focus)||camp.captured.includes(target))return no('내정 종료 후 인접 미점령 도시를 선택하세요.');
 const q=supplyQuote(r,target,focus);if(!q.road)return no('연결된 원정 통로가 없습니다.');if(!r.generals.length)return no('출전 장수가 필요합니다.');
 city.food-=q.cost;city.people-=q.troops;city.readiness=Math.max(0,city.readiness-q.troops*2);city.metrics.order=Math.max(0,city.metrics.order-q.orderLoss);cityRecord(city,`출발: 식량 ${q.cost}, 운송 손실 ${q.loss}, 보충 ${q.troops}, 정보 ${q.intel}.`);
 const fresh=newRegionalRun(Math.floor(nextFloat(camp)*2147483647)+1,r.lordId,r.difficulty,r.unlocked);const generals:GeneralInst[]=r.generals.map(g=>({...g}));const kept={generals,deck:r.deck,relics:r.relics,debateBuild:r.debateBuild,hp:Math.max(20,Math.min(r.maxHp,r.hp+q.troops*2)),maxHp:r.maxHp,food:8+q.food};
 camp.target=target;camp.stage='expedition';camp.method=null;camp.approach={choices:[],intel:q.intel,supply:0,trust:city.groups.locals>=2?1:0,cut:0,damage:0};camp.departures++;
 Object.assign(r,fresh,kept,{campaign:camp});r.history.push(`${CITY_DEFS[city.id].name} 도시 운영 지원: 군량 ${r.food}, 병력 ${r.hp}, 정보 ${q.intel}. 원정 교리는 다시 선택.`);
 initializeCityCorridor(r,city.id,target);
 r.map[7][0].encounterId=CITY_DEFS[target].encounter;
 if(q.intel&&r.geography){for(const id of Object.keys(r.geography.scout))r.geography.scout[id]=Math.max(r.geography.scout[id],Math.min(3,q.intel));}
 if(city.pact?.kind==='guard')r.social.support={block:5,damage:2,rewardPenalty:0};if(city.pact?.kind==='trade')r.social.passage={moves:2,discount:1};
 return ok;
}
export function completeCampaign(r:RunState):Result {const c=r.campaign;if(!c||c.stage!=='ready'||c.captured.length!==3)return no('세 도시의 정벌을 완료하세요.');c.stage='complete';return ok;}


