import {GENERALS} from './generals.ts';
export interface BattleArt {
 portrait:string|null; portraitBattle:string|null; portraitCutIn:string|null; banner:string;
 factionPalette:string; formationIcon:string; poses:Record<'idle'|'command'|'attack'|'guard'|'counter'|'damaged',string|null>;
 signatureEffect:string; anchor:[number,number]; mobileCrop:string; quality:'generated'|'banner';
}
const PORTRAITS:Record<string,string>={guojia:'/assets/debate/portraits/guojia/neutral.webp',dianwei:'/assets/battle/dianwei-v1.png'};
export const BATTLE_SCENERY:Partial<Record<string,string>>={plains:'/assets/battle/plains-v1.png'};
// Only names that explicitly define equipment get that representation. Other troops stay generic.
export const ENEMY_PRESENTATION:Record<string,{equipment:'generic'|'bow'|'crossbow'}>={archer:{equipment:'bow'},xbow:{equipment:'crossbow'}};
export const BATTLE_PRESENTATION:Record<string,BattleArt>=Object.fromEntries(Object.values(GENERALS).map(g=>{
 const image=PORTRAITS[g.id]??null;
 return [g.id,{portrait:image,portraitBattle:image,portraitCutIn:image,banner:g.name,factionPalette:'#698a94',formationIcon:'군진',poses:{idle:image,command:image,attack:image,guard:image,counter:image,damaged:image},signatureEffect:g.affinity,anchor:[50,82],mobileCrop:'50% 24%',quality:image?'generated':'banner'}];
}));
export const BATTLE_AUDIO:Partial<Record<string,string>>={}; // Licensed recordings may be connected later.
export function battleArt(id:string):BattleArt{return BATTLE_PRESENTATION[id]??{portrait:null,portraitBattle:null,portraitCutIn:null,banner:'군진',factionPalette:'#698a94',formationIcon:'군진',poses:{idle:null,command:null,attack:null,guard:null,counter:null,damaged:null},signatureEffect:'none',anchor:[50,82],mobileCrop:'50% 24%',quality:'banner'};}
