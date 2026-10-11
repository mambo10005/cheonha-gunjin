import {resolveArt,type ArtAssetId} from '../data/art-assets.ts';
import {esc} from './html.ts';

/** 개발 모드(npm run dev)에서만 임시 에셋 표시를 붙인다. 배포 화면 HTML에는 표시 문구가 들어가지 않는다. */
const DEV=!!import.meta.env.DEV;

/**
 * manifest 에셋 이미지. final이 있으면 final, 없으면 fallback을 쓴다.
 * 목록을 모르는 환경에서는 final을 먼저 시도하고, 불러오기에 실패하면 fallback으로 바꾼다.
 * 개발 모드에서는 바로 뒤에 '임시 에셋' 표시를 붙이며, CSS가 fallback일 때만 보이게 한다.
 */
export function artImg(id:ArtAssetId,attrs:{className?:string;alt:string;decorative?:boolean}):string {
 const a=resolveArt(id),onerror="this.onerror=null;this.src=this.dataset.fallback;this.dataset.artStatus='fallback'";
 return `<img${attrs.className?` class="${esc(attrs.className)}"`:''} src="${esc(a.src)}" data-art="${esc(id)}" data-art-status="${a.status}" data-fallback="${esc(a.fallback)}"${a.status==='fallback'?'':` onerror="${onerror}"`} alt="${esc(attrs.alt)}"${attrs.decorative?' aria-hidden="true"':''}>${DEV?'<span class="art-dev-badge" aria-hidden="true">임시 에셋</span>':''}`;
}
