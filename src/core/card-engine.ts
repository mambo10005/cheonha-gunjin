/**
 * 거병 카드 엔진: 카드 공통 문법(표식 생성·소비·후속), 인재 원칙, 거병 책략, 장소 사건 퍼즐,
 * 12장 활동 덱, 설전 논거·대결 전술·군진 임시 카드 변환, 보상·정제를 한 곳에서 다룬다.
 * 모든 상태 변경은 명령(exploreAction/playRaisingCard) 안에서만 일어나며 렌더링은 읽기 전용 함수만 쓴다.
 */
import {CARD_GRAMMAR,MARK_NAMES,MARK_CAP,ALERT_CAP,FAMILY6_NAMES,markText} from '../data/card-grammar.ts';
import {PUZZLES,type PuzzleDef,type ResolutionDef} from '../data/card-puzzles.ts';
import {STRATAGEMS,STRATAGEM_SLOTS,STRATAGEM_SWAP} from '../data/stratagems.ts';
import {TALENTS} from '../data/talents.ts';
import {CLAUSES} from '../data/clauses.ts';
import {GATE_PROFILES} from '../data/gate-profiles.ts';
import {evaluateDuel,DUEL_OBJECTIVES} from '../data/duel-objectives.ts';
import {enableDuelV2} from './duel.ts';
import {deckPreview} from './debate-deck.ts';
import {clauseContext,evaluateDebate,type DebateEvaluation} from './debate-grade.ts';
import {RAISING_CARDS,ORIGINS} from '../data/raising.ts';
import {OFFICERS} from '../data/personnel.ts';
import {EXPLORATION_EVENTS,EXPLORATION_ITEMS} from '../data/city-exploration.ts';
import {explorationOf,explorationInternals} from './city-exploration.ts';
import {personnelOf,isRecruited} from './personnel-rules.ts';
import {handleInnAction} from './inn.ts';
import {shuffle} from './rng.ts';
import type {RunState} from './types.ts';
import type {CityState} from './city-types.ts';
import type {Result} from './run.ts';
import type {RaisingCard,RaisingState} from './raising-types.ts';
import type {LibraryCard} from './personnel-types.ts';
import type {EngineTelemetry,CardGain,CardGrammar,ChainLink,EngineState,Mark,MarkBag,PuzzleState,DuelLoadout,EngineArgument} from './card-engine-types.ts';
import type {DuelState,DebateState} from './social-types.ts';
import type {ExplorationApproach,ExplorationItemId} from './city-exploration-types.ts';

const ok:Result={ok:true},no=(reason:string):Result=>({ok:false,reason});
export const DECK_LIMIT=12;
export const DECK_CAPS={protagonist:4,origin:2,talent:4,region:1,burden:2} as const;
export type DeckCategory=keyof typeof DECK_CAPS;
export const DECK_CATEGORY_NAMES:Record<DeckCategory,string>={protagonist:'주인공',origin:'출신·도시',talent:'인재(대표·동행)',region:'지역·물품',burden:'부담·약속'};
const raisingOf=(r:RunState)=>r.campaign?.world?.raising;
export const newTelemetry=():EngineTelemetry=>({plays:{},events:{},stratagems:{},firstPlays:[],rewards:{taken:[],declined:0},swaps:[],sequences:[],withdrawals:0,cancels:0,afterFailure:[],results:[]});
/** 1차 카드 엔진 저장(협력·계측 필드 없음)은 읽을 때 빈 기본값을 채운다. */
export const engineOf=(r:RunState):EngineState|undefined=>{const e=raisingOf(r)?.engine;if(e){e.telemetry??=newTelemetry();if(e.pact===undefined)e.pact=null;e.profile??='standard';e.debates??=[];e.duels??=[];}return e;};

export function ensureEngine(r:RunState):EngineState|undefined {
 const q=raisingOf(r);if(!q||!personnelOf(r))return undefined;
 q.engine??={version:1,stratagems:[],stratagemSwaps:0,scene:null,puzzles:{},arguments:[],loadout:{opening:null,response:null,gambit:null},battleCards:[],principles:{},growth:{},legacy:[],reward:null,rewardsTaken:[],rests:[],pact:null,telemetry:newTelemetry(),
  stats:{chains:{},consumed:{},produced:{},distinctOwners:[],burdenUses:0,forceDealt:0,cardsRemoved:0,cardsUpgraded:0,skips:0},log:[]};
 return q.engine;
}
function log(e:EngineState,text:string){e.log.push(text);e.log=e.log.slice(-60);}
const add=(bag:MarkBag,m:Mark,n:number)=>{bag[m]=Math.max(0,Math.min(m==='alert'?ALERT_CAP:MARK_CAP,(bag[m]??0)+n));if(!bag[m])delete bag[m];};

/* ───────────── 참여와 소유 ───────────── */
export function cardOwner(r:RunState,c:RaisingCard):string|null {const p=personnelOf(r),l=p?.library.find(l=>l.uid===c.personnelCard);if(!l||!l.owners.length)return null;if(l.sourceType==='officer'&&l.owners.length===1&&l.owners[0]===p!.protagonistId)return l.sourceId;return l.owners.join('+');}
/** 원칙이 작동하는 인재: 정식 등용 + 현재 동행(참여). */
export function activeTalents(r:RunState):string[] {const p=personnelOf(r);if(!p)return [];return p.party.filter(id=>TALENTS[id]&&p.officers[id]&&isRecruited(p.officers[id])&&p.officers[id].duty==='available');}
const principleOf=(e:EngineState,id:string)=>e.principles[id]??'base';

/* ───────────── 활동 덱(12장)과 보관함 ───────────── */
export function deckCategory(r:RunState,l:LibraryCard):DeckCategory {
 const p=personnelOf(r)!,d=RAISING_CARDS[l.id];
 if(d?.burden||l.ownerType==='promise'||d?.family==='promise'&&l.sourceType!=='protagonist')return 'burden';
 if(l.sourceType==='officer'&&l.owners.length===1&&l.owners[0]===p.protagonistId)return 'protagonist';
 if(l.sourceType==='city'||l.sourceType==='protagonist'&&ORIGINS[p.background].cards.includes(l.id))return 'origin';
 if(l.owners.some(o=>o!==p.protagonistId))return 'talent';
 if(l.sourceType==='protagonist')return 'protagonist';
 return 'region';
}
export function deckComposition(r:RunState){const p=personnelOf(r)!;const out:Record<DeckCategory,number>={protagonist:0,origin:0,talent:0,region:0,burden:0};for(const uid of p.loadouts.raising){const l=p.library.find(c=>c.uid===uid);if(l)out[deckCategory(r,l)]++;}return out;}
/** 편성 추가 가능 여부: 총 12장 + 범주별 상한. */
export function deckAddReason(r:RunState,l:LibraryCard):string|null {
 const p=personnelOf(r)!;if(p.loadouts.raising.length>=DECK_LIMIT)return `활동 덱은 ${DECK_LIMIT}장입니다. 먼저 한 장을 보관함으로 빼세요.`;
 const cat=deckCategory(r,l),comp=deckComposition(r);if(comp[cat]>=DECK_CAPS[cat])return `${DECK_CATEGORY_NAMES[cat]} 칸은 ${DECK_CAPS[cat]}장입니다.`;return null;
}

/* ───────────── 장면·퍼즐 ───────────── */
export function puzzleApplies(r:RunState,id:string):boolean {
 const x=explorationOf(r),def=PUZZLES[id];if(!x||!def||x.converted||x.location!==def.location||!['location','result'].includes(x.scene))return false;
 if(id==='escort'){const q=x.inn?.quests.escort;return !!q&&['accepted','active'].includes(q.status)&&q.step<=1;}
 if(id==='recommendation'){const q=x.inn?.quests.recommendation;return !!q&&['accepted','active'].includes(q.status)&&q.step>=1&&q.step<=2;}
 if(id==='barracks'){const ev=x.events.barracks;return x.event?.id==='barracks'&&!!ev&&ev.status==='active'&&!ev.claimed;}
 return false;
}
export function currentPuzzleId(r:RunState):string|null {const e=engineOf(r);if(!e)return null;return Object.keys(PUZZLES).find(id=>puzzleApplies(r,id)&&e.puzzles[id]?.status==='active')??null;}
export function currentPuzzle(r:RunState):{def:PuzzleDef;state:PuzzleState}|null {const id=currentPuzzleId(r),e=engineOf(r);return id&&e?{def:PUZZLES[id],state:e.puzzles[id]}:null;}
function newPuzzle(def:PuzzleDef):PuzzleState {return {id:def.id,status:'active',focus:null,obstacles:def.obstacles.map(o=>({id:o.id,hp:o.hp,max:o.hp})),marks:{...def.start,...(def.startAlert?{alert:def.startAlert}:{})},alert:def.startAlert,resolution:null,plays:0,inspected:[],items:[],log:[]};}
/** 장소 진입·의뢰 수락 뒤 장면 표식과 퍼즐을 준비한다. 같은 장소의 진행 중 퍼즐은 표식과 장애를 그대로 이어 간다. */
export function syncEngineScene(r:RunState,fresh=false){
 const e=engineOf(r),x=explorationOf(r);if(!e||!x)return;
 for(const def of Object.values(PUZZLES))if(puzzleApplies(r,def.id)){const s=e.puzzles[def.id];if(!s)e.puzzles[def.id]=newPuzzle(def);else if(s.status==='failed'&&x.locations[def.location].closedUntil<=x.tick){s.status='active';s.marks.alert=Math.max(0,def.alertLimit-3);log(e,`${def.title} · 경계가 가라앉아 다시 시도할 수 있습니다(실패 후속).`);}}
 const pid=Object.keys(PUZZLES).find(id=>puzzleApplies(r,id)&&e.puzzles[id]?.status==='active');
 if(fresh||!e.scene||e.scene.location!==x.location){if(e.scene&&e.scene.location!==x.location)stashScene(e);e.scene={location:x.location,marks:pid?{...e.puzzles[pid].marks}:{},chain:[],uses:{},draws:0,powerGain:0};}
 else if(pid&&e.scene)e.scene.marks={...e.puzzles[pid].marks};
}
function stashScene(e:EngineState){for(const p of Object.values(e.puzzles))if(p.status==='active'&&e.scene&&PUZZLES[p.id].location===e.scene.location)p.marks={...e.scene.marks};}
export function leaveEngineScene(r:RunState){const e=engineOf(r);if(!e||!e.scene)return;stashScene(e);e.scene=null;}
function puzzleMarks(r:RunState,e:EngineState){const pid=currentPuzzleId(r);if(pid&&e.scene)e.puzzles[pid].marks={...e.scene.marks};}
export function alertLimit(r:RunState,def:PuzzleDef){const e=engineOf(r)!;return def.alertLimit+(activeTalents(r).includes('dianwei')&&principleOf(e,'dianwei')==='base'?1:0);}

