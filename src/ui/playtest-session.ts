/**
 * 플레이테스트 세션(화면 쪽): 명령 경계 기록, 화면 열람 기록, 관찰자 메모, 설문, 내보내기.
 * 모든 기록은 이 브라우저의 저장소(KV)에만 남는다. 네트워크 호출 없음.
 */
import {probe,recordAction,recordUi,recordObserver,setSurvey,newPlaytestLog,loadPlaytestLog,savePlaytestLog,summarizeLog,prepSummary,CORE_SURVEY,DETAIL_SURVEY,OBSERVER_TAGS,PLAYTEST_PRESET,PLAYTEST_LOG_KEY,type PlaytestLog} from '../core/playtest.ts';
import {esc} from './html.ts';
import {PLAYTEST_ROUTES} from '../data/playtest.ts';
import type {RunState} from '../core/types.ts';
import type {KV} from '../core/save.ts';
export class PlaytestSession {
 log:PlaytestLog|null=null;active=false;routeShown=false;private kv:KV;exportNote='';
 constructor(kv:KV){this.kv=kv;}
 hasLog(){return !!loadPlaytestLog(this.kv);}
 start(){this.log=newPlaytestLog();this.active=true;this.routeShown=false;this.save();}
 resume(){const l=loadPlaytestLog(this.kv)??newPlaytestLog();l.sessions++;this.log=l;this.active=true;this.routeShown=false;this.save();}
 /** 저장 없이 설문·내보내기만 다루고 싶을 때(제목 화면에서). */
 attach(){this.log=loadPlaytestLog(this.kv);return !!this.log;}
 stop(){this.active=false;}
 save(){if(this.log)savePlaytestLog(this.kv,this.log);}
 /** 행동 하나를 감싼다: 전후 투영을 비교해 기록. 규칙 함수의 결과는 그대로 돌려준다. */
 wrap<T>(run:RunState,label:string,fn:()=>T):T{if(!this.active||!this.log)return fn();const before=probe(run);const res=fn();const rr=res as unknown as {ok?:boolean;reason?:string}|null|undefined;const ok=!(rr&&typeof rr==='object'&&'ok' in rr&&!rr.ok);if(ok){const after=probe(run);recordAction(this.log,before,after,label,run);this.save();}else{this.log.entries.push({n:this.log.actions,tick:before.tick,at:Date.now(),kind:'거부',cat:'거부',text:`${label} · ${rr?.reason??''}`});this.save();}return res;}
 ui(run:RunState|null,kind:string,text:string,data?:Record<string,unknown>){if(!this.active||!this.log||!run)return;recordUi(this.log,run,kind,text,data);this.save();}
 observer(run:RunState|null,tag:string,text:string){if(!this.log)return;recordObserver(this.log,run??({} as RunState),tag,text);this.save();}
 survey(id:string,score:number,note:string){if(!this.log)return {ok:false,reason:'기록이 없습니다.'};const r=setSurvey(this.log,id,score,note);if(r.ok)this.save();return r;}
 openRoute(run:RunState|null){this.routeShown=true;this.ui(run,'추천 경로 열람','추천 경로를 열었다');}
 json(run:RunState|null){return JSON.stringify({kind:'cheonha-gunjin-playtest-log',note:'로컬 전용 · 외부 전송 없음 · 개인 정보 없음',exportedAt:new Date().toISOString(),log:this.log,summary:this.log?summarizeLog(this.log,run):''},null,1);}
 summary(run:RunState|null){return this.log?summarizeLog(this.log,run):'';}
 /** 준비 시간·준비력 내역: 최근 5건, 총 사용량, 항목별 합계(접힌 상세). */
 prepPanel():string{const log=this.log;if(!log)return '';const ps=prepSummary(log);
  return `<details class="pt-prep" data-log="준비 내역 열람"><summary>준비 소비 내역 · 시간 ${ps.totalTime} · 준비력 ${ps.totalPower}</summary><p>최근 5건</p><ul>${ps.recent.map(x=>`<li>[행동 ${x.n} · ${x.tick}시] ${esc(x.cat)} · 시간 ${x.time} · 준비력 ${x.power} <small>${esc(x.text.split(' · ').slice(1).join(' · '))}</small></li>`).join('')||'<li>아직 없음</li>'}</ul><p>항목별 합계</p><ul>${ps.byCat.map(c=>`<li>${esc(c.cat)} · 시간 ${c.time} · 준비력 ${c.power} · ${c.count}건</li>`).join('')||'<li>아직 없음</li>'}</ul></details>`;}
 /** 추천 경로: 기본 비공개. 여는 순간 기록된다. */
 routePanel():string{if(!this.log)return '';if(!this.routeShown)return `<section class="pt-route"><p>추천 경로는 기본으로 닫혀 있습니다. 막혔을 때만 여세요(여는 시점이 기록됩니다).</p><button type="button" class="btn" data-pt-route>추천 경로 열기 · 기록됨</button></section>`;
  return `<section class="pt-route open"><p>추천 경로(열람 기록: ${this.log.routeOpened.map(n=>'행동 '+n).join(', ')})</p>${PLAYTEST_ROUTES.map(rt=>`<details><summary>${esc(rt.name)}</summary><ol>${rt.steps.map(x=>`<li>${esc(x)}</li>`).join('')}</ol></details>`).join('')}</section>`;}
 /** 패널: 설문(핵심 8 + 상세 펼침), 관찰자 메모, 내보내기. 거병 준비 패널·제목 화면·거병 결과에서 같이 쓴다. */
 panel(run:RunState|null,opts:{compact?:boolean}={}):string{const log=this.log;if(!log)return '';const sv=log.survey;const ps=prepSummary(log);
  const q=(qq:{id:string;text:string})=>`<div class="pt-q"><p>${esc(qq.text)}</p><div class="pt-scale" role="group" aria-label="${esc(qq.text)}">${[1,2,3,4,5].map(n=>`<button type="button" data-pt-survey="${qq.id}" data-score="${n}" aria-pressed="${sv[qq.id]?.score===n}">${n}</button>`).join('')}</div><input type="text" data-pt-note="${qq.id}" value="${esc(sv[qq.id]?.note??'')}" placeholder="짧은 의견(선택)" maxlength="300"></div>`;
  const answered=CORE_SURVEY.filter(x=>sv[x.id]).length;
  return `<section class="pt-panel" aria-label="플레이테스트">
  <h3>${esc(PLAYTEST_PRESET.name)}</h3><p class="pt-meta">세션 ${log.sessions} · 행동 ${log.actions} · 기록 ${log.entries.length}건 · 준비 시간 ${ps.totalTime} · 이 브라우저에만 저장(외부 전송 없음)</p>
  ${opts.compact?'':`<details class="pt-survey" open><summary>플레이 후 설문 (${answered}/${CORE_SURVEY.length}) · 1 전혀 아니다 ~ 5 매우 그렇다</summary>${CORE_SURVEY.map(q).join('')}<details class="pt-detail"><summary>추가 상세 문항 (${DETAIL_SURVEY.filter(x=>sv[x.id]).length}/${DETAIL_SURVEY.length})</summary>${DETAIL_SURVEY.map(q).join('')}</details></details>`}
  <details class="pt-observer"><summary>관찰자 기록 (${log.observer.length})</summary><p>플레이어가 아니라 지켜보는 사람이 적습니다. 태그를 누르면 행동 번호·캠페인 시간과 함께 기록됩니다.</p><div class="pt-tags">${OBSERVER_TAGS.map(t=>`<button type="button" data-pt-observer="${esc(t)}">${esc(t)}</button>`).join('')}</div><div class="pt-note-row"><input type="text" data-pt-observer-text placeholder="메모(선택, 태그와 함께 저장)" maxlength="300"><button type="button" class="btn" data-pt-observer="메모">메모만 저장</button></div>${log.observer.slice(-5).reverse().map(o=>`<p class="pt-obs">[행동 ${o.n} · ${o.tick}시] ${esc(o.tag)}${o.text?' · '+esc(o.text):''}</p>`).join('')}</details>
  <div class="pt-export"><button type="button" class="btn" data-pt-export="json">로그 JSON 내보내기</button><button type="button" class="btn" data-pt-export="summary">읽을 수 있는 요약 내보내기</button><button type="button" class="btn" data-pt-export="copy">요약 복사</button>${this.exportNote?`<small>${esc(this.exportNote)}</small>`:''}</div>
  <details class="pt-raw"><summary>요약 미리보기</summary><textarea readonly data-pt-summary rows="12">${esc(this.summary(run))}</textarea></details>
  </section>`;}
 /** 클릭·입력 처리. 처리했으면 true. */
 handle(target:Element,run:RunState|null,doc:Document):boolean{
  const s=target.closest<HTMLElement>('[data-pt-survey]');if(s){const id=s.dataset.ptSurvey!,score=Number(s.dataset.score);const note=doc.querySelector<HTMLInputElement>(`[data-pt-note="${id}"]`)?.value??this.log?.survey[id]?.note??'';this.survey(id,score,note);return true;}
  const o=target.closest<HTMLElement>('[data-pt-observer]');if(o){const input=doc.querySelector<HTMLInputElement>('[data-pt-observer-text]');const text=input?.value??'';if(o.dataset.ptObserver==='메모'&&!text.trim())return true;this.observer(run,o.dataset.ptObserver!,text.trim());if(input)input.value='';return true;}
  const ex=target.closest<HTMLElement>('[data-pt-export]');if(ex){this.export(ex.dataset.ptExport!,run,doc);return true;}
  if(target.closest('[data-pt-route]')){this.openRoute(run);return true;}
  return false;}
 /** 설문 의견 입력은 change 때 저장(점수가 이미 있을 때). */
 handleChange(el:Element):boolean{const inp=el as HTMLInputElement;if(!inp.matches?.('[data-pt-note]'))return false;const id=inp.dataset.ptNote!;const cur=this.log?.survey[id];if(cur){this.survey(id,cur.score,inp.value);}return true;}
 export(kind:string,run:RunState|null,doc:Document){const view=doc.defaultView;const stamp=new Date().toISOString().slice(0,16).replace(/[:T]/g,'-');
  const text=kind==='json'?this.json(run):this.summary(run);const name=kind==='json'?`cheonha-playtest-${stamp}.json`:`cheonha-playtest-${stamp}.md`;
  if(kind==='copy'){const ta=doc.querySelector<HTMLTextAreaElement>('[data-pt-summary]');try{if(view?.navigator?.clipboard?.writeText){view.navigator.clipboard.writeText(text).then(()=>{this.exportNote='요약을 복사했습니다.';},()=>{this.exportNote='복사가 막혔습니다. 아래 요약 미리보기를 길게 눌러 복사하세요.';});}else{ta?.select();doc.execCommand?.('copy');this.exportNote='요약을 선택했습니다. 복사하세요.';}}catch{this.exportNote='복사가 막혔습니다. 아래 요약 미리보기를 길게 눌러 복사하세요.';}return;}
  try{if(view&&typeof view.URL?.createObjectURL==='function'){const blob=new view.Blob([text],{type:kind==='json'?'application/json':'text/markdown'});const nav=view.navigator as Navigator&{canShare?:(d:unknown)=>boolean;share?:(d:unknown)=>Promise<void>};const file=typeof view.File==='function'?new view.File([blob],name,{type:blob.type}):null;
   if(file&&nav.canShare?.({files:[file]})&&nav.share){nav.share({files:[file],title:name}).catch(()=>{});this.exportNote=`${name} 공유 창을 열었습니다.`;return;}
   const url=view.URL.createObjectURL(blob);const a=doc.createElement('a');a.href=url;a.download=name;doc.body.appendChild(a);a.click();a.remove();view.setTimeout(()=>view.URL.revokeObjectURL(url),1000);this.exportNote=`${name} 저장(다운로드)`;try{view.localStorage?.setItem(PLAYTEST_LOG_KEY+'.last-export',name);}catch{/* 저장 공간 없음 */}return;}
  }catch{/* 아래 대체 */}
  this.exportNote='파일 저장이 막혔습니다. 요약 미리보기에서 복사하세요.';}
}
