/**
 * 사람 플레이테스트: 고정 프리셋(「거병 프롤로그 플레이테스트」), 일반 저장과 분리된 저장 키, 로컬 전용 로그.
 * 로그는 명령 경계(한 번의 행동)마다 작은 상태 투영(probe)을 비교해 관찰 사실만 적는다. 재미 판정은 하지 않는다.
 * 외부 전송 없음: 이 모듈은 저장소(KV)와 문자열만 다룬다.
 */
import {newWorldCampaign} from './world.ts';
import {startCityExploration} from './city-exploration-start.ts';
import {explorationOf} from './city-exploration.ts';
import {raisingOf} from './raising.ts';
import {engineOf,burdenSettlementStatus,BURDEN_SETTLEMENTS} from './card-engine.ts';
import {personnelOf} from './personnel-rules.ts';
import {evaluateDuel} from '../data/duel-objectives.ts';
import {debateLivePreview} from './card-engine.ts';
import {RAISING_CARDS} from '../data/raising.ts';
import {DUEL_CARDS} from '../data/duel-cards.ts';
import {DEBATE_CARDS} from '../data/debate-cards.ts';
import {ARGUMENT_DEFS} from '../data/debate-field.ts';
import {CLAUSES} from '../data/clauses.ts';
import {OFFICERS} from '../data/personnel.ts';
import {CITY_EXPLORATION_DEFS} from '../data/city-exploration.ts';
import {DISTANCE_NAMES,STANCE_NAMES} from './duel.ts';
import {ISSUE_DEFS,POLICY_DEFS} from '../data/cities.ts';
import type {RunState} from './types.ts';
import type {Result} from './run.ts';
import type {KV} from './save.ts';

export const PLAYTEST_PRESET={id:'prologue-v1',name:'거병 프롤로그 플레이테스트',seed:141001,profile:'standard' as const,city:'xingyang' as const,founder:'chengong' as const,origin:'notable' as const,
 conditions:['시드 141001','표준 난도','형양','진궁','재야 명사','추천 경로 기본 비공개','개발자 정보 비공개','로컬 로그 활성화','외부 네트워크 전송 없음']};
/** 일반 캠페인 저장(`cheonha-gunjin.campaign`)과 다른 키. 로그도 별도 키. */
export const PLAYTEST_SAVE_KEY='cheonha-gunjin.playtest.campaign';
export const PLAYTEST_LOG_KEY='cheonha-gunjin.playtest.log';
export const PLAYTEST_LOG_VERSION=1;

export interface PlaytestFlag {preset:string;version:1;startedAt:number}
export interface PlaytestEntry {n:number;tick:number;at:number;kind:string;cat?:string;text:string;data?:Record<string,unknown>}
export interface PrepSpend {n:number;tick:number;cat:PrepCategory;time:number;power:number;text:string}
export type PrepCategory='이동'|'장소 진입'|'조사'|'카드 사용'|'사건'|'의뢰'|'설전 준비'|'대결 준비'|'휴식'|'기타';
export const PREP_CATEGORIES:PrepCategory[]=['이동','장소 진입','조사','카드 사용','사건','의뢰','설전 준비','대결 준비','휴식','기타'];
export interface SurveyAnswer {score:number;note:string}
export interface ObserverNote {n:number;tick:number;at:number;tag:string;text:string}
export interface PlaytestLog {version:1;preset:string;seed:number;startedAt:number;actions:number;entries:PlaytestEntry[];prep:PrepSpend[];survey:Record<string,SurveyAnswer>;observer:ObserverNote[];routeOpened:number[];sessions:number}

