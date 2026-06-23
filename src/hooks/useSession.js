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
