import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {build} from 'vite';
import {readFileSync} from 'node:fs';
import {loadRun} from '../src/core/save.ts';
import {deckPolicyAction} from '../src/sim/debate-deck-policy.ts';
test('compiled UI: both 61001 entrances -> real hand -> play/reload -> result/reward -> original council', {timeout:60000},async()=>{
 const bundle=await build({logLevel:'silent',define:{'import.meta.env.DEV':'true'},build:{write:false}}),out=Array.isArray(bundle)?bundle[0]:bundle;assert.ok('output' in out);const chunk=out.output.find(c=>c.type==='chunk');assert.ok(chunk&&chunk.type==='chunk');
 const html=readFileSync('index.html','utf8').replace(/<script[^>]+src="\/src\/ui\/main.ts"[^>]*><\/script>/,'');
 const app=(saved?:string)=>{const dom=new JSDOM(html,{url:'http://localhost/?dev=1',runScripts:'outside-only',beforeParse(w){w.structuredClone=structuredClone;w.matchMedia=(()=>({matches:true,addEventListener(){},removeEventListener(){}})) as unknown as typeof w.matchMedia;if(saved)w.localStorage.setItem('cheonha-gunjin.run',saved);}});dom.window.eval(chunk.code);return dom;};
 for(const general of ['guojia','chengong']){
  let dom=app();const click=(selector:string)=>{if(selector.includes('data-a="move"')){const col=selector.match(/data-col="(\d+)"/)?.[1];const loaded=loadRun(dom.window.localStorage);if(loaded.ok)dom.window.document.querySelector<HTMLButtonElement>(`[data-map-action="select"][data-key="${loaded.data.floor+1}:${col}"]`)?.click();}const e=dom.window.document.querySelector<HTMLButtonElement>(selector);assert.ok(e,selector);assert.equal(e.disabled,false);e.click();};
  try{
   click('[data-a="to-lords"]');click(`[data-a="deck-debate-demo"][data-id="${general}"]`);click('[data-a="doctrine"][data-id="scheme"]');click('[data-a="move"][data-col="0"]');dom.window.document.querySelector<HTMLSelectElement>('#social-general')!.value=general;click('[data-kind="begin-debate"][data-choice="sponsorship"]');
   const first=dom.window.document.querySelector<HTMLButtonElement>('[data-debate-select][aria-disabled="false"]')!;assert.ok(first);const choice=first.dataset.debateSelect!;first.click();click(`[data-kind="debate-action"][data-choice="${choice}"]`);
   const before=loadRun(dom.window.localStorage);assert.ok(before.ok);assert.equal(before.data.pending.kind,'debate');const saved=dom.window.localStorage.getItem('cheonha-gunjin.run')!;dom.window.close();dom=app(saved);click('[data-a="continue"]');assert.deepEqual(loadRun(dom.window.localStorage),before);
   let i=0;
   while(i++<70){const loaded=loadRun(dom.window.localStorage);assert.ok(loaded.ok);if(loaded.data.pending.kind!=='debate'||loaded.data.pending.state.result!=='ongoing')break;const action=deckPolicyAction(loaded.data.pending.state);if(action.startsWith('card:'))click(`[data-debate-select="${action}"]`);click(`[data-kind="debate-action"][data-choice="${action}"]`);}
   assert.ok(i<70);click('[data-kind="finish-debate"]');const after=loadRun(dom.window.localStorage);assert.ok(after.ok);if(after.data.pending.kind==='debateReward')click('[data-kind="deck-reward"][data-choice="skip"]');assert.ok(dom.window.document.querySelector('[data-kind="sign-agreement"]'));
  }finally{dom.window.close();}
 }
});