/* ───────────── 카드 사용: 공통 문법 파이프라인 ───────────── */
export function grammarFor(c:RaisingCard):CardGrammar {return CARD_GRAMMAR[c.id];}
interface PlayOutcome {force:number;produced:MarkBag;consumed:MarkBag;draw:number;power:number;notes:string[]}
function apply(o:PlayOutcome,g:CardGain,note:string){o.force+=g.force??0;for(const [m,n] of Object.entries(g.marks??{}))o.produced[m as Mark]=(o.produced[m as Mark]??0)+n!;o.draw+=g.draw??0;o.power+=g.power??0;o.notes.push(note);}
function useOnce(e:EngineState,key:string,limit:number){const s=e.scene!;if((s.uses[key]??0)>=limit)return false;s.uses[key]=(s.uses[key]??0)+1;return true;}
function spend(e:EngineState,o:PlayOutcome,m:Mark,n:number){const bag=e.scene!.marks;if((bag[m]??0)<n)return false;add(bag,m,-n);o.consumed[m]=(o.consumed[m]??0)+n;e.stats.consumed[m]=(e.stats.consumed[m]??0)+n;return true;}
/**
 * playRaisingCard 안에서 호출된다. 미리보기(structuredClone)와 실제 사용이 같은 경로를 탄다.
 */
export function engineAfterPlay(r:RunState,c:RaisingCard,exhausted:boolean){
 const e=engineOf(r),q=raisingOf(r)!;if(!e)return;if(!e.scene)syncEngineScene(r);const s=e.scene!;const g=grammarFor(c),owner=cardOwner(r,c)??'faction',prev=s.chain.at(-1),talents=activeTalents(r);
 const o:PlayOutcome={force:g.force,produced:{...g.produces},consumed:{},draw:0,power:0,notes:[]};let burnCard=false;
 if(c.upgrade){const b=g.upgradeBranches[c.upgrade];apply(o,b.gain,`${b.name} 강화`);}
 // 1) 카드 고유 소비
 if(g.consumes&&spend(e,o,g.consumes.mark,g.consumes.amount)){apply(o,g.consumes.gain,g.consumes.text);}
 // 2) 후속 조건
 const f=g.followup;let followed=false;if(f&&prev&&(!f.after.action||prev.action===f.after.action)&&(!f.after.family||prev.family===f.after.family)&&(!f.after.mark||prev.produced.includes(f.after.mark))&&(!f.after.differentOwner||prev.owner!==owner)){apply(o,f.gain,f.text);followed=true;}
 const differentOwner=!!prev&&prev.owner!==owner;if(prev&&prev.owner===owner&&owner!=='faction'&&owner!==personnelOf(r)!.protagonistId){e.stats.privateInterest=(e.stats.privateInterest??0)+1;o.notes.push('같은 인재 카드 연속 · 사적 이해 +1');}
 // 2.5) 퍼즐 장애 대상과 열쇠 표식(이전에 쌓인 것만 소비). 원칙·책략이 이 소비를 본다.
 const pid=currentPuzzleId(r);let target:{id:string;hp:number}|undefined,keyNote='';
 if(pid&&(o.force>0||g.force>0)){const p=e.puzzles[pid],def=PUZZLES[pid];const open=p.obstacles.filter(x=>x.hp>0&&def.obstacles.find(d=>d.id===x.id)!.accepts.includes(g.action));target=open.find(x=>x.id===p.focus)??open[0];if(target){const d=def.obstacles.find(d=>d.id===target!.id)!;if(spend(e,o,d.key,1)){o.force++;keyNote=`${d.name}: ${MARK_NAMES[d.key]} 1 소비 → 장애 +1`;}}}
 // 3) 인재 원칙 (동행한 정식 등용 인재만)
 for(const id of talents){const mode=principleOf(e,id);
  if(id==='xunyu'&&mode==='base'&&differentOwner&&useOnce(e,'p:xunyu',3))apply(o,{marks:{opinion:1}},'순욱 · 공론의 인선');
  if(id==='xunyu'&&mode==='alt'&&(o.consumed.opinion??0)>0&&useOnce(e,'p:xunyu',3))apply(o,{marks:{support:1}},'순욱 · 인선의 저울');
  if(id==='dianwei'&&mode==='base'&&g.family==='military'&&(o.produced.momentum??0)>0&&useOnce(e,'p:dianwei',3))apply(o,{marks:{momentum:1}},'전위 · 선봉 호위');
  if(id==='dianwei'&&mode==='alt'&&(o.consumed.momentum??0)>0&&useOnce(e,'p:dianwei',3))apply(o,{marks:{alert:-1}},'전위 · 호위의 철칙');
  if(id==='lusu'&&mode==='base'&&prev?.family==='intel'&&['network','scheme'].includes(g.family)&&useOnce(e,'p:lusu',2))apply(o,{marks:{inside:1}},'노숙 · 양측의 계산');
  if(id==='lusu'&&mode==='base'&&g.action==='trade'&&(o.produced.alert??0)>0){o.produced.alert=0;o.notes.push('노숙 · 거래는 경계를 만들지 않음');}
  if(id==='lusu'&&mode==='alt'&&(o.consumed.promise??0)>0&&useOnce(e,'p:lusu',2))apply(o,{marks:{ledger:1}},'노숙 · 중재의 장부');
  if(id==='chengpu'&&mode==='base'&&g.burden&&useOnce(e,'p:chengpu',1))apply(o,{marks:{supply:1},power:1},'정보 · 분산 보급');
  if(id==='chengpu'&&mode==='base'&&(s.marks.supply??0)>=3&&(o.produced.alert??0)>0){o.produced.alert=0;o.notes.push('정보 · 보급 3 이상: 경계 차단');}
 }
 // 4) 거병 책략
 const fire=(id:string,gain:CardGain,note:string)=>{apply(o,gain,'책략 · '+note);e.telemetry.stratagems[id]=(e.telemetry.stratagems[id]??0)+1;};
 for(const id of e.stratagems){
  if(id==='relay_trust'&&prev?.family==='intel'&&['network','scheme'].includes(g.family)&&useOnce(e,'s:'+id,2))fire(id,{force:1,marks:{inside:1}},'밀서와 인맥');
  if(id==='banner_march'&&g.family==='military'&&(s.marks.support??0)>=1&&useOnce(e,'s:'+id,2)){spend(e,o,'support',1);fire(id,{marks:{momentum:2}},'민심의 진군');}
  if(id==='heavy_burden'&&(g.produces.burden??0)>0&&useOnce(e,'s:'+id,2)){o.produced.burden=Math.max(0,(o.produced.burden??0)-1);fire(id,{marks:{supply:1,promise:1}},'짐을 진 맹세(부담 1 → 보급·약속, 이 카드는 소멸)');if(g.burden)burnCard=true;}
  if(id==='many_hands'&&g.action==='persuade'&&(Object.keys(o.consumed).length>0||followed)&&useOnce(e,'s:'+id,2)){fire(id,{force:1},'공론의 조항');const n=e.arguments.filter(a=>a.id.startsWith('clause:')).length;if(n<3)addArgument(e,{id:'clause:'+n,source:'puzzle',label:`조항 초안 ${n+1} · ${RAISING_CARDS[c.id].name}`,text:'설전 덱에 「조항 정리」 1장(부담 −1·신뢰 +1)'});}
  if(id==='oath_policy'&&(o.consumed.promise??0)>0&&useOnce(e,'s:'+id,3)){fire(id,{marks:{support:1}},'약속의 제도화');const n=e.legacy.filter(l=>l.id.startsWith('oath:')).length;if(n<2)e.legacy.push({id:'oath:'+n,kind:'policy',text:'약속의 제도화 · 거병 후 공동 운영 정책'});}
  if(id==='burn_bridge'&&(exhausted||g.burden)&&useOnce(e,'s:'+id,2))fire(id,{draw:1},'소진의 결단');
  if(id==='open_flag'&&(o.consumed.guard??0)>0&&useOnce(e,'s:'+id,2))fire(id,{force:1,marks:{momentum:1}},'반격의 진형');
  if(id==='ledger_net'&&['investigate','trade'].includes(g.action)&&useOnce(e,'s:'+id,2)){if((o.consumed.ledger??0)>0)fire(id,{marks:{clue:1,inside:1}},'장부의 그물');else if((s.marks.ledger??0)>=1){spend(e,o,'ledger',1);fire(id,{marks:{clue:1,inside:1}},'장부의 그물');}else s.uses['s:'+id]--;}
 }
 for(const id of talents)if(id==='chengpu'&&principleOf(e,id)==='alt'&&(o.consumed.supply??0)>=2&&useOnce(e,'p:chengpu',2))apply(o,{draw:1},'정보 · 노장의 셈');
 if(g.burden)e.stats.burdenUses++;
 if(burnCard&&q.discard.includes(c.uid)){q.discard=q.discard.filter(v=>v!==c.uid);q.exhaust.push(c.uid);}
 e.telemetry.plays[c.id]=(e.telemetry.plays[c.id]??0)+1;{const ev=currentPuzzleId(r)??explorationOf(r)?.event?.id??'none';e.telemetry.events[ev]=(e.telemetry.events[ev]??0)+1;}if(e.telemetry.firstPlays.length<12)e.telemetry.firstPlays.push(c.id);
 // 5) 퍼즐 장애: 열쇠 표식은 이전에 쌓인 것만 소비(생산 전에 판정)
 let hit='';
 if(pid&&o.force>0){const p=e.puzzles[pid],def=PUZZLES[pid];
  if(target){const d=def.obstacles.find(d=>d.id===target!.id)!;if(keyNote)o.notes.push(keyNote);const dealt=Math.min(target.hp,o.force);target.hp-=dealt;e.stats.forceDealt+=dealt;hit=`${d.name} −${dealt}${target.hp?'':' (해소)'}`;p.plays++;}
  else o.notes.push('이 행동으로 줄일 장애가 없습니다(표식만 남음)');}
 // 6) 생산
 for(const [m,n] of Object.entries(o.produced)){if(!n)continue;add(s.marks,m as Mark,n);if(n>0)e.stats.produced[m]=(e.stats.produced[m]??0)+n;}
 // 7) 드로우·준비력: 장소당 상한으로 무한 순환 방지
 const draws=Math.min(o.draw,3-s.draws);if(draws>0){s.draws+=draws;drawCards(q,draws);}
 const power=Math.min(o.power,2-s.powerGain);if(power>0){s.powerGain+=power;q.power=Math.min(5,q.power+power);}
 // 8) 연쇄 기록
 const link:ChainLink={card:c.id,family:g.family,action:g.action,owner,produced:(Object.keys(o.produced) as Mark[]).filter(m=>(o.produced[m]??0)>0),consumed:Object.keys(o.consumed) as Mark[]};
 if(prev){const key=`${FAMILY6_NAMES[prev.family]}→${FAMILY6_NAMES[g.family]}`;e.stats.chains[key]=(e.stats.chains[key]??0)+1;if(prev.family==='cause'&&(link.produced.includes('support')||link.produced.includes('opinion')))e.stats.chains['명분→지지']=(e.stats.chains['명분→지지']??0)+1;}
 if(owner!=='faction'&&!e.stats.distinctOwners.includes(owner))e.stats.distinctOwners.push(owner);
 s.chain.push(link);s.chain=s.chain.slice(-12);
 log(e,`${RAISING_CARDS[c.id].name}: ${[hit,markText(o.produced)&&'표식 '+markText(o.produced),Object.keys(o.consumed).length?'소비 '+Object.entries(o.consumed).map(([m,n])=>`${MARK_NAMES[m as Mark]} ${n}`).join('·'):'',...o.notes].filter(Boolean).join(' · ')}`);
 if(pid){puzzleMarks(r,e);checkPuzzleFailure(r,pid);}
}
function drawCards(q:RaisingState,n:number){for(let i=0;i<n&&q.hand.length<8;i++){if(!q.draw.length){if(!q.discard.length)break;q.draw=shuffle(q,q.discard.splice(0));}q.hand.push(q.draw.pop()!);}}
function checkPuzzleFailure(r:RunState,pid:string){
 const e=engineOf(r)!,p=e.puzzles[pid],def=PUZZLES[pid],x=explorationOf(r)!,w=r.campaign!.world!;if(p.status!=='active'||(e.scene?.marks.alert??0)<alertLimit(r,def))return;
 p.status='failed';p.log.push(def.failure.text);log(e,'실패 · '+def.failure.text);w.preparation.exposure=Math.min(200,w.preparation.exposure+def.failure.exposure);x.locations[def.location].closedUntil=x.tick+def.failure.closed;
 const h=explorationInternals.innHooks(r);h.emit('eventResolved',`${def.title} 실패 · ${def.failure.text}`);
 if(pid==='escort'){const quest=x.inn!.quests.escort;if(!quest.evidence.includes('blocked'))quest.evidence.push('blocked');}
 if(pid==='recommendation'){const quest=x.inn!.quests.recommendation;if(!quest.evidence.includes('blocked'))quest.evidence.push('blocked');w.diplomacy.obligation=Math.min(200,w.diplomacy.obligation+1);}
 if(pid==='barracks'){const a=EXPLORATION_EVENTS.barracks.stages[0].approaches.find(a=>a.id==='duel')!;explorationInternals.resolveApproach(r,a,false);}
}
/** 협력 직후 첫 방문: 새로 받은 전용 카드가 손패에 먼저 들어온다(방문 1회). */
export function engineOpeningHand(r:RunState){const e=engineOf(r),q=raisingOf(r)!,p=personnelOf(r)!;if(!e?.pact||e.pact.open||e.telemetry.firstPlays.length>=5)return;for(const sw of e.pact.swaps){const l=p.library.find(l=>l.id===sw.added&&l.sourceType==='officer'),c=l&&q.cards.find(c=>c.personnelCard===l.uid);if(!c||q.hand.includes(c.uid)||q.hand.length>=4||!q.draw.includes(c.uid)&&!q.discard.includes(c.uid))continue;q.draw=q.draw.filter(v=>v!==c.uid);q.discard=q.discard.filter(v=>v!==c.uid);q.hand.push(c.uid);}}
/** 손패 정리: 준비 시간 1로 손패를 모두 버리고 4장을 새로 뽑는다(장소 방문당 1회, 준비력은 그대로). */
export function mulligan(r:RunState):Result {const e=engineOf(r),x=explorationOf(r)!,q=raisingOf(r)!;if(!e?.scene||!currentPuzzleId(r))return no('사건 퍼즐에서만 손패를 정리할 수 있습니다.');if(e.scene.uses.mulligan)return no('손패 정리는 방문당 한 번입니다.');if(x.tick+1>x.budget)return no('준비 시간이 부족합니다.');e.scene.uses.mulligan=1;explorationInternals.advance(r,1);q.discard.push(...q.hand.splice(0));drawCards(q,4);q.revision++;log(e,'손패 정리 · 준비 시간 1');return ok;}
/** 퍼즐 대상 장애 지정. */
export function focusObstacle(r:RunState,id:string):Result {const pz=currentPuzzle(r);if(!pz)return no('진행 중인 사건 퍼즐이 없습니다.');const o=pz.state.obstacles.find(o=>o.id===id);if(!o||!o.hp)return no('남아 있는 장애를 고르세요.');pz.state.focus=id;return ok;}
/** 조사 대상·아이템이 퍼즐 표식으로 이어진다. */
export function engineInspect(r:RunState,inspectable:string){const e=engineOf(r),pz=currentPuzzle(r);if(!e||!pz||!e.scene)return;if(pz.state.inspected.includes(inspectable))return;const bag=pz.def.inspect[inspectable];if(!bag)return;pz.state.inspected.push(inspectable);for(const [m,n] of Object.entries(bag))add(e.scene.marks,m as Mark,n!);log(e,`조사 · ${markText(bag)}`);puzzleMarks(r,e);checkPuzzleFailure(r,pz.def.id);}
export function useItemInPuzzle(r:RunState,uid:number):Result {
 const e=engineOf(r),pz=currentPuzzle(r),x=explorationOf(r)!;if(!e||!pz||!e.scene)return no('진행 중인 사건 퍼즐이 없습니다.');const item=x.items.find(i=>i.uid===uid);if(!item)return no('보유 아이템을 고르세요.');const bag=pz.def.items[item.id as keyof PuzzleDef['items']];if(!bag)return no('이 사건에서 쓸 수 없는 아이템입니다.');
 x.items=x.items.filter(i=>i.uid!==uid);x.stats.items[item.id]=(x.stats.items[item.id]??0)+1;pz.state.items.push(item.id);for(const [m,n] of Object.entries(bag))add(e.scene.marks,m as Mark,n!);
 if(item.id==='ledger'||item.id==='letter'||item.id==='seal')addArgument(e,{id:'item:'+item.id,source:'item',label:EXPLORATION_ITEMS[item.id].name,text:item.id==='ledger'?'이익 요구 −1':item.id==='letter'?'명예 요구 −1':'권한 요구 −1'});
 explorationInternals.emit(x,'itemUsed',`${EXPLORATION_ITEMS[item.id].name} · ${pz.def.title}에 제출 · ${markText(bag)}`);explorationInternals.deliverPending(x);puzzleMarks(r,e);return ok;
}
function addArgument(e:EngineState,a:EngineArgument){if(!e.arguments.some(v=>v.id===a.id))e.arguments.push(a);e.arguments=e.arguments.slice(-12);}

