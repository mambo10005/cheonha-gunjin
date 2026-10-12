/**
 * 고정 시드 141001에서 세 빌드를 실제 명령으로 끝까지 플레이한다(자동 테스트 정책이 아니라 사람이 정한 경로).
 * 1) 순욱 중심 명분·문서·설전  2) 전위 중심 군사·방비·대결  3) 노숙 중심 정보·인맥·계책
 * 카드 선택은 손패 상황에 따라 우선순위로 고르며, 각 빌드의 목표 해결 방식·책략·인재·관문이 다르다.
 * 결과는 재미를 입증하지 않는다. 서로 다른 선택과 해결 경로가 실제로 작동하는지만 기록한다.
 */
import {writeFileSync} from 'node:fs';
import {freshRun,Player,BUILD_SEED} from './card-engine-play.ts';
import {puzzleResolutions,engineSummary,debateArguments,escortBattleConversions} from '../core/card-engine.ts';
import {selectRaisingPlan} from '../core/raising.ts';
import {CARD_GRAMMAR} from '../data/card-grammar.ts';
import {PUZZLES} from '../data/card-puzzles.ts';
import {STRATAGEMS} from '../data/stratagems.ts';
import {RAISING_CARDS} from '../data/raising.ts';
import {LOCATION_SCENE_DEFS} from '../data/location-scenes.ts';
import {CITY_EXPLORATION_DEFS} from '../data/city-exploration.ts';
import {OFFICERS} from '../data/personnel.ts';
import {finishInnBattle} from '../core/inn.ts';
import {explorationInternals,charactersAt} from '../core/city-exploration.ts';
import {botTurn} from './autoplay.ts';
import type {Mark} from '../core/card-engine-types.ts';

