import { metricLevel } from '../lib/polyphony.js'

// 신호등 점 — 다양성/엔트로피 값을 높음(초록)/중간(주황)/낮음(빨강)으로.
export default function LevelDot({ value, withLabel = false }) {
  const lv = metricLevel(value)
  return (
    <span className="level-dot-wrap" title={`${lv.label} (${Math.round(value * 100)}%)`}>
      <span className="level-dot" style={{ background: lv.color }} />
      {withLabel && <span style={{ color: lv.color, fontWeight: 600 }}>{lv.label}</span>}
    </span>
  )
}
