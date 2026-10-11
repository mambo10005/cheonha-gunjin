import {build} from 'vite';
import {JSDOM} from 'jsdom';
import {mkdirSync,writeFileSync} from 'node:fs';
import {newRegionalRun,moveTo} from '../src/core/run.ts';
import {configureRegionalDemo} from '../src/core/geography.ts';
import {chooseDoctrine} from '../src/core/build.ts';
import {saveRun} from '../src/core/save.ts';
const bundle=await build({logLevel:'silent',build:{write:false}}),o=Array.isArray(bundle)?bundle[0]:bundle;
if(!('output' in o))throw Error('missing bundle');const js=o.output.find(x=>x.type==='chunk');if(!js||js.type!=='chunk')throw Error('missing JS');
const css=o.output.filter(x=>x.type==='asset'&&x.fileName.endsWith('.css')).map(x=>x.type==='asset'?x.source:'').join('\n');
const directory='public/verification/geography';mkdirSync(directory,{recursive:true});
const cases=['region','overview','all','near','mountain','ford','gate','historical-city','fictional-site','scouting','influence','obligation','mobile','high-contrast','reduced-motion','sources','list'];
for(const name of cases){
 const r=newRegionalRun(81001,'caocao');configureRegionalDemo(r);chooseDoctrine(r,'scheme');
 if(['ford','gate','obligation'].includes(name)){moveTo(r,1);r.pending={kind:'none'};r.screen='map';r.battle=null;r.build.claimed.push('camp:0');}
 if(name==='obligation'){r.map[5][0].type='elite';r.map[5][0].encounterId='el_huaxiong';r.social.accords.nextUid=2;r.social.accords.agreements=[{uid:1,clause:'escort',faction:'villages',target:{floor:5,col:0},supply:{floor:4,col:1},beneficiary:null,stage:'waiting',status:'active',deposit:0,boosted:true,createdFloor:0}];}
 const d=new JSDOM('<main id="app"></main>',{url:'http://localhost/',runScripts:'outside-only',beforeParse(w){w.structuredClone=structuredClone;w.matchMedia=(()=>({matches:true})) as unknown as typeof w.matchMedia;saveRun(w.localStorage,r);}});d.window.eval(js.code);
 const click=(q:string)=>d.window.document.querySelector(q)?.dispatchEvent(new d.window.MouseEvent('click',{bubbles:true}));click('[data-a="continue"]');
 if(name==='overview'||name==='list')click(`[data-geo-action="mode"][data-value="${name}"]`);
 if(['all','influence','scouting','obligation'].includes(name))click('[data-geo-action="focus"][data-value="all"]');
 if(name==='influence')click('[data-geo-action="layer"][data-value="influence"]');
 if(['near','historical-city'].includes(name))click('[data-geo-action="place"][data-id="luoyang"]');
 if(name==='near')for(let i=0;i<3;i++)click('[data-geo-action="zoom"][data-factor="0.8"]');
 if(['mountain','ford','gate','fictional-site','mobile'].includes(name)){const key=name==='ford'?'1:0':name==='gate'?'1:1':name==='mountain'?'0:2':'0:1';click(`[data-map-action="select"][data-key="${key}"]`);}
 if(name==='sources')click('[data-geo-action="source"]');
 if(['high-contrast','reduced-motion'].includes(name)){click('[data-map-action="drawer"][data-value="settings"]');click(name==='high-contrast'?'[data-map-action="contrast"]':'[data-map-action="motion"][data-value="off"]');click('[data-map-action="close"]');}
 await Promise.resolve();const html=d.window.document.querySelector('#app')!.outerHTML;
 writeFileSync(`${directory}/${name}.html`,`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${name} · 정적 DOM / 실제 브라우저 미검증</title><style>${css}${name==='mobile'?'body{max-width:390px;margin:auto}':''}</style>${html}<aside style="position:fixed;bottom:0;right:0;background:#101c20;color:#fff;padding:4px;z-index:100">준비 상태를 주입한 정적 DOM 자료 · 스크린샷/실제 플레이 통과 자료 아님</aside></html>`);d.window.close();
}
writeFileSync(`${directory}/index.html`,`<!doctype html><html lang="ko"><meta charset="utf-8"><title>역사 지역 지도 DOM 자료</title><h1>실제 브라우저 미검증 · 정적 자료</h1><p>상태를 준비해 추출한 DOM이며 조작·렌더링·모바일 픽셀 검증 결과가 아닙니다. 실제 플레이는 게임을 직접 실행하세요.</p>${cases.map(n=>`<p><a href="${n}.html">${n}</a></p>`).join('')}</html>`);
console.log(`${cases.length} static DOM fixtures; no browser or screenshot verification.`);
