# Polyphony — 기획·구현서 (재현용)

> 대화주의(dialogism) 기반 실시간 토론 오케스트레이션·시각화 도구.
> 이 문서는 **현재 구현된 상태를 그대로 다시 만들 수 있도록** 정리한 것이다.
> 의사결정 로그: [log.md](./log.md) · 지표 산출 근거: [stat-report.md](./stat-report.md) · 사용법: 앱 내 `/help` · 실행: [README.md](./README.md)
> 최종 갱신 2026-06-22 (척도형·지표 시각화·페이즈바·헬퍼·xlsx·재개·도움말 반영).

## 1. 한 줄 소개
질문 → 의견 수집 → AI 군집화 → (심화/전환/통합) 후속 질문 → 재수집 사이클을 **가로 스크롤 캔버스**로 펼쳐 보며 진행하는 도구. **우세한 의견을 드러내지 않고** 다성성(polyphony)과 그 전개를 시각화한다.

## 2. 핵심 원칙 (코드 전반에서 불변)
1. **무대(학생·교사 화면) 우세 은폐**: 군집 카드는 크기·색·위치 동등, 인원수 비표시, 예시 1개, 외톨이 표시 없음.
2. **내부 지표는 관리자·교사만**: 인원수, 전체 의견, 다양성·엔트로피·일치도, 우세(최다)·외톨이 강조.
3. **AI는 조력자**: 순위·우세 금지, 외톨이 보존, 제안만 하고 결정은 사람.
4. **일치도 높음 ≠ 좋음**(수렴 신호) → 무채색 표시. **빨강 = 나쁨이 아니라 수렴**.

## 3. 기술 스택
- React 18 + Vite, **JS/JSX(TS 미사용)**, react-router-dom v6, **xlsx(SheetJS)** 내보내기.
- 데이터: 추상화된 `store`(현재=localStorage + BroadcastChannel; 같은 브라우저 다중 탭 실시간; 추후 Firebase 교체).
- AI: Anthropic Claude(`claude-opus-4-8`/`claude-haiku-4-5-20251001`), **관리자 기기에서만** fetch 호출, 키는 관리자 localStorage. 키 없으면 **오프라인 폴백**.
- 시각화: CSS + 인라인 스타일(SVG 없이 div 기반 number line).

## 4. 파일 구조
```
src/
  main.jsx            라우팅: / · /help · /s/:code/{student|admin|teacher}
  index.css           디자인 시스템
  lib/
    store.js          데이터 계층(세션/라운드/의견/군집/참가자/회고) + 실시간 구독
    ai.js             Claude 호출 + 오프라인 폴백: 첫질문/군집화(+입자)/후속질문(심화·전환·통합)/회고/테스트의견(배치)
    polyphony.js      metricLevel, metricBand(5색), roundDiversity, roundShannon, likertStats,
                      divergenceTrend, sessionSummary, retrospectiveData
    exportXlsx.js     세션 → .xlsx(라운드/의견/군집 3시트)
    colors.js · id.js
  hooks/useSession.js 실시간 구독 훅 + 참가자 식별 보관
  components/
    Canvas.jsx        가로 스크롤 칼럼(밀도 3단·확장·삭제·지표·브리핑·우세/외톨이 강조), 칼럼 전체 세로 스크롤
    ClusterCard.jsx   동등 카드(stage 은폐 / admin 내부지표·우세(빨강)·외톨이(보라점선))
    ExpandedRound.jsx 라운드 확장 뷰(좌 질문·브리핑 / 우 카드 그리드)
    ScaleViz.jsx      리커트 점수 수직선(number line) + 평균마커·일치도 (hideParametric: 교사뷰 평균/표준편차 숨김)
    PolyphonyMeter.jsx 세션요약 + 라운드별 막대(다양성·엔트로피, 색=신호등) + 일치도 무채색 막대 + (i)설명
    PhaseBar.jsx      현재 페이즈 스텝 바(의견수집→군집화→후속질문) + 상황 설명
    Guide.jsx         규칙 기반 진행 헬퍼(다음 행동 안내, 다양성 낮으면 개방형 질문 제안 등)
    LevelDot.jsx · InfoButton.jsx
    SessionRetrospective.jsx (📜 버튼→모달, 포털 렌더, 자동표시 안 함) · RetrospectiveList.jsx (패널 인라인)
    Settings.jsx
  views/
    Landing.jsx       역할 선택(교사/학생) → 생성/참가, 📖 사용 방법 링크
    StudentView.jsx   무대(이전대화 접기 가능 + 하단 고정 작성칸/리커트 점수)
    AdminView.jsx     진행(페이즈바+캔버스+분석토글+사이드 진행패널+헬퍼+미터+회고)
    TeacherView.jsx   모니터링(페이즈바+캔버스+분석토글[기본접힘]+참여현황+미터+voice목록+회고)
    Help.jsx          사용 방법(이미지 자리표시자 → public/help_image_N.png)
public/               help_image_1~10.png 자리(README 참고)
```

