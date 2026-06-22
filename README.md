# Polyphony 🎼

대화주의(dialogism)에 기반한 실시간 토론 오케스트레이션·시각화 도구의 프로토타입.
**우세한 의견을 드러내지 않고**, 살아있는 차이(다성성)와 그 전개를 가로 스크롤로 보여준다.

기획 문서: [plan.md](./plan.md) · 개발 명세: [output.md](./output.md) · 결정 로그: [log.md](./log.md)

## 실행
```bash
npm install
npm run dev      # http://localhost:5173
```

## 사용해 보기 (한 대의 PC에서 데모)
같은 브라우저에서 **탭을 여러 개** 열면 실시간으로 연동됩니다(BroadcastChannel + localStorage).
1. 탭 A: 첫 화면에서 **"세션 만들기"** → 관리자 화면 진입, 세션 코드 확인.
2. 탭 B, C: 첫 화면에서 그 코드로 **학생**으로 참가.
3. 탭 A(관리자): **① 첫 질문 발행** → 학생 탭에서 응답 제출.
4. 관리자: **수집 마감 → ② AI 군집화 → 군집 확정 → ③ 후속 질문 제안 → 선택 → 다음 라운드 발행**.
5. 관리자 상단 **"모니터링 뷰 ↗"** 로 교사(관찰) 화면을 새 탭에서 확인.
6. 마무리: **세션 종료** → 읽기전용 회고 + (AI) 비위계적 voice 요약 + JSON 내보내기.

> **API 키 없이도** 전체 사이클을 시험할 수 있습니다(오프라인 휴리스틱 군집화). 실제 의미 기반 군집화·질문 제안은 ⚙ **설정**에서 Anthropic API 키를 넣으면 동작합니다. 키는 **이 브라우저(관리자 기기)** 에만 저장됩니다.

## 구조
```
src/
  lib/
    store.js       데이터 계층 추상화 (지금=localStorage+BroadcastChannel, 나중=Firebase 교체)
    ai.js          Anthropic Claude 호출(관리자 전용) + 오프라인 폴백 (군집/후속질문/회고)
    polyphony.js   다양성·발산/수렴 지표 (모니터링 전용)
    colors.js      동등 채도 voice 팔레트 (우열 암시 금지)
    id.js          세션 코드·ID
  hooks/useSession.js   세션 실시간 구독 훅 + 참가자 식별 보관
  components/
    Canvas.jsx     가로 스크롤 라운드 열 캔버스
    ClusterCard.jsx 동등 군집 카드 (stage=은폐 / admin=내부지표)
    Settings.jsx   API 키·모델 설정
  views/
    Landing.jsx    입장(세션 생성/참가)
    StudentView.jsx  학생 무대
    AdminView.jsx    관리자 진행 (사이클 전체)
    TeacherView.jsx  교사 모니터링 대시보드
```

## 핵심 원칙 (코드 전반에서 지켜야 함)
- **무대(학생·교사 화면)에서는 우세 은폐**: 군집 카드의 크기·색 채도·위치가 동등하고 인원수를 표시하지 않는다.
- **관리자/모니터링에서만 내부 지표**(인원수, 폴리포니 미터 등) 노출.
- **AI는 조력자**: 순위·다수·우세를 매기지 않고, 외톨이 의견을 보존한다.

## 다음 단계 (output.md 마일스톤 기준)
- **M5**: 계보/강물 분기 뷰(세분·통합을 SVG 선으로), 군집 수동 편집(드래그).
- **Firebase 전환**: `src/lib/store.js` 를 동일 인터페이스의 `firebaseStore`(Firestore onSnapshot)로 교체 → 다중 기기 실시간.
- **보안**: 실배포 시 AI 호출을 Cloud Functions 로 이전(키 은닉).
# polyphony_v1
