import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newRun, moveTo, leaveNode, supplyChoose, finishBattle, replaceGeneral } from '../src/core/run.ts';
import { chooseGrowth } from '../src/core/build.ts';
import { configureAccordDemo } from '../src/core/accord-demo.ts';
import { createDebate, previewDebateAction, resolveDebateAction } from '../src/core/debate.ts';
import { prepareNegotiation } from '../src/core/negotiation.ts';
import { agreementQuote, signAgreement, activeAgreements, abandonAgreement, resetCouncil, accordsOnMove, accordsBattleOpening } from '../src/core/accords.ts';
import { actDebate, beginDebate, finishDebate, acceptParley, villageDiplomacy, acceptDuel } from '../src/core/social-run.ts';
import { socialBotStep } from '../src/sim/social-policy.ts';
import { memoryKV, loadRun, saveRun, RUN_KEY } from '../src/core/save.ts';
import { socialView, handleSocialAction } from '../src/ui/social-view.ts';
import type { RunState } from '../src/core/types.ts';

function demo(): RunState { const r=newRun(51001,'caocao');configureAccordDemo(r);return r; }
function settle(r: RunState): void {
 if((r as RunState).pending.kind==='growth') chooseGrowth(r,'recover','');
 if((r as RunState).pending.kind==='socialResult' || (r as RunState).pending.kind==='none') leaveNode(r);
 if((r as RunState).pending.kind==='growth') {chooseGrowth(r,'recover','');leaveNode(r);}
}
function move(r:RunState,col=0):void {moveTo(r,col);const g=(r as RunState).pending;if(g.kind==='growth'){chooseGrowth(r,'recover','');leaveNode(r);moveTo(r,col);}}
function merchant(r:RunState):void {move(r);assert.equal((r as RunState).pending.kind,'council');}
function village(r:RunState):void {merchant(r);handleSocialAction(r,'decline-council','','',0);settle(r);move(r);supplyChoose(r,'food');settle(r);move(r);villageDiplomacy(r);}
function militia(r:RunState):void {village(r);handleSocialAction(r,'decline-council','','',0);settle(r);move(r);}
function win(r:RunState):void {assert.ok(r.battle);r.battle.result='win';finishBattle(r);}
function debate(opponent:string, reports=1) {const s=createDebate(170,'dianwei',opponent,{kind:'supply'});prepareNegotiation(s,20,reports,0);return s;}
function roundTrip(r:RunState):RunState {const kv=memoryKV();assert.ok(saveRun(kv,r));const l=loadRun(kv);assert.ok(l.ok);assert.deepEqual(l.data,r);return l.data;}

