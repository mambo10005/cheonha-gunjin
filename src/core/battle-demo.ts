import {createBattle} from './combat.ts';
import type {RunState} from './types.ts';
/** Deliberate teaching setup; entering 91001 in an ordinary expedition is still an ordinary random run. */
export function configureBattleDemo(run:RunState):void {
 delete run.geography;run.floor=0;run.col=1;run.pending={kind:'none'};run.screen='battle';
 run.generals=[{id:'dianwei',row:'front'},{id:'guojia',row:'rear'}];
 run.deck=['spear','formation','readied','feint','order','spear','formation','feint','readied','order'].map((id,i)=>({id,uid:i+1}));run.nextUid=11;
 run.map[0][1]={...run.map[0][1],type:'battle',terrain:'plains',encounterId:'e_archers'};
 run.battle=createBattle({rng:run.rng,hp:run.hp,maxHp:run.maxHp,food:run.food,deck:run.deck,generals:run.generals,relics:run.relics,lordId:run.lordId,terrain:'plains',encounterId:'e_archers',enemies:['ytsoldier','archer','ytsoldier'],difficulty:0,allyBlessing:false});
 // Keep card identities/piles unique; this demo explicitly teaches a fixed opening hand.
 run.battle.hand=run.deck.slice(0,5).map(x=>({...x}));run.battle.draw=run.deck.slice(5).map(x=>({...x}));
 for(const e of run.battle.enemies)e.intent=e.defId==='archer'?{kind:'attack',row:'rear',dmg:6,hits:1}:{kind:'attack',row:'front',dmg:6,hits:1};
 run.history.push('군진 전투 체험 91001: 고정 첫 손패와 의도. 이후 실제 전투 규칙.');
}
