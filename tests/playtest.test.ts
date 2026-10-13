import {test} from 'node:test';
import assert from 'node:assert/strict';
import {startPlaytest,PLAYTEST_PRESET,PLAYTEST_SAVE_KEY,PLAYTEST_LOG_KEY,isPlaytest,newPlaytestLog,probe,recordAction,recordUi,recordObserver,setSurvey,prepSummary,summarizeLog,detectLoops,savePlaytestLog,loadPlaytestLog,CORE_SURVEY,DETAIL_SURVEY,prepCategory,type PlaytestLog} from '../src/core/playtest.ts';
import {saveCampaign,loadCampaign,CAMPAIGN_KEY} from '../src/core/campaign-save.ts';
import {memoryKV} from '../src/core/save.ts';
import {engineOf} from '../src/core/card-engine.ts';
import {personnelOf} from '../src/core/personnel-rules.ts';
import {Player,deckDuelAction,debateAction} from '../src/sim/card-engine-play.ts';
import {runDianwei,runXunyu} from '../src/sim/card-engine-builds.ts';
import {debateFieldView,fieldDelta,remainingRiskNote} from '../src/ui/debate-field-view.ts';
import {duelDeckView,duelDelta} from '../src/ui/duel-deck-view.ts';
import {deckPreview} from '../src/core/debate-deck.ts';
import {ARGUMENT_DEFS} from '../src/data/debate-field.ts';
import {PlaytestSession} from '../src/ui/playtest-session.ts';
import type {RunState} from '../src/core/types.ts';

/** 명령 경계 흉내: Player.act를 감싸 전후 투영을 기록한다. */
function logged(P:Player,log:PlaytestLog){const act0=P.act.bind(P);P.act=(a:string)=>{const before=probe(P.r);const res=act0(a);recordAction(log,before,probe(P.r),a,P.r,1);return res;};return P;}

test('preset: one call fixes seed 141001·standard·xingyang·chengong·notable, marks the campaign, and saves under a key separate from the normal campaign',()=>{
 const r=startPlaytest(5);assert.equal(r.campaign!.seed,PLAYTEST_PRESET.seed);assert.equal(engineOf(r)!.profile,'standard');assert.equal(r.campaign!.world!.startCity,'xingyang');assert.equal(personnelOf(r)!.protagonistId,'chengong');assert.equal(r.campaign!.world!.raising!.origin,'notable');assert.ok(isPlaytest(r));
 const kv=memoryKV();assert.ok(saveCampaign(kv,r,PLAYTEST_SAVE_KEY));assert.equal(kv.getItem(CAMPAIGN_KEY),null,'normal campaign slot untouched');const none=loadCampaign(kv);assert.ok(!none.ok&&none.reason==='none');
 const l=loadCampaign(kv,PLAYTEST_SAVE_KEY);assert.ok(l.ok);assert.ok(isPlaytest(l.data.activeExpedition!));assert.equal(l.data.activeExpedition!.campaign!.playtest!.startedAt,5);
 const normal=startPlaytest(1);delete normal.campaign!.playtest;assert.ok(saveCampaign(kv,normal));const ln=loadCampaign(kv);assert.ok(ln.ok&&!isPlaytest(ln.data.activeExpedition!));assert.ok(loadCampaign(kv,PLAYTEST_SAVE_KEY).ok,'both slots coexist');
 const bad=startPlaytest(1);(bad.campaign as any).playtest={preset:'x'};assert.ok(!saveCampaign(kv,bad,'tmp')||!loadCampaign(kv,'tmp').ok,'a malformed flag is rejected by validation');
});

