import { useEffect, useState } from 'react'
import { store } from '../lib/store.js'

// 세션 스냅샷을 실시간 구독하는 훅.
// 반환: { snapshot, loading } — snapshot = {session, rounds, opinions, clusters, participants}
export function useSession(code) {
  const [snapshot, setSnapshot] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!code) return
    setLoading(true)
    setSnapshot(null)
    let settled = false
    const unsub = store.subscribe(code, (snap) => {
      settled = true
      setSnapshot(snap)
      setLoading(false)
    })
    // 비동기 백엔드(Firebase)는 데이터가 도착해야 콜백이 온다.
    // 도착 전까지 loading 유지 → "찾을 수 없음"이 깜빡이지 않음.
    // 진짜 없는 세션이 콜백을 안 줄 수도 있어, 안전망 타임아웃으로 not-found 확정.
    const t = setTimeout(() => {
      if (!settled) setLoading(false)
    }, 4000)
    return () => {
      clearTimeout(t)
      unsub()
    }
  }, [code])

  return { snapshot, loading }
}

// 참가자 식별자(닉/역할/id)를 localStorage 에 보관 (탭 새로고침 유지)
const MEMBER_KEY = (code) => `polyphony:member:${code}`

export function getMember(code) {
  const raw = localStorage.getItem(MEMBER_KEY(code))
  return raw ? JSON.parse(raw) : null
}

export function setMember(code, member) {
  localStorage.setItem(MEMBER_KEY(code), JSON.stringify(member))
}

// 최근 입장한 세션 기록 (이 브라우저 기준). 메인화면에서 다시 입장하는 용도.
const RECENT_KEY = 'polyphony:recent'

export function getRecentSessions(limit = 5) {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
    return list.sort((a, b) => b.ts - a.ts).slice(0, limit)
  } catch {
    return []
  }
}

export function addRecentSession({ code, title, role }) {
  let list = []
  try {
    list = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
  } catch {
    list = []
  }
  list = list.filter((s) => s.code !== code) // 중복 제거(최신으로 갱신)
  list.unshift({ code, title: title || '제목 없는 세션', role, ts: Date.now() })
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 20)))
}

export function removeRecentSession(code) {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]').filter((s) => s.code !== code)
    localStorage.setItem(RECENT_KEY, JSON.stringify(list))
  } catch {
    /* noop */
  }
}
