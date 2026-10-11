# 곡물 창고 전용 원화 요청문

현재 곡물 창고의 구역 그림(`public/assets/locations/warehouse-{yard,office,interior,loading}-v1.svg`)과
창고 책임자 초상(`warehouse-manager-v2.svg`)은 코드로 그린 벡터 일러스트다.
객사·인물 원화와 같은 손그림 화풍으로 바꾸려면 아래 요청문으로 그림을 만든 뒤,
같은 이름의 `.webp`로 저장하고 `src/ui/city-exploration-screen.ts`의 경로 확장자만 바꾼다.

공통 화풍: High-end hand-painted realistic historical concept illustration with subtle ink wash, late Eastern Han dynasty (190 AD) northern China, warm lantern light and cool dusk mist, dark jade and charcoal palette, no text, letters, logos, frames, UI, watermarks, modern objects, anime.

| 파일 | 비율 | 장면 |
|---|---|---|
| warehouse-yard-v1.webp | 16:9 | 높은 석축 위 목조 곡창 정면과 기와지붕, 흙담에 둘러싸인 앞마당. 왼쪽에 곡물 자루를 실은 두 바퀴 수레와 자루를 멘 짐꾼, 가운데 자루 더미, 오른쪽에 창을 든 호위 두 명과 나무 상자로 막힌 좁은 통로. 처마의 등불 두 개. |
| warehouse-office-v1.webp | 16:9 | 출입 관리소 실내. 대나무 죽간 장부가 쌓인 긴 책상, 벽의 청동 열쇠걸이, 붉은 인장 상자, 격자창으로 비스듬히 드는 빛, 등불. |
| warehouse-interior-v1.webp | 16:9 | 어두운 곡물 창고 내부. 양쪽에 높이 쌓인 곡물 자루, 큰 토기 독, 정면에 철띠와 자물쇠를 단 비축 구역 문, 높은 창의 빛줄기, 앞쪽에 찢어져 곡식이 쏟아진 자루. |
| warehouse-loading-v1.webp | 16:9 | 두 흙담 사이 좁은 하역 통로 끝에 성문 누각이 보이는 장면. 오른쪽 비탈 하역대와 자루, 통로를 지나는 짐 실은 수레와 짐꾼. |
| warehouse-manager-v2.webp | 2:3 | 창작 인물 창고 책임자 왕상. 사십대 후반 동아시아 남성, 검은 두건, 다듬은 콧수염과 짧은 턱수염, 바랜 갈색 관리 도포, 두 손에 대나무 장부, 허리에 청동 열쇠 꾸러미. 허리 위 반신, 곡물 자루가 흐릿한 창고 배경. |
