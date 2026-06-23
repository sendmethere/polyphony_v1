// ─────────────────────────────────────────────────────────────
// 다양성 지표 — Hill Number 프레임워크 (정의서: stat.md)
//
// ▶ 지표 교체/추가/삭제는 이 파일만 고치면 된다.
//   - 원자료: hill(ctx) → { N, h0, h1, h2 }
//   - 등급(밴드): band* 함수
//   - 표시할 판단지표: INDICATORS 배열  ← 여기서 추가/교체/삭제
//   화면(Canvas·PolyphonyMeter)은 roundMetrics()/metricTrend() 를 그대로 그린다.
//
// N=참여자(=그 라운드 응답) 수, S=코드(군집) 수, pᵢ=코드 i 비율.
//   Hill0 = S (풍부도) / Hill1 = exp(H), H=−Σpᵢln pᵢ (실효 의견 수) / Hill2 = 1/Σpᵢ² (실효 지배 수)
//   개방성 Openness = Hill1/N · 균형성 Evenness = Hill1/Hill0 · 소수 의견 1−d (Berger–Parker)
// ─────────────────────────────────────────────────────────────

// 5단계 팔레트 (낮음→높음)
const C = ['#b5482f', '#cf6b3a', '#c98a2b', '#6f9e4b', '#2e7d52']
const pct = (v) => `${Math.round(v * 100)}%`

function pickBand(v, stops, labels, colors) {
  if (v == null || Number.isNaN(v)) return { key: 'na', label: '—', color: '#bbb' }
  let i = 0
  while (i < stops.length && v >= stops[i]) i++
  return { key: ['l0', 'l1', 'l2', 'l3', 'l4'][i], label: labels[i], color: colors[i] }
}

// 개방성(Hill1/N): 3등급 — 참여자 수가 많으면 구조적으로 낮으므로 현실 범위에 맞춤.
// <0.2 낮음 / 0.2–0.4 보통 / >0.4 높음
export function bandOpenness(v) {
  if (v == null) return { key: 'na', label: '—', color: '#bbb' }
  if (v > 0.4) return { key: 'high', label: '높음', color: C[4] }
  if (v >= 0.2) return { key: 'mid', label: '보통', color: C[2] }
  return { key: 'low', label: '낮음', color: C[0] }
}
// 균형성(Hill1/Hill0): 3등급 — <0.5 낮음 / 0.5–0.75 보통 / >0.75 높음
export function bandEvenness(v) {
  if (v == null) return { key: 'na', label: '—', color: '#bbb' }
  if (v > 0.75) return { key: 'high', label: '높음', color: C[4] }
  if (v >= 0.5) return { key: 'mid', label: '보통', color: C[2] }
  return { key: 'low', label: '낮음', color: C[0] }
}
// 소수 의견 비율 1−d (Berger–Parker): 3등급 — <0.25 낮음 / 0.25–0.5 보통 / >0.5 높음
// (낮음=최다 의견이 지배 / 높음=다수에 안 휩쓸린 소수 목소리가 많음)
export function bandMinority(v) {
  if (v == null) return { key: 'na', label: '—', color: '#bbb' }
  if (v > 0.5) return { key: 'high', label: '높음', color: C[4] }
  if (v >= 0.25) return { key: 'mid', label: '보통', color: C[2] }
  return { key: 'low', label: '낮음', color: C[0] }
}
// van der Eijk 일치도 A (순서형/리커트): <0 양극화 / 0~0.3 합의낮음 / 0.3~0.6 중간 / >0.6 높음
export function bandAgreement(a) {
  if (a == null) return { key: 'na', label: '—', color: '#bbb' }
  if (a < 0) return { key: 'pol', label: '양극화', color: '#6b3fa0' }
  if (a <= 0.3) return { key: 'low', label: '합의 낮음', color: C[0] }
  if (a <= 0.6) return { key: 'mid', label: '중간', color: C[2] }
  return { key: 'high', label: '높음', color: C[4] }
}

