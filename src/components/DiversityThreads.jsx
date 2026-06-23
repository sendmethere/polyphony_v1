import { useState } from 'react'

export const THREAD_COLORS = {
  openness: '#e879a8',  // 분홍
  evenness: '#9b72cf',  // 보라
  minority: '#5b8def',  // 파랑
  agreement: '#909090', // 무색 회색
}

const THREAD_HINTS = {
  openness: '참여자 수 대비 실효 의견 수 — 인원에 비해 얼마나 다양한 목소리가 나왔는지',
  evenness: '등장한 의견들이 얼마나 고르게 쓰였는지 (쏠림이 적을수록 높음)',
  minority: '가장 많은 의견에 속하지 않은 학생의 비율',
  agreement: '점수가 한 곳에 모였는지(+1) ↔ 양 끝으로 갈렸는지(−1). 참고용 지표',
}

function bandOpacity(band) {
  switch (band?.key) {
    case 'low': return 0.2
    case 'mid': return 0.6
    case 'high': return 1
    default: return 0.25
  }
}

// 일치도 A — 낮을수록 진하게, 높을수록 연하게 (역방향)
function agreementOpacity(band) {
  switch (band?.key) {
    case 'pol':
    case 'low': return 1
    case 'mid': return 0.6
    case 'high': return 0.2
    default: return 0.25
  }
}

function threadOpacity(id, band) {
  return id === 'agreement' ? agreementOpacity(band) : bandOpacity(band)
}

// 낮음·보통은 채도도 낮춤(흐릿하게). 일치도 A는 무색 회색이라 채도 변화 무의미.
function threadSaturation(id, band) {
  if (id === 'agreement') return 1
  switch (band?.key) {
    case 'low': return 0.35
    case 'mid': return 0.65
    case 'high': return 1
    default: return 0.5
  }
}

// 굵기로 등급 강조: 낮음 얇게 · 보통 중간 · 높음 매우 굵게
function bandWidth(band) {
  switch (band?.key) {
    case 'low':
    case 'pol': return 4
    case 'mid': return 8
    case 'high': return 13
    default: return 6
  }
}

// 일치도 A는 역방향: 합의 낮음/양극화일수록 굵게, 한쪽으로 쏠릴(높음)수록 얇게
function threadWidth(id, band) {
  if (id !== 'agreement') return bandWidth(band)
  switch (band?.key) {
    case 'pol':
    case 'low': return 13
    case 'mid': return 8
    case 'high': return 4
    default: return 6
  }
}

const WAVE_AMP = 9
const WAVE_PERIODS = 2
const WAVE_SAMPLES = 32

// 모든 thread가 공유하는 물결 오프셋 (y 기준선 대비 dy)
function waveTemplate(n = WAVE_SAMPLES) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n
    return WAVE_AMP * Math.sin(t * Math.PI * 2 * WAVE_PERIODS)
  })
}

function catmullRomPath(pts) {
  if (pts.length < 2) return ''
  let d = `M ${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`
  }
  return d
}

function stackedWavePath(yBase, w, offsets) {
  const pts = offsets.map((dy, i) => {
    const x = (i / (offsets.length - 1)) * w
    return [x, yBase + dy]
  })
  return catmullRomPath(pts)
}