/* ───────────── 해결 방식 ───────────── */
export function resolutionCheck(r:RunState,res:ResolutionDef):string|null {
 const pz=currentPuzzle(r),w=r.campaign!.world!,x=explorationOf(r)!;if(!pz)return '진행 중인 사건 퍼즐이 없습니다.';const st=pz.state,e=engineOf(r)!;
 const req=res.requires;for(const id of req.cleared??[]){const o=st.obstacles.find(o=>o.id===id)!;if(o.hp>0)return `${pz.def.obstacles.find(d=>d.id===id)!.name}을(를) 먼저 카드로 해소하세요(남은 ${o.hp}).`;}
 for(const [id,n] of Object.entries(req.atMost??{})){const o=st.obstacles.find(o=>o.id===id)!;if(o.hp>n)return `${pz.def.obstacles.find(d=>d.id===id)!.name}을(를) ${n} 이하로 낮추세요(현재 ${o.hp}).`;}
 for(const [m,n] of Object.entries(req.marks??{}))if((e.scene?.marks[m as Mark]??0)<n!)return `${MARK_NAMES[m as Mark]} ${n}이(가) 필요합니다.`;
 const funds=(res.cost?.funds??0)+(pz.def.id==='escort'&&res.id==='contract'&&x.inn?.quests.escort.evidence.includes('blocked')?1:0);
 if(w.preparation.funds<funds||w.preparation.food<(res.cost?.food??0))return '표시된 자금·군량이 부족합니다.';
 if(res.quality==='duel'&&!loadoutComplete(e.loadout))return '대결 전에 선제·대응·승부수 전술 3장을 고르세요.';
 if(x.tick+1>x.budget)return '준비 시간이 부족합니다.';
 return null;
}
export function puzzleResolutions(r:RunState){const pz=currentPuzzle(r);if(!pz)return [];return pz.def.resolutions.map(res=>({...res,reason:resolutionCheck(r,res)}));}
export function resolvePuzzle(r:RunState,id:string):Result {
 const pz=currentPuzzle(r),e=engineOf(r);if(!pz||!e)return no('진행 중인 사건 퍼즐이 없습니다.');const res=pz.def.resolutions.find(v=>v.id===id);if(!res)return no('없는 해결 방식입니다.');const reason=resolutionCheck(r,res);if(reason)return no(reason);
 const w=r.campaign!.world!,st=pz.state,h=explorationInternals.innHooks(r);
 const remaining=st.obstacles.filter(o=>o.hp>0).map(o=>o.id);
 // 결과에 쓰는 표식 소비
 for(const [m,n] of Object.entries(res.consume??{}))add(e.scene!.marks,m as Mark,-n!);
 // 설전 논거: 퍼즐에서 해소한 장애와 책임자 관계가 지속 논거로 남는다
 for(const o of pz.def.obstacles)if(!remaining.includes(o.id))addArgument(e,{id:`clue:${pz.def.id}:${o.id}`,source:o.id==='keeper_alert'||o.id==='clerk_guard'?'manager':'clue',label:`${pz.def.title} · ${o.name} 해소`,text:o.id==='keeper_alert'||o.id==='clerk_guard'?'신뢰 +1 (책임자의 증언)':o.key==='ledger'?'이익 요구 −1':o.key==='clue'?'안전 요구 −1':'명예 요구 −1'});
 if(st.log.length)e.telemetry.afterFailure.push(`${pz.def.id}:${res.id}`);
 let result:Result=ok;
 if(pz.def.id==='escort')result=resolveEscort(r,res,remaining);
 else if(pz.def.id==='recommendation')result=resolveRecommendation(r,res);
 else if(pz.def.id==='barracks')result=resolveBarracks(r,res);
 if(!result.ok)return result;
 st.status=res.quality==='partial'||remaining.length?'partial':'resolved';if(res.quality==='debate'||res.quality==='duel')st.status='resolved';st.resolution=res.id;st.marks={...e.scene!.marks};
 e.legacy.push({id:`${pz.def.id}:${res.id}`,kind:res.legacy.kind,text:res.legacy.text});
 log(e,`${pz.def.title} → ${res.label}${remaining.length?` · 남은 장애 ${remaining.length}`:''}`);
 h.emit('sceneInteractionResolved',`${pz.def.title} · ${res.label} · ${res.legacy.text}`);
 if(!e.rewardsTaken.includes(pz.def.id))e.reward=makeReward(r,pz.def.id,res);
 void w;return ok;
}
function resolveEscort(r:RunState,res:ResolutionDef,remaining:string[]):Result {
 const x=explorationOf(r)!,quest=x.inn!.quests.escort,h=explorationInternals.innHooks(r);
 if(quest.step===0){quest.evidence.push('inspect');quest.approaches.push('puzzle');quest.step=1;quest.status='active';}
 quest.evidence.push('puzzle:'+res.id);for(const o of remaining)quest.evidence.push('obstacle:'+o);
 if(engineOf(r)!.scene!.marks.supply&&engineOf(r)!.scene!.marks.supply!>=2)quest.evidence.push('stock');
 if(res.id==='contract'&&quest.evidence.includes('blocked')){const w=r.campaign!.world!;w.preparation.funds=Math.max(0,w.preparation.funds-1);}
 return handleInnAction(r,'quest:escort:'+res.id,h);
}
function resolveRecommendation(r:RunState,res:ResolutionDef):Result {
 const quest=explorationOf(r)!.inn!.quests.recommendation,h=explorationInternals.innHooks(r);
 quest.evidence.push('puzzle:'+res.id);
 if(res.id==='debate'){quest.step=2;quest.status='active';return handleInnAction(r,'quest:recommendation:debate',h);}
 if(!quest.evidence.includes('investigate'))quest.evidence.push('investigate');if(!quest.evidence.includes('verify'))quest.evidence.push('verify');
 if(res.id==='truth'){quest.result='complete';quest.evidence.push('verified');}
 if(res.id==='expose'&&!quest.evidence.includes('verified'))quest.evidence.push('verified');
 quest.step=3;quest.status='active';return handleInnAction(r,'quest:recommendation:'+res.id,h);
}
function resolveBarracks(r:RunState,res:ResolutionDef):Result {
 const x=explorationOf(r)!,w=r.campaign!.world!,base=EXPLORATION_EVENTS.barracks.stages[0].approaches,ix=explorationInternals;
 w.preparation.funds-=res.cost?.funds??0;w.preparation.food-=res.cost?.food??0;ix.advance(r,1);
 if(res.id==='duel'){const a=base.find(a=>a.id==='duel')!;x.socialApproach=a.id;ix.social(r,a);return ok;}
 const approach:ExplorationApproach=res.id==='drill'?{...base.find(a=>a.id==='drill')!,family:undefined,cost:undefined}:res.id==='inside'?{id:'inside',label:res.label,description:res.text,kind:'card',time:1,effects:{troops:3,influence:1,secure:true,plan:'barracks'}}:{id:'supply',label:res.label,description:res.text,kind:'trade',time:1,effects:{troops:4,training:1,secure:true,plan:'barracks',promise:'ration'}};
 ix.resolveApproach(r,approach,true);return ok;
}

