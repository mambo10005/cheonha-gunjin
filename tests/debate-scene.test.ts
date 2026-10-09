import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {build} from 'vite';
import {createDebate,resolveDebateAction} from '../src/core/debate.ts';
import {prepareNegotiation} from '../src/core/negotiation.ts';
import {newRun} from '../src/core/run.ts';
import {configureAccordDemo} from '../src/core/accord-demo.ts';
import {actDebate} from '../src/core/social-run.ts';
import {saveRun,loadRun,memoryKV} from '../src/core/save.ts';
import {DEBATE_PRESENTATION,characterPresentation,portraitPose,speechLine,opponentLine} from '../src/data/debate-presentation.ts';
import {debateScene,argumentPreview} from '../src/ui/debate-scene.ts';
import {DebatePlayback,defaultSceneSettings,loadSceneSettings,orderedEvents,attachSceneControls,sceneSettingsHtml} from '../src/ui/debate-playback.ts';
import type {DebateState} from '../src/core/social-types.ts';

function debate(general='guojia',opponent='elder'):DebateState{const s=createDebate(51001,general,opponent,{kind:'agreement',clause:'escort',faction:'villages'});prepareNegotiation(s,20,1,0);return s;}
function runWith(s:DebateState){const run=newRun(51001,'caocao');configureAccordDemo(run);run.floor=2;run.col=0;run.screen='node';run.food=s.negotiation!.food;run.generals=[{id:s.generalId,row:'rear'}];run.pending={kind:'debate',state:s};return run;}