// 다양성 지표를 물결 thread로 — 불투명도=등급(낮음 20%·보통 60%·높음 100%), 일치도 A는 무색
export default function DiversityThreads({ metrics = [], agreement = null, compact = false }) {
  const [tip, setTip] = useState(null)

  const threads = [
    ...metrics.map((m) => ({
      id: m.id,
      label: m.label,
      text: m.text,
      band: m.band,
      color: THREAD_COLORS[m.id] || '#888',
      hint: THREAD_HINTS[m.id],
    })),
    ...(agreement
      ? [{
          id: 'agreement',
          label: '응답 일치도 A',
          text: `${agreement.value.toFixed(2)} · ${agreement.band.label}`,
          band: agreement.band,
          color: THREAD_COLORS.agreement,
          hint: THREAD_HINTS.agreement,
        }]
      : []),
  ]

  if (!threads.length) return null

  const h = compact ? 72 : 88
  const w = 200
  const offsets = waveTemplate()
  const count = threads.length
  const margin = 14
  const baseGap = count > 1 ? (h - margin * 2) / (count - 1) : 0
  const threadGap = Math.max(8, baseGap - 2)
  const totalSpan = (count - 1) * threadGap
  const startY = (h - totalSpan) / 2
  const yBases = threads.map((_, i) => (count > 1 ? startY + i * threadGap : h / 2))

  return (
    <div className={`diversity-threads${compact ? ' compact' : ''}`}>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        {threads.map((t, i) => (
            <path
              key={t.id}
              d={stackedWavePath(yBases[i], w, offsets)}
              stroke={t.color}
              strokeOpacity={threadOpacity(t.id, t.band)}
              strokeWidth={threadWidth(t.id, t.band)}
              fill="none"
              strokeLinecap="round"
              style={{ filter: `saturate(${threadSaturation(t.id, t.band)})` }}
              className="diversity-thread-path cursor-pointer"
              onMouseEnter={(e) => setTip({ ...t, x: e.clientX, y: e.clientY })}
              onMouseMove={(e) => setTip((prev) => (prev?.id === t.id ? { ...prev, x: e.clientX, y: e.clientY } : prev))}
              onMouseLeave={() => setTip((prev) => (prev?.id === t.id ? null : prev))}
            />
        ))}
      </svg>
      {tip && (
        <div className="diversity-threads-tip" style={{ left: tip.x, top: tip.y }}>
          <div className="tip-title">
            <span className="tip-dot" style={{ background: tip.color, opacity: threadOpacity(tip.id, tip.band) }} />
            {tip.label} · <b>{tip.band.label}</b>
          </div>
          <div className="tip-val">{tip.text}</div>
          <div className="tip-hint">{tip.hint}</div>
        </div>
      )}
    </div>
  )
}

// 라벨 점 — 색=지표(THREAD_COLORS), 등급은 반지름·채도·불투명도로(높을수록 큼·선명·진함).
const DOT = {
  pol: { r: 6, sat: 1, op: 1 },
  low: { r: 3, sat: 0.35, op: 0.5 },
  mid: { r: 4.5, sat: 0.65, op: 0.75 },
  high: { r: 6, sat: 1, op: 1 },
}
// 일치도 A 등 역방향 지표: 낮을수록 굵고 선명(높음 모양), 높을수록 작고 흐릿(낮음 모양).
const DOT_REV = { pol: 'pol', low: 'high', mid: 'mid', high: 'low' }
export function BandDot({ band, color, reverse }) {
  const key = reverse ? (DOT_REV[band?.key] || band?.key) : band?.key
  const d = DOT[key] || DOT.mid
  return (
    <span style={{
      display: 'inline-block', width: d.r * 2, height: d.r * 2, borderRadius: '50%',
      background: color || band?.color || '#bbb', filter: `saturate(${d.sat})`, opacity: d.op,
      verticalAlign: 'middle', marginRight: 6,
    }} />
  )
}

