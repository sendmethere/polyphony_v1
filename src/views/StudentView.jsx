import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSession, getMember } from '../hooks/useSession.js'
import { store } from '../lib/store.js'
import Canvas from '../components/Canvas.jsx'
import SessionRetrospective from '../components/SessionRetrospective.jsx'

export default function StudentView() {
  const { code } = useParams()
  const nav = useNavigate()
  const { snapshot, loading } = useSession(code)
  const member = getMember(code)
  const [text, setText] = useState('')
  const [score, setScore] = useState(null)
  const [justSaved, setJustSaved] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(true)

  const session = snapshot?.session
  const currentRound = snapshot?.rounds?.find((r) => r.id === session?.currentRoundId)
  const myOpinion = snapshot?.opinions?.find(
    (o) => o.roundId === currentRound?.id && o.participantId === member?.id
  )

  // 라운드가 바뀌면 입력칸 초기화 / 기존 응답 로드
  useEffect(() => {
    setText(myOpinion?.text || '')
    setScore(myOpinion?.score ?? null)
    setJustSaved(false)
  }, [currentRound?.id]) // eslint-disable-line

  if (!member) {
    return (
      <div className="centered stack">
        <div className="banner warn">먼저 세션에 참가해 주세요.</div>
        <button onClick={() => nav('/')}>입장 화면으로</button>
      </div>
    )
  }
  if (loading) return <div className="waiting">불러오는 중…</div>
  if (!session) return <div className="waiting">세션을 찾을 수 없습니다.</div>

  const isScale = currentRound?.responseType === 'scale'
  const canSubmit = currentRound && !session.locked && (isScale ? score != null : text.trim())

  function submit() {
    if (!canSubmit) return
    store.submitOpinion(code, {
      roundId: currentRound.id,
      participantId: member.id,
      text: text.trim(),
      score: isScale ? score : null,
    })
    setJustSaved(true)
  }

  // 종료 → 읽기전용 회고
  if (session.status === 'closed') {
    return (
      <Shell code={code} title={session.title} snapshot={snapshot} onExit={() => nav('/')}>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div className="banner info" style={{ margin: '12px 24px 0' }}>
            이 대화는 마무리되었습니다. 전체 전개를 가로로 돌아볼 수 있어요.
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <Canvas snapshot={snapshot} mode="stage" showOpinions />
          </div>
        </div>
      </Shell>
    )
  }

  // 학생이 보는 캔버스: 이전 라운드 + "군집화가 끝난" 현재 라운드까지.
  //  - 수집 중(질문 시작)인 라운드는 숨김(아래 입력칸으로만) → 의견 형성 중엔 결과를 안 보여줌.
  //  - 현재 라운드도 status==='clustered' 가 되면(군집 끝) 결과를 무대에 노출.
  const historySnapshot = {
    ...snapshot,
    rounds: (snapshot.rounds || []).filter(
      (r) => r.id !== session.currentRoundId || r.status === 'clustered'
    ),
  }
  const hasHistory = historySnapshot.rounds.length > 0

  return (
    <Shell code={code} title={session.title} snapshot={snapshot} onExit={() => nav('/')}>
      {/* 위: 지금까지의 대화 (접었다 폈다) */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: historyOpen ? 1 : '0 0 auto',
          minHeight: 0,
        }}
      >
        <button
          className="ghost tiny"
          onClick={() => setHistoryOpen((o) => !o)}
          style={{ textAlign: 'left', padding: '10px 24px 6px', color: 'var(--ink-soft)' }}
        >
          🎼 지금까지의 대화 {historyOpen ? '▾ 접기' : '▸ 펴기'}
        </button>
        {historyOpen &&
          (hasHistory ? (
            <div style={{ flex: 1, minHeight: 0 }}>
              <Canvas snapshot={historySnapshot} mode="stage" showOpinions />
            </div>
          ) : (
            <div className="waiting" style={{ flex: 1 }}>
              <div className="pulse">대화가 시작되면 여기에 지금까지의 흐름이 쌓입니다.</div>
            </div>
          ))}
      </div>

      {/* 아래: 항상 고정된 응답 작성칸 */}
      <div className="composer">
        {!currentRound ? (
          <div className="pulse tiny muted">진행자가 첫 질문을 준비하고 있습니다…</div>
        ) : (
          <>
            <div className="kicker">현재 질문</div>
            <div className="q" style={{ fontSize: 17, marginBottom: 8 }}>
              {currentRound.question}
            </div>
            {session.locked ? (
              <div className="pulse tiny muted">🔒 이 세션은 잠겨 있어 읽기 전용입니다. 응답을 제출·수정할 수 없습니다.</div>
            ) : currentRound.status === 'collecting' ? (
              <div className="stack" style={{ gap: 8 }}>
                {isScale && (
                  <div className="likert">
                    <span className="tiny muted likert-anchor">
                      1점<br />{currentRound.scaleLabels?.min || '전혀 아니다'}
                    </span>
                    {Array.from({ length: currentRound.scaleMax }, (_, i) => i + 1).map((v) => (
                      <button
                        key={v}
                        className={`likert-pt ${score === v ? 'on' : ''}`}
                        onClick={() => {
                          setScore(v)
                          setJustSaved(false)
                        }}
                      >
                        {v}
                      </button>
                    ))}
                    <span className="tiny muted likert-anchor">
                      {currentRound.scaleMax}점<br />{currentRound.scaleLabels?.max || '매우 그렇다'}
                    </span>
                  </div>
                )}
                <div className="row" style={{ alignItems: 'flex-end' }}>
                  <textarea
                    value={text}
                    onChange={(e) => {
                      setText(e.target.value)
                      setJustSaved(false)
                    }}
                    placeholder={isScale ? '점수를 고른 이유를 적어주세요 (선택)' : '당신의 생각을 적어주세요. 정답은 없습니다.'}
                    style={{ minHeight: 56 }}
                  />
                  <button
                    className="primary"
                    onClick={submit}
                    disabled={!canSubmit}
                    style={{ flex: '0 0 auto' }}
                  >
                    {myOpinion ? '수정' : '제출'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="pulse tiny muted">응답이 마감되었습니다. 다음 질문을 기다리는 중…</div>
            )}
            {justSaved && (
              <div className="banner info tiny" style={{ marginTop: 8 }}>
                제출되었습니다. 언제든 수정할 수 있어요.
              </div>
            )}
          </>
        )}
      </div>
    </Shell>
  )
}

function Shell({ code, title, snapshot, onExit, children }) {
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="app-bar">
        <img className="brand-logo" src="/logo.png" alt="Polyphony" />
        <span className="role-tag student">학생</span>
        <span className="muted tiny">{title}</span>
        <span className="spacer" />
        {snapshot && <SessionRetrospective snapshot={snapshot} />}
        <span className="code">{code}</span>
        <button className="ghost" onClick={onExit} title="메인 화면으로 나가기">
          나가기 ✕
        </button>
      </div>
      {children}
    </div>
  )
}
