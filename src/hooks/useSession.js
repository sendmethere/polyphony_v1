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
    const unsub = store.subscribe(code, (snap) => {
      setSnapshot(snap)
      setLoading(false)
    })
    // 구독 직후에도 존재 여부 확정
    const initial = store.getSnapshot(code)
    if (!initial) setLoading(false)
    return unsub
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
