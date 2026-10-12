import {explorationOf,applyExplorationFounding,recoverCityExploration} from './city-exploration.ts';
import {finalizePersonnel,resetPersonnelRoute} from './prologue.ts';
import {personnelOf,contactCardAllowed,personnelExtraCost,personnelBeforePlay,personnelAfterPlay,discoverPersonnel,revealPersonnel,captureRaisingLibrary,isRecruited} from './personnel-rules.ts';
import {RAISING_CARDS,ORIGINS,REPRESENTATIVES,SCHEMES,ALLIES,NODES,PLANS} from '../data/raising.ts';
import {OFFICERS} from '../data/personnel.ts';
import {GENERALS} from '../data/generals.ts';
import {DUEL_OPPONENTS} from '../data/social.ts';
import {CARDS} from '../data/cards.ts';
import {ADMIN_CARDS,POLICY_DEFS,CITY_DEFS} from '../data/cities.ts';
import {DEBATE_CARDS} from '../data/debate-cards.ts';
import {shuffle,sample,nextFloat} from './rng.ts';
import {foundFaction} from './world.ts';
import {activeCity} from './city.ts';
import {createDebate,resolveDebateAction} from './debate.ts';
import {createDuel,resolveDuelAction} from './duel.ts';
import {prepareNegotiation} from './negotiation.ts';
import {startDeckDebate,ensureRepresentative} from './debate-deck.ts';
import type {RunState} from './types.ts';
import type {Result} from './run.ts';
import type {RaisingState,RaisingOrigin,RaisingResource,RaisingOperation,RaisingEffect,RaisingCard} from './raising-types.ts';
import type {TacticId} from '../data/tactics.ts';
import {engineOf,engineAfterPlay,currentPuzzleId,applyGateDebateRules,applyGateDuelRules,insideSkipsDuel,engineFoundingResult,applyEngineFounding,engineGateOutcome,recordSequence,engineDebateFinished,engineGateGrade,engineGateLines,profileOf} from './card-engine.ts';
export const RAISING_SEED=121001;
const grades={great:'대성공',success:'성공',conditional:'조건부 성공',incomplete:'불완전 거병',escaped:'실패 후 도피',lost:'기반 상실'};
const outcomes:Record<string,string>={success:'완전 협력',partial:'조건부 협력',failure:'결렬',win:'승리',draw:'무승부',lose:'패배',surrender:'기권'};
const promises:Record<string,string>={autonomy:'향촌 자치',shared:'향촌 공동 운영',authority:'권한 공유',ration:'군량 지급'};
const ok:Result={ok:true},no=(reason:string):Result=>({ok:false,reason});
const clamp=(n:number,max=200)=>Math.max(0,Math.min(max,n));
export const raisingOf=(r:RunState)=>r.campaign?.world?.raising;
function record(q:RaisingState,text:string){q.log.push(text);q.log=q.log.slice(-100);}
export function raisingAmount(r:RunState,field:RaisingResource):number {const w=r.campaign!.world!,q=w.raising!;if(field==='debt')return w.diplomacy.obligation;if(['funds','food','troops','support','exposure'].includes(field))return w.preparation[field as 'funds'];return q[field as 'intel'];}
function setAmount(r:RunState,field:RaisingResource,value:number){const w=r.campaign!.world!,q=w.raising!;value=clamp(value);if(field==='debt')w.diplomacy.obligation=value;else if(['funds','food','troops','support','exposure'].includes(field))w.preparation[field as 'funds']=value;else q[field as 'intel']=value;}
function addCard(q:RaisingState,id:string,hand=false):RaisingCard {const c={uid:q.nextUid++,id};q.cards.push(c);if(hand&&q.hand.length<8)q.hand.push(c.uid);else q.discard.push(c.uid);return c;}
function draw(q:RaisingState,n:number){for(let i=0;i<Math.min(4,n)&&q.hand.length<8;i++){if(!q.draw.length){if(!q.discard.length)break;q.draw=shuffle(q,q.discard.splice(0));q.stats.reshuffles++;}q.hand.push(q.draw.pop()!);}}
function route(q:RaisingState){const keys=Object.keys(NODES);return Array.from({length:6},(_,row)=>{const choices=row===0?['village','barracks','letters']:row===1?['inn','store','office']:row===4?['bandits','council','camp']:row===5?['ferry','camp','office']:sample(q,keys.filter(k=>!NODES[k].elite),3);return choices.map((kind,lane)=>({id:`${q.attempt}:${row}:${lane}`,kind,row,lane,open:row<2}));});}
export function startRaising(r:RunState,origin:RaisingOrigin='notable',assistant='guard',preserve=false):Result {
 const w=r.campaign?.world;if(!w||!['preparing','founding'].includes(w.stage)||w.raising||!ORIGINS[origin]||!ALLIES[assistant]||ALLIES[assistant].regional)return no('거병 시작 설정을 확인하세요.');
 const founder=w.founder;if(!REPRESENTATIVES[founder])return no('대표 인물을 확인하세요.');
 const q:RaisingState={version:1,seed:r.campaign!.seed,rng:(r.campaign!.seed^0x7251a)>>>0,origin,representative:founder,assistant,phase:'map',step:0,length:6,cards:[],draw:[],hand:[],discard:[],exhaust:[],nextUid:1,route:[],visited:[],node:null,progress:0,event:null,power:3,played:0,previous:null,previousId:null,discount:0,uses:{},revealed:1,legitimacy:origin==='notable'?3:1,intel:origin==='official'?2:0,training:origin==='militia'?1:0,influence:0,allies:[assistant],regional:null,schemes:[origin==='notable'?'people':origin==='militia'?'oath':'door'],pledges:[],completed:[],reward:null,revision:0,plan:null,gate:null,grade:null,attempt:0,result:[],log:[],converted:false,stats:{plays:{},picks:{},skips:0,removes:0,upgrades:0,mods:0,chains:0,reshuffles:0,recoveries:0,allyPicks:{}}};
 w.raising=q;w.stage='preparing';w.preparation.step=1;w.preparation.ap=3;w.preparation.actions=[];
 if(!preserve){const p=w.preparation;p.funds=origin==='official'?6:4;p.food=w.startCity==='xingyang'?10:8;p.troops=origin==='militia'?8:4;p.support=origin==='notable'?3:2;p.exposure=origin==='official'?2:0;p.base=false;if(w.perk==='granary'){p.food+=3;p.funds=Math.max(0,p.funds-1);}if(w.perk==='credit'){p.funds+=3;w.diplomacy.obligation+=1;}if(w.perk==='network')q.influence++;}
 const cityCard=w.startCity==='xingyang'?'cache':w.startCity==='chenggao'?'gate':'wagon';
 for(const id of ['manifesto','food','coin',ALLIES[assistant].card,...ORIGINS[origin].cards,cityCard,...REPRESENTATIVES[founder].cards,ORIGINS[origin].burden])addCard(q,id);
 q.route=route(q);q.draw=shuffle(q,q.discard.splice(0));record(q,`대표 ${GENERALS[founder].name} / ${ORIGINS[origin].name} · 책략 ${SCHEMES[q.schemes[0]].name}. 최종 계획을 보고 경로를 준비하세요.`);return ok;
}
function condition(q:RaisingState,e:RaisingEffect,family:string,id:string){const c=e.condition;return !c||(!c.previous||q.previous===c.previous)&&(!c.family||family===c.family)&&(!c.different||q.previousId!==id)&&(!c.ally||q.allies.includes(c.ally));}
function operate(r:RunState,ops:RaisingOperation[],source:string){const q=raisingOf(r)!;for(const o of ops){if(o.kind==='resource'){const before=raisingAmount(r,o.field);setAmount(r,o.field,before+o.amount);record(q,`${source}: ${({funds:'자금',food:'군량',troops:'병력',support:'지지',exposure:'노출',legitimacy:'명분',intel:'정보',debt:'채무',training:'훈련',influence:'인맥'})[o.field]} ${before} → ${raisingAmount(r,o.field)}`);}else if(o.kind==='draw')draw(q,o.amount);else if(o.kind==='power')q.power=clamp(q.power+o.amount,5);else if(o.kind==='reveal'){q.revealed=clamp(q.revealed+o.amount,6);for(const row of q.route.slice(q.step,q.step+1+o.amount))for(const n of row)n.open=true;}else if(o.kind==='discount')q.discount=clamp(q.discount+o.amount,3);else if(o.kind==='generate'&&q.cards.length<(personnelOf(r)?14:30))addCard(q,o.card,true);else if(o.kind==='pledge'&&!q.pledges.includes(o.id)){q.pledges.push(o.id);record(q,`${source}: ${promises[o.id]} 의무는 첫 도시로 이어집니다.`);}}}
function rules(r:RunState,c:RaisingCard){const q=raisingOf(r)!,d=RAISING_CARDS[c.id];const basic=c.upgrade?d.upgrades[c.upgrade].effects:d.effects;
 const extras=[REPRESENTATIVES[personnelOf(r)?.protagonistId??q.representative].principle,...q.schemes.map(id=>SCHEMES[id].rule),...q.allies.map(id=>ALLIES[id].rule),...(q.regional?[ALLIES[q.regional].rule]:[])];
 return [...basic.map((e,i)=>({e,key:`card:${c.uid}:${q.played}:${i}`,extra:false})),...extras.map((e,i)=>({e,key:`rule:${i}:${e.source}`,extra:true}))].filter(x=>['play','after'].includes(x.e.timing)&&condition(q,x.e,d.family,c.id)&&(q.uses[x.key]??0)<x.e.limit).sort((a,b)=>a.e.priority-b.e.priority);
}
export function raisingCardCost(c:RaisingCard,r?:RunState){return Math.max(0,RAISING_CARDS[c.id].cost+(r?personnelExtraCost(r,c):0)-(c.mod==='fleeting'?1:0));}
export function canPlayRaising(r:RunState,uid:number,revision:number):Result {
 const exploration=explorationOf(r),puzzle=exploration&&currentPuzzleId(r);if(exploration&&!exploration.converted&&!(exploration.scene==='location'&&exploration.event?.status==='active'||puzzle&&['location','result'].includes(exploration.scene)))return no('진행 중인 장소 사건에서 카드를 사용하세요.');
 const q=raisingOf(r),c=q?.cards.find(c=>c.uid===uid);if(!q||q.phase!=='node'||revision!==q.revision||!c||!q.hand.includes(uid))return no('현재 손패 또는 입력 차례를 확인하세요.');
 const personal=personnelBeforePlay(r,c);if(personal)return no(personal);const d=RAISING_CARDS[c.id],node=q.route.flat().find(n=>n.id===q.node)!;if(!(exploration&&engineOf(r))&&!NODES[node.kind].families.includes(d.family)&&!contactCardAllowed(r,c))return no('이 장소에서 사용 가능한 카드 계열이 아닙니다.');
 if(q.played>=12||q.power<raisingCardCost(c,r))return no('준비력이 부족하거나 단계 사용 상한입니다.');
 const amounts:Partial<Record<RaisingResource,number>>={};for(const {e} of rules(r,c))for(const o of e.operations)if(o.kind==='resource')amounts[o.field]=(amounts[o.field]??0)+o.amount;
 if(Object.entries(amounts).some(([field,amount])=>['funds','food','troops'].includes(field)&&raisingAmount(r,field as RaisingResource)+amount<0))return no('카드 비용에 필요한 자원이 부족합니다.');
 if(d.effects.some(e=>e.operations.some(o=>o.kind==='pledge'&&q.pledges.includes(o.id))))return no('같은 약속을 다시 발행할 수 없습니다.');return ok;
}
export function playRaisingCard(r:RunState,uid:number,revision:number):Result {
 const check=canPlayRaising(r,uid,revision);if(!check.ok)return check;const q=raisingOf(r)!,c=q.cards.find(c=>c.uid===uid)!,d=RAISING_CARDS[c.id],rs=rules(r,c);q.power-=raisingCardCost(c,r);q.hand=q.hand.filter(x=>x!==uid);
 for(const {e,key,extra} of rs){operate(r,e.operations,e.source);q.uses[key]=(q.uses[key]??0)+1;if(extra&&e.condition?.previous)q.stats.chains++;}
 operate(r,personnelAfterPlay(r,c),'인재 협력');revealPersonnel(r);if(c.mod==='cycle')draw(q,1);const exhausted=c.mod==='fleeting'||(c.upgrade?d.upgrades[c.upgrade].exhaust??d.exhaust:d.exhaust);(exhausted?q.exhaust:q.discard).push(uid);engineAfterPlay(r,c,!!exhausted);
 captureRaisingLibrary(r);q.progress++;q.played++;q.previous=d.family;q.previousId=c.id;q.stats.plays[c.id]=(q.stats.plays[c.id]??0)+1;q.revision++;return ok;
}
export function enterRaisingNode(r:RunState,id:string):Result {
 if(explorationOf(r))return no('도시 지도에서 연결된 장소로 이동하세요.');
 const q=raisingOf(r);if(!q||q.phase!=='map')return no('다음 경로를 선택할 때만 방문할 수 있습니다.');const node=q.route[q.step]?.find(n=>n.id===id);if(!node||q.visited.includes(id))return no('현재 단계의 새 거점을 고르세요.');
 const n=NODES[node.kind],p=r.campaign!.world!.preparation;
 // Known surveillance closes only one conspicuous lane; two alternatives remain.
 if(p.exposure>=12&&node.lane===1&&!n.rest)return no('감시가 강화되어 이 길은 폐쇄되었습니다. 다른 길 또는 최종 계획을 선택하세요.');
 q.node=id;q.phase='node';q.progress=0;q.event=null;q.power=3;q.played=0;q.previous=null;q.previousId=null;q.uses={};q.visited.push(id);p.exposure=clamp(p.exposure+n.risk);p.step=Math.min(5,q.step+1);p.ap=3;
 q.draw.push(...q.hand.splice(0));q.draw=shuffle(q,q.draw);const opening=q.cards.filter(c=>c.mod==='opening'&&q.draw.includes(c.uid)).slice(0,4);for(const c of opening){q.draw=q.draw.filter(uid=>uid!==c.uid);q.hand.push(c.uid);}draw(q,4-q.hand.length);discoverPersonnel(r);q.revision++;record(q,`${q.step+1}/6 ${n.name}: ${n.story} · 필요 진행 ${n.need}, 노출 +${n.risk}.`);return ok;
}
export function raisingNodeChoice(r:RunState,index:number,revision:number):Result {
 if(explorationOf(r))return no('현재 장소 장면의 접근법을 선택하세요.');
 const q=raisingOf(r);if(!q||q.phase!=='node'||q.event!==null||q.revision!==revision)return no('장소 사건은 방문당 한 번 선택합니다.');const n=NODES[q.route.flat().find(n=>n.id===q.node)!.kind],choice=n.choices[index];if(!choice)return no('없는 사건 선택.');if(choice.effects.some(o=>o.kind==='resource'&&['funds','food','troops'].includes(o.field)&&raisingAmount(r,o.field)+o.amount<0))return no('사건 비용이 부족합니다.');operate(r,choice.effects,n.name+' · '+choice.name);q.event=String(index);q.progress+=choice.progress;q.revision++;return ok;
}
function offers(r:RunState){const q=raisingOf(r)!,n=NODES[q.route.flat().find(n=>n.id===q.node)!.kind];const pool=Object.values(RAISING_CARDS).filter(d=>!d.owner&&!d.burden&&!d.discovery),first=sample(q,pool.filter(d=>d.family===n.rewardFamily),1)[0].id;const missing=r.campaign!.world!.preparation.food<8?'supply':ORIGINS[q.origin].family;const second=sample(q,pool.filter(d=>d.family===missing&&d.id!==first),1)[0]?.id??'coin';const third=sample(q,pool.filter(d=>d.id!==first&&d.id!==second),1)[0].id;return [first,second,third];}
export function finishRaisingNode(r:RunState,revision:number):Result {
 if(explorationOf(r))return no('도시 사건을 해결한 뒤 지도로 돌아가세요.');
 const q=raisingOf(r);if(!q||q.phase!=='node'||q.revision!==revision)return no('이미 종료된 준비 장소입니다.');const n=NODES[q.route.flat().find(n=>n.id===q.node)!.kind];if(q.progress<n.need)return no(`사건이나 카드로 진행 ${n.need}를 채우세요. 현재 ${q.progress}.`);
 const p=r.campaign!.world!.preparation;p.food=Math.max(0,p.food-1);p.exposure=clamp(p.exposure+1);p.base=true;
 q.discard.push(...q.hand.splice(0));q.phase='reward';const token=q.node!;q.reward={token,cards:offers(r),scheme:sample(q,Object.keys(SCHEMES).filter(id=>!q.schemes.includes(id)&&(!SCHEMES[id].rare||n.elite)),1)[0]??'people',ally:n.ally};q.revision++;record(q,`${n.name} 완료. 보상은 하나만 선택합니다. 노출 ${p.exposure}: 8부터 관문 강화, 12부터 공개 경로 폐쇄, 18부터 조기 계획 권고.`);return ok;
}
export function assistRaisingNode(r:RunState,revision:number):Result {
 if(explorationOf(r))return no('도시 사건에서 인재와 직접 접촉하세요.');
 const q=raisingOf(r);if(!q||q.phase!=='node'||q.revision!==revision||q.power<1||q.uses.nodeAssist)return no('방문당 한 번, 준비력 1이 필요합니다.');q.uses.nodeAssist=1;q.power--;q.progress++;setAmount(r,'exposure',raisingAmount(r,'exposure')+1);q.revision++;record(q,'추가 접촉: 준비력 1·노출 1을 쓰고 진행 1. 자원은 증가하지 않습니다.');return ok;
}
export function chooseRaisingReward(r:RunState,action:string,revision:number):Result {
 const q=raisingOf(r);if(!q||q.phase!=='reward'||!q.reward||q.revision!==revision||q.completed.includes(q.reward.token))return no('이미 처리한 보상입니다.');const [kind,a,b]=action.split(':');const reward=q.reward;let c=q.cards.find(c=>c.uid===Number(a));
 if(kind==='add'){if(!reward.cards.includes(a)||q.cards.length>=(personnelOf(r)?14:30))return no('후보 카드 또는 덱 상한을 확인하세요.');addCard(q,a);q.stats.picks[a]=(q.stats.picks[a]??0)+1;}
 else if(kind==='remove'){if(!c||RAISING_CARDS[c.id].owner||q.cards.length<=6)return no('공용 카드만 제거, 덱 최소 6장입니다.');q.cards=q.cards.filter(v=>v.uid!==c!.uid);for(const pile of ['draw','hand','discard','exhaust'] as const)q[pile]=q[pile].filter(uid=>uid!==c!.uid);q.stats.removes++;}
 else if(kind==='upgrade'){if(!c||c.upgrade||!['bold','quiet'].includes(b))return no('아직 강화하지 않은 카드와 강화 분기를 고르세요.');c.upgrade=b as 'bold'|'quiet';q.stats.upgrades++;}
 else if(kind==='mod'){if(!c||c.mod||!['opening','fleeting','cycle'].includes(b))return no('개조와 카드를 확인하세요.');c.mod=b as 'opening';q.stats.mods++;}
 else if(kind==='scheme'){if(a!==reward.scheme||q.schemes.includes(a))return no('현재 보상의 책략을 고르세요.');if(q.schemes.length>=2){if(!q.schemes.includes(b))return no('책략 슬롯 2개: 교체할 책략을 고르세요.');q.schemes=q.schemes.filter(id=>id!==b);}q.schemes.push(a);}
 else if(kind==='ally'){if(personnelOf(r))return no('장소에서 인재의 부탁과 협력 조건을 해결하세요.');if(a!==reward.ally||q.allies.includes(a)||q.regional===a)return no('현재 접촉 가능한 새 협력자를 고르세요.');const d=ALLIES[a];if(d.regional){q.regional=a;}else {if(q.allies.length>=2){if(!q.allies.includes(b)||b===q.assistant)return no('핵심 협력자 슬롯 2개: 보좌 외 협력자를 교체하세요.');q.allies=q.allies.filter(id=>id!==b);}q.allies.push(a);}addCard(q,d.card);if(d.debt)setAmount(r,'debt',raisingAmount(r,'debt')+d.debt);q.stats.allyPicks[a]=(q.stats.allyPicks[a]??0)+1;}
 else if(kind==='resource'){setAmount(r,'funds',raisingAmount(r,'funds')+2);setAmount(r,'food',raisingAmount(r,'food')+2);}
 else if(kind==='skip')q.stats.skips++;
 else return no('없는 보상 선택.');
 captureRaisingLibrary(r);q.completed.push(reward.token);q.reward=null;q.step++;q.phase=q.step>=q.length?'plan':'map';q.revision++;record(q,`보상 ${({add:'카드 획득',remove:'카드 제거',upgrade:'카드 강화',mod:'카드 개조',scheme:'책략',ally:'협력자',resource:'자원',skip:'건너뛰기'} as Record<string,string>)[kind]} 확정. 카드 ${q.cards.length}장; 제거·건너뛰기는 다음 드로우 밀도를 바꿉니다.`);return ok;
}
export function raisingParticipants(r:RunState){const q=raisingOf(r)!,p=personnelOf(r);if(p)return [p.protagonistId,...p.party.filter(id=>isRecruited(p.officers[id])||p.officers[id].relationship==='trusted')];return [...new Set([q.representative,...q.allies.map(id=>ALLIES[id].officer).filter((id):id is string=>!!id)])];}
export function raisingPlanQuote(r:RunState,plan:string){const q=raisingOf(r)!,p=r.campaign!.world!.preparation,def=PLANS[plan as keyof typeof PLANS];if(!def)return null;const readiness=plan==='assembly'?q.legitimacy+p.support:plan==='barracks'?q.training+Math.floor(p.troops/4):q.intel+q.influence;return {readiness,shortage:Math.max(0,8-readiness),exposurePenalty:Math.floor(p.exposure/8),troops:[p.troops,p.troops+4],order:plan==='barracks'?[25,40]:[35,55],debts:raisingAmount(r,'debt'),pledges:[...q.pledges],opponent:def.opponent,mode:def.mode};}
export function selectRaisingPlan(r:RunState,plan:string,representative:string,revision:number):Result {
 const q=raisingOf(r);if(!q||!['map','plan'].includes(q.phase)||q.step<3||q.revision!==revision||!Object.hasOwn(PLANS,plan)||!raisingParticipants(r).includes(representative))return no('최소 세 준비 장소 뒤 현재 참가 인물과 계획을 고르세요.');
 if(explorationOf(r)&&!explorationOf(r)!.unlockedPlans.includes(plan as 'assembly'|'barracks'|'inside'))return no('도시 사건에서 이 거병 계획을 먼저 발견하세요.');if(personnelOf(r)&&!personnelOf(r)!.representative)return no('먼저 대표·보좌 편성을 확정하세요.');q.plan=plan as RaisingState['plan'];q.gate={debate:null,duel:null,debateGrade:null,duelGrade:null,representative,support:personnelOf(r)?.assistant&&OFFICERS[personnelOf(r)!.assistant!]?.family==='military'?1:0,discount:q.discount,tacticRefund:false};q.revision++;if(plan==='barracks')beginRaisingDuel(r);else beginRaisingDebate(r);return ok;
}
function beginRaisingDebate(r:RunState){const q=raisingOf(r)!,p=r.campaign!.world!.preparation,g=q.gate!,quote=raisingPlanQuote(r,q.plan!)!;
 const s=createDebate(Math.floor(nextFloat(q)*2147483646)+1,q.representative,q.plan==='inside'?'scholar':'elder',{kind:'supply'});prepareNegotiation(s,p.food,q.intel,q.influence);
 const build=structuredClone(r.debateBuild);ensureRepresentative(build,q.representative);build.assistant=personnelOf(r)?null:ALLIES[q.assistant].officer==='dianwei'?'dianwei':null;if(personnelOf(r)){build.cards=build.cards.filter(c=>!c.owner);if(personnelOf(r)!.assistant)build.cards.push({uid:build.nextUid++,id:'bond',temporary:true});}
 for(const c of q.cards.filter(c=>RAISING_CARDS[c.id].debate).slice(0,12)){const id=RAISING_CARDS[c.id].debate!;if(DEBATE_CARDS[id])build.cards.push({uid:build.nextUid++,id,temporary:true,...(c.personnelCard!==undefined?{personnelCard:c.personnelCard,personnelOwners:[...(personnelOf(r)?.library.find(l=>l.uid===c.personnelCard)?.owners??[])],personnelCost:personnelExtraCost(r,c)}:{}),...(c.mod==='opening'?{mod:'opening' as const}:{})});}
 startDeckDebate(s,build,!!(explorationOf(r)&&engineOf(r)&&profileOf(r).debate.elite));s.resolve=Math.min(6,s.resolve+Math.min(2,g.discount));const engineGate=!!(explorationOf(r)&&engineOf(r));if(!engineGate){for(const axis of Object.keys(s.negotiation!.needs) as ('honor'|'profit'|'safety'|'authority')[])s.negotiation!.needs[axis]=Math.min(12,Math.max(2,s.negotiation!.needs[axis]!+quote.shortage+quote.exposurePenalty-Math.min(3,Math.floor(quote.readiness/5))));s.negotiation!.needs.honor=Math.min(12,Math.max(3,7-Math.floor(q.legitimacy/4))+quote.shortage+quote.exposurePenalty);if(q.plan==='assembly')s.negotiation!.needs.safety=Math.max(4,s.negotiation!.needs.safety??4);}else{/* 카드 엔진 관문: 자원 준비도 대신 빌드(인재·연쇄·논거)가 요구를 바꾼다 */for(const axis of Object.keys(s.negotiation!.needs) as ('honor'|'profit'|'safety'|'authority')[])s.negotiation!.needs[axis]=Math.min(12,s.negotiation!.needs[axis]!+quote.exposurePenalty);if(q.plan==='assembly')s.negotiation!.needs.honor=3+quote.exposurePenalty;}s.trust=Math.min(6,1+Math.floor(p.support/4));s.negotiation!.reports=Math.min(4,q.intel);if(engineGate)applyGateDebateRules(r,s,q.plan!);q.phase='debate';g.debate=s;record(q,`최종 관문: ${PLANS[q.plan!].name}. 부족 ${quote.shortage}, 감시 난도 +${quote.exposurePenalty}. 준비 카드의 임시 논거 ${build.cards.filter(c=>c.temporary).length}장.`);
}
function beginRaisingDuel(r:RunState){const q=raisingOf(r)!,g=q.gate!,quote=raisingPlanQuote(r,q.plan!)!;const tactics=[...new Set(q.cards.map(c=>RAISING_CARDS[c.id].tactic).filter((id):id is TacticId=>!!id))].slice(0,2);
 const s=createDuel(Math.floor(nextFloat(q)*2147483646)+1,g.representative,q.plan==='inside'?'sentinel':'champion',r.build,tactics);s.hp=Math.max(1,s.hp-(q.injuries?.[g.representative]??0)*4);s.momentum=clamp(s.momentum+Math.floor(q.training/2),5);s.protection=Math.min(8,q.training);s.enemyMaxHp=s.enemyHp=Math.max(10,s.enemyHp+quote.shortage+quote.exposurePenalty*2-g.support*3);if(q.intel>=3)s.patternOffset=0;if(explorationOf(r)&&engineOf(r)){s.enemyMaxHp=s.enemyHp=Math.max(10,DUEL_BASE(s)+quote.exposurePenalty*2);applyGateDuelRules(r,s,q.plan!,g.debateGrade);}q.phase='duel';g.duel=s;record(q,`군영 대결: 준비 기세 ${s.momentum}, 방비 ${s.protection}, 지원 분리 ${g.support}, 전술 ${tactics.join('·')||'없음'}. 상대 ${s.opponentId==='sentinel'?'관문 호위':'군영 대표'}.`);
}
export function actRaisingGate(r:RunState,action:string,revision:number):Result {
 const q=raisingOf(r);if(!q||!q.gate||q.revision!==revision)return no('관문 입력이 이미 처리되었습니다.');const g=q.gate;let check:Result;
 if(q.phase==='debate'&&g.debate){check=resolveDebateAction(g.debate,action,g.debate.deck?.revision??g.debate.round);if(check.ok)r.campaign!.world!.preparation.food=g.debate.negotiation!.food;}
 else if(q.phase==='duel'&&g.duel){const before=g.duel.momentum;check=resolveDuelAction(g.duel,action,g.duel.round);if(check.ok&&!g.tacticRefund&&g.duel.momentum<before){for(const id of q.schemes){const rule=SCHEMES[id].rule;if(rule.timing!=='duel')continue;for(const op of rule.operations)if(op.kind==='refundMomentum'){g.duel.momentum=Math.min(5,g.duel.momentum+op.amount);g.tacticRefund=true;record(q,rule.source+': 첫 기세 소비 회복.');}}}}
 else return no('진행 중인 설전·대결이 없습니다.');if(check.ok){q.revision++;const cur=q.phase==='debate'?g.debate:g.duel;recordSequence(r,q.phase==='debate'?'debate':'duel','gate:'+q.plan,action,cur&&cur.result!=='ongoing'?cur.result:undefined);}return check;
}
export function finishRaisingGate(r:RunState,revision:number):Result {
 const q=raisingOf(r);if(!q||!q.gate||q.revision!==revision)return no('이미 확인한 관문 결과입니다.');const g=q.gate;
 if(q.phase==='debate'&&g.debate&&g.debate.result!=='ongoing'){g.debateGrade=g.debate.result;if(explorationOf(r)&&engineOf(r))engineDebateFinished(r,g.debate,'gate:'+q.plan);for(const p of g.debate.deck?.promises??[])if(!q.pledges.includes(p))q.pledges.push(p);g.support=g.debate.result==='success'?2:g.debate.result==='partial'?1:0;
  if(q.plan==='inside'&&!(explorationOf(r)&&engineOf(r)?insideSkipsDuel(r,g.debate.result):g.debate.result==='success'&&q.intel>=6&&q.influence>=4&&r.campaign!.world!.preparation.exposure<12)){g.debateGrade=g.debate.result;beginRaisingDuel(r);q.revision++;return ok;}
 }else if(q.phase==='duel'&&g.duel&&g.duel.result!=='ongoing'){g.duelGrade=g.duel.result;if(g.duel.result==='lose'||g.duel.result==='surrender'){setAmount(r,'troops',Math.floor(raisingAmount(r,'troops')*.7));q.injuries??={};q.injuries[g.duel.generalId]=Math.min(2,(q.injuries[g.duel.generalId]??0)+1);record(q,`${GENERALS[g.duel.generalId].name}: 패배 부상·다음 대결 체력 −4·합류 후 피로.`);}}
 else return no('관문이 아직 진행 중입니다.');
 const good=g.debateGrade==='success'||g.duelGrade==='win',partial=g.debateGrade==='partial'||g.duelGrade==='draw';const failed=q.plan==='assembly'?g.debateGrade==='failure':q.plan==='barracks'?['lose','surrender'].includes(g.duelGrade!):['lose','surrender'].includes(g.duelGrade!)||!good&&!partial;
 q.grade=failed?(q.pledges.length&&raisingAmount(r,'support')>=3?'incomplete':'escaped'):q.plan==='inside'&&(g.debateGrade!=='success'||g.duelGrade==='draw')?'conditional':good?(raisingPlanQuote(r,q.plan!)!.shortage===0&&raisingAmount(r,'exposure')<12?'great':'success'):'conditional';
 const engineEval=explorationOf(r)&&engineOf(r)?engineGateOutcome(r,q.plan!,g.debateGrade,g.duel):null;if(explorationOf(r)&&engineOf(r)&&!failed)q.grade=engineGateGrade(r,q.plan!,engineEval?.grade??null,g.duel);
 if(q.grade==='conditional'||q.grade==='incomplete'){setAmount(r,'debt',raisingAmount(r,'debt')+2);if(!q.pledges.includes('authority'))q.pledges.push('authority');}
 if(!(explorationOf(r)&&engineOf(r)))engineGateOutcome(r,q.plan!,g.debateGrade,g.duel);q.phase=q.grade==='escaped'?'escape':'result';q.result=[`${PLANS[q.plan!].name}: ${grades[q.grade]}`,`설전 ${outcomes[g.debateGrade??'']??'없음'} · 대결 ${outcomes[g.duelGrade??'']??'없음'}`,`자금 ${raisingAmount(r,'funds')}·군량 ${raisingAmount(r,'food')}·병력 ${raisingAmount(r,'troops')} 모두 잔여 장부`, `노출 ${raisingAmount(r,'exposure')}·채무 ${raisingAmount(r,'debt')}·약속 ${q.pledges.map(id=>promises[id]).join('·')||'없음'}`];q.result.push(...engineGateLines(r,q.plan!),...engineFoundingResult(r).map(t=>'예정 '+t));q.revision++;return ok;
}
const DUEL_BASE=(s:{opponentId:string})=>DUEL_OPPONENTS[s.opponentId].hp;
export function recoverRaising(r:RunState,revision:number):Result {
 const q=raisingOf(r);if(!q||q.phase!=='escape'||q.revision!==revision)return no('현재 도피 결과가 아닙니다.');if(q.attempt>=1||raisingAmount(r,'funds')+raisingAmount(r,'food')===0){q.grade='lost';r.campaign!.world!.stage='failed';q.revision++;return ok;}
 setAmount(r,'funds',Math.floor(raisingAmount(r,'funds')/2));setAmount(r,'troops',Math.floor(raisingAmount(r,'troops')/2));setAmount(r,'exposure',2);q.attempt++;q.stats.recoveries++;q.step=0;q.route=route(q);resetPersonnelRoute(r);q.phase='map';q.plan=null;q.gate=null;q.grade=null;q.node=null;q.completed=[];q.visited=[];q.draw.push(...q.hand.splice(0),...q.discard.splice(0));q.draw=shuffle(q,q.draw);recoverCityExploration(r);q.revision++;record(q,'도피 후 같은 지역 재기: 카드·단서·협력자는 유지, 자금·병력 절반을 잃었습니다. 다음 실패는 기반 상실 위험.');return ok;
}
export function foundRaisingFaction(r:RunState,name:string,color:string,revision:number):Result {
 const q=raisingOf(r),w=r.campaign?.world;if(!q||!w||q.phase!=='result'||q.converted||q.revision!==revision||!q.grade||['escaped','lost'].includes(q.grade))return no('확인할 거병 성공 결과가 없습니다.');
 if(personnelOf(r)&&!personnelOf(r)!.doctrine)return no('거병 결과에서 정식 세력 교리를 선택하세요.');const p={...w.preparation},method=q.plan==='barracks'?'volunteers':q.plan==='assembly'?'officials':'merchants';
 // Legacy occupation rules create the city once; preparation totals remain authoritative.
 const check=foundFaction(r,method,name,color,w.goal);if(!check.ok)return check;const city=activeCity(r)!,c=r.campaign!;c.approach.trust=Math.min(10,c.approach.trust);
 w.treasury=p.funds;city.food=p.food;city.reserveTroops=clamp(p.troops+(q.gate?.duelGrade==='win'?4:0));city.training=Math.min(2,Math.floor(q.training/2));city.metrics.order=clamp((city.exploration?city.metrics.order:CITY_DEFS[city.id].metrics.order)+(q.plan==='barracks'?-8:8)+(q.grade==='great'?5:q.grade==='incomplete'?-15:q.grade==='conditional'?-5:0),100);city.metrics.life=clamp(city.metrics.life+(q.plan==='barracks'?-5:3),100);city.groups.locals=clamp((city.exploration?city.groups.locals:0)+Math.floor(p.support/3)+(q.regional==='elder'?1:0),3);city.groups.traders=q.regional==='sponsor'?Math.max(2,city.groups.traders):city.exploration?city.groups.traders:0;
 if(!city.exploration&&q.plan==='inside'&&q.gate?.debateGrade==='success')for(const d of city.districts)d.damage=0;
 // The old merchant founding grants a loan; remove that automatic grant/obligation.
 if(method==='merchants')w.diplomacy.obligation=Math.max(0,w.diplomacy.obligation-3);
 city.promises=city.promises.filter(p=>p.id!=='authority'||q.pledges.includes('authority'));
 for(const id of q.pledges){const mapped=id==='autonomy'?'shared':id;if(!city.promises.some(p=>p.id===mapped))city.promises.push({id:mapped,due:3,status:'active'});}
 for(const id of q.allies){const officer=ALLIES[id].officer;if(!officer||c.roster.includes(officer))continue;const joins=q.grade!=='incomplete'||id===q.assistant;if(!joins)continue;c.roster.push(officer);const row=GENERALS[officer].row==='rear'?'rear':'front';if(r.generals.length<4&&r.generals.filter(g=>g.row===row).length<2)r.generals.push({id:officer,row});else w.reserveOfficers.push(officer);const candidate=w.candidates.find(v=>v.id===officer);if(candidate)candidate.recruited=true;}
 for(const [id,injury] of Object.entries(q.injuries??{}))if(c.roster.includes(id))c.fatigue[id]=Math.min(6,injury*3);
 ensureRepresentative(r.debateBuild,q.representative);
 const seen=new Set<string>();for(const card of q.cards){if(personnelOf(r))continue;const d=RAISING_CARDS[card.id],f=d.fate,key=f.kind+':'+f.id;if(f.kind==='consume'||f.kind==='obligation'||seen.has(key))continue;seen.add(key);
  if(f.kind==='admin'&&f.id&&ADMIN_CARDS[f.id]){city.cards.push({uid:city.nextUid++,id:f.id,upgrade:!!card.upgrade,mod:'none'});city.discard.push(city.nextUid-1);}
  if(f.kind==='combat'&&f.id&&CARDS[f.id])r.deck.push({uid:r.nextUid++,id:f.id});
  if(f.kind==='debate'&&f.id&&DEBATE_CARDS[f.id])r.debateBuild.cards.push({uid:r.debateBuild.nextUid++,id:f.id});
  if(f.kind==='policy'&&f.id&&POLICY_DEFS[f.id]&&city.policies.length<2)city.policies.push({id:f.id,remaining:3});
  q.result.push(`${d.name} → ${f.text}`);
 }
 if(q.grade==='incomplete'){city.outcome='부분 장악·잔당 안정화 필요';for(const district of city.districts.filter(d=>d.id==='hall'||d.id==='gate'))district.damage=Math.max(2,district.damage);if(!city.issues.some(i=>i.id==='remnants'))city.issues.push({id:'remnants',due:2,progress:0,status:'active'});}
 w.neutral.trust+=q.plan==='assembly'?1:q.plan==='barracks'?-1:0;w.rival.plan=p.exposure>=12?'거병 노출·방비 강화':'새 세력 경계';q.result.push(`시작 병력 ${city.reserveTroops}: 준비 ${p.troops} + 대결 승리 ${city.reserveTroops-p.troops}`,`도시 안정 ${city.metrics.order}: 도시 기준 ${CITY_DEFS[city.id].metrics.order}, 계획·결과 보정`,`장수 ${c.roster.map(id=>GENERALS[id].name).join('·')} · 약속 ${city.promises.map(p=>promises[p.id]??p.id).join('·')||'없음'}`);
 q.result.push(...applyEngineFounding(r,city,id=>!!POLICY_DEFS[id]));
 q.converted=true;q.phase='founded';finalizePersonnel(r);applyExplorationFounding(r);q.revision++;w.history.push(...q.result.map(t=>`${w.turn}턴 · 거병: ${t}`));w.history=w.history.slice(-200);return ok;
}
export function previewRaisingCard(r:RunState,uid:number){const state=structuredClone(r);return {state,check:playRaisingCard(state,uid,raisingOf(state)!.revision)};}
export function previewRaisingPlan(r:RunState,plan:string,representative:string){const state=structuredClone(r);return {state,check:selectRaisingPlan(state,plan,representative,raisingOf(state)!.revision)};}


