import {readdirSync,readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
const folder='public/verification/battle';let count=0;
for(const file of readdirSync(folder).filter(x=>x.endsWith('.html')&&x!=='index.html')){
 const dom=new JSDOM(readFileSync(`${folder}/${file}`,'utf8'));const d=dom.window.document;
 assert.ok(d.querySelector('.battlefield'),file);assert.ok(d.querySelector('.battle-command-dock'),file);assert.ok(d.querySelector('[data-battle-log]'),file);
 assert.ok(d.querySelector('[name="viewport"]'),file);assert.equal(/NaN|undefined|\[object Object\]/.test(d.body.textContent??''),false,file);
 assert.equal(d.querySelectorAll('.army-unit').length>=1,true,file);assert.equal(d.querySelectorAll('.lane-label').length,2,file);
 if(file.includes('missing'))assert.equal(d.querySelectorAll('[data-battle-portrait]').length,0,file);
 if(file.includes('mobile'))assert.ok(d.querySelector('.battle-preview'),file);
 dom.window.close();count++;
}
console.log(`${count} static battle DOM fixtures valid. Pixel layout and browser interactions were not tested.`);