interface Goal {resolution:string;focus:string[];inspect:string[];priority:string[];avoid?:string[];spend?:string[]}
const placeName=(id:string)=>CITY_EXPLORATION_DEFS.xingyang.locations.find(l=>l.id===id)?.name??id;
/** 목표 해결 방식이 열릴 때까지 조사·카드·손패 정리·재방문을 반복한다. 실패하면 이유를 남긴다. */
function solve(P:Player,g:Goal,notes:string[],maxVisits=3){
 const location=P.x.location;
 for(let visit=0;visit<maxVisits;visit++){
  for(let guard=0;guard<20;guard++){
   const pz=P.puzzle();if(!pz)return false;
   const why=puzzleResolutions(P.r).find(v=>v.id===g.resolution)?.reason;if(!why||why.includes('전술 3장'))return true;
   const open=g.focus.map(id=>pz.state.obstacles.find(o=>o.id===id)!).filter(o=>o.hp>0);const target=open[0];
   if(target&&pz.state.focus!==target.id)P.act('engine:focus:'+target.id);
   const def=target&&pz.def.obstacles.find(d=>d.id===target.id)!;
   const ins=g.inspect.find(id=>!pz.state.inspected.includes(id)&&LOCATION_SCENE_DEFS['xingyang:'+location].inspectables.some(i=>i.id===id)&&(!def||(pz.def.inspect[id]?.[def.key]??0)>0||!open.length));
   if(ins&&P.x.tick+1<=P.x.budget&&(P.e.scene!.marks.alert??0)+(pz.def.inspect[ins]?.alert??0)<pz.def.alertLimit-1){P.act('scene:inspect:'+ins);notes.push(`조사 ${ins} → ${Object.entries(pz.def.inspect[ins]).map(([m,n])=>m+'+'+n).join(',')}`);continue;}
   const hand=P.q.hand.map(uid=>P.q.cards.find(c=>c.uid===uid)!).filter(c=>!g.avoid?.includes(c.id));
   const playable=hand.filter(c=>{const g2=CARD_GRAMMAR[c.id];return P.q.power>=1&&(!def||def.accepts.includes(g2.action)||(g2.produces[def.key]??0)>0)&&(P.e.scene!.marks.alert??0)+(g2.produces.alert??0)<pz.def.alertLimit;});
   playable.sort((a,b)=>{const pa=g.priority.indexOf(a.id),pb=g.priority.indexOf(b.id);return (pa<0?99:pa)-(pb<0?99:pb);});
   // 열쇠 표식을 만드는 카드를 먼저, 그다음 행동이 맞는 카드
   const keyFirst=def?playable.sort((a,b)=>Number((CARD_GRAMMAR[b.id].produces[def.key]??0)>0&&!(def.accepts.includes(CARD_GRAMMAR[b.id].action)))-Number((CARD_GRAMMAR[a.id].produces[def.key]??0)>0&&!(def.accepts.includes(CARD_GRAMMAR[a.id].action)))||0):playable;
   const pick=(P.e.scene!.marks[def?.key as Mark]??0)>0?playable.find(c=>def!.accepts.includes(CARD_GRAMMAR[c.id].action))??keyFirst[0]:keyFirst[0];
   if(pick&&P.try('card:'+pick.uid).ok){notes.push(`카드 ${RAISING_CARDS[pick.id].name}`);continue;}
   if(!P.e.scene!.uses.mulligan&&P.q.power>=1){P.act('engine:mulligan');notes.push('손패 정리');continue;}
   break;
  }
  if(!puzzleResolutions(P.r).find(v=>v.id===g.resolution)?.reason)return true;
  if(visit<maxVisits-1){P.act('leave');P.act('enter');notes.push(`${placeName(location)} 재방문(시간 1)`);}
 }
 return !puzzleResolutions(P.r).find(v=>v.id===g.resolution)?.reason;
}
/** 목표를 연 뒤 남은 준비력으로 추가 장애를 줄인다(부분 성공의 부담을 줄이기 위해). */
function spendRest(P:Player,targets:string[],notes:string[]){for(let guard=0;guard<6;guard++){const pz=P.puzzle();if(!pz||P.q.power<1)return;const t=targets.map(id=>pz.state.obstacles.find(o=>o.id===id)!).find(o=>o.hp>0);if(!t)return;if(pz.state.focus!==t.id)P.act('engine:focus:'+t.id);const d=pz.def.obstacles.find(v=>v.id===t.id)!;const c=P.q.hand.map(uid=>P.q.cards.find(c=>c.uid===uid)!).find(c=>d.accepts.includes(CARD_GRAMMAR[c.id].action)&&(P.e.scene!.marks.alert??0)+(CARD_GRAMMAR[c.id].produces.alert??0)<pz.def.alertLimit-1);if(!c||!P.try('card:'+c.uid).ok)return;notes.push(`추가 카드 ${RAISING_CARDS[c.id].name} → ${d.name}`);}}
function equipTalent(P:Player,id:string,ids?:string[]){if(P.x.scene!=='map')P.act('leave');for(const l of P.p.library.filter(l=>l.owners.includes(id)&&(!ids||ids.includes(l.id)))){if(P.p.loadouts.raising.includes(l.uid))continue;P.try(`officer:equip:${l.uid}:raising`);}}
function unequip(P:Player,cardId:string){if(P.x.scene!=='map')P.act('leave');const l=P.p.library.find(l=>l.id===cardId&&P.p.loadouts.raising.includes(l.uid));if(l)P.act(`officer:equip:${l.uid}:raising`);}
function battle(P:Player){const b=P.r.battle!;for(let turn=0;turn<40&&b.result==='ongoing';turn++)botTurn(b);return b.result;}
/** 같은 시점에서 빌드(인재 동행·논거·연쇄·사건 결과)를 지운 대조 상태로 같은 관문을 열어 시작 조건을 비교한다. */
function control(P:Player,plan:string){const r=structuredClone(P.r),e=r.campaign!.world!.raising!.engine!,p=r.campaign!.personnel!,x=r.campaign!.cities.xingyang!.exploration!;e.stats={chains:{},consumed:{},produced:{},distinctOwners:[],burdenUses:0,forceDealt:0,cardsRemoved:0,cardsUpgraded:0,skips:0};e.arguments=[];e.legacy=[];for(const pz of Object.values(e.puzzles)){pz.resolution=null;for(const o of pz.obstacles)o.hp=o.max;}p.party=[];x.companions=[];x.items=[];const res=selectRaisingPlan(r,plan,p.protagonistId,r.campaign!.world!.raising!.revision);if(!res.ok)return '대조 불가: '+res.reason;const g=r.campaign!.world!.raising!.gate!;return g.debate?`대조(빌드 제거): 요구 ${JSON.stringify(g.debate.negotiation!.needs)} · 신뢰 ${g.debate.trust}`:`대조(빌드 제거): 상대 체력 ${g.duel!.enemyHp} · 기세 ${g.duel!.momentum} · 방비 ${g.duel!.protection??0}`;}
export interface BuildReport {firstPlays:string[];cardLog:string[];firstQuestStratagems:Record<string,number>;stratagemTriggers:Record<string,number>;pact:string;name:string;visits:string[];talents:string[];stratagems:string[];deck:string[];chains:Record<string,number>;keyChains:string[];resolutions:string[];social:string[];plan:string;gate:string[];grade:string|null;legacy:string[];promises:string[];policies:string[];debt:number;arguments:string[];loadout:string;battle:string[];notes:string[];principles:string[];trail:number}
function report(P:Player,name:string,notes:string[],social:string[],battleNotes:string[],firstQuest:Record<string,number>={}):BuildReport {
 const s=engineSummary(P.r)!,city=P.r.campaign!.cities.xingyang!,w=P.r.campaign!.world!;
 return {firstPlays:P.e.telemetry.firstPlays.slice(0,5).map(id=>RAISING_CARDS[id].name),cardLog:P.cardLog,firstQuestStratagems:firstQuest,stratagemTriggers:{...P.e.telemetry.stratagems},pact:P.e.pact?`${OFFICERS[P.e.pact.talent].name}: ${P.e.pact.swaps.map(s=>RAISING_CARDS[s.removed].name+'→'+RAISING_CARDS[s.added].name).join(', ')} · 책략 ${P.e.pact.stratagem?STRATAGEMS[P.e.pact.stratagem].name:'없음'}`:'없음',name,visits:P.trail.filter(a=>a.startsWith('move:')).map(a=>placeName(a.slice(5))),talents:Object.values(P.p.officers).filter(o=>['recruited','valued','core'].includes(o.relationship)).map(o=>`${OFFICERS[o.id].name}(${o.relationship}${o.growth?'·성장 '+(P.e.growth[o.id]??o.growth):''})`),
  stratagems:s.stratagems,deck:s.deck,chains:s.chains,keyChains:P.e.log.filter(t=>t.includes('소비')||t.includes('→')).slice(-30),resolutions:s.puzzles.map(p=>`${PUZZLES[p.id].title}: ${p.resolution?PUZZLES[p.id].resolutions.find(r=>r.id===p.resolution)!.label:'미해결'} (${p.status}${p.left.length?', 남은 장애 '+p.left.length:''})`),
  social,plan:P.q.plan??'없음',gate:P.q.result.slice(),grade:P.q.grade,legacy:s.legacy.map(l=>l.text),promises:city.promises.map(p=>p.id),policies:city.policies.map(p=>p.id),debt:w.diplomacy.obligation,arguments:s.arguments,loadout:[s.loadout.opening,s.loadout.response,s.loadout.gambit].join('/'),battle:battleNotes,notes,principles:s.principles,trail:P.trail.length};
}
function pickReward(P:Player,prefer:string[]){const rw=P.e.reward;if(!rw)return '';for(const want of prefer){if(want.startsWith('stratagem')&&P.e.stratagems.length<2){const ids=want.split(':').slice(1),pick=ids.find(id=>rw.stratagems.includes(id))??(ids.length?undefined:rw.stratagems[0]);if(pick){P.act(`engine:reward:stratagem:${pick}`);return `책략 ${STRATAGEMS[pick].name} (제안: ${rw.stratagems.map(id=>STRATAGEMS[id].name).join('·')})`;}}if(want.startsWith('card:')){const id=want.slice(5);if(rw.cards.includes(id)){P.act('engine:reward:card:'+id);return `카드 ${RAISING_CARDS[id].name}`;}}if(want==='anycard'){P.act('engine:reward:card:'+rw.cards[0]);return `카드 ${RAISING_CARDS[rw.cards[0]].name}`;}if(want==='skip'){P.act('engine:reward:skip');return '받지 않기';}if(want.startsWith('remove:')){const l=P.p.library.find(l=>l.id===want.slice(7));if(l){P.act('engine:reward:remove:'+l.uid);return `제거 ${RAISING_CARDS[l.id].name}`;}}if(want.startsWith('upgrade:')){const [,id,b]=want.split(':');const l=P.p.library.find(l=>l.id===id&&!l.upgrade);if(l){P.act(`engine:reward:upgrade:${l.uid}:${b}`);return `강화 ${RAISING_CARDS[id].name}`;}}if(want==='relation'&&rw.officer){P.act('engine:reward:relation:'+rw.officer);return `관계 ${OFFICERS[rw.officer].name}`;}}P.act('engine:reward:skip');return '받지 않기';}

