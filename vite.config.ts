import {defineConfig, type Plugin} from 'vite';
import fs from 'node:fs';
import path from 'node:path';

// GitHub Pages(https://<user>.github.io/<저장소>/)처럼 하위 경로에 올릴 때는 BASE_PATH=/<저장소>/ 로 빌드한다.
// 게임 코드는 public/assets 파일을 '/assets/...' 절대 경로 문자열로 참조하므로, 빌드 결과에서만 그 앞에 기본 경로를 붙인다.
// 로컬 개발(npm run dev)과 테스트는 기본 경로 '/' 그대로라 아무것도 바뀌지 않는다.
const base = process.env.BASE_PATH || '/';

// 최종 미술 파일 폴더. 여기 있는 래스터 이미지 목록을 __FINAL_ASSETS__ 로 넘겨, 파일만 넣으면 코드 수정 없이 fallback 대신 쓰이게 한다.
const RUNTIME_DIR = path.resolve('public/assets/runtime');
const RASTER = /\.(webp|png|jpe?g|avif)$/i;
function listFinalAssets(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (RASTER.test(entry.name) && fs.statSync(full).size > 0) out.push('/assets/runtime/' + path.relative(RUNTIME_DIR, full).split(path.sep).join('/'));
    }
  };
  walk(RUNTIME_DIR);
  return out.sort();
}

function prefixPublicAssets(prefix: string): Plugin {
  const fix = (text: string) => text.replace(/(["'`(])\/assets\//g, `$1${prefix}assets/`);
  return {
    name: 'prefix-public-assets',
    apply: 'build',
    generateBundle(_options, bundle) {
      if (prefix === '/') return;
      for (const file of Object.values(bundle)) {
        if (file.type === 'chunk') file.code = fix(file.code);
        else if (file.fileName.endsWith('.css') && typeof file.source === 'string') file.source = fix(file.source);
      }
    },
  };
}

/** 개발 서버: runtime 폴더에 그림을 넣거나 빼면 목록을 다시 읽도록 서버를 재시작한다. */
function watchFinalAssets(): Plugin {
  return {
    name: 'watch-final-assets',
    apply: 'serve',
    configureServer(server) {
      server.watcher.add(RUNTIME_DIR);
      const onChange = (file: string) => { if (path.resolve(file).startsWith(RUNTIME_DIR) && RASTER.test(file)) server.restart(); };
      server.watcher.on('add', onChange);
      server.watcher.on('unlink', onChange);
    },
  };
}

export default defineConfig({
  base,
  define: {__FINAL_ASSETS__: JSON.stringify(listFinalAssets())},
  plugins: [prefixPublicAssets(base), watchFinalAssets()],
});
