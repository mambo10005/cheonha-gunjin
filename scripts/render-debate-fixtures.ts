import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {createDebate,resolveDebateAction} from '../src/core/debate.ts';
import {prepareNegotiation} from '../src/core/negotiation.ts';
import {newRun} from '../src/core/run.ts';
import {configureAccordDemo} from '../src/core/accord-demo.ts';
import {debateScene} from '../src/ui/debate-scene.ts';
import {DebatePlayback,attachSceneControls,defaultSceneSettings,sceneSettingsHtml} from '../src/ui/debate-playback.ts';
import {poseAsset,type ArtPose} from '../src/data/debate-art.ts';
import type {DebateEvent} from '../src/core/debate-events.ts';
export const VISUAL_CASES=['start','player-speech','counter','signature','requirement','irrevocable-cost','partial','success','failure','missing','reduced','contrast','long-text'] as const;
const css=readFileSync('src/ui/style.css','utf8')+'\n'+readFileSync('src/ui/debate-cinematic.css','utf8');
mkdirSync('public/verification/debate',{recursive:true});
for(const name of VISUAL_CASES){
  const general=name==='missing'?'chengong':'guojia',s=createDebate(51001,general,'merchant',{kind:'agreement',clause:'sponsorship',faction:'caravan'});prepareNegotiation(s,18,2,0);
  let events:DebateEvent[]=[],action='evidence';
  const commit=(a:string)=>{action=a;events=resolveDebateAction(s,a,s.round).events??[];};
  if(name==='player-speech'||name==='requirement')commit('evidence');
  if(name==='signature')commit('disclose');
  if(name==='counter'){commit('disclose');commit('concede');}
  if(name==='success')for(const a of ['proposal','pledge','evidence','concede'])commit(a);
  if(name==='partial')for(const a of ['evidence','proposal','evidence','concede'])commit(a);
  if(name==='failure')commit('withdraw');
  if(name==='long-text')s.log.push('長文 · '+'긴 한국어 요구와 설명 '.repeat(30));
  const run=newRun(51001,'caocao');configureAccordDemo(run);run.food=s.negotiation!.food;run.floor=0;run.col=0;run.screen='node';run.pending={kind:'debate',state:s};
  const settings=defaultSceneSettings(name==='reduced');settings.highContrast=name==='contrast';settings.speed='instant';settings.lowPower=true;
  const dom=new JSDOM('<div id="app"><div class="hud panel cinematic-hud">조조 · 군량 '+run.food+' · 집중 '+s.resolve+' · 검증 고정 상태</div>'+debateScene(run)+'</div>');
  const root=dom.window.document.querySelector<HTMLElement>('#app')!,playback=new DebatePlayback(root,settings);root.querySelector('.scene-utilities')?.insertAdjacentHTML('beforeend',sceneSettingsHtml(settings));attachSceneControls(root,()=>s,playback);playback.applySettings();
  const kind:Partial<Record<typeof name,DebateEvent['kind']>>={'player-speech':'speechStarted',counter:'opponentCountered',signature:'followupUnlocked',requirement:'requirementSatisfied'};
  const event=events.find(e=>e.kind===kind[name]);if(event)playback.presentEvent(event,s,action);
  if(name==='irrevocable-cost')root.querySelector<HTMLButtonElement>('[data-debate-select="pledge"]')?.click();
  for(const person of root.querySelectorAll<HTMLElement>('[data-person]')){
    const poses:Record<string,ArtPose>={idle:'neutral',speak:'speak',press:'press',counter:'countered',advantage:'victory',concede:'concede'};
    const image=person.querySelector<HTMLImageElement>('[data-layer="front"]');if(image)image.src=poseAsset(person.dataset.person??'',poses[person.dataset.pose??'idle']??'neutral');
    const back=person.querySelector<HTMLImageElement>('[data-layer="back"]');if(back)back.hidden=true;
  }
  const html='<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>설전 시각 고정 상태 '+name+'</title><style>'+css+'\n*{animation:none!important;transition:none!important}</style><body>'+root.outerHTML+'</body></html>';
  writeFileSync('public/verification/debate/'+name+'.html',html);playback.cancel();dom.window.close();
}
writeFileSync('public/verification/debate/index.html','<!doctype html><html lang="ko"><meta charset="utf-8"><title>설전 시각 검증 상태</title><body><h1>설전 시각 고정 상태</h1><p>규칙 엔진과 실제 렌더러로 생성한 정적 검수 자료입니다. 실제 브라우저 검증 결과가 아닙니다.</p>'+VISUAL_CASES.map(n=>'<p><a href="./'+n+'.html">'+n+'</a></p>').join('')+'</body></html>');
console.log('13 deterministic visual fixtures generated. No browser or screenshots were used.');
