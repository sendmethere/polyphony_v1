// ─────────────────────────────────────────────────────────────
// firebaseStore — Firebase Realtime Database(RTDB) 기반 데이터 계층.
// localStore 와 동일한 인터페이스. 다중 기기 실시간 동기화.
//
// 트리 구조:
//   sessions/{code}/session           = 세션 메타
//   sessions/{code}/rounds/{roundId}  = 라운드
//   sessions/{code}/opinions/{opId}   = 의견  (opId = `${roundId}__${participantId}` → 1인1응답 upsert)
//   sessions/{code}/clusters/{cId}    = 군집
//   sessions/{code}/participants/{pId}= 참가자
//
// - subscribe 는 sessions/{code} 서브트리 전체를 onValue 로 구독(우리 규모엔 단순·충분).
// - 다른 경로 동시 쓰기는 서로 덮어쓰지 않음(학생 동시 제출 안전).
// - 화면의 동기 인터페이스 유지를 위해 낙관적 로컬 미러(mirror)도 갱신.
//
// TODO(운영): RTDB 보안 규칙(학생은 자기 의견만 쓰기 등), 익명 인증.
// ─────────────────────────────────────────────────────────────

import { initializeApp } from 'firebase/app'
import { getDatabase, ref, onValue, set, update, get } from 'firebase/database'
import { makeSessionCode, makeId } from './id.js'

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MSG_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  databaseURL: import.meta.env.VITE_FIREBASE_REALTIME_DB_URL,
})
const db = getDatabase(app)

const nowIso = () => new Date().toISOString()
const sRef = (code, path = '') => ref(db, `sessions/${code}${path ? '/' + path : ''}`)

// RTDB 는 undefined 를 허용하지 않음 → null/생략으로 정리
const clean = (obj) => {
  const out = {}
  for (const k in obj) out[k] = obj[k] === undefined ? null : obj[k]
  return out
}

const mirror = new Map() // code -> snapshot
const subs = new Map() // code -> { cbs:Set, unsub }

function toSnapshot(val) {
  const v = val || {}
  return {
    session: v.session || null,
    rounds: Object.values(v.rounds || {}),
    opinions: Object.values(v.opinions || {}),
    clusters: Object.values(v.clusters || {}),
    participants: Object.values(v.participants || {}),
  }
}
function ensure(code) {
  if (!mirror.has(code)) mirror.set(code, toSnapshot(null))
  return mirror.get(code)
}
function emit(code) {
  const snap = mirror.get(code)
  const s = subs.get(code)
  if (!snap || !snap.session || !s) return
  for (const cb of s.cbs) cb({ ...snap })
}

