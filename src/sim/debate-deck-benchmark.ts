import {newRun,moveTo} from '../core/run.ts';
import {configureDeckDemo} from '../core/debate-deck-demo.ts';
import {beginDebate,actDebate,finishDebate} from '../core/social-run.ts';
import {DEBATE_POLICIES,deckPolicyAction,deckRewardPolicy} from './debate-deck-policy.ts';
import {DEBATE_CARDS} from '../data/debate-cards.ts';
import {ensureRepresentative} from '../core/debate-deck.ts';
import type {DebatePolicy} from './debate-deck-policy.ts';
import type {RunState} from '../core/types.ts';
export function benchmarkDecks(samples=12){
 const records:{general:string;policy:DebatePolicy;seed:number;agreements:number;partial:number;encounters:number;rounds:number;plays:number;repeats:number;deck:number;rewards:number;skips:number;bounded:boolean;choices:Record<string,number>}[]=[];
 for(const general of ['guojia','chengong'])for(const policy of DEBATE_POLICIES)for(let seed=61001;seed<61001+samples;seed++){
  const r=newRun(seed,'caocao');configureDeckDemo(r,general);ensureRepresentative(r.debateBuild,general);r.debateBuild.assistant=policy==='stable'?'caoren':'dianwei';r.debateBuild.seals=policy==='chain'?['chain','illusion']:policy==='stable'?['forum','yield']:['forum','reply'];
  moveTo(r,0);const rng={rng:seed};const choices:Record<string,number>={};let agreements=0,partial=0,rounds=0,plays=0,repeats=0,last='';let bounded=true;let rewards=0,skips=0;
  for(let encounter=0;encounter<3;encounter++){
   if(encounter){r.floor=encounter;r.col=0;r.screen='node';r.pending=encounter===1?{kind:'parley',mode:'supply'}:{kind:'parley',mode:'recruit',candidate:'luxun'};}
   if(!beginDebate(r,general,encounter===0?'sponsorship':undefined,encounter===2).ok)throw new Error('benchmark entrance');
   if(r.pending.kind!=='debate')throw new Error('missing debate');const s=r.pending.state;let actions=0;
   while(s.result==='ongoing'&&actions++<90){const action=deckPolicyAction(s,policy,rng);const id=action.startsWith('card:')?s.deck!.cards.find(c=>c.uid===Number(action.slice(5)))!.id:null;if(id){choices[id]=(choices[id]??0)+1;plays++;if(last===id)repeats++;last=id;}if(!actDebate(r,action,s.deck!.revision).ok)throw new Error('invalid policy');}
   bounded&&=actions<90;agreements+=Number(s.result==='success');partial+=Number(s.result==='partial');rounds+=Math.min(s.maxRounds,s.round+1);finishDebate(r);
   if((r as RunState).pending.kind==='debateReward'){rewards++;deckRewardPolicy(r,policy);skips+=Number(r.history.at(-1)?.includes('설전 성장: skip'));}
  }
  records.push({general,policy,seed,agreements,partial,encounters:3,rounds,plays,repeats,deck:r.debateBuild.cards.length,rewards,skips,bounded,choices});
 }
 const summary=(general:string,policy:DebatePolicy)=>{const subset=records.filter(r=>r.general===general&&r.policy===policy);const sum=(key:'agreements'|'partial'|'encounters'|'rounds'|'plays'|'repeats'|'deck'|'rewards'|'skips')=>subset.reduce((n,r)=>n+r[key],0);const choices:Record<string,number>={};for(const r of subset)for(const [id,count] of Object.entries(r.choices))choices[id]=(choices[id]??0)+count;return {general,policy,runs:subset.length,encounters:sum('encounters'),fullAgreement:sum('agreements'),conditional:sum('partial'),averageDeck:sum('deck')/subset.length,averageRounds:sum('rounds')/sum('encounters'),repeatRatio:sum('repeats')/Math.max(1,sum('plays')),rewardSkips:sum('skips'),bounded:subset.every(r=>r.bounded),cardSelections:choices};};
 return {samplesPerPolicy:samples,scope:'Three actual debate entrances per run, generated maps compressed for simulation; not full combat expedition or user fun.',summary:['guojia','chengong'].flatMap(g=>DEBATE_POLICIES.map(p=>summary(g,p))),unusedCards:Object.keys(DEBATE_CARDS).filter(id=>records.every(r=>!r.choices[id])),records};
}
if(process.argv[1]?.endsWith('debate-deck-benchmark.ts'))console.log(JSON.stringify(benchmarkDecks(Number(process.argv[2]??12)),null,2));