// 세션 회고용 — 라운드별 곡선을 하나로 이어 흐름을 보여준다.
// 지표마다 한 가닥, 라운드별 구간이 그 값(굵기·채도·불투명도)으로 그려진다.
const SEG_SAMPLES = 12 // 라운드당 표본 수
export function SessionThreads({ entries = [] }) {
  const rounds = entries.filter((e) => e.hasClusters && e.metrics?.length)
  if (rounds.length < 2) return null // 이어 볼 게 있어야 의미

  const idOrder = []
  const labelById = {}
  rounds.forEach((e) => e.metrics.forEach((m) => {
    if (!idOrder.includes(m.id)) { idOrder.push(m.id); labelById[m.id] = m.short || m.label }
  }))
  // 일치도 A(점수형 라운드)도 한 가닥으로
  if (rounds.some((e) => e.agreement)) { idOrder.push('agreement'); labelById.agreement = '일치도 A' }
  const bandOf = (e, id) => (id === 'agreement' ? e.agreement?.band : e.metrics.find((m) => m.id === id)?.band)

  const n = rounds.length
  const count = idOrder.length
  const tickH = 14
  const margin = 14
  const gap = 24
  const w = Math.max(200, n * 52)
  const h = margin * 2 + (count - 1) * gap + tickH
  const yBases = idOrder.map((_, i) => (count > 1 ? margin + i * gap : (h - tickH) / 2))
  const amp = Math.min(7, gap / 3)
  const total = n * SEG_SAMPLES
  const sinAt = (k) => Math.sin((k / SEG_SAMPLES) * Math.PI * 2)

  return (
    <div className="session-threads">
      <div className="session-threads-legend">
        {idOrder.map((id) => (
          <span key={id}><span className="stl-dot" style={{ background: THREAD_COLORS[id] || '#888' }} />{labelById[id]}</span>
        ))}
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet">
        {idOrder.map((id, ti) =>
          rounds.map((e, ri) => {
            const band = bandOf(e, id)
            if (!band) return null // 해당 없는 라운드(예: 점수형 아님)는 미표시
            const pts = []
            for (let s = 0; s <= SEG_SAMPLES; s++) {
              const k = ri * SEG_SAMPLES + s
              const x = (k / total) * w
              pts.push(`${x.toFixed(1)},${(yBases[ti] + amp * sinAt(k)).toFixed(1)}`)
            }
            return (
              <path
                key={`${id}-${ri}`}
                d={`M ${pts.join(' L ')}`}
                fill="none"
                stroke={THREAD_COLORS[id] || '#888'}
                strokeWidth={threadWidth(id, band) * 0.6}
                strokeOpacity={threadOpacity(id, band)}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ filter: `saturate(${threadSaturation(id, band)})` }}
              />
            )
          })
        )}
        {rounds.map((e, ri) => (
          <text
            key={e.round.id}
            x={(((ri + 0.5) * SEG_SAMPLES) / total) * w}
            y={h - 3}
            textAnchor="middle"
            className="session-thread-tick"
          >R{e.round.index + 1}</text>
        ))}
      </svg>
      <ul className="session-threads-qs">
        {rounds.map((e) => (
          <li key={e.round.id}>
            <b>R{e.round.index + 1}</b>
            <span>{e.round.question}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// 오른쪽 다양성 패널용 — 한 지표의 라운드별 값을 곡선 한 가닥으로(굵기·채도·불투명도=값).
// vector-effect로 굵기는 px 고정, 가로는 컨테이너 폭에 맞춰 늘인다.
export function MetricStrand({ id, points = [] }) {
  const n = points.length
  if (!n) return null
  const w = Math.max(120, n * 40)
  const h = 30
  const yb = h / 2
  const amp = 7
  const total = n * SEG_SAMPLES
  const sinAt = (k) => Math.sin((k / SEG_SAMPLES) * Math.PI * 2)
  const color = THREAD_COLORS[id] || '#888'
  return (
    <svg className="metric-strand" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      {points.slice(1).map((p, i) => (
        <line
          key={`b-${p.roundId}`}
          x1={(((i + 1) * SEG_SAMPLES) / total) * w}
          x2={(((i + 1) * SEG_SAMPLES) / total) * w}
          y1="0" y2={h}
          stroke="var(--paper-line)"
          strokeWidth="1"
          strokeDasharray="2 2"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {points.map((p, ri) => {
        const band = p.band
        const pts = []
        for (let s = 0; s <= SEG_SAMPLES; s++) {
          const k = ri * SEG_SAMPLES + s
          pts.push(`${((k / total) * w).toFixed(1)},${(yb + amp * sinAt(k)).toFixed(1)}`)
        }
        return (
          <path
            key={p.roundId}
            d={`M ${pts.join(' L ')}`}
            fill="none"
            stroke={color}
            strokeWidth={threadWidth(id, band) * 0.6}
            strokeOpacity={threadOpacity(id, band)}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            style={{ filter: `saturate(${threadSaturation(id, band)})` }}
          >
            <title>{`라운드 ${p.index + 1}: ${p.text}`}</title>
          </path>
        )
      })}
    </svg>
  )
}
