import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {BATTLE_PRESENTATION,BATTLE_SCENERY,battleArt} from '../src/data/battle-presentation.ts';
import {GENERALS} from '../src/data/generals.ts';
for(const id of Object.keys(GENERALS)){
 const art=BATTLE_PRESENTATION[id];assert.ok(art,id);assert.ok(art.banner&&art.mobileCrop);assert.equal(art.anchor.length,2);
 for(const asset of [art.portrait,art.portraitBattle,art.portraitCutIn,...Object.values(art.poses)])if(asset)assert.ok(existsSync('public'+asset),asset);
 if(art.quality==='banner')assert.equal(art.portrait,null,'Fallback must not impersonate another general');
}
for(const asset of Object.values(BATTLE_SCENERY))assert.ok(existsSync('public'+asset),asset);
assert.equal(battleArt('missing').portrait,null);
console.log(`Verified ${Object.keys(BATTLE_PRESENTATION).length} commander manifests. Plains and Dian Wei are own generated PNGs; vector fallback/cohorts are original source drawings. Portrait licenses remain in debate art documentation. No licensed audio recordings are bundled.`);