## 5. 데이터 모델 (store.js, 세션 1건 = localStorage 1 JSON)
- **session** `{ id(code), title, status('active'|'closed'), currentRoundId, studentReactionMode, model, createdAt, retrospective }`
- **rounds[]** `{ id, index, question, direction('seed'|'deepen'|'shift'|'integrate'), responseType('open'|'scale'), scaleMax(4|5|7), scaleLabels({min,max}), status('collecting'|'closed'|'clustered'), parentRoundId, briefing, createdAt }`
- **opinions[]** `{ id, roundId, participantId, text, score(number|null), createdAt }` ← 1인 1응답(upsert), score는 척도형
- **clusters[]** `{ id, roundId, label, summary, opinionIds[], parentClusterIds[], colorIndex, isOutlier }`
- **participants[]** `{ id, nickname, role('student'|'facilitator'), joinedAt, synthetic? }`
- store 메서드: createSession, getSnapshot, subscribe(같은탭 로컬리스너+BroadcastChannel+storage), updateSession, joinSession, addRound, updateRound, submitOpinion, setClusters(…,briefing), seedOpinions(…,scores), deleteOpinion, deleteCluster, listSessions.

## 6. 역할 & 화면
- **Landing**: 역할 선택(🎛 교사 / 🎓 학생). 교사→새 세션 또는 코드로 진행자 입장(/admin). 학생→코드+닉(/student). 📖 사용 방법(/help).
- **학생(/student)**: 상단 "지금까지의 대화"(접기 가능, 무대규칙) + **하단 고정 작성칸**(서술형 글 / 척도형 점수버튼+이유, 양끝 라벨). 1인1응답 수정 가능.
- **진행자(facilitator)** = 동일 권한, 두 뷰:
  - **관리자(/admin)**: 페이즈바 + 캔버스(내부지표, 분석토글 **기본 펼침**) + 사이드 진행패널(7절) + 헬퍼 + 미터 + 회고. 개별 의견/군집 삭제, 우세(빨강)·외톨이(보라) 강조.
  - **교사(/teacher)**: 읽기전용 모니터링. 페이즈바 + 캔버스(분석토글 **기본 접힘**) + 참여현황 + 미터 + voice목록 + 회고. 척도형 **평균·표준편차 숨김**(분포·일치도만).
- 모든 화면 앱바: 📜 세션 회고(종료 시) · 나가기 ✕.

