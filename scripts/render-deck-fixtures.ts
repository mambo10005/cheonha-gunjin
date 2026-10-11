import {writeFileSync,mkdirSync,readFileSync} from 'node:fs';
import {newRun,moveTo} from '../src/core/run.ts';
import {configureDeckDemo} from '../src/core/debate-deck-demo.ts';
import {beginDebate,actDebate,finishDebate} from '../src/core/social-run.ts';
import {socialView} from '../src/ui/social-view.ts';
import {deckActions} from '../src/core/debate-deck.ts';
const dir='public/verification/debate-deck';mkdirSync(dir,{recursive:true});
const css=readFileSync('src/ui/style.css','utf8')+'\n'+readFileSync('src/ui/debate-cinematic.css','utf8');
const names=[];
for(const general of ['guojia','chengong']){
 const r=newRun(61001,'caocao');configureDeckDemo(r,general);moveTo(r,0);beginDebate(r,general,'sponsorship');if(r.pending.kind!=='debate')throw Error();const s=r.pending.state;
 for(const phase of ['start','speech','reward']){
  if(phase==='speech')actDebate(r,deckActions(s)[0],s.deck!.revision);
  if(phase==='reward'){s.negotiation!.scores={profit:20,safety:20,honor:20,authority:20};s.trust=4;actDebate(r,'settle',s.deck!.revision);finishDebate(r);}
  const name=general+'-'+phase;names.push(name);const markup=socialView(r);writeFileSync(dir+'/'+name+'.html',`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${name} · 정적 DOM fixture</title><style>${css}</style><main id="app">${markup}</main></html>`);
 }
}
writeFileSync(dir+'/index.html','<!doctype html><html lang="ko"><meta charset="utf-8"><h1>설전 덱 정적 확인 자료</h1><p>실제 렌더러 HTML. reward 상태 수치는 fixture용으로 명시 주입했으며 사용자 플레이/스크린샷/브라우저 통과 자료가 아닙니다.</p>'+names.map(n=>`<p><a href="${n}.html">${n}</a></p>`).join(''));
console.log('6 static deck UI fixtures generated. Reward setup injected for visual inspection; no browser used.');
