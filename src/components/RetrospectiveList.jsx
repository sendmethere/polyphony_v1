import LevelDot from './LevelDot.jsx'
import { retrospectiveData, likertStats } from '../lib/polyphony.js'

// 우측 패널용 컴팩트 "질문별 돌아보기" — 최고/최저 다양성 + 라운드별 브리핑.
export default function RetrospectiveList({ snapshot }) {
  const { entries, highest, lowest } = retrospectiveData(
    snapshot.rounds,
    snapshot.clusters,
    snapshot.opinions
  )

  return (
    <div className="panel stack">
      <h3>질문별 돌아보기</h3>

      {highest && (
        <div className="tiny" style={{ lineHeight: 1.5 }}>
          <div>
            <span style={{ color: '#2e7d52', fontWeight: 700 }}>최고 다양성</span> · {Math.round(highest.diversity * 100)}%
            <div className="muted">{highest.round.question}</div>
          </div>
          <div style={{ marginTop: 4 }}>
            <span style={{ color: '#b5482f', fontWeight: 700 }}>최저 다양성</span> · {Math.round(lowest.diversity * 100)}%
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
              <div style={{ margin: '3px 0' }}>
                <LevelDot value={e.diversity} /> 다양성 {Math.round(e.diversity * 100)}% · 엔트로피 {Math.round(e.shannon * 100)}%
              </div>
              {e.round.responseType === 'scale' && (() => {
                const s = likertStats(e.round, snapshot.opinions)
                return s.n ? (
                  <div style={{ margin: '3px 0' }}>
                    📊 평균 {s.mean.toFixed(2)} · 표준편차 {s.std.toFixed(2)} · 일치도 {Math.round(s.agreement * 100)}%
                  </div>
                ) : null
              })()}
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