test('core receipt: cost, score, trust, burden and resources match committed state',()=>{
  for(const action of ['evidence','rebuttal','concede','proposal','disclose','pledge','authority','credential']){
    const s=debate('chengong','merchant');s.negotiation!.credentials=1;const before=structuredClone(s), result=resolveDebateAction(s,action,0);assert.ok(result.ok);const e=result.events!;
    const sum=(resource:string,kinds:string[])=>e.filter(e=>e.resource===resource&&kinds.includes(e.kind)).reduce((sum,e)=>sum+e.value,0);
    assert.equal(sum('focus',['costSpent','argumentApplied']),s.resolve-before.resolve);
    assert.equal(sum('trust',['trustChanged']),s.trust-before.trust);
    assert.equal(sum('food',['resourceSpent']),s.negotiation!.food-before.negotiation!.food);
    assert.equal(sum('reports',['resourceSpent']),s.negotiation!.reports-before.negotiation!.reports);
    assert.equal(sum('credentials',['resourceSpent']),s.negotiation!.credentials-before.negotiation!.credentials);
    assert.equal(sum('burden',['burdenChanged']),s.negotiation!.burden-before.negotiation!.burden);
    for(const axis of ['profit','safety','honor','authority'] as const)assert.equal(sum(axis,['argumentApplied']),s.negotiation!.scores[axis]-before.negotiation!.scores[axis]);
  }
});
test('core event order: action → costs/resources → speech → effect → link → counter → condition → result',()=>{
  const s=debate();resolveDebateAction(s,'disclose',0);const receipt=resolveDebateAction(s,'concede',1).events!;
  assert.deepEqual(receipt.map(e=>e.sequence),receipt.map((_,i)=>i));assert.deepEqual(orderedEvents(receipt),receipt);
  assert.ok(receipt.findIndex(e=>e.kind==='traitTriggered')<receipt.findIndex(e=>e.kind==='opponentCountered'));
  assert.ok(receipt.some(e=>e.kind==='opponentCountered'&&e.resource==='safety'&&e.value===1));
  assert.equal(s.negotiation!.needs.safety,4);assert.ok(receipt.filter(e=>e.kind==='requirementSatisfied').every(e=>e.target==='trust'?s.trust>=s.negotiation!.trustNeeded:s.negotiation!.scores[e.target as 'safety']>=s.negotiation!.needs[e.target as 'safety']!));
});
test('legacy rules also return receipts without changing their grade',()=>{const s=createDebate(31001,'guojia','merchant',{kind:'supply'});for(let i=0;i<4;i++){const before=s.agreement;const r=resolveDebateAction(s,'concede',i);assert.equal(r.events!.find(e=>e.resource==='agreement')!.value,s.agreement-before);}assert.equal(s.result,'failure');});
test('core rejects stale round duplicates and never produces a second receipt',()=>{const run=runWith(debate());const first=actDebate(run,'pledge',0);assert.ok(first.ok);const before=structuredClone(run);const repeat=actDebate(run,'pledge',0);assert.equal(repeat.ok,false);assert.equal(repeat.events,undefined);assert.deepEqual(run,before);});
test('save restore excludes receipts and cannot reapply payment or reward',()=>{const run=runWith(debate());actDebate(run,'pledge',0);const kv=memoryKV();assert.ok(saveRun(kv,run));const loaded=loadRun(kv);assert.ok(loaded.ok);assert.deepEqual(loaded.data,run);assert.equal(JSON.stringify(loaded.data).includes('speechStarted'),false);assert.equal(actDebate(loaded.data,'pledge',0).ok,false);assert.equal(loaded.data.food,18);});
test('portraits and poses have deterministic fallbacks and reserved dimensions',()=>{assert.equal(characterPresentation('unknown').portrait,'/assets/debate/portraits/guojia/neutral.webp');const p=DEBATE_PRESENTATION.guojia,old=p.poses;p.poses=['idle'];try{assert.equal(portraitPose('guojia','press'),'idle');}finally{p.poses=old;}for(const p of Object.values(DEBATE_PRESENTATION))assert.ok(existsSync('public'+p.portrait));const html=debateScene(runWith(debate()));assert.match(html,/width="512" height="512"/);assert.match(html,/반신 원화/);});
test('same seed and action choose the same speech without touching rule RNG',()=>{const s=debate(),copy=structuredClone(s);assert.equal(speechLine(s,'disclose'),speechLine(copy,'disclose'));assert.deepEqual(s,copy);assert.match(opponentLine(s),/안전/);s.negotiation!.scores.safety=4;s.trust=3;assert.match(opponentLine(s),/충족/);});
test('preview is generated by rule engine and warns about irrevocable food and promised authority',()=>{const s=debate(),before=structuredClone(s);assert.match(argumentPreview(s,'pledge'),/환급하지/);assert.match(argumentPreview(s,'authority'),/보상 선택지/);assert.match(argumentPreview(s,'pledge'),/20 → 18/);assert.deepEqual(s,before);});
test('reduced motion defaults and persisted settings are independent of run saves',()=>{assert.equal(defaultSceneSettings(true).speed,'instant');const settings=loadSceneSettings({getItem:()=>null},true);assert.equal(settings.reduced,true);assert.equal(settings.shake,false);assert.equal(loadSceneSettings({getItem:()=>'{"sfx":999,"speed":"fast"}'},true).sfx,100);assert.equal(loadSceneSettings({getItem:()=>'{broken'},true).speed,'instant');});
test('DOM accessibility settings persist separately and apply without changing expedition',()=>{
  const s=debate(),before=structuredClone(s),dom=new JSDOM('<div>'+debateScene(runWith(s))+sceneSettingsHtml(defaultSceneSettings())+'</div>',{url:'http://localhost/'});const root=dom.window.document.querySelector<HTMLElement>('div')!,playback=new DebatePlayback(root,defaultSceneSettings());attachSceneControls(root,()=>s,playback);
  const reduced=root.querySelector<HTMLInputElement>('[data-scene-setting="reduced"]')!;reduced.checked=true;reduced.dispatchEvent(new dom.window.Event('change',{bubbles:true}));assert.equal(loadSceneSettings(dom.window.localStorage).reduced,true);assert.equal(root.querySelector('.debate-scene')!.getAttribute('data-motion'),'reduced');assert.deepEqual(s,before);playback.cancel();dom.window.close();
});
test('DOM: all cards focusable, explicit execution, lock reasons, keyboard navigation and missing image recovery',()=>{
  const s=debate(),dom=new JSDOM('<div id="app">'+debateScene(runWith(s))+'</div>');const root=dom.window.document.querySelector<HTMLElement>('#app')!;
  const playback=new DebatePlayback(root,defaultSceneSettings(true));attachSceneControls(root,()=>s,playback);const cards=Array.from(root.querySelectorAll<HTMLButtonElement>('[data-debate-select]'));
  assert.equal(cards.length,8);assert.ok(cards.every(c=>!c.disabled));
  const locked=root.querySelector<HTMLButtonElement>('[data-debate-select="credential"]')!;locked.focus();assert.equal(locked.getAttribute('aria-disabled'),'true');assert.match(root.querySelector('[data-argument-detail]')!.textContent!,/신용/);assert.equal(root.querySelector('[data-kind="debate-action"][data-choice="credential"]'),null);
  cards[0].focus();cards[0].dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));assert.equal(dom.window.document.activeElement,cards[1]);
  for(const c of cards){c.focus();assert.match(root.querySelector('[data-argument-detail]')!.textContent!,new RegExp(c.querySelector('strong')!.textContent!));}
  cards[0].click();assert.equal(cards[0].getAttribute('aria-pressed'),'true');assert.ok(root.querySelector('[data-kind="debate-action"][data-choice="evidence"]'));
  const img=root.querySelector<HTMLImageElement>('[data-portrait]')!;img.src='/missing.webp';img.dispatchEvent(new dom.window.Event('error'));assert.equal(img.getAttribute('src'),'/assets/debate/portraits/guojia/neutral.webp');img.dispatchEvent(new dom.window.Event('error'));assert.equal(img.hidden,true);assert.equal(root.querySelector<HTMLElement>('.portrait-fallback')!.hidden,false);assert.ok(root.querySelector('[data-kind="debate-action"][data-choice="evidence"]'));playback.cancel();dom.window.close();
});
test('DOM playback: instant, fast, normal and skip do not mutate rule state',async()=>{
  for(const speed of ['instant','fast','normal','skip'] as const){const s=debate();const receipt=resolveDebateAction(s,'disclose',0).events!;const before=structuredClone(s);const dom=new JSDOM('<div>'+debateScene(runWith(s))+'</div>');const root=dom.window.document.querySelector<HTMLElement>('div')!;const settings=defaultSceneSettings(true);settings.speed=speed==='skip'?'normal':speed;const playback=new DebatePlayback(root,settings);const observed:string[]=[];root.addEventListener('debate-audio',e=>observed.push((e as CustomEvent).detail.cue));const pending=playback.play(receipt,s,'disclose');if(speed==='skip')playback.cancel();await pending;assert.deepEqual(s,before);assert.equal(root.querySelector('.debate-scene')!.getAttribute('data-motion'),'reduced');assert.ok(observed.includes('card-select'));playback.cancel();dom.window.close();}
});
test('DOM results: success, partial, failure expose costs, follow-up duties and confirmation',()=>{
  for(const result of ['success','partial','failure'] as const){const s=debate();s.result=result;s.round=4;s.negotiation!.paid=2;const html=debateScene(runWith(s));const dom=new JSDOM(html);assert.ok(dom.window.document.querySelector('.result-'+result));assert.match(dom.window.document.body.textContent!,/지불한 군량 2/);assert.match(dom.window.document.body.textContent!,/아직 거래 보상|의무/);assert.ok(dom.window.document.querySelector('[data-kind="finish-debate"]'));dom.window.close();}
});
test('result quotes use current core partial-recruit and supply terms, without applying them',()=>{
  const s=debate();s.result='partial';s.round=4;s.context={kind:'recruit',candidate:'luxun'};const run=runWith(s),before=structuredClone(run);assert.match(debateScene(run),/군량 3/);assert.deepEqual(run,before);s.context={kind:'supply'};assert.match(debateScene(runWith(s)),/군량 \+5/);assert.match(debateScene(runWith(s)),/병력 \+6/);
});
test('CSS structure: mobile horizontal hand, minimum touch size, motion fallback and visible focus (layout unverified)',()=>{
  const css=readFileSync('src/ui/debate-cinematic.css','utf8');assert.match(css,/@media\(max-width:560px\)/);assert.match(css,/overflow-x:auto/);assert.match(css,/data-speaker=opponent/);assert.match(css,/min-height:44px/);assert.match(css,/prefers-reduced-motion:reduce/);assert.match(css,/focus-visible/);assert.match(sceneSettingsHtml(defaultSceneSettings()),/연출 감소/);
});
test('bundled DOM: two representatives → card selection → receipt → three results; reload never replays', {timeout:30000},async()=>{
  const bundle=await build({logLevel:'silent',build:{write:false}}),out=Array.isArray(bundle)?bundle[0]:bundle;assert.ok('output' in out);const chunk=out.output.find(o=>o.type==='chunk');assert.ok(chunk&&chunk.type==='chunk');
  const html=readFileSync('index.html','utf8').replace(/<script[^>]+src="\/src\/ui\/main.ts"[^>]*><\/script>/,'');
  const app=(saved?:string)=>{const dom=new JSDOM(html,{url:'http://localhost/',runScripts:'outside-only',beforeParse(w){w.structuredClone=structuredClone;w.matchMedia=(()=>({matches:true,addEventListener(){},removeEventListener(){}})) as unknown as typeof w.matchMedia;if(saved)w.localStorage.setItem('cheonha-gunjin.run',saved);}});dom.window.eval(chunk.code);return dom;};
  for(const [general,actions,grade] of [['guojia',['proposal','pledge','evidence','concede'],'success'],['chengong',['evidence','proposal','evidence','concede'],'partial'],['guojia',['withdraw'],'failure']] as const){
    let dom=app();const click=(selector:string)=>{const e=dom.window.document.querySelector<HTMLButtonElement>(selector);assert.ok(e,selector);assert.equal(e.disabled,false);e.click();};
    try{click('[data-a="to-lords"]');click(`[data-a="debate-scene-demo"][data-id="${general}"]`);click('[data-a="move"][data-col="0"]');dom.window.document.querySelector<HTMLSelectElement>('#social-general')!.value=general;click('[data-kind="begin-debate"][data-choice="sponsorship"]');assert.equal(dom.window.document.querySelector('.debate-scene')!.getAttribute('data-motion'),'reduced');
      for(const action of actions){if(action!=='withdraw')click(`[data-debate-select="${action}"]`);click(`[data-kind="debate-action"][data-choice="${action}"]`);}
      assert.ok(dom.window.document.querySelector('.result-'+grade));const saved=dom.window.localStorage.getItem('cheonha-gunjin.run')!;assert.ok(saved);const before=loadRun(dom.window.localStorage);assert.ok(before.ok);dom.window.close();dom=app(saved);click('[data-a="continue"]');const after=loadRun(dom.window.localStorage);assert.deepEqual(after,before);assert.equal(dom.window.document.querySelector('.debate-scene')!.getAttribute('data-event'),null);assert.ok(dom.window.document.querySelector('.result-'+grade));click('[data-kind="finish-debate"]');assert.ok(dom.window.document.querySelector('[data-kind="sign-agreement"]'));
    }finally{dom.window.close();}
  }
});
