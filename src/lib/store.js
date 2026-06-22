// ─────────────────────────────────────────────────────────────
// 데이터 계층 선택기 (Data layer selector)
//
// 화면 코드는 이 `store` 만 사용한다. 백엔드를 바꾸려면 아래 한 줄만 교체.
//
// 인터페이스 (localStore / firebaseStore 가 동일하게 구현):
//   createSession({title, model}) -> code
//   getSnapshot(code) -> {session, rounds, opinions, clusters, participants} | null
//   getSession(code) -> session | null         // 입장 검증용 (await 가능)
//   sessionExists(code) -> bool                 // 입장 검증용 (await 가능)
//   subscribe(code, cb) -> unsubscribe          // 변경 시 cb(snapshot)
//   updateSession(code, patch)
//   joinSession(code, {nickname, role}) -> participantId
//   addRound(code, {question, direction, parentRoundId, responseType, scaleMax, scaleLabels}) -> roundId
//   updateRound(code, roundId, patch)
//   submitOpinion(code, {roundId, participantId, text, score})   // 1인 1응답(upsert)
//   seedOpinions(code, roundId, texts[], scores[])
//   setClusters(code, roundId, clusters[], briefing)
//   deleteOpinion(code, opinionId) · deleteCluster(code, clusterId)
//   listSessions() -> [{code, title, status}]
//
// ── Firebase 로 전환하는 법 ──────────────────────────────────
//   1) npm i firebase
//   2) .env 에 VITE_FIREBASE_* 값 채우기 (.env.example 참고)
//   3) 아래 import/Export 두 줄을 firebaseStore 로 교체
// ─────────────────────────────────────────────────────────────

// import { localStore } from './localStore.js'
import { firebaseStore } from './firebaseStore.js' // RTDB 기반 (다중 기기 실시간)

// export const store = localStore
export const store = firebaseStore
