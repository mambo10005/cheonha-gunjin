import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {JSDOM} from 'jsdom';
import {saveCampaign,loadCampaign,CAMPAIGN_KEY} from '../src/core/campaign-save.ts';
import {memoryKV} from '../src/core/save.ts';
import {freshRun,Player} from '../src/sim/card-engine-play.ts';
// 카드 엔진 공개 DOM 확인(jsdom). 실제 브라우저 렌더링이나 사람의 플레이 결과는 아니다.
test('engine drawer shows the 12-card active deck, storage, stratagem slots, tactics, arguments; plan screen shows the gate build test',{timeout:180000},async()=>{
 const built=await build({logLevel:'silent',build:{write:false}}),out=Array.isArray(built)?built[0]:built;assert.ok('output' in out);const js=out.output.find(x=>x.type==='chunk');assert.ok(js&&js.type==='chunk');const errors:string[]=[];
 // 실제 명령으로 문서고 퍼즐을 풀고 순욱을 등용한 저장 상태를 만든다
 const P=new Player(freshRun());P.act('enter');P.act('inn:offer:recommendation');P.act('inn:accept:recommendation');P.act('inn:quest:recommendation:public-records');P.visit('archive');P.act('engine:mulligan');P.act('scene:inspect:ledger');for(const id of ['clues','manifesto','recommend'])P.play(id);P.act('engine:resolve:truth');P.act('engine:reward:card:'+P.e.reward!.cards[0]);P.visit('inn');P.act('inn:report:recommendation');P.act('officer:recruit:xunyu:a');P.act('leave');P.act('companion:xunyu');
 const kv=memoryKV();assert.ok(saveCampaign(kv,P.r));const raw=kv.getItem(CAMPAIGN_KEY)!;
 const boot=(data:string)=>{const d=new JSDOM('<main id="app"></main>',{url:'http://localhost/',runScripts:'outside-only',beforeParse(w){w.structuredClone=structuredClone;w.matchMedia=(()=>({matches:true})) as unknown as typeof w.matchMedia;w.localStorage.setItem(CAMPAIGN_KEY,data);w.addEventListener('error',e=>errors.push(String(e.error)));}});d.window.eval(js.code);return d;};
 let dom=boot(raw),doc=dom.window.document;
 const click=(selector:string)=>{const b=doc.querySelector<HTMLButtonElement>(selector);assert.ok(b,selector);assert.equal(b.disabled,false,selector+' '+b.textContent);b.click();assert.deepEqual(errors,[]);};
 const state=()=>{const data=loadCampaign(dom.window.localStorage);assert.ok(data.ok);return data.data.activeExpedition!;};
 try{
  click('[data-a="world-continue"]');click('[data-explore-tab="engine"]');const drawer=doc.querySelector('.engine-drawer');assert.ok(drawer,'engine drawer');
  assert.match(drawer!.textContent!,/활동 덱 7\/12/);assert.match(drawer!.textContent!,/인재\(대표·동행\) 0\/4/);assert.match(drawer!.textContent!,/거병 책략 0\/2/);
  const xunyuCards=state().campaign!.personnel!.library.filter(l=>l.owners.includes('xunyu'));assert.equal(xunyuCards.length,2);for(const l of xunyuCards)assert.ok(!state().campaign!.personnel!.loadouts.raising.includes(l.uid),'recruit does not auto-equip');
  click(`[data-explore-action="officer:equip:${xunyuCards[0].uid}:raising"]`);assert.ok(state().campaign!.personnel!.loadouts.raising.includes(xunyuCards[0].uid));assert.match(doc.querySelector('.engine-drawer')!.textContent!,/활동 덱 8\/12/);
  assert.ok(doc.querySelector('.engine-talent'),'talent principle card');assert.match(doc.querySelector('.engine-drawer')!.textContent!,/공론의 인선/);
  assert.ok(doc.querySelector('[data-explore-action="engine:tactic:opening:read"]'),'tactic slots');assert.ok(doc.querySelector<HTMLButtonElement>('[data-explore-action="engine:tactic:opening:press"]')!.disabled,'no military source');click('[data-explore-action="engine:tactic:opening:read"]');assert.equal(state().campaign!.world!.raising!.engine!.loadout.opening,'read');
  assert.match(doc.querySelector('.engine-drawer')!.textContent!,/기록 공백 해소/,'persistent argument listed');
  dom.window.close();
  // 민회 계획까지 진행한 상태에서 계획 화면이 관문 규칙·논거·전술 편성을 보여 준다
  P.visit('shrine');P.act('approach:assembly');if(P.x.scene!=='map')P.act('leave');P.act('plan');P.officer('elect:chengong:xunyu');const kv2=memoryKV();assert.ok(saveCampaign(kv2,P.r));dom=boot(kv2.getItem(CAMPAIGN_KEY)!);doc=dom.window.document;click('[data-a="world-continue"]');
  assert.ok(doc.querySelector('.engine-gate-rule'),'gate build test text');assert.match(doc.body.textContent!,/민회와 격문: 기본 명예 요구 \+2/);assert.ok(doc.querySelector('.engine-gate-prep .engine-argument-list'),'arguments before the debate');
 }finally{dom.window.close();}
});