// 일반 3등급(LevelDot·Guide 공용)
export function metricLevel(v) {
  if (v == null) return { key: 'na', label: '—', color: '#bbb' }
  if (v > 0.6) return { key: 'high', label: '높음', color: C[4] }
  if (v >= 0.4) return { key: 'mid', label: '중간', color: C[2] }
  return { key: 'low', label: '낮음', color: C[0] }
}

// ── 컨텍스트 ─────────────────────────────────────────────────
function context(round, clusters, opinions) {
  const cs = clusters.filter((c) => c.roundId === round.id)
  const N = opinions.filter((o) => o.roundId === round.id).length
  const counts = cs.map((c) => c.opinionIds?.length || 0)
  return { round, N, S: counts.length, counts }
}

// ── Hill 수 ─────────────────────────────────────────────────
export function hill(ctx) {
  const { S, N, counts } = ctx
  if (!N || !S) return null
  let H = 0
  let D = 0
  for (const n of counts) {
    if (n <= 0) continue
    const p = n / N
    H += -p * Math.log(p)
    D += p * p
  }
  const h1 = Math.exp(H)
  const h2 = D > 0 ? 1 / D : 0
  const d = Math.max(...counts) / N // Berger–Parker 우점도(최다 군집 점유율)
  return {
    N,
    h0: S, // 풍부도
    h1, // 실효 의견 수
    h2, // 실효 지배 수
    d,
    minority: 1 - d, // 소수 의견 비율 (직관적 지배 지표)
    openness: N > 0 ? Math.min(1, h1 / N) : 0,
    // 균형성은 코드가 2개 이상일 때만 의미(S=1이면 1로 고정 → null).
    evenness: S > 1 ? Math.min(1, h1 / S) : null,
  }
}

export function hillSummary(round, clusters, opinions) {
  return hill(context(round, clusters, opinions))
}

// ── ★ 표시할 판단지표 (여기서 추가/교체/삭제) ────────────────
// compute(H) → { value, text, band, barValue(0~1) } | null
export const INDICATORS = [
  {
    id: 'openness',
    label: '관점 개방성',
    short: '개방성',
    primary: true, // 추이·세션요약·배경색 기준
    compute(H) {
      const band = bandOpenness(H.openness)
      return { value: H.openness, text: `${pct(H.openness)} · ${band.label}`, band, barValue: H.openness }
    },
  },
  {
    id: 'evenness',
    label: '관점 균형성',
    short: '균형성',
    compute(H) {
      if (H.evenness == null) return null // 코드 1개뿐 → 균형성 무의미
      const band = bandEvenness(H.evenness)
      return { value: H.evenness, text: `${pct(H.evenness)} · ${band.label}`, band, barValue: H.evenness }
    },
  },
  {
    id: 'minority',
    label: '소수 의견 비율',
    short: '소수',
    compute(H) {
      const band = bandMinority(H.minority)
      return { value: H.minority, text: `${pct(H.minority)} · ${band.label}`, band, barValue: H.minority }
    },
  },
]

export function roundMetrics(round, clusters, opinions) {
  const H = hill(context(round, clusters, opinions))
  if (!H) return []
  return INDICATORS.map((ind) => {
    const r = ind.compute(H)
    return r ? { id: ind.id, label: ind.label, short: ind.short, primary: !!ind.primary, ...r } : null
  }).filter(Boolean)
}

export function metricTrend(rounds, clusters, opinions) {
  const sorted = [...rounds].sort((a, b) => a.index - b.index).filter((r) => clusters.some((c) => c.roundId === r.id))
  const byId = new Map()
  sorted.forEach((r) => {
    roundMetrics(r, clusters, opinions).forEach((m) => {
      if (!byId.has(m.id)) byId.set(m.id, { id: m.id, label: m.label, short: m.short, points: [] })
      byId.get(m.id).points.push({ roundId: r.id, index: r.index, value: m.value, barValue: m.barValue, band: m.band, text: m.text })
    })
  })
  return [...byId.values()]
}

// 주 지표(개방성) = 추이/요약/Guide 기준
export function roundDiversity(round, clusters, opinions) {
  return hill(context(round, clusters, opinions))?.openness ?? 0
}

