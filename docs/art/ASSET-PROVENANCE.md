# 생성 자산 출처와 사용 상태

2026-10-09 Codex에서 제공된 image_gen 도구로 독립 생성했다. 외부 게임 화면·인터넷 초상화·추출 에셋·참조 게임의 음악/효과음은 사용하지 않았다. 특정 회사의 화풍을 지시하지 않았다. 생성에 사용한 요청은 prompts/guojia.txt, merchant.txt, camp.txt에 보관했다.

| 생성 원본 | 용도 | 실행 파일 ID |
|---|---|---|
| guojia-source.png | 곽가 6포즈 atlas | exec-c9000644-e63a-44f7-a438-6666db0fff2d.png |
| merchant-source.png | 가상 교섭관 6포즈 atlas | exec-3e2e861d-2fb9-40bf-bc06-42acf90f0503.png |
| camp-source.png | 군막 배경 | exec-6c2f2ab8-6b8f-4d1e-9281-789629d20a6d.png |

원본은 저장소 밖 work/art/cinematic에 보관했다. 배포에는 런타임 WebP/manifest만 포함한다. atlas 분할, 16px 안전 여백, WebP 압축, low placeholder 생성은 Pillow로 수행했다. 그림 내용의 수작업 보정이나 외부 합성은 하지 않았다. 어두운 배경 합성에서 얼굴/손과 가장자리를 정적 확인했다. 게임 화면 검수는 미검증이다.

본 파일은 생성 출처 기록이며 독점 저작권·법률 심사·전문 원화 최종 승인을 보증하지 않는다. 생성 이미지의 실제 상용 배포 승인과 프로젝트 자산 라이선스 확정은 별도 검토 상태다. 외부 폰트를 다운로드하지 않으며 시스템 폰트 fallback을 사용한다. 새 오디오/리깅 라이브러리는 추가하지 않았다.