export const CORE_SURVEY:{id:string;text:string}[]=[
 {id:'next',text:'다음에 무엇을 해야 하는지 알 수 있었는가?'},
 {id:'combo',text:'카드 조합을 스스로 발견했다고 느꼈는가?'},
 {id:'talent',text:'인재 선택이 덱과 해결 방식에 영향을 줬는가?'},
 {id:'protect',text:'설전에서 어떤 논거를 지켜야 하는지 이해했는가?'},
 {id:'duel',text:'대결에서 거리·자세·빈틈을 고려했는가?'},
 {id:'grade',text:'결과 등급이 나온 이유를 이해했는가?'},
 {id:'length',text:'거병 준비 과정이 길거나 반복적으로 느껴졌는가?'},
 {id:'again',text:'다른 인재와 거병 계획으로 다시 해 보고 싶은가?'},
];
export const DETAIL_SURVEY:{id:string;text:string}[]=[
 {id:'d-pick',text:'카드를 얻을 때 선택이 어려웠는가?'},
 {id:'d-marks',text:'표식(생산·소비)을 이해했는가?'},
 {id:'d-quest',text:'의뢰 목표를 찾기 쉬웠는가?'},
 {id:'d-prep',text:'준비 전술을 기억하고 사용했는가?'},
 {id:'d-gambit',text:'승부수 경고를 읽었는가?'},
 {id:'d-gate',text:'거병 관문이 준비를 시험한다고 느꼈는가?'},
 {id:'d-burden',text:'부담 결산 선택의 차이를 이해했는가?'},
 {id:'d-route',text:'추천 경로를 열었다면, 어느 시점이었는가?'},
];
export const OBSERVER_TAGS=['처음 멈춘 지점','잘못 이해한 용어','카드 상세 다시 읽음','결과에 놀람','반복 클릭','목표 상실','추천 경로 열람','자발적 덱 변경','두 번째 빌드 의사'];

export const isPlaytest=(r:RunState|null|undefined):boolean=>!!r?.campaign?.playtest;
export {validPlaytestFlag} from './playtest-flag.ts';

/** 프리셋 시작: 한 번의 조작으로 시드·난도·도시·인물·출신을 고정한다. */
export function startPlaytest(now=Date.now()):RunState{
 const r=newWorldCampaign(PLAYTEST_PRESET.seed).activeExpedition!;const res=startCityExploration(r,PLAYTEST_PRESET.city,PLAYTEST_PRESET.founder,PLAYTEST_PRESET.origin);if(!res.ok)throw new Error(res.reason);
 const e=engineOf(r);if(e)e.profile=PLAYTEST_PRESET.profile;
 r.campaign!.playtest={preset:PLAYTEST_PRESET.id,version:1,startedAt:now};return r;}
export function newPlaytestLog(now=Date.now()):PlaytestLog{return {version:1,preset:PLAYTEST_PRESET.id,seed:PLAYTEST_PRESET.seed,startedAt:now,actions:0,entries:[],prep:[],survey:{},observer:[],routeOpened:[],sessions:1};}
export function savePlaytestLog(kv:KV,log:PlaytestLog):boolean{try{kv.setItem(PLAYTEST_LOG_KEY,JSON.stringify(log));return true;}catch{return false;}}
export function loadPlaytestLog(kv:KV):PlaytestLog|null{try{const raw=kv.getItem(PLAYTEST_LOG_KEY);if(!raw)return null;const l=JSON.parse(raw);if(!l||l.version!==1||!Array.isArray(l.entries)||!Array.isArray(l.prep))return null;l.survey??={};l.observer??=[];l.routeOpened??=[];l.sessions??=1;return l as PlaytestLog;}catch{return null;}}