export function divergenceTrend(rounds, clusters, opinions) {
  const sorted = [...rounds].sort((a, b) => a.index - b.index)
  return sorted.map((r, i) => {
    const v = roundDiversity(r, clusters, opinions)
    const prev = i > 0 ? roundDiversity(sorted[i - 1], clusters, opinions) : v
    let trend = 'flat'
    if (v > prev + 0.05) trend = 'diverge'
    else if (v < prev - 0.05) trend = 'converge'
    return { roundId: r.id, index: r.index, value: v, trend }
  })
}

export function sessionSummary(rounds, clusters, opinions) {
  const series = divergenceTrend(rounds, clusters, opinions).filter((s) => clusters.some((c) => c.roundId === s.roundId))
  if (!series.length) return { count: 0, avg: 0, max: 0, min: 0, overall: 'flat' }
  const vals = series.map((s) => s.value)
  const delta = vals[vals.length - 1] - vals[0]
  return {
    count: series.length,
    avg: vals.reduce((a, b) => a + b, 0) / vals.length,
    max: Math.max(...vals),
    min: Math.min(...vals),
    overall: delta > 0.05 ? 'opened' : delta < -0.05 ? 'converged' : 'flat',
  }
}

// van der Eijk 일치도 A — 빈도분포를 수평 층으로 분해, 층별 U·(1−(S−1)/(K−1)) 빈도 가중평균
function eijkA(counts, K) {
  const maxF = Math.max(...counts)
  let num = 0
  let den = 0
  for (let L = 1; L <= maxF; L++) {
    const pat = counts.map((c) => (c >= L ? 1 : 0))
    const s = pat.reduce((a, b) => a + b, 0)
    if (!s) continue
    const first = pat.indexOf(1)
    const last = pat.lastIndexOf(1)
    let contiguous = true
    for (let i = first; i <= last; i++) if (pat[i] === 0) { contiguous = false; break }
    const A = K > 1 ? (contiguous ? 1 : -1) * (1 - (s - 1) / (K - 1)) : 1
    num += s * A
    den += s
  }
  return den ? Math.max(-1, Math.min(1, num / den)) : 0
}

// 척도형 점수 분포(ScaleViz)용 — 분포·중앙값·응답 일치도 A. (Hill 지표와 별개의 보조 시각화)
export function scoreDistribution(round, opinions) {
  if (round.responseType !== 'scale') return null
  const K = round.scaleMax || 5
  const scores = opinions
    .filter((o) => o.roundId === round.id && typeof o.score === 'number')
    .map((o) => o.score)
  const N = scores.length
  if (!N) return null
  const counts = Array.from({ length: K }, (_, i) => scores.filter((v) => v === i + 1).length)
  const sorted = [...scores].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  return { counts, median, N, K, A: eijkA(counts, K) }
}

// 객체형 종합(.xlsx)
export function roundReport(round, clusters, opinions) {
  const H = hill(context(round, clusters, opinions))
  const sd = scoreDistribution(round, opinions)
  return { hill: H, dist: sd }
}

export function retrospectiveData(rounds, clusters, opinions) {
  const sorted = [...rounds].sort((a, b) => a.index - b.index)
  const entries = sorted.map((r) => {
    const cs = clusters.filter((c) => c.roundId === r.id)
    return {
      round: r,
      clusters: cs,
      metrics: roundMetrics(r, clusters, opinions),
      hill: hill(context(r, clusters, opinions)),
      diversity: roundDiversity(r, clusters, opinions),
      opinionCount: opinions.filter((o) => o.roundId === r.id).length,
      hasClusters: cs.length > 0,
    }
  })
  const clustered = entries.filter((e) => e.hasClusters)
  let highest = null
  let lowest = null
  if (clustered.length) {
    highest = clustered.reduce((a, b) => (b.diversity > a.diversity ? b : a))
    lowest = clustered.reduce((a, b) => (b.diversity < a.diversity ? b : a))
  }
  return { entries, highest, lowest }
}
