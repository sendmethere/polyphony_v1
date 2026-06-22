import InfoButton from './InfoButton.jsx'
import LevelDot from './LevelDot.jsx'
import { divergenceTrend, sessionSummary, metricLevel, likertStats } from '../lib/polyphony.js'

const TREND_LABEL = { diverge: '발산 ⇢', converge: '수렴 ⇠', flat: '유지 —' }
const OVERALL_LABEL = { opened: '전체적으로 열림 ⇢', converged: '전체적으로 모임 ⇠', flat: '대체로 유지 —' }

// 다양성/엔트로피 지표 패널 — 관리자·교사(모니터링) 공용.
// 우세도가 아니라 "의견이 얼마나 갈라져 있나"를 0~100% 로 보여준다(학생 무대엔 미표시).
export default function PolyphonyMeter({ rounds, clusters, opinions }) {
  const trend = divergenceTrend(rounds, clusters, opinions)
  const latest = trend[trend.length - 1]
  const summary = sessionSummary(rounds, clusters, opinions)

  // 척도형 라운드의 일치도(agreement) 시리즈 — 응답이 있는 척도형만
  const agreementSeries = [...rounds]
    .sort((a, b) => a.index - b.index)
    .filter((r) => r.responseType === 'scale')
    .map((r) => {
      const s = likertStats(r, opinions)
      return { roundId: r.id, index: r.index, agreement: s.agreement, mean: s.mean, n: s.n }
    })
    .filter((x) => x.n > 0)

  return (
    <div className="panel stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>폴리포니 미터</h3>
        <InfoButton title="폴리포니 미터 — 다양성 지표">
          <p>
            두 지표 모두 <b>"어떤 의견이 우세한가"</b>가 아니라 <b>"의견이 얼마나 여러 갈래로, 고르게 갈라져 있나"</b>를 0~100%로 잰 값입니다. 군집 인원수를 쓰므로 학생 무대에는 표시하지 않습니다.
          </p>
          <p>
            <b>Simpson 다양성</b> = 1 − Σ(pᵢ)². 아무 의견 2개를 집었을 때 서로 다른 군집일 확률.
            큰 그림의 균등함(쏠림 정도)에 민감합니다.
          </p>
          <p>
            <b>Shannon 엔트로피</b> = −Σ pᵢ·ln(pᵢ) 를 ln(의견 수)로 정규화. 다음 의견이 어느 군집일지의
            예측 불가능성으로, <b>희귀한 소수·외톨이 목소리</b>의 등장에 더 민감합니다.
          </p>
          <p>
            <b>세션 전체</b> 값은 군집이 만들어진 각 라운드의 지표를 <b>평균</b>낸 것입니다(범위=라운드별 최저~최고,
            방향=첫 라운드 대비 마지막 라운드).
          </p>
          <p>
            <b>척도형 점수 일치도</b>(agreement) = 1 − (표준편차 ÷ 최대표준편차). 점수가 한 곳으로 모일수록
            높음(100%), 양극단으로 갈릴수록 낮음(0%).
          </p>
          <p>
            ⚠️ <b>대화주의에서 일치도가 높다고 "좋은" 게 아닙니다.</b> 모두 같은 점수로 모인 것은 오히려
            <b> 한 목소리로의 수렴(monologic)</b>에 가까운 신호예요. 그래서 좋음/나쁨을 암시하지 않으려고
            신호등 색 대신 <b>무채색 회색</b>으로 표시합니다.
          </p>
          <p>
            중요: <b>점수의 일치 ≠ 목소리의 일치</b>. 같은 점수라도 그 이유(주관식)는 제각각일 수 있습니다.
            "같은 점수, 다른 이유"는 표면 아래 다성성이 살아있는 상태예요. 일치도는 반드시 위의 텍스트 다양성과
            <b> 나란히</b> 읽으세요.
          </p>
          <p>
            <b>신호등</b>: <span style={{ color: '#b5482f' }}>● 낮음</span>(0~32%) ·{' '}
            <span style={{ color: '#c98a2b' }}>● 중간</span>(33~65%) ·{' '}
            <span style={{ color: '#2e7d52' }}>● 높음</span>(66~100%). 낮음이 "나쁨"은 아닙니다 — 대화가 한 곳으로 모인
            수렴 국면일 수 있어요. 추이와 함께 읽으세요.
          </p>
          <p className="tiny muted">
            (pᵢ = i번째 군집의 의견 수 ÷ 그 라운드 전체 의견 수. 둘 다 군집이 많고 고를수록 1에 가까워집니다.
            AI 군집화 결과에 의존하므로 절대값보다 추이로 읽으세요.)
          </p>
        </InfoButton>
      </div>

      {latest && (clusters || []).length > 0 ? (
        <>
          {summary.count > 0 && (
            <div className="summary-box">
              <div className="tiny" style={{ fontWeight: 700 }}>세션 전체 ({summary.count}개 라운드)</div>
              <div className="tiny">
                평균 Simpson <b>{Math.round(summary.avgDiversity * 100)}%</b> · 평균 Shannon{' '}
                <b>{Math.round(summary.avgShannon * 100)}%</b>
              </div>
              <div className="tiny muted">
                범위 {Math.round(summary.minDiversity * 100)}~{Math.round(summary.maxDiversity * 100)}% ·{' '}
                {OVERALL_LABEL[summary.overall]}
              </div>
            </div>
          )}

          <div className="tiny" style={{ fontWeight: 600, marginTop: 8 }}>
            <LevelDot value={latest.diversity} withLabel /> Simpson 다양성{' '}
            <b>{Math.round(latest.diversity * 100)}%</b> · {TREND_LABEL[latest.trend]}
          </div>
          <Bars trend={trend} field="diversity" />
          <div className="tiny" style={{ fontWeight: 600, marginTop: 10 }}>
            <LevelDot value={latest.shannon} withLabel /> Shannon 엔트로피{' '}
            <b>{Math.round(latest.shannon * 100)}%</b>
          </div>
          <Bars trend={trend} field="shannon" />

          {/* 척도형 일치도 — 무채색 (다양성 신호등과 구분) */}
          {agreementSeries.length > 0 && (
            <>
              <div className="tiny" style={{ fontWeight: 600, marginTop: 12 }}>
                척도형 점수 일치도{' '}
                <b>{Math.round(agreementSeries[agreementSeries.length - 1].agreement * 100)}%</b>
                <span className="muted" style={{ fontWeight: 400 }}> · 수렴 신호</span>
              </div>
              <div className="row" style={{ gap: 4, alignItems: 'flex-end', height: 48, marginTop: 6 }}>
                {agreementSeries.map((a) => (
                  <div
                    key={a.roundId}
                    title={`라운드 ${a.index + 1}: 일치도 ${Math.round(a.agreement * 100)}% · 평균 ${a.mean.toFixed(2)}`}
                    style={{
                      flex: 1,
                      height: `${Math.max(4, a.agreement * 100)}%`,
                      background: '#8a857a',
                      borderRadius: 3,
                    }}
                  />
                ))}
              </div>
              <div className="tiny muted">
                점수가 모일수록 높음 = 수렴. <b>높다고 좋은 게 아닙니다</b> — 한 목소리로 모였다는 신호.
                같은 점수라도 이유(텍스트)는 다를 수 있으니 위 다양성과 함께 보세요.
              </div>
            </>
          )}
        </>
      ) : (
        <div className="tiny muted">군집화가 완료되면 다양성·엔트로피가 표시됩니다.</div>
      )}
    </div>
  )
}

function Bars({ trend, field }) {
  return (
    <div className="row" style={{ gap: 4, alignItems: 'flex-end', height: 48, marginTop: 6 }}>
      {trend.map((t) => {
        const v = t[field] || 0
        const lv = metricLevel(v)
        return (
          <div
            key={t.roundId}
            title={`라운드 ${t.index + 1}: ${Math.round(v * 100)}% (${lv.label})`}
            style={{
              flex: 1,
              height: `${Math.max(4, v * 100)}%`,
              background: lv.color,
              borderRadius: 3,
            }}
          />
        )
      })}
    </div>
  )
}
