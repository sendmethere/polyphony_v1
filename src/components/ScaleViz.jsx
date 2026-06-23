import { scoreDistribution } from '../lib/polyphony.js'

// 척도형 점수 분포를 수직선(number line) 위에 표시 + 중앙값. (Hill 지표와 별개의 보조 그림)
export default function ScaleViz({ round, opinions }) {
  const s = scoreDistribution(round, opinions)
  if (!s) return <div className="round-metrics">{round.scaleMax || 5}점 척도 · 응답 대기</div>

  const max = s.K
  const maxCount = Math.max(...s.counts, 1)
  const pos = (v) => ((v - 1) / (max - 1)) * 100

  return (
    <div className="scaleviz">
      <div className="scaleviz-head">점수 분포 · 응답 {s.N} · 중앙값 <b>{s.median}</b></div>

      <div className="numline">
        {s.counts.map((c, i) => (
          <div key={i} className="numline-bar-wrap" style={{ left: `${pos(i + 1)}%` }}>
            {c > 0 && <span className="numline-cnt">{c}</span>}
            <div className="numline-bar" style={{ height: `${(c / maxCount) * 46 + 2}px` }} />
            <span className="numline-tick">{i + 1}</span>
          </div>
        ))}
        <div className="numline-axis" />
        <div className="numline-mean" style={{ left: `${pos(s.median)}%`, borderLeftColor: 'var(--ink)' }} title={`중앙값 ${s.median}`}>
          <span className="numline-mean-tip" style={{ color: 'var(--ink)' }}>중앙값 {s.median}</span>
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
