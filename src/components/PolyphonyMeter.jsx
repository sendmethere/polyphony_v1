import InfoButton from './InfoButton.jsx'
import { metricTrend, sessionSummary, divergenceTrend } from '../lib/polyphony.js'

const OVERALL_LABEL = { opened: '전체적으로 열림 ⇢', converged: '전체적으로 모임 ⇠', flat: '대체로 유지 —' }

// 다양성 지표 패널 — metrics.js 의 INDICATORS 를 그대로 그린다(지표 교체 시 코드 변경 불필요).
export default function PolyphonyMeter({ rounds, clusters, opinions }) {
  const series = metricTrend(rounds, clusters, opinions)
  const trend = divergenceTrend(rounds, clusters, opinions).filter((s) => clusters.some((c) => c.roundId === s.roundId))
  const latestTrend = trend[trend.length - 1]
  const summary = sessionSummary(rounds, clusters, opinions)
  const hasData = series.length > 0 && series[0].points.length > 0

  return (
    <div className="panel stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>다양성 지표</h3>
        <InfoButton title="이 숫자들, 어떻게 읽나요?">
          <p>"몇 개의 의견이 있었나"를 넘어 <b>얼마나 열린 의미 공간이 만들어졌는지</b>를 봅니다. (학생 화면에는 보이지 않습니다.)</p>

          <p className="info-term">먼저, 세 가지 기본 수 (Hill)</p>
          <p><b>풍부도</b> = 등장한 의견 종류 수.<br />
          <b>실효 의견 수</b> = 빈도까지 따졌을 때 "사실상 몇 종"이 의미 있게 쓰였나.<br />
          <b>실효 지배 수</b> = 실제로 담화를 주도한 의견이 몇 개인가.<br />
          <span className="muted">예: 4종이 나왔지만 실효 2.6, 지배 1.9 → 사실상 두 갈래가 주도.</span></p>

          <p className="info-term">관점 개방성</p>
          <p>참여자 수 대비 실효 의견 수입니다. <b>인원에 비해 얼마나 다양한 목소리가 나왔나.</b>
          <br /><Band c="#b5482f">낮음</Band> · <Band c="#c98a2b">보통</Band> · <Band c="#2e7d52">높음</Band>
          <br /><span className="muted">참여자가 많으면(예: 20명+) 구조적으로 값이 작게 나옵니다. 절대치보다 추이로 보세요.</span></p>

          <p className="info-term">관점 균형성</p>
          <p>등장한 의견들이 얼마나 <b>고르게</b> 쓰였나(쏠림이 적을수록 높음).
          <br /><Band c="#b5482f">낮음</Band> 몇몇 의견에 편중 · <Band c="#c98a2b">보통</Band> · <Band c="#2e7d52">높음</Band> 골고루</p>

          <p className="info-term">소수 의견 비율</p>
          <p>가장 많은 의견에 속하지 <b>않은</b> 학생의 비율입니다.
          <br /><Band c="#b5482f">낮음</Band> 한 의견이 다수 지배 · <Band c="#c98a2b">보통</Band> · <Band c="#2e7d52">높음</Band> 소수 목소리가 많음</p>

          <p className="info-term">응답 일치도 A <span className="muted">(점수형 질문에서만)</span></p>
          <p>점수가 한 곳에 모였는지(+1) ↔ 양 끝으로 갈렸는지(−1)를 나타냅니다.
          <br /><b style={{ color: '#6b3fa0' }}>양극화</b>(A&lt;0) 두 진영으로 갈림 · <Band c="#b5482f">합의 낮음</Band> · <Band c="#c98a2b">중간</Band> · <Band c="#2e7d52">높음</Band> 한 점에 합의
          <br />"<b>어디로</b> 모였는지"는 알려주지 않으니 <b>중앙값</b>과 함께 보세요. 합의가 곧 좋음은 아니며, <b>양극화·흩어짐이 더 풍부한 대화의 신호</b>일 수 있습니다.</p>

          <p className="info-term">한 가지 주의</p>
          <p>높다고 좋은 것도, 낮다고 나쁜 것도 아닙니다. 펼치는 국면엔 높고 모으는 국면엔 낮아집니다. 한 시점보다 <b>라운드별 추이(막대)</b>를 보세요.</p>

          <p className="tiny muted">막대는 라운드별 값입니다. 통계 정의·공식은 stat.md.</p>
        </InfoButton>
      </div>

      {hasData ? (
        <>
          {summary.count > 0 && (
            <div className="summary-box">
              <div className="tiny" style={{ fontWeight: 700 }}>세션 전체 ({summary.count}개 라운드)</div>
              <div className="tiny">평균 다양성 <b>{Math.round(summary.avg * 100)}%</b></div>
              <div className="tiny muted">
                범위 {Math.round(summary.min * 100)}~{Math.round(summary.max * 100)}%
                {latestTrend ? ` · ${OVERALL_LABEL[summary.overall]}` : ''}
              </div>
            </div>
          )}

          {series.map((s) => {
            const last = s.points[s.points.length - 1]
            return (
              <div key={s.id}>
                <div className="tiny" style={{ fontWeight: 600, marginTop: 10 }}>
                  <Dot c={last.band.color} /> {s.label} <b>{last.text}</b>
                </div>
                <div className="row" style={{ gap: 4, alignItems: 'flex-end', height: 48, marginTop: 6 }}>
                  {s.points.map((p) => (
                    <div
                      key={p.roundId}
                      title={`라운드 ${p.index + 1}: ${p.text}`}
                      style={{ flex: 1, height: `${Math.max(4, p.barValue * 100)}%`, background: p.band.color, borderRadius: 3 }}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </>
      ) : (
        <div className="tiny muted">군집화가 완료되면 다양성 지표가 표시됩니다.</div>
      )}
    </div>
  )
}

function Dot({ c }) {
  return <span className="level-dot" style={{ background: c }} />
}

function Band({ c, children }) {
  return <b style={{ color: c }}>{children}</b>
}