export const firebaseStore = {
  createSession({ title = '', model = 'claude-opus-4-8' } = {}) {
    const code = makeSessionCode()
    const session = {
      id: code, title, status: 'active', currentRoundId: null,
      studentReactionMode: false, model, createdAt: nowIso(), retrospective: null,
    }
    ensure(code).session = session
    set(sRef(code, 'session'), clean(session)).catch(console.error)
    return code
  },

  getSnapshot(code) {
    const s = mirror.get(code)
    return s && s.session ? { ...s } : null
  },

  async getSession(code) {
    const cached = mirror.get(code)?.session
    if (cached) return cached
    const snap = await get(sRef(code, 'session'))
    return snap.exists() ? snap.val() : null
  },
  async sessionExists(code) {
    if (mirror.get(code)?.session) return true
    const snap = await get(sRef(code, 'session'))
    return snap.exists()
  },

  subscribe(code, cb) {
    ensure(code)
    if (!subs.has(code)) {
      const entry = { cbs: new Set(), unsub: null }
      entry.unsub = onValue(sRef(code), (snap) => {
        mirror.set(code, toSnapshot(snap.val()))
        emit(code)
      })
      subs.set(code, entry)
    }
    const entry = subs.get(code)
    entry.cbs.add(cb)
    const cur = mirror.get(code)
    if (cur && cur.session) cb({ ...cur })
    return () => {
      entry.cbs.delete(cb)
      if (entry.cbs.size === 0) {
        entry.unsub && entry.unsub()
        subs.delete(code)
      }
    }
  },

  updateSession(code, patch) {
    const m = ensure(code)
    if (m.session) m.session = { ...m.session, ...patch }
    emit(code)
    update(sRef(code, 'session'), clean(patch)).catch(console.error)
  },

  joinSession(code, { nickname, role }) {
    const id = makeId('p')
    const p = { id, nickname, role, joinedAt: nowIso() }
    ensure(code).participants.push(p)
    emit(code)
    set(sRef(code, `participants/${id}`), p).catch(console.error)
    return id
  },

  addRound(code, { question, direction = 'seed', parentRoundId = null, responseType = 'open', scaleMax = 5, scaleLabels = null }) {
    const m = ensure(code)
    const id = makeId('r')
    const round = clean({
      id, index: m.rounds.length, question, direction, responseType, scaleMax, scaleLabels,
      status: 'collecting', parentRoundId, createdAt: nowIso(),
    })
    m.rounds.push(round)
    if (m.session) m.session.currentRoundId = id
    emit(code)
    update(sRef(code), { [`rounds/${id}`]: round, 'session/currentRoundId': id }).catch(console.error)
    return id
  },

  updateRound(code, roundId, patch) {
    const r = ensure(code).rounds.find((x) => x.id === roundId)
    if (r) Object.assign(r, patch)
    emit(code)
    update(sRef(code, `rounds/${roundId}`), clean(patch)).catch(console.error)
  },

  submitOpinion(code, { roundId, participantId, text, score = null }) {
    const m = ensure(code)
    const id = `${roundId}__${participantId}`
    const existing = m.opinions.find((o) => o.id === id)
    const o = clean({ id, roundId, participantId, text, score, createdAt: existing?.createdAt || nowIso(), updatedAt: nowIso() })
    if (existing) Object.assign(existing, o)
    else m.opinions.push(o)
    emit(code)
    set(sRef(code, `opinions/${id}`), o).catch(console.error)
  },

  seedOpinions(code, roundId, texts, scores = []) {
    const m = ensure(code)
    const updates = {}
    const synth = m.participants.filter((p) => p.role === 'student' && p.synthetic)
    const answered = new Set(m.opinions.filter((o) => o.roundId === roundId).map((o) => o.participantId))
    const available = synth.filter((p) => !answered.has(p.id))
    texts.forEach((text, i) => {
      let pid
      if (available[i]) {
        pid = available[i].id
      } else {
        pid = makeId('p')
        const n = m.participants.filter((p) => p.synthetic).length + 1
        const p = { id: pid, nickname: `테스트${n}`, role: 'student', joinedAt: nowIso(), synthetic: true }
        m.participants.push(p)
        updates[`participants/${pid}`] = p
      }
      const id = `${roundId}__${pid}`
      const o = clean({ id, roundId, participantId: pid, text, score: typeof scores[i] === 'number' ? scores[i] : null, createdAt: nowIso() })
      const ex = m.opinions.find((x) => x.id === id)
      if (ex) Object.assign(ex, o)
      else m.opinions.push(o)
      updates[`opinions/${id}`] = o
    })
    emit(code)
    update(sRef(code), updates).catch(console.error)
  },

  setClusters(code, roundId, clusters, briefing = '') {
    const m = ensure(code)
    const updates = {}
    // 기존 군집 제거
    m.clusters.filter((c) => c.roundId === roundId).forEach((c) => { updates[`clusters/${c.id}`] = null })
    m.clusters = m.clusters.filter((c) => c.roundId !== roundId)
    clusters.forEach((c, i) => {
      const id = c.id || makeId('c')
      const cl = clean({
        id, roundId, label: c.label, summary: c.summary || '',
        opinionIds: c.opinionIds || [], parentClusterIds: c.parentClusterIds || [],
        colorIndex: c.colorIndex ?? i, isOutlier: !!c.isOutlier,
      })
      m.clusters.push(cl)
      updates[`clusters/${id}`] = cl
    })
    const r = m.rounds.find((x) => x.id === roundId)
    if (r) {
      r.status = 'clustered'
      if (briefing) r.briefing = briefing
      updates[`rounds/${roundId}/status`] = 'clustered'
      updates[`rounds/${roundId}/briefing`] = briefing || r.briefing || ''
    }
    emit(code)
    update(sRef(code), updates).catch(console.error)
  },

  deleteOpinion(code, opinionId) {
    const m = ensure(code)
    m.opinions = m.opinions.filter((o) => o.id !== opinionId)
    const updates = { [`opinions/${opinionId}`]: null }
    m.clusters.forEach((c) => {
      if ((c.opinionIds || []).includes(opinionId)) {
        c.opinionIds = c.opinionIds.filter((id) => id !== opinionId)
        updates[`clusters/${c.id}/opinionIds`] = c.opinionIds
      }
    })
    emit(code)
    update(sRef(code), updates).catch(console.error)
  },

  deleteCluster(code, clusterId) {
    const m = ensure(code)
    const target = m.clusters.find((c) => c.id === clusterId)
    if (!target) return
    const ids = new Set(target.opinionIds || [])
    const updates = { [`clusters/${clusterId}`]: null }
    m.opinions.filter((o) => ids.has(o.id)).forEach((o) => { updates[`opinions/${o.id}`] = null })
    m.opinions = m.opinions.filter((o) => !ids.has(o.id))
    m.clusters = m.clusters.filter((c) => c.id !== clusterId)
    emit(code)
    update(sRef(code), updates).catch(console.error)
  },

  async listSessions() {
    const snap = await get(ref(db, 'sessions'))
    const v = snap.val() || {}
    return Object.entries(v).map(([code, s]) => ({ code, title: s.session?.title, status: s.session?.status }))
  },
}
