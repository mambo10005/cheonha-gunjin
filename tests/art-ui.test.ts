import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {JSDOM} from 'jsdom';
import {ART_ASSETS} from '../src/data/art-assets.ts';
// 곡물 창고 그림의 final/fallback 선택과 개발 모드 전용 표시를 공개 DOM으로 확인한다. 실제 이미지 로딩·브라우저 렌더링은 확인하지 않는다.
async function warehouse(define:Record<string,string>){
 const built=await build({logLevel:'silent',define,build:{write:false}}),out=Array.isArray(built)?built[0]:built;assert.ok('output' in out);const js=out.output.find(x=>x.type==='chunk');assert.ok(js&&js.type==='chunk');const errors:string[]=[];
 const dom=new JSDOM('<main id="app"></main>',{url:'http://localhost/',runScripts:'outside-only',beforeParse(w){w.structuredClone=structuredClone;w.matchMedia=(()=>({matches:true})) as unknown as typeof w.matchMedia;w.addEventListener('error',e=>errors.push(String(e.error)));}});dom.window.eval(js.code);const doc=dom.window.document;
 const click=(s:string)=>{const b=doc.querySelector<HTMLButtonElement>(s);assert.ok(b,s);b.click();assert.deepEqual(errors,[]);};const act=(a:string)=>click(`[data-explore-action="${a}"]`);
 const change=(s:string,v:string)=>{const el=doc.querySelector<HTMLInputElement|HTMLSelectElement>(s)!;el.value=v;el.dispatchEvent(new dom.window.Event('change',{bubbles:true}));};
 click('[data-a="world-new"]');change('[data-world-seed]','141001');click('[data-campaign-choice="founder"][data-value="chengong"]');change('[data-raising-origin]','notable');click('[data-world="start"]');act('enter');
 act('leave');for(const id of ['market','store']){click(`[data-city-location="${id}"]`);act('move:'+id);}act('enter');
 return {dom,doc};
}
test('without final files the granary uses the fallback SVGs, and the production screen carries no temporary-asset label',{timeout:180000},async()=>{
 const {dom,doc}=await warehouse({__FINAL_ASSETS__:'[]'});
 try{
  const scene=doc.querySelector<HTMLImageElement>('img[data-art="granary.yard"]')!;assert.ok(scene);assert.equal(scene.getAttribute('src'),ART_ASSETS['granary.yard'].fallback);assert.equal(scene.dataset.artStatus,'fallback');
  const keeper=doc.querySelector<HTMLImageElement>('img[data-art="granary-keeper.portrait"]')!;assert.equal(keeper.getAttribute('src'),ART_ASSETS['granary-keeper.portrait'].fallback);
  assert.equal(doc.querySelector('.art-dev-badge'),null);assert.doesNotMatch(doc.body.textContent!,/임시 에셋/);
 }finally{dom.window.close();}
});
test('a final raster file listed by the build replaces the fallback with no code change',{timeout:180000},async()=>{
 const {dom,doc}=await warehouse({__FINAL_ASSETS__:JSON.stringify([ART_ASSETS['granary.yard'].final,ART_ASSETS['granary-keeper.portrait'].final])});
 try{
  const scene=doc.querySelector<HTMLImageElement>('img[data-art="granary.yard"]')!;assert.equal(scene.getAttribute('src'),ART_ASSETS['granary.yard'].final);assert.equal(scene.dataset.artStatus,'final');assert.equal(scene.dataset.fallback,ART_ASSETS['granary.yard'].fallback);
  assert.equal(doc.querySelector<HTMLImageElement>('img[data-art="granary-keeper.portrait"]')!.getAttribute('src'),ART_ASSETS['granary-keeper.portrait'].final);
  doc.querySelector<HTMLButtonElement>('[data-explore-action="scene:zone:office"]')!.click();assert.equal(doc.querySelector<HTMLImageElement>('img[data-art="granary.office"]')!.getAttribute('src'),ART_ASSETS['granary.office'].fallback,'구역별로 따로 판단');
 }finally{dom.window.close();}
});
test('development mode marks fallback art with a temporary-asset label',{timeout:180000},async()=>{
 const {dom,doc}=await warehouse({__FINAL_ASSETS__:'[]','import.meta.env.DEV':'true'});
 try{assert.ok(doc.querySelector('img[data-art="granary.yard"]+.art-dev-badge'));assert.match(doc.querySelector('.location-scene-visual')!.textContent!,/임시 에셋/);}finally{dom.window.close();}
});