/* ───────────── 보상·정제 ───────────── */
const REWARD_POOLS:Record<string,string[]>={escort:['weapons','defection','tunnel','fund','medicine','loan'],recommendation:['redress','order','contact','register','help'],barracks:['drill','captain','patrol','weapons','medicine']};
function makeReward(r:RunState,event:string,res:ResolutionDef){const e=engineOf(r)!,q=raisingOf(r)!;const pool=REWARD_POOLS[event].filter(id=>RAISING_CARDS[id]);const cards=shuffle(q,[...pool]).slice(0,3);const stratagems=shuffle(q,Object.keys(STRATAGEMS).filter(id=>!e.stratagems.includes(id))).slice(0,2);const officer=event==='escort'?'dianwei':event==='recommendation'?'xunyu':(personnelOf(r)!.party[0]??null);return {token:event+':'+res.id,event,cards,stratagems,item:event==='barracks'?'medicine':'ration',officer};}
export function chooseEngineReward(r:RunState,kind:string,a?:string,b?:string):Result {
 const e=engineOf(r),p=personnelOf(r)!,x=explorationOf(r)!,w=r.campaign!.world!;if(!e?.reward)return no('받을 사건 보상이 없습니다.');const rw=e.reward;
 if(kind==='card'){if(!a||!rw.cards.includes(a))return no('후보 카드 중에서 고르세요.');explorationInternals.giveCard(r,a,'사건 보상');}
 else if(kind==='skip'){e.stats.skips++;}
 else if(kind==='upgrade'){const res=upgradeLibraryCard(r,Number(a),b);if(!res.ok)return res;}
 else if(kind==='remove'){const res=removeLibraryCard(r,Number(a));if(!res.ok)return res;}
 else if(kind==='relation'){const id=a??rw.officer;const o=id&&p.officers[id];if(!o||o.information<2)return no('만난 인재를 고르세요.');o.trust=Math.min(100,o.trust+10);o.events.push('사건 보상 · 관계 신뢰 +10');p.revision++;}
 else if(kind==='stratagem'){if(!a||!rw.stratagems.includes(a))return no('제안된 책략 중에서 고르세요.');const res=equipStratagem(r,a,b,true);if(!res.ok)return res;}
 else if(kind==='item'){if(!rw.item)return no('제안된 아이템이 없습니다.');explorationInternals.giveItem(x,rw.item as ExplorationItemId,'사건 보상');}
 else if(kind==='burden-favor'){if(e.stats.burdenUses<2)return no('부담 카드를 두 번 이상 써야 열리는 보상입니다.');const l=p.library.find(c=>c.uid===Number(a)&&RAISING_CARDS[c.id]?.burden);if(!l)return no('바꿀 부담 카드를 고르세요.');l.id='fund';const c=raisingOf(r)!.cards.find(c=>c.personnelCard===l.uid);if(c)c.id='fund';p.revision++;log(e,'부담을 신용으로 · 부담 카드가 공동 기금으로 바뀜');}
 else if(kind==='resource'){if(a==='food')w.preparation.food=Math.min(200,w.preparation.food+2);else w.preparation.funds=Math.min(200,w.preparation.funds+2);}
 else return no('없는 보상 선택입니다.');
 if(kind==='skip')e.telemetry.rewards.declined++;else e.telemetry.rewards.taken.push(kind+(a?':'+a:''));
 e.rewardsTaken.push(rw.event);e.reward=null;log(e,`사건 보상 · ${({card:'카드 1장',skip:'받지 않기',upgrade:'카드 강화',remove:'카드 제거',relation:'인재 관계',stratagem:'책략',item:'아이템',resource:'자원'} as Record<string,string>)[kind]}`);return ok;
}
export function upgradeLibraryCard(r:RunState,uid:number,branch?:string):Result {const p=personnelOf(r)!,e=engineOf(r)!,l=p.library.find(c=>c.uid===uid);if(!l||l.upgrade||l.spent||!['bold','quiet'].includes(branch??''))return no('강화하지 않은 카드와 강화 분기(강행·정밀)를 고르세요.');l.upgrade=branch as 'bold'|'quiet';const c=raisingOf(r)!.cards.find(c=>c.personnelCard===uid);if(c)c.upgrade=l.upgrade;e.stats.cardsUpgraded++;p.revision++;return ok;}
export function removeLibraryCard(r:RunState,uid:number):Result {
 const p=personnelOf(r)!,e=engineOf(r)!,q=raisingOf(r)!,l=p.library.find(c=>c.uid===uid);if(!l)return no('보관함 카드를 고르세요.');if(l.owners.some(o=>o!==p.protagonistId))return no('인재 카드는 제거하지 않고 편성에서만 뺍니다.');if(p.loadouts.raising.length<=6&&p.loadouts.raising.includes(uid))return no('활동 덱은 최소 6장입니다.');
 p.library=p.library.filter(c=>c.uid!==uid);for(const k of Object.keys(p.loadouts) as (keyof typeof p.loadouts)[])p.loadouts[k]=p.loadouts[k].filter(v=>v!==uid);const c=q.cards.find(c=>c.personnelCard===uid);if(c){q.cards=q.cards.filter(v=>v.uid!==c.uid);for(const pile of ['draw','hand','discard','exhaust'] as const)q[pile]=q[pile].filter(v=>v!==c.uid);}e.stats.cardsRemoved++;p.revision++;return ok;
}

/* ───────────── 책략 ───────────── */
export function equipStratagem(r:RunState,id:string,replace?:string,free=false):Result {
 const e=engineOf(r),w=r.campaign!.world!,x=explorationOf(r);if(!e||!STRATAGEMS[id])return no('없는 책략입니다.');if(e.stratagems.includes(id))return no('이미 장착한 책략입니다.');
 if(e.stratagems.length>=STRATAGEM_SLOTS){if(!replace||!e.stratagems.includes(replace))return no(`책략은 ${STRATAGEM_SLOTS}칸입니다. 교체할 책략을 고르세요.`);
  if(!free){if(w.preparation.funds<STRATAGEM_SWAP.funds||x&&x.tick+STRATAGEM_SWAP.time>x.budget)return no('책략 교체에는 자금 1과 준비 시간 1이 듭니다.');w.preparation.funds-=STRATAGEM_SWAP.funds;if(x&&!x.converted)explorationInternals.advance(r,STRATAGEM_SWAP.time);}
  e.stratagems=e.stratagems.filter(v=>v!==replace);e.stratagemSwaps++;}
 e.stratagems.push(id);log(e,`책략 장착 · ${STRATAGEMS[id].name}`);return ok;
}
/** 인재 등용 직후 그 인재의 성향에 맞는 책략 하나를 제안 없이 바로 얻지 않도록, 책략은 사건 보상과 객사 숙박 대화에서만 얻는다. */

/* ───────────── 인재 성장 ───────────── */
export function talentGrowth(r:RunState,id:string,mode:string):Result {
 const p=personnelOf(r)!,e=engineOf(r),t=TALENTS[id],o=p.officers[id];if(!e||!t||!o)return no('주요 인재가 아닙니다.');if(!['add','upgrade','replace','principle'].includes(mode))return no('성장 방식(추가·강화·교체·원칙)을 고르세요.');
 if(mode==='add'){if(p.library.some(c=>c.id===t.growth.add.card&&c.owners.includes(id)))return no('이미 보유한 카드입니다. 다른 성장을 고르세요.');p.library.push({uid:p.nextUid++,id:t.growth.add.card,sourceType:'officer',sourceId:id,ownerType:'personal',owners:[id],activities:['raising','combat','admin','debate','diplomacy'],expires:null,spent:false});}
 if(mode==='upgrade'){const l=p.library.find(c=>c.id===t.growth.upgrade.card&&c.owners.includes(id))??p.library.find(c=>c.owners.includes(id)&&!c.upgrade&&!c.id.startsWith('support_'));if(!l||l.upgrade)return no('강화할 이 인재의 카드가 없습니다.');l.upgrade=t.growth.upgrade.branch;const c=raisingOf(r)!.cards.find(c=>c.personnelCard===l.uid);if(c)c.upgrade=l.upgrade;}
 if(mode==='replace'){const l=p.library.find(c=>c.id===t.growth.replace.from&&c.owners.includes(id));if(!l)return no('교체할 역할 카드가 없습니다.');l.id=t.growth.replace.to;const c=raisingOf(r)!.cards.find(c=>c.personnelCard===l.uid);if(c)c.id=l.id;}
 if(mode==='principle')e.principles[id]='alt';
 e.growth[id]=mode as 'add';o.growth=mode==='add'||mode==='upgrade'?'expert':'authority';o.relationship=o.growth==='authority'?'core':'valued';o.loyalty=Math.min(100,o.loyalty+10);o.events.push(`성장 · ${({add:t.growth.add.text,upgrade:t.growth.upgrade.text,replace:t.growth.replace.text,principle:t.growth.principle.text} as Record<string,string>)[mode]}`);p.stats.growth[mode]=(p.stats.growth[mode]??0)+1;return ok;
}

