import {build} from 'vite';
import {JSDOM} from 'jsdom';
import {writeFileSync,mkdirSync} from 'node:fs';
import {newRun} from '../src/core/run.ts';
import {configureDeckDemo} from '../src/core/debate-deck-demo.ts';
import {chooseDoctrine} from '../src/core/build.ts';
import {saveRun} from '../src/core/save.ts';
const b=await build({logLevel:'silent',build:{write:false}}),out=Array.isArray(b)?b[0]:b;
if(!('output' in out))throw Error('missing bundle');
const js=out.output.find(o=>o.type==='chunk');if(!js||js.type!=='chunk')throw Error('missing JS');
const css=out.output.filter(o=>o.type==='asset'&&o.fileName.endsWith('.css')).map(o=>o.type==='asset'?o.source:'').join('\n');
const dir='public/verification/strategic-map';mkdirSync(dir,{recursive:true});
const names=['start','selected','current','whole-map','boss','partial','obligation','high-contrast','reduced-motion','records','mobile-selected'];
for(const name of names){
 const r=newRun(61001,'caocao');configureDeckDemo(r);chooseDoctrine(r,'scheme');
 if(['current','obligation'].includes(name)){r.floor=0;r.col=0;r.mapTrail=[{floor:0,col:0}];}
 if(name==='obligation'){r.social.accords.nextUid=2;r.social.accords.agreements=[{uid:1,clause:'escort',faction:'villages',target:{floor:5,col:0},supply:{floor:4,col:0},beneficiary:null,stage:'waiting',status:'active',deposit:0,boosted:true,createdFloor:0}];}
 const d=new JSDOM('<div id="app"></div>',{url:'http://localhost/',runScripts:'outside-only',beforeParse(w){w.structuredClone=structuredClone;w.matchMedia=(()=>({matches:true})) as unknown as typeof w.matchMedia;saveRun(w.localStorage,r);}});
 d.window.eval(js.code);const click=(s:string)=>d.window.document.querySelector<HTMLButtonElement>(s)?.click();click('[data-a="continue"]');
 if(['selected','mobile-selected'].includes(name))click('[data-map-action="select"][data-key="0:0"]');
 if(name==='whole-map')click('[data-map-action="camera"][data-value="all"]');
 if(name==='boss')click('[data-map-action="camera"][data-value="boss"]');
 if(name==='partial')click('[data-map-action="select"][data-key="2:0"]');
 if(name==='obligation'){click('[data-map-action="camera"][data-value="all"]');click('[data-map-action="select"][data-key="4:0"]');}
 if(['high-contrast','reduced-motion'].includes(name)){click('[data-map-action="drawer"][data-value="settings"]');click(name==='high-contrast'?'[data-map-action="contrast"]':'[data-map-action="motion"][data-value="off"]');click('[data-map-action="close"]');}
 if(name==='records')click('[data-map-action="drawer"][data-value="records"]');
 const html=d.window.document.querySelector('#app')!.outerHTML;
 writeFileSync(`${dir}/${name}.html`,`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${name} · DOM fixture / 브라우저 미검증</title><style>${css}</style>${html}<aside style="position:fixed;right:8px;bottom:4px;z-index:100;font-size:12px;background:#000;color:white;padding:2px 6px">정적 DOM 자료 · 준비 상태 주입 · 실제 플레이/시각 통과 자료 아님</aside></html>`);d.window.close();
}
writeFileSync(`${dir}/index.html`,'<!doctype html><html lang="ko"><meta charset="utf-8"><h1>전략 지도 정적 확인 자료</h1><p>실제 번들로 만든 DOM 자료입니다. 현재 위치·협정은 자료 생성용으로 주입했습니다. 브라우저 캡처/실제 플레이 검증 결과가 아닙니다. 화면 크기를 바꾸어 배치를 수동 확인하세요.</p>'+names.map(n=>`<p><a href="${n}.html">${n}</a></p>`).join(''));
console.log('11 compiled DOM fixtures generated; no actual browser used.');
