import { retrospectiveData } from '../lib/polyphony.js'
import { BandDot, THREAD_COLORS } from './DiversityThreads.jsx'

// 우측 패널용 컴팩트 "질문별 돌아보기" — 최고/최저 다양성 + 라운드별 지표(레지스트리 기반).
export default function RetrospectiveList({ snapshot }) {
  const { entries, highest, lowest } = retrospectiveData(snapshot.rounds, snapshot.clusters, snapshot.opinions)

  return (
    <div className="panel stack">
      <h3>질문별 돌아보기</h3>

      {highest && (
        <div className="tiny" style={{ lineHeight: 1.5 }}>
          <div>
            <span style={{ color: '#2e7d52', fontWeight: 700 }}>최고 개방성</span> · {Math.round(highest.diversity * 100)}%
            <div className="muted">{highest.round.question}</div>
          </div>
          <div style={{ marginTop: 4 }}>
            <span style={{ color: '#b5482f', fontWeight: 700 }}>최저 개방성</span> · {Math.round(lowest.diversity * 100)}%
            <div className="muted">{lowest.round.question}</div>
          </div>
        </div>
      )}

      <div className="divider" />

      {entries.map((e) => (
        <div key={e.round.id} className="tiny" style={{ marginBottom: 8 }}>
          <div className="muted">라운드 {e.round.index + 1}</div>
          <div style={{ fontWeight: 600 }}>{e.round.question}</div>
          {e.hasClusters ? (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 10px', margin: '3px 0' }}>
                {e.metrics.map((m) => (
                  <span key={m.id}>
                    <BandDot band={m.band} color={THREAD_COLORS[m.id]} />
                    <b style={{ color: THREAD_COLORS[m.id] || '#888' }}>{m.short}</b> {m.text}
                  </span>
                ))}
                {e.agreement && (
                  <span>
                    <BandDot band={e.agreement.band} color={THREAD_COLORS.agreement} reverse />
                    <b style={{ color: THREAD_COLORS.agreement }}>일치도</b> {e.agreement.value.toFixed(2)} · {e.agreement.band.label}
                  </span>
                )}
              </div>
              {e.round.briefing && <div className="muted">{e.round.briefing}</div>}
            </>
          ) : (
            <div className="muted">군집화되지 않음</div>
          )}
        </div>
      ))}
    </div>
  )
}