test('요구별 합의: 선비는 명분·권한, 향촌은 안전·부담을 함께 판정',()=>{
 const s=debate('scholar'); for(const a of ['authority','evidence','concede','evidence'])resolveDebateAction(s,a,s.round);assert.equal(s.result,'success');
 const e=debate('elder');for(const a of ['authority','disclose','concede','proposal'])resolveDebateAction(e,a,e.round);assert.equal(e.result,'failure');assert.ok(e.trust>=3);assert.ok(e.negotiation!.scores.safety>=4);
});
test('예고한 반론은 두 답변 후 요구에 적용되고 같은 시드로 재현',()=>{
 const a=debate('merchant'),b=debate('merchant');assert.deepEqual(a,b);const axis=a.negotiation!.counter.axis,old=a.negotiation!.needs[axis]!;
 resolveDebateAction(a,'proposal',0);assert.equal(a.negotiation!.counter.applied,false);resolveDebateAction(a,'evidence',1);assert.equal(a.negotiation!.needs[axis],old+1);assert.equal(a.negotiation!.counter.applied,true);
});
test('정보 공개→양보 신뢰 연쇄, 같은 답 감쇠와 정보 소진',()=>{
 const a=debate('elder');resolveDebateAction(a,'disclose',0);const trust=a.trust;resolveDebateAction(a,'concede',1);assert.equal(a.trust,trust+2);assert.equal(a.negotiation!.concessionReady,false);assert.equal(resolveDebateAction(a,'disclose',2).ok,false);resolveDebateAction(a,'concede',2);assert.equal(a.negotiation!.scores.safety,3);
});
test('실물 군량은 미리보기와 동일하게 즉시 지불하며 중단·중복 입력으로 환급하지 않음',()=>{
 const r=demo();merchant(r);beginDebate(r,'guojia','sponsorship');assert.equal((r as RunState).pending.kind,'debate');const dp=(r as RunState).pending;if(dp.kind!=='debate')return;
 const before=structuredClone(r),pv=previewDebateAction(dp.state,'pledge');assert.deepEqual(r,before);actDebate(r,'pledge',0);assert.deepEqual(dp.state,pv.state);assert.equal(r.food,before.food-2);const f=r.food;assert.equal(actDebate(r,'pledge',0).ok,false);actDebate(r,'withdraw',1);finishDebate(r);assert.equal(r.food,f);assert.equal(signAgreement(r,'sponsorship','').ok,false);resetCouncil(r);assert.ok(signAgreement(r,'sponsorship','').ok);
});
test('권한 약속은 최종 조건 수락 때만 보상 선택지 대가를 적용',()=>{
 const r=demo();merchant(r);(r as RunState).pending={kind:'parley',mode:'supply'};beginDebate(r,'guojia');for(const [i,a] of ['disclose','concede','proposal','evidence'].entries())actDebate(r,a,i);assert.equal((r as RunState).pending.kind,'debate');finishDebate(r);assert.equal(r.flags.rewardPenalty,0);
 (r as RunState).pending={kind:'parley',mode:'supply',negotiated:'partial',terms:{penalty:1,paid:0,description:'권한'}};r.hp=20;const f=r.food;acceptParley(r,true);assert.equal(r.flags.rewardPenalty,1);assert.equal(r.food,f+5);assert.equal(r.hp,26);assert.equal(acceptParley(r,true).ok,false);
});
test('성공 설전 성장 선택은 거래 조건을 부분 합의로 바꾸며 중복 보상 불가',()=>{
 const r=demo();merchant(r);beginDebate(r,'guojia','sponsorship');for(let i=0;i<4;i++)socialBotStep(r);
 assert.equal((r as RunState).pending.kind,'debate');const dp=(r as RunState).pending;if(dp.kind!=='debate')return;assert.equal(dp.state.result,'success');assert.ok(finishDebate(r,'growth').ok);assert.equal((r as RunState).pending.kind,'growth');chooseGrowth(r,'recover','');assert.equal((r as RunState).pending.kind,'council');const p=(r as RunState).pending;if(p.kind==='council')assert.equal(p.negotiated!.result,'partial');assert.equal(finishDebate(r,'growth').ok,false);
});
test('지속 협정은 실제 경로에서 목표를 선택하고 없는 정예전은 체결 불가',()=>{
 const r=demo();militia(r);assert.deepEqual(agreementQuote(r,'operation').target,{floor:5,col:0});for(const n of r.map[5])n.type='rest';const old=structuredClone(r);assert.equal(signAgreement(r,'operation','guojia').ok,false);assert.deepEqual(r,old);
});
test('협정 슬롯 2개·같은 협정 중첩·다른 세력·없는 장수는 비용 없이 거부',()=>{
 const r=demo();merchant(r);assert.equal(signAgreement(r,'escort','guojia').ok,false);signAgreement(r,'sponsorship','');settle(r);move(r);supplyChoose(r,'food');settle(r);move(r);villageDiplomacy(r);signAgreement(r,'escort','');settle(r);move(r);const old=structuredClone(r);assert.equal(signAgreement(r,'operation','guojia').ok,false);assert.deepEqual(r,old);assert.equal(activeAgreements(r).length,2);assert.ok(abandonAgreement(r,1).ok);assert.equal(signAgreement(r,'operation','missing').ok,false);assert.ok(signAgreement(r,'operation','guojia').ok);
});
test('같은 협정은 중첩하지 않고 서명만으로 관계가 오르지 않음',()=>{
 const r=demo();merchant(r);signAgreement(r,'sponsorship','');assert.equal(r.social.relations.caravan,0);(r as RunState).pending={kind:'council',faction:'caravan'};assert.match(agreementQuote(r,'sponsorship').reason!,/중첩/);
});
test('상단 후원: 군량 보급 추가·목표 카드 보상 전환·이행 관계 및 일회성',()=>{
 const r=demo();merchant(r);signAgreement(r,'sponsorship','');settle(r);move(r);const food=r.food;supplyChoose(r,'food');assert.equal(r.food,food+7);settle(r);move(r);handleSocialAction(r,'decline-parley','','',0);settle(r);move(r);handleSocialAction(r,'decline-council','','',0);settle(r);move(r);supplyChoose(r,'food');settle(r);move(r);acceptDuel(r,null);win(r);assert.equal(r.social.accords.agreements[0].status,'fulfilled');assert.equal(r.social.relations.caravan,1);assert.equal((r as RunState).pending.kind,'reward');const rp=(r as RunState).pending;if(rp.kind==='reward'){assert.deepEqual(rp.cards,[]);assert.equal(rp.picked,true);assert.ok(rp.extra);}
 const f=r.food;assert.equal(finishBattle(r).ok,false);assert.equal(r.food,f);
});
test('호송과 공동 작전: 보급→동일 정예전 지원→지정 장수 성장·예치금 반환',()=>{
 let r=demo();village(r);(r as RunState).pending={kind:'council',faction:'villages',negotiated:{clause:'escort',result:'partial',terms:{penalty:0,paid:0,description:'부분'}}};signAgreement(r,'escort','');settle(r);move(r);signAgreement(r,'operation','guojia');settle(r);move(r);supplyChoose(r,'food');assert.equal(activeAgreements(r)[0].stage,'armed');settle(r);move(r);assert.deepEqual(accordsBattleOpening(r),{block:8,damage:4});acceptDuel(r,null);assert.equal(r.battle!.block.front,8);assert.equal(r.battle!.enemies[0].hp,r.battle!.enemies[0].maxHp-4);r=roundTrip(r);
 const f=r.food;win(r);assert.equal(r.food,f+5+2);assert.equal((r as RunState).pending.kind,'growth');const gp=(r as RunState).pending;if(gp.kind!=='growth')return;assert.equal(gp.general,'guojia');assert.equal(chooseGrowth(r,'planner','dianwei').ok,false);assert.equal(chooseGrowth(r,'doctrine:bastion','guojia').ok,false);assert.ok(chooseGrowth(r,'planner','guojia').ok);assert.equal(r.build.growth.guojia.level,1);assert.equal(r.social.relations.villages,1);assert.equal(r.social.relations.militia,1);assert.equal(activeAgreements(r).length,0);
});
test('선보급 의무를 건너뛰면 만료하며 다른 지정 경로는 파기',()=>{
 const r=demo();village(r);signAgreement(r,'escort','');const f=r.food;accordsOnMove(r,r.map[5][0]);assert.equal(r.social.accords.agreements[0].status,'expired');assert.equal(r.food,f-2);assert.equal(r.social.relations.villages,-1);assert.equal(abandonAgreement(r,1).ok,false);
 const b=demo();merchant(b);signAgreement(b,'sponsorship','');accordsOnMove(b,b.map[5][1]);assert.equal(b.social.accords.agreements[0].status,'broken');
});
test('의약 보급은 호송을 준비하지 않으며 지정 보급을 떠나면 의무 만료',()=>{
 const r=demo();village(r);signAgreement(r,'escort','');settle(r);move(r);handleSocialAction(r,'decline-council','','',0);settle(r);move(r);supplyChoose(r,'hp');assert.equal(activeAgreements(r)[0].stage,'waiting');settle(r);move(r);assert.deepEqual(accordsBattleOpening(r),{block:0,damage:0});acceptDuel(r,null);win(r);assert.equal(r.social.accords.agreements[0].status,'expired');
});
test('목표 전투 패배는 협정 실패, 지정 장수 교체도 파기',()=>{
 const r=demo();militia(r);signAgreement(r,'operation','guojia');settle(r);move(r);supplyChoose(r,'food');settle(r);move(r);acceptDuel(r,null);r.battle!.result='lose';finishBattle(r);assert.equal(r.social.accords.agreements[0].status,'broken');assert.equal(r.screen,'defeat');
 const b=demo();militia(b);signAgreement(b,'operation','guojia');b.pending={kind:'replaceGeneral',incoming:'zhangliao',then:{kind:'none'}};replaceGeneral(b,'guojia');assert.equal(b.social.accords.agreements[0].status,'broken');
});
test('상단과 공동 작전 동시 이행은 카드 전환 후 성장 보상으로 감싸기',()=>{
 const r=demo();merchant(r);signAgreement(r,'sponsorship','');settle(r);move(r);supplyChoose(r,'food');settle(r);move(r);acceptParley(r,false);settle(r);move(r);signAgreement(r,'operation','guojia');settle(r);move(r);supplyChoose(r,'food');settle(r);move(r);acceptDuel(r,null);win(r);assert.equal((r as RunState).pending.kind,'growth');const g=(r as RunState).pending;if(g.kind==='growth'){assert.equal(g.then.kind,'reward');if(g.then.kind==='reward')assert.deepEqual(g.then.cards,[]);}assert.equal(activeAgreements(r).length,0);
});
test('설전·협정·활동 의무·성장 진행의 저장 재현과 손상 거부',()=>{
 let r=demo();merchant(r);beginDebate(r,'guojia','sponsorship');actDebate(r,'pledge',0);r=roundTrip(r);const kv=memoryKV();saveRun(kv,r);const env=JSON.parse(kv.getItem(RUN_KEY)!);env.data.pending.state.negotiation.food++;kv.setItem(RUN_KEY,JSON.stringify(env));assert.equal(loadRun(kv).ok,false);
 const a=demo();militia(a);signAgreement(a,'operation','guojia');roundTrip(a);saveRun(kv,a);const base=JSON.parse(kv.getItem(RUN_KEY)!);for(const mutate of [(x:any)=>x.data.social.accords.agreements[0].deposit=-2,(x:any)=>x.data.social.accords.agreements[0].target.col=9,(x:any)=>x.data.social.accords.agreements.push(x.data.social.accords.agreements[0]),(x:any)=>x.data.social.accords.agreements[0].beneficiary='missing']){const e=structuredClone(base);mutate(e);kv.setItem(RUN_KEY,JSON.stringify(e));assert.equal(loadRun(kv).ok,false);}
});
test('버전3 진행 중 설전은 기존 규칙으로 유지하며 장수 성장·RNG 보존',()=>{
 const r=demo();merchant(r);r.social.protocol='legacy'; // council entry differs; use parley directly
 (r as RunState).pending={kind:'parley',mode:'supply'};beginDebate(r,'guojia');actDebate(r,'proposal',0);
 const old:any=structuredClone(r);old.version=3;delete old.social.protocol;delete old.social.accords;const kv=memoryKV();kv.setItem(RUN_KEY,JSON.stringify({version:3,data:old}));const l=loadRun(kv);assert.ok(l.ok);assert.equal(l.data.version,4);assert.equal(l.data.social.protocol,'legacy');assert.deepEqual(l.data.build,r.build);assert.equal(l.data.rng,r.rng);assert.deepEqual(l.data.pending,(r as RunState).pending);
});
test('설전 화면은 정확한 요구·자원·후속 대가를 표시하고 렌더는 상태 불변',()=>{
 const r=demo();merchant(r);beginDebate(r,'guojia','sponsorship');const before=structuredClone(r);const html=socialView(r)!;for(const t of ['미충족','2회 답변','작전 정보 공개','실물 군량','활동 권한','協定'.replace('協定','협정 신용')])assert.ok(html.includes(t),t);assert.deepEqual(r,before);
});

