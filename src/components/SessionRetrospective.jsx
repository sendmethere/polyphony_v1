import { useState } from 'react'
import { createPortal } from 'react-dom'
import LevelDot from './LevelDot.jsx'
import { retrospectiveData } from '../lib/polyphony.js'

// 세션 종료 회고 — 질문별 브리핑·다양성 + 최고/최저 다양성 질문.
// 자동으로 뜨지 않는다. 📜 버튼을 눌러야 열린다.
export default function SessionRetrospective({ snapshot }) {
  const [open, setOpen] = useState(false)

  if (snapshot?.session?.status !== 'closed') return null

  const { entries, highest, lowest } = retrospectiveData(
    snapshot.rounds,
    snapshot.clusters,
    snapshot.opinions
  )

  return (
    <>
      <button onClick={() => setOpen(true)}>📜 세션 회고</button>
      {open && createPortal(
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="expanded retro" onClick={(e) => e.stopPropagation()}>
            <div className="retro-scroll">
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h2 style={{ margin: 0 }}>세션 회고 — {snapshot.session.title}</h2>
                <button className="ghost" onClick={() => setOpen(false)}>✕ 닫기</button>
              </div>

              {/* AI 비위계적 voice 요약 */}
              {snapshot.session.retrospective && (
                <div className="banner info" style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>
                  {snapshot.session.retrospective}
                </div>
              )}

              {/* 최고/최저 다양성 질문 */}
              {highest && (
                <div className="retro-highlights">
                  <div className="retro-hl">
                    <div className="tiny muted">가장 다양성이 높았던 질문 🟢</div>
                    <div className="retro-hl-q">{highest.round.question}</div>
                    <div className="tiny">
                      <LevelDot value={highest.diversity} withLabel /> 다양성 {Math.round(highest.diversity * 100)}%
                    </div>
                  </div>
                  <div className="retro-hl">
                    <div className="tiny muted">가장 다양성이 낮았던 질문 🔴</div>
                    <div className="retro-hl-q">{lowest.round.question}</div>
                    <div className="tiny">
                      <LevelDot value={lowest.diversity} withLabel /> 다양성 {Math.round(lowest.diversity * 100)}%
                    </div>
                  </div>
                </div>
              )}

              {/* 질문별 브리핑 */}
              <h3 style={{ marginBottom: 4 }}>질문별 돌아보기</h3>
              <div className="stack" style={{ gap: 12 }}>
                {entries.map((e) => (
                  <div key={e.round.id} className="retro-round">
                    <div className="kicker">라운드 {e.round.index + 1}</div>
                    <div className="retro-hl-q" style={{ fontSize: 16 }}>{e.round.question}</div>
                    {e.hasClusters ? (
                      <>
                        <div className="tiny" style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 10px', margin: '4px 0' }}>
                          {e.metrics.map((m) => (
                            <span key={m.id}>
                              <span className="level-dot" style={{ background: m.band.color }} /> {m.short} {m.text}
                            </span>
                          ))}
                          <span className="muted">· 의견 {e.opinionCount}개</span>
                        </div>
                        {e.round.briefing && <div className="summary">{e.round.briefing}</div>}
                        <div className="retro-voices">
                          {e.clusters.map((c) => (
                            <span key={c.id} className="retro-voice">{c.label}</span>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="tiny muted">군집화되지 않은 라운드</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