/* ───────────── 상태 투영(probe)과 차이 ───────────── */
export interface Probe {
 tick:number;power:number;location:string;scene:string;event:string|null;queueNext:number;engineLog:number;raisingLog:number;
 hand:string[];deck:string[];library:string[];storage:string[];produced:Record<string,number>;consumed:Record<string,number>;strat:Record<string,number>;
 quests:Record<string,string>;companions:string[];officers:Record<string,string>;plans:string[];
 duel:null|{round:number;distance:string;stance:string;oppStance:string;opening:boolean;oppOpening:boolean;momentum:number;hp:number;enemyHp:number;hand:string[];tactic:string[];log:number;exLog:number;result:string;grade:string;blind:number;excessive:boolean;injuries:number;objective:string};
 debate:null|{round:number;trust:number;resolve:number;hand:string[];log:number;history:number;result:string;grade:string;player:string[];opponent:string[];hidden:string[];exposed:string[];focus:string|null;clauses:string[];context:string};
 gate:{phase:string;plan:string|null}|null;founded:boolean;
}
const cardName=(id:string)=>RAISING_CARDS[id]?.name??id;
export function probe(r:RunState):Probe{
 const x=explorationOf(r),q=raisingOf(r),e=engineOf(r),p=personnelOf(r);
 const lib=p?.library??[];const deck=(p?.loadouts.raising??[]).map(uid=>lib.find(l=>l.uid===uid)?.id??'?');
 const u=x?.duel??q?.gate?.duel??null,s=x?.debate??q?.gate?.debate??null;
 const duel=u?.deck&&u.v2?{round:u.round,distance:u.v2.distance,stance:u.v2.stance??'',oppStance:u.deck.oppStance??'',opening:u.v2.opening,oppOpening:u.deck.oppOpening,momentum:u.momentum,hp:u.hp,enemyHp:u.enemyHp,hand:u.deck.hand.map(id=>u.deck!.cards.find(c=>c.uid===id)!.id),tactic:u.deck.tacticHand.map(id=>u.deck!.cards.find(c=>c.uid===id)!.id),log:u.log.length,exLog:u.deck.stats.log.length,result:u.result,grade:evaluateDuel(u).grade,blind:u.v2.stats.blindFinishers??0,excessive:(u.v2.stats.forceHit??0)>=18,injuries:u.deck.injuries.length,objective:u.v2.objective}:null;
 let debate:Probe['debate']=null;if(s?.deck&&s.field){const f=s.field;const ctx=s.engineArgs?.context||x?.inn?.activity?.event||x?.event?.id||(q?.phase==='debate'?'gate:'+q.plan:'city');const live=debateLivePreview(r,s,ctx);debate={round:s.round,trust:s.trust,resolve:s.resolve,hand:s.deck.hand.map(id=>s.deck!.cards.find(c=>c.uid===id)!.id),log:s.log.length,history:f.history.length,result:s.result,grade:live?.ev.grade??'',player:[f.playerCore,...f.player].map(a=>a.definitionId),opponent:[f.opponentCore,...f.opponent].filter(a=>a.durability>0).map(a=>a.definitionId),hidden:f.hidden.map(a=>a.definitionId),exposed:f.hidden.filter(a=>a.exposed).map(a=>a.definitionId),focus:f.focus??null,clauses:live?.ev.clauses??[],context:ctx};}
 return {tick:x?.tick??0,power:q?.power??0,location:x?.location??'',scene:x?.scene??'',event:x?.event?.id??null,queueNext:x?.nextEventId??0,engineLog:e?.log.length??0,raisingLog:q?.log.length??0,
  hand:(q?.hand??[]).map(uid=>q!.cards.find(c=>c.uid===uid)?.id??'?'),deck,library:lib.map(l=>l.id),storage:lib.filter(l=>!(p?.loadouts.raising??[]).includes(l.uid)).map(l=>l.id),produced:{...(e?.stats.produced??{})},consumed:{...(e?.stats.consumed??{})},strat:{...(e?.telemetry.stratagems??{})},
  quests:Object.fromEntries(Object.entries(x?.inn?.quests??{}).map(([id,qs])=>[id,`${qs.status}:${qs.step}`])),companions:[...(x?.companions??[])],officers:Object.fromEntries(Object.entries(p?.officers??{}).map(([id,o])=>[id,o.relationship])),plans:[...(x?.unlockedPlans??[])],
  duel,debate,gate:q?{phase:q.phase,plan:q.plan??null}:null,founded:!!r.campaign?.world&&r.campaign.world.stage!=='setup'&&!!q&&q.phase==='founded'};}

export function prepCategory(action:string,before:Probe):PrepCategory{
 if(action.startsWith('move:'))return '이동';if(action==='enter'||action.startsWith('select:'))return '장소 진입';if(action.startsWith('scene:inspect')||action.startsWith('engine:inspect'))return '조사';
 if(action.startsWith('card:')||action.startsWith('engine:play')||action.startsWith('play:'))return '카드 사용';if(action.startsWith('inn:lodge')||action.startsWith('rest')||action.startsWith('inn:rest'))return '휴식';
 if(action.startsWith('inn:'))return '의뢰';if(action.startsWith('engine:tactic')||action.startsWith('engine:resolve:duel')||action.startsWith('duel:prepare'))return '대결 준비';if(action.startsWith('engine:resolve:debate')||action.startsWith('engine:evidence'))return '설전 준비';
 if(action.startsWith('approach:')||action.startsWith('engine:resolve')||action.startsWith('engine:reward')||action.startsWith('officer:'))return '사건';if(before.scene==='debate')return '설전 준비';if(before.scene==='duel')return '대결 준비';return '기타';}

