import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ART_ASSETS,resolveArt,type ArtAssetId} from '../src/data/art-assets.ts';

const file=(p:string)=>'public'+p;
const ids=Object.keys(ART_ASSETS) as ArtAssetId[];

test('art manifest separates final raster paths from development fallback paths',()=>{
 for(const id of ids){const a=ART_ASSETS[id];
  assert.match(a.final,/^\/assets\/runtime\/(locations|characters)\/[a-z-]+\/[a-z-]+\.(webp|png)$/,id);
  assert.match(a.fallback,/^\/assets\/fallback\//,id);
  assert.ok(fs.existsSync(file(a.fallback)),`${id} fallback 파일 존재`);
 }
 assert.equal(new Set(ids.map(id=>ART_ASSETS[id].final)).size,ids.length);
});

test('final art is preferred whenever the file exists; fallback only when it is missing; unknown environments try final first',()=>{
 const keeper=ART_ASSETS['granary-keeper.portrait'];
 assert.deepEqual(resolveArt('granary-keeper.portrait',new Set([keeper.final])),{id:'granary-keeper.portrait',src:keeper.final,fallback:keeper.fallback,status:'final'});
 assert.deepEqual(resolveArt('granary-keeper.portrait',new Set()),{id:'granary-keeper.portrait',src:keeper.fallback,fallback:keeper.fallback,status:'fallback'});
 assert.equal(resolveArt('granary.yard',null).src,ART_ASSETS['granary.yard'].final);
 assert.equal(resolveArt('granary.yard',null).status,'unknown');
 const onlyYard=new Set([ART_ASSETS['granary.yard'].final]);
 assert.equal(resolveArt('granary.yard',onlyYard).status,'final');assert.equal(resolveArt('granary.office',onlyYard).status,'fallback');
});

test('asset status document lists every manifest asset with an allowed status, and the granary set is recorded as fallback while final files are absent',()=>{
 const doc=fs.readFileSync('docs/art/asset-status.md','utf8');
 for(const id of ids){
  const row=doc.split('\n').find(l=>l.includes('`'+id+'`'));assert.ok(row,id+' 문서 행');
  const status=row!.match(/\|\s*(final|generated-candidate|fallback|missing|rejected)\s*\|/)?.[1];assert.ok(status,id+' 상태');
  const finalExists=fs.existsSync(file(ART_ASSETS[id].final));
  if(!finalExists)assert.notEqual(status,'final',id+'는 최종 파일이 없으므로 final로 기록할 수 없다');
 }
});

test('no game code still points at the old granary SVG locations',()=>{
 const src=['src/ui/city-exploration-screen.ts','src/data/inn-presentation.ts'].map(f=>fs.readFileSync(f,'utf8')).join('\n');
 assert.doesNotMatch(src,/warehouse-(manager-v2|yard-v1|office-v1|interior-v1|loading-v1)\.svg/);
});