/* ───────────── 대결 전술 3장 ───────────── */
export const DUEL_TACTICS:Record<string,{slot:'opening'|'response'|'gambit';name:string;text:string;families:string[];talents:string[]}>={
 read:{slot:'opening',name:'수읽기',text:'상대의 행동 순서를 모두 공개하고 첫 피해 −3.',families:['intel','scheme'],talents:['lusu']},
 press:{slot:'opening',name:'선제 돌격',text:'기세 +2, 상대 체력 −3.',families:['military'],talents:['dianwei']},
 shield:{slot:'opening',name:'방비 진형',text:'방비 +5.',families:['supply'],talents:['chengpu']},
 second:{slot:'response',name:'보좌 개입',text:'쓰러질 피해를 한 번 체력 1로 버팁니다.',families:['network','cause'],talents:['xunyu','lusu']},
 counter:{slot:'response',name:'반격 태세',text:'첫 방어 성공 때 반격 피해 5.',families:['military'],talents:['dianwei']},
 ration:{slot:'response',name:'보급 회복',text:'체력이 절반 이하가 되면 한 번 6 회복.',families:['supply'],talents:['chengpu']},
 all_in:{slot:'gambit',name:'결사 일격',text:'승부수: 기세를 모두 써서 피해 8+기세×3.',families:['military'],talents:['dianwei']},
 expose:{slot:'gambit',name:'허점 폭로',text:'승부수: 방비 제거·피해 6·이번 상대 피해 무효.',families:['scheme','intel'],talents:['lusu']},
 oath:{slot:'gambit',name:'맹약의 증언',text:'승부수: 체력 5 회복·기세 +2·피해 4.',families:['cause','network'],talents:['xunyu']},
};
export function duelTacticOptions(r:RunState){const q=raisingOf(r)!,talents=activeTalents(r);const families=new Set(q.cards.map(c=>CARD_GRAMMAR[c.id].family));return Object.entries(DUEL_TACTICS).map(([id,t])=>{const byCard=t.families.find(f=>families.has(f as never)),byTalent=t.talents.find(v=>talents.includes(v));return {id,...t,ok:!!(byCard||byTalent),source:byTalent?`${OFFICERS[byTalent].name} 동행`:byCard?`활동 덱의 ${FAMILY6_NAMES[byCard as keyof typeof FAMILY6_NAMES]} 카드`:'활동 덱에 관련 카드·인재 없음'};});}
export const loadoutComplete=(l:DuelLoadout)=>!!(l.opening&&l.response&&l.gambit);
export function setDuelLoadout(r:RunState,opening:string,response:string,gambit:string):Result {const e=engineOf(r);if(!e)return no('카드 엔진 이전 저장입니다.');const opts=duelTacticOptions(r);for(const [slot,id] of [['opening',opening],['response',response],['gambit',gambit]] as const){const o=opts.find(o=>o.id===id);if(!o||o.slot!==slot)return no('선제·대응·승부수 칸에 맞는 전술을 고르세요.');if(!o.ok)return no(`${o.name}: ${o.source}`);}e.loadout={opening,response,gambit};log(e,`대결 전술 · ${[opening,response,gambit].map(id=>DUEL_TACTICS[id].name).join(' / ')}`);return ok;}
export function setDuelTactic(r:RunState,slot:string,id:string):Result {const e=engineOf(r);if(!e)return no('카드 엔진 이전 저장입니다.');const o=duelTacticOptions(r).find(o=>o.id===id);if(!['opening','response','gambit'].includes(slot)||!o||o.slot!==slot)return no('칸에 맞는 전술을 고르세요.');if(!o.ok)return no(`${o.name}: ${o.source}`);e.loadout[slot as 'opening']=id;return ok;}
/** 대결 생성 직후 호출: 선제 전술을 적용하고 대응·승부수를 대결 상태에 싣는다. */
export function applyDuelLoadout(r:RunState,s:DuelState){const e=engineOf(r);if(!e||!loadoutComplete(e.loadout))return;const l=e.loadout;s.loadout={opening:l.opening,response:l.response,gambit:l.gambit,used:[]};
 if(l.opening==='read'){s.loadout.revealed=true;s.log.push('수읽기: 상대 행동 순서 공개·첫 피해 −3');}
 if(l.opening==='press'){s.momentum=Math.min(5,s.momentum+2);s.enemyHp=Math.max(1,s.enemyHp-3);s.log.push('선제 돌격: 기세 +2·상대 체력 −3');}
 if(l.opening==='shield'){s.protection=(s.protection??0)+5;s.log.push('방비 진형: 방비 +5');}
}

/* ───────────── 설전 논거 ───────────── */
export interface ArgumentView {id:string;label:string;source:string;text:string}
export function debateArguments(r:RunState):ArgumentView[] {
 const e=engineOf(r),x=explorationOf(r),p=personnelOf(r);if(!e||!p)return [];const out:ArgumentView[]=e.arguments.map(a=>({id:a.id,label:a.label,source:({clue:'조사 단서',item:'증거 아이템',talent:'인재 지원',manager:'책임자 관계',puzzle:'사건 결과'})[a.source],text:a.text}));
 for(const item of x?.items??[])if(['ledger','letter','seal'].includes(item.id)&&!out.some(a=>a.id==='item:'+item.id))out.push({id:'item:'+item.id,label:EXPLORATION_ITEMS[item.id].name+' (보유)',source:'증거 아이템',text:item.id==='ledger'?'이익 요구 −1':item.id==='letter'?'명예 요구 −1':'권한 요구 −1'});
 for(const id of activeTalents(r))out.push({id:'talent:'+id,label:`${OFFICERS[id].name}의 지원`,source:'인재 지원',text:({xunyu:'신뢰 +1',lusu:'부담 한도 +1',dianwei:'안전 요구 −1',chengpu:'이익 요구 −1'} as Record<string,string>)[id]});
 return out;
}
/** 설전 시작 직후 지속 논거를 적용한다. 요구는 1 아래로 내려가지 않는다. */
export function applyDebateArguments(r:RunState,s:DebateState){
 const n=s.negotiation;if(!n)return [];const args=debateArguments(r);s.engineArgs={initial:args.length,record:args.filter(a=>/장부|기록|문서|공백/.test(a.label)).length,context:s.engineArgs?.context??''};
 for(const a of args){const m=a.text.match(/^(이익|명예|안전|권한) 요구 −(\d)/);if(m){const axis=({이익:'profit',명예:'honor',안전:'safety',권한:'authority'} as const)[m[1] as '이익'];if(n.needs[axis]!==undefined)n.needs[axis]=Math.max(1,n.needs[axis]!-Number(m[2]));}
  else if(a.text.startsWith('신뢰'))s.trust=Math.min(10,s.trust+1);else if(a.text.startsWith('부담 한도'))n.burdenLimit+=1;}
 const clauses=args.filter(a=>a.id.startsWith('clause:')).length;if(s.deck&&clauses){for(let i=0;i<Math.min(2,clauses);i++){const uid=s.deck.nextUid++;s.deck.cards.push({uid,id:'redress',temporary:true});s.deck.draw.unshift(uid);}s.log.push(`조항 초안 ${clauses}건 → 「조항 정리」 ${Math.min(2,clauses)}장`);}
 if(args.length)s.log.push('지속 논거 '+args.length+'개: '+args.map(a=>a.label).join(', '));return args;
}

/* ───────────── 군진 전투 임시 카드 ───────────── */
export function escortBattleConversions(r:RunState):{card:string;label:string;source:string}[] {
 const x=explorationOf(r),quest=x?.inn?.quests.escort,p=personnelOf(r);if(!quest||!p)return [];const ev=quest.evidence,out:{card:string;label:string;source:string}[]=[];
 if(ev.some(v=>v.startsWith('contract:')&&v!=='contract:conditional'))out.push({card:'formation',label:'호위 계약',source:'계약으로 붙은 호위 인원 → 방진'});
 if(ev.includes('duel-grade:완벽한 인정')||ev.includes('duel-grade:인정')||ev.includes('puzzle:duel')&&ev.includes('verified')&&!ev.some(v=>v.startsWith('duel-grade:')))out.push({card:'escort-formation',label:ev.includes('duel-grade:완벽한 인정')?'호위 대표의 완벽한 인정':'호위 대표의 인정',source:'호위 편성 → 시작 방비 3, 첫 방비 카드 때 반격 카드 1장 생성(편성은 한 번만)'});
 const pz=engineOf(r)?.puzzles.escort;if(pz&&pz.obstacles.every(o=>o.hp===0))out.push({card:'prepared-hand',label:'준비 완료',source:'창고 장애를 모두 풀어 첫 손에 방어 카드 1장 보장'});
 if(ev.includes('workers')||ev.includes('lusu-joint')||(engineOf(r)?.puzzles.escort?.inspected.includes('workers')))out.push({card:'feint',label:'짐꾼 증언',source:'짐꾼이 아는 매복 지점 → 양동'});
 if(ev.includes('stock'))out.push({card:'requisition',label:'비축 군량',source:'보급 2 이상으로 해결 → 징발'});
 if(ev.includes('alternate-route'))out.push({card:'ambush',label:'우회로',source:'좁은 우회로 → 매복'});
 const o=p.officers.dianwei;if(o&&(o.trust>=45||x!.companions.includes('dianwei')))out.push({card:'readied',label:'장수 신뢰',source:'전위의 신뢰 → 반격 태세'});
 if(ev.includes('risk:client'))out.push({card:'rabble',label:'책임 분담',source:'사고 책임을 우리가 짐 → 부담 카드'});
 for(const o of ev.filter(v=>v.startsWith('obstacle:')).slice(0,2))out.push({card:'unrest',label:'남은 장애',source:`${PUZZLES.escort.obstacles.find(d=>d.id===o.slice(9))?.name??'장애'} 미해결 → 동요(부담)`});
 return out;
}