const diffList=(a:string[],b:string[])=>{const ca=new Map<string,number>(),cb=new Map<string,number>();for(const x of a)ca.set(x,(ca.get(x)??0)+1);for(const x of b)cb.set(x,(cb.get(x)??0)+1);const added:string[]=[],removed:string[]=[];for(const [k,n] of cb)for(let i=(ca.get(k)??0);i<n;i++)added.push(k);for(const [k,n] of ca)for(let i=(cb.get(k)??0);i<n;i++)removed.push(k);return {added,removed};};
const sum=(o:Record<string,number>)=>Object.values(o).reduce((v,n)=>v+n,0);
/** 한 번의 행동 전후 투영을 비교해 로그 항목을 만든다(순수 함수). 새 로그 줄은 상태 기록에서 가져온다. */
export function diffProbe(before:Probe,after:Probe,action:string,r:RunState,n:number,now:number):{entries:PlaytestEntry[];prep:PrepSpend|null}{
 const out:PlaytestEntry[]=[];const E=(kind:string,text:string,data?:Record<string,unknown>,cat?:string)=>out.push({n,tick:after.tick,at:now,kind,cat,text,data});
 const x=explorationOf(r),q=raisingOf(r),e=engineOf(r);const def=x?CITY_EXPLORATION_DEFS[x.cityId]:null;const place=(id:string)=>def?.locations.find(l=>l.id===id)?.name??id;
 E('action',action,{scene:after.scene,location:after.location},'행동');
 if(before.location!==after.location)E('탐색','방문 장소 '+place(after.location),{from:before.location,to:after.location,path:[before.location,after.location]},'이동');
 if(x)for(const ev of x.queue.filter(v=>v.id>=before.queueNext))E('탐색',ev.text,{type:ev.type,location:ev.location},ev.type);
 if(q)for(const line of q.log.slice(before.raisingLog))E('거병',line,undefined,'raising');
 if(e)for(const line of e.log.slice(before.engineLog))E('덱',line,undefined,'engine');
 const dh=diffList(before.hand,after.hand);const dd=diffList(before.deck,after.deck);const dl=diffList(before.library,after.library);
 if(dl.added.length)E('덱','카드 획득 '+dl.added.map(cardName).join('·'),{cards:dl.added},'획득');
 if(dl.removed.length)E('덱','카드 제외 '+dl.removed.map(cardName).join('·'),{cards:dl.removed},'제외');
 if(dd.added.length||dd.removed.length)E('덱',`카드 편성 ${dd.added.map(cardName).join('·')||'-'} / 해제 ${dd.removed.map(cardName).join('·')||'-'}`,{in:dd.added,out:dd.removed},'편성');
 if(action.startsWith('card:')||action.startsWith('play:')){const played=dh.removed.filter(id=>!dh.added.includes(id));if(played.length)E('덱','사용 카드 '+played.map(cardName).join('·'),{cards:played,handLeft:after.hand,unusedInHand:after.hand},'사용');}
 if(before.location!==after.location||before.scene!==after.scene){const idle=before.hand.filter(id=>!after.hand.includes(id));void idle;}
 const pd=sum(after.produced)-sum(before.produced),cd=sum(after.consumed)-sum(before.consumed);if(pd||cd)E('덱',`표식 생성 ${pd} · 소비 ${cd}`,{produced:after.produced,consumed:after.consumed},'표식');
 for(const [k,v] of Object.entries(after.strat))if((before.strat[k]??0)<v)E('덱','책략 발동 '+k,{id:k},'책략');
 for(const [id,st] of Object.entries(after.quests))if(before.quests[id]!==st)E('의뢰',`의뢰 ${id} · ${st}`,{quest:id,state:st},'의뢰');
 for(const [id,rel] of Object.entries(after.officers))if(before.officers[id]!==rel)E('인재',`${OFFICERS[id]?.name??id} 관계 ${before.officers[id]??'-'} → ${rel}`,{officer:id,relationship:rel},'관계');
 for(const pl of after.plans)if(!before.plans.includes(pl))E('거병','거병 계획 발견 '+pl,{plan:pl},'계획');
 // 설전
 const sb=before.debate,sa=after.debate;if(sa){const s=x?.debate??q?.gate?.debate;const f=s?.field;
  if(!sb)E('설전','설전 시작 · '+sa.context,{context:sa.context,hand:sa.hand,opponent:sa.opponent,hidden:sa.hidden.length},'시작');
  if(sb&&action.includes('card:')){const used=diffList(sb.hand,sa.hand).removed;E('설전','논거 선택 '+used.map(id=>DEBATE_CARDS[id]?.name??id).join('·'),{cards:used,target:sb.focus,action},'카드');}
  if(sb&&action.includes('target:'))E('설전','공격 대상 지정 '+(ARGUMENT_DEFS[[...(f?.opponent??[]),f?.opponentCore,...(f?.hidden??[])].find(a=>a?.argumentId===sa.focus)?.definitionId??'']?.name??sa.focus),{focus:sa.focus},'대상');
  if(f)for(const line of f.history.slice(sb?.history??0)){const kind=line.includes('공개')?'숨은 논거 공개':line.includes('보호')?'보호':line.includes('논박')||line.includes('공격')?'공격':'기록';E('설전',line,undefined,kind);}
  if(sb){const gone=sb.opponent.filter(id=>!sa.opponent.includes(id));if(gone.length)E('설전','상대 논거 제거 '+gone.map(id=>ARGUMENT_DEFS[id]?.name??id).join('·'),{args:gone},'제거');
   const newly=sa.exposed.filter(id=>!sb.exposed.includes(id));if(newly.length)E('설전','숨은 논거 공개 '+newly.map(id=>ARGUMENT_DEFS[id]?.name??id).join('·'),{args:newly},'공개');
   if(sb.grade!==sa.grade)E('설전',`예상 등급 ${sb.grade} → ${sa.grade}`,{from:sb.grade,to:sa.grade},'등급');
   if(sb.clauses.join()!==sa.clauses.join())E('설전','조항 변화 '+(sa.clauses.map(id=>CLAUSES[id]?.name??id).join('·')||'없음'),{clauses:sa.clauses},'조항');
   if(action.includes('settle'))E('설전','최종 제안',{grade:sa.grade},'최종 제안');
   if(sb.result==='ongoing'&&sa.result!=='ongoing'){const live=s?debateLivePreview(r,s,sa.context):null;E('설전',`결과 ${sa.result} · ${sa.grade}`,{result:sa.result,grade:sa.grade,missed:live?.ev.checks.flatMap(c=>c.items.filter(i=>!i.ok).map(i=>c.grade+': '+i.text))??[],remainingOpp:sa.opponent,attacks:f?.stats.attacks,destroyedOpp:f?.stats.destroyedOpp},'결과');}}}
 // 대결
 const ub=before.duel,ua=after.duel;if(ua){const u=x?.duel??q?.gate?.duel;
  if(!ub)E('대결','대결 시작 · '+ua.objective,{objective:ua.objective,hand:ua.hand,tactic:ua.tactic,distance:ua.distance},'시작');
  if(ub&&action.includes('card:')){const used=diffList([...ub.hand,...ub.tactic],[...ua.hand,...ua.tactic]).removed;const fromTactic=used.filter(id=>ub.tactic.includes(id)&&!ua.tactic.includes(id));
   E('대결',`카드 ${used.map(id=>DUEL_CARDS[id]?.name??id).join('·')} · ${DISTANCE_NAMES[ua.distance as 'near']} · 자세 ${ua.stance?STANCE_NAMES[ua.stance as 'offense']:'없음'}/${ua.oppStance?STANCE_NAMES[ua.oppStance as 'offense']:'-'} · 빈틈 ${ua.opening||ua.oppOpening?'있음':'없음'} · 기세 ${ua.momentum}`,{cards:used,round:ua.round+1,distance:ua.distance,stance:ua.stance,oppStance:ua.oppStance,opening:ua.opening,oppOpening:ua.oppOpening,momentum:ua.momentum,prepared:fromTactic},'카드');
   if(fromTactic.length)E('대결','준비 전술 사용 '+fromTactic.map(id=>DUEL_CARDS[id]?.name??id).join('·'),{cards:fromTactic},'준비 전술');
   if(ua.blind>ub.blind)E('대결','빈틈 없는 승부수',{round:ua.round+1},'빈틈 없는 승부수');}
  if(u?.deck)for(const l of u.deck.stats.log.slice(ub?.exLog??0))E('대결',`${l.exchange}합 ${l.cards.join('→')||'카드 없음'} / 상대 ${l.intent} · 준 ${l.dealt} · 받은 ${l.taken}${l.notes.length?' · '+l.notes.join('·'):''}`,{exchange:l.exchange,cards:l.cards,intent:l.intent,dealt:l.dealt,taken:l.taken,notes:l.notes},'합');
  if(ub&&!ub.excessive&&ua.excessive)E('대결','과잉 무력',undefined,'과잉 무력');
  if(ub&&ua.injuries>ub.injuries)E('대결','부상',{injuries:ua.injuries},'부상');
  if(ub&&ub.grade!==ua.grade)E('대결',`예상 등급 ${ub.grade} → ${ua.grade}`,{from:ub.grade,to:ua.grade},'등급');
  if(ub&&ub.result==='ongoing'&&ua.result!=='ongoing'){const ev=u?evaluateDuel(u):null;E('대결',`결과 ${ua.result} · ${ua.grade}`,{result:ua.result,grade:ua.grade,rounds:ua.round,hp:ua.hp,injuries:ua.injuries,excessive:ua.excessive,blind:ua.blind,missed:ev?.checks.flatMap(c=>c.items.filter(i=>!i.ok).map(i=>c.grade+': '+i.text))??[]},'결과');}}
 // 거병
 if(before.gate&&after.gate&&before.gate.plan!==after.gate.plan&&after.gate.plan)E('거병','거병 계획 선택 '+after.gate.plan,{plan:after.gate.plan,timeLeft:Math.max(0,(x?.budget??42)-after.tick)},'계획');
 if(before.gate&&after.gate&&before.gate.phase!=='founded'&&after.gate.phase==='founded'){const st=burdenSettlementStatus(r);const city=r.campaign?.active?r.campaign.cities[r.campaign.active]:null;
  E('거병','거병 완료',{plan:after.gate.plan,timeLeft:Math.max(0,(x?.budget??42)-after.tick),officers:Object.entries(after.officers).filter(([,v])=>['recruited','valued','core'].includes(v)).map(([id])=>id),deck:after.deck,policies:city?.policies.map(p=>p.id)??[],promises:city?.promises.map(p=>p.id+':'+p.status)??[],issues:city?.issues.map(i=>i.id)??[],settlement:st?.chosen?BURDEN_SETTLEMENTS[st.chosen].name:null,treasury:r.campaign?.world?.treasury},'완료');}
 if(action.startsWith('engine:settle:'))E('거병','부담 결산 선택 '+(BURDEN_SETTLEMENTS[action.slice(14)]?.name??action.slice(14)),{id:action.slice(14)},'부담 결산');
 const time=after.tick-before.tick,power=before.power-after.power;let prep:PrepSpend|null=null;
 if(time>0||(power>0&&before.location===after.location&&before.scene===after.scene)){const cat=prepCategory(action,before);prep={n,tick:after.tick,cat,time:Math.max(0,time),power:Math.max(0,power),text:`${cat} · ${action}`};E('준비',`${cat} · 시간 ${time>0?time:0} · 준비력 ${power>0?power:0}`,{cat,time,power,action},'준비');}
 return {entries:out,prep};}

