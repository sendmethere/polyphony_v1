// ─────────────────────────────────────────────────────────────
// localStore — localStorage + BroadcastChannel 기반 데이터 계층.
// 같은 브라우저의 여러 탭(학생/관리자/교사) 사이에서 실시간 동기화.
// 인터페이스는 store.js 주석 참고. (firebaseStore.js 가 동일 인터페이스 구현)
// ─────────────────────────────────────────────────────────────

import { makeSessionCode, makeId } from './id.js'

const KEY = (code) => `polyphony:session:${code}`
const INDEX_KEY = 'polyphony:index'
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('polyphony') : null

const localListeners = new Map() // code -> Set<cb>

function notifyLocal(code) {
  const set = localListeners.get(code)
  if (!set) return
  const snap = read(code)
  for (const cb of set) cb(snap)
}

function read(code) {
  const raw = localStorage.getItem(KEY(code))
  return raw ? JSON.parse(raw) : null
}

function write(code, snapshot) {
  localStorage.setItem(KEY(code), JSON.stringify(snapshot))
  notifyLocal(code)
  if (channel) channel.postMessage({ type: 'change', code })
}

function touchIndex(code, title, status) {
  const raw = localStorage.getItem(INDEX_KEY)
  const idx = raw ? JSON.parse(raw) : {}
  idx[code] = { code, title, status }
  localStorage.setItem(INDEX_KEY, JSON.stringify(idx))
}

function nowIso() {
  return new Date().toISOString()
}

export const localStore = {
  createSession({ title = '', model = 'claude-opus-4-8' } = {}) {
    let code = makeSessionCode()
    while (read(code)) code = makeSessionCode()
    const snapshot = {
      session: {
        id: code,
        title,
        status: 'active',
        currentRoundId: null,
        studentReactionMode: false,
        model,
        createdAt: nowIso(),
        retrospective: null,
      },
      rounds: [],
      opinions: [],
      clusters: [],
      participants: [],
    }
    write(code, snapshot)
    touchIndex(code, title, 'active')
    return code
  },

  getSnapshot(code) {
    return read(code)
  },

  // 존재/세션 확인 (입장 검증용). async 인터페이스로 통일(firebaseStore 와 호환).
  getSession(code) {
    const s = read(code)
    return s ? s.session : null
  },
  sessionExists(code) {
    return read(code) != null
  },

  subscribe(code, cb) {
    const handler = (snap) => snap && cb(snap)
    const initial = read(code)
    if (initial) cb(initial)
    if (!localListeners.has(code)) localListeners.set(code, new Set())
    localListeners.get(code).add(cb)
    const onStorage = (e) => {
      if (e.key === KEY(code)) handler(read(code))
    }
    const onMessage = (e) => {
      if (e.data?.type === 'change' && e.data.code === code) handler(read(code))
    }
    window.addEventListener('storage', onStorage)
    if (channel) channel.addEventListener('message', onMessage)
    return () => {
      localListeners.get(code)?.delete(cb)
      window.removeEventListener('storage', onStorage)
      if (channel) channel.removeEventListener('message', onMessage)
    }
  },

  updateSession(code, patch) {
    const snap = read(code)
    if (!snap) return
    snap.session = { ...snap.session, ...patch }
    write(code, snap)
    if (patch.title !== undefined || patch.status !== undefined) {
      touchIndex(code, snap.session.title, snap.session.status)
    }
  },

  joinSession(code, { nickname, role }) {
    const snap = read(code)
    if (!snap) return null
    const id = makeId('p')
    snap.participants.push({ id, nickname, role, joinedAt: nowIso() })
    write(code, snap)
    return id
  },

  addRound(code, { question, direction = 'seed', parentRoundId = null, responseType = 'open', scaleMax = 5, scaleLabels = null }) {
    const snap = read(code)
    if (!snap) return null
    const id = makeId('r')
    const index = snap.rounds.length
    snap.rounds.push({
      id, index, question, direction, responseType, scaleMax, scaleLabels,
      status: 'collecting', parentRoundId, createdAt: nowIso(),
    })
    snap.session.currentRoundId = id
    write(code, snap)
    return id
  },

  updateRound(code, roundId, patch) {
    const snap = read(code)
    if (!snap) return
    const r = snap.rounds.find((x) => x.id === roundId)
    if (!r) return
    Object.assign(r, patch)
    write(code, snap)
  },

  submitOpinion(code, { roundId, participantId, text, score = null }) {
    const snap = read(code)
    if (!snap) return
    const existing = snap.opinions.find((o) => o.roundId === roundId && o.participantId === participantId)
    if (existing) {
      existing.text = text
      existing.score = score
      existing.updatedAt = nowIso()
    } else {
      snap.opinions.push({ id: makeId('o'), roundId, participantId, text, score, createdAt: nowIso() })
    }
    write(code, snap)
  },

  seedOpinions(code, roundId, texts, scores = []) {
    const snap = read(code)
    if (!snap) return
    const synth = snap.participants.filter((p) => p.role === 'student' && p.synthetic)
    const answered = new Set(snap.opinions.filter((o) => o.roundId === roundId).map((o) => o.participantId))
    const available = synth.filter((p) => !answered.has(p.id))
    texts.forEach((text, i) => {
      let pid
      if (available[i]) {
        pid = available[i].id
      } else {
        pid = makeId('p')
        const n = snap.participants.filter((p) => p.synthetic).length + 1
        snap.participants.push({ id: pid, nickname: `테스트${n}`, role: 'student', joinedAt: nowIso(), synthetic: true })
      }
      snap.opinions.push({
        id: makeId('o'), roundId, participantId: pid, text,
        score: typeof scores[i] === 'number' ? scores[i] : null, createdAt: nowIso(),
      })
    })
    write(code, snap)
  },

  setClusters(code, roundId, clusters, briefing = '') {
    const snap = read(code)
    if (!snap) return
    snap.clusters = snap.clusters.filter((c) => c.roundId !== roundId)
    clusters.forEach((c, i) => {
      snap.clusters.push({
        id: c.id || makeId('c'), roundId, label: c.label, summary: c.summary || '',
        opinionIds: c.opinionIds || [], parentClusterIds: c.parentClusterIds || [],
        colorIndex: c.colorIndex ?? i, isOutlier: !!c.isOutlier,
      })
    })
    const r = snap.rounds.find((x) => x.id === roundId)
    if (r) {
      r.status = 'clustered'
      if (briefing) r.briefing = briefing
    }
    write(code, snap)
  },

  deleteOpinion(code, opinionId) {
    const snap = read(code)
    if (!snap) return
    snap.opinions = snap.opinions.filter((o) => o.id !== opinionId)
    snap.clusters.forEach((c) => {
      c.opinionIds = (c.opinionIds || []).filter((id) => id !== opinionId)
    })
    write(code, snap)
  },

  deleteCluster(code, clusterId) {
    const snap = read(code)
    if (!snap) return
    const target = snap.clusters.find((c) => c.id === clusterId)
    if (!target) return
    const ids = new Set(target.opinionIds || [])
    snap.opinions = snap.opinions.filter((o) => !ids.has(o.id))
    snap.clusters = snap.clusters.filter((c) => c.id !== clusterId)
    write(code, snap)
  },

  listSessions() {
    const raw = localStorage.getItem(INDEX_KEY)
    return raw ? Object.values(JSON.parse(raw)) : []
  },
}