/* ───────────── 거병 관문 규칙 ───────────── */
export function gateRuleText(plan:string){return ({assembly:'민회와 격문: 기본 명예 요구 +2, 서로 다른 인재 1명당 −1(최대 3), 사적 이해 2마다 +1. 같은 인재 카드를 연달아 쓰면 사적 이해, 서로 다른 인재를 이으면 공론이 쌓입니다. 공론이 고급 조항 「공동 통치」를 열고, 사적 이해가 많으면 막힙니다. 지킬 약속이 없으면 「주민 부담 제한」을 얻지 못합니다. 강한 압박(단호한 질문 2회 이상)은 빠르지만 거병 후 불신 현안을 남깁니다. 등급은 조항·신뢰·부담·보존 논거·라운드·특별 목표로 정해집니다.',barracks:'군영 장악: 거리·자세가 있는 대결입니다. 병사 지원(병영 퍼즐의 수비대 경계·군기 해이가 남으면 늘어남)을 간보기로 걷어내고, 방비로 막아 반격·빈틈을 만든 뒤 짧은 승부수로 제압하면 「완전 장악」. 빈틈 없이 한 번에 18 이상(과잉 무력)·지원 미제거·4합 초과는 등급을 낮추고, 「명목상 장악」이면 병영 피해와 불만이 남습니다. 반격이 준비된 방비(반격 추가 피해가 있을 때)는 지켜보던 병사 지원도 하나 흩어지게 합니다. 생산한 방비는 시작 방비, 기세 3마다 시작 기세 +1, 반격 2회마다 반격 피해 +3.',inside:'성문 내응: 감시·지휘관·병사 지지 세 장애. 단서 4 이상 또는 비밀 우회로 → 감시 무력화(첫 합 기습), 장부 3 이상과 설전 완전 합의 → 지휘관 논거 무력화, 둘 중 하나 → 약화(상대 승부수 제거), 내부 협력 2 이상 → 병사 지원 제거, 설전 완전 합의 또는 지지·공론 3 이상 → 병사 지지 확보, 기세 6 이상 → 시작 기세 +2, 비밀 우회로 → 시작 거리 선택. 셋 모두 해결하면 대결 없이 개방, 일부면 다른 지원·의도·거리로 대결, 남은 장애는 거병 후 치안·충성 현안이 됩니다.'} as Record<string,string>)[plan]??'';}
export function gateBuildSummary(r:RunState){const e=engineOf(r);if(!e)return null;const p=personnelOf(r)!;const talents=e.stats.distinctOwners.filter(o=>o!=='faction'&&o!==p.protagonistId&&!o.includes('+')).length;return {talents,causeChains:e.stats.chains['명분→지지']??0,momentum:e.stats.produced.momentum??0,supply:e.stats.produced.supply??0,inside:e.stats.produced.inside??0,clue:e.stats.produced.clue??0,ledger:e.stats.produced.ledger??0,support:e.stats.produced.support??0,opinion:e.stats.produced.opinion??0,guard:e.stats.produced.guard??0,counters:e.stats.consumed.guard??0,privateInterest:e.stats.privateInterest??0,infoChains:(e.stats.chains['정보→인맥']??0)+(e.stats.chains['정보→계책']??0),clauses:e.arguments.filter(a=>a.id.startsWith('clause:')).length,barracks:e.puzzles.barracks,legacy:e.legacy.map(l=>l.id)};}
export const profileOf=(r:RunState)=>GATE_PROFILES[engineOf(r)?.profile??'standard'];
export function applyGateDebateRules(r:RunState,s:DebateState,plan:string){const e=engineOf(r),n=s.negotiation;if(!e||!n)return;const b=gateBuildSummary(r)!,pf=profileOf(r);s.maxRounds=pf.debate.maxRounds;s.engineArgs={initial:0,record:0,context:'gate:'+plan};
 if(plan==='assembly'){n.needs.honor=Math.min(12,(n.needs.honor??3)+2-Math.min(3,b.talents)+Math.floor(b.privateInterest/2));if(n.needs.safety!==undefined)n.needs.safety=Math.max(1,n.needs.safety-Math.min(2,b.causeChains));const focus=Math.min(2,Math.floor(b.opinion/3));s.resolve=Math.min(6,s.resolve+focus);s.log.push(`민회 규칙: 참여 인재 ${b.talents}명·명분→지지 ${b.causeChains}회·공론 ${b.opinion}·사적 이해 ${b.privateInterest} → 집중 +${focus}`);}
 if(plan==='inside'){if(b.legacy.includes('barracks:inside'))s.trust=Math.min(10,s.trust+1);if(b.inside>=3)s.trust=Math.min(10,s.trust+1);s.log.push(`성문 내응 규칙: 내부 협력 생산 ${b.inside}`);}
 applyDebateArguments(r,s);
}
/** 성문 내응 세 장애(감시·지휘관·병사 지지)의 해결 상태. 설전 결과와 표식이 서로 다른 장애를 약화한다. */
export function insideObstacles(r:RunState,debateGrade:string|null){const b=gateBuildSummary(r);if(!b)return null;const passage=b.legacy.includes('escort:alternate');const ok=debateGrade==='success';
 const watch=b.clue>=4||passage;const commander=b.ledger>=3&&ok?'resolved':b.ledger>=3||ok?'weakened':'unresolved';const supportRemoved=b.inside>=2,loyalty=ok||b.support+b.opinion>=3;
 const soldiers=supportRemoved&&loyalty?'resolved':supportRemoved||loyalty?'weakened':'unresolved';
 const conv:{id:string;text:string}[]=[];
 conv.push(watch?{id:'initiative',text:`감시 무력화(${passage?'비밀 우회로':`단서 ${b.clue}`}) → 첫 합 기습`}:{id:'watch-open',text:`감시 남음(단서 ${b.clue}/4) → 거병 후 치안 현안`});
 conv.push(commander==='unresolved'?{id:'commander-open',text:`지휘관 논거 그대로(장부 ${b.ledger}/3·설전 ${debateGrade??'없음'}) → 상대 승부수 유지`}:{id:'commander',text:`지휘관 논거 ${commander==='resolved'?'무력화':'약화'}(장부 ${b.ledger}·설전 ${debateGrade??'없음'}) → 상대 승부수 제거${commander==='resolved'?'·견제 제거':''}`});
 conv.push(supportRemoved?{id:'no-support',text:`내부 협력 ${b.inside} → 병사 지원 카드 제거`}:{id:'support-open',text:`내부 협력 ${b.inside}/2 → 병사 지원 2 유지`});
 conv.push(loyalty?{id:'loyalty',text:`${ok?'설전 완전 합의':`지지·공론 ${b.support+b.opinion}`} → 병사 지지 확보`}:{id:'loyalty-open',text:'병사 지지 미확보 → 거병 후 충성 현안'});
 if(b.momentum>=6)conv.push({id:'momentum',text:`기세 ${b.momentum} → 시작 기세 +2`});
 if(passage)conv.push({id:'distance',text:'비밀 우회로 → 시작 거리 선택'});
 return {watch,commander,soldiers,passage,all:watch&&commander==='resolved'&&soldiers==='resolved',conversions:conv};}
export function insideConversions(r:RunState,debateGrade:string|null){return insideObstacles(r,debateGrade)?.conversions??[];}
/** 대결 2판 설정: 사건 목표·프로필·준비 결과를 거리·지원·의도·시작 자원으로 바꾼다. */
export function setupEngineDuel(r:RunState,s:DuelState,objective:string,extra:{support?:number;distance?:'near'|'mid'|'far'}={}){const pf=profileOf(r);enableDuelV2(s,objective,{distance:extra.distance??pf.duel.startDistance,support:Math.max(0,extra.support??pf.duel.support),profile:pf.id,maxRounds:pf.duel.maxRounds,pattern:pf.duel.patterns[s.opponentId]});applyDuelLoadout(r,s);}
export function applyGateDuelRules(r:RunState,s:DuelState,plan:string,debateGrade:string|null){const e=engineOf(r);if(!e)return;const b=gateBuildSummary(r)!;
 if(plan==='barracks'){const pz=b.barracks,left=(id:string)=>!pz||pz.obstacles.find(o=>o.id===id)!.hp>0;const support=Math.max(0,profileOf(r).duel.support+(left('garrison_alert')?1:0)+(left('discipline')?1:0)-(b.legacy.includes('duel:escort-perfect')?1:0));
  setupEngineDuel(r,s,'barracks_gate',{support});s.momentum=Math.min(5,s.momentum+Math.min(3,Math.floor(b.momentum/3)));s.protection=(s.protection??0)+Math.min(6,b.guard);s.counterBonus=Math.min(2,Math.floor(b.counters/2))*3;if(b.legacy.includes('escort:duel'))s.momentum=Math.min(5,s.momentum+1);
  s.log.push(`군영 규칙: 병사 지원 ${support}(수비대 경계·군기 해이 ${left('garrison_alert')||left('discipline')?'남음':'해결'})·방비 생산 ${b.guard}·기세 생산 ${b.momentum}·반격 ${b.counters}회 → 시작 방비 ${s.protection}·기세 ${s.momentum}·반격 추가 ${s.counterBonus}`);return;}
 if(plan==='inside'){const o=insideObstacles(r,debateGrade)!;const distance=o.passage?(e.insideDistance??'near'):undefined;setupEngineDuel(r,s,'inside_gate',{support:o.soldiers==='resolved'||o.conversions.some(c=>c.id==='no-support')?0:2,distance});
  if(o.watch)s.initiative=true;if(o.commander!=='unresolved')s.pattern=s.pattern.map(a=>a==='finisher'?'strike':a);if(o.conversions.some(c=>c.id==='momentum'))s.momentum=Math.min(5,s.momentum+2);if(o.soldiers==='unresolved')s.enemyMaxHp=s.enemyHp=s.enemyHp+4;
  s.log.push('성문 내응 전환: '+o.conversions.map(c=>c.text).join(' / '));return;}
 applyDuelLoadout(r,s);
}
export function insideSkipsDuel(r:RunState,debateGrade:string|null){return insideObstacles(r,debateGrade)?.all??false;}
/** 관문 결과 → 최종 조항·대결 목표 등급·남은 장애를 거병 후 기록으로 남긴다. */
export function engineGateOutcome(r:RunState,plan:string,debateGrade:string|null,duel:DuelState|null){const e=engineOf(r);if(!e)return null;const push=(id:string,kind:'policy'|'obligation'|'gate',text:string)=>{if(!e.legacy.some(l=>l.id===id))e.legacy.push({id,kind,text});};let duelEval:ReturnType<typeof evaluateDuel>|null=null;
 if(duel?.v2&&duel.result!=='ongoing'){duelEval=evaluateDuel(duel);e.duels!.push({context:'gate:'+plan,grade:duelEval.grade,result:duel.result,rounds:duelEval.rounds,reasons:duelEval.checks.flatMap(c=>c.items.filter(i=>!i.ok).map(i=>`${c.grade}: ${i.text}`)).slice(0,8)});e.duels=e.duels!.slice(-10);e.telemetry.results.push(`${plan}:duel:${duelEval.grade}`);
  if(plan==='barracks'){if(duelEval.grade==='완전 장악')push('gate:barracks-duel','policy','군영 완전 장악 · 병사 지지 · 훈련 정책');else if(duelEval.grade==='장악')push('gate:barracks-hold','gate','군영 장악 · 지휘권 인정');else if(duelEval.grade==='명목상 장악')push('issue:soldiers','obligation','명목상 장악 · 병영 피해와 병사 불만 현안');}
  if(plan==='inside'&&duelEval.grade==='강제 개방')push('issue:gate-force','obligation','강제 개방 · 성문 수비대 반발 현안');}
 if(plan==='inside'){const o=insideObstacles(r,debateGrade)!;if(!o.watch)push('issue:watch','obligation','감시 미해결 · 거병 후 치안 현안');if(o.soldiers!=='resolved')push('issue:soldiers','obligation',o.conversions.some(c=>c.id==='loyalty-open')?'병사 지지 미확보 · 거병 후 충성 현안':'성문 병사 일부가 내부 협력 없이 남음 · 거병 후 충성 현안');if(o.commander==='unresolved')push('issue:commander','obligation','구 지휘관 반발 현안');}
 if(debateGrade)e.telemetry.results.push(`${plan}:debate:${debateGrade}`);return duelEval;}