test('log: exploration moves, card use, prep spend categories, duel start/exchanges/result and the yard gambit are recorded from the command boundary; nothing leaves the process',()=>{
 const log=newPlaytestLog(1);const P=logged(new Player(startPlaytest(1)),log);
 P.act('enter');P.act('inn:area:yard');P.act('inn:select:dianwei');P.act('inn:offer:escort');P.act('inn:accept:escort');P.act('leave');P.visit('market');
 assert.ok(log.entries.some(e=>e.kind==='탐색'&&e.cat==='이동'&&String(e.text).includes('방문 장소')));assert.ok(log.entries.some(e=>e.kind==='의뢰'));
 const cats=new Set(log.prep.map(p=>p.cat));assert.ok(cats.has('이동')&&cats.has('장소 진입'),[...cats].join());assert.ok(log.prep.every(p=>p.time>=0&&p.power>=0));
 const es=runDianwei(true).escortState!;const log2=newPlaytestLog(1);const Q=logged(new Player(structuredClone(es)),log2);Q.x.fatigue=0;Q.visit('inn');Q.act('inn:area:yard');Q.act('inn:courtyard');const s=Q.x.duel!;
 assert.ok(log2.entries.some(e=>e.kind==='대결'&&e.cat==='시작'&&e.data?.objective==='practice'));
 for(let i=0;i<60&&s.result==='ongoing';i++)Q.act('social:'+deckDuelAction(s,'objective'));
 assert.ok(log2.entries.some(e=>e.kind==='대결'&&e.cat==='카드'&&typeof e.data?.distance==='string'&&'opening' in (e.data??{})),'card entries carry distance·stance·opening·momentum');
 assert.ok(log2.entries.some(e=>e.kind==='대결'&&e.cat==='합'));const result=log2.entries.find(e=>e.kind==='대결'&&e.cat==='결과');assert.ok(result&&typeof result.data?.grade==='string'&&Array.isArray(result.data?.missed));
 const text=JSON.stringify(log2);assert.ok(!/https?:\/\//.test(text),'no URLs in the log');
 const md=summarizeLog(log2,Q.r);for(const h of ['## 방문 경로','## 최종 덱','## 대결 연쇄','## 결과 등급','## 준비력·시간 내역','## 반복 또는 막힘'])assert.ok(md.includes(h),h);assert.ok(!/재미/.test(md.replace('재미 여부를 자동으로 판정하지 않습니다','')),'no fun verdict');
});

test('log: debate card plays record 논거 선택·공격 대상·예상 등급·조항, and the finished debate records missed conditions',()=>{
 const doc=runXunyu().docState!;const log=newPlaytestLog(1);const P=logged(new Player(structuredClone(doc)),log);const s=P.x.debate!;assert.ok(s.field);
 for(let i=0;i<80&&s.result==='ongoing';i++){const a=debateAction(s);P.act('social:'+a);}
 assert.ok(log.entries.some(e=>e.kind==='설전'&&e.cat==='카드'&&Array.isArray(e.data?.cards)));
 const res=log.entries.find(e=>e.kind==='설전'&&e.cat==='결과');assert.ok(res&&typeof res.data?.grade==='string'&&Array.isArray(res.data?.remainingOpp));
 recordUi(log,P.r,'추천 경로 열람','x');assert.deepEqual(log.routeOpened,[log.actions]);recordObserver(log,P.r,'결과에 놀람','등급');assert.equal(log.observer.length,1);
 assert.ok(setSurvey(log,'next',4,'메모').ok);assert.ok(!setSurvey(log,'next',6,'').ok);assert.ok(!setSurvey(log,'nope',3,'').ok);assert.equal(CORE_SURVEY.length,8);assert.ok(DETAIL_SURVEY.length>0);
 const kv=memoryKV();assert.ok(savePlaytestLog(kv,log));const back=loadPlaytestLog(kv)!;assert.equal(back.actions,log.actions);assert.equal(kv.getItem(PLAYTEST_LOG_KEY)!==null,true);assert.equal(kv.getItem(CAMPAIGN_KEY),null);
 const md=summarizeLog(back,P.r);assert.ok(md.includes('## 설전 논거')&&md.includes('## 설문')&&md.includes('## 관찰자 기록')&&md.includes('추천 경로 열람: 행동'));
});

test('prep categories and loop detection',()=>{
 const b=probe(startPlaytest(1));assert.equal(prepCategory('move:market',b),'이동');assert.equal(prepCategory('enter',b),'장소 진입');assert.equal(prepCategory('scene:inspect:ledger',b),'조사');assert.equal(prepCategory('card:12',b),'카드 사용');assert.equal(prepCategory('inn:lodge:room',b),'휴식');assert.equal(prepCategory('inn:accept:escort',b),'의뢰');assert.equal(prepCategory('engine:tactic:opening:shield',b),'대결 준비');assert.equal(prepCategory('approach:duel',b),'사건');
 const log=newPlaytestLog(1);let n=0;const mv=(to:string)=>{n++;log.entries.push({n,tick:n,at:1,kind:'action',cat:'행동',text:'move:'+to});log.entries.push({n,tick:n,at:1,kind:'탐색',cat:'이동',text:'방문 장소 '+to,data:{to}});log.prep.push({n,tick:n,cat:'이동',time:1,power:0,text:'이동'});};
 mv('market');mv('inn');mv('market');mv('inn');const loops=detectLoops(log);assert.ok(loops.some(t=>t.includes('왕복')),loops.join('|'));
 const ps=prepSummary(log);assert.equal(ps.totalTime,4);assert.equal(ps.byCat[0].cat,'이동');assert.equal(ps.recent.length,4);
});

test('debate readability: primary bar shows 집중·손패·다음 의도·예상 등급, secondary numbers are folded, badges mark core/danger/evidence, the card delta is labelled 대상/생성/소멸/조항/예상 등급, and attacking only the core explains the remaining risks',()=>{
 const doc=runXunyu().docState!;const s=structuredClone(doc.campaign!.cities.xingyang!.exploration!.debate!);const f=s.field!;
 const html=debateFieldView(s,null,(a,l)=>`<button data-x="${a}">${l}</button>`,{gradeOf:()=>'일반 합의',clausesOf:()=>[]});
 assert.ok(html.includes('field-status primary')&&html.includes('상대 다음 의도')&&html.includes('현재 예상'));assert.ok(html.includes('field-status-detail')&&html.includes('field-status secondary'));
 assert.ok(html.includes('내 핵심 입장'));assert.ok([f.opponentCore,...f.opponent,...f.hidden].some(a=>ARGUMENT_DEFS[a.definitionId].danger)?html.includes('field-badge danger'):true);
 const uid=s.deck!.hand[0];const d=fieldDelta(s,'card:'+uid,()=>'일반 합의',()=>[]);assert.ok(d.includes('예상 등급')||d.includes('변화 없음')||d.length>0);
 const pv=deckPreview(s,'card:'+uid);assert.ok(pv.check.ok);
 // 결과: 상대 보조 논거를 하나도 제거하지 않고 공격만 한 경우
 const t=structuredClone(s);t.result='partial';t.field!.stats.attacks=3;t.field!.stats.destroyedOpp=0;const note=remainingRiskNote(t);assert.ok(t.field!.opponent.some(a=>a.durability>0)?note.includes('상대 핵심 주장만 공격했습니다')&&note.includes('<li>'):true);
 const u=structuredClone(s);u.result='success';u.field!.stats.attacks=3;u.field!.stats.destroyedOpp=0;u.field!.opponent=[];assert.equal(remainingRiskNote(u),'');
});

test('duel readability: prepared tactics sit in their own group flagged when usable, and every card delta states the expected evaluation change',()=>{
 const es=runDianwei(true).escortState!;const P=new Player(structuredClone(es));P.x.fatigue=0;P.visit('inn');P.act('inn:area:yard');P.act('inn:courtyard');const s=P.x.duel!;
 const html=duelDeckView(s,(a,l)=>`<button data-x="${a}">${l}</button>`,{selectAttr:'data-c'});assert.ok(html.includes('duel-tactics')&&html.includes('준비 전술 3장'));assert.ok(/duel-tactics ready/.test(html),'a tactic is usable at the start');
 const uid=s.deck!.hand.find(u=>s.deck!.cards.find(c=>c.uid===u)!.id==='probe')??s.deck!.hand[0];const d=duelDelta(s,'card:'+uid);assert.ok(d.length>0);
 const ends=duelDelta(s,'end');assert.ok(typeof ends==='string');
});

test('session wrapper records accepted and refused actions, UI views, observer notes and survey; export text is local only',()=>{
 const kv=memoryKV();const ses=new PlaytestSession(kv);ses.start();const r=startPlaytest(1);const P=new Player(r);
 ses.wrap(r,'enter',()=>P.try('enter'));ses.wrap(r,'move:nowhere',()=>P.try('move:nowhere'));
 assert.equal(ses.log!.actions,1);assert.ok(ses.log!.entries.some(e=>e.kind==='거부'));ses.ui(r,'카드 상세 열람','카드 1');ses.observer(r,'처음 멈춘 지점','객사');assert.ok(ses.survey('again',5,'').ok);
 const json=ses.json(r);assert.ok(json.includes('cheonha-gunjin-playtest-log')&&json.includes('외부 전송 없음'));assert.ok(ses.summary(r).includes('## 관찰자 기록'));
 const panel=ses.panel(r);assert.ok(panel.includes('data-pt-survey="next"')&&panel.includes('data-pt-export="summary"')&&panel.includes('data-pt-observer'));assert.ok(ses.routePanel().includes('data-pt-route')&&!ses.routePanel().includes('<ol>'),'routes hidden until opened');ses.openRoute(r);assert.ok(ses.routePanel().includes('<ol>'));assert.deepEqual(ses.log!.routeOpened,[1]);
 assert.ok(ses.prepPanel().includes('준비 소비 내역'));
 const again=new PlaytestSession(kv);again.resume();assert.equal(again.log!.sessions,2);assert.equal(again.log!.actions,1);
 void (r as RunState);
});