/** 명령 경계에서 호출: 행동 하나를 로그에 반영한다. */
export function recordAction(log:PlaytestLog,before:Probe,after:Probe,action:string,r:RunState,now=Date.now()):PlaytestLog{log.actions++;const d=diffProbe(before,after,action,r,log.actions,now);log.entries.push(...d.entries);if(d.prep)log.prep.push(d.prep);return log;}
/** 화면 조작(열람·펼침 등)을 기록: 상태를 바꾸지 않는 관찰. */
export function recordUi(log:PlaytestLog,r:RunState,kind:string,text:string,data?:Record<string,unknown>,now=Date.now()):PlaytestLog{const tick=explorationOf(r)?.tick??0;log.entries.push({n:log.actions,tick,at:now,kind:'화면',cat:kind,text,data});if(kind==='추천 경로 열람')log.routeOpened.push(log.actions);return log;}
export function recordObserver(log:PlaytestLog,r:RunState,tag:string,text:string,now=Date.now()):PlaytestLog{log.observer.push({n:log.actions,tick:explorationOf(r)?.tick??0,at:now,tag,text});return log;}
export function setSurvey(log:PlaytestLog,id:string,score:number,note:string):Result{if(![...CORE_SURVEY,...DETAIL_SURVEY].some(q=>q.id===id)||!Number.isInteger(score)||score<1||score>5)return {ok:false,reason:'설문 문항 또는 점수가 올바르지 않습니다.'};log.survey[id]={score,note:note.slice(0,300)};return {ok:true};}

