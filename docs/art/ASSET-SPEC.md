# 인물 자산 사양

기준 manifest: src/data/debate-art.ts. 각 public/assets/debate/portraits/{id}/manifest.json은 전달용 사본이다.

원본: 1536×1024 RGBA PNG, 3열×2행 atlas. runtime: 각 512×512 투명 WebP, 반신 전체를 480px 안에 축소 배치. 하단 반신 절단은 원화 구도이며 손/관모에는 여백을 남긴다. low: 128×128 WebP. 배경: 1535×864 불투명 WebP. 압축 인물 quality88, low65, 배경87. 실제 용량은 asset-sizes.json 참조.

neutral/speak/press/countered/concede 필수, victory 선택 구현. 네트워크 또는 pose 실패 시 neutral, 전체 이미지 실패 시 비식별 인장. 유효 인물과 알 수 없는 인물의 차이를 development에서만 임시 원화 표기로 드러낸다. 최종 원화 없는 인물을 생성 완료로 표시하지 않는다.

용량 예산: 인물 포즈 180KB 이하, 배경 250KB 이하. width/height/faceAnchor/crop/mirror/색/소품/소재를 검증한다. mirror=false: 손과 소품 방향을 고려해 원화 자체가 각자의 중앙을 보도록 제작했다. 기본 얼굴 기준점 [50,24], desktop crop50%50%, mobile50%18%는 배치 시작값이며 실제 화면 승인은 미검증이다.

다중 포즈를 선택하고 교차 페이드140ms, 약한 위치/조명 변화를 적용한다. 리깅을 고도화하려면 분리 원화와 라이선스/관절 검수를 별도로 준비한다. 현재 런타임 라이브러리를 추가하지 않았다.

검수: 실제 포즈별 손가락/문서/관모/얼굴 동일성, 회담 명암, 1600/1366/820/390/360px 크롭, 안전 여백, 확대·고대비, 이미지 실패, 원정 저장 복원을 확인한다. 정적 원화 검토와 실제 브라우저 승인란을 분리한다.
