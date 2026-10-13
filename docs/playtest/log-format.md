# 플레이테스트 로그 형식

## 파일
- `cheonha-playtest-<시각>.json` — 원시 로그. `{kind:'cheonha-gunjin-playtest-log', note, exportedAt, log, summary}`.
- `cheonha-playtest-<시각>.md` — 사람이 읽는 요약(`summary`와 같은 내용).
- 브라우저 저장소 키: `cheonha-gunjin.playtest.log` (로그), `cheonha-gunjin.playtest.campaign` (테스트 캠페인 저장). 외부로 보내지 않습니다.

## `log`
```
version 1
preset   'prologue-v1'
seed     141001
startedAt, sessions(이어하기 횟수), actions(행동 수)
entries  PlaytestEntry[]
prep     PrepSpend[]        // 준비 시간·준비력 소비
survey   {문항id: {score 1~5, note}}
observer {n, tick, at, tag, text}[]
routeOpened number[]        // 추천 경로를 연 행동 번호
```

### PlaytestEntry
`{n, tick, at, kind, cat, text, data}`
- `n` 행동 번호(명령 경계마다 +1), `tick` 캠페인 시간(0~42), `at` 기기 시각.
- `kind`: `action`(명령 문자열) · `탐색` · `덱` · `의뢰` · `인재` · `거병` · `설전` · `대결` · `준비` · `화면`(열람) · `거부`(규칙이 거부한 명령).
- `cat` 예: 탐색 `이동`·`locationEntered`·`cardCommitted`… / 덱 `획득`·`제외`·`편성`·`사용`(data.cards, unusedInHand)·`표식`·`책략` / 설전 `시작`·`카드`·`대상`·`공격`·`보호`·`숨은 논거 공개`·`제거`·`등급`·`조항`·`최종 제안`·`결과`(data.missed, remainingOpp) / 대결 `시작`·`카드`(data.distance, stance, oppStance, opening, momentum, prepared)·`준비 전술`·`빈틈 없는 승부수`·`합`·`과잉 무력`·`부상`·`등급`·`결과`(data.missed) / 거병 `계획`·`완료`(data.plan, timeLeft, officers, deck, policies, promises, issues, settlement)·`부담 결산` / 화면 `카드 상세 열람`·`카드 미리보기`(data.guide=승부수 경고 노출)·`덱·책략 열람`·`보관함 열람`·`현재 목표 확인`·`추천 경로 열람`·`예상 등급 열람`·`조항 열람`·`준비 전술 열람`·`합 기록 열람`·`세부 수치 열람`·`준비 내역 열람`.

### PrepSpend
`{n, tick, cat, time, power, text}` — `cat`은 이동 / 장소 진입 / 조사 / 카드 사용 / 사건 / 의뢰 / 설전 준비 / 대결 준비 / 휴식 / 기타. `time`은 캠페인 시간, `power`는 장소 준비력.

## 요약(.md) 구성
행동 수와 캠페인 시간(플레이 시간 대신) · 방문 경로 · 최종 덱 · 핵심 카드 연쇄 · 미사용 카드 · 인재 · 설전 논거 · 대결 연쇄 · 결과 등급(놓친 조건) · 준비력·시간 내역 · 거병 후 정책·의무·현안 · 반복 또는 막힘 가능성이 있는 구간(같은 두 장소 왕복, 같은 명령 3회 연속, 추천 경로 열람 시점) · 설문 · 관찰자 기록. 재미 여부는 판정하지 않습니다.
