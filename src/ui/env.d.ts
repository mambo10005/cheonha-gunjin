/// <reference types="vite/client" />
// Vite가 CSS import를 처리한다. 타입 검사용 선언.
declare module '*.css';

// 빌드·개발 서버가 public/assets/runtime 에 있는 최종 미술 파일 경로 목록을 넣는다(vite.config.ts). 테스트용 번들 등에서는 없다.
declare const __FINAL_ASSETS__: string[] | undefined;