/* ───────────── 준비력·시간 내역 ───────────── */
export function prepSummary(log:PlaytestLog){const byCat:Record<string,{time:number;power:number;count:number}>={};for(const p of log.prep){const c=byCat[p.cat]??={time:0,power:0,count:0};c.time+=p.time;c.power+=p.power;c.count++;}
 return {recent:log.prep.slice(-5).reverse(),totalTime:log.prep.reduce((v,p)=>v+p.time,0),totalPower:log.prep.reduce((v,p)=>v+p.power,0),byCat:PREP_CATEGORIES.filter(c=>byCat[c]).map(c=>({cat:c,...byCat[c]}))};}

/* ───────────── 읽을 수 있는 요약 ───────────── */
function pairs(entries:PlaytestEntry[]){const path:string[]=[];for(const en of entries){if(en.kind==='탐색'&&en.cat==='이동')path.push(String(en.data?.to??''));else if(en.kind==='탐색'&&en.cat==='locationEntered')path.push(`${en.data?.location??''} 진입`);}return path;}
/** 같은 두 장소를 목표 없이 오간 구간: 의뢰·사건·카드 기록 없이 A→B→A→B 왕복. */
export function detectLoops(log:PlaytestLog):string[]{const out:string[]=[];const moves=log.entries.filter(e=>e.kind==='탐색'&&e.cat==='이동');for(let i=0;i+3<moves.length;i++){const a=moves[i],b=moves[i+1],c=moves[i+2],d=moves[i+3];if(a.data?.to===c.data?.to&&b.data?.to===d.data?.to&&a.data?.to!==b.data?.to){const between=log.entries.filter(e=>e.n>a.n&&e.n<=d.n&&['의뢰','사건','사용','획득','시작'].includes(e.cat??''));if(!between.length)out.push(`행동 ${a.n}~${d.n}: ${a.text.replace('방문 장소 ','')}↔${b.text.replace('방문 장소 ','')} 왕복(사이에 의뢰·사건·카드 기록 없음)`);}}
 const repeats=log.entries.filter(e=>e.kind==='action');for(let i=2;i<repeats.length;i++)if(repeats[i].text===repeats[i-1].text&&repeats[i].text===repeats[i-2].text&&!repeats[i].text.startsWith('social:')&&!repeats[i].text.startsWith('camera'))out.push(`행동 ${repeats[i-2].n}~${repeats[i].n}: 같은 명령 3회 연속 (${repeats[i].text})`);
 return [...new Set(out)];}
