// 다양성/엔트로피 0~1 값을 높음/중간/낮음 3등급(신호등)으로 판정.
// 임계값: < 0.33 낮음(red) / 0.33~0.66 중간(amber) / ≥ 0.66 높음(green)
export function metricLevel(value) {
  if (value >= 0.66) return { key: 'high', label: '높음', color: '#2e7d52' }
  if (value >= 0.33) return { key: 'mid', label: '중간', color: '#c98a2b' }
  return { key: 'low', label: '낮음', color: '#b5482f' }
}

// 0~1 값을 5단계 배경색(빨강→주황→노랑→연두→초록)으로. 값이 높을수록 초록.
// 다양성/엔트로피 박스 배경에 사용(텍스트 가독성을 위해 연한 톤).
export function metricBand(value) {
  if (value >= 0.8) return { bg: '#dff0e5', border: '#b3dcc0' } // 초록
  if (value >= 0.6) return { bg: '#edf4d6', border: '#d4e2a4' } // 연두
  if (value >= 0.4) return { bg: '#faf2cc', border: '#ecdc9c' } // 노랑
  if (value >= 0.2) return { bg: '#f9e5cd', border: '#ecc99c' } // 주황
  return { bg: '#f6dad3', border: '#e6b0a4' } // 빨강
}

// 폴리포니 지표 — "우세도"가 아니라 "다양성/발산도"를 측정한다.
// 모니터링(교사) 화면 전용. 학생 무대에는 절대 노출하지 않는다.

// 한 라운드의 다양성: 군집(외톨이 포함) 수가 많을수록, 또 군집 크기가 고를수록 높다.
// 0~1 정규화. (Simpson 다양성 지수 변형)
export function roundDiversity(round, clusters, opinions) {
  const cs = clusters.filter((c) => c.roundId === round.id)
  const os = opinions.filter((o) => o.roundId === round.id)
  if (!cs.length || !os.length) return 0
  const total = os.length
  // Simpson: 1 - Σ(p_i^2). 군집이 많고 고를수록 1에 가까움.
  let sumSq = 0
  for (const c of cs) {
    const p = (c.opinionIds?.length || 0) / total
    sumSq += p * p
  }
  return Math.max(0, Math.min(1, 1 - sumSq))
}

// Shannon 엔트로피(정규화). 희귀한 소수 의견의 등장에 더 민감하다.
// H = −Σ p·ln(p), 전체 의견 수의 ln 으로 나눠 0~1 로 정규화.
export function roundShannon(round, clusters, opinions) {
  const cs = clusters.filter((c) => c.roundId === round.id)
  const os = opinions.filter((o) => o.roundId === round.id)
  const total = os.length
  if (total <= 1 || !cs.length) return 0
  let H = 0
  for (const c of cs) {
    const p = (c.opinionIds?.length || 0) / total
    if (p > 0) H += -p * Math.log(p)
  }
  const norm = H / Math.log(total) // 모두 제각각일 때 1
  return Math.max(0, Math.min(1, norm))
}

// 리커트(척도형) 응답 분석 — 평균·표준편차·일치도.
// 일치도(agreement) = 1 − (표준편차 / 최대가능표준편차). 1에 가까울수록 점수가 모임.
export function likertStats(round, opinions) {
  const scores = opinions
    .filter((o) => o.roundId === round.id && typeof o.score === 'number')
    .map((o) => o.score)
  const n = scores.length
  if (!n) return { n: 0, mean: 0, std: 0, agreement: 0, max: round.scaleMax || 5 }
  const mean = scores.reduce((a, b) => a + b, 0) / n
  const variance = scores.reduce((a, b) => a + (b - mean) ** 2, 0) / n
  const std = Math.sqrt(variance)
  // 점수 범위가 1..max 일 때, 최대 표준편차는 절반이 1, 절반이 max 로 갈렸을 때 = (max-1)/2
  const maxStd = (round.scaleMax - 1) / 2
  const agreement = maxStd > 0 ? Math.max(0, Math.min(1, 1 - std / maxStd)) : 1
  return { n, mean, std, agreement, max: round.scaleMax }
}

// 세션 회고용 데이터 — 질문(라운드)별 브리핑·다양성·엔트로피 + 최고/최저 다양성 질문.
export function retrospectiveData(rounds, clusters, opinions) {
  const sorted = [...rounds].sort((a, b) => a.index - b.index)
  const entries = sorted.map((r) => {
    const cs = clusters.filter((c) => c.roundId === r.id)
    return {
      round: r,
      clusters: cs,
      diversity: roundDiversity(r, clusters, opinions),
      shannon: roundShannon(r, clusters, opinions),
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

// 세션 전체 요약 — 군집이 만들어진 라운드들의 평균/최고/최저 다양성·엔트로피와
// 첫 라운드 대비 마지막 라운드의 전체 흐름(열림/모임).
export function sessionSummary(rounds, clusters, opinions) {
  const series = divergenceTrend(rounds, clusters, opinions).filter((s) =>
    clusters.some((c) => c.roundId === s.roundId)
  )
  if (!series.length) {
    return { count: 0, avgDiversity: 0, avgShannon: 0, maxDiversity: 0, minDiversity: 0, overall: 'flat' }
  }
  const mean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length
  const divs = series.map((s) => s.diversity)
  const shs = series.map((s) => s.shannon)
  const delta = series[series.length - 1].diversity - series[0].diversity
  return {
    count: series.length,
    avgDiversity: mean(divs),
    avgShannon: mean(shs),
    maxDiversity: Math.max(...divs),
    minDiversity: Math.min(...divs),
    overall: delta > 0.05 ? 'opened' : delta < -0.05 ? 'converged' : 'flat',
  }
}

// 직전 라운드 대비 방향: 다양성이 늘면 발산(diverge), 줄면 수렴(converge).
// 방향 판정은 Simpson 다양성 기준. 두 지표(simpson·shannon)를 함께 반환.
export function divergenceTrend(rounds, clusters, opinions) {
  const sorted = [...rounds].sort((a, b) => a.index - b.index)
  return sorted.map((r, i) => {
    const d = roundDiversity(r, clusters, opinions)
    const sh = roundShannon(r, clusters, opinions)
    const prev = i > 0 ? roundDiversity(sorted[i - 1], clusters, opinions) : d
    let trend = 'flat'
    if (d > prev + 0.05) trend = 'diverge'
    else if (d < prev - 0.05) trend = 'converge'
    return { roundId: r.id, index: r.index, diversity: d, shannon: sh, trend }
  })
}