const lib=(P:Player,id:string)=>{const l=P.p.library.find(l=>l.id===id&&P.p.loadouts.raising.includes(l.uid));if(!l)throw new Error('덱에 없음 '+id);return l.uid;};
function pact(P:Player,swaps:[string,string][],stratagem:string,notes:string[]){for(const [add,remove] of swaps)P.act(`engine:pact-swap:${add}:${lib(P,remove)}`);P.act('engine:pact-stratagem:'+stratagem);P.act('engine:pact-close');notes.push(`첫 협력 교체: ${swaps.map(([a,b])=>RAISING_CARDS[b].name+'→'+RAISING_CARDS[a].name).join(', ')} · 책략 ${STRATAGEMS[stratagem].name}`);}
/** 퍼즐 손패에서 지정 순서대로 카드를 쓴다(장애 지정 포함). 손패에 없으면 건너뛴다. */
function script(P:Player,steps:([string,string]|string)[],notes:string[]){for(const st of steps){const [focus,card]=Array.isArray(st)?st:[null,st];if(focus&&P.puzzle()?.state.obstacles.find(o=>o.id===focus)?.hp)P.act('engine:focus:'+focus);if(card.startsWith('inspect:')){P.act('scene:'+card);continue;}const c=P.q.cards.find(c=>c.id===card&&P.q.hand.includes(c.uid));if(!c){notes.push(`손패에 없음: ${RAISING_CARDS[card]?.name??card}`);continue;}const res=P.try('card:'+c.uid);if(!res.ok)notes.push(`사용 불가 ${RAISING_CARDS[card].name}: ${res.reason}`);}}

