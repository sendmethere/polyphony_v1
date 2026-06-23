import InfoButton from './InfoButton.jsx'
import { MetricStrand, BandDot, THREAD_COLORS } from './DiversityThreads.jsx'
import { metricTrend, bandOpenness, bandEvenness, bandMinority } from '../lib/polyphony.js'

const BAND_BY_ID = { openness: bandOpenness, evenness: bandEvenness, minority: bandMinority }

// 다양성 지표 패널 — metrics.js 의 INDICATORS 를 그대로 그린다(지표 교체 시 코드 변경 불필요).
export default function PolyphonyMeter({ rounds, clusters, opinions }) {
  const series = metricTrend(rounds, clusters, opinions)
  const hasData = series.length > 0 && series[0].points.length > 0

  return (
    <div className="panel stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>다양성 지표</h3>
        <InfoButton title="이 숫자들, 어떻게 읽나요?">
          <p>"몇 개의 의견이 있었나"를 넘어 <b>얼마나 열린 의미 공간이 만들어졌는지</b>를 봅니다. (학생 화면에는 보이지 않습니다.)</p>

          <p className="info-term">곡선 읽는 법</p>
          <p>지표는 각 라운드 칼럼에 <b>색깔 물결 곡선</b>으로 겹쳐 그려집니다. 같은 색이라도
          <b> 값이 높을수록 굵고·선명하고·진하게</b>, 낮을수록 <b>가늘고·흐릿하고·반투명</b>하게 보입니다.</p>
          <div className="curve-legend">
            <div className="cl-row cl-head"><span className="cl-name" /><span>낮음</span><span>보통</span><span>높음</span></div>
            {CURVE_LEGEND.map((r) => (
              <div className="cl-row" key={r.label}>
                <span className="cl-name" style={{ color: r.c }}>{r.label}</span>
                {r.levels.map((lv, i) => <CurveSwatch key={i} c={r.c} lvl={lv} />)}
              </div>
            ))}
          </div>
          <p className="tiny muted"><b>응답 일치도 A는 반대로 읽습니다</b> — 합의가 낮을(또는 양극화)수록 굵고 진하게, 한쪽으로 쏠려 합의가 높을수록 가늘고 반투명하게(표의 좌우가 뒤집힘).</p>

          <p className="info-term">먼저, 세 가지 기본 수 (Hill)</p>
          <p><b>풍부도</b> = 등장한 의견 종류 수.<br />
          <b>실효 의견 수</b> = 빈도까지 따졌을 때 "사실상 몇 종"이 의미 있게 쓰였나.<br />
          <b>실효 지배 수</b> = 실제로 담화를 주도한 의견이 몇 개인가.<br />
          <span className="muted">예: 4종이 나왔지만 실효 2.6, 지배 1.9 → 사실상 두 갈래가 주도.</span></p>

          <p className="info-term"><CurveTag c="#e879a8" /> 관점 개방성 <span className="muted">(분홍 곡선)</span></p>
          <p>참여자 수 대비 실효 의견 수입니다. <b>인원에 비해 얼마나 다양한 목소리가 나왔나.</b>
          <br /><Band c="#b5482f">낮음</Band> · <Band c="#c98a2b">보통</Band> · <Band c="#2e7d52">높음</Band>
          <br /><span className="muted">참여자가 많으면(예: 20명+) 구조적으로 값이 작게 나옵니다. 절대치보다 추이로 보세요.</span></p>

          <p className="info-term"><CurveTag c="#9b72cf" /> 관점 균형성 <span className="muted">(보라 곡선)</span></p>
          <p>등장한 의견들이 얼마나 <b>고르게</b> 쓰였나(쏠림이 적을수록 높음).
          <br /><Band c="#b5482f">낮음</Band> 몇몇 의견에 편중 · <Band c="#c98a2b">보통</Band> · <Band c="#2e7d52">높음</Band> 골고루</p>

          <p className="info-term"><CurveTag c="#5b8def" /> 소수 의견 비율 <span className="muted">(파랑 곡선)</span></p>
          <p>가장 많은 의견에 속하지 <b>않은</b> 학생의 비율입니다.
          <br /><Band c="#b5482f">낮음</Band> 한 의견이 다수 지배 · <Band c="#c98a2b">보통</Band> · <Band c="#2e7d52">높음</Band> 소수 목소리가 많음</p>

          <p className="info-term"><CurveTag c="#909090" /> 응답 일치도 A <span className="muted">(회색 곡선 · 점수형 질문에서만)</span></p>
          <p>점수가 한 곳에 모였는지(+1) ↔ 양 끝으로 갈렸는지(−1)를 나타냅니다.
          <br /><b style={{ color: '#6b3fa0' }}>양극화</b>(A&lt;0) 두 진영으로 갈림 · <Band c="#b5482f">합의 낮음</Band> · <Band c="#c98a2b">중간</Band> · <Band c="#2e7d52">높음</Band> 한 점에 합의
          <br />"<b>어디로</b> 모였는지"는 알려주지 않으니 <b>중앙값</b>과 함께 보세요. 합의가 곧 좋음은 아니며, <b>양극화·흩어짐이 더 풍부한 대화의 신호</b>일 수 있습니다.</p>

          <p className="info-term">한 가지 주의</p>
          <p>높다고 좋은 것도, 낮다고 나쁜 것도 아닙니다. 펼치는 국면엔 높고 모으는 국면엔 낮아집니다. 한 시점보다 <b>라운드별 추이(곡선)</b>를 보세요.</p>

          <p className="tiny muted">곡선은 라운드별 값입니다(굵고 진할수록 높음). 통계 정의·공식은 stat.md.</p>
        </InfoButton>
      </div>

      {hasData ? (
        <div className="strand-scroll">
          <div className="strand-inner" style={{ minWidth: series[0].points.length * 64 }}>
            <div className="strand-axis">
              {series[0].points.map((p) => <span key={p.roundId}>R{p.index + 1}</span>)}
            </div>
            {series.map((s) => {
              const avg = s.points.reduce((a, p) => a + p.value, 0) / s.points.length
              const band = (BAND_BY_ID[s.id] || (() => s.points[s.points.length - 1].band))(avg)
              return (
                <div key={s.id}>
                  <div className="tiny strand-label" style={{ fontWeight: 600, marginTop: 10 }}>
                    <BandDot band={band} color={THREAD_COLORS[s.id]} /> {s.label} <b>{Math.round(avg * 100)}% · {band.label}</b>
                    <span className="muted"> (평균)</span>
                  </div>
                  <MetricStrand id={s.id} points={s.points} />
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="tiny muted">군집화가 완료되면 다양성 지표가 표시됩니다.</div>
      )}
    </div>
  )
}


function Band({ c, children }) {
  return <b style={{ color: c }}>{children}</b>
}

// 등급별 곡선 모양 — 실제 렌더링과 같은 규칙(굵을수록·진할수록·선명할수록 높음). 미리보기용 축소 굵기.
const CW = { low: 2.2, mid: 3.6, high: 5.5 }
const CSAT = { low: 0.35, mid: 0.65, high: 1 }
const COP = { low: 0.25, mid: 0.6, high: 1 }
// 일치도 A(회색)는 역방향: 낮음 칼럼에 굵은 모양이 오도록 levels를 뒤집어 둔다.
const CURVE_LEGEND = [
  { label: '개방성', c: '#e879a8', levels: ['low', 'mid', 'high'] },
  { label: '균형성', c: '#9b72cf', levels: ['low', 'mid', 'high'] },
  { label: '소수 의견', c: '#5b8def', levels: ['low', 'mid', 'high'] },
  { label: '일치도 A', c: '#909090', levels: ['high', 'mid', 'low'] },
]

function CurveSwatch({ c, lvl }) {
  return (
    <svg width="46" height="14" viewBox="0 0 46 14" aria-hidden="true" style={{ verticalAlign: 'middle' }}>
      <path d="M2,7 C8,2 15,12 23,7 C31,2 38,12 44,7" fill="none" stroke={c}
        strokeWidth={CW[lvl]} strokeOpacity={COP[lvl]} strokeLinecap="round"
        style={{ filter: `saturate(${CSAT[lvl]})` }} />
    </svg>
  )
}

function CurveTag({ c }) {
  return (
    <svg width="26" height="11" viewBox="0 0 26 11" aria-hidden="true" style={{ verticalAlign: 'middle', marginRight: 3 }}>
      <path d="M1,5.5 C5,1 9,10 14,5.5 C19,1 22,10 25,5.5" fill="none" stroke={c} strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
