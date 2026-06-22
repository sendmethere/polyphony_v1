import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { store } from '../lib/store.js'
import { setMember } from '../hooks/useSession.js'

export default function Landing() {
  const nav = useNavigate()
  const [mode, setMode] = useState(null) // null | 'teacher' | 'student'
  const [title, setTitle] = useState('')
  const [code, setCode] = useState('')
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState('')

  function createSession() {
    const newCode = store.createSession({ title: title.trim() || '제목 없는 세션' })
    const pid = store.joinSession(newCode, { nickname: '진행자', role: 'facilitator' })
    setMember(newCode, { id: pid, nickname: '진행자', role: 'facilitator' })
    nav(`/s/${newCode}/admin`)
  }

  async function joinAsTeacher() {
    setError('')
    const c = code.trim().toUpperCase()
    const session = await store.getSession(c) // localStore=동기값, firebaseStore=비동기 — 둘 다 await로 통일
    if (!session) return setError('존재하지 않는 세션 코드입니다.')
    const pid = store.joinSession(c, { nickname: '진행자', role: 'facilitator' })
    setMember(c, { id: pid, nickname: '진행자', role: 'facilitator' })
    nav(`/s/${c}/admin`)
  }

  async function joinAsStudent() {
    setError('')
    const c = code.trim().toUpperCase()
    if (!nickname.trim()) return setError('닉네임을 입력해 주세요.')
    const session = await store.getSession(c)
    if (!session) return setError('존재하지 않는 세션 코드입니다.')
    if (session.status === 'closed') return setError('이미 종료된 세션입니다.')
    const pid = store.joinSession(c, { nickname: nickname.trim(), role: 'student' })
    setMember(c, { id: pid, nickname: nickname.trim(), role: 'student' })
    nav(`/s/${c}/student`)
  }

  return (
    <div className="centered stack">
      <div>
        <h1 style={{ marginBottom: 4, letterSpacing: '-0.03em' }}>Polyphony 🎼</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          다성성(polyphony)을 드러내는 대화 도구 — 우세한 의견 대신, 살아있는 차이를 봅니다.
        </p>
      </div>

      {/* 1단계: 역할 선택 */}
      {!mode && (
        <div className="stack">
          <h3>어떤 역할로 들어오시나요?</h3>
          <div className="row" style={{ gap: 12 }}>
            <button
              className="role-pick"
              onClick={() => {
                setMode('teacher')
                setError('')
              }}
            >
              <div className="role-pick-emoji">🎛</div>
              <div className="role-pick-title">교사입니다</div>
              <div className="tiny muted">세션을 만들고 진행·모니터링합니다</div>
            </button>
            <button
              className="role-pick"
              onClick={() => {
                setMode('student')
                setError('')
              }}
            >
              <div className="role-pick-emoji">🎓</div>
              <div className="role-pick-title">학생입니다</div>
              <div className="tiny muted">코드로 참가해 의견을 냅니다</div>
            </button>
          </div>
        </div>
      )}

      {/* 2단계: 교사 */}
      {mode === 'teacher' && (
        <div className="stack">
          <button className="ghost tiny" style={{ alignSelf: 'flex-start' }} onClick={() => setMode(null)}>
            ← 역할 다시 선택
          </button>

          <div className="panel stack">
            <h3>새 세션 만들기</h3>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="세션 제목 (예: 좋은 질문이란 무엇인가)"
            />
            <button className="primary" onClick={createSession}>
              세션 만들기 →
            </button>
          </div>

          <div className="panel stack">
            <h3>기존 세션 진행 참가</h3>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="세션 코드 (예: ABCD)"
              style={{ fontFamily: 'ui-monospace, monospace', letterSpacing: '0.1em' }}
            />
            {error && <div className="banner warn tiny">{error}</div>}
            <button className="primary" onClick={joinAsTeacher}>
              진행자로 입장 →
            </button>
          </div>
        </div>
      )}

      {/* 2단계: 학생 */}
      {mode === 'student' && (
        <div className="stack">
          <button className="ghost tiny" style={{ alignSelf: 'flex-start' }} onClick={() => setMode(null)}>
            ← 역할 다시 선택
          </button>

          <div className="panel stack">
            <h3>학생으로 참가</h3>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="세션 코드 (예: ABCD)"
              style={{ fontFamily: 'ui-monospace, monospace', letterSpacing: '0.1em' }}
            />
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="닉네임 (무대에선 익명으로 표시됩니다)"
            />
            {error && <div className="banner warn tiny">{error}</div>}
            <button className="primary" onClick={joinAsStudent}>
              참가하기 →
            </button>
          </div>
        </div>
      )}

      <p className="tiny muted">
        팁: 같은 브라우저에서 탭을 여러 개 열어 교사/학생 화면을 동시에 띄우면 실시간으로 연동됩니다.
      </p>
      <p className="tiny">
        <a className="linklike" onClick={() => nav('/help')}>📖 사용 방법 보기</a>
      </p>
    </div>
  )
}
