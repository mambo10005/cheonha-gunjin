import {syncPersonnelDecks,personnelDiplomacy} from './personnel-rules.ts';
import {personnelTurn} from './prologue.ts';
// Campaign owns the ledger. RunState is the existing card/negotiation engine's adapter.
// Its army HP/food/decks are authoritative: no second ArmyState stock is maintained.
import {newCityCampaign,occupyCity,activeCity,delegateCity,endAdminPhase} from './city.ts';
import {initializeCityExploration,syncExploration} from './city-exploration.ts';
import {newRegionalRun,moveTo} from './run.ts';
import {initializeCityCorridor} from './geography.ts';
import {nextFloat,shuffle} from './rng.ts';
import {GENERALS} from '../data/generals.ts';
import {CITY_DEFS} from '../data/cities.ts';
import type {CampaignState,CityId,AdminPlan} from './city-types.ts';
import type {StartType,Rising,Doctrine} from './world-types.ts';
import type {RunState} from './types.ts';
import type {Result} from './run.ts';
export const WORLD_SEED=111001;
export const WORLD_CITIES=Object.keys(CITY_DEFS) as CityId[];
export const RECRUITS=['guojia','chengpu','chengong','zhangliao','dianwei','caoren','local_captain','local_scribe'];
const ok:Result={ok:true},no=(reason:string):Result=>({ok:false,reason});
const cap=(n:number,max=200)=>Math.max(0,Math.min(max,n));
export function worldOf(r:RunState){return r.campaign?.world;}
export function bindCampaign(r:RunState):CampaignState {
 const c=r.campaign!;Object.defineProperty(c,'activeExpedition',{configurable:true,enumerable:false,get:()=>r});return c;
}
function record(r:RunState,text:string){const w=worldOf(r)!;w.history.push(`${w.turn}턴 · ${text}`);w.history=w.history.slice(-200);}
export function newWorldCampaign(seed=WORLD_SEED):CampaignState {
 const r=newCityCampaign(seed);const c=r.campaign!;
 c.campaignId=`henan-${seed}`;c.saveVersion=7;c.scenarioId='henan-190';c.roster=['chengong'];r.generals=[{id:'chengong',row:'rear'}];r.hp=0;r.food=0;
 const cities=shuffle(c,[...WORLD_CITIES]);const candidates=[...shuffle(c,RECRUITS.slice(0,6)),...RECRUITS.slice(6)].map((id,i)=>({id,city:cities[i%3],clue:0,recruited:false}));
 c.world={stage:'setup',view:'map',turn:0,ap:3,startCity:'xingyang',startType:'wanderer',founder:'chengong',doctrine:'people',perk:'granary',factionName:'하남 의군',flagColor:'#b95339',goal:'core',treasury:0,prestige:0,capital:null,
 preparation:{step:1,ap:3,funds:4,food:4,troops:0,support:1,exposure:0,base:false,actions:[],failed:0,workers:[]},rising:null,reserveOfficers:[],candidates,
 owners:{xingyang:'neutral',chenggao:'rival',gong:'neutral'},management:{},rival:{name:'하남 수비 연합',core:'chenggao',food:32,funds:16,troops:24,people:12,officer:'rival_guard',army:null,plan:'방비 강화',losses:0},neutral:{name:'하남 상단·향촌 연합',food:18,trust:0},diplomacy:{truceUntil:0,tradeUntil:0,subordinate:false,obligation:0},operation:null,operationSerial:0,growth:{},discoveries:{},history:['190년 하남윤 역사 지명 위의 가상 거병 시나리오. 인물 배치·세력·도로·거점은 창작.'],victory:[],stats:{risingStep:0,firstDeparture:0,conquests:0,recruits:0,starved:0,returns:0,aiAttacks:0,defenses:0,cityIncome:{}}};
 return bindCampaign(r);
}
export function configureStart(r:RunState,city:CityId,type:StartType,founder:'chengong'|'zhangliao'|'guojia',doctrine:Doctrine,perk:'credit'|'granary'|'network'):Result {
 const c=r.campaign,w=worldOf(r);if(!c||!w||w.stage!=='setup'||!WORLD_CITIES.includes(city)||!['wanderer','castellan'].includes(type)||!['chengong','zhangliao','guojia'].includes(founder)||!['people','law','strategy'].includes(doctrine)||!['credit','granary','network'].includes(perk))return no('시작 설정이 올바르지 않습니다.');
 w.startCity=city;w.startType=type;w.founder=founder;w.doctrine=doctrine;w.perk=perk;c.roster=[founder];r.generals=[{id:founder,row:founder==='chengong'?'rear':'front'}];
 w.candidates.forEach(p=>{if(p.id===founder)p.recruited=true;});
 w.rival.core=city==='chenggao'?'gong':'chenggao';w.owners={xingyang:'neutral',chenggao:'neutral',gong:'neutral'};w.owners[w.rival.core]='rival';
 const d=CITY_DEFS[city],p=w.preparation;p.funds=(city==='gong'?8:5)+(perk==='credit'?5:0);p.food=(city==='xingyang'?9:6)+(perk==='granary'?5:0);p.support=city==='gong'?1:2;p.troops=city==='chenggao'?6:2;p.base=type==='castellan';
 if(perk==='credit'){p.support--;p.exposure++;}if(perk==='granary')p.funds=Math.max(0,p.funds-2);if(perk==='network'){p.funds--;const candidate=w.candidates.find(p=>!p.recruited&&p.city===city);if(candidate)candidate.clue=1;}
 c.target=city;w.stage=type==='castellan'?'founding':'preparing';w.history.push(`${d.name} · ${type==='wanderer'?'재야 거병':'소규모 성주'} · ${GENERALS[founder].name}. 특전과 약점을 자원에 반영.`);return ok;
}
function enlist(r:RunState,id:string){const c=r.campaign!,w=worldOf(r)!;if(c.roster.includes(id))return false;c.roster.push(id);const row=GENERALS[id].row==='rear'?'rear':'front';if(r.generals.length<4&&r.generals.filter(g=>g.row===row).length<2)r.generals.push({id,row});else w.reserveOfficers.push(id);w.stats.recruits++;w.growth[id]={combat:0,debate:0,governance:0};return true;}
export function prepareAction(r:RunState,id:string):Result {
 const w=worldOf(r);if(w?.raising)return no('카드 거병에서는 준비 카드와 경로를 사용하세요.');if(!w||w.stage!=='preparing'||w.preparation.ap<1)return no('거병 준비 행동력이 없습니다.');const p=w.preparation;
 if(!['talent','credit','grain','recruit','support','base','conceal'].includes(id)||p.actions.includes(id))return no('각 준비 단계에서 같은 활동은 한 번만 가능합니다.');
 if(id==='grain'&&p.funds<2||id==='recruit'&&(p.funds<1||p.food<2)||id==='base'&&p.funds<2)return no('군량 매입은 자금 2, 모집은 자금 1·군량 2, 거점 확보는 자금 2가 필요합니다.');
 if(id==='talent'){const candidate=w.candidates.find(c=>!c.recruited&&c.city===w.startCity)??w.candidates.find(c=>!c.recruited);if(!candidate)return no('현재 소개받을 인재가 없습니다.');if(p.funds<1)return no('탐문 자금 1 필요.');p.funds--;candidate.clue++;if(candidate.clue>=2){enlist(r,candidate.id);candidate.recruited=true;record(r,`${GENERALS[candidate.id].name}: 추천서와 만남을 통해 합류.`);}else record(r,`${GENERALS[candidate.id].name}의 단서 확보. 다음 준비 단계에서 다시 탐문하여 만남.`);}
 if(id==='credit'){p.funds+=4;p.exposure+=2;p.support=Math.max(0,p.support-1);w.diplomacy.obligation+=2;}
 if(id==='grain'){p.funds-=2;p.food+=6;p.exposure++;}
 if(id==='recruit'){p.funds--;p.food-=2;p.troops+=12;p.exposure+=2;}
 if(id==='support'){p.support+=2;p.exposure++;}
 if(id==='base'){if(p.base)return no('이미 거점이 있습니다.');p.funds-=2;p.base=true;p.exposure+=2;}
 if(id==='conceal'){p.exposure=Math.max(0,p.exposure-3);p.support=Math.max(0,p.support-1);}
 p.ap--;p.actions.push(id);record(r,`거병 준비 ${id}: 자금 ${p.funds}, 군량 ${p.food}, 병력 ${p.troops}, 지지 ${p.support}, 노출 ${p.exposure}.`);return ok;
}
export function advancePreparation(r:RunState):Result {
 const w=worldOf(r);if(w?.raising)return no('현재 장소의 카드 거병 단계 종료를 사용하세요.');if(!w||w.stage!=='preparing')return no('거병 준비 기간이 아닙니다.');const p=w.preparation;
 p.step++;p.food=Math.max(0,p.food-1);p.exposure++;
 if(p.step>5||p.exposure>=12){p.failed++;p.step=1;p.funds=Math.floor(p.funds/2);p.troops=Math.floor(p.troops/2);p.support=Math.max(0,p.support-2);p.exposure=2;p.base=false;record(r,'준비 발각·기간 만료: 자금·병력 절반 손실, 인재·단서는 보존하고 재거병 준비.');}
 p.ap=3;p.actions=[];p.workers=[];return ok;
}
export function risingAllowed(r:RunState,method:Rising):Result {
 const w=worldOf(r);if(!w||!['preparing','founding'].includes(w.stage)||!['volunteers','officials','merchants'].includes(method))return no('거병할 수 없습니다.');const p=w.preparation;
 if(w.raising){const q=w.raising;return q.phase==='result'&&!q.converted&&q.grade&&!['escaped','lost'].includes(q.grade)?ok:no('최종 설전·대결을 해결한 뒤 세력을 창설하세요.');}
 if(w.startType==='castellan')return ok;
 if(p.exposure>=12)return no('노출 12 이상에서는 거병할 수 없습니다. 감시 회피 또는 다음 준비 단계의 실패 정산이 필요합니다.');
 if(p.funds<4||p.food<8||p.troops<12||p.support<3||!p.base||r.campaign!.roster.length<2)return no('자금 4·군량 8·병력 12·지지 3·거점·인재 2명이 필요합니다.');
 if(method==='officials'&&p.exposure>8)return no('관리 협력은 노출 8 이하가 필요합니다.');if(method==='merchants'&&p.funds<6)return no('상단 후원은 초기 자금 6 이상이 필요합니다.');return ok;
}
export function foundFaction(r:RunState,method:Rising,name='하남 의군',color='#b95339',goal:'core'|'league'='core'):Result {
 const check=risingAllowed(r,method);if(!check.ok)return check;const c=r.campaign!,w=worldOf(r)!,p=w.preparation;
 if(!name.trim()||name.length>24||!/^#[0-9a-f]{6}$/i.test(color)||!['core','league'].includes(goal))return no('세력명 1~24자·군기 색·목표를 확인하세요.');
 w.factionName=name.trim();w.flagColor=color;w.goal=goal;w.rising=method;w.treasury=p.funds;w.prestige=p.support;w.capital=w.startCity;w.stage='strategy';w.turn=1;w.ap=3;w.stats.risingStep=p.step;
 c.target=w.startCity;c.stage='occupation';c.method='inside';c.approach={choices:[],intel:0,supply:0,trust:p.support,cut:0,damage:method==='volunteers'?1:0};
 occupyCity(r,method==='officials'?'shared':method==='merchants'?'merchant':'military');const city=activeCity(r)!;
 city.food=p.food;city.reserveTroops=p.troops+(w.startType==='castellan'?22:0);city.funds=0;city.training=method==='volunteers'?0:1;
 if(method==='merchants'){w.treasury+=5;w.diplomacy.obligation+=3;city.groups.traders=2;}if(method==='officials'){city.metrics.order+=3;city.promises.push({id:'authority',due:3,status:'active'});}if(method==='volunteers'){city.reserveTroops+=6;city.metrics.production=Math.max(0,city.metrics.production-4);}
 if(w.startType==='castellan'){city.materials+=4;w.rival.troops+=8;}
 if(w.doctrine==='people')city.metrics.life=cap(city.metrics.life+5,100);if(w.doctrine==='law'){city.groups.locals=Math.max(-3,city.groups.locals-1);}if(w.doctrine==='law')city.metrics.security=cap(city.metrics.security+5,100);if(w.doctrine==='strategy'){city.readiness=cap(city.readiness+8,100);city.ap=3;}
 configureOwnedCity(r,city.id);p.funds=0;p.food=0;p.troops=0;r.hp=0;r.food=0;record(r,`${w.factionName} 창설: ${method}, ${w.doctrine}. 준비 자원을 근거지와 금고로 이동.`);return ok;
}
export function configureOwnedCity(r:RunState,id:CityId){
 if(r.campaign!.cities[r.campaign!.world!.startCity]?.exploration&&!r.campaign!.cities[id]!.exploration)initializeCityExploration(r,r.campaign!.cities[id]!);
 const c=r.campaign!,city=c.cities[id]!,w=worldOf(r)!;w.capital??=id;city.limit=100000;city.phase=Math.max(1,w.turn);city.ap=w.doctrine==='strategy'?3:4;city.settledTurn=0;city.delegated=id!==w.capital;city.funds??=0;city.reserveTroops??=Math.max(8,Math.floor(city.readiness/2));city.training??=0;
 w.owners[id]='player';w.management[id]??=id===w.capital?'direct':'issues';c.stage='admin';w.view='map';
 if(w.operation){if(id===w.rival.core){city.food=w.rival.food;city.reserveTroops=Math.floor(w.rival.troops/3);city.funds=w.rival.funds;city.people=w.rival.people;w.rival.food=0;w.rival.troops=0;w.rival.funds=0;w.rival.people=0;w.rival.army=null;}returnArmy(r,id);w.stats.conquests++;w.prestige+=3;w.operation=null;w.stage='strategy';}
 record(r,`${CITY_DEFS[id].name} 세력망 편입. 고정 5단계 없이 캠페인 턴에서 운영.`);
}
export function recruitTalent(r:RunState,id:string):Result {
 if(r.campaign?.personnel?.officers[id])return no('이 인재는 도시 탐색의 부탁·협력·등용 과정으로 합류합니다.');
 const c=r.campaign,w=worldOf(r),city=activeCity(r);if(!c||!w||w.stage!=='strategy'||!city||w.ap<1||w.treasury<2)return no('전략 행동력 1·금고 2와 운영 도시가 필요합니다.');const p=w.candidates.find(p=>p.id===id);
 if(!p||p.recruited||p.city!==city.id)return no('이 도시의 발견 가능한 인재를 선택하세요.');
 // Deterministic clues/requirements; candidates never reroll on reload.
 w.ap--;w.treasury-=2;p.clue++;
 if(p.clue>=2&&(city.metrics.order>=35||city.groups.locals>=1||w.prestige>=5)){p.recruited=true;enlist(r,id);record(r,`${GENERALS[id].name} 등용: 안정·관계·명망 조건 충족.`);}else record(r,`${GENERALS[id].name} 단서 ${p.clue}/2. 합류 요구: 안정 35 또는 주민 관계 1 또는 명망 5.`);return ok;
}
export function muster(r:RunState,mode:'levy'|'train'):Result {
 const w=worldOf(r),city=activeCity(r);if(!w||w.stage!=='strategy'||!city||city.ap<1||!['levy','train'].includes(mode))return no('도시 행동력 1이 필요합니다.');
 if(mode==='levy'){if(w.treasury<2||city.people<2||city.food<2)return no('금고 2·인력 2·식량 2 필요.');w.treasury-=2;city.people-=2;city.food-=2;city.reserveTroops=cap((city.reserveTroops??0)+12);city.metrics.life=cap(city.metrics.life-(w.doctrine==='people'?5:3),100);city.metrics.production=cap(city.metrics.production-2,100);}
 else {if(w.treasury<1||city.food<2||(city.reserveTroops??0)<8)return no('금고 1·식량 2·예비병 8 필요.');w.treasury--;city.food-=2;city.training=Math.min(2,(city.training??0)+1);city.readiness=cap(city.readiness+5,100);}
 city.ap--;record(r,mode==='levy'?'모병: 생산 인력을 예비병으로 전환.':'훈련: 다음 전투 시작 방비에 반영.');return ok;
}
export function cityRevenue(r:RunState,id:CityId,harsh=false):Result {const w=worldOf(r),city=r.campaign?.cities[id];if(!w||w.stage!=='strategy'||!city||city.ap<1)return no('운영 도시 행동력 1 필요.');const amount=harsh?5:Math.min(city.funds??0,4);if(!amount)return no('이전할 도시 수입이 없습니다.');if(!harsh)city.funds!-=amount;else{city.metrics.life=cap(city.metrics.life-5,100);city.metrics.order=cap(city.metrics.order-4,100);city.metrics.production=cap(city.metrics.production-2,100);city.groups.traders=Math.max(-3,city.groups.traders-1);}w.treasury+=amount;city.ap--;record(r,`${CITY_DEFS[id].name} ${harsh?'강제 세금':'수입 이전'} ${amount}.`);return ok;}
export function setManagement(r:RunState,id:CityId,plan:AdminPlan|'direct'):Result {const w=worldOf(r),c=r.campaign?.cities[id];if(!w||w.stage!=='strategy'||!c||!['direct','life','military','production','issues','support','conserve'].includes(plan))return no('소유 도시와 운영 방침을 선택하세요.');if(plan==='direct'&&Object.entries(w.management).filter(([other,p])=>other!==id&&p==='direct').length>=2)return no('직접 통치는 최대 두 도시입니다.');w.management[id]=plan;c.delegated=plan!=='direct';return ok;}
export function openWorldCity(r:RunState,id:CityId):Result {const c=r.campaign,w=worldOf(r);if(!c||!w||w.stage!=='strategy'||!c.cities[id])return no('전략 단계에서 소유 도시를 선택하세요.');c.active=id;c.stage='admin';w.view='city';return ok;}
export function mobilizeOfficer(r:RunState,id:string):Result {const w=worldOf(r);if(!w||w.stage!=='strategy'||!w.reserveOfficers.includes(id)||w.ap<1)return no('대기 인재와 전략 행동력 1 필요.');if(r.campaign?.personnel?.officers[id]?.duty&&r.campaign.personnel.officers[id].duty!=='available')return no('임무·휴식 중에는 군단에 편성할 수 없습니다.');const row=GENERALS[id].row==='rear'?'rear':'front';if(r.generals.length>=4||r.generals.filter(g=>g.row===row).length>=2)return no('진형은 전열·후열 각 2명입니다.');w.ap--;w.reserveOfficers=w.reserveOfficers.filter(x=>x!==id);r.generals.push({id,row});restoreOfficerAssets(r,id);syncPersonnelDecks(r);return ok;}
export function reserveOfficer(r:RunState,id:string):Result {const w=worldOf(r);if(!w||w.stage!=='strategy'||!r.generals.some(g=>g.id===id)||r.generals.length<=1)return no('군단 후보는 최소 1명 남겨야 합니다.');r.generals=r.generals.filter(g=>g.id!==id);w.reserveOfficers.push(id);archiveOfficerAssets(r,id);syncPersonnelDecks(r);return ok;}
export function worldRoute(r:RunState,target:CityId,objective:'conquest'|'recon'='conquest'){
 const c=r.campaign!,city=activeCity(r)!;const road=c.roads.find(x=>x.a===city.id&&x.b===target||x.b===city.id&&x.a===target);
 const count=objective==='recon'?2:(road?.distance??1)===2?4:3;const route=count===2?[0,2]:count===3?[0,2,7]:[0,2,5,7];const terrain=road?.distance===2?'mountain':target==='gong'?'river':'plains';const cost=terrain==='mountain'?count*2:count;
 const supply=c.captured.filter(id=>c.roads.some(x=>(x.a===city.id&&x.b===id)||(x.b===city.id&&x.a===id))),loss=road?.condition===1?1:0,capacity=12+(road?.condition??1)*3+supply.length*4+(city.districts.some(d=>d.facility==='relay'&&d.damage<3)?4:0);
 return {road,route,terrain,cost:cost+loss,loss,capacity,defense:(city.reserveTroops??0)+Math.floor(city.readiness/2),supply,retreat:city.id};
}
export function sendWorldSupply(r:RunState,target:CityId,amount:number):Result {const w=worldOf(r),source=activeCity(r),dest=r.campaign?.cities[target];if(!w||w.stage!=='strategy'||!source||!dest||source.id===target||source.ap<1||!Number.isInteger(amount)||amount<1||amount>source.food)return no('소유 도시 사이에서 도시 행동력 1과 실제 비축 식량이 필요합니다.');const q=worldRoute(r,target);if(!q.road||amount>q.capacity||(dest.food+amount-q.loss)>200)return no('연결 도로·운송량·수신 도시 비축 한도를 확인하세요.');source.food-=amount;source.ap--;dest.food+=Math.max(0,amount-q.loss);record(r,`${CITY_DEFS[source.id].name} → ${CITY_DEFS[target].name} 보급: 식량 ${amount} 차감, 운송 손실 ${q.loss}, 도착 ${Math.max(0,amount-q.loss)}. 소유 도시 연결이 운송량 ${q.capacity}에 반영.`);return ok;}
export function departWorld(r:RunState,target:CityId,troops:number,food:number,objective:'conquest'|'recon'='conquest'):Result {
 const c=r.campaign,w=worldOf(r),city=activeCity(r);if(!c||!w||w.stage!=='strategy'||!city||w.operation||!WORLD_CITIES.includes(target)||target===city.id||!['conquest','recon'].includes(objective)||objective==='conquest'&&w.owners[target]==='player')return no('전략 지도에서 인접 목표를 선택하세요.');
 syncPersonnelDecks(r);const q=worldRoute(r,target,objective);if(!q.road||!Number.isInteger(troops)||troops<12||troops>r.maxHp||!Number.isInteger(food)||food<q.cost||food>city.food||food>q.capacity||(city.reserveTroops??0)<troops||w.ap<1||w.treasury<2||!r.generals.length)return no(`출진: 금고 2·전략 행동력 1, 병력 12~${r.maxHp}, 군량 ${q.cost}~${q.capacity}, 도시 비축 필요.`);
 if(target===w.rival.core&&w.diplomacy.truceUntil>=w.turn)return no('휴전 기간에는 상대 핵심 도시 정벌 불가. 정찰은 휴전 위반으로 간주됩니다.');
 city.reserveTroops!-=troops;city.food-=food;w.ap--;w.treasury-=2;
 const fresh=newRegionalRun(Math.floor(nextFloat(c)*2147483647)+1,r.lordId,r.difficulty,r.unlocked);
 const kept={generals:r.generals,deck:r.deck,relics:r.relics,debateBuild:r.debateBuild,maxHp:r.maxHp,build:r.build,history:r.history,social:r.social};
 // Keep campaign growth and accords. Ended coordinates stay archived; unresolved obligations aren't silently deleted.
 for(const a of kept.social.accords.agreements)if(a.status==='active')a.status='expired';
 const armyGrowth=kept.build.growth;kept.build.growth=Object.fromEntries(Object.entries(armyGrowth).filter(([id])=>kept.generals.some(g=>g.id===id)));
 Object.assign(r,fresh,kept,{hp:troops,food:food-q.loss,campaign:c});c.target=target;c.stage='expedition';c.method=null;c.approach={choices:[],intel:0,supply:0,trust:city.groups.locals>0?1:0,cut:0,damage:0};c.departures++;
 w.operation={id:++w.operationSerial,origin:city.id,target,objective,route:q.route,index:0,cost:q.cost,returned:false,training:city.training??0};w.stage='operation';w.view='map';if(!w.stats.firstDeparture)w.stats.firstDeparture=w.turn;
 initializeCityCorridor(r,city.id,target);r.geography!.corridor!.steps=q.route;r.map[7][0].encounterId=CITY_DEFS[target].encounter;
 for(const floor of q.route)for(const node of r.map[floor])if(floor!==7)node.terrain=q.terrain as 'plains'|'mountain'|'river';
 for(const node of r.map[q.route[1]]){node.type='event';node.eventId='envoy';delete node.encounterId;}
 if(q.route.length===4)for(const node of r.map[q.route[2]]){node.type='supply';delete node.encounterId;delete node.eventId;}
 // Reachable corridor: actual card battle, existing diplomacy event, then gate. No fabricated battle result.
 r.map[q.route[0]][0].type='battle';r.map[q.route[0]][0].encounterId='e_bandit';
 record(r,`${CITY_DEFS[city.id].name} → ${CITY_DEFS[target].name} 출진. 병력 ${troops}·군량 ${food} 차감, 행군 ${q.route.length}구간.`);bindCampaign(r);return ok;
}
export function worldMoves(r:RunState){const op=worldOf(r)?.operation;if(!op||r.screen!=='map'||r.campaign!.stage!=='expedition')return [];return r.map[op.route[op.index]??7]??[];}
export function marchWorld(r:RunState,col:number):Result {
 const w=worldOf(r),op=w?.operation;if(!w||!op||r.screen!=='map'||r.campaign!.stage!=='expedition')return no('행군 지도에서 경로를 선택하세요.');const next=op.route[op.index];if(next===undefined||!r.map[next]?.[col])return no('연결된 행군 경로가 아닙니다.');
 // Adapter skips unused floors without inventing an extra travel payment. Core moveTo still charges terrain/accord costs.
 const prior={floor:r.floor,col:r.col,trail:r.mapTrail};r.floor=next-1;r.col=next===0?-1:0;if(next>0)r.map[next-1][0].next=[0,1,2].filter(i=>!!r.map[next][i]);r.mapTrail=[];
 const result=moveTo(r,col);if(!result.ok||r.floor!==next){r.floor=prior.floor;r.col=prior.col;r.mapTrail=prior.trail;return result;}op.index++;
 for(const g of r.generals)r.campaign!.fatigue[g.id]=Math.min(6,(r.campaign!.fatigue[g.id]??0)+1);
 if(op.objective==='recon'&&op.index===op.route.length&&r.screen==='map')return retreatWorld(r,true);return ok;
}
export function finishReconIfReady(r:RunState){const w=worldOf(r),op=w?.operation;if(op?.objective==='recon'&&op.index>=op.route.length&&r.screen==='map'&&r.pending.kind==='none'){w!.discoveries[op.target]={turn:w!.turn,source:'군단 현지 정찰',strength:w!.rival.troops};retreatWorld(r,true);}}
function returnArmy(r:RunState,destination:CityId){const c=r.campaign!,w=worldOf(r)!,city=c.cities[destination];if(!city)return;city.reserveTroops=cap((city.reserveTroops??0)+r.hp);city.food=cap(city.food+r.food);r.hp=0;r.food=0;w.stats.returns++;record(r,`${CITY_DEFS[destination].name} 귀환: 생존 병력·잔여 군량을 도시 비축으로 이동. 덱·설전 성장·약속 보존.`);}
export function retreatWorld(r:RunState,recon=false):Result {
 const c=r.campaign,w=worldOf(r),op=w?.operation;if(!c||!w||!op||op.returned)return no('귀환할 원정군이 없습니다.');if(!recon&&r.screen==='battle'&&r.battle?.result==='ongoing')return no('전투 중에는 판정 후 철수하세요.');
 op.returned=true;const destination=c.cities[op.origin]?op.origin:c.captured[0];if(!destination){w.stage='failed';record(r,'마지막 거점과 회복 기반 소실.');return ok;}returnArmy(r,destination);
 r.battle=null;r.pending={kind:'none'};r.screen='map';c.active=destination;c.stage='admin';w.operation=null;w.stage='strategy';w.view='map';c.activity=null;record(r,recon?'정찰 작전 완료.':'원정 철수: 살아남은 자원만 반환.');return ok;
}
export function settleCityWorld(r:RunState):Result {
 const c=r.campaign,w=worldOf(r),city=activeCity(r);if(!c||!w||w.stage!=='strategy'||!city||city.settledTurn===w.turn)return no('이미 정산한 도시입니다. 캠페인 턴 종료 시 한 번 정산됩니다.');
 // endAdminPhase uses this function only as a guard: worldInternal distinguishes global settlement.
 return no('도시마다 턴을 끝내지 않습니다. 전도에서 캠페인 턴 종료를 사용하세요.');
}
export function reconcileWorld(r:RunState){
 const c=r.campaign,w=worldOf(r);if(!c||!w)return;
 for(const g of r.generals)if(!c.roster.includes(g.id)){c.roster.push(g.id);const p=w.candidates.find(p=>p.id===g.id);if(p)p.recruited=true;w.stats.recruits++;}
 const working=new Set([...r.generals.map(g=>g.id),...Object.values(c.cities).flatMap(city=>Object.values(city!.roles).filter((id):id is string=>!!id))]);
 w.reserveOfficers=c.roster.filter(id=>!working.has(id));finishReconIfReady(r);personnelTurn(r);syncPersonnelDecks(r);
}
export function archiveOfficerAssets(r:RunState,id:string){const w=worldOf(r);if(!w)return;if(r.build.growth[id]){w.officerBranches??={};w.officerBranches[id]=r.build.growth[id];delete r.build.growth[id];}if(r.debateBuild.representative===id){w.personalDebate??={};w.personalDebate[id]=r.debateBuild.cards.filter(card=>card.owner===id);r.debateBuild.cards=r.debateBuild.cards.filter(card=>card.owner!==id);r.debateBuild.representative=null;}if(r.debateBuild.assistant===id)r.debateBuild.assistant=null;}
export function restoreOfficerAssets(r:RunState,id:string){const w=worldOf(r);if(w?.officerBranches?.[id]){r.build.growth[id]=w.officerBranches[id];delete w.officerBranches[id];}}
export function endWorldTurn(r:RunState):Result {
 const c=r.campaign,w=worldOf(r);if(!c||!w||w.stage!=='strategy'||w.operation)return no('원정 종료 후 캠페인 턴을 정산하세요.');const active=c.active;
 for(const id of c.captured){const city=c.cities[id]!;if(city.settledTurn===w.turn)continue;c.active=id;c.stage='admin';
  // Internal receipt prevents recursive world-turn settlement and double delegation.
  city.uses.worldInternal=1;const plan=w.management[id]??'issues';if(plan==='direct')endAdminPhase(r);else delegateCity(r,plan);city.settledTurn=w.turn;
  const income=Math.max(0,Math.floor(city.metrics.production/15)+(city.build==='trade'?1:0)-Math.floor((city.reserveTroops??0)/35));city.funds=cap((city.funds??0)+income);w.stats.cityIncome[id]=(w.stats.cityIncome[id]??0)+income;
  const tax=Math.min(2,city.funds);city.funds-=tax;w.treasury+=tax;
  const ration=Math.ceil((city.reserveTroops??0)/20);const missing=Math.max(0,ration-city.food);city.food=cap(city.food-ration);if(missing){city.reserveTroops=cap((city.reserveTroops??0)-missing*2);w.stats.starved++;}
  for(const officer of Object.values(city.roles))if(officer){w.growth[officer]??={combat:0,debate:0,governance:0};w.growth[officer].governance++;}
 }
 const working=new Set(Object.values(c.cities).flatMap(city=>Object.values(city!.roles).filter(Boolean)));for(const id of c.roster)if(!working.has(id))c.fatigue[id]=Math.max(0,(c.fatigue[id]??0)-2);
 const wage=Math.ceil(c.roster.length/3);const shortage=Math.max(0,wage-w.treasury);w.treasury=Math.max(0,w.treasury-wage);if(shortage)w.prestige=Math.max(0,w.prestige-shortage);
 if(w.diplomacy.obligation){const pay=Math.min(w.treasury,2,w.diplomacy.obligation);w.treasury-=pay;w.diplomacy.obligation-=pay;if(!pay)w.neutral.trust--;}
 rivalTurn(r);w.turn++;w.ap=3;c.active=active&&c.cities[active]?active:c.captured[0]??null;c.stage='admin';w.view='map';
 if(!c.captured.length){w.stage='failed';record(r,'마지막 도시 소실. 캠페인 패배.');return ok;}
 for(const id of c.captured){const city=c.cities[id]!;city.phase=w.turn;city.ap=w.doctrine==='strategy'?3:city.metrics.order<25?3:4;city.used=[];delete city.uses.worldInternal;}
 personnelTurn(r);syncExploration(r);checkVictory(r);record(r,`세계 정산 완료. 금고 ${w.treasury}·봉록 ${wage}, 도시 ${c.captured.length}개. 도시 정산은 각 1회.`);return ok;
}
function rivalTurn(r:RunState){
 const c=r.campaign!,w=worldOf(r)!,ai=w.rival;if(w.owners[ai.core]!=='rival'||w.diplomacy.subordinate){ai.plan='핵심 도시 상실·공세 종료';return;}
 // Finite stock, paid recruitment, city production and consumption, no difficulty subsidy.
 const foodBefore=ai.food;ai.food=cap(ai.food+4-Math.ceil(ai.troops/12));ai.funds=cap(ai.funds+2);if(ai.people>=2&&ai.food>=3&&ai.funds>=2&&ai.troops<36){ai.people-=2;ai.food-=3;ai.funds-=2;ai.troops+=6;ai.plan='인력·식량·자금으로 모집';}
 if(ai.army&&ai.army.arrival<=w.turn){const attack=ai.army,target=c.cities[attack.target];if(target){const strength=(target.reserveTroops??0)+Math.floor(target.readiness/2)+Math.floor(target.metrics.security/3),loss=Math.max(0,attack.troops-strength);target.reserveTroops=cap((target.reserveTroops??0)-Math.ceil(attack.troops/4));target.food=cap(target.food-Math.ceil(loss/3));target.metrics.order=cap(target.metrics.order-Math.ceil(loss/2),100);target.districts.find(d=>d.id==='gate')!.damage=Math.min(4,target.districts.find(d=>d.id==='gate')!.damage+Number(loss>0));
   if(loss>18&&target.metrics.order<15&&c.captured.length>1){for(const id of Object.values(target.roles))if(id&&!w.reserveOfficers.includes(id))w.reserveOfficers.push(id);w.owners[target.id]='rival';delete c.cities[target.id];c.captured=c.captured.filter(id=>id!==target.id);delete w.management[target.id];if(w.capital===target.id)w.capital=c.captured[0];record(r,`${CITY_DEFS[target.id].name} 함락. 다른 도시로 수도·생존 인재 이동.`);}else{w.stats.defenses++;record(r,`${CITY_DEFS[target.id].name} 방어 ${strength}, 적 ${attack.troops}, 부족 ${loss}.`);}}
  ai.troops=cap(ai.troops+Math.max(0,Math.floor(attack.troops/3)));ai.losses+=Math.ceil(attack.troops*2/3);ai.army=null;
 }
 if(!ai.army&&w.turn%4===0&&w.diplomacy.truceUntil<w.turn&&ai.troops>=18&&ai.food>=8){const target=c.captured.filter(id=>c.roads.some(road=>(road.a===ai.core&&road.b===id)||(road.b===ai.core&&road.a===id))).sort((a,b)=>(c.cities[a]!.reserveTroops??0)-(c.cities[b]!.reserveTroops??0))[0];if(target){ai.troops-=12;ai.food-=8;ai.army={origin:ai.core,target,troops:12,food:8,arrival:w.turn+1};w.stats.aiAttacks++;ai.plan=`${CITY_DEFS[target].name} 공격 예고`;record(r,`경쟁 군단 출진: ${CITY_DEFS[target].name}, 병력 12·군량 8 실제 차감, 다음 턴 공격.`);}}
 if(ai.food===0){ai.troops=Math.max(0,ai.troops-2);ai.plan='군량 부족·방어 전환';}record(r,`경쟁 세력 정산: 식량 ${foodBefore} → ${ai.food}·주둔 ${ai.troops}, ${ai.plan}.`);
}
export function diplomacyWorld(r:RunState,kind:'trade'|'truce'|'submit'):Result {
 const w=worldOf(r);if(!w||w.stage!=='strategy'||w.ap<1)return no('전략 행동력 1 필요.');if(kind==='trade'){if(w.treasury<3||w.neutral.food<4||w.diplomacy.tradeUntil>=w.turn)return no('금고 3·상단 재고 4·종료된 교역 계약 필요.');w.treasury-=3;w.neutral.food-=4;const city=activeCity(r)!;city.food=cap(city.food+4);w.neutral.trust++;w.diplomacy.tradeUntil=w.turn+2;}
 else if(kind==='truce'){if(w.treasury<4||w.diplomacy.truceUntil>=w.turn)return no('금고 4 또는 기존 휴전 만료 필요.');w.treasury-=4;w.rival.funds+=4;w.diplomacy.truceUntil=w.turn+2;}
 else if(kind==='submit'){if(r.campaign!.captured.length<2||w.prestige<5||w.rival.troops>24||w.diplomacy.subordinate)return no('도시 2·명망 5·상대 주둔 24 이하 필요.');w.diplomacy.subordinate=true;}
 else return no('알 수 없는 외교.');w.ap--;personnelDiplomacy(r);record(r,`세력 외교 ${kind} 체결. 자원·기간·재고를 장부에 반영.`);return ok;
}
export function checkVictory(r:RunState){const c=r.campaign!,w=worldOf(r)!;const core=w.owners[w.rival.core]==='player'||w.diplomacy.subordinate,stable=c.captured.length>=2&&c.captured.every(id=>c.cities[id]!.metrics.order>=25),connected=c.captured.some(a=>c.captured.some(b=>a!==b&&c.roads.some(x=>(x.a===a&&x.b===b)||(x.b===a&&x.a===b))));w.victory=[`핵심 도시·종속: ${core?'충족':'미충족'}`,`2도시 안정 25 이상: ${stable?'충족':'미충족'}`,`보급망 연결: ${connected?'충족':'미충족'}`];if(core&&stable&&connected){w.stage='won';w.view='map';record(r,'지역 패권 달성. 전국 통일은 향후 확장 범위.');}}
export function migrateCityCampaign(r:RunState):CampaignState|null {
 if(!r.campaign)return null;if(r.campaign.world)return bindCampaign(r);const old=r.campaign,w=newWorldCampaign(old.seed).world!;
 w.stage=old.captured.length?'strategy':'operation';w.startCity=old.active??old.target;w.capital=old.active;w.treasury=0;w.reserveOfficers=[];w.factionName='이전 도시 캠페인';w.turn=Math.max(1,...Object.values(old.cities).map(c=>c!.phase));w.ap=3;
 for(const id of old.captured){const city=old.cities[id]!;city.funds=0;city.reserveTroops=0;city.training=0;city.delegated=id!==w.capital;city.limit=100000;city.settledTurn=0;w.owners[id]='player';w.management[id]=id===w.capital?'direct':'issues';}
 w.candidates.forEach(p=>p.recruited=old.roster.includes(p.id));w.history.push('구 도시 저장 변환: 도시 자원·배치·군단 병력·군량·카드·진행을 보존. 새 비축은 0.');
 if(['expedition','approach','conquest','occupation'].includes(old.stage)){w.stage='operation';w.operation={id:1,origin:old.active??old.target,target:old.target,objective:'conquest',route:[0,1,2,3,4,5,6,7],index:r.floor+1,cost:8,returned:false,training:0};w.operationSerial=1;}else if(old.stage==='complete'){w.stage='strategy';old.stage='admin';}
 if(w.stage==='strategy'&&old.active&&old.cities[old.active]){const city=old.cities[old.active]!;city.reserveTroops=r.hp;city.food+=r.food;r.hp=0;r.food=0;w.history.push('휴식 중 군단의 기존 병력·군량은 근거지 비축으로 이동했습니다. 총자원은 그대로입니다.');}
 old.world=w;old.campaignId=`migrated-${old.seed}`;old.saveVersion=7;old.scenarioId='henan-190';return bindCampaign(r);
}

