import { likertStats } from '../lib/polyphony.js'

// 리커트(척도형) 응답을 수직선(number line) 위 분포로 표시.
// 1..scaleMax 축에 점수별 막대(빈도) + 평균 위치 마커. 평균·표준편차·일치도 함께.
// hideParametric=true 이면 순서형 척도에 부적절한 평균·표준편차(와 평균 마커)를 감춘다(교사 뷰).
export default function ScaleViz({ round, opinions, hideParametric = false }) {
  const max = round.scaleMax || 5
  const scores = opinions
    .filter((o) => o.roundId === round.id && typeof o.score === 'number')
    .map((o) => o.score)
  const s = likertStats(round, opinions)

  if (!s.n) return <div className="round-metrics">📊 {max}점 척도 · 응답 대기</div>

  const counts = Array.from({ length: max }, (_, i) => scores.filter((v) => v === i + 1).length)
  const maxCount = Math.max(...counts, 1)
  const pos = (v) => ((v - 1) / (max - 1)) * 100 // 1→0%, max→100%

  return (
    <div className="scaleviz">
      <div className="scaleviz-head">
        📊 응답 {s.n} ·{' '}
        {!hideParametric && (
          <>
            평균 <b>{s.mean.toFixed(2)}</b> · 표준편차 <b>{s.std.toFixed(2)}</b> ·{' '}
          </>
        )}
        <span className="level-dot" style={{ background: '#8a857a' }} /> 일치도 {Math.round(s.agreement * 100)}%
      </div>

      <div className="numline">
        {/* 점수별 빈도 막대 */}
        {counts.map((c, i) => (
          <div key={i} className="numline-bar-wrap" style={{ left: `${pos(i + 1)}%` }}>
            {c > 0 && <span className="numline-cnt">{c}</span>}
            <div className="numline-bar" style={{ height: `${(c / maxCount) * 46 + 2}px` }} />
            <span className="numline-tick">{i + 1}</span>
          </div>
        ))}
        {/* 기준선 */}
        <div className="numline-axis" />
        {/* 평균 마커 */}
        <div className="numline-mean" style={{ left: `${pos(s.mean)}%` }} title={`평균 ${s.mean.toFixed(2)}`}>
          <span className="numline-mean-tip">▲ {s.mean.toFixed(1)}</span>
        </div>
      </div>

      {round.scaleLabels && (
        <div className="scaleviz-anchors">
          <span>1 · {round.scaleLabels.min}</span>
          <span>{max} · {round.scaleLabels.max}</span>
        </div>
      )}
    </div>
  )
}
