// Compile and inspect selected DOM fixtures without starting or driving a browser.
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const names=['region','overview','all','near','mountain','ford','gate','historical-city','fictional-site','scouting','influence','obligation','mobile','high-contrast','reduced-motion','sources','list'];
for(const name of names){const d=new JSDOM(readFileSync(`public/verification/geography/${name}.html`,'utf8'));
 if(!d.window.document.querySelector('.expedition-map'))throw Error(`${name}: missing regional map`);
 if(name==='obligation'&&!d.window.document.body.textContent?.includes('의무'))throw Error('missing obligation fixture');
 if(name==='list'&&d.window.document.querySelectorAll('.geo-list button').length!==22)throw Error('invalid list fixture');
 if(name==='historical-city'&&!d.window.document.querySelector('.geo-detail'))throw Error('missing historical source panel');
 if([...d.window.document.querySelectorAll('[x],[y],[width],[height]')].some(e=>['x','y','width','height'].some(a=>e.getAttribute(a)?.includes('NaN'))))throw Error(`${name}: invalid SVG coordinate`);
 d.window.close();
}console.log('17 static DOM fixtures valid; not real browser or pixel verification.');
