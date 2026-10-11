/**
 * 미술 에셋 목록(manifest). 각 에셋은 최종(final) 래스터 경로와 개발용 임시(fallback) 경로를 따로 가진다.
 * - final: public/assets/runtime/... 에 놓이는 손그림 원화(WebP/PNG). 파일이 있으면 항상 이것을 쓴다.
 * - fallback: public/assets/fallback/... 의 개발용 임시 그림(코드로 그린 SVG). final 파일이 없을 때만 쓴다.
 * final 파일을 같은 경로에 넣으면 코드 수정 없이 교체된다(빌드·개발 서버가 runtime 폴더를 읽어 존재 여부를 넘긴다).
 * 상태와 사양은 docs/art/asset-status.md, location-art-spec.md, character-art-spec.md 참고.
 */
export type ArtAssetKind='location'|'character';
export interface ArtAsset {id:string;kind:ArtAssetKind;label:string;final:string;fallback:string;}
export const ART_ASSETS={
 'granary.yard':{id:'granary.yard',kind:'location',label:'곡물 창고 · 앞마당',final:'/assets/runtime/locations/granary/yard.webp',fallback:'/assets/fallback/locations/granary/yard.svg'},
 'granary.office':{id:'granary.office',kind:'location',label:'곡물 창고 · 출입 관리소',final:'/assets/runtime/locations/granary/office.webp',fallback:'/assets/fallback/locations/granary/office.svg'},
 'granary.interior':{id:'granary.interior',kind:'location',label:'곡물 창고 · 창고 내부',final:'/assets/runtime/locations/granary/interior.webp',fallback:'/assets/fallback/locations/granary/interior.svg'},
 'granary.loading':{id:'granary.loading',kind:'location',label:'곡물 창고 · 하역장',final:'/assets/runtime/locations/granary/loading.webp',fallback:'/assets/fallback/locations/granary/loading.svg'},
 'granary-keeper.portrait':{id:'granary-keeper.portrait',kind:'character',label:'창고 책임자 왕상 · 초상',final:'/assets/runtime/characters/granary-keeper/portrait.webp',fallback:'/assets/fallback/characters/granary-keeper/portrait.svg'},
} satisfies Record<string,ArtAsset>;
export type ArtAssetId=keyof typeof ART_ASSETS;

/** 빌드·개발 서버가 넘겨 준 최종 파일 목록. 알 수 없는 환경(테스트 번들 등)에서는 null이다. */
export function finalAssetList():ReadonlySet<string>|null {return typeof __FINAL_ASSETS__==='undefined'?null:new Set(__FINAL_ASSETS__);}

export interface ResolvedArt {id:string;src:string;fallback:string;status:'final'|'fallback'|'unknown';}
/**
 * final이 있으면 final, 없으면 fallback.
 * 목록을 모르는 환경에서는 final을 먼저 시도하고(이미지 오류 시 fallback으로 바꿈) 상태를 'unknown'으로 둔다.
 */
export function resolveArt(id:ArtAssetId,available:ReadonlySet<string>|null=finalAssetList()):ResolvedArt {
 const a=ART_ASSETS[id];
 if(available===null)return {id,src:a.final,fallback:a.fallback,status:'unknown'};
 return available.has(a.final)?{id,src:a.final,fallback:a.fallback,status:'final'}:{id,src:a.fallback,fallback:a.fallback,status:'fallback'};
}