test('정보 공개 사이에 다른 논거가 끼면 직후 양보 연쇄를 잃음',()=>{
 const s=debate('elder');resolveDebateAction(s,'disclose',0);resolveDebateAction(s,'evidence',1);const t=s.trust;resolveDebateAction(s,'concede',2);assert.equal(s.trust,t+1);
});
test('기존 목표와 함께 이행할 수 없는 분기에는 새 협정을 생성하지 않음',()=>{
 const r=demo();village(r);signAgreement(r,'escort','');settle(r);move(r);assert.equal(r.pending.kind,'council');
 // Existing escort must visit floor4/col0 then floor5/col0. Its route leads to a normal battle.
 r.map[5][0].type='battle';r.map[4][0].next=[0];r.map[4][1].next=[1];r.map[4][2].next=[2];
 assert.match(agreementQuote(r,'operation').reason!,/실제 연결 경로/);assert.equal(signAgreement(r,'operation','guojia').ok,false);
});
test('교리/장수 성장과 협정 신용이 설전 논거의 실제 가용성을 바꿈',()=>{
 const r=demo();merchant(r);r.build.doctrines=['breakthrough'];r.build.growth.guojia={branch:'planner',level:2};r.social.relations.villages=1;beginDebate(r,'guojia','sponsorship');const p=r.pending;assert.equal(p.kind,'debate');if(p.kind!=='debate')return;assert.equal(p.state.resolve,9);assert.ok(p.state.negotiation!.credentials>=1);assert.ok(p.state.negotiation!.reports>=1);const before=structuredClone(p.state);assert.ok(previewDebateAction(p.state,'credential').check.ok);assert.deepEqual(p.state,before);
});