/* ───────────── 첫 협력 인재: 공통 카드 교체·조기 책략 ───────────── */
export const PACT_CARDS:Record<string,string[]>={xunyu:['x_document','x_orthodox','x_guard_args','x_refine'],dianwei:['d_guard','d_momentum','d_counter','d_direct'],lusu:['l_trade','l_ledger','l_convert','l_mediate']};
export const PACT_STRATAGEMS:Record<string,string[]>={xunyu:['many_hands','oath_policy','heavy_burden'],dianwei:['open_flag','banner_march','heavy_burden'],lusu:['ledger_net','relay_trust','heavy_burden']};
export const COMMON_CARDS=['manifesto','coin','clues','food'];
const PACT_QUEST:Record<string,string>={recommendation:'xunyu',escort:'dianwei',accounts:'lusu'};
/** 첫 주요 인재의 의뢰를 수락하면 한 번 열린다. */
export function openPact(r:RunState,quest:string){const e=engineOf(r);const talent=PACT_QUEST[quest];if(!e||e.pact||!talent)return;e.pact={talent,open:true,cards:[...PACT_CARDS[talent]],stratagems:PACT_STRATAGEMS[talent].filter(id=>!e.stratagems.includes(id)),swaps:[],stratagem:null};log(e,`${OFFICERS[talent].name}와 첫 협력 · 공통 카드 최대 2장을 전용 카드로 바꾸고 책략 1개를 고르세요.`);}
export function pactSwap(r:RunState,card:string,oldUid:number):Result {
 const e=engineOf(r),p=personnelOf(r)!,q=raisingOf(r)!,pact=e?.pact;if(!pact?.open)return no('열린 협력 제안이 없습니다.');if(pact.swaps.length>=2)return no('교체는 2장까지입니다.');if(!pact.cards.includes(card)||pact.swaps.some(s=>s.added===card))return no('이 인재의 전용 카드 중 아직 넣지 않은 카드를 고르세요.');
 const old=p.library.find(l=>l.uid===oldUid);if(!old||!p.loadouts.raising.includes(old.uid)||!COMMON_CARDS.includes(old.id)||old.sourceType!=='protagonist')return no('활동 덱의 공통 카드(격문·사재·조사·곡물)만 교체할 수 있습니다.');
 p.loadouts.raising=p.loadouts.raising.filter(v=>v!==old.uid);const oc=q.cards.find(c=>c.personnelCard===old.uid);if(oc){q.cards=q.cards.filter(c=>c.uid!==oc.uid);for(const pile of ['draw','hand','discard','exhaust'] as const)q[pile]=q[pile].filter(v=>v!==oc.uid);}
 const l={uid:p.nextUid++,id:card,sourceType:'officer' as const,sourceId:pact.talent,ownerType:'personal' as const,owners:[p.protagonistId],activities:['raising' as const,'debate' as const,'combat' as const],expires:null,spent:false};p.library.push(l);p.loadouts.raising.push(l.uid);
 const c={uid:q.nextUid++,id:card,personnelCard:l.uid};q.cards.push(c);(q.hand.length<8?q.hand:q.discard).push(c.uid);
 pact.swaps.push({removed:old.id,added:card});e!.telemetry.swaps.push(`협력 교체 ${old.id}→${card}`);p.revision++;q.revision++;log(e!,`협력 교체 · ${RAISING_CARDS[old.id].name} → ${RAISING_CARDS[card].name}`);return ok;
}
export function pactStratagem(r:RunState,id:string):Result {const e=engineOf(r),pact=e?.pact;if(!pact?.open||pact.stratagem)return no('책략 선택이 열려 있지 않습니다.');if(!pact.stratagems.includes(id))return no('제안된 책략 3개 중에서 고르세요.');const res=equipStratagem(r,id,e!.stratagems[0],true);if(!res.ok)return res;pact.stratagem=id;return ok;}
export function pactClose(r:RunState):Result {const e=engineOf(r);if(!e?.pact?.open)return no('열린 협력 제안이 없습니다.');if(!e.pact.swaps.length&&!e.pact.stratagem){log(e,`${OFFICERS[e.pact.talent].name}와의 협력 전환을 미룸 · 다음 주요 인재 의뢰에서 다시 제안`);e.pact=null;return ok;}e.pact.open=false;log(e,'첫 협력 확정');return ok;}

/* ───────────── 계측: 로컬 디버그 리포트 ───────────── */
export function recordSequence(r:RunState,kind:'debate'|'duel'|'battle',context:string,action:string|null,result?:string){const e=engineOf(r);if(!e)return;const t=e.telemetry;let cur=t.sequences.at(-1);if(!cur||cur.result||cur.kind!==kind||cur.context!==context){cur={kind,context,actions:[],result:''};t.sequences.push(cur);t.sequences=t.sequences.slice(-20);}if(action){cur.actions.push(action);cur.actions=cur.actions.slice(-60);}if(result)cur.result=result;}
export function buildDebugReport(r:RunState){const e=engineOf(r),p=personnelOf(r),x=explorationOf(r);if(!e||!p)return null;const t=e.telemetry;const deck=p.loadouts.raising.map(uid=>p.library.find(l=>l.uid===uid)!).filter(Boolean).map(l=>l.id);
 return {kind:'cheonha-gunjin-debug-report',version:2,profile:e.profile??'standard',protagonist:p.protagonistId,survey:t.survey??{},debates:e.debates??[],duels:e.duels??[],insideDistance:e.insideDistance??null,note:'로컬 디버그 리포트 · 외부 전송 없음 · 개인 정보 없음',seed:r.campaign?.seed,tick:x?.tick,deck,storage:p.library.filter(l=>!p.loadouts.raising.includes(l.uid)).map(l=>l.id),cardPlays:t.plays,unusedInDeck:deck.filter(id=>!t.plays[id]),firstPlays:t.firstPlays,marksProduced:e.stats.produced,marksConsumed:e.stats.consumed,chains:e.stats.chains,stratagems:e.stratagems,stratagemTriggers:t.stratagems,rewards:t.rewards,deckSwaps:t.swaps,cardsPerEvent:t.events,sequences:t.sequences,withdrawals:t.withdrawals,cancels:t.cancels,afterFailure:t.afterFailure,results:t.results,puzzles:Object.values(e.puzzles).map(z=>({id:z.id,status:z.status,resolution:z.resolution,left:z.obstacles.filter(o=>o.hp>0).map(o=>o.id)})),legacy:e.legacy};}


/* ───────────── 휴식 정제 ───────────── */
export function engineRest(r:RunState,mode:string,a?:string,b?:string):Result {
 const e=engineOf(r)!,x=explorationOf(r)!,p=personnelOf(r)!,day=Math.floor(x.tick/6);if(e.rests.includes(day))return no('정제 휴식은 하루에 한 번입니다.');
 if(mode==='remove'){const res=removeLibraryCard(r,Number(a));if(!res.ok)return res;}
 else if(mode==='upgrade'){const res=upgradeLibraryCard(r,Number(a),b);if(!res.ok)return res;}
 else if(mode==='talk'){const o=a&&p.officers[a];if(!o||!x.companions.includes(a!))return no('동행 인재와 대화하세요.');o.trust=Math.min(100,o.trust+5);o.xp=Math.min(99,o.xp+1);o.events.push('휴식 중 대화 · 신뢰 +5·경험 +1');p.revision++;}
 else if(mode!=='fatigue')return no('피로 회복·카드 제거·카드 강화·인재 대화 중 하나를 고르세요.');
 e.rests.push(day);e.rests=e.rests.slice(-10);return ok;
}