## 7. 진행 사이클 (관리자 패널 상태머신) + 페이즈바
페이즈바: **의견 수집 → 군집화 → 후속 질문**(현재 단계·상황 설명).
1. **첫 질문**: ✨ 추천받기(서술/척도 섞인 4개, 🔄 다시추천) 또는 직접작성 → 유형 선택(서술형/척도형 4·5·7점 + 양끝 라벨) → 발행.
2. **수집 중**: 응답 수 표시, 🧪 테스트 의견 생성(개수 + 다양성 낮음/중간/높음; 척도형이면 점수도; 10개씩 배치) → **수집 마감**.
3. **마감**: 군집화 입자(묶기/보통/세밀) 선택 → **② AI 군집화** → 브리핑(200자, 편집·척도형이면 점수정보 포함) + 군집안 검토 → **군집 확정**.
4. **군집화됨**: **③ 후속 질문 제안받기**(🔄 다시제안) → **심화/전환/통합** 3갈래(유형 배지) → 선택(질문·유형 자동) → **다음 라운드 발행**.
5. 반복 또는 **세션 종료**(즉시 전환, 회고 요약은 백그라운드) → 회고 모드. **세션 재개**/**.xlsx 내보내기** 가능.

## 8. AI 동작 (ai.js) — 맥락 주입 + 오프라인 폴백
- 공통 `buildContextBlock(title, history)`: 세션 제목 + 이전 질문/브리핑 주입(연속성).
- **proposeFirstQuestions** → `[{text,type,scaleMax,minLabel,maxLabel}]` 4개(최소 1 척도형), 양끝 의미 텍스트에 삽입.
- **clusterOpinions(…,scaleNote,granularity)** → `{clusters[], briefing}`. 순위·우세 금지, 입자별 묶기/세밀 규칙, **외톨이=혼자 또는 10%미만(markOutliers, 결정론적)**, 라벨·브리핑 초등 눈높이, 척도형이면 브리핑에 점수 분포.
- **proposeFollowups(…,history,title)** → `{deepen[],shift[],integrate[]}` 각 typed, 맥락 이어받기.
- **summarizeRetrospective** → 비위계적 "차이의 지도".
- **generateTestOpinions(…,diversity)** → 수준별 의견, **10개씩 배치**(긴 응답 파싱 실패 방지).
- 호출은 관리자 기기 한정, 키 비노출.

## 9. 지표 (polyphony.js) — 상세 stat-report.md
- 다양성 = 1−Σpᵢ² · 엔트로피 = −Σpᵢln pᵢ ÷ ln(N) · 일치도 = 1−std/maxStd(척도형).
- 신호등 `metricLevel`(≥.66 높음/≥.33 중간/그외 낮음). **박스 배경 `metricBand`** 5색(초록·연두·노랑·주황·빨강, 다양성·엔트로피 평균 기준).
- 일치도 = 무채색(수렴 신호, "높음≠좋음"). 척도형 점수는 **수직선 분포 + 평균 마커**(교사뷰는 평균/표준편차·마커 숨김).
- 추이(±0.05 발산/수렴), 세션요약(라운드 평균·범위·열림/모임), 회고(최고/최저 다양성 질문). 표시는 관리자·교사만.

## 10. 캔버스 상호작용 (Canvas.jsx)
- 라운드=세로 열(좌→우), 새 라운드 자동 스크롤. **칼럼 전체(질문+분석+답변)가 함께 세로 스크롤**.
- 밀도 토글 ≣펼침/≡접기/—더접기(기본 **더 접기**), **⤢ 확장** 뷰.
- 분석(지표·브리핑) **보기/숨기기 토글**(관리자 기본 펼침·교사 기본 접힘).
- 관리자: 군집화 전 원문 표시, 개별 의견/군집 삭제(✕), 우세(빨강 outline·"최다")·외톨이(보라 점선) 강조.

## 11. 디자인
- 종이 톤(`--paper:#f6f3ec`), voice=동등 채도 색(황금각, S/L 고정 → 우열 암시 없음). 한글 가독성. 평가적 색은 신호등·박스배경뿐, 나머지 중립. 모달은 포털 렌더(앱바 backdrop-filter 영향 회피).

## 12. 비기능 · 범위
- 동시 학생 ~30–40, 라운드 수십. 한국어 우선. 보안(프로토타입): AI 키 관리자 기기 한정. 데이터: 종료 후 보존 + .xlsx 내보내기 + 세션 재개.

## 13. 미구현 / 다음 단계
- Firebase 전환(store 인터페이스 교체) → 다중 기기. 계보/강물 분기 뷰. 학생 상호활성화(interanimation) 입력. "같은 점수, 다른 이유" 자동 배지. 지표(엔트로피·일치도) 타당화·해석 지원. Cloud Functions 키 은닉.