export function summarizeLog(log:PlaytestLog,r:RunState|null):string{
 const L:string[]=[];const x=r?explorationOf(r):undefined,q=r?raisingOf(r):undefined,p=r?personnelOf(r):undefined,e=r?engineOf(r):undefined;
 L.push(`# 플레이테스트 요약 · ${PLAYTEST_PRESET.name}`,'',`- 프리셋 ${log.preset} · 시드 ${log.seed} · 세션 ${log.sessions}회 · 행동 수 ${log.actions} · 캠페인 시간 ${x?.tick??'-'}/${x?.budget??42}`,`- 관찰 사실만 적습니다. 재미 여부를 자동으로 판정하지 않습니다.`,'');
 const path=pairs(log.entries);L.push('## 방문 경로',path.length?path.map((id,i)=>`${i+1}. ${id}`).join('\n'):'(이동 없음)','');
 if(p){const deck=p.loadouts.raising.map(uid=>p.library.find(l=>l.uid===uid)).filter(Boolean).map(l=>cardName(l!.id));L.push('## 최종 덱',deck.join(' · ')||'(없음)','');}
 const used=new Set(log.entries.filter(en=>en.cat==='사용').flatMap(en=>(en.data?.cards as string[])??[]));const seen=new Set(log.entries.filter(en=>en.cat==='사용').flatMap(en=>(en.data?.unusedInHand as string[])??[]));
 L.push('## 핵심 카드 연쇄',Object.entries(e?.stats.chains??{}).map(([k,v])=>`- ${k} × ${v}`).join('\n')||'(기록 없음)','','## 미사용 카드(손에 있었으나 쓰지 않음)',[...seen].filter(id=>!used.has(id)).map(cardName).join(' · ')||'(없음)','');
 L.push('## 인재',Object.entries(p?.officers??{}).filter(([,o])=>['recruited','valued','core'].includes(o.relationship)).map(([id,o])=>`- ${OFFICERS[id]?.name??id} · ${o.relationship} · 신뢰 ${o.trust}`).join('\n')||'(등용 없음)','');
 const debates=log.entries.filter(en=>en.kind==='설전');L.push('## 설전 논거',debates.filter(en=>['카드','대상','공격','보호','공개','제거','최종 제안','결과'].includes(en.cat??'')).map(en=>`- [${en.n}] ${en.text}`).join('\n')||'(설전 없음)','');
 const duels=log.entries.filter(en=>en.kind==='대결');L.push('## 대결 연쇄',duels.filter(en=>['합','준비 전술','빈틈 없는 승부수','과잉 무력','결과','시작'].includes(en.cat??'')).map(en=>`- [${en.n}] ${en.text}`).join('\n')||'(대결 없음)','');
 L.push('## 결과 등급',log.entries.filter(en=>en.cat==='결과').map(en=>`- [${en.n}] ${en.kind} · ${en.text}${(en.data?.missed as string[])?.length?` · 놓친 조건: ${(en.data!.missed as string[]).slice(0,4).join(' / ')}`:''}`).join('\n')||'(없음)','');
 const ps=prepSummary(log);L.push('## 준비력·시간 내역',`- 총 시간 ${ps.totalTime} · 총 준비력 ${ps.totalPower}`,...ps.byCat.map(c=>`- ${c.cat}: 시간 ${c.time} · 준비력 ${c.power} · ${c.count}건`),'');
 const done=log.entries.find(en=>en.cat==='완료');const city=r?.campaign?.active?r.campaign.cities[r.campaign.active]:null;
 L.push('## 거병 후 정책·의무·현안',done?`- 계획 ${done.data?.plan} · 남은 시간 ${done.data?.timeLeft} · 부담 결산 ${done.data?.settlement??'없음'}`:'- 거병 미완료',`- 정책 ${(city?.policies??[]).map(pl=>POLICY_DEFS[pl.id]?.name??pl.id).join('·')||'없음'}`,`- 의무 ${(city?.promises??[]).map(pr=>pr.id+'('+pr.status+')').join('·')||'없음'}`,`- 현안 ${(city?.issues??[]).map(i=>ISSUE_DEFS[i.id]?.name??i.id).join('·')||'없음'}`,'');
 const loops=detectLoops(log);L.push('## 반복 또는 막힘 가능성이 있는 구간',loops.map(t=>'- '+t).join('\n')||'(감지 없음)',`- 추천 경로 열람: ${log.routeOpened.length?log.routeOpened.map(n=>'행동 '+n).join(', '):'없음'}`,'');
 L.push('## 설문',[...CORE_SURVEY,...DETAIL_SURVEY].filter(qq=>log.survey[qq.id]).map(qq=>`- ${qq.text} → ${log.survey[qq.id].score}/5${log.survey[qq.id].note?' · '+log.survey[qq.id].note:''}`).join('\n')||'(미응답)','');
 L.push('## 관찰자 기록',log.observer.map(o=>`- [행동 ${o.n} · ${o.tick}시] ${o.tag}${o.text?' · '+o.text:''}`).join('\n')||'(없음)','');
 void q;return L.join('\n');}
