import { voiceColor, voiceColorSoft } from '../lib/colors.js'

const DIR_LABEL = { seed: '시작', deepen: '심화 ⤵', shift: '전환 ↔' }

// 한 라운드를 크게 펼쳐 보는 뷰.
//  좌측: 질문 + 브리핑
//  우측: 의견 군집 카드들 (소제목 + 개요 + 대표의견 1개)
// 모든 역할(관리자·교사·학생)에서 열람 가능. 우세는 드러내지 않는다(대표의견 1개, 카운트 없음).
export default function ExpandedRound({ round, clusters, opinions, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="expanded" onClick={(e) => e.stopPropagation()}>
        {/* 좌측: 질문 · 브리핑 */}
        <aside className="expanded-side">
          <div className="kicker">라운드 {round.index + 1}</div>
          <div className={`dir ${round.direction}`}>{DIR_LABEL[round.direction] || ''}</div>
          <h2 className="expanded-q">{round.question}</h2>
          {round.briefing && (
            <div className="expanded-briefing">
              <div className="kicker">📋 브리핑</div>
              <p>{round.briefing}</p>
            </div>
          )}
          <button className="ghost" onClick={onClose} style={{ marginTop: 'auto' }}>
            ✕ 닫기
          </button>
        </aside>

        {/* 우측: 의견 카드 */}
        <section className="expanded-main">
          {clusters.length === 0 ? (
            <div className="muted">아직 군집이 없습니다.</div>
          ) : (
            <div className="expanded-grid">
              {clusters.map((c) => {
                const rep = opinions.find((o) => c.opinionIds?.includes(o.id))
                return (
                  <div
                    key={c.id}
                    className="cluster-card big"
                    style={{ '--voice': voiceColor(c.colorIndex ?? 0), '--voice-soft': voiceColorSoft(c.colorIndex ?? 0) }}
                  >
                    <div className="label" style={{ fontSize: 16 }}>
                      {c.label}
                    </div>
                    {c.summary && <div className="summary">{c.summary}</div>}
                    {rep && (
                      <div className="opinions">
                        <div className="op">
                          <span>
                            {typeof rep.score === 'number' && <span className="op-score">{rep.score}점</span>}
                            {rep.text || <span className="muted">(점수만)</span>}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
