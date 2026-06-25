import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { store } from '../lib/store.js'

// 비밀번호는 평문으로 저장하지 않고 SHA-256 해시만 저장·비교한다.
// ponytail: 단일 관리자용이라 솔트 없는 단순 해시. 다중 관리자/공격 모델이 생기면 PBKDF2/bcrypt 로.
async function sha256(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const AUTH_KEY = 'polyphony:adminAuthed' // 탭 새로고침 동안만 로그인 유지(sessionStorage)

export default function SiteAdmin() {
  const nav = useNavigate()
  const [hash, setHash] = useState(undefined) // undefined=로딩, null=미설정, string=설정됨
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(AUTH_KEY) === '1')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [error, setError] = useState('')
  const [sessions, setSessions] = useState(null)
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 10

  useEffect(() => {
    store.getAdminHash().then((h) => setHash(h ?? null)).catch(() => setHash(null))
  }, [])

  async function refresh() {
    setSessions(await store.listSessions())
  }
  useEffect(() => {
    if (authed) refresh()
  }, [authed])

  async function register() {
    setError('')
    if (pw.length < 4) return setError('비밀번호는 4자 이상으로 정해주세요.')
    if (pw !== pw2) return setError('두 비밀번호가 일치하지 않습니다.')
    const h = await sha256(pw)
    await store.setAdminHash(h)
    setHash(h)
    sessionStorage.setItem(AUTH_KEY, '1')
    setAuthed(true)
  }

  async function login() {
    setError('')
    if ((await sha256(pw)) !== hash) return setError('비밀번호가 틀렸습니다.')
    sessionStorage.setItem(AUTH_KEY, '1')
    setAuthed(true)
  }

  function toggleLock(s) {
    store.setLocked(s.code, !s.locked)
    setSessions((list) => list.map((x) => (x.code === s.code ? { ...x, locked: !x.locked } : x)))
  }

  async function remove(s) {
    if (!confirm(`세션 "${s.title || s.code}" 을(를) 완전히 삭제할까요?\n의견·군집·회고가 모두 사라지며 되돌릴 수 없습니다.`)) return
    await store.deleteSession(s.code)
    setSessions((list) => list.filter((x) => x.code !== s.code))
  }

  if (hash === undefined) return <div className="waiting">불러오는 중…</div>

  // ── 로그인 / 최초 비밀번호 등록 ──
  if (!authed) {
    const first = hash === null
    return (
      <div className="centered stack">
        <img className="landing-logo" src="/logo.png" alt="Polyphony" />
        <div className="panel stack" style={{ minWidth: 300 }}>
          <h3>{first ? '관리자 비밀번호 등록' : '관리자 로그인'}</h3>
          {first && (
            <p className="tiny muted">처음 등록하는 비밀번호가 관리자 비밀번호가 됩니다. 잊지 않도록 보관하세요.</p>
          )}
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !first && login()}
            placeholder="비밀번호"
            autoFocus
          />
          {first && (
            <input
              type="password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && register()}
              placeholder="비밀번호 확인"
            />
          )}
          {error && <div className="banner warn tiny">{error}</div>}
          <button className="primary" onClick={first ? register : login}>
            {first ? '등록하고 입장 →' : '입장 →'}
          </button>
          <a className="linklike tiny" onClick={() => nav('/')}>← 메인으로</a>
        </div>
      </div>
    )
  }

  // ── 세션 관리 대시보드 ──
  const sorted = [...(sessions || [])].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const curPage = Math.min(page, pageCount - 1)
  const pageRows = sorted.slice(curPage * PAGE_SIZE, curPage * PAGE_SIZE + PAGE_SIZE)
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="app-bar">
        <img className="brand-logo" src="/logo.png" alt="Polyphony" />
        <span className="role-tag admin">사이트 관리자</span>
        <span className="spacer" />
        <button className="ghost" onClick={refresh}>↻ 새로고침</button>
        <button
          className="ghost"
          onClick={() => {
            sessionStorage.removeItem(AUTH_KEY)
            setAuthed(false)
            setPw('')
          }}
        >
          로그아웃
        </button>
        <button className="ghost" onClick={() => nav('/')}>나가기 ✕</button>
      </div>

      <div style={{ padding: 24, maxWidth: 860, margin: '0 auto', width: '100%' }}>
        <h3>세션 관리 ({sorted.length})</h3>
        <p className="tiny muted">
          잠근 세션은 <b>읽기 전용</b>이 됩니다 — 학생 의견 제출·수정, 진행자의 세션 재개·편집이 모두 막힙니다.
        </p>
        {sessions === null ? (
          <div className="waiting">불러오는 중…</div>
        ) : sorted.length === 0 ? (
          <div className="banner info tiny">아직 만들어진 세션이 없습니다.</div>
        ) : (
          <>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>제목</th>
                  <th>코드</th>
                  <th>상태</th>
                  <th style={{ textAlign: 'right' }}>작업</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((s) => (
                  <tr key={s.code}>
                    <td style={{ fontWeight: 600 }}>{s.title || '제목 없는 세션'}</td>
                    <td><span className="code">{s.code}</span></td>
                    <td>
                      <span className={`pill ${s.status === 'closed' ? 'closed' : 'active'}`}>
                        {s.status === 'closed' ? '종료됨' : '진행중'}
                      </span>
                      {s.locked && <span className="pill locked" style={{ marginLeft: 6 }}>🔒 잠김</span>}
                    </td>
                    <td className="actions">
                      <Link className="linklike tiny" to={`/s/${s.code}/teacher`} target="_blank" style={{ marginRight: 10 }}>모니터링 ↗</Link>
                      <Link className="linklike tiny" to={`/s/${s.code}/admin`} target="_blank" style={{ marginRight: 10 }}>진행 ↗</Link>
                      <button onClick={() => toggleLock(s)}>
                        {s.locked ? '잠금 해제' : '잠그기'}
                      </button>
                      <button onClick={() => remove(s)}>삭제</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {pageCount > 1 && (
              <div className="pager">
                <button className="ghost" disabled={curPage === 0} onClick={() => setPage(curPage - 1)}>← 이전</button>
                <span className="tiny muted">{curPage + 1} / {pageCount}</span>
                <button className="ghost" disabled={curPage >= pageCount - 1} onClick={() => setPage(curPage + 1)}>다음 →</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
