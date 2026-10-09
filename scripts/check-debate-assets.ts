import {readFileSync,existsSync,statSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {DEBATE_ART,MEETING_PLACES,REQUIRED_ART_POSES,type DebateArt} from '../src/data/debate-art.ts';
export function validateDebateAssets(art:Record<string,DebateArt>=DEBATE_ART,root=resolve(fileURLToPath(new URL('../public',import.meta.url)))):string[]{
  const issues:string[]=[];
  for(const [id,character] of Object.entries(art)){
    if(character.id!==id)issues.push(`${id}: manifest ID mismatch`);
    if(character.quality==='generated')for(const pose of REQUIRED_ART_POSES)if(!character.poses[pose])issues.push(`${id}: missing required pose ${pose}`);
    if(character.width!==512||character.height!==512)issues.push(`${id}: unexpected dimensions`);
    if(!character.crop.desktop||!character.crop.mobile)issues.push(`${id}: crop metadata missing`);
    for(const url of new Set([...Object.values(character.poses),character.fallback,character.placeholder])){
      const file=resolve(root,'.'+url);if(!file.startsWith(root)||!url.startsWith('/assets/debate/')){issues.push(`${id}: unsafe asset path`);continue;}
      if(!existsSync(file)){issues.push(`${id}: missing ${url}`);continue;}
      const data=readFileSync(file);if(data.toString('ascii',0,4)!=='RIFF'||data.toString('ascii',8,12)!=='WEBP')issues.push(`${id}: not WebP ${url}`);
      if(!url.endsWith('/low.webp')&&(data.toString('ascii',12,16)!=='VP8X'||!(data[20]&0x10)))issues.push(`${id}: alpha missing ${url}`);
      if(statSync(file).size>180_000)issues.push(`${id}: portrait budget exceeded ${url}`);
    }
  }
  for(const place of Object.values(MEETING_PLACES)){const file=resolve(root,'.'+place.image);if(!existsSync(file))issues.push(`background missing ${place.image}`);else if(statSync(file).size>250_000)issues.push('background budget exceeded');}
  return issues;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const issues=validateDebateAssets();if(issues.length){console.error(issues.join('\n'));process.exitCode=1;}else console.log('Debate assets: IDs, required poses, WebP alpha, crop metadata, paths and file budgets passed. Rendering/performance unverified.');
}