test('first-cooperation pact panel: swap common cards for talent cards, pick an early stratagem, and see them in the next hand (jsdom)',{timeout:180000},async()=>{
 const built=await build({logLevel:'silent',build:{write:false}}),out=Array.isArray(built)?built[0]:built;assert.ok('output' in out);const js=out.output.find(x=>x.type==='chunk');assert.ok(js&&js.type==='chunk');const errors:string[]=[];
 const dom=new JSDOM('<main id="app"></main>',{url:'http://localhost/',runScripts:'outside-only',beforeParse(w){w.structuredClone=structuredClone;w.matchMedia=(()=>({matches:true})) as unknown as typeof w.matchMedia;w.addEventListener('error',e=>errors.push(String(e.error)));}});dom.window.eval(js.code);const doc=dom.window.document;
 const click=(selector:string)=>{const b=doc.querySelector<HTMLButtonElement>(selector);assert.ok(b,selector);assert.equal(b.disabled,false,selector+' '+b.textContent);b.click();assert.deepEqual(errors,[]);};const act=(a:string)=>click(`[data-explore-action="${a}"]`);
 const change=(selector:string,value:string)=>{const el=doc.querySelector<HTMLInputElement|HTMLSelectElement>(selector)!;el.value=value;el.dispatchEvent(new dom.window.Event('change',{bubbles:true}));};
 const state=()=>{const data=loadCampaign(dom.window.localStorage);assert.ok(data.ok);return data.data.activeExpedition!;};
 try{
  click('[data-a="world-new"]');change('[data-world-seed]','141001');click('[data-campaign-choice="founder"][data-value="chengong"]');change('[data-raising-origin]','notable');click('[data-world="start"]');act('enter');act('inn:area:yard');act('inn:select:dianwei');act('inn:offer:escort');act('inn:accept:escort');
  const panel=doc.querySelector('.engine-pact');assert.ok(panel,'pact panel');assert.equal(panel!.querySelectorAll('.engine-pact-cards article').length,4);assert.equal(panel!.querySelectorAll('.engine-pact-stratagems article').length,3);
  const p=state().campaign!.personnel!,man=p.library.find(l=>l.id==='manifesto')!;act(`engine:pact-swap:d_guard:${man.uid}`);act('engine:pact-stratagem:open_flag');act('engine:pact-close');assert.equal(doc.querySelector('.engine-pact'),null);
  const s=state();assert.ok(!s.campaign!.personnel!.loadouts.raising.includes(man.uid));assert.deepEqual(s.campaign!.world!.raising!.engine!.stratagems,['open_flag']);
  act('leave');for(const id of ['market','store']){click(`[data-city-location="${id}"]`);act('move:'+id);}act('enter');assert.ok([...doc.querySelectorAll('.exploration-hand-card h4')].some(h=>h.textContent==='방비 태세'),'pact card in the first hand');
  click('[data-explore-tab="engine"]');assert.ok(doc.querySelector('[data-engine-report]'),'local debug report button');
 }finally{dom.window.close();}
});
