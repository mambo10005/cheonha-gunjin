import {defineConfig, type Plugin} from 'vite';

// GitHub Pages(https://<user>.github.io/<저장소>/)처럼 하위 경로에 올릴 때는 BASE_PATH=/<저장소>/ 로 빌드한다.
// 게임 코드는 public/assets 파일을 '/assets/...' 절대 경로 문자열로 참조하므로, 빌드 결과에서만 그 앞에 기본 경로를 붙인다.
// 로컬 개발(npm run dev)과 테스트는 기본 경로 '/' 그대로라 아무것도 바뀌지 않는다.
const base = process.env.BASE_PATH || '/';

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

export default defineConfig({
  base,
  plugins: [prefixPublicAssets(base)],
});