/* ───────────── 거병 후 결과 ───────────── */
export function engineFoundingResult(r:RunState):string[] {const e=engineOf(r);if(!e)return [];return e.legacy.map(l=>`${({policy:'정책',obligation:'의무',gate:'관문'} as const)[l.kind]} · ${l.text}`);}
export function engineSummary(r:RunState){const e=engineOf(r),p=personnelOf(r);if(!e||!p)return null;return {stratagems:e.stratagems.map(id=>STRATAGEMS[id].name),principles:activeTalents(r).map(id=>`${TALENTS[id].name}: ${principleOf(e,id)==='base'?TALENTS[id].principle.name:TALENTS[id].alt.name}`),deck:p.loadouts.raising.map(uid=>p.library.find(c=>c.uid===uid)!).filter(Boolean).map(l=>RAISING_CARDS[l.id].name+(l.upgrade?`+${l.upgrade==='bold'?'강행':'정밀'}`:'')),chains:e.stats.chains,produced:e.stats.produced,consumed:e.stats.consumed,legacy:e.legacy,arguments:e.arguments.map(a=>a.label),loadout:e.loadout,puzzles:Object.values(e.puzzles).map(p=>({id:p.id,status:p.status,resolution:p.resolution,left:p.obstacles.filter(o=>o.hp>0).map(o=>o.id)}))};}
/** 거병 성공 시 사건 퍼즐·책략의 결과를 도시 정책·약속으로 옮긴다. 정책은 도시 상한(2)까지만. */
const LEGACY_POLICY:Record<string,string>={'gate:assembly-clause':'settlement','gate:barracks-duel':'training','gate:inside-duel':'relay','escort:debate':'granary','escort:contract-bond':'relay','recommendation:truth':'settlement','barracks:drill':'training','oath:0':'settlement','oath:1':'granary'};
const LEGACY_PROMISE:Record<string,'ration'|'authority'|'shared'>={'gate:assembly-conditional':'authority','escort:contract':'ration','recommendation:conditional':'ration','recommendation:expose':'authority','barracks:supply':'ration','escort:contract-shared':'shared'};
export function applyEngineFounding(r:RunState,city:CityState,policyExists:(id:string)=>boolean):string[] {
 const e=engineOf(r);if(!e)return [];const lines:string[]=[];const c=r.campaign!;
 const policy=(pol:string,text:string)=>{if(!policyExists(pol))return;if(city.policies.length<2&&!city.policies.some(p=>p.id===pol)){city.policies.push({id:pol,remaining:3});lines.push(`정책 시행 · ${text}`);}else lines.push(`정책 후보(상한 초과로 보류) · ${text}`);};
 const promise=(id:string,text:string)=>{if(!city.promises.some(p=>p.id===id))city.promises.push({id,due:3,status:'active'});lines.push(`의무 · ${text}`);};
 for(const l of e.legacy){
  if(l.id.startsWith('deal:')&&CLAUSES[l.id.slice(5)]){const cl=CLAUSES[l.id.slice(5)],ef=cl.effects;
   if(ef.policy)policy(ef.policy,`${cl.name} 조항`);if(ef.obligation)promise(ef.obligation,`${cl.name} 조항`);
   for(const [g,n] of Object.entries(ef.groups??{}))city.groups[g as 'locals']=Math.max(-3,Math.min(3,city.groups[g as 'locals']+n!));
   for(const [m,n] of Object.entries(ef.metrics??{}))city.metrics[m as 'order']=Math.max(0,Math.min(100,city.metrics[m as 'order']+n!));
   if(ef.facility){const d=city.districts.find(d=>d.id===ef.facility!.district);if(d){d.damage=0;lines.push(`시설 보존 · ${ef.facility.text}`);}}
   if(ef.officer){const o=personnelOf(r)?.officers[ef.officer];if(o&&o.information>=2&&!c.roster.includes(ef.officer)){c.roster.push(ef.officer);r.campaign!.world!.reserveOfficers.push(ef.officer);o.relationship='recruited';lines.push(`인재 합류 · ${OFFICERS[ef.officer].name} (${cl.name} 조항)`);}}
   if(ef.followup)lines.push(`후속 사건 · ${ef.followup}`);
   if(Object.keys(ef.groups??{}).length)lines.push(`집단 관계 · ${cl.name}: ${Object.entries(ef.groups!).map(([g,n])=>({locals:'주민',traders:'상단',refugees:'유민'} as Record<string,string>)[g]+(n!>0?' +':' ')+n).join(', ')}`);
   continue;}
  if(l.id==='deal:distrust'){city.metrics.order=Math.max(0,city.metrics.order-5);city.groups.locals=Math.max(-3,city.groups.locals-1);lines.push('현안 · 강한 압박에 대한 주민 불신(질서 −5, 주민 관계 −1)');continue;}
  if(l.id.startsWith('issue:')){city.metrics[l.id==='issue:watch'?'security':'order']=Math.max(0,city.metrics[l.id==='issue:watch'?'security':'order']-5);lines.push(`현안 · ${l.text}`);continue;}
  const pol=l.kind==='policy'?LEGACY_POLICY[l.id]:undefined,pr=LEGACY_PROMISE[l.id];
  if(pol)policy(pol,l.text);else if(pr)promise(pr,l.text);else lines.push(`기록 · ${l.text}`);}
 return lines;
}

/* ───────────── 설전 등급·조항 ───────────── */
export function debateContextFor(r:RunState,s:DebateState,context:string){const e=engineOf(r)!,q=raisingOf(r)!,b=gateBuildSummary(r)!;
 return clauseContext(s,context,{argsInitial:s.engineArgs?.initial??0,recordArgs:s.engineArgs?.record??0,opinion:e.stats.produced.opinion??0,privateInterest:e.stats.privateInterest??0,pledges:q.pledges.length,promiseMarks:e.stats.produced.promise??0,talents:b.talents,profile:e.profile??'standard'});}
/** 화면 표시용(상태 변경 없음). */
export function debateEvaluationPreview(r:RunState,s:DebateState,context:string){const e=engineOf(r);if(!e||!s.negotiation||s.result==='ongoing')return null;return evaluateDebate(s,debateContextFor(r,s,context));}
/** 진행 중 설전: 지금 최종 제안하면 받을 등급·조항(상태 변경 없음). 끝난 설전은 실제 평가. */
export function debateLivePreview(r:RunState,s:DebateState,context:string){const e=engineOf(r);if(!e||!s.negotiation)return null;if(s.result!=='ongoing')return {settled:true,ev:evaluateDebate(s,debateContextFor(r,s,context))};const pv=deckPreview(s,'settle');if(!pv.check.ok)return null;return {settled:false,ev:evaluateDebate(pv.state,debateContextFor(r,pv.state,context))};}
/** 설전 종료 명령에서 한 번: 등급·조항을 기록하고 즉시 효과를 적용, 거병 후 효과는 legacy로 남긴다. */
export function engineDebateFinished(r:RunState,s:DebateState,context:string):DebateEvaluation|null {
 const e=engineOf(r);if(!e||!s.negotiation||s.result==='ongoing')return null;const ev=evaluateDebate(s,debateContextFor(r,s,context));const w=r.campaign!.world!,q=raisingOf(r)!;
 for(const id of ev.clauses){const c=CLAUSES[id];const im=c.effects.immediate??{};for(const f of ['support','funds','food','exposure'] as const)if(im[f])w.preparation[f]=Math.max(0,Math.min(200,w.preparation[f]+im[f]!));if(im.legitimacy)q.legitimacy=Math.min(200,q.legitimacy+im.legitimacy);
  const lid='deal:'+id;if(!e.legacy.some(l=>l.id===lid))e.legacy.push({id:lid,kind:c.effects.policy?'policy':c.effects.obligation?'obligation':'gate',text:`조항 「${c.name}」 · ${c.text}`});}
 if(ev.pressure&&!e.legacy.some(l=>l.id==='deal:distrust'))e.legacy.push({id:'deal:distrust',kind:'obligation',text:'강한 압박으로 빨리 끝낸 설전 · 거병 후 불신 현안'});
 e.debates!.push({context,grade:ev.grade,base:ev.base,clauses:ev.clauses,pressure:ev.pressure,rounds:ev.rounds,failed:ev.checks.flatMap(c=>c.items.filter(i=>!i.ok).map(i=>`${c.grade}: ${i.text}`)).slice(0,8)});e.debates=e.debates!.slice(-10);
 e.telemetry.results.push(`${context}:debate:${ev.grade}`);log(e,`설전 결과 ${ev.grade} · 조항 ${ev.clauses.map(id=>CLAUSES[id].name).join('·')||'없음'}`);return ev;
}

/** 엔진 관문 등급: 설전 조항 등급·대결 목표 등급으로 거병 결과(대성공·성공·조건부)를 정한다. */
const RANK:Record<string,number>={'탁월한 합의':3,'유리한 합의':3,'일반 합의':2,'조건부 합의':1,'결렬':0,'완전 장악':3,'장악':2,'명목상 장악':1,'조용한 개방':3,'개방':2,'강제 개방':1,'실패':0};
export function engineGateGrade(r:RunState,plan:string,duelGrade:string|null,duel:DuelState|null):'great'|'success'|'conditional'{const e=engineOf(r)!;const deb=[...e.debates!].reverse().find(d=>d.context==='gate:'+plan);const ranks:number[]=[];if(deb)ranks.push(RANK[deb.grade]??1);if(duel?.v2&&duelGrade)ranks.push(duel.result==='draw'?1:RANK[duelGrade]??1);const m=ranks.length?Math.min(...ranks):2;return m>=3?'great':m===2?'success':'conditional';}
export function engineGateLines(r:RunState,plan:string){const e=engineOf(r);if(!e)return [];const out:string[]=[];const deb=[...e.debates!].reverse().find(d=>d.context==='gate:'+plan);if(deb){out.push(`설전 등급 ${deb.grade} · 조항 ${deb.clauses.map(id=>CLAUSES[id].name).join('·')||'없음'}`);const miss=deb.failed.filter(f=>f.startsWith('탁월한 합의: ')).map(f=>f.slice(8));if(deb.grade!=='탁월한 합의'&&miss.length)out.push('탁월한 합의 미충족: '+miss.join(' · '));}const du=[...e.duels!].reverse().find(d=>d.context==='gate:'+plan);if(du){out.push(`대결 목표 등급 ${du.grade} · ${du.rounds}합`);const g0=du.reasons[0]?.split(': ')[0];if(g0&&g0!==du.grade&&(RANK[g0]??0)>(RANK[du.grade]??0))out.push(`${g0} 미충족: `+du.reasons.filter(t=>t.startsWith(g0+': ')).map(t=>t.slice(g0.length+2)).join(' · '));}return out;}
/** 의뢰·연습 대결 종료 처리: 목표 등급을 기록하고 관계·계약 결과를 바꾼다(한 번만). */
export function engineDuelFinished(r:RunState,s:DuelState,context:string){const e=engineOf(r);if(!e||!s.v2||s.result==='ongoing')return null;const ev=evaluateDuel(s),def=DUEL_OBJECTIVES[s.v2.objective],p=personnelOf(r)!,x=explorationOf(r)!;
 e.duels!.push({context,grade:ev.grade,result:s.result,rounds:ev.rounds,reasons:ev.checks.flatMap(c=>c.items.filter(i=>!i.ok).map(i=>`${c.grade}: ${i.text}`)).slice(0,8)});e.duels=e.duels!.slice(-10);e.telemetry.results.push(`${context}:duel:${ev.grade}`);
 const trust=def.relationshipEffects[ev.grade]??0,o=p.officers.dianwei;if(trust&&o){o.trust=Math.max(0,Math.min(100,o.trust+trust));o.events.push(`${def.name} · ${ev.grade} · 신뢰 ${trust>0?'+':''}${trust}`);p.revision++;}
 if(def.id==='escort_captain'){const q=x.inn?.quests.escort;if(q){q.evidence.push('duel-grade:'+ev.grade);if(ev.grade==='조건부 인정'){q.evidence.push('contract:conditional');}}if(ev.grade==='완벽한 인정'&&!e.legacy.some(l=>l.id==='duel:escort-perfect'))e.legacy.push({id:'duel:escort-perfect',kind:'gate',text:'호위 대표의 완벽한 인정 · 군영 장악 대결 병사 지원 −1'});if(ev.injury.enemyGrave&&!e.legacy.some(l=>l.id==='issue:escort-injury'))e.legacy.push({id:'issue:escort-injury',kind:'obligation',text:'호위 대표 중상 · 호위대 반감 현안'});}
 log(e,`대결 목표 「${def.name}」 · ${ev.grade}`);return ev;}
/** 첫 손 부담 과다 안전장치: 장소 첫 손패에 부담 카드가 2장 이상이면 1장만 남기고 나머지는 덱 맨 아래로 보낸 뒤 다른 카드를 뽑는다. */
export function burdenHandSafety(r:RunState){const e=engineOf(r),q=raisingOf(r)!;if(!e)return;const burden=(uid:number)=>!!CARD_GRAMMAR[q.cards.find(c=>c.uid===uid)!.id]?.burden;const extra=q.hand.filter(burden).slice(1);for(const uid of extra){const next=[...q.draw].reverse().find(v=>!burden(v));if(next===undefined)break;q.hand=q.hand.map(v=>v===uid?next:v);q.draw=q.draw.filter(v=>v!==next);q.draw.unshift(uid);log(e,'첫 손 부담 과다 · 부담 카드 1장을 덱 아래로 돌림');}}