/* ── 빌드 1: 순욱 · 문서·정론·논거·조항 ── */
export function buildXunyu():BuildReport {return runXunyu().report;}
export function runXunyu(){
 const P=new Player(freshRun()),notes:string[]=[],social:string[]=[];let firstQuest:Record<string,number>={};let gateState:import('../core/types.ts').RunState|null=null;let docState:import('../core/types.ts').RunState|null=null;
 try{
 P.act('enter');P.act('inn:offer:recommendation');P.act('inn:accept:recommendation');pact(P,[['x_document','coin'],['x_orthodox','manifesto']],'many_hands',notes);P.act('inn:quest:recommendation:public-records');
 P.visit('archive');P.act('scene:inspect:ledger');script(P,[['record_gap','x_document'],['clerk_guard','x_orthodox'],['refugee_distrust','recommend']],notes);
 P.act('engine:resolve:debate');docState=structuredClone(P.r);social.push(`서리 설전 시작: 요구 ${JSON.stringify(P.x.debate!.negotiation!.needs)} · 신뢰 ${P.x.debate!.trust} · 집중 ${P.x.debate!.resolve}`);const d=P.debate('stable');social.push('서리 설전: '+d);P.act('finish-social');
 const concl=P.try('inn:quest:recommendation:truth');if(!concl.ok)P.act('inn:quest:recommendation:conditional');notes.push('결론: '+(concl.ok?'완전 보증':'조건부 보증'));
 notes.push('보상: '+pickReward(P,['card:register','anycard']));
 P.visit('inn');P.act('inn:report:recommendation');firstQuest={...P.e.telemetry.stratagems};P.act('officer:recruit:xunyu:a');notes.push('순욱 등용(고유: 왕좌의 인선)');
 P.act('leave');P.act('companion:xunyu');equipTalent(P,'xunyu');
 P.visit('hall');script(P,['x_document','person_xunyu_a','role_network_a','x_orthodox','recommend'],notes);const hallApp=P.try('approach:records');if(!hallApp.ok)P.try('approach:official');notes.push('관청 사건: '+(hallApp.ok?'기록의 가치 설명':'시도 '+hallApp.reason));
 P.visit('shrine');script(P,['x_orthodox','person_xunyu_a','role_network_a','recommend','x_document'],notes);const sh=P.try('approach:assembly');notes.push('민회 공론: '+(sh.ok?'민회 계획 발견':sh.reason));
 if(P.x.scene!=='map')P.act('leave');const g1=P.try('engine:growth:xunyu:replace');notes.push('순욱 성장: '+(g1.ok?'역할 카드 교체(명망의 협력)':g1.reason));
 P.act('plan');P.officer('elect:chengong:xunyu');const args=debateArguments(P.r);notes.push(`관문 전 지속 논거 ${args.length}: `+args.map(a=>a.label).join(', '));
 gateState=structuredClone(P.r);social.push(control(P,'assembly'));P.plan('assembly');const g=P.q.gate!.debate!;social.push(`민회 설전 시작 요구 ${JSON.stringify(g.negotiation!.needs)} 신뢰 ${g.trust} 집중 ${g.resolve}`);
 const res=P.debate('stable',true);social.push('민회 설전: '+res+` · 조항 ${JSON.stringify(g.deck?.promises??[])}`);P.finishGate();
 if(P.q.phase==='result'){P.officer('doctrine:people');P.found();}
 }catch(e){notes.push('중단: '+(e as Error).message);}
 return {report:report(P,'순욱 · 문서·정론·논거·조항',notes,social,[],firstQuest),gateState,docState};
}
/* ── 빌드 2: 전위 · 방비·기세·반격 ── */
export function buildDianwei(){const out=runDianwei();return out.report;}
export function runDianwei(stopAtBattle=false){
 const P=new Player(freshRun()),notes:string[]=[],social:string[]=[],battleNotes:string[]=[];let firstQuest:Record<string,number>={};let battleStart:import('../core/types.ts').RunState|null=null,gateState:import('../core/types.ts').RunState|null=null,escortState:import('../core/types.ts').RunState|null=null;
 try{
 P.act('enter');P.act('inn:area:yard');P.act('inn:select:dianwei');P.act('inn:offer:escort');P.act('inn:accept:escort');pact(P,[['d_guard','manifesto'],['d_counter','coin']],'open_flag',notes);
 P.act('engine:tactic:opening:press');P.act('engine:tactic:response:counter');P.act('engine:tactic:gambit:all_in');notes.push('대결 전술: 선제 돌격/반격 태세/결사 일격');
 P.visit('store');script(P,['inspect:guards',['escort_gap','d_guard'],['blocked','d_counter']],notes);spendRest(P,['keeper_alert','ledger_gap'],notes);
 escortState=structuredClone(P.r);P.act('engine:resolve:duel');const d=P.duel();social.push(`창고 통행권 대결: ${d} (체력 ${P.x.duel!.hp}/${P.x.duel!.maxHp})`);P.act('finish-social');
 notes.push('보상: '+pickReward(P,['card:weapons','anycard']));
 P.visit('gate');const conv=escortBattleConversions(P.r);battleNotes.push('전투 전 변환: '+conv.map(c=>`${c.label}→${c.card}`).join(', '));
 P.act('inn:quest:escort:joint-escort');battleStart=structuredClone(P.r);if(stopAtBattle)return {P,battleStart,gateState,escortState,report:null as unknown as BuildReport};const br=battle(P);battleNotes.push('공동 호위 전투: '+br);const fin=finishInnBattle(P.r,explorationInternals.innHooks(P.r));if(!fin.ok)throw new Error(fin.reason);P.x.revision++;
 P.visit('inn');P.act('inn:report:escort');firstQuest={...P.e.telemetry.stratagems};P.act('officer:recruit:dianwei:a');notes.push('전위 등용(고유: 철위의 결집)');
 P.act('leave');P.act('companion:dianwei');unequip(P,'recommend');equipTalent(P,'dianwei');const w=P.p.library.find(l=>l.id==='weapons');if(w&&!P.p.loadouts.raising.includes(w.uid))P.try(`officer:equip:${w.uid}:raising`);
 P.visit('barracks');script(P,['inspect:weapons',['discipline','d_guard'],['command_distrust','d_counter'],['command_distrust','person_dianwei_a'],['command_distrust','role_military_a']],notes);
 const ok2=solve(P,{resolution:'duel',focus:['command_distrust','discipline'],inspect:['supplies'],priority:['d_counter','d_guard','person_dianwei_a','role_military_a','weapons','cache']},notes);notes.push('병영 퍼즐(훈련 대표 대결) 목표 달성: '+ok2);
 if(ok2){P.act('engine:resolve:duel');const d2=P.duel();social.push(`병영 훈련 대표 대결: ${d2} (체력 ${P.x.duel!.hp}/${P.x.duel!.maxHp})`);P.act('finish-social');notes.push('보상: '+pickReward(P,['stratagem:banner_march','card:drill','anycard']));}
 if(P.x.scene!=='map')P.act('leave');const g2=P.try('engine:growth:dianwei:upgrade');notes.push('전위 성장: '+(g2.ok?'철위의 결집 강행 강화':g2.reason));
 P.act('plan');P.officer('elect:dianwei:');
 gateState=structuredClone(P.r);social.push(control(P,'barracks'));P.plan('barracks');const s=P.q.gate!.duel!;social.push(`군영 장악 대결 시작: 상대 체력 ${s.enemyHp}, 기세 ${s.momentum}, 방비 ${s.protection??0}, 반격 추가 ${s.counterBonus??0}`);const res=P.duel(true);social.push('군영 장악 대결: '+res);P.finishGate();
 if(P.q.phase==='result'){P.officer('doctrine:strategy');P.found();}
 }catch(e){notes.push('중단: '+(e as Error).message);}
 return {P,battleStart,gateState,escortState,report:report(P,'전위 · 방비·기세·반격',notes,social,battleNotes,firstQuest)};
}
/* ── 빌드 3: 노숙 · 장부·비용·정보 전환 ── */
export function buildLusu():BuildReport {return runLusu().report;}
export function runLusu(){
 const P=new Player(freshRun()),notes:string[]=[],social:string[]=[],battleNotes:string[]=[];let firstQuest:Record<string,number>={};let gateState:import('../core/types.ts').RunState|null=null;
 try{
 P.act('enter');P.act('inn:area:yard');P.act('inn:select:dianwei');P.act('inn:offer:escort');P.act('inn:accept:escort');P.act('engine:pact-close');notes.push('객사: 호위 의뢰 수락, 전위와의 협력 전환은 미룸');
 P.act('leave');P.act('enter');P.act('inn:select:lusu');P.act('inn:offer:accounts');P.act('inn:accept:accounts');pact(P,[['l_trade','coin'],['l_ledger','manifesto']],'ledger_net',notes);
 P.visit('market');script(P,['l_trade','l_ledger','clues'],notes);const inv=P.try('inn:quest:accounts:card-investigate');if(!inv.ok)P.act('inn:quest:accounts:investigate');notes.push('시장 장부 조사: '+(inv.ok?'카드 조사':'직접 조사'));
 P.visit('store');P.act('scene:talk:lusu:route');P.act('scene:joint:lusu:accept');notes.push('노숙의 공동 대조 수락');
 script(P,[['blocked','l_ledger'],['blocked','clues'],['keeper_alert','l_trade']],notes);
 const ok=solve(P,{resolution:'alternate',focus:['blocked'],inspect:[],priority:['l_ledger','clues','l_trade']},notes,1);notes.push('창고 퍼즐(막힌 통로) 목표 달성: '+ok);
 P.act('engine:resolve:alternate');notes.push('보상: '+pickReward(P,['card:tunnel','anycard']));
 P.act('inn:quest:accounts:debate');social.push(`창고 장부 설전 시작: 요구 ${JSON.stringify(P.x.debate!.negotiation!.needs)} 신뢰 ${P.x.debate!.trust}`);const dr=P.debate('chain');social.push('창고 장부 설전: '+dr);P.act('finish-social');
 const concl=P.try('inn:quest:accounts:truth');if(!concl.ok)P.act('inn:quest:accounts:conditional');notes.push('장부 결론: '+(concl.ok?'공개 기록':'공동 부담'));
 P.visit('gate');P.act('inn:quest:escort:transport');notes.push('우회로로 수레 호송(전투 없음)');
 P.visit('inn');const rep2=P.try('inn:report:accounts');notes.push('장부 보고: '+(rep2.ok?'완료':rep2.reason));firstQuest={...P.e.telemetry.stratagems};const rep1=P.try('inn:report:escort');notes.push('호위 보고: '+(rep1.ok?'완료':rep1.reason));P.act('officer:recruit:lusu:a');notes.push('노숙 등용(고유: 양측의 계산)');
 P.act('leave');P.act('companion:lusu');unequip(P,'recommend');equipTalent(P,'lusu');
 P.act('engine:tactic:opening:read');P.act('engine:tactic:response:second');P.act('engine:tactic:gambit:expose');notes.push('대결 전술: 수읽기/보좌 개입/허점 폭로');
 P.visit('gate');script(P,['l_trade','l_ledger','clues','person_lusu_a','role_intel_a','l_ledger'],notes);
 const sc=P.try('approach:scout');notes.push('동문 교대 기록 조사: '+(sc.ok?'성문 내응 계획 발견':sc.reason));
 if(P.x.scene!=='map')P.act('leave');const g3=P.try('engine:growth:lusu:principle');notes.push('노숙 성장: '+(g3.ok?'원칙 변화(중재의 장부)':g3.reason));
 P.act('plan');P.officer('elect:chengong:lusu');
 gateState=structuredClone(P.r);social.push(control(P,'inside'));P.plan('inside');social.push(`성문 내응 설전 시작 요구 ${JSON.stringify(P.q.gate!.debate!.negotiation!.needs)} 신뢰 ${P.q.gate!.debate!.trust}`);const d1=P.debate('chain',true);social.push('성문 내응 설전: '+d1);P.finishGate();
 if(P.q.phase==='duel'){const s=P.q.gate!.duel!;social.push(`후속 대결 시작: 상대 체력 ${s.enemyHp}/${s.enemyMaxHp} · 기세 ${s.momentum} · 방비 ${s.protection??0} · 지원 제거 ${!!s.noSupport} · 기습 ${!!s.initiative} · ${s.log.find(t=>t.startsWith('성문 내응 전환'))??''}`);social.push('후속 대결: '+P.duel(true));P.finishGate();}else social.push('후속 대결 없음(설전 성공·우회로·내부 협력 4 이상)');
 if(P.q.phase==='result'){P.officer('doctrine:law');P.found();}
 }catch(e){notes.push('중단: '+(e as Error).message);}
 return {gateState,report:report(P,'노숙 · 장부·비용·정보 전환',notes,social,battleNotes,firstQuest)};
}
if(import.meta.main){
 const builds=[buildXunyu,buildDianwei,buildLusu].map(f=>{try{return f();}catch(e){return {name:f.name,error:String((e as Error).stack??e)};}});
 writeFileSync('docs/verification/card-engine-builds.json',JSON.stringify({seed:BUILD_SEED,builds},null,2));
 console.log(JSON.stringify(builds,null,1));
}
/* ── 부담 빌드: 정보(程普) · 부담 생성·사용·전환·소멸·보상 조건 ── */
export function runChengpu(burdenBuild=true){
 const P=new Player(freshRun()),notes:string[]=[],social:string[]=[],battleNotes:string[]=[];let firstQuest:Record<string,number>={};const burdenLog:string[]=[];
 const seen=(t:string)=>{for(const line of P.e.log.slice(-6))if((line.includes('부담')||line.includes('짐을 진')||line.includes('분산 보급'))&&!burdenLog.includes(line))burdenLog.push(line);void t;};
 const findChengpu=()=>{for(let i=0;i<4;i++){const loc=P.x.sightings.chengpu.location;P.visit(loc);if(charactersAt(P.r).includes('chengpu'))return loc;}throw new Error('정보를 찾지 못함');};
 try{
 P.act('enter');P.act('inn:area:yard');P.act('inn:select:dianwei');P.act('inn:offer:escort');P.act('inn:accept:escort');
 pact(P,[['d_guard','manifesto']],burdenBuild?'heavy_burden':'open_flag',notes);
 P.visit('market');for(const id of ['prices','ledger','contract','route']){if(charactersAt(P.r).includes('chengpu'))break;P.act('scene:inspect:'+id);}if(!charactersAt(P.r).includes('chengpu'))findChengpu();else{P.act('leave');P.act('enter');}notes.push(`정보를 ${placeName(P.x.location)}에서 만남(${P.x.tick}시)`);
 P.act('officer:task:chengpu');P.act('officer:cooperate:chengpu:relation');P.act(`officer:recruit:chengpu:${burdenBuild?'b':'a'}`);notes.push(`정보 등용(고유: ${burdenBuild?'분산 군량망':'노장의 호송'})`);
 P.act('leave');P.act('companion:chengpu');unequip(P,'recommend');equipTalent(P,'chengpu');
 P.visit('store');script(P,['inspect:guards',['ledger_gap','poverty'],['ledger_gap','person_chengpu_b'],['escort_gap','d_guard'],['ledger_gap','coin'],['keeper_alert','c_ledger']],notes);seen('store');
 const ok=solve(P,{resolution:'contract-shared',focus:['keeper_alert','ledger_gap'],inspect:['ledger'],priority:['poverty','person_chengpu_b','coin','c_ledger','role_supply_a','cache']},notes,2);seen('store2');notes.push('창고 퍼즐(책임 분담 계약) 목표 달성: '+ok);
 P.act('engine:resolve:contract-shared');notes.push('보상: '+pickReward(P,['card:loan','card:medicine','anycard']));
 P.act('leave');for(const id of ['debt_note','loan']){const l=P.p.library.find(l=>l.id===id&&!P.p.loadouts.raising.includes(l.uid));if(l){const why=P.try(`officer:equip:${l.uid}:raising`);notes.push(`${RAISING_CARDS[id].name} 편성: `+(why.ok?'예':why.reason));}}
 P.visit('gate');battleNotes.push('전투 전 변환: '+escortBattleConversions(P.r).map(c=>`${c.label}→${c.card}`).join(', '));P.act('inn:quest:escort:joint-escort');const br=battle(P);battleNotes.push('공동 호위 전투: '+br);const fin=finishInnBattle(P.r,explorationInternals.innHooks(P.r));if(!fin.ok)throw new Error(fin.reason);P.x.revision++;
 P.visit('inn');const rep=P.try('inn:report:escort');notes.push('호위 보고: '+(rep.ok?'완료':rep.reason));firstQuest={...P.e.telemetry.stratagems};
 P.act('engine:tactic:opening:shield');P.act('engine:tactic:response:ration');P.act('engine:tactic:gambit:oath');
 P.visit('barracks');script(P,['inspect:supplies',['discipline','debt_note'],['discipline','loan'],['discipline','poverty'],['discipline','person_chengpu_b'],['discipline','person_chengpu_a'],['discipline','role_supply_a'],['command_distrust','d_guard'],['discipline','cache']],notes);seen('barracks');
 const ok2=solve(P,{resolution:'supply',focus:['discipline'],inspect:['weapons'],priority:['debt_note','loan','poverty','person_chengpu_b','person_chengpu_a','role_supply_a','cache','coin']},notes,2);seen('barracks2');notes.push('병영 퍼즐(보급 약속) 목표 달성: '+ok2);if(ok2){P.act('engine:resolve:supply');const fav=P.e.stats.burdenUses>=2&&P.p.library.find(l=>RAISING_CARDS[l.id]?.burden&&P.p.loadouts.raising.includes(l.uid));notes.push('보상: '+(fav&&burdenBuild?(P.act(`engine:reward:burden-favor:${fav.uid}`),`부담을 신용으로(${RAISING_CARDS['fund'].name}로 전환)`):pickReward(P,['card:medicine','anycard'])));}
 if(P.x.scene!=='map')P.act('leave');P.act('plan');P.officer('elect:chengong:chengpu');
 social.push(control(P,'barracks'));P.plan('barracks');const s=P.q.gate!.duel!;social.push(`군영 장악 대결 시작: 상대 체력 ${s.enemyHp}, 기세 ${s.momentum}, 방비 ${s.protection??0}`);social.push('군영 장악 대결: '+P.duel(true));P.finishGate();
 if(P.q.phase==='result'){P.officer('doctrine:people');P.found();}
 }catch(e){notes.push('중단: '+(e as Error).message);}
 const rep=report(P,burdenBuild?'정보 · 부담 활용':'정보 · 일반 물자(대조)',notes,social,battleNotes,firstQuest);
 return {report:rep,burdenLog,burdenUses:P.e.stats.burdenUses,burdenMarks:{produced:P.e.stats.produced.burden??0,consumed:P.e.stats.consumed.burden??0},exhausted:P.q.exhaust.map(uid=>P.q.cards.find(c=>c.uid===uid)?.id),deckBurden:P.p.library.filter(l=>RAISING_CARDS[l.id]?.burden).map(l=>l.id),tick:P.x.tick,resources:{...P.r.campaign!.world!.preparation},debt:P.r.campaign!.world!.diplomacy.obligation};
}
