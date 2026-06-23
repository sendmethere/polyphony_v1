# Polyphony — 지표 구현 매핑 (정의서: stat.md)

> 정의·공식·밴드는 [stat.md](./stat.md)(Hill Number 프레임워크)가 기준.
> 계산·표시는 **`src/lib/metrics.js` 한 파일**에 모여 있다(지표 교체 시 여기만 수정).

공통: N=참여자(=라운드 응답) 수, S=코드(군집) 수, pᵢ=코드 i 비율.

## 기본 수 — `hill(ctx)` → `{ N, h0, h1, h2, openness, evenness, dominance }`
| stat.md | 식 | 필드 |
|---|---|---|
| Hill 0 풍부도 | S | `h0` |
| Hill 1 실효 의견 수 | exp(H), H=−Σpᵢln pᵢ | `h1` |
| Hill 2 실효 지배 수 | 1/Σpᵢ² | `h2` |
| 개방성 Openness | Hill1/N | `openness` |
| 균형성 Evenness | Hill1/Hill0 | `evenness` |
| 분산도 Dominance | Hill2/Hill1 | `dominance` |

## 표시 판단지표 — `INDICATORS` 배열 (이 배열만 바꾸면 화면 자동 반영)
| id | 라벨 | 값 | 밴드 함수 |
|---|---|---|---|
| openness(primary) | 관점 개방성 | Hill1/N | `bandOpenness` (5단계) |
| evenness | 관점 균형성 | Hill1/Hill0 | `bandEvenness` (4단계) |
| dominance | 담화 분산도 | Hill2/Hill1 | `bandDominance` (4단계) |

- 밴드 경계(stat.md): 개방성 0.2/0.4/0.6/0.8 · 균형성 0.25/0.5/0.75 · 분산도 0.4/0.7/0.9.
- `roundMetrics(round,clusters,opinions)` → 표시용 배열, `metricTrend(...)` → 라운드별 막대 시리즈.
- 추이·세션요약·Guide·배경색은 **primary(개방성)** 기준(`roundDiversity`, `divergenceTrend`, `sessionSummary`).
- 척도형 점수 분포는 별개 보조 시각화 `scoreDistribution`(분포·중앙값) → `ScaleViz`.

## 표시 위치
- **칼럼 머리글**(Canvas): 개방성·균형성·분산도(밴드 점) + Hill 요약(풍부도/실효/지배, N). 배경은 개방성 등급 톤.
- **다양성 지표 패널**(PolyphonyMeter): 세션 요약 + 지표별 막대. (i) 버튼에 친절한 해석.
- **회고**(RetrospectiveList/SessionRetrospective): 라운드별 지표 배열(`e.metrics`).
- **.xlsx**(exportXlsx): N·Hill0·Hill1·Hill2·개방성·균형성·분산도·(척도)중앙값.
- 모두 관리자·교사 전용.

## 유의
- 절대값보다 정규화 지표(개방성·균형성·분산도)와 **라운드 추이**로 해석.
- 높음이 곧 "좋음"은 아님(펼침/모음 국면의 서술).
- AI 군집화 입자에 따라 S가 달라지니 추이로 본다.
