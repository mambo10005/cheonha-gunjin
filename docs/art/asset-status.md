# 미술 에셋 상태

코드의 기준 목록은 `src/data/art-assets.ts`(manifest)다. 이 문서는 각 에셋의 현재 상태를 기록한다.

## 상태 정의

| 상태 | 뜻 |
|---|---|
| final | 최종 원화가 `public/assets/runtime/...` 경로에 들어 있고 화면 검수를 통과했다. |
| generated-candidate | 생성된 후보 이미지가 있으나 아직 검수 전이다. 검수 전에는 runtime 경로에 넣지 않는다. |
| fallback | 최종 원화가 없어 개발용 임시 에셋(`public/assets/fallback/...`, 코드로 그린 SVG)을 쓰고 있다. 최종 미술이 아니다. |
| missing | 최종 원화도, 임시 에셋도 없다. |
| rejected | 후보를 검토했으나 쓰지 않기로 했다. 사유를 비고에 남긴다. |

## 현재 상태

| 에셋 ID | 상태 | 최종 원화 경로(아직 없음) | 현재 화면에 쓰는 파일 | 비고 |
|---|---|---|---|---|
| `granary.yard` | fallback | `public/assets/runtime/locations/granary/yard.webp` | `public/assets/fallback/locations/granary/yard.svg` | 곡물 창고 앞마당. 코드로 그린 임시 그림. |
| `granary.office` | fallback | `public/assets/runtime/locations/granary/office.webp` | `public/assets/fallback/locations/granary/office.svg` | 출입 관리소. 코드로 그린 임시 그림. |
| `granary.interior` | fallback | `public/assets/runtime/locations/granary/interior.webp` | `public/assets/fallback/locations/granary/interior.svg` | 창고 내부. 코드로 그린 임시 그림. |
| `granary.loading` | fallback | `public/assets/runtime/locations/granary/loading.webp` | `public/assets/fallback/locations/granary/loading.svg` | 하역장. 코드로 그린 임시 그림. |
| `granary-keeper.portrait` | fallback | `public/assets/runtime/characters/granary-keeper/portrait.webp` | `public/assets/fallback/characters/granary-keeper/portrait.svg` | 창고 책임자 왕상. 장소 인물 카드·대화·창고 설전 상대 초상에 쓰인다. 코드로 그린 임시 그림. |

곡물 창고 4구역과 창고 책임자의 최종 미술은 **완성되지 않았다.** 위 SVG는 개발용 임시 에셋이며, 더 다듬지 않는다.

## 교체 방법

1. Codex 등 이미지 생성 도구에서 `docs/art/prompts/granary.md`의 요청문으로 이미지를 만든다.
2. 사양(`location-art-spec.md`, `character-art-spec.md`)에 맞는지 확인하고, 이 표의 상태를 `generated-candidate`로 바꾼다.
3. 검수 후 표의 "최종 원화 경로"에 같은 파일 이름으로 넣는다. 코드 수정은 필요 없다.
   - `npm run dev` 중이면 개발 서버가 폴더 변화를 감지해 다시 읽는다.
   - 배포는 `main`에 푸시하면 GitHub Actions가 다시 빌드하면서 반영한다.
4. 화면 검수를 마치면 상태를 `final`로 바꾼다. 쓰지 않을 후보는 `rejected`와 사유를 남긴다.

## manifest 밖의 기존 임시 그림(참고)

- `public/assets/locations/escort-captain.svg`: 호위 대표 장굉 초상. 이 작업 이전부터 있던 코드 SVG이며 아직 manifest로 옮기지 않았다. 성격상 fallback이다.
- `public/assets/locations/warehouse-manager.svg`: 이전 창고 책임자 임시 초상. 현재 화면에서 쓰지 않는다.
