import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSession } from '../hooks/useSession.js'
import Canvas from '../components/Canvas.jsx'
import PolyphonyMeter from '../components/PolyphonyMeter.jsx'
import SessionRetrospective from '../components/SessionRetrospective.jsx'
import RetrospectiveList from '../components/RetrospectiveList.jsx'
import PhaseBar from '../components/PhaseBar.jsx'

export default function TeacherView() {
  const { code } = useParams()
  const nav = useNavigate()
  const { snapshot, loading } = useSession(code)
  const [analysisOpen, setAnalysisOpen] = useState(false) // 교사 뷰 기본 접힘

  if (loading) return <div className="waiting">불러오는 중…</div>
  if (!snapshot) return <div className="waiting">세션을 찾을 수 없습니다.</div>

  const { session, rounds, opinions, clusters, participants } = snapshot
  const students = participants.filter((p) => p.role === 'student')
  const currentRound = rounds.find((r) => r.id === session.currentRoundId)
  const submitted = currentRound
    ? opinions.filter((o) => o.roundId === currentRound.id).length
    : 0

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="app-bar">
        <span className="brand">Polyphony</span>
        <span className="role-tag teacher">모니터링 (교사)</span>
        <span className="muted tiny">{session.title}</span>
        <span className="spacer" />
        <span className="tiny muted">읽기 전용 · 조작 불가</span>
        <SessionRetrospective snapshot={snapshot} />
        <span className="code">{code}</span>
        <button className="ghost" onClick={() => nav('/')} title="메인 화면으로 나가기">
          나가기 ✕
        </button>
      </div>

      <PhaseBar round={currentRound} sessionClosed={session.status === 'closed'} />

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* 무대는 학생과 동일하게 동등 표현 (우세 은폐) */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div className="canvas-toolbar">
            <button className="ghost tiny" onClick={() => setAnalysisOpen((o) => !o)}>
              {analysisOpen ? '🔍 분석 숨기기 ▾' : '🔍 분석 보기 ▸'}
            </button>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <Canvas
              snapshot={snapshot}
              mode="stage"
              showOpinions
              showBriefing={analysisOpen}
              showMetrics={analysisOpen}
              hideParametric
            />
          </div>
        </div>

        {/* 모니터링 지표 — 학생 무대엔 절대 없는 내부 데이터 */}
        <div style={{ flex: '0 0 300px', borderLeft: '1px solid var(--paper-line)', padding: 18, overflowY: 'auto', minHeight: 0 }}>
          <div className="panel stack">
            <h3>① 참여 현황</h3>
            {currentRound ? (
              <>
                <div className="tiny">
                  응답 제출 <b>{submitted}</b> / 학생 {students.length}명
                </div>
                <div className="meter">
                  <span style={{ width: students.length ? `${(submitted / students.length) * 100}%` : '0%' }} />
                </div>
              </>
            ) : (
              <div className="tiny muted">진행 중인 라운드 없음</div>
            )}
          </div>

          <div style={{ marginTop: 12 }}>
            <PolyphonyMeter rounds={rounds} clusters={clusters} opinions={opinions} />
          </div>

          {session.status === 'closed' && (
            <div style={{ marginTop: 12 }}>
              <RetrospectiveList snapshot={snapshot} />
            </div>
          )}

          <div className="panel stack" style={{ marginTop: 12 }}>
            <h3>라운드별 등장한 voice</h3>
            <p className="tiny muted">인원수·우세도는 표시하지 않습니다. 어떤 관점들이 살아있었는지만.</p>
            {[...rounds]
              .sort((a, b) => b.index - a.index)
              .map((r) => {
                const cs = clusters.filter((c) => c.roundId === r.id)
                return (
                  <div key={r.id} className="tiny" style={{ marginBottom: 6 }}>
                    <div className="muted">라운드 {r.index + 1}</div>
                    {cs.length ? (
                      cs.map((c) => <div key={c.id}>· {c.label}</div>)
                    ) : (
                      <div>· 아직 군집 없음</div>
                    )}
                  </div>
                )
              })}
          </div>
        </div>
      </div>
    </div>
  )
}
