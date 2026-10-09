import type { DebateEvent } from '../core/debate-events.ts';
import type { DebateState } from '../core/social-types.ts';
import { ARGUMENT_VISUALS, characterPresentation, opponentLine, portraitPose } from '../data/debate-presentation.ts';
import { ARGUMENTS } from '../data/arguments.ts';
import { DEBATE_ACTIONS } from '../data/social.ts';
import { argumentPreview, requirements } from './debate-scene.ts';
import { activityButton, esc } from './html.ts';
import { characterArt, poseAsset, type ArtPose } from '../data/debate-art.ts';

export interface SceneSettings { reduced:boolean; shake:boolean; speed:'normal'|'fast'|'instant'; lowPower:boolean; muted:boolean; sfx:number; music:number; particles:boolean; highContrast:boolean; autoDialogue:boolean; textSize:number }
const SETTINGS_KEY='cheonha-gunjin.presentation';
export function defaultSceneSettings(reduced=false):SceneSettings{return {reduced,shake:!reduced,speed:reduced?'instant':'normal',lowPower:false,muted:true,sfx:50,music:25,particles:!reduced,highContrast:false,autoDialogue:true,textSize:100};}
export function loadSceneSettings(storage:Pick<Storage,'getItem'>,reduced=false):SceneSettings {
  const settings=defaultSceneSettings(reduced);try {const raw=JSON.parse(storage.getItem(SETTINGS_KEY)??'{}');
    for(const key of ['reduced','shake','lowPower','muted','particles','highContrast','autoDialogue'] as const)if(typeof raw[key]==='boolean')settings[key]=raw[key];
    if(['normal','fast','instant'].includes(raw.speed))settings.speed=raw.speed;
    for(const key of ['sfx','music'] as const)if(Number.isFinite(raw[key]))settings[key]=Math.max(0,Math.min(100,raw[key]));
    if(Number.isFinite(raw.textSize))settings.textSize=Math.max(100,Math.min(150,raw.textSize));
  }catch{ /* Storage is optional; rules do not depend on it. */ }return settings;
}
export function orderedEvents(events:DebateEvent[]):DebateEvent[]{
  return [...events].sort((a,b)=>a.sequence-b.sequence);
}
export const AUDIO_CUES:Partial<Record<DebateEvent['kind'],string>>={actionUsed:'card-select',speechStarted:'brush',resourceSpent:'bamboo',traitTriggered:'seal',opponentCountered:'counter',requirementSatisfied:'requirement',debateResolved:'result'};
// Empty licensed-audio manifest. Events are available without downloading or inventing music.
export const AUDIO_ASSETS:Record<string,string>={};
export type CinematicCamera='establishing'|'playerSpeak'|'opponentSpeak'|'clash'|'requirementComplete'|'resolution';
export function cameraForEvent(event:DebateEvent):CinematicCamera{
  if(event.kind==='speechStarted')return 'playerSpeak';
  if(event.kind==='opponentCountered'||event.kind==='opponentResponded')return 'opponentSpeak';
  if(event.kind==='requirementSatisfied')return 'requirementComplete';
  if(event.kind==='debateResolved')return 'resolution';
  if(event.kind==='argumentApplied'||event.kind==='traitTriggered')return 'clash';
  return 'establishing';
}
export class DebatePlayback {
  private epoch=0;
  private timers=new Set<ReturnType<typeof setTimeout>>();
  private resolvePending:(()=>void)|null=null;
  private summary='';
  private root:HTMLElement;
  settings:SceneSettings;
  constructor(root:HTMLElement,settings:SceneSettings){this.root=root;this.settings=settings;}
  cancel():void {this.epoch++;for(const id of this.timers)clearTimeout(id);this.timers.clear();this.resolvePending?.();this.resolvePending=null;
    const feedback=this.root.querySelector('[data-scene-feedback]');if(feedback&&this.summary)feedback.textContent=this.summary;this.summary='';
    this.root.querySelectorAll<HTMLElement>('[data-person]').forEach(p=>{const result=this.root.querySelector<HTMLElement>('.debate-scene')?.dataset.result;
      this.setPose(p,result==='success'?(p.classList.contains('player')?'advantage':'concede'):result==='failure'?(p.classList.contains('player')?'concede':'advantage'):'idle');});
    this.root.querySelectorAll<HTMLElement>('.event-active,.signature-active').forEach(p=>p.classList.remove('event-active','signature-active'));
    const scene=this.root.querySelector<HTMLElement>('.debate-scene'); if(scene){delete scene.dataset.event;delete scene.dataset.effect;delete scene.dataset.priority;scene.dataset.camera=scene.dataset.result==='ongoing'?'establishing':'resolution';}
    const next=this.root.querySelector<HTMLButtonElement>('[data-next-debate]');if(next)next.hidden=true;
  }
  advance():void{const next=this.root.querySelector<HTMLButtonElement>('[data-next-debate]');if(next)next.hidden=true;this.resolvePending?.();this.resolvePending=null;}
  // Deterministic visual fixture hook: presentation only, no action or reward dispatch.
  presentEvent(event:DebateEvent,state:DebateState,action:string):void{this.applySettings();this.show(event,state,action);}
  private setPose(person:HTMLElement,pose:string):void{
    person.dataset.pose=pose;
    const aliases:Record<string,ArtPose>={idle:'neutral',speak:'speak',press:'press',counter:'countered',advantage:'victory',concede:'concede'};
    const src=poseAsset(person.dataset.person??'',aliases[pose]??'neutral');
    const front=person.querySelector<HTMLImageElement>('[data-layer="front"]'),back=person.querySelector<HTMLImageElement>('[data-layer="back"]');
    if(!front||!back)return;
    if(front.getAttribute('src')===src){delete back.dataset.requested;back.hidden=true;return;}
    back.dataset.requested=src;back.classList.remove('is-visible');back.classList.add('is-fading');back.hidden=false;back.src=src;
  }
  applySettings():void{const scene=this.root.querySelector<HTMLElement>('.debate-scene');if(!scene)return;
    scene.dataset.motion=this.settings.reduced?'reduced':'full';scene.dataset.shake=String(this.settings.shake&&!this.settings.reduced);scene.dataset.speed=this.settings.speed;scene.dataset.lowPower=String(this.settings.lowPower);
    scene.dataset.particles=String(this.settings.particles&&!this.settings.reduced&&!this.settings.lowPower);scene.dataset.contrast=this.settings.highContrast?'high':'normal';scene.style.setProperty('--text-scale',String(this.settings.textSize/100));scene.dataset.largeText=String(this.settings.textSize>110);
  }
  async play(events:DebateEvent[],state:DebateState,action:string):Promise<void>{
    this.cancel();this.applySettings();const epoch=this.epoch;this.summary=events.map(eventText).filter(Boolean).join(' · ');
    for(const event of orderedEvents(events)){
      if(epoch!==this.epoch)break;this.show(event,state,action);
      if(!this.settings.autoDialogue&&['speechStarted','opponentCountered','opponentResponded'].includes(event.kind)){
        const next=this.root.querySelector<HTMLButtonElement>('[data-next-debate]');if(next){next.hidden=false;await new Promise<void>(resolve=>{this.resolvePending=resolve;});if(epoch!==this.epoch)break;}
      }
      const delay=this.settings.speed==='instant'?0:this.settings.speed==='fast'?80:event.visualPriority===3?420:180;
      if(delay)await new Promise<void>(resolve=>{this.resolvePending=resolve;const timer=setTimeout(()=>{this.timers.delete(timer);this.resolvePending=null;resolve();},delay);this.timers.add(timer);});
    }
    if(epoch===this.epoch){this.cancel();const feedback=this.root.querySelector('[data-scene-feedback]');if(feedback)feedback.textContent=events.map(eventText).filter(Boolean).join(' · ');}
  }
  private show(e:DebateEvent,s:DebateState,action:string):void{
    const scene=this.root.querySelector<HTMLElement>('.debate-scene');if(!scene)return;
    this.root.querySelectorAll('.event-active').forEach(p=>p.classList.remove('event-active'));
    scene.dataset.event=e.kind;scene.dataset.priority=String(e.visualPriority);scene.dataset.effect=ARGUMENT_VISUALS[action]?.effect??'document';
    scene.dataset.camera=cameraForEvent(e);
    if(e.kind==='speechStarted'||e.kind==='actionUsed')scene.dataset.speaker='player';
    if(e.kind==='opponentCountered'||e.kind==='opponentResponded')scene.dataset.speaker='opponent';
    const feedback=this.root.querySelector('[data-scene-feedback]');if(feedback)feedback.textContent=eventText(e);
    const symbol=this.root.querySelector('[data-effect-symbol]');if(symbol)symbol.textContent=ARGUMENT_VISUALS[action]?.symbol??'議';
    const who=e.kind==='opponentCountered'||e.kind==='opponentResponded'?'opponent':'player';
    const person=this.root.querySelector<HTMLElement>('.debate-person.'+who);
    if(person){const pose=e.kind==='opponentCountered'?'press':e.kind==='debateResolved'?'concede':e.kind==='speechStarted'?'speak':e.kind==='traitTriggered'?'advantage':'idle';this.setPose(person,portraitPose(who==='player'?s.generalId:s.opponentId,pose));}
    if(e.kind==='opponentCountered'){const player=this.root.querySelector<HTMLElement>('.debate-person.player');if(player)this.setPose(player,'counter');}
    if(e.kind==='speechStarted'){const speech=this.root.querySelector('[data-speech-player]');if(speech)speech.textContent='“'+e.reason+'”';}
    const reply=this.root.querySelector('[data-speech-opponent]');if(reply&&(e.kind==='opponentCountered'||e.kind==='opponentResponded'))reply.textContent='“'+e.reason+'”';else if(reply&&e.kind==='debateResolved')reply.textContent='“'+opponentLine(s)+'”';
    this.root.querySelectorAll<HTMLElement>('[data-requirement]').forEach(el=>{if(el.dataset.requirement===e.target)el.classList.add('event-active');});
    const presentation=characterPresentation(s.generalId);
    // Signatures decorate actual trait/follow-up/condition events only; never add a rule benefit.
    if(presentation.signatureActions.includes(action)&&['traitTriggered','followupUnlocked','requirementSatisfied'].includes(e.kind)){scene.dataset.signature=presentation.signatureEffect;scene.classList.add('signature-active');}
    const cue=AUDIO_CUES[e.kind];if(cue){const EventClass=this.root.ownerDocument.defaultView?.CustomEvent;
      if(EventClass)this.root.dispatchEvent(new EventClass('debate-audio',{detail:{cue,result:e.kind==='debateResolved'?e.resource:undefined,muted:this.settings.muted,volume:this.settings.sfx/100}}));
      const url=AUDIO_ASSETS[cue];if(url&&!this.settings.muted){const audio=new Audio(url);audio.volume=this.settings.sfx/100;void audio.play().catch(()=>{});}}
  }
}
export function eventText(e:DebateEvent):string{
  const labels:Record<string,string>={focus:'집중',food:'군량',reports:'정보',credentials:'신용',profit:'이익',safety:'안전',honor:'명분',authority:'권한',trust:'신뢰',burden:'부담',agreement:'합의'};
  if(e.kind==='actionUsed')return (ARGUMENTS[e.reason as keyof typeof ARGUMENTS]?.name ?? DEBATE_ACTIONS[e.reason as keyof typeof DEBATE_ACTIONS]?.name ?? '협상 중단')+' 선택';
  if(e.kind==='opponentCountered')return `${e.reason} · 요구 +${e.value}`;
  if(e.kind==='debateResolved')return ({success:'합의 성립',partial:'부분 합의',failure:'결렬'}[e.resource as 'success']??'결과')+' · '+e.reason;
  return `${e.reason}${e.value?` · ${labels[e.resource]??e.resource} ${e.value>0?'+':''}${e.value}`:''}`;
}
export function sceneSettingsHtml(settings:SceneSettings):string{
  return `<details class="scene-settings"><summary>연출·접근성 설정</summary><div class="settings-grid">${(['reduced','shake','lowPower','muted','particles','highContrast','autoDialogue'] as const).map((key,i)=>`<label><input type="checkbox" data-scene-setting="${key}" ${settings[key]?'checked':''}> ${['연출 감소','화면 흔들림','저사양 모드','효과음 음소거','먼지 입자','높은 대비','대사 자동 진행'][i]}</label>`).join('')}<label>속도 <select data-scene-setting="speed">${(['normal','fast','instant'] as const).map((v,i)=>`<option value="${v}" ${settings.speed===v?'selected':''}>${['보통','빠르게','즉시'][i]}</option>`).join('')}</select></label><label>효과음 <input type="range" min="0" max="100" value="${settings.sfx}" data-scene-setting="sfx"></label><label>음악 <input type="range" min="0" max="100" value="${settings.music}" data-scene-setting="music"></label><label>글자 크기 <input type="range" min="100" max="150" value="${settings.textSize}" data-scene-setting="textSize"></label></div><p class="tiny">현재 음원 미탑재 · 시각 정보만으로 진행 가능합니다. 설정은 이 브라우저에 저장됩니다.</p></details><button class="btn small" hidden data-next-debate>다음 발언</button>`;
}
export function attachSceneControls(root:HTMLElement,getState:()=>DebateState|null,playback:DebatePlayback):void{
  let selectedId:string|null=null,suppressPreview=false,selectionKey='';
  function closeDetail():void{
    const detail=root.querySelector<HTMLElement>('[data-argument-detail]');if(detail){detail.hidden=true;detail.removeAttribute('aria-modal');}
    const selected=root.querySelector<HTMLElement>('[data-debate-select].selected');selected?.classList.remove('selected');selected?.setAttribute('aria-pressed','false');
    root.querySelectorAll('.preview-target').forEach(e=>e.classList.remove('preview-target'));
    if(selectedId){const card=root.querySelector<HTMLElement>(`[data-debate-select="${selectedId}"]`);suppressPreview=true;card?.focus();suppressPreview=false;}selectedId=null;
  }
  function preview(card:HTMLElement,selected=false):void{
    const s=getState();if(!s||suppressPreview)return;const id=card.dataset.debateSelect!;
    const key=`${s.rng}:${s.generalId}:${s.opponentId}:${s.round}`;if(key!==selectionKey){selectedId=null;selectionKey=key;}
    if(!selected&&selectedId&&selectedId!==id)return;
    const definition=s.negotiation?ARGUMENTS[id as keyof typeof ARGUMENTS]:DEBATE_ACTIONS[id as keyof typeof DEBATE_ACTIONS];
    const el=root.querySelector<HTMLElement>('[data-argument-detail]');if(!el)return;el.hidden=false;
    if(selected){selectedId=id;el.setAttribute('aria-modal','true');}
    if(selected)root.querySelectorAll<HTMLElement>('[data-debate-select]').forEach(c=>{c.classList.toggle('selected',c===card);c.setAttribute('aria-pressed',String(c===card));});
    el.innerHTML=`<h3>${esc(definition.name)}</h3><p>${esc(definition.text)}</p>${argumentPreview(s,id)}<p class="preview-source">효과 출처: 현재 설전 규칙 · 대표 적성/특성 · 공개된 반론 포함</p><div class="detail-controls">${card.getAttribute('aria-disabled')==='true'?'':activityButton('debate-action',definition.name+' 실행',{choice:id,round:s.round})}<button class="btn ghost" data-close-argument>취소 · 닫기</button></div>`;
    if(selected)el.focus();
    const pv=previewDebateActionForForecast(s,id);
    for(const r of requirements(s)){const next=requirements(pv).find(v=>v.key===r.key);const forecast=root.querySelector<HTMLElement>(`[data-forecast="${r.key}"]`);if(forecast){forecast.textContent=next?`예상 ${r.value} → ${next.value}${r.needed!==next.needed?' · 요구 '+next.needed:''}`:'';forecast.closest('.requirement')?.classList.toggle('preview-target',Boolean(next&&(next.value!==r.value||next.needed!==r.needed)));}}
  }
  root.addEventListener('click',e=>{const card=(e.target as HTMLElement).closest<HTMLElement>('[data-debate-select]');if(card){preview(card,true);return;}
    if((e.target as HTMLElement).closest('[data-close-argument]'))closeDetail();
    if((e.target as HTMLElement).closest('[data-next-debate]'))playback.advance();
    if((e.target as HTMLElement).closest('[data-skip-debate]'))playback.cancel();});
  root.addEventListener('focusin',e=>{const card=(e.target as HTMLElement).closest<HTMLElement>('[data-debate-select]');if(card)preview(card);});
  root.addEventListener('mouseover',e=>{const card=(e.target as HTMLElement).closest<HTMLElement>('[data-debate-select]');if(card&&!root.querySelector('[data-debate-select].selected'))preview(card);});
  root.addEventListener('keydown',e=>{const detail=root.querySelector<HTMLElement>('[data-argument-detail]');
    if(e.key==='Escape'&&detail&&!detail.hidden){e.preventDefault();e.stopPropagation();closeDetail();return;}
    if(e.key==='Tab'&&detail&&!detail.hidden&&detail.getAttribute('aria-modal')==='true'){const focusable=Array.from(detail.querySelectorAll<HTMLElement>('button:not(:disabled),[tabindex="0"]'));if(focusable.length){const first=focusable[0],last=focusable[focusable.length-1];if(e.shiftKey&&(root.ownerDocument.activeElement===first||root.ownerDocument.activeElement===detail)){e.preventDefault();last.focus();}else if(!e.shiftKey&&root.ownerDocument.activeElement===last){e.preventDefault();first.focus();}}return;}
    const card=(e.target as HTMLElement).closest<HTMLElement>('[data-debate-select]');if(!card||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
    e.preventDefault();const cards=Array.from(root.querySelectorAll<HTMLElement>('[data-debate-select]'));const index=cards.indexOf(card);const next=e.key==='Home'?0:e.key==='End'?cards.length-1:(index+(e.key==='ArrowRight'?1:-1)+cards.length)%cards.length;cards[next].focus();});
  root.addEventListener('change',e=>{const el=e.target as HTMLInputElement;const key=el.dataset.sceneSetting as keyof SceneSettings|undefined;if(!key)return;
    if(['reduced','shake','lowPower','muted','particles','highContrast','autoDialogue'].includes(key))(playback.settings as unknown as Record<string,unknown>)[key]=el.checked;
    else if(key==='speed'&&['normal','fast','instant'].includes(el.value))playback.settings.speed=el.value as SceneSettings['speed'];
    else if(key==='sfx'||key==='music')playback.settings[key]=Math.max(0,Math.min(100,Number(el.value)));
    else if(key==='textSize')playback.settings.textSize=Math.max(100,Math.min(150,Number(el.value)));
    try{root.ownerDocument.defaultView?.localStorage.setItem(SETTINGS_KEY,JSON.stringify(playback.settings));}catch{/* optional */}
    playback.cancel();playback.applySettings();});
  root.addEventListener('load',e=>{
    const image=e.target as HTMLImageElement;if(!image.matches?.('[data-portrait]'))return;
    const person=image.closest<HTMLElement>('[data-person]');if(!person)return;image.parentElement?.setAttribute('data-ready','true');
    if(image.dataset.layer==='back'&&image.dataset.requested===image.getAttribute('src')){
      const front=person.querySelector<HTMLImageElement>('[data-layer="front"]');
      image.classList.remove('is-fading');image.classList.add('is-visible');image.dataset.layer='front';delete image.dataset.requested;
      if(front){front.classList.add('is-fading');front.classList.remove('is-visible');front.dataset.layer='back';}
    }
    if(person.dataset.warmed)return;person.dataset.warmed='true';
    const art=characterArt(person.dataset.person??'');
    const win=root.ownerDocument.defaultView;
    if(win&&!playback.settings.lowPower)win.setTimeout(()=>{if(!person.isConnected)return;for(const pose of ['speak','press','countered','concede'] as const){const preload=new win.Image();preload.decoding='async';preload.src=art.poses[pose]??art.fallback;}},0);
  },true);
  root.addEventListener('error',e=>{const image=e.target as HTMLImageElement;if(image.matches?.('[data-scene-background]')){image.hidden=true;return;}
    if(!image.matches?.('[data-portrait]'))return;
    if(image.dataset.fallback&&image.getAttribute('src')!==image.dataset.fallback)image.src=image.dataset.fallback;
    else{image.hidden=true;const fallback=image.parentElement?.querySelector<HTMLElement>('.portrait-fallback');if(fallback)fallback.hidden=false;}
  },true);
}
import { previewDebateAction as previewDebateActionForForecastRaw } from '../core/debate.ts';
function previewDebateActionForForecast(s:DebateState,id:string):DebateState{return previewDebateActionForForecastRaw(s,id).state;}
